import { Request, Response } from 'express'
import { ethers } from 'ethers'
import { db } from '../services/db.service'
import { 
  ApiResponse,
  ApiError
} from '../types'

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