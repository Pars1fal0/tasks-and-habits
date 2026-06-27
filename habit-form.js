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
      };

      ctx.upsertHabit(habit);
      ctx.saveState();
      resetHabitForm();
      ctx.render();
      ctx.showToast(existing ? "Привычка обновлена" : "Привычка создана", { undo });
    }

    function fillHabitForm(habit) {
      ctx.els.habitFormPanel.classList.remove("is-collapsed");
      ctx.els.habitId.value = habit.id;
      ctx.els.habitTitle.value = habit.title;
      ctx.els.habitType.value = habit.type;
      ctx.els.habitRepeat.value = ctx.normalizeHabitRepeat(habit.repeat);
      ctx.setHabitCustomRepeatForm(habit.customRepeat);
      ctx.syncHabitCustomRepeatPanel();
      ctx.els.habitUnit.value = habit.unit || "";
      ctx.els.habitGoal.value = habit.goal || "";
      ctx.els.habitTitle.focus();
    }

    function resetHabitForm() {
      ctx.els.habitFormPanel.classList.remove("is-collapsed");
      ctx.els.habitForm.reset();
      ctx.els.habitId.value = "";
      ctx.els.habitType.value = "check";
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
