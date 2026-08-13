import { ApiError } from '../middleware/errorHandler.middleware.js';
import { getStageMaster } from '../constants/stageMaster.js';

const fieldPresent = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  return Boolean(value);
};

export const validateStageExit = (opportunity, fromStage = opportunity.current_micro_stage) => {
  const master = getStageMaster(fromStage);
  if (!master) return { ok: true, missingFields: [] };

  const fields = opportunity.stage_step_data?.[fromStage]?.fields || {};
  const missing = (master.mandatoryFields || []).filter((key) => !fieldPresent(fields[key]));
  if (!missing.length) return { ok: true, missingFields: [] };

  return {
    ok: false,
    missingFields: missing,
    message: `Cannot leave ${fromStage}: missing mandatory fields (${missing.join(', ')}). ${master.mandatoryValidation}`,
  };
};

export const assertStageExitAllowsTransition = (opportunity, allowOverride = false) => {
  if (allowOverride) return;
  const result = validateStageExit(opportunity);
  if (!result.ok) {
    throw new ApiError(400, 'STAGE_EXIT_BLOCKED', result.message, 'stage_step_data');
  }
};
