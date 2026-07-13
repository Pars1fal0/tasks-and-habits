(function (global) {
  const TASK_DRAG_MIME = "application/x-rhythm-timeline-task";
  const layout =
    global.RhythmTimelineLayout ||
    (typeof require !== "undefined" ? require("./timeline-layout.js") : null);
  const {
    DEFAULT_BLOCK_MINUTES,
    TIMELINE_SLOT_MINUTES,
    buildTimelineModel,
    formatBlockLabel,
    formatHourMinute,
    getSlotHeight,
    minuteOffsetToPx,
    minutesToPx,
    nextBlockTimes,
    snapMinutes,
  } = layout;
  const menuApi =
    global.RhythmTimelineMenu ||
    (typeof require !== "undefined" ? require("./timeline-menu.js") : null);
  const dragApi =
    global.RhythmTimelineDrag ||
    (typeof require !== "undefined" ? require("./timeline-drag.js") : null);

  function createTimelineView(ctx) {
    const taskMenu = menuApi.createTimelineMenu(ctx);
    const timelineDrag = dragApi.createTimelineDrag({
      ctx,
      formatHourMinute,
      minuteFromPointer,
      taskDragMime: TASK_DRAG_MIME,
    });

    function renderTimeline() {
      taskMenu.closeTaskMenu();
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
        timelineDrag.attachDropZone(slot, row.hour);
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
      const actions = taskMenu.createTaskMenu(entry);

      card.className = `timeline-task priority-${entry.task.priority || "medium"}`;
      card.classList.toggle("is-scheduled", Number.isFinite(entry.minutes));
      card.classList.toggle("is-unscheduled", !Number.isFinite(entry.minutes));
      card.classList.toggle("is-done", entry.done);
      card.classList.toggle("is-overdue", entry.isOverdue);
      card.classList.toggle("is-time-block", entry.isTimeBlock);
      card.classList.toggle("is-deadline-marker", Number.isFinite(entry.minutes) && !entry.isTimeBlock);
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
        timelineDrag.attachUnscheduledDrag(card, entry);
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
          timelineDrag.showPointerHint(formatBlockLabel(next.start, next.end), moveEvent);
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
        timelineDrag.hidePointerHint();
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
      const startX = event.clientX;
      const startY = event.clientY;
      const originalStart = entry.minutes;
      const duration = entry.isTimeBlock ? Math.max(TIMELINE_SLOT_MINUTES, entry.endMinutes - entry.minutes) : 0;
      let didMove = false;
      let latestStart = originalStart;
      let dropWithoutTime = false;

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
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 3) didMove = true;
        if (didMove) timelineDrag.showUnscheduledTarget();
        dropWithoutTime = didMove && timelineDrag.isOverUnscheduledTarget(moveEvent);
        timelineDrag.setUnscheduledTargetActive(dropWithoutTime);
        latestStart = nextStart;
        if (dropWithoutTime) {
          card.style.setProperty("--timeline-drag-y", "0px");
          card.setAttribute("data-drag-label", "Без времени");
          timelineDrag.showPointerHint("Без времени", moveEvent);
          return;
        }
        const label = duration
          ? formatBlockLabel(nextStart, nextStart + duration)
          : formatHourMinute(Math.floor(nextStart / 60), nextStart % 60);
        card.style.setProperty("--timeline-drag-y", `${minutesToPx(nextStart - originalStart)}px`);
        card.setAttribute("data-drag-label", label);
        timelineDrag.showPointerHint(label, moveEvent);
      };

      const onUp = (upEvent) => {
        const shouldClearTime = dropWithoutTime || timelineDrag.isOverUnscheduledTarget(upEvent);
        cleanup(upEvent);
        if (!didMove || (!shouldClearTime && latestStart === originalStart)) return;
        card.dataset.suppressClick = "true";
        window.setTimeout(() => {
          delete card.dataset.suppressClick;
        }, 0);
        if (shouldClearTime) {
          ctx.clearTaskTime?.(entry.task.id);
        } else {
          ctx.moveTaskTime(entry.task.id, formatHourMinute(Math.floor(latestStart / 60), latestStart % 60));
        }
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
        timelineDrag.hidePointerHint();
        timelineDrag.hideUnscheduledTarget();
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

    function setBlockHeight(card, duration) {
      card.style.setProperty("--block-min-height", `${Math.max(20, Math.round(minutesToPx(Math.max(TIMELINE_SLOT_MINUTES, duration)) - 4))}px`);
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

    function attachSlotCreate(slot, hour) {
      if (!ctx.createTaskAtTime) return;
      slot.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest(".timeline-task") || event.target.closest(".timeline-now-line")) return;
        const startMinutes = minuteFromPointerFree(event, slot, hour);
        let latestEnd = Math.min(23 * 60 + 59, startMinutes + DEFAULT_BLOCK_MINUTES);
        let didMove = false;
        const startY = event.clientY;
        const preview = document.createElement("span");
        preview.className = "timeline-create-preview";
        slot.appendChild(preview);
        updateCreatePreview(preview, startMinutes, latestEnd);
        slot.setPointerCapture?.(event.pointerId);

        const onMove = (moveEvent) => {
          moveEvent.preventDefault();
          if (Math.abs(moveEvent.clientY - startY) > 4) didMove = true;
          const rawEnd = minuteFromPointerFree(moveEvent, slot, hour);
          latestEnd = Math.max(startMinutes + TIMELINE_SLOT_MINUTES, rawEnd);
          updateCreatePreview(preview, startMinutes, latestEnd);
          timelineDrag.showPointerHint(formatBlockLabel(startMinutes, latestEnd), moveEvent);
        };

        const onUp = (upEvent) => {
          cleanup(upEvent);
          if (!didMove) return;
          slot.dataset.suppressClick = "true";
          window.setTimeout(() => {
            delete slot.dataset.suppressClick;
          }, 0);
          ctx.createTaskAtTime(formatMinutes(startMinutes), formatMinutes(latestEnd));
        };

        const onCancel = (cancelEvent) => cleanup(cancelEvent);

        const cleanup = (nextEvent) => {
          slot.releasePointerCapture?.(nextEvent.pointerId);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          preview.remove();
          timelineDrag.hidePointerHint();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
      });

      slot.addEventListener("click", (event) => {
        if (slot.dataset.suppressClick === "true") return;
        if (event.target.closest(".timeline-task") || event.target.closest(".timeline-now-line")) return;
        const minutes = minuteFromPointer(event, slot, hour);
        const startTime = formatMinutes(minutes);
        const end = Math.min(23 * 60 + 59, minutes + DEFAULT_BLOCK_MINUTES);
        const endTime = formatMinutes(end);
        ctx.createTaskAtTime(startTime, endTime);
      });
    }

    function minuteFromPointer(event, slot, hour) {
      const rect = slot.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const minutesInHour = Math.min(45, Math.max(0, snapMinutes((y / getSlotHeight(slot)) * 60)));
      return Math.min(23 * 60 + 59, hour * 60 + minutesInHour);
    }

    function minuteFromPointerFree(event, slot, hour) {
      const rect = slot.getBoundingClientRect();
      const rawMinutes = hour * 60 + snapMinutes(((event.clientY - rect.top) / getSlotHeight(slot)) * 60);
      return Math.max(0, Math.min(23 * 60 + 59, rawMinutes));
    }

    function updateCreatePreview(preview, startMinutes, endMinutes) {
      const top = `${((startMinutes % 60) / 60) * 100}%`;
      const height = `${Math.max(20, minutesToPx(endMinutes - startMinutes) - 4)}px`;
      preview.style.setProperty("--create-preview-top", top);
      preview.style.setProperty("--create-preview-height", height);
      preview.textContent = formatBlockLabel(startMinutes, endMinutes);
    }

    function formatMinutes(minutes) {
      return formatHourMinute(Math.floor(minutes / 60), minutes % 60);
    }

    return { renderTimeline };
  }

  const api = { buildTimelineModel, createTimelineView };
  global.RhythmTimelineView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
