import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import { env } from '../config/env.js';
import {
  authenticateAdminEnv,
  authenticateUser,
  createUser,
  toAuthUser,
} from '../services/auth.service.js';

const signToken = (user) =>
  jwt.sign(
    { email: user.email, name: user.name, role: user.role, userId: user.id },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password are required');
  }
  if (password.length < 6) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Password must be at least 6 characters', 'password');
  }

  const result = await createUser({ email, password, name });
  if (result.error === 'EMAIL_EXISTS') {
    throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists', 'email');
  }

  const user = toAuthUser(result.user);
  const token = signToken(user);
  ok(res.status(201), { token, user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password are required');
  }

  const doc = await authenticateUser(email, password);
  if (doc) {
    const user = toAuthUser(doc);
    return ok(res, { token: signToken(user), user });
  }

  const admin = authenticateAdminEnv(email, password);
  if (admin) {
    const user = { ...admin, id: 'env-admin' };
    return ok(res, { token: signToken(user), user });
  }

  throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
});

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');
  ok(res, req.user);
});
