const assert = require("node:assert/strict");
const { createTaskState } = require("../task-state.js");

module.exports = [
  {
    name: "removes a deleted task from orders and linked goals",
    fn() {
      const state = {
        goals: [{ id: "goal-1", taskIds: ["task-1", "task-2"] }],
        habits: [],
        tasks: [{ id: "task-1" }, { id: "task-2" }],
        taskOrder: { "2026-07-11": ["task-1", "task-2"] },
      };
      const result = createTaskState({ getState: () => state }).deleteTask("task-1");
      assert.deepEqual(state.tasks.map((task) => task.id), ["task-2"]);
      assert.deepEqual(state.taskOrder["2026-07-11"], ["task-2"]);
      assert.deepEqual(state.goals[0].taskIds, ["task-2"]);
      assert.equal(result.linkedGoalCount, 1);
    },
  },
];
