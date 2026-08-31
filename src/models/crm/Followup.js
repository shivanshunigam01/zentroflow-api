import mongoose from 'mongoose';

const followupSchema = new mongoose.Schema(
  {
    followup_id: { type: String, required: true, unique: true, index: true },
    opportunity_id: { type: String, required: true, index: true },
    lead_id: { type: String, index: true },
    tenant_id: { type: String, required: true, index: true },
    organization_id: { type: String, default: null },
    dealer_id: { type: String, default: null },
    branch_id: { type: String, default: null },
    owner_type: { type: String, default: 'USER' },
    assigned_to: { type: String, required: true, index: true },
    followup_type: {
      type: String,
      enum: ['CALL', 'WHATSAPP', 'EMAIL', 'SMS', 'VISIT', 'TEST_DRIVE', 'VIDEO_CALL', 'OTHER'],
      default: 'CALL',
    },
    scheduled_at: { type: Date, required: true, index: true },
    reminder_at: { type: Date, default: null },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status: {
      type: String,
      enum: ['OPEN', 'DUE', 'COMPLETED', 'MISSED', 'RESCHEDULED', 'CANCELLED'],
      default: 'OPEN',
      index: true,
    },
    outcome: { type: String, default: null },
    remarks: { type: String, default: null },
    next_followup_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    created_by: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

followupSchema.index({ tenant_id: 1, assigned_to: 1, scheduled_at: 1 });
followupSchema.index({ tenant_id: 1, status: 1, scheduled_at: 1 });

export default mongoose.model('Followup', followupSchema);
