import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  customer_id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, text: true },
  mobile: { type: String, required: true, trim: true },
  mobile_normalized: { type: String, required: true, unique: true, index: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  customer_type: { type: String, default: 'Individual' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('Customer', customerSchema);
