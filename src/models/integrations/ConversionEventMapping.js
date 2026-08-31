import mongoose from 'mongoose';

const conversionEventMappingSchema = new mongoose.Schema(
  {
    mapping_id: { type: String, required: true, unique: true, index: true },
    tenant_id: { type: String, required: true, index: true },
    platform: { type: String, enum: ['meta', 'google'], required: true },
    crm_event_type: { type: String, required: true },
    platform_event_name: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
    value_field: { type: String, default: null },
    priority: { type: Number, default: 100 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

conversionEventMappingSchema.index({ tenant_id: 1, platform: 1, crm_event_type: 1 }, { unique: true });

export default mongoose.model('ConversionEventMapping', conversionEventMappingSchema);
