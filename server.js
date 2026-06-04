import http from 'http';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { env } from './src/config/env.js';
import { ensureDefaultUser } from './src/services/auth.service.js';

/** 10 minutes — large Excel import/validate (nginx must match proxy_read_timeout). */
const HTTP_TIMEOUT_MS = 600000;

const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }

  try {
    await ensureDefaultUser();
  } catch (error) {
    console.warn('Default user seed skipped:', error.message);
  }

  const host = '0.0.0.0';
  const server = http.createServer(app);
  server.requestTimeout = HTTP_TIMEOUT_MS;
  server.headersTimeout = HTTP_TIMEOUT_MS + 10000;
  server.keepAliveTimeout = HTTP_TIMEOUT_MS + 10000;
  server.timeout = HTTP_TIMEOUT_MS;

  server.listen(env.PORT, host, () => {
    console.log(`ZentroFlow API running on http://${host}:${env.PORT}`);
    console.log(`Health: http://${host}:${env.PORT}/health`);
    console.log(`HTTP timeout: ${HTTP_TIMEOUT_MS / 1000}s (large imports)`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
