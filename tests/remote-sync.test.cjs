const assert = require("node:assert/strict");
const { createRemoteSync, normalizeUserKey, stripTrailingSlash } = require("../remote-sync.js");

module.exports = [
  {
    name: "normalizes remote sync configuration",
    fn() {
      assert.equal(stripTrailingSlash("https://demo.supabase.co///"), "https://demo.supabase.co");
      assert.equal(normalizeUserKey(" My Main Device "), "my-main-device");

      const sync = createRemoteSync({ fetch: async () => ({ ok: true, text: async () => "[]" }) });
      assert.equal(sync.isConfigured({ enabled: true, supabaseUrl: "https://demo.supabase.co", anonKey: "key", userKey: "me" }), true);
      assert.equal(sync.isConfigured({ enabled: true, supabaseUrl: "", anonKey: "key", userKey: "me" }), false);
    },
  },
  {
    name: "pushes state through Supabase upsert endpoint",
    async fn() {
      const calls = [];
      const sync = createRemoteSync({
        fetch: async (url, options) => {
          calls.push({ url, options });
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify([{ user_key: "me", state: { tasks: [] } }]),
          };
        },
      });

      const result = await sync.pushState(
        { enabled: true, supabaseUrl: "https://demo.supabase.co/", anonKey: "anon", userKey: "me" },
        { clientUpdatedAt: "2026-07-01T00:00:00.000Z", schemaVersion: 7, state: { tasks: [] }, uiState: { themePreference: "dark" } },
      );

      assert.equal(result.ok, true);
      assert.equal(calls[0].url, "https://demo.supabase.co/rest/v1/rhythm_states?on_conflict=user_key");
      assert.equal(calls[0].options.method, "POST");
      assert.equal(calls[0].options.headers.apikey, "anon");
      assert.equal(calls[0].options.headers["x-rhythm-user-key"], "me");
      assert.equal(calls[0].options.headers.Prefer, "resolution=merge-duplicates,return=representation");
      assert.deepEqual(JSON.parse(calls[0].options.body), {
        client_updated_at: "2026-07-01T00:00:00.000Z",
        schema_version: 7,
        state: { tasks: [] },
        ui_state: { themePreference: "dark" },
        user_key: "me",
      });
    },
  },
  {
    name: "pulls state from Supabase by user key",
    async fn() {
      const calls = [];
      const sync = createRemoteSync({
        fetch: async (url, options) => {
          calls.push({ url, options });
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify([
                {
                  state: { schemaVersion: 7, tasks: [{ id: "task-1" }] },
                  ui_state: { themePreference: "dark" },
                  client_updated_at: "2026-07-01T00:00:00.000Z",
                  updated_at: "2026-07-01T00:00:01.000Z",
                },
              ]),
          };
        },
      });

      const result = await sync.pullState({ enabled: true, supabaseUrl: "https://demo.supabase.co", anonKey: "anon", userKey: "me" });

      assert.equal(result.found, true);
      assert.equal(result.state.tasks[0].id, "task-1");
      assert.match(calls[0].url, /user_key=eq\.me/);
      assert.equal(calls[0].options.method, "GET");
    },
  },
];
