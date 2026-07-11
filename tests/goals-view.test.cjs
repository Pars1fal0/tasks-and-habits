const assert = require("node:assert/strict");
const goalsView = require("../goals-view.js");

module.exports = [
  {
    name: "counts active overdue and done goals",
    fn() {
      const stats = goalsView.goalStats(
        [
          { dueDate: "2026-07-02", status: "active" },
          { dueDate: "2026-06-30", status: "active" },
          { dueDate: "2026-06-20", status: "done" },
        ],
        "2026-07-01",
      );

      assert.deepEqual(stats, { active: 1, done: 1, overdue: 1 });
      assert.equal(goalsView.goalState({ dueDate: "2026-06-30", status: "active" }, "2026-07-01"), "overdue");
      assert.equal(goalsView.goalState({ dueDate: "2026-06-30", status: "done" }, "2026-07-01"), "done");
    },
  },
  {
    name: "calculates progress from real linked tasks",
    fn() {
      const tasks = [{ done: true }, { done: false }, { done: true }, { done: false }];
      assert.equal(goalsView.goalProgress({ status: "active", taskIds: ["a", "b", "c", "d"] }, tasks), 50);
    },
  },
  {
    name: "calculates checklist progress and preserves edited steps",
    fn() {
      const steps = goalsView.parseGoalSteps("Дизайн\nВерстка\nДеплой", [
        { id: "a", title: "Дизайн", done: true },
        { id: "b", title: "Верстка", done: false },
      ]);

      assert.equal(steps.length, 3);
      assert.equal(steps[0].id, "a");
      assert.equal(steps[0].done, true);
      assert.equal(steps[1].id, "b");
      assert.equal(steps[1].done, false);
      assert.equal(goalsView.goalProgress({ status: "active", steps }), 33);
      assert.equal(goalsView.goalProgress({ status: "done", steps }), 100);
    },
  },
];
