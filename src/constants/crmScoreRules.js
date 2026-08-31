/** Default CRM scoring rules — admin-configurable via ScoreRule collection */
export const DEFAULT_SCORE_RULES = [
  { rule_id: 'SR-PURCHASE-30', rule_code: 'purchase_timeline_30', name: 'Purchase within 30 days', field: 'purchase_timeline', operator: 'eq', expected_value: '0-30', points: 25 },
  { rule_id: 'SR-VALID-PHONE', rule_code: 'valid_phone', name: 'Valid phone verified', field: 'verification_status', operator: 'eq', expected_value: 'VERIFIED', points: 10 },
  { rule_id: 'SR-MODEL-ID', rule_code: 'model_identified', name: 'Product/model identified', field: 'product', operator: 'exists', expected_value: null, points: 10 },
  { rule_id: 'SR-QUALIFIED', rule_code: 'qualified', name: 'Lead qualified', field: 'qualification_status', operator: 'eq', expected_value: 'QUALIFIED', points: 15 },
  { rule_id: 'SR-HOT-TEMP', rule_code: 'hot_temperature', name: 'Hot temperature band', field: 'temperature', operator: 'eq', expected_value: 'HOT', points: 10 },
];

export const SCORE_BANDS = [
  { label: 'HOT', min: 80, max: 100 },
  { label: 'WARM', min: 60, max: 79 },
  { label: 'NURTURE', min: 40, max: 59 },
  { label: 'COLD', min: 0, max: 39 },
];

export const classifyCrmScore = (score) => {
  if (score >= 80) return 'Hot';
  if (score >= 60) return 'Warm';
  if (score >= 40) return 'Cold';
  return 'Cold';
};

export const mapScoreToTemperature = (score) => {
  if (score >= 80) return 'HOT';
  if (score >= 60) return 'WARM';
  if (score >= 40) return 'NURTURE';
  return 'COLD';
};
