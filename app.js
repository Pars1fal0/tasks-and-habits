const SCHEMA_VERSION = 7;
const VALID_PRIORITIES = ["high", "medium", "low"];
const VALID_HABIT_REPEATS = ["daily", "every2days", "every3days", "weekdays", "weekends", "weekly", "custom"];
const VALID_REMINDER_OFFSETS = ["none", "0", "5", "15", "30", "60", "1440"];
const VALID_BACKUP_SCHEDULES = ["0", "5", "15", "30", "60"];

const storage = window.RhythmStorage.createLocalStorageAdapter({
  appName: "Ритм дня",
  schemaVersion: SCHEMA_VERSION,
});
const stateNormalizer = window.RhythmStateNormalizer.createStateNormalizer({
  schemaVersion: SCHEMA_VERSION,
  validPriorities: VALID_PRIORITIES,
  cleanText,
  cleanTimeValue,
  createId,
  normalizeDateKey,
  normalizeHabitLogs,
  normalizeHabitRepeat,
  normalizeReminderOffset,
  normalizeTaskFlags,
  normalizeTaskOrder,
  randomCategoryColor,
  recurrence: window.RhythmRecurrence,
  sanitizeColor,
  toDateKey,
});

let state = normalizeState(storage.loadState());
let activeDate = toDateKey(new Date());
let activeView = "tasks";
let taskFilter = "all";
const initialUiState = storage.loadUiState();
let taskCategoryFilter = initialUiState.taskCategoryFilter || "all";
let taskSearchQuery = initialUiState.taskSearchQuery || "";
let archiveCategoryFilter = initialUiState.archiveCategoryFilter || "all";
let archiveSearchQuery = initialUiState.archiveSearchQuery || "";
let themePreference = normalizeThemePreference(initialUiState.themePreference);
let notificationSetting = normalizeNotificationSetting(initialUiState.notificationSetting);
let backupSchedule = normalizeBackupSchedule(initialUiState.backupSchedule);
let firstDayOfWeek = normalizeFirstDayOfWeek(initialUiState.firstDayOfWeek);
let densityPreference = normalizeDensityPreference(initialUiState.densityPreference);
let interfaceMode = normalizeInterfaceMode(initialUiState.interfaceMode);
let timeFormat = normalizeTimeFormat(initialUiState.timeFormat);
let remoteSyncEnabled = normalizeRemoteSyncEnabled(initialUiState.remoteSyncEnabled);
let remoteSyncUrl = cleanText(initialUiState.remoteSyncUrl || "");
let remoteSyncAnonKey = cleanText(initialUiState.remoteSyncAnonKey || "");
let remoteSyncUserKey = normalizeRemoteUserKey(initialUiState.remoteSyncUserKey || "");
let remoteSyncLastPushedAt = initialUiState.remoteSyncLastPushedAt || "";
let remoteSyncLastPulledAt = initialUiState.remoteSyncLastPulledAt || "";
let remoteSyncLastError = "";
let draggedTaskId = null;
let draggedTaskDate = "";
let pointerDragTask = null;
let autoBackupTimerId = null;
let remoteSyncTimerId = null;
let remoteSyncInFlight = false;
let lastAutoBackupAt = "";
let nextAutoBackupAt = "";

