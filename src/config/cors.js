/**
 * Single CORS policy — do NOT also add Access-Control-* headers in nginx
 * (duplicate Access-Control-Allow-Origin causes browsers to fail with
 * "Failed to fetch" while curl still works).
 *
 * Auth uses Bearer tokens (Authorization header), not cookies → credentials: false.
 * Allow any Origin (open CORS) as requested for ZentroFLOW API clients.
 */

/** Kept for tests / tooling that still import this helper. */
export const parseCorsOrigins = (raw) => {
  const value = (raw ?? '').trim();
  if (!value || value === '*') return ['*'];
  return [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))];
};

export const corsOptions = {
  origin: true, // reflect any request Origin (allow all sources)
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};
