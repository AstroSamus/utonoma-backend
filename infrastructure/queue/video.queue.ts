import { Queue } from 'bullmq'
import dotenv from 'dotenv'

dotenv.config()

export const VIDEO_QUEUE_NAME = 'VIDEO_QUEUE'

export const videoQueueConnection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null,
}

export const videoQueue = new Queue(
  VIDEO_QUEUE_NAME, 
  {
    connection: videoQueueConnection,
  }
)
/*
export const videoQueue = new Queue('video-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 60 * 60,
      count: 100,
    },
    removeOnFail: {
      age: 24 * 60 * 60,
    },
  },
});*/