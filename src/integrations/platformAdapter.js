/**
 * Platform adapter registry — CRM depends on this abstraction, not Meta/Google directly.
 */

const adapters = new Map();

export const registerAdapter = (platform, adapter) => {
  adapters.set(platform, adapter);
};

export const getAdapter = (platform) => {
  const adapter = adapters.get(platform);
  if (!adapter) throw new Error(`No adapter registered for platform: ${platform}`);
  return adapter;
};

export const listAdapters = () => [...adapters.keys()];

/**
 * @typedef {object} PlatformAdapter
 * @property {string} platform
 * @property {(ctx: object) => Promise<object>} connect
 * @property {(ctx: object) => Promise<object>} disconnect
 * @property {(ctx: object) => Promise<object>} getAccounts
 * @property {(ctx: object) => Promise<object>} getPages
 * @property {(ctx: object) => Promise<object>} getForms
 * @property {(ctx: object, externalLeadId: string) => Promise<object>} fetchLead
 * @property {(ctx: object, event: object) => Promise<object>} sendConversion
 * @property {(ctx: object) => Promise<object>} healthCheck
 */
