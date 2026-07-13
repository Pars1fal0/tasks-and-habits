const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = [
  {
    name: "keeps the voice assistant isolated and configurable",
    fn() {
      const root = path.join(__dirname, "..", "voice-assistant");
      const config = JSON.parse(fs.readFileSync(path.join(root, "config.example.json"), "utf8"));
      const source = fs.readFileSync(path.join(root, "assistant.py"), "utf8");

      assert.deepEqual(config.wake_phrases, ["кодекс работай", "кодекс слушай"]);
      assert.equal(config.send_phrase, "отправь");
      assert.match(source, /RawInputStream/);
      assert.match(source, /command_timeout_seconds/);
      assert.doesNotMatch(source, /requests|urllib/);
      const control = fs.readFileSync(path.join(root, "codex_control.py"), "utf8");
      assert.match(control, /composer_point/);
      assert.match(control, /send_unicode_text/);
      assert.doesNotMatch(control, /pywinauto|comtypes/i);
      assert.doesNotMatch(control, /clipboard/i);
    },
  },
];
