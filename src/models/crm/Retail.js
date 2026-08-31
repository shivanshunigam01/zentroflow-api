import mongoose from 'mongoose';

const tenantFields = {
  tenant_id: { type: String, required: true, index: true },
  organization_id: { type: String, default: null, index: true },
  dealer_id: { type: String, default: null, index: true },
  branch_id: { type: String, default: null, index: true },
};

const retailSchema = new mongoose.Schema(
  {
    retail_id: { type: String, required: true, unique: true, index: true },
    opportunity_id: { type: String, required: true, index: true },
    lead_id: { type: String, index: true },
    customer_id: { type: String, index: true },
    ...tenantFields,
    retail_date: { type: Date, required: true, index: true },
    product: { type: String, required: true },
    dealer_name: { type: String, default: null },
    amount: { type: Number, default: null },
    delivery_status: { type: String, enum: ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'], default: 'PENDING', index: true },
    remarks: { type: String, default: null },
    created_by: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

retailSchema.index({ tenant_id: 1, delivery_status: 1, retail_date: -1 });
export default mongoose.model('Retail', retailSchema);
