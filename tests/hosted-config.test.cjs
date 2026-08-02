const assert = require("node:assert/strict");
const { loadHostedConfig } = require("../hosted-config.js");

module.exports = [
  {
    name: "loads managed Supabase settings from the hosted Worker",
    async fn() {
      const result = await loadHostedConfig({
        location: { protocol: "https:" },
        fetchFn: async () => ({
          ok: true,
          json: async () => ({
            anonKey: "public-key",
            supabaseUrl: "https://project.supabase.co/",
          }),
        }),
      });
      assert.deepEqual(result, {
        anonKey: "public-key",
        managed: true,
        supabaseUrl: "https://project.supabase.co",
      });
    },
  },
  {
    name: "loads the shared Parsitasks project in Electron builds",
    async fn() {
      let requestedUrl = "";
      const result = await loadHostedConfig({
        location: { protocol: "file:" },
        fetchFn: async (url) => {
          requestedUrl = url;
          return {
            ok: true,
            json: async () => ({
              anonKey: "desktop-public-key",
              supabaseUrl: "https://project.supabase.co",
            }),
          };
        },
      });
      assert.equal(requestedUrl, "https://parsitasks.ru/api/public-config");
      assert.deepEqual(result, {
        anonKey: "desktop-public-key",
        managed: true,
        supabaseUrl: "https://project.supabase.co",
      });
    },
  },
  {
    name: "keeps unsupported protocols disconnected",
    async fn() {
      let called = false;
      const result = await loadHostedConfig({
        location: { protocol: "data:" },
        fetchFn: async () => { called = true; },
      });
      assert.equal(called, false);
      assert.deepEqual(result, { managed: false });
    },
  },
];
