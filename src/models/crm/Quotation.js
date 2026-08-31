import mongoose from 'mongoose';

const tenantFields = {
  tenant_id: { type: String, required: true, index: true },
  organization_id: { type: String, default: null, index: true },
  dealer_id: { type: String, default: null, index: true },
  branch_id: { type: String, default: null, index: true },
};

const quotationSchema = new mongoose.Schema(
  {
    quotation_id: { type: String, required: true, unique: true, index: true },
    opportunity_id: { type: String, required: true, index: true },
    lead_id: { type: String, index: true },
    customer_id: { type: String, index: true },
    ...tenantFields,
    product: { type: String, required: true },
    amount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    validity_until: { type: Date, default: null },
    status: { type: String, enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'], default: 'DRAFT', index: true },
    remarks: { type: String, default: null },
    created_by: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

quotationSchema.index({ tenant_id: 1, status: 1, created_at: -1 });
export default mongoose.model('Quotation', quotationSchema);
