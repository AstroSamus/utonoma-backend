import { 
  PendingUploadRow, 
  UploadUidRow , 
  query, 
  UploadStatus ,
  UploadSessionRow,
  UploadSessionUidRow,
  ShortVideoRow
} from "../db.js";
import { CreatePendingUploadParams } from '../types.js'

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
  updateUploadStatus(5, 'DISMISSED')
 */
export async function updateUploadStatus(
  uid: number, 
  status: UploadStatus
): Promise<PendingUploadRow> {
  const { rows } = await query<PendingUploadRow>(`
    UPDATE public.uploads 
    SET status='${status}'
	  WHERE uid=${uid};
  `)
  return rows[0]
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

export const db = {
  createUploadSession,
  getUploadSession,
  upsertShortVideo,
  getShortVideo
}