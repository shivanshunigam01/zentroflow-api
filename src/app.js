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
import { errorHandler, notFound } from './middleware/errorHandler.middleware.js';

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestId);
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.get('/', sendRoot);
app.get('/health', sendHealth);
app.use(env.API_PREFIX, apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
