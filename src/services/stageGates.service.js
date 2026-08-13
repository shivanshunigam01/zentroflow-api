import { ApiError } from '../middleware/errorHandler.middleware.js';
import { getMacroFromMicroStage, EXIT_MICRO_STAGES, LIFECYCLE_STAGES } from '../constants/stages.js';
import { assertStageExitAllowsTransition } from './stageExit.service.js';

const microNumber = (stage) => Number(String(stage).split('.')[1] || 0);

export const validateSequentialTransition = (opportunity, newMicroStage, { force = false } = {}) => {
  if (!force) assertStageExitAllowsTransition(opportunity, false);

  const current = opportunity.current_micro_stage;
  if (current === newMicroStage) return true;

  if (LIFECYCLE_STAGES.includes(current) && LIFECYCLE_STAGES.includes(newMicroStage)) {
    const cIdx = LIFECYCLE_STAGES.indexOf(current);
    const nIdx = LIFECYCLE_STAGES.indexOf(newMicroStage);
    if (nIdx !== cIdx + 1) {
      throw new ApiError(
        400,
        'STAGE_TRANSITION_BLOCKED',
        `Complete ${current} before moving to ${newMicroStage}. Next step only — no skipping.`,
        'new_micro_stage',
      );
    }
    return true;
  }

  const currentMacro = getMacroFromMicroStage(current);
  const nextMacro = getMacroFromMicroStage(newMicroStage);

  if (currentMacro === nextMacro) {
    if (microNumber(newMicroStage) !== microNumber(current) + 1) {
      throw new ApiError(400, 'STAGE_TRANSITION_BLOCKED', `Complete ${current} before moving to ${newMicroStage}. Next step only — no skipping.`, 'new_micro_stage');
    }
    return true;
  }

  if (!EXIT_MICRO_STAGES.includes(current)) {
    throw new ApiError(400, 'STAGE_GATE_BLOCKED', `You can move from ${currentMacro} to ${nextMacro} only from exit stage ${currentMacro}.10`, 'new_micro_stage');
  }

  if (!String(newMicroStage).endsWith('.1') && !LIFECYCLE_STAGES.includes(newMicroStage)) {
    throw new ApiError(400, 'STAGE_GATE_BLOCKED', 'Cross macro movement must enter the next macro at .1', 'new_micro_stage');
  }
  return true;
};
