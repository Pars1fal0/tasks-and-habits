const assert = require("node:assert/strict");
const { createMemoryStorage, storageApi } = require("./test-utils.cjs");

module.exports = [
  {
    name: "adapter saves state, ui state, backups, and import safety backup",
    fn() {
      const memoryStorage = createMemoryStorage();
      const storage = storageApi.createLocalStorageAdapter({
        storage: memoryStorage,
        schemaVersion: 7,
      });

      storage.saveUiState({ taskSearchQuery: "дом" });
      assert.deepEqual(storage.loadUiState(), { taskSearchQuery: "дом" });

      const state = storage.saveState({ tasks: [], habits: [], goals: [], categories: [] }, { schemaVersion: 7, skipBackup: true });
      assert.equal(state.schemaVersion, 7);
      assert.equal(storage.loadState().schemaVersion, 7);
      assert.deepEqual(storage.loadStateWithRecovery(), { state, status: "ok" });

      assert.equal(storage.createBackup({ state, now: 100000 }).ok, true);
      assert.equal(storage.createBackup({ state, now: 100100, throttle: true }).reason, "throttled");
      assert.equal(storage.loadBackup().state.schemaVersion, 7);

      const safety = storage.createImportSafetyBackup({ state: JSON.stringify(state) }, { schemaVersion: 7 });
      assert.equal(safety.ok, true);
      assert.equal(JSON.parse(memoryStorage.getItem(storage.keys.importSafetyBackup)).reason, "before-import");
    },
  },
  {
    name: "archives corrupt state and restores the latest valid backup",
    fn() {
      const memoryStorage = createMemoryStorage();
      const storage = storageApi.createLocalStorageAdapter({
        storage: memoryStorage,
        schemaVersion: 7,
      });
      const backupState = { schemaVersion: 7, tasks: [{ id: "safe" }] };
      memoryStorage.setItem(storage.keys.state, "{broken");
      memoryStorage.setItem(storage.keys.backup, JSON.stringify({ state: backupState }));

      const result = storage.loadStateWithRecovery();

      assert.equal(result.status, "recovered");
      assert.deepEqual(result.state, backupState);
      assert.equal(memoryStorage.getItem(storage.keys.corruptState), "{broken");
      assert.deepEqual(JSON.parse(memoryStorage.getItem(storage.keys.state)), backupState);
    },
  },
  {
    name: "keeps the previous valid state as the automatic undo backup",
    fn() {
      const memoryStorage = createMemoryStorage();
      const storage = storageApi.createLocalStorageAdapter({ storage: memoryStorage, schemaVersion: 7 });
      storage.saveState({ tasks: [{ id: "before" }] }, { skipBackup: true });
      storage.saveState({ tasks: [{ id: "after" }] });

      assert.deepEqual(storage.loadBackup().state.tasks, [{ id: "before" }]);
      assert.deepEqual(storage.loadState().tasks, [{ id: "after" }]);
    },
  },
];