const els = {
  activeDate: document.querySelector("#activeDate"),
  archiveCategoryFilter: document.querySelector("#archiveCategoryFilter"),
  archiveEmpty: document.querySelector("#archiveEmpty"),
  archiveList: document.querySelector("#archiveList"),
  archiveSearch: document.querySelector("#archiveSearch"),
  backupStatus: document.querySelector("#backupStatus"),
  backupSchedule: document.querySelector("#backupSchedule"),
  categoryColor: document.querySelector("#categoryColor"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryList: document.querySelector("#categoryList"),
  categoryName: document.querySelector("#categoryName"),
  clearArchiveFilter: document.querySelector("#clearArchiveFilter"),
  clearTaskSearch: document.querySelector("#clearTaskSearch"),
  closeGoalForm: document.querySelector("#closeGoalForm"),
  confirmAccept: document.querySelector("#confirmAccept"),
  confirmCancel: document.querySelector("#confirmCancel"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmTitle: document.querySelector("#confirmTitle"),
  desktopStatus: document.querySelector("#desktopStatus"),
  densityPreference: document.querySelector("#densityPreference"),
  exportButton: document.querySelector("#exportButton"),
  excludedList: document.querySelector("#excludedList"),
  excludedPanel: document.querySelector("#excludedPanel"),
  focusBar: document.querySelector("#focusBar"),
  focusMeta: document.querySelector("#focusMeta"),
  focusPercent: document.querySelector("#focusPercent"),
  focusTitle: document.querySelector("#focusTitle"),
  fileBackupStatus: document.querySelector("#fileBackupStatus"),
  firstDayOfWeek: document.querySelector("#firstDayOfWeek"),
  goalActiveMetric: document.querySelector("#goalActiveMetric"),
  goalAdvancedPanel: document.querySelector("#goalAdvancedPanel"),
  goalDescription: document.querySelector("#goalDescription"),
  goalDoneMetric: document.querySelector("#goalDoneMetric"),
  goalDueDate: document.querySelector("#goalDueDate"),
  goalEmpty: document.querySelector("#goalEmpty"),
  goalForm: document.querySelector("#goalForm"),
  goalFormHeading: document.querySelector("#goalFormHeading"),
  goalFormPanel: document.querySelector("#goalFormPanel"),
  goalId: document.querySelector("#goalId"),
  goalList: document.querySelector("#goalList"),
  goalMeasure: document.querySelector("#goalMeasure"),
  goalOverdueMetric: document.querySelector("#goalOverdueMetric"),
  goalReality: document.querySelector("#goalReality"),
  goalSteps: document.querySelector("#goalSteps"),
  goalTitle: document.querySelector("#goalTitle"),
  goalWhy: document.querySelector("#goalWhy"),
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
  interfaceMode: document.querySelector("#interfaceMode"),
  monthGrid: document.querySelector("#monthGrid"),
  monthLabel: document.querySelector("#monthLabel"),
  monthWeekdays: document.querySelector("#monthWeekdays"),
  navTabs: document.querySelectorAll(".nav-tab"),
  nextDay: document.querySelector("#nextDay"),
  nextMonth: document.querySelector("#nextMonth"),
  notificationSetting: document.querySelector("#notificationSetting"),
  notifyButton: document.querySelector("#notifyButton"),
  openGoalForm: document.querySelector("#openGoalForm"),
  openHabitForm: document.querySelector("#openHabitForm"),
  openBackupFolderButton: document.querySelector("#openBackupFolderButton"),
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
  remoteSyncAnonKey: document.querySelector("#remoteSyncAnonKey"),
  remoteSyncEnabled: document.querySelector("#remoteSyncEnabled"),
  remoteSyncPullButton: document.querySelector("#remoteSyncPullButton"),
  remoteSyncPushButton: document.querySelector("#remoteSyncPushButton"),
  remoteSyncStatus: document.querySelector("#remoteSyncStatus"),
  remoteSyncUrl: document.querySelector("#remoteSyncUrl"),
  remoteSyncUserKey: document.querySelector("#remoteSyncUserKey"),
  resetHabitForm: document.querySelector("#resetHabitForm"),
  resetGoalForm: document.querySelector("#resetGoalForm"),
  resetTaskForm: document.querySelector("#resetTaskForm"),
  restoreBackupButton: document.querySelector("#restoreBackupButton"),
  settingsExportButton: document.querySelector("#settingsExportButton"),
  settingsExportSettingsButton: document.querySelector("#settingsExportSettingsButton"),
  settingsBackupStatus: document.querySelector("#settingsBackupStatus"),
  settingsImportFile: document.querySelector("#settingsImportFile"),
  settingsImportSettingsButton: document.querySelector("#settingsImportSettingsButton"),
  settingsNotifyButton: document.querySelector("#settingsNotifyButton"),
  settingsOpenBackupFolderButton: document.querySelector("#settingsOpenBackupFolderButton"),
  settingsResetButton: document.querySelector("#settingsResetButton"),
  settingsRestoreBackupButton: document.querySelector("#settingsRestoreBackupButton"),
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
  taskBlockTimeFields: document.querySelector("#taskBlockTimeFields"),
  taskList: document.querySelector("#taskList"),
  taskPriority: document.querySelector("#taskPriority"),
  taskProgress: document.querySelector("#taskProgress"),
  taskProgressRing: document.querySelector("#taskProgressRing"),
  taskScheduleBlock: document.querySelector("#taskScheduleBlock"),
  taskScheduleDeadline: document.querySelector("#taskScheduleDeadline"),
  taskReminder: document.querySelector("#taskReminder"),
  taskRepeat: document.querySelector("#taskRepeat"),
  taskSearch: document.querySelector("#taskSearch"),
  taskStartTime: document.querySelector("#taskStartTime"),
  taskTemplate: document.querySelector("#taskTemplate"),
  taskTime: document.querySelector("#taskTime"),
  taskDeadlineTimeField: document.querySelector("#taskDeadlineTimeField"),
  taskEndTime: document.querySelector("#taskEndTime"),
  taskTitle: document.querySelector("#taskTitle"),
  themePreference: document.querySelector("#themePreference"),
  timeFormat: document.querySelector("#timeFormat"),
  timelineEmpty: document.querySelector("#timelineEmpty"),
  timelineGrid: document.querySelector("#timelineGrid"),
  timelineSummary: document.querySelector("#timelineSummary"),
  timelineUnscheduledList: document.querySelector("#timelineUnscheduledList"),
  todayButton: document.querySelector("#todayButton"),
  todayDoneMetric: document.querySelector("#todayDoneMetric"),
  todayLabel: document.querySelector("#todayLabel"),
  todayOpenMetric: document.querySelector("#todayOpenMetric"),
  toast: document.querySelector("#appToast"),
  views: {
    archive: document.querySelector("#archiveView"),
    goals: document.querySelector("#goalsView"),
    habits: document.querySelector("#habitsView"),
    overview: document.querySelector("#overviewView"),
    settings: document.querySelector("#settingsView"),
    tasks: document.querySelector("#tasksView"),
    timeline: document.querySelector("#timelineView"),
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

const confirmDialog = window.RhythmConfirmDialog.createConfirmDialog({ els });
const remoteSync = window.RhythmRemoteSync.createRemoteSync();
const taskFormHome = {
  next: els.taskFormPanel?.nextSibling || null,
  parent: els.taskFormPanel?.parentNode || null,
};

const priorityLabels = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const repeatLabels = window.RhythmRecurrence.repeatLabels;

const tasksView = window.RhythmTasksView.createTasksView({
  els,
  priorityLabels,
  addDays,
  clearTaskDragState,
  createUndoSnapshot,
  deleteTask,
  escapeHtml,
  excludeTaskDate,
  excludedTasksForDate,
  fillTaskForm,
  formatLongDate,
  formatTime,
  formatTaskRepeat,
  getActiveDate: () => activeDate,
  getCategory,
  getOrderedTasksForDate,
  getTaskCategoryFilter: () => taskCategoryFilter,
  getTaskFilter: () => taskFilter,
  getTaskSearchQuery: () => taskSearchQuery,
  isTaskDone,
  matchesCategoryFilter,
  openDate: (dateKey) => {
    activeDate = dateKey;
    resetTaskForm();
    render();
  },
  overdueTaskEntries,
  postponeTask,
  render,
  reorderTask,
  restoreTaskDate,
  saveState,
  setDraggedTask: (taskId, dateKey) => {
    draggedTaskId = taskId;
    draggedTaskDate = dateKey;
  },
  showToast,
  taskDetails,
  taskMatchesSearch,
  taskMetaMarkup,
  toDateKey,
});

const habitsView = window.RhythmHabitsView.createHabitsView({
  els,
  createUndoSnapshot,
  deleteHabit,
  escapeHtml,
  fillHabitForm,
  formatHabitRepeat,
  getActiveDate: () => activeDate,
  getState: () => state,
  habitStreak,
  habitsForDate,
  render,
  renderDailyPulse,
  renderOverview,
  saveState,
  showToast,
});

const goalsView = window.RhythmGoalsView.createGoalsView({
  els,
  cleanText,
  createId,
  createUndoSnapshot,
  deleteGoal,
  getActiveDate: () => activeDate,
  getInterfaceMode: () => interfaceMode,
  getState: () => state,
  normalizeDateKey,
  render,
  saveState,
  showToast,
  toDateKey,
  upsertGoal: (goal) => {
    const existing = state.goals.find((item) => item.id === goal.id);
    if (existing) {
      Object.assign(existing, goal);
    } else {
      state.goals.push(goal);
    }
  },
});

const calendarView = window.RhythmCalendarView.createCalendarView({
  els,
  attachTaskChipDrag,
  attachTaskDropZone,
  escapeHtml,
  formatLongDate,
  formatMonthLabel,
  formatShortDate,
  formatWeekday,
  getActiveDate: () => activeDate,
  getCategory,
  getMonthCalendarDates,
  getOrderedTasksForDate,
  getWeekDates,
  habitsForDate,
  heatAlpha,
  isTaskDone,
  openDateTasks,
  parseDate,
  priorityLabels,
  statsForDate,
  toDateKey,
});

const timelineView = window.RhythmTimelineView.createTimelineView({
  els,
  createTaskAtTime,
  deleteTask: deleteTimelineTask,
  duplicateTask: duplicateTimelineTask,
  fillTaskForm,
  formatTime,
  getActiveDate: () => activeDate,
  getCategory,
  getOrderedTasksForDate,
  isTaskDone,
  moveTaskTime,
  priorityLabels,
  resizeTaskBlockTime,
  setTaskTime,
  shiftTaskTime,
  toggleTaskDone: toggleTimelineTaskDone,
  toDateKey,
});

const archiveView = window.RhythmArchiveView.createArchiveView({
  els,
  archiveEntries,
  archiveEntryMatchesSearch,
  createUndoSnapshot,
  escapeHtml,
  formatLongDate,
  getArchiveCategoryFilter: () => archiveCategoryFilter,
  getArchiveSearchQuery: () => archiveSearchQuery,
  getCategory,
  matchesCategoryFilter,
  priorityLabels,
  render,
  saveState,
  showToast,
});

const taskFormController = window.RhythmTaskForm.createTaskForm({
  els,
  afterSave: () => {
    if (activeView === "timeline") {
      els.taskFormPanel.classList.add("is-collapsed");
      closeFloatingTaskForm();
    }
  },
  cleanText,
  cleanTimeValue,
  createId,
  createUndoSnapshot,
  findTask: (id) => state.tasks.find((task) => task.id === id),
  getActiveDate: () => activeDate,
  getCustomRepeatFromForm,
  getTaskScheduleMode,
  isTimeBlock,
  isValidTimeBlock,
  render,
  saveState,
  setActiveDate: (dateKey) => {
    activeDate = dateKey;
  },
  setCustomRepeatForm,
  setTaskScheduleMode,
  showToast,
  syncCustomRepeatPanel,
  syncTaskScheduleMode,
  syncTaskTimePresets,
  upsertTask: (task) => {
    const existing = state.tasks.find((item) => item.id === task.id);
    if (existing) {
      Object.assign(existing, task);
    } else {
      state.tasks.push(task);
    }
  },
});

const habitFormController = window.RhythmHabitForm.createHabitForm({
  els,
  cleanText,
  createId,
  createUndoSnapshot,
  findHabit: (id) => state.habits.find((habit) => habit.id === id),
  getActiveDate: () => activeDate,
  getHabitCustomRepeatFromForm,
  normalizeHabitRepeat,
  render,
  saveState,
  setHabitCustomRepeatForm,
  showToast,
  syncHabitCustomRepeatPanel,
  upsertHabit: (habit) => {
    const existing = state.habits.find((item) => item.id === habit.id);
    if (existing) {
      Object.assign(existing, habit);
    } else {
      state.habits.push(habit);
    }
  },
});

const categoriesController = window.RhythmCategories.createCategories({
  els,
  cleanText,
  confirmAction,
  createId,
  createUndoSnapshot,
  escapeHtml,
  getArchiveCategoryFilter: () => archiveCategoryFilter,
  getState: () => state,
  getTaskCategoryFilter: () => taskCategoryFilter,
  render,
  saveState,
  saveUiState,
  setArchiveCategoryFilter: (value) => {
    archiveCategoryFilter = value;
  },
  setTaskCategoryFilter: (value) => {
    taskCategoryFilter = value;
  },
  showToast,
});

const importExportController = window.RhythmImportExport.createImportExport({
  els,
  confirmAction,
  createUndoSnapshot,
  getState: () => state,
  normalizeState,
  render,
  replaceState,
  saveState,
  schemaVersion: SCHEMA_VERSION,
  showToast,
  storage,
  toDateKey,
});

const settingsController = window.RhythmSettingsController.createSettingsController({
  els,
  exportData,
  exportSettings,
  getSettings: getUiSettings,
  importSettings,
  openBackupFolder,
  pullRemoteState,
  pushRemoteState,
  renderBackupStatus: renderSettingsBackupStatus,
  requestNotifications,
  resetInterfaceSettings,
  restoreBackup,
  updateSetting,
});

const notificationsController = window.RhythmNotifications.createNotifications({
  els,
  cleanTimeValue,
  getCategory,
  getNotificationsEnabled: () => notificationSetting === "on",
  getState: () => state,
  icon,
  isTaskDone,
  parseDate,
  saveState,
  showToast,
  taskOccursOn,
  tasksForDate,
  toDateKey,
});

seedIfEmpty();
init();

function init() {
  els.activeDate.value = activeDate;
  els.taskSearch.value = taskSearchQuery;
  els.archiveSearch.value = archiveSearchQuery;
  applyThemePreference();
  applySettingsPreferences();
  settingsController.syncControls();
  confirmDialog.bindEvents();
  bindEvents();
  resetTaskForm();
  resetHabitForm();
  resetGoalForm();
  registerServiceWorker();
  updateNotificationButton();
  updateBackupStatus();
  renderSettingsBackupStatus();
  renderRemoteSyncStatus();
  updateFileBackupStatus();
  render();
  syncDesktopReminders();
  syncDesktopBackup();
  setInterval(checkDueNotifications, 30000);
  setInterval(syncDesktopReminders, 60000);
  scheduleAutoBackup();
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
    closeFloatingTaskForm();
  });
  els.openTaskForm.addEventListener("click", () => {
    restoreTaskFormPanel();
    resetTaskForm();
    els.taskTitle.focus();
  });
  els.resetTaskForm.addEventListener("click", resetTaskForm);
  els.taskForm.addEventListener("submit", saveTaskFromForm);
  els.quickTaskForm.addEventListener("submit", saveQuickTask);
  els.quickTaskInput.addEventListener("input", updateQuickTaskPreview);
  els.taskRepeat.addEventListener("change", syncCustomRepeatPanel);
  [els.taskScheduleDeadline, els.taskScheduleBlock].forEach((input) => {
    input?.addEventListener("change", syncTaskScheduleMode);
  });
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
  [els.taskStartTime, els.taskEndTime].forEach((input) => input?.addEventListener("input", syncTaskTimePresets));
  document.querySelectorAll("[data-time-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = button.dataset.timePreset || "";
      if (getTaskScheduleMode() === "block") {
        els.taskStartTime.value = preset;
        els.taskEndTime.value = preset ? minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(preset) + 60)) : "";
      } else {
        els.taskTime.value = preset;
      }
      syncTaskTimePresets();
      (getTaskScheduleMode() === "block" ? els.taskStartTime : els.taskTime).focus();
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

  els.closeGoalForm.addEventListener("click", () => {
    els.goalFormPanel.classList.add("is-collapsed");
  });
  els.openGoalForm.addEventListener("click", () => {
    resetGoalForm();
    els.goalFormPanel.classList.remove("is-collapsed");
    els.goalTitle.focus();
  });
  els.resetGoalForm.addEventListener("click", resetGoalForm);
  els.goalForm.addEventListener("submit", saveGoalFromForm);

  els.categoryForm.addEventListener("submit", saveCategoryFromForm);
  els.notifyButton.addEventListener("click", requestNotifications);
  els.exportButton.addEventListener("click", exportData);
  els.restoreBackupButton.addEventListener("click", restoreBackup);
  els.openBackupFolderButton.addEventListener("click", openBackupFolder);
  settingsController.bindEvents();
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importData);
  window.matchMedia?.("(prefers-color-scheme: light)")?.addEventListener("change", () => {
    if (themePreference === "system") applyThemePreference();
  });
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
  if (activeView !== "timeline") restoreTaskFormPanel();
  els.activeDate.value = activeDate;
  els.todayLabel.textContent = formatLongDate(activeDate);
  els.pageTitle.textContent = {
    archive: "Архив",
    goals: "Цели",
    habits: "Привычки",
    overview: "Обзор",
    settings: "Настройки",
    tasks: "Задачи на день",
    timeline: "Таймлайн дня",
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
  renderTimeline();
  renderHabits();
  renderGoals();
  renderWeekdayLabels();
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
  tasksView.renderTasks();
}

function renderTimeline() {
  timelineView.renderTimeline();
}

function createTaskNode(task) {
  return tasksView.createTaskNode(task);
}

function renderOverdueTasks() {
  tasksView.renderOverdueTasks();
}

function renderExcludedTasks() {
  tasksView.renderExcludedTasks();
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

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((item) => item.id !== taskId);
  Object.keys(state.taskOrder).forEach((dateKey) => {
    state.taskOrder[dateKey] = state.taskOrder[dateKey].filter((id) => id !== taskId);
  });
}

function deleteTimelineTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const undo = createUndoSnapshot();
  deleteTask(taskId);
  saveState();
  render();
  showToast("Задача удалена", { undo });
}

