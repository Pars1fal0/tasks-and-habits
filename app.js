const STORAGE_KEY = "rhythm-day-state-v1";
const UI_STATE_KEY = "rhythm-day-ui-v1";
const SCHEMA_VERSION = 4;
const VALID_PRIORITIES = ["high", "medium", "low"];
const VALID_REPEATS = ["none", "daily", "every2days", "every3days", "weekdays", "weekends", "weekly", "monthly", "yearly"];
const VALID_HABIT_REPEATS = ["daily", "every2days", "every3days", "weekdays", "weekends", "weekly"];

let state = normalizeState(loadStoredState());
let activeDate = toDateKey(new Date());
let activeView = "tasks";
let taskFilter = "all";
let taskCategoryFilter = loadUiState().taskCategoryFilter || "all";
let draggedTaskId = null;
let toastTimer = null;

const els = {
  activeDate: document.querySelector("#activeDate"),
  archiveEmpty: document.querySelector("#archiveEmpty"),
  archiveList: document.querySelector("#archiveList"),
  categoryColor: document.querySelector("#categoryColor"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryList: document.querySelector("#categoryList"),
  categoryName: document.querySelector("#categoryName"),
  clearArchiveFilter: document.querySelector("#clearArchiveFilter"),
  desktopStatus: document.querySelector("#desktopStatus"),
  exportButton: document.querySelector("#exportButton"),
  focusBar: document.querySelector("#focusBar"),
  focusMeta: document.querySelector("#focusMeta"),
  focusPercent: document.querySelector("#focusPercent"),
  focusTitle: document.querySelector("#focusTitle"),
  habitDoneMetric: document.querySelector("#habitDoneMetric"),
  habitEmpty: document.querySelector("#habitEmpty"),
  habitForm: document.querySelector("#habitForm"),
  habitFormPanel: document.querySelector("#habitFormPanel"),
  habitGoal: document.querySelector("#habitGoal"),
  habitId: document.querySelector("#habitId"),
  habitList: document.querySelector("#habitList"),
  habitRepeat: document.querySelector("#habitRepeat"),
  habitTemplate: document.querySelector("#habitTemplate"),
  habitTitle: document.querySelector("#habitTitle"),
  habitType: document.querySelector("#habitType"),
  habitUnit: document.querySelector("#habitUnit"),
  heatmapGrid: document.querySelector("#heatmapGrid"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  navTabs: document.querySelectorAll(".nav-tab"),
  nextDay: document.querySelector("#nextDay"),
  notifyButton: document.querySelector("#notifyButton"),
  openHabitForm: document.querySelector("#openHabitForm"),
  openTaskForm: document.querySelector("#openTaskForm"),
  pageTitle: document.querySelector("#pageTitle"),
  prevDay: document.querySelector("#prevDay"),
  resetHabitForm: document.querySelector("#resetHabitForm"),
  resetTaskForm: document.querySelector("#resetTaskForm"),
  sideProgressBar: document.querySelector("#sideProgressBar"),
  sideProgressValue: document.querySelector("#sideProgressValue"),
  taskCategoryId: document.querySelector("#taskCategoryId"),
  taskCategoryFilter: document.querySelector("#taskCategoryFilter"),
  taskCounter: document.querySelector("#taskCounter"),
  taskDate: document.querySelector("#taskDate"),
  taskEmpty: document.querySelector("#taskEmpty"),
  taskForm: document.querySelector("#taskForm"),
  taskFormPanel: document.querySelector("#taskFormPanel"),
  taskId: document.querySelector("#taskId"),
  taskList: document.querySelector("#taskList"),
  taskPriority: document.querySelector("#taskPriority"),
  taskProgress: document.querySelector("#taskProgress"),
  taskProgressRing: document.querySelector("#taskProgressRing"),
  taskReminder: document.querySelector("#taskReminder"),
  taskRepeat: document.querySelector("#taskRepeat"),
  taskTemplate: document.querySelector("#taskTemplate"),
  taskTime: document.querySelector("#taskTime"),
  taskTitle: document.querySelector("#taskTitle"),
  todayDoneMetric: document.querySelector("#todayDoneMetric"),
  todayLabel: document.querySelector("#todayLabel"),
  todayOpenMetric: document.querySelector("#todayOpenMetric"),
  toast: document.querySelector("#appToast"),
  views: {
    archive: document.querySelector("#archiveView"),
    habits: document.querySelector("#habitsView"),
    overview: document.querySelector("#overviewView"),
    tasks: document.querySelector("#tasksView"),
  },
  weekStrip: document.querySelector("#weekStrip"),
  weeklyHabitMetric: document.querySelector("#weeklyHabitMetric"),
  weeklyHabitText: document.querySelector("#weeklyHabitText"),
  weeklyTaskMetric: document.querySelector("#weeklyTaskMetric"),
  weeklyTaskText: document.querySelector("#weeklyTaskText"),
};

const priorityLabels = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const repeatLabels = {
  none: "Без повтора",
  daily: "Каждый день",
  every2days: "Каждые 2 дня",
  every3days: "Каждые 3 дня",
  weekdays: "Будни",
  weekends: "Выходные",
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
  yearly: "Ежегодно",
};

seedIfEmpty();
init();

function init() {
  els.activeDate.value = activeDate;
  bindEvents();
  resetTaskForm();
  resetHabitForm();
  registerServiceWorker();
  updateNotificationButton();
  render();
  syncDesktopReminders();
  setInterval(checkDueNotifications, 30000);
  setInterval(syncDesktopReminders, 60000);
}

function bindEvents() {
  els.activeDate.addEventListener("change", () => {
    activeDate = els.activeDate.value || toDateKey(new Date());
    resetTaskForm();
    render();
  });

  els.prevDay.addEventListener("click", () => shiftDate(-1));
  els.nextDay.addEventListener("click", () => shiftDate(1));

  els.navTabs.forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      render();
    });
  });

  els.taskCategoryFilter.addEventListener("change", () => {
    taskCategoryFilter = els.taskCategoryFilter.value || "all";
    saveUiState();
    renderTasks();
  });

  document.querySelectorAll("[data-task-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      taskFilter = button.dataset.taskFilter;
      document.querySelectorAll("[data-task-filter]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      renderTasks();
    });
  });

  document.querySelector("#closeTaskForm").addEventListener("click", () => {
    els.taskFormPanel.classList.add("is-collapsed");
  });
  els.openTaskForm.addEventListener("click", () => {
    resetTaskForm();
    els.taskTitle.focus();
  });
  els.resetTaskForm.addEventListener("click", resetTaskForm);
  els.taskForm.addEventListener("submit", saveTaskFromForm);
  els.taskTime.addEventListener("input", syncTaskTimePresets);
  document.querySelectorAll("[data-time-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      els.taskTime.value = button.dataset.timePreset || "";
      syncTaskTimePresets();
      els.taskTime.focus();
    });
  });

  document.querySelector("#closeHabitForm").addEventListener("click", () => {
    els.habitFormPanel.classList.add("is-collapsed");
  });
  els.openHabitForm.addEventListener("click", () => {
    resetHabitForm();
    els.habitTitle.focus();
  });
  els.resetHabitForm.addEventListener("click", resetHabitForm);
  els.habitForm.addEventListener("submit", saveHabitFromForm);

  els.categoryForm.addEventListener("submit", saveCategoryFromForm);
  els.notifyButton.addEventListener("click", requestNotifications);
  els.exportButton.addEventListener("click", exportData);
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importData);
  els.clearArchiveFilter.addEventListener("click", renderArchive);
}

