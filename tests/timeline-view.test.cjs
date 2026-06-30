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
  {
    name: "marks overdue timed tasks and exposes current time line",
    fn() {
      const tasks = [
        { id: "past", title: "Past", time: "09:00", priority: "high", categoryId: "" },
        { id: "future", title: "Future", time: "11:00", priority: "medium", categoryId: "" },
        { id: "done", title: "Done", time: "08:30", priority: "low", categoryId: "" },
      ];
      const model = buildTimelineModel({
        activeDate: "2026-06-30",
        formatTime: (value) => value,
        getCategory: () => null,
        isTaskDone: (task) => task.id === "done",
        now: new Date(2026, 5, 30, 10, 30),
        priorityLabels: { high: "High", medium: "Medium", low: "Low" },
        tasks,
        todayKey: "2026-06-30",
      });

      assert.equal(model.timedTasks.find((entry) => entry.task.id === "past").isOverdue, true);
      assert.equal(model.timedTasks.find((entry) => entry.task.id === "future").isOverdue, false);
      assert.equal(model.timedTasks.find((entry) => entry.task.id === "done").isOverdue, false);
      assert.deepEqual(model.nowLine, { hour: 10, offsetPercent: 50 });
    },
  },
];
