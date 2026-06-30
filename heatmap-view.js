(function (global) {
  const WEEKDAY_LABELS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

  function createHeatmapView(ctx) {
    function renderHeatmap() {
      const model = buildHeatmapModel({
        activeDate: ctx.getActiveDate(),
        formatLongDate: ctx.formatLongDate,
        parseDate: ctx.parseDate,
        statsForDate: ctx.statsForDate,
        toDateKey: ctx.toDateKey,
      });
      const tooltipNode = getHeatmapTooltip();

      ctx.els.heatmapGrid.replaceChildren();
      ctx.els.heatmapGrid.style.setProperty("--heatmap-columns", model.columns);

      const monthRow = document.createElement("div");
      monthRow.className = "heatmap-months";
      monthRow.style.setProperty("--heatmap-columns", model.columns);
      model.monthSpans.forEach((item) => {
        const node = document.createElement("span");
        node.textContent = item.label;
        node.style.gridColumn = `${item.column + 1} / span ${item.span}`;
        monthRow.appendChild(node);
      });

      const weekdayColumn = document.createElement("div");
      weekdayColumn.className = "heatmap-weekdays";
      WEEKDAY_LABELS.forEach((label) => {
        const node = document.createElement("span");
        node.textContent = label;
        weekdayColumn.appendChild(node);
      });

      const cellsGrid = document.createElement("div");
      cellsGrid.className = "heatmap-cells";
      cellsGrid.style.setProperty("--heatmap-columns", model.columns);

      for (let i = 0; i < model.leadingBlanks; i += 1) {
        cellsGrid.appendChild(createEmptyCell());
      }

      model.days.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";
        cell.tabIndex = 0;
        cell.dataset.date = day.dateKey;
        cell.dataset.tooltip = day.tooltip;
        cell.style.setProperty("--task-alpha", ctx.heatAlpha(day.taskPercent));
        cell.style.setProperty("--habit-alpha", ctx.heatAlpha(day.habitPercent));
        cell.setAttribute("aria-label", day.tooltip);
        if (day.dateKey === model.activeDate) cell.classList.add("is-current");
        bindTooltip(cell, tooltipNode, day.tooltip);
        cellsGrid.appendChild(cell);
      });

      for (let i = 0; i < model.trailingBlanks; i += 1) {
        cellsGrid.appendChild(createEmptyCell());
      }

      ctx.els.heatmapGrid.append(monthRow, weekdayColumn, cellsGrid);
    }

    return { renderHeatmap };
  }

  function buildHeatmapModel({ activeDate, formatLongDate, parseDate, statsForDate, toDateKey }) {
    const end = parseDate(activeDate);
    const start = new Date(end);
    start.setDate(end.getDate() - 364);

    const leadingBlanks = weekdayIndex(start);
    const days = [];
    const monthLabels = [];
    const monthSpans = [];
    let lastMonth = "";

    for (let i = 0; i < 365; i += 1) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const dateKey = toDateKey(current);
      const stats = statsForDate(dateKey);
      const slotIndex = leadingBlanks + i;
      const column = Math.floor(slotIndex / 7);
      const monthKey = `${current.getFullYear()}-${current.getMonth()}`;

      if (monthKey !== lastMonth) {
        monthLabels[column] = monthLabel(current);
        monthSpans.push({ column, label: monthLabel(current) });
        lastMonth = monthKey;
      }

      days.push({
        dateKey,
        habitPercent: stats.habitPercent,
        taskPercent: stats.taskPercent,
        tooltip: `${formatLongDate(dateKey)} (${dateKey}): задачи ${stats.taskPercent}%, привычки ${stats.habitPercent}%`,
      });
    }

    const totalSlots = Math.ceil((leadingBlanks + days.length) / 7) * 7;
    const columns = totalSlots / 7;
    const trailingBlanks = totalSlots - leadingBlanks - days.length;
    const resolvedMonthSpans = monthSpans.map((item, index) => ({
      ...item,
      span: Math.max(1, (monthSpans[index + 1]?.column ?? columns) - item.column),
    }));

    return {
      activeDate,
      columns,
      days,
      leadingBlanks,
      monthLabels: Array.from({ length: columns }, (_, index) => monthLabels[index] || ""),
      monthSpans: resolvedMonthSpans,
      trailingBlanks,
    };
  }

  function monthLabel(date) {
    return new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(date).replace(".", "");
  }

  function weekdayIndex(date) {
    return (date.getDay() + 6) % 7;
  }

  function createEmptyCell() {
    const node = document.createElement("div");
    node.className = "heatmap-empty-cell";
    return node;
  }

  function bindTooltip(cell, tooltipNode, text) {
    cell.addEventListener("pointerenter", () => showHeatmapTooltip(tooltipNode, cell, text));
    cell.addEventListener("pointermove", () => positionHeatmapTooltip(tooltipNode, cell));
    cell.addEventListener("pointerleave", () => hideHeatmapTooltip(tooltipNode));
    cell.addEventListener("click", () => showHeatmapTooltip(tooltipNode, cell, text));
    cell.addEventListener("focus", () => showHeatmapTooltip(tooltipNode, cell, text));
    cell.addEventListener("blur", () => hideHeatmapTooltip(tooltipNode));
  }

  function getHeatmapTooltip() {
    let tooltip = document.querySelector("[data-heatmap-tooltip]");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "heatmap-tooltip";
      tooltip.dataset.heatmapTooltip = "";
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function showHeatmapTooltip(tooltip, cell, text) {
    tooltip.textContent = text;
    tooltip.classList.add("is-visible");
    positionHeatmapTooltip(tooltip, cell);
  }

  function positionHeatmapTooltip(tooltip, cell) {
    const rect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportPadding = 10;
    const desiredLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
    const left = Math.min(Math.max(viewportPadding, desiredLeft), window.innerWidth - tooltipRect.width - viewportPadding);
    const hasRoomAbove = rect.top > tooltipRect.height + 14;
    const top = hasRoomAbove ? rect.top - tooltipRect.height - 8 : rect.bottom + 8;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function hideHeatmapTooltip(tooltip) {
    tooltip.classList.remove("is-visible");
  }

  const api = { buildHeatmapModel, createHeatmapView };
  global.RhythmHeatmapView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
