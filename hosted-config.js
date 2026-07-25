(function (global) {
  async function loadHostedConfig(options = {}) {
    const locationRef = options.location || global.location;
    const fetchFn = options.fetchFn || global.fetch?.bind(global);
    if (!fetchFn || !/^https?:$/.test(String(locationRef?.protocol || ""))) {
      return { managed: false };
    }

    try {
      const response = await fetchFn("/api/public-config", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return { managed: false };
      const value = await response.json();
      const supabaseUrl = String(value?.supabaseUrl || "").trim().replace(/\/+$/, "");
      const anonKey = String(value?.anonKey || "").trim();
      if (!/^https:\/\/[^/]+\.supabase\.co$/i.test(supabaseUrl) || !anonKey) {
        return { managed: false };
      }
      return { anonKey, managed: true, supabaseUrl };
    } catch {
      return { managed: false };
    }
  }

  const api = { loadHostedConfig };
  global.RhythmHostedConfig = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
