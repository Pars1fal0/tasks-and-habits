(function (global) {
  function createStateNormalizer(config) {
    function normalizeState(raw) {
      const normalized = {
        schemaVersion: config.schemaVersion,
        tasks: [],
        habits: [],
        categories: [],
        taskOrder: {},
      };

      if (!raw || typeof raw !== "object") return normalized;

      normalized.categories = Array.isArray(raw.categories)
        ? raw.categories.map((category) => ({
            id: category.id || config.createId(),
            name: config.cleanText(category.name) || "Категория",
            color: config.sanitizeColor(category.color) || config.randomCategoryColor(),
            createdAt: category.createdAt || new Date().toISOString(),
          }))
        : [];

      const ensureCategory = (name) => {
        const categoryName = config.cleanText(name);
        if (!categoryName) return "";
        const existing = normalized.categories.find(
          (category) => category.name.toLowerCase() === categoryName.toLowerCase(),
        );
        if (existing) return existing.id;
        const category = {
          id: config.createId(),
          name: categoryName,
          color: config.randomCategoryColor(),
          createdAt: new Date().toISOString(),
        };
        normalized.categories.push(category);
        return category.id;
      };

      normalized.tasks = Array.isArray(raw.tasks)
        ? raw.tasks.map((task) => {
            const time = config.cleanTimeValue(task.time);
            const categoryId = normalized.categories.some((category) => category.id === task.categoryId)
              ? task.categoryId
              : ensureCategory(task.category);

            return {
              id: task.id || config.createId(),
              title: config.cleanText(task.title) || "Задача",
              date: config.normalizeDateKey(task.date),
              time,
              categoryId,
              priority: config.validPriorities.includes(task.priority) ? task.priority : "medium",
              repeat: config.recurrence.normalizeRepeat(task.repeat),
              customRepeat: config.recurrence.normalizeCustomRepeat(task.customRepeat),
              reminderOffset: config.normalizeReminderOffset(task.reminderOffset, Boolean(time)),
              completed: config.normalizeTaskFlags(task.completed),
              excludedDates: config.normalizeTaskFlags(task.excludedDates),
              notified: config.normalizeTaskFlags(task.notified),
              createdAt: task.createdAt || new Date().toISOString(),
            };
          })
        : [];

      normalized.habits = Array.isArray(raw.habits)
        ? raw.habits.map((habit) => {
            const type = habit.type === "number" ? "number" : "check";
            return {
              id: habit.id || config.createId(),
              title: config.cleanText(habit.title) || "Привычка",
              type,
              repeat: config.normalizeHabitRepeat(habit.repeat),
              customRepeat: config.recurrence.normalizeCustomRepeat(habit.customRepeat),
              startDate: config.normalizeDateKey(habit.startDate, config.toDateKey(new Date(habit.createdAt || Date.now()))),
              unit: config.cleanText(habit.unit),
              goal: Math.max(1, Number(habit.goal || 1)),
              logs: config.normalizeHabitLogs(habit.logs, type),
              createdAt: habit.createdAt || new Date().toISOString(),
            };
          })
        : [];

      normalized.taskOrder = config.normalizeTaskOrder(raw.taskOrder);
      return normalized;
    }

    return { normalizeState };
  }

  const api = { createStateNormalizer };
  global.RhythmStateNormalizer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
