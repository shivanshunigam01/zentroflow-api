import { env } from '../config/env.js';
import { normalizeMobile, isValidMobile } from '../helpers/mobile.js';

/** AiSensy / api-wa.co expects e.g. 09771495587 */
export const formatWhatsAppDestination = (mobile) => {
  const digits = normalizeMobile(mobile);
  if (!isValidMobile(digits)) return null;
  return `0${digits}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildPayload = (destination) => ({
  apiKey: env.WHATSAPP_CAMPAIGN_API_KEY,
  campaignName: env.WHATSAPP_CAMPAIGN_NAME,
  destination,
  userName: env.WHATSAPP_CAMPAIGN_USER_NAME,
  templateParams: [],
  source: env.WHATSAPP_CAMPAIGN_SOURCE,
  media: {},
  buttons: [],
  carouselCards: [],
  location: {},
  attributes: {},
  paramsFallbackValue: {},
});

export const sendWhatsAppCampaignMessage = async (destination) => {
  if (!env.WHATSAPP_CAMPAIGN_API_URL || !env.WHATSAPP_CAMPAIGN_API_KEY) {
    throw new Error('WhatsApp campaign API is not configured on the server');
  }

  const res = await fetch(env.WHATSAPP_CAMPAIGN_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(destination)),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message = data?.message || data?.error || text.slice(0, 300) || `HTTP ${res.status}`;
    return { ok: false, destination, status: res.status, error: message, data };
  }

  return { ok: true, destination, data };
};

/**
 * Send campaign message to each unique destination sequentially.
 * @param {string[]} mobiles - raw mobile values from leads/customers
 */
export const sendBulkWhatsAppCampaign = async (mobiles = [], options = {}) => {
  const delayMs = options.delayMs ?? Number(env.WHATSAPP_CAMPAIGN_DELAY_MS || 350);
  const destinations = [...new Set(
    mobiles.map((m) => formatWhatsAppDestination(m)).filter(Boolean),
  )];

  const summary = {
    total: destinations.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const destination of destinations) {
    try {
      const result = await sendWhatsAppCampaignMessage(destination);
      if (result.ok) {
        summary.sent += 1;
      } else {
        summary.failed += 1;
        if (summary.errors.length < 40) {
          summary.errors.push({ destination, error: result.error });
        }
      }
    } catch (err) {
      summary.failed += 1;
      if (summary.errors.length < 40) {
        summary.errors.push({ destination, error: err.message });
      }
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  return summary;
};

export const isWhatsAppCampaignConfigured = () => Boolean(
  env.WHATSAPP_CAMPAIGN_API_URL && env.WHATSAPP_CAMPAIGN_API_KEY,
);
