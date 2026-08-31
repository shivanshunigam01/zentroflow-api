import mongoose from 'mongoose';

const tenantFields = {
  tenant_id: { type: String, required: true, index: true },
  organization_id: { type: String, default: null, index: true },
  dealer_id: { type: String, default: null, index: true },
  branch_id: { type: String, default: null, index: true },
};

const testDriveSchema = new mongoose.Schema(
  {
    test_drive_id: { type: String, required: true, unique: true, index: true },
    opportunity_id: { type: String, required: true, index: true },
    lead_id: { type: String, index: true },
    customer_id: { type: String, index: true },
    ...tenantFields,
    scheduled_date: { type: Date, required: true, index: true },
    scheduled_time: { type: String, default: null },
    product: { type: String, required: true },
    salesperson: { type: String, default: null, index: true },
    status: { type: String, enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], default: 'SCHEDULED', index: true },
    outcome: { type: String, default: null },
    remarks: { type: String, default: null },
    created_by: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

testDriveSchema.index({ tenant_id: 1, scheduled_date: 1 });
export default mongoose.model('TestDrive', testDriveSchema);
