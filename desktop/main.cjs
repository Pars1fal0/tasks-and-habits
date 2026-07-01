const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, nativeImage, shell } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");
const isSmokeTest = process.argv.includes("--smoke-test");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let backgroundNoticeShown = false;
let reminderSnapshot = [];
let lastFileBackupAt = 0;
const sentReminders = new Set();
const FILE_BACKUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_FILE_BACKUPS = 20;

if (isSmokeTest) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  app.commandLine.appendSwitch("in-process-gpu");
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rhythm-day-smoke-"));
  const smokeDocuments = path.join(smokeRoot, "documents");
  fs.mkdirSync(smokeDocuments, { recursive: true });
  app.setPath("userData", path.join(smokeRoot, "userData"));
  app.setPath("documents", smokeDocuments);
}

app.setAppUserModelId("local.rhythm-day.tracker");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    show: !isSmokeTest,
    title: "Ритм дня",
    backgroundColor: "#090d10",
    icon: path.join(appRoot, "icon.svg"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (!isSmokeTest) {
      mainWindow.show();
    }
  });

  if (!isSmokeTest) {
    mainWindow.on("close", (event) => {
      if (isQuitting) return;
      event.preventDefault();
      mainWindow.hide();
      showBackgroundNotice();
    });
  }

  if (isSmokeTest) {
    mainWindow.webContents.on("console-message", (event) => {
      const { level, lineNumber: line, message, sourceId } = event;
      if (!message || message.includes("Electron Security Warning")) return;
      console.error(`RENDERER_${level} ${message} ${sourceId}:${line}`);
    });
  }

  mainWindow.webContents.once("did-finish-load", async () => {
    if (!isSmokeTest) return;

    try {
      const result = await Promise.race([
        mainWindow.webContents.executeJavaScript(
      `(async () => {
        const submit = (form) => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        const click = (selector) => document.querySelector(selector)?.click();
        const categoryName = "Smoke Category";
        const taskTitle = "Smoke Task";

        document.querySelector("#categoryName").value = categoryName;
        document.querySelector("#categoryColor").value = "#5967d8";
        submit(document.querySelector("#categoryForm"));

        const categoryOption = [...document.querySelectorAll("#taskCategoryId option")].find((option) => option.textContent === categoryName);
        document.querySelector("#taskTitle").value = taskTitle;
        document.querySelector("#taskDate").value = document.querySelector("#activeDate").value;
        document.querySelector("#taskTime").value = "18:45";
        document.querySelector("#taskCategoryId").value = categoryOption?.value || "";
        document.querySelector("#taskPriority").value = "high";
        document.querySelector("#taskReminder").value = "30";
        document.querySelector("#taskRepeat").value = "every2days";
        submit(document.querySelector("#taskForm"));

        document.querySelector("#taskTitle").value = "Smoke Task Later";
        document.querySelector("#taskDate").value = document.querySelector("#activeDate").value;
        document.querySelector("#taskTime").value = "19:30";
        document.querySelector("#taskCategoryId").value = categoryOption?.value || "";
        document.querySelector("#taskPriority").value = "low";
        document.querySelector("#taskReminder").value = "30";
        document.querySelector("#taskRepeat").value = "none";
        submit(document.querySelector("#taskForm"));

        document.querySelector("#taskTitle").value = "Smoke Time Block";
        document.querySelector("#taskDate").value = document.querySelector("#activeDate").value;
        document.querySelector("#taskScheduleBlock").checked = true;
        document.querySelector("#taskScheduleBlock").dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector("#taskStartTime").value = "14:00";
        document.querySelector("#taskEndTime").value = "15:30";
        document.querySelector("#taskCategoryId").value = categoryOption?.value || "";
        document.querySelector("#taskPriority").value = "medium";
        document.querySelector("#taskReminder").value = "15";
        document.querySelector("#taskRepeat").value = "none";
        submit(document.querySelector("#taskForm"));
        const timeBlockCreated = state.tasks.some(
          (task) =>
            task.title === "Smoke Time Block" &&
            task.scheduleMode === "block" &&
            task.startTime === "14:00" &&
            task.endTime === "15:30" &&
            task.time === "15:30",
        );

        const beforeOrder = [...document.querySelectorAll(".task-item")].map((item) => ({
          id: item.dataset.taskId,
          title: item.querySelector("h3")?.textContent,
        }));
        const firstTask = beforeOrder.find((item) => item.title === taskTitle);
        const secondTask = beforeOrder.find((item) => item.title === "Smoke Task Later");
        if (firstTask && secondTask) {
          reorderTask(document.querySelector("#activeDate").value, secondTask.id, firstTask.id);
          renderTasks();
        }
        const afterOrder = [...document.querySelectorAll(".task-item h3")].map((item) => item.textContent);
        const dndOrderChanged = afterOrder.indexOf("Smoke Task Later") < afterOrder.indexOf(taskTitle);

        const taskCard = [...document.querySelectorAll(".task-item")].find((item) => item.querySelector("h3")?.textContent === taskTitle);
        taskCard?.querySelector(".check-button")?.click();
        click('[data-view="archive"]');
        const archived = [...document.querySelectorAll(".archive-item h3")].some((item) => item.textContent === taskTitle);

        click('[data-view="tasks"]');
        document.querySelector("#quickTaskInput").value = "Smoke Quick завтра 10:00 #SmokeQuick !high";
        document.querySelector("#quickTaskInput").dispatchEvent(new Event("input", { bubbles: true }));
        const quickPreviewVisible =
          !document.querySelector("#quickTaskPreview")?.hidden &&
          document.querySelector("#quickTaskPreview")?.textContent.includes("Smoke Quick") &&
          document.querySelector("#quickTaskPreview")?.textContent.includes("10:00");
        submit(document.querySelector("#quickTaskForm"));
        const quickTaskCard = [...document.querySelectorAll(".task-item")].find((item) => item.querySelector("h3")?.textContent === "Smoke Quick");
        const quickTaskCreated =
          Boolean(quickTaskCard) &&
          quickTaskCard?.querySelector(".task-meta")?.textContent.includes("10:00") &&
          quickTaskCard?.querySelector(".priority-pill")?.textContent === "Высокий";
        document.querySelector("#quickTaskInput").value = "Smoke Quick Block завтра 14:00-15:30 #SmokeQuick !high";
        document.querySelector("#quickTaskInput").dispatchEvent(new Event("input", { bubbles: true }));
        const quickBlockPreviewVisible =
          !document.querySelector("#quickTaskPreview")?.hidden &&
          document.querySelector("#quickTaskPreview")?.textContent.includes("14:00-15:30");
        submit(document.querySelector("#quickTaskForm"));
        const quickBlockCreated = state.tasks.some(
          (task) => task.title === "Smoke Quick Block" && task.scheduleMode === "block" && task.startTime === "14:00" && task.endTime === "15:30",
        );
        const quickTaskId = quickTaskCard?.dataset.taskId;
        const quickSourceDate = document.querySelector("#activeDate").value;
        const quickTargetDate = addDays(quickSourceDate, 1);
        if (quickTaskId) moveTaskToDate(quickTaskId, quickSourceDate, quickTargetDate);
        const calendarDragMove =
          Boolean(quickTaskId) &&
          document.querySelector("#activeDate").value === quickTargetDate &&
          state.tasks.some((task) => task.id === quickTaskId && task.date === quickTargetDate);
        click('[data-view="overview"]');
        const hasWeekBoard =
          document.querySelectorAll(".week-board-day").length === 7 &&
          [...document.querySelectorAll(".week-task-chip span")].some((item) => item.textContent === "Smoke Quick");
        const calendarKeyboardDateBefore = state.tasks.find((task) => task.id === quickTaskId)?.date;
        document.querySelector('.month-task-chip[data-task-id="' + quickTaskId + '"]')?.dispatchEvent(
          new KeyboardEvent("keydown", { altKey: true, bubbles: true, cancelable: true, key: "ArrowRight" }),
        );
        const calendarKeyboardMove =
          Boolean(calendarKeyboardDateBefore) &&
          state.tasks.find((task) => task.id === quickTaskId)?.date === addDays(calendarKeyboardDateBefore, 1);
        const relativeQuick = parseQuickTaskInput("Smoke Relative через 2 часа #SmokeQuick !low");
        const phraseQuick = parseQuickTaskInput("Smoke Next в следующий понедельник вечером #SmokeQuick !high");
        const customRepeatTask = {
          title: "Smoke Custom Repeat",
          date: "2026-06-22",
          repeat: "custom",
          customRepeat: { type: "weekdays", weekdays: [1, 3, 5] },
        };
        const customRepeatWorks =
          taskScheduledOn(customRepeatTask, "2026-06-24") &&
          taskScheduledOn(customRepeatTask, "2026-06-26") &&
          !taskScheduledOn(customRepeatTask, "2026-06-27") &&
          window.RhythmRecurrence.repeatLabel(customRepeatTask).includes("ПН");
        const customHabit = {
          title: "Smoke Custom Habit",
          type: "check",
          repeat: "custom",
          startDate: "2026-06-22",
          customRepeat: { type: "weekdays", weekdays: [1, 3, 5] },
          logs: {},
        };
        state.habits.push(customHabit);
        const customHabitRepeatWorks =
          habitOccursOn(customHabit, "2026-06-24") &&
          habitOccursOn(customHabit, "2026-06-26") &&
          !habitOccursOn(customHabit, "2026-06-27") &&
          formatHabitRepeat(customHabit).includes("ПН");

        click('[data-view="goals"]');
        document.querySelector("#goalTitle").value = "Smoke Goal";
        document.querySelector("#goalDueDate").value = "2026-07-20";
        document.querySelector("#goalDescription").value = "Ship a goal flow";
        document.querySelector("#goalMeasure").value = "3 verified milestones";
        document.querySelector("#goalReality").value = "Has time, scope, and clear checkpoints";
        document.querySelector("#goalWhy").value = "Keeps larger outcomes visible";
        document.querySelector("#goalSteps").value = "Design\\nBuild\\nVerify";
        submit(document.querySelector("#goalForm"));
        const goalCreated =
          document.body.dataset.view === "goals" &&
          state.goals.some((goal) => goal.title === "Smoke Goal" && goal.dueDate === "2026-07-20" && goal.measure && goal.why && goal.steps?.length === 3) &&
          [...document.querySelectorAll(".goal-item")].some((item) => item.textContent.includes("Smoke Goal") && item.textContent.includes("0%"));
        document.querySelector(".goal-step input")?.click();
        const goalStepProgressWorks =
          state.goals.some((goal) => goal.title === "Smoke Goal" && goal.steps?.some((step) => step.done)) &&
          [...document.querySelectorAll(".goal-item")].some((item) => item.textContent.includes("Smoke Goal") && item.textContent.includes("33%"));
        document.querySelector(".goal-item .goal-actions button:nth-child(2)")?.click();
        const goalCompleteWorks =
          state.goals.some((goal) => goal.title === "Smoke Goal" && goal.status === "done") &&
          [...document.querySelectorAll(".goal-item.is-done")].some((item) => item.textContent.includes("Smoke Goal"));

        click('[data-view="tasks"]');
        document.querySelector("#quickTaskInput").value = "Smoke Undo 2026-07-12 #SmokeQuick";
        submit(document.querySelector("#quickTaskForm"));
        const hasUndoButton = document.querySelector("#appToast button")?.textContent === "Отменить";
        const undoTaskCreated = state.tasks.some((task) => task.title === "Smoke Undo");
        document.querySelector("#appToast button")?.click();
        const undoRestored = !state.tasks.some((task) => task.title === "Smoke Undo");
        const backupBeforeImport = localStorage.getItem("rhythm-day-backup-v1");
        const importUndo = createUndoSnapshot();
        createImportSafetyBackup(importUndo);
        state.tasks.push({
          id: "smoke-import-task",
          title: "Smoke Imported",
          date: "2026-07-13",
          time: "",
          categoryId: "",
          priority: "medium",
          repeat: "none",
          reminderOffset: "none",
          completed: {},
          excludedDates: {},
          notified: {},
          createdAt: new Date().toISOString(),
        });
        saveState({ skipBackup: true });
        const safetyBackup = JSON.parse(localStorage.getItem("rhythm-day-import-safety-backup-v1") || "null");
        const importSafetyBackupCreated = Boolean(safetyBackup?.state?.tasks);
        const importBackupPreserved = localStorage.getItem("rhythm-day-backup-v1") === backupBeforeImport;
        replaceState(JSON.parse(importUndo.state));
        saveState({ skipBackup: true });
        render();
        const fileBackupResult = await window.rhythmDesktop.writeFileBackup({
          schemaVersion: 7,
          state,
        });
        const fileBackupWorks = fileBackupResult.ok || fileBackupResult.reason === "throttled";
        const fileBackupInfo = await window.rhythmDesktop.getFileBackupInfo();
        const openBackupFolderResult = await window.rhythmDesktop.openBackupFolder();
        const fileBackupUiVisible =
          Boolean(document.querySelector("#openBackupFolderButton")) &&
          !document.querySelector("#fileBackupStatus")?.hidden &&
          document.querySelector("#fileBackupStatus")?.textContent.includes("Файловый бэкап");
        const openBackupFolderWorks = openBackupFolderResult?.ok && Boolean(openBackupFolderResult.path);

        click('[data-view="timeline"]');
        const timelineVisible =
          document.body.dataset.view === "timeline" &&
          document.querySelectorAll(".timeline-hour-row").length >= 8 &&
          [...document.querySelectorAll(".timeline-task")].some((item) => item.textContent.includes("Smoke Quick"));
        const timelineSummaryWorks = document.querySelector("#timelineSummary")?.textContent.includes("по времени");
        const timelineDateBeforeBlockCheck = document.querySelector("#activeDate")?.value || activeDate;
        const blockTaskForTimeline = state.tasks.find((task) => task.title === "Smoke Time Block");
        activeDate = blockTaskForTimeline?.date || timelineDateBeforeBlockCheck;
        render();
        click('[data-view="timeline"]');
        const timelineBlockVisible =
          [...document.querySelectorAll(".timeline-task.is-time-block")].some((item) => item.textContent.includes("Smoke Time Block")) &&
          document.querySelectorAll(".timeline-task.is-time-block .timeline-resize-handle").length >= 2;
        activeDate = timelineDateBeforeBlockCheck;
        render();
        click('[data-view="timeline"]');
        const timelineAccessibilityWorks =
          document.querySelector("#timelineSummary")?.getAttribute("aria-live") === "polite" &&
          document.querySelectorAll(".timeline-hour-slot[role='list']").length >= 8 &&
          document.querySelectorAll(".timeline-task[role='listitem']").length >= 1;

        document.querySelector('[data-view="overview"]').click();
        const heatmapGrid = document.querySelector("#heatmapGrid");
        const firstHeatmapCell = document.querySelector(".heatmap-cell");
        firstHeatmapCell.dispatchEvent(new Event("pointerenter"));
        const heatmapTooltip = document.querySelector(".heatmap-tooltip.is-visible");
        const heatmapHasLabels =
          document.querySelectorAll(".heatmap-months span").length >= 12 &&
          document.querySelectorAll(".heatmap-weekdays span").length === 7;
        const heatmapFits = heatmapGrid.scrollWidth <= heatmapGrid.clientWidth + 1;
        const heatmapTooltipSingle = document.querySelectorAll(".heatmap-tooltip.is-visible").length === 1;
        const heatmapTooltipHasDate = /\\d{4}-\\d{2}-\\d{2}/.test(heatmapTooltip?.textContent || "");
        const nativeHeatmapTitleAbsent = !firstHeatmapCell.hasAttribute("title");

        document.querySelector('[data-view="settings"]').click();
        const themeSelect = document.querySelector("#themePreference");
        themeSelect.value = "light";
        themeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        const switchedLight = document.documentElement.dataset.theme === "light";
        themeSelect.value = "dark";
        themeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        const switchedDark = document.documentElement.dataset.theme === "dark";
        const themeSwitchWorks = switchedLight && switchedDark;
        const firstDaySelect = document.querySelector("#firstDayOfWeek");
        firstDaySelect.value = "sunday";
        firstDaySelect.dispatchEvent(new Event("change", { bubbles: true }));
        const firstDaySettingWorks =
          document.querySelector(".month-weekdays span")?.textContent === "Вс" &&
          document.querySelector("#weekBoardLabel")?.textContent;
        const densitySelect = document.querySelector("#densityPreference");
        densitySelect.value = "compact";
        densitySelect.dispatchEvent(new Event("change", { bubbles: true }));
        const densitySettingWorks = document.documentElement.dataset.density === "compact";
        const interfaceModeSelect = document.querySelector("#interfaceMode");
        const defaultSimpleModeWorks =
          interfaceModeSelect?.value === "simple" && document.documentElement.dataset.interfaceMode === "simple";
        interfaceModeSelect.value = "advanced";
        interfaceModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        const advancedModeWorks =
          document.documentElement.dataset.interfaceMode === "advanced" && document.querySelector("#goalAdvancedPanel")?.open;
        const timeFormatSelect = document.querySelector("#timeFormat");
        timeFormatSelect.value = "12";
        timeFormatSelect.dispatchEvent(new Event("change", { bubbles: true }));
        click('[data-view="timeline"]');
        const timeFormatWorks = [...document.querySelectorAll(".timeline-task strong")].some((item) =>
          /AM|PM|дп|пп/i.test(item.textContent),
        );
        const smokeQuickTask = state.tasks.find((task) => task.title === "Smoke Quick");
        const smokeQuickTimeBefore = smokeQuickTask?.time;
        document.querySelector('.timeline-task[data-task-id="' + smokeQuickTask?.id + '"] .timeline-time-action')?.click();
        const timelineQuickActionWorks =
          smokeQuickTask && smokeQuickTimeBefore && state.tasks.find((task) => task.id === smokeQuickTask.id)?.time !== smokeQuickTimeBefore;
        const smokeQuickTimeAfterAction = state.tasks.find((task) => task.id === smokeQuickTask?.id)?.time;
        document.querySelector('.timeline-task[data-task-id="' + smokeQuickTask?.id + '"] .timeline-task-main')?.dispatchEvent(
          new KeyboardEvent("keydown", { altKey: true, bubbles: true, cancelable: true, key: "ArrowRight" }),
        );
        const timelineKeyboardMoveWorks =
          smokeQuickTimeAfterAction && state.tasks.find((task) => task.id === smokeQuickTask?.id)?.time !== smokeQuickTimeAfterAction;
        const timelineDropZonesWork = document.querySelectorAll(".timeline-hour-slot[data-hour]").length >= 8;
        const backupScheduleSelect = document.querySelector("#backupSchedule");
        document.querySelector('[data-view="settings"]').click();
        backupScheduleSelect.value = "15";
        backupScheduleSelect.dispatchEvent(new Event("change", { bubbles: true }));
        const backupSettingWorks = backupScheduleSelect.value === "15";
        const settingsBackupStatusWorks = document.querySelector("#settingsBackupStatus")?.textContent.includes("следующий");
        const notificationSelect = document.querySelector("#notificationSetting");
        notificationSelect.value = "off";
        notificationSelect.dispatchEvent(new Event("change", { bubbles: true }));
        const notificationSettingWorks =
          notificationSelect.value === "off" && document.querySelector("#notifyButton")?.textContent.includes("паузе");
        document.querySelector("#settingsResetButton").click();
        const confirmInitialFocusWorks = document.activeElement?.id === "confirmAccept";
        document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" }));
        const confirmTabWrapWorks = document.activeElement?.id === "confirmCancel";
        document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab", shiftKey: true }));
        const confirmShiftTabWrapWorks = document.activeElement?.id === "confirmAccept";
        const confirmModalWorks =
          !document.querySelector("#confirmModal")?.hidden && document.querySelector("#confirmTitle")?.textContent.includes("Сбросить");
        document.querySelector("#confirmAccept").click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const interfaceResetWorks =
          document.documentElement.dataset.theme === "dark" &&
          document.documentElement.dataset.density === "comfortable" &&
          document.documentElement.dataset.interfaceMode === "simple" &&
          document.querySelector("#timeFormat")?.value === "24" &&
          document.querySelector("#firstDayOfWeek")?.value === "monday";
        const settingsPayload = {
          settings: {
            backupSchedule: "0",
            densityPreference: "compact",
            firstDayOfWeek: "sunday",
            notificationSetting: "on",
            themePreference: "dark",
            interfaceMode: "advanced",
            timeFormat: "12",
          },
        };
        const settingsTransfer = new DataTransfer();
        settingsTransfer.items.add(new File([JSON.stringify(settingsPayload)], "settings.json", { type: "application/json" }));
        const settingsImportFile = document.querySelector("#settingsImportFile");
        settingsImportFile.files = settingsTransfer.files;
        settingsImportFile.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        const settingsImportWorks =
          document.querySelector("#backupSchedule")?.value === "0" &&
          document.querySelector("#densityPreference")?.value === "compact" &&
          document.querySelector("#interfaceMode")?.value === "advanced" &&
          document.querySelector("#notificationSetting")?.value === "on";

        document.querySelector('[data-view="habits"]').click();
        document.querySelector("#openHabitForm").click();
        const habitFormRect = document.querySelector("#habitFormPanel").getBoundingClientRect();
        const habitFormControlsFit = [...document.querySelectorAll("#habitFormPanel select, #habitFormPanel input")]
          .filter((control) => control.type !== "hidden" && control.offsetParent !== null)
          .every((control) => {
            const rect = control.getBoundingClientRect();
            return rect.left >= habitFormRect.left - 1 && rect.right <= habitFormRect.right + 1 && rect.right <= window.innerWidth;
          });
        const habitFormFits = habitFormRect.left >= 0 && habitFormRect.right <= window.innerWidth && habitFormControlsFit;

        return {
          title: document.title,
          hasTaskForm: Boolean(document.querySelector("#taskForm")),
          hasHabitList: Boolean(document.querySelector("#habitList")),
          hasGoals: Boolean(document.querySelector("#goalsView")) && Boolean(document.querySelector("#goalForm")),
          hasArchive: Boolean(document.querySelector("#archiveView")),
          hasHeatmap:
            document.querySelectorAll(".heatmap-cell").length === 365 &&
            Boolean(document.querySelector(".heatmap-cell[data-tooltip]")),
          hasSettings: Boolean(document.querySelector("#settingsView")) && Boolean(document.querySelector("#themePreference")),
          hasMonthCalendar: document.querySelectorAll(".month-day").length === 42,
          hasWeekBoard,
          hasTodayButton: Boolean(document.querySelector("#todayButton")),
          hasQuickInput: Boolean(document.querySelector("#quickTaskInput")),
          hasCategories: document.querySelectorAll(".category-item").length >= 1,
          hasJsonActions: Boolean(document.querySelector("#exportButton")) && Boolean(document.querySelector("#importFile")),
          modulesLoaded: Boolean(
            window.RhythmQuickInput &&
              window.RhythmArchiveView &&
              window.RhythmCalendarView &&
              window.RhythmCategories &&
              window.RhythmConfirmDialog &&
              window.RhythmGoalsView &&
              window.RhythmHabitForm &&
              window.RhythmHabitsView &&
              window.RhythmHeatmapView &&
              window.RhythmImportExport &&
              window.RhythmNotifications &&
              window.RhythmRecurrence &&
              window.RhythmStateNormalizer &&
              window.RhythmStorage &&
              window.RhythmTaskForm &&
              window.RhythmTasksView &&
              window.RhythmTaskMoves &&
              window.RhythmTimelineView &&
              window.RhythmSettingsController &&
              window.RhythmToast,
          ),
          desktopBridge: Boolean(window.rhythmDesktop?.syncReminders && window.rhythmDesktop?.writeFileBackup),
          taskCreated: Boolean(taskCard),
          timeBlockCreated,
          quickTaskCreated,
          quickBlockCreated,
          quickBlockPreviewVisible,
          quickPreviewVisible,
          smartQuickRelative: relativeQuick.title === "Smoke Relative" && Boolean(relativeQuick.time) && relativeQuick.priority === "low",
          smartQuickPhrase: phraseQuick.title === "Smoke Next" && phraseQuick.time === "18:00" && phraseQuick.priority === "high",
          customRepeatWorks,
          customHabitRepeatWorks,
          goalCreated,
          goalStepProgressWorks,
          goalCompleteWorks,
          hasUndoButton,
          undoTaskCreated,
          undoRestored,
          importSafetyBackupCreated,
          importBackupPreserved,
          fileBackupWorks,
          fileBackupInfoWorks: Boolean(fileBackupInfo?.path),
          fileBackupUiVisible,
          openBackupFolderWorks,
          backupSettingWorks,
          calendarKeyboardMove,
          confirmFocusTrapWorks: confirmInitialFocusWorks && confirmTabWrapWorks && confirmShiftTabWrapWorks,
          confirmModalWorks,
          advancedModeWorks,
          defaultSimpleModeWorks,
          densitySettingWorks,
          firstDaySettingWorks: Boolean(firstDaySettingWorks),
          heatmapFits,
          heatmapHasLabels,
          heatmapTooltipHasDate,
          heatmapTooltipSingle,
          habitFormFits,
          nativeHeatmapTitleAbsent,
          notificationSettingWorks,
          interfaceResetWorks,
          settingsBackupStatusWorks,
          settingsImportWorks,
          themeSwitchWorks,
          timeFormatWorks,
          timelineDropZonesWork,
          timelineAccessibilityWorks,
          timelineKeyboardMoveWorks,
          timelineQuickActionWorks,
          timelineSummaryWorks,
          timelineVisible,
          timelineBlockVisible,
          calendarDragMove,
          dndOrderChanged,
          archived,
        };
        })()`,
        ),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Smoke script timed out")), 45000);
        }),
      ]);
      const failedChecks = Object.entries(result).filter(([key, value]) => key !== "title" && value !== true);
      if (failedChecks.length) {
        console.error(`SMOKE_FAIL ${JSON.stringify(failedChecks)}`);
        app.exit(1);
        return;
      }
      console.log(`SMOKE_OK ${JSON.stringify(result)}`);
      app.quit();
    } catch (error) {
      console.error(`SMOKE_FAIL ${error?.stack || error}`);
      app.exit(1);
    }
  });

  mainWindow.webContents.once("did-fail-load", (_event, code, description) => {
    if (!isSmokeTest) return;

    console.error(`SMOKE_FAIL ${code} ${description}`);
    app.exit(1);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadFile(path.join(appRoot, "index.html"));
}

function createTray() {
  if (isSmokeTest || tray) return;

  const image = nativeImage.createFromPath(path.join(appRoot, "icon.svg"));
  tray = new Tray(image.resize({ width: 16, height: 16 }));
  tray.setToolTip("Ритм дня");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Открыть Ритм дня",
        click: showMainWindow,
      },
      {
        label: "Проверить напоминания",
        click: checkReminders,
      },
      { type: "separator" },
      {
        label: "Выйти",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showMainWindow);
}

