(function (global) {
  function createPwaController(options = {}) {
    const navigatorApi = options.navigator || global.navigator;
    const cachesApi = options.caches || global.caches;
    const hostname = options.hostname ?? global.location?.hostname ?? "";
    const isDesktop = options.isDesktop ?? Boolean(global.rhythmDesktop);

    function register() {
      if (!navigatorApi?.serviceWorker || isDesktop) return Promise.resolve(false);
      if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return clearDevelopmentCaches();
      return navigatorApi.serviceWorker
        .register("sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .then(() => true)
        .catch(() => false);
    }

    async function clearDevelopmentCaches() {
      const registrations = await navigatorApi.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if (cachesApi) {
        const keys = await cachesApi.keys().catch(() => []);
        await Promise.all(keys.filter((key) => key.startsWith("rhythm-day-")).map((key) => cachesApi.delete(key)));
      }
      return false;
    }

    return { register };
  }

  const api = { createPwaController };
  global.RhythmPwaController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
