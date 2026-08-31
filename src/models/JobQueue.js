import mongoose from 'mongoose';

const jobQueueSchema = new mongoose.Schema(
  {
    job_type: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    tenant_id: { type: String, default: null, index: true },
    organization_id: { type: String, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: 5 },
    scheduled_at: { type: Date, default: Date.now, index: true },
    started_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    failed_at: { type: Date, default: null },
    last_error: { type: String, default: null },
    idempotency_key: { type: String, default: null, sparse: true, unique: true },
    processing_token: { type: String, default: null, index: true },
    processing_expires_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

jobQueueSchema.index({ status: 1, scheduled_at: 1 });
jobQueueSchema.index({ tenant_id: 1, status: 1, scheduled_at: 1 });
jobQueueSchema.index({ status: 1, processing_expires_at: 1 });

export default mongoose.model('JobQueue', jobQueueSchema);
