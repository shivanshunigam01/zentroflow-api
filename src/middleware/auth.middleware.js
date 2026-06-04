import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './errorHandler.middleware.js';

export const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET);
    return next();
  } catch {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid token'));
  }
};

export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new ApiError(401, 'UNAUTHORIZED', 'Authorization token required'));
  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET);
    return next();
  } catch {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid token'));
  }
};