function render() {
  els.activeDate.value = activeDate;
  els.todayLabel.textContent = formatLongDate(activeDate);
  els.pageTitle.textContent = {
    archive: "Архив",
    habits: "Привычки",
    overview: "Обзор",
    tasks: "Задачи на день",
  }[activeView];
  document.body.dataset.view = activeView;
  syncTaskTimePresets();

  els.navTabs.forEach((button) => {
    const isActive = button.dataset.view === activeView;
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  Object.entries(els.views).forEach(([view, element]) => {
    element.classList.toggle("is-active", view === activeView);
  });

  renderCategories();
  renderDailyPulse();
  renderTasks();
  renderHabits();
  renderOverview();
  renderArchive();
}

function renderDailyPulse() {
  const tasks = getOrderedTasksForDate(activeDate);
  const doneTasks = tasks.filter((task) => isTaskDone(task, activeDate));
  const openTasks = tasks.filter((task) => !isTaskDone(task, activeDate));
  const taskPercent = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const habits = habitsForDate(activeDate);
  const doneHabits = habits.filter((habit) => isHabitComplete(habit, activeDate)).length;
  const habitPercent = habits.length ? Math.round((doneHabits / habits.length) * 100) : 0;
  const pulseParts = [];
  if (tasks.length) pulseParts.push(taskPercent);
  if (habits.length) pulseParts.push(habitPercent);
  const pulse = pulseParts.length
    ? Math.round(pulseParts.reduce((sum, item) => sum + item, 0) / pulseParts.length)
    : 0;
  const nextTask = openTasks[0];

  els.focusTitle.textContent = nextTask
    ? nextTask.title
    : tasks.length
      ? "План закрыт"
      : "Свободный слот";
  els.focusMeta.textContent = nextTask
    ? taskDetails(nextTask).join(" · ") || "Без категории"
    : tasks.length
      ? "Все задачи на выбранный день выполнены"
      : "Можно добавить задачу или оставить день без перегруза";
  els.focusPercent.textContent = `${taskPercent}%`;
  els.focusBar.style.width = `${taskPercent}%`;
  els.todayOpenMetric.textContent = openTasks.length;
  els.todayDoneMetric.textContent = doneTasks.length;
  els.habitDoneMetric.textContent = `${doneHabits}/${habits.length}`;
  els.sideProgressValue.textContent = `${pulse}%`;
  els.sideProgressBar.style.width = `${pulse}%`;
}

function renderTasks() {
  const tasks = getOrderedTasksForDate(activeDate);
  const visibleTasks = tasks.filter((task) => {
    const done = isTaskDone(task, activeDate);
    const matchesCategory = taskCategoryFilter === "all" ? true : (task.categoryId || "none") === taskCategoryFilter;
    if (!matchesCategory) return false;
    if (taskFilter === "open") return !done;
    if (taskFilter === "done") return done;
    return true;
  });

  els.taskList.replaceChildren();
  visibleTasks.forEach((task) => els.taskList.appendChild(createTaskNode(task)));

  const doneCount = tasks.filter((task) => isTaskDone(task, activeDate)).length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  els.taskEmpty.textContent =
    taskCategoryFilter === "all" ? "На выбранный день задач нет." : "В этой категории на выбранный день задач нет.";
  els.taskEmpty.classList.toggle("is-visible", visibleTasks.length === 0);
  els.taskCounter.textContent = `${doneCount} из ${tasks.length} выполнено`;
  els.taskProgress.textContent = `${percent}%`;
  els.taskProgressRing.style.setProperty("--progress", `${percent * 3.6}deg`);
}

function createTaskNode(task) {
  const node = els.taskTemplate.content.firstElementChild.cloneNode(true);
  const done = isTaskDone(task, activeDate);
  const category = getCategory(task.categoryId);
  const title = node.querySelector("h3");
  const check = node.querySelector(".check-button");
  const meta = node.querySelector(".task-meta");
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
  priority.textContent = priorityLabels[task.priority] || "Средний";
  priority.classList.add(`priority-${task.priority || "medium"}`);
  meta.innerHTML = taskMetaMarkup(task);

  node.addEventListener("dragstart", (event) => {
    draggedTaskId = task.id;
    node.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  });
  node.addEventListener("dragend", () => {
    draggedTaskId = null;
    node.classList.remove("is-dragging");
    document.querySelectorAll(".task-item.is-drop-target").forEach((item) => {
      item.classList.remove("is-drop-target");
    });
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
      reorderTask(activeDate, sourceId, task.id);
      saveState();
      render();
    }
  });

  check.addEventListener("click", () => {
    task.completed[activeDate] = !done;
    saveState();
    render();
  });

  node.querySelector(".edit-task").addEventListener("click", () => fillTaskForm(task));
  node.querySelector(".delete-task").addEventListener("click", () => {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    Object.keys(state.taskOrder).forEach((dateKey) => {
      state.taskOrder[dateKey] = state.taskOrder[dateKey].filter((id) => id !== task.id);
    });
    saveState();
    render();
  });

  return node;
}

function renderHabits() {
  const habits = habitsForDate(activeDate);
  els.habitList.replaceChildren();
  habits.forEach((habit) => els.habitList.appendChild(createHabitNode(habit)));
  els.habitEmpty.textContent = state.habits.length ? "На выбранный день привычек по расписанию нет." : "Добавь первую привычку.";
  els.habitEmpty.classList.toggle("is-visible", habits.length === 0);
}

function createHabitNode(habit) {
  const node = els.habitTemplate.content.firstElementChild.cloneNode(true);
  const title = node.querySelector("h3");
  const streak = node.querySelector(".habit-streak");
  const control = node.querySelector(".habit-control");

  title.textContent = habit.title;
  streak.textContent = `Серия: ${habitStreak(habit, activeDate)} дн.`;

  if (habit.type === "number") {
    const current = Number(habit.logs[activeDate] || 0);
    const goal = Number(habit.goal || 1);
    const percent = Math.min(100, Math.round((current / goal) * 100));

    control.innerHTML = `
      <div class="habit-number-row">
        <input type="number" min="0" step="1" value="${current}" aria-label="${escapeHtml(habit.title)}">
        <span>${current} / ${goal} ${escapeHtml(habit.unit || "")}</span>
      </div>
      <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width: ${percent}%"></div></div>
    `;

    control.querySelector("input").addEventListener("input", (event) => {
      habit.logs[activeDate] = Math.max(0, Number(event.target.value || 0));
      saveState();
      renderDailyPulse();
      renderOverview();
      node.querySelector(".habit-streak").textContent = `Серия: ${habitStreak(habit, activeDate)} дн.`;
      const nextPercent = Math.min(100, Math.round((Number(habit.logs[activeDate]) / goal) * 100));
      control.querySelector(".progress-fill").style.width = `${nextPercent}%`;
      control.querySelector("span").textContent = `${habit.logs[activeDate]} / ${goal} ${habit.unit || ""}`;
    });
  } else {
    const done = habit.logs[activeDate] === true;
    const row = document.createElement("div");
    row.className = "habit-check-row";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `check-button${done ? " is-checked" : ""}`;
    button.setAttribute("aria-label", `Отметить ${habit.title}`);

    const label = document.createElement("span");
    label.textContent = done ? "Выполнено" : "Не отмечено";

    button.addEventListener("click", () => {
      habit.logs[activeDate] = !done;
      saveState();
      render();
    });

    row.append(button, label);
    control.append(row);
  }

  node.querySelector(".edit-habit").addEventListener("click", () => fillHabitForm(habit));
  node.querySelector(".delete-habit").addEventListener("click", () => {
    state.habits = state.habits.filter((item) => item.id !== habit.id);
    saveState();
    render();
  });

  return node;
}

function renderOverview() {
  const week = getWeekDates(activeDate);
  let taskDone = 0;
  let taskTotal = 0;
  let habitDone = 0;
  let habitTotal = 0;

  els.weekStrip.replaceChildren();

  week.forEach((dateKey) => {
    const stats = statsForDate(dateKey);
    taskDone += stats.taskDone;
    taskTotal += stats.taskTotal;
    habitDone += stats.habitDone;
    habitTotal += stats.habitTotal;

    const dayCell = document.createElement("article");
    dayCell.className = "day-cell";
    dayCell.innerHTML = `
      <span class="day-name">${formatWeekday(dateKey)}</span>
      <strong class="day-score">${Math.round((stats.taskPercent + stats.habitPercent) / 2)}%</strong>
      <div class="day-bars">
        <div class="mini-bar"><span style="width: ${stats.taskPercent}%"></span></div>
        <div class="mini-bar habit"><span style="width: ${stats.habitPercent}%"></span></div>
      </div>
    `;
    els.weekStrip.appendChild(dayCell);
  });

  const taskMetric = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;
  const habitMetric = habitTotal ? Math.round((habitDone / habitTotal) * 100) : 0;

  els.weeklyTaskMetric.textContent = `${taskMetric}%`;
  els.weeklyHabitMetric.textContent = `${habitMetric}%`;
  els.weeklyTaskText.textContent = `${taskDone} из ${taskTotal} задач за неделю`;
  els.weeklyHabitText.textContent = `${habitDone} из ${habitTotal} отметок привычек`;
  renderHeatmap();
}

function renderHeatmap() {
  const end = parseDate(activeDate);
  const start = new Date(end);
  start.setDate(end.getDate() - 69);
  els.heatmapGrid.replaceChildren();

  for (let i = 0; i < 70; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const dateKey = toDateKey(current);
    const stats = statsForDate(dateKey);
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.style.setProperty("--task-alpha", heatAlpha(stats.taskPercent));
    cell.style.setProperty("--habit-alpha", heatAlpha(stats.habitPercent));
    cell.title = `${formatLongDate(dateKey)}: задачи ${stats.taskPercent}%, привычки ${stats.habitPercent}%`;
    cell.setAttribute("aria-label", cell.title);
    if (dateKey === activeDate) cell.classList.add("is-current");
    els.heatmapGrid.appendChild(cell);
  }
}

function renderArchive() {
  const entries = archiveEntries();
  els.archiveList.replaceChildren();
  entries.forEach((entry) => els.archiveList.appendChild(createArchiveNode(entry)));
  els.archiveEmpty.classList.toggle("is-visible", entries.length === 0);
}

function createArchiveNode(entry) {
  const node = document.createElement("article");
  node.className = "archive-item";

  const category = getCategory(entry.task.categoryId);
  const categoryHtml = category
    ? `<span class="category-dot" style="--category-color: ${escapeHtml(category.color)}"></span>${escapeHtml(category.name)}`
    : "Без категории";

  node.innerHTML = `
    <div>
      <h3>${escapeHtml(entry.task.title)}</h3>
      <p>${formatLongDate(entry.dateKey)} · ${categoryHtml} · ${priorityLabels[entry.task.priority] || "Средний"}</p>
    </div>
    <button class="ghost-button restore-task" type="button">Вернуть</button>
  `;

  node.querySelector(".restore-task").addEventListener("click", () => {
    entry.task.completed[entry.dateKey] = false;
    saveState();
    render();
    showToast("Задача возвращена в план");
  });

  return node;
}

function renderCategories() {
  els.taskCategoryId.replaceChildren();
  els.taskCategoryFilter.replaceChildren();

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Без категории";
  els.taskCategoryId.appendChild(emptyOption);

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Все категории";
  els.taskCategoryFilter.appendChild(allOption);

  const uncategorizedOption = document.createElement("option");
  uncategorizedOption.value = "none";
  uncategorizedOption.textContent = "Без категории";
  els.taskCategoryFilter.appendChild(uncategorizedOption);

  const categories = [...state.categories].sort((a, b) => a.name.localeCompare(b.name, "ru"));

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    els.taskCategoryId.appendChild(option);

    const filterOption = document.createElement("option");
    filterOption.value = category.id;
    filterOption.textContent = category.name;
    els.taskCategoryFilter.appendChild(filterOption);
  });

  const filterExists = taskCategoryFilter === "all" || taskCategoryFilter === "none" || categories.some((category) => category.id === taskCategoryFilter);
  if (!filterExists) {
    taskCategoryFilter = "all";
    saveUiState();
  }
  els.taskCategoryFilter.value = taskCategoryFilter;

  els.categoryList.replaceChildren();
  categories.forEach((category) => {
    const item = document.createElement("div");
    item.className = "category-item";
    item.innerHTML = `
      <span class="category-dot" style="--category-color: ${escapeHtml(category.color)}"></span>
      <span>${escapeHtml(category.name)}</span>
      <button class="icon-button subtle" type="button" aria-label="Удалить категорию">
        <svg class="ui-icon"><use href="#icon-trash"></use></svg>
      </button>
    `;
    item.querySelector("button").addEventListener("click", () => deleteCategory(category.id));
    els.categoryList.appendChild(item);
  });
}