function showMainWindow() {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function showBackgroundNotice() {
  if (backgroundNoticeShown || !Notification.isSupported()) return;
  backgroundNoticeShown = true;
  new Notification({
    title: "Ритм дня работает в фоне",
    body: "Окно закрыто, но напоминания останутся активными через трей.",
    silent: true,
  }).show();
}

function createMenu() {
  const template = [
    {
      label: "Файл",
      submenu: [
        {
          label: "Скрыть в трей",
          click: () => mainWindow?.hide(),
        },
        {
          label: "Выйти",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "Вид",
      submenu: [
        {
          label: "Обновить",
          role: "reload",
        },
        {
          label: "Масштаб +",
          role: "zoomIn",
        },
        {
          label: "Масштаб -",
          role: "zoomOut",
        },
        {
          label: "Сбросить масштаб",
          role: "resetZoom",
        },
      ],
    },
    {
      label: "Окно",
      submenu: [
        {
          label: "Свернуть",
          role: "minimize",
        },
        {
          label: "Показать",
          click: showMainWindow,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  ipcMain.on("reminders:sync", (_event, payload) => {
    reminderSnapshot = Array.isArray(payload?.reminders) ? payload.reminders : [];
    checkReminders();
  });

  ipcMain.handle("reminders:test", () => {
    showNotification({
      id: `test-${Date.now()}`,
      title: "Напоминания активны",
      body: "Ритм дня сможет напоминать о задачах, пока приложение работает в фоне.",
    });
    return true;
  });

  ipcMain.handle("backups:write-file", async (_event, payload) => {
    return writeFileBackup(payload);
  });

  ipcMain.handle("backups:info", async () => {
    return getFileBackupInfo();
  });

  ipcMain.handle("backups:open-folder", async () => {
    const backupDir = getFileBackupDir();
    await fs.promises.mkdir(backupDir, { recursive: true });
    if (isSmokeTest) return { ok: true, path: backupDir, smoke: true };
    const error = await shell.openPath(backupDir);
    if (!error) return { ok: true, path: backupDir };
    try {
      shell.showItemInFolder(backupDir);
      return { ok: true, path: backupDir, fallback: "showItemInFolder", error };
    } catch {
      return { ok: false, path: backupDir, error };
    }
  });
}

async function writeFileBackup(payload) {
  const now = Date.now();
  if (now - lastFileBackupAt < FILE_BACKUP_INTERVAL_MS) {
    return { ok: false, reason: "throttled" };
  }

  if (!payload?.state || typeof payload.state !== "object") {
    return { ok: false, reason: "invalid-payload" };
  }

  const backup = {
    app: "Ритм дня",
    schemaVersion: payload.schemaVersion || 1,
    exportedAt: new Date(now).toISOString(),
    state: payload.state,
  };

  const backupDir = getFileBackupDir();
  const fileName = `ritm-dnya-${new Date(now).toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(backupDir, fileName);

  await fs.promises.mkdir(backupDir, { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(backup, null, 2), "utf8");
  lastFileBackupAt = now;
  await pruneFileBackups(backupDir);

  return { ok: true, path: filePath };
}

function getFileBackupDir() {
  return path.join(app.getPath("documents"), "Ритм дня", "backups");
}

async function getFileBackupInfo() {
  const backupDir = getFileBackupDir();
  try {
    const entries = await fs.promises.readdir(backupDir, { withFileTypes: true });
    const backups = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && /^ritm-dnya-.*\.json$/i.test(entry.name))
        .map(async (entry) => {
          const filePath = path.join(backupDir, entry.name);
          const stat = await fs.promises.stat(filePath);
          return { name: entry.name, path: filePath, mtimeMs: stat.mtimeMs };
        }),
    );
    const latest = backups.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
    return { ok: true, path: backupDir, latest };
  } catch {
    return { ok: true, path: backupDir, latest: null };
  }
}

async function pruneFileBackups(backupDir) {
  const entries = await fs.promises.readdir(backupDir, { withFileTypes: true });
  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^ritm-dnya-.*\.json$/i.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(backupDir, entry.name);
        const stat = await fs.promises.stat(filePath);
        return { filePath, mtimeMs: stat.mtimeMs };
      }),
  );

  backups
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(MAX_FILE_BACKUPS)
    .forEach((backup) => {
      fs.promises.unlink(backup.filePath).catch(() => {});
    });
}

function checkReminders() {
  if (!Notification.isSupported()) return;

  const now = Date.now();
  reminderSnapshot.forEach((reminder) => {
    const reminderAt = Date.parse(reminder.reminderAt);
    const dueAt = Date.parse(reminder.dueAt);
    if (!Number.isFinite(reminderAt) || !Number.isFinite(dueAt)) return;
    if (reminderAt > now || dueAt < now - 86400000) return;
    if (sentReminders.has(reminder.id)) return;

    sentReminders.add(reminder.id);
    showNotification({
      id: reminder.id,
      title: reminder.title,
      body: reminderBody(reminder),
    });
  });
}

function reminderBody(reminder) {
  const due = new Date(reminder.dueAt);
  const time = due.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const parts = [`до ${time}`];
  if (reminder.category) parts.push(reminder.category);
  return parts.join(" · ");
}

function showNotification({ title, body }) {
  const notification = new Notification({ title, body });
  notification.on("click", showMainWindow);
  notification.show();
}

app.whenReady().then(() => {
  registerIpc();
  createMenu();
  createTray();
  createWindow();
  setInterval(checkReminders, 15000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  if (isQuitting || isSmokeTest) {
    app.quit();
  }
});
