const { Queue, QueueEvents } = require('bullmq');
const { redisConnection } = require('../config/redis');

const DB_QUEUE_NAME = process.env.DB_QUEUE_NAME || 'db-queries';

const dbQueue = new Queue(DB_QUEUE_NAME, {
  connection: redisConnection,
});

const dbQueueEvents = new QueueEvents(DB_QUEUE_NAME, {
  connection: redisConnection,
});

const ensureDbQueueReady = async () => {
  await dbQueue.waitUntilReady();
  await dbQueueEvents.waitUntilReady();
};

const enqueueDbJob = async (name, payload) => {
  const job = await dbQueue.add(name, payload, {
    // don't remove immediately on complete - keep a short TTL so waitUntilFinished
    // can reliably find the job key. Remove after 60 seconds.
    removeOnComplete: { age: 60 },
    // keep a reasonable number of failed jobs for inspection
    removeOnFail: { count: 100 },
  });

  // wait up to 60s for the job to finish; avoids "Missing key for job ... isFinished"
  return job.waitUntilFinished(dbQueueEvents, 60000);
};

module.exports = {
  DB_QUEUE_NAME,
  ensureDbQueueReady,
  enqueueDbJob,
};
