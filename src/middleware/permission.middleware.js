import { ApiError } from './errorHandler.middleware.js';
import { hasPermission } from '../services/permission.service.js';

/**
 * Require a specific permission. Must run after resolveTenantContext.
 */
export const requirePermission = (permission) => (req, res, next) => {
  const permissions = req.tenantContext?.permissions ?? [];
  if (hasPermission(permissions, permission)) return next();
  return next(new ApiError(403, 'FORBIDDEN', `Permission required: ${permission}`));
};
