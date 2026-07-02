(function (global) {
  function createTimelineController(ctx) {
    function deleteTask(taskId) {
      const task = ctx.findTask(taskId);
      if (!task) return false;
      const undo = ctx.createUndoSnapshot();
      ctx.deleteTask(taskId);
      commit(ctx.messages.deleted, undo);
      return true;
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
      const activeDate = ctx.getActiveDate();
      const undo = ctx.createUndoSnapshot();
      const source = cloneTask(task);
      const duplicate = {
        ...source,
        id: ctx.createId(),
        title: `${task.title} ${ctx.messages.copySuffix}`,
        date: activeDate,
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
