(function (global) {
  const TASK_DRAG_MIME = "application/x-rhythm-timeline-task";

  function createTimelineView(ctx) {
    function renderTimeline() {
      const activeDate = ctx.getActiveDate();
      const now = ctx.getNow?.() || new Date();
      const model = buildTimelineModel({
        activeDate,
        formatTime: ctx.formatTime,
        getCategory: ctx.getCategory,
        isTaskDone: ctx.isTaskDone,
        now,
        priorityLabels: ctx.priorityLabels,
        tasks: ctx.getOrderedTasksForDate(activeDate),
        todayKey: ctx.toDateKey?.(now),
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
        slot.dataset.hour = String(row.hour);
        attachDropZone(slot, row.hour);

        if (model.nowLine?.hour === row.hour) {
          slot.appendChild(createNowLine(model.nowLine.offsetPercent));
        }

        row.tasks.forEach((entry) => {
          slot.appendChild(createTimelineTask(entry));
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
        ctx.els.timelineUnscheduledList.appendChild(createTimelineTask(entry));
      });
    }

    function createTimelineTask(entry) {
      const card = document.createElement("article");
      const main = document.createElement("button");
      const top = document.createElement("span");
      const time = document.createElement("strong");
      const title = document.createElement("span");
      const meta = document.createElement("small");

      card.className = `timeline-task priority-${entry.task.priority || "medium"}`;
      card.classList.toggle("is-done", entry.done);
      card.classList.toggle("is-overdue", entry.isOverdue);
      card.dataset.taskId = entry.task.id;
      if (entry.categoryColor) card.style.setProperty("--category-color", entry.categoryColor);

      if (ctx.moveTaskTime) {
        card.draggable = true;
        card.addEventListener("dragstart", (event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", entry.task.id);
          event.dataTransfer.setData(
            TASK_DRAG_MIME,
            JSON.stringify({
              minute: Number.isFinite(entry.minutes) ? entry.minutes % 60 : 0,
              taskId: entry.task.id,
            }),
          );
          card.classList.add("is-dragging");
        });
        card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
      }

      main.type = "button";
      main.className = "timeline-task-main";
      main.setAttribute("aria-label", `${entry.title}, ${entry.timeLabel || "без времени"}`);
      main.addEventListener("click", () => ctx.fillTaskForm(entry.task));

      top.className = "timeline-task-top";
      time.textContent = entry.timeLabel || "Без времени";
      title.textContent = entry.title;
      meta.textContent = entry.isOverdue ? `${entry.metaLabel} · просрочено` : entry.metaLabel;
      top.append(time, title);
      main.append(top, meta);
      card.appendChild(main);

      if (Number.isFinite(entry.minutes) && (ctx.shiftTaskTime || ctx.setTaskTime)) {
        card.appendChild(createQuickActions(entry));
      }

      return card;
    }

    function createQuickActions(entry) {
      const actions = document.createElement("div");
      actions.className = "timeline-task-actions";
      actions.setAttribute("aria-label", "Быстрый перенос времени");
      actions.append(
        createActionButton("+15", () => ctx.shiftTaskTime?.(entry.task.id, 15)),
        createActionButton("+30", () => ctx.shiftTaskTime?.(entry.task.id, 30)),
        createActionButton("Вечер", () => ctx.setTaskTime?.(entry.task.id, "18:00")),
      );
      return actions;
    }

    function createActionButton(label, handler) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-time-action";
      button.textContent = label;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        handler();
      });
      return button;
    }

    function createNowLine(offsetPercent) {
      const marker = document.createElement("span");
      const label = document.createElement("span");
      marker.className = "timeline-now-line";
      marker.style.setProperty("--now-offset", `${offsetPercent}%`);
      label.className = "timeline-now-label";
      label.textContent = "Сейчас";
      marker.appendChild(label);
      return marker;
    }

    function attachDropZone(slot, hour) {
      if (!ctx.moveTaskTime) return;

      slot.addEventListener("dragover", (event) => {
        if (!readDragData(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        slot.classList.add("is-drop-target");
      });

      slot.addEventListener("dragleave", (event) => {
        if (!slot.contains(event.relatedTarget)) slot.classList.remove("is-drop-target");
      });

      slot.addEventListener("drop", (event) => {
        const dragData = readDragData(event.dataTransfer);
        if (!dragData?.taskId) return;
        event.preventDefault();
        slot.classList.remove("is-drop-target");
        ctx.moveTaskTime(dragData.taskId, formatHourMinute(hour, dragData.minute));
      });
    }

    function readDragData(dataTransfer) {
      if (!dataTransfer) return null;
      const typed = dataTransfer.getData(TASK_DRAG_MIME);
      if (typed) {
        try {
          return JSON.parse(typed);
        } catch {
          return null;
        }
      }
      const taskId = dataTransfer.getData("text/plain");
      return taskId ? { minute: 0, taskId } : null;
    }

    return { renderTimeline };
  }

  function buildTimelineModel({ activeDate, formatTime, getCategory, isTaskDone, now = new Date(), priorityLabels, tasks, todayKey }) {
    const timedTasks = [];
    const unscheduledTasks = [];
    const resolvedTodayKey = todayKey || dateKeyFromDate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    tasks.forEach((task) => {
      const minutes = parseTimeToMinutes(task.time);
      const category = getCategory(task.categoryId);
      const done = isTaskDone(task, activeDate);
      const entry = {
        categoryColor: category?.color || "",
        done,
        hour: Number.isFinite(minutes) ? Math.floor(minutes / 60) : null,
        isOverdue: Number.isFinite(minutes) && !done && isTaskTimeOverdue(activeDate, minutes, resolvedTodayKey, currentMinutes),
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

    const currentHour = activeDate === resolvedTodayKey ? Math.floor(currentMinutes / 60) : null;
    const earliestHour = timedTasks.length ? Math.floor(timedTasks[0].minutes / 60) : 8;
    const latestHour = timedTasks.length ? Math.floor(timedTasks[timedTasks.length - 1].minutes / 60) : 18;
    const startHour = Math.min(8, earliestHour, Number.isFinite(currentHour) ? currentHour : 8);
    const endHour = Math.max(20, latestHour, Number.isFinite(currentHour) ? currentHour : 20);
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
      nowLine:
        Number.isFinite(currentHour) && currentHour >= startHour && currentHour <= endHour
          ? {
              hour: currentHour,
              offsetPercent: Math.round(((currentMinutes % 60) / 60) * 100),
            }
          : null,
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

  function isTaskTimeOverdue(activeDate, minutes, todayKey, currentMinutes) {
    if (activeDate < todayKey) return true;
    if (activeDate > todayKey) return false;
    return minutes < currentMinutes;
  }

  function formatHourMinute(hour, minute = 0) {
    const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
    const safeMinute = Math.max(0, Math.min(59, Number(minute) || 0));
    return `${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
  }

  function dateKeyFromDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const api = { buildTimelineModel, createTimelineView };
  global.RhythmTimelineView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
