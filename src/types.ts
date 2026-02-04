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

export interface CreatePendingUploadParams {
  content_cid: string;
  metadata_cid: string;
  extra_cids: object | null;
}

type UploadJsonToIpfsInput = 
  | { //short videos
      type: "json";
      shortVideoTitle: string;
      shortVideoDescription: string;
    }
  // you can add other dtos here
