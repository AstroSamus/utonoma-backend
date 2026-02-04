import dotenv from "dotenv"
import { 
  PinataPinJsonResponse, 
  UploadJsonToIpfsInput,
  isPinataPinJsonResponse 
} from '../types'

dotenv.config();
const PINATA_PIN_JSON_URL: URL = new URL("https://api.pinata.cloud/pinning/pinJSONToIPFS");
const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  throw new Error('Missing env PINATA_JWT in ipfs service')
}

export async function uploadJsonToIpfs(payload: UploadJsonToIpfsInput): Promise<PinataPinJsonResponse> {
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