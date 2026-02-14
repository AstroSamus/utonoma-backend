import { 
  PendingUploadRow, 
  UploadUidRow , 
  query, 
  UploadStatus } from "../db";
import {CreatePendingUploadParams} from '../types'
import logger from "../infrastructure/logger";

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
export async function createPendingUpload(
  params: CreatePendingUploadParams
): Promise<PendingUploadRow> {
  const { rows } = await query<PendingUploadRow>(`
    INSERT INTO public.uploads (
      content_cid, metadata_cid, extra_cids
      ) VALUES (
        '${params.content_cid}', '${params.metadata_cid}', '${params.extra_cids? JSON.stringify(params.extra_cids): null }'
      )
  `)
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