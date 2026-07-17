const assert = require("node:assert/strict");
const { SESSION_KEY, createRemoteAuth } = require("../remote-auth.js");

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

module.exports = [
  {
    name: "stores an authenticated session separately after sign in",
    async fn() {
      const storage = createStorage();
      const calls = [];
      const auth = createRemoteAuth({
        fetch: async (url, options) => {
          calls.push({ url, options });
          return {
            ok: true,
            text: async () => JSON.stringify({ access_token: "jwt", refresh_token: "refresh", user: { id: "u1", email: "me@example.com" } }),
          };
        },
        getConfig: () => ({ anonKey: "anon", supabaseUrl: "https://demo.supabase.co/" }),
        storage,
      });

      await auth.signIn(" ME@example.com ", "secret12");

      assert.match(calls[0].url, /auth\/v1\/token\?grant_type=password$/);
      assert.equal(JSON.parse(calls[0].options.body).email, "me@example.com");
      assert.equal(auth.getSession().user.id, "u1");
      assert.equal(JSON.parse(storage.values.get(SESSION_KEY)).access_token, "jwt");
    },
  },
  {
    name: "clears the local session on sign out",
    async fn() {
      const storage = createStorage();
      storage.setItem(SESSION_KEY, JSON.stringify({ access_token: "jwt", user: { id: "u1" } }));
      const auth = createRemoteAuth({
        fetch: async () => ({ ok: true, text: async () => "" }),
        getConfig: () => ({ anonKey: "anon", supabaseUrl: "https://demo.supabase.co" }),
        storage,
      });

      await auth.signOut();
      assert.equal(auth.getSession(), null);
      assert.equal(storage.getItem(SESSION_KEY), null);
    },
  },
  {
    name: "still signs out locally after project settings are removed",
    async fn() {
      const storage = createStorage();
      storage.setItem(SESSION_KEY, JSON.stringify({ access_token: "jwt", user: { id: "u1" } }));
      const auth = createRemoteAuth({
        fetch: async () => {
          throw new Error("must not request a missing project");
        },
        getConfig: () => ({}),
        storage,
      });

      await auth.signOut();

      assert.equal(storage.getItem(SESSION_KEY), null);
    },
  },
  {
    name: "requests a password recovery email without storing credentials",
    async fn() {
      const calls = [];
      const auth = createRemoteAuth({
        fetch: async (url, options) => {
          calls.push({ url, options });
          return { ok: true, text: async () => "{}" };
        },
        getConfig: () => ({ anonKey: "anon", supabaseUrl: "https://demo.supabase.co" }),
        storage: createStorage(),
      });

      await auth.resetPassword(" ME@example.com ");
      assert.match(calls[0].url, /auth\/v1\/recover$/);
      assert.equal(JSON.parse(calls[0].options.body).email, "me@example.com");
    },
  },
];
