const assert = require("node:assert/strict");
const { cleanText, recurrence, taskMoves, toDateKey } = require("./test-utils.cjs");

module.exports = [
  {
    name: "creates a hidden replacement when moving a timed recurring occurrence to an already scheduled today",
    fn() {
      const state = {
        tasks: [{
          id: "daily-1",
          title: "Daily timed",
          date: "2026-06-01",
          time: "08:00",
          categoryId: "cat",
          priority: "high",
          repeat: "daily",
          reminderOffset: "15",
          completed: {},
          excludedDates: {},
          notified: {},
        }],
        taskOrder: {},
      };
      taskMoves.postponeTask({
        state,
        task: state.tasks[0],
        sourceDateKey: "2026-06-29",
        targetDateKey: "2026-06-30",
        options: { clearPastTimeToday: true },
        helpers: {
          cleanTimeValue: (value) => value,
          createId: () => "replacement-1",
          taskScheduledOn: recurrence.taskScheduledOn,
          toDateKey: () => "2026-06-30",
        },
      });
      assert.equal(state.tasks[0].excludedDates["2026-06-30"], true);
      assert.equal(state.tasks[1].sourceTaskId, "daily-1");
      assert.equal(state.tasks[1].date, "2026-06-30");
      assert.equal(state.tasks[1].time, "");
      assert.equal(state.tasks[1].priority, "high");
    },
  },
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
            priority: "high",
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
      assert.equal(state.tasks[0].priority, "high");
      assert.equal(state.tasks[0].completed["2026-06-26"], undefined);
      assert.equal(state.tasks[0].completed["2026-06-27"], true);
      assert.deepEqual(state.taskOrder["2026-06-26"], ["task-2"]);
    },
  },
  {
    name: "uses the natural target occurrence when a recurring task already runs there",
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
      assert.equal(state.tasks[0].excludedDates["2026-06-30"], undefined);
      assert.equal(state.tasks.length, 1);
      assert.equal(state.tasks[0].priority, "high");
      assert.deepEqual(state.taskOrder["2026-06-26"], []);
    },
  },
  {
    name: "creates a one-off task when the recurring series does not run on the target date",
    fn() {
      const state = {
        tasks: [{
          id: "weekly-1",
          title: "Weekly",
          date: "2026-06-22",
          time: "08:00",
          categoryId: "cat",
          priority: "high",
          repeat: "weekly",
          reminderOffset: "15",
          completed: {},
          excludedDates: {},
          notified: {},
        }],
        taskOrder: {},
      };

      taskMoves.postponeTask({
        state,
        task: state.tasks[0],
        sourceDateKey: "2026-06-22",
        targetDateKey: "2026-06-23",
        helpers: {
          cleanText,
          createId: () => "one-off-1",
          taskScheduledOn: recurrence.taskScheduledOn,
          toDateKey,
          cleanTimeValue: (value) => value,
        },
      });

      assert.equal(state.tasks.length, 2);
      assert.equal(state.tasks[1].date, "2026-06-23");
      assert.equal(state.tasks[1].priority, "high");
      assert.equal(state.tasks[0].excludedDates["2026-06-23"], undefined);
    },
  },
  {
    name: "changes the timeline schedule for only one recurring occurrence",
    fn() {
      const state = {
        tasks: [{
          id: "daily",
          title: "Решить 10 задач SQL",
          date: "2026-07-01",
          time: "",
          categoryId: "study",
          priority: "high",
          repeat: "daily",
          completed: {},
          acknowledgedOverdue: {},
          excludedDates: {},
          notified: {},
        }],
        taskOrder: { "2026-07-12": ["daily"] },
      };

      const occurrence = taskMoves.updateRecurringTaskSchedule({
        state,
        task: state.tasks[0],
        dateKey: "2026-07-12",
        scope: "occurrence",
        schedule: { scheduleMode: "block", startTime: "10:00", endTime: "11:00", time: "11:00" },
        helpers: { createId: () => "daily-occurrence" },
      });

      assert.equal(state.tasks[0].excludedDates["2026-07-12"], true);
      assert.equal(occurrence.repeat, "none");
      assert.equal(occurrence.sourceTaskId, "daily");
      assert.equal(occurrence.startTime, "10:00");
      assert.equal(occurrence.priority, "high");
      assert.deepEqual(state.taskOrder["2026-07-12"], ["daily-occurrence"]);
    },
  },
  {
    name: "splits a recurring series when changing this and following timeline occurrences",
    fn() {
      const state = {
        tasks: [{
          id: "daily",
          title: "Решить 10 задач SQL",
          date: "2026-07-01",
          time: "09:00",
          scheduleMode: "deadline",
          categoryId: "study",
          priority: "high",
          repeat: "daily",
          repeatUntil: "2026-08-01",
          customRepeat: {},
          completed: { "2026-07-11": true, "2026-07-13": true },
          acknowledgedOverdue: {},
          excludedDates: {},
          notified: { "2026-07-13": true },
        }],
        taskOrder: { "2026-07-11": ["daily"], "2026-07-13": ["daily"] },
      };

      const nextSeries = taskMoves.updateRecurringTaskSchedule({
        state,
        task: state.tasks[0],
        dateKey: "2026-07-12",
        scope: "following",
        schedule: { scheduleMode: "block", startTime: "18:00", endTime: "19:00", time: "19:00" },
        helpers: { createId: () => "daily-next" },
      });

      assert.equal(state.tasks[0].repeatUntil, "2026-07-11");
      assert.equal(state.tasks[0].completed["2026-07-11"], true);
      assert.equal(state.tasks[0].completed["2026-07-13"], undefined);
      assert.equal(nextSeries.date, "2026-07-12");
      assert.equal(nextSeries.repeat, "daily");
      assert.equal(nextSeries.repeatUntil, "2026-08-01");
      assert.equal(nextSeries.completed["2026-07-13"], true);
      assert.equal(nextSeries.startTime, "18:00");
      assert.equal(nextSeries.priority, "high");
      assert.deepEqual(state.taskOrder["2026-07-11"], ["daily"]);
      assert.deepEqual(state.taskOrder["2026-07-13"], ["daily-next"]);
    },
  },
  {
    name: "edits only one recurring occurrence without changing the series",
    fn() {
      const state = {
        tasks: [{
          id: "daily",
          title: "Старая формулировка",
          date: "2026-07-01",
          time: "09:00",
          scheduleMode: "deadline",
          categoryId: "study",
          priority: "medium",
          repeat: "daily",
          repeatUntil: "",
          customRepeat: {},
          completed: { "2026-07-13": true },
          acknowledgedOverdue: {},
          excludedDates: {},
          notified: {},
        }],
        taskOrder: { "2026-07-13": ["daily"] },
      };

      const occurrence = taskMoves.updateRecurringTaskDetails({
        state,
        task: state.tasks[0],
        dateKey: "2026-07-13",
        scope: "occurrence",
        editedTask: {
          title: "Новая формулировка",
          time: "11:00",
          scheduleMode: "deadline",
          categoryId: "work",
          priority: "high",
          repeat: "daily",
          reminderOffset: "30",
        },
        helpers: { createId: () => "daily-edited" },
      });

      assert.equal(state.tasks[0].title, "Старая формулировка");
      assert.equal(state.tasks[0].excludedDates["2026-07-13"], true);
      assert.equal(state.tasks[0].completed["2026-07-13"], undefined);
      assert.equal(occurrence.title, "Новая формулировка");
      assert.equal(occurrence.repeat, "none");
      assert.equal(occurrence.priority, "high");
      assert.equal(occurrence.completed["2026-07-13"], true);
      assert.deepEqual(state.taskOrder["2026-07-13"], ["daily-edited"]);
    },
  },
  {
    name: "edits this and following recurring occurrences as a new series",
    fn() {
      const state = {
        tasks: [{
          id: "daily",
          title: "Учиться",
          date: "2026-07-01",
          time: "09:00",
          scheduleMode: "deadline",
          categoryId: "study",
          priority: "medium",
          repeat: "daily",
          repeatUntil: "2026-08-01",
          customRepeat: {},
          completed: { "2026-07-12": true, "2026-07-14": true },
          acknowledgedOverdue: {},
          excludedDates: {},
          notified: { "2026-07-14": true },
        }],
        taskOrder: { "2026-07-12": ["daily"], "2026-07-14": ["daily"] },
      };

      const nextSeries = taskMoves.updateRecurringTaskDetails({
        state,
        task: state.tasks[0],
        dateKey: "2026-07-13",
        scope: "following",
        editedTask: {
          title: "Учиться по-новому",
          time: "18:00",
          scheduleMode: "deadline",
          categoryId: "growth",
          priority: "high",
          repeat: "weekdays",
          repeatUntil: "2026-09-01",
          customRepeat: {},
          reminderOffset: "15",
        },
        helpers: { createId: () => "daily-next" },
      });

      assert.equal(state.tasks[0].repeatUntil, "2026-07-12");
      assert.equal(state.tasks[0].title, "Учиться");
      assert.equal(nextSeries.date, "2026-07-13");
      assert.equal(nextSeries.title, "Учиться по-новому");
      assert.equal(nextSeries.repeat, "weekdays");
      assert.equal(nextSeries.repeatUntil, "2026-09-01");
      assert.equal(nextSeries.completed["2026-07-14"], true);
      assert.equal(state.tasks[0].completed["2026-07-14"], undefined);
      assert.deepEqual(state.taskOrder["2026-07-14"], ["daily-next"]);
    },
  },
  {
    name: "edits the whole recurring series while preserving its start date and history",
    fn() {
      const task = {
        id: "daily",
        title: "До правки",
        date: "2026-07-01",
        time: "09:00",
        scheduleMode: "deadline",
        categoryId: "study",
        priority: "medium",
        repeat: "daily",
        customRepeat: {},
        completed: { "2026-07-10": true },
        excludedDates: {},
        notified: {},
      };
      const state = { tasks: [task], taskOrder: {} };

      taskMoves.updateRecurringTaskDetails({
        state,
        task,
        dateKey: "2026-07-13",
        scope: "series",
        editedTask: {
          title: "После правки",
          date: "2026-07-13",
          time: "",
          scheduleMode: "deadline",
          categoryId: "work",
          priority: "high",
          repeat: "weekly",
          repeatUntil: "",
          customRepeat: {},
          reminderOffset: "none",
        },
      });

      assert.equal(task.date, "2026-07-01");
      assert.equal(task.title, "После правки");
      assert.equal(task.repeat, "weekly");
      assert.equal(task.priority, "high");
      assert.equal(task.completed["2026-07-10"], true);
      assert.equal(state.tasks.length, 1);
    },
  },
];
