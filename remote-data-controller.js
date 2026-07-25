(function (global) {
  function createRemoteDataController(ctx) {
    let busy = false;

    function bindEvents() {
      ctx.els.remoteSnapshotsLoadButton?.addEventListener("click", loadSnapshots);
      ctx.els.remoteSnapshotRestoreButton?.addEventListener("click", restoreSelectedSnapshot);
      ctx.els.remoteAccountDeleteButton?.addEventListener("click", deleteAccount);
      ctx.els.remoteSnapshotSelect?.addEventListener("change", () => {
        ctx.els.remoteSnapshotRestoreButton.disabled = busy || !ctx.els.remoteSnapshotSelect.value;
      });
    }

    async function loadSnapshots() {
      if (!ctx.isReady()) return ctx.showToast("Сначала войди в аккаунт синхронизации");
      if (busy) return;
      setBusy(true, "Загружаю версии...");
      try {
        const result = await ctx.remoteSync.listSnapshots(ctx.getConfig(), 15);
        renderSnapshots(result.snapshots);
        setStatus(result.snapshots.length ? `Доступно версий: ${result.snapshots.length}` : "Предыдущих версий пока нет");
      } catch (error) {
        setStatus(schemaHint(error));
      } finally {
        setBusy(false);
      }
    }

    async function restoreSelectedSnapshot() {
      const snapshotId = ctx.els.remoteSnapshotSelect?.value;
      if (!snapshotId || busy) return ctx.showToast("Сначала выбери облачную версию");
      const confirmed = await ctx.confirmAction({
        confirmLabel: "Восстановить версию",
        message: "Текущее облачное состояние сохранится как отдельная версия. Локальный safety backup будет создан перед восстановлением.",
        tone: "danger",
        title: "Восстановить облачную версию?",
      });
      if (!confirmed) return;
      setBusy(true, "Восстанавливаю версию...");
      try {
        const backup = ctx.createImportSafetyBackup({ state: JSON.stringify(ctx.getState()) });
        if (backup?.ok === false) throw new Error("Не удалось создать safety backup");
        const result = await ctx.remoteSync.restoreSnapshot(ctx.getConfig(), snapshotId);
        ctx.replaceState(result.snapshot.state);
        ctx.saveState({ skipBackup: true, skipRemote: true });
        ctx.render();
        ctx.showToast("Облачная версия восстановлена");
        const versions = await ctx.remoteSync.listSnapshots(ctx.getConfig(), 15);
        renderSnapshots(versions.snapshots);
        setStatus(`Версия восстановлена · доступно версий: ${versions.snapshots.length}`);
      } catch (error) {
        setStatus(schemaHint(error));
        ctx.showToast("Не удалось восстановить облачную версию");
      } finally {
        setBusy(false);
      }
    }

    async function deleteAccount() {
      if (!ctx.isReady() || busy) return ctx.showToast("Сначала войди в аккаунт синхронизации");
      const confirmed = await ctx.confirmAction({
        confirmLabel: "Удалить аккаунт",
        message: "Аккаунт, облачное состояние и все серверные версии будут удалены без возможности восстановления. Локальные данные на этом устройстве останутся.",
        tone: "danger",
        title: "Удалить аккаунт и облачные данные?",
      });
      if (!confirmed) return;
      setBusy(true, "Удаляю аккаунт...");
      try {
        await ctx.remoteSync.deleteAccount(ctx.getConfig());
        await ctx.afterAccountDeleted();
        renderSnapshots([]);
        setStatus("Облачный аккаунт удалён. Локальные данные сохранены.");
        ctx.showToast("Аккаунт и облачные данные удалены");
      } catch (error) {
        setStatus(schemaHint(error));
        ctx.showToast("Не удалось удалить облачный аккаунт");
      } finally {
        setBusy(false);
      }
    }

    function renderSnapshots(snapshots) {
      const select = ctx.els.remoteSnapshotSelect;
      if (!select) return;
      select.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = snapshots.length ? "Выбери версию" : "Нет доступных версий";
      select.appendChild(placeholder);
      snapshots.forEach((snapshot) => {
        const option = document.createElement("option");
        option.value = String(snapshot.id);
        option.textContent = ctx.formatDate(snapshot.created_at);
        select.appendChild(option);
      });
      ctx.els.remoteSnapshotRestoreButton.disabled = !snapshots.length;
    }

    function setBusy(value, message = "") {
      busy = value;
      [
        ctx.els.remoteSnapshotsLoadButton,
        ctx.els.remoteSnapshotRestoreButton,
        ctx.els.remoteAccountDeleteButton,
      ].forEach((button) => {
        if (button) button.disabled = value;
      });
      if (ctx.els.remoteSnapshotRestoreButton) {
        ctx.els.remoteSnapshotRestoreButton.disabled = value || !ctx.els.remoteSnapshotSelect?.value;
      }
      if (message) setStatus(message);
    }

    function setStatus(message) {
      if (ctx.els.remoteSnapshotsStatus) ctx.els.remoteSnapshotsStatus.textContent = message;
    }

    function schemaHint(error) {
      const text = String(error?.message || "");
      return /rhythm_state_snapshots|delete_parsitasks_account|404|PGRST/i.test(text)
        ? "Обнови supabase-schema.sql в SQL Editor, затем повтори действие"
        : `Ошибка облачных данных: ${text || "неизвестная ошибка"}`;
    }

    return { bindEvents, deleteAccount, loadSnapshots, restoreSelectedSnapshot };
  }

  const api = { createRemoteDataController };
  global.RhythmRemoteDataController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
