import express, { json, Request, Response } from "express";
import dotenv from "dotenv"

interface VideoMetadata {
  shortVideoTitle: string;
  shortVideoDescription: string;
}

interface PinataPinJsonPayload {
  pinataContent: unknown;
  pinataOptions?: {
    cidVersion?: number;
  };
  pinataMetadata?: {
    name?: string;
  };
}

interface PinataPinJsonResponse {
  IpfsHash?: string;
  cid?: string;
  Hash?: string;
  PinSize?: number;
  Timestamp?: string;
  isDuplicate?: boolean;
  // otros campos que quieras agregar si los usas
}

dotenv.config();

const PINATA_TIMEOUT_MS = Number(process.env.PINATA_TIMEOUT_MS || 60_000);
const PINATA_PIN_JSON_URL: URL = new URL("https://api.pinata.cloud/pinning/pinJSONToIPFS");

const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  throw new Error('Missing env PINATA_JWT')
}

const app: express.Application = express();
const PORT: number = 3000;

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "hello world" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

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

  try {
    const rawPinataResp = await fetch(PINATA_PIN_JSON_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pinataContent: {
            shortVideoTitle,
            shortVideoDescription,
          },
          pinataOptions: { cidVersion: 0 },
          pinataMetadata: { name: "test from typescript 123" },
          timeout: PINATA_TIMEOUT_MS,
        }),
      }
    )

    const pinataResp: PinataPinJsonResponse = await rawPinataResp.json();
    /**
     * {
        "IpfsHash": "QmUvpuwFTv746Du2UKQ9rdm676aVKUMahVqMZfJ4hHEdGE",    }
     */

    console.log("Upload response:", pinataResp);
    return res.status(200).json({ message: "Metadata received successfully", pinataResp });
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
    return res.status(500).json({ error: "Failed to upload metadata to Pinata" });
  }
})