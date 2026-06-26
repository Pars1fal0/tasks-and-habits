const STORAGE_KEY = "rhythm-day-state-v1";
const UI_STATE_KEY = "rhythm-day-ui-v1";
const BACKUP_KEY = "rhythm-day-backup-v1";
const IMPORT_SAFETY_BACKUP_KEY = "rhythm-day-import-safety-backup-v1";
const SCHEMA_VERSION = 5;
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;
const VALID_PRIORITIES = ["high", "medium", "low"];
const VALID_HABIT_REPEATS = ["daily", "every2days", "every3days", "weekdays", "weekends", "weekly", "custom"];
const VALID_REMINDER_OFFSETS = ["none", "0", "5", "15", "30", "60", "1440"];

let state = normalizeState(loadStoredState());
let activeDate = toDateKey(new Date());
let activeView = "tasks";
let taskFilter = "all";
const initialUiState = loadUiState();
let taskCategoryFilter = initialUiState.taskCategoryFilter || "all";
let taskSearchQuery = initialUiState.taskSearchQuery || "";
let archiveCategoryFilter = initialUiState.archiveCategoryFilter || "all";
let archiveSearchQuery = initialUiState.archiveSearchQuery || "";
let draggedTaskId = null;
let draggedTaskDate = "";
let pointerDragTask = null;
let lastBackupAt = 0;

const els = {
  activeDate: document.querySelector("#activeDate"),
  archiveCategoryFilter: document.querySelector("#archiveCategoryFilter"),
  archiveEmpty: document.querySelector("#archiveEmpty"),
  archiveList: document.querySelector("#archiveList"),
  archiveSearch: document.querySelector("#archiveSearch"),
  backupStatus: document.querySelector("#backupStatus"),
  categoryColor: document.querySelector("#categoryColor"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryList: document.querySelector("#categoryList"),
  categoryName: document.querySelector("#categoryName"),
  clearArchiveFilter: document.querySelector("#clearArchiveFilter"),
  clearTaskSearch: document.querySelector("#clearTaskSearch"),
  desktopStatus: document.querySelector("#desktopStatus"),
  exportButton: document.querySelector("#exportButton"),
  excludedList: document.querySelector("#excludedList"),
  excludedPanel: document.querySelector("#excludedPanel"),
  focusBar: document.querySelector("#focusBar"),
  focusMeta: document.querySelector("#focusMeta"),
  focusPercent: document.querySelector("#focusPercent"),
  focusTitle: document.querySelector("#focusTitle"),
  habitDoneMetric: document.querySelector("#habitDoneMetric"),
  habitEmpty: document.querySelector("#habitEmpty"),
  habitForm: document.querySelector("#habitForm"),
  habitFormPanel: document.querySelector("#habitFormPanel"),
  habitGoal: document.querySelector("#habitGoal"),
  habitCustomRepeatInterval: document.querySelector("#habitCustomRepeatInterval"),
  habitCustomRepeatMonthDay: document.querySelector("#habitCustomRepeatMonthDay"),
  habitCustomRepeatPanel: document.querySelector("#habitCustomRepeatPanel"),
  habitCustomRepeatSummary: document.querySelector("#habitCustomRepeatSummary"),
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
  monthGrid: document.querySelector("#monthGrid"),
  monthLabel: document.querySelector("#monthLabel"),
  navTabs: document.querySelectorAll(".nav-tab"),
  nextDay: document.querySelector("#nextDay"),
  nextMonth: document.querySelector("#nextMonth"),
  notifyButton: document.querySelector("#notifyButton"),
  openHabitForm: document.querySelector("#openHabitForm"),
  openTaskForm: document.querySelector("#openTaskForm"),
  overdueCounter: document.querySelector("#overdueCounter"),
  overdueList: document.querySelector("#overdueList"),
  overduePanel: document.querySelector("#overduePanel"),
  pageTitle: document.querySelector("#pageTitle"),
  prevDay: document.querySelector("#prevDay"),
  prevMonth: document.querySelector("#prevMonth"),
  customRepeatInterval: document.querySelector("#customRepeatInterval"),
  customRepeatMonthDay: document.querySelector("#customRepeatMonthDay"),
  customRepeatPanel: document.querySelector("#customRepeatPanel"),
  customRepeatSummary: document.querySelector("#customRepeatSummary"),
  quickTaskForm: document.querySelector("#quickTaskForm"),
  quickTaskInput: document.querySelector("#quickTaskInput"),
  quickTaskPreview: document.querySelector("#quickTaskPreview"),
  resetHabitForm: document.querySelector("#resetHabitForm"),
  resetTaskForm: document.querySelector("#resetTaskForm"),
  restoreBackupButton: document.querySelector("#restoreBackupButton"),
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
  taskSearch: document.querySelector("#taskSearch"),
  taskTemplate: document.querySelector("#taskTemplate"),
  taskTime: document.querySelector("#taskTime"),
  taskTitle: document.querySelector("#taskTitle"),
  todayButton: document.querySelector("#todayButton"),
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
  weekBoardGrid: document.querySelector("#weekBoardGrid"),
  weekBoardLabel: document.querySelector("#weekBoardLabel"),
  weekStrip: document.querySelector("#weekStrip"),
  weeklyHabitMetric: document.querySelector("#weeklyHabitMetric"),
  weeklyHabitText: document.querySelector("#weeklyHabitText"),
  weeklyTaskMetric: document.querySelector("#weeklyTaskMetric"),
  weeklyTaskText: document.querySelector("#weeklyTaskText"),
};

const toastController = window.RhythmToast.createToastController({
  element: els.toast,
  restoreUndoSnapshot,
});

const priorityLabels = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const repeatLabels = window.RhythmRecurrence.repeatLabels;

seedIfEmpty();
init();

function init() {
  els.activeDate.value = activeDate;
  els.taskSearch.value = taskSearchQuery;
  els.archiveSearch.value = archiveSearchQuery;
  bindEvents();
  resetTaskForm();
  resetHabitForm();
  registerServiceWorker();
  updateNotificationButton();
  updateBackupStatus();
  render();
  syncDesktopReminders();
  setInterval(checkDueNotifications, 30000);
  setInterval(syncDesktopReminders, 60000);
  setInterval(() => createBackup({ silent: true }), BACKUP_INTERVAL_MS);
}

function bindEvents() {
  els.activeDate.addEventListener("change", () => {
    activeDate = els.activeDate.value || toDateKey(new Date());
    resetTaskForm();
    render();
  });

  els.prevDay.addEventListener("click", () => shiftDate(-1));
  els.nextDay.addEventListener("click", () => shiftDate(1));
  els.todayButton.addEventListener("click", goToday);
  els.prevMonth.addEventListener("click", () => shiftMonth(-1));
  els.nextMonth.addEventListener("click", () => shiftMonth(1));

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

  els.taskSearch.addEventListener("input", () => {
    taskSearchQuery = cleanSearchQuery(els.taskSearch.value);
    saveUiState();
    renderTasks();
  });

  els.clearTaskSearch.addEventListener("click", () => {
    taskFilter = "all";
    taskCategoryFilter = "all";
    taskSearchQuery = "";
    els.taskSearch.value = "";
    els.taskCategoryFilter.value = "all";
    document.querySelectorAll("[data-task-filter]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.taskFilter === "all");
    });
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
  els.quickTaskForm.addEventListener("submit", saveQuickTask);
  els.quickTaskInput.addEventListener("input", updateQuickTaskPreview);
  els.taskRepeat.addEventListener("change", syncCustomRepeatPanel);
  document.querySelectorAll("[data-repeat-mode]").forEach((button) => {
    button.addEventListener("click", () => setCustomRepeatMode(button.dataset.repeatMode));
  });
  document.querySelectorAll("[data-weekday]").forEach((button) => {
    button.addEventListener("click", () => {
      const activeButtons = document.querySelectorAll("[data-weekday].is-active");
      if (button.classList.contains("is-active") && activeButtons.length <= 1) return;
      button.classList.toggle("is-active");
      updateCustomRepeatSummary();
    });
  });
  [els.customRepeatMonthDay, els.customRepeatInterval].forEach((input) => {
    input.addEventListener("input", updateCustomRepeatSummary);
  });
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
  els.habitRepeat.addEventListener("change", syncHabitCustomRepeatPanel);
  document.querySelectorAll("[data-habit-repeat-mode]").forEach((button) => {
    button.addEventListener("click", () => setHabitCustomRepeatMode(button.dataset.habitRepeatMode));
  });
  document.querySelectorAll("[data-habit-weekday]").forEach((button) => {
    button.addEventListener("click", () => {
      const activeButtons = document.querySelectorAll("[data-habit-weekday].is-active");
      if (button.classList.contains("is-active") && activeButtons.length <= 1) return;
      button.classList.toggle("is-active");
      updateHabitCustomRepeatSummary();
    });
  });
  [els.habitCustomRepeatMonthDay, els.habitCustomRepeatInterval].forEach((input) => {
    input.addEventListener("input", updateHabitCustomRepeatSummary);
  });

  els.categoryForm.addEventListener("submit", saveCategoryFromForm);
  els.notifyButton.addEventListener("click", requestNotifications);
  els.exportButton.addEventListener("click", exportData);
  els.restoreBackupButton.addEventListener("click", restoreBackup);
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importData);
  els.archiveSearch.addEventListener("input", () => {
    archiveSearchQuery = cleanSearchQuery(els.archiveSearch.value);
    saveUiState();
    renderArchive();
  });
  els.archiveCategoryFilter.addEventListener("change", () => {
    archiveCategoryFilter = els.archiveCategoryFilter.value || "all";
    saveUiState();
    renderArchive();
  });
  els.clearArchiveFilter.addEventListener("click", () => {
    archiveSearchQuery = "";
    archiveCategoryFilter = "all";
    els.archiveSearch.value = "";
    els.archiveCategoryFilter.value = "all";
    saveUiState();
    renderArchive();
  });
  document.addEventListener("pointermove", handleCalendarPointerMove);
  document.addEventListener("pointerup", finishCalendarPointerDrag);
  document.addEventListener("pointercancel", cancelCalendarPointerDrag);
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
    const matchesCategory = matchesCategoryFilter(task, taskCategoryFilter);
    if (!matchesCategory) return false;
    if (!taskMatchesSearch(task, taskSearchQuery, activeDate)) return false;
    if (taskFilter === "open") return !done;
    if (taskFilter === "done") return done;
    return true;
  });

  renderOverdueTasks();
  els.taskList.replaceChildren();
  visibleTasks.forEach((task) => els.taskList.appendChild(createTaskNode(task)));

  const doneCount = tasks.filter((task) => isTaskDone(task, activeDate)).length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const hasActiveFilters = taskFilter !== "all" || taskCategoryFilter !== "all" || taskSearchQuery;

  els.taskEmpty.textContent = tasks.length
    ? "По текущим фильтрам задач нет."
    : "На выбранный день задач нет.";
  els.taskEmpty.classList.toggle("is-visible", visibleTasks.length === 0);
  els.taskCounter.textContent = hasActiveFilters
    ? `${visibleTasks.length} из ${tasks.length} найдено · ${doneCount} выполнено`
    : `${doneCount} из ${tasks.length} выполнено`;
  els.taskProgress.textContent = `${percent}%`;
  els.taskProgressRing.style.setProperty("--progress", `${percent * 3.6}deg`);
  renderExcludedTasks();
}

