import { randomUUID } from 'crypto';
import axios from 'axios';
import { env } from '../../config/env.js';
import { encryptSecret, decryptSecret } from '../../helpers/crypto.js';
import PlatformConnection from '../../models/integrations/PlatformConnection.js';
import { registerAdapter } from '../platformAdapter.js';

const isConfigured = () => Boolean(env.GOOGLE_ADS_CLIENT_ID && env.GOOGLE_ADS_CLIENT_SECRET);

const getConnection = async (tenantContext) => PlatformConnection.findOne({
  platform: 'google',
  tenant_id: tenantContext.tenant_id,
  status: 'CONNECTED',
  ...(tenantContext.dealer_id ? { dealer_id: tenantContext.dealer_id } : {}),
}).sort({ updated_at: -1 });

export const googleAdapter = {
  platform: 'google',

  async connect({ tenantContext, code }) {
    if (!isConfigured()) {
      return { status: 'not_configured', message: 'Google Ads credentials not configured' };
    }
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_ADS_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }, { timeout: 15000 });

    const accessToken = tokenRes.data?.access_token;
    const refreshToken = tokenRes.data?.refresh_token;
    if (!accessToken) throw new Error('Google OAuth token exchange failed');

    const connectionId = `GADS-${randomUUID().slice(0, 8).toUpperCase()}`;
    await PlatformConnection.findOneAndUpdate(
      { tenant_id: tenantContext.tenant_id, platform: 'google', dealer_id: tenantContext.dealer_id || null },
      {
        connection_id: connectionId,
        platform: 'google',
        tenant_id: tenantContext.tenant_id,
        organization_id: tenantContext.organization_id,
        dealer_id: tenantContext.dealer_id,
        branch_id: tenantContext.branch_id,
        status: 'CONNECTED',
        access_token_enc: encryptSecret(accessToken),
        refresh_token_enc: refreshToken ? encryptSecret(refreshToken) : null,
        token_expires_at: tokenRes.data?.expires_in ? new Date(Date.now() + tokenRes.data.expires_in * 1000) : null,
        connected_by: tenantContext.user_id,
      },
      { upsert: true, new: true },
    );
    return { status: 'connected', connection_id: connectionId };
  },

  async disconnect({ tenantContext }) {
    await PlatformConnection.updateMany(
      { tenant_id: tenantContext.tenant_id, platform: 'google', dealer_id: tenantContext.dealer_id || null },
      { status: 'DISCONNECTED', access_token_enc: null, refresh_token_enc: null, disconnected_at: new Date() },
    );
    return { status: 'disconnected' };
  },

  async getAccounts({ tenantContext }) {
    const conn = await getConnection(tenantContext);
    if (!conn) return { connected: false, accounts: [] };
    if (!isConfigured()) return { connected: true, accounts: [], mode: 'mock' };
    return {
      connected: true,
      accounts: [{
        id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || 'mock-customer-id',
        name: 'Google Ads Account',
        manager: true,
      }],
    };
  },

  async getPages() {
    return { pages: [] };
  },

  async getForms() {
    return { forms: [] };
  },

  async fetchLead() {
    throw new Error('Google lead fetch via webhook/offline conversion only');
  },

  async sendConversion({ tenantContext, event }) {
    if (!isConfigured()) return { status: 'skipped', reason: 'not_configured', mock: true };
    const conn = await getConnection(tenantContext);
    if (!conn) return { status: 'skipped', reason: 'not_connected' };
    return { status: 'queued', mode: 'offline_conversion_architecture', event_name: event.event_name };
  },

  async healthCheck({ tenantContext }) {
    const conn = await getConnection(tenantContext);
    return {
      platform: 'google',
      configured: isConfigured(),
      connected: Boolean(conn),
      token_status: conn?.token_expires_at && conn.token_expires_at < new Date() ? 'expired' : conn ? 'ok' : 'missing',
      last_sync_at: conn?.last_sync_at || null,
    };
  },
};

registerAdapter('google', googleAdapter);
