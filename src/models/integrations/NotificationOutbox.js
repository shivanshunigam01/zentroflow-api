import mongoose from 'mongoose';

/** Async notification outbox — email, SMS, WhatsApp, internal (Phase 13 foundation). */
const notificationOutboxSchema = new mongoose.Schema(
  {
    notification_id: { type: String, required: true, unique: true, index: true },
    tenant_id: { type: String, required: true, index: true },
    channel: { type: String, enum: ['email', 'sms', 'whatsapp', 'internal'], required: true, index: true },
    recipient: { type: String, required: true },
    template_code: { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['PENDING', 'QUEUED', 'SENT', 'FAILED', 'DEAD_LETTER'], default: 'PENDING', index: true },
    idempotency_key: { type: String, default: null, sparse: true, unique: true },
    attempts: { type: Number, default: 0 },
    last_error: { type: String, default: null },
    correlation_id: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export default mongoose.model('NotificationOutbox', notificationOutboxSchema);