function createTaskNode(task) {
  const node = els.taskTemplate.content.firstElementChild.cloneNode(true);
  const done = isTaskDone(task, activeDate);
  const category = getCategory(task.categoryId);
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
  priority.textContent = priorityLabels[task.priority] || "Средний";
  priority.classList.add(`priority-${task.priority || "medium"}`);
  meta.innerHTML = taskMetaMarkup(task);

  node.addEventListener("dragstart", (event) => {
    draggedTaskId = task.id;
    draggedTaskDate = activeDate;
    node.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.setData("application/x-rhythm-task", JSON.stringify({ taskId: task.id, dateKey: activeDate }));
  });
  node.addEventListener("dragend", () => {
    clearTaskDragState();
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
      const undo = createUndoSnapshot();
      reorderTask(activeDate, sourceId, task.id);
      saveState();
      render();
      showToast("Порядок задач изменен", { undo });
    }
  });

  check.addEventListener("click", () => {
    const undo = createUndoSnapshot();
    task.completed[activeDate] = !done;
    saveState();
    render();
    showToast(done ? "Задача снова активна" : "Задача выполнена", { undo });
  });

  node.querySelector(".edit-task").addEventListener("click", () => fillTaskForm(task));
  node.querySelector(".postpone-tomorrow").addEventListener("click", () => {
    postponeTask(task, activeDate, addDays(activeDate, 1));
  });
  node.querySelector(".postpone-week").addEventListener("click", () => {
    postponeTask(task, activeDate, addDays(activeDate, 7));
  });
  node.querySelector(".postpone-date").addEventListener("click", () => {
    postponeDateInput.value = addDays(activeDate, 1);
    postponeDateInput.classList.add("is-visible");
    if (postponeDateInput.showPicker) {
      postponeDateInput.showPicker();
    } else {
      postponeDateInput.focus();
    }
  });
  postponeDateInput.addEventListener("change", () => {
    if (!postponeDateInput.value) return;
    postponeTask(task, activeDate, postponeDateInput.value);
  });
  const excludeButton = node.querySelector(".exclude-task");
  excludeButton.hidden = task.repeat === "none";
  excludeButton.addEventListener("click", () => excludeTaskDate(task, activeDate));
  node.querySelector(".delete-task").addEventListener("click", () => {
    const undo = createUndoSnapshot();
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    Object.keys(state.taskOrder).forEach((dateKey) => {
      state.taskOrder[dateKey] = state.taskOrder[dateKey].filter((id) => id !== task.id);
    });
    saveState();
    render();
    showToast("Задача удалена", { undo });
  });

  return node;
}

