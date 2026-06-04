/** Shared root/health responses for GET /, GET /health, GET /api/v1/health */

export const API_VERSION = '1.0.0';

export const sendRoot = (req, res) => {
  res.json({
    success: true,
    message: 'Zentroflow API is running',
    version: API_VERSION,
  });
};

export const sendHealth = (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Zentroflow API healthy',
  });
};
