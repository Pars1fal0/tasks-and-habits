const fs = require("node:fs");
const path = require("node:path");

const testFiles = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".test.cjs"))
  .sort();

const tests = testFiles.flatMap((file) => {
  const loaded = require(path.join(__dirname, file));
  return loaded.map((test) => ({ ...test, file }));
});

let failed = 0;

for (const item of tests) {
  try {
    item.fn();
    console.log(`ok - ${item.file} - ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${item.file} - ${item.name}`);
    console.error(error);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} tests passed`);
}