function renderOverdueTasks() {
  const overdueEntries = overdueTaskEntries();
  els.overdueList.replaceChildren();
  els.overduePanel.classList.toggle("is-visible", overdueEntries.length > 0);
  els.overdueCounter.textContent = overdueEntries.length
    ? `${overdueEntries.length} невыполнено`
    : "";

  overdueEntries.forEach((entry) => {
    const node = document.createElement("article");
    node.className = "overdue-item";
    const category = getCategory(entry.task.categoryId);
    const details = [
      formatLongDate(entry.dateKey),
      entry.task.time ? `до ${entry.task.time}` : "до конца дня",
      category?.name || "Без категории",
      priorityLabels[entry.task.priority] || "Средний",
    ];
    if (entry.task.repeat !== "none") details.push(formatTaskRepeat(entry.task));

    node.innerHTML = `
      <div>
        <h3>${escapeHtml(entry.task.title)}</h3>
        <p>${details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join(" · ")}</p>
      </div>
      <div class="overdue-actions">
        <button class="ghost-button compact-button overdue-go" type="button">К дню</button>
        <button class="ghost-button compact-button overdue-today" type="button">Сегодня</button>
        <button class="primary-button compact-button overdue-done" type="button">Готово</button>
      </div>
    `;

    node.querySelector(".overdue-go").addEventListener("click", () => {
      activeDate = entry.dateKey;
      resetTaskForm();
      render();
    });

    node.querySelector(".overdue-today").addEventListener("click", () => {
      postponeTask(entry.task, entry.dateKey, toDateKey(new Date()), { clearPastTimeToday: true });
    });

    node.querySelector(".overdue-done").addEventListener("click", () => {
      const undo = createUndoSnapshot();
      entry.task.completed[entry.dateKey] = true;
      saveState();
      render();
      showToast("Просроченная задача закрыта", { undo });
    });

    els.overdueList.appendChild(node);
  });
}

function renderExcludedTasks() {
  const excludedTasks = excludedTasksForDate(activeDate);
  els.excludedList.replaceChildren();
  els.excludedPanel.classList.toggle("is-visible", excludedTasks.length > 0);

  excludedTasks.forEach((task) => {
    const node = document.createElement("article");
    node.className = "excluded-item";
    const details = taskDetails(task).filter((detail) => detail !== formatTaskRepeat(task));
    node.innerHTML = `
      <div>
        <h3>${escapeHtml(task.title)}</h3>
        <p>${escapeHtml(formatTaskRepeat(task) || "Повтор")} · ${escapeHtml(details.join(" · ") || "Без категории")}</p>
      </div>
      <button class="ghost-button compact-button restore-excluded" type="button">Вернуть в день</button>
    `;

    node.querySelector(".restore-excluded").addEventListener("click", () => {
      restoreTaskDate(task, activeDate);
    });

    els.excludedList.appendChild(node);
  });
}

function excludeTaskDate(task, dateKey) {
  if (task.repeat === "none") return;
  const undo = createUndoSnapshot();
  task.excludedDates = task.excludedDates || {};
  task.excludedDates[dateKey] = true;
  delete task.completed?.[dateKey];
  delete task.notified?.[dateKey];
  if (Array.isArray(state.taskOrder[dateKey])) {
    state.taskOrder[dateKey] = state.taskOrder[dateKey].filter((id) => id !== task.id);
  }
  saveState();
  render();
  showToast("Повтор исключен на выбранный день", { undo });
}

function restoreTaskDate(task, dateKey) {
  const undo = createUndoSnapshot();
  if (task.excludedDates) {
    delete task.excludedDates[dateKey];
  }
  saveState();
  render();
  showToast("Повтор возвращен в план", { undo });
}

function openDateTasks(dateKey) {
  activeDate = dateKey;
  activeView = "tasks";
  resetTaskForm();
  render();
}

function moveTaskToDate(taskId, sourceDateKey, targetDateKey) {
  const task = state.tasks.find((item) => item.id === taskId);
  const sourceDate = normalizeDateKey(sourceDateKey || activeDate, "");
  const targetDate = normalizeDateKey(targetDateKey, "");
  if (!task || !sourceDate || !targetDate || sourceDate === targetDate) return;
  postponeTask(task, sourceDate, targetDate);
}

function attachTaskDropZone(element, dateKey) {
  element.addEventListener("dragover", (event) => {
    const transfer = getDraggedTaskTransfer(event);
    if (!transfer.taskId || transfer.dateKey === dateKey) return;
    event.preventDefault();
    element.classList.add("is-drop-target");
    event.dataTransfer.dropEffect = "move";
  });
  element.addEventListener("dragleave", (event) => {
    if (!element.contains(event.relatedTarget)) {
      element.classList.remove("is-drop-target");
    }
  });
  element.addEventListener("drop", (event) => {
    event.preventDefault();
    element.classList.remove("is-drop-target");
    const transfer = getDraggedTaskTransfer(event);
    if (!transfer.taskId || transfer.dateKey === dateKey) return;
    moveTaskToDate(transfer.taskId, transfer.dateKey, dateKey);
  });
}

function attachTaskChipDrag(chip) {
  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    openDateTasks(chip.dataset.date);
  });
  chip.addEventListener("keydown", (event) => event.stopPropagation());
  chip.addEventListener("pointerdown", (event) => {
    startCalendarPointerDrag(event, chip);
  });
  chip.addEventListener("dragstart", (event) => {
    draggedTaskId = chip.dataset.taskId;
    draggedTaskDate = chip.dataset.date;
    chip.classList.add("is-dragging");
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chip.dataset.taskId);
    event.dataTransfer.setData(
      "application/x-rhythm-task",
      JSON.stringify({ taskId: chip.dataset.taskId, dateKey: chip.dataset.date }),
    );
  });
  chip.addEventListener("dragend", () => {
    chip.classList.remove("is-dragging");
    clearTaskDragState();
  });
}

function getDraggedTaskTransfer(event) {
  try {
    const raw = event.dataTransfer?.getData("application/x-rhythm-task");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        taskId: String(parsed.taskId || ""),
        dateKey: normalizeDateKey(parsed.dateKey || draggedTaskDate || activeDate, ""),
      };
    }
  } catch {
    // Fall back to the plain text payload below.
  }

  return {
    taskId: event.dataTransfer?.getData("text/plain") || draggedTaskId || "",
    dateKey: normalizeDateKey(draggedTaskDate || activeDate, ""),
  };
}

function clearTaskDragState() {
  draggedTaskId = null;
  draggedTaskDate = "";
  document.querySelectorAll(".task-item.is-drop-target, .calendar-drop-zone.is-drop-target").forEach((item) => {
    item.classList.remove("is-drop-target");
  });
}

function startCalendarPointerDrag(event, chip) {
  if (event.button !== 0 || !chip.dataset.taskId || !chip.dataset.date) return;
  pointerDragTask = {
    taskId: chip.dataset.taskId,
    dateKey: chip.dataset.date,
    startX: event.clientX,
    startY: event.clientY,
    dragging: false,
    chip,
  };
}

