(function (global) {
  function createHabitForm(ctx) {
    function saveHabitFromForm(event) {
      event.preventDefault();
      const undo = ctx.createUndoSnapshot();
      const id = ctx.els.habitId.value || ctx.createId();
      const existing = ctx.findHabit(id);
      const type = ctx.els.habitType.value;
      const now = new Date().toISOString();
      let habit = {
        id,
        title: existing?.title || ctx.cleanText(ctx.els.habitTitle.value),
        titleHistory: existing?.titleHistory || [],
        type,
        repeat: ctx.normalizeHabitRepeat(ctx.els.habitRepeat.value),
        customRepeat: ctx.els.habitRepeat.value === "custom" ? ctx.getHabitCustomRepeatFromForm() : {},
        startDate: existing?.startDate || ctx.getActiveDate(),
        unit: ctx.cleanText(ctx.els.habitUnit.value),
        goal: type === "number" ? Math.max(1, Number(ctx.els.habitGoal.value || 1)) : 1,
        logs: existing?.logs || {},
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      habit = ctx.applyHabitTitleChange
        ? ctx.applyHabitTitleChange(habit, ctx.els.habitTitle.value, ctx.getActiveDate(), { cleanText: ctx.cleanText, updatedAt: now })
        : { ...habit, title: ctx.cleanText(ctx.els.habitTitle.value) };

      ctx.upsertHabit(habit);
      ctx.saveState();
      resetHabitForm({ open: false });
      ctx.render();
      ctx.showToast(existing ? "Привычка обновлена" : "Привычка создана", { undo });
    }

    function fillHabitForm(habit) {
      ctx.els.habitFormPanel.classList.remove("is-collapsed");
      if (ctx.els.habitFormHeading) ctx.els.habitFormHeading.textContent = "Редактировать привычку";
      if (ctx.els.resetHabitForm) ctx.els.resetHabitForm.textContent = "Отмена";
      ctx.els.habitId.value = habit.id;
      ctx.els.habitTitle.value = ctx.habitTitleOnDate?.(habit, ctx.getActiveDate()) || habit.title;
      ctx.els.habitType.value = habit.type;
      ctx.syncHabitTypeFields();
      ctx.els.habitRepeat.value = ctx.normalizeHabitRepeat(habit.repeat);
      ctx.setHabitCustomRepeatForm(habit.customRepeat);
      ctx.syncHabitCustomRepeatPanel();
      ctx.els.habitUnit.value = habit.unit || "";
      ctx.els.habitGoal.value = habit.goal || "";
      ctx.els.habitTitle.focus();
    }

    function resetHabitForm(options = {}) {
      ctx.els.habitFormPanel.classList.toggle("is-collapsed", options.open === false);
      if (ctx.els.habitFormHeading) ctx.els.habitFormHeading.textContent = "Новая привычка";
      if (ctx.els.resetHabitForm) ctx.els.resetHabitForm.textContent = "Очистить";
      ctx.els.habitForm.reset();
      ctx.els.habitId.value = "";
      ctx.els.habitType.value = "check";
      ctx.syncHabitTypeFields();
      ctx.els.habitRepeat.value = "daily";
      ctx.setHabitCustomRepeatForm();
      ctx.syncHabitCustomRepeatPanel();
    }

    return { fillHabitForm, resetHabitForm, saveHabitFromForm };
  }

  const api = { createHabitForm };
  global.RhythmHabitForm = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
