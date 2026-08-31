import mongoose from 'mongoose';

const leadIngestionEventSchema = new mongoose.Schema(
  {
    event_id: { type: String, required: true, unique: true, index: true },
    platform: { type: String, enum: ['meta', 'google', 'manual', 'import'], required: true, index: true },
    event_type: { type: String, required: true, index: true },
    external_event_id: { type: String, default: null, index: true },
    external_lead_id: { type: String, default: null, index: true },
    idempotency_key: { type: String, default: null, sparse: true, unique: true },

    tenant_id: { type: String, default: null, index: true },
    organization_id: { type: String, default: null },
    dealer_id: { type: String, default: null },
    branch_id: { type: String, default: null },

    meta_form_id: { type: String, default: null, index: true },
    mapping_status: { type: String, enum: ['MAPPED', 'UNMAPPED', 'UNKNOWN'], default: 'UNKNOWN', index: true },

    raw_payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    normalized_payload: { type: mongoose.Schema.Types.Mixed, default: null },

    processing_status: {
      type: String,
      enum: ['RECEIVED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNMAPPED', 'SKIPPED'],
      default: 'RECEIVED',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    last_error: { type: String, default: null },

    opportunity_id: { type: String, default: null, index: true },
    customer_id: { type: String, default: null },
    correlation_id: { type: String, default: null, index: true },

    received_at: { type: Date, default: Date.now, index: true },
    processed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

leadIngestionEventSchema.index({ platform: 1, external_event_id: 1 }, { unique: true, sparse: true });
leadIngestionEventSchema.index({ tenant_id: 1, processing_status: 1, received_at: -1 });

export default mongoose.model('LeadIngestionEvent', leadIngestionEventSchema);
