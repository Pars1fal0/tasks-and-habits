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

      ctx.els.themePreference?.addEventListener("change", () => ctx.updateSetting("themePreference", ctx.els.themePreference.value));
      ctx.els.notificationSetting?.addEventListener("change", () => ctx.updateSetting("notificationSetting", ctx.els.notificationSetting.value));
      ctx.els.backupSchedule?.addEventListener("change", () => ctx.updateSetting("backupSchedule", ctx.els.backupSchedule.value));
      ctx.els.firstDayOfWeek?.addEventListener("change", () => ctx.updateSetting("firstDayOfWeek", ctx.els.firstDayOfWeek.value));
      ctx.els.densityPreference?.addEventListener("change", () => ctx.updateSetting("densityPreference", ctx.els.densityPreference.value));
      ctx.els.timeFormat?.addEventListener("change", () => ctx.updateSetting("timeFormat", ctx.els.timeFormat.value));
    }

    function syncControls(settings = ctx.getSettings()) {
      setValue(ctx.els.themePreference, settings.themePreference);
      setValue(ctx.els.notificationSetting, settings.notificationSetting);
      setValue(ctx.els.backupSchedule, settings.backupSchedule);
      setValue(ctx.els.firstDayOfWeek, settings.firstDayOfWeek);
      setValue(ctx.els.densityPreference, settings.densityPreference);
      setValue(ctx.els.timeFormat, settings.timeFormat);
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
