import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    branch_id: { type: String, required: true, unique: true },
    organisation_id: { type: String, required: true, index: true },
    name: { type: String, required: true },
    territory: { type: String, default: '' },
    status: { type: String, default: 'ACTIVE' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export default mongoose.model('Branch', branchSchema);
