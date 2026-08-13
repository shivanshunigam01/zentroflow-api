import { Router } from 'express';
import {
  createBranch,
  createOrg,
  createProduct,
  listBranches,
  listOrgs,
  listProducts,
  listRoles,
} from '../controllers/masters.controller.js';

const router = Router();
router.get('/organisations', listOrgs);
router.post('/organisations', createOrg);
router.get('/branches', listBranches);
router.post('/branches', createBranch);
router.get('/products', listProducts);
router.post('/products', createProduct);
router.get('/roles', listRoles);
export default router;
