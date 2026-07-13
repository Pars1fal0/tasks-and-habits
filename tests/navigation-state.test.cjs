const assert = require("node:assert/strict");
const { buildHash, parseHash } = require("../navigation-state.js");

module.exports = [
  {
    name: "maps application views to stable URL hashes",
    fn() {
      assert.equal(buildHash("tasks", "week"), "#tasks");
      assert.equal(buildHash("timeline", "week"), "#timeline");
      assert.equal(buildHash("overview", "month"), "#calendar/month");
      assert.deepEqual(parseHash("#calendar/year"), { view: "overview", overviewMode: "year" });
      assert.deepEqual(parseHash("#/habits"), { view: "habits", overviewMode: null });
      assert.equal(parseHash("#unknown"), null);
    },
  },
];
