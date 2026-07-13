const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "web-dist");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const shellSource = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1];

if (!shellSource) throw new Error("Unable to find APP_SHELL in sw.js");

const files = [...vm.runInNewContext(`[${shellSource}]`), "sw.js"]
  .map((file) => String(file).replace(/^\.\//, ""))
  .filter((file) => file && file !== ".");

fs.rmSync(output, { force: true, recursive: true });
fs.mkdirSync(output, { recursive: true });

for (const file of new Set(files)) {
  const source = path.join(root, file);
  const destination = path.join(output, file);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Missing web asset: ${file}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

fs.writeFileSync(path.join(output, ".nojekyll"), "", "utf8");
console.log(`web build ok - ${new Set(files).size} files`);
