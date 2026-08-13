import mongoose from 'mongoose';

const actionSchema = new mongoose.Schema(
  {
    action_id: { type: String, required: true, unique: true, index: true },
    opportunity_id: { type: String, required: true, index: true },
    lead_id: { type: String, index: true },
    customer_id: String,
    macro_stage: String,
    micro_stage: { type: String, required: true },
    action_type: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    priority: { type: String, enum: ['P1', 'P2', 'P3', 'P4', 'P5'], default: 'P2' },
    owner_id: { type: String, required: true, index: true },
    due_at: { type: Date, required: true, index: true },
    sla_policy_id: String,
    trigger_event_id: String,
    trigger_rule_id: String,
    version_number: { type: Number, default: 1 },
    idempotency_key: { type: String, index: true },
    completion_json: { type: mongoose.Schema.Types.Mixed, default: {} },
    reassign_reason: String,
    updated_by: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

actionSchema.index(
  { opportunity_id: 1, action_type: 1, micro_stage: 1, status: 1 },
  { name: 'action_active_lookup' },
);

export default mongoose.model('Action', actionSchema);
