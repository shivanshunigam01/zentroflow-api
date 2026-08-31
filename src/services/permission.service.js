import Role from '../models/Role.js';
import { env } from '../config/env.js';

const ROLE_MAP = {
  admin: 'ROLE-ADMIN',
  user: 'ROLE-SE',
};

let roleCache = null;
let roleCacheAt = 0;
const CACHE_TTL_MS = 60_000;

const loadRoles = async () => {
  const now = Date.now();
  if (roleCache && now - roleCacheAt < CACHE_TTL_MS) return roleCache;
  const rows = await Role.find().lean();
  roleCache = new Map(rows.map((r) => [r.role_id, r]));
  roleCacheAt = now;
  return roleCache;
};

export const resolveRoleId = (user) => {
  if (user?.role_id) return user.role_id;
  if (user?.role === 'admin') return 'ROLE-ADMIN';
  return ROLE_MAP[user?.role] || 'ROLE-SE';
};

export const getPermissionsForUser = async (user) => {
  if (!user) return [];
  if (user.role === 'admin' || user.id === 'env-admin') return ['*'];
  const roleId = resolveRoleId(user);
  const roles = await loadRoles();
  const role = roles.get(roleId);
  return role?.permissions ?? [];
};

export const hasPermission = (permissions, required) => {
  if (!required) return true;
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
};

export const DEFAULT_TENANT_ID = () => env.DEFAULT_TENANT_ID || 'zentroverse';
