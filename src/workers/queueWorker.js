/**
 * Generic MongoDB-backed queue worker.
 * Run as separate PM2 process: node src/workers/queueWorker.js
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { validateEnv } from '../config/env.js';
import { processOneJob } from '../services/queue/queue.service.js';
import { registerQueueProcessors } from './registerProcessors.js';

const POLL_MS = Number(process.env.QUEUE_POLL_MS || 2000);
const ENABLED = process.env.WORKER_ENABLED !== 'false';
const CONCURRENCY = Math.min(Number(process.env.QUEUE_WORKER_CONCURRENCY || 1), 5);

registerQueueProcessors();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const loop = async () => {
  while (ENABLED) {
    try {
      const jobs = await Promise.all(Array.from({ length: CONCURRENCY }, () => processOneJob()));
      if (!jobs.some(Boolean)) await sleep(POLL_MS);
    } catch (err) {
      console.error('[queueWorker] loop error:', err?.message || err);
      await sleep(POLL_MS);
    }
  }
};

const start = async () => {
  if (!ENABLED) {
    console.log('[queueWorker] WORKER_ENABLED=false — exiting');
    process.exit(0);
  }
  validateEnv();
  await connectDB();
  console.log(`[queueWorker] started — polling every ${POLL_MS}ms, concurrency=${CONCURRENCY}`);
  await loop();
};

start().catch((err) => {
  console.error('[queueWorker] fatal:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await mongoose.disconnect();
  process.exit(0);
});
