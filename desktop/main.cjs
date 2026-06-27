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

  mainWindow.webContents.once("did-finish-load", async () => {
    if (!isSmokeTest) return;

    const result = await mainWindow.webContents.executeJavaScript(
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
          schemaVersion: 5,
          state,
        });
        const fileBackupWorks = fileBackupResult.ok || fileBackupResult.reason === "throttled";
        const fileBackupInfo = await window.rhythmDesktop.getFileBackupInfo();
        const fileBackupUiVisible =
          Boolean(document.querySelector("#openBackupFolderButton")) &&
          !document.querySelector("#fileBackupStatus")?.hidden &&
          document.querySelector("#fileBackupStatus")?.textContent.includes("Файловый бэкап");

        return {
          title: document.title,
          hasTaskForm: Boolean(document.querySelector("#taskForm")),
          hasHabitList: Boolean(document.querySelector("#habitList")),
          hasArchive: Boolean(document.querySelector("#archiveView")),
          hasHeatmap: document.querySelectorAll(".heatmap-cell").length === 70,
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
              window.RhythmHabitForm &&
              window.RhythmHabitsView &&
              window.RhythmImportExport &&
              window.RhythmNotifications &&
              window.RhythmRecurrence &&
              window.RhythmStateNormalizer &&
              window.RhythmStorage &&
              window.RhythmTaskForm &&
              window.RhythmTasksView &&
              window.RhythmTaskMoves &&
              window.RhythmToast,
          ),
          desktopBridge: Boolean(window.rhythmDesktop?.syncReminders && window.rhythmDesktop?.writeFileBackup),
          taskCreated: Boolean(taskCard),
          quickTaskCreated,
          quickPreviewVisible,
          smartQuickRelative: relativeQuick.title === "Smoke Relative" && Boolean(relativeQuick.time) && relativeQuick.priority === "low",
          smartQuickPhrase: phraseQuick.title === "Smoke Next" && phraseQuick.time === "18:00" && phraseQuick.priority === "high",
          customRepeatWorks,
          customHabitRepeatWorks,
          hasUndoButton,
          undoTaskCreated,
          undoRestored,
          importSafetyBackupCreated,
          importBackupPreserved,
          fileBackupWorks,
          fileBackupInfoWorks: Boolean(fileBackupInfo?.path),
          fileBackupUiVisible,
          calendarDragMove,
          dndOrderChanged,
          archived,
        };
      })()`,
    );
    const failedChecks = Object.entries(result).filter(([key, value]) => key !== "title" && value !== true);
    if (failedChecks.length) {
      console.error(`SMOKE_FAIL ${JSON.stringify(failedChecks)}`);
      app.exit(1);
      return;
    }
    console.log(`SMOKE_OK ${JSON.stringify(result)}`);
    app.quit();
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
    const error = await shell.openPath(backupDir);
    return { ok: !error, path: backupDir, error };
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
