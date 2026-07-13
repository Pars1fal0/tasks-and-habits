const assert = require("node:assert/strict");
const { buildWeeklySummary } = require("../weekly-summary.js");

module.exports = [
  {
    name: "builds a compact weekly total and identifies the best active day",
    fn() {
      const stats = {
        monday: { taskDone: 1, taskTotal: 2, taskPercent: 50, habitDone: 1, habitTotal: 2, habitPercent: 50 },
        tuesday: { taskDone: 2, taskTotal: 2, taskPercent: 100, habitDone: 1, habitTotal: 1, habitPercent: 100 },
      };
      const summary = buildWeeklySummary(["monday", "tuesday"], (dateKey) => stats[dateKey], (dateKey) => dateKey);

      assert.equal(summary.taskDone, 3);
      assert.equal(summary.habitDone, 2);
      assert.equal(summary.bestDayLabel, "tuesday, 100%");
      assert.equal(summary.overall, 71);
    },
  },
  {
    name: "returns a useful empty weekly summary",
    fn() {
      const empty = { taskDone: 0, taskTotal: 0, taskPercent: 0, habitDone: 0, habitTotal: 0, habitPercent: 0 };
      const summary = buildWeeklySummary(["monday"], () => empty, (value) => value);
      assert.equal(summary.bestDayLabel, "Нет данных");
      assert.match(summary.text, /пока нет/);
    },
  },
];
