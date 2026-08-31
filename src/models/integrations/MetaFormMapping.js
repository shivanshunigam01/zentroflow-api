import mongoose from 'mongoose';

const metaFormMappingSchema = new mongoose.Schema(
  {
    mapping_id: { type: String, required: true, unique: true, index: true },
    tenant_id: { type: String, required: true, index: true },
    organization_id: { type: String, required: true, index: true },
    dealer_id: { type: String, default: null, index: true },
    branch_id: { type: String, default: null, index: true },

    meta_form_id: { type: String, required: true, index: true },
    meta_form_name: { type: String, default: null },
    meta_page_id: { type: String, default: null, index: true },
    meta_page_name: { type: String, default: null },
    meta_ad_account_id: { type: String, default: null },
    meta_ad_account_name: { type: String, default: null },

    product: { type: String, default: 'General' },
    default_owner: { type: String, default: null },
    status: { type: String, enum: ['MAPPED', 'UNMAPPED', 'DISABLED'], default: 'MAPPED', index: true },
    mapped_by: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

metaFormMappingSchema.index({ tenant_id: 1, meta_form_id: 1 }, { unique: true });

export default mongoose.model('MetaFormMapping', metaFormMappingSchema);
