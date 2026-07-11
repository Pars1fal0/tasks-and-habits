const assert = require("node:assert/strict");
const { mergeStates } = require("../state-merge.js");

module.exports = [
  {
    name: "merges records and dated logs from two devices",
    fn() {
      const merged = mergeStates(
        {
          tasks: [{ id: "shared", title: "Local", completed: { "2026-07-11": true } }, { id: "local" }],
          habits: [{ id: "habit", logs: { "2026-07-11": 2 } }], goals: [], categories: [], taskOrder: {},
        },
        {
          tasks: [{ id: "shared", title: "Remote", completed: { "2026-07-12": true } }, { id: "remote" }],
          habits: [{ id: "habit", logs: { "2026-07-12": 3 } }], goals: [], categories: [], taskOrder: {},
        },
      );
      assert.deepEqual(merged.tasks.map((task) => task.id), ["shared", "local", "remote"]);
      assert.deepEqual(merged.tasks[0].completed, { "2026-07-11": true, "2026-07-12": true });
      assert.deepEqual(merged.habits[0].logs, { "2026-07-11": 2, "2026-07-12": 3 });
    },
  },
];
