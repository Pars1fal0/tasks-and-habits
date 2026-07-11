(function (global) {
  function createTaskState(ctx) {
    function deleteTask(taskId) {
      const state = ctx.getState();
      const linkedGoals = [];
      state.goals.forEach((goal) => {
        const before = goal.taskIds?.length || 0;
        goal.taskIds = (goal.taskIds || []).filter((id) => id !== taskId);
        if (goal.taskIds.length !== before) linkedGoals.push(goal.id);
      });
      state.tasks = state.tasks.filter((item) => item.id !== taskId);
      Object.keys(state.taskOrder).forEach((dateKey) => {
        state.taskOrder[dateKey] = state.taskOrder[dateKey].filter((id) => id !== taskId);
      });
      return { linkedGoalCount: linkedGoals.length };
    }

    function deleteHabit(habitId) {
      const state = ctx.getState();
      state.habits = state.habits.filter((item) => item.id !== habitId);
    }

    function deleteGoal(goalId) {
      const state = ctx.getState();
      state.goals = state.goals.filter((item) => item.id !== goalId);
    }

    function reorderHabit(sourceId, targetId) {
      const habits = ctx.getState().habits;
      const from = habits.findIndex((habit) => habit.id === sourceId);
      const to = habits.findIndex((habit) => habit.id === targetId);
      if (from < 0 || to < 0 || from === to) return false;
      const [habit] = habits.splice(from, 1);
      habits.splice(to, 0, habit);
      return true;
    }

    return { deleteGoal, deleteHabit, deleteTask, reorderHabit };
  }

  global.RhythmTaskState = { createTaskState };
  if (typeof module !== "undefined" && module.exports) module.exports = { createTaskState };
})(typeof window !== "undefined" ? window : globalThis);
