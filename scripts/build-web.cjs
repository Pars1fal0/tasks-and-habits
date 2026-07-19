const fs = require("node:fs");
const crypto = require("node:crypto");
const esbuild = require("esbuild");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "web-dist");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const shellSource = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1];

if (!shellSource) throw new Error("Unable to find APP_SHELL in sw.js");

const files = [...vm.runInNewContext(`[${shellSource}]`), "sw.js", "_headers"]
  .map((file) => String(file).replace(/^\.\//, ""))
  .filter((file) => file && file !== ".");

fs.rmSync(output, { force: true, recursive: true });
fs.mkdirSync(output, { recursive: true });

const uniqueFiles = new Set(files);
const extraAssets = ["oauth-consent.html", "oauth-consent.css"];
const buildHasher = crypto.createHash("sha256");
[...uniqueFiles].filter((file) => file !== "sw.js").forEach((file) => buildHasher.update(fs.readFileSync(path.join(root, file))));
extraAssets.forEach((file) => buildHasher.update(fs.readFileSync(path.join(root, file))));
buildHasher.update(fs.readFileSync(path.join(root, "mcp", "oauth-consent-entry.mjs")));
const buildHash = buildHasher.digest("hex").slice(0, 12);

for (const file of uniqueFiles) {
  const source = path.join(root, file);
  const destination = path.join(output, file);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Missing web asset: ${file}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (file === "sw.js") {
    fs.writeFileSync(destination, fs.readFileSync(source, "utf8").replaceAll("__BUILD_HASH__", buildHash), "utf8");
  } else {
    fs.copyFileSync(source, destination);
  }
}

extraAssets.forEach((file) => {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
});
esbuild.buildSync({
  bundle: true,
  entryPoints: [path.join(root, "mcp", "oauth-consent-entry.mjs")],
  format: "iife",
  minify: true,
  outfile: path.join(output, "oauth-consent.js"),
  platform: "browser",
  target: ["es2022"],
});

fs.writeFileSync(path.join(output, ".nojekyll"), "", "utf8");
console.log(`web build ok - ${uniqueFiles.size + extraAssets.length + 1} files - cache ${buildHash}`);
