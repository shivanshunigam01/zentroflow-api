import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password_hash: { type: String, required: true, select: false },
    name: { type: String, required: true, default: 'User' },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    role_id: { type: String, default: null, index: true },
    tenant_id: { type: String, default: null, index: true },
    organization_id: { type: String, default: null, index: true },
    dealer_id: { type: String, default: null, index: true },
    branch_id: { type: String, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export default mongoose.model('User', userSchema);
