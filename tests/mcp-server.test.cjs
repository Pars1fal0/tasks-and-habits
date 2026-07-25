const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = [
  {
    name: "MCP worker advertises protected read and write tools",
    fn() {
      const source = fs.readFileSync(path.resolve(__dirname, "../mcp/worker.mjs"), "utf8");
      const managementSource = fs.readFileSync(path.resolve(__dirname, "../mcp/management-tools.mjs"), "utf8");
      const promptsSource = fs.readFileSync(path.resolve(__dirname, "../mcp/prompts.mjs"), "utf8");
      const toolNames = [...`${source}\n${managementSource}`.matchAll(/server\.registerTool\(\s*"([^"]+)"/g)]
        .map((match) => match[1]);

      assert.deepEqual(toolNames, [
        "get_today_overview",
        "get_journal_entry",
        "append_journal_entry",
        "search",
        "fetch",
        "create_task",
        "complete_task",
        "update_task",
        "delete_task",
        "set_habit_value",
        "create_goal",
        "update_goal_checkpoint",
        "get_day_brief",
        "list_mcp_activity",
        "undo_mcp_action",
        "get_calendar_range",
        "get_backlog",
        "get_productivity_stats",
        "list_categories",
        "preview_task_plan",
        "apply_task_plan",
        "create_habit",
        "update_habit",
        "set_habit_active",
        "update_goal",
        "delete_goal",
        "duplicate_task",
        "acknowledge_overdue",
        "upsert_category",
        "delete_category",
      ]);
      assert.match(source, /securitySchemes:\s*OAUTH_SECURITY/g);
      assert.match(source, /annotations:\s*\{\s*readOnlyHint:\s*true,\s*openWorldHint:\s*false,\s*destructiveHint:\s*false\s*\}/);
      assert.match(source, /annotations:\s*\{\s*readOnlyHint:\s*false,\s*openWorldHint:\s*false,\s*destructiveHint:\s*false\s*\}/);
      assert.match(source, /"delete_task"[\s\S]*confirm:\s*z\.boolean/);
      assert.match(source, /destructiveHint:\s*true/);
      assert.deepEqual(
        [...promptsSource.matchAll(/server\.registerPrompt\(\s*"([^"]+)"/g)].map((match) => match[1]),
        ["plan_week", "review_backlog", "monthly_review"],
      );
    },
  },
];
