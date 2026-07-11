(function (global) {
  function createGoalsView(ctx) {
    function renderGoals() {
      const goals = [...(ctx.getState().goals || [])];
      const todayKey = ctx.toDateKey(new Date());
      const stats = goalStats(goals, todayKey);
      const editingGoal = goals.find((goal) => goal.id === ctx.els.goalId.value);
      renderTaskPicker(editingGoal?.taskIds || []);

      ctx.els.goalActiveMetric.textContent = stats.active;
      ctx.els.goalOverdueMetric.textContent = stats.overdue;
      ctx.els.goalDoneMetric.textContent = stats.done;
      ctx.els.goalList.replaceChildren();
      ctx.els.goalEmpty.classList.toggle("is-visible", goals.length === 0);

      goals
        .sort((a, b) => goalSortRank(a, todayKey) - goalSortRank(b, todayKey) || a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title))
        .forEach((goal) => ctx.els.goalList.appendChild(createGoalNode(goal, todayKey)));
    }

    function createGoalNode(goal, todayKey = ctx.toDateKey(new Date())) {
      const item = document.createElement("article");
      const main = document.createElement("div");
      const head = document.createElement("div");
      const title = document.createElement("h3");
      const status = document.createElement("span");
      const meta = document.createElement("p");
      const linkedTasks = getLinkedTasks(goal);
      const progress = createGoalProgress(goalProgress(goal, linkedTasks, linkedTaskDone));
      const nextStep = createNextStep(goal);
      const details = createGoalDetails(goal);
      const actions = document.createElement("div");
      const state = goalState(goal, todayKey);

      item.className = `goal-item is-${state}`;
      item.dataset.goalId = goal.id;
      main.className = "goal-main";
      head.className = "goal-head";
      title.textContent = goal.title;
      status.className = "goal-status-pill";
      status.textContent = goalStatusLabel(goal, todayKey);
      meta.className = "goal-meta";
      meta.textContent = goalDueLabel(goal, todayKey);
      actions.className = "goal-actions";

      actions.append(
        createAction("Изменить", () => fillGoalForm(goal)),
        goal.status === "done"
          ? createAction("Вернуть", () => setGoalStatus(goal.id, "active"))
          : createAction("Готово", () => setGoalStatus(goal.id, "done")),
        createAction("Удалить", () => deleteGoal(goal.id), "danger"),
      );

      head.append(title, status);
      main.append(head, meta, progress);
      if (nextStep) main.appendChild(nextStep);
      main.appendChild(details);
      item.append(main, actions);
      return item;
    }

    function saveGoalFromForm(event) {
      event.preventDefault();
      const title = ctx.cleanText(ctx.els.goalTitle.value);
      const dueDate = ctx.normalizeDateKey(ctx.els.goalDueDate.value, "");
      if (!title) {
        ctx.showToast("Напиши название цели");
        ctx.els.goalTitle.focus();
        return;
      }
      if (!dueDate) {
        ctx.showToast("Выбери срок цели");
        ctx.els.goalDueDate.focus();
        return;
      }

      const undo = ctx.createUndoSnapshot();
      const id = ctx.els.goalId.value || ctx.createId();
      const existing = ctx.getState().goals.find((goal) => goal.id === id);
      const nextGoal = {
        id,
        title,
        description: "",
        measure: "",
        reality: "",
        why: "",
        dueDate,
        taskIds: selectedTaskIds(),
        steps: existing?.steps || [],
        status: existing?.status === "done" ? "done" : "active",
        completedAt: existing?.completedAt || "",
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      ctx.upsertGoal(nextGoal);
      ctx.saveState();
      resetGoalForm({ open: false });
      renderGoals();
      ctx.showToast(existing ? "Цель обновлена" : "Цель добавлена", { undo });
    }

    function fillGoalForm(goal) {
      ctx.els.goalId.value = goal.id;
      ctx.els.goalTitle.value = goal.title || "";
      ctx.els.goalDueDate.value = goal.dueDate || ctx.getActiveDate();
      if (ctx.els.goalDescription) ctx.els.goalDescription.value = "";
      if (ctx.els.goalMeasure) ctx.els.goalMeasure.value = "";
      if (ctx.els.goalReality) ctx.els.goalReality.value = "";
      if (ctx.els.goalWhy) ctx.els.goalWhy.value = "";
      ctx.els.goalSteps.value = (goal.steps || []).map((step) => step.title).join("\n");
      renderTaskPicker(goal.taskIds || []);
      ctx.els.goalFormHeading.textContent = "Редактировать цель";
      ctx.els.goalFormPanel.classList.remove("is-collapsed");
      ctx.els.goalTitle.focus();
    }

    function resetGoalForm(options = {}) {
      ctx.els.goalFormPanel.classList.toggle("is-collapsed", options.open === false);
      ctx.els.goalId.value = "";
      ctx.els.goalTitle.value = "";
      ctx.els.goalDueDate.value = ctx.getActiveDate();
      if (ctx.els.goalDescription) ctx.els.goalDescription.value = "";
      if (ctx.els.goalMeasure) ctx.els.goalMeasure.value = "";
      if (ctx.els.goalReality) ctx.els.goalReality.value = "";
      if (ctx.els.goalWhy) ctx.els.goalWhy.value = "";
      ctx.els.goalSteps.value = "";
      renderTaskPicker([]);
      ctx.els.goalFormHeading.textContent = "Новая цель";
    }

    function setGoalStatus(goalId, status) {
      const goal = ctx.getState().goals.find((item) => item.id === goalId);
      if (!goal) return;
      const undo = ctx.createUndoSnapshot();
      goal.status = status === "done" ? "done" : "active";
      goal.completedAt = goal.status === "done" ? new Date().toISOString() : "";
      ctx.saveState();
      renderGoals();
      ctx.showToast(goal.status === "done" ? "Цель закрыта" : "Цель снова активна", { undo });
    }

    function toggleGoalStep(goalId, stepId, done) {
      const goal = ctx.getState().goals.find((item) => item.id === goalId);
      const step = goal?.steps?.find((item) => item.id === stepId);
      if (!goal || !step) return;
      const undo = ctx.createUndoSnapshot();
      step.done = done;
      if (goal.steps.length && goal.steps.every((item) => item.done)) {
        goal.status = "done";
        goal.completedAt = goal.completedAt || new Date().toISOString();
      } else if (goal.status === "done") {
        goal.status = "active";
        goal.completedAt = "";
      }
      ctx.saveState();
      renderGoals();
      ctx.showToast(done ? "Шаг выполнен" : "Шаг снова активен", { undo });
    }

    function deleteGoal(goalId) {
      const goal = ctx.getState().goals.find((item) => item.id === goalId);
      if (!goal) return;
      const undo = ctx.createUndoSnapshot();
      ctx.deleteGoal(goalId);
      ctx.saveState();
      resetGoalForm({ open: false });
      renderGoals();
      ctx.showToast("Цель удалена", { undo });
    }

    function createAction(label, handler, tone = "") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = tone === "danger" ? "ghost-button compact-button danger-button" : "ghost-button compact-button";
      button.textContent = label;
      button.addEventListener("click", handler);
      return button;
    }

    function createGoalProgress(progressValue) {
      const progress = document.createElement("div");
      const head = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      const bar = document.createElement("div");
      const fill = document.createElement("span");

      progress.className = "goal-progress";
      head.className = "goal-progress-head";
      label.textContent = "Прогресс";
      value.textContent = `${progressValue}%`;
      bar.className = "goal-progress-bar";
      bar.setAttribute("aria-hidden", "true");
      fill.style.width = `${progressValue}%`;

      head.append(label, value);
      bar.appendChild(fill);
      progress.append(head, bar);
      return progress;
    }

    function createNextStep(goal) {
      const next = getLinkedTasks(goal).find((task) => !linkedTaskDone(task));
      if (!next) return null;
      const element = document.createElement("p");
      const label = document.createElement("span");
      element.className = "goal-next-step";
      label.textContent = "Следующий шаг";
      element.append(label, document.createTextNode(next.title));
      return element;
    }

    function createGoalDetails(goal) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      const body = document.createElement("div");
      const steps = document.createElement("div");

      details.className = "goal-details";
      summary.textContent = "Связанные задачи";
      body.className = "goal-details-body";

      const linkedTasks = getLinkedTasks(goal);
      if (linkedTasks.length) {
        steps.className = "goal-steps";
        steps.setAttribute("aria-label", "Связанные задачи");
        linkedTasks.forEach((task) => steps.appendChild(createTaskControl(goal, task)));
        body.appendChild(steps);
      } else {
        const empty = document.createElement("p");
        empty.className = "goal-description";
        empty.textContent = "Связанных задач пока нет.";
        body.appendChild(empty);
      }

      details.append(summary, body);
      return details;
    }

    function createTaskControl(goal, task) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      const text = document.createElement("span");
      label.className = "goal-step";
      checkbox.type = "checkbox";
      checkbox.checked = linkedTaskDone(task);
      checkbox.addEventListener("change", () => {
        const undo = ctx.createUndoSnapshot();
        ctx.toggleLinkedTask(task.id, checkbox.checked);
        ctx.saveState();
        ctx.render();
        ctx.showToast(checkbox.checked ? "Задача выполнена" : "Задача снова активна", { undo });
      });
      text.textContent = task.title;
      label.append(checkbox, text);
      return label;
    }

    function getLinkedTasks(goal) {
      const ids = new Set(goal.taskIds || []);
      return ctx.getState().tasks.filter((task) => ids.has(task.id));
    }

    function linkedTaskDone(task) {
      return ctx.isTaskDone(task, task.date || ctx.getActiveDate());
    }

    function selectedTaskIds() {
      return [...ctx.els.goalTaskPicker.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    }

    function renderTaskPicker(selectedIds = []) {
      const selected = new Set(selectedIds);
      const tasks = ctx.getState().tasks.filter((task) => task.repeat === "none");
      ctx.els.goalTaskPicker.replaceChildren();
      if (!tasks.length) {
        const empty = document.createElement("p");
        empty.className = "goal-task-picker-empty";
        empty.textContent = "Сначала создай обычную задачу.";
        ctx.els.goalTaskPicker.appendChild(empty);
        return;
      }
      tasks
        .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.title.localeCompare(b.title))
        .forEach((task) => {
          const label = document.createElement("label");
          const checkbox = document.createElement("input");
          const content = document.createElement("span");
          const title = document.createElement("strong");
          const date = document.createElement("small");
          label.className = "goal-task-option";
          checkbox.type = "checkbox";
          checkbox.value = task.id;
          checkbox.checked = selected.has(task.id);
          title.textContent = task.title;
          date.textContent = task.date || "Без даты";
          content.append(title, date);
          label.append(checkbox, content);
          ctx.els.goalTaskPicker.appendChild(label);
        });
    }

    return {
      createGoalNode,
      fillGoalForm,
      renderGoals,
      resetGoalForm,
      saveGoalFromForm,
    };
  }

  function goalStats(goals, todayKey) {
    return goals.reduce(
      (stats, goal) => {
        const state = goalState(goal, todayKey);
        if (state === "done") stats.done += 1;
        else if (state === "overdue") stats.overdue += 1;
        else stats.active += 1;
        return stats;
      },
      { active: 0, done: 0, overdue: 0 },
    );
  }

  function goalProgress(goal, linkedTasks = [], isDone = (task) => task.done === true) {
    if (goal.status === "done") return 100;
    if (linkedTasks.length) return Math.round((linkedTasks.filter(isDone).length / linkedTasks.length) * 100);
    const steps = Array.isArray(goal.steps) ? goal.steps : [];
    if (!steps.length) return 0;
    return Math.round((steps.filter((step) => step.done).length / steps.length) * 100);
  }

  function goalState(goal, todayKey) {
    if (goal.status === "done") return "done";
    if (goal.dueDate < todayKey) return "overdue";
    return "active";
  }

  function goalSortRank(goal, todayKey) {
    return { overdue: 0, active: 1, done: 2 }[goalState(goal, todayKey)] ?? 1;
  }

  function goalStatusLabel(goal, todayKey) {
    const state = goalState(goal, todayKey);
    if (state === "done") return "Готово";
    if (state === "overdue") return "Просрочено";
    return "Активна";
  }

  function goalDueLabel(goal, todayKey) {
    if (!goal.dueDate) return "Без срока";
    const diff = diffDays(todayKey, goal.dueDate);
    if (goal.status === "done") return `закрыта · срок был до ${goal.dueDate}`;
    if (diff === 0) return "срок сегодня";
    if (diff === 1) return "срок завтра";
    if (diff > 1) return `осталось ${diff} дн. · до ${goal.dueDate}`;
    return `просрочено на ${Math.abs(diff)} дн. · до ${goal.dueDate}`;
  }

  function diffDays(fromKey, toKey) {
    const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number);
    const [toYear, toMonth, toDay] = toKey.split("-").map(Number);
    const fromDate = Date.UTC(fromYear, fromMonth - 1, fromDay);
    const toDate = Date.UTC(toYear, toMonth - 1, toDay);
    return Math.round((toDate - fromDate) / 86400000);
  }

  function parseGoalSteps(value, existingSteps = []) {
    const existingByTitle = new Map(existingSteps.map((step) => [String(step.title || "").toLowerCase(), step]));
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .map((title, index) => {
        const existing = existingByTitle.get(title.toLowerCase()) || existingSteps[index];
        return {
          id: existing?.id || `goal-step-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
          title,
          done: existing?.title === title ? existing.done === true : false,
        };
      });
  }

  const api = { createGoalsView, goalProgress, goalStats, goalState, parseGoalSteps };
  global.RhythmGoalsView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
