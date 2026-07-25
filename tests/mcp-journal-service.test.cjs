const assert = require("node:assert/strict");

async function loadServices() {
  return Promise.all([
    import("../mcp/journal-service.mjs"),
    import("../mcp/task-service.mjs"),
    import("../mcp/activity-service.mjs"),
  ]);
}

module.exports = [
  {
    name: "MCP reads and appends journal text idempotently with undo",
    async fn() {
      const [journal, tasks, activity] = await loadServices();
      const state = tasks.createEmptyState();
      const input = {
        requestId: "journal-request-123",
        date: "2026-07-25",
        text: "Подключил дневник к ChatGPT.",
      };
      const first = journal.appendJournalEntryCommand(state, input, {
        now: "2026-07-25T12:00:00.000Z",
      });
      const retry = journal.appendJournalEntryCommand(first.state, input, {
        now: "2026-07-25T12:01:00.000Z",
      });

      assert.equal(first.changed, true);
      assert.equal(first.entry.text, input.text);
      assert.equal(retry.changed, false);
      assert.equal(retry.state.journalEntries.length, 1);
      assert.equal(journal.getJournalEntry(first.state, input.date).exists, true);

      const undone = activity.undoMcpActivity(
        first.state,
        first.activity.id,
        "2026-07-25T12:02:00.000Z",
      );
      assert.equal(undone.state.journalEntries.length, 0);
      assert.ok(undone.state.tombstones.journalEntries[first.entry.id]);
    },
  },
  {
    name: "MCP appends a new paragraph instead of replacing the journal",
    async fn() {
      const [journal, tasks] = await loadServices();
      const state = tasks.createEmptyState();
      state.journalEntries.push({
        id: "existing",
        date: "2026-07-25",
        text: "Утром была тренировка.",
        createdAt: "2026-07-25T08:00:00.000Z",
        updatedAt: "2026-07-25T08:00:00.000Z",
      });
      const result = journal.appendJournalEntryCommand(state, {
        requestId: "journal-request-456",
        date: "2026-07-25",
        text: "Вечером закончил работу.",
      }, { now: "2026-07-25T18:00:00.000Z" });

      assert.equal(result.entry.text, "Утром была тренировка.\n\nВечером закончил работу.");
      const search = tasks.searchKnowledge(result.state, "тренировка", { baseUrl: "https://parsitasks.ru" });
      assert.equal(search.results[0].type, "journal");
      assert.equal(tasks.fetchKnowledge(result.state, search.results[0].id).text, result.entry.text);
    },
  },
];
