const assert = require("node:assert/strict");
const { createOverdueController } = require("../overdue-controller.js");

module.exports = [
  {
    name: "keeps overdue occurrences older than sixty days",
    fn() {
      const tasks = [{ id: "old", title: "Old", date: "2026-01-01", time: "", repeat: "none", completed: {} }];
      const controller = createOverdueController({
        getTaskDeadlineDate: (_task, dateKey) => new Date(`${dateKey}T23:59:59`),
        getTasks: () => tasks,
        isTaskDone: () => false,
        isTaskExcluded: () => false,
        taskScheduledOn: () => true,
        toDateKey: (date) => date.toISOString().slice(0, 10),
      });
      assert.equal(controller.list(new Date("2026-07-11T12:00:00")).length, 1);
    },
  },
];