function toggleTimelineTaskDone(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const undo = createUndoSnapshot();
  const done = isTaskDone(task, activeDate);
  task.completed = task.completed || {};
  task.completed[activeDate] = !done;
  saveState();
  render();
  showToast(done ? "Задача снова активна" : "Задача выполнена", { undo });
}

function duplicateTimelineTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const undo = createUndoSnapshot();
  const source = typeof structuredClone === "function" ? structuredClone(task) : JSON.parse(JSON.stringify(task));
  const duplicate = {
    ...source,
    id: createId(),
    title: `${task.title} копия`,
    date: activeDate,
    completed: {},
    excludedDates: {},
    notified: {},
    createdAt: new Date().toISOString(),
  };
  state.tasks.push(duplicate);
  state.taskOrder[activeDate] = getOrderedTasksForDate(activeDate).map((item) => item.id);
  const sourceIndex = state.taskOrder[activeDate].indexOf(task.id);
  if (sourceIndex >= 0) {
    state.taskOrder[activeDate] = state.taskOrder[activeDate].filter((id) => id !== duplicate.id);
    state.taskOrder[activeDate].splice(sourceIndex + 1, 0, duplicate.id);
  }
  saveState();
  render();
  showToast("Задача продублирована", { undo });
}

function deleteHabit(habitId) {
  state.habits = state.habits.filter((item) => item.id !== habitId);
}

