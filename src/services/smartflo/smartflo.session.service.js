import { env, isDialerSessionMode } from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import DialerAgentSession from '../../models/DialerAgentSession.js';
import { smartfloPost } from './smartflo.client.js';

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
  return {
    dialerMode: mode,
    sessionEnabled,
    status: doc?.status || 'OFFLINE',
    campaignId: env.SMARTFLO_CAMPAIGN_ID || null,
    startedAt: doc?.started_at || null,
    message: sessionEnabled
      ? 'Session APIs are enabled for this campaign.'
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
  console.log(JSON.stringify({ service: 'smartflo', operation: 'dialer.session.start', status: 'success' }));
  return { status: 'IN_SESSION', smartflo: data };
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
  console.log(JSON.stringify({ service: 'smartflo', operation: 'dialer.session.end', status: 'success' }));
  return { status: 'OFFLINE', smartflo: data };
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
  return { status: 'OFFLINE', smartflo: data };
};