function saveTaskFromForm(event) {
  event.preventDefault();
  const id = els.taskId.value || createId();
  const existing = state.tasks.find((task) => task.id === id);
  const task = {
    id,
    title: cleanText(els.taskTitle.value),
    date: els.taskDate.value || activeDate,
    time: cleanTimeValue(els.taskTime.value),
    categoryId: els.taskCategoryId.value,
    priority: els.taskPriority.value,
    repeat: els.taskRepeat.value,
    reminderOffset: els.taskReminder.value,
    completed: existing?.completed || {},
    notified: existing?.notified || {},
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, task);
  } else {
    state.tasks.push(task);
  }

  activeDate = task.date;
  saveState();
  resetTaskForm();
  render();
}

function fillTaskForm(task) {
  els.taskFormPanel.classList.remove("is-collapsed");
  els.taskId.value = task.id;
  els.taskTitle.value = task.title;
  els.taskDate.value = task.date;
  els.taskTime.value = cleanTimeValue(task.time);
  els.taskCategoryId.value = task.categoryId || "";
  els.taskPriority.value = task.priority || "medium";
  els.taskRepeat.value = task.repeat || "none";
  els.taskReminder.value = task.reminderOffset ?? (task.time ? "15" : "none");
  syncTaskTimePresets();
  els.taskTitle.focus();
}

