export const createCorrelationId = () => `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
