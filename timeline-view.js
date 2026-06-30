(function (global) {
  function createTimelineView(ctx) {
    function renderTimeline() {
      const activeDate = ctx.getActiveDate();
      const model = buildTimelineModel({
        activeDate,
        formatTime: ctx.formatTime,
        getCategory: ctx.getCategory,
        isTaskDone: ctx.isTaskDone,
        priorityLabels: ctx.priorityLabels,
        tasks: ctx.getOrderedTasksForDate(activeDate),
      });

      ctx.els.timelineSummary.textContent = `${model.timedTasks.length} по времени · ${model.unscheduledTasks.length} без времени`;
      ctx.els.timelineGrid.replaceChildren();
      ctx.els.timelineUnscheduledList.replaceChildren();
      ctx.els.timelineEmpty.classList.toggle("is-visible", model.timedTasks.length === 0 && model.unscheduledTasks.length === 0);

      model.hourRows.forEach((row) => {
        const rowNode = document.createElement("div");
        const label = document.createElement("div");
        const slot = document.createElement("div");

        rowNode.className = "timeline-hour-row";
        label.className = "timeline-hour-label";
        label.textContent = row.label;
        slot.className = "timeline-hour-slot";

        row.tasks.forEach((entry) => {
          slot.appendChild(createTimelineTask(entry, activeDate));
        });

        if (!row.tasks.length) {
          const empty = document.createElement("span");
          empty.className = "timeline-slot-empty";
          empty.textContent = "Свободно";
          slot.appendChild(empty);
        }

        rowNode.append(label, slot);
        ctx.els.timelineGrid.appendChild(rowNode);
      });

      model.unscheduledTasks.forEach((entry) => {
        ctx.els.timelineUnscheduledList.appendChild(createTimelineTask(entry, activeDate));
      });
    }

    function createTimelineTask(entry, activeDate) {
      const button = document.createElement("button");
      const top = document.createElement("span");
      const time = document.createElement("strong");
      const title = document.createElement("span");
      const meta = document.createElement("small");

      button.type = "button";
      button.className = `timeline-task priority-${entry.task.priority || "medium"}`;
      button.classList.toggle("is-done", entry.done);
      button.dataset.taskId = entry.task.id;
      button.setAttribute("aria-label", `${entry.title}, ${entry.timeLabel || "без времени"}`);
      if (entry.categoryColor) button.style.setProperty("--category-color", entry.categoryColor);

      top.className = "timeline-task-top";
      time.textContent = entry.timeLabel || "Без времени";
      title.textContent = entry.title;
      meta.textContent = entry.metaLabel;
      top.append(time, title);
      button.append(top, meta);
      button.addEventListener("click", () => ctx.fillTaskForm(entry.task));

      return button;
    }

    return { renderTimeline };
  }

  function buildTimelineModel({ activeDate, formatTime, getCategory, isTaskDone, priorityLabels, tasks }) {
    const timedTasks = [];
    const unscheduledTasks = [];

    tasks.forEach((task) => {
      const minutes = parseTimeToMinutes(task.time);
      const category = getCategory(task.categoryId);
      const entry = {
        categoryColor: category?.color || "",
        done: isTaskDone(task, activeDate),
        hour: Number.isFinite(minutes) ? Math.floor(minutes / 60) : null,
        metaLabel: category?.name || priorityLabels[task.priority] || "Задача",
        minutes,
        task,
        timeLabel: Number.isFinite(minutes) ? formatTime(task.time) : "",
        title: task.title,
      };

      if (Number.isFinite(minutes)) {
        timedTasks.push(entry);
      } else {
        unscheduledTasks.push(entry);
      }
    });

    timedTasks.sort((a, b) => a.minutes - b.minutes || priorityRank(a.task.priority) - priorityRank(b.task.priority) || a.title.localeCompare(b.title));
    unscheduledTasks.sort((a, b) => priorityRank(a.task.priority) - priorityRank(b.task.priority) || a.title.localeCompare(b.title));

    const earliestHour = timedTasks.length ? Math.floor(timedTasks[0].minutes / 60) : 8;
    const latestHour = timedTasks.length ? Math.floor(timedTasks[timedTasks.length - 1].minutes / 60) : 18;
    const startHour = Math.min(8, earliestHour);
    const endHour = Math.max(20, latestHour);
    const hourRows = [];

    for (let hour = startHour; hour <= endHour; hour += 1) {
      hourRows.push({
        hour,
        label: formatTime(`${String(hour).padStart(2, "0")}:00`),
        tasks: timedTasks.filter((entry) => entry.hour === hour),
      });
    }

    return {
      hourRows,
      timedTasks,
      unscheduledTasks,
    };
  }

  function parseTimeToMinutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return NaN;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
    return hours * 60 + minutes;
  }

  function priorityRank(priority) {
    return { high: 0, medium: 1, low: 2 }[priority] ?? 1;
  }

  const api = { buildTimelineModel, createTimelineView };
  global.RhythmTimelineView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
