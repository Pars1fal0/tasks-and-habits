(function (global) {
  function createRemoteSyncController(options = {}) {
    const cryptoApi = options.crypto || global.crypto;

    function generatePrivateKey() {
      if (!cryptoApi?.getRandomValues) throw new Error("Secure random generator is unavailable");
      const bytes = new Uint8Array(24);
      cryptoApi.getRandomValues(bytes);
      return `rhythm_${[...bytes].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
    }

    function isSecurePrivateKey(value) {
      return /^rhythm_[a-f0-9]{48,}$/i.test(String(value || "").trim());
    }

    return { generatePrivateKey, isSecurePrivateKey };
  }

  function createRemoteSyncWorkflow(ctx) {
    let inFlight = false;
    let lastError = "";
    let pending = false;
    let timerId = null;

    function getConfig() {
      const settings = ctx.getSettings();
      return ctx.remoteSync.normalizeConfig({
        anonKey: settings.anonKey,
        accessToken: settings.accessToken,
        enabled: settings.enabled,
        supabaseUrl: settings.supabaseUrl,
        userId: settings.userId,
        userKey: settings.userKey,
      });
    }

    function isReady() {
      return ctx.remoteSync.isConfigured(getConfig());
    }

    function hasCredentials() {
      return ctx.remoteSync.isConfigured({ ...getConfig(), enabled: true });
    }

    function getOperationConfig() {
      return { ...getConfig(), enabled: true };
    }

    function clearError() {
      lastError = "";
    }

    function renderStatus() {
      if (!ctx.statusElement) return;
      const settings = ctx.getSettings();
      syncActionState();
      if (!hasCredentials()) return setStatus("БД: не настроено · войди в аккаунт или подключи legacy-ключ");
      if (!settings.enabled) return setStatus("БД: подключение готово · автоматическая синхронизация выключена");
      if (lastError) return setStatus(`БД: ошибка · ${lastError}`);
      if (inFlight) return setStatus("БД: синхронизация...");
      if (!settings.userId && !ctx.isSecurePrivateKey(settings.userKey)) {
        return setStatus("БД: подключена старым коротким ключом · создай приватный ключ перед хранением важных данных");
      }
      if (pending) return setStatus("БД: ожидает синхронизации локальных изменений");
      const meta = ctx.getSyncMeta();
      const pushed = meta.lastPushedAt ? ctx.formatDate(meta.lastPushedAt) : "еще не сохранялось";
      const pulled = meta.lastPulledAt ? ctx.formatDate(meta.lastPulledAt) : "еще не загружалось";
      const latestSync = ctx.latestIsoDate(meta.lastPushedAt, meta.lastPulledAt);
      const latest = latestSync ? ctx.formatDate(latestSync) : "еще не было";
      setStatus(`БД: подключена · последняя синхронизация: ${latest} · сохранено: ${pushed} · загружено: ${pulled}`);
    }

    function schedulePush() {
      if (!isReady()) return renderStatus();
      pending = true;
      renderStatus();
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        timerId = null;
        push({ silent: true });
      }, 1200);
    }

    async function push(options = {}) {
      options?.preventDefault?.();
      const manual = !options?.silent;
      if (!hasCredentials()) {
        renderStatus();
        if (manual) ctx.showToast("Заполни настройки удаленной БД");
        return;
      }
      if (inFlight) return;
      begin();
      try {
        if (!(await confirmOverwriteIfNeeded({ manual }))) return;
        const pushedAt = new Date().toISOString();
        await ctx.remoteSync.pushState(getOperationConfig(), {
          clientUpdatedAt: pushedAt,
          schemaVersion: ctx.schemaVersion,
          state: ctx.getState(),
          uiState: ctx.getRemoteUiSettings({ remoteSyncLastPushedAt: pushedAt }),
        });
        ctx.setSyncMeta({ lastPushedAt: pushedAt });
        pending = false;
        ctx.saveUiState();
        ctx.recordSyncEvent?.("push");
        if (manual) ctx.showToast("Данные сохранены в БД");
      } catch (error) {
        lastError = ctx.describeError(error);
        ctx.recordSyncEvent?.("error", lastError);
        if (manual) ctx.showToast("Не удалось сохранить данные в БД");
      } finally {
        finish();
      }
    }

    async function confirmOverwriteIfNeeded({ manual }) {
      const remoteSnapshot = await ctx.remoteSync.pullState(getOperationConfig());
      const meta = ctx.getSyncMeta();
      if (!remoteSnapshot.found || !remoteSnapshot.clientUpdatedAt) return true;
      if (!ctx.isRemoteVersionNewer(remoteSnapshot.clientUpdatedAt, meta.lastPulledAt, meta.lastPushedAt)) return true;
      const remoteDate = ctx.formatDate(remoteSnapshot.clientUpdatedAt);
      if (!manual) {
        lastError = `удаленная версия новее (${remoteDate}); нажми "Загрузить из БД" или подтверди ручное сохранение`;
        return false;
      }
      return ctx.confirmAction({
        confirmLabel: "Перезаписать БД",
        message: `В БД есть версия от ${remoteDate}, которую это устройство еще не загружало. Если продолжить, она будет перезаписана текущими локальными данными.`,
        tone: "danger",
        title: "Удаленная версия новее",
      });
    }

    async function check(options = {}) {
      options?.preventDefault?.();
      if (!hasCredentials()) {
        renderStatus();
        ctx.showToast("Заполни настройки удаленной БД");
        return;
      }
      if (inFlight) return;
      begin();
      try {
        const result = await ctx.remoteSync.checkConnection(getOperationConfig());
        ctx.showToast(result.found ? "Подключение к БД работает" : "Подключение работает, сохранений пока нет");
      } catch (error) {
        lastError = ctx.describeError(error);
        ctx.showToast("Подключение к БД не прошло проверку");
      } finally {
        finish();
      }
    }

    async function pull(options = {}) {
      options?.preventDefault?.();
      if (!hasCredentials()) {
        renderStatus();
        ctx.showToast("Заполни настройки удаленной БД");
        return;
      }
      if (inFlight) return;
      begin();
      let pulled;
      try {
        pulled = await ctx.remoteSync.pullState(getOperationConfig());
      } catch (error) {
        lastError = ctx.describeError(error);
        ctx.showToast("Не удалось загрузить данные из БД");
        finish();
        return;
      }
      finish();
      if (!pulled.found || !pulled.state) {
        ctx.showToast("В БД пока нет сохраненных данных");
        return;
      }
      const remoteDate = pulled.clientUpdatedAt ? ctx.formatDate(pulled.clientUpdatedAt) : "неизвестно";
      const localUpdatedAt = ctx.getLocalUpdatedAt();
      const localWarning =
        localUpdatedAt && pulled.clientUpdatedAt && localUpdatedAt > pulled.clientUpdatedAt
          ? ` Локальные данные новее удаленной версии (${ctx.formatDate(localUpdatedAt)}).`
          : "";
      const confirmed = await ctx.confirmAction({
        confirmLabel: "Заменить локальные",
        secondaryLabel: "Объединить",
        message: `Данные из БД от ${remoteDate}.${localWarning} Можно объединить записи с двух устройств или полностью заменить локальное состояние. Перед действием приложение создаст safety backup.`,
        tone: "danger",
        title: "Как загрузить данные из БД?",
      });
      if (!confirmed || inFlight) return;
      begin();
      try {
        const undo = ctx.createUndoSnapshot();
        ctx.createImportSafetyBackup({ state: JSON.stringify(ctx.getState()) });
        const nextState = confirmed === "secondary" ? ctx.mergeStates(ctx.getState(), pulled.state) : pulled.state;
        ctx.replaceState(nextState);
        const pulledAt = new Date().toISOString();
        ctx.setSyncMeta({ lastPulledAt: pulledAt });
        pending = false;
        ctx.saveState({ localUpdatedAt: pulled.clientUpdatedAt || pulledAt, skipBackup: true, skipRemote: true });
        ctx.saveUiState();
        ctx.render();
        ctx.recordSyncEvent?.(confirmed === "secondary" ? "merge" : "pull", `версия от ${remoteDate}`);
        ctx.showToast(confirmed === "secondary" ? "Локальные и удаленные данные объединены" : "Данные загружены из БД", { undo });
      } catch (error) {
        lastError = ctx.describeError(error);
        ctx.recordSyncEvent?.("error", lastError);
        ctx.showToast("Не удалось загрузить данные из БД");
      } finally {
        finish();
      }
    }

    async function syncLatest(options = {}) {
      if (!isReady() || inFlight || global.navigator?.onLine === false) return { changed: false };
      begin();
      try {
        const pulled = await ctx.remoteSync.pullState(getConfig());
        if (!pulled.found || !pulled.state) return { changed: false };
        const meta = ctx.getSyncMeta();
        if (!ctx.isRemoteVersionNewer(pulled.clientUpdatedAt, meta.lastPulledAt, meta.lastPushedAt)) return { changed: false };
        const undo = ctx.createUndoSnapshot();
        ctx.createImportSafetyBackup(undo);
        const nextState = ctx.mergeStates(ctx.getState(), pulled.state);
        ctx.replaceState(nextState);
        const pulledAt = new Date().toISOString();
        ctx.setSyncMeta({ lastPulledAt: pulledAt });
        pending = false;
        ctx.saveState({ localUpdatedAt: pulled.clientUpdatedAt || pulledAt, skipBackup: true, skipRemote: true });
        ctx.saveUiState();
        ctx.render();
        ctx.recordSyncEvent?.("merge", "автоматическая синхронизация");
        if (!options.silent) ctx.showToast("Данные с другого устройства объединены", { undo });
        global.setTimeout(() => schedulePush(), 0);
        return { changed: true };
      } catch (error) {
        lastError = ctx.describeError(error);
        ctx.recordSyncEvent?.("error", lastError);
        if (!options.silent) ctx.showToast("Не удалось синхронизировать данные");
        return { changed: false, error };
      } finally {
        finish();
      }
    }

    function begin() {
      inFlight = true;
      lastError = "";
      renderStatus();
      ctx.renderSaveStatus?.();
    }

    function finish() {
      inFlight = false;
      ctx.syncControls();
      renderStatus();
      ctx.renderSaveStatus?.();
    }

    function setStatus(message) {
      ctx.statusElement.textContent = message;
    }

    function syncActionState() {
      const disabled = !hasCredentials() || inFlight;
      [ctx.els?.remoteSyncPushButton, ctx.els?.remoteSyncPullButton, ctx.els?.remoteSyncCheckButton]
        .filter(Boolean)
        .forEach((button) => { button.disabled = disabled; });
    }

    function getStatus() {
      return { inFlight, lastError, pending };
    }

    return { check, clearError, getConfig, getStatus, isReady, pull, push, renderStatus, schedulePush, syncLatest };
  }

  const api = { createRemoteSyncController, createRemoteSyncWorkflow };
  global.RhythmRemoteSyncController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
