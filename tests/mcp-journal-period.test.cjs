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
];
