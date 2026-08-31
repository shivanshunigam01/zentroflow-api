import mongoose from 'mongoose';

const routingRuleSchema = new mongoose.Schema(
  {
    rule_id: { type: String, required: true, unique: true, index: true },
    tenant_id: { type: String, required: true, index: true },
    organization_id: { type: String, default: null, index: true },
    name: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 100 },

    match: {
      source: { type: String, default: null },
      platform: { type: String, default: null },
      meta_form_id: { type: String, default: null },
      campaign: { type: String, default: null },
      product: { type: String, default: null },
    },

    assign: {
      dealer_id: { type: String, default: null },
      branch_id: { type: String, default: null },
      owner: { type: String, default: null },
      strategy: { type: String, enum: ['fixed', 'round_robin', 'workload'], default: 'fixed' },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

routingRuleSchema.index({ tenant_id: 1, active: 1, priority: 1 });

export default mongoose.model('RoutingRule', routingRuleSchema);
