import { Bytes32, CreatePendingUploadParams } from '../types.js'

import { 
  Pool, 
  QueryResultRow,
  Client
} from 'pg'
import dotenv from 'dotenv'
import { logger } from '../shared/logger.js'
import { eventBus } from '../infrastructure/eventBus.js'

dotenv.config();

export type UploadStatus = "PENDING" | "CONFIRMED" | "DISMISSED";

export interface PendingUploadRow {
  uid: number;
  content_cid: string;               // CHAR(46) → llega como string
  metadata_cid: string;              // CHAR(46)
  extra_cids: unknown | null; // JSONB → lo puedes refinar luego
  status: UploadStatus;
  uploaded_at: string;       // pg normalmente lo da como string ISO
  purged: boolean;
}

export interface UploadUidRow { uid: number };

/**
 * Types for upload_sessions table
 */

export type UploadSessionStatus = 'ACTIVE' | 'READY' | 'COMPLETED' | 'EXPIRED' | 'INCONSISTENT'

export interface UploadSessionRow {
  uid: string
  creator_address: string
  started_at: string
  short_video_completed: boolean
  status: UploadSessionStatus
}
export interface UploadSessionUidRow { uid: string }

export interface ShortVideoRow {
  upload_session_id: string
  original: string
  standardized: string | null
  standardized_cid: string | null
  mid_res: string | null
  mid_res_cid: string | null
  low_res: string | null
  low_res_cid: string | null
  metadata: string | null
  metadata_cid: string | null
  is_copyright_free: boolean | null
  is_explicit_free: boolean | null
}

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
})

pool.on('error', (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
})

//Creating a new reserved connection only for listening pg notify events
const client = new Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

(async () => {
  await client.connect()
  await client.query('LISTEN upload_session_ready')
  client.on('notification', (msg) => {
    if(msg.payload) {
      eventBus.emit('upload_session_ready', { sessionId: msg.payload})
    }
  })
})()

export async function query<T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<{ rows: T[]}> {
  try {
    const result = await pool.query<T>(text, params)
    return { rows: result.rows };
  } catch (error) {
    logger.error({error}, 'error on db. Check if the DB is running')
    throw error
  }
}

/**
 * Usage sample:
      createPendingUpload({
        content_cid: 'third try',
        metadata_cid: 'fdsafe',
        extra_cids: {
          videoFullRes: 'fesafaesfes',
          ffeas: 'feafes'
        }
     })
 * 
 */
//Chore: This table desapeared in the new Api so you should delete this method as there is no usage
export async function createPendingUpload(
  params: CreatePendingUploadParams
): Promise<PendingUploadRow> {
  const { rows } = await query<PendingUploadRow>(`
    INSERT INTO public.uploads (
      content_cid, metadata_cid, extra_cids
      ) VALUES ($1, $2, $3)
  `, [
    params.metadata_cid,
    params.extra_cids? JSON.stringify(params.extra_cids): null
  ])
  return rows[0];
}


export async function createUploadEntryWithNoData() : Promise<number> {
  const { rows } = await query<UploadUidRow>(`
    INSERT INTO public.uploads
    VALUES (DEFAULT)
    RETURNING uid;
  `)
  return rows[0].uid;
}

/**
 * Usage sample:
  updateUploadSessionStatus('3f53d610', 'COMPLETED')
 */
async function updateUploadSessionStatus(
  sessionId: string, 
  status: UploadSessionStatus 
): Promise<void> {
  await query<PendingUploadRow>(`
    UPDATE public.upload_sessions
    SET status= $2
	  WHERE uid= $1;
  `, [sessionId, status])
}

export async function updateMetadataCid(uid: number, metadataCid?: string) {
  const { rows } = await query<PendingUploadRow>(`
    UPDATE public.uploads
    SET metadata_cid='${metadataCid}'
    WHERE uid=${uid};
  `)
  return rows[0];
}