function deleteGoal(goalId) {
  state.goals = state.goals.filter((item) => item.id !== goalId);
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
  chip.tabIndex = 0;
  chip.setAttribute("role", "button");
  chip.setAttribute("aria-keyshortcuts", "Enter Space Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown");
  chip.setAttribute(
    "aria-label",
    `${chip.textContent.trim()}. Enter открыть день. Alt и стрелки — перенести задачу по календарю.`,
  );
  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    openDateTasks(chip.dataset.date);
  });
  chip.addEventListener("keydown", (event) => handleTaskChipKeydown(event, chip));
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

function handleTaskChipKeydown(event, chip) {
  event.stopPropagation();
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openDateTasks(chip.dataset.date);
    return;
  }

  if (!event.altKey) return;
  const offsets = {
    ArrowDown: 7,
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
  };
  const offset = offsets[event.key];
  if (!offset || !chip.dataset.taskId || !chip.dataset.date) return;
  event.preventDefault();
  moveTaskToDate(chip.dataset.taskId, chip.dataset.date, addDays(chip.dataset.date, offset));
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
  habitsView.renderHabits();
}

function renderGoals() {
  goalsView.renderGoals();
}

function createHabitNode(habit) {
  return habitsView.createHabitNode(habit);
}

function habitSubtitle(habit) {
  return habitsView.habitSubtitle(habit);
}

function renderOverview() {
  return calendarView.renderOverview();
}

function renderWeekBoard(week) {
  return calendarView.renderWeekBoard(week);
}

function renderMonthCalendar() {
  return calendarView.renderMonthCalendar();
}

function renderHeatmap() {
  return calendarView.renderHeatmap();
}

function renderArchive() {
  return archiveView.renderArchive();
}

function createArchiveNode(entry) {
  return archiveView.createArchiveNode(entry);
}

function renderCategories() {
  categoriesController.renderCategories();
}

function saveTaskFromForm(event) {
  taskFormController.saveTaskFromForm(event);
}

function saveGoalFromForm(event) {
  goalsView.saveGoalFromForm(event);
}

