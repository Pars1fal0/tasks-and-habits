const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = [
  {
    name: "allows state access only through authenticated RLS policies",
    fn() {
      const sql = fs.readFileSync(path.join(__dirname, "..", "supabase-schema.sql"), "utf8");
      assert.match(sql, /to authenticated/);
      assert.match(sql, /auth\.uid\(\).*user_id/s);
      assert.doesNotMatch(sql, /to anon/);
      assert.doesNotMatch(sql, /x-rhythm-user-key/);
    },
  },
];
