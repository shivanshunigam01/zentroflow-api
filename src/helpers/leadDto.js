import Customer from '../models/Customer.js';

/** Opportunity DTO enriched with customer fields for frontend inbox sync */
export const enrichLeadDto = async (opportunity) => {
  const row = opportunity?.toObject?.() ?? opportunity;
  const customer = await Customer.findOne({ customer_id: row.customer_id }).lean();
  return {
    ...row,
    customer_name: customer?.name,
    customer_mobile: customer?.mobile,
    customer_email: customer?.email ?? null,
    customer_address: customer?.address ?? null,
  };
};
