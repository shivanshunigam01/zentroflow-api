import mongoose from 'mongoose';
const schema = new mongoose.Schema({ type: { type: String, index: true, required: true }, opportunity_id: String, customer_id: String, payload: Object, correlation_id: String, processed: { type: Boolean, default: false } }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('DomainEvent', schema);
