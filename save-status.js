(function (global) {
  function createSaveStatus(options = {}) {
    function render(state = {}) {
      if (!options.element) return "";
      const message = getMessage(state);
      options.element.textContent = message;
      return message;
    }

    function getMessage(state = {}) {
      if (state.localStorageError) return state.localStorageError;
      if (state.remoteEnabled && state.syncStatus?.lastError) return "Ошибка синхронизации";
      if (state.remoteEnabled && state.syncStatus?.inFlight) return "Синхронизация...";
      if (state.online === false) return "Офлайн · сохранено локально";
      if (state.remoteEnabled && state.syncStatus?.pending) return "Ожидает синхронизации";
      if (!state.localUpdatedAt) return "Сохранено локально";
      const savedAt = new Date(state.localUpdatedAt);
      if (Number.isNaN(savedAt.getTime())) return "Сохранено локально";
      return `Сохранено ${options.formatTime(options.toTimeValue(savedAt))}`;
    }

    function describeRemoteError(error) {
      if (error?.code === "clock-skew") return "проверь дату и время на устройстве";
      if (error?.status === 401 || error?.status === 403) return "неверный anon key или доступ запрещен";
      if (error?.status === 404) return "таблица rhythm_states не создана";
      const message = String(error?.message || "").trim();
      if (/failed to fetch|network|load failed/i.test(message)) return "нет сети или Supabase URL недоступен";
      return message || "неизвестная ошибка";
    }

    return { describeRemoteError, getMessage, render };
  }

  const api = { createSaveStatus };
  global.RhythmSaveStatus = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
