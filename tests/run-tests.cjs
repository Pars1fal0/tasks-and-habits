const assert = require("node:assert/strict");

const quickInput = require("../quick-input.js");
const recurrence = require("../recurrence.js");
const storageApi = require("../storage.js");
const taskMoves = require("../task-moves.js");
const stateNormalizerApi = require("../state-normalizer.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function normalizeDateKey(value, fallback = "") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return fallback;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTimeValue(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function createStateNormalizer() {
  return stateNormalizerApi.createStateNormalizer({
    schemaVersion: 5,
    validPriorities: ["high", "medium", "low"],
    cleanText,
    cleanTimeValue: (value) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
      if (!match) return "";
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    },
    createId: (() => {
      let index = 0;
      return () => `id-${(index += 1)}`;
    })(),
    normalizeDateKey: (value, fallback = "2026-06-26") => normalizeDateKey(value, fallback),
    normalizeHabitLogs: (value, type) => {
      const logs = {};
      Object.entries(value || {}).forEach(([dateKey, entry]) => {
        const normalizedDate = normalizeDateKey(dateKey, "");
        if (!normalizedDate) return;
        logs[normalizedDate] = type === "number" ? Math.max(0, Number(entry || 0)) : entry === true;
      });
      return logs;
    },
    normalizeHabitRepeat: (value) =>
      ["daily", "every2days", "every3days", "weekdays", "weekends", "weekly", "custom"].includes(value)
        ? value
        : "daily",
    normalizeReminderOffset: (value, hasTime = true) => {
      const offset = String(value ?? (hasTime ? "15" : "none"));
      return ["none", "0", "5", "15", "30", "60", "1440"].includes(offset) ? offset : hasTime ? "15" : "none";
    },
    normalizeTaskFlags: (value) => {
      const flags = {};
      Object.entries(value || {}).forEach(([dateKey, entry]) => {
        const normalizedDate = normalizeDateKey(dateKey, "");
        if (normalizedDate && entry === true) flags[normalizedDate] = true;
      });
      return flags;
    },
    normalizeTaskOrder: (value) => {
      const order = {};
      Object.entries(value || {}).forEach(([dateKey, ids]) => {
        const normalizedDate = normalizeDateKey(dateKey, "");
        if (normalizedDate && Array.isArray(ids)) order[normalizedDate] = ids.map(String);
      });
      return order;
    },
    randomCategoryColor: () => "#00a78e",
    recurrence,
    sanitizeColor: (value) => (/^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : ""),
    toDateKey,
  });
}

test("quick input parses date, time word, category, and priority", () => {
  const parsed = quickInput.parseQuickTaskInput("Позвонить врачу 2026-07-15 вечером #здоровье !high", {
    activeDate: "2026-06-26",
    cleanText,
    getOrCreateCategory: () => "cat-health",
    normalizeCategoryName: (value) => cleanText(value).replace(/^./, (char) => char.toLocaleUpperCase("ru-RU")),
    normalizeDateKey,
    toDateKey,
    toTimeValue,
  });

  assert.equal(parsed.title, "Позвонить врачу");
  assert.equal(parsed.date, "2026-07-15");
  assert.equal(parsed.time, "18:00");
  assert.equal(parsed.categoryId, "cat-health");
  assert.equal(parsed.categoryName, "Здоровье");
  assert.equal(parsed.priority, "high");
});

