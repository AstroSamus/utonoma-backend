import { Request, Response } from 'express'
import { ethers } from 'ethers'
import { db } from '../services/db.service.js'
import { 
  ApiResponse,
  ApiError
} from '../types.js'
import Busboy from 'busboy'
import { 
  createWriteStream,
  unlink
} from 'fs'
import { writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import os from 'os'
import { pipeline } from 'stream/promises'
import { videoUtils } from '../utils/videoUtils.js'
import { logger } from '../infrastructure/logger.js'
import {
  videoQueue
} from '../../queue/video.queue.js'
import { eventBus } from '../infrastructure/eventBus.js'
import { ShortVideoRow } from '../db.js' 
import DOMPurify from 'isomorphic-dompurify'
import { simulateIpfsCid } from '../utils/ipfs.utils.js'

type CreateUploadSessionBody = {
  creatorAddress: string
}


function isCreateUploadSessionBody(value: unknown): value is CreateUploadSessionBody {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const body = value as Record<string, unknown>

  return (
    typeof body.creatorAddress === 'string' &&
    ethers.isAddress(body.creatorAddress)
  )
}


export const createUploadSession = async (req: Request, res: Response) => {
  if(!isCreateUploadSessionBody(req.body)) {
    const response: ApiError = {
      code: 'ERROR_INVALID_REQUEST_BODY_ADDRESS',
      message: 'Invalid request body. "creatorAddress" must be a valid Ethereum address.'
    }
    return res.status(400).json(response)    
  }
  
  try {
    const { uid: uploadSessionId } = await db.createUploadSession(req.body.creatorAddress)

    const response: ApiResponse<{uploadSessionId: string}> = {
      data: { uploadSessionId }
    }
    res.status(200).json(response)
  }
  catch(error) {
    console.error('Error creating upload session', error)
    const response: ApiError = {
      code: 'ERROR_CREATING_UPLOAD_SESSION',
      message: 'An error occurred while creating the upload session. Please try again later.'
    }
    return res.status(500).json(response)
  }
}

export const subToProgressUpdates = async (
  req: Request <{ sessionId: string } >, 
  res: Response
) => {
  const { sessionId } = req.params

  if(!sessionId) {
    const response: ApiError = {
      code: 'ERROR_INVALID_REQUEST_PARAMS_SESSION_ID',
      message: 'Invalid request parameters. "sessionId" must be provided.'
    }
    return res.status(400).json(response)  
  }

  const sessionData = await db.getUploadSession(sessionId)

  if(!sessionData) {
    const response: ApiError = {
      code: 'ERROR_UPLOAD_SESSION_NOT_FOUND',
      message: 'Upload session not found.'
    }
    return res.status(404).json(response)  
  }

  if(sessionData.status == 'ACTIVE') {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`event: connected\n`);

    //Detect 'upload session completed' events from db
    const unsubFromUploadSessionCompleted = eventBus.on(
      'upload_session_completed', 
      async (payload) => {
        //check if the 'completed' event comes from our target content
        console.log('event received in controller: ', payload)
        if(sessionData.uid === payload.sessionId) {
          //get video information
          const shortVideoData = await db.getShortVideo(sessionData.uid)
          
          if(!shortVideoData) {
            res.end() //to do: fail gracefully (corrupted data, upload short video again)
            return
          }

          const response: ApiResponse<ShortVideoRow> = {
            data: shortVideoData
          }
          res.write(`event: completed\n`)
          res.write(`data: ${JSON.stringify(response)}\n\n`)
          res.end()
          unsubFromUploadSessionCompleted()
          return
        }
      }
    )
    req.on('close', () => {
      unsubFromUploadSessionCompleted()
    })
  } else if(sessionData.status === 'COMPLETED') {
    //to do: if status is completed then return the CIDs in bytes32 to the user
    const response: ApiError = {
      code: 'ERROR_UPLOAD_SESSION_ALREADY_COMPLETED',
      message: 'The upload session is already completed.'
    }
    return res.status(400).json(response)  
  } else if(sessionData.status === 'EXPIRED') {
    const response: ApiError = {
      code: 'ERROR_UPLOAD_SESSION_EXPIRED',
      message: 'The upload session has expired, create a new one.'
    }
    return res.status(400).json(response)  
  }
}