function resetGoalForm() {
  goalsView.resetGoalForm();
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
    scheduleMode: parsed.scheduleMode || "deadline",
    startTime: parsed.startTime || "",
    endTime: parsed.endTime || "",
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
    parsed.scheduleMode === "block" ? formatTaskWindow(parsed) : parsed.time ? formatTaskTime(parsed.time) : "без времени",
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
  const isCustom = els.taskRepeat.value === "custom" && interfaceMode === "advanced";
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
  const isCustom = els.habitRepeat.value === "custom" && interfaceMode === "advanced";
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

function getTaskScheduleMode() {
  return els.taskScheduleBlock?.checked ? "block" : "deadline";
}

function setTaskScheduleMode(mode = "deadline") {
  const isBlock = mode === "block";
  if (els.taskScheduleDeadline) els.taskScheduleDeadline.checked = !isBlock;
  if (els.taskScheduleBlock) els.taskScheduleBlock.checked = isBlock;
}

function syncTaskScheduleMode() {
  const isBlock = getTaskScheduleMode() === "block";
  if (els.taskDeadlineTimeField) els.taskDeadlineTimeField.hidden = isBlock;
  if (els.taskBlockTimeFields) els.taskBlockTimeFields.hidden = !isBlock;
}

function fillTaskForm(task) {
  if (activeView === "timeline") openFloatingTaskForm();
  taskFormController.fillTaskForm(task);
}

function resetTaskForm() {
  taskFormController.resetTaskForm();
}

function saveHabitFromForm(event) {
  habitFormController.saveHabitFromForm(event);
}

function fillHabitForm(habit) {
  habitFormController.fillHabitForm(habit);
}

function resetHabitForm() {
  habitFormController.resetHabitForm();
}

function saveCategoryFromForm(event) {
  categoriesController.saveCategoryFromForm(event);
}

function deleteCategory(categoryId) {
  categoriesController.deleteCategory(categoryId);
}

function moveTaskTime(taskId, targetTime) {
  return updateTaskTime(taskId, targetTime, "Время задачи обновлено");
}

function shiftTaskTime(taskId, offsetMinutes) {
  const task = state.tasks.find((item) => item.id === taskId);
  const currentMinutes = timeToMinutes(taskSortTime(task));
  if (!Number.isFinite(currentMinutes)) return;
  const nextMinutes = Math.max(0, Math.min(23 * 60 + 59, currentMinutes + offsetMinutes));
  updateTaskTime(taskId, minutesToTime(nextMinutes), `Перенесено на ${formatTime(minutesToTime(nextMinutes))}`);
}

function setTaskTime(taskId, targetTime) {
  return updateTaskTime(taskId, targetTime, `Перенесено на ${formatTime(targetTime)}`);
}

function updateTaskTime(taskId, targetTime, message) {
  const task = state.tasks.find((item) => item.id === taskId);
  const nextTime = cleanTimeValue(targetTime);
  if (!task || !nextTime || taskSortTime(task) === nextTime) return;

  const undo = createUndoSnapshot();
  if (isTimeBlock(task)) {
    const duration = timeToMinutes(task.endTime) - timeToMinutes(task.startTime);
    const nextStart = timeToMinutes(nextTime);
    const nextEnd = Math.min(23 * 60 + 59, nextStart + duration);
    task.startTime = minutesToTime(Math.max(0, nextEnd - duration));
    task.endTime = minutesToTime(nextEnd);
    task.time = task.endTime;
    task.scheduleMode = "block";
  } else {
    task.time = nextTime;
    task.scheduleMode = "deadline";
    task.startTime = "";
    task.endTime = "";
  }
  if (task.notified) delete task.notified[activeDate];
  saveState();
  render();
  showToast(message || "Время задачи обновлено", { undo });
}

function resizeTaskBlockTime(taskId, startTime, endTime) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !isValidTimeBlock(startTime, endTime)) return;
  const nextStart = cleanTimeValue(startTime);
  const nextEnd = cleanTimeValue(endTime);
  if (task.startTime === nextStart && task.endTime === nextEnd) return;

  const undo = createUndoSnapshot();
  task.scheduleMode = "block";
  task.startTime = nextStart;
  task.endTime = nextEnd;
  task.time = nextEnd;
  if (task.notified) delete task.notified[activeDate];
  saveState();
  render();
  showToast(`Блок обновлен: ${formatTaskWindow(task)}`, { undo });
}

function createTaskAtTime(startTime, endTime) {
  resetTaskForm();
  openFloatingTaskForm();
  setTaskScheduleMode("block");
  els.taskDate.value = activeDate;
  els.taskStartTime.value = cleanTimeValue(startTime);
  els.taskEndTime.value = cleanTimeValue(endTime);
  els.taskTime.value = "";
  els.taskReminder.value = "15";
  syncTaskScheduleMode();
  syncTaskTimePresets();
  els.taskFormPanel.classList.remove("is-collapsed");
  els.taskTitle.focus();
}

function openFloatingTaskForm() {
  if (!els.taskFormPanel || !taskFormHome.parent) return;
  if (!els.taskFormPanel.classList.contains("is-floating-panel")) {
    document.body.appendChild(els.taskFormPanel);
    els.taskFormPanel.classList.add("is-floating-panel");
  }
  document.body.classList.add("has-floating-task-form");
  els.taskFormPanel.classList.remove("is-collapsed");
}

function closeFloatingTaskForm() {
  document.body.classList.remove("has-floating-task-form");
}

function restoreTaskFormPanel() {
  if (!els.taskFormPanel || !taskFormHome.parent || !els.taskFormPanel.classList.contains("is-floating-panel")) return;
  taskFormHome.parent.insertBefore(els.taskFormPanel, taskFormHome.next);
  els.taskFormPanel.classList.remove("is-floating-panel");
  document.body.classList.remove("has-floating-task-form");
}

function exportData() {
  importExportController.exportData();
}

