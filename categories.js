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
        const dot = document.createElement("span");
        const name = document.createElement("span");
        const button = document.createElement("button");
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");

        item.className = "category-item";
        dot.className = "category-dot";
        dot.style.setProperty("--category-color", category.color);
        name.textContent = category.name;
        button.className = "icon-button subtle";
        button.type = "button";
        button.setAttribute("aria-label", "Удалить категорию");
        icon.classList.add("ui-icon");
        use.setAttribute("href", "#icon-trash");
        icon.appendChild(use);
        button.appendChild(icon);
        button.addEventListener("click", () => deleteCategory(category.id));
        item.append(dot, name, button);
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

    async function deleteCategory(categoryId) {
      const state = ctx.getState();
      const category = state.categories.find((item) => item.id === categoryId);
      const taskCount = state.tasks.filter((task) => task.categoryId === categoryId).length;
      const message = taskCount
        ? `Удалить категорию «${category?.name || "Без названия"}»? У ${taskCount} задач категория будет очищена.`
        : `Удалить категорию «${category?.name || "Без названия"}»?`;
      const confirmed = await ctx.confirmAction({
            confirmLabel: "Удалить",
            message,
            tone: "danger",
            title: "Удалить категорию?",
          });
      if (!confirmed) return;

      const undo = ctx.createUndoSnapshot();
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
