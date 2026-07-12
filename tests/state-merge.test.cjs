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
  {
    name: "keeps the newest entity fields while merging dated activity",
    fn() {
      const merged = mergeStates(
        {
          tasks: [{ id: "task", title: "New local title", updatedAt: "2026-07-12T12:00:00.000Z", completed: {} }],
          habits: [], goals: [], categories: [], taskOrder: {},
        },
        {
          tasks: [{ id: "task", title: "Old remote title", updatedAt: "2026-07-11T12:00:00.000Z", completed: { "2026-07-11": true } }],
          habits: [], goals: [], categories: [], taskOrder: {},
        },
      );
      assert.equal(merged.tasks[0].title, "New local title");
      assert.equal(merged.tasks[0].completed["2026-07-11"], true);
    },
  },
  {
    name: "does not resurrect an entity deleted on another device",
    fn() {
      const merged = mergeStates(
        {
          tasks: [], habits: [], goals: [], categories: [], taskOrder: {},
          tombstones: { tasks: { removed: "2026-07-12T12:00:00.000Z" } },
        },
        {
          tasks: [{ id: "removed", title: "Stale task", updatedAt: "2026-07-11T12:00:00.000Z" }],
          habits: [], goals: [], categories: [], taskOrder: {},
        },
      );
      assert.equal(merged.tasks.length, 0);
      assert.equal(merged.tombstones.tasks.removed, "2026-07-12T12:00:00.000Z");
    },
  },
  {
    name: "allows a record recreated after its deletion marker",
    fn() {
      const merged = mergeStates(
        {
          tasks: [], habits: [], goals: [], categories: [], taskOrder: {},
          tombstones: { tasks: { restored: "2026-07-11T12:00:00.000Z" } },
        },
        {
          tasks: [{ id: "restored", title: "Restored", updatedAt: "2026-07-12T12:00:00.000Z" }],
          habits: [], goals: [], categories: [], taskOrder: {},
        },
      );
      assert.equal(merged.tasks[0].title, "Restored");
    },
  },
];
