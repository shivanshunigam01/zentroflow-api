import mongoose from 'mongoose';

const assignmentHistorySchema = new mongoose.Schema(
  {
    opportunity_id: { type: String, required: true, index: true },
    lead_id: { type: String, index: true },
    tenant_id: { type: String, required: true, index: true },
    organization_id: { type: String, default: null },
    dealer_id: { type: String, default: null },
    branch_id: { type: String, default: null },
    previous_owner: { type: String, default: null },
    new_owner: { type: String, required: true },
    assigned_by: { type: String, required: true },
    reason: { type: String, default: null },
    rule: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

assignmentHistorySchema.index({ opportunity_id: 1, created_at: -1 });

export default mongoose.model('AssignmentHistory', assignmentHistorySchema);