function resetTaskForm() {
  els.taskFormPanel.classList.remove("is-collapsed");
  els.taskForm.reset();
  els.taskId.value = "";
  els.taskDate.value = activeDate;
  els.taskTime.value = "";
  els.taskCategoryId.value = "";
  els.taskPriority.value = "medium";
  els.taskRepeat.value = "none";
  els.taskReminder.value = "15";
  syncTaskTimePresets();
}

function saveHabitFromForm(event) {
  event.preventDefault();
  const id = els.habitId.value || createId();
  const existing = state.habits.find((habit) => habit.id === id);
  const type = els.habitType.value;
  const habit = {
    id,
    title: cleanText(els.habitTitle.value),
    type,
    repeat: normalizeHabitRepeat(els.habitRepeat.value),
    startDate: existing?.startDate || activeDate,
    unit: cleanText(els.habitUnit.value),
    goal: type === "number" ? Math.max(1, Number(els.habitGoal.value || 1)) : 1,
    logs: existing?.logs || {},
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, habit);
  } else {
    state.habits.push(habit);
  }

  saveState();
  resetHabitForm();
  render();
}

function fillHabitForm(habit) {
  els.habitFormPanel.classList.remove("is-collapsed");
  els.habitId.value = habit.id;
  els.habitTitle.value = habit.title;
  els.habitType.value = habit.type;
  els.habitRepeat.value = normalizeHabitRepeat(habit.repeat);
  els.habitUnit.value = habit.unit || "";
  els.habitGoal.value = habit.goal || "";
  els.habitTitle.focus();
}

