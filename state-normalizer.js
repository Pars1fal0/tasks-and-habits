(function (global) {
  function createStateNormalizer(config) {
    function normalizeState(raw) {
      const normalized = {
        schemaVersion: config.schemaVersion,
        tasks: [],
        habits: [],
        goals: [],
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
            const startTime = config.cleanTimeValue(task.startTime);
            const endTime = config.cleanTimeValue(task.endTime);
            const hasBlock = isValidTimeBlock(startTime, endTime);
            const normalizedTime = hasBlock ? endTime : time;
            const categoryId = normalized.categories.some((category) => category.id === task.categoryId)
              ? task.categoryId
              : ensureCategory(task.category);

            return {
              id: task.id || config.createId(),
              title: config.cleanText(task.title) || "Задача",
              date: config.normalizeDateKey(task.date),
              time: normalizedTime,
              scheduleMode: hasBlock ? "block" : "deadline",
              startTime: hasBlock ? startTime : "",
              endTime: hasBlock ? endTime : "",
              categoryId,
              priority: config.validPriorities.includes(task.priority) ? task.priority : "medium",
              repeat: config.recurrence.normalizeRepeat(task.repeat),
              repeatUntil: config.normalizeDateKey(task.repeatUntil, ""),
              sourceTaskId: config.cleanText(task.sourceTaskId),
              movedFromDate: config.normalizeDateKey(task.movedFromDate, ""),
              customRepeat: config.recurrence.normalizeCustomRepeat(task.customRepeat),
              reminderOffset: config.normalizeReminderOffset(task.reminderOffset, Boolean(normalizedTime)),
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

      normalized.goals = Array.isArray(raw.goals)
        ? raw.goals.map((goal) => {
            const createdAt = goal.createdAt || new Date().toISOString();
            const status = goal.status === "done" || goal.completed === true ? "done" : "active";
            return {
              id: goal.id || config.createId(),
              title: config.cleanText(goal.title) || "Цель",
              description: config.cleanText(goal.description),
              measure: config.cleanText(goal.measure),
              reality: config.cleanText(goal.reality),
              why: config.cleanText(goal.why),
              dueDate: config.normalizeDateKey(goal.dueDate),
              taskIds: normalizeGoalTaskIds(goal.taskIds),
              steps: normalizeGoalSteps(goal.steps, config),
              status,
              completedAt: status === "done" ? goal.completedAt || new Date().toISOString() : "",
              createdAt,
            };
          })
        : [];

      const validTaskIds = new Set(normalized.tasks.map((task) => task.id));
      normalized.goals.forEach((goal) => {
        goal.taskIds = goal.taskIds.filter((taskId) => validTaskIds.has(taskId));
      });

      normalized.taskOrder = config.normalizeTaskOrder(raw.taskOrder);
      return normalized;
    }

    return { normalizeState };
  }

  function isValidTimeBlock(startTime, endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  }

  function timeToMinutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return NaN;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function normalizeGoalSteps(value, config) {
    if (!Array.isArray(value)) return [];
    return value
      .map((step) => ({
        id: step?.id || config.createId(),
        title: config.cleanText(step?.title || step),
        done: step?.done === true,
      }))
      .filter((step) => step.title);
  }

  function normalizeGoalTaskIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((id) => String(id || "").trim()).filter(Boolean))];
  }

  const api = { createStateNormalizer };
  global.RhythmStateNormalizer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
