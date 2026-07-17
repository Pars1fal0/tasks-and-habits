const assert = require("node:assert/strict");
const { createSettingsState } = require("../settings-state.js");

module.exports = [
  {
    name: "normalizes imported settings and keeps remote sync keys local-only",
    fn() {
      const settingsState = createSettingsState({
        cleanText: (value) => String(value || "").trim(),
        validBackupSchedules: ["0", "5", "15", "30", "60"],
      });

      const normalized = settingsState.normalizeImportedSettings({
        backupSchedule: "999",
        remoteSyncAnonKey: " secret ",
        remoteSyncPending: true,
        remoteSyncUrl: " https://demo.supabase.co ",
        themePreference: "neon",
      });
      const remoteSafe = settingsState.createRemoteUiSettings(normalized, { remoteSyncLastPushedAt: "2026-07-02T10:00:00.000Z" });

      assert.equal(normalized.backupSchedule, "5");
      assert.equal(normalized.themePreference, "dark");
      assert.equal(normalized.remoteSyncAnonKey, "secret");
      assert.equal(normalized.remoteSyncPending, false);
      assert.equal(remoteSafe.remoteSyncAnonKey, undefined);
      assert.equal(remoteSafe.remoteSyncPending, undefined);
      assert.equal(remoteSafe.remoteSyncUrl, undefined);
      assert.equal(remoteSafe.remoteSyncLastPushedAt, "2026-07-02T10:00:00.000Z");
      assert.equal(settingsState.isRemoteVersionNewer("2026-07-02T10:05:00.000Z", "2026-07-02T10:00:00.000Z"), true);
      assert.equal(settingsState.isRemoteVersionNewer("2026-07-02T09:55:00.000Z", "2026-07-02T10:00:00.000Z"), false);
    },
  },
];
