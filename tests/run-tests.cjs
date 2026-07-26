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
const failureSummaries = [];

(async () => {
  for (const item of tests) {
    try {
      await item.fn();
      console.log(`ok - ${item.file} - ${item.name}`);
    } catch (error) {
      failed += 1;
      failureSummaries.push({
        file: item.file,
        name: item.name,
        error: error?.stack || String(error),
      });
      console.error(`not ok - ${item.file} - ${item.name}`);
      console.error(error);
    }
  }

  if (failed) {
    console.error("\nFailure summary:");
    failureSummaries.forEach((failure) => {
      console.error(`\nnot ok - ${failure.file} - ${failure.name}`);
      console.error(failure.error);
    });
    process.exitCode = 1;
  } else {
    console.log(`\n${tests.length} tests passed`);
  }
})();
