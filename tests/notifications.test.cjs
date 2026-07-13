const assert = require("node:assert/strict");
const { createNotifications } = require("../notifications.js");

function createController() {
  return createNotifications({
    cleanTimeValue(value) {
      return /^\d{2}:\d{2}$/.test(String(value || "")) ? value : "";
    },
    parseDate(dateKey) {
      const [year, month, day] = dateKey.split("-").map(Number);
      return new Date(year, month - 1, day);
    },
  });
}

module.exports = [
  {
    name: "uses a time block start for its reminder",
    fn() {
      const reminder = createController().getReminderDate(
        { scheduleMode: "block", startTime: "14:00", time: "15:30", reminderOffset: "15" },
        "2026-07-13",
      );
      assert.equal(reminder.getHours(), 13);
      assert.equal(reminder.getMinutes(), 45);
    },
  },
  {
    name: "uses a deadline time for a deadline reminder",
    fn() {
      const reminder = createController().getReminderDate(
        { scheduleMode: "deadline", time: "10:00", reminderOffset: "30" },
        "2026-07-13",
      );
      assert.equal(reminder.getHours(), 9);
      assert.equal(reminder.getMinutes(), 30);
    },
  },
];
