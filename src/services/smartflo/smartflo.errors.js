import { ApiError } from '../../middleware/errorHandler.middleware.js';

const STATUS_CODE = {
  400: 'SMARTFLO_BAD_REQUEST',
  401: 'SMARTFLO_UNAUTHORIZED',
  403: 'SMARTFLO_FORBIDDEN',
  404: 'SMARTFLO_NOT_FOUND',
  409: 'SMARTFLO_CONFLICT',
  422: 'SMARTFLO_UNPROCESSABLE',
  429: 'SMARTFLO_RATE_LIMITED',
};

/**
 * Map an axios/Smartflo failure to ApiError. Never includes Authorization or tokens.
 * @param {unknown} err
 * @param {string} operation
 */
export const mapSmartfloError = (err, operation = 'request') => {
  if (err instanceof ApiError) return err;

  const status = err?.response?.status;
  const data = err?.response?.data;
  const upstream = data?.message || data?.error || (typeof data === 'string' ? data : null);
  const safeUpstream = typeof upstream === 'string' ? upstream.slice(0, 280) : null;

  if (!status) {
    if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
      return new ApiError(504, 'SMARTFLO_TIMEOUT', `Smartflo ${operation} timed out`);
    }
    return new ApiError(503, 'SMARTFLO_UNAVAILABLE', `Smartflo ${operation} is unavailable`);
  }

  const code = STATUS_CODE[status] || (status >= 500 ? 'SMARTFLO_API_ERROR' : 'SMARTFLO_API_ERROR');
  const http = status >= 500 ? 502 : status === 401 || status === 403 ? 502 : status;
  const message = safeUpstream || `Unable to complete Smartflo ${operation}`;
  return new ApiError(http, code, message);
};

/** Strip secrets from any object that might be logged. */
export const sanitizeForLog = (value) => {
  if (!value || typeof value !== 'object') return value;
  const blocked = new Set(['authorization', 'token', 'api_key', 'apikey', 'password', 'secret']);
  const out = Array.isArray(value) ? [] : {};
  for (const [key, val] of Object.entries(value)) {
    if (blocked.has(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else if (val && typeof val === 'object') {
      out[key] = sanitizeForLog(val);
    } else {
      out[key] = val;
    }
  }
  return out;
};
