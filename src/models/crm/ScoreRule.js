import mongoose from 'mongoose';

const scoreRuleSchema = new mongoose.Schema(
  {
    rule_id: { type: String, required: true, index: true },
    tenant_id: { type: String, default: null, index: true },
    rule_code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    field: { type: String, default: null },
    operator: { type: String, enum: ['eq', 'gte', 'lte', 'exists', 'event'], default: 'event' },
    expected_value: { type: String, default: null },
    points: { type: Number, required: true },
    version: { type: Number, default: 1 },
    active: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 100 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

scoreRuleSchema.index({ tenant_id: 1, rule_id: 1 }, { unique: true });
scoreRuleSchema.index({ tenant_id: 1, active: 1, priority: 1 });

export default mongoose.model('ScoreRule', scoreRuleSchema);