function resetHabitForm() {
  els.habitFormPanel.classList.remove("is-collapsed");
  els.habitForm.reset();
  els.habitId.value = "";
  els.habitType.value = "check";
  els.habitRepeat.value = "daily";
}

function saveCategoryFromForm(event) {
  event.preventDefault();
  const name = cleanText(els.categoryName.value);
  if (!name) return;
  const existing = state.categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    showToast("Такая категория уже есть");
    return;
  }

  state.categories.push({
    id: createId(),
    name,
    color: els.categoryColor.value || "#00a78e",
    createdAt: new Date().toISOString(),
  });
  els.categoryForm.reset();
  els.categoryColor.value = "#00a78e";
  saveState();
  renderCategories();
  showToast("Категория создана");
}

function deleteCategory(categoryId) {
  const hasTasks = state.tasks.some((task) => task.categoryId === categoryId);
  state.categories = state.categories.filter((category) => category.id !== categoryId);
  if (hasTasks) {
    state.tasks.forEach((task) => {
      if (task.categoryId === categoryId) task.categoryId = "";
    });
  }
  if (taskCategoryFilter === categoryId) taskCategoryFilter = "all";
  saveState();
  saveUiState();
  render();
}

function exportData() {
  const payload = {
    app: "Ритм дня",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ritm-dnya-${toDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Экспорт готов");
}

async function importData() {
  const file = els.importFile.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedState = normalizeState(parsed.state || parsed);
    replaceState(importedState);
    saveState();
    render();
    showToast("Данные импортированы");
  } catch {
    showToast("Не удалось импортировать JSON");
  } finally {
    els.importFile.value = "";
  }
}

function tasksForDate(dateKey) {
  return state.tasks.filter((task) => taskOccursOn(task, dateKey));
}

function getOrderedTasksForDate(dateKey) {
  const tasks = tasksForDate(dateKey);
  const order = state.taskOrder[dateKey] || [];
  const orderMap = new Map(order.map((id, index) => [id, index]));

  return tasks.sort((a, b) => {
    return sortTasks(a, b, orderMap);
  });
}

function reorderTask(dateKey, sourceId, targetId) {
  const order = getOrderedTasksForDate(dateKey).map((task) => task.id);
  const from = order.indexOf(sourceId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0) return;
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  state.taskOrder[dateKey] = order;
}

function taskOccursOn(task, dateKey) {
  if (task.repeat === "none") return task.date === dateKey;
  const date = parseDate(dateKey);
  const start = parseDate(task.date);
  if (date < start) return false;

  const diff = Math.floor((date - start) / 86400000);
  if (task.repeat === "daily") return true;
  if (task.repeat === "every2days") return diff % 2 === 0;
  if (task.repeat === "every3days") return diff % 3 === 0;
  if (task.repeat === "weekdays") {
    const day = date.getDay();
    return day !== 0 && day !== 6;
  }
  if (task.repeat === "weekends") {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
  if (task.repeat === "weekly") return date.getDay() === start.getDay();
  if (task.repeat === "monthly") return date.getDate() === start.getDate();
  if (task.repeat === "yearly") {
    return date.getDate() === start.getDate() && date.getMonth() === start.getMonth();
  }
  return false;
}

function habitsForDate(dateKey) {
  return state.habits.filter((habit) => habitOccursOn(habit, dateKey));
}

function habitOccursOn(habit, dateKey) {
  const repeat = normalizeHabitRepeat(habit.repeat);
  const date = parseDate(dateKey);
  const start = parseDate(habit.startDate || activeDate);
  if (date < start) return false;

  const diff = Math.floor((date - start) / 86400000);
  if (repeat === "daily") return true;
  if (repeat === "every2days") return diff % 2 === 0;
  if (repeat === "every3days") return diff % 3 === 0;
  if (repeat === "weekdays") {
    const day = date.getDay();
    return day !== 0 && day !== 6;
  }
  if (repeat === "weekends") {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
  return date.getDay() === start.getDay();
}

function isTaskDone(task, dateKey) {
  return task.completed?.[dateKey] === true;
}

function isHabitComplete(habit, dateKey) {
  const value = habit.logs?.[dateKey];
  if (habit.type === "number") return Number(value || 0) >= Number(habit.goal || 1);
  return value === true;
}

function habitStreak(habit, dateKey = toDateKey(new Date())) {
  let count = 0;
  let guard = 0;
  let cursor = parseDate(dateKey);

  while (guard < 3660) {
    const cursorKey = toDateKey(cursor);
    if (habitOccursOn(habit, cursorKey)) {
      if (!isHabitComplete(habit, cursorKey)) break;
      count += 1;
    }
    cursor.setDate(cursor.getDate() - 1);
    guard += 1;
  }

  return count;
}

function sortTasks(a, b, orderMap = new Map()) {
  const manualDiff = (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity);
  const priorityWeight = { high: 0, medium: 1, low: 2 };
  const priorityDiff = (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1);
  const timeDiff = timeValue(a.time).localeCompare(timeValue(b.time));
  const categoryDiff = categoryLabel(a).localeCompare(categoryLabel(b), "ru");

  if (priorityDiff !== 0) return priorityDiff;
  if (manualDiff !== 0) return manualDiff;
  if (timeDiff !== 0) return timeDiff;
  return categoryDiff;
}

function taskDetails(task) {
  const details = [];
  const category = getCategory(task.categoryId);
  if (task.time) details.push(`до ${task.time}`);
  if (category) details.push(category.name);
  if (task.repeat !== "none") details.push(repeatLabels[task.repeat]);
  if (task.time && task.reminderOffset !== "none") details.push(reminderLabel(task.reminderOffset));
  return details;
}

function taskMetaMarkup(task) {
  const category = getCategory(task.categoryId);
  const chips = [];

  if (category) {
    chips.push(`
      <span class="task-meta-chip task-category-chip" style="--category-color: ${escapeHtml(category.color)}">
        <span class="task-meta-dot"></span>
        ${escapeHtml(category.name)}
      </span>
    `);
  }

  if (task.time) chips.push(`<span class="task-meta-chip">до ${escapeHtml(task.time)}</span>`);
  if (task.repeat !== "none") chips.push(`<span class="task-meta-chip">${escapeHtml(repeatLabels[task.repeat])}</span>`);
  if (task.time && task.reminderOffset !== "none") {
    chips.push(`<span class="task-meta-chip">${escapeHtml(reminderLabel(task.reminderOffset))}</span>`);
  }

  return chips.join("") || `<span class="task-meta-chip is-empty">Без категории</span>`;
}

function categoryLabel(task) {
  return getCategory(task.categoryId)?.name || "\uffff";
}

function timeValue(value) {
  return cleanTimeValue(value) || "99:99";
}

function normalizeHabitRepeat(value) {
  return VALID_HABIT_REPEATS.includes(value) ? value : "daily";
}

function reminderLabel(value) {
  const labels = {
    0: "напомнить в срок",
    5: "за 5 минут",
    15: "за 15 минут",
    30: "за 30 минут",
    60: "за 1 час",
    1440: "за день",
  };
  return labels[value] || "без напоминания";
}

function statsForDate(dateKey) {
  const tasks = tasksForDate(dateKey);
  const habits = habitsForDate(dateKey);
  const taskDone = tasks.filter((task) => isTaskDone(task, dateKey)).length;
  const habitDone = habits.filter((habit) => isHabitComplete(habit, dateKey)).length;
  const taskTotal = tasks.length;
  const habitTotal = habits.length;
  return {
    habitDone,
    habitPercent: habitTotal ? Math.round((habitDone / habitTotal) * 100) : 0,
    habitTotal,
    taskDone,
    taskPercent: taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0,
    taskTotal,
  };
}

function archiveEntries() {
  return state.tasks
    .flatMap((task) =>
      Object.entries(task.completed || {})
        .filter(([, done]) => done === true)
        .map(([dateKey]) => ({ dateKey, task })),
    )
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.task.createdAt.localeCompare(a.task.createdAt));
}

function getCategory(categoryId) {
  return state.categories.find((category) => category.id === categoryId);
}

function checkDueNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();

  state.tasks.forEach((task) => {
    const dates = candidateReminderDates(task, now);
    dates.forEach((dateKey) => {
      const reminderAt = getReminderDate(task, dateKey);
      if (!reminderAt || reminderAt > now || isTaskDone(task, dateKey) || task.notified?.[dateKey]) return;
      task.notified[dateKey] = true;
      new Notification("Ритм дня", {
        body: task.title,
        tag: `${task.id}-${dateKey}`,
      });
      saveState();
    });
  });
}

async function requestNotifications() {
  if (window.rhythmDesktop) {
    await window.rhythmDesktop.showTestNotification();
    updateNotificationButton("granted");
    showToast("Фоновые напоминания активны");
    return;
  }

  if (!("Notification" in window)) {
    els.notifyButton.textContent = "Не поддерживаются";
    return;
  }

  const permission = await Notification.requestPermission();
  updateNotificationButton(permission);
}

function updateNotificationButton(permission = "Notification" in window ? Notification.permission : "default") {
  if (window.rhythmDesktop) {
    els.notifyButton.innerHTML = `${icon("bell")}Фон включен`;
    els.desktopStatus.textContent = "Закрытое окно останется в фоне";
    return;
  }
  els.notifyButton.innerHTML =
    permission === "granted" ? `${icon("bell")}Уведомления включены` : `${icon("bell")}Уведомления`;
}

function syncDesktopReminders() {
  if (!window.rhythmDesktop?.syncReminders) return;

  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 1);
  const reminders = [];

  for (let i = 0; i < 62; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const dateKey = toDateKey(current);
    tasksForDate(dateKey).forEach((task) => {
      const reminderAt = getReminderDate(task, dateKey);
      if (!reminderAt || isTaskDone(task, dateKey)) return;
      const dueAt = getDueDate(task, dateKey);
      reminders.push({
        id: `${task.id}-${dateKey}`,
        taskId: task.id,
        title: task.title,
        dateKey,
        dueAt: dueAt.toISOString(),
        reminderAt: reminderAt.toISOString(),
        category: getCategory(task.categoryId)?.name || "",
        priority: task.priority,
      });
    });
  }

  window.rhythmDesktop.syncReminders({ generatedAt: now.toISOString(), reminders });
}

