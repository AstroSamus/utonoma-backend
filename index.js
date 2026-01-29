import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Busboy from "busboy";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import cors from 'cors';

dotenv.config();
const app = express()
app.use(cors())

const PORT = process.env.PORT || 3000

const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  throw new Error('Missing env PINATA_JWT')
}

const PINATA_PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

// (2000MB = 2GB)
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES || 2000 * 1024 * 1024);

// (50mb)
const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES || 50 * 1024 * 1024);

// (60 seconds)
const PINATA_TIMEOUT_MS = Number(process.env.PINATA_TIMEOUT_MS || 60_000);

app.use(express.json({ limit: MAX_JSON_BYTES }));
app.use(helmet())

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/', (req, res) => {
  res.send('Hello, World!')
})

app.post("/pinFileToIpfs", async (req, res) => {
  const bb = Busboy({
    headers: req.headers,
    limits: {
      files: 1,
      fileSize: MAX_FILE_BYTES, // corta si excede
    },
  });

  let uploadHandled = false;
  let aborted = false;

  // Para abortar el request a Pinata si el cliente se desconecta
  const controller = new AbortController();
  const abortAll = (reason) => {
    if (aborted) return;
    aborted = true;
    controller.abort(reason);
  };

  req.on("aborted", () => {
    console.log("[req] aborted by client");
    abortAll("client_aborted");
  });

  res.on("close", () => {
    if (!res.headersSent) {
      console.log("[res] closed before response");
      abortAll("res_closed_early");
    }
  });

  req.on("aborted", () => console.log("[req] aborted by client"));
  req.on("close", () => console.log("[req] close"));
  req.on("end", () => console.log("[req] end"));
  req.on("error", (e) => console.log("[req] error", e));

  bb.on("field", (name, val) => console.log("[bb] field", name));
  bb.on("file", (name, _s, info) => console.log("[bb] file", name, info));
  bb.on("finish", () => console.log("[bb] finish"));
  bb.on("close", () => console.log("[bb] close"));
  bb.on("error", (e) => console.log("[bb] error", e));

  bb.on("file", async (fieldname, fileStream, info) => {
    if (uploadHandled) {
      fileStream.resume();
      return;
    }
    uploadHandled = true;

    if (fieldname !== "file") {
      fileStream.resume();
      return res.status(400).json({ error: "Expected field 'file'." });
    }

    const { filename, mimeType } = info;

    // Busboy emite este evento si se excede el límite de size
    fileStream.on("limit", () => {
      abortAll("file_too_large");
      // Ojo: responder aquí puede chocar si ya respondiste; lo manejamos abajo.
    });

    fileStream.on("data", (chunk) => console.log("[file] chunk", chunk.length));
    fileStream.on("end", () => console.log("[file] end"));
    fileStream.on("close", () => console.log("[file] close"));
    fileStream.on("error", (e) => console.log("[file] error", e));
    fileStream.on("limit", () => console.log("[file] LIMIT TRIGGERED"));

    try {
      // Construimos el multipart para Pinata
      const form = new FormData();

      // 1) Archivo como stream
      form.append("file", fileStream, {
        filename: filename || "upload.bin",
        contentType: mimeType || "application/octet-stream",
      });

      // 2) Metadata opcional (puedes quitarlo)
      // form.append("pinataMetadata", JSON.stringify({ name: filename || "upload" }));

      // 3) Options opcionales (ej. pinataOptions / CID version)
      form.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));

      const headers = {
        ...form.getHeaders(),
        Authorization: `Bearer ${PINATA_JWT}`,
      };


      console.log("-> starting pinata request");
      const pinataResp = await axios.post(PINATA_PIN_FILE_URL, form, {
        headers,
        signal: controller.signal,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: PINATA_TIMEOUT_MS,
        // Nota: axios + form-data hace streaming internamente.
      });
      console.log("<- pinata responded", pinataResp.status);

      // Respuesta típica trae IpfsHash (CID)
      const data = pinataResp.data;

      // Normaliza un poco, porque depende del endpoint/version
      const cid = data.IpfsHash || data.cid || data.Hash || null;

      if (!cid) {
        return res.status(502).json({
          error: "Pinata response did not include a CID",
          raw: data,
        });
      }

      return res.status(200).json({
        ...data,
      });
    } catch (err) {
      if (aborted && controller.signal.aborted) {
        const reason = controller.signal.reason;

        if (reason === "file_too_large") {
          return res.status(413).json({ error: "File too large", maxBytes: MAX_FILE_BYTES });
        }

        if (reason === "client_aborted" || reason === "res_closed_early") {
          // aquí normalmente ya no puedes responder, pero al menos no te quedas colgado
          return;
        }
      }

    }
  });

  bb.on("error", (e) => {
    return res.status(400).json({ error: "Malformed multipart request", details: e.message });
  });

  bb.on("finish", () => {
    // Si nunca llegó el campo 'file'
    if (!uploadHandled && !res.headersSent) {
      return res.status(400).json({ error: "No file received (field 'file' missing)." });
    }
  });

  req.pipe(bb);
});


app.post("/pinJsonToIpfs", async (req, res) => {
  try {
    // Validación mínima
    const json = req.body;

    if (json === null || json === undefined) {
      return res.status(400).json({ error: "Missing JSON body" });
    }

    // Opcional: si quieres asegurarte de que sea objeto/array y no string
    const t = typeof json;
    const isValidJsonValue =
      t === "object" || t === "number" || t === "boolean" || t === "string";

    if (!isValidJsonValue) {
      return res.status(400).json({ error: "Invalid JSON body type" });
    }

    const headers = {
      Authorization: `Bearer ${PINATA_JWT}`,
      "Content-Type": "application/json",
    };

    const pinataResp = await axios.post(PINATA_PIN_JSON_URL, {
        pinataContent: json,
        pinataOptions: { cidVersion: 0 },
        pinataMetadata: { name: "Metadata" }
      }, {
        headers,
        timeout: PINATA_TIMEOUT_MS,
      }
    );

    const data = pinataResp.data;
    const cid = data.IpfsHash || data.cid || data.Hash || null;

    if (!cid) {
      return res.status(502).json({
        error: "Pinata response did not include a CID",
        raw: data,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data || err?.message || "Unknown error";

    return res.status(status).json({
      error: "Failed to pin JSON to Pinata",
      details,
    });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`)
})