import { Request, Response } from 'express'
import { ethers } from 'ethers'
import { db } from '../services/db.service'
import { 
  ApiResponse,
  ApiError
} from '../types'
import Busboy from 'busboy'
import { createWriteStream } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import os from 'os'
import { pipeline } from 'stream/promises'

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

    const response: ApiResponse<{uploadSessionId: number}> = {
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
  const sessionIdNumber = Number(sessionId)

  if(!sessionIdNumber) {
    const response: ApiError = {
      code: 'ERROR_INVALID_REQUEST_PARAMS_SESSION_ID',
      message: 'Invalid request parameters. "sessionId" must be a valid number.'
    }
    return res.status(400).json(response)  
  }

  const sessionData = await db.getUploadSession(sessionIdNumber)

  if(sessionData === null) {
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

    /**
     * Subscribe to events related to upload session progress
     * and send updates to the client
     */
    const intervalId = setInterval(() => {
      res.write(`event: progress\n`);
      res.write(`data: test data\n\n`);
    }, 20000)

    req.on('close', () => {
      clearInterval(intervalId)
    })
  } else if(sessionData.status === 'COMPLETED') {
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
      code: 'ERROR_INVALID_CONTENT_TYPE',
      message: 'Invalid content type. Expected multipart/form-data.'
    }
    return res.status(415).json(error)
  }

  //validate that upload session id exists
  const { sessionId } = req.params
  const sessionIdNumber = Number(sessionId)
  if(!sessionIdNumber) {
    const response: ApiError = {
      code: 'ERROR_INVALID_REQUEST_PARAMS_SESSION_ID',
      message: 'Invalid request parameters. "sessionId" must be a valid number.'
    }
    return res.status(400).json(response)  
  }
  const sessionData = await db.getUploadSession(sessionIdNumber)
  if(sessionData === null) {
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

  
  busboy.on('file', async(name, stream, info) => {
    const tempPath = path.join(os.tmpdir(), randomUUID() + path.extname(info.filename))

    try {
      const videoStream = createWriteStream(tempPath)
      await pipeline(stream, videoStream)
      stream.pipe(videoStream)
    } catch (error) {
      return res.send(500).json({ error: 'Upload failed' })
    }
  })

  busboy.on('finish', () => {
    res.send(400)
  })

  req.pipe(busboy)

}