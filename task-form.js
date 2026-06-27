(function (global) {
  function createTaskForm(ctx) {
    function saveTaskFromForm(event) {
      event.preventDefault();
      const undo = ctx.createUndoSnapshot();
      const id = ctx.els.taskId.value || ctx.createId();
      const existing = ctx.findTask(id);
      const task = {
        id,
        title: ctx.cleanText(ctx.els.taskTitle.value),
        date: ctx.els.taskDate.value || ctx.getActiveDate(),
        time: ctx.cleanTimeValue(ctx.els.taskTime.value),
        categoryId: ctx.els.taskCategoryId.value,
        priority: ctx.els.taskPriority.value,
        repeat: ctx.els.taskRepeat.value,
        customRepeat: ctx.els.taskRepeat.value === "custom" ? ctx.getCustomRepeatFromForm() : {},
        reminderOffset: ctx.els.taskReminder.value,
        completed: existing?.completed || {},
        excludedDates: existing?.excludedDates || {},
        notified: existing?.notified || {},
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      ctx.upsertTask(task);
      ctx.setActiveDate(task.date);
      resetTaskForm();
      ctx.saveState();
      ctx.render();
      ctx.showToast(existing ? "Задача обновлена" : "Задача создана", { undo });
    }

    function fillTaskForm(task) {
      ctx.els.taskFormPanel.classList.remove("is-collapsed");
      ctx.els.taskId.value = task.id;
      ctx.els.taskTitle.value = task.title;
      ctx.els.taskDate.value = task.date;
      ctx.els.taskTime.value = ctx.cleanTimeValue(task.time);
      ctx.els.taskCategoryId.value = task.categoryId || "";
      ctx.els.taskPriority.value = task.priority || "medium";
      ctx.els.taskRepeat.value = task.repeat || "none";
      ctx.setCustomRepeatForm(task.customRepeat);
      ctx.els.taskReminder.value = task.reminderOffset ?? (task.time ? "15" : "none");
      ctx.syncCustomRepeatPanel();
      ctx.syncTaskTimePresets();
      ctx.els.taskTitle.focus();
    }

    function resetTaskForm() {
      ctx.els.taskFormPanel.classList.remove("is-collapsed");
      ctx.els.taskForm.reset();
      ctx.els.taskId.value = "";
      ctx.els.taskDate.value = ctx.getActiveDate();
      ctx.els.taskTime.value = "";
      ctx.els.taskCategoryId.value = "";
      ctx.els.taskPriority.value = "medium";
      ctx.els.taskRepeat.value = "none";
      ctx.setCustomRepeatForm();
      ctx.syncCustomRepeatPanel();
      ctx.els.taskReminder.value = "15";
      ctx.syncTaskTimePresets();
    }

    return { fillTaskForm, resetTaskForm, saveTaskFromForm };
  }

  const api = { createTaskForm };
  global.RhythmTaskForm = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
