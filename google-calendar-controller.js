(function (global) {
  function createGoogleCalendarController(ctx) {
    let connected = false;
    let configured = true;
    let direction = "export";
    let inFlight = false;
    let lastError = "";
    let lastSyncedAt = "";
    let lastSummary = null;
    let lastLocalFingerprint = "";
    let timer = null;
    let interval = null;

    function bindEvents() {
      ctx.els.googleCalendarConnect?.addEventListener("click", connect);
      ctx.els.googleCalendarDisconnect?.addEventListener("click", disconnect);
      ctx.els.googleCalendarSync?.addEventListener("click", () => sync({ announce: true }));
      ctx.els.googleCalendarDirection?.addEventListener("change", () => {
        direction = normalizeDirection(ctx.els.googleCalendarDirection.value);
        render();
        schedule();
      });
      global.addEventListener?.("online", () => schedule(300));
      global.document?.addEventListener("visibilitychange", () => {
        if (global.document.visibilityState === "visible") schedule(300);
      });
    }

    async function initialize() {
      consumeCallbackResult();
      await refreshStatus();
      if (connected) sync({ silent: true });
      if (!interval) interval = global.setInterval(() => sync({ silent: true }), 5 * 60 * 1000);
    }

    async function refreshStatus() {
      if (!ctx.getAccessToken()) {
        connected = false;
        render();
        return;
      }
      setBusy(true);
      try {
        const status = await ctx.api.status();
        configured = status.configured !== false;
        connected = status.connected === true;
        direction = normalizeDirection(status.direction);
        lastSyncedAt = status.lastSyncedAt || "";
        lastError = status.lastError || "";
      } catch (error) {
        connected = false;
        lastError = describeError(error);
      } finally {
        setBusy(false);
      }
    }

    async function connect() {
      if (inFlight) return;
      setBusy(true);
      lastError = "";
      try {
        const result = await ctx.api.connect();
        if (!result.authorizationUrl) throw new Error("Сервер не вернул адрес Google");
        if (global.location.protocol === "file:") {
          global.open?.(result.authorizationUrl, "_blank", "noopener");
          ctx.showToast("Подключение Google Calendar открыто в браузере");
        } else {
          global.location.assign(result.authorizationUrl);
        }
      } catch (error) {
        lastError = describeError(error);
        ctx.showToast(lastError);
        setBusy(false);
      }
    }

    async function disconnect() {
      if (inFlight || !connected) return;
      const confirmed = await ctx.confirmAction({
        title: "Отключить Google Calendar?",
        message: "Уже созданные события останутся в Google. Новые изменения больше не будут синхронизироваться.",
        confirmText: "Отключить",
        danger: true,
      });
      if (!confirmed) return;
      setBusy(true);
      try {
        await ctx.api.disconnect();
        connected = false;
        lastSyncedAt = "";
        lastSummary = null;
        ctx.showToast("Google Calendar отключён");
      } catch (error) {
        lastError = describeError(error);
        ctx.showToast(lastError);
      } finally {
        setBusy(false);
      }
    }

    function schedule(delay = 2500) {
      if (!connected || inFlight || global.navigator?.onLine === false) return;
      const fingerprint = payloadFingerprint(buildPayload(ctx.getState(), direction, ctx.getTimeZone()));
      if (fingerprint === lastLocalFingerprint) return;
      lastLocalFingerprint = fingerprint;
      global.clearTimeout(timer);
      timer = global.setTimeout(() => sync({ silent: true }), delay);
    }

    async function sync(options = {}) {
      if (!connected || inFlight || !ctx.getAccessToken() || global.navigator?.onLine === false) return null;
      setBusy(true);
      lastError = "";
      try {
        const payload = buildPayload(ctx.getState(), direction, ctx.getTimeZone());
        const result = await ctx.api.sync(payload);
        if (result.connected === false) {
          connected = false;
          throw new Error(result.message || "Google Calendar не подключён");
        }
        applyResult(result);
        lastLocalFingerprint = payloadFingerprint(buildPayload(ctx.getState(), direction, ctx.getTimeZone()));
        lastSyncedAt = result.lastSyncedAt || new Date().toISOString();
        lastSummary = result.summary || null;
        if (options.announce) ctx.showToast(summaryText(lastSummary));
        return result;
      } catch (error) {
        lastError = describeError(error);
        if (!options.silent || error?.status === 401) ctx.showToast(lastError);
        return null;
      } finally {
        setBusy(false);
      }
    }

    function applyResult(result) {
      const state = ctx.getState();
      state.googleCalendarLinks = result.links && typeof result.links === "object" ? result.links : {};
      const googleCategoryId = result.upserts?.length ? ensureGoogleCategory(state, ctx.createId) : "";
      const taskById = new Map(state.tasks.map((task) => [task.id, task]));
      (result.upserts || []).forEach((patch) => {
        const existing = taskById.get(patch.id);
        if (existing) {
          Object.assign(existing, {
            date: patch.date,
            endTime: patch.endTime,
            scheduleMode: "block",
            startTime: patch.startTime,
            time: patch.endTime,
            title: patch.title,
            updatedAt: patch.updatedAt,
          });
          return;
        }
        const now = new Date().toISOString();
        const task = {
          acknowledgedOverdue: {}, categoryId: googleCategoryId, completed: {}, createdAt: now,
          customRepeat: {}, date: patch.date, endTime: patch.endTime, excludedDates: {}, id: patch.id,
          movedFromDate: "", notified: {}, priority: "medium", reminderOffset: "15", repeat: "none",
          repeatUntil: "", scheduleMode: "block", sourceTaskId: "", startTime: patch.startTime,
          time: patch.endTime, title: patch.title, updatedAt: patch.updatedAt,
        };
        state.tasks.push(task);
        taskById.set(task.id, task);
      });
      (result.deletions || []).forEach((taskId) => {
        if (taskById.has(taskId)) ctx.deleteTask(taskId);
      });
      ctx.saveState({ skipGoogleCalendar: true });
      ctx.render();
    }

    function consumeCallbackResult() {
      if (!global.location?.href || !global.history?.replaceState) return;
      const url = new URL(global.location.href);
      const result = url.searchParams.get("googleCalendar");
      if (!result) return;
      url.searchParams.delete("googleCalendar");
      global.history.replaceState(global.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      if (result === "connected") ctx.showToast("Google Calendar подключён");
      else ctx.showToast(callbackError(result));
    }

    function setBusy(value) {
      inFlight = value;
      render();
    }

    function render() {
      const authenticated = Boolean(ctx.getAccessToken());
      if (ctx.els.googleCalendarDirection) {
        ctx.els.googleCalendarDirection.value = direction;
        ctx.els.googleCalendarDirection.disabled = inFlight || !connected;
      }
      if (ctx.els.googleCalendarConnect) ctx.els.googleCalendarConnect.hidden = connected;
      if (ctx.els.googleCalendarDisconnect) ctx.els.googleCalendarDisconnect.hidden = !connected;
      if (ctx.els.googleCalendarSync) {
        ctx.els.googleCalendarSync.hidden = !connected;
        ctx.els.googleCalendarSync.disabled = inFlight;
        ctx.els.googleCalendarSync.textContent = inFlight ? "Синхронизация..." : "Синхронизировать";
      }
      if (!ctx.els.googleCalendarStatus) return;
      if (!authenticated) ctx.els.googleCalendarStatus.textContent = "Войдите в аккаунт Parsitasks, чтобы подключить календарь.";
      else if (!configured) ctx.els.googleCalendarStatus.textContent = "Интеграция ещё не настроена на сервере.";
      else if (lastError) ctx.els.googleCalendarStatus.textContent = `Ошибка: ${lastError}`;
      else if (!connected) ctx.els.googleCalendarStatus.textContent = "Google Calendar не подключён.";
      else {
        const last = lastSyncedAt ? ctx.formatDate(lastSyncedAt) : "ещё не запускалась";
        ctx.els.googleCalendarStatus.textContent = `Подключён · последняя синхронизация: ${last}${lastSummary ? ` · ${summaryText(lastSummary)}` : ""}`;
      }
    }

    return { bindEvents, initialize, refreshStatus, render, schedule, sync };
  }

  function buildPayload(state = {}, direction, timeZone, now = new Date()) {
    const categories = new Map((state.categories || []).map((category) => [category.id, category.name]));
    const range = syncRange(now);
    const timedTasks = (state.tasks || []).filter((task) => task.scheduleMode === "block" && task.startTime && task.endTime);
    const eligible = timedTasks.filter((task) => task.repeat === "none" && task.date >= range.from && task.date <= range.to);
    const outOfRangeTaskIds = timedTasks
      .filter((task) => task.repeat === "none" && (task.date < range.from || task.date > range.to))
      .map((task) => task.id);
    return {
      direction: normalizeDirection(direction),
      links: state.googleCalendarLinks || {},
      outOfRangeTaskIds,
      skipped: timedTasks.filter((task) => task.repeat !== "none").length,
      tasks: eligible.map((task) => ({
        category: categories.get(task.categoryId) || "",
        date: task.date,
        endTime: task.endTime,
        id: task.id,
        priority: task.priority,
        startTime: task.startTime,
        title: task.title,
        updatedAt: task.updatedAt,
      })),
      timeZone,
      tombstones: state.tombstones?.tasks || {},
    };
  }

  function syncRange(now = new Date()) {
    const from = new Date(now.getTime() - 30 * 86400000);
    const to = new Date(now.getTime() + 180 * 86400000);
    return { from: dateKey(from), to: dateKey(to) };
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function ensureGoogleCategory(state, createId) {
    const existing = (state.categories || []).find((category) => category.name.toLowerCase() === "google calendar");
    if (existing) return existing.id;
    const now = new Date().toISOString();
    const category = { id: createId(), name: "Google Calendar", color: "#4285f4", createdAt: now, updatedAt: now };
    state.categories.push(category);
    return category.id;
  }

  function summaryText(summary = {}) {
    const changed = Number(summary.created || 0) + Number(summary.updated || 0) + Number(summary.imported || 0) + Number(summary.deleted || 0);
    if (!changed) return summary.skipped ? `Без изменений · пропущено: ${summary.skipped}` : "Изменений нет";
    return `Обновлено: ${changed}${summary.skipped ? ` · пропущено: ${summary.skipped}` : ""}`;
  }

  function payloadFingerprint(payload) {
    return JSON.stringify({
      direction: payload.direction,
      links: payload.links,
      outOfRangeTaskIds: payload.outOfRangeTaskIds,
      tasks: payload.tasks,
      tombstones: payload.tombstones,
    });
  }

  function callbackError(value) {
    const messages = {
      access_denied: "Подключение Google Calendar отменено",
      invalid_state: "Сессия подключения устарела. Попробуйте ещё раз",
      not_configured: "Google Calendar ещё не настроен на сервере",
      session_expired: "Сессия Parsitasks истекла. Войдите снова",
      token_exchange_failed: "Google не выдал постоянный доступ. Подключите календарь ещё раз",
      callback_failed: "Не удалось завершить подключение Google Calendar",
    };
    return messages[value] || "Не удалось подключить Google Calendar";
  }

  function describeError(error) {
    if (error?.status === 401) return "Сессия Parsitasks истекла. Войдите снова";
    if (error?.code === "not_configured") return "Интеграция Google Calendar ещё не настроена на сервере";
    return String(error?.message || "Не удалось синхронизировать Google Calendar");
  }

  function normalizeDirection(value) {
    return value === "two-way" ? "two-way" : "export";
  }

  const api = { buildPayload, createGoogleCalendarController, syncRange };
  global.RhythmGoogleCalendarController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
