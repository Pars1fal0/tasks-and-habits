(function (global) {
  function createHabitsView(ctx) {
    function renderHabits() {
      const activeDate = ctx.getActiveDate();
      const habits = ctx.habitsForDate(activeDate);
      ctx.els.habitList.replaceChildren();
      habits.forEach((habit) => ctx.els.habitList.appendChild(createHabitNode(habit)));
      ctx.els.habitEmpty.textContent = ctx.getState().habits.length
        ? "На выбранный день привычек по расписанию нет."
        : "Добавь первую привычку.";
      ctx.els.habitEmpty.classList.toggle("is-visible", habits.length === 0);
    }

    function createHabitNode(habit) {
      const activeDate = ctx.getActiveDate();
      const node = ctx.els.habitTemplate.content.firstElementChild.cloneNode(true);
      const title = node.querySelector("h3");
      const streak = node.querySelector(".habit-streak");
      const control = node.querySelector(".habit-control");

      title.textContent = habit.title;
      streak.textContent = habitSubtitle(habit);

      if (habit.type === "number") {
        const current = Number(habit.logs[activeDate] || 0);
        const goal = Number(habit.goal || 1);
        const percent = Math.min(100, Math.round((current / goal) * 100));

        control.innerHTML = `
          <div class="habit-number-row">
            <input type="number" min="0" step="1" value="${current}" aria-label="${ctx.escapeHtml(habit.title)}">
            <span>${current} / ${goal} ${ctx.escapeHtml(habit.unit || "")}</span>
          </div>
          <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width: ${percent}%"></div></div>
        `;

        control.querySelector("input").addEventListener("input", (event) => {
          habit.logs[activeDate] = Math.max(0, Number(event.target.value || 0));
          ctx.saveState();
          ctx.renderDailyPulse();
          ctx.renderOverview();
          node.querySelector(".habit-streak").textContent = habitSubtitle(habit);
          const nextPercent = Math.min(100, Math.round((Number(habit.logs[activeDate]) / goal) * 100));
          control.querySelector(".progress-fill").style.width = `${nextPercent}%`;
          control.querySelector("span").textContent = `${habit.logs[activeDate]} / ${goal} ${habit.unit || ""}`;
        });
      } else {
        const done = habit.logs[activeDate] === true;
        const row = document.createElement("div");
        row.className = "habit-check-row";

        const button = document.createElement("button");
        button.type = "button";
        button.className = `check-button${done ? " is-checked" : ""}`;
        button.setAttribute("aria-label", `Отметить ${habit.title}`);

        const label = document.createElement("span");
        label.textContent = done ? "Выполнено" : "Не отмечено";

        button.addEventListener("click", () => {
          const undo = ctx.createUndoSnapshot();
          habit.logs[activeDate] = !done;
          ctx.saveState();
          ctx.render();
          ctx.showToast(done ? "Отметка снята" : "Привычка отмечена", { undo });
        });

        row.append(button, label);
        control.append(row);
      }

      node.querySelector(".edit-habit").addEventListener("click", () => ctx.fillHabitForm(habit));
      node.querySelector(".delete-habit").addEventListener("click", () => {
        const undo = ctx.createUndoSnapshot();
        ctx.deleteHabit(habit.id);
        ctx.saveState();
        ctx.render();
        ctx.showToast("Привычка удалена", { undo });
      });

      return node;
    }

    function habitSubtitle(habit) {
      const repeat = ctx.formatHabitRepeat(habit);
      return `Серия: ${ctx.habitStreak(habit, ctx.getActiveDate())} дн. · ${repeat}`;
    }

    return {
      createHabitNode,
      habitSubtitle,
      renderHabits,
    };
  }

  const api = { createHabitsView };
  global.RhythmHabitsView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
