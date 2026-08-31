import Role from '../models/Role.js';

const CRM_PERMISSIONS = {
  'ROLE-SE': [
    'lead:view', 'lead:edit', 'lead:stage', 'lead:qualify', 'lead:score', 'lead:dedupe',
    'customer:view', 'crm:dashboard:view', 'followup:view', 'followup:edit', 'action:complete',
    'journey:view', 'journey:test_drive', 'journey:quotation', 'journey:booking', 'journey:retail',
    'integration:view',
  ],
  'ROLE-SM': [
    'lead:view', 'lead:edit', 'lead:stage', 'lead:assign', 'lead:qualify', 'lead:score', 'lead:dedupe',
    'customer:view', 'crm:dashboard:view', 'followup:view', 'followup:edit',
    'action:reassign', 'rule:activate', 'score_rule:admin',
    'journey:view', 'journey:test_drive', 'journey:quotation', 'journey:booking', 'journey:retail',
    'integration:view', 'integration:manage', 'routing:view', 'routing:manage',
  ],
  'ROLE-ADMIN': ['*'],
};

/** Merge CRM permissions into existing roles without removing other permissions. */
export const syncCrmRolePermissions = async () => {
  for (const [roleId, perms] of Object.entries(CRM_PERMISSIONS)) {
    const existing = await Role.findOne({ role_id: roleId });
    if (!existing) {
      await Role.create({
        role_id: roleId,
        name: roleId.replace('ROLE-', ''),
        permissions: perms,
      });
      continue;
    }
    const merged = [...new Set([...(existing.permissions || []), ...perms])];
    if (merged.length !== (existing.permissions || []).length) {
      existing.permissions = merged;
      await existing.save();
    }
  }
};
