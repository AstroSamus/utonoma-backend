import dotenv from "dotenv"
import { 
  PinataPinJsonResponse, 
  VideoMetadata,
  isPinataPinJsonResponse 
} from '../types.js'
import { Readable } from "node:stream";
import FormData from 'form-data'
import axios from "axios"

dotenv.config();
const PINATA_PIN_JSON_URL: URL = new URL("https://api.pinata.cloud/pinning/pinJSONToIPFS");
const PINATA_PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  throw new Error('Missing env PINATA_JWT in ipfs service')
}

export async function uploadJsonToIpfsService(payload: VideoMetadata): Promise<PinataPinJsonResponse> {
  const rawPinataResp = await fetch(PINATA_PIN_JSON_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  )

  const pinataResp: unknown = await rawPinataResp.json();

  if (!isPinataPinJsonResponse(pinataResp)) {
    throw new Error(`
      error when pinning json to ipfs, error object was
      ${payload}
      `)
  }
  //by using the type guard, typescript already knows the type of pinataResp
  return pinataResp;
}

/**
 * Streams a readable stream to ipfs
 */
export async function uploadVideoToIpfsService(
  fileStream: Readable,
  mimeType: string
): Promise<PinataPinJsonResponse> {
  
  const formToUpload = new FormData()

  formToUpload.append('file', fileStream, {
    filename: 'video',
    contentType: mimeType,
  });

  formToUpload.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));

  const headers = {
    ...formToUpload.getHeaders(),
    Authorization: `Bearer ${PINATA_JWT}`,
  }

  try {
    const pinataResp = await axios.post(PINATA_PIN_FILE_URL, formToUpload, {
      headers,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const cid = pinataResp.data

    if (!isPinataPinJsonResponse(cid)) {
      throw new Error(`
        error when pinning video to ipfs
      `)
    }

    return cid;
  } catch (error) {
    throw error
  }
}