import DialerAuditLog from '../../models/DialerAuditLog.js';

/** Persist dialer audit events. Never pass tokens into metadata. */
export const writeDialerAudit = async ({
  actor = 'System',
  action,
  entity = null,
  entityId = null,
  metadata = {},
}) => {
  if (!action) return null;
  try {
    return await DialerAuditLog.create({
      actor: String(actor || 'System'),
      action: String(action),
      entity: entity ? String(entity) : null,
      entity_id: entityId ? String(entityId) : null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  } catch (err) {
    console.error(JSON.stringify({
      service: 'dialer',
      operation: 'audit.write',
      status: 'failed',
      message: err.message,
    }));
    return null;
  }
};
