import axios from 'axios';
import { env, getSmartfloApiBase } from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { mapSmartfloError, sanitizeForLog } from './smartflo.errors.js';

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const joinUrl = (base, path) => {
  const root = String(base || '').replace(/\/+$/, '');
  const suffix = String(path || '');
  if (!suffix) return root;
  return `${root}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
};

export const requireSmartfloToken = () => {
  if (!env.SMARTFLO_API_TOKEN?.trim()) {
    throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Smartflo is not configured');
  }
};

const logSafe = (payload) => {
  console.log(JSON.stringify({ service: 'smartflo', ...payload }));
};

/**
 * Authenticated Smartflo HTTP call. Never logs Authorization headers or the token.
 * @param {{ method: string, path: string, body?: unknown, params?: unknown, timeoutMs?: number, operation?: string }} opts
 */
export const smartfloRequest = async ({
  method,
  path,
  body,
  params,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  operation,
}) => {
  requireSmartfloToken();
  const op = operation || `${method} ${path}`;
  const url = joinUrl(getSmartfloApiBase(), path);
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      logSafe({ operation: op, attempt, status: 'request' });
      const response = await axios({
        method,
        url,
        data: body,
        params,
        timeout: timeoutMs,
        headers: {
          Authorization: `Bearer ${env.SMARTFLO_API_TOKEN}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        validateStatus: (s) => s >= 200 && s < 300,
      });
      logSafe({ operation: op, attempt, status: 'success', http: response.status });
      return response.data;
    } catch (err) {
      const http = err?.response?.status;
      lastError = mapSmartfloError(err, op);
      logSafe({
        operation: op,
        attempt,
        status: 'error',
        http: http || null,
        code: lastError.code,
        body: sanitizeForLog(err?.response?.data),
      });
      if (http && RETRYABLE.has(http) && attempt < MAX_ATTEMPTS) {
        await sleep(300 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
};

export const smartfloGet = (path, params, operation) =>
  smartfloRequest({ method: 'GET', path, params, operation });

export const smartfloPost = (path, body, operation) =>
  smartfloRequest({ method: 'POST', path, body, operation });

export const smartfloPut = (path, body, operation) =>
  smartfloRequest({ method: 'PUT', path, body, operation });

export const smartfloPatch = (path, body, operation) =>
  smartfloRequest({ method: 'PATCH', path, body, operation });

export const smartfloDelete = (path, operation) =>
  smartfloRequest({ method: 'DELETE', path, operation });
