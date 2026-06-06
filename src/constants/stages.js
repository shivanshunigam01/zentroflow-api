export const MACRO_ORDER = ['C0', 'C1', 'C1A', 'C2', 'C3', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
export const EXIT_MICRO_STAGES = ['C0.10', 'C1.10', 'C1A.10', 'C2.10', 'C3.10'];
export const FUNNEL_STAGES = ['C0', 'C1', 'C1A', 'C2', 'C3'];
export const LIFECYCLE_STAGES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

/** Full C0 → C3 → lifecycle order for journey UI */
export const FULL_JOURNEY_MICRO_STAGES = [
  'C0.1', 'C0.2', 'C0.3', 'C0.4', 'C0.5', 'C0.6', 'C0.7', 'C0.8', 'C0.9', 'C0.10',
  'C1.1', 'C1.2', 'C1.3', 'C1.4', 'C1.5', 'C1.6', 'C1.7', 'C1.8', 'C1.9', 'C1.10',
  'C1A.1', 'C1A.2', 'C1A.3', 'C1A.4', 'C1A.5', 'C1A.6', 'C1A.7', 'C1A.8', 'C1A.9', 'C1A.10',
  'C2.1', 'C2.2', 'C2.3', 'C2.4', 'C2.5', 'C2.6', 'C2.7', 'C2.8', 'C2.9', 'C2.10',
  'C3.1', 'C3.2', 'C3.3', 'C3.4', 'C3.5', 'C3.6', 'C3.7', 'C3.8', 'C3.9', 'C3.10',
  'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7',
];

export const getNextJourneyMicroStage = (currentMicro) => {
  const idx = FULL_JOURNEY_MICRO_STAGES.indexOf(currentMicro);
  if (idx < 0 || idx >= FULL_JOURNEY_MICRO_STAGES.length - 1) return null;
  return FULL_JOURNEY_MICRO_STAGES[idx + 1];
};

export const getMacroFromMicroStage = (microStage = '') => microStage.split('.').at(0);
export const isLifecycleStage = (stage) => LIFECYCLE_STAGES.includes(stage);
