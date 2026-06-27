(function (global) {
  function createNotifications(ctx) {
    function checkDueNotifications() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();

      ctx.getState().tasks.forEach((task) => {
        const dates = candidateReminderDates(task, now);
        dates.forEach((dateKey) => {
          const reminderAt = getReminderDate(task, dateKey);
          if (!reminderAt || reminderAt > now || ctx.isTaskDone(task, dateKey) || task.notified?.[dateKey]) return;
          task.notified[dateKey] = true;
          new Notification("Ритм дня", {
            body: task.title,
            tag: `${task.id}-${dateKey}`,
          });
          ctx.saveState();
        });
      });
    }

    async function requestNotifications() {
      if (window.rhythmDesktop) {
        await window.rhythmDesktop.showTestNotification();
        updateNotificationButton("granted");
        ctx.showToast("Фоновые напоминания активны");
        return;
      }

      if (!("Notification" in window)) {
        ctx.els.notifyButton.textContent = "Не поддерживаются";
        return;
      }

      const permission = await Notification.requestPermission();
      updateNotificationButton(permission);
    }

    function updateNotificationButton(permission = "Notification" in window ? Notification.permission : "default") {
      if (window.rhythmDesktop) {
        ctx.els.notifyButton.innerHTML = `${ctx.icon("bell")}Фон включен`;
        ctx.els.desktopStatus.textContent = "Закрытое окно останется в фоне";
        return;
      }
      ctx.els.notifyButton.innerHTML =
        permission === "granted" ? `${ctx.icon("bell")}Уведомления включены` : `${ctx.icon("bell")}Уведомления`;
    }

    function syncDesktopReminders() {
      if (!window.rhythmDesktop?.syncReminders) return;

      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 1);
      const reminders = [];

      for (let i = 0; i < 62; i += 1) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        const dateKey = ctx.toDateKey(current);
        ctx.tasksForDate(dateKey).forEach((task) => {
          const reminderAt = getReminderDate(task, dateKey);
          if (!reminderAt || ctx.isTaskDone(task, dateKey)) return;
          const dueAt = getDueDate(task, dateKey);
          reminders.push({
            id: `${task.id}-${dateKey}`,
            taskId: task.id,
            title: task.title,
            dateKey,
            dueAt: dueAt.toISOString(),
            reminderAt: reminderAt.toISOString(),
            category: ctx.getCategory(task.categoryId)?.name || "",
            priority: task.priority,
          });
        });
      }

      window.rhythmDesktop.syncReminders({ generatedAt: now.toISOString(), reminders });
    }

    function candidateReminderDates(task, now) {
      const dates = [];
      for (let offset = -1; offset <= 1; offset += 1) {
        const date = new Date(now);
        date.setDate(now.getDate() + offset);
        const dateKey = ctx.toDateKey(date);
        if (ctx.taskOccursOn(task, dateKey)) dates.push(dateKey);
      }
      return dates;
    }

    function getDueDate(task, dateKey) {
      const [hours, minutes] = (ctx.cleanTimeValue(task.time) || "09:00").split(":").map(Number);
      const date = ctx.parseDate(dateKey);
      date.setHours(hours || 0, minutes || 0, 0, 0);
      return date;
    }

    function getTaskDeadlineDate(task, dateKey) {
      const date = ctx.parseDate(dateKey);
      const time = ctx.cleanTimeValue(task.time);
      if (!time) {
        date.setHours(23, 59, 59, 999);
        return date;
      }

      const [hours, minutes] = time.split(":").map(Number);
      date.setHours(hours, minutes, 0, 0);
      return date;
    }

    function getReminderDate(task, dateKey) {
      if (!task.time || task.reminderOffset === "none") return null;
      const offset = Number(task.reminderOffset || 0);
      if (!Number.isFinite(offset)) return null;
      const due = getDueDate(task, dateKey);
      const reminder = new Date(due);
      reminder.setMinutes(due.getMinutes() - offset);
      return reminder;
    }

    return {
      candidateReminderDates,
      checkDueNotifications,
      getDueDate,
      getReminderDate,
      getTaskDeadlineDate,
      requestNotifications,
      syncDesktopReminders,
      updateNotificationButton,
    };
  }

  global.RhythmNotifications = { createNotifications };
})(window);
