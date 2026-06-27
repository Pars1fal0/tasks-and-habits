(function (global) {
  function createTasksView(ctx) {
    let draggedTaskId = null;
    let draggedTaskDate = "";

    function renderTasks() {
      const activeDate = ctx.getActiveDate();
      const tasks = ctx.getOrderedTasksForDate(activeDate);
      const visibleTasks = tasks.filter((task) => {
        const done = ctx.isTaskDone(task, activeDate);
        const matchesCategory = ctx.matchesCategoryFilter(task, ctx.getTaskCategoryFilter());
        if (!matchesCategory) return false;
        if (!ctx.taskMatchesSearch(task, ctx.getTaskSearchQuery(), activeDate)) return false;
        if (ctx.getTaskFilter() === "open") return !done;
        if (ctx.getTaskFilter() === "done") return done;
        return true;
      });

      renderOverdueTasks();
      ctx.els.taskList.replaceChildren();
      visibleTasks.forEach((task) => ctx.els.taskList.appendChild(createTaskNode(task)));

      const doneCount = tasks.filter((task) => ctx.isTaskDone(task, activeDate)).length;
      const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
      const hasActiveFilters = ctx.getTaskFilter() !== "all" || ctx.getTaskCategoryFilter() !== "all" || ctx.getTaskSearchQuery();

      ctx.els.taskEmpty.textContent = tasks.length
        ? "По текущим фильтрам задач нет."
        : "На выбранный день задач нет.";
      ctx.els.taskEmpty.classList.toggle("is-visible", visibleTasks.length === 0);
      ctx.els.taskCounter.textContent = hasActiveFilters
        ? `${visibleTasks.length} из ${tasks.length} найдено · ${doneCount} выполнено`
        : `${doneCount} из ${tasks.length} выполнено`;
      ctx.els.taskProgress.textContent = `${percent}%`;
      ctx.els.taskProgressRing.style.setProperty("--progress", `${percent * 3.6}deg`);
      renderExcludedTasks();
    }

    function createTaskNode(task) {
      const activeDate = ctx.getActiveDate();
      const node = ctx.els.taskTemplate.content.firstElementChild.cloneNode(true);
      const done = ctx.isTaskDone(task, activeDate);
      const category = ctx.getCategory(task.categoryId);
      const title = node.querySelector("h3");
      const check = node.querySelector(".check-button");
      const meta = node.querySelector(".task-meta");
      const postponeDateInput = node.querySelector(".postpone-date-input");
      const priority = node.querySelector(".priority-pill");

      node.dataset.taskId = task.id;
      if (category) {
        node.classList.add("has-category");
        node.style.setProperty("--category-color", category.color);
      } else {
        node.classList.remove("has-category");
        node.style.removeProperty("--category-color");
      }
      node.classList.toggle("is-done", done);
      node.classList.add(`priority-${task.priority || "medium"}-task`);
      title.textContent = task.title;
      check.classList.toggle("is-checked", done);
      priority.textContent = ctx.priorityLabels[task.priority] || "Средний";
      priority.classList.add(`priority-${task.priority || "medium"}`);
      meta.innerHTML = ctx.taskMetaMarkup(task);

      node.addEventListener("dragstart", (event) => {
        draggedTaskId = task.id;
        draggedTaskDate = activeDate;
        ctx.setDraggedTask(task.id, activeDate);
        node.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.setData("application/x-rhythm-task", JSON.stringify({ taskId: task.id, dateKey: activeDate }));
      });
      node.addEventListener("dragend", () => {
        ctx.clearTaskDragState();
        draggedTaskId = null;
        draggedTaskDate = "";
        node.classList.remove("is-dragging");
      });
      node.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (draggedTaskId && draggedTaskId !== task.id) {
          node.classList.add("is-drop-target");
        }
      });
      node.addEventListener("dragleave", () => node.classList.remove("is-drop-target"));
      node.addEventListener("drop", (event) => {
        event.preventDefault();
        const sourceId = draggedTaskId || event.dataTransfer.getData("text/plain");
        if (sourceId && sourceId !== task.id) {
          const undo = ctx.createUndoSnapshot();
          ctx.reorderTask(activeDate, sourceId, task.id);
          ctx.saveState();
          ctx.render();
          ctx.showToast("Порядок задач изменен", { undo });
        }
      });

      check.addEventListener("click", () => {
        const undo = ctx.createUndoSnapshot();
        task.completed[activeDate] = !done;
        ctx.saveState();
        ctx.render();
        ctx.showToast(done ? "Задача снова активна" : "Задача выполнена", { undo });
      });

      node.querySelector(".edit-task").addEventListener("click", () => ctx.fillTaskForm(task));
      node.querySelector(".postpone-tomorrow").addEventListener("click", () => {
        ctx.postponeTask(task, activeDate, ctx.addDays(activeDate, 1));
      });
      node.querySelector(".postpone-week").addEventListener("click", () => {
        ctx.postponeTask(task, activeDate, ctx.addDays(activeDate, 7));
      });
      node.querySelector(".postpone-date").addEventListener("click", () => {
        postponeDateInput.value = ctx.addDays(activeDate, 1);
        postponeDateInput.classList.add("is-visible");
        if (postponeDateInput.showPicker) {
          postponeDateInput.showPicker();
        } else {
          postponeDateInput.focus();
        }
      });
      postponeDateInput.addEventListener("change", () => {
        if (!postponeDateInput.value) return;
        ctx.postponeTask(task, activeDate, postponeDateInput.value);
      });
      const excludeButton = node.querySelector(".exclude-task");
      excludeButton.hidden = task.repeat === "none";
      excludeButton.addEventListener("click", () => ctx.excludeTaskDate(task, activeDate));
      node.querySelector(".delete-task").addEventListener("click", () => {
        const undo = ctx.createUndoSnapshot();
        ctx.deleteTask(task.id);
        ctx.saveState();
        ctx.render();
        ctx.showToast("Задача удалена", { undo });
      });

      return node;
    }

    function renderOverdueTasks() {
      const overdueEntries = ctx.overdueTaskEntries();
      ctx.els.overdueList.replaceChildren();
      ctx.els.overduePanel.classList.toggle("is-visible", overdueEntries.length > 0);
      ctx.els.overdueCounter.textContent = overdueEntries.length ? `${overdueEntries.length} невыполнено` : "";

      overdueEntries.forEach((entry) => {
        const node = document.createElement("article");
        node.className = "overdue-item";
        const category = ctx.getCategory(entry.task.categoryId);
        const details = [
          ctx.formatLongDate(entry.dateKey),
          entry.task.time ? `до ${entry.task.time}` : "до конца дня",
          category?.name || "Без категории",
          ctx.priorityLabels[entry.task.priority] || "Средний",
        ];
        if (entry.task.repeat !== "none") details.push(ctx.formatTaskRepeat(entry.task));

        node.innerHTML = `
          <div>
            <h3>${ctx.escapeHtml(entry.task.title)}</h3>
            <p>${details.map((detail) => `<span>${ctx.escapeHtml(detail)}</span>`).join(" · ")}</p>
          </div>
          <div class="overdue-actions">
            <button class="ghost-button compact-button overdue-go" type="button">К дню</button>
            <button class="ghost-button compact-button overdue-today" type="button">Сегодня</button>
            <button class="primary-button compact-button overdue-done" type="button">Готово</button>
          </div>
        `;

        node.querySelector(".overdue-go").addEventListener("click", () => {
          ctx.openDate(entry.dateKey);
        });

        node.querySelector(".overdue-today").addEventListener("click", () => {
          ctx.postponeTask(entry.task, entry.dateKey, ctx.toDateKey(new Date()), { clearPastTimeToday: true });
        });

        node.querySelector(".overdue-done").addEventListener("click", () => {
          const undo = ctx.createUndoSnapshot();
          entry.task.completed[entry.dateKey] = true;
          ctx.saveState();
          ctx.render();
          ctx.showToast("Просроченная задача закрыта", { undo });
        });

        ctx.els.overdueList.appendChild(node);
      });
    }

    function renderExcludedTasks() {
      const activeDate = ctx.getActiveDate();
      const excludedTasks = ctx.excludedTasksForDate(activeDate);
      ctx.els.excludedList.replaceChildren();
      ctx.els.excludedPanel.classList.toggle("is-visible", excludedTasks.length > 0);

      excludedTasks.forEach((task) => {
        const node = document.createElement("article");
        node.className = "excluded-item";
        const details = ctx.taskDetails(task).filter((detail) => detail !== ctx.formatTaskRepeat(task));
        node.innerHTML = `
          <div>
            <h3>${ctx.escapeHtml(task.title)}</h3>
            <p>${ctx.escapeHtml(ctx.formatTaskRepeat(task) || "Повтор")} · ${ctx.escapeHtml(details.join(" · ") || "Без категории")}</p>
          </div>
          <button class="ghost-button compact-button restore-excluded" type="button">Вернуть в день</button>
        `;

        node.querySelector(".restore-excluded").addEventListener("click", () => {
          ctx.restoreTaskDate(task, activeDate);
        });

        ctx.els.excludedList.appendChild(node);
      });
    }

    return {
      createTaskNode,
      renderExcludedTasks,
      renderOverdueTasks,
      renderTasks,
    };
  }

  const api = { createTasksView };
  global.RhythmTasksView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
