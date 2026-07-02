(function (global) {
  function createRemoteSync(options = {}) {
    const fetchFn = options.fetch || global.fetch?.bind(global);
    const tableName = options.tableName || "rhythm_states";

    function normalizeConfig(config = {}) {
      return {
        enabled: config.enabled === true,
        supabaseUrl: stripTrailingSlash(String(config.supabaseUrl || "").trim()),
        anonKey: String(config.anonKey || "").trim(),
        userKey: normalizeUserKey(config.userKey),
      };
    }

    function isConfigured(config = {}) {
      const normalized = normalizeConfig(config);
      return Boolean(normalized.enabled && normalized.supabaseUrl && normalized.anonKey && normalized.userKey);
    }

    async function pushState(config, payload = {}) {
      ensureFetch();
      const normalized = normalizeConfig(config);
      ensureConfigured(normalized);
      const clientUpdatedAt = payload.clientUpdatedAt || new Date().toISOString();
      const body = {
        user_key: normalized.userKey,
        state: payload.state || {},
        ui_state: payload.uiState || {},
        schema_version: payload.schemaVersion || payload.state?.schemaVersion || 1,
        client_updated_at: clientUpdatedAt,
      };
      const response = await fetchFn(`${normalized.supabaseUrl}/rest/v1/${tableName}?on_conflict=user_key`, {
        method: "POST",
        headers: supabaseHeaders(normalized, {
          Prefer: "resolution=merge-duplicates,return=representation",
        }),
        body: JSON.stringify(body),
      });

      const data = await readResponse(response);
      if (!response.ok) throw createRemoteError("push-failed", response, data);
      return { ok: true, clientUpdatedAt, row: Array.isArray(data) ? data[0] : data };
    }

    async function pullState(config) {
      ensureFetch();
      const normalized = normalizeConfig(config);
      ensureConfigured(normalized);
      const filter = `user_key=eq.${encodeURIComponent(normalized.userKey)}`;
      const select = "select=state,ui_state,schema_version,client_updated_at,updated_at";
      const response = await fetchFn(`${normalized.supabaseUrl}/rest/v1/${tableName}?${select}&${filter}&limit=1`, {
        method: "GET",
        headers: supabaseHeaders(normalized),
      });

      const data = await readResponse(response);
      if (!response.ok) throw createRemoteError("pull-failed", response, data);
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return { ok: true, found: false };
      return {
        ok: true,
        found: true,
        row,
        state: row.state || null,
        uiState: row.ui_state || {},
        clientUpdatedAt: row.client_updated_at || "",
        updatedAt: row.updated_at || "",
      };
    }

    async function checkConnection(config) {
      ensureFetch();
      const normalized = normalizeConfig(config);
      ensureConfigured(normalized);
      const filter = `user_key=eq.${encodeURIComponent(normalized.userKey)}`;
      const response = await fetchFn(`${normalized.supabaseUrl}/rest/v1/${tableName}?select=user_key,client_updated_at&${filter}&limit=1`, {
        method: "GET",
        headers: supabaseHeaders(normalized),
      });

      const data = await readResponse(response);
      if (!response.ok) throw createRemoteError("check-failed", response, data);
      const row = Array.isArray(data) ? data[0] : null;
      return { found: Boolean(row), ok: true, row };
    }

    function ensureFetch() {
      if (!fetchFn) throw new Error("Fetch API is not available for remote sync");
    }

    function ensureConfigured(config) {
      if (!isConfigured(config)) {
        throw new Error("Remote sync is not configured");
      }
    }

    function supabaseHeaders(config, extra = {}) {
      return {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        "x-rhythm-user-key": config.userKey,
        ...extra,
      };
    }

    async function readResponse(response) {
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return {
      checkConnection,
      isConfigured,
      normalizeConfig,
      pullState,
      pushState,
    };
  }

  function createRemoteError(code, response, data) {
    const message = typeof data === "string" ? data : data?.message || data?.hint || response.statusText;
    const error = new Error(message || code);
    error.code = code;
    error.status = response.status;
    error.data = data;
    return error;
  }

  function normalizeUserKey(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  function stripTrailingSlash(value) {
    return value.replace(/\/+$/, "");
  }

  const api = { createRemoteSync, normalizeUserKey, stripTrailingSlash };
  global.RhythmRemoteSync = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
