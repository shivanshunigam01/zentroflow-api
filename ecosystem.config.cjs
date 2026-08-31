/** PM2: pm2 start ecosystem.config.cjs --update-env */
module.exports = {
  apps: [
    {
      name: 'zentroflow-api',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'zentroflow-queue-worker',
      script: 'src/workers/queueWorker.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        WORKER_ENABLED: 'true',
      },
    },
  ],
};
