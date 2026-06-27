(function (global) {
  function createCalendarView(ctx) {
    function renderOverview() {
      const activeDate = ctx.getActiveDate();
      const week = ctx.getWeekDates(activeDate);
      let taskDone = 0;
      let taskTotal = 0;
      let habitDone = 0;
      let habitTotal = 0;

      ctx.els.weekStrip.replaceChildren();

      week.forEach((dateKey) => {
        const stats = ctx.statsForDate(dateKey);
        taskDone += stats.taskDone;
        taskTotal += stats.taskTotal;
        habitDone += stats.habitDone;
        habitTotal += stats.habitTotal;

        const dayCell = document.createElement("article");
        dayCell.className = "day-cell";
        dayCell.innerHTML = `
          <span class="day-name">${ctx.formatWeekday(dateKey)}</span>
          <strong class="day-score">${Math.round((stats.taskPercent + stats.habitPercent) / 2)}%</strong>
          <div class="day-bars">
            <div class="mini-bar"><span style="width: ${stats.taskPercent}%"></span></div>
            <div class="mini-bar habit"><span style="width: ${stats.habitPercent}%"></span></div>
          </div>
        `;
        ctx.els.weekStrip.appendChild(dayCell);
      });

      const taskMetric = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;
      const habitMetric = habitTotal ? Math.round((habitDone / habitTotal) * 100) : 0;

      ctx.els.weeklyTaskMetric.textContent = `${taskMetric}%`;
      ctx.els.weeklyHabitMetric.textContent = `${habitMetric}%`;
      ctx.els.weeklyTaskText.textContent = `${taskDone} из ${taskTotal} задач за неделю`;
      ctx.els.weeklyHabitText.textContent = `${habitDone} из ${habitTotal} отметок привычек`;
      renderWeekBoard(week);
      renderMonthCalendar();
      renderHeatmap();
    }

    function renderWeekBoard(week) {
      const activeDate = ctx.getActiveDate();
      ctx.els.weekBoardLabel.textContent = `${ctx.formatShortDate(week[0])} — ${ctx.formatShortDate(week[6])}`;
      ctx.els.weekBoardGrid.replaceChildren();

      week.forEach((dateKey) => {
        const tasks = ctx.getOrderedTasksForDate(dateKey);
        const openTasks = tasks.filter((task) => !ctx.isTaskDone(task, dateKey));
        const doneCount = tasks.length - openTasks.length;
        const column = document.createElement("article");

        column.className = "week-board-day calendar-drop-zone";
        column.dataset.date = dateKey;
        column.tabIndex = 0;
        column.setAttribute("role", "button");
        column.setAttribute("aria-label", `${ctx.formatLongDate(dateKey)}: ${openTasks.length} открыто, ${doneCount} готово`);
        column.classList.toggle("is-active", dateKey === activeDate);
        column.classList.toggle("is-today", dateKey === ctx.toDateKey(new Date()));
        column.innerHTML = `
          <div class="week-board-header">
            <span>${ctx.formatWeekday(dateKey)}</span>
            <strong>${ctx.parseDate(dateKey).getDate()}</strong>
          </div>
          <div class="week-board-count">${doneCount}/${tasks.length} выполнено</div>
          <div class="week-board-list">
            ${
              tasks.length
                ? tasks
                    .map((task) => {
                      const done = ctx.isTaskDone(task, dateKey);
                      const category = ctx.getCategory(task.categoryId);
                      return `
                        <span class="week-task-chip month-task-chip${done ? " is-done" : ""}" draggable="true" data-task-id="${ctx.escapeHtml(task.id)}" data-date="${dateKey}">
                          <span>${ctx.escapeHtml(task.title)}</span>
                          <small>${ctx.escapeHtml(category?.name || ctx.priorityLabels[task.priority] || "Задача")}</small>
                        </span>
                      `;
                    })
                    .join("")
                : `<span class="week-board-empty">Нет задач</span>`
            }
          </div>
        `;

        column.addEventListener("click", () => ctx.openDateTasks(dateKey));
        column.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          ctx.openDateTasks(dateKey);
        });
        ctx.attachTaskDropZone(column, dateKey);
        column.querySelectorAll(".month-task-chip").forEach((chip) => ctx.attachTaskChipDrag(chip));
        ctx.els.weekBoardGrid.appendChild(column);
      });
    }

    function renderMonthCalendar() {
      const activeDate = ctx.getActiveDate();
      const monthDate = ctx.parseDate(activeDate);
      const currentMonth = monthDate.getMonth();
      const dates = ctx.getMonthCalendarDates(activeDate);

      ctx.els.monthLabel.textContent = ctx.formatMonthLabel(activeDate);
      ctx.els.monthGrid.replaceChildren();

      dates.forEach((dateKey) => {
        const date = ctx.parseDate(dateKey);
        const tasks = ctx.getOrderedTasksForDate(dateKey);
        const openTasks = tasks.filter((task) => !ctx.isTaskDone(task, dateKey));
        const doneCount = tasks.length - openTasks.length;
        const habitCount = ctx.habitsForDate(dateKey).length;
        const visibleTasks = openTasks.slice(0, 3);
        const hiddenTasks = openTasks.slice(3);
        const hiddenCount = hiddenTasks.length;
        const dayCell = document.createElement("div");
        const details = [];

        if (openTasks.length) details.push(`${openTasks.length} открыто`);
        if (doneCount) details.push(`${doneCount} готово`);
        if (habitCount) details.push(`${habitCount} привычек`);

        dayCell.className = "month-day calendar-drop-zone";
        dayCell.dataset.date = dateKey;
        dayCell.tabIndex = 0;
        dayCell.setAttribute("role", "button");
        dayCell.setAttribute("aria-label", `${ctx.formatLongDate(dateKey)}: ${details.join(", ") || "нет задач"}`);
        dayCell.classList.toggle("is-outside", date.getMonth() !== currentMonth);
        dayCell.classList.toggle("is-active", dateKey === activeDate);
        dayCell.classList.toggle("is-today", dateKey === ctx.toDateKey(new Date()));
        dayCell.innerHTML = `
          <span class="month-day-head">
            <strong>${date.getDate()}</strong>
            ${tasks.length ? `<span>${doneCount}/${tasks.length}</span>` : ""}
          </span>
          <div class="month-day-items">
            ${visibleTasks
              .map((task) => `<span class="month-task-chip" draggable="true" data-task-id="${ctx.escapeHtml(task.id)}" data-date="${dateKey}">${ctx.escapeHtml(task.title)}</span>`)
              .join("")}
            ${
              hiddenCount > 0
                ? `<button class="month-day-more" type="button">+${hiddenCount}</button>
                  <div class="month-day-hidden">
                    ${hiddenTasks
                      .map((task) => `<span class="month-task-chip" draggable="true" data-task-id="${ctx.escapeHtml(task.id)}" data-date="${dateKey}">${ctx.escapeHtml(task.title)}</span>`)
                      .join("")}
                  </div>`
                : ""
            }
          </div>
        `;
        dayCell.addEventListener("click", () => ctx.openDateTasks(dateKey));
        dayCell.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          ctx.openDateTasks(dateKey);
        });
        ctx.attachTaskDropZone(dayCell, dateKey);
        dayCell.querySelectorAll(".month-task-chip").forEach((chip) => ctx.attachTaskChipDrag(chip));
        const moreButton = dayCell.querySelector(".month-day-more");
        if (moreButton) {
          moreButton.addEventListener("click", (event) => {
            event.stopPropagation();
            const expanded = dayCell.classList.toggle("is-expanded");
            moreButton.textContent = expanded ? "Скрыть" : `+${hiddenCount}`;
          });
        }

        ctx.els.monthGrid.appendChild(dayCell);
      });
    }

    function renderHeatmap() {
      const activeDate = ctx.getActiveDate();
      const end = ctx.parseDate(activeDate);
      const start = new Date(end);
      start.setDate(end.getDate() - 69);
      ctx.els.heatmapGrid.replaceChildren();

      for (let i = 0; i < 70; i += 1) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        const dateKey = ctx.toDateKey(current);
        const stats = ctx.statsForDate(dateKey);
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";
        cell.style.setProperty("--task-alpha", ctx.heatAlpha(stats.taskPercent));
        cell.style.setProperty("--habit-alpha", ctx.heatAlpha(stats.habitPercent));
        cell.title = `${ctx.formatLongDate(dateKey)}: задачи ${stats.taskPercent}%, привычки ${stats.habitPercent}%`;
        cell.setAttribute("aria-label", cell.title);
        if (dateKey === activeDate) cell.classList.add("is-current");
        ctx.els.heatmapGrid.appendChild(cell);
      }
    }

    return {
      renderHeatmap,
      renderMonthCalendar,
      renderOverview,
      renderWeekBoard,
    };
  }

  const api = { createCalendarView };
  global.RhythmCalendarView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
