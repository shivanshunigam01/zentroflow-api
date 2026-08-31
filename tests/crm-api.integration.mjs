/**
 * CRM API integration tests — requires MongoDB.
 * Run: RUN_CRM_INTEGRATION=1 node --test tests/crm-api.integration.mjs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'node:http';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Customer from '../src/models/Customer.js';
import Opportunity from '../src/models/Opportunity.js';
import AssignmentHistory from '../src/models/crm/AssignmentHistory.js';
import StageHistory from '../src/models/StageHistory.js';
import Role from '../src/models/Role.js';
import { hashPassword } from '../src/services/auth.service.js';
import { env } from '../src/config/env.js';

const SKIP = process.env.RUN_CRM_INTEGRATION !== '1';
const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

describe('CRM API integration', { skip: SKIP }, () => {
  let server;
  let port;
  let tokenA;
  let tokenNoPerm;
  let oppA;
  let oppB;

  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI);
    await Promise.all([
      User.deleteMany({ email: /crm-test-/ }),
      Customer.deleteMany({ customer_id: /^CRM-TEST-/ }),
      Opportunity.deleteMany({ opportunity_id: /^CRM-TEST-/ }),
      AssignmentHistory.deleteMany({ opportunity_id: /^CRM-TEST-/ }),
      StageHistory.deleteMany({ opportunity_id: /^CRM-TEST-/ }),
    ]);

    await Role.updateOne(
      { role_id: 'ROLE-SE' },
      {
        $set: {
          permissions: ['lead:view', 'lead:edit', 'lead:stage', 'customer:view', 'crm:dashboard:view'],
        },
      },
      { upsert: true },
    );
    await Role.updateOne(
      { role_id: 'ROLE-NOCRM' },
      { $set: { name: 'No CRM', permissions: ['action:complete'] } },
      { upsert: true },
    );

    const pw = await hashPassword('testpass123');
    const userA = await User.create({
      email: 'crm-test-a@example.com',
      password_hash: pw,
      name: 'CRM Test A',
      role: 'user',
      role_id: 'ROLE-SE',
      tenant_id: TENANT_A,
      organization_id: 'ORG-A',
    });
    const userNoPerm = await User.create({
      email: 'crm-test-noperm@example.com',
      password_hash: pw,
      name: 'No Perm',
      role: 'user',
      role_id: 'ROLE-NOCRM',
      tenant_id: TENANT_A,
      organization_id: 'ORG-A',
    });

    tokenA = jwt.sign(
      { email: userA.email, name: userA.name, role: userA.role, userId: userA._id.toString() },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );
    tokenNoPerm = jwt.sign(
      { email: userNoPerm.email, name: userNoPerm.name, role: userNoPerm.role, userId: userNoPerm._id.toString() },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const custA = await Customer.create({
      customer_id: 'CRM-TEST-CU-A',
      name: 'Tenant A Customer',
      mobile: '9876543210',
      mobile_normalized: '9876543210',
      tenant_id: TENANT_A,
      organization_id: 'ORG-A',
    });
    const custB = await Customer.create({
      customer_id: 'CRM-TEST-CU-B',
      name: 'Tenant B Customer',
      mobile: '9876543211',
      mobile_normalized: '9876543211',
      tenant_id: TENANT_B,
      organization_id: 'ORG-B',
    });

    oppA = await Opportunity.create({
      opportunity_id: 'CRM-TEST-OP-A',
      lead_id: 'CRM-TEST-LD-A',
      customer_id: custA.customer_id,
      tenant_id: TENANT_A,
      organization_id: 'ORG-A',
      product: 'Nexon',
      current_owner: 'Sales Executive',
      current_micro_stage: 'C0.1',
      source: 'Manual',
      branch: 'Branch A',
    });
    oppB = await Opportunity.create({
      opportunity_id: 'CRM-TEST-OP-B',
      lead_id: 'CRM-TEST-LD-B',
      customer_id: custB.customer_id,
      tenant_id: TENANT_B,
      organization_id: 'ORG-B',
      product: 'Punch',
      current_owner: 'Sales Executive',
      current_micro_stage: 'C0.1',
      source: 'Manual',
      branch: 'Branch B',
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });

  after(async () => {
    if (server) server.close();
    await mongoose.disconnect();
  });

  const request = (method, path, token, body) =>
    new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: `${env.API_PREFIX}${path}`,
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => {
            raw += c;
          });
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') });
            } catch {
              resolve({ status: res.statusCode, body: raw });
            }
          });
        },
      );
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });

  it('tenant A can access tenant A lead', async () => {
    const res = await request('GET', `/crm/leads/${oppA.opportunity_id}`, tokenA);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.lead.opportunity_id, oppA.opportunity_id);
  });

  it('tenant A cannot access tenant B lead', async () => {
    const res = await request('GET', `/crm/leads/${oppB.opportunity_id}`, tokenA);
    assert.equal(res.status, 404);
  });

  it('RBAC denies lead:view without permission', async () => {
    const res = await request('GET', '/crm/leads', tokenNoPerm);
    assert.equal(res.status, 403);
  });

  it('CRM leads list is paginated', async () => {
    const res = await request('GET', '/crm/leads?limit=1', tokenA);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 1);
    assert.ok(res.body.meta.total >= 1);
  });

  it('stage change creates history and requires lead:stage', async () => {
    const deny = await request('POST', `/crm/leads/${oppA.opportunity_id}/stage`, tokenNoPerm, {
      new_micro_stage: 'C0.2',
    });
    assert.equal(deny.status, 403);

    const beforeCount = await StageHistory.countDocuments({ opportunity_id: oppA.opportunity_id });
    const res = await request('POST', `/crm/leads/${oppA.opportunity_id}/stage`, tokenA, {
      new_micro_stage: 'C0.2',
      reason: 'CRM test transition',
    });
    assert.equal(res.status, 200);
    const afterCount = await StageHistory.countDocuments({ opportunity_id: oppA.opportunity_id });
    assert.equal(afterCount, beforeCount + 1);
  });

  it('assignment creates AssignmentHistory and requires lead:assign', async () => {
    const deny = await request('POST', `/crm/leads/${oppA.opportunity_id}/assign`, tokenA, {
      new_owner: 'New Owner',
    });
    assert.equal(deny.status, 403);

    await Role.updateOne({ role_id: 'ROLE-SE' }, { $addToSet: { permissions: 'lead:assign' } });

    const res = await request('POST', `/crm/leads/${oppA.opportunity_id}/assign`, tokenA, {
      new_owner: 'Assigned Executive',
      reason: 'Test assign',
    });
    assert.equal(res.status, 200);
    const hist = await AssignmentHistory.findOne({ opportunity_id: oppA.opportunity_id }).sort({ created_at: -1 });
    assert.ok(hist);
    assert.equal(hist.new_owner, 'Assigned Executive');
  });
});
