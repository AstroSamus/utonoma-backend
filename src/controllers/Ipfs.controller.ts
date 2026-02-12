import { Request, Response } from 'express'
import Busboy from 'busboy';
import {
  isVideoMetadata,
  VideoMetadata,
  UploadVideoToIpfsResponse,
  PinataPinJsonResponse
} from '../types'
import {
  uploadJsonToIpfsService,
  uploadVideoToIpfsService
} from '../services/ipfs.service'

const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm'])

/**
 * 
 * @notice Send the metadata first in the form as in this way the client can start uploading 
 * the video to ipfs while the metadata is being uploaded, this will reduce the total upload time
 */
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
  const responseData: UploadVideoToIpfsResponse = {}

  const respondOnce = (status: number, payload: any) => {
    if (responded || res.headersSent) return;

    responded = true;
    res.status(status).json(payload);
  };

  let isMetadataIncluided = false
  let isVideoIncluided = false

  //logic for the metadata
  busboy.on('field', (name, value) => {
    if(isMetadataIncluided) 
      return respondOnce(400, { error: "Duplicate metadata in the request." })
    try {
      const metadata = JSON.parse(value)
      if(!isVideoMetadata(metadata))
        return respondOnce(400, { error: "Field 'metadata' must be valid JSON." })

      isMetadataIncluided = true;

      (async () => {
        const metadataCid = await uploadJsonToIpfsService(metadata)
        responseData.metadataCid = metadataCid
        //respond only if both the video and the metadata have been uploaded to IPFS, 
        // otherwise wait for the other one to finish
        if(responseData?.metadataCid && responseData?.contentCid)
          respondOnce(200, responseData)
      })()
      //if upload is successful you will upload this to the database for the pin unpin worker
    } catch {
      return respondOnce(400, { error: "Error uploading metadata to ipfs." });
    }
  })

  //logic for the video
  busboy.on('file', (fieldname, fileStream, info) => {
    if(isVideoIncluided) 
      return respondOnce(400, { error: "Duplicate video in the request." })
    const { mimeType } = info
    if(!ALLOWED_VIDEO_TYPES.has(mimeType)) {
      fileStream.resume() //discards the stream
      return respondOnce(415, { error: 'Unsupported media type'})
    }

    isVideoIncluided = true;

    (async () => {
      try {
        const contentCid = await uploadVideoToIpfsService(fileStream, mimeType) //pipe stream to IPFS
        responseData.contentCid = contentCid
        //respond only if both the video and the metadata have been uploaded to IPFS, 
        // otherwise wait for the other one to finish
        if(responseData?.metadataCid && responseData?.contentCid)
          respondOnce(200, responseData)
      } catch (e) {
        respondOnce(500, { error: 'fail when uploading video to IPFS' });
      }
    })()
  })

  req.pipe(busboy)
}