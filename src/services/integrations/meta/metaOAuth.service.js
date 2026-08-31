import { randomUUID } from 'crypto';
import { env } from '../../config/env.js';
import OAuthState from '../../models/integrations/OAuthState.js';
import MetaFormMapping from '../../models/integrations/MetaFormMapping.js';
import { getAdapter } from '../../integrations/platformAdapter.js';
import { writeAuditLog } from '../audit.service.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import '../../integrations/meta/metaAdapter.js';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export const startMetaOAuth = async ({ tenantContext, redirect_after }) => {
  if (!env.META_APP_ID || !env.META_OAUTH_REDIRECT_URI) {
    throw new ApiError(503, 'META_NOT_CONFIGURED', 'Meta OAuth is not configured');
  }
  const state = randomUUID();
  await OAuthState.create({
    state,
    platform: 'meta',
    tenant_id: tenantContext.tenant_id,
    organization_id: tenantContext.organization_id,
    dealer_id: tenantContext.dealer_id,
    branch_id: tenantContext.branch_id,
    user_id: tenantContext.user_id,
    redirect_after: redirect_after || null,
    expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS),
  });
  const scopes = ['pages_show_list', 'pages_read_engagement', 'leads_retrieval', 'ads_read', 'business_management'];
  const url = new URL(`https://www.facebook.com/${env.META_API_VERSION || 'v21.0'}/dialog/oauth`);
  url.searchParams.set('client_id', env.META_APP_ID);
  url.searchParams.set('redirect_uri', env.META_OAUTH_REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', scopes.join(','));
  return { authorization_url: url.toString(), state };
};

export const handleMetaOAuthCallback = async ({ code, state, correlation_id, ip_address }) => {
  const stateDoc = await OAuthState.findOne({ state, platform: 'meta', consumed: false });
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

  const adapter = getAdapter('meta');
  const result = await adapter.connect({ tenantContext, code });

  await writeAuditLog({
    tenantContext,
    action: 'integration.meta.connected',
    entity_type: 'platform_connection',
    entity_id: result.connection_id || 'meta',
    after: { platform: 'meta', status: result.status },
    correlation_id,
    ip_address,
  });

  return { ...result, redirect_after: stateDoc.redirect_after };
};

export const getMetaAccounts = async (tenantContext) => getAdapter('meta').getAccounts({ tenantContext });
export const getMetaForms = async (tenantContext) => getAdapter('meta').getForms({ tenantContext });
export const disconnectMeta = async ({ tenantContext, correlation_id, ip_address }) => {
  const result = await getAdapter('meta').disconnect({ tenantContext });
  await writeAuditLog({
    tenantContext,
    action: 'integration.meta.disconnected',
    entity_type: 'platform_connection',
    entity_id: 'meta',
    correlation_id,
    ip_address,
  });
  return result;
};

export const mapMetaForm = async ({
  tenantContext,
  formId,
  body,
  correlation_id,
  ip_address,
}) => {
  const mappingId = `MFM-${randomUUID().slice(0, 8).toUpperCase()}`;
  const mapping = await MetaFormMapping.findOneAndUpdate(
    { tenant_id: tenantContext.tenant_id, meta_form_id: formId },
    {
      mapping_id: mappingId,
      tenant_id: tenantContext.tenant_id,
      organization_id: tenantContext.organization_id,
      dealer_id: body.dealer_id || tenantContext.dealer_id,
      branch_id: body.branch_id || tenantContext.branch_id,
      meta_form_id: formId,
      meta_form_name: body.meta_form_name || null,
      meta_page_id: body.meta_page_id || null,
      meta_page_name: body.meta_page_name || null,
      meta_ad_account_id: body.meta_ad_account_id || null,
      product: body.product || 'General',
      default_owner: body.default_owner || null,
      status: 'MAPPED',
      mapped_by: tenantContext.user_id,
    },
    { upsert: true, new: true },
  );

  await writeAuditLog({
    tenantContext,
    action: 'integration.meta.form_mapped',
    entity_type: 'meta_form_mapping',
    entity_id: mapping.mapping_id,
    after: { meta_form_id: formId, dealer_id: mapping.dealer_id, branch_id: mapping.branch_id },
    correlation_id,
    ip_address,
  });

  return mapping;
};

export const getMetaHealth = async (tenantContext) => getAdapter('meta').healthCheck({ tenantContext });
