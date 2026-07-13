(function (global) {
  function createArchiveView(ctx) {
    const selectedKeys = new Set();
    let visibleEntries = [];
    let period = "all";

    ctx.els?.archiveSelectAll?.addEventListener("change", () => {
      selectedKeys.clear();
      if (ctx.els.archiveSelectAll.checked) visibleEntries.forEach((entry) => selectedKeys.add(entryKey(entry)));
      renderArchive();
    });
    ctx.els?.archiveBulkRestore?.addEventListener("click", restoreSelected);
    ctx.els?.archiveBulkDelete?.addEventListener("click", deleteSelected);
    ctx.els?.archivePeriodFilter?.addEventListener("change", () => {
      period = ctx.els.archivePeriodFilter.value || "all";
      renderArchive();
    });

    function renderArchive() {
      const allEntries = ctx.archiveEntries();
      const entries = allEntries.filter((entry) => {
        return (
          ctx.matchesCategoryFilter(entry.task, ctx.getArchiveCategoryFilter()) &&
          ctx.archiveEntryMatchesSearch(entry, ctx.getArchiveSearchQuery()) &&
          global.RhythmPlanningHistory.archiveEntryInPeriod(entry.dateKey, period, ctx.toDateKey(new Date()), ctx.addDays)
        );
      });
      visibleEntries = entries;
      const validKeys = new Set(allEntries.map(entryKey));
      [...selectedKeys].forEach((key) => {
        if (!validKeys.has(key)) selectedKeys.delete(key);
      });
      ctx.els.archiveList.replaceChildren();
      let currentDateKey = "";
      entries.forEach((entry) => {
        if (entry.dateKey !== currentDateKey) {
          currentDateKey = entry.dateKey;
          ctx.els.archiveList.appendChild(createArchiveDateHeader(entry.dateKey));
        }
        ctx.els.archiveList.appendChild(createArchiveNode(entry));
      });
      ctx.els.archiveEmpty.textContent = allEntries.length
        ? "По текущим фильтрам записей нет."
        : "Завершенных задач пока нет.";
      ctx.els.archiveEmpty.classList.toggle("is-visible", entries.length === 0);
      renderBulkBar();
    }

    function createArchiveDateHeader(dateKey) {
      const header = document.createElement("div");
      header.className = "archive-date-header";
      header.textContent = ctx.formatLongDate(dateKey);
      return header;
    }

    function createArchiveNode(entry) {
      const node = document.createElement("article");
      const content = document.createElement("div");
      const title = document.createElement("h3");
      const meta = document.createElement("p");
      const restoreButton = document.createElement("button");
      const select = document.createElement("input");
      const category = ctx.getCategory(entry.task.categoryId);

      node.className = "archive-item";
      select.type = "checkbox";
      select.className = "archive-item-select";
      select.checked = selectedKeys.has(entryKey(entry));
      select.setAttribute("aria-label", `Выбрать ${entry.task.title}`);
      select.addEventListener("change", () => {
        if (select.checked) selectedKeys.add(entryKey(entry));
        else selectedKeys.delete(entryKey(entry));
        renderBulkBar();
      });
      title.textContent = entry.task.title;
      appendArchiveMeta(meta, ctx.formatLongDate(entry.dateKey));
      if (category) {
        const categoryLabel = document.createElement("span");
        const dot = document.createElement("span");
        dot.className = "category-dot";
        dot.style.setProperty("--category-color", category.color);
        categoryLabel.append(dot, document.createTextNode(category.name));
        appendArchiveMeta(meta, categoryLabel);
      } else {
        appendArchiveMeta(meta, "Без категории");
      }
      appendArchiveMeta(meta, ctx.priorityLabels[entry.task.priority] || "Средний");
      restoreButton.className = "ghost-button restore-task";
      restoreButton.type = "button";
      restoreButton.textContent = "Вернуть";
      restoreButton.addEventListener("click", async () => {
        const choice = await ctx.confirmAction({
          title: "Куда вернуть задачу?",
          message: `«${entry.task.title}» была завершена ${ctx.formatLongDate(entry.dateKey)}. Можно вернуть ее на исходный день или перенести в сегодняшний план.`,
          confirmLabel: "На сегодня",
          secondaryLabel: "На исходную дату",
        });
        if (!choice) return;
        const undo = ctx.createUndoSnapshot();
        entry.task.completed[entry.dateKey] = false;
        if (choice !== "secondary") {
          ctx.postponeTask(entry.task, entry.dateKey, ctx.toDateKey(new Date()));
          return;
        }
        ctx.saveState();
        ctx.render();
        ctx.showToast("Задача возвращена в план", { undo });
      });
      content.append(title, meta);
      node.append(select, content, restoreButton);

      return node;
    }

    function renderBulkBar() {
      const count = selectedKeys.size;
      ctx.els.archiveBulkBar.hidden = visibleEntries.length === 0;
      ctx.els.archiveBulkBar.classList.toggle("has-selection", count > 0);
      ctx.els.archiveBulkCount.textContent = `Выбрано: ${count}`;
      ctx.els.archiveBulkRestore.disabled = count === 0;
      ctx.els.archiveBulkDelete.disabled = count === 0;
      const visibleKeys = visibleEntries.map(entryKey);
      ctx.els.archiveSelectAll.checked = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));
      ctx.els.archiveSelectAll.indeterminate = !ctx.els.archiveSelectAll.checked && visibleKeys.some((key) => selectedKeys.has(key));
    }

    function selectedEntries() {
      return ctx.archiveEntries().filter((entry) => selectedKeys.has(entryKey(entry)));
    }

    function restoreSelected() {
      const entries = selectedEntries();
      if (!entries.length) return;
      const undo = ctx.createUndoSnapshot();
      entries.forEach((entry) => {
        entry.task.completed[entry.dateKey] = false;
      });
      selectedKeys.clear();
      ctx.saveState();
      ctx.render();
      ctx.showToast(`Возвращено задач: ${entries.length}`, { undo });
    }

    async function deleteSelected() {
      const entries = selectedEntries();
      if (!entries.length) return;
      const confirmed = await ctx.confirmAction({
        title: "Удалить записи из архива?",
        message: `Будет удалено записей: ${entries.length}. Повторяющиеся серии сохранятся.`,
        confirmLabel: "Удалить",
        tone: "danger",
      });
      if (!confirmed) return;
      const undo = ctx.createUndoSnapshot();
      const deletedTaskIds = new Set();
      entries.forEach((entry) => {
        if (entry.task.repeat === "none") deletedTaskIds.add(entry.task.id);
        else delete entry.task.completed[entry.dateKey];
      });
      deletedTaskIds.forEach(ctx.deleteTask);
      selectedKeys.clear();
      ctx.saveState();
      ctx.render();
      ctx.showToast(`Удалено записей: ${entries.length}`, { undo });
    }

    function entryKey(entry) {
      return `${entry.task.id}:${entry.dateKey}`;
    }

    function appendArchiveMeta(meta, value) {
      if (meta.childNodes.length) meta.append(document.createTextNode(" · "));
      if (value instanceof Node) {
        meta.appendChild(value);
      } else {
        meta.append(document.createTextNode(value));
      }
    }
    function setPeriod(value) {
      period = ["all", "week", "month", "quarter"].includes(value) ? value : "all";
      if (ctx.els.archivePeriodFilter) ctx.els.archivePeriodFilter.value = period;
      renderArchive();
    }
    return { createArchiveNode, renderArchive, setPeriod };
  }

  const api = { createArchiveView };
  global.RhythmArchiveView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
