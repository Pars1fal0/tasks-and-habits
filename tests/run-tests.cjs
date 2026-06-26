const assert = require("node:assert/strict");

const quickInput = require("../quick-input.js");
const recurrence = require("../recurrence.js");
const storageApi = require("../storage.js");

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
