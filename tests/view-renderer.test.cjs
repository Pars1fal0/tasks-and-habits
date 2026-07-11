const assert = require("node:assert/strict");
const { createViewRenderer } = require("../view-renderer.js");

module.exports = [
  {
    name: "renders only the active view and shared pulse",
    fn() {
      const calls = [];
      const names = ["renderArchive", "renderCategories", "renderDailyPulse", "renderGoals", "renderHabits", "renderOverview", "renderTasks", "renderTimeline", "renderWeekdayLabels"];
      const ctx = Object.fromEntries(names.map((name) => [name, () => calls.push(name)]));
      createViewRenderer(ctx).render("timeline");
      assert.deepEqual(calls, ["renderDailyPulse", "renderCategories", "renderTimeline"]);
    },
  },
];
