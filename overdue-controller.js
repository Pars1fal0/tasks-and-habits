(function (global) {
  function createOverdueController(ctx) {
    function list(now = new Date()) {
      const todayKey = ctx.toDateKey(now);
      const entries = [];

      ctx.getTasks().forEach((task) => {
        if (task.repeat === "none") {
          addEntry(entries, task, task.date, now);
          return;
        }

        const firstDate = parseDate(task.date);
        if (Number.isNaN(firstDate.getTime())) return;
        const finalKey = task.repeatUntil && task.repeatUntil < todayKey ? task.repeatUntil : todayKey;
        const finalDate = parseDate(finalKey);
        for (let cursor = firstDate; cursor <= finalDate; cursor.setDate(cursor.getDate() + 1)) {
          const dateKey = ctx.toDateKey(cursor);
          if (!ctx.taskScheduledOn(task, dateKey) || ctx.isTaskExcluded(task, dateKey)) continue;
          addEntry(entries, task, dateKey, now);
        }
      });

      return entries.sort((a, b) => a.dueAt - b.dueAt || a.task.title.localeCompare(b.task.title, "ru"));
    }

    function addEntry(entries, task, dateKey, now) {
      const dueAt = ctx.getTaskDeadlineDate(task, dateKey);
      if (dueAt >= now || ctx.isTaskDone(task, dateKey)) return;
      entries.push({ task, dateKey, dueAt });
    }

    return { list };
  }

  function parseDate(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  global.RhythmOverdueController = { createOverdueController };
  if (typeof module !== "undefined" && module.exports) module.exports = { createOverdueController };
})(typeof window !== "undefined" ? window : globalThis);
