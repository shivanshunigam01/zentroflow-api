import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  customer_id: { type: String, required: true, unique: true, index: true },
  tenant_id: { type: String, default: null, index: true },
  organization_id: { type: String, default: null, index: true },
  dealer_id: { type: String, default: null, index: true },
  branch_id: { type: String, default: null, index: true },
  name: { type: String, required: true, trim: true, text: true },
  first_name: { type: String, trim: true, default: null },
  last_name: { type: String, trim: true, default: null },
  mobile: { type: String, required: true, trim: true },
  mobile_normalized: { type: String, required: true, index: true },
  alternate_mobile: { type: String, trim: true, default: null },
  whatsapp_number: { type: String, trim: true, default: null },
  email: { type: String, trim: true, lowercase: true },
  preferred_language: { type: String, trim: true, default: null },
  address: { type: String, trim: true },
  locality: { type: String, trim: true, default: null },
  city: { type: String, trim: true, default: null },
  district: { type: String, trim: true, default: null },
  state: { type: String, trim: true, default: null },
  pincode: { type: String, trim: true, default: null },
  customer_type: { type: String, default: 'Individual' },
  consent: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_by: { type: String, default: null },
  updated_by: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

customerSchema.index({ tenant_id: 1, mobile_normalized: 1 }, { unique: true });
customerSchema.index({ tenant_id: 1, email: 1 });
customerSchema.index({ tenant_id: 1, dealer_id: 1, branch_id: 1 });
customerSchema.index({ tenant_id: 1, created_at: -1 });

customerSchema.pre('save', function normalizeEmail() {
  if (this.email) this.email = String(this.email).trim().toLowerCase();
});

export default mongoose.model('Customer', customerSchema);
