(function (global) {
  function createTimelineController(ctx) {
    function deleteTask(taskId) {
      const task = ctx.findTask(taskId);
      if (!task) return false;
      if (task.sourceTaskId && ctx.confirmAction) return deleteMovedReplacement(task);
      if (task.repeat !== "none" && ctx.confirmAction) {
        return deleteRecurringTask(task);
      }
      if ((ctx.getLinkedGoals?.(task.id) || []).length && ctx.confirmAction) return deleteLinkedTask(task);
      const undo = ctx.createUndoSnapshot();
      ctx.deleteTask(taskId);
      commit(ctx.messages.deleted, undo);
      return true;
    }

    async function deleteLinkedTask(task) {
      const linkedGoals = ctx.getLinkedGoals(task.id);
      const confirmed = await ctx.confirmAction({
        title: "Удалить связанную задачу?",
        message: `Связь исчезнет из целей: ${linkedGoals.map((goal) => goal.title).join(", ")}.`,
        confirmLabel: "Удалить задачу",
        tone: "danger",
      });
      if (!confirmed) return false;
      const undo = ctx.createUndoSnapshot();
      ctx.deleteTask(task.id);
      commit(ctx.messages.deleted, undo);
      return true;
    }

    async function deleteMovedReplacement(task) {
      const choice = await ctx.confirmAction({
        title: "Удалить перенесенную задачу?",
        message: "Можно вернуть исходный повтор на этот день или оставить день исключенным из серии.",
        secondaryLabel: "Вернуть повтор",
        confirmLabel: "Оставить день пустым",
        tone: "danger",
      });
      if (!choice) return false;
      const undo = ctx.createUndoSnapshot();
      ctx.deleteMovedReplacement(task.id, { restoreSourceOccurrence: choice === "secondary" });
      commit(choice === "secondary" ? "Исходный повтор возвращен" : ctx.messages.deleted, undo);
      return true;
    }

    async function deleteRecurringTask(task) {
      const dateKey = ctx.getActiveDate();
      const scope = await ctx.confirmAction({
        title: "Удалить повторяющуюся задачу?",
        message: `Выбери, убрать только ${ctx.formatLongDate(dateKey)} или завершить серию с этого дня. Прошлая история сохранится.`,
        secondaryLabel: "Только этот день",
        confirmLabel: "Этот и будущие",
        tone: "danger",
      });
      if (scope === "secondary") {
        ctx.excludeTaskDate(task, dateKey);
        return true;
      }
      if (scope === true) {
        ctx.stopTaskSeries(task, dateKey);
        return true;
      }
      return false;
    }

    function toggleTaskDone(taskId) {
      const task = ctx.findTask(taskId);
      if (!task) return false;
      const activeDate = ctx.getActiveDate();
      const undo = ctx.createUndoSnapshot();
      const done = ctx.isTaskDone(task, activeDate);
      task.completed = task.completed || {};
      task.completed[activeDate] = !done;
      commit(done ? ctx.messages.active : ctx.messages.done, undo);
      return true;
    }

    function duplicateTask(taskId) {
      const task = ctx.findTask(taskId);
      if (!task) return null;
      if (task.repeat !== "none" && ctx.confirmAction) return chooseDuplicateScope(task);
      return createDuplicate(task, { wholeSeries: false });
    }

    async function chooseDuplicateScope(task) {
      const choice = await ctx.confirmAction({
        title: "Дублировать повторяющуюся задачу?",
        message: "Создать разовую копию выбранного дня или вторую повторяющуюся серию?",
        secondaryLabel: "Только этот день",
        confirmLabel: "Всю серию",
      });
      if (!choice) return null;
      return createDuplicate(task, { wholeSeries: choice === true });
    }

    function createDuplicate(task, options = {}) {
      const activeDate = ctx.getActiveDate();
      const undo = ctx.createUndoSnapshot();
      const source = cloneTask(task);
      const duplicate = {
        ...source,
        id: ctx.createId(),
        title: `${task.title} ${ctx.messages.copySuffix}`,
        date: options.wholeSeries ? task.date : activeDate,
        repeat: options.wholeSeries ? task.repeat : "none",
        repeatUntil: options.wholeSeries ? task.repeatUntil || "" : "",
        customRepeat: options.wholeSeries ? cloneTask(task.customRepeat || {}) : {},
        sourceTaskId: "",
        movedFromDate: "",
        completed: {},
        excludedDates: {},
        notified: {},
        createdAt: new Date().toISOString(),
      };

      ctx.getState().tasks.push(duplicate);
      ctx.getState().taskOrder[activeDate] = ctx.getOrderedTasksForDate(activeDate).map((item) => item.id);
      const sourceIndex = ctx.getState().taskOrder[activeDate].indexOf(task.id);
      if (sourceIndex >= 0) {
        ctx.getState().taskOrder[activeDate] = ctx.getState().taskOrder[activeDate].filter((id) => id !== duplicate.id);
        ctx.getState().taskOrder[activeDate].splice(sourceIndex + 1, 0, duplicate.id);
      }

      commit(ctx.messages.duplicated, undo);
      return duplicate;
    }

    function moveTaskTime(taskId, targetTime) {
      return updateTaskTime(taskId, targetTime, ctx.messages.timeUpdated);
    }

    function shiftTaskTime(taskId, offsetMinutes) {
      const task = ctx.findTask(taskId);
      if (!task) return false;
      const currentMinutes = ctx.timeToMinutes(ctx.taskSortTime(task));
      if (!Number.isFinite(currentMinutes)) return false;
      const nextMinutes = Math.max(0, Math.min(23 * 60 + 59, currentMinutes + offsetMinutes));
      const nextTime = ctx.minutesToTime(nextMinutes);
      return updateTaskTime(taskId, nextTime, `${ctx.messages.movedTo} ${ctx.formatTime(nextTime)}`);
    }

    function setTaskTime(taskId, targetTime) {
      return updateTaskTime(taskId, targetTime, `${ctx.messages.movedTo} ${ctx.formatTime(targetTime)}`);
    }

    function updateTaskTime(taskId, targetTime, message) {
      const task = ctx.findTask(taskId);
      const nextTime = ctx.cleanTimeValue(targetTime);
      if (!task || !nextTime || ctx.taskSortTime(task) === nextTime) return false;

      const undo = ctx.createUndoSnapshot();
      if (ctx.isTimeBlock(task)) {
        const duration = ctx.timeToMinutes(task.endTime) - ctx.timeToMinutes(task.startTime);
        const nextStart = ctx.timeToMinutes(nextTime);
        const nextEnd = Math.min(23 * 60 + 59, nextStart + duration);
        task.startTime = ctx.minutesToTime(Math.max(0, nextEnd - duration));
        task.endTime = ctx.minutesToTime(nextEnd);
        task.time = task.endTime;
        task.scheduleMode = "block";
      } else if (!ctx.cleanTimeValue(task.time)) {
        const nextStart = ctx.timeToMinutes(nextTime);
        const nextEnd = Math.min(23 * 60 + 59, nextStart + 60);
        task.startTime = ctx.minutesToTime(Math.max(0, nextEnd - 60));
        task.endTime = ctx.minutesToTime(nextEnd);
        task.time = task.endTime;
        task.scheduleMode = "block";
      } else {
        task.time = nextTime;
        task.scheduleMode = "deadline";
        task.startTime = "";
        task.endTime = "";
      }
      clearNotification(task, ctx.getActiveDate());
      commit(message || ctx.messages.timeUpdated, undo);
      return true;
    }

    function resizeTaskBlockTime(taskId, startTime, endTime) {
      const task = ctx.findTask(taskId);
      if (!task || !ctx.isValidTimeBlock(startTime, endTime)) return false;
      const nextStart = ctx.cleanTimeValue(startTime);
      const nextEnd = ctx.cleanTimeValue(endTime);
      if (task.startTime === nextStart && task.endTime === nextEnd) return false;

      const undo = ctx.createUndoSnapshot();
      task.scheduleMode = "block";
      task.startTime = nextStart;
      task.endTime = nextEnd;
      task.time = nextEnd;
      clearNotification(task, ctx.getActiveDate());
      commit(`${ctx.messages.blockUpdated}: ${ctx.formatTaskWindow(task)}`, undo);
      return true;
    }

    function createTaskAtTime(startTime, endTime) {
      ctx.resetTaskForm();
      ctx.openFloatingTaskForm();
      ctx.setTaskScheduleMode("block");
      ctx.els.taskDate.value = ctx.getActiveDate();
      ctx.els.taskStartTime.value = ctx.cleanTimeValue(startTime);
      ctx.els.taskEndTime.value = ctx.cleanTimeValue(endTime);
      ctx.els.taskTime.value = "";
      ctx.els.taskReminder.value = "15";
      ctx.syncTaskScheduleMode();
      ctx.syncTaskTimePresets();
      ctx.els.taskFormPanel.classList.remove("is-collapsed");
      ctx.els.taskTitle.focus();
      return true;
    }

    function commit(message, undo) {
      ctx.saveState();
      ctx.render();
      ctx.showToast(message, { undo });
    }

    return {
      createTaskAtTime,
      deleteTask,
      duplicateTask,
      moveTaskTime,
      resizeTaskBlockTime,
      setTaskTime,
      shiftTaskTime,
      toggleTaskDone,
      updateTaskTime,
    };
  }

  function clearNotification(task, dateKey) {
    if (task.notified) delete task.notified[dateKey];
  }

  function cloneTask(task) {
    if (typeof structuredClone === "function") return structuredClone(task);
    return JSON.parse(JSON.stringify(task));
  }

  const api = { createTimelineController };
  global.RhythmTimelineController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
