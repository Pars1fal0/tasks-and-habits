(function (global) {
  function normalizeHabitConfigHistory(value, options = {}) {
    const fallbackDate = normalizeDate(options.startDate) || "1970-01-01";
    const fallbackUpdatedAt = validTimestamp(options.updatedAt) || new Date(0).toISOString();
    const fallback = normalizeConfig(options.fallback || {}, options);
    const byDate = new Map();

    (Array.isArray(value) ? value : []).forEach((entry) => {
      const fromDate = normalizeDate(entry?.fromDate);
      if (!fromDate) return;
      const normalized = {
        ...normalizeConfig(entry, options),
        fromDate,
        updatedAt: validTimestamp(entry.updatedAt) || fallbackUpdatedAt,
      };
      const existing = byDate.get(fromDate);
      if (!existing || Date.parse(normalized.updatedAt) >= Date.parse(existing.updatedAt)) byDate.set(fromDate, normalized);
    });

    if (!byDate.size || ![...byDate.keys()].some((dateKey) => dateKey <= fallbackDate)) {
      byDate.set(fallbackDate, { ...fallback, fromDate: fallbackDate, updatedAt: fallbackUpdatedAt });
    }
    return [...byDate.values()].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  }

  function habitConfigOnDate(habit, dateKey, options = {}) {
    const history = normalizeHabitConfigHistory(habit?.configHistory, {
      ...options,
      fallback: habit,
      startDate: habit?.startDate,
      updatedAt: habit?.updatedAt || habit?.createdAt,
    });
    const targetDate = normalizeDate(dateKey) || "9999-12-31";
    return [...history].reverse().find((entry) => entry.fromDate <= targetDate) || history[0];
  }

  function habitIsArchivedOnDate(habit, dateKey) {
    if (habit?.archived !== true) return false;
    const archivedFromDate = normalizeDate(habit.archivedFromDate) || normalizeDate(String(habit.archivedAt || "").slice(0, 10));
    return !archivedFromDate || normalizeDate(dateKey) >= archivedFromDate;
  }

  function applyHabitConfigChange(habit, config, effectiveDate, options = {}) {
    const fromDate = normalizeDate(effectiveDate);
    if (!fromDate) return habit;
    const updatedAt = validTimestamp(options.updatedAt) || new Date().toISOString();
    const history = normalizeHabitConfigHistory(habit?.configHistory, {
      ...options,
      fallback: habit,
      startDate: habit?.startDate || fromDate,
      updatedAt: habit?.updatedAt || habit?.createdAt,
    }).filter((entry) => entry.fromDate !== fromDate);
    history.push({ ...normalizeConfig(config, options), fromDate, updatedAt });
    history.sort((a, b) => a.fromDate.localeCompare(b.fromDate));
    const latest = history.at(-1);
    return {
      ...habit,
      type: latest.type,
      repeat: latest.repeat,
      customRepeat: clone(latest.customRepeat),
      unit: latest.unit,
      goal: latest.goal,
      configHistory: history,
      updatedAt,
    };
  }

  function mergeHabitConfigHistory(localHabit, remoteHabit, options = {}) {
    const local = normalizeHabitConfigHistory(localHabit?.configHistory, {
      ...options,
      fallback: localHabit,
      startDate: localHabit?.startDate,
      updatedAt: localHabit?.updatedAt || localHabit?.createdAt,
    });
    const remote = normalizeHabitConfigHistory(remoteHabit?.configHistory, {
      ...options,
      fallback: remoteHabit,
      startDate: remoteHabit?.startDate,
      updatedAt: remoteHabit?.updatedAt || remoteHabit?.createdAt,
    });
    return normalizeHabitConfigHistory([...local, ...remote], {
      ...options,
      fallback: remoteHabit || localHabit,
      startDate: remoteHabit?.startDate || localHabit?.startDate,
      updatedAt: remoteHabit?.updatedAt || localHabit?.updatedAt,
    });
  }

  function normalizeConfig(value = {}, options = {}) {
    const type = value.type === "number" ? "number" : "check";
    const repeat = options.normalizeRepeat ? options.normalizeRepeat(value.repeat) : normalizeRepeat(value.repeat);
    const customRepeat = repeat === "custom"
      ? options.normalizeCustomRepeat?.(value.customRepeat) || clone(value.customRepeat || {})
      : {};
    return {
      type,
      repeat,
      customRepeat,
      unit: cleanText(value.unit),
      goal: type === "number" ? Math.max(1, Number(value.goal || 1)) : 1,
    };
  }

  function normalizeRepeat(value) {
    return ["daily", "every2days", "every3days", "weekdays", "weekends", "weekly", "custom"].includes(value)
      ? value
      : "daily";
  }

  function normalizeDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return "";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return "";
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function cleanText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function validTimestamp(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : "";
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const api = { applyHabitConfigChange, habitConfigOnDate, habitIsArchivedOnDate, mergeHabitConfigHistory, normalizeHabitConfigHistory };
  global.RhythmHabitConfigHistory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
