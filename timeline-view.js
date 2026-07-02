(function (global) {
  const TASK_DRAG_MIME = "application/x-rhythm-timeline-task";
  const TIMELINE_HOUR_HEIGHT = 96;
  const TIMELINE_SLOT_MINUTES = 15;
  const DEFAULT_BLOCK_MINUTES = 60;

  function createTimelineView(ctx) {
    let openTaskMenu = null;
    ensureMenuDismissHandlers();

    function renderTimeline() {
      closeTaskMenu();
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
        attachSlotCreate(slot, row.hour);

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
      const actions = createTaskMenu(entry);

      card.className = `timeline-task priority-${entry.task.priority || "medium"}`;
      card.classList.toggle("is-scheduled", Number.isFinite(entry.minutes));
      card.classList.toggle("is-unscheduled", !Number.isFinite(entry.minutes));
      card.classList.toggle("is-done", entry.done);
      card.classList.toggle("is-overdue", entry.isOverdue);
      card.classList.toggle("is-time-block", entry.isTimeBlock);
      card.dataset.taskId = entry.task.id;
      card.setAttribute("role", "listitem");
      if (entry.categoryColor) card.style.setProperty("--timeline-color", entry.categoryColor);
      card.addEventListener("click", (event) => {
        if (card.dataset.suppressClick === "true" || event.target.closest(".timeline-resize-handle, .timeline-menu-button, .timeline-task-menu")) return;
        ctx.fillTaskForm(entry.task);
      });
      if (Number.isFinite(entry.minutes)) {
        card.style.setProperty("--timeline-task-top", `${minuteOffsetToPx(entry.minutes)}px`);
        card.style.setProperty("--timeline-column-left", `${((entry.columnIndex || 0) / (entry.columnCount || 1)) * 100}%`);
        card.style.setProperty("--timeline-column-width", `${(1 / (entry.columnCount || 1)) * 100}%`);
        card.style.setProperty("--timeline-column-gap", entry.columnCount > 1 ? "6px" : "0px");
        card.setAttribute("aria-grabbed", "false");
        if (ctx.moveTaskTime) card.addEventListener("pointerdown", (event) => startTaskDrag(event, entry));
      } else if (ctx.moveTaskTime) {
        attachUnscheduledDrag(card, entry);
      }
      if (Number.isFinite(entry.visualDuration)) {
        const duration = Math.max(TIMELINE_SLOT_MINUTES, entry.visualDuration);
        card.classList.toggle("is-short-block", duration <= 30);
        card.classList.toggle("is-tiny-block", duration <= 15);
        setBlockHeight(card, duration);
      }

      main.type = "button";
      main.className = "timeline-task-main";
      main.setAttribute("aria-label", `${entry.title}, ${entry.timeLabel || "без времени"}`);
      if (Number.isFinite(entry.minutes) && ctx.shiftTaskTime) {
        main.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight");
        main.addEventListener("keydown", (event) => handleTaskKeydown(event, entry));
      }
      top.className = "timeline-task-top";
      time.textContent = entry.timeLabel || "Без времени";
      title.textContent = entry.title;
      meta.textContent = entry.isOverdue ? `${entry.metaLabel} · просрочено` : entry.metaLabel;
      top.append(time, title);
      main.append(top, meta);
      card.append(main, actions);

      if (entry.isTimeBlock && ctx.resizeTaskBlockTime) {
        card.appendChild(createResizeHandle(entry, "start"));
        card.appendChild(createResizeHandle(entry, "end"));
      }

      return card;
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

    function createTaskMenu(entry) {
      const wrap = document.createElement("div");
      const button = document.createElement("button");
      const menu = document.createElement("div");

      wrap.className = "timeline-task-menu-wrap";
      button.type = "button";
      button.className = "timeline-menu-button";
      button.setAttribute("aria-haspopup", "menu");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", `Действия для задачи ${entry.title}`);
      button.textContent = "...";

      menu.className = "timeline-task-menu";
      menu.setAttribute("role", "menu");
      menu.hidden = true;
      menu.append(
        createMenuItem(entry.done ? "Снова активна" : "Завершить", "complete", () => ctx.toggleTaskDone?.(entry.task.id)),
        createMenuItem("Дублировать", "duplicate", () => ctx.duplicateTask?.(entry.task.id)),
        createMenuItem("Открыть детали", "details", () => ctx.fillTaskForm(entry.task)),
        createMenuItem("Удалить", "delete", () => ctx.deleteTask?.(entry.task.id), "danger"),
      );

      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleTaskMenu(wrap);
      });

      wrap.append(button, menu);
      return wrap;
    }

    function createMenuItem(label, action, handler, tone = "") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = tone ? `timeline-menu-item is-${tone}` : "timeline-menu-item";
      button.dataset.action = action;
      button.setAttribute("role", "menuitem");
      button.textContent = label;
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeTaskMenu();
        handler();
      });
      return button;
    }

    function toggleTaskMenu(wrap) {
      const shouldOpen = openTaskMenu !== wrap;
      closeTaskMenu();
      if (!shouldOpen) return;
      const menu = wrap.querySelector(".timeline-task-menu");
      const button = wrap.querySelector(".timeline-menu-button");
      wrap.classList.add("is-open");
      wrap.closest(".timeline-task")?.classList.add("has-open-menu");
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      openTaskMenu = wrap;
    }

    function closeTaskMenu() {
      if (!openTaskMenu) return;
      const menu = openTaskMenu.querySelector(".timeline-task-menu");
      const button = openTaskMenu.querySelector(".timeline-menu-button");
      openTaskMenu.closest(".timeline-task")?.classList.remove("has-open-menu");
      openTaskMenu.classList.remove("is-open");
      if (menu) menu.hidden = true;
      if (button) button.setAttribute("aria-expanded", "false");
      openTaskMenu = null;
    }

    function ensureMenuDismissHandlers() {
      if (typeof document === "undefined") return;
      document.addEventListener("click", (event) => {
        if (!event.target.closest?.(".timeline-task-menu-wrap")) closeTaskMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeTaskMenu();
      });
    }

    function createDeleteButton(entry) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-delete-button";
      button.setAttribute("aria-label", `Удалить задачу ${entry.title}`);
      button.textContent = "×";
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        ctx.deleteTask?.(entry.task.id);
      });
      return button;
    }

    function attachUnscheduledDrag(card, entry) {
      card.draggable = true;
      card.setAttribute("aria-grabbed", "false");
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", entry.task.id);
        event.dataTransfer.setData(TASK_DRAG_MIME, JSON.stringify({ taskId: entry.task.id }));
        card.classList.add("is-dragging");
        card.setAttribute("aria-grabbed", "true");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        card.setAttribute("aria-grabbed", "false");
        card.dataset.suppressClick = "true";
        window.setTimeout(() => {
          delete card.dataset.suppressClick;
        }, 0);
      });
    }

    function startBlockResize(event, entry, edge) {
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget;
      const card = target.closest(".timeline-task");
      const slotHeight = getSlotHeight(target.closest(".timeline-hour-slot"));
      const startY = event.clientY;
      const originalStart = entry.minutes;
      const originalEnd = entry.endMinutes;
      target.setPointerCapture?.(event.pointerId);
      card?.classList.add("is-resizing");
      card?.setAttribute("data-resize-label", formatBlockLabel(originalStart, originalEnd));

      const onMove = (moveEvent) => {
        moveEvent.preventDefault();
        const rawDelta = ((moveEvent.clientY - startY) / slotHeight) * 60;
        const delta = snapMinutes(rawDelta);
        const next = nextBlockTimes(originalStart, originalEnd, edge, delta);
        if (card) {
          previewBlockResize(card, originalStart, next.start, next.end);
        }
      };

      const onUp = (upEvent) => {
        cleanup(upEvent);
        const rawDelta = ((upEvent.clientY - startY) / slotHeight) * 60;
        const delta = snapMinutes(rawDelta);
        const next = nextBlockTimes(originalStart, originalEnd, edge, delta);
        ctx.resizeTaskBlockTime(entry.task.id, formatHourMinute(Math.floor(next.start / 60), next.start % 60), formatHourMinute(Math.floor(next.end / 60), next.end % 60));
      };

      const onCancel = (cancelEvent) => {
        cleanup(cancelEvent);
        if (card) {
          setBlockHeight(card, originalEnd - originalStart);
          card.style.removeProperty("--timeline-drag-y");
          card.style.removeProperty("transform");
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

    function startTaskDrag(event, entry) {
      if (!Number.isFinite(entry.minutes) || !ctx.moveTaskTime) return;
      if (event.button !== 0 || event.target.closest(".timeline-resize-handle, .timeline-menu-button, .timeline-task-menu")) return;
      const card = event.currentTarget;
      const startY = event.clientY;
      const originalStart = entry.minutes;
      const duration = entry.isTimeBlock ? Math.max(TIMELINE_SLOT_MINUTES, entry.endMinutes - entry.minutes) : 0;
      let didMove = false;
      let latestStart = originalStart;

      card.setPointerCapture?.(event.pointerId);
      card.classList.add("is-dragging");
      card.setAttribute("aria-grabbed", "true");
      card.setAttribute("data-drag-label", entry.timeLabel || formatHourMinute(Math.floor(originalStart / 60), originalStart % 60));

      const onMove = (moveEvent) => {
        moveEvent.preventDefault();
        const rawDelta = ((moveEvent.clientY - startY) / getSlotHeight(card.closest(".timeline-hour-slot"))) * 60;
        const delta = snapMinutes(rawDelta);
        const maxStart = duration ? 23 * 60 + 59 - duration : 23 * 60 + 59;
        const nextStart = Math.max(0, Math.min(maxStart, originalStart + delta));
        if (Math.abs(moveEvent.clientY - startY) > 3) didMove = true;
        latestStart = nextStart;
        const label = duration
          ? formatBlockLabel(nextStart, nextStart + duration)
          : formatHourMinute(Math.floor(nextStart / 60), nextStart % 60);
        card.style.setProperty("--timeline-drag-y", `${minutesToPx(nextStart - originalStart)}px`);
        card.setAttribute("data-drag-label", label);
      };

      const onUp = (upEvent) => {
        cleanup(upEvent);
        if (!didMove || latestStart === originalStart) return;
        card.dataset.suppressClick = "true";
        window.setTimeout(() => {
          delete card.dataset.suppressClick;
        }, 0);
        ctx.moveTaskTime(entry.task.id, formatHourMinute(Math.floor(latestStart / 60), latestStart % 60));
      };

      const onCancel = (cancelEvent) => {
        cleanup(cancelEvent);
      };

      const cleanup = (nextEvent) => {
        card.releasePointerCapture?.(nextEvent.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        card.classList.remove("is-dragging");
        card.setAttribute("aria-grabbed", "false");
        card.style.removeProperty("--timeline-drag-y");
        card.removeAttribute("data-drag-label");
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    }

    function previewBlockResize(card, originalStart, nextStart, nextEnd) {
      setBlockHeight(card, nextEnd - nextStart);
      card.style.setProperty("--timeline-drag-y", `${minutesToPx(nextStart - originalStart)}px`);
      card.setAttribute("data-resize-label", formatBlockLabel(nextStart, nextEnd));
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
      card.style.setProperty("--block-min-height", `${Math.max(20, Math.round(minutesToPx(Math.max(TIMELINE_SLOT_MINUTES, duration)) - 4))}px`);
    }

    function formatBlockLabel(start, end) {
      return `${formatHourMinute(Math.floor(start / 60), start % 60)}-${formatHourMinute(Math.floor(end / 60), end % 60)}`;
    }

    function handleTaskKeydown(event, entry) {
      if (!event.altKey) return;
      const offsets = {
        ArrowDown: 15,
        ArrowLeft: -15,
        ArrowRight: 15,
        ArrowUp: -15,
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
        const minutes = minuteFromPointer(event, slot, hour);
        ctx.moveTaskTime(dragData.taskId, formatHourMinute(Math.floor(minutes / 60), minutes % 60));
      });
    }

    function attachSlotCreate(slot, hour) {
      if (!ctx.createTaskAtTime) return;
      slot.addEventListener("click", (event) => {
        if (event.target.closest(".timeline-task") || event.target.closest(".timeline-now-line")) return;
        const minutes = minuteFromPointer(event, slot, hour);
        const startTime = formatHourMinute(Math.floor(minutes / 60), minutes % 60);
        const end = Math.min(23 * 60 + 59, minutes + DEFAULT_BLOCK_MINUTES);
        const endTime = formatHourMinute(Math.floor(end / 60), end % 60);
        ctx.createTaskAtTime(startTime, endTime);
      });
    }

    function minuteFromPointer(event, slot, hour) {
      const rect = slot.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const minutesInHour = Math.min(45, Math.max(0, snapMinutes((y / getSlotHeight(slot)) * 60)));
      return Math.min(23 * 60 + 59, hour * 60 + minutesInHour);
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

  function getSlotHeight(slot) {
    return Math.max(60, slot?.clientHeight || TIMELINE_HOUR_HEIGHT);
  }

  function snapMinutes(value) {
    return Math.round(value / TIMELINE_SLOT_MINUTES) * TIMELINE_SLOT_MINUTES;
  }

  function minutesToPx(minutes) {
    return (minutes / 60) * TIMELINE_HOUR_HEIGHT;
  }

  function minuteOffsetToPx(minutes) {
    return minutesToPx(minutes % 60);
  }

  function buildTimelineModel({ activeDate, formatTime, getCategory, isTaskDone, now = new Date(), priorityLabels, tasks, todayKey }) {
    const timedTasks = [];
    const unscheduledTasks = [];
    const resolvedTodayKey = todayKey || dateKeyFromDate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    tasks.forEach((task) => {
      const block = parseTaskBlock(task);
      const minutes = Number.isFinite(block.start) ? block.start : parseTimeToMinutes(task.time);
      const endMinutes = Number.isFinite(block.end) ? block.end : Number.isFinite(minutes) ? minutes + 30 : minutes;
      const visualDuration = Number.isFinite(minutes) ? Math.max(TIMELINE_SLOT_MINUTES, endMinutes - minutes) : NaN;
      const category = getCategory(task.categoryId);
      const done = isTaskDone(task, activeDate);
      const entry = {
        categoryColor: category?.color || "",
        columnCount: 1,
        columnIndex: 0,
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
        visualDuration,
      };

      if (Number.isFinite(minutes)) {
        timedTasks.push(entry);
      } else {
        unscheduledTasks.push(entry);
      }
    });

    timedTasks.sort((a, b) => a.minutes - b.minutes || priorityRank(a.task.priority) - priorityRank(b.task.priority) || a.title.localeCompare(b.title));
    assignTimelineColumns(timedTasks);
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

  function assignTimelineColumns(entries) {
    let cluster = [];
    let clusterEnd = -Infinity;

    entries.forEach((entry) => {
      const start = entry.minutes;
      const end = entryLayoutEnd(entry);
      if (!cluster.length || start < clusterEnd) {
        cluster.push(entry);
        clusterEnd = Math.max(clusterEnd, end);
        return;
      }
      assignClusterColumns(cluster);
      cluster = [entry];
      clusterEnd = end;
    });

    if (cluster.length) assignClusterColumns(cluster);
  }

  function assignClusterColumns(cluster) {
    const columns = [];
    cluster.forEach((entry) => {
      const start = entry.minutes;
      const end = entryLayoutEnd(entry);
      let columnIndex = columns.findIndex((columnEnd) => columnEnd <= start);
      if (columnIndex === -1) {
        columnIndex = columns.length;
        columns.push(end);
      } else {
        columns[columnIndex] = end;
      }
      entry.columnIndex = columnIndex;
    });

    const columnCount = Math.max(1, columns.length);
    cluster.forEach((entry) => {
      entry.columnCount = columnCount;
    });
  }

  function entryLayoutEnd(entry) {
    return Math.min(24 * 60, entry.minutes + Math.max(TIMELINE_SLOT_MINUTES, entry.visualDuration || TIMELINE_SLOT_MINUTES));
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
