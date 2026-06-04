/**
 * Global CORS — all origins, no credentials (JWT in Authorization header).
 * Frontend: https://zentroverse-automation.vercel.app
 * Backend: https://flow.zentroverse.com
 */
export const corsOptions = {
  origin: true,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
