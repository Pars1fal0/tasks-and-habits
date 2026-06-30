const assert = require("node:assert/strict");
const { buildTimelineModel } = require("../timeline-view.js");

module.exports = [
  {
    name: "groups timed tasks by hour and keeps unscheduled tasks separate",
    fn() {
      const tasks = [
        { id: "late", title: "Late", time: "18:30", priority: "low", categoryId: "cat" },
        { id: "none", title: "No time", time: "", priority: "high", categoryId: "" },
        { id: "early", title: "Early", time: "08:15", priority: "medium", categoryId: "" },
      ];
      const model = buildTimelineModel({
        activeDate: "2026-06-30",
        formatTime: (value) => value,
        getCategory: (id) => (id ? { name: "Work", color: "#00a78e" } : null),
        isTaskDone: (task) => task.id === "early",
        priorityLabels: { high: "High", medium: "Medium", low: "Low" },
        tasks,
      });

      assert.deepEqual(model.timedTasks.map((entry) => entry.task.id), ["early", "late"]);
      assert.deepEqual(model.unscheduledTasks.map((entry) => entry.task.id), ["none"]);
      assert.equal(model.hourRows.find((row) => row.hour === 8).tasks[0].done, true);
      assert.equal(model.hourRows.find((row) => row.hour === 18).tasks[0].metaLabel, "Work");
    },
  },
];
