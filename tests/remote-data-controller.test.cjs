const assert = require("node:assert/strict");
const { installDom } = require("./dom-test-utils.cjs");
const { createRemoteDataController, snapshotSummaryParts } = require("../remote-data-controller.js");

module.exports = [
  {
    name: "describes cloud snapshots with useful entity counts",
    fn() {
      assert.deepEqual(
        snapshotSummaryParts({ goals: 2, habits: 4, tasks: 12 }),
        ["12 задач", "4 привычек", "2 целей"],
      );
      assert.deepEqual(snapshotSummaryParts(), []);
    },
  },
  {
    name: "restoring a cloud snapshot creates a safety backup and exposes undo",
    async fn() {
      const document = installDom();
      const select = document.createElement("select");
      select.value = "7";
      const restoreButton = document.createElement("button");
      const status = document.createElement("p");
      const undo = { state: "before" };
      const calls = { saved: null, toast: null };
      const controller = createRemoteDataController({
        confirmAction: async () => true,
        createImportSafetyBackup: () => ({ ok: true }),
        createUndoSnapshot: () => undo,
        els: {
          remoteAccountDeleteButton: document.createElement("button"),
          remoteSnapshotRestoreButton: restoreButton,
          remoteSnapshotSelect: select,
          remoteSnapshotsLoadButton: document.createElement("button"),
          remoteSnapshotsStatus: status,
        },
        formatDate: () => "date",
        getConfig: () => ({}),
        getState: () => ({ tasks: [{ id: "before" }] }),
        isReady: () => true,
        remoteSync: {
          listSnapshots: async () => ({ snapshots: [] }),
          restoreSnapshot: async () => ({ snapshot: { state: { tasks: [{ id: "after" }] } } }),
        },
        render() {},
        replaceState() {},
        saveState: (options) => {
          calls.saved = options;
        },
        showToast: (message, options) => {
          calls.toast = { message, options };
        },
      });

      await controller.restoreSelectedSnapshot();
      assert.deepEqual(calls.saved, { skipBackup: true, skipRemote: true });
      assert.equal(calls.toast.message, "Облачная версия восстановлена");
      assert.equal(calls.toast.options.undo, undo);
    },
  },
];
