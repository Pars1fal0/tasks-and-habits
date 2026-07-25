const assert = require("node:assert/strict");
const { installDom } = require("./dom-test-utils.cjs");
const { createJournalView } = require("../journal-view.js");

module.exports = [
  {
    name: "renders and autosaves the selected daily journal entry",
    fn() {
      const document = installDom();
      document.activeElement = null;
      const els = {
        journalCount: document.createElement("span"),
        journalDate: document.createElement("p"),
        journalStatus: document.createElement("span"),
        journalText: document.createElement("textarea"),
      };
      let saved = null;
      const view = createJournalView({
        els,
        formatLongDate: () => "суббота, 25 июля",
        formatTime: () => "12:30",
        getActiveDate: () => "2026-07-25",
        getEntry: () => ({ text: "Начало дня", updatedAt: "2026-07-25T10:00:00.000Z" }),
        maxLength: 50000,
        saveEntry: (date, text) => {
          saved = { date, text };
          return { entry: { date, text, updatedAt: "2026-07-25T12:30:00.000Z" } };
        },
      });

      view.bindEvents();
      view.render();
      assert.equal(els.journalText.value, "Начало дня");
      assert.match(els.journalDate.textContent, /25 июля/);

      els.journalText.value = "Полная запись дня";
      els.journalText.dispatchEvent({ type: "input" });
      view.flush();

      assert.deepEqual(saved, { date: "2026-07-25", text: "Полная запись дня" });
      assert.match(els.journalStatus.textContent, /12:30/);
      assert.match(els.journalCount.textContent, /^17/);
    },
  },
];
