/** Normalize Excel/API mobile values (number, +91, leading 0) to 10-digit Indian mobile. */
export const normalizeMobile = (mobile = '') => {
  let digits = String(mobile ?? '').replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) digits = digits.slice(-10);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  else if (digits.length > 10) digits = digits.slice(-10);
  return digits;
};

export const isValidMobile = (mobile = '') => /^[6-9]\d{9}$/.test(normalizeMobile(mobile));
