(function (global) {
  function createImportExport(ctx) {
    function exportData() {
      const payload = {
        app: "Ритм дня",
        schemaVersion: ctx.schemaVersion,
        exportedAt: new Date().toISOString(),
        state: ctx.getState(),
      };
      createBackup({ payload, silent: true });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ritm-dnya-${ctx.toDateKey(new Date())}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      ctx.showToast("Экспорт готов");
    }

    async function importData() {
      const file = ctx.els.importFile.files?.[0];
      if (!file) return;

      const undo = ctx.createUndoSnapshot();
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const importedState = ctx.normalizeState(parsed.state || parsed);
        createImportSafetyBackup(undo);
        ctx.replaceState(importedState);
        ctx.saveState({ skipBackup: true });
        ctx.render();
        ctx.showToast("Данные импортированы. Предыдущие данные сохранены", { undo });
      } catch {
        ctx.showToast("Не удалось импортировать JSON");
      } finally {
        ctx.els.importFile.value = "";
      }
    }

    function syncDesktopBackup() {
      if (!window.rhythmDesktop?.writeFileBackup) return;
      window.rhythmDesktop
        .writeFileBackup({
          schemaVersion: ctx.schemaVersion,
          state: ctx.getState(),
        })
        .then(() => updateFileBackupStatus())
        .catch(() => {
          if (ctx.els.fileBackupStatus) {
            ctx.els.fileBackupStatus.hidden = false;
            ctx.els.fileBackupStatus.textContent = "Файловый бэкап: ошибка записи";
          }
        });
    }

    async function updateFileBackupStatus() {
      if (!window.rhythmDesktop?.getFileBackupInfo || !ctx.els.fileBackupStatus || !ctx.els.openBackupFolderButton) return;
      ctx.els.fileBackupStatus.hidden = false;
      ctx.els.openBackupFolderButton.hidden = false;
      try {
        const info = await window.rhythmDesktop.getFileBackupInfo();
        if (info?.latest?.mtimeMs) {
          ctx.els.fileBackupStatus.textContent = `Файловый бэкап: ${formatBackupDate(info.latest.mtimeMs)}`;
        } else {
          ctx.els.fileBackupStatus.textContent = "Файловый бэкап: папка готова";
        }
      } catch {
        ctx.els.fileBackupStatus.textContent = "Файловый бэкап: недоступен";
      }
    }

    async function openBackupFolder() {
      if (!window.rhythmDesktop?.openBackupFolder) return;
      const result = await window.rhythmDesktop.openBackupFolder();
      ctx.showToast(result?.ok ? "Папка бэкапов открыта" : "Не удалось открыть папку бэкапов");
    }

    function createBackup({ payload = null, silent = false, throttle = false } = {}) {
      const result = ctx.storage.createBackup({
        payload,
        state: ctx.getState(),
        throttle,
      });

      if (result.ok) {
        updateBackupStatus();
        if (!silent) ctx.showToast("Локальный бэкап обновлен");
        return;
      }

      if (!silent && result.reason !== "throttled") ctx.showToast("Не удалось создать бэкап");
    }

    function createImportSafetyBackup(snapshot) {
      ctx.storage.createImportSafetyBackup(snapshot, { schemaVersion: ctx.schemaVersion });
    }

    async function restoreBackup() {
      const backup = loadBackup();
      if (!backup) {
        ctx.showToast("Локальный бэкап пока не найден");
        return;
      }

      const backupDate = backup.exportedAt ? formatBackupDate(backup.exportedAt) : "без даты";
      const message = `Восстановить данные из локального бэкапа (${backupDate})? Текущий план будет заменен.`;
      const confirmed = ctx.confirmAction
        ? await ctx.confirmAction({
            confirmLabel: "Восстановить",
            message,
            tone: "danger",
            title: "Восстановить бэкап?",
          })
        : window.confirm(message);
      if (!confirmed) return;

      ctx.replaceState(backup.state || backup);
      ctx.saveState();
      ctx.render();
      ctx.showToast("Данные восстановлены из бэкапа");
    }

    function loadBackup() {
      return ctx.storage.loadBackup();
    }

    function updateBackupStatus() {
      const backup = loadBackup();
      if (!backup?.exportedAt) {
        ctx.els.backupStatus.textContent = "Бэкап еще не создан";
        return;
      }
      ctx.els.backupStatus.textContent = `Бэкап: ${formatBackupDate(backup.exportedAt)}`;
    }

    function formatBackupDate(value) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return "без даты";
      return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }

    return {
      createBackup,
      createImportSafetyBackup,
      exportData,
      formatBackupDate,
      importData,
      loadBackup,
      openBackupFolder,
      restoreBackup,
      syncDesktopBackup,
      updateBackupStatus,
      updateFileBackupStatus,
    };
  }

  global.RhythmImportExport = { createImportExport };
})(window);
