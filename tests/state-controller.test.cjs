const assert = require("node:assert/strict");
const { createStateController } = require("../state-controller.js");

module.exports = [
  {
    name: "normalizes replacements and tracks persisted state changes",
    fn() {
      const tracked = [];
      const saved = [];
      const controller = createStateController({
        clone: (value) => structuredClone(value),
        initialState: { value: 1 },
        normalizeState: (value) => ({ value: Number(value?.value) || 0 }),
        schemaVersion: 12,
        storage: {
          saveState(state, options) {
            saved.push({ state: structuredClone(state), options });
            return structuredClone(state);
          },
        },
        trackChanges: (previous, next) => tracked.push([previous.value, next.value]),
      });

      const replacement = controller.replaceState({ value: "2" });
      assert.equal(replacement.value, 2);
      controller.saveState(replacement, { skipBackup: true });
      assert.deepEqual(tracked, [[1, 2]]);
      assert.equal(saved[0].options.schemaVersion, 12);
      assert.equal(saved[0].options.skipBackup, true);
    },
  },
];