export async function updateContentCid(uid: number, contentCid?: string) {
  const { rows } = await query<PendingUploadRow>(`
    UPDATE public.uploads
    SET content_cid='${contentCid}'
    WHERE uid=${uid};
  `)
  return rows[0];
}

async function createUploadSession(
  creatorAddress: string
): Promise<UploadSessionUidRow> {
  const { rows } = await query<UploadSessionRow>(`
    INSERT INTO public.upload_sessions (creator_address)
    VALUES ($1)
    RETURNING uid;
  `, [creatorAddress])
  return rows[0]
}

async function getUploadSession(
  sessionId: string
) : Promise<UploadSessionRow | null> {
  const { rows } = await query<UploadSessionRow>(`
    SELECT *
    FROM public.upload_sessions 
    WHERE uid = $1;
  `, [sessionId])
  return rows[0]
}

/**
 * Extracts all the upload sessions that are on 'ready' state, this means that they are processed but not in IPFS yet
 */
async function getReadyUploadSessions(): Promise<UploadSessionRow[]> {
  const { rows } = await query<UploadSessionRow>(`
    SELECT * FROM public.upload_sessions
    WHERE status = 'READY';
  `)
  return rows
}

async function upsertShortVideo(
  sessionId: string,
  shortVideoUri: string
) : Promise<ShortVideoRow> {
  const { rows } = await query<ShortVideoRow>(`
    INSERT INTO public.short_videos
    (upload_session_id, original)
    VALUES($1, $2)
    ON CONFLICT (upload_session_id)
    DO UPDATE SET original = EXCLUDED.original
    RETURNING *
  `, [sessionId, shortVideoUri])
  return rows[0]
}

async function getShortVideo(sessionId: string) : Promise<ShortVideoRow | null> {
  const { rows } = await query<ShortVideoRow>(`
    SELECT * FROM public.short_videos
    WHERE upload_session_id = $1    
  `, [sessionId])
  return rows[0]
}

async function updateShortVideoStandardized(
  sessionId: string, 
  standardizedVideoUri: string,
  standardizedVideoCid: Bytes32
) : Promise<void> {
  await query(`
    UPDATE public.short_videos
    SET standardized = $2, standardized_cid = $3
    WHERE upload_session_id = $1
  `, [sessionId, standardizedVideoUri, standardizedVideoCid])
}

async function updateShortVideoMetadata(
  sessionId: string,
  metadataFilePath: string,
  metadataIpfsCid: Bytes32
) {
  await query(`
    UPDATE public.short_videos
    SET metadata = $2, metadata_cid = $3
    WHERE upload_session_id = $1
  `, [sessionId, metadataFilePath, metadataIpfsCid])
}

/**
 * @developer Note that latest_block_evaluated is a big int in the postgresql db
 * but in pg that is our handler 
*/
async function getLatestBlockEvaluated(network: string = "avalanche_fuji"): Promise<string> {
  const { rows } = await query(`
    SELECT latest_block_evaluated FROM public.blockchain_state
    WHERE network = $1
  `, [network])
  return rows[0]
}

async function getShortVideosInReadyState(): Promise<ShortVideoRow[]> {
  const { rows } = await query(`
    SELECT
      sv.upload_session_id, 
      sv.original, 
      sv.standardized,
      sv.standardized_cid,
      sv.mid_res,
      sv.mid_res_cid, 
      sv.low_res, 
      sv.low_res_cid,
      sv.metadata,
      sv.metadata_cid,
      sv.is_copyright_free,
      sv.is_explicit_free
    from public.short_videos sv
    INNER JOIN public.upload_sessions us 
      ON sv.upload_session_id = us.uid
    WHERE us.status = 'READY'
  `, )
  return rows
}

export const db = {
  createUploadSession,
  getUploadSession,
  getReadyUploadSessions,
  updateUploadSessionStatus,
  upsertShortVideo,
  getShortVideo,
  updateShortVideoStandardized,
  updateShortVideoMetadata,
  getLatestBlockEvaluated,
  getShortVideosInReadyState
}