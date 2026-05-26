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
import { 
  createUploadEntryWithNoData,
  updateUploadStatus,
  updateMetadataCid,
  updateContentCid
} from '../services/db.service'
import logger from "../infrastructure/logger"
import { createWriteStream } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { getActualVideoInfo } from '../utils/videoUtils';

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska'
])
const MAX_SHORT_VIDEO_BYTES = 500 * 1024 * 1024 //500 MB

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
      fileSize: MAX_SHORT_VIDEO_BYTES,
    },
  })

  let responded = false;
  const responseData: UploadVideoToIpfsResponse = {}

  let isMetadataIncluided = false
  let isVideoIncluided = false


  //logic for content upload registry
  // Create a pending upload with empty data
  const entryUid = await createUploadEntryWithNoData()

  busboy.on('field', (name, value) => {
    if(isMetadataIncluided)
      return respondOnce(400, { error: "Duplicate metadata in the request." })
    isMetadataIncluided = true;
    try {
      const metadata = JSON.parse(value)
      if(!isVideoMetadata(metadata))
        return respondOnce(400, { error: "Field 'metadata' must be valid JSON." });

      (async () => {
        const metadataCid = await uploadJsonToIpfsService(metadata)

        await updateMetadataCid(entryUid, metadataCid.IpfsHash) //add metadata cid to the db entry

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
  busboy.on('file', async(fieldname, fileStream, info) => {
    if(isVideoIncluided) 
      return respondOnce(400, { error: "Duplicate video in the request." })
    isVideoIncluided = true
    const { mimeType } = info
    if(!ALLOWED_VIDEO_TYPES.has(mimeType)) {
      fileStream.resume() //discards the stream
      return respondOnce(415, { error: 'Unsupported media type'})
    }

    const tempPath = path.join('/tmp', randomUUID());
    const writeStream = createWriteStream(tempPath);

    try {
      await pipeline(fileStream, writeStream)
      const actualVideoInfo = await getActualVideoInfo(tempPath)
      if(!actualVideoInfo.isValid) {
        //delete the video from tmp
        return respondOnce(500, { error: 'Upload failed' })
      }
    } catch (error) {
      return respondOnce(500, { error: 'Upload failed' })
    }


    /*
    (async () => {
      try {
        const contentCid = await uploadVideoToIpfsService(fileStream, mimeType) //pipe stream to IPFS
        
        await updateContentCid(entryUid, contentCid.IpfsHash)

        responseData.contentCid = contentCid
        //respond only if both the video and the metadata have been uploaded to IPFS, 
        // otherwise wait for the other one to finish
        if(responseData?.metadataCid && responseData?.contentCid)
          respondOnce(200, responseData)
      } catch (e) {
        respondOnce(500, { error: 'fail when uploading video to IPFS' });
      }
    })()*/

    fileStream.on('limit', () => {
      fileStream.unpipe()
      fileStream.resume()
      respondOnce(413, { error: 'File too large' })
    })
  })

  busboy.on('finish', () => {
    if (!isVideoIncluided) return respondOnce(400, { error: "Missing file field 'file'." });
    if (!isMetadataIncluided) return respondOnce(400, { error: "Missing JSON field 'metadata'." });
  })

  req.pipe(busboy)

  function respondOnce(status: number, payload: any) {
    if (responded || res.headersSent) return;
    if(status >= 400) {
      //update status in content uploads table to DISMISSED
      try {
        updateUploadStatus(entryUid, 'DISMISSED')
      } catch(error) {
        logger.error({error}, `
          critical error: content was not uploaded correctly to IPFS
          either, because there is a problem uploading metadata or content
          this content should be flagged as DISMISSED, so the worker can 
          delete it. But this operation was not completed for some reason.
          ADMIN OF THE DB SHOULD MANUALLY UPDATE THE STATUS OF THE ENTRY WITH
          UID ${entryUid} TO DISMISSED.
          `
        )
      }
    }
    responded = true
    res.status(status).json(payload)
  };

}