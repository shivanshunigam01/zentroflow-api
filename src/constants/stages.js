export const MACRO_ORDER = ['C0', 'C1', 'C1A', 'C2', 'C3', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
export const EXIT_MICRO_STAGES = ['C0.10', 'C1.10', 'C1A.10', 'C2.10', 'C3.10'];
export const FUNNEL_STAGES = ['C0', 'C1', 'C1A', 'C2', 'C3'];
export const LIFECYCLE_STAGES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

export const getMacroFromMicroStage = (microStage = '') => microStage.split('.').at(0);
export const isLifecycleStage = (stage) => LIFECYCLE_STAGES.includes(stage);
