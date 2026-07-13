const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceFiles = fs
  .readdirSync(root)
  .filter((file) => file.endsWith(".js"))
  .map((file) => path.join(root, file));
const testFiles = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".cjs"))
  .map((file) => path.join(__dirname, file));

const forbidden = [
  { pattern: /\binnerHTML\b/, label: "innerHTML" },
  { pattern: /\bwindow\.confirm\b/, label: "window.confirm" },
  { pattern: /\balert\s*\(/, label: "alert()" },
  { pattern: /\bprompt\s*\(/, label: "prompt()" },
];

sourceFiles.forEach((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  forbidden.forEach((rule) => {
    assert.equal(rule.pattern.test(source), false, `${path.basename(filePath)} contains forbidden ${rule.label}`);
  });
});

[...sourceFiles, ...testFiles].forEach((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  assert.doesNotThrow(() => new Function(source), `${path.relative(root, filePath)} has invalid JavaScript syntax`);
});

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scriptSources = [...indexHtml.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1].split("?")[0]);
scriptSources.forEach((scriptSource) => {
  assert.equal(fs.existsSync(path.join(root, scriptSource)), true, `Missing script referenced by index.html: ${scriptSource}`);
});

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packagedFiles = new Set(packageJson.build?.files || []);
["device-sync-controller.js", "form-dialog.js", "goal-checkpoint-editor.js", "remote-auth.js", "remote-auth-controller.js", "settings-state.js", "settings-sync.js", "timeline-drag.js", "timeline-layout.js", "timeline-menu.js"].forEach((file) => {
  assert.equal(packagedFiles.has(file), true, `package.json build.files is missing ${file}`);
});

console.log(`lint ok - ${sourceFiles.length} source files, ${testFiles.length} test files`);
