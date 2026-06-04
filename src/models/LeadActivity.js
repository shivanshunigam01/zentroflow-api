import mongoose from 'mongoose';
const schema = new mongoose.Schema({ opportunity_id: { type: String, index: true, required: true }, customer_id: String, type: { type: String, required: true }, title: String, description: String, changed_by: String, payload: Object }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('LeadActivity', schema);
