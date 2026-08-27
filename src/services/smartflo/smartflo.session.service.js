import { env } from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import DialerAgentSession from '../../models/DialerAgentSession.js';
import { smartfloPost } from './smartflo.client.js';
import { writeDialerAudit } from './smartflo.audit.service.js';

const userKey = (user) => String(user?.userId || user?.id || user?.email || 'unknown');

/** Start Session is available whenever campaign + token are set (Dial Out Each Call or session). */
export const isSessionStartEnabled = () => Boolean(
  env.SMARTFLO_API_TOKEN?.trim() && env.SMARTFLO_CAMPAIGN_ID?.trim(),
);

export const getSessionStatus = async (user) => {
  const mode = env.SMARTFLO_DIALER_MODE;
  const sessionEnabled = isSessionStartEnabled();
  const doc = await DialerAgentSession.findOne({ user_id: userKey(user) }).lean();
  const status = doc?.status || 'OFFLINE';
  const active = sessionEnabled && ['IN_SESSION', 'IN_CALL', 'WRAP_UP', 'READY', 'PAUSED'].includes(status);
  return {
    dialerMode: mode,
    sessionEnabled,
    active,
    status,
    campaignId: env.SMARTFLO_CAMPAIGN_ID || null,
    startedAt: doc?.started_at || null,
    endedAt: doc?.ended_at || null,
    agentId: userKey(user),
    message: !sessionEnabled
      ? 'Configure SMARTFLO_API_TOKEN and SMARTFLO_CAMPAIGN_ID to start a dialer session.'
      : active
        ? 'Session is active — Smartflo will auto-dial. End Session when finished.'
        : mode === 'dial_out_each_call'
          ? 'Dial Out (Each Call): click Start Session to go live, receive the first call, then Smartflo continues auto-dialing.'
          : 'Session mode is ready. Click Start Session to begin auto-dialing.',
  };
};

const requireSessionReady = () => {
  if (!env.SMARTFLO_API_TOKEN?.trim()) {
    throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Smartflo API token is not configured');
  }
  if (!env.SMARTFLO_CAMPAIGN_ID?.trim()) {
    throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Smartflo campaign is not configured');
  }
};

const persist = async (user, patch) => DialerAgentSession.findOneAndUpdate(
  { user_id: userKey(user) },
  { $set: { user_email: user?.email || null, campaign_id: env.SMARTFLO_CAMPAIGN_ID, ...patch } },
  { upsert: true, new: true },
);

export const startDialerSession = async (user) => {
  requireSessionReady();
  const campaignId = env.SMARTFLO_CAMPAIGN_ID.trim();
  const data = await smartfloPost(
    '/dialer/session_call',
    { startOrEnd: true, campaignId, logout: false },
    'sessionStart',
  );
  await persist(user, { status: 'IN_SESSION', started_at: new Date(), ended_at: null });
  await writeDialerAudit({
    actor: user?.email || user?.name || 'Agent',
    action: 'session.started',
    entity: 'campaign',
    entityId: campaignId,
    metadata: { dialerMode: env.SMARTFLO_DIALER_MODE },
  });
  console.log(JSON.stringify({
    service: 'smartflo',
    operation: 'dialer.session.start',
    dialerMode: env.SMARTFLO_DIALER_MODE,
    status: 'success',
  }));
  return { status: 'IN_SESSION', active: true, dialerMode: env.SMARTFLO_DIALER_MODE, smartflo: data };
};

export const endDialerSession = async (user) => {
  requireSessionReady();
  const campaignId = env.SMARTFLO_CAMPAIGN_ID.trim();
  const data = await smartfloPost(
    '/dialer/session_call',
    { startOrEnd: false, campaignId, logout: true },
    'sessionEnd',
  );
  await persist(user, { status: 'OFFLINE', ended_at: new Date() });
  await writeDialerAudit({
    actor: user?.email || user?.name || 'Agent',
    action: 'session.ended',
    entity: 'campaign',
    entityId: campaignId,
  });
  console.log(JSON.stringify({ service: 'smartflo', operation: 'dialer.session.end', status: 'success' }));
  return { status: 'OFFLINE', active: false, smartflo: data };
};

export const logoutDialerSession = async (user) => {
  requireSessionReady();
  const campaignId = env.SMARTFLO_CAMPAIGN_ID.trim();
  const data = await smartfloPost(
    '/dialer/logout',
    { campaign_id: campaignId },
    'sessionLogout',
  );
  await persist(user, { status: 'OFFLINE', ended_at: new Date() });
  await writeDialerAudit({
    actor: user?.email || user?.name || 'Agent',
    action: 'session.logout',
    entity: 'campaign',
    entityId: campaignId,
  });
  return { status: 'OFFLINE', active: false, smartflo: data };
};