function candidateReminderDates(task, now) {
  const dates = [];
  for (let offset = -1; offset <= 1; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const dateKey = toDateKey(date);
    if (taskOccursOn(task, dateKey)) dates.push(dateKey);
  }
  return dates;
}

function getDueDate(task, dateKey) {
  const [hours, minutes] = (task.time || "09:00").split(":").map(Number);
  const date = parseDate(dateKey);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function getReminderDate(task, dateKey) {
  if (!task.time || task.reminderOffset === "none") return null;
  const due = getDueDate(task, dateKey);
  const reminder = new Date(due);
  reminder.setMinutes(due.getMinutes() - Number(task.reminderOffset || 0));
  return reminder;
}

function shiftDate(days) {
  const date = parseDate(activeDate);
  date.setDate(date.getDate() + days);
  activeDate = toDateKey(date);
  resetTaskForm();
  render();
}

function loadStoredState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function loadUiState() {
  try {
    return JSON.parse(localStorage.getItem(UI_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUiState() {
  localStorage.setItem(UI_STATE_KEY, JSON.stringify({ taskCategoryFilter }));
}

function cleanTimeValue(value) {
  const time = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(time) ? time : "";
}

function syncTaskTimePresets() {
  const time = cleanTimeValue(els.taskTime.value);
  document.querySelectorAll("[data-time-preset]").forEach((button) => {
    const preset = button.dataset.timePreset || "";
    button.classList.toggle("is-active", preset === time);
  });
}

function normalizeState(raw) {
  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    habits: [],
    categories: [],
    taskOrder: {},
  };

  if (!raw || typeof raw !== "object") return normalized;

  normalized.categories = Array.isArray(raw.categories)
    ? raw.categories.map((category) => ({
        id: category.id || createId(),
        name: cleanText(category.name) || "Категория",
        color: sanitizeColor(category.color) || randomCategoryColor(),
        createdAt: category.createdAt || new Date().toISOString(),
      }))
    : [];

  const ensureCategory = (name) => {
    const categoryName = cleanText(name);
    if (!categoryName) return "";
    const existing = normalized.categories.find(
      (category) => category.name.toLowerCase() === categoryName.toLowerCase(),
    );
    if (existing) return existing.id;
    const category = {
      id: createId(),
      name: categoryName,
      color: randomCategoryColor(),
      createdAt: new Date().toISOString(),
    };
    normalized.categories.push(category);
    return category.id;
  };

  normalized.tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map((task) => ({
        id: task.id || createId(),
        title: cleanText(task.title) || "Задача",
        date: task.date || toDateKey(new Date()),
        time: cleanTimeValue(task.time),
        categoryId: task.categoryId || ensureCategory(task.category),
        priority: VALID_PRIORITIES.includes(task.priority) ? task.priority : "medium",
        repeat: VALID_REPEATS.includes(task.repeat) ? task.repeat : "none",
        reminderOffset: task.reminderOffset ?? (task.time ? "15" : "none"),
        completed: task.completed && typeof task.completed === "object" ? task.completed : {},
        notified: task.notified && typeof task.notified === "object" ? task.notified : {},
        createdAt: task.createdAt || new Date().toISOString(),
      }))
    : [];

  normalized.habits = Array.isArray(raw.habits)
    ? raw.habits.map((habit) => ({
        id: habit.id || createId(),
        title: cleanText(habit.title) || "Привычка",
        type: habit.type === "number" ? "number" : "check",
        repeat: normalizeHabitRepeat(habit.repeat),
        startDate: habit.startDate || toDateKey(new Date(habit.createdAt || Date.now())),
        unit: cleanText(habit.unit),
        goal: Math.max(1, Number(habit.goal || 1)),
        logs: habit.logs && typeof habit.logs === "object" ? habit.logs : {},
        createdAt: habit.createdAt || new Date().toISOString(),
      }))
    : [];

  normalized.taskOrder = raw.taskOrder && typeof raw.taskOrder === "object" ? raw.taskOrder : {};
  return normalized;
}

function replaceState(nextState) {
  state = normalizeState(nextState);
}

function saveState() {
  state.schemaVersion = SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  syncDesktopReminders();
}

function seedIfEmpty() {
  if (!state.categories.length) {
    state.categories.push(
      { id: createId(), name: "Работа", color: "#5967d8", createdAt: new Date().toISOString() },
      { id: createId(), name: "Фокус", color: "#00a78e", createdAt: new Date().toISOString() },
      { id: createId(), name: "Здоровье", color: "#ef6a4b", createdAt: new Date().toISOString() },
      { id: createId(), name: "Дом", color: "#e7b84a", createdAt: new Date().toISOString() },
    );
  }

  if (state.tasks.length || state.habits.length) {
    saveState();
    return;
  }

  const focusId = state.categories.find((category) => category.name === "Фокус")?.id || "";
  const workId = state.categories.find((category) => category.name === "Работа")?.id || "";
  const healthId = state.categories.find((category) => category.name === "Здоровье")?.id || "";

  state.tasks.push(
    {
      id: createId(),
      title: "Собрать план на день",
      date: activeDate,
      time: "10:00",
      categoryId: focusId,
      priority: "high",
      repeat: "daily",
      reminderOffset: "15",
      completed: {},
      notified: {},
      createdAt: new Date().toISOString(),
    },
    {
      id: createId(),
      title: "Закрыть важную рабочую задачу",
      date: activeDate,
      time: "16:30",
      categoryId: workId,
      priority: "medium",
      repeat: "none",
      reminderOffset: "30",
      completed: {},
      notified: {},
      createdAt: new Date().toISOString(),
    },
  );

  state.habits.push(
    {
      id: createId(),
      title: "Вода",
      type: "number",
      repeat: "daily",
      startDate: activeDate,
      unit: "мл",
      goal: 2000,
      logs: {},
      createdAt: new Date().toISOString(),
    },
    {
      id: createId(),
      title: "Разминка",
      type: "check",
      repeat: "weekdays",
      startDate: activeDate,
      unit: "",
      goal: 1,
      logs: {},
      createdAt: new Date().toISOString(),
    },
  );

  if (!healthId) ensureHealthCategory();
  saveState();
}

function ensureHealthCategory() {
  if (!state.categories.some((category) => category.name === "Здоровье")) {
    state.categories.push({ id: createId(), name: "Здоровье", color: "#ef6a4b", createdAt: new Date().toISOString() });
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.rhythmDesktop) return;

  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  if (isLocalHost) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});

    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("rhythm-day-")).map((key) => caches.delete(key))))
        .catch(() => {});
    }

    return;
  }

  navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch(() => {});
}

function getWeekDates(dateKey) {
  const date = parseDate(dateKey);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);

  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(date);
    item.setDate(date.getDate() + index);
    return toDateKey(item);
  });
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(dateKey) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseDate(dateKey));
}

function formatWeekday(dateKey) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
  }).format(parseDate(dateKey));
}

function heatAlpha(percent) {
  if (percent <= 0) return "0.08";
  if (percent < 35) return "0.24";
  if (percent < 70) return "0.48";
  if (percent < 100) return "0.72";
  return "1";
}

function randomCategoryColor() {
  const colors = ["#00a78e", "#5967d8", "#ef6a4b", "#e7b84a", "#8b5cf6", "#0ea5e9"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function sanitizeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function icon(name) {
  return `<svg class="ui-icon"><use href="#icon-${name}"></use></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}
