import { ethers } from 'ethers'
import dotenv from 'dotenv'
//import db to initiate an instance of the eventBus so you can listen for events
//from the db via de the event bus
import { db } from '../api/services/db.service.js'
import { eventBus } from '../api/infrastructure/eventBus.js'
import { 
  uploadJsonToIpfsService,
  uploadVideoToIpfsService
} from '../api/services/ipfs.service.js'
import fs from 'node:fs/promises'
import { createReadStream } from 'fs'
import { convertIpfsCidToBytes32 } from '../api/utils/ipfs.utils.js'

dotenv.config()

eventBus.on("upload_session_ready", async({sessionId}) => {
  console.log('detecting upload session ready from ipfs worker', sessionId)
  try {
    const shortVideoInfo = await db.getShortVideo(sessionId)
    if(!shortVideoInfo) throw new Error('Short video info does not exist')
    const { standardized: shortVideoUri, metadata: metadataShortVideoUri } = shortVideoInfo
    if(!shortVideoUri || !metadataShortVideoUri) throw new Error('File URIs are missing') //flag as inconsistent
    
    //read the metadata and upload it
    const metadata = await fs.readFile(metadataShortVideoUri, { encoding: 'utf-8' })
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
    else throw new Error('upload to ipfs failed')

  } catch (error) {
    //marc the entry as inconsistent
    console.log(error)
    try {
      await db.updateUploadSessionStatus(sessionId, 'INCONSISTENT')
    } catch(error) {
      console.log(`failed to mark the upload session ${sessionId} as INCONSISTENT`)
    }
  }
})