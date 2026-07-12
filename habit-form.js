(function (global) {
  function createHabitForm(ctx) {
    function saveHabitFromForm(event) {
      event.preventDefault();
      const undo = ctx.createUndoSnapshot();
      const id = ctx.els.habitId.value || ctx.createId();
      const existing = ctx.findHabit(id);
      const type = ctx.els.habitType.value;
      const habit = {
        id,
        title: ctx.cleanText(ctx.els.habitTitle.value),
        type,
        repeat: ctx.normalizeHabitRepeat(ctx.els.habitRepeat.value),
        customRepeat: ctx.els.habitRepeat.value === "custom" ? ctx.getHabitCustomRepeatFromForm() : {},
        startDate: existing?.startDate || ctx.getActiveDate(),
        unit: ctx.cleanText(ctx.els.habitUnit.value),
        goal: type === "number" ? Math.max(1, Number(ctx.els.habitGoal.value || 1)) : 1,
        logs: existing?.logs || {},
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      ctx.upsertHabit(habit);
      ctx.saveState();
      resetHabitForm({ open: false });
      ctx.render();
      ctx.showToast(existing ? "Привычка обновлена" : "Привычка создана", { undo });
    }

    function fillHabitForm(habit) {
      ctx.els.habitFormPanel.classList.remove("is-collapsed");
      if (ctx.els.habitFormHeading) ctx.els.habitFormHeading.textContent = "Редактировать привычку";
      ctx.els.habitId.value = habit.id;
      ctx.els.habitTitle.value = habit.title;
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
