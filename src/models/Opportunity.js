import mongoose from 'mongoose';

const opportunitySchema = new mongoose.Schema({
  opportunity_id: { type: String, required: true, unique: true, index: true },
  lead_id: { type: String, required: true, unique: true, index: true },
  customer_id: { type: String, required: true, index: true },
  tenant_id: { type: String, default: null, index: true },
  organization_id: { type: String, default: null, index: true },
  dealer_id: { type: String, default: null, index: true },
  branch_id: { type: String, default: null, index: true },
  external_lead_id: { type: String, default: null, index: true },
  external_source_id: { type: String, default: null },
  received_at: { type: Date, default: null },
  product: { type: String, required: true, trim: true },
  variant: String,
  requirement: String,
  opportunity_type: { type: String, default: 'New' },
  current_stage: { type: String, enum: ['C0', 'C1', 'C1A', 'C2', 'C3', null], default: 'C0' },
  lifecycle_stage: { type: String, enum: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', null], default: null },
  current_micro_stage: { type: String, required: true, default: 'C0.1' },
  current_owner: { type: String, required: true, index: true },
  current_action: { type: String, required: true, default: 'Complete Contact' },
  next_action: { type: String, required: true, default: 'Complete Contact' },
  next_action_date: { type: Date, required: true, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: true },
  priority: { type: String, enum: ['P1', 'P2', 'P3', 'P4', 'P5'], default: 'P3' },
  lead_score: { type: Number, default: 0 },
  score_classification: { type: String, enum: ['Cold', 'Warm', 'Hot', 'Critical'], default: 'Cold' },
  temperature: { type: String, enum: ['COLD', 'WARM', 'HOT', 'NURTURE', null], default: null },
  verification_status: { type: String, enum: ['PENDING', 'VERIFIED', 'INVALID', null], default: null },
  qualification_status: { type: String, enum: ['PENDING', 'QUALIFIED', 'DISQUALIFIED', null], default: null },
  duplicate_status: { type: String, enum: ['NEW', 'LIKELY_DUPLICATE', 'CONFIRMED_DUPLICATE', null], default: null },
  duplicate_group: { type: String, default: null, index: true },
  linked_opportunity_id: { type: String, default: null, index: true },
  score_version: { type: Number, default: 1 },
  score_reasons: { type: [String], default: [] },
  sla: { type: String, required: true, default: '24 hours' },
  sla_due_at: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  sla_status: { type: String, enum: ['On Track', 'At Risk', 'Breached'], default: 'On Track' },
  escalation_owner: { type: String, required: true, default: 'Sales Manager' },
  status: { type: String, enum: ['Open', 'Hold', 'Lost', 'Delivered', 'Closed'], default: 'Open', index: true },
  source: { type: String, required: true, default: 'Manual' },
  campaign: String,
  branch: { type: String, required: true, default: 'Default Branch' },
  last_activity_at: { type: Date, default: Date.now },
  stage_step_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_by: { type: String, default: null },
  updated_by: { type: String, default: null },

  smartflo_lead_id: { type: String, default: null, index: true },
  smartflo_lead_list_id: { type: String, default: null },
  smartflo_sync_status: { type: String, enum: ['PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'SKIPPED'], default: undefined },
  smartflo_sync_error: { type: String, default: null },
  smartflo_last_synced_at: { type: Date, default: null },
  smartflo_dial_status: { type: String, default: null },
  smartflo_disposition: { type: String, default: null },
  smartflo_sub_disposition: { type: String, default: null },
  smartflo_external_disposition: { type: String, default: null },
  smartflo_last_call_id: { type: String, default: null },
  smartflo_last_call_at: { type: Date, default: null },
  smartflo_retry_count: { type: Number, default: 0 },
  callback_at: { type: Date, default: null },
  callback_note: { type: String, default: null },
  callback_agent_id: { type: String, default: null },
  dialer_feedback: { type: String, default: null },
  dialer_notes: { type: String, default: null },
  dialer_priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT', null], default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

opportunitySchema.index({ tenant_id: 1, status: 1, created_at: -1 });
opportunitySchema.index({ tenant_id: 1, current_owner: 1, next_action_date: 1 });
opportunitySchema.index({ tenant_id: 1, source: 1 });
opportunitySchema.index({ tenant_id: 1, current_stage: 1 });
opportunitySchema.index({ tenant_id: 1, dealer_id: 1, branch_id: 1 });
opportunitySchema.index({ tenant_id: 1, lead_score: -1 });
opportunitySchema.index({ tenant_id: 1, qualification_status: 1 });
opportunitySchema.index({ tenant_id: 1, duplicate_status: 1 });
opportunitySchema.index({ tenant_id: 1, external_lead_id: 1, source: 1 });
opportunitySchema.index({ tenant_id: 1, created_at: -1 });

opportunitySchema.pre('validate', function validateStage(next) {
  if (this.current_stage && this.lifecycle_stage) return next(new Error('Either current_stage or lifecycle_stage can be set, not both'));
  return next();
});

export default mongoose.model('Opportunity', opportunitySchema);
