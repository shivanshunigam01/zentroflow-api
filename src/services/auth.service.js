import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { env } from '../config/env.js';

const SALT_ROUNDS = 10;

export const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

export const findUserByEmail = (email) =>
  User.findOne({ email: email.toLowerCase().trim() }).select('+password_hash');

export const createUser = async ({ email, password, name, role = 'user' }) => {
  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized });
  if (existing) return { error: 'EMAIL_EXISTS' };
  const password_hash = await hashPassword(password);
  const user = await User.create({
    email: normalized,
    password_hash,
    name: name?.trim() || normalized.split('@')[0],
    role,
  });
  return { user };
};

export const authenticateUser = async (email, password) => {
  const doc = await findUserByEmail(email);
  if (!doc) return null;
  const ok = await comparePassword(password, doc.password_hash);
  if (!ok) return null;
  return doc;
};

export const authenticateAdminEnv = (email, password) => {
  if (email === env.ADMIN_EMAIL && password === env.ADMIN_PASSWORD) {
    return { email, name: 'Admin', role: 'admin' };
  }
  return null;
};

export const toAuthUser = (doc) => ({
  id: doc._id?.toString(),
  email: doc.email,
  name: doc.name,
  role: doc.role,
});

/** Create default buddy account if no users exist */
export const ensureDefaultUser = async () => {
  const count = await User.countDocuments();
  if (count > 0) return;
  const email = env.DEFAULT_USER_EMAIL || 'buddy@zentroverse.com';
  const password = env.DEFAULT_USER_PASSWORD || 'Zentroflow@2026';
  const result = await createUser({ email, password, name: 'Buddy', role: 'admin' });
  if (result.user) {
    console.log(`Default user created: ${email} (use this to sign in)`);
  }
};
