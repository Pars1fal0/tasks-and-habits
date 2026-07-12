(function (global) {
  function createTaskForm(ctx) {
    function saveTaskFromForm(event) {
      event.preventDefault();
      const undo = ctx.createUndoSnapshot();
      const id = ctx.els.taskId.value || ctx.createId();
      const existing = ctx.findTask(id);
      const scheduleMode = ctx.getTaskScheduleMode();
      const startTime = scheduleMode === "block" ? ctx.cleanTimeValue(ctx.els.taskStartTime.value) : "";
      const endTime = scheduleMode === "block" ? ctx.cleanTimeValue(ctx.els.taskEndTime.value) : "";
      const deadlineTime = ctx.cleanTimeValue(ctx.els.taskTime.value);
      const repeatUntil = ctx.els.taskRepeat.value === "none" ? "" : ctx.normalizeDateKey(ctx.els.taskRepeatUntil.value, "");
      if (scheduleMode === "block" && !ctx.isValidTimeBlock(startTime, endTime)) {
        ctx.showToast("Укажи корректный временной блок");
        return;
      }
      if (repeatUntil && repeatUntil < (ctx.els.taskDate.value || ctx.getActiveDate())) {
        ctx.showToast("Дата окончания повтора не может быть раньше начала");
        ctx.els.taskRepeatUntil.focus();
        return;
      }
      const task = {
        id,
        title: ctx.cleanText(ctx.els.taskTitle.value),
        date: ctx.els.taskDate.value || ctx.getActiveDate(),
        scheduleMode: scheduleMode === "block" ? "block" : "deadline",
        startTime,
        endTime,
        time: scheduleMode === "block" ? endTime : scheduleMode === "none" ? "" : deadlineTime,
        categoryId: ctx.els.taskCategoryId.value,
        priority: ctx.els.taskPriority.value,
        repeat: ctx.els.taskRepeat.value,
        repeatUntil,
        customRepeat: ctx.els.taskRepeat.value === "custom" ? ctx.getCustomRepeatFromForm() : {},
        reminderOffset: scheduleMode === "none" ? "none" : ctx.els.taskReminder.value,
        completed: existing?.completed || {},
        acknowledgedOverdue: existing?.acknowledgedOverdue || {},
        excludedDates: existing?.excludedDates || {},
        notified: existing?.notified || {},
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      ctx.upsertTask(task);
      ctx.setActiveDate(task.date);
      resetTaskForm({ open: false });
      ctx.saveState();
      ctx.render();
      ctx.showToast(existing ? "Задача обновлена" : "Задача создана", { undo });
      ctx.afterSave?.(task, existing);
    }

    function fillTaskForm(task) {
      ctx.els.taskFormPanel.classList.remove("is-collapsed");
      if (ctx.els.taskFormHeading) ctx.els.taskFormHeading.textContent = "Редактировать задачу";
      ctx.els.taskId.value = task.id;
      ctx.els.taskTitle.value = task.title;
      ctx.els.taskDate.value = task.date;
      ctx.els.taskTime.value = ctx.cleanTimeValue(task.time);
      ctx.setTaskScheduleMode(ctx.isTimeBlock(task) ? "block" : ctx.cleanTimeValue(task.time) ? "deadline" : "none");
      ctx.els.taskStartTime.value = ctx.cleanTimeValue(task.startTime);
      ctx.els.taskEndTime.value = ctx.cleanTimeValue(task.endTime);
      ctx.els.taskCategoryId.value = task.categoryId || "";
      ctx.els.taskPriority.value = task.priority || "medium";
      ctx.els.taskRepeat.value = task.repeat || "none";
      ctx.els.taskRepeatUntil.value = task.repeatUntil || "";
      ctx.setCustomRepeatForm(task.customRepeat);
      ctx.els.taskReminder.value = task.reminderOffset ?? (task.time ? "15" : "none");
      ctx.syncTaskScheduleMode();
      ctx.syncCustomRepeatPanel();
      ctx.syncTaskTimePresets();
      ctx.els.taskTitle.focus();
    }

    function resetTaskForm(options = {}) {
      ctx.els.taskFormPanel.classList.toggle("is-collapsed", options.open === false);
      if (ctx.els.taskFormHeading) ctx.els.taskFormHeading.textContent = "Новая задача";
      ctx.els.taskForm.reset();
      ctx.els.taskId.value = "";
      ctx.els.taskDate.value = ctx.getActiveDate();
      ctx.els.taskTime.value = "";
      ctx.setTaskScheduleMode("deadline");
      ctx.els.taskStartTime.value = "";
      ctx.els.taskEndTime.value = "";
      ctx.els.taskCategoryId.value = "";
      ctx.els.taskPriority.value = "medium";
      ctx.els.taskRepeat.value = "none";
      ctx.els.taskRepeatUntil.value = "";
      ctx.setCustomRepeatForm();
      ctx.syncCustomRepeatPanel();
      ctx.syncTaskScheduleMode();
      ctx.els.taskReminder.value = "15";
      ctx.syncTaskTimePresets();
    }

    return { fillTaskForm, resetTaskForm, saveTaskFromForm };
  }

  const api = { createTaskForm };
  global.RhythmTaskForm = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
