const assert = require("node:assert/strict");
const { searchWorkspace } = require("../global-search.js");

module.exports = [
  {
    name: "searches tasks, habits, goals, and journal entries together",
    fn() {
      const state = {
        categories: [{ id: "work", name: "Работа" }],
        tasks: [{ id: "task", title: "Запустить сайт", date: "2026-07-25", categoryId: "work", completed: {} }],
        habits: [{ id: "habit", title: "Читать книгу", startDate: "2026-07-01" }],
        goals: [{ id: "goal", title: "Подготовить релиз", steps: [{ title: "Запустить сайт" }] }],
        journalEntries: [{ id: "journal", date: "2026-07-24", text: "Сегодня удалось запустить сайт" }],
      };
      const results = searchWorkspace(state, "запустить сайт");
      assert.deepEqual(results.map((item) => item.type), ["task", "goal", "journal"]);
      assert.equal(results.at(-1).view, "journal");
    },
  },
];
