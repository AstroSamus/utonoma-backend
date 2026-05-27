import express, { json, Request, Response } from "express";
import dotenv from "dotenv"
import { PendingUploadRow, query } from "./db.js";
import {
  createPendingUpload,
  updateUploadStatus,
  createUploadEntryWithNoData
} from './services/db.service.js'
import {
  VideoMetadata, 
  PinataPinJsonPayload, 
  PinataPinJsonResponse,
  isPinataPinJsonResponse
} from './types.js'
import { uploadVideoToIpfsController } from "./controllers/Ipfs.controller.js";


dotenv.config();

const PINATA_PIN_JSON_URL: URL = new URL("https://api.pinata.cloud/pinning/pinJSONToIPFS");

const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  throw new Error('Missing env PINATA_JWT')
}

const app: express.Application = express();
const PORT: number = 3000;

app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
  try {
    const log = await createUploadEntryWithNoData()
    updateUploadStatus(5, 'DISMISSED')
    res.json({ message: "hello world" });
  } catch (error) {
    console.log(error)
    res.json({ error });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

app.get('/allRows', async (req: Request, res: Response) => {
  try {
    const { rows } = await query<PendingUploadRow>(
      'SELECT * FROM public.uploads ORDER BY uid ASC'
    )
    return res.status(200).json({ rows });
  } catch (error) {
    console.error("Error fetching rows:", error);
    return res.status(500).json({ error: "Failed to fetch rows from database" });
  }
});

app.post('/testVideo', (req: Request, res: Response) => {
  uploadVideoToIpfsController(req, res)
})

/**
 * flujo para hacer uploadToUtonoma
 * se checa que el body contenga el video de forma correcta
 * se checa que el body contenga la metadata de forma correcta
 * se sube el video a ipfs y se sube la metadata a ipfs de forma concurrente
 * cuando ambos jobs terminan:
 * Se hace una llamada a createPendingUpload pasandole los cids retornados en el paso anterior
 */


app.post('/uploadToUtonoma', async (req: Request, res: Response) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Body must be a JSON object" });
  }
  //when casting with partial, all the properties become optional, this is useful
  //as we don't know if all the properties where incluided in the request
  const { shortVideoTitle, shortVideoDescription } = body as Partial<VideoMetadata>;

  if (typeof shortVideoTitle !== "string" || typeof shortVideoDescription !== "string") {
    return res.status(400).json({ error: "shortVideoTitle and shortVideoDescription are required and must be strings" });
  }

  const pinataPayload : PinataPinJsonPayload = {
    pinataContent: {
      shortVideoTitle,
      shortVideoDescription,
    },
    pinataOptions: { cidVersion: 0 },
    pinataMetadata: { name: "test from typescript 123" }
  }

  try {
    const rawPinataResp = await fetch(PINATA_PIN_JSON_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pinataPayload),
      }
    )

    const pinataResp: unknown = await rawPinataResp.json();

    if (!isPinataPinJsonResponse(pinataResp)) {
      return res.status(502).json({ error: "Invalid Pinata response" });
    }

    const endpointResp = pinataResp as PinataPinJsonResponse;

    console.log("Upload response:", endpointResp);
    return res.status(200).json(endpointResp);
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
    return res.status(500).json({ error: "Failed to upload metadata to Pinata" });
  }
})

app.get('/uploadShortVideo', async (req, res) => {
  //1. validate that the req has all the information needed
  /*const [resultA, restultB] = await Promise.all(
    uploadShortVideoMetadata(req.body.metadata), //uploads metadata json to ipfs
    uploadMainContent(req.body.content) //uploads the content to ipfs
  )*/

})

/**
 * 1. Receive multiparcer form data the video in the request
 * 2. Pass the stream to pinata cloud via multiform part data
*/

async function uploadMainContent(content) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(content);
    }, 3000);
  });
}

async function uploadShortVideoMetadata(payload) {
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Body must be a JSON object" });
  }
  //when casting with partial, all the properties become optional, this is useful
  //as we don't know if all the properties where incluided in the request
  const { shortVideoTitle, shortVideoDescription } = body as Partial<VideoMetadata>;

  if (typeof shortVideoTitle !== "string" || typeof shortVideoDescription !== "string") {
    return res.status(400).json({ error: "shortVideoTitle and shortVideoDescription are required and must be strings" });
  }

  const pinataPayload : PinataPinJsonPayload = {
    pinataContent: {
      shortVideoTitle,
      shortVideoDescription,
    },
    pinataOptions: { cidVersion: 0 },
    pinataMetadata: { name: "test from typescript 123" }
  }

  try {
    const rawPinataResp = await fetch(PINATA_PIN_JSON_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pinataPayload),
      }
    )

    const pinataResp: unknown = await rawPinataResp.json();

    if (!isPinataPinJsonResponse(pinataResp)) {
      return res.status(502).json({ error: "Invalid Pinata response" });
    }

    const endpointResp = pinataResp as PinataPinJsonResponse;

    console.log("Upload response:", endpointResp);
    return res.status(200).json(endpointResp);
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
    return res.status(500).json({ error: "Failed to upload metadata to Pinata" });
  }
} 