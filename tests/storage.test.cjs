const assert = require("node:assert/strict");
const { createMemoryStorage, storageApi } = require("./test-utils.cjs");

module.exports = [
  {
    name: "adapter saves state, ui state, backups, and import safety backup",
    fn() {
      const memoryStorage = createMemoryStorage();
      const storage = storageApi.createLocalStorageAdapter({
        storage: memoryStorage,
        schemaVersion: 5,
      });

      storage.saveUiState({ taskSearchQuery: "дом" });
      assert.deepEqual(storage.loadUiState(), { taskSearchQuery: "дом" });

      const state = storage.saveState({ tasks: [], habits: [], categories: [] }, { schemaVersion: 5, skipBackup: true });
      assert.equal(state.schemaVersion, 5);
      assert.equal(storage.loadState().schemaVersion, 5);

      assert.equal(storage.createBackup({ state, now: 100000 }).ok, true);
      assert.equal(storage.createBackup({ state, now: 100100, throttle: true }).reason, "throttled");
      assert.equal(storage.loadBackup().state.schemaVersion, 5);

      const safety = storage.createImportSafetyBackup({ state: JSON.stringify(state) }, { schemaVersion: 5 });
      assert.equal(safety.ok, true);
      assert.equal(JSON.parse(memoryStorage.getItem(storage.keys.importSafetyBackup)).reason, "before-import");
    },
  },
];
