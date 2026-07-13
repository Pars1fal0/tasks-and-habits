const SCHEMA_VERSION = 9;
const VALID_PRIORITIES = ["high", "medium", "low"];
const VALID_HABIT_REPEATS = ["daily", "every2days", "every3days", "weekdays", "weekends", "weekly", "custom"];
const VALID_REMINDER_OFFSETS = ["none", "0", "5", "15", "30", "60", "1440"];
const VALID_BACKUP_SCHEDULES = ["0", "5", "15", "30", "60"];

const appUtils = window.RhythmAppUtils.createAppUtils({
  getFirstDayOfWeek: () => firstDayOfWeek,
  getTimeFormat: () => timeFormat,
});
const {
  addDays,
  cleanText,
  cleanTimeValue,
  createId,
  escapeHtml,
  firstDayIndex,
  formatLongDate,
  formatMonthLabel,
  formatShortDate,
  formatTime,
  formatWeekday,
  getMonthCalendarDates,
  getWeekDates,
  heatAlpha,
  minutesToTime,
  normalizeDateKey,
  parseDate,
  randomCategoryColor,
  sanitizeColor,
  timeToMinutes,
  toDateKey,
  toTimeValue,
} = appUtils;

const storage = window.RhythmStorage.createLocalStorageAdapter({
  appName: "Ритм дня",
  schemaVersion: SCHEMA_VERSION,
});
const settingsState = window.RhythmSettingsState.createSettingsState({
  cleanText,
  normalizeRemoteUserKey: window.RhythmRemoteSync.normalizeUserKey,
  validBackupSchedules: VALID_BACKUP_SCHEDULES,
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
let currentToday = activeDate;
let activeView = "tasks";
let taskFilter = "all";
const initialUiState = storage.loadUiState();
let taskCategoryFilter = initialUiState.taskCategoryFilter || "all";
let taskSearchQuery = initialUiState.taskSearchQuery || "";
let archiveCategoryFilter = initialUiState.archiveCategoryFilter || "all";
let archiveSearchQuery = initialUiState.archiveSearchQuery || "";
let overdueHidden = initialUiState.overdueHidden === true;
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
let localStateUpdatedAt = initialUiState.localStateUpdatedAt || "";
let autoBackupTimerId = null;
let lastAutoBackupAt = "";
let nextAutoBackupAt = "";

const overdueController = window.RhythmOverdueController.createOverdueController({
  getCacheKey: () => localStateUpdatedAt,
  getTaskDeadlineDate,
  getTasks: () => state.tasks,
  isAcknowledged: (task, dateKey) => task.acknowledgedOverdue?.[dateKey] === true,
  isTaskDone,
  isTaskExcluded,
  taskScheduledOn,
  toDateKey,
});
const taskState = window.RhythmTaskState.createTaskState({ getState: () => state });

const els = {
  activeDate: document.querySelector("#activeDate"),
  archiveCategoryFilter: document.querySelector("#archiveCategoryFilter"),
  archiveBulkBar: document.querySelector("#archiveBulkBar"),
  archiveBulkCount: document.querySelector("#archiveBulkCount"),
  archiveBulkDelete: document.querySelector("#archiveBulkDelete"),
  archiveBulkRestore: document.querySelector("#archiveBulkRestore"),
  archiveEmpty: document.querySelector("#archiveEmpty"),
  archiveList: document.querySelector("#archiveList"),
  archivePeriodFilter: document.querySelector("#archivePeriodFilter"),
  archiveSearch: document.querySelector("#archiveSearch"),
  archiveSelectAll: document.querySelector("#archiveSelectAll"),
  backupStatus: document.querySelector("#backupStatus"),
  backupSchedule: document.querySelector("#backupSchedule"),
  categoryColor: document.querySelector("#categoryColor"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryId: document.querySelector("#categoryId"),
  categoryList: document.querySelector("#categoryList"),
  categoryName: document.querySelector("#categoryName"),
  clearArchiveFilter: document.querySelector("#clearArchiveFilter"),
  clearTaskSearch: document.querySelector("#clearTaskSearch"),
  closeGoalForm: document.querySelector("#closeGoalForm"),
  confirmAccept: document.querySelector("#confirmAccept"),
  confirmCancel: document.querySelector("#confirmCancel"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmSecondary: document.querySelector("#confirmSecondary"),
  confirmTitle: document.querySelector("#confirmTitle"),
  desktopStatus: document.querySelector("#desktopStatus"),
  densityPreference: document.querySelector("#densityPreference"),
  exportButton: document.querySelector("#exportButton"),
  excludedList: document.querySelector("#excludedList"),
  excludedPanel: document.querySelector("#excludedPanel"),
  endedSeriesCount: document.querySelector("#endedSeriesCount"),
  endedSeriesList: document.querySelector("#endedSeriesList"),
  endedSeriesPanel: document.querySelector("#endedSeriesPanel"),
  focusBar: document.querySelector("#focusBar"),
  focusMeta: document.querySelector("#focusMeta"),
  focusPercent: document.querySelector("#focusPercent"),
  focusTitle: document.querySelector("#focusTitle"),
  fileBackupStatus: document.querySelector("#fileBackupStatus"),
  firstDayOfWeek: document.querySelector("#firstDayOfWeek"),
  goalActiveMetric: document.querySelector("#goalActiveMetric"),
  addGoalCheckpoint: document.querySelector("#addGoalCheckpoint"),
  goalCheckpointEmpty: document.querySelector("#goalCheckpointEmpty"),
  goalCheckpointInput: document.querySelector("#goalCheckpointInput"),
  goalCheckpointList: document.querySelector("#goalCheckpointList"),
  goalDoneMetric: document.querySelector("#goalDoneMetric"),
  goalDueDate: document.querySelector("#goalDueDate"),
  goalEmpty: document.querySelector("#goalEmpty"),
  goalForm: document.querySelector("#goalForm"),
  goalFormHeading: document.querySelector("#goalFormHeading"),
  goalFormPanel: document.querySelector("#goalFormPanel"),
  goalId: document.querySelector("#goalId"),
  goalList: document.querySelector("#goalList"),
  goalOverdueMetric: document.querySelector("#goalOverdueMetric"),
  goalTitle: document.querySelector("#goalTitle"),
  habitDoneMetric: document.querySelector("#habitDoneMetric"),
  habitEmpty: document.querySelector("#habitEmpty"),
  habitArchiveCount: document.querySelector("#habitArchiveCount"),
  habitArchiveList: document.querySelector("#habitArchiveList"),
  habitArchivePanel: document.querySelector("#habitArchivePanel"),
  habitForm: document.querySelector("#habitForm"),
  habitFormHeading: document.querySelector("#habitFormHeading"),
  habitFormPanel: document.querySelector("#habitFormPanel"),
  habitGoal: document.querySelector("#habitGoal"),
  habitCustomRepeatInterval: document.querySelector("#habitCustomRepeatInterval"),
  habitCustomRepeatMonthDay: document.querySelector("#habitCustomRepeatMonthDay"),
  habitCustomRepeatPanel: document.querySelector("#habitCustomRepeatPanel"),
  habitCustomRepeatSummary: document.querySelector("#habitCustomRepeatSummary"),
  habitId: document.querySelector("#habitId"),
  habitList: document.querySelector("#habitList"),
  historicalTaskCount: document.querySelector("#historicalTaskCount"),
  historicalTaskList: document.querySelector("#historicalTaskList"),
  historicalTaskPanel: document.querySelector("#historicalTaskPanel"),
  habitNumericFields: document.querySelector("#habitNumericFields"),
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
  navMore: document.querySelector(".nav-more"),
  navMoreSummary: document.querySelector(".nav-more-summary"),
  navTabs: document.querySelectorAll(".nav-tab[data-view]"),
  nextDay: document.querySelector("#nextDay"),
  nextMonth: document.querySelector("#nextMonth"),
  notificationSetting: document.querySelector("#notificationSetting"),
  notifyButton: document.querySelector("#notifyButton"),
  openGoalForm: document.querySelector("#openGoalForm"),
  openHabitForm: document.querySelector("#openHabitForm"),
  openBackupFolderButton: document.querySelector("#openBackupFolderButton"),
  openTaskForm: document.querySelector("#openTaskForm"),
  overdueCounter: document.querySelector("#overdueCounter"),
  overdueAcknowledgeAll: document.querySelector("#overdueAcknowledgeAll"),
  overdueList: document.querySelector("#overdueList"),
  overduePanel: document.querySelector("#overduePanel"),
  overdueToggle: document.querySelector("#overdueToggle"),
  pageTitle: document.querySelector("#pageTitle"),
  prevDay: document.querySelector("#prevDay"),
  prevMonth: document.querySelector("#prevMonth"),
  customRepeatInterval: document.querySelector("#customRepeatInterval"),
  customRepeatMonthDay: document.querySelector("#customRepeatMonthDay"),
  customRepeatPanel: document.querySelector("#customRepeatPanel"),
  customRepeatSummary: document.querySelector("#customRepeatSummary"),
  quickTaskForm: document.querySelector("#quickTaskForm"),
  quickTaskInput: document.querySelector("#quickTaskInput"),
  quickInputHints: document.querySelector("#quickInputHints"),
  quickTaskPreview: document.querySelector("#quickTaskPreview"),
  remoteSyncAnonKey: document.querySelector("#remoteSyncAnonKey"),
  remoteAuthEmail: document.querySelector("#remoteAuthEmail"),
  remoteAuthPassword: document.querySelector("#remoteAuthPassword"),
  remoteAuthSignInButton: document.querySelector("#remoteAuthSignInButton"),
  remoteAuthSignOutButton: document.querySelector("#remoteAuthSignOutButton"),
  remoteAuthSignUpButton: document.querySelector("#remoteAuthSignUpButton"),
  remoteAuthStatus: document.querySelector("#remoteAuthStatus"),
  remoteSyncCheckButton: document.querySelector("#remoteSyncCheckButton"),
  remoteSyncEnabled: document.querySelector("#remoteSyncEnabled"),
  remoteSyncGenerateKeyButton: document.querySelector("#remoteSyncGenerateKeyButton"),
  remoteSyncHistory: document.querySelector("#remoteSyncHistory"),
  remoteSyncPullButton: document.querySelector("#remoteSyncPullButton"),
  remoteSyncPushButton: document.querySelector("#remoteSyncPushButton"),
  remoteSyncStatus: document.querySelector("#remoteSyncStatus"),
  remoteSyncUrl: document.querySelector("#remoteSyncUrl"),
  remoteSyncUserKey: document.querySelector("#remoteSyncUserKey"),
  resetHabitForm: document.querySelector("#resetHabitForm"),
  resetGoalForm: document.querySelector("#resetGoalForm"),
  resetTaskForm: document.querySelector("#resetTaskForm"),
  restoreBackupButton: document.querySelector("#restoreBackupButton"),
  saveStatus: document.querySelector("#saveStatus"),
  settingsExportButton: document.querySelector("#settingsExportButton"),
  settingsExportSettingsButton: document.querySelector("#settingsExportSettingsButton"),
  settingsBackupStatus: document.querySelector("#settingsBackupStatus"),
  settingsImportFile: document.querySelector("#settingsImportFile"),
  settingsImportDataButton: document.querySelector("#settingsImportDataButton"),
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
  taskFormHeading: document.querySelector("#taskFormHeading"),
  taskFormPanel: document.querySelector("#taskFormPanel"),
  taskId: document.querySelector("#taskId"),
  taskBlockTimeFields: document.querySelector("#taskBlockTimeFields"),
  taskList: document.querySelector("#taskList"),
  taskPriority: document.querySelector("#taskPriority"),
  taskProgress: document.querySelector("#taskProgress"),
  taskProgressRing: document.querySelector("#taskProgressRing"),
  taskScheduleBlock: document.querySelector("#taskScheduleBlock"),
  taskScheduleDeadline: document.querySelector("#taskScheduleDeadline"),
  taskScheduleNone: document.querySelector("#taskScheduleNone"),
  taskReminder: document.querySelector("#taskReminder"),
  taskReminderField: document.querySelector("#taskReminderField"),
  taskRepeat: document.querySelector("#taskRepeat"),
  taskRepeatUntil: document.querySelector("#taskRepeatUntil"),
  taskRepeatUntilField: document.querySelector("#taskRepeatUntilField"),
  taskRepeatEditHint: document.querySelector("#taskRepeatEditHint"),
  taskRepeatEditScope: document.querySelector("#taskRepeatEditScope"),
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
  timelineScaleButtons: [...document.querySelectorAll("[data-timeline-scale]")],
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
const remoteSyncController = window.RhythmRemoteSyncController.createRemoteSyncController();
const remoteAuth = window.RhythmRemoteAuth.createRemoteAuth({
  getConfig: () => ({ anonKey: remoteSyncAnonKey, supabaseUrl: remoteSyncUrl }),
});
const syncHistory = window.RhythmSyncHistory.createSyncHistory();
const taskScheduleController = window.RhythmTaskSchedule.createTaskSchedule({
  cleanTimeValue,
  els,
  minutesToTime,
  timeToMinutes,
});
const getTaskScheduleMode = taskScheduleController.getMode;
const setTaskScheduleMode = taskScheduleController.setMode;
const syncTaskScheduleMode = taskScheduleController.syncMode;
const syncTaskTimePresets = taskScheduleController.syncPresets;
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
const calendarDragController = window.RhythmCalendarDragController.createCalendarDragController({
  addDays,
  getActiveDate: () => activeDate,
  moveTaskToDate,
  normalizeDateKey,
  openDateTasks,
});

const tasksView = window.RhythmTasksView.createTasksView({
  els,
  priorityLabels,
  addDays,
  acknowledgeOverdueTask,
  acknowledgeAllOverdueTasks,
  clearTaskDragState,
  createUndoSnapshot,
  confirmAction,
  deleteTask,
  deleteMovedReplacement,
  escapeHtml,
  excludeTaskDate,
  excludedTasksForDate,
  endedRecurringTasks,
  fillTaskForm,
  formatLongDate,
  formatTime,
  formatTaskRepeat,
  getActiveDate: () => activeDate,
  getCategory,
  getOrderedTasksForDate,
  getState: () => state,
  getTaskCategoryFilter: () => taskCategoryFilter,
  getTaskFilter: () => taskFilter,
  getTaskSearchQuery: () => taskSearchQuery,
  isTaskDone,
  isTaskExcluded,
  matchesCategoryFilter,
  openDate: (dateKey) => {
    activeDate = dateKey;
    resetTaskForm({ open: false });
    render();
    scrollWorkspaceTop();
  },
  overdueTaskEntries,
  getOverdueHidden: () => overdueHidden,
  setOverdueHidden: (value) => {
    overdueHidden = value === true;
    saveUiState();
  },
  postponeTask,
  render: renderTaskSurfaces,
  reorderTask,
  restoreTaskDate,
  restoreOverdueTask,
  resumeTaskSeries,
  stopTaskSeries,
  saveState,
  setDraggedTask: (taskId, dateKey) => {
    calendarDragController.setDraggedTask(taskId, dateKey);
  },
  showToast,
  taskDetails,
  taskMatchesSearch,
  taskMetaItems,
  taskOccursOn,
  toDateKey,
});

const habitsView = window.RhythmHabitsView.createHabitsView({
  els,
  confirmAction,
  createUndoSnapshot,
  deleteHabit,
  escapeHtml,
  fillHabitForm,
  formatHabitRepeat,
  getActiveDate: () => activeDate,
  getState: () => state,
  isTaskDone,
  habitStreak,
  habitsForDate,
  render: renderHabitSurfaces,
  renderDailyPulse,
  renderOverview,
  reorderHabit,
  saveState,
  showToast,
});

const goalCheckpointEditor = window.RhythmGoalCheckpointEditor.createGoalCheckpointEditor({
  createId,
  els,
});

const goalsView = window.RhythmGoalsView.createGoalsView({
  checkpointEditor: goalCheckpointEditor,
  els,
  cleanText,
  confirmAction,
  createId,
  createUndoSnapshot,
  deleteGoal,
  getActiveDate: () => activeDate,
  getState: () => state,
  normalizeDateKey,
  render: renderGoalSurfaces,
  saveState,
  showToast,
  toDateKey,
  upsertGoal: (goal) => {
    delete state.tombstones?.goals?.[goal.id];
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

const timelineController = window.RhythmTimelineController.createTimelineController({
  cleanTimeValue,
  confirmAction,
  createId,
  createUndoSnapshot,
  deleteTask,
  deleteMovedReplacement,
  excludeTaskDate,
  els,
  findTask: (id) => state.tasks.find((task) => task.id === id),
  formatTaskWindow,
  formatLongDate,
  formatTime,
  getActiveDate: () => activeDate,
  getOrderedTasksForDate,
  getState: () => state,
  isTaskDone,
  isTimeBlock,
  isValidTimeBlock,
  messages: {
    active: "Задача снова активна",
    blockUpdated: "Блок обновлен",
    copySuffix: "копия",
    deleted: "Задача удалена",
    done: "Задача выполнена",
    duplicated: "Задача продублирована",
    movedTo: "Перенесено на",
    timeUpdated: "Время задачи обновлено",
  },
  minutesToTime,
  openFloatingTaskForm,
  render: renderTaskSurfaces,
  resetTaskForm,
  saveState,
  setTaskScheduleMode,
  showToast,
  stopTaskSeries,
  syncTaskScheduleMode,
  syncTaskTimePresets,
  taskSortTime,
  timeToMinutes,
});

const timelineView = window.RhythmTimelineView.createTimelineView({
  els,
  clearTaskTime: timelineController.clearTaskTime,
  createTaskAtTime: timelineController.createTaskAtTime,
  deleteTask: timelineController.deleteTask,
  duplicateTask: timelineController.duplicateTask,
  fillTaskForm,
  formatTime,
  getActiveDate: () => activeDate,
  getCategory,
  getOrderedTasksForDate,
  isTaskDone,
  moveTaskTime: timelineController.moveTaskTime,
  priorityLabels,
  resizeTaskBlockTime: timelineController.resizeTaskBlockTime,
  setTaskTime: timelineController.setTaskTime,
  shiftTaskTime: timelineController.shiftTaskTime,
  toggleTaskDone: timelineController.toggleTaskDone,
  toDateKey,
});

const archiveView = window.RhythmArchiveView.createArchiveView({
  addDays,
  els,
  archiveEntries,
  archiveEntryMatchesSearch,
  confirmAction,
  createUndoSnapshot,
  deleteTask,
  escapeHtml,
  formatLongDate,
  getArchiveCategoryFilter: () => archiveCategoryFilter,
  getArchiveSearchQuery: () => archiveSearchQuery,
  getCategory,
  matchesCategoryFilter,
  postponeTask,
  priorityLabels,
  render: renderTaskSurfaces,
  saveState,
  showToast,
  toDateKey,
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
  normalizeDateKey,
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
  updateRecurringTask: (task, editedTask, dateKey, scope) => window.RhythmTaskMoves.updateRecurringTaskDetails({
    state,
    task,
    editedTask,
    dateKey,
    scope,
    helpers: { createId },
  }),
  upsertTask: (task) => {
    delete state.tombstones?.tasks?.[task.id];
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
  syncHabitTypeFields,
  upsertHabit: (habit) => {
    delete state.tombstones?.habits?.[habit.id];
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
  checkRemoteConnection,
  pullRemoteState,
  pushRemoteState,
  generateRemoteSyncKey,
  renderBackupStatus: renderSettingsBackupStatus,
  renderRemoteSyncStatus,
  requestNotifications,
  resetInterfaceSettings,
  restoreBackup,
  updateSetting,
});

const remoteSyncWorkflow = window.RhythmRemoteSyncController.createRemoteSyncWorkflow({
  confirmAction,
  createImportSafetyBackup,
  createUndoSnapshot,
  describeError: describeRemoteSyncError,
  formatDate: formatBackupDate,
  getLocalUpdatedAt: () => localStateUpdatedAt,
  getRemoteUiSettings,
  getSettings: () => ({
    accessToken: remoteAuth.getSession()?.access_token || "",
    anonKey: remoteSyncAnonKey,
    enabled: remoteSyncEnabled === "on",
    supabaseUrl: remoteSyncUrl,
    userId: remoteAuth.getSession()?.user?.id || "",
    userKey: remoteSyncUserKey,
  }),
  getState: () => state,
  getSyncMeta: () => ({ lastPulledAt: remoteSyncLastPulledAt, lastPushedAt: remoteSyncLastPushedAt }),
  isRemoteVersionNewer: settingsState.isRemoteVersionNewer,
  isSecurePrivateKey: remoteSyncController.isSecurePrivateKey,
  latestIsoDate,
  mergeStates: window.RhythmStateMerge.mergeStates,
  remoteSync,
  recordSyncEvent: (type, detail) => {
    syncHistory.record(type, detail);
    syncHistory.render(els.remoteSyncHistory, formatBackupDate);
  },
  render,
  renderSaveStatus,
  replaceState,
  saveState,
  saveUiState,
  schemaVersion: SCHEMA_VERSION,
  setSyncMeta: ({ lastPulledAt, lastPushedAt }) => {
    if (lastPulledAt) remoteSyncLastPulledAt = lastPulledAt;
    if (lastPushedAt) remoteSyncLastPushedAt = lastPushedAt;
  },
  showToast,
  statusElement: els.remoteSyncStatus,
  syncControls: () => settingsController.syncControls(),
});

const remoteAuthController = window.RhythmRemoteAuthController.createRemoteAuthController({
  auth: remoteAuth,
  els,
  renderSyncStatus: () => remoteSyncWorkflow.renderStatus(),
  showToast,
  syncLatest: (options) => remoteSyncWorkflow.syncLatest(options),
});
syncHistory.render(els.remoteSyncHistory, formatBackupDate);

const notificationsController = window.RhythmNotifications.createNotifications({
  els,
  cleanTimeValue,
  getCategory,
  getNotificationsEnabled: () => notificationSetting === "on",
  getState: () => state,
  isTaskDone,
  parseDate,
  saveState,
  showToast,
  taskOccursOn,
  tasksForDate,
  toDateKey,
});

const viewRenderer = window.RhythmViewRenderer.createViewRenderer({
  renderArchive,
  renderCategories,
  renderDailyPulse,
  renderGoals,
  renderHabits,
  renderOverview,
  renderRemoteSyncStatus,
  renderSettingsBackupStatus,
  renderTasks,
  renderTimeline,
  renderWeekdayLabels,
});

const appEvents = window.RhythmAppEvents.createAppEvents({
  calendarDragController,
  changeActiveDate: (value) => {
    activeDate = value || toDateKey(new Date());
    resetTaskForm({ open: false });
    render();
  },
  changeArchiveCategoryFilter: (value) => {
    archiveCategoryFilter = value || "all";
    saveUiState();
    renderArchive();
  },
  changeArchiveSearch: (value) => {
    archiveSearchQuery = cleanSearchQuery(value);
    saveUiState();
    renderArchive();
  },
  changeTaskCategoryFilter: (value) => {
    taskCategoryFilter = value || "all";
    saveUiState();
    renderTasks();
  },
  changeTaskFilter: (value, activeButton) => {
    taskFilter = value;
    document.querySelectorAll("[data-task-filter]").forEach((item) => item.classList.toggle("is-active", item === activeButton));
    renderTasks();
  },
  changeTaskSearch: (value) => {
    taskSearchQuery = cleanSearchQuery(value);
    saveUiState();
    renderTasks();
  },
  changeView: (nextView) => {
    if (!nextView || !els.views[nextView]) return;
    activeView = nextView;
    els.navMore?.removeAttribute("open");
    render();
    scrollWorkspaceTop();
  },
  clearArchiveFilter: () => {
    archiveSearchQuery = "";
    archiveCategoryFilter = "all";
    els.archiveSearch.value = "";
    els.archiveCategoryFilter.value = "all";
    archiveView.setPeriod("all");
    saveUiState();
    renderArchive();
  },
  clearTaskSearch: () => {
    taskFilter = "all";
    taskCategoryFilter = "all";
    taskSearchQuery = "";
    els.taskSearch.value = "";
    els.taskCategoryFilter.value = "all";
    document.querySelectorAll("[data-task-filter]").forEach((item) => item.classList.toggle("is-active", item.dataset.taskFilter === "all"));
    saveUiState();
    renderTasks();
  },
  closeGoalForm: () => {
    els.goalFormPanel.classList.add("is-collapsed");
    els.openGoalForm.focus();
  },
  closeHabitForm: () => {
    els.habitFormPanel.classList.add("is-collapsed");
    els.openHabitForm.focus();
  },
  closeTaskForm: () => {
    els.taskFormPanel.classList.add("is-collapsed");
    closeFloatingTaskForm();
    els.openTaskForm.focus();
  },
  els,
  exportData,
  goToday,
  handleOnline: async () => {
    renderSaveStatus();
    await remoteAuth.ensureFreshSession().catch(() => null);
    await remoteSyncWorkflow.syncLatest({ silent: true });
    scheduleRemotePush();
  },
  handleSystemThemeChange: () => {
    if (themePreference === "system") applyThemePreference();
  },
  importData,
  openBackupFolder,
  openGoalForm: () => {
    resetGoalForm({ open: true });
    els.goalTitle.focus();
  },
  openHabitForm: () => {
    resetHabitForm({ open: true });
    els.habitTitle.focus();
  },
  openTaskForm: () => {
    restoreTaskFormPanel();
    resetTaskForm({ open: true });
    els.taskTitle.focus();
  },
  applyTimePreset: taskScheduleController.applyPreset,
  renderSaveStatus,
  requestNotifications,
  resetGoalForm,
  resetHabitForm,
  resetTaskForm,
  restoreBackup,
  saveCategoryFromForm,
  saveGoalFromForm,
  saveHabitFromForm,
  saveQuickTask,
  saveTaskFromForm,
  setCustomRepeatMode,
  setHabitCustomRepeatMode,
  settingsController,
  shiftDate,
  shiftMonth,
  syncCustomRepeatPanel,
  syncHabitCustomRepeatPanel,
  syncHabitTypeFields,
  syncTaskScheduleMode,
  syncTaskTimePresets,
  updateCustomRepeatSummary,
  updateHabitCustomRepeatSummary,
  updateQuickTaskPreview,
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
  appEvents.bind();
  resetTaskForm({ open: false });
  resetHabitForm({ open: false });
  resetGoalForm({ open: false });
  registerServiceWorker();
  updateNotificationButton();
  updateBackupStatus();
  renderSettingsBackupStatus();
  renderRemoteSyncStatus();
  updateFileBackupStatus();
  render();
  remoteAuth.ensureFreshSession().catch(() => null).finally(() => remoteSyncWorkflow.syncLatest({ silent: true }));
  syncDesktopReminders();
  syncDesktopBackup();
  setInterval(checkDueNotifications, 30000);
  setInterval(syncDesktopReminders, 60000);
  setInterval(handleDateRollover, 30000);
  scheduleAutoBackup();
}

function handleDateRollover() {
  const nextToday = toDateKey(new Date());
  const rollover = window.RhythmDateRollover.resolveDateRollover(activeDate, currentToday, nextToday);
  if (!rollover.changed) return;
  currentToday = rollover.today;
  if (rollover.activeDate !== activeDate) {
    activeDate = rollover.activeDate;
    resetTaskForm({ open: false });
    resetHabitForm({ open: false });
  }
  render();
}

function render() {
  if (activeView !== "timeline") restoreTaskFormPanel();
  els.activeDate.value = activeDate;
  els.todayLabel.textContent = formatLongDate(activeDate);
  renderSaveStatus();
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

  const isMoreView = activeView === "goals" || activeView === "archive" || activeView === "settings";
  els.navMoreSummary?.classList.toggle("is-active", isMoreView);
  if (isMoreView) {
    els.navMoreSummary?.setAttribute("aria-current", "page");
  } else {
    els.navMoreSummary?.removeAttribute("aria-current");
  }

  Object.entries(els.views).forEach(([view, element]) => {
    element.classList.toggle("is-active", view === activeView);
  });

  viewRenderer.render(activeView);
}

function scrollWorkspaceTop() {
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

function renderSaveStatus() {
  if (!els.saveStatus) return;
  const syncStatus = remoteSyncWorkflow.getStatus();
  if (remoteSyncEnabled === "on" && syncStatus.lastError) {
    els.saveStatus.textContent = "Ошибка синхронизации";
    return;
  }
  if (remoteSyncEnabled === "on" && syncStatus.inFlight) {
    els.saveStatus.textContent = "Синхронизация...";
    return;
  }
  if (navigator.onLine === false) {
    els.saveStatus.textContent = "Офлайн · сохранено локально";
    return;
  }
  if (remoteSyncEnabled === "on" && syncStatus.pending) {
    els.saveStatus.textContent = "Ожидает синхронизации";
    return;
  }
  if (!localStateUpdatedAt) {
    els.saveStatus.textContent = "Сохранено локально";
    return;
  }
  const savedAt = new Date(localStateUpdatedAt);
  if (Number.isNaN(savedAt.getTime())) {
    els.saveStatus.textContent = "Сохранено локально";
    return;
  }
  els.saveStatus.textContent = `Сохранено ${formatTime(toTimeValue(savedAt))}`;
}

function renderTaskSurfaces() {
  viewRenderer.render(activeView);
}

function renderHabitSurfaces() {
  viewRenderer.render(activeView);
}

function renderGoalSurfaces() {
  renderGoals();
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
  task.updatedAt = new Date().toISOString();
  delete task.completed?.[dateKey];
  delete task.notified?.[dateKey];
  if (Array.isArray(state.taskOrder[dateKey])) {
    state.taskOrder[dateKey] = state.taskOrder[dateKey].filter((id) => id !== task.id);
  }
  saveState();
  render();
  showToast("Повтор исключен на выбранный день", { undo });
}

function acknowledgeOverdueTask(task, dateKey) {
  const undo = createUndoSnapshot();
  task.acknowledgedOverdue = task.acknowledgedOverdue || {};
  task.acknowledgedOverdue[dateKey] = true;
  task.updatedAt = new Date().toISOString();
  saveState();
  render();
  showToast("Задача убрана из просроченных", { undo });
}

function acknowledgeAllOverdueTasks(entries) {
  if (!entries.length) return;
  const undo = createUndoSnapshot();
  entries.forEach(({ task, dateKey }) => {
    task.acknowledgedOverdue = task.acknowledgedOverdue || {};
    task.acknowledgedOverdue[dateKey] = true;
    task.updatedAt = new Date().toISOString();
  });
  saveState();
  render();
  showToast(`Просмотрено задач: ${entries.length}`, { undo });
}

function restoreOverdueTask(task, dateKey) {
  if (!task.acknowledgedOverdue?.[dateKey]) return;
  const undo = createUndoSnapshot();
  delete task.acknowledgedOverdue[dateKey];
  task.updatedAt = new Date().toISOString();
  saveState();
  render();
  showToast("Задача снова появится в просроченных на следующем дне", { undo });
}

function restoreTaskDate(task, dateKey) {
  const undo = createUndoSnapshot();
  if (task.excludedDates) {
    delete task.excludedDates[dateKey];
  }
  task.updatedAt = new Date().toISOString();
  saveState();
  render();
  showToast(`Повтор возвращен на ${formatLongDate(dateKey)}`, { undo });
}

function stopTaskSeries(task, dateKey) {
  if (task.repeat === "none") return;
  const undo = createUndoSnapshot();
  const cutoff = addDays(dateKey, -1);
  task.repeatUntil = cutoff;
  task.updatedAt = new Date().toISOString();
  [task.completed, task.acknowledgedOverdue, task.excludedDates, task.notified].forEach((flags) => {
    Object.keys(flags || {}).forEach((key) => {
      if (key >= dateKey) delete flags[key];
    });
  });
  Object.keys(state.taskOrder).forEach((key) => {
    if (key >= dateKey) state.taskOrder[key] = state.taskOrder[key].filter((id) => id !== task.id);
  });
  saveState();
  render();
  showToast(`Повтор завершен с ${formatLongDate(dateKey)}`, { undo });
}

function resumeTaskSeries(task) {
  const undo = createUndoSnapshot();
  task.date = toDateKey(new Date());
  task.repeatUntil = "";
  task.updatedAt = new Date().toISOString();
  saveState();
  render();
  showToast("Повторяющаяся серия возобновлена с сегодняшнего дня", { undo });
}

function deleteTask(taskId) {
  return taskState.deleteTask(taskId);
}

function deleteMovedReplacement(taskId, options) {
  return taskState.deleteMovedReplacement(taskId, options);
}

function deleteHabit(habitId) {
  taskState.deleteHabit(habitId);
}

function reorderHabit(sourceId, targetId) {
  taskState.reorderHabit(sourceId, targetId);
}

function deleteGoal(goalId) {
  taskState.deleteGoal(goalId);
}

function openDateTasks(dateKey) {
  activeDate = dateKey;
  activeView = "tasks";
  resetTaskForm({ open: false });
  render();
  scrollWorkspaceTop();
}

function moveTaskToDate(taskId, sourceDateKey, targetDateKey) {
  const task = state.tasks.find((item) => item.id === taskId);
  const sourceDate = normalizeDateKey(sourceDateKey || activeDate, "");
  const targetDate = normalizeDateKey(targetDateKey, "");
  if (!task || !sourceDate || !targetDate || sourceDate === targetDate) return;
  postponeTask(task, sourceDate, targetDate);
}

function attachTaskDropZone(element, dateKey) {
  calendarDragController.attachTaskDropZone(element, dateKey);
}

function attachTaskChipDrag(chip) {
  calendarDragController.attachTaskChipDrag(chip);
}

function clearTaskDragState() {
  calendarDragController.clearTaskDragState();
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
  resetTaskForm({ open: false });
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

function resetGoalForm(options) {
  goalsView.resetGoalForm(options);
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
  resetTaskForm({ open: false });
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
  const category = parsed.categoryId
    ? getCategory(parsed.categoryId)?.name
    : parsed.categoryName
      ? `новая категория: ${parsed.categoryName}`
      : "";
  const details = [
    formatLongDate(parsed.date),
    parsed.scheduleMode === "block" ? formatTaskWindow(parsed) : parsed.time ? formatTaskTime(parsed.time) : "без времени",
    category || "без категории",
    priorityLabels[parsed.priority],
  ];

  els.quickTaskPreview.hidden = false;
  els.quickTaskPreview.replaceChildren(createQuickPreviewSummary(parsed), createQuickPreviewChips(details));
}

function createQuickPreviewSummary(parsed) {
  const summary = document.createElement("div");
  const label = document.createElement("span");
  const title = document.createElement("strong");
  label.textContent = "Будет создано";
  title.textContent = parsed.title || "Задача без названия";
  summary.append(label, title);
  return summary;
}

function createQuickPreviewChips(details) {
  const chips = document.createElement("div");
  chips.className = "quick-preview-chips";
  details.forEach((detail) => {
    const chip = document.createElement("span");
    chip.textContent = detail;
    chips.appendChild(chip);
  });
  return chips;
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
  const hasRepeat = els.taskRepeat.value !== "none";
  const isCustom = els.taskRepeat.value === "custom";
  els.taskRepeatUntilField.hidden = !hasRepeat;
  if (hasRepeat) els.taskRepeatUntil.min = els.taskDate.value || activeDate;
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

function syncHabitTypeFields() {
  const isNumber = els.habitType.value === "number";
  if (els.habitNumericFields) els.habitNumericFields.hidden = !isNumber;
  els.habitUnit.disabled = !isNumber;
  els.habitGoal.disabled = !isNumber;
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
  if (activeView === "timeline") openFloatingTaskForm();
  taskFormController.fillTaskForm(task);
}

function resetTaskForm(options) {
  taskFormController.resetTaskForm(options);
}

function saveHabitFromForm(event) {
  habitFormController.saveHabitFromForm(event);
}

function fillHabitForm(habit) {
  habitFormController.fillHabitForm(habit);
}

function resetHabitForm(options) {
  habitFormController.resetHabitForm(options);
}

function saveCategoryFromForm(event) {
  categoriesController.saveCategoryFromForm(event);
}

function deleteCategory(categoryId) {
  categoriesController.deleteCategory(categoryId);
}function openFloatingTaskForm() {
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
  const replacementSourceIds = new Set(
    state.tasks
      .filter((task) => task.repeat === "none" && task.date === dateKey && task.sourceTaskId)
      .map((task) => task.sourceTaskId),
  );
  return state.tasks
    .filter(
      (task) =>
        task.repeat !== "none" &&
        taskScheduledOn(task, dateKey) &&
        isTaskExcluded(task, dateKey) &&
        !replacementSourceIds.has(task.id),
    )
    .sort(sortTasks);
}

function endedRecurringTasks(todayKey = toDateKey(new Date())) {
  return state.tasks
    .filter((task) => task.repeat !== "none" && task.repeatUntil && task.repeatUntil < todayKey)
    .sort((a, b) => b.repeatUntil.localeCompare(a.repeatUntil) || a.title.localeCompare(b.title, "ru"));
}

function overdueTaskEntries(referenceDateKey = activeDate) {
  const referenceDate = parseDate(normalizeDateKey(referenceDateKey, activeDate));
  referenceDate.setHours(12, 0, 0, 0);
  return overdueController.list(referenceDate);
}

function habitsForDate(dateKey) {
  return state.habits.filter((habit) => !habit.archived && habitOccursOn(habit, dateKey));
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

function taskMetaItems(task) {
  const category = getCategory(task.categoryId);
  const items = [];

  if (category) {
    items.push({
      categoryColor: category.color,
      label: category.name,
      type: "category",
    });
  }

  if (taskHasSchedule(task)) items.push({ label: formatTaskScheduleLabel(task), type: "schedule" });
  if (task.repeat !== "none") items.push({ label: formatTaskRepeat(task), type: "repeat" });
  if (taskHasSchedule(task) && task.reminderOffset !== "none") {
    items.push({ label: reminderLabel(task.reminderOffset), type: "reminder" });
  }

  return items.length ? items : [{ label: "Без категории", type: "empty" }];
}

function categoryLabel(task) {
  return getCategory(task.categoryId)?.name || "\uffff";
}

function timeValue(value) {
  return cleanTimeValue(value) || "99:99";
}

function formatTaskRepeat(task) {
  const label = window.RhythmRecurrence.repeatLabel(task);
  return task.repeatUntil ? `${label} · до ${formatShortDate(task.repeatUntil)}` : label;
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
  resetTaskForm({ open: false });
  render();
}

function goToday() {
  activeDate = toDateKey(new Date());
  resetTaskForm({ open: false });
  render();
}

function shiftMonth(months) {
  const date = parseDate(activeDate);
  const targetDay = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(targetDay, lastDay));
  activeDate = toDateKey(target);
  resetTaskForm({ open: false });
  render();
}

function saveUiState() {
  storage.saveUiState({
    archiveCategoryFilter,
    archiveSearchQuery,
    backupSchedule,
    densityPreference,
    firstDayOfWeek,
    interfaceMode,
    localStateUpdatedAt,
    notificationSetting,
    overdueHidden,
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
  return settingsState.normalizeThemePreference(value);
}

function normalizeNotificationSetting(value) {
  return settingsState.normalizeNotificationSetting(value);
}

function normalizeBackupSchedule(value) {
  return settingsState.normalizeBackupSchedule(value);
}

function normalizeFirstDayOfWeek(value) {
  return settingsState.normalizeFirstDayOfWeek(value);
}

function normalizeDensityPreference(value) {
  return settingsState.normalizeDensityPreference(value);
}

function normalizeInterfaceMode(value) {
  return settingsState.normalizeInterfaceMode(value);
}

function normalizeTimeFormat(value) {
  return settingsState.normalizeTimeFormat(value);
}

function normalizeRemoteSyncEnabled(value) {
  return settingsState.normalizeRemoteSyncEnabled(value);
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
}

function getUiSettings() {
  return {
    backupSchedule,
    densityPreference,
    firstDayOfWeek,
    interfaceMode,
    localStateUpdatedAt,
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

function getRemoteUiSettings(overrides = {}) {
  return settingsState.createRemoteUiSettings(getUiSettings(), overrides);
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
      renderWeekdayLabels();
      renderOverview();
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
      remoteSyncWorkflow.clearError();
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      renderRemoteSyncStatus();
      if (isRemoteSyncReady()) scheduleRemotePush();
      showToast(remoteSyncEnabled === "on" ? "Синхронизация с БД включена" : "Синхронизация с БД выключена");
      break;
    case "remoteSyncUrl":
      remoteSyncUrl = cleanText(value);
      remoteSyncWorkflow.clearError();
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      renderRemoteSyncStatus();
      break;
    case "remoteSyncAnonKey":
      remoteSyncAnonKey = cleanText(value);
      remoteSyncWorkflow.clearError();
      applySettingsPreferences();
      saveUiState();
      settingsController.syncControls();
      renderRemoteSyncStatus();
      break;
    case "remoteSyncUserKey":
      remoteSyncUserKey = normalizeRemoteUserKey(value);
      remoteSyncWorkflow.clearError();
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
  const normalized = settingsState.normalizeImportedSettings(settings);
  themePreference = normalized.themePreference;
  notificationSetting = normalized.notificationSetting;
  backupSchedule = normalized.backupSchedule;
  firstDayOfWeek = normalized.firstDayOfWeek;
  densityPreference = normalized.densityPreference;
  interfaceMode = normalized.interfaceMode;
  timeFormat = normalized.timeFormat;
  remoteSyncEnabled = normalized.remoteSyncEnabled;
  remoteSyncUrl = normalized.remoteSyncUrl;
  remoteSyncAnonKey = normalized.remoteSyncAnonKey;
  remoteSyncUserKey = normalized.remoteSyncUserKey;
  remoteSyncLastPulledAt = normalized.remoteSyncLastPulledAt;
  remoteSyncLastPushedAt = normalized.remoteSyncLastPushedAt;
  localStateUpdatedAt = normalized.localStateUpdatedAt || localStateUpdatedAt;
  remoteSyncWorkflow.clearError();
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

function generateRemoteSyncKey() {
  remoteSyncUserKey = remoteSyncController.generatePrivateKey();
  remoteSyncWorkflow.clearError();
  saveUiState();
  settingsController.syncControls();
  els.remoteSyncUserKey?.focus();
  showToast("Приватный ключ создан. Сохрани его для подключения других устройств");
}

function isRemoteSyncReady() {
  return remoteSyncWorkflow.isReady();
}

function renderRemoteSyncStatus() {
  remoteSyncWorkflow.renderStatus();
}

function scheduleRemotePush() {
  remoteSyncWorkflow.schedulePush();
}

async function pushRemoteState(options = {}) {
  return remoteSyncWorkflow.push(options);
}

async function checkRemoteConnection(options = {}) {
  return remoteSyncWorkflow.check(options);
}

async function pullRemoteState(options = {}) {
  return remoteSyncWorkflow.pull(options);
}

function latestIsoDate(...values) {
  return values.filter(Boolean).sort().at(-1) || "";
}

function describeRemoteSyncError(error) {
  if (error?.status === 401 || error?.status === 403) return "неверный anon key или доступ запрещен";
  if (error?.status === 404) return "таблица rhythm_states не создана";
  const message = String(error?.message || "").trim();
  if (/failed to fetch|network|load failed/i.test(message)) return "нет сети или Supabase URL недоступен";
  return message || "неизвестная ошибка";
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
  localStateUpdatedAt = options.localUpdatedAt || new Date().toISOString();
  saveUiState();
  renderSaveStatus();
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
  if (state.categories.length) return;
  state.categories.push(
    { id: createId(), name: "Работа", color: "#5967d8", createdAt: new Date().toISOString() },
    { id: createId(), name: "Фокус", color: "#00a78e", createdAt: new Date().toISOString() },
    { id: createId(), name: "Здоровье", color: "#ef6a4b", createdAt: new Date().toISOString() },
    { id: createId(), name: "Дом", color: "#e7b84a", createdAt: new Date().toISOString() },
  );
  saveState();
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

function icon(name) {
  return `<svg class="ui-icon"><use href="#icon-${name}"></use></svg>`;
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
    resetTaskForm({ open: false });
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
