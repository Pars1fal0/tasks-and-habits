const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = [
  {
    name: "pre-caches every script required by the application shell",
    fn() {
      const root = path.resolve(__dirname, "..");
      const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
      const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
      const scripts = [...html.matchAll(/<script src="([^"?]+)(?:\?[^" ]*)?"/g)].map((match) => match[1]);
      scripts.forEach((script) => assert.match(serviceWorker, new RegExp(`"${script.replace(".", "\\.")}"`), `${script} is missing from APP_SHELL`));
    },
  },
  {
    name: "web build replaces the service worker cache placeholder",
    fn() {
      const root = path.resolve(__dirname, "..");
      const buildScript = fs.readFileSync(path.join(root, "scripts", "build-web.cjs"), "utf8");
      assert.match(buildScript, /replaceAll\("__BUILD_HASH__", buildHash\)/);
      assert.match(buildScript, /createHash\("sha256"\)/);
    },
  },
];
