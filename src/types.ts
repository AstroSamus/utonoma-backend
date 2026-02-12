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

export interface videoMetadata {
  type: "json";
  shortVideoTitle: string;
  shortVideoDescription: string;
}

export function isVideoMetadata(data: unknown): data is videoMetadata {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    obj.type === "json" &&
    typeof obj.shortVideoTitle === "string" &&
    typeof obj.shortVideoDescription === "string"
  )
}