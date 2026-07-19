const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = [
  {
    name: "MCP worker advertises protected read and write tools",
    fn() {
      const source = fs.readFileSync(path.resolve(__dirname, "../mcp/worker.mjs"), "utf8");
      const toolNames = [...source.matchAll(/server\.registerTool\(\s*"([^"]+)"/g)].map((match) => match[1]);

      assert.deepEqual(toolNames, ["get_today_overview", "search", "fetch", "create_task", "complete_task"]);
      assert.match(source, /securitySchemes:\s*OAUTH_SECURITY/g);
      assert.match(source, /annotations:\s*\{\s*readOnlyHint:\s*true,\s*openWorldHint:\s*false,\s*destructiveHint:\s*false\s*\}/);
      assert.match(source, /annotations:\s*\{\s*readOnlyHint:\s*false,\s*openWorldHint:\s*false,\s*destructiveHint:\s*false\s*\}/);
      assert.equal(source.includes('server.registerTool(\n    "delete'), false);
    },
  },
];
