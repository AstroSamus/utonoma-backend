import { Worker } from 'bullmq'
import { db } from '../api/services/db.service.js'
import { videoUtils } from '../api/utils/videoUtils.js'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { simulateIpfsCid } from '../api/utils/ipfs.utils.js'
import {
  videoQueueConnection,
  VIDEO_QUEUE_NAME
} from '../queue/video.queue.js'
import { Bytes32 } from '../api/types.js'

const worker = new Worker(
  VIDEO_QUEUE_NAME,
  async (job) => {
    console.log('Job received:', job.id);
    console.log('Job name:', job.name);
    console.log('Job data:', job.data);

    const shortVideoInfo = await db.getShortVideo(job.data.sessionId)
    const uploadSessionInfo = await db.getUploadSession(job.data.sessionId)
    if(!shortVideoInfo || !shortVideoInfo?.original) {
      throw new Error(`No information about ${job.data.sessionId}, cannot process task.`)
      //to do: mark upload session as expired on db

    }
    if(uploadSessionInfo?.status === 'EXPIRED' || uploadSessionInfo?.status === 'COMPLETED') {
      throw new Error(`Upload session ${job.data.sessionId} is expired, cannot process task.`)
    }


    const outputFileName = path.join(os.tmpdir(), randomUUID() + '.webm')

    const [convertionError, isConverted] = await videoUtils.convertToWebM(
      shortVideoInfo.original, 
      outputFileName,
      (progress) => {
        if(progress) console.log(progress)
      }
    )

    let standardizedVideoCid: Bytes32 | null = null
    if(!convertionError) {
      const [ipfsError, cidAsBytes32] = await simulateIpfsCid(outputFileName)
      standardizedVideoCid = cidAsBytes32
    }

    //Store the output in db
    if(convertionError || !standardizedVideoCid) {
      throw new Error(`Error converting video for session ${job.data.sessionId}: ${convertionError?.message}`)
    } else {
      try{
        await db.updateShortVideoStandardized(
          job.data.sessionId, 
          outputFileName,
          standardizedVideoCid
        )
      } catch(err) {
        throw new Error(`Error updating database for session ${job.data.sessionId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  },
  {
    connection: videoQueueConnection,
    concurrency: 2,
  }
)

worker.on('ready', () => {
  console.log(`Worker listening on queue: ${VIDEO_QUEUE_NAME}`);
})