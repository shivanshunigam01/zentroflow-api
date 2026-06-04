import mongoose from 'mongoose';
const schema = new mongoose.Schema({ opportunity_id: { type: String, index: true, required: true }, from_micro_stage: String, to_micro_stage: { type: String, required: true }, from_stage: String, to_stage: String, changed_by: String, reason: String, forced: { type: Boolean, default: false } }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('StageHistory', schema);
