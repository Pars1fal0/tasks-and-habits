const assert = require("node:assert/strict");
const { buildPayload } = require("../google-calendar-controller.js");
const { createGoogleCalendarApi, resolveBaseUrl } = require("../google-calendar-api.js");

module.exports = [
  {
    name: "Google Calendar OAuth requests offline event access with protected state",
    async fn() {
      const calendar = await import("../mcp/google-calendar.mjs");
      const env = {
        APP_BASE_URL: "https://parsitasks.ru",
        GOOGLE_CALENDAR_CLIENT_ID: "client.apps.googleusercontent.com",
      };
      const url = new URL(calendar.createGoogleAuthorizationUrl(env, "secure-state", "https://parsitasks.ru/api/google-calendar/connect"));
      assert.equal(url.origin, "https://accounts.google.com");
      assert.equal(url.searchParams.get("access_type"), "offline");
      assert.equal(url.searchParams.get("prompt"), "consent");
      assert.equal(url.searchParams.get("state"), "secure-state");
      assert.equal(url.searchParams.get("redirect_uri"), "https://parsitasks.ru/api/google-calendar/callback");
      assert.match(url.searchParams.get("scope"), /calendar\.events/);
    },
  },
  {
    name: "calendar connection requires a Parsitasks session and stores OAuth state in an HttpOnly cookie",
    async fn() {
      const calendar = await import("../mcp/google-calendar.mjs");
      const env = {
        APP_BASE_URL: "https://parsitasks.ru",
        GOOGLE_CALENDAR_CLIENT_ID: "client.apps.googleusercontent.com",
        GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
        GOOGLE_TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
        SUPABASE_PUBLISHABLE_KEY: "publishable",
        SUPABASE_URL: "https://demo.supabase.co",
      };
      const fetch = async (url) => {
        assert.match(String(url), /\/auth\/v1\/user$/);
        return new Response(JSON.stringify({ id: "user-1", email: "me@example.com" }), { status: 200 });
      };
      const response = await calendar.handleGoogleCalendarRequest(new Request("https://parsitasks.ru/api/google-calendar/connect", {
        method: "POST",
        headers: { Authorization: "Bearer account-token" },
      }), env, { fetch });
      const data = await response.json();
      assert.equal(response.status, 200);
      assert.match(data.authorizationUrl, /^https:\/\/accounts\.google\.com/);
      assert.match(response.headers.get("set-cookie"), /HttpOnly/);
      assert.match(response.headers.get("set-cookie"), /SameSite=Lax/);
      assert.doesNotMatch(data.authorizationUrl, /account-token/);
    },
  },
  {
    name: "Google Calendar converts a same-day event into a Parsitasks block",
    async fn() {
      const calendar = await import("../mcp/google-calendar.mjs");
      const patch = calendar.googleEventToTask({
        id: "event-1",
        summary: "Созвон",
        start: { dateTime: "2026-08-03T10:00:00+03:00" },
        end: { dateTime: "2026-08-03T11:30:00+03:00" },
        updated: "2026-08-02T12:00:00.000Z",
      }, "task-1", "Europe/Moscow");
      assert.deepEqual(patch, {
        id: "task-1",
        title: "Созвон",
        date: "2026-08-03",
        scheduleMode: "block",
        startTime: "10:00",
        endTime: "11:30",
        time: "11:30",
        updatedAt: "2026-08-02T12:00:00.000Z",
      });
      assert.equal(calendar.googleEventToTask({ start: { date: "2026-08-03" }, end: { date: "2026-08-04" } }, "all-day"), null);
    },
  },
  {
    name: "calendar payload includes ordinary blocks and safely skips recurring series",
    fn() {
      const state = {
        categories: [{ id: "work", name: "Работа" }],
        googleCalendarLinks: { one: { eventId: "event-1" } },
        tasks: [
          { id: "one", title: "Блок", date: "2026-08-03", scheduleMode: "block", startTime: "10:00", endTime: "11:00", repeat: "none", categoryId: "work", priority: "high", updatedAt: "2026-08-02T10:00:00.000Z" },
          { id: "series", title: "Серия", date: "2026-08-03", scheduleMode: "block", startTime: "12:00", endTime: "13:00", repeat: "daily", updatedAt: "2026-08-02T10:00:00.000Z" },
        ],
        tombstones: { tasks: { deleted: "2026-08-02T11:00:00.000Z" } },
      };
      const payload = buildPayload(state, "two-way", "Europe/Moscow", new Date("2026-08-02T12:00:00.000Z"));
      assert.equal(payload.tasks.length, 1);
      assert.equal(payload.tasks[0].category, "Работа");
      assert.equal(payload.direction, "two-way");
      assert.equal(payload.skipped, 1);
      assert.deepEqual(payload.outOfRangeTaskIds, []);
      assert.equal(payload.tombstones.deleted, "2026-08-02T11:00:00.000Z");
    },
  },
  {
    name: "calendar API keeps credentials in the Authorization header",
    async fn() {
      const calls = [];
      const api = createGoogleCalendarApi({
        fetch: async (url, options) => {
          calls.push({ options, url });
          return { ok: true, text: async () => JSON.stringify({ connected: false }) };
        },
        getAccessToken: async () => "account-token",
        location: { origin: "https://parsitasks.ru", protocol: "https:" },
      });
      await api.status();
      assert.equal(calls[0].url, "https://parsitasks.ru/api/google-calendar/status");
      assert.equal(calls[0].options.headers.Authorization, "Bearer account-token");
      assert.equal(resolveBaseUrl({ origin: "null", protocol: "file:" }), "https://parsitasks.ru");
    },
  },
];
