import { Worker } from 'bullmq'

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

    // Simulamos procesamiento pesado
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log('Job completed:', job.id);

    return {
      message: 'Video processed successfully',
      jobId: job.id,
      processedAt: new Date().toISOString(),
    };
  },
  {
    connection: videoQueueConnection,
    concurrency: 1,
  }
)

worker.on('ready', () => {
  console.log(`Worker listening on queue: ${VIDEO_QUEUE_NAME}`);
})