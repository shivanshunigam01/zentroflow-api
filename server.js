import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { env } from './src/config/env.js';
import { ensureDefaultUser } from './src/services/auth.service.js';

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
  app.listen(env.PORT, host, () => {
    console.log(`ZentroFlow API running on http://${host}:${env.PORT}`);
    console.log(`Health: http://${host}:${env.PORT}/health`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
