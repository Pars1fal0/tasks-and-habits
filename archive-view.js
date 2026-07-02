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
      const content = document.createElement("div");
      const title = document.createElement("h3");
      const meta = document.createElement("p");
      const restoreButton = document.createElement("button");
      const category = ctx.getCategory(entry.task.categoryId);

      node.className = "archive-item";
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
      restoreButton.addEventListener("click", () => {
        const undo = ctx.createUndoSnapshot();
        entry.task.completed[entry.dateKey] = false;
        ctx.saveState();
        ctx.render();
        ctx.showToast("Задача возвращена в план", { undo });
      });
      content.append(title, meta);
      node.append(content, restoreButton);

      return node;
    }

    function appendArchiveMeta(meta, value) {
      if (meta.childNodes.length) meta.append(document.createTextNode(" · "));
      if (value instanceof Node) {
        meta.appendChild(value);
      } else {
        meta.append(document.createTextNode(value));
      }
    }
    return { createArchiveNode, renderArchive };
  }

  const api = { createArchiveView };
  global.RhythmArchiveView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
