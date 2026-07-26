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
      assert.match(sql, /create table if not exists public\.rhythm_state_snapshots/);
      assert.match(sql, /summary jsonb not null default '\{\}'::jsonb/);
      assert.match(sql, /jsonb_build_object\(/);
      assert.match(sql, /create trigger rhythm_states_snapshot/);
      assert.match(sql, /delete_parsitasks_account/);
      assert.match(sql, /insert into storage\.buckets/);
      assert.match(sql, /'board-images'/);
      assert.match(sql, /board_images_select_own/);
      assert.match(sql, /storage\.foldername\(name\).*auth\.uid\(\)/s);
      assert.match(sql, /'boardItems'.*old\.state -> 'boardItems'/s);
    },
  },
];
