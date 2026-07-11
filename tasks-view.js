(function (global) {
  function createTasksView(ctx) {
    let draggedTaskId = null;
    let draggedTaskDate = "";
    let overdueVisibleCount = 20;

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
      renderTaskMeta(meta, task);

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
        deleteTaskWithScope(task, activeDate);
      });

      return node;
    }

    function renderTaskMeta(meta, task) {
      meta.replaceChildren();
      ctx.taskMetaItems(task).forEach((item) => {
        const chip = document.createElement("span");
        chip.className = item.type === "category" ? "task-meta-chip task-category-chip" : "task-meta-chip";
        if (item.type === "empty") chip.classList.add("is-empty");
        if (item.categoryColor) {
          const dot = document.createElement("span");
          chip.style.setProperty("--category-color", item.categoryColor);
          dot.className = "task-meta-dot";
          chip.appendChild(dot);
        }
        chip.append(document.createTextNode(item.label));
        meta.appendChild(chip);
      });
    }

    function renderOverdueTasks() {
      const overdueEntries = ctx.overdueTaskEntries();
      const visibleEntries = overdueEntries.slice(0, overdueVisibleCount);
      ctx.els.overdueList.replaceChildren();
      ctx.els.overduePanel.classList.toggle("is-visible", overdueEntries.length > 0);
      ctx.els.overdueCounter.textContent = overdueEntries.length
        ? `${overdueEntries.length} невыполнено${visibleEntries.length < overdueEntries.length ? ` · показано ${visibleEntries.length}` : ""}`
        : "";

      visibleEntries.forEach((entry) => {
        const node = document.createElement("article");
        node.className = "overdue-item";
        const category = ctx.getCategory(entry.task.categoryId);
        const details = [
          ctx.formatLongDate(entry.dateKey),
          entry.task.time ? `до ${ctx.formatTime(entry.task.time)}` : "до конца дня",
          category?.name || "Без категории",
          ctx.priorityLabels[entry.task.priority] || "Средний",
        ];
        if (entry.task.repeat !== "none") details.push(ctx.formatTaskRepeat(entry.task));

        const content = document.createElement("div");
        const title = document.createElement("h3");
        const meta = document.createElement("p");
        const actions = document.createElement("div");
        const more = document.createElement("details");
        const moreSummary = document.createElement("summary");
        const moreMenu = document.createElement("div");
        const deleteButton = createButton(
          "ghost-button compact-button overdue-delete",
          entry.task.repeat === "none" ? "Удалить" : "Только этот день",
        );
        const deleteFutureButton = entry.task.repeat === "none"
          ? null
          : createButton("ghost-button compact-button overdue-delete-future", "Этот и последующие");
        const goButton = createButton("ghost-button compact-button overdue-go", "К дню");
        const todayButton = createButton("ghost-button compact-button overdue-today", "Сегодня");
        const doneButton = createButton("primary-button compact-button overdue-done", "Готово");

        title.textContent = entry.task.title;
        appendDetails(meta, details);
        content.append(title, meta);
        actions.className = "overdue-actions";
        more.className = "overdue-more";
        moreSummary.className = "overdue-more-trigger";
        moreSummary.setAttribute("aria-label", "Еще действия");
        moreSummary.textContent = "...";
        moreMenu.className = "overdue-more-menu";
        moreMenu.append(goButton, deleteButton);
        if (deleteFutureButton) moreMenu.appendChild(deleteFutureButton);
        more.append(moreSummary, moreMenu);
        actions.append(todayButton, doneButton, more);
        node.append(content, actions);

        goButton.addEventListener("click", () => {
          more.open = false;
          ctx.openDate(entry.dateKey);
        });

        todayButton.addEventListener("click", () => {
          ctx.postponeTask(entry.task, entry.dateKey, ctx.toDateKey(new Date()), { clearPastTimeToday: true });
        });

        doneButton.addEventListener("click", () => {
          const undo = ctx.createUndoSnapshot();
          entry.task.completed[entry.dateKey] = true;
          ctx.saveState();
          ctx.render();
          ctx.showToast("Просроченная задача закрыта", { undo });
        });

        deleteButton.addEventListener("click", () => {
          more.open = false;
          if (entry.task.repeat !== "none") {
            ctx.excludeTaskDate(entry.task, entry.dateKey);
            return;
          }
          deleteTaskWithScope(entry.task, entry.dateKey);
        });

        deleteFutureButton?.addEventListener("click", () => {
          more.open = false;
          ctx.stopTaskSeries(entry.task, entry.dateKey);
        });

        ctx.els.overdueList.appendChild(node);
      });

      if (visibleEntries.length < overdueEntries.length) {
        const loadMore = createButton("ghost-button compact-button overdue-load-more", `Показать еще (${overdueEntries.length - visibleEntries.length})`);
        loadMore.addEventListener("click", () => {
          overdueVisibleCount += 20;
          renderOverdueTasks();
        });
        ctx.els.overdueList.appendChild(loadMore);
      }
    }

    async function deleteTaskWithScope(task, dateKey) {
      if (task.repeat === "none") {
        const undo = ctx.createUndoSnapshot();
        ctx.deleteTask(task.id);
        ctx.saveState();
        ctx.render();
        ctx.showToast("Задача удалена", { undo });
        return;
      }

      if (!ctx.confirmAction) {
        ctx.excludeTaskDate(task, dateKey);
        return;
      }

      const scope = await ctx.confirmAction({
        title: "Удалить повторяющуюся задачу?",
        message: `Выбери, убрать только ${ctx.formatLongDate(dateKey)} или завершить серию с этого дня. Прошлая история сохранится.`,
        secondaryLabel: "Только этот день",
        confirmLabel: "Этот и будущие",
        tone: "danger",
      });
      if (scope === "secondary") {
        ctx.excludeTaskDate(task, dateKey);
      } else if (scope === true) {
        ctx.stopTaskSeries(task, dateKey);
      }
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
        const content = document.createElement("div");
        const title = document.createElement("h3");
        const meta = document.createElement("p");
        const restoreButton = createButton("ghost-button compact-button restore-excluded", "Вернуть в день");

        title.textContent = task.title;
        appendDetails(meta, [ctx.formatTaskRepeat(task) || "Повтор", details.join(" · ") || "Без категории"]);
        content.append(title, meta);
        node.append(content, restoreButton);

        restoreButton.addEventListener("click", () => {
          ctx.restoreTaskDate(task, activeDate);
        });

        ctx.els.excludedList.appendChild(node);
      });
    }

    function createButton(className, label) {
      const button = document.createElement("button");
      button.className = className;
      button.type = "button";
      button.textContent = label;
      return button;
    }

    function appendDetails(node, details) {
      details.forEach((detail, index) => {
        if (index > 0) node.append(document.createTextNode(" · "));
        const part = document.createElement("span");
        part.textContent = detail;
        node.appendChild(part);
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
