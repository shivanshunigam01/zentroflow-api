import { normalizeMobile, isValidMobile } from '../../helpers/mobile.js';

const pickField = (fields, names) => {
  for (const name of names) {
    const f = fields.find((x) => String(x.name || '').toLowerCase() === name.toLowerCase());
    if (f?.values?.[0]) return String(f.values[0]).trim();
  }
  return null;
};

export const normalizeMetaLead = (metaLead, context = {}) => {
  const fieldData = metaLead?.field_data || [];
  const fullName = pickField(fieldData, ['full_name', 'name', 'first_name']) || 'Meta Lead';
  const phoneRaw = pickField(fieldData, ['phone_number', 'phone', 'mobile', 'mobile_number']);
  const email = pickField(fieldData, ['email', 'email_address']);
  const city = pickField(fieldData, ['city']);
  const state = pickField(fieldData, ['state']);
  const pincode = pickField(fieldData, ['zip_code', 'pincode', 'post_code']);

  const mobile = phoneRaw && isValidMobile(phoneRaw) ? normalizeMobile(phoneRaw) : null;
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || fullName;
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;

  return {
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    mobile,
    mobile_display: phoneRaw,
    whatsapp_number: mobile,
    email,
    city,
    state,
    pincode,
    source: 'Meta',
    medium: 'paid_social',
    campaign: context.campaign_name || null,
    campaign_id: metaLead?.campaign_id || context.campaign_id || null,
    ad_id: metaLead?.ad_id || context.ad_id || null,
    ad_set_id: metaLead?.adset_id || context.adset_id || null,
    form_id: metaLead?.form_id || context.form_id || null,
    external_lead_id: metaLead?.id || context.external_lead_id || null,
    platform: 'meta',
    received_at: metaLead?.created_time ? new Date(metaLead.created_time) : new Date(),
    utm_source: 'facebook',
    utm_medium: 'paid_social',
    utm_campaign: context.campaign_name || null,
  };
};

export const normalizeGoogleLead = (payload) => ({
  name: payload.name || 'Google Lead',
  first_name: payload.first_name || null,
  last_name: payload.last_name || null,
  mobile: payload.mobile ? normalizeMobile(payload.mobile) : null,
  email: payload.email || null,
  source: 'Google Ads',
  medium: 'paid_search',
  platform: 'google',
  gclid: payload.gclid || null,
  campaign: payload.campaign || null,
  campaign_id: payload.campaign_id || null,
  external_lead_id: payload.lead_id || null,
  received_at: new Date(),
  utm_source: 'google',
  utm_medium: 'cpc',
});
