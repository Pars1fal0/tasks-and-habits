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

      assert.deepEqual(config.wake_phrases, ["кодекс работай", "кодекс работать", "кодекс слушай"]);
      assert.equal(config.send_phrase, "отправь");
      assert.deepEqual(config.send_phrases, ["отправить", "отправляй"]);
      assert.equal(config.auto_send_enabled, false);
      assert.equal(config.auto_send_seconds, 2);
      assert.match(source, /RawInputStream/);
      assert.match(source, /command_timeout_seconds/);
      assert.match(source, /split_send_phrase/);
      assert.match(source, /should_auto_send/);
      assert.match(source, /auto_send_enabled/);
      assert.match(source, /DEFAULT_SEND_PHRASES/);
      assert.doesNotMatch(source, /requests|urllib/);
      const control = fs.readFileSync(path.join(root, "codex_control.py"), "utf8");
      assert.match(control, /composer_point/);
      assert.match(control, /send_unicode_text/);
      assert.match(control, /candidate_score/);
      assert.match(control, /is_cloaked_window/);
      assert.match(control, /wait_until_active/);
      assert.match(control, /SW_MAXIMIZE/);
      assert.doesNotMatch(control, /pywinauto|comtypes/i);
      assert.doesNotMatch(control, /clipboard/i);
      const startScript = fs.readFileSync(path.join(root, "start.ps1"), "utf8");
      assert.match(startScript, /import sounddevice, vosk, win32gui/);
      assert.match(startScript, /Run install\.ps1 again/);
      const installScript = fs.readFileSync(path.join(root, "install.ps1"), "utf8");
      assert.match(installScript, /AddSeconds\(15\)/);
      assert.match(installScript, /Start-Sleep -Milliseconds 500/);
    },
  },
];
