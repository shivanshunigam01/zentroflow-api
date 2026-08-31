import { randomUUID } from 'crypto';
import JobQueue from '../../models/JobQueue.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

/**
 * Enqueue a job for async processing. Idempotent when idempotency_key is provided.
 */
export const enqueueJob = async ({
  job_type,
  payload = {},
  idempotency_key = null,
  scheduled_at = null,
  max_attempts = DEFAULT_MAX_ATTEMPTS,
  tenant_id = null,
  organization_id = null,
}) => {
  if (idempotency_key) {
    const existing = await JobQueue.findOne({ idempotency_key }).lean();
    if (existing) return { job: existing, duplicate: true };
  }
  const job = await JobQueue.create({
    job_type,
    payload,
    idempotency_key: idempotency_key || undefined,
    scheduled_at: scheduled_at || new Date(),
    max_attempts,
    tenant_id: tenant_id || null,
    organization_id: organization_id || null,
    status: 'PENDING',
  });
  return { job, duplicate: false };
};

/** Recover jobs stuck in PROCESSING past lease expiry. */
export const recoverStaleJobs = async () => {
  const now = new Date();
  await JobQueue.updateMany(
    {
      status: 'PROCESSING',
      processing_expires_at: { $lte: now },
    },
    {
      $set: { status: 'PENDING', processing_token: null, processing_expires_at: null },
    },
  );
};

/** Claim next pending job (atomic) — prevents double processing via processing_token. */
export const claimNextJob = async () => {
  await recoverStaleJobs();
  const now = new Date();
  const token = randomUUID();
  const leaseUntil = new Date(Date.now() + PROCESSING_LEASE_MS);

  return JobQueue.findOneAndUpdate(
    {
      status: 'PENDING',
      scheduled_at: { $lte: now },
      $expr: { $lt: ['$attempts', '$max_attempts'] },
    },
    {
      $set: {
        status: 'PROCESSING',
        started_at: now,
        processing_token: token,
        processing_expires_at: leaseUntil,
      },
      $inc: { attempts: 1 },
    },
    { sort: { scheduled_at: 1 }, new: true },
  );
};

export const completeJob = async (jobId, processingToken) => {
  const result = await JobQueue.findOneAndUpdate(
    { _id: jobId, processing_token: processingToken, status: 'PROCESSING' },
    {
      status: 'COMPLETED',
      completed_at: new Date(),
      last_error: null,
      processing_token: null,
      processing_expires_at: null,
    },
    { new: true },
  );
  return result;
};

export const failJob = async (job, errorMessage) => {
  const dead = job.attempts >= job.max_attempts;
  const backoffMs = Math.min(1000 * 2 ** job.attempts, 60_000);
  await JobQueue.findOneAndUpdate(
    { _id: job._id, processing_token: job.processing_token },
    {
      status: dead ? 'DEAD_LETTER' : 'PENDING',
      last_error: errorMessage,
      failed_at: new Date(),
      processing_token: null,
      processing_expires_at: null,
      scheduled_at: dead ? job.scheduled_at : new Date(Date.now() + backoffMs),
    },
  );
};

/** Generic processor registry — extend in later phases. */
const processors = new Map();

export const registerProcessor = (jobType, handler) => {
  processors.set(jobType, handler);
};

export const processOneJob = async () => {
  const job = await claimNextJob();
  if (!job) return null;
  const handler = processors.get(job.job_type);
  if (!handler) {
    await failJob(job, `No processor registered for job_type: ${job.job_type}`);
    return job;
  }
  try {
    await handler(job);
    const completed = await completeJob(job._id, job.processing_token);
    if (!completed) {
      return { ...job.toObject(), concurrent_skip: true };
    }
  } catch (err) {
    await failJob(job, err?.message || String(err));
  }
  return job;
};

export const getQueueStats = async (tenantId = null) => {
  const statuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER'];
  const base = tenantId ? { tenant_id: tenantId } : {};
  const counts = {};
  await Promise.all(
    statuses.map(async (s) => {
      counts[s] = await JobQueue.countDocuments({ ...base, status: s });
    }),
  );
  return counts;
};
