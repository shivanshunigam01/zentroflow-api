/**
 * Idempotent tenant backfill for existing MongoDB records.
 *
 * Usage:
 *   node scripts/migrate-tenant-backfill.mjs --dry-run
 *   node scripts/migrate-tenant-backfill.mjs
 *
 * Never overwrites existing tenant_id / organization_id values.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'zentroverse';
const ORG_ID = process.env.DEFAULT_ORGANIZATION_ID || 'ORG-DEFAULT';

const buildMongoUri = () => {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  return 'mongodb://127.0.0.1:27017/zentroflow';
};

const CRM_PERMISSIONS = {
  'ROLE-SE': ['lead:view', 'lead:edit', 'lead:stage', 'customer:view', 'crm:dashboard:view', 'action:complete'],
  'ROLE-SM': [
    'lead:view',
    'lead:edit',
    'lead:stage',
    'lead:assign',
    'customer:view',
    'crm:dashboard:view',
    'action:reassign',
    'rule:activate',
  ],
  'ROLE-ADMIN': ['*'],
};

const backfillCollection = async (db, collectionName, fields) => {
  const col = db.collection(collectionName);
  const before = await col.countDocuments({
    $or: fields.map((f) => ({ [f]: { $in: [null, ''] } })).concat(fields.map((f) => ({ [f]: { $exists: false } }))),
  });

  const setFields = {};
  for (const f of fields) {
    setFields[f] = f === 'tenant_id' ? TENANT_ID : ORG_ID;
  }

  let modified = 0;
  if (!DRY_RUN) {
    for (const field of fields) {
      const res = await col.updateMany(
        {
          $or: [{ [field]: null }, { [field]: '' }, { [field]: { $exists: false } }],
        },
        { $set: { [field]: setFields[field] } },
      );
      modified += res.modifiedCount;
    }
  }

  const after = DRY_RUN
    ? before
    : await col.countDocuments({
        $or: fields.map((f) => ({ [f]: { $in: [null, ''] } })).concat(fields.map((f) => ({ [f]: { $exists: false } }))),
      });

  return { collection: collectionName, before, after, modified: DRY_RUN ? 0 : modified };
};

const syncRoles = async (db) => {
  const col = db.collection('roles');
  const results = [];
  for (const [roleId, perms] of Object.entries(CRM_PERMISSIONS)) {
    const existing = await col.findOne({ role_id: roleId });
    if (!existing) {
      if (!DRY_RUN) {
        await col.insertOne({
          role_id: roleId,
          name: roleId.replace('ROLE-', ''),
          permissions: perms,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
      results.push({ role_id: roleId, action: 'created', permissions: perms });
      continue;
    }
    const merged = [...new Set([...(existing.permissions || []), ...perms])];
    if (JSON.stringify(merged.sort()) !== JSON.stringify((existing.permissions || []).sort())) {
      if (!DRY_RUN) {
        await col.updateOne({ role_id: roleId }, { $set: { permissions: merged, updated_at: new Date() } });
      }
      results.push({ role_id: roleId, action: 'updated', permissions: merged });
    } else {
      results.push({ role_id: roleId, action: 'unchanged' });
    }
  }
  return results;
};

const main = async () => {
  console.log(`\n=== Tenant Backfill Migration ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  console.log(`DEFAULT_TENANT_ID=${TENANT_ID}`);
  console.log(`DEFAULT_ORGANIZATION_ID=${ORG_ID}\n`);

  await mongoose.connect(buildMongoUri());
  const db = mongoose.connection.db;

  const collections = [
    ['users', ['tenant_id', 'organization_id']],
    ['customers', ['tenant_id', 'organization_id']],
    ['opportunities', ['tenant_id', 'organization_id']],
  ];

  for (const [name, fields] of collections) {
    const stats = await backfillCollection(db, name, fields);
    console.log(
      `[${stats.collection}] docs missing tenant/org before: ${stats.before} | after: ${stats.after} | modified: ${stats.modified}`,
    );
  }

  console.log('\n--- Role permission sync ---');
  const roleResults = await syncRoles(db);
  for (const r of roleResults) {
    console.log(`  ${r.role_id}: ${r.action}${r.permissions ? ` → ${r.permissions.join(', ')}` : ''}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run complete — no documents modified.');
  } else {
    console.log('\nMigration complete.');
  }

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
