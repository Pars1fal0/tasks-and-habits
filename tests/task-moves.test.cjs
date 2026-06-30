const assert = require("node:assert/strict");
const { cleanText, recurrence, taskMoves, toDateKey } = require("./test-utils.cjs");

module.exports = [
  {
    name: "transfer single tasks and clear old order",
    fn() {
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
    },
  },
  {
    name: "convert recurring occurrence into one-off task",
    fn() {
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
          cleanText,
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
    },
  },
];
