(function (global) {
  function createJournalView(ctx) {
    let pendingDate = "";
    let saveTimer = null;

    function bindEvents() {
      ctx.els.journalText?.addEventListener("input", handleInput);
      ctx.els.journalText?.addEventListener("blur", flush);
    }

    function render() {
      const date = ctx.getActiveDate();
      const entry = ctx.getEntry(date);
      ctx.els.journalDate.textContent = ctx.formatLongDate(date);
      if (document.activeElement !== ctx.els.journalText || pendingDate !== date) {
        ctx.els.journalText.value = entry?.text || "";
      }
      pendingDate = date;
      renderCount();
      renderStatus(entry?.updatedAt ? `Сохранено ${ctx.formatTime(entry.updatedAt)}` : "Запись сохранится автоматически");
    }

    function handleInput() {
      pendingDate = ctx.getActiveDate();
      renderCount();
      renderStatus("Сохраняю...");
      if (saveTimer) global.clearTimeout(saveTimer);
      saveTimer = global.setTimeout(flush, 550);
    }

    function flush() {
      if (saveTimer) global.clearTimeout(saveTimer);
      saveTimer = null;
      const date = pendingDate || ctx.getActiveDate();
      const result = ctx.saveEntry(date, ctx.els.journalText.value);
      const entry = result?.entry || ctx.getEntry(date);
      renderStatus(entry?.updatedAt ? `Сохранено ${ctx.formatTime(entry.updatedAt)}` : "Запись сохранится автоматически");
    }

    function renderCount() {
      const length = ctx.els.journalText?.value.length || 0;
      ctx.els.journalCount.textContent = `${length.toLocaleString("ru-RU")} / ${ctx.maxLength.toLocaleString("ru-RU")}`;
    }

    function renderStatus(message) {
      ctx.els.journalStatus.textContent = message;
    }

    return { bindEvents, flush, render };
  }

  const api = { createJournalView };
  global.RhythmJournalView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
