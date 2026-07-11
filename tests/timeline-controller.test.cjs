const assert = require("node:assert/strict");
const { createTimelineController } = require("../timeline-controller.js");

function createHarness() {
  const state = {
    taskOrder: {
      "2026-07-02": ["task-1"],
    },
    tasks: [
      {
        id: "task-1",
        title: "Timeline task",
        date: "2026-07-02",
        time: "10:00",
        categoryId: "",
        priority: "medium",
        repeat: "none",
        reminderOffset: "none",
        completed: {},
        excludedDates: {},
        notified: { "2026-07-02": true },
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ],
  };
  const calls = {
    render: 0,
    save: 0,
    toasts: [],
  };
  const messages = {
    active: "active",
    blockUpdated: "block updated",
    copySuffix: "copy",
    deleted: "deleted",
    done: "done",
    duplicated: "duplicated",
    movedTo: "moved to",
    timeUpdated: "time updated",
  };
  const ctx = {
    cleanTimeValue: (value) => value,
    createId: () => "task-copy",
    createUndoSnapshot: () => ({ state: "before" }),
    deleteTask(taskId) {
      state.tasks = state.tasks.filter((task) => task.id !== taskId);
      Object.keys(state.taskOrder).forEach((dateKey) => {
        state.taskOrder[dateKey] = state.taskOrder[dateKey].filter((id) => id !== taskId);
      });
    },
    els: {},
    findTask: (id) => state.tasks.find((task) => task.id === id),
    formatTaskWindow: (task) => `${task.startTime}-${task.endTime}`,
    formatTime: (value) => value,
    getActiveDate: () => "2026-07-02",
    getOrderedTasksForDate: (dateKey) => {
      const order = state.taskOrder[dateKey] || [];
      return [...state.tasks].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    },
    getState: () => state,
    isTaskDone: (task, dateKey) => task.completed?.[dateKey] === true,
    isTimeBlock: (task) => task.scheduleMode === "block",
    isValidTimeBlock: (start, end) => start < end,
    messages,
    minutesToTime: (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    render: () => {
      calls.render += 1;
    },
    saveState: () => {
      calls.save += 1;
    },
    showToast: (message, options) => {
      calls.toasts.push({ message, options });
    },
    taskSortTime: (task) => task.time,
    timeToMinutes: (value) => {
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    },
  };

  return {
    calls,
    controller: createTimelineController(ctx),
    state,
  };
}

module.exports = [
  {
    name: "turns an unscheduled timeline drop into a resizable one-hour block",
    fn() {
      const { controller, state } = createHarness();
      const task = state.tasks[0];
      task.time = "";
      task.priority = "high";

      assert.equal(controller.moveTaskTime(task.id, "14:15"), true);

      assert.equal(task.scheduleMode, "block");
      assert.equal(task.startTime, "14:15");
      assert.equal(task.endTime, "15:15");
      assert.equal(task.time, "15:15");
      assert.equal(task.priority, "high");
    },
  },
  {
    name: "toggles a timeline task done with undo toast",
    fn() {
      const { calls, controller, state } = createHarness();

      assert.equal(controller.toggleTaskDone("task-1"), true);

      assert.equal(state.tasks[0].completed["2026-07-02"], true);
      assert.equal(calls.save, 1);
      assert.equal(calls.render, 1);
      assert.equal(calls.toasts[0].message, "done");
      assert.deepEqual(calls.toasts[0].options.undo, { state: "before" });
    },
  },
  {
    name: "duplicates a timeline task next to the source",
    fn() {
      const { calls, controller, state } = createHarness();

      const duplicate = controller.duplicateTask("task-1");

      assert.equal(duplicate.id, "task-copy");
      assert.equal(duplicate.title, "Timeline task copy");
      assert.equal(duplicate.date, "2026-07-02");
      assert.deepEqual(duplicate.completed, {});
      assert.deepEqual(duplicate.notified, {});
      assert.deepEqual(state.taskOrder["2026-07-02"], ["task-1", "task-copy"]);
      assert.equal(calls.toasts[0].message, "duplicated");
    },
  },
  {
    name: "deletes a timeline task from tasks and order",
    fn() {
      const { calls, controller, state } = createHarness();

      assert.equal(controller.deleteTask("task-1"), true);

      assert.deepEqual(state.tasks, []);
      assert.deepEqual(state.taskOrder["2026-07-02"], []);
      assert.equal(calls.save, 1);
      assert.equal(calls.render, 1);
      assert.equal(calls.toasts[0].message, "deleted");
    },
  },
];
