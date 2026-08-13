import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    product_id: { type: String, required: true, unique: true },
    oem: { type: String, default: '' },
    model: { type: String, required: true },
    variant: { type: String, default: '' },
    colour: { type: String, default: '' },
    status: { type: String, default: 'ACTIVE' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export default mongoose.model('Product', productSchema);