test("quick input parses relative time without losing the title", () => {
  const parsed = quickInput.parseQuickTaskInput("Сдать отчет через 2 часа !low", {
    activeDate: "2026-06-26",
    cleanText,
    normalizeDateKey,
    toDateKey,
    toTimeValue,
  });

  assert.equal(parsed.title, "Сдать отчет");
  assert.match(parsed.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(parsed.time, /^\d{2}:\d{2}$/);
  assert.equal(parsed.priority, "low");
});

test("custom weekday recurrence matches selected weekdays only", () => {
  const task = {
    date: "2026-06-22",
    repeat: "custom",
    customRepeat: { type: "weekdays", weekdays: [1, 3, 5] },
  };

  assert.equal(recurrence.taskScheduledOn(task, "2026-06-24"), true);
  assert.equal(recurrence.taskScheduledOn(task, "2026-06-26"), true);
  assert.equal(recurrence.taskScheduledOn(task, "2026-06-27"), false);
  assert.equal(recurrence.repeatLabel(task), "По дням: ПН, СР, ПТ");
});

test("custom month-day and interval recurrences are normalized", () => {
  assert.equal(
    recurrence.taskScheduledOn(
      { date: "2026-01-01", repeat: "custom", customRepeat: { type: "monthDay", day: 15 } },
      "2026-02-15",
    ),
    true,
  );
  assert.equal(
    recurrence.taskScheduledOn(
      { date: "2026-01-01", repeat: "custom", customRepeat: { type: "monthDay", day: 15 } },
      "2026-02-14",
    ),
    false,
  );
  assert.equal(
    recurrence.taskScheduledOn(
      { date: "2026-06-01", repeat: "custom", customRepeat: { type: "interval", every: 5 } },
      "2026-06-06",
    ),
    true,
  );
  assert.deepEqual(recurrence.normalizeCustomRepeat({ type: "interval", every: 999 }), {
    type: "interval",
    every: 365,
  });
});

test("storage adapter saves state, ui state, backups, and import safety backup", () => {
  const memoryStorage = createMemoryStorage();
  const storage = storageApi.createLocalStorageAdapter({
    storage: memoryStorage,
    schemaVersion: 5,
  });

  storage.saveUiState({ taskSearchQuery: "дом" });
  assert.deepEqual(storage.loadUiState(), { taskSearchQuery: "дом" });

  const state = storage.saveState({ tasks: [], habits: [], categories: [] }, { schemaVersion: 5, skipBackup: true });
  assert.equal(state.schemaVersion, 5);
  assert.equal(storage.loadState().schemaVersion, 5);

  assert.equal(storage.createBackup({ state, now: 100000 }).ok, true);
  assert.equal(storage.createBackup({ state, now: 100100, throttle: true }).reason, "throttled");
  assert.equal(storage.loadBackup().state.schemaVersion, 5);

  const safety = storage.createImportSafetyBackup({ state: JSON.stringify(state) }, { schemaVersion: 5 });
  assert.equal(safety.ok, true);
  assert.equal(JSON.parse(memoryStorage.getItem(storage.keys.importSafetyBackup)).reason, "before-import");
});

test("task moves transfer single tasks and clear old order", () => {
  const state = {
    tasks: [
      {
        id: "task-1",
        title: "Move me",
        date: "2026-06-26",
        time: "09:00",
        repeat: "none",
        completed: { "2026-06-26": true },
        notified: { "2026-06-26": true },
      },
    ],
    taskOrder: { "2026-06-26": ["task-1", "task-2"] },
  };

  taskMoves.postponeTask({
    state,
    task: state.tasks[0],
    sourceDateKey: "2026-06-26",
    targetDateKey: "2026-06-27",
    helpers: { toDateKey, cleanTimeValue: (value) => value },
  });

  assert.equal(state.tasks[0].date, "2026-06-27");
  assert.equal(state.tasks[0].completed["2026-06-26"], undefined);
  assert.equal(state.tasks[0].completed["2026-06-27"], true);
  assert.deepEqual(state.taskOrder["2026-06-26"], ["task-2"]);
});

test("task moves convert recurring occurrence into one-off task", () => {
  const state = {
    tasks: [
      {
        id: "repeat-1",
        title: "Repeat me",
        date: "2026-06-01",
        time: "08:00",
        categoryId: "cat",
        priority: "high",
        repeat: "daily",
        reminderOffset: "15",
        completed: { "2026-06-26": true },
        excludedDates: {},
        notified: {},
      },
    ],
    taskOrder: { "2026-06-26": ["repeat-1"] },
  };

  taskMoves.postponeTask({
    state,
    task: state.tasks[0],
    sourceDateKey: "2026-06-26",
    targetDateKey: "2026-06-30",
    helpers: {
      createId: () => "one-off-1",
      taskScheduledOn: recurrence.taskScheduledOn,
      toDateKey,
      cleanTimeValue: (value) => value,
    },
  });

  assert.equal(state.tasks[0].excludedDates["2026-06-26"], true);
  assert.equal(state.tasks[0].excludedDates["2026-06-30"], true);
  assert.equal(state.tasks[1].id, "one-off-1");
  assert.equal(state.tasks[1].repeat, "none");
  assert.equal(state.tasks[1].date, "2026-06-30");
  assert.deepEqual(state.taskOrder["2026-06-26"], []);
});

test("state normalizer cleans imported tasks and habits", () => {
  const normalizer = createStateNormalizer();
  const normalized = normalizer.normalizeState({
    categories: [{ id: "cat-1", name: "Дом", color: "not-a-color" }],
    tasks: [
      {
        id: "task-1",
        title: "",
        date: "bad-date",
        time: "25:99",
        category: "Работа",
        priority: "urgent-ish",
        repeat: "custom",
        customRepeat: { type: "interval", every: 4 },
        reminderOffset: "999",
        completed: { "2026-06-26": true, nope: true },
      },
    ],
    habits: [
      {
        id: "habit-1",
        title: "",
        type: "number",
        repeat: "custom",
        customRepeat: { type: "monthDay", day: 31 },
        goal: 0,
        logs: { "2026-06-26": "3" },
      },
    ],
    taskOrder: { "2026-06-26": [123] },
  });

  assert.equal(normalized.schemaVersion, 5);
  assert.equal(normalized.categories[0].color, "#00a78e");
  assert.equal(normalized.categories[1].name, "Работа");
  assert.equal(normalized.tasks[0].title, "Задача");
  assert.equal(normalized.tasks[0].date, "2026-06-26");
  assert.equal(normalized.tasks[0].time, "");
  assert.equal(normalized.tasks[0].priority, "medium");
  assert.equal(normalized.tasks[0].customRepeat.every, 4);
  assert.equal(normalized.tasks[0].reminderOffset, "none");
  assert.deepEqual(normalized.tasks[0].completed, { "2026-06-26": true });
  assert.equal(normalized.habits[0].title, "Привычка");
  assert.equal(normalized.habits[0].goal, 1);
  assert.deepEqual(normalized.habits[0].logs, { "2026-06-26": 3 });
  assert.deepEqual(normalized.taskOrder, { "2026-06-26": ["123"] });
});

let failed = 0;

for (const item of tests) {
  try {
    item.fn();
    console.log(`ok - ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${item.name}`);
    console.error(error);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} tests passed`);
}
