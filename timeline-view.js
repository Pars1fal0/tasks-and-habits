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
        slot.setAttribute("role", "list");
        slot.setAttribute("aria-label", `Задачи на ${row.label}`);
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
      card.classList.toggle("is-time-block", entry.isTimeBlock);
      card.dataset.taskId = entry.task.id;
      card.setAttribute("role", "listitem");
      if (entry.categoryColor) card.style.setProperty("--category-color", entry.categoryColor);
      if (entry.isTimeBlock) {
        const duration = Math.max(15, entry.endMinutes - entry.minutes);
        setBlockHeight(card, duration);
      }

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
      if (Number.isFinite(entry.minutes) && ctx.shiftTaskTime) {
        main.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight");
        main.addEventListener("keydown", (event) => handleTaskKeydown(event, entry));
      }
      main.addEventListener("click", () => ctx.fillTaskForm(entry.task));

      top.className = "timeline-task-top";
      time.textContent = entry.timeLabel || "Без времени";
      title.textContent = entry.title;
      meta.textContent = entry.isOverdue ? `${entry.metaLabel} · просрочено` : entry.metaLabel;
      top.append(time, title);
      main.append(top, meta);
      card.appendChild(main);

      if (entry.isTimeBlock && ctx.resizeTaskBlockTime) {
        card.appendChild(createResizeHandle(entry, "start"));
        card.appendChild(createResizeHandle(entry, "end"));
      }

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

    function createResizeHandle(entry, edge) {
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = `timeline-resize-handle is-${edge}`;
      handle.setAttribute("aria-label", edge === "start" ? "Потянуть начало блока" : "Потянуть конец блока");
      handle.addEventListener("pointerdown", (event) => startBlockResize(event, entry, edge));
      handle.addEventListener("keydown", (event) => {
        const offsets = { ArrowDown: 15, ArrowUp: -15 };
        const offset = offsets[event.key];
        if (!offset) return;
        event.preventDefault();
        resizeBlockByKeyboard(entry, edge, offset);
      });
      return handle;
    }

    function startBlockResize(event, entry, edge) {
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget;
      const card = target.closest(".timeline-task");
      const slotHeight = Math.max(48, target.closest(".timeline-hour-slot")?.clientHeight || 68);
      const startY = event.clientY;
      const originalStart = entry.minutes;
      const originalEnd = entry.endMinutes;
      target.setPointerCapture?.(event.pointerId);
      card?.classList.add("is-resizing");
      card?.setAttribute("data-resize-label", formatBlockLabel(originalStart, originalEnd));

      const onMove = (moveEvent) => {
        moveEvent.preventDefault();
        const rawDelta = ((moveEvent.clientY - startY) / slotHeight) * 60;
        const delta = Math.round(rawDelta / 15) * 15;
        const next = nextBlockTimes(originalStart, originalEnd, edge, delta);
        if (card) {
          setBlockHeight(card, next.end - next.start);
          card.setAttribute("data-resize-label", formatBlockLabel(next.start, next.end));
        }
      };

      const onUp = (upEvent) => {
        cleanup(upEvent);
        const rawDelta = ((upEvent.clientY - startY) / slotHeight) * 60;
        const delta = Math.round(rawDelta / 15) * 15;
        const next = nextBlockTimes(originalStart, originalEnd, edge, delta);
        ctx.resizeTaskBlockTime(entry.task.id, formatHourMinute(Math.floor(next.start / 60), next.start % 60), formatHourMinute(Math.floor(next.end / 60), next.end % 60));
      };

      const onCancel = (cancelEvent) => {
        cleanup(cancelEvent);
        if (card) {
          setBlockHeight(card, originalEnd - originalStart);
          card.removeAttribute("data-resize-label");
        }
      };

      const cleanup = (nextEvent) => {
        target.releasePointerCapture?.(nextEvent.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        card?.classList.remove("is-resizing");
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    }

    function resizeBlockByKeyboard(entry, edge, offset) {
      const next = nextBlockTimes(entry.minutes, entry.endMinutes, edge, offset);
      ctx.resizeTaskBlockTime(entry.task.id, formatHourMinute(Math.floor(next.start / 60), next.start % 60), formatHourMinute(Math.floor(next.end / 60), next.end % 60));
    }

    function nextBlockTimes(start, end, edge, delta) {
      if (edge === "start") {
        const nextStart = Math.max(0, Math.min(end - 15, start + delta));
        return { start: nextStart, end };
      }
      const nextEnd = Math.max(start + 15, Math.min(23 * 60 + 59, end + delta));
      return { start, end: nextEnd };
    }

    function setBlockHeight(card, duration) {
      card.style.setProperty("--block-min-height", `${Math.max(58, Math.round(Math.max(15, duration) * 1.2))}px`);
    }

    function formatBlockLabel(start, end) {
      return `${formatHourMinute(Math.floor(start / 60), start % 60)}-${formatHourMinute(Math.floor(end / 60), end % 60)}`;
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

    function handleTaskKeydown(event, entry) {
      if (!event.altKey) return;
      const offsets = {
        ArrowDown: 60,
        ArrowLeft: -15,
        ArrowRight: 15,
        ArrowUp: -60,
      };
      const offset = offsets[event.key];
      if (!offset) return;
      event.preventDefault();
      event.stopPropagation();
      ctx.shiftTaskTime(entry.task.id, offset);
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
      const block = parseTaskBlock(task);
      const minutes = Number.isFinite(block.start) ? block.start : parseTimeToMinutes(task.time);
      const endMinutes = Number.isFinite(block.end) ? block.end : minutes;
      const category = getCategory(task.categoryId);
      const done = isTaskDone(task, activeDate);
      const entry = {
        categoryColor: category?.color || "",
        done,
        endMinutes,
        hour: Number.isFinite(minutes) ? Math.floor(minutes / 60) : null,
        isOverdue: Number.isFinite(endMinutes) && !done && isTaskTimeOverdue(activeDate, endMinutes, resolvedTodayKey, currentMinutes),
        isTimeBlock: Number.isFinite(block.start) && Number.isFinite(block.end),
        metaLabel: category?.name || priorityLabels[task.priority] || "Задача",
        minutes,
        task,
        timeLabel:
          Number.isFinite(block.start) && Number.isFinite(block.end)
            ? `${formatTime(task.startTime)}-${formatTime(task.endTime)}`
            : Number.isFinite(minutes)
              ? formatTime(task.time)
              : "",
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
    const earliestHour = timedTasks.length ? Math.min(...timedTasks.map((entry) => Math.floor(entry.minutes / 60))) : 8;
    const latestHour = timedTasks.length ? Math.max(...timedTasks.map((entry) => Math.floor((entry.endMinutes || entry.minutes) / 60))) : 18;
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

  function parseTaskBlock(task) {
    if (task?.scheduleMode !== "block") return { start: NaN, end: NaN };
    const start = parseTimeToMinutes(task.startTime);
    const end = parseTimeToMinutes(task.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { start: NaN, end: NaN };
    return { start, end };
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
