import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import {
  startMetaOAuth,
  handleMetaOAuthCallback,
  getMetaAccounts,
  getMetaForms,
  mapMetaForm,
  disconnectMeta,
  getMetaHealth,
} from '../services/integrations/meta/metaOAuth.service.js';
import {
  startGoogleOAuth,
  handleGoogleOAuthCallback,
  getGoogleAccounts,
  disconnectGoogle,
  getGoogleHealth,
} from '../services/integrations/google/googleOAuth.service.js';
import {
  getIntegrationHealth,
  getMetaIntegrationHealth,
  getGoogleIntegrationHealth,
} from '../services/integrations/integrationHealth.service.js';
import { verifyMetaWebhookGet, verifyMetaWebhookSignature, processMetaWebhook } from '../services/integrations/meta/metaWebhook.service.js';
import { listRoutingRules, createRoutingRule } from '../services/integrations/routing.service.js';

const ctx = (req, res) => ({
  tenantContext: req.tenantContext,
  correlation_id: res.locals.correlationId,
  ip_address: req.ip,
});

// --- Meta OAuth (authenticated) ---
export const metaConnect = asyncHandler(async (req, res) => {
  ok(res, await startMetaOAuth({ tenantContext: req.tenantContext, redirect_after: req.body?.redirect_after }));
});

export const metaCallback = asyncHandler(async (req, res) => {
  const result = await handleMetaOAuthCallback({
    code: req.query.code,
    state: req.query.state,
    correlation_id: res.locals.correlationId,
    ip_address: req.ip,
  });
  if (result.redirect_after) {
    return res.redirect(result.redirect_after);
  }
  ok(res, result);
});

export const metaAccounts = asyncHandler(async (req, res) => {
  ok(res, await getMetaAccounts(req.tenantContext));
});

export const metaForms = asyncHandler(async (req, res) => {
  ok(res, await getMetaForms(req.tenantContext));
});

export const metaMapForm = asyncHandler(async (req, res) => {
  ok(res, await mapMetaForm({ ...ctx(req, res), formId: req.params.formId, body: req.body }));
});

export const metaDisconnect = asyncHandler(async (req, res) => {
  ok(res, await disconnectMeta(ctx(req, res)));
});

export const metaHealth = asyncHandler(async (req, res) => {
  ok(res, await getMetaHealth(req.tenantContext));
});

// --- Google OAuth ---
export const googleConnect = asyncHandler(async (req, res) => {
  ok(res, await startGoogleOAuth({ tenantContext: req.tenantContext, redirect_after: req.body?.redirect_after }));
});

export const googleCallback = asyncHandler(async (req, res) => {
  const result = await handleGoogleOAuthCallback({
    code: req.query.code,
    state: req.query.state,
    correlation_id: res.locals.correlationId,
    ip_address: req.ip,
  });
  if (result.redirect_after) return res.redirect(result.redirect_after);
  ok(res, result);
});

export const googleAccounts = asyncHandler(async (req, res) => {
  ok(res, await getGoogleAccounts(req.tenantContext));
});

export const googleDisconnect = asyncHandler(async (req, res) => {
  ok(res, await disconnectGoogle(ctx(req, res)));
});

export const googleHealth = asyncHandler(async (req, res) => {
  ok(res, await getGoogleHealth(req.tenantContext));
});

// --- Health ---
export const integrationsHealth = asyncHandler(async (req, res) => {
  ok(res, await getIntegrationHealth(req.tenantContext));
});

// --- Webhook (public) ---
export const metaWebhookVerify = (req, res) => {
  const challenge = verifyMetaWebhookGet(req.query);
  res.status(200).send(challenge);
};

export const metaWebhookReceive = asyncHandler(async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body);
  verifyMetaWebhookSignature(rawBody, req.get('X-Hub-Signature-256'));
  const result = await processMetaWebhook(req.body, res.locals.correlationId);
  ok(res, { received: true, ...result });
});

// --- Routing ---
export const listRouting = asyncHandler(async (req, res) => {
  ok(res, await listRoutingRules(req.tenantContext));
});

export const createRouting = asyncHandler(async (req, res) => {
  ok(res, await createRoutingRule({ tenantContext: req.tenantContext, body: req.body }), { status: 201 });
});
