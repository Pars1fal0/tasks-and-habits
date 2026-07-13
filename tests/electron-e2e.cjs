const assert = require("node:assert/strict");
const path = require("node:path");
const { _electron: electron } = require("playwright-core");

(async () => {
  const electronApp = await electron.launch({
    args: [path.resolve(__dirname, ".."), "--e2e-test"],
    executablePath: require("electron"),
  });
  const page = await electronApp.firstWindow();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.waitForSelector("#pageTitle");
    await page.setViewportSize({ height: 780, width: 390 });

    await page.locator('.nav-tab[data-view="habits"]:visible').click();
    await page.locator("#openHabitForm").click();
    const formBox = await page.locator("#habitFormPanel").boundingBox();
    assert.ok(formBox, "habit form should be visible");
    assert.ok(formBox.x >= 0 && formBox.x + formBox.width <= 390.5, "habit form must fit the mobile viewport");

    await page.locator('.nav-tab[data-view="timeline"]:visible').click();
    await page.locator('[data-timeline-scale="compact"]').click();
    const compactHeight = await page.locator(".timeline-hour-slot").first().evaluate((node) => node.getBoundingClientRect().height);
    await page.locator('[data-timeline-scale="large"]').click();
    const largeHeight = await page.locator(".timeline-hour-slot").first().evaluate((node) => node.getBoundingClientRect().height);
    assert.ok(largeHeight > compactHeight, "large timeline scale should increase the touch target");
    assert.equal(await page.locator('[data-timeline-scale="large"]').getAttribute("aria-pressed"), "true");
    assert.deepEqual(pageErrors, []);

    console.log("e2e ok - mobile habit form and timeline scale");
  } finally {
    await electronApp.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
