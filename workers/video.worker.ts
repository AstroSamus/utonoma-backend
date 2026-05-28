import { Worker } from 'bullmq'
import { db } from '../api/services/db.service.js'
import { videoUtils } from '../api/utils/videoUtils.js'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'

import {
  videoQueueConnection,
  VIDEO_QUEUE_NAME
} from '../queue/video.queue.js'

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


    const outputFileName = path.join(os.tmpdir(), randomUUID())

    const [error, isConverted] = await videoUtils.convertToWebM(
      shortVideoInfo.original, 
      outputFileName,
      (progress) => {
        if(progress) console.log(progress)
      }
    )

    //3. Store the output in db
    if(error || !isConverted) {
      throw new Error(`Error converting video for session ${job.data.sessionId}: ${error?.message}`)
    } else {
      console.log('Job completed file is stored in:', outputFileName)      
    }
  },
  {
    connection: videoQueueConnection,
    concurrency: 1,
  }
)

worker.on('ready', () => {
  console.log(`Worker listening on queue: ${VIDEO_QUEUE_NAME}`);
})