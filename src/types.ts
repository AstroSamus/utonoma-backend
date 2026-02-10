export interface VideoMetadata {
  shortVideoTitle: string;
  shortVideoDescription: string;
}

export interface PinataPinJsonPayload {
  pinataContent: unknown;
  pinataOptions?: {
    cidVersion?: number;
  };
  pinataMetadata?: {
    name?: string;
  };
}

export interface PinataPinJsonResponse {
  IpfsHash?: string;
}

export function isPinataPinJsonResponse(data: unknown): data is PinataPinJsonResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  const hasValidCid = typeof d.IpfsHash === "string"
  return hasValidCid;
}

export interface CreatePendingUploadParams {
  content_cid: string;
  metadata_cid: string;
  extra_cids: object | null;
}

export type UploadJsonToIpfsInput = 
  | { //short videos
      type: "json";
      shortVideoTitle: string;
      shortVideoDescription: string;
    }
  // you can add other dtos here