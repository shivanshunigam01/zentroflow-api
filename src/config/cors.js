import { env } from './env.js';

const allowAll = env.CORS_ORIGIN === '*' || env.CORS_ALLOW_ALL === 'true';

/** Allow all origins when CORS_ORIGIN=* or CORS_ALLOW_ALL=true; otherwise use comma-separated list */
export const corsOptions = allowAll
  ? {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }
  : {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const allowed = env.CORS_ORIGIN.split(',').map((item) => item.trim());
        if (allowed.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };
