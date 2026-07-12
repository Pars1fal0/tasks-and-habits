(function (global) {
  function mergeStates(localState = {}, remoteState = {}) {
    const tombstones = mergeTombstones(localState.tombstones, remoteState.tombstones);
    return {
      ...localState,
      ...remoteState,
      categories: withoutDeleted(mergeEntities(localState.categories, remoteState.categories), tombstones.categories),
      tasks: withoutDeleted(mergeEntities(localState.tasks, remoteState.tasks, mergeTask), tombstones.tasks),
      habits: withoutDeleted(mergeEntities(localState.habits, remoteState.habits, mergeHabit), tombstones.habits),
      goals: withoutDeleted(mergeEntities(localState.goals, remoteState.goals, mergeGoal), tombstones.goals),
      taskOrder: mergeTaskOrder(localState.taskOrder, remoteState.taskOrder),
      tombstones,
    };
  }

  function mergeEntities(local = [], remote = [], mergeEntity = chooseNewest) {
    const byId = new Map();
    (Array.isArray(local) ? local : []).forEach((item) => byId.set(item.id, clone(item)));
    (Array.isArray(remote) ? remote : []).forEach((item) => {
      const existing = byId.get(item.id);
      byId.set(item.id, existing ? mergeEntity(existing, clone(item)) : clone(item));
    });
    return [...byId.values()];
  }

  function mergeTask(local, remote) {
    const newest = chooseNewest(local, remote);
    return {
      ...newest,
      completed: { ...(local.completed || {}), ...(remote.completed || {}) },
      acknowledgedOverdue: { ...(local.acknowledgedOverdue || {}), ...(remote.acknowledgedOverdue || {}) },
      excludedDates: { ...(local.excludedDates || {}), ...(remote.excludedDates || {}) },
      notified: { ...(local.notified || {}), ...(remote.notified || {}) },
    };
  }

  function mergeHabit(local, remote) {
    return { ...chooseNewest(local, remote), logs: { ...(local.logs || {}), ...(remote.logs || {}) } };
  }

  function mergeGoal(local, remote) {
    return chooseNewest(local, remote);
  }

  function chooseNewest(local, remote) {
    return timestampOf(remote) >= timestampOf(local) ? remote : local;
  }

  function timestampOf(entity) {
    const value = Date.parse(entity?.updatedAt || entity?.createdAt || "");
    return Number.isFinite(value) ? value : 0;
  }

  function mergeTombstones(local = {}, remote = {}) {
    const result = { tasks: {}, habits: {}, goals: {}, categories: {} };
    Object.keys(result).forEach((type) => {
      const ids = new Set([...Object.keys(local?.[type] || {}), ...Object.keys(remote?.[type] || {})]);
      ids.forEach((id) => {
        const localValue = local?.[type]?.[id] || "";
        const remoteValue = remote?.[type]?.[id] || "";
        result[type][id] = newestTimestamp(localValue, remoteValue);
      });
    });
    return result;
  }

  function withoutDeleted(entities, tombstones = {}) {
    return entities.filter((entity) => {
      const deletedAt = Date.parse(tombstones[entity.id] || "");
      return !Number.isFinite(deletedAt) || timestampOf(entity) > deletedAt;
    });
  }

  function newestTimestamp(localValue, remoteValue) {
    const localTime = Date.parse(localValue || "");
    const remoteTime = Date.parse(remoteValue || "");
    if (!Number.isFinite(localTime)) return remoteValue;
    if (!Number.isFinite(remoteTime)) return localValue;
    return remoteTime >= localTime ? remoteValue : localValue;
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
