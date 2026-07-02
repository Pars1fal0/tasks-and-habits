const assert = require("node:assert/strict");
const { installDom } = require("./dom-test-utils.cjs");

function loadDomModules() {
  installDom();
  global.RhythmHeatmapView = { createHeatmapView: () => ({ renderHeatmap() {} }) };
  delete require.cache[require.resolve("../archive-view.js")];
  delete require.cache[require.resolve("../calendar-view.js")];
  delete require.cache[require.resolve("../categories.js")];
  delete require.cache[require.resolve("../habits-view.js")];
  const archive = require("../archive-view.js");
  const calendar = require("../calendar-view.js");
  require("../categories.js");
  const habits = require("../habits-view.js");
  return { archive, calendar, categories: global.RhythmCategories, habits };
}

function createHabitTemplate() {
  const template = document.createElement("template");
  const article = document.createElement("article");
  const title = document.createElement("h3");
  const streak = document.createElement("p");
  const control = document.createElement("div");
  const edit = document.createElement("button");
  const remove = document.createElement("button");
  streak.className = "habit-streak";
  control.className = "habit-control";
  edit.className = "edit-habit";
  remove.className = "delete-habit";
  article.append(title, streak, control, edit, remove);
  template.content.appendChild(article);
  return template;
}

module.exports = [
  {
    name: "renders archive item without innerHTML",
    fn() {
      const { archive } = loadDomModules();
      const view = archive.createArchiveView({
        createUndoSnapshot: () => ({}),
        formatLongDate: (dateKey) => `date:${dateKey}`,
        getCategory: () => ({ color: "#34d399", name: "Work" }),
        priorityLabels: { high: "High" },
        render() {},
        saveState() {},
        showToast() {},
      });
      const node = view.createArchiveNode({
        dateKey: "2026-07-02",
        task: { categoryId: "work", completed: {}, priority: "high", title: "Call doctor" },
      });

      assert.equal(node.classList.contains("archive-item"), true);
      assert.equal(node.querySelector("h3").textContent, "Call doctor");
      assert.equal(node.querySelector(".category-dot").style.values["--category-color"], "#34d399");
      assert.equal(node.querySelector(".restore-task").textContent, "Вернуть");
    },
  },
  {
    name: "renders category item without innerHTML",
    fn() {
      const { categories } = loadDomModules();
      const els = {
        archiveCategoryFilter: document.createElement("select"),
        categoryList: document.createElement("div"),
        taskCategoryFilter: document.createElement("select"),
        taskCategoryId: document.createElement("select"),
      };
      const controller = categories.createCategories({
        cleanText: (value) => String(value).trim(),
        confirmAction: async () => true,
        createUndoSnapshot: () => ({}),
        els,
        getArchiveCategoryFilter: () => "all",
        getState: () => ({ categories: [{ color: "#38bdf8", id: "work", name: "Work" }], tasks: [] }),
        getTaskCategoryFilter: () => "all",
        saveUiState() {},
        setArchiveCategoryFilter() {},
        setTaskCategoryFilter() {},
        showToast() {},
      });

      controller.renderCategories();

      const item = els.categoryList.querySelector(".category-item");
      assert.ok(item);
      assert.equal(item.textContent.includes("Work"), true);
      assert.equal(item.querySelector(".category-dot").style.values["--category-color"], "#38bdf8");
      assert.equal(item.querySelector("button").getAttribute("aria-label"), "Удалить категорию");
    },
  },
  {
    name: "renders habit number control without innerHTML",
    fn() {
      const { habits } = loadDomModules();
      const view = habits.createHabitsView({
        createUndoSnapshot: () => ({}),
        deleteHabit() {},
        els: { habitTemplate: createHabitTemplate() },
        fillHabitForm() {},
        formatHabitRepeat: () => "daily",
        getActiveDate: () => "2026-07-02",
        habitStreak: () => 4,
        render() {},
        renderDailyPulse() {},
        renderOverview() {},
        saveState() {},
        showToast() {},
      });
      const node = view.createHabitNode({
        goal: 8,
        id: "habit-1",
        logs: { "2026-07-02": 4 },
        title: "Water",
        type: "number",
        unit: "cups",
      });

      assert.equal(node.querySelector("h3").textContent, "Water");
      assert.equal(node.querySelector("input").value, "4");
      assert.equal(node.querySelector(".progress-fill").style.values.width, "50%");
      assert.equal(node.querySelector(".habit-number-row").textContent.includes("4 / 8 cups"), true);
    },
  },
  {
    name: "renders month and week calendar task chips without innerHTML",
    fn() {
      const { calendar } = loadDomModules();
      const task = { categoryId: "work", id: "task-1", priority: "high", title: "Design review" };
      let attachedDragCount = 0;
      const els = {
        monthGrid: document.createElement("div"),
        monthLabel: document.createElement("span"),
        weekBoardGrid: document.createElement("div"),
        weekBoardLabel: document.createElement("span"),
      };
      const view = calendar.createCalendarView({
        attachTaskChipDrag: () => {
          attachedDragCount += 1;
        },
        attachTaskDropZone() {},
        els,
        formatLongDate: (dateKey) => dateKey,
        formatMonthLabel: () => "July 2026",
        formatShortDate: (dateKey) => dateKey.slice(5),
        formatWeekday: () => "Пн",
        getActiveDate: () => "2026-07-02",
        getCategory: () => ({ color: "#34d399", name: "Work" }),
        getMonthCalendarDates: () => ["2026-07-02"],
        getOrderedTasksForDate: () => [task, { ...task, id: "task-2" }, { ...task, id: "task-3" }, { ...task, id: "task-4" }],
        habitsForDate: () => [],
        isTaskDone: () => false,
        openDateTasks() {},
        parseDate: (dateKey) => {
          const [year, month, day] = dateKey.split("-").map(Number);
          return new Date(year, month - 1, day);
        },
        priorityLabels: { high: "High" },
        toDateKey: () => "2026-07-02",
      });

      view.renderMonthCalendar();
      view.renderWeekBoard(["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"]);

      assert.equal(els.monthGrid.querySelector(".month-task-chip").textContent, "Design review");
      assert.equal(els.monthGrid.querySelector(".month-day-more").textContent, "+1");
      assert.equal(els.weekBoardGrid.querySelector(".week-task-chip").textContent.includes("Design review"), true);
      assert.ok(attachedDragCount >= 2);
    },
  },
];
