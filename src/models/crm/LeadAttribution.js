import mongoose from 'mongoose';

/**
 * Platform-agnostic lead attribution — supports Meta, Google, and organic sources.
 * One record per opportunity; created on lead ingestion or first attribution capture.
 */
const leadAttributionSchema = new mongoose.Schema(
  {
    attribution_id: { type: String, required: true, unique: true, index: true },
    opportunity_id: { type: String, required: true, unique: true, index: true },
    tenant_id: { type: String, required: true, index: true },
    organization_id: { type: String, default: null, index: true },
    dealer_id: { type: String, default: null, index: true },
    branch_id: { type: String, default: null, index: true },

    source: { type: String, default: null },
    medium: { type: String, default: null },
    campaign: { type: String, default: null },
    campaign_id: { type: String, default: null, index: true },
    ad_id: { type: String, default: null },
    ad_set_id: { type: String, default: null },
    ad_name: { type: String, default: null },
    form_id: { type: String, default: null },
    external_lead_id: { type: String, default: null, index: true },
    platform: { type: String, default: null, index: true },
    landing_page: { type: String, default: null },

    utm_source: { type: String, default: null },
    utm_medium: { type: String, default: null },
    utm_campaign: { type: String, default: null },
    utm_content: { type: String, default: null },
    utm_term: { type: String, default: null },

    gclid: { type: String, default: null },
    fbclid: { type: String, default: null },

    raw_payload: { type: mongoose.Schema.Types.Mixed, default: null },
    captured_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

leadAttributionSchema.index({ tenant_id: 1, external_lead_id: 1, platform: 1 });
leadAttributionSchema.index({ tenant_id: 1, campaign_id: 1 });

export default mongoose.model('LeadAttribution', leadAttributionSchema);
