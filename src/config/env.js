import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const buildMongoUri = () => {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const user = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  const host = process.env.MONGODB_HOST;
  const db = process.env.MONGODB_DB || 'zentroverse';
  if (user && password && host) {
    const encoded = encodeURIComponent(password);
    return `mongodb+srv://${user}:${encoded}@${host}/${db}?authSource=admin&retryWrites=true&w=majority`;
  }
  return 'mongodb://127.0.0.1:27017/zentroflow';
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || process.env.RAZORPAY_API_PORT || 5000),
  MONGODB_URI: buildMongoUri(),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  DUPLICATE_WINDOW_DAYS: Number(process.env.DUPLICATE_WINDOW_DAYS || 30),

  MONGODB_USER: process.env.MONGODB_USER,
  MONGODB_PASSWORD: process.env.MONGODB_PASSWORD,
  MONGODB_HOST: process.env.MONGODB_HOST,
  MONGODB_DB: process.env.MONGODB_DB || 'zentroverse',

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,

  SUREPASS_BASE_URL: process.env.SUREPASS_BASE_URL,
  SUREPASS_TOKEN: process.env.SUREPASS_TOKEN,

  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'change-me-in-production',
  DEFAULT_USER_EMAIL: process.env.DEFAULT_USER_EMAIL || 'buddy@zentroverse.com',
  DEFAULT_USER_PASSWORD: process.env.DEFAULT_USER_PASSWORD || 'Zentroflow@2026',

  AISENSY_PARTNER_ID: process.env.AISENSY_PARTNER_ID,
  AISENSY_PARTNER_API_KEY: process.env.AISENSY_PARTNER_API_KEY,
  AISENSY_SHARED_SECRET: process.env.AISENSY_SHARED_SECRET,
  AISENSY_PARTNER_PLAN_FAMILY_ID: process.env.AISENSY_PARTNER_PLAN_FAMILY_ID,
  AISENSY_PLAN_FAMILY_ID: process.env.AISENSY_PLAN_FAMILY_ID,

  /** WhatsApp bulk campaign (api-wa.co / AiSensy) — server-side only */
  WHATSAPP_CAMPAIGN_API_URL: process.env.WHATSAPP_CAMPAIGN_API_URL
    || 'https://backend.api-wa.co/campaign/zentroverse-global/api/v2',
  WHATSAPP_CAMPAIGN_API_KEY: process.env.WHATSAPP_CAMPAIGN_API_KEY,
  WHATSAPP_CAMPAIGN_NAME: process.env.WHATSAPP_CAMPAIGN_NAME || 'flowtest',
  WHATSAPP_CAMPAIGN_USER_NAME: process.env.WHATSAPP_CAMPAIGN_USER_NAME || 'Zentroverse',
  WHATSAPP_CAMPAIGN_SOURCE: process.env.WHATSAPP_CAMPAIGN_SOURCE || 'zentroflow-lead-inbox',
  WHATSAPP_CAMPAIGN_DELAY_MS: process.env.WHATSAPP_CAMPAIGN_DELAY_MS || '350',

  /** AiSensy connect.api-wa.co — project id (defaults from JWT id in WHATSAPP_CAMPAIGN_API_KEY) */
  WHATSAPP_PROJECT_ID: process.env.WHATSAPP_PROJECT_ID,
  /** Optional override; otherwise resolved via campaign-details API */
  WHATSAPP_CAMPAIGN_ID: process.env.WHATSAPP_CAMPAIGN_ID,

  /** Max customers/opportunities returned on GET /bootstrap (inbox sync) */
  BOOTSTRAP_MAX_LEADS: Number(process.env.BOOTSTRAP_MAX_LEADS || 10000),

  /** Tata Smartflo IVR — bulk lead list upload (server-side only) */
  SMARTFLO_API_TOKEN: process.env.SMARTFLO_API_TOKEN,
  SMARTFLO_LEAD_LIST_ID: process.env.SMARTFLO_LEAD_LIST_ID,
  SMARTFLO_BASE_URL: process.env.SMARTFLO_BASE_URL || 'https://api-smartflo.tatateleservices.com',

  /** Click-to-Call — API Connect key + confirmed UI field values */
  SMARTFLO_CLICK_TO_CALL_API_KEY: process.env.SMARTFLO_CLICK_TO_CALL_API_KEY,
  SMARTFLO_IVR_ID: process.env.SMARTFLO_IVR_ID || '83389',
  SMARTFLO_CLICK_TO_CALL_ENDPOINT: process.env.SMARTFLO_CLICK_TO_CALL_ENDPOINT || '/v1/click_to_call_support',
  SMARTFLO_CTC_CALLER_ID: process.env.SMARTFLO_CTC_CALLER_ID,
  SMARTFLO_CTC_AGENT_ID: process.env.SMARTFLO_CTC_AGENT_ID,
  SMARTFLO_USER_ID: process.env.SMARTFLO_USER_ID,
  /** Legacy optional DID */
  SMARTFLO_CALLER_ID: process.env.SMARTFLO_CALLER_ID,

  /** Direct agent Click-to-Call — POST /v1/click_to_call (Bearer token) */
  SMARTFLO_DIRECT_CALL_ENDPOINT: process.env.SMARTFLO_DIRECT_CALL_ENDPOINT || '/v1/click_to_call',
  /** Smartflo agent extension / ID who receives the call first */
  SMARTFLO_AGENT_NUMBER: process.env.SMARTFLO_AGENT_NUMBER,
};

export const validateEnv = () => {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required');
};

/** For startup logs — never log credentials */
export const mongoTargetLabel = () => {
  const uri = env.MONGODB_URI;
  if (uri.includes('127.0.0.1') || uri.includes('localhost')) return 'local MongoDB';
  const match = uri.match(/@([^/]+)/);
  return match ? `Atlas (${match[1]})` : 'remote MongoDB';
};