export const uploadShortVideo = async (
  req: Request<{ sessionId: string }>, 
  res: Response
) => {
  //validate multipart form data
  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    const error: ApiError = { 
      code: 'ERROR_EXPECTED_MULTIPART_FORM_DATA',
      message: 'Invalid content type. Expected multipart/form-data.'
    }
    return res.status(415).json(error)
  }

  //validate that upload session id exists
  const { sessionId } = req.params
  if(!sessionId || typeof(sessionId) !== 'string') {
    const response: ApiError = {
      code: 'ERROR_INVALID_REQUEST_PARAMS_SESSION_ID',
      message: 'Invalid request parameters. "sessionId" must be a valid UUID string.'
    }
    return res.status(400).json(response)  
  }
  const sessionData = await db.getUploadSession(sessionId)
  if(!sessionData) {
    const response: ApiError = {
      code: 'ERROR_UPLOAD_SESSION_NOT_FOUND',
      message: 'Upload session not found.'
    }
    return res.status(404).json(response)  
  }

  //parse 
  const busboy = Busboy({
    headers: req.headers,
    limits: {
      files: 1,
      fileSize: 500 * 1024 * 1024 //500 MB
    }
  })

  //save file
  busboy.on('file', (name, stream, info) => {
    //validate file extension
    if(!videoUtils.isValidVideoMimeType(info?.mimeType)) {
      stream.resume() //discards the stream
      const errorResp: ApiError = { 
        code: 'ERROR_INVALID_CONTENT_TYPE',
        message: 'Expected file to be in the allowed video types'
      }
      return res.status(404).json(errorResp) 
    }

    //save and detect valid video
    const tempPath = path.join(os.tmpdir(), randomUUID() + path.extname(info.filename))
    const videoStream = createWriteStream(tempPath)
    pipeline(stream, videoStream).then(async() => {
      const actualVideoInfo = await videoUtils.getActualVideoInfo(tempPath)
      if(actualVideoInfo.duration > 60) {
        const errorResp: ApiError = { 
          code: 'ERROR_VIDEO_TOO_LONG',
          message: 'Too long for a short video'
        }
        return res.status(400).json(errorResp) 
      }
      else if(!actualVideoInfo.isValid) {
        //delete the invalid file
        unlink(tempPath, (err) => {
          if(err) logger.error({err}, 'error when deleting video')
        })
        const errorResp: ApiError = { 
          code: 'ERROR_INVALID_VIDEO',
          message: 'File provided is not a video'
        }
        return res.status(400).json(errorResp) 
      }
      else {
        await db.upsertShortVideo(
          sessionId,
          tempPath
        )
        const job = await videoQueue.add(
          'convert-video',
          {
            sessionId,
          },
        )
        const response: ApiResponse<{status: string}> = {
          data: { status: 'ok' }
        }
        return res.status(200).json(response)
      }
    }).catch((error) => {
      logger.error({error}, 'error when uploading video')
      const errorResp: ApiError = { 
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error when uploading file'
      }
      return res.status(404).json(errorResp) 
      
    })

    stream.on('limit', () => {
      stream.unpipe()
      stream.resume()
      //delete partial file
      unlink(tempPath, (err) => {
        if(err) logger.error(err, 'error when deleting video')
      })
      const errorResp: ApiError = { 
        code: 'ERROR_FILE_TOO_LARGE',
        message: 'File too large'
      }
      return res.status(413).json(errorResp)
    })
  })

  req.pipe(busboy)

}

export const uploadShortVideoMetadata = async (
  req: Request<{sessionId: string}, any, { shortVideoTitle: string, shortVideoDescription: string}>, 
  res: Response
) => {
  const { sessionId } = req.params
  const { 
    shortVideoTitle,
    shortVideoDescription
  } = req.body  

  if(!sessionId || !shortVideoDescription || !shortVideoTitle) {
    const response: ApiError = {
      code: 'ERROR_INVALID_REQUEST_PARAMS',
      message: 'Invalid request parameters. "sessionId", "shortVideoDescription" and "shortVideoTitle" must be provided.'
    }
    return res.status(400).json(response)  
  }

  if(shortVideoTitle?.length > 100) {
    const response: ApiError = {
      code: 'ERROR_INVALID_TITLE',
      message: 'Invalid title for your content, it should be 100 characters or less'
    }
    return res.status(400).json(response)
  }

  if(shortVideoDescription?.length > 2000) {
    const response: ApiError = {
      code: 'ERROR_INVALID_DESCRIPTION',
      message: 'Invalid description for your content, it should be 2000 characters or less'
    }
    return res.status(400).json(response)
  }

  try {
    const sessionData = await db.getUploadSession(sessionId)

    if(!sessionData) {
      const response: ApiError = {
        code: 'ERROR_UPLOAD_SESSION_NOT_FOUND',
        message: 'Upload session not found.'
      }
      return res.status(404).json(response)  
    }

    const metadataFilePath = path.join(os.tmpdir(), randomUUID() + '.json')
    const sanitizedMetadata = DOMPurify.sanitize(JSON.stringify({    
      shortVideoTitle,
      shortVideoDescription
    }))

    await writeFile(
      metadataFilePath,
      sanitizedMetadata,
      'utf-8'
    )

    const [error, metadataSimulatedCid] = await simulateIpfsCid(metadataFilePath)

    if(!error && metadataSimulatedCid) {
      await db.updateShortVideoMetadata(sessionId, metadataFilePath, metadataSimulatedCid)
      const response: ApiResponse<{status: string}> = {
        data: { status: 'ok' }
      }
      return res.status(200).json(response)
    } else {
      throw new Error(`${error ? error : ''} Unexpected Error when uploading metadata`)
    }
  } catch(error) {
    logger.error({error}, 'error when uploading metadata')
    const errorResp: ApiError = { 
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error when uploading metadata'
    }
    return res.status(404).json(errorResp) 
  }
}