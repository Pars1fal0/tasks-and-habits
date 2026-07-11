const assert = require("node:assert/strict");
const { recurrence } = require("./test-utils.cjs");

module.exports = [
  {
    name: "stops a recurring series after its repeat-until date",
    fn() {
      const task = { date: "2026-07-01", repeat: "daily", repeatUntil: "2026-07-10" };
      assert.equal(recurrence.taskScheduledOn(task, "2026-07-10"), true);
      assert.equal(recurrence.taskScheduledOn(task, "2026-07-11"), false);
    },
  },
  {
    name: "custom weekday recurrence matches selected weekdays only",
    fn() {
      const task = {
        date: "2026-06-22",
        repeat: "custom",
        customRepeat: { type: "weekdays", weekdays: [1, 3, 5] },
      };

      assert.equal(recurrence.taskScheduledOn(task, "2026-06-24"), true);
      assert.equal(recurrence.taskScheduledOn(task, "2026-06-26"), true);
      assert.equal(recurrence.taskScheduledOn(task, "2026-06-27"), false);
      assert.equal(recurrence.repeatLabel(task), "По дням: ПН, СР, ПТ");
    },
  },
  {
    name: "custom month-day and interval recurrences are normalized",
    fn() {
      assert.equal(
        recurrence.taskScheduledOn(
          { date: "2026-01-01", repeat: "custom", customRepeat: { type: "monthDay", day: 15 } },
          "2026-02-15",
        ),
        true,
      );
      assert.equal(
        recurrence.taskScheduledOn(
          { date: "2026-01-01", repeat: "custom", customRepeat: { type: "monthDay", day: 15 } },
          "2026-02-14",
        ),
        false,
      );
      assert.equal(
        recurrence.taskScheduledOn(
          { date: "2026-06-01", repeat: "custom", customRepeat: { type: "interval", every: 5 } },
          "2026-06-06",
        ),
        true,
      );
      assert.deepEqual(recurrence.normalizeCustomRepeat({ type: "interval", every: 999 }), {
        type: "interval",
        every: 365,
      });
    },
  },
];
