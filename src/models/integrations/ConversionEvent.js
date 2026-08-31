import mongoose from 'mongoose';

const conversionEventSchema = new mongoose.Schema(
  {
    conversion_id: { type: String, required: true, unique: true, index: true },
    opportunity_id: { type: String, required: true, index: true },
    lead_id: { type: String, default: null, index: true },
    tenant_id: { type: String, required: true, index: true },
    organization_id: { type: String, default: null },
    dealer_id: { type: String, default: null },
    branch_id: { type: String, default: null },

    platform: { type: String, enum: ['meta', 'google'], required: true, index: true },
    event_type: { type: String, required: true, index: true },
    event_name: { type: String, required: true },
    event_value: { type: Number, default: null },
    currency: { type: String, default: 'INR' },
    event_time: { type: Date, required: true },

    external_reference: { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    idempotency_key: { type: String, required: true, unique: true, index: true },

    status: {
      type: String,
      enum: ['PENDING', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: 5 },
    next_retry_at: { type: Date, default: null, index: true },
    last_error: { type: String, default: null },
    sent_at: { type: Date, default: null },
    correlation_id: { type: String, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

conversionEventSchema.index({ tenant_id: 1, platform: 1, status: 1 });
conversionEventSchema.index({ tenant_id: 1, event_type: 1, created_at: -1 });

export default mongoose.model('ConversionEvent', conversionEventSchema);
