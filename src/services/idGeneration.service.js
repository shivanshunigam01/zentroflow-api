/** Align with zentroverse-buddy/src/services/id-generation.service.ts */

export const customerNamePrefix = (customerName = '') => {
  const cleaned = String(customerName).trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const firstWord = cleaned.split(/\s+/).find((w) => w.length > 0) ?? 'CUST';
  const prefix = firstWord.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  return prefix || 'CUST';
};

const uniqueSuffix = () => {
  const year = new Date().getFullYear();
  const tail = `${Date.now()}${Math.random().toString(36).slice(2, 5)}`.slice(-6);
  return `${year}-${tail}`;
};

export const generateIds = (customerName) => {
  const prefix = customerNamePrefix(customerName);
  const seq = uniqueSuffix();
  return {
    lead_id: `${prefix}-LD-${seq}`,
    customer_id: `${prefix}-CU-${seq}`,
    opportunity_id: `${prefix}-OP-${seq}`,
  };
};