function handleCalendarPointerMove(event) {
  if (!pointerDragTask) return;
  const distance = Math.hypot(event.clientX - pointerDragTask.startX, event.clientY - pointerDragTask.startY);
  if (!pointerDragTask.dragging && distance < 8) return;

  pointerDragTask.dragging = true;
  pointerDragTask.chip.classList.add("is-dragging");
  document.querySelectorAll(".calendar-drop-zone.is-drop-target").forEach((item) => item.classList.remove("is-drop-target"));

  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".calendar-drop-zone");
  if (target?.dataset.date && target.dataset.date !== pointerDragTask.dateKey) {
    target.classList.add("is-drop-target");
  }
}

function finishCalendarPointerDrag(event) {
  if (!pointerDragTask) return;
  const drag = pointerDragTask;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".calendar-drop-zone");
  cancelCalendarPointerDrag();

  if (!drag.dragging || !target?.dataset.date || target.dataset.date === drag.dateKey) return;
  moveTaskToDate(drag.taskId, drag.dateKey, target.dataset.date);
}

function cancelCalendarPointerDrag() {
  if (pointerDragTask?.chip) pointerDragTask.chip.classList.remove("is-dragging");
  pointerDragTask = null;
  document.querySelectorAll(".calendar-drop-zone.is-drop-target").forEach((item) => item.classList.remove("is-drop-target"));
}

function postponeTask(task, sourceDateKey, targetDateKey, options = {}) {
  const targetDate = normalizeDateKey(targetDateKey, "");
  if (!targetDate) {
    showToast("Не удалось перенести задачу");
    return;
  }
  const undo = options.undo || createUndoSnapshot();
  window.RhythmTaskMoves.postponeTask({
    state,
    task,
    sourceDateKey,
    targetDateKey: targetDate,
    options,
    helpers: {
      cleanTimeValue,
      createId,
      taskScheduledOn,
      toDateKey,
    },
  });

  activeDate = targetDate;
  saveState();
  resetTaskForm();
  render();
  showToast(`Задача перенесена на ${formatLongDate(targetDate)}`, { undo });
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
  streak.textContent = habitSubtitle(habit);

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
      node.querySelector(".habit-streak").textContent = habitSubtitle(habit);
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
      const undo = createUndoSnapshot();
      habit.logs[activeDate] = !done;
      saveState();
      render();
      showToast(done ? "Отметка снята" : "Привычка отмечена", { undo });
    });

    row.append(button, label);
    control.append(row);
  }

  node.querySelector(".edit-habit").addEventListener("click", () => fillHabitForm(habit));
  node.querySelector(".delete-habit").addEventListener("click", () => {
    const undo = createUndoSnapshot();
    state.habits = state.habits.filter((item) => item.id !== habit.id);
    saveState();
    render();
    showToast("Привычка удалена", { undo });
  });

  return node;
}

function habitSubtitle(habit) {
  const repeat = formatHabitRepeat(habit);
  return `Серия: ${habitStreak(habit, activeDate)} дн. · ${repeat}`;
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
  renderWeekBoard(week);
  renderMonthCalendar();
  renderHeatmap();
}

function renderWeekBoard(week) {
  els.weekBoardLabel.textContent = `${formatShortDate(week[0])} — ${formatShortDate(week[6])}`;
  els.weekBoardGrid.replaceChildren();

  week.forEach((dateKey) => {
    const tasks = getOrderedTasksForDate(dateKey);
    const openTasks = tasks.filter((task) => !isTaskDone(task, dateKey));
    const doneCount = tasks.length - openTasks.length;
    const column = document.createElement("article");

    column.className = "week-board-day calendar-drop-zone";
    column.dataset.date = dateKey;
    column.tabIndex = 0;
    column.setAttribute("role", "button");
    column.setAttribute("aria-label", `${formatLongDate(dateKey)}: ${openTasks.length} открыто, ${doneCount} готово`);
    column.classList.toggle("is-active", dateKey === activeDate);
    column.classList.toggle("is-today", dateKey === toDateKey(new Date()));
    column.innerHTML = `
      <div class="week-board-header">
        <span>${formatWeekday(dateKey)}</span>
        <strong>${parseDate(dateKey).getDate()}</strong>
      </div>
      <div class="week-board-count">${doneCount}/${tasks.length} выполнено</div>
      <div class="week-board-list">
        ${
          tasks.length
            ? tasks
                .map((task) => {
                  const done = isTaskDone(task, dateKey);
                  const category = getCategory(task.categoryId);
                  return `
                    <span class="week-task-chip month-task-chip${done ? " is-done" : ""}" draggable="true" data-task-id="${escapeHtml(task.id)}" data-date="${dateKey}">
                      <span>${escapeHtml(task.title)}</span>
                      <small>${escapeHtml(category?.name || priorityLabels[task.priority] || "Задача")}</small>
                    </span>
                  `;
                })
                .join("")
            : `<span class="week-board-empty">Нет задач</span>`
        }
      </div>
    `;

    column.addEventListener("click", () => openDateTasks(dateKey));
    column.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDateTasks(dateKey);
    });
    attachTaskDropZone(column, dateKey);
    column.querySelectorAll(".month-task-chip").forEach((chip) => attachTaskChipDrag(chip));
    els.weekBoardGrid.appendChild(column);
  });
}

