import mongoose from 'mongoose';

/** Dialer audit trail — never store SMARTFLO_API_TOKEN in metadata. */
const dialerAuditLogSchema = new mongoose.Schema({
  actor: { type: String, default: 'System', index: true },
  action: { type: String, required: true, index: true },
  entity: { type: String, default: null, index: true },
  entity_id: { type: String, default: null, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

dialerAuditLogSchema.index({ created_at: -1 });

export default mongoose.model('DialerAuditLog', dialerAuditLogSchema);
