const assert = require("node:assert/strict");
const { createRemoteSyncController, createRemoteSyncWorkflow } = require("../remote-sync-controller.js");

module.exports = [
  {
    name: "generates a strong private sync key",
    fn() {
      const controller = createRemoteSyncController({
        crypto: { getRandomValues: (bytes) => bytes.fill(10) },
      });
      const key = controller.generatePrivateKey();
      assert.equal(controller.isSecurePrivateKey(key), true);
      assert.equal(controller.isSecurePrivateKey("me@example.com"), false);
    },
  },
  {
    name: "merges a newer remote snapshot during automatic sync",
    async fn() {
      let enabled = true;
      let replaced = null;
      let safety = null;
      const workflow = createRemoteSyncWorkflow({
        createImportSafetyBackup: (snapshot) => { safety = snapshot; },
        createUndoSnapshot: () => ({ state: "local" }),
        describeError: (error) => error.message,
        formatDate: (value) => value,
        getLocalUpdatedAt: () => "2026-07-12T00:00:00.000Z",
        getRemoteUiSettings: () => ({}),
        getSettings: () => ({ enabled, anonKey: "anon", supabaseUrl: "url", userKey: "key" }),
        getState: () => ({ tasks: [{ id: "local" }] }),
        getSyncMeta: () => ({ lastPulledAt: "", lastPushedAt: "" }),
        isRemoteVersionNewer: () => true,
        isSecurePrivateKey: () => true,
        latestIsoDate: () => "",
        mergeStates: () => ({ tasks: [{ id: "merged" }] }),
        remoteSync: {
          normalizeConfig: (config) => config,
          isConfigured: (config) => config.enabled,
          pullState: async () => {
            enabled = false;
            return { found: true, clientUpdatedAt: "2026-07-13T00:00:00.000Z", state: { tasks: [{ id: "remote" }] } };
          },
        },
        render() {},
        renderSaveStatus() {},
        replaceState: (state) => { replaced = state; },
        saveState() {},
        saveUiState() {},
        schemaVersion: 9,
        setSyncMeta() {},
        showToast() {},
        statusElement: { textContent: "" },
        syncControls() {},
      });

      const result = await workflow.syncLatest({ silent: true });
      assert.equal(result.changed, true);
      assert.deepEqual(replaced, { tasks: [{ id: "merged" }] });
      assert.deepEqual(safety, { state: "local" });
    },
  },
];
