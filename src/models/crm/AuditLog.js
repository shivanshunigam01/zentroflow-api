import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    tenant_id: { type: String, required: true, index: true },
    organization_id: { type: String, default: null, index: true },
    dealer_id: { type: String, default: null },
    branch_id: { type: String, default: null },
    actor_user_id: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entity_type: { type: String, required: true, index: true },
    entity_id: { type: String, required: true, index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    correlation_id: { type: String, default: null },
    ip_address: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

auditLogSchema.index({ tenant_id: 1, created_at: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
