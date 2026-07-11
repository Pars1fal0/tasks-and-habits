(function (global) {
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
    if (options.clearTime) {
      task.time = "";
      task.scheduleMode = "deadline";
      task.startTime = "";
      task.endTime = "";
    }
    delete task.completed?.[sourceDateKey];
    delete task.acknowledgedOverdue?.[sourceDateKey];
    delete task.notified?.[sourceDateKey];
    removeTaskFromOrder(state, task.id, sourceDateKey);
    if (wasDone) task.completed[targetDateKey] = true;
  }

  function moveRecurringOccurrence(state, task, sourceDateKey, targetDateKey, options = {}, helpers = {}) {
    task.excludedDates = task.excludedDates || {};
    task.excludedDates[sourceDateKey] = true;
    delete task.completed?.[sourceDateKey];
    delete task.acknowledgedOverdue?.[sourceDateKey];
    delete task.notified?.[sourceDateKey];
    removeTaskFromOrder(state, task.id, sourceDateKey);

    const targetHasNaturalOccurrence = targetDateKey !== sourceDateKey && helpers.taskScheduledOn?.(task, targetDateKey);
    if (targetHasNaturalOccurrence && !options.clearTime) {
      delete task.excludedDates[targetDateKey];
      return;
    }
    if (targetHasNaturalOccurrence) task.excludedDates[targetDateKey] = true;

    state.tasks.push({
      id: helpers.createId?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      title: task.title,
      date: targetDateKey,
      time: options.clearTime ? "" : task.time,
      scheduleMode: options.clearTime ? "deadline" : task.scheduleMode || "deadline",
      startTime: options.clearTime ? "" : task.startTime || "",
      endTime: options.clearTime ? "" : task.endTime || "",
      categoryId: task.categoryId,
      priority: task.priority,
      repeat: "none",
      sourceTaskId: task.id,
      movedFromDate: sourceDateKey,
      customRepeat: {},
      reminderOffset: task.reminderOffset,
      completed: {},
      acknowledgedOverdue: {},
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

  const api = {
    moveRecurringOccurrence,
    moveSingleTask,
    postponeTask,
    removeTaskFromOrder,
    shouldClearTimeForToday,
  };

  global.RhythmTaskMoves = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
