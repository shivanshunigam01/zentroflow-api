export const getActionPatch = (microStage) => {
  const n = Number(String(microStage).split('.')[1] || 1);
  const priority = n >= 8 ? 'P1' : n >= 5 ? 'P2' : 'P3';
  return {
    current_action: `Complete ${microStage}`,
    next_action: `Next step after ${microStage}`,
    priority,
    next_action_date: new Date(Date.now() + (priority === 'P1' ? 4 : 24) * 60 * 60 * 1000),
  };
};
