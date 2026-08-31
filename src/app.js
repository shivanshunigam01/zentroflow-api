import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/index.js';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { sendHealth, sendRoot } from './helpers/healthHandlers.js';
import { requestId } from './middleware/requestId.middleware.js';
import { captureRawBody } from './middleware/rawBody.middleware.js';
import { errorHandler, notFound } from './middleware/errorHandler.middleware.js';

const app = express();

// Behind nginx — required for express-rate-limit + X-Forwarded-For
app.set('trust proxy', 1);

// CORS once, before everything else (no manual Access-Control-* headers elsewhere)
app.use(cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl?.includes('/integrations/meta/webhook')) captureRawBody(req, res, buf);
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestId);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/', sendRoot);
app.get('/health', sendHealth);
app.use(env.API_PREFIX, apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
