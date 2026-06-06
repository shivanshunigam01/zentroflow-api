import { env } from '../config/env.js';
import { normalizeMobile } from '../helpers/mobile.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';

const CONNECT_BASE = 'https://connect.api-wa.co/project-apis/v1';

const partnerHeaders = () => {
  if (!env.AISENSY_PARTNER_API_KEY) {
    throw new ApiError(503, 'AISENSY_NOT_CONFIGURED', 'Set AISENSY_PARTNER_API_KEY in server .env');
  }
  return {
    Accept: 'application/json',
    'X-AiSensy-Partner-API-Key': env.AISENSY_PARTNER_API_KEY,
  };
};

/** Project id from env or JWT payload id on WHATSAPP_CAMPAIGN_API_KEY. */
export const resolveWhatsAppProjectId = () => {
  if (env.WHATSAPP_PROJECT_ID) return env.WHATSAPP_PROJECT_ID;

  const key = env.WHATSAPP_CAMPAIGN_API_KEY;
  if (!key || !key.includes('.')) return null;

  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return payload.id || null;
  } catch {
    return null;
  }
};

export const isAisensyConnectConfigured = () => Boolean(
  env.AISENSY_PARTNER_API_KEY && resolveWhatsAppProjectId(),
);

const campaignDetailsUrl = () => {
  const slug = env.WHATSAPP_CAMPAIGN_API_URL?.match(/\/campaign\/([^/]+)\//)?.[1];
  if (slug) {
    return `https://backend.api-wa.co/campaign/${slug}/api/campaign-details`;
  }
  return 'https://backend.aisensy.com/campaign/t1/api/campaign-details';
};

/** Resolve Mongo campaign _id from campaign name (flowtest). */
export const resolveCampaignId = async (campaignName = env.WHATSAPP_CAMPAIGN_NAME) => {
  if (env.WHATSAPP_CAMPAIGN_ID) return env.WHATSAPP_CAMPAIGN_ID;

  if (!env.WHATSAPP_CAMPAIGN_API_KEY) {
    throw new ApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'Set WHATSAPP_CAMPAIGN_API_KEY in server .env');
  }

  const res = await fetch(campaignDetailsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: env.WHATSAPP_CAMPAIGN_API_KEY, campaignName }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.campaign?._id) {
    throw new ApiError(502, 'CAMPAIGN_LOOKUP_FAILED', data?.message || 'Could not resolve campaign id');
  }

  return data.campaign._id;
};

export const fetchCampaignMeta = async (campaignName = env.WHATSAPP_CAMPAIGN_NAME) => {
  if (!env.WHATSAPP_CAMPAIGN_API_KEY) {
    throw new ApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'Set WHATSAPP_CAMPAIGN_API_KEY in server .env');
  }

  const res = await fetch(campaignDetailsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: env.WHATSAPP_CAMPAIGN_API_KEY, campaignName }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new ApiError(502, 'CAMPAIGN_LOOKUP_FAILED', data?.message || 'Could not load campaign metadata');
  }

  return data.campaign;
};

const fetchAudiencePage = async (campaignId, { limit = 100, after, type } = {}) => {
  const projectId = resolveWhatsAppProjectId();
  if (!projectId) {
    throw new ApiError(503, 'WHATSAPP_PROJECT_MISSING', 'Set WHATSAPP_PROJECT_ID or WHATSAPP_CAMPAIGN_API_KEY JWT');
  }

  const qs = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 100)) });
  if (after) qs.set('after', after);
  if (type) qs.set('type', type);

  const url = `${CONNECT_BASE}/project/${projectId}/campaign/audience/${campaignId}?${qs}`;
  const res = await fetch(url, { headers: partnerHeaders() });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new ApiError(res.status >= 500 ? 502 : res.status, 'AISENSY_AUDIENCE_ERROR', data?.message || text.slice(0, 200));
  }

  return data;
};

/** Paginate full campaign audience from connect.api-wa.co. */
export const fetchAllCampaignAudience = async (campaignId, { type } = {}) => {
  const rows = [];
  let after = null;

  for (let page = 0; page < 500; page += 1) {
    const batch = await fetchAudiencePage(campaignId, { limit: 100, after, type });
    const items = batch?.data || [];
    rows.push(...items);
    after = batch?.paging?.cursors?.after;
    if (!after || items.length === 0) break;
  }

  return rows;
};

const mapAudienceRow = (row) => {
  const mobile = normalizeMobile(row.userNumber);
  return {
    id: row._id,
    mobile,
    userNumber: row.userNumber,
    userName: row.userName || '',
    sentAt: row.sentAt || null,
    deliveredAt: row.deliveredAt || null,
    readAt: row.readAt || null,
    repliedAt: row.repliedAt || null,
    failedAt: row.failedAt || null,
    error: row.error || row.failureReason || null,
  };
};

const classifyContact = (contact, { repliedSet, failedSet }) => {
  if (repliedSet.has(contact.mobile) || contact.repliedAt) return 'replied';
  if (failedSet.has(contact.mobile) || contact.failedAt || contact.error) return 'failed';
  if (contact.sentAt && !contact.deliveredAt) return 'failed';
  if (contact.readAt) return 'read_no_reply';
  if (contact.deliveredAt) return 'delivered';
  if (contact.sentAt) return 'sent';
  return 'unknown';
};

/** Build sent / delivered / read / replied / failed / no-reply breakdown. */
export const buildWhatsAppCampaignReport = async (options = {}) => {
  const campaignName = options.campaignName || env.WHATSAPP_CAMPAIGN_NAME;
  const [meta, campaignId] = await Promise.all([
    fetchCampaignMeta(campaignName),
    resolveCampaignId(campaignName),
  ]);

  const [allRows, repliedRows, failedRows] = await Promise.all([
    fetchAllCampaignAudience(campaignId),
    fetchAllCampaignAudience(campaignId, { type: 'replied' }),
    fetchAllCampaignAudience(campaignId, { type: 'failed' }),
  ]);

  const repliedSet = new Set(repliedRows.map((r) => normalizeMobile(r.userNumber)).filter(Boolean));
  const failedSet = new Set(failedRows.map((r) => normalizeMobile(r.userNumber)).filter(Boolean));

  const byMobile = new Map();
  for (const raw of allRows) {
    const contact = mapAudienceRow(raw);
    if (!contact.mobile) continue;
    byMobile.set(contact.mobile, contact);
  }

  const buckets = {
    sent: [],
    delivered: [],
    read_no_reply: [],
    replied: [],
    failed: [],
  };

  for (const contact of byMobile.values()) {
    const status = classifyContact(contact, { repliedSet, failedSet });
    contact.status = status;

    if (contact.sentAt) buckets.sent.push(contact);
    if (contact.deliveredAt) buckets.delivered.push(contact);
    if (status === 'read_no_reply') buckets.read_no_reply.push(contact);
    if (status === 'replied') buckets.replied.push(contact);
    if (status === 'failed') buckets.failed.push(contact);
  }

  const summary = {
    total: byMobile.size,
    sent: buckets.sent.length,
    delivered: buckets.delivered.length,
    readNoReply: buckets.read_no_reply.length,
    replied: buckets.replied.length,
    failed: buckets.failed.length,
    pendingDelivery: buckets.sent.filter((c) => !c.deliveredAt).length,
  };

  return {
    campaign: {
      id: meta._id,
      name: meta.name,
      status: meta.status,
      type: meta.type,
    },
    summary,
    contacts: buckets,
    fetchedAt: new Date().toISOString(),
  };
};
