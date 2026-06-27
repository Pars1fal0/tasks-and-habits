(function (global) {
  function createArchiveView(ctx) {
    function renderArchive() {
      const allEntries = ctx.archiveEntries();
      const entries = allEntries.filter((entry) => {
        return ctx.matchesCategoryFilter(entry.task, ctx.getArchiveCategoryFilter()) && ctx.archiveEntryMatchesSearch(entry, ctx.getArchiveSearchQuery());
      });
      ctx.els.archiveList.replaceChildren();
      entries.forEach((entry) => ctx.els.archiveList.appendChild(createArchiveNode(entry)));
      ctx.els.archiveEmpty.textContent = allEntries.length
        ? "По текущим фильтрам записей нет."
        : "Завершенных задач пока нет.";
      ctx.els.archiveEmpty.classList.toggle("is-visible", entries.length === 0);
    }

    function createArchiveNode(entry) {
      const node = document.createElement("article");
      node.className = "archive-item";

      const category = ctx.getCategory(entry.task.categoryId);
      const categoryHtml = category
        ? `<span class="category-dot" style="--category-color: ${ctx.escapeHtml(category.color)}"></span>${ctx.escapeHtml(category.name)}`
        : "Без категории";

      node.innerHTML = `
        <div>
          <h3>${ctx.escapeHtml(entry.task.title)}</h3>
          <p>${ctx.formatLongDate(entry.dateKey)} · ${categoryHtml} · ${ctx.priorityLabels[entry.task.priority] || "Средний"}</p>
        </div>
        <button class="ghost-button restore-task" type="button">Вернуть</button>
      `;

      node.querySelector(".restore-task").addEventListener("click", () => {
        const undo = ctx.createUndoSnapshot();
        entry.task.completed[entry.dateKey] = false;
        ctx.saveState();
        ctx.render();
        ctx.showToast("Задача возвращена в план", { undo });
      });

      return node;
    }

    return { createArchiveNode, renderArchive };
  }

  const api = { createArchiveView };
  global.RhythmArchiveView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
