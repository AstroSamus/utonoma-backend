import { PendingUploadRow, query } from "../db";

export interface CreatePendingUploadParams {
  content_cid: string;
  metadata_cid: string;
  extra_cids: object | null;
}

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