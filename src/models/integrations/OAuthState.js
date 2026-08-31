import mongoose from 'mongoose';

const oauthStateSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, unique: true, index: true },
    platform: { type: String, enum: ['meta', 'google'], required: true },
    tenant_id: { type: String, required: true },
    organization_id: { type: String, default: null },
    dealer_id: { type: String, default: null },
    branch_id: { type: String, default: null },
    user_id: { type: String, required: true },
    redirect_after: { type: String, default: null },
    expires_at: { type: Date, required: true, index: true },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

oauthStateSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OAuthState', oauthStateSchema);
