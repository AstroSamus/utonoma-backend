import { ethers } from 'ethers'
import dotenv from 'dotenv'
//import db to initiate an instance of the eventBus so you can listen for events
//from the db via de the event bus
import { db } from '../infrastructure/db.js'
import { eventBus } from '../infrastructure/eventBus.js'
import { 
  uploadJsonToIpfsService,
  uploadVideoToIpfsService
} from '../api/services/ipfs.service.js'
import fs from 'node:fs/promises'
import { createReadStream } from 'fs'
import { convertIpfsCidToBytes32 } from '../shared/utils/ipfs.utils.js'
import { ShortVideoRow } from '../api/db.js'
import { setTimeout } from 'timers/promises'

dotenv.config()

try {
  const readyShortVideos = await db.getShortVideosInReadyState()
  if(readyShortVideos && readyShortVideos.length > 0) {
    //do not await, so the eventBus.on can start to listen messages immediately
    uploadSecuentiallyToIpfs(readyShortVideos) 
  }
} catch (error) {
  console.error(error)
}


eventBus.on("upload_session_ready", async({sessionId}) => {
  try {
    const shortVideoInfo = await db.getShortVideo(sessionId)

    const shortVideoUri = shortVideoInfo?.standardized || null
    const metadataShortVideoUri = shortVideoInfo?.metadata || null

    await uploadToIpfs(sessionId, metadataShortVideoUri, shortVideoUri)

  } catch (error) {
    console.log(error)
  }
})


async function uploadToIpfs(
  sessionId: ShortVideoRow['upload_session_id'],
  metadataShortVideoUri: ShortVideoRow['metadata'], 
  shortVideoUri: ShortVideoRow['standardized']
): Promise<void> {
  //validate URIs
  if(!metadataShortVideoUri || !shortVideoUri) {
    markAsInconsistent(sessionId)
    return
  }

  try{
    //read the metadata and upload it
    const metadata = await fs.readFile(metadataShortVideoUri, { encoding: 'utf-8' })
    console.log(metadataShortVideoUri)
    const metadataAsJson = JSON.parse(metadata)
    const metadataCid = await uploadJsonToIpfsService(metadataAsJson)
    
    //read the short video and upload it
    const shortVideoReadStream = createReadStream(shortVideoUri)
    const shortVideoCid = await uploadVideoToIpfsService(shortVideoReadStream, 'video/webm')

    if(metadataCid && shortVideoCid) {
      //mark upload session as completed
      await db.updateUploadSessionStatus(sessionId, 'COMPLETED')
      return
    }
    else {
      throw new Error('error when uploading to IPFS')
    }
  } catch(error) {
    console.error(error)
    markAsInconsistent(sessionId)
  }
}

/**
 * Calls uploadToIpfs secuentially to avoid saturating the endpoint
 */
async function uploadSecuentiallyToIpfs(contents: ShortVideoRow[]) {
  for(const content of contents) {
    await uploadToIpfs(
      content.upload_session_id, 
      content.metadata, 
      content.standardized
    )
    //wait for 3 seconds for the next req
    await setTimeout(3000)
  }
}

async function markAsInconsistent(sessionId: string) {
  try {
    await db.updateUploadSessionStatus(sessionId, 'INCONSISTENT')
  } catch(error) {
    console.log(`failed to mark the upload session ${sessionId} as INCONSISTENT`)
  }
}