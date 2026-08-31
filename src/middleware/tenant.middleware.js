import User from '../models/User.js';
import { ApiError } from './errorHandler.middleware.js';
import { getPermissionsForUser, DEFAULT_TENANT_ID } from '../services/permission.service.js';
import { recordInTenant } from '../helpers/tenantScope.js';
import { env } from '../config/env.js';

const defaultOrg = () => env.DEFAULT_ORGANIZATION_ID || 'ORG-DEFAULT';

/**
 * Resolve tenant context from authenticated user (never from client-supplied tenant_id).
 */
export const resolveTenantContext = async (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));

  try {
    let tenant_id = DEFAULT_TENANT_ID();
    let organization_id = defaultOrg();
    let dealer_id = null;
    let branch_id = null;
    let role_id = null;
    let name = req.user.name;
    let email = req.user.email;

    if (req.user.userId && req.user.userId !== 'env-admin') {
      const doc = await User.findById(req.user.userId).lean();
      if (!doc) return next(new ApiError(401, 'UNAUTHORIZED', 'User account not found'));
      tenant_id = doc.tenant_id || DEFAULT_TENANT_ID();
      organization_id = doc.organization_id || defaultOrg();
      dealer_id = doc.dealer_id ?? null;
      branch_id = doc.branch_id ?? null;
      role_id = doc.role_id ?? null;
      name = doc.name;
      email = doc.email;
    } else if (req.user.userId === 'env-admin' || req.user.role === 'admin') {
      role_id = 'ROLE-ADMIN';
    }

    const permissions = await getPermissionsForUser({
      id: req.user.userId,
      role: req.user.role,
      role_id,
    });

    req.tenantContext = {
      tenant_id,
      organization_id,
      dealer_id,
      branch_id,
      user_id: req.user.userId,
      user_email: email,
      user_name: name,
      role: req.user.role,
      role_id,
      permissions,
    };

    return next();
  } catch (err) {
    return next(err);
  }
};

/** Ensure record belongs to user's tenant — returns false if cross-tenant (caller returns 404). */
export const assertTenantAccess = (record, tenantContext) => recordInTenant(record, tenantContext);
