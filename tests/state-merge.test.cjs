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
    name: "keeps a deletion across two devices even when the stale device clock is ahead",
    fn() {
      const deletedOnLaptop = {
        tasks: [], habits: [], goals: [], categories: [], taskOrder: { "2026-07-13": [] },
        tombstones: { tasks: { shared: "2026-07-13T10:00:00.000Z" } },
      };
      const staleOnDesktop = {
        tasks: [{ id: "shared", title: "Stale task", updatedAt: "2030-01-01T00:00:00.000Z" }],
        habits: [], goals: [], categories: [], taskOrder: { "2026-07-13": ["shared"] },
      };

      const desktopAfterPull = mergeStates(staleOnDesktop, deletedOnLaptop);
      const laptopAfterDesktopPush = mergeStates(deletedOnLaptop, desktopAfterPull);

      assert.equal(desktopAfterPull.tasks.length, 0);
      assert.deepEqual(desktopAfterPull.taskOrder["2026-07-13"], []);
      assert.equal(laptopAfterDesktopPush.tasks.length, 0);
      assert.equal(laptopAfterDesktopPush.tombstones.tasks.shared, "2026-07-13T10:00:00.000Z");
    },
  },
];
