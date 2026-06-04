export const normalizeMobile = (mobile = '') => String(mobile).replace(/\D/g, '').slice(-10);
export const isValidMobile = (mobile = '') => /^[6-9]\d{9}$/.test(normalizeMobile(mobile));
