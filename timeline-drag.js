(function (global) {
  function createTimelineDrag({ ctx, formatHourMinute, minuteFromPointer, taskDragMime }) {
    let pointerHint = null;
    let unscheduledTarget = null;

    function attachUnscheduledDrag(card, entry) {
      card.draggable = true;
      card.setAttribute("aria-grabbed", "false");
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", entry.task.id);
        event.dataTransfer.setData(taskDragMime, JSON.stringify({ taskId: entry.task.id }));
        card.classList.add("is-dragging");
        card.setAttribute("aria-grabbed", "true");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        card.setAttribute("aria-grabbed", "false");
        hidePointerHint();
        removeAllDropPreviews();
        card.dataset.suppressClick = "true";
        window.setTimeout(() => {
          delete card.dataset.suppressClick;
        }, 0);
      });
    }

    function attachDropZone(slot, hour) {
      if (!ctx.moveTaskTime) return;

      slot.addEventListener("dragover", (event) => {
        if (!readDragData(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const minutes = minuteFromPointer(event, slot, hour);
        const label = formatMinutes(minutes);
        slot.classList.add("is-drop-target");
        updateDropPreview(slot, minutes, label);
        showPointerHint(label, event);
      });

      slot.addEventListener("dragleave", (event) => {
        if (slot.contains(event.relatedTarget)) return;
        slot.classList.remove("is-drop-target");
        removeDropPreview(slot);
        hidePointerHint();
      });

      slot.addEventListener("drop", (event) => {
        const dragData = readDragData(event.dataTransfer);
        if (!dragData?.taskId) return;
        event.preventDefault();
        slot.classList.remove("is-drop-target");
        removeDropPreview(slot);
        hidePointerHint();
        const minutes = minuteFromPointer(event, slot, hour);
        ctx.moveTaskTime(dragData.taskId, formatMinutes(minutes));
      });
    }

    function readDragData(dataTransfer) {
      if (!dataTransfer) return null;
      const typed = dataTransfer.getData(taskDragMime);
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

    function updateDropPreview(slot, minutes, label) {
      const preview = ensureDropPreview(slot);
      preview.style.setProperty("--drop-preview-top", `${((minutes % 60) / 60) * 100}%`);
      preview.textContent = label;
    }

    function ensureDropPreview(slot) {
      let preview = slot.querySelector(":scope > .timeline-drop-preview");
      if (!preview) {
        preview = document.createElement("span");
        preview.className = "timeline-drop-preview";
        slot.appendChild(preview);
      }
      return preview;
    }

    function removeDropPreview(slot) {
      slot.querySelector(":scope > .timeline-drop-preview")?.remove();
    }

    function removeAllDropPreviews() {
      document.querySelectorAll(".timeline-drop-preview").forEach((node) => node.remove());
    }

    function showPointerHint(label, event) {
      if (!pointerHint) {
        pointerHint = document.createElement("span");
        pointerHint.className = "timeline-pointer-hint";
        document.body.appendChild(pointerHint);
      }
      pointerHint.textContent = label;
      pointerHint.style.left = `${event.clientX}px`;
      pointerHint.style.top = `${event.clientY}px`;
    }

    function hidePointerHint() {
      pointerHint?.remove();
      pointerHint = null;
    }

    function showUnscheduledTarget() {
      if (unscheduledTarget) return;
      unscheduledTarget = document.createElement("div");
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      const hint = document.createElement("small");
      unscheduledTarget.className = "timeline-unschedule-target";
      unscheduledTarget.setAttribute("aria-hidden", "true");
      icon.classList.add("ui-icon");
      use.setAttribute("href", "#icon-skip");
      title.textContent = "Без времени";
      hint.textContent = "Перетащи сюда, чтобы убрать расписание";
      icon.appendChild(use);
      copy.append(title, hint);
      unscheduledTarget.append(icon, copy);
      document.body.appendChild(unscheduledTarget);
    }

    function isOverUnscheduledTarget(event) {
      if (!unscheduledTarget) return false;
      const rect = unscheduledTarget.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    function setUnscheduledTargetActive(active) {
      unscheduledTarget?.classList.toggle("is-drop-target", active);
    }

    function hideUnscheduledTarget() {
      unscheduledTarget?.remove();
      unscheduledTarget = null;
    }

    function formatMinutes(minutes) {
      return formatHourMinute(Math.floor(minutes / 60), minutes % 60);
    }

    return {
      attachDropZone,
      attachUnscheduledDrag,
      hidePointerHint,
      hideUnscheduledTarget,
      isOverUnscheduledTarget,
      readDragData,
      setUnscheduledTargetActive,
      showPointerHint,
      showUnscheduledTarget,
    };
  }

  const api = { createTimelineDrag };
  global.RhythmTimelineDrag = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
