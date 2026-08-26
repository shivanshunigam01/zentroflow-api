import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  event_key: { type: String, required: true, unique: true, index: true },
  event_type: { type: String, default: null },
  smartflo_call_id: { type: String, default: null, index: true },
  smartflo_uuid: { type: String, default: null },
  customer_number: { type: String, default: null },
  campaign_id: { type: String, default: null },
  disposition: { type: String, default: null },
  opportunity_id: { type: String, default: null },
  duplicate: { type: Boolean, default: false },
  processed: { type: Boolean, default: false },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  processed_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.index({ created_at: -1 });

export default mongoose.model('SmartfloWebhookEvent', schema);
