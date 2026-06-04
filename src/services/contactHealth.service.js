import ContactHealth from '../models/ContactHealth.js';
import { isValidMobile } from '../helpers/mobile.js';

export const verifyContactHealth = async ({ opportunity_id, mobile, district }) => {
  const mobile_valid = isValidMobile(mobile);
  const territory_valid = Boolean(district);
  const health_status = mobile_valid && territory_valid ? 'Healthy' : 'Needs Review';
  return ContactHealth.findOneAndUpdate({ opportunity_id }, { mobile, district, mobile_valid, territory_valid, health_status, last_verified_at: new Date() }, { upsert: true, new: true });
};
