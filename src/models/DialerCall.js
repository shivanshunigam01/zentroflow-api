import mongoose from 'mongoose';

const dialerCallSchema = new mongoose.Schema({
  opportunity_id: { type: String, index: true },
  lead_id: { type: String, index: true },
  customer_id: { type: String, index: true },
  customer_number: { type: String, index: true },
  smartflo_call_id: { type: String, default: null, sparse: true, unique: true },
  smartflo_uuid: { type: String, default: null, sparse: true, unique: true },
  smartflo_ref_id: { type: String, default: null, index: true },
  smartflo_lead_id: { type: String, default: null, index: true },
  campaign_id: { type: String, default: null, index: true },
  agent_id: { type: String, default: null, index: true },
  agent_name: { type: String, default: null },
  caller_id: { type: String, default: null },
  direction: { type: String, default: null },
  status: { type: String, default: null, index: true },
  disposition: { type: String, default: null, index: true },
  disposition_code: { type: String, default: null },
  sub_disposition: { type: String, default: null },
  disposition_note: { type: String, default: null },
  start_time: { type: Date, default: null, index: true },
  answered_at: { type: Date, default: null },
  end_time: { type: Date, default: null },
  duration: { type: Number, default: null },
  recording_ref: { type: String, default: null },
  raw_event_ref: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

dialerCallSchema.index({ created_at: -1 });
dialerCallSchema.index({ opportunity_id: 1, created_at: -1 });
dialerCallSchema.index({ campaign_id: 1, created_at: -1 });
dialerCallSchema.index({ agent_id: 1, created_at: -1 });

export default mongoose.model('DialerCall', dialerCallSchema);