function renderMonthCalendar() {
  const monthDate = parseDate(activeDate);
  const currentMonth = monthDate.getMonth();
  const dates = getMonthCalendarDates(activeDate);

  els.monthLabel.textContent = formatMonthLabel(activeDate);
  els.monthGrid.replaceChildren();

  dates.forEach((dateKey) => {
    const date = parseDate(dateKey);
    const tasks = getOrderedTasksForDate(dateKey);
    const openTasks = tasks.filter((task) => !isTaskDone(task, dateKey));
    const doneCount = tasks.length - openTasks.length;
    const habitCount = habitsForDate(dateKey).length;
    const visibleTasks = openTasks.slice(0, 3);
    const hiddenTasks = openTasks.slice(3);
    const hiddenCount = hiddenTasks.length;
    const dayCell = document.createElement("div");
    const details = [];

    if (openTasks.length) details.push(`${openTasks.length} открыто`);
    if (doneCount) details.push(`${doneCount} готово`);
    if (habitCount) details.push(`${habitCount} привычек`);

    dayCell.className = "month-day calendar-drop-zone";
    dayCell.dataset.date = dateKey;
    dayCell.tabIndex = 0;
    dayCell.setAttribute("role", "button");
    dayCell.setAttribute(
      "aria-label",
      `${formatLongDate(dateKey)}: ${details.join(", ") || "нет задач"}`,
    );
    dayCell.classList.toggle("is-outside", date.getMonth() !== currentMonth);
    dayCell.classList.toggle("is-active", dateKey === activeDate);
    dayCell.classList.toggle("is-today", dateKey === toDateKey(new Date()));
    dayCell.innerHTML = `
      <span class="month-day-head">
        <strong>${date.getDate()}</strong>
        ${tasks.length ? `<span>${doneCount}/${tasks.length}</span>` : ""}
      </span>
      <div class="month-day-items">
        ${visibleTasks
          .map((task) => `<span class="month-task-chip" draggable="true" data-task-id="${escapeHtml(task.id)}" data-date="${dateKey}">${escapeHtml(task.title)}</span>`)
          .join("")}
        ${
          hiddenCount > 0
            ? `<button class="month-day-more" type="button">+${hiddenCount}</button>
              <div class="month-day-hidden">
                ${hiddenTasks
                  .map((task) => `<span class="month-task-chip" draggable="true" data-task-id="${escapeHtml(task.id)}" data-date="${dateKey}">${escapeHtml(task.title)}</span>`)
                  .join("")}
              </div>`
            : ""
        }
      </div>
    `;
    dayCell.addEventListener("click", () => openDateTasks(dateKey));
    dayCell.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDateTasks(dateKey);
    });
    attachTaskDropZone(dayCell, dateKey);
    dayCell.querySelectorAll(".month-task-chip").forEach((chip) => attachTaskChipDrag(chip));
    const moreButton = dayCell.querySelector(".month-day-more");
    if (moreButton) {
      moreButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const expanded = dayCell.classList.toggle("is-expanded");
        moreButton.textContent = expanded ? "Скрыть" : `+${hiddenCount}`;
      });
    }

    els.monthGrid.appendChild(dayCell);
  });
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
  const allEntries = archiveEntries();
  const entries = allEntries.filter((entry) => {
    return matchesCategoryFilter(entry.task, archiveCategoryFilter) && archiveEntryMatchesSearch(entry, archiveSearchQuery);
  });
  els.archiveList.replaceChildren();
  entries.forEach((entry) => els.archiveList.appendChild(createArchiveNode(entry)));
  els.archiveEmpty.textContent = allEntries.length
    ? "По текущим фильтрам записей нет."
    : "Завершенных задач пока нет.";
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
    const undo = createUndoSnapshot();
    entry.task.completed[entry.dateKey] = false;
    saveState();
    render();
    showToast("Задача возвращена в план", { undo });
  });

  return node;
}

function renderCategories() {
  els.taskCategoryId.replaceChildren();
  els.taskCategoryFilter.replaceChildren();
  els.archiveCategoryFilter.replaceChildren();

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Без категории";
  els.taskCategoryId.appendChild(emptyOption);

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Все категории";
  els.taskCategoryFilter.appendChild(allOption);

  const archiveAllOption = allOption.cloneNode(true);
  els.archiveCategoryFilter.appendChild(archiveAllOption);

  const uncategorizedOption = document.createElement("option");
  uncategorizedOption.value = "none";
  uncategorizedOption.textContent = "Без категории";
  els.taskCategoryFilter.appendChild(uncategorizedOption);

  const archiveUncategorizedOption = uncategorizedOption.cloneNode(true);
  els.archiveCategoryFilter.appendChild(archiveUncategorizedOption);

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

    const archiveFilterOption = filterOption.cloneNode(true);
    els.archiveCategoryFilter.appendChild(archiveFilterOption);
  });

  const filterExists = taskCategoryFilter === "all" || taskCategoryFilter === "none" || categories.some((category) => category.id === taskCategoryFilter);
  if (!filterExists) {
    taskCategoryFilter = "all";
    saveUiState();
  }
  const archiveFilterExists =
    archiveCategoryFilter === "all" || archiveCategoryFilter === "none" || categories.some((category) => category.id === archiveCategoryFilter);
  if (!archiveFilterExists) {
    archiveCategoryFilter = "all";
    saveUiState();
  }
  els.taskCategoryFilter.value = taskCategoryFilter;
  els.archiveCategoryFilter.value = archiveCategoryFilter;

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
  const undo = createUndoSnapshot();
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
    customRepeat: els.taskRepeat.value === "custom" ? getCustomRepeatFromForm() : {},
    reminderOffset: els.taskReminder.value,
    completed: existing?.completed || {},
    excludedDates: existing?.excludedDates || {},
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
  showToast(existing ? "Задача обновлена" : "Задача создана", { undo });
}

function saveQuickTask(event) {
  event.preventDefault();
  const undo = createUndoSnapshot();
  const parsed = parseQuickTaskInput(els.quickTaskInput.value);
  if (!parsed.title) {
    showToast("Напиши название задачи");
    els.quickTaskInput.focus();
    return;
  }

  const task = {
    id: createId(),
    title: parsed.title,
    date: parsed.date,
    time: parsed.time,
    categoryId: parsed.categoryId,
    priority: parsed.priority,
    repeat: "none",
    customRepeat: {},
    reminderOffset: parsed.time ? "15" : "none",
    completed: {},
    excludedDates: {},
    notified: {},
    createdAt: new Date().toISOString(),
  };

  state.tasks.push(task);
  activeDate = task.date;
  activeView = "tasks";
  els.quickTaskInput.value = "";
  updateQuickTaskPreview();
  saveState();
  resetTaskForm();
  render();
  showToast(`Добавлено: ${task.title}`, { undo });
}

function updateQuickTaskPreview() {
  const rawValue = cleanText(els.quickTaskInput.value);
  if (!rawValue) {
    els.quickTaskPreview.hidden = true;
    els.quickTaskPreview.replaceChildren();
    return;
  }

  const parsed = parseQuickTaskPreview(rawValue);
  const category = parsed.categoryId ? getCategory(parsed.categoryId)?.name : parsed.categoryName;
  const details = [
    formatLongDate(parsed.date),
    parsed.time ? `до ${parsed.time}` : "без времени",
    category || "без категории",
    priorityLabels[parsed.priority],
  ];

  els.quickTaskPreview.hidden = false;
  els.quickTaskPreview.innerHTML = `
    <div>
      <span>Будет создано</span>
      <strong>${escapeHtml(parsed.title || "Задача без названия")}</strong>
    </div>
    <div class="quick-preview-chips">
      ${details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
    </div>
  `;
}

function parseQuickTaskPreview(value) {
  return window.RhythmQuickInput.parseQuickTaskInput(value, {
    activeDate,
    cleanText,
    getOrCreateCategory: (categoryValue) => {
      const name = normalizeQuickCategoryName(categoryValue);
      return state.categories.find((category) => category.name.toLowerCase() === name.toLowerCase())?.id || "";
    },
    normalizeCategoryName: normalizeQuickCategoryName,
    normalizeDateKey,
    toDateKey,
    toTimeValue,
  });
}

