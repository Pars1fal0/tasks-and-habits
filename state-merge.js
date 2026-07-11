(function (global) {
  function mergeStates(localState = {}, remoteState = {}) {
    return {
      ...localState,
      ...remoteState,
      categories: mergeEntities(localState.categories, remoteState.categories),
      tasks: mergeEntities(localState.tasks, remoteState.tasks, mergeTask),
      habits: mergeEntities(localState.habits, remoteState.habits, mergeHabit),
      goals: mergeEntities(localState.goals, remoteState.goals, mergeGoal),
      taskOrder: mergeTaskOrder(localState.taskOrder, remoteState.taskOrder),
    };
  }

  function mergeEntities(local = [], remote = [], mergeEntity = (_local, next) => next) {
    const byId = new Map();
    (Array.isArray(local) ? local : []).forEach((item) => byId.set(item.id, clone(item)));
    (Array.isArray(remote) ? remote : []).forEach((item) => {
      const existing = byId.get(item.id);
      byId.set(item.id, existing ? mergeEntity(existing, clone(item)) : clone(item));
    });
    return [...byId.values()];
  }

  function mergeTask(local, remote) {
    return {
      ...local,
      ...remote,
      completed: { ...(local.completed || {}), ...(remote.completed || {}) },
      acknowledgedOverdue: { ...(local.acknowledgedOverdue || {}), ...(remote.acknowledgedOverdue || {}) },
      excludedDates: { ...(local.excludedDates || {}), ...(remote.excludedDates || {}) },
      notified: { ...(local.notified || {}), ...(remote.notified || {}) },
    };
  }

  function mergeHabit(local, remote) {
    return { ...local, ...remote, logs: { ...(local.logs || {}), ...(remote.logs || {}) } };
  }

  function mergeGoal(local, remote) {
    return { ...local, ...remote, taskIds: [...new Set([...(local.taskIds || []), ...(remote.taskIds || [])])] };
  }

  function mergeTaskOrder(local = {}, remote = {}) {
    const result = {};
    new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]).forEach((dateKey) => {
      result[dateKey] = [...new Set([...(local?.[dateKey] || []), ...(remote?.[dateKey] || [])])];
    });
    return result;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  global.RhythmStateMerge = { mergeStates };
  if (typeof module !== "undefined" && module.exports) module.exports = { mergeStates };
})(typeof window !== "undefined" ? window : globalThis);
