(function (global) {
  function createSettingsController(ctx) {
    function bindEvents() {
      ctx.els.settingsExportButton?.addEventListener("click", ctx.exportData);
      ctx.els.settingsRestoreBackupButton?.addEventListener("click", ctx.restoreBackup);
      ctx.els.settingsOpenBackupFolderButton?.addEventListener("click", ctx.openBackupFolder);
      ctx.els.settingsNotifyButton?.addEventListener("click", ctx.requestNotifications);
      ctx.els.settingsExportSettingsButton?.addEventListener("click", ctx.exportSettings);
      ctx.els.settingsImportSettingsButton?.addEventListener("click", () => ctx.els.settingsImportFile?.click());
      ctx.els.settingsImportFile?.addEventListener("change", ctx.importSettings);
      ctx.els.settingsResetButton?.addEventListener("click", ctx.resetInterfaceSettings);
      ctx.els.remoteSyncPushButton?.addEventListener("click", ctx.pushRemoteState);
      ctx.els.remoteSyncPullButton?.addEventListener("click", ctx.pullRemoteState);

      ctx.els.themePreference?.addEventListener("change", () => ctx.updateSetting("themePreference", ctx.els.themePreference.value));
      ctx.els.notificationSetting?.addEventListener("change", () => ctx.updateSetting("notificationSetting", ctx.els.notificationSetting.value));
      ctx.els.backupSchedule?.addEventListener("change", () => ctx.updateSetting("backupSchedule", ctx.els.backupSchedule.value));
      ctx.els.firstDayOfWeek?.addEventListener("change", () => ctx.updateSetting("firstDayOfWeek", ctx.els.firstDayOfWeek.value));
      ctx.els.densityPreference?.addEventListener("change", () => ctx.updateSetting("densityPreference", ctx.els.densityPreference.value));
      ctx.els.interfaceMode?.addEventListener("change", () => ctx.updateSetting("interfaceMode", ctx.els.interfaceMode.value));
      ctx.els.timeFormat?.addEventListener("change", () => ctx.updateSetting("timeFormat", ctx.els.timeFormat.value));
      ctx.els.remoteSyncEnabled?.addEventListener("change", () => ctx.updateSetting("remoteSyncEnabled", ctx.els.remoteSyncEnabled.value));
      ctx.els.remoteSyncUrl?.addEventListener("change", () => ctx.updateSetting("remoteSyncUrl", ctx.els.remoteSyncUrl.value));
      ctx.els.remoteSyncAnonKey?.addEventListener("change", () => ctx.updateSetting("remoteSyncAnonKey", ctx.els.remoteSyncAnonKey.value));
      ctx.els.remoteSyncUserKey?.addEventListener("change", () => ctx.updateSetting("remoteSyncUserKey", ctx.els.remoteSyncUserKey.value));
    }

    function syncControls(settings = ctx.getSettings()) {
      setValue(ctx.els.themePreference, settings.themePreference);
      setValue(ctx.els.notificationSetting, settings.notificationSetting);
      setValue(ctx.els.backupSchedule, settings.backupSchedule);
      setValue(ctx.els.firstDayOfWeek, settings.firstDayOfWeek);
      setValue(ctx.els.densityPreference, settings.densityPreference);
      setValue(ctx.els.interfaceMode, settings.interfaceMode);
      setValue(ctx.els.timeFormat, settings.timeFormat);
      setValue(ctx.els.remoteSyncEnabled, settings.remoteSyncEnabled);
      setValue(ctx.els.remoteSyncUrl, settings.remoteSyncUrl);
      setValue(ctx.els.remoteSyncAnonKey, settings.remoteSyncAnonKey);
      setValue(ctx.els.remoteSyncUserKey, settings.remoteSyncUserKey);
      ctx.renderBackupStatus?.();
    }

    function setValue(element, value) {
      if (element) element.value = value;
    }

    return {
      bindEvents,
      syncControls,
    };
  }

  global.RhythmSettingsController = { createSettingsController };
})(window);
