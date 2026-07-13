(function (global) {
  const SECRET_REMOTE_KEYS = new Set(["remoteSyncAnonKey", "remoteSyncUrl", "remoteSyncUserKey"]);

  function createSettingsState(options = {}) {
    const validBackupSchedules = options.validBackupSchedules || ["0", "5", "15", "30", "60"];
    const cleanText = options.cleanText || ((value) => String(value || "").trim());
    const normalizeRemoteUserKey = options.normalizeRemoteUserKey || ((value) => String(value || "").trim().toLowerCase());

    function normalizeThemePreference(value) {
      return ["dark", "light", "system"].includes(value) ? value : "dark";
    }

    function normalizeNotificationSetting(value) {
      return value === "off" ? "off" : "on";
    }

    function normalizeBackupSchedule(value) {
      const schedule = String(value ?? "5");
      return validBackupSchedules.includes(schedule) ? schedule : "5";
    }

    function normalizeFirstDayOfWeek(value) {
      return value === "sunday" ? "sunday" : "monday";
    }

    function normalizeDensityPreference(value) {
      return value === "compact" ? "compact" : "comfortable";
    }

    function normalizeTimeFormat(value) {
      return value === "12" ? "12" : "24";
    }

    function normalizeRemoteSyncEnabled(value) {
      return value === true || value === "on" ? "on" : "off";
    }

    function normalizeImportedSettings(settings = {}) {
      return {
        backupSchedule: normalizeBackupSchedule(settings.backupSchedule),
        densityPreference: normalizeDensityPreference(settings.densityPreference),
        firstDayOfWeek: normalizeFirstDayOfWeek(settings.firstDayOfWeek),
        localStateUpdatedAt: settings.localStateUpdatedAt || "",
        notificationSetting: normalizeNotificationSetting(settings.notificationSetting),
        remoteSyncAnonKey: cleanText(settings.remoteSyncAnonKey || ""),
        remoteSyncEnabled: normalizeRemoteSyncEnabled(settings.remoteSyncEnabled),
        remoteSyncLastPulledAt: settings.remoteSyncLastPulledAt || "",
        remoteSyncLastPushedAt: settings.remoteSyncLastPushedAt || "",
        remoteSyncUrl: cleanText(settings.remoteSyncUrl || ""),
        remoteSyncUserKey: normalizeRemoteUserKey(settings.remoteSyncUserKey || ""),
        themePreference: normalizeThemePreference(settings.themePreference),
        timeFormat: normalizeTimeFormat(settings.timeFormat),
      };
    }

    function createRemoteUiSettings(settings = {}, overrides = {}) {
      const merged = { ...settings, ...overrides };
      const safe = {};
      Object.entries(merged).forEach(([key, value]) => {
        if (!SECRET_REMOTE_KEYS.has(key)) safe[key] = value;
      });
      return safe;
    }

    function isRemoteVersionNewer(remoteUpdatedAt, ...localAnchors) {
      if (!remoteUpdatedAt) return false;
      const latestLocal = localAnchors.filter(Boolean).sort().at(-1) || "";
      return !latestLocal || remoteUpdatedAt > latestLocal;
    }

    return {
      createRemoteUiSettings,
      isRemoteVersionNewer,
      normalizeBackupSchedule,
      normalizeDensityPreference,
      normalizeFirstDayOfWeek,
      normalizeImportedSettings,
      normalizeNotificationSetting,
      normalizeRemoteSyncEnabled,
      normalizeThemePreference,
      normalizeTimeFormat,
    };
  }

  const api = { createSettingsState };
  global.RhythmSettingsState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
