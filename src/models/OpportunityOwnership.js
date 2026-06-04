import mongoose from 'mongoose';
const schema = new mongoose.Schema({ opportunity_id: { type: String, index: true, required: true }, owner: String, role: String, is_primary: { type: Boolean, default: true }, assigned_by: String, assigned_at: { type: Date, default: Date.now } }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('OpportunityOwnership', schema);
