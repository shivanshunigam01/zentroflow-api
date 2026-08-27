/** Canonical Smartflo disposition / call-state → ZentroFLOW dial status. */

const TABLE = {
  new: 'READY',
  ready: 'READY',
  undisposed: 'DISPOSITION_PENDING',
  interested: 'INTERESTED',
  'not interested': 'NOT_INTERESTED',
  converted: 'CONVERTED',
  successful: 'CONVERTED',
  success: 'CONVERTED',
  'schedule call': 'CALLBACK',
  callback: 'CALLBACK',
  answered: 'CONTACTED',
  contacted: 'CONTACTED',
  busy: 'BUSY',
  'no answer': 'NO_ANSWER',
  missed: 'NO_ANSWER',
  'ring timeout': 'NO_ANSWER',
  'not reachable': 'NOT_REACHABLE',
  'call drop': 'CALL_DROPPED',
  'call dropped': 'CALL_DROPPED',
  failed: 'FAILED',
  'do not call': 'DNC',
  dnc: 'DNC',
  dnd: 'DNC',
  'in call': 'IN_CALL',
  connected: 'IN_CALL',
  ringing: 'RINGING',
  completed: 'COMPLETED',
  hangup: 'COMPLETED',
};

const CALL_EVENT = {
  'call connected to agent': 'IN_CALL',
  'call connected to agent (dialer)': 'IN_CALL',
  'customer answered': 'CONTACTED',
  'customer missed': 'NO_ANSWER',
  'call connected': 'IN_CALL',
  'call completed': 'COMPLETED',
  'call failed': 'FAILED',
  connected: 'IN_CALL',
  answered: 'CONTACTED',
  ringing: 'RINGING',
  'call hangup': 'COMPLETED',
  'call hangup (missed or answered)': 'COMPLETED',
  hangup: 'COMPLETED',
  missed: 'NO_ANSWER',
  completed: 'COMPLETED',
  failed: 'FAILED',
  'disposition status updated': 'DISPOSITION_PENDING',
  'disposition status updated (dialer)': 'DISPOSITION_PENDING',
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

/**
 * @param {string | null | undefined} smartfloValue
 * @returns {{ mapped: string | null, external: string | null, known: boolean }}
 */
export const mapSmartfloStatus = (smartfloValue) => {
  const raw = String(smartfloValue || '').trim();
  if (!raw) return { mapped: null, external: null, known: true };
  const mapped = TABLE[normalizeKey(raw)] || CALL_EVENT[normalizeKey(raw)] || null;
  if (mapped) return { mapped, external: null, known: true };
  return { mapped: null, external: raw, known: false };
};

export const mapCallEventType = (eventName) => {
  const mapped = CALL_EVENT[normalizeKey(eventName)];
  return mapped || null;
};

export { TABLE as SMARTFLO_STATUS_TABLE, CALL_EVENT as SMARTFLO_CALL_EVENT_TABLE };
