import mongoose from 'mongoose';

const platformConnectionSchema = new mongoose.Schema(
  {
    connection_id: { type: String, required: true, unique: true, index: true },
    platform: { type: String, enum: ['meta', 'google'], required: true, index: true },
    tenant_id: { type: String, required: true, index: true },
    organization_id: { type: String, default: null, index: true },
    dealer_id: { type: String, default: null, index: true },
    branch_id: { type: String, default: null },

    status: { type: String, enum: ['CONNECTED', 'DISCONNECTED', 'EXPIRED', 'ERROR'], default: 'CONNECTED', index: true },
    external_account_id: { type: String, default: null, index: true },
    external_account_name: { type: String, default: null },
    external_business_id: { type: String, default: null },
    external_business_name: { type: String, default: null },

    access_token_enc: { type: String, default: null },
    refresh_token_enc: { type: String, default: null },
    token_expires_at: { type: Date, default: null },

    scopes: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    connected_by: { type: String, default: null },
    disconnected_at: { type: Date, default: null },
    last_sync_at: { type: Date, default: null },
    last_error: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

platformConnectionSchema.index({ tenant_id: 1, platform: 1, dealer_id: 1 });
platformConnectionSchema.index({ tenant_id: 1, platform: 1, status: 1 });

export default mongoose.model('PlatformConnection', platformConnectionSchema);
