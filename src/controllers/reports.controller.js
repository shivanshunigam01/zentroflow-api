import XLSX from 'xlsx';
import Opportunity from '../models/Opportunity.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';

export const pipeline = asyncHandler(async (req, res) => {
  const [funnel, sources, executives] = await Promise.all([
    Opportunity.aggregate([{ $group: { _id: '$current_stage', count: { $sum: 1 } } }]),
    Opportunity.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
    Opportunity.aggregate([{ $group: { _id: '$current_owner', count: { $sum: 1 } } }]),
  ]);
  ok(res, { funnel, sources, executives });
});

export const exportReport = asyncHandler(async (req, res) => {
  const rows = await Opportunity.find().lean();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Opportunities');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="zentroflow-report.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});
