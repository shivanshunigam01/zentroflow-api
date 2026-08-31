#!/usr/bin/env node
/**
 * CRM production schema migration — idempotent index ensure.
 * DO NOT run automatically in production. Use --dry-run first.
 *
 * Usage:
 *   node scripts/migrate-crm-production.mjs --dry-run
 *   node scripts/migrate-crm-production.mjs
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const dryRun = process.argv.includes('--dry-run');

const models = [
  '../src/models/integrations/PlatformConnection.js',
  '../src/models/integrations/OAuthState.js',
  '../src/models/integrations/MetaFormMapping.js',
  '../src/models/integrations/LeadIngestionEvent.js',
  '../src/models/integrations/ConversionEvent.js',
  '../src/models/integrations/ConversionEventMapping.js',
  '../src/models/integrations/RoutingRule.js',
  '../src/models/integrations/NotificationOutbox.js',
  '../src/models/crm/TestDrive.js',
  '../src/models/crm/Quotation.js',
  '../src/models/crm/Booking.js',
  '../src/models/crm/Retail.js',
  '../src/models/crm/LeadAttribution.js',
];

const run = async () => {
  console.log(dryRun ? '[dry-run] CRM production migration' : 'CRM production migration');
  if (dryRun) {
    console.log('Would connect to:', env.MONGODB_URI.replace(/\/\/.*@/, '//***@'));
    console.log('Would ensure indexes for:', models.length, 'models');
    process.exit(0);
  }
  await mongoose.connect(env.MONGODB_URI);
  for (const path of models) {
    const mod = await import(path);
    const Model = mod.default;
    await Model.createIndexes();
    console.log('Indexes ensured:', Model.modelName);
  }
  await mongoose.disconnect();
  console.log('Done.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
