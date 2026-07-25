const assert = require("node:assert/strict");

module.exports = [
  {
    name: "MCP returns journal entries for an inclusive period",
    async fn() {
      const { getJournalPeriod } = await import("../mcp/journal-service.mjs");
      const result = getJournalPeriod({
        journalEntries: [
          { id: "one", date: "2026-07-20", text: "Понедельник", updatedAt: "2026-07-20T10:00:00.000Z" },
          { id: "two", date: "2026-07-27", text: "Следующая неделя", updatedAt: "2026-07-27T10:00:00.000Z" },
        ],
      }, "2026-07-20", "2026-07-26");
      assert.deepEqual(result.entries.map((entry) => entry.date), ["2026-07-20"]);
    },
  },
  {
    name: "MCP journal writes version their revision history for synchronization",
    async fn() {
      const { appendJournalEntryCommand } = await import("../mcp/journal-service.mjs");
      const state = {
        journalEntries: [{
          id: "journal",
          date: "2026-07-20",
          text: "Старая запись",
          revisions: [],
          createdAt: "2026-07-20T08:00:00.000Z",
          updatedAt: "2026-07-20T08:00:00.000Z",
        }],
        mcpActivity: [],
        tombstones: { journalEntries: {} },
        syncMeta: { entityFields: { journalEntries: {} } },
      };
      const result = appendJournalEntryCommand(state, {
        requestId: "journal-sync-version",
        date: "2026-07-20",
        text: "Новый абзац",
      }, { now: "2026-07-20T10:00:00.000Z" });
      const versions = result.state.syncMeta.entityFields.journalEntries.journal;
      assert.equal(versions.revisions, "2026-07-20T10:00:00.000Z");
      assert.equal(result.entry.revisions.length, 1);
    },
  },
];
