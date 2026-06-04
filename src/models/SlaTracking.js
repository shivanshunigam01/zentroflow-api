import mongoose from 'mongoose';
const schema = new mongoose.Schema({ opportunity_id: { type: String, unique: true, index: true, required: true }, sla_due_at: Date, sla_status: { type: String, default: 'On Track' }, breached_at: Date, escalation_owner: String, notes: String }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('SlaTracking', schema);
