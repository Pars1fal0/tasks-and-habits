const assert = require("node:assert/strict");
const { createStateNormalizer } = require("./test-utils.cjs");

module.exports = [
  {
    name: "cleans imported tasks and habits",
    fn() {
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
    },
  },
];
