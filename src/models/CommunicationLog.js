import mongoose from 'mongoose';
const schema = new mongoose.Schema({ opportunity_id: { type: String, index: true }, customer_id: String, channel: String, direction: String, message: String, status: String, sent_by: String, sent_at: { type: Date, default: Date.now } }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('CommunicationLog', schema);
