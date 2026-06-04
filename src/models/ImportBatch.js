import mongoose from 'mongoose';
const schema = new mongoose.Schema({ total: Number, valid: Number, duplicate: Number, invalid: Number, outOfTerritory: Number, imported: Number, rejected: Number, rows: Array, imported_by: String }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
export default mongoose.model('ImportBatch', schema);
