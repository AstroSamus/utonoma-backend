import { ethers } from 'ethers'
import { CreateUploadSessionBody } from './types.js'

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

export const guards = {
    isCreateUploadSessionBody
}