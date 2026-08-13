import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    role_id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    permissions: { type: [String], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export default mongoose.model('Role', roleSchema);
