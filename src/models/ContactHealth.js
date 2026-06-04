import mongoose from 'mongoose';
const schema = new mongoose.Schema({ opportunity_id: { type: String, unique: true, index: true, required: true }, mobile: String, district: String, mobile_valid: Boolean, territory_valid: Boolean, health_status: String, last_verified_at: Date, notes: String }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('ContactHealth', schema);
