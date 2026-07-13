(function (global) {
  function createWeeklySummary(ctx) {
    function render(week) {
      const summary = buildWeeklySummary(week, ctx.statsForDate, ctx.formatWeekday);
      if (ctx.els.weekSummaryCompleted) {
        ctx.els.weekSummaryCompleted.textContent = `${summary.taskDone} / ${summary.taskTotal}`;
      }
      if (ctx.els.weekSummaryHabits) {
        ctx.els.weekSummaryHabits.textContent = `${summary.habitDone} / ${summary.habitTotal}`;
      }
      if (ctx.els.weekSummaryBestDay) ctx.els.weekSummaryBestDay.textContent = summary.bestDayLabel;
      if (ctx.els.weekSummaryText) ctx.els.weekSummaryText.textContent = summary.text;
      ctx.els.weeklySummaryPanel?.classList.toggle(
        "is-empty",
        summary.taskTotal + summary.habitTotal === 0,
      );
      return summary;
    }

    return { render };
  }

  function buildWeeklySummary(week = [], statsForDate, formatWeekday = (value) => value) {
    const days = week.map((dateKey) => ({ dateKey, stats: statsForDate(dateKey) }));
    const totals = days.reduce(
      (result, day) => ({
        taskDone: result.taskDone + day.stats.taskDone,
        taskTotal: result.taskTotal + day.stats.taskTotal,
        habitDone: result.habitDone + day.stats.habitDone,
        habitTotal: result.habitTotal + day.stats.habitTotal,
      }),
      { taskDone: 0, taskTotal: 0, habitDone: 0, habitTotal: 0 },
    );
    const rankedDays = days
      .map((day) => ({ ...day, score: combinedScore(day.stats) }))
      .filter((day) => day.stats.taskTotal + day.stats.habitTotal > 0)
      .sort((a, b) => b.score - a.score || b.dateKey.localeCompare(a.dateKey));
    const bestDay = rankedDays[0];
    const bestDayLabel = bestDay ? `${formatWeekday(bestDay.dateKey)}, ${bestDay.score}%` : "Нет данных";
    const completionTotal = totals.taskTotal + totals.habitTotal;
    const completionDone = totals.taskDone + totals.habitDone;
    const overall = completionTotal ? Math.round((completionDone / completionTotal) * 100) : 0;
    const text = completionTotal
      ? `Общий темп недели — ${overall}%. ${bestDay ? `Лучший день: ${formatWeekday(bestDay.dateKey).toLowerCase()}.` : ""}`.trim()
      : "На этой неделе пока нет запланированных задач и привычек.";
    return { ...totals, bestDayLabel, overall, text };
  }

  function combinedScore(stats) {
    const parts = [];
    if (stats.taskTotal) parts.push(stats.taskPercent);
    if (stats.habitTotal) parts.push(stats.habitPercent);
    return parts.length ? Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length) : 0;
  }

  const api = { buildWeeklySummary, createWeeklySummary };
  global.RhythmWeeklySummary = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
