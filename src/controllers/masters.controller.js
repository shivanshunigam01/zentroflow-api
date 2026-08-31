import { randomUUID } from 'crypto';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import Organisation from '../models/Organisation.js';
import Branch from '../models/Branch.js';
import Product from '../models/Product.js';
import Role from '../models/Role.js';

const ensureDefaultRoles = async () => {
  const count = await Role.countDocuments();
  if (count > 0) return;
  await Role.insertMany([
    {
      role_id: 'ROLE-SE',
      name: 'Sales Executive',
      permissions: ['lead:view', 'lead:edit', 'lead:stage', 'customer:view', 'crm:dashboard:view', 'action:complete'],
    },
    {
      role_id: 'ROLE-SM',
      name: 'Sales Manager',
      permissions: [
        'lead:view',
        'lead:edit',
        'lead:stage',
        'lead:assign',
        'customer:view',
        'crm:dashboard:view',
        'action:reassign',
        'rule:activate',
      ],
    },
    { role_id: 'ROLE-ADMIN', name: 'Super Admin', permissions: ['*'] },
  ]);
};

export const listOrgs = asyncHandler(async (_req, res) => ok(res, await Organisation.find().lean()));
export const createOrg = asyncHandler(async (req, res) => {
  const doc = await Organisation.create({
    organisation_id: randomUUID(),
    name: req.body?.name || 'New Organisation',
    oem_brand: req.body?.oem_brand || '',
  });
  ok(res, doc);
});

export const listBranches = asyncHandler(async (_req, res) => ok(res, await Branch.find().lean()));
export const createBranch = asyncHandler(async (req, res) => {
  const doc = await Branch.create({
    branch_id: randomUUID(),
    organisation_id: req.body?.organisation_id || 'ORG-DEFAULT',
    name: req.body?.name || 'New Branch',
    territory: req.body?.territory || '',
  });
  ok(res, doc);
});

export const listProducts = asyncHandler(async (_req, res) => ok(res, await Product.find().lean()));
export const createProduct = asyncHandler(async (req, res) => {
  const doc = await Product.create({
    product_id: randomUUID(),
    oem: req.body?.oem || '',
    model: req.body?.model || 'Model',
    variant: req.body?.variant || '',
    colour: req.body?.colour || '',
  });
  ok(res, doc);
});

export const listRoles = asyncHandler(async (_req, res) => {
  await ensureDefaultRoles();
  ok(res, await Role.find().lean());
});
