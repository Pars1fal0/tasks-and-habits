(function () {
  function postponeTask({ state, task, sourceDateKey, targetDateKey, options = {}, helpers = {} }) {
    const shouldClearTime = shouldClearTimeForToday(task, targetDateKey, options, helpers);

    if (task.repeat === "none") {
      moveSingleTask(state, task, sourceDateKey, targetDateKey, { clearTime: shouldClearTime });
    } else {
      moveRecurringOccurrence(state, task, sourceDateKey, targetDateKey, { clearTime: shouldClearTime }, helpers);
    }

    return { targetDate: targetDateKey };
  }

  function moveSingleTask(state, task, sourceDateKey, targetDateKey, options = {}) {
    const wasDone = task.completed?.[sourceDateKey] === true;
    task.completed = task.completed || {};
    task.notified = task.notified || {};
    task.date = targetDateKey;
    if (options.clearTime) task.time = "";
    delete task.completed?.[sourceDateKey];
    delete task.notified?.[sourceDateKey];
    removeTaskFromOrder(state, task.id, sourceDateKey);
    if (wasDone) task.completed[targetDateKey] = true;
  }

  function moveRecurringOccurrence(state, task, sourceDateKey, targetDateKey, options = {}, helpers = {}) {
    task.excludedDates = task.excludedDates || {};
    task.excludedDates[sourceDateKey] = true;
    if (targetDateKey !== sourceDateKey && helpers.taskScheduledOn?.(task, targetDateKey)) {
      task.excludedDates[targetDateKey] = true;
    }
    delete task.completed?.[sourceDateKey];
    delete task.notified?.[sourceDateKey];
    removeTaskFromOrder(state, task.id, sourceDateKey);

    state.tasks.push({
      id: helpers.createId?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      title: task.title,
      date: targetDateKey,
      time: options.clearTime ? "" : task.time,
      categoryId: task.categoryId,
      priority: task.priority,
      repeat: "none",
      reminderOffset: task.reminderOffset,
      completed: {},
      excludedDates: {},
      notified: {},
      createdAt: new Date().toISOString(),
    });
  }

  function shouldClearTimeForToday(task, targetDateKey, options = {}, helpers = {}) {
    if (!options.clearPastTimeToday) return false;
    if (targetDateKey !== helpers.toDateKey?.(new Date())) return false;
    return Boolean(helpers.cleanTimeValue?.(task.time));
  }

  function removeTaskFromOrder(state, taskId, dateKey) {
    if (!Array.isArray(state.taskOrder?.[dateKey])) return;
    state.taskOrder[dateKey] = state.taskOrder[dateKey].filter((id) => id !== taskId);
  }

  window.RhythmTaskMoves = {
    moveRecurringOccurrence,
    moveSingleTask,
    postponeTask,
    removeTaskFromOrder,
    shouldClearTimeForToday,
  };
})();
