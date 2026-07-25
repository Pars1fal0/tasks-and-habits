const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { _electron: electron } = require("playwright-core");

(async () => {
  const electronApp = await electron.launch({
    args: [path.resolve(__dirname, ".."), "--e2e-test"],
    executablePath: require("electron"),
  });
  const page = await electronApp.firstWindow();

  try {
    await page.waitForSelector("#pageTitle");
    await page.evaluate(fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"));
    const views = ["tasks", "timeline", "habits", "goals", "overview", "archive", "settings"];
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const view of views) {
        const directTab = page.locator(`.nav-tab[data-view="${view}"]:visible`).first();
        if (await directTab.count()) {
          await directTab.click();
        } else {
          await page.locator(".nav-more-summary:visible").click();
          await page.locator(`.nav-more-menu .nav-tab[data-view="${view}"]`).click();
        }
        await page.waitForTimeout(20);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `${view} must not overflow horizontally at ${width}px`);
        const screenshot = await page.screenshot();
        assert.ok(screenshot.length > 10_000, `${view} screenshot must not be blank`);
        const audit = await page.evaluate(async () => window.axe.run(document));
        const blocking = audit.violations.filter((violation) => ["critical", "serious"].includes(violation.impact));
        assert.deepEqual(
          blocking.map((violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`),
          [],
          `${view} has blocking accessibility violations at ${width}px`,
        );
      }
    }
    console.log("e2e ok - accessibility, nonblank rendering, and horizontal fit");
  } finally {
    await electronApp.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
