export const maskId = (value) => {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.length <= 4) return '********';
  return `********${s.slice(-4)}`;
};

export const firstString = (...candidates) => {
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
};

export const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.leads)) return value.leads;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.records)) return value.records;
  return [];
};
