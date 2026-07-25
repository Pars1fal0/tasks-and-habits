(function (global) {
  const MAX_JOURNAL_LENGTH = 50000;

  function normalizeJournalEntries(value, options = {}) {
    const createId = options.createId || (() => `journal-${Date.now().toString(36)}`);
    const byDate = new Map();
    (Array.isArray(value) ? value : []).forEach((entry) => {
      const date = normalizeDateKey(entry?.date);
      if (!date) return;
      const createdAt = validTimestamp(entry?.createdAt) || new Date().toISOString();
      const updatedAt = validTimestamp(entry?.updatedAt) || createdAt;
      const normalized = {
        id: String(entry?.id || createId()),
        date,
        text: normalizeJournalText(entry?.text),
        createdAt,
        updatedAt,
      };
      const current = byDate.get(date);
      if (!current || updatedAt >= current.updatedAt) byDate.set(date, normalized);
    });
    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  function journalEntryForDate(entries, date) {
    const dateKey = normalizeDateKey(date);
    if (!dateKey) return null;
    return (Array.isArray(entries) ? entries : []).find((entry) => entry?.date === dateKey) || null;
  }

  function upsertJournalEntry(entries, input, options = {}) {
    const date = normalizeDateKey(input?.date);
    if (!date) throw new Error("Дата дневника должна быть в формате YYYY-MM-DD");
    const text = normalizeJournalText(input?.text);
    const now = validTimestamp(options.now) || new Date().toISOString();
    const createId = options.createId || (() => `journal-${Date.now().toString(36)}`);
    const next = normalizeJournalEntries(entries, { createId });
    const existing = journalEntryForDate(next, date);
    if (!existing && !text) return { changed: false, entries: next, entry: null };
    if (existing && existing.text === text) return { changed: false, entries: next, entry: existing };

    if (existing) {
      existing.text = text;
      existing.updatedAt = now;
      return { changed: true, entries: next, entry: existing };
    }

    const entry = { id: createId(), date, text, createdAt: now, updatedAt: now };
    next.push(entry);
    next.sort((left, right) => left.date.localeCompare(right.date));
    return { changed: true, entries: next, entry };
  }

  function appendJournalText(current, addition) {
    const previous = normalizeJournalText(current);
    const next = normalizeJournalText(addition);
    if (!next) throw new Error("Текст записи не может быть пустым");
    return normalizeJournalText(previous ? `${previous}\n\n${next}` : next);
  }

  function normalizeJournalText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim()
      .slice(0, MAX_JOURNAL_LENGTH);
  }

  function normalizeDateKey(value) {
    const text = String(value || "");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return "";
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return (
      date.getUTCFullYear() === Number(match[1])
      && date.getUTCMonth() === Number(match[2]) - 1
      && date.getUTCDate() === Number(match[3])
    ) ? text : "";
  }

  function validTimestamp(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : "";
  }

  const api = {
    MAX_JOURNAL_LENGTH,
    appendJournalText,
    journalEntryForDate,
    normalizeJournalEntries,
    normalizeJournalText,
    upsertJournalEntry,
  };
  global.RhythmJournalModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
