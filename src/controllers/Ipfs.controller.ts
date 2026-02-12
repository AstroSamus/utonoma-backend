import { Request, Response } from 'express'
import Busboy from 'busboy';
import {
  isVideoMetadata,
  videoMetadata
} from '../types'
import {
  uploadJsonToIpfsService,
  uploadVideoToIpfsService
} from '../services/ipfs.service'

export async function uploadVideoToIpfsController(req: Request, res: Response) {
  //Validate the we are dealing with multipart form data
  const ct = req.headers['content-type'] || ''
  if (!ct.includes('multipart/form-data')) {
    return res.status(415).json({ error: 'Expected multipart/form-data' })
  }

  const busboy = Busboy({
    headers: req.headers,
    limits: {
      files: 1, //one file that will be the video
      fields: 1, //one field that will be the metadata
      //fileSize: MAX_FILE_BYTES, limit the size of the video
    },
  })

  let responded = false;

  const respondOnce = (status: number, payload: any) => {
    if (responded || res.headersSent) return;
    responded = true;
    res.status(status).json(payload);
  };



  busboy.on('field', (name, value) => {
    try {
      const metadata = JSON.parse(value)
      if(!isVideoMetadata(metadata))
        return respondOnce(400, { error: "Field 'metadata' must be valid JSON." });
      (async () => {await uploadJsonToIpfsService(metadata)})()
      //if upload is successful you will upload this to the database for the pin unpin worker
    } catch {
      return respondOnce(400, { error: "Error uploading metadata to ipfs." });
    }
  })

}