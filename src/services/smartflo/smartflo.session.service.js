import { env, isDialerSessionMode } from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import DialerAgentSession from '../../models/DialerAgentSession.js';
import { smartfloPost } from './smartflo.client.js';
import { writeDialerAudit } from './smartflo.audit.service.js';

const sessionDisabled = () => new ApiError(
  409,
  'SMARTFLO_SESSION_DISABLED',
  'This campaign uses Dial Out (Each Call). Log into the Smartflo Dialer Panel instead of starting a session from ZentroFLOW.',
);

const userKey = (user) => String(user?.userId || user?.id || user?.email || 'unknown');

export const getSessionStatus = async (user) => {
  const mode = env.SMARTFLO_DIALER_MODE;
  const sessionEnabled = isDialerSessionMode();
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
    message: sessionEnabled
      ? (active ? 'Session is active.' : 'Session APIs are enabled. Start a session to begin auto-dialing.')
      : 'Calling is handled by the Smartflo Dialer Panel.',
  };
};

const requireSessionMode = () => {
  if (!isDialerSessionMode()) throw sessionDisabled();
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
  requireSessionMode();
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
  });
  console.log(JSON.stringify({ service: 'smartflo', operation: 'dialer.session.start', status: 'success' }));
  return { status: 'IN_SESSION', active: true, smartflo: data };
};

export const endDialerSession = async (user) => {
  requireSessionMode();
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
  requireSessionMode();
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
