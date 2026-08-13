import mongoose from 'mongoose';

const automationRuleSchema = new mongoose.Schema(
  {
    rule_id: { type: String, required: true, unique: true, index: true },
    rule_code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['EVENT', 'TIME', 'STAGE'], default: 'EVENT' },
    trigger_event: { type: String, required: true, index: true },
    priority: { type: String, enum: ['P1', 'P2', 'P3', 'P4', 'P5'], default: 'P2' },
    status: {
      type: String,
      enum: ['ACTIVE', 'DRAFT', 'SHADOW', 'PAUSED', 'RETIRED'],
      default: 'DRAFT',
      index: true,
    },
    current_version: { type: Number, default: 1 },
    field_path: String,
    operator: String,
    expected_value: String,
    action_type: String,
    owner_logic: String,
    sla_minutes: { type: Number, default: 60 },
    escalation_logic: String,
    exit_condition: String,
    next_stage: String,
    scope: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export default mongoose.model('AutomationRule', automationRuleSchema);
