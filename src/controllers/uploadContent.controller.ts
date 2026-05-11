import { Request, Response } from 'express'
import { ethers } from 'ethers'

type CreateWalletBody = {
  ownerAddress: string
}


function isCreateUploadSesionBody(value: unknown): value is CreateWalletBody {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const body = value as Record<string, unknown>

  return (
    typeof body.creatorAddress === 'string' &&
    ethers.isAddress(body.creatorAddress)
  )
}


export const createUploadSesion = (req: Request, res: Response) => {
  if(!isCreateUploadSesionBody(req.body)) return res.status(400).json({ error: 'Invalid Request Body'})
  /*
  1. Create a new instance in db for the upload sesion
  2. Return the uuid of the upload sesion to the client
  */
  res.send('server is running fine')
}