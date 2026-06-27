(function (global) {
  function createCategories(ctx) {
    function renderCategories() {
      ctx.els.taskCategoryId.replaceChildren();
      ctx.els.taskCategoryFilter.replaceChildren();
      ctx.els.archiveCategoryFilter.replaceChildren();

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Без категории";
      ctx.els.taskCategoryId.appendChild(emptyOption);

      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "Все категории";
      ctx.els.taskCategoryFilter.appendChild(allOption);

      const archiveAllOption = allOption.cloneNode(true);
      ctx.els.archiveCategoryFilter.appendChild(archiveAllOption);

      const uncategorizedOption = document.createElement("option");
      uncategorizedOption.value = "none";
      uncategorizedOption.textContent = "Без категории";
      ctx.els.taskCategoryFilter.appendChild(uncategorizedOption);

      const archiveUncategorizedOption = uncategorizedOption.cloneNode(true);
      ctx.els.archiveCategoryFilter.appendChild(archiveUncategorizedOption);

      const categories = [...ctx.getState().categories].sort((a, b) => a.name.localeCompare(b.name, "ru"));

      categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        ctx.els.taskCategoryId.appendChild(option);

        const filterOption = document.createElement("option");
        filterOption.value = category.id;
        filterOption.textContent = category.name;
        ctx.els.taskCategoryFilter.appendChild(filterOption);

        const archiveFilterOption = filterOption.cloneNode(true);
        ctx.els.archiveCategoryFilter.appendChild(archiveFilterOption);
      });

      const taskCategoryFilter = ctx.getTaskCategoryFilter();
      const archiveCategoryFilter = ctx.getArchiveCategoryFilter();
      const filterExists =
        taskCategoryFilter === "all" || taskCategoryFilter === "none" || categories.some((category) => category.id === taskCategoryFilter);
      if (!filterExists) {
        ctx.setTaskCategoryFilter("all");
        ctx.saveUiState();
      }
      const archiveFilterExists =
        archiveCategoryFilter === "all" ||
        archiveCategoryFilter === "none" ||
        categories.some((category) => category.id === archiveCategoryFilter);
      if (!archiveFilterExists) {
        ctx.setArchiveCategoryFilter("all");
        ctx.saveUiState();
      }
      ctx.els.taskCategoryFilter.value = ctx.getTaskCategoryFilter();
      ctx.els.archiveCategoryFilter.value = ctx.getArchiveCategoryFilter();

      ctx.els.categoryList.replaceChildren();
      categories.forEach((category) => {
        const item = document.createElement("div");
        item.className = "category-item";
        item.innerHTML = `
          <span class="category-dot" style="--category-color: ${ctx.escapeHtml(category.color)}"></span>
          <span>${ctx.escapeHtml(category.name)}</span>
          <button class="icon-button subtle" type="button" aria-label="Удалить категорию">
            <svg class="ui-icon"><use href="#icon-trash"></use></svg>
          </button>
        `;
        item.querySelector("button").addEventListener("click", () => deleteCategory(category.id));
        ctx.els.categoryList.appendChild(item);
      });
    }

    function saveCategoryFromForm(event) {
      event.preventDefault();
      const name = ctx.cleanText(ctx.els.categoryName.value);
      if (!name) return;
      const existing = ctx.getState().categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        ctx.showToast("Такая категория уже есть");
        return;
      }
      const undo = ctx.createUndoSnapshot();

      ctx.getState().categories.push({
        id: ctx.createId(),
        name,
        color: ctx.els.categoryColor.value || "#00a78e",
        createdAt: new Date().toISOString(),
      });
      ctx.els.categoryForm.reset();
      ctx.els.categoryColor.value = "#00a78e";
      ctx.saveState();
      renderCategories();
      ctx.showToast("Категория создана", { undo });
    }

    function deleteCategory(categoryId) {
      const undo = ctx.createUndoSnapshot();
      const state = ctx.getState();
      const hasTasks = state.tasks.some((task) => task.categoryId === categoryId);
      state.categories = state.categories.filter((category) => category.id !== categoryId);
      if (hasTasks) {
        state.tasks.forEach((task) => {
          if (task.categoryId === categoryId) task.categoryId = "";
        });
      }
      if (ctx.getTaskCategoryFilter() === categoryId) ctx.setTaskCategoryFilter("all");
      if (ctx.getArchiveCategoryFilter() === categoryId) ctx.setArchiveCategoryFilter("all");
      ctx.saveState();
      ctx.saveUiState();
      ctx.render();
      ctx.showToast("Категория удалена", { undo });
    }

    return {
      deleteCategory,
      renderCategories,
      saveCategoryFromForm,
    };
  }

  global.RhythmCategories = { createCategories };
})(window);
