import { PendingUploadRow, query, UploadStatus } from "../db";
import {CreatePendingUploadParams} from '../types'

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
/**
 * Usage sample:
  updateUploadStatus(5, 'DISMISSED')
 */