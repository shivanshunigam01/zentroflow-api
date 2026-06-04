import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { env } from './src/config/env.js';
import { ensureDefaultUser } from './src/services/auth.service.js';

const startServer = async () => {
  try {
    await connectDB();
    await ensureDefaultUser();
    app.listen(env.PORT, () => {
      console.log(`ZentroFlow API running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
