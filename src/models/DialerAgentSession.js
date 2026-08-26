import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true, index: true },
  user_email: { type: String, default: null },
  status: { type: String, enum: ['OFFLINE', 'READY', 'IN_SESSION', 'IN_CALL', 'WRAP_UP', 'PAUSED'], default: 'OFFLINE' },
  campaign_id: { type: String, default: null },
  started_at: { type: Date, default: null },
  ended_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('DialerAgentSession', schema);
