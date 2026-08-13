import mongoose from 'mongoose';

const organisationSchema = new mongoose.Schema(
  {
    organisation_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    oem_brand: { type: String, default: '' },
    status: { type: String, default: 'ACTIVE' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export default mongoose.model('Organisation', organisationSchema);
