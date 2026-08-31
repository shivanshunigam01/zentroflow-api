import mongoose from 'mongoose';

const tenantFields = {
  tenant_id: { type: String, required: true, index: true },
  organization_id: { type: String, default: null, index: true },
  dealer_id: { type: String, default: null, index: true },
  branch_id: { type: String, default: null, index: true },
};

const bookingSchema = new mongoose.Schema(
  {
    booking_id: { type: String, required: true, unique: true, index: true },
    opportunity_id: { type: String, required: true, index: true },
    lead_id: { type: String, index: true },
    customer_id: { type: String, index: true },
    ...tenantFields,
    product: { type: String, required: true },
    booking_date: { type: Date, required: true, index: true },
    amount: { type: Number, default: null },
    booking_reference: { type: String, default: null },
    status: { type: String, enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'], default: 'PENDING', index: true },
    remarks: { type: String, default: null },
    created_by: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

bookingSchema.index({ tenant_id: 1, status: 1, booking_date: -1 });
export default mongoose.model('Booking', bookingSchema);
