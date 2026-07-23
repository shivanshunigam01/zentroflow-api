import { env } from './env.js';

/**
 * Single CORS policy — do NOT also add Access-Control-* headers in nginx
 * (duplicate Access-Control-Allow-Origin causes browsers to fail with
 * "Failed to fetch" while curl still works).
 *
 * Auth uses Bearer tokens (Authorization header), not cookies → credentials: false.
 * Frontend: https://zentroverse-automation.vercel.app
 * API:     https://flow.zentroverse.com
 */

const DEFAULT_ORIGINS = [
  'https://zentroverse-automation.vercel.app',
  'https://flow.zentroverse.com',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

/** Parse CORS_ORIGIN — comma-separated list (never use bare "*" with credentials). */
export const parseCorsOrigins = (raw) => {
  const value = (raw ?? '').trim();
  if (!value || value === '*') return [...DEFAULT_ORIGINS];
  return [...new Set([
    ...value.split(',').map((s) => s.trim()).filter(Boolean),
    ...DEFAULT_ORIGINS,
  ])];
};

const allowedOrigins = parseCorsOrigins(env.CORS_ORIGIN);

export const corsOptions = {
  origin(origin, callback) {
    // Non-browser clients (curl, server-to-server) send no Origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};
