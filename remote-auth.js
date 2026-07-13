(function (global) {
  const SESSION_KEY = "rhythm-supabase-session-v1";

  function createRemoteAuth(options = {}) {
    const fetchFn = options.fetch || global.fetch?.bind(global);
    const storage = options.storage || global.localStorage;
    const getConfig = options.getConfig || (() => ({}));
    let session = loadSession();
    let refreshTimer = null;

    function loadSession() {
      try {
        const value = JSON.parse(storage?.getItem(SESSION_KEY) || "null");
        return value?.access_token && value?.user?.id ? value : null;
      } catch {
        return null;
      }
    }

    function saveSession(nextSession) {
      session = nextSession?.access_token && nextSession?.user?.id ? nextSession : null;
      try {
        if (session) storage?.setItem(SESSION_KEY, JSON.stringify(session));
        else storage?.removeItem(SESSION_KEY);
      } catch {}
      scheduleRefresh();
      options.onSessionChange?.(session);
      return session;
    }

    async function signUp(email, password) {
      return authenticate("signup", { email: cleanEmail(email), password });
    }

    async function signIn(email, password) {
      return authenticate("token?grant_type=password", { email: cleanEmail(email), password });
    }

    async function authenticate(path, body) {
      const config = requireConfig();
      const response = await fetchFn(`${config.supabaseUrl}/auth/v1/${path}`, {
        method: "POST",
        headers: authHeaders(config),
        body: JSON.stringify(body),
      });
      const data = await readResponse(response);
      if (!response.ok) throw createAuthError(response, data);
      if (data.access_token) saveSession(data);
      return data;
    }

    async function refreshSession() {
      if (!session?.refresh_token) return null;
      const config = requireConfig();
      const response = await fetchFn(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: authHeaders(config),
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      const data = await readResponse(response);
      if (!response.ok) {
        saveSession(null);
        throw createAuthError(response, data);
      }
      return saveSession(data);
    }

    async function signOut() {
      const current = session;
      saveSession(null);
      if (!current?.access_token) return;
      const config = requireConfig();
      await fetchFn(`${config.supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: { ...authHeaders(config), Authorization: `Bearer ${current.access_token}` },
      }).catch(() => {});
    }

    function scheduleRefresh() {
      if (refreshTimer) global.clearTimeout(refreshTimer);
      refreshTimer = null;
      if (!session?.expires_at || !session?.refresh_token) return;
      const delay = Math.max(10_000, session.expires_at * 1000 - Date.now() - 60_000);
      refreshTimer = global.setTimeout(() => refreshSession().catch(() => {}), delay);
    }

    function getSession() {
      return session;
    }

    async function ensureFreshSession() {
      if (!session?.expires_at || session.expires_at * 1000 > Date.now() + 60_000) return session;
      return refreshSession();
    }

    function requireConfig() {
      if (!fetchFn) throw new Error("Fetch API is not available");
      const raw = getConfig();
      const config = {
        anonKey: String(raw.anonKey || "").trim(),
        supabaseUrl: String(raw.supabaseUrl || "").trim().replace(/\/+$/, ""),
      };
      if (!config.supabaseUrl || !config.anonKey) throw new Error("Сначала заполни URL и публичный ключ Supabase");
      return config;
    }

    scheduleRefresh();
    return { ensureFreshSession, getSession, refreshSession, signIn, signOut, signUp };
  }

  function authHeaders(config) {
    return { apikey: config.anonKey, "Content-Type": "application/json" };
  }

  function cleanEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function readResponse(response) {
    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { message: text }; }
  }

  function createAuthError(response, data) {
    const error = new Error(data?.msg || data?.message || response.statusText || "Ошибка авторизации");
    error.status = response.status;
    return error;
  }

  const api = { SESSION_KEY, createRemoteAuth };
  global.RhythmRemoteAuth = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
