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

export interface VideoMetadata {
  shortVideoTitle: string;
  shortVideoDescription: string;
}

export function isVideoMetadata(data: unknown): data is VideoMetadata {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.shortVideoTitle === "string" &&
    typeof obj.shortVideoDescription === "string"
  )
}

export type UploadVideoToIpfsResponse = {
  metadataCid?: PinataPinJsonResponse,
  contentCid?: PinataPinJsonResponse
}

export interface GetActualVideoInfoResult {
  width: number;
  height: number;
  duration: number;    // in ms
  codecName: string | null
  codecType: string | null
  formatName: string | null
  isValid: boolean
  isWebM: boolean
}

export interface CodecInfo {
  codecName: string | null
  codecType: string | null
  formatName: string | null
}

export type Bytes32 = `0x${string}` & {
  readonly __brand: 'Bytes32'
}