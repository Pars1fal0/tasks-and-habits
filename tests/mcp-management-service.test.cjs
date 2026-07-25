const assert = require("node:assert/strict");

async function loadServices() {
  const [taskService, managementService, writeService, activityService] = await Promise.all([
    import("../mcp/task-service.mjs"),
    import("../mcp/management-service.mjs"),
    import("../mcp/write-service.mjs"),
    import("../mcp/activity-service.mjs"),
  ]);
  return { taskService, managementService, writeService, activityService };
}

function task(overrides = {}) {
  return {
    id: "task-1",
    title: "Подготовить отчет",
    date: "2026-07-20",
    time: "",
    scheduleMode: "none",
    startTime: "",
    endTime: "",
    categoryId: "",
    priority: "high",
    repeat: "none",
    repeatUntil: "",
    customRepeat: {},
    reminderOffset: "none",
    completed: {},
    acknowledgedOverdue: {},
    excludedDates: {},
    notified: {},
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-20T08:00:00.000Z",
    ...overrides,
  };
}

module.exports = [
  {
    name: "MCP calendar range and productivity stats include recurring activity",
    async fn() {
      const { taskService, managementService } = await loadServices();
      const state = taskService.createEmptyState();
      state.tasks.push(task({
        repeat: "daily",
        completed: { "2026-07-21": true },
      }));
      const calendar = managementService.getCalendarRange(state, {
        from: "2026-07-20",
        to: "2026-07-22",
      });
      const stats = managementService.getProductivityStats(state, {
        from: "2026-07-20",
        to: "2026-07-22",
      });

      assert.equal(calendar.days.length, 3);
      assert.equal(calendar.summary.tasks, 3);
      assert.equal(stats.tasksTotal, 3);
      assert.equal(stats.tasksCompleted, 1);
      assert.equal(stats.taskCompletionRate, 33);
    },
  },
  {
    name: "MCP backlog excludes completed and acknowledged occurrences",
    async fn() {
      const { taskService, managementService } = await loadServices();
      const state = taskService.createEmptyState();
      state.tasks.push(task({
        repeat: "daily",
        completed: { "2026-07-22": true },
        acknowledgedOverdue: { "2026-07-23": true },
      }));
      const backlog = managementService.getBacklog(state, {
        before: "2026-07-25",
        days: 5,
      });

      assert.deepEqual(backlog.entries.map((entry) => entry.date), ["2026-07-24", "2026-07-21", "2026-07-20"]);
    },
  },
  {
    name: "MCP habit edits preserve old dated configuration and title",
    async fn() {
      const { taskService, managementService } = await loadServices();
      const state = taskService.createEmptyState();
      const created = managementService.createHabitCommand(state, {
        requestId: "habit-create-2026",
        title: "Вода",
        startDate: "2026-07-20",
        type: "number",
        goal: 8,
        unit: "стаканов",
      }, { now: "2026-07-20T09:00:00.000Z", today: "2026-07-20" });
      const updated = managementService.updateHabitCommand(created.state, {
        requestId: "habit-update-2026",
        habitId: created.habit.id,
        fromDate: "2026-07-25",
        title: "Пить воду",
        goal: 10,
      }, { now: "2026-07-25T09:00:00.000Z", today: "2026-07-25" });

      assert.equal(updated.habit.titleHistory[0].title, "Вода");
      assert.equal(updated.habit.titleHistory[1].title, "Пить воду");
      assert.equal(updated.habit.configHistory[0].goal, 8);
      assert.equal(updated.habit.configHistory[1].goal, 10);
    },
  },
  {
    name: "MCP habit creation is idempotent even after the action was undone",
    async fn() {
      const { taskService, managementService, writeService } = await loadServices();
      const state = taskService.createEmptyState();
      const input = {
        requestId: "habit-idempotent-1",
        title: "Медитация",
        startDate: "2026-07-25",
      };
      const created = managementService.createHabitCommand(state, input, {
        now: "2026-07-25T09:00:00.000Z",
        today: "2026-07-25",
      });
      const undone = writeService.undoMcpCommand(created.state, {
        actionId: created.activity.id,
      }, { now: "2026-07-25T09:05:00.000Z" });
      const retry = managementService.createHabitCommand(undone.state, input, {
        now: "2026-07-25T09:06:00.000Z",
        today: "2026-07-25",
      });

      assert.equal(retry.changed, false);
      assert.equal(retry.state.habits.length, 0);
    },
  },
  {
    name: "MCP duplicates one recurring occurrence without lowering priority",
    async fn() {
      const { taskService, managementService } = await loadServices();
      const state = taskService.createEmptyState();
      state.tasks.push(task({ repeat: "daily" }));
      assert.throws(
        () => managementService.duplicateTaskCommand(state, {
          requestId: "duplicate-no-mode",
          taskId: "task-1",
          occurrenceDate: "2026-07-25",
        }),
        /copyMode/,
      );
      const result = managementService.duplicateTaskCommand(state, {
        requestId: "duplicate-one-day",
        taskId: "task-1",
        occurrenceDate: "2026-07-25",
        date: "2026-07-26",
        copyMode: "occurrence",
      }, { now: "2026-07-25T10:00:00.000Z" });

      assert.equal(result.task.repeat, "none");
      assert.equal(result.task.date, "2026-07-26");
      assert.equal(result.task.priority, "high");
    },
  },
  {
    name: "MCP acknowledges an overdue occurrence without completing it",
    async fn() {
      const { taskService, managementService } = await loadServices();
      const state = taskService.createEmptyState();
      state.tasks.push(task());
      const result = managementService.acknowledgeOverdueCommand(state, {
        requestId: "ack-overdue-2026",
        taskId: "task-1",
        date: "2026-07-20",
      }, { now: "2026-07-25T10:00:00.000Z" });

      assert.equal(result.task.acknowledgedOverdue["2026-07-20"], true);
      assert.equal(result.task.completed["2026-07-20"], undefined);
    },
  },
  {
    name: "MCP category deletion migrates tasks and undo restores a usable category",
    async fn() {
      const { taskService, managementService, writeService } = await loadServices();
      const state = taskService.createEmptyState();
      state.categories.push(
        { id: "old", name: "Старое", color: "#ff0000" },
        { id: "new", name: "Новое", color: "#00ff00" },
      );
      state.tasks.push(task({ categoryId: "old" }));
      const deleted = managementService.deleteCategoryCommand(state, {
        requestId: "delete-category-1",
        categoryId: "old",
        replacementCategoryId: "new",
        confirm: true,
      }, { now: "2026-07-25T10:00:00.000Z" });
      assert.equal(deleted.state.tasks[0].categoryId, "new");

      const undone = writeService.undoMcpCommand(deleted.state, {
        actionId: deleted.activity.id,
      }, { now: "2026-07-25T10:05:00.000Z" });
      const restored = undone.state.categories.find((category) => category.name === "Старое");
      assert.ok(restored);
      assert.notEqual(restored.id, "old");
      assert.equal(undone.state.tasks[0].categoryId, restored.id);
      assert.ok(undone.state.tombstones.categories.old);
    },
  },
  {
    name: "MCP goal deletion requires confirmation and remains undoable across sync",
    async fn() {
      const { taskService, managementService, writeService } = await loadServices();
      const state = taskService.createEmptyState();
      state.goals.push({
        id: "goal-1",
        title: "Запустить проект",
        dueDate: "2026-08-01",
        steps: [],
        status: "active",
      });
      assert.throws(
        () => managementService.deleteGoalCommand(state, {
          requestId: "delete-goal-no",
          goalId: "goal-1",
          confirm: false,
        }),
        /confirm: true/,
      );
      const deleted = managementService.deleteGoalCommand(state, {
        requestId: "delete-goal-yes",
        goalId: "goal-1",
        confirm: true,
      }, { now: "2026-07-25T10:00:00.000Z" });
      const undone = writeService.undoMcpCommand(deleted.state, {
        actionId: deleted.activity.id,
      }, { now: "2026-07-25T10:05:00.000Z" });

      assert.equal(undone.state.goals.length, 1);
      assert.notEqual(undone.state.goals[0].id, "goal-1");
      assert.ok(undone.state.tombstones.goals["goal-1"]);
    },
  },
  {
    name: "MCP previews and atomically applies a task plan with one undo action",
    async fn() {
      const { taskService, managementService, activityService } = await loadServices();
      const state = taskService.createEmptyState();
      state.tasks.push({
        id: "plan-task",
        title: "Plan task",
        date: "2026-07-25",
        priority: "high",
        repeat: "none",
        completed: {},
        excludedDates: {},
      });
      const operations = [{
        taskId: "plan-task",
        date: "2026-07-27",
        scheduleMode: "block",
        startTime: "10:00",
        endTime: "10:30",
      }];
      const preview = managementService.previewTaskPlan(state, { operations });
      assert.equal(state.tasks[0].date, "2026-07-25");
      assert.equal(preview.operations[0].date, "2026-07-27");

      const applied = managementService.applyTaskPlanCommand(state, {
        requestId: "weekly-plan-apply",
        operations,
        confirm: true,
      }, { now: "2026-07-25T10:00:00.000Z" });
      assert.equal(applied.state.tasks[0].date, "2026-07-27");
      assert.equal(applied.state.mcpActivity.length, 1);

      const undone = activityService.undoMcpActivity(
        applied.state,
        applied.activity.id,
        "2026-07-25T10:01:00.000Z",
      );
      assert.equal(undone.state.tasks[0].date, "2026-07-25");
    },
  },
];
