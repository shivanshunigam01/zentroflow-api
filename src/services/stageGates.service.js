import { ApiError } from '../middleware/errorHandler.middleware.js';
import { getMacroFromMicroStage, EXIT_MICRO_STAGES } from '../constants/stages.js';

const microNumber = (stage) => Number(String(stage).split('.')[1] || 0);

export const validateSequentialTransition = (opportunity, newMicroStage) => {
  const current = opportunity.current_micro_stage;
  if (current === newMicroStage) return true;
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

  if (!String(newMicroStage).endsWith('.1')) {
    throw new ApiError(400, 'STAGE_GATE_BLOCKED', 'Cross macro movement must enter the next macro at .1', 'new_micro_stage');
  }
  return true;
};