function getCustomRepeatFromForm() {
  const activeMode = document.querySelector("[data-repeat-mode].is-active")?.dataset.repeatMode || "weekdays";
  if (activeMode === "monthDay") {
    return window.RhythmRecurrence.normalizeCustomRepeat({
      type: "monthDay",
      day: Number(els.customRepeatMonthDay.value || 15),
    });
  }
  if (activeMode === "interval") {
    return window.RhythmRecurrence.normalizeCustomRepeat({
      type: "interval",
      every: Number(els.customRepeatInterval.value || 5),
    });
  }

  return window.RhythmRecurrence.normalizeCustomRepeat({
    type: "weekdays",
    weekdays: [...document.querySelectorAll("[data-weekday].is-active")].map((button) => Number(button.dataset.weekday)),
  });
}

function setCustomRepeatForm(value = {}) {
  const custom = window.RhythmRecurrence.normalizeCustomRepeat(value);
  setCustomRepeatMode(custom.type);
  const activeWeekdays = custom.weekdays || [1, 3, 5];
  document.querySelectorAll("[data-weekday]").forEach((button) => {
    button.classList.toggle("is-active", activeWeekdays.includes(Number(button.dataset.weekday)));
  });
  els.customRepeatMonthDay.value = custom.type === "monthDay" ? custom.day : 15;
  els.customRepeatInterval.value = custom.type === "interval" ? custom.every : 5;
  updateCustomRepeatSummary();
}

function syncCustomRepeatPanel() {
  const isCustom = els.taskRepeat.value === "custom";
  els.customRepeatPanel.hidden = !isCustom;
  if (isCustom) updateCustomRepeatSummary();
}

function setCustomRepeatMode(mode = "weekdays") {
  document.querySelectorAll("[data-repeat-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.repeatMode === mode);
  });
  document.querySelectorAll("[data-repeat-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.repeatPanel !== mode;
  });
  updateCustomRepeatSummary();
}

function updateCustomRepeatSummary() {
  els.customRepeatSummary.textContent = window.RhythmRecurrence.customRepeatLabel(getCustomRepeatFromForm());
}

function getHabitCustomRepeatFromForm() {
  const activeMode = document.querySelector("[data-habit-repeat-mode].is-active")?.dataset.habitRepeatMode || "weekdays";
  if (activeMode === "monthDay") {
    return window.RhythmRecurrence.normalizeCustomRepeat({
      type: "monthDay",
      day: Number(els.habitCustomRepeatMonthDay.value || 15),
    });
  }
  if (activeMode === "interval") {
    return window.RhythmRecurrence.normalizeCustomRepeat({
      type: "interval",
      every: Number(els.habitCustomRepeatInterval.value || 5),
    });
  }

  return window.RhythmRecurrence.normalizeCustomRepeat({
    type: "weekdays",
    weekdays: [...document.querySelectorAll("[data-habit-weekday].is-active")].map((button) =>
      Number(button.dataset.habitWeekday),
    ),
  });
}

function setHabitCustomRepeatForm(value = {}) {
  const custom = window.RhythmRecurrence.normalizeCustomRepeat(value);
  setHabitCustomRepeatMode(custom.type);
  const activeWeekdays = custom.weekdays || [1, 3, 5];
  document.querySelectorAll("[data-habit-weekday]").forEach((button) => {
    button.classList.toggle("is-active", activeWeekdays.includes(Number(button.dataset.habitWeekday)));
  });
  els.habitCustomRepeatMonthDay.value = custom.type === "monthDay" ? custom.day : 15;
  els.habitCustomRepeatInterval.value = custom.type === "interval" ? custom.every : 5;
  updateHabitCustomRepeatSummary();
}

function syncHabitCustomRepeatPanel() {
  const isCustom = els.habitRepeat.value === "custom";
  els.habitCustomRepeatPanel.hidden = !isCustom;
  if (isCustom) updateHabitCustomRepeatSummary();
}

function setHabitCustomRepeatMode(mode = "weekdays") {
  document.querySelectorAll("[data-habit-repeat-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.habitRepeatMode === mode);
  });
  document.querySelectorAll("[data-habit-repeat-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.habitRepeatPanel !== mode;
  });
  updateHabitCustomRepeatSummary();
}

function updateHabitCustomRepeatSummary() {
  els.habitCustomRepeatSummary.textContent = window.RhythmRecurrence.customRepeatLabel(getHabitCustomRepeatFromForm());
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
  setCustomRepeatForm(task.customRepeat);
  els.taskReminder.value = task.reminderOffset ?? (task.time ? "15" : "none");
  syncCustomRepeatPanel();
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
  setCustomRepeatForm();
  syncCustomRepeatPanel();
  els.taskReminder.value = "15";
  syncTaskTimePresets();
}