async function importData() {
  return importExportController.importData();
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
  const timeDiff = timeValue(taskSortTime(a)).localeCompare(timeValue(taskSortTime(b)));
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
  if (taskHasSchedule(task)) details.push(formatTaskScheduleLabel(task));
  if (category) details.push(category.name);
  if (task.repeat !== "none") details.push(formatTaskRepeat(task));
  if (taskHasSchedule(task) && task.reminderOffset !== "none") details.push(reminderLabel(task.reminderOffset));
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
    task.startTime,
    task.endTime,
    formatTime(task.time),
    formatTaskScheduleLabel(task),
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

  if (taskHasSchedule(task)) chips.push(`<span class="task-meta-chip">${escapeHtml(formatTaskScheduleLabel(task))}</span>`);
  if (task.repeat !== "none") chips.push(`<span class="task-meta-chip">${escapeHtml(formatTaskRepeat(task))}</span>`);
  if (taskHasSchedule(task) && task.reminderOffset !== "none") {
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
  notificationsController.checkDueNotifications();
}

async function requestNotifications() {
  notificationSetting = "on";
  applySettingsPreferences();
  saveUiState();
  return notificationsController.requestNotifications();
}

function updateNotificationButton(permission = "Notification" in window ? Notification.permission : "default") {
  notificationsController.updateNotificationButton(permission);
}

function syncDesktopReminders() {
  notificationsController.syncDesktopReminders();
}

function syncDesktopBackup() {
  importExportController.syncDesktopBackup();
}

async function updateFileBackupStatus() {
  return importExportController.updateFileBackupStatus();
}

async function openBackupFolder() {
  return importExportController.openBackupFolder();
}

function candidateReminderDates(task, now) {
  return notificationsController.candidateReminderDates(task, now);
}

function getDueDate(task, dateKey) {
  return notificationsController.getDueDate(task, dateKey);
}

function getTaskDeadlineDate(task, dateKey) {
  return notificationsController.getTaskDeadlineDate(task, dateKey);
}

function getReminderDate(task, dateKey) {
  return notificationsController.getReminderDate(task, dateKey);
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

function saveUiState() {
  storage.saveUiState({
    archiveCategoryFilter,
    archiveSearchQuery,
    backupSchedule,
    densityPreference,
    firstDayOfWeek,
    interfaceMode,
    notificationSetting,
    remoteSyncAnonKey,
    remoteSyncEnabled,
    remoteSyncLastPulledAt,
    remoteSyncLastPushedAt,
    remoteSyncUrl,
    remoteSyncUserKey,
    taskCategoryFilter,
    taskSearchQuery,
    themePreference,
    timeFormat,
  });
}

function normalizeThemePreference(value) {
  return ["dark", "light", "system"].includes(value) ? value : "dark";
}

function normalizeNotificationSetting(value) {
  return value === "off" ? "off" : "on";
}

function normalizeBackupSchedule(value) {
  const schedule = String(value ?? "5");
  return VALID_BACKUP_SCHEDULES.includes(schedule) ? schedule : "5";
}

function normalizeFirstDayOfWeek(value) {
  return value === "sunday" ? "sunday" : "monday";
}

function normalizeDensityPreference(value) {
  return value === "compact" ? "compact" : "comfortable";
}

function normalizeInterfaceMode(value) {
  return value === "advanced" ? "advanced" : "simple";
}

function normalizeTimeFormat(value) {
  return value === "12" ? "12" : "24";
}

function normalizeRemoteSyncEnabled(value) {
  return value === true || value === "on" ? "on" : "off";
}

function normalizeRemoteUserKey(value) {
  return window.RhythmRemoteSync.normalizeUserKey(value);
}

function applyThemePreference() {
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
  const resolvedTheme = themePreference === "system" ? (prefersLight ? "light" : "dark") : themePreference;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = themePreference;
  if (els.themePreference) els.themePreference.value = themePreference;
}

function applySettingsPreferences() {
  document.documentElement.dataset.density = densityPreference;
  document.documentElement.dataset.interfaceMode = interfaceMode;
  if (els.notificationSetting) els.notificationSetting.value = notificationSetting;
  if (els.backupSchedule) els.backupSchedule.value = backupSchedule;
  if (els.firstDayOfWeek) els.firstDayOfWeek.value = firstDayOfWeek;
  if (els.densityPreference) els.densityPreference.value = densityPreference;
  if (els.interfaceMode) els.interfaceMode.value = interfaceMode;
  if (els.timeFormat) els.timeFormat.value = timeFormat;
  if (els.remoteSyncEnabled) els.remoteSyncEnabled.value = remoteSyncEnabled;
  if (els.remoteSyncUrl) els.remoteSyncUrl.value = remoteSyncUrl;
  if (els.remoteSyncAnonKey) els.remoteSyncAnonKey.value = remoteSyncAnonKey;
  if (els.remoteSyncUserKey) els.remoteSyncUserKey.value = remoteSyncUserKey;
  syncCustomRepeatPanel();
  syncHabitCustomRepeatPanel();
  if (els.goalAdvancedPanel && !els.goalId?.value) {
    els.goalAdvancedPanel.open = interfaceMode === "advanced";
  }
}

function getUiSettings() {
  return {
    backupSchedule,
    densityPreference,
    firstDayOfWeek,
    interfaceMode,
    notificationSetting,
    remoteSyncAnonKey,
    remoteSyncEnabled,
    remoteSyncLastPulledAt,
    remoteSyncLastPushedAt,
    remoteSyncUrl,
    remoteSyncUserKey,
    themePreference,
    timeFormat,
  };
}

function updateSetting(name, value) {
  switch (name) {
    case "themePreference":
      themePreference = normalizeThemePreference(value);
      applyThemePreference();
      saveUiState();
      settingsController.syncControls();
      showToast("Тема обновлена");
      break;
    case "notificationSetting":
      notificationSetting = normalizeNotificationSetting(value);
      saveUiState();
      settingsController.syncControls();
      updateNotificationButton();
      syncDesktopReminders();
      showToast(notificationSetting === "on" ? "Напоминания включены" : "Напоминания на паузе");
      break;
    case "backupSchedule":
      backupSchedule = normalizeBackupSchedule(value);
      saveUiState();
      scheduleAutoBackup();
      settingsController.syncControls();
      showToast(backupSchedule === "0" ? "Плановый бэкап выключен" : "Расписание бэкапа обновлено");
      break;
    case "firstDayOfWeek":
      firstDayOfWeek = normalizeFirstDayOfWeek(value);
      saveUiState();
      settingsController.syncControls();
      render();
      showToast("Календарь обновлен");
      break;
    case "densityPreference":
      densityPreference = normalizeDensityPreference(value);
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      showToast("Плотность интерфейса обновлена");
      break;
    case "interfaceMode":
      interfaceMode = normalizeInterfaceMode(value);
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      render();
      showToast(interfaceMode === "advanced" ? "Расширенный режим включен" : "Простой режим включен");
      break;
    case "timeFormat":
      timeFormat = normalizeTimeFormat(value);
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      render();
      showToast("Формат времени обновлен");
      break;
    case "remoteSyncEnabled":
      remoteSyncEnabled = normalizeRemoteSyncEnabled(value);
      remoteSyncLastError = "";
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      renderRemoteSyncStatus();
      if (isRemoteSyncReady()) scheduleRemotePush();
      showToast(remoteSyncEnabled === "on" ? "Синхронизация с БД включена" : "Синхронизация с БД выключена");
      break;
    case "remoteSyncUrl":
      remoteSyncUrl = cleanText(value);
      remoteSyncLastError = "";
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      renderRemoteSyncStatus();
      break;
    case "remoteSyncAnonKey":
      remoteSyncAnonKey = cleanText(value);
      remoteSyncLastError = "";
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      renderRemoteSyncStatus();
      break;
    case "remoteSyncUserKey":
      remoteSyncUserKey = normalizeRemoteUserKey(value);
      remoteSyncLastError = "";
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      renderRemoteSyncStatus();
      break;
  }
}

function exportSettings() {
  const payload = {
    app: "Ритм дня",
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    settings: getUiSettings(),
    type: "settings",
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ritm-dnya-settings-${toDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Настройки экспортированы");
}

async function importSettings() {
  const file = els.settingsImportFile?.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    applyImportedSettings(parsed.settings || parsed);
    saveUiState();
    render();
    showToast("Настройки импортированы");
  } catch {
    showToast("Не удалось импортировать настройки");
  } finally {
    if (els.settingsImportFile) els.settingsImportFile.value = "";
  }
}

async function resetInterfaceSettings() {
  const confirmed = await confirmAction({
    confirmLabel: "Сбросить",
    message: "Тема, плотность, формат времени и первый день недели вернутся к настройкам по умолчанию. Данные задач и привычек не изменятся.",
    tone: "danger",
    title: "Сбросить настройки интерфейса?",
  });
  if (!confirmed) return;

  themePreference = "dark";
  densityPreference = "comfortable";
  interfaceMode = "simple";
  timeFormat = "24";
  firstDayOfWeek = "monday";
  applyThemePreference();
  applySettingsPreferences();
  saveUiState();
  settingsController.syncControls();
  render();
  showToast("Настройки интерфейса сброшены");
}

function applyImportedSettings(settings = {}) {
  themePreference = normalizeThemePreference(settings.themePreference);
  notificationSetting = normalizeNotificationSetting(settings.notificationSetting);
  backupSchedule = normalizeBackupSchedule(settings.backupSchedule);
  firstDayOfWeek = normalizeFirstDayOfWeek(settings.firstDayOfWeek);
  densityPreference = normalizeDensityPreference(settings.densityPreference);
  interfaceMode = normalizeInterfaceMode(settings.interfaceMode);
  timeFormat = normalizeTimeFormat(settings.timeFormat);
  remoteSyncEnabled = normalizeRemoteSyncEnabled(settings.remoteSyncEnabled);
  remoteSyncUrl = cleanText(settings.remoteSyncUrl || "");
  remoteSyncAnonKey = cleanText(settings.remoteSyncAnonKey || "");
  remoteSyncUserKey = normalizeRemoteUserKey(settings.remoteSyncUserKey || "");
  remoteSyncLastPulledAt = settings.remoteSyncLastPulledAt || "";
  remoteSyncLastPushedAt = settings.remoteSyncLastPushedAt || "";
  remoteSyncLastError = "";
  applyThemePreference();
  applySettingsPreferences();
  scheduleAutoBackup();
  settingsController.syncControls();
  renderRemoteSyncStatus();
  updateNotificationButton();
  syncDesktopReminders();
}

function renderSettingsBackupStatus() {
  if (!els.settingsBackupStatus) return;
  if (backupSchedule === "0") {
    els.settingsBackupStatus.textContent = "Авто-бэкап выключен";
    return;
  }
  const last = lastAutoBackupAt ? formatBackupDate(lastAutoBackupAt) : "еще не запускался";
  const next = nextAutoBackupAt ? formatBackupDate(nextAutoBackupAt) : "ожидает расписание";
  els.settingsBackupStatus.textContent = `Последний авто-бэкап: ${last} · следующий: ${next}`;
}

function getRemoteSyncConfig() {
  return remoteSync.normalizeConfig({
    anonKey: remoteSyncAnonKey,
    enabled: remoteSyncEnabled === "on",
    supabaseUrl: remoteSyncUrl,
    userKey: remoteSyncUserKey,
  });
}

function isRemoteSyncReady() {
  return remoteSync.isConfigured(getRemoteSyncConfig());
}

function renderRemoteSyncStatus() {
  if (!els.remoteSyncStatus) return;
  if (remoteSyncEnabled !== "on") {
    els.remoteSyncStatus.textContent = "Удаленная БД выключена";
    return;
  }
  if (!isRemoteSyncReady()) {
    els.remoteSyncStatus.textContent = "Заполни Supabase URL, anon key и ключ пользователя";
    return;
  }
  if (remoteSyncLastError) {
    els.remoteSyncStatus.textContent = `Ошибка синхронизации: ${remoteSyncLastError}`;
    return;
  }
  const pushed = remoteSyncLastPushedAt ? formatBackupDate(remoteSyncLastPushedAt) : "еще не сохранялось";
  const pulled = remoteSyncLastPulledAt ? formatBackupDate(remoteSyncLastPulledAt) : "еще не загружалось";
  els.remoteSyncStatus.textContent = remoteSyncInFlight
    ? "Синхронизация с БД..."
    : `БД подключена · сохранено: ${pushed} · загружено: ${pulled}`;
}

function scheduleRemotePush() {
  if (!isRemoteSyncReady()) {
    renderRemoteSyncStatus();
    return;
  }
  if (remoteSyncTimerId) clearTimeout(remoteSyncTimerId);
  remoteSyncTimerId = setTimeout(() => {
    remoteSyncTimerId = null;
    pushRemoteState({ silent: true });
  }, 1200);
}

async function pushRemoteState(options = {}) {
  if (options?.preventDefault) options.preventDefault();
  const manual = !options?.silent;
  if (!isRemoteSyncReady()) {
    renderRemoteSyncStatus();
    if (manual) showToast("Заполни настройки удаленной БД");
    return;
  }
  if (remoteSyncInFlight) return;

  remoteSyncInFlight = true;
  remoteSyncLastError = "";
  renderRemoteSyncStatus();
  try {
    const pushedAt = new Date().toISOString();
    await remoteSync.pushState(getRemoteSyncConfig(), {
      clientUpdatedAt: pushedAt,
      schemaVersion: SCHEMA_VERSION,
      state,
      uiState: { ...getUiSettings(), remoteSyncLastPushedAt: pushedAt },
    });
    remoteSyncLastPushedAt = pushedAt;
    saveUiState();
    if (manual) showToast("Данные сохранены в БД");
  } catch (error) {
    remoteSyncLastError = error.message || "неизвестная ошибка";
    if (manual) showToast("Не удалось сохранить данные в БД");
  } finally {
    remoteSyncInFlight = false;
    settingsController.syncControls();
    renderRemoteSyncStatus();
  }
}

async function pullRemoteState(options = {}) {
  if (options?.preventDefault) options.preventDefault();
  if (!isRemoteSyncReady()) {
    renderRemoteSyncStatus();
    showToast("Заполни настройки удаленной БД");
    return;
  }

  const confirmed = await confirmAction({
    confirmLabel: "Загрузить",
    message: "Локальные данные будут заменены состоянием из БД. Перед заменой приложение создаст safety backup.",
    tone: "danger",
    title: "Загрузить данные из БД?",
  });
  if (!confirmed || remoteSyncInFlight) return;

  remoteSyncInFlight = true;
  remoteSyncLastError = "";
  renderRemoteSyncStatus();
  try {
    const pulled = await remoteSync.pullState(getRemoteSyncConfig());
    if (!pulled.found || !pulled.state) {
      showToast("В БД пока нет сохраненных данных");
      return;
    }
    const undo = createUndoSnapshot();
    createImportSafetyBackup({ state: JSON.stringify(state) });
    replaceState(pulled.state);
    saveState({ skipBackup: true, skipRemote: true });
    remoteSyncLastPulledAt = new Date().toISOString();
    saveUiState();
    render();
    showToast("Данные загружены из БД", { undo });
  } catch (error) {
    remoteSyncLastError = error.message || "неизвестная ошибка";
    showToast("Не удалось загрузить данные из БД");
  } finally {
    remoteSyncInFlight = false;
    settingsController.syncControls();
    renderRemoteSyncStatus();
  }
}

function scheduleAutoBackup() {
  if (autoBackupTimerId) {
    clearInterval(autoBackupTimerId);
    autoBackupTimerId = null;
  }

  const minutes = Number(backupSchedule);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    nextAutoBackupAt = "";
    renderSettingsBackupStatus();
    return;
  }

  const intervalMs = minutes * 60 * 1000;
  nextAutoBackupAt = new Date(Date.now() + intervalMs).toISOString();
  renderSettingsBackupStatus();

  autoBackupTimerId = setInterval(() => {
    createBackup({ silent: true });
    syncDesktopBackup();
    lastAutoBackupAt = new Date().toISOString();
    nextAutoBackupAt = new Date(Date.now() + intervalMs).toISOString();
    renderSettingsBackupStatus();
  }, intervalMs);
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

function timeToMinutes(value) {
  const time = cleanTimeValue(value);
  if (!time) return NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const minutes = Math.max(0, Math.min(23 * 60 + 59, Number(value) || 0));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatTime(value) {
  const time = cleanTimeValue(value);
  if (!time) return "";
  if (timeFormat === "24") return time;
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatTaskTime(value) {
  const formatted = formatTime(value);
  return formatted ? `до ${formatted}` : "";
}

function isTimeBlock(task) {
  return task?.scheduleMode === "block" && isValidTimeBlock(task.startTime, task.endTime);
}

function isValidTimeBlock(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function taskHasSchedule(task) {
  return isTimeBlock(task) || Boolean(cleanTimeValue(task?.time));
}

function taskSortTime(task) {
  return isTimeBlock(task) ? task.startTime : task?.time || "";
}

function formatTaskWindow(task) {
  if (!isValidTimeBlock(task?.startTime, task?.endTime)) return "";
  return `${formatTime(task.startTime)}-${formatTime(task.endTime)}`;
}

function formatTaskScheduleLabel(task) {
  return isTimeBlock(task) ? formatTaskWindow(task) : formatTaskTime(task.time);
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
  const time = getTaskScheduleMode() === "block" ? cleanTimeValue(els.taskStartTime.value) : cleanTimeValue(els.taskTime.value);
  document.querySelectorAll("[data-time-preset]").forEach((button) => {
    const preset = button.dataset.timePreset || "";
    button.classList.toggle("is-active", preset === time);
  });
}

function normalizeState(raw) {
  return stateNormalizer.normalizeState(raw);
}

function replaceState(nextState) {
  state = normalizeState(nextState);
}

function saveState(options = {}) {
  state = storage.saveState(state, {
    schemaVersion: SCHEMA_VERSION,
    skipBackup: options.skipBackup,
  });
  if (!options.skipBackup) updateBackupStatus();
  syncDesktopReminders();
  if (!options.skipBackup) syncDesktopBackup();
  if (!options.skipBackup && !options.skipRemote) scheduleRemotePush();
}

function createBackup(options = {}) {
  return importExportController.createBackup(options);
}

function createImportSafetyBackup(snapshot) {
  return importExportController.createImportSafetyBackup(snapshot);
}

function restoreBackup() {
  return importExportController.restoreBackup();
}

function loadBackup() {
  return importExportController.loadBackup();
}

function updateBackupStatus() {
  importExportController.updateBackupStatus();
}

function formatBackupDate(value) {
  return importExportController.formatBackupDate(value);
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

  if (state.tasks.length || state.habits.length || state.goals.length) {
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
  const offset = (date.getDay() - firstDayIndex() + 7) % 7;
  date.setDate(date.getDate() - offset);

  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(date);
    item.setDate(date.getDate() + index);
    return toDateKey(item);
  });
}

function getMonthCalendarDates(dateKey) {
  const date = parseDate(dateKey);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (firstDay.getDay() - firstDayIndex() + 7) % 7;
  firstDay.setDate(firstDay.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const item = new Date(firstDay);
    item.setDate(firstDay.getDate() + index);
    return toDateKey(item);
  });
}

function firstDayIndex() {
  return firstDayOfWeek === "sunday" ? 0 : 1;
}

function renderWeekdayLabels() {
  if (!els.monthWeekdays) return;
  const mondayFirst = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const sundayFirst = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  els.monthWeekdays.replaceChildren(
    ...(firstDayOfWeek === "sunday" ? sundayFirst : mondayFirst).map((label) => {
      const node = document.createElement("span");
      node.textContent = label;
      return node;
    }),
  );
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

function confirmAction(options = {}) {
  return confirmDialog.confirm(options);
}
