/** Single CORS policy — do not add Access-Control-* headers in nginx (causes duplicates). */
export const corsOptions = {
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};
