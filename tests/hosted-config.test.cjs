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
    name: "keeps local and Electron builds manually configurable",
    async fn() {
      let called = false;
      const result = await loadHostedConfig({
        location: { protocol: "file:" },
        fetchFn: async () => {
          called = true;
        },
      });
      assert.equal(called, false);
      assert.deepEqual(result, { managed: false });
    },
  },
];
