import { env } from './env.js';

export const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = env.CORS_ORIGIN.split(',').map((item) => item.trim());
    if (allowed.includes(origin) || allowed.includes('*')) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};
