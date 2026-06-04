import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import { env } from '../config/env.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password are required');
  if (email !== env.ADMIN_EMAIL || password !== env.ADMIN_PASSWORD) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const user = { email, name: 'Admin', role: 'admin' };
  const token = jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' });
  ok(res, { token, user });
});

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');
  ok(res, req.user);
});
