import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import { getPagination, paginationMeta } from '../helpers/pagination.js';
import { normalizeMobile, isValidMobile } from '../helpers/mobile.js';
import { generateIds } from '../services/idGeneration.service.js';

export const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = req.query.search ? { $or: [{ name: new RegExp(req.query.search, 'i') }, { mobile: new RegExp(req.query.search, 'i') }, { customer_id: new RegExp(req.query.search, 'i') }] } : {};
  const [data, total] = await Promise.all([Customer.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit), Customer.countDocuments(filter)]);
  ok(res, data, paginationMeta({ page, limit, total }));
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ customer_id: req.params.customerId });
  if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  const opportunities_count = await Opportunity.countDocuments({ customer_id: customer.customer_id });
  ok(res, { ...customer.toObject(), opportunities_count });
});

export const createCustomer = asyncHandler(async (req, res) => {
  if (!isValidMobile(req.body.mobile)) throw new ApiError(400, 'INVALID_MOBILE', 'Valid Indian mobile number is required', 'mobile');
  const mobile_normalized = normalizeMobile(req.body.mobile);
  const existing = await Customer.findOne({ mobile_normalized });
  if (existing) throw new ApiError(409, 'DUPLICATE_CUSTOMER', 'Customer with this mobile already exists', 'mobile');
  const ids = generateIds(req.body.name);
  const customer = await Customer.create({ customer_id: req.body.customer_id || ids.customer_id, name: req.body.name, mobile: req.body.mobile, mobile_normalized, email: req.body.email, address: req.body.address, customer_type: req.body.customer_type || 'Individual' });
  ok(res.status(201), customer);
});
