import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

const deriveKey = (secret) => {
  const raw = secret || env.META_TOKEN_ENCRYPTION_KEY || env.JWT_SECRET || 'dev-encryption-key';
  return scryptSync(raw, 'zentroflow-salt', 32);
};

/** Encrypt sensitive token for at-rest storage. Returns `iv:tag:ciphertext` hex string. */
export const encryptSecret = (plaintext) => {
  if (!plaintext) return null;
  const key = deriveKey(env.META_TOKEN_ENCRYPTION_KEY);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
};

/** Decrypt token stored via encryptSecret. */
export const decryptSecret = (payload) => {
  if (!payload) return null;
  const [ivHex, tagHex, dataHex] = String(payload).split(':');
  if (!ivHex || !tagHex || !dataHex) return null;
  const key = deriveKey(env.META_TOKEN_ENCRYPTION_KEY);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
};
