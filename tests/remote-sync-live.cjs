const assert = require("node:assert/strict");
const { createRemoteAuth } = require("../remote-auth.js");
const { createRemoteSync } = require("../remote-sync.js");

const requiredVariables = [
  "RHYTHM_SUPABASE_URL",
  "RHYTHM_SUPABASE_ANON_KEY",
  "RHYTHM_SUPABASE_EMAIL",
  "RHYTHM_SUPABASE_PASSWORD",
];
const missing = requiredVariables.filter((name) => !String(process.env[name] || "").trim());

if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("See README.md -> Live-проверка Supabase.");
  process.exit(2);
}

const config = {
  anonKey: process.env.RHYTHM_SUPABASE_ANON_KEY.trim(),
  supabaseUrl: process.env.RHYTHM_SUPABASE_URL.trim().replace(/\/+$/, ""),
};
const memoryStorage = {
  getItem() {
    return null;
  },
  removeItem() {},
  setItem() {},
};

async function run() {
  const auth = createRemoteAuth({
    fetch,
    getConfig: () => config,
    storage: memoryStorage,
  });
  const session = await auth.signIn(
    process.env.RHYTHM_SUPABASE_EMAIL,
    process.env.RHYTHM_SUPABASE_PASSWORD,
  );
  assert.ok(session.access_token, "Supabase Auth did not return an access token");
  assert.ok(session.user?.id, "Supabase Auth did not return a user id");

  const sync = createRemoteSync({ fetch });
  const result = await sync.checkConnection({
    ...config,
    accessToken: session.access_token,
    enabled: true,
    userId: session.user.id,
  });
  assert.equal(result.ok, true);
  console.log(`live sync ok - auth, rhythm_states and RLS are available (saved row: ${result.found ? "yes" : "no"})`);
}

run().catch((error) => {
  console.error(`live sync failed: ${error.message}`);
  if (error.status) console.error(`HTTP status: ${error.status}`);
  process.exitCode = 1;
});
