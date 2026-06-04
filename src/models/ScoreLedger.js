import mongoose from 'mongoose';
const schema = new mongoose.Schema({ opportunity_id: { type: String, index: true, required: true }, event_type: String, points: Number, score_after: Number, classification_after: String, reason: String }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('ScoreLedger', schema);