function saveHabitFromForm(event) {
  event.preventDefault();
  const undo = createUndoSnapshot();
  const id = els.habitId.value || createId();
  const existing = state.habits.find((habit) => habit.id === id);
  const type = els.habitType.value;
  const habit = {
    id,
    title: cleanText(els.habitTitle.value),
    type,
    repeat: normalizeHabitRepeat(els.habitRepeat.value),
    customRepeat: els.habitRepeat.value === "custom" ? getHabitCustomRepeatFromForm() : {},
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
  showToast(existing ? "Привычка обновлена" : "Привычка создана", { undo });
}

function fillHabitForm(habit) {
  els.habitFormPanel.classList.remove("is-collapsed");
  els.habitId.value = habit.id;
  els.habitTitle.value = habit.title;
  els.habitType.value = habit.type;
  els.habitRepeat.value = normalizeHabitRepeat(habit.repeat);
  setHabitCustomRepeatForm(habit.customRepeat);
  syncHabitCustomRepeatPanel();
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
  setHabitCustomRepeatForm();
  syncHabitCustomRepeatPanel();
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
  const undo = createUndoSnapshot();

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
  showToast("Категория создана", { undo });
}

function deleteCategory(categoryId) {
  const undo = createUndoSnapshot();
  const hasTasks = state.tasks.some((task) => task.categoryId === categoryId);
  state.categories = state.categories.filter((category) => category.id !== categoryId);
  if (hasTasks) {
    state.tasks.forEach((task) => {
      if (task.categoryId === categoryId) task.categoryId = "";
    });
  }
  if (taskCategoryFilter === categoryId) taskCategoryFilter = "all";
  if (archiveCategoryFilter === categoryId) archiveCategoryFilter = "all";
  saveState();
  saveUiState();
  render();
  showToast("Категория удалена", { undo });
}

function exportData() {
  const payload = {
    app: "Ритм дня",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  createBackup({ payload, silent: true });
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

  const undo = createUndoSnapshot();
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedState = normalizeState(parsed.state || parsed);
    createImportSafetyBackup(undo);
    replaceState(importedState);
    saveState({ skipBackup: true });
    render();
    showToast("Данные импортированы. Предыдущие данные сохранены", { undo });
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
  const taskIds = new Set(tasks.map((task) => task.id));
  const order = Array.isArray(state.taskOrder[dateKey])
    ? state.taskOrder[dateKey].filter((id) => taskIds.has(id))
    : [];
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
  return taskScheduledOn(task, dateKey) && !isTaskExcluded(task, dateKey);
}

function taskScheduledOn(task, dateKey) {
  return window.RhythmRecurrence.taskScheduledOn(task, dateKey);
}

function isTaskExcluded(task, dateKey) {
  return task.excludedDates?.[dateKey] === true;
}

function excludedTasksForDate(dateKey) {
  return state.tasks
    .filter((task) => task.repeat !== "none" && taskScheduledOn(task, dateKey) && isTaskExcluded(task, dateKey))
    .sort(sortTasks);
}

function overdueTaskEntries(now = new Date()) {
  const todayKey = toDateKey(now);
  const start = new Date(now);
  start.setDate(now.getDate() - 60);
  const entries = [];

  state.tasks.forEach((task) => {
    if (task.repeat === "none") {
      addOverdueEntry(entries, task, task.date, now);
      return;
    }

    for (let cursor = new Date(start); cursor <= now; cursor.setDate(cursor.getDate() + 1)) {
      const dateKey = toDateKey(cursor);
      if (dateKey > todayKey) continue;
      if (!taskScheduledOn(task, dateKey) || isTaskExcluded(task, dateKey)) continue;
      addOverdueEntry(entries, task, dateKey, now);
    }
  });

  return entries
    .sort((a, b) => a.dueAt - b.dueAt || a.task.title.localeCompare(b.task.title, "ru"))
    .slice(0, 20);
}

function addOverdueEntry(entries, task, dateKey, now) {
  const dueAt = getTaskDeadlineDate(task, dateKey);
  if (dueAt >= now || isTaskDone(task, dateKey)) return;
  entries.push({ task, dateKey, dueAt });
}

function habitsForDate(dateKey) {
  return state.habits.filter((habit) => habitOccursOn(habit, dateKey));
}

function habitOccursOn(habit, dateKey) {
  const repeat = normalizeHabitRepeat(habit.repeat);
  return window.RhythmRecurrence.taskScheduledOn(
    {
      date: habit.startDate || activeDate,
      repeat: repeat === "weekly" ? "weekly" : repeat,
      customRepeat: habit.customRepeat,
    },
    dateKey,
  );
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
  const manualRankA = orderMap.get(a.id);
  const manualRankB = orderMap.get(b.id);
  const hasManualOrder = manualRankA !== undefined || manualRankB !== undefined;
  const priorityWeight = { high: 0, medium: 1, low: 2 };
  const priorityDiff = (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1);
  const timeDiff = timeValue(a.time).localeCompare(timeValue(b.time));
  const categoryDiff = categoryLabel(a).localeCompare(categoryLabel(b), "ru");

  if (hasManualOrder) {
    const manualDiff = (manualRankA ?? Number.MAX_SAFE_INTEGER) - (manualRankB ?? Number.MAX_SAFE_INTEGER);
    if (manualDiff !== 0) return manualDiff;
  }
  if (priorityDiff !== 0) return priorityDiff;
  if (timeDiff !== 0) return timeDiff;
  return categoryDiff;
}

function taskDetails(task) {
  const details = [];
  const category = getCategory(task.categoryId);
  if (task.time) details.push(`до ${task.time}`);
  if (category) details.push(category.name);
  if (task.repeat !== "none") details.push(formatTaskRepeat(task));
  if (task.time && task.reminderOffset !== "none") details.push(reminderLabel(task.reminderOffset));
  return details;
}

function matchesCategoryFilter(task, filter) {
  return filter === "all" ? true : (task.categoryId || "none") === filter;
}

function taskMatchesSearch(task, query, dateKey = "") {
  const search = cleanSearchQuery(query);
  if (!search) return true;

  const category = getCategory(task.categoryId);
  const haystack = [
    task.title,
    category?.name,
    priorityLabels[task.priority],
    formatTaskRepeat(task),
    task.time,
    dateKey,
    dateKey ? formatLongDate(dateKey) : "",
    task.reminderOffset !== "none" ? reminderLabel(task.reminderOffset) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return search.split(" ").every((token) => haystack.includes(token));
}

function archiveEntryMatchesSearch(entry, query) {
  const search = cleanSearchQuery(query);
  if (!search) return true;

  return taskMatchesSearch(entry.task, search, entry.dateKey);
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
  if (task.repeat !== "none") chips.push(`<span class="task-meta-chip">${escapeHtml(formatTaskRepeat(task))}</span>`);
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

function formatTaskRepeat(task) {
  return window.RhythmRecurrence.repeatLabel(task);
}

function normalizeHabitRepeat(value) {
  return VALID_HABIT_REPEATS.includes(value) ? value : "daily";
}

function formatHabitRepeat(habit) {
  return window.RhythmRecurrence.repeatLabel({
    repeat: normalizeHabitRepeat(habit.repeat),
    customRepeat: habit.customRepeat,
  });
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
  const [hours, minutes] = (cleanTimeValue(task.time) || "09:00").split(":").map(Number);
  const date = parseDate(dateKey);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function getTaskDeadlineDate(task, dateKey) {
  const date = parseDate(dateKey);
  const time = cleanTimeValue(task.time);
  if (!time) {
    date.setHours(23, 59, 59, 999);
    return date;
  }

  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function getReminderDate(task, dateKey) {
  if (!task.time || task.reminderOffset === "none") return null;
  const offset = Number(task.reminderOffset || 0);
  if (!Number.isFinite(offset)) return null;
  const due = getDueDate(task, dateKey);
  const reminder = new Date(due);
  reminder.setMinutes(due.getMinutes() - offset);
  return reminder;
}

function shiftDate(days) {
  const date = parseDate(activeDate);
  date.setDate(date.getDate() + days);
  activeDate = toDateKey(date);
  resetTaskForm();
  render();
}

function goToday() {
  activeDate = toDateKey(new Date());
  resetTaskForm();
  render();
}

function shiftMonth(months) {
  const date = parseDate(activeDate);
  const targetDay = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(targetDay, lastDay));
  activeDate = toDateKey(target);
  resetTaskForm();
  render();
}

function addDays(dateKey, days) {
  const date = parseDate(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
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
  localStorage.setItem(
    UI_STATE_KEY,
    JSON.stringify({
      archiveCategoryFilter,
      archiveSearchQuery,
      taskCategoryFilter,
      taskSearchQuery,
    }),
  );
}

function cleanSearchQuery(value) {
  return cleanText(value).toLowerCase();
}

function cleanTimeValue(value) {
  const time = String(value || "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseQuickTaskInput(value) {
  return window.RhythmQuickInput.parseQuickTaskInput(value, {
    activeDate,
    cleanText,
    getOrCreateCategory,
    normalizeCategoryName: normalizeQuickCategoryName,
    normalizeDateKey,
    toDateKey,
    toTimeValue,
  });
}

function getOrCreateCategory(value) {
  const name = normalizeQuickCategoryName(value);
  if (!name) return "";
  const existing = state.categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const category = {
    id: createId(),
    name,
    color: randomCategoryColor(),
    createdAt: new Date().toISOString(),
  };
  state.categories.push(category);
  return category.id;
}

function normalizeQuickCategoryName(value) {
  const name = cleanText(String(value || "").replaceAll("_", " "));
  if (!name) return "";
  return name.charAt(0).toLocaleUpperCase("ru-RU") + name.slice(1);
}

function normalizeReminderOffset(value, hasTime = true) {
  const offset = String(value ?? (hasTime ? "15" : "none"));
  if (VALID_REMINDER_OFFSETS.includes(offset)) return offset;
  return hasTime ? "15" : "none";
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
    ? raw.tasks.map((task) => {
        const time = cleanTimeValue(task.time);
        const categoryId = normalized.categories.some((category) => category.id === task.categoryId)
          ? task.categoryId
          : ensureCategory(task.category);

        return {
          id: task.id || createId(),
          title: cleanText(task.title) || "Задача",
          date: normalizeDateKey(task.date),
          time,
          categoryId,
          priority: VALID_PRIORITIES.includes(task.priority) ? task.priority : "medium",
          repeat: window.RhythmRecurrence.normalizeRepeat(task.repeat),
          customRepeat: window.RhythmRecurrence.normalizeCustomRepeat(task.customRepeat),
          reminderOffset: normalizeReminderOffset(task.reminderOffset, Boolean(time)),
          completed: normalizeTaskFlags(task.completed),
          excludedDates: normalizeTaskFlags(task.excludedDates),
          notified: normalizeTaskFlags(task.notified),
          createdAt: task.createdAt || new Date().toISOString(),
        };
      })
    : [];

  normalized.habits = Array.isArray(raw.habits)
    ? raw.habits.map((habit) => {
        const type = habit.type === "number" ? "number" : "check";
        return {
          id: habit.id || createId(),
          title: cleanText(habit.title) || "Привычка",
          type,
          repeat: normalizeHabitRepeat(habit.repeat),
          customRepeat: window.RhythmRecurrence.normalizeCustomRepeat(habit.customRepeat),
          startDate: normalizeDateKey(habit.startDate, toDateKey(new Date(habit.createdAt || Date.now()))),
          unit: cleanText(habit.unit),
          goal: Math.max(1, Number(habit.goal || 1)),
          logs: normalizeHabitLogs(habit.logs, type),
          createdAt: habit.createdAt || new Date().toISOString(),
        };
      })
    : [];

  normalized.taskOrder = normalizeTaskOrder(raw.taskOrder);
  return normalized;
}

function replaceState(nextState) {
  state = normalizeState(nextState);
}

function saveState(options = {}) {
  state.schemaVersion = SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!options.skipBackup) {
    createBackup({ silent: true, throttle: true });
  }
  syncDesktopReminders();
}

function createBackup({ payload = null, silent = false, throttle = false } = {}) {
  const now = Date.now();
  if (throttle && now - lastBackupAt < 60000) return;

  const backup = payload || {
    app: "Ритм дня",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    state,
  };

  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    lastBackupAt = now;
    updateBackupStatus();
    if (!silent) showToast("Локальный бэкап обновлен");
  } catch {
    if (!silent) showToast("Не удалось создать бэкап");
  }
}

function createImportSafetyBackup(snapshot) {
  if (!snapshot?.state) return;

  try {
    localStorage.setItem(
      IMPORT_SAFETY_BACKUP_KEY,
      JSON.stringify({
        app: "Ритм дня",
        schemaVersion: SCHEMA_VERSION,
        reason: "before-import",
        exportedAt: new Date().toISOString(),
        state: JSON.parse(snapshot.state),
      }),
    );
  } catch {
    // The undo snapshot in the toast still protects the current session.
  }
}

function restoreBackup() {
  const backup = loadBackup();
  if (!backup) {
    showToast("Локальный бэкап пока не найден");
    return;
  }

  const backupDate = backup.exportedAt ? formatBackupDate(backup.exportedAt) : "без даты";
  const confirmed = window.confirm(`Восстановить данные из локального бэкапа (${backupDate})? Текущий план будет заменен.`);
  if (!confirmed) return;

  replaceState(backup.state || backup);
  saveState();
  render();
  showToast("Данные восстановлены из бэкапа");
}

function loadBackup() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BACKUP_KEY));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function updateBackupStatus() {
  const backup = loadBackup();
  if (!backup?.exportedAt) {
    els.backupStatus.textContent = "Бэкап еще не создан";
    return;
  }
  els.backupStatus.textContent = `Бэкап: ${formatBackupDate(backup.exportedAt)}`;
}

function formatBackupDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function getMonthCalendarDates(dateKey) {
  const date = parseDate(dateKey);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  firstDay.setDate(firstDay.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const item = new Date(firstDay);
    item.setDate(firstDay.getDate() + index);
    return toDateKey(item);
  });
}

function parseDate(dateKey) {
  const [year, month, day] = normalizeDateKey(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeDateKey(value, fallback = toDateKey(new Date())) {
  const dateKey = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isValid ? dateKey : fallback;
}

function normalizeTaskFlags(value) {
  const flags = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return flags;

  Object.entries(value).forEach(([dateKey, done]) => {
    const normalizedDate = normalizeDateKey(dateKey, "");
    if (normalizedDate && done === true) flags[normalizedDate] = true;
  });

  return flags;
}

function normalizeHabitLogs(value, type) {
  const logs = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return logs;

  Object.entries(value).forEach(([dateKey, entry]) => {
    const normalizedDate = normalizeDateKey(dateKey, "");
    if (!normalizedDate) return;
    if (type === "number") {
      const amount = Number(entry);
      if (Number.isFinite(amount) && amount > 0) logs[normalizedDate] = amount;
      return;
    }
    if (entry === true) logs[normalizedDate] = true;
  });

  return logs;
}

function normalizeTaskOrder(value) {
  const taskOrder = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return taskOrder;

  Object.entries(value).forEach(([dateKey, ids]) => {
    const normalizedDate = normalizeDateKey(dateKey, "");
    if (!normalizedDate || !Array.isArray(ids)) return;
    taskOrder[normalizedDate] = [...new Set(ids.map((id) => String(id || "")).filter(Boolean))];
  });

  return taskOrder;
}

function toDateKey(date) {
  const safeDate = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeValue(date) {
  const safeDate = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  return `${String(safeDate.getHours()).padStart(2, "0")}:${String(safeDate.getMinutes()).padStart(2, "0")}`;
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

function formatShortDate(dateKey) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(parseDate(dateKey));
}

function formatMonthLabel(dateKey) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
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

function createUndoSnapshot() {
  return {
    activeDate,
    activeView,
    state: JSON.stringify(state),
  };
}

function restoreUndoSnapshot(snapshot) {
  if (!snapshot?.state) return;
  try {
    replaceState(JSON.parse(snapshot.state));
    activeDate = normalizeDateKey(snapshot.activeDate, toDateKey(new Date()));
    activeView = snapshot.activeView || "tasks";
    saveState();
    resetTaskForm();
    render();
    showToast("Действие отменено");
  } catch {
    showToast("Не удалось отменить действие");
  }
}

function showToast(message, options = {}) {
  toastController.showToast(message, options);
}
