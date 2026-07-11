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
        goals: [
          {
            id: "goal-1",
            title: "",
            description: "  Сделать  MVP  ",
            measure: "  3 шага  ",
            reality: "  есть  время  ",
            why: "  важно  для роста  ",
            dueDate: "bad-date",
            taskIds: ["task-1", "missing-task"],
            steps: [
              { id: "step-1", title: "  Дизайн  ", done: true },
              { title: "  ", done: true },
              "Деплой",
            ],
            status: "done",
          },
        ],
        taskOrder: { "2026-06-26": [123] },
      });

      assert.equal(normalized.schemaVersion, 7);
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
      assert.equal(normalized.goals[0].title, "Цель");
      assert.equal(normalized.goals[0].description, "Сделать MVP");
      assert.equal(normalized.goals[0].measure, "3 шага");
      assert.equal(normalized.goals[0].reality, "есть время");
      assert.equal(normalized.goals[0].why, "важно для роста");
      assert.equal(normalized.goals[0].dueDate, "2026-06-26");
      assert.deepEqual(normalized.goals[0].taskIds, ["task-1"]);
      assert.deepEqual(
        normalized.goals[0].steps.map((step) => ({ done: step.done, title: step.title })),
        [
          { done: true, title: "Дизайн" },
          { done: false, title: "Деплой" },
        ],
      );
      assert.equal(normalized.goals[0].status, "done");
      assert.ok(normalized.goals[0].completedAt);
      assert.deepEqual(normalized.taskOrder, { "2026-06-26": ["123"] });
    },
  },
  {
    name: "normalizes scheduled task blocks",
    fn() {
      const normalizer = createStateNormalizer();
      const normalized = normalizer.normalizeState({
        tasks: [
          {
            id: "task-block",
            title: "Созвон",
            date: "2026-06-30",
            time: "",
            startTime: "14:00",
            endTime: "15:30",
            priority: "high",
            repeat: "none",
          },
        ],
      });

      assert.equal(normalized.tasks[0].scheduleMode, "block");
      assert.equal(normalized.tasks[0].startTime, "14:00");
      assert.equal(normalized.tasks[0].endTime, "15:30");
      assert.equal(normalized.tasks[0].time, "15:30");
      assert.equal(normalized.tasks[0].reminderOffset, "15");
    },
  },
];
