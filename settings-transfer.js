(function (global) {
  function createSettingsTransfer(ctx) {
    function exportSettings() {
      const payload = {
        app: "Ритм дня",
        exportedAt: new Date().toISOString(),
        schemaVersion: ctx.schemaVersion,
        settings: ctx.getSettings(),
        type: "settings",
      };
      const blob = new global.Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = global.URL.createObjectURL(blob);
      const link = ctx.document.createElement("a");
      link.href = url;
      link.download = `ritm-dnya-settings-${ctx.toDateKey(new Date())}.json`;
      ctx.document.body.appendChild(link);
      link.click();
      link.remove();
      global.URL.revokeObjectURL(url);
      ctx.showToast("Настройки экспортированы");
    }

    async function importSettings() {
      const file = ctx.els.settingsImportFile?.files?.[0];
      if (!file) return;

      try {
        const parsed = JSON.parse(await file.text());
        ctx.applyImportedSettings(parsed.settings || parsed);
        ctx.saveUiState();
        ctx.render();
        ctx.showToast("Настройки импортированы");
      } catch {
        ctx.showToast("Не удалось импортировать настройки");
      } finally {
        if (ctx.els.settingsImportFile) ctx.els.settingsImportFile.value = "";
      }
    }

    async function resetInterfaceSettings() {
      const confirmed = await ctx.confirmAction({
        confirmLabel: "Сбросить",
        message: "Тема, цвет, плотность, формат времени и первый день недели вернутся к настройкам по умолчанию. Данные задач и привычек не изменятся.",
        tone: "danger",
        title: "Сбросить настройки интерфейса?",
      });
      if (!confirmed) return;
      ctx.resetPreferences();
    }

    return { exportSettings, importSettings, resetInterfaceSettings };
  }

  const api = { createSettingsTransfer };
  global.RhythmSettingsTransfer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
