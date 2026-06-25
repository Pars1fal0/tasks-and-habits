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
const sentReminders = new Set();

if (isSmokeTest) {
  app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "rhythm-day-smoke-")));
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
      `(() => {
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

        return {
          title: document.title,
          hasTaskForm: Boolean(document.querySelector("#taskForm")),
          hasHabitList: Boolean(document.querySelector("#habitList")),
          hasArchive: Boolean(document.querySelector("#archiveView")),
          hasHeatmap: document.querySelectorAll(".heatmap-cell").length === 70,
          hasCategories: document.querySelectorAll(".category-item").length >= 1,
          hasJsonActions: Boolean(document.querySelector("#exportButton")) && Boolean(document.querySelector("#importFile")),
          desktopBridge: Boolean(window.rhythmDesktop?.syncReminders),
          taskCreated: Boolean(taskCard),
          dndOrderChanged,
          archived,
        };
      })()`,
    );
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
