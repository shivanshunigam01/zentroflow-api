import { randomUUID } from 'crypto';
import axios from 'axios';
import { env } from '../../config/env.js';
import { encryptSecret, decryptSecret } from '../../helpers/crypto.js';
import PlatformConnection from '../../models/integrations/PlatformConnection.js';
import MetaFormMapping from '../../models/integrations/MetaFormMapping.js';
import { registerAdapter } from '../platformAdapter.js';

const API_VERSION = () => env.META_API_VERSION || 'v21.0';
const GRAPH = () => `https://graph.facebook.com/${API_VERSION()}`;

const isConfigured = () => Boolean(env.META_APP_ID && env.META_APP_SECRET);

const getConnection = async (tenantContext) => {
  const filter = {
    platform: 'meta',
    tenant_id: tenantContext.tenant_id,
    status: 'CONNECTED',
  };
  if (tenantContext.dealer_id) filter.dealer_id = tenantContext.dealer_id;
  return PlatformConnection.findOne(filter).sort({ updated_at: -1 });
};

const graphGet = async (path, token, params = {}) => {
  if (!isConfigured() || !token) return { data: { data: [] } };
  const res = await axios.get(`${GRAPH()}${path}`, {
    params: { access_token: token, ...params },
    timeout: 15000,
  });
  return res;
};

export const metaAdapter = {
  platform: 'meta',

  async connect({ tenantContext, code }) {
    if (!isConfigured()) {
      return { status: 'not_configured', message: 'Meta credentials not configured' };
    }
    const tokenRes = await axios.get(`${GRAPH()}/oauth/access_token`, {
      params: {
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        redirect_uri: env.META_OAUTH_REDIRECT_URI,
        code,
      },
      timeout: 15000,
    });
    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) throw new Error('Meta OAuth token exchange failed');

    const me = await graphGet('/me', accessToken, { fields: 'id,name' });
    const connectionId = `META-${randomUUID().slice(0, 8).toUpperCase()}`;
    await PlatformConnection.findOneAndUpdate(
      { tenant_id: tenantContext.tenant_id, platform: 'meta', dealer_id: tenantContext.dealer_id || null },
      {
        connection_id: connectionId,
        platform: 'meta',
        tenant_id: tenantContext.tenant_id,
        organization_id: tenantContext.organization_id,
        dealer_id: tenantContext.dealer_id,
        branch_id: tenantContext.branch_id,
        status: 'CONNECTED',
        external_account_id: me.data?.id || null,
        external_account_name: me.data?.name || null,
        access_token_enc: encryptSecret(accessToken),
        connected_by: tenantContext.user_id,
        disconnected_at: null,
        last_error: null,
      },
      { upsert: true, new: true },
    );
    return { status: 'connected', connection_id: connectionId };
  },

  async disconnect({ tenantContext }) {
    await PlatformConnection.updateMany(
      { tenant_id: tenantContext.tenant_id, platform: 'meta', dealer_id: tenantContext.dealer_id || null },
      { status: 'DISCONNECTED', access_token_enc: null, refresh_token_enc: null, disconnected_at: new Date() },
    );
    return { status: 'disconnected' };
  },

  async getAccounts({ tenantContext }) {
    const conn = await getConnection(tenantContext);
    if (!conn) return { connected: false, accounts: [] };
    const token = decryptSecret(conn.access_token_enc);
    if (!isConfigured() || !token) {
      return { connected: true, accounts: [], mode: 'mock' };
    }
    try {
      const res = await graphGet('/me/adaccounts', token, { fields: 'id,name,account_status', limit: 50 });
      return { connected: true, business: conn.external_business_name, accounts: res.data?.data || [] };
    } catch {
      return { connected: true, accounts: [], error: 'account_fetch_failed' };
    }
  },

  async getPages({ tenantContext }) {
    const conn = await getConnection(tenantContext);
    if (!conn) return { pages: [] };
    const token = decryptSecret(conn.access_token_enc);
    if (!isConfigured() || !token) return { pages: [] };
    try {
      const res = await graphGet('/me/accounts', token, { fields: 'id,name', limit: 50 });
      return { pages: res.data?.data || [] };
    } catch {
      return { pages: [] };
    }
  },

  async getForms({ tenantContext }) {
    const conn = await getConnection(tenantContext);
    if (!conn) return { forms: [] };
    const token = decryptSecret(conn.access_token_enc);
    if (!isConfigured() || !token) return { forms: [] };
    const pages = await this.getPages({ tenantContext });
    const forms = [];
    for (const page of (pages.pages || []).slice(0, 10)) {
      try {
        const pageTokenRes = await graphGet(`/${page.id}`, token, { fields: 'access_token' });
        const pageToken = pageTokenRes.data?.access_token || token;
        const res = await graphGet(`/${page.id}/leadgen_forms`, pageToken, { fields: 'id,name,status', limit: 50 });
        for (const f of res.data?.data || []) {
          forms.push({ ...f, page_id: page.id, page_name: page.name });
        }
      } catch { /* skip page */ }
    }
    const mappings = await MetaFormMapping.find({ tenant_id: tenantContext.tenant_id }).lean();
    const mapByForm = new Map(mappings.map((m) => [m.meta_form_id, m]));
    return {
      forms: forms.map((f) => ({
        ...f,
        mapping: mapByForm.get(f.id) || null,
        mapping_status: mapByForm.get(f.id)?.status || 'UNMAPPED',
      })),
    };
  },

  async fetchLead({ tenantContext, externalLeadId, pageId }) {
    const conn = await getConnection(tenantContext);
    if (!conn) throw new Error('Meta not connected');
    const token = decryptSecret(conn.access_token_enc);
    if (!isConfigured() || !token) {
      return {
        id: externalLeadId,
        field_data: [
          { name: 'full_name', values: ['Test Lead'] },
          { name: 'phone_number', values: ['9876543210'] },
          { name: 'email', values: ['test@example.com'] },
        ],
        _mock: true,
      };
    }
    const res = await graphGet(`/${externalLeadId}`, token, { fields: 'id,created_time,field_data,ad_id,adset_id,campaign_id,form_id' });
    return res.data;
  },

  async sendConversion({ tenantContext, event }) {
    if (!isConfigured()) {
      return { status: 'skipped', reason: 'not_configured', mock: true };
    }
    const conn = await getConnection(tenantContext);
    if (!conn) return { status: 'skipped', reason: 'not_connected' };
    const token = decryptSecret(conn.access_token_enc);
    const pixelId = conn.metadata?.pixel_id || env.META_PIXEL_ID;
    if (!token || !pixelId) return { status: 'skipped', reason: 'missing_pixel_or_token' };

    const payload = {
      data: [{
        event_name: event.event_name,
        event_time: Math.floor(new Date(event.event_time).getTime() / 1000),
        action_source: 'system_generated',
        user_data: event.payload?.user_data || {},
        custom_data: event.payload?.custom_data || {},
      }],
    };
    const res = await axios.post(`${GRAPH()}/${pixelId}/events`, payload, {
      params: { access_token: token },
      timeout: 15000,
    });
    return { status: 'sent', response: { events_received: res.data?.events_received } };
  },

  async healthCheck({ tenantContext }) {
    const conn = await getConnection(tenantContext);
    return {
      platform: 'meta',
      configured: isConfigured(),
      connected: Boolean(conn),
      token_status: conn?.token_expires_at && conn.token_expires_at < new Date() ? 'expired' : conn ? 'ok' : 'missing',
      last_sync_at: conn?.last_sync_at || null,
      last_error: conn?.last_error || null,
    };
  },
};

registerAdapter('meta', metaAdapter);
