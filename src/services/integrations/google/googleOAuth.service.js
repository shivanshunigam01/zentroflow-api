import { randomUUID } from 'crypto';
import { env } from '../../../config/env.js';
import OAuthState from '../../../models/integrations/OAuthState.js';
import { getAdapter } from '../../../integrations/platformAdapter.js';
import { writeAuditLog } from '../../audit.service.js';
import { ApiError } from '../../../middleware/errorHandler.middleware.js';
import '../../../integrations/google/googleAdapter.js';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export const startGoogleOAuth = async ({ tenantContext, redirect_after }) => {
  if (!env.GOOGLE_ADS_CLIENT_ID || !env.GOOGLE_ADS_OAUTH_REDIRECT_URI) {
    throw new ApiError(503, 'GOOGLE_NOT_CONFIGURED', 'Google Ads OAuth is not configured');
  }
  const state = randomUUID();
  await OAuthState.create({
    state,
    platform: 'google',
    tenant_id: tenantContext.tenant_id,
    organization_id: tenantContext.organization_id,
    dealer_id: tenantContext.dealer_id,
    branch_id: tenantContext.branch_id,
    user_id: tenantContext.user_id,
    redirect_after,
    expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS),
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_ADS_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_ADS_OAUTH_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return { authorization_url: url.toString(), state };
};

export const handleGoogleOAuthCallback = async ({ code, state, correlation_id, ip_address }) => {
  const stateDoc = await OAuthState.findOne({ state, platform: 'google', consumed: false });
  if (!stateDoc || stateDoc.expires_at < new Date()) {
    throw new ApiError(400, 'INVALID_OAUTH_STATE', 'OAuth state invalid or expired');
  }
  stateDoc.consumed = true;
  await stateDoc.save();

  const tenantContext = {
    tenant_id: stateDoc.tenant_id,
    organization_id: stateDoc.organization_id,
    dealer_id: stateDoc.dealer_id,
    branch_id: stateDoc.branch_id,
    user_id: stateDoc.user_id,
  };

  const result = await getAdapter('google').connect({ tenantContext, code });
  await writeAuditLog({
    tenantContext,
    action: 'integration.google.connected',
    entity_type: 'platform_connection',
    entity_id: result.connection_id || 'google',
    correlation_id,
    ip_address,
  });
  return { ...result, redirect_after: stateDoc.redirect_after };
};

export const getGoogleAccounts = async (tenantContext) => getAdapter('google').getAccounts({ tenantContext });
export const disconnectGoogle = async ({ tenantContext, correlation_id, ip_address }) => {
  const result = await getAdapter('google').disconnect({ tenantContext });
  await writeAuditLog({
    tenantContext,
    action: 'integration.google.disconnected',
    entity_type: 'platform_connection',
    entity_id: 'google',
    correlation_id,
    ip_address,
  });
  return result;
};
export const getGoogleHealth = async (tenantContext) => getAdapter('google').healthCheck({ tenantContext });
