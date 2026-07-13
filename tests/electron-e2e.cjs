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
    assert.equal(await page.locator("#archivePeriodFilter").evaluate((node) => node.closest(".view")?.id), "archiveView");
    assert.equal(await page.locator("#categoryForm").evaluate((node) => node.closest(".view")?.id), "settingsView");

    await page.locator('.nav-tab[data-view="overview"]:visible').click();
    assert.match(await page.locator("#weekSummaryText").textContent(), /недел|пока нет/i);
    assert.equal(await page.locator("#weekSummaryCompleted").textContent(), "0 / 0");
    await page.locator('[data-overview-mode="month"]').click();
    assert.equal(await page.locator("#overviewHeading").textContent(), "Обзор месяца");
    assert.match(await page.locator("#weeklyTaskText").textContent(), /за месяц/);

    await page.locator('.nav-tab[data-view="settings"]:visible').click();
    assert.equal(await page.locator("#remoteSyncPushButton").isDisabled(), true);
    assert.equal(await page.locator("#remoteSyncPullButton").isDisabled(), true);

    await page.setViewportSize({ height: 780, width: 390 });
    assert.equal(await page.locator(".task-filter-disclosure").getAttribute("open"), null);
    assert.equal(await page.locator(".quick-task-disclosure").getAttribute("open"), null);
    assert.equal(await page.locator(".timeline-unscheduled-panel").getAttribute("open"), null);

    await page.locator('.nav-tab[data-view="overview"]:visible').click();
    await page.locator('[data-overview-mode="week"]').click();
    const summaryBox = await page.locator(".weekly-summary-panel").boundingBox();
    assert.ok(summaryBox && summaryBox.x >= 0 && summaryBox.x + summaryBox.width <= 390.5, "weekly summary must fit mobile");
    await page.locator("#updateBanner").evaluate((node) => { node.hidden = false; });
    const updateBox = await page.locator("#updateBanner").boundingBox();
    assert.ok(updateBox && updateBox.x >= 0 && updateBox.x + updateBox.width <= 390.5, "update banner must fit mobile");
    await page.locator("#updateBanner").evaluate((node) => { node.hidden = true; });

    await page.locator('.nav-tab[data-view="habits"]:visible').click();
    await page.locator("#openHabitForm").click();
    const formBox = await page.locator("#habitFormPanel").boundingBox();
    assert.ok(formBox, "habit form should be visible");
    assert.ok(formBox.x >= 0 && formBox.x + formBox.width <= 390.5, "habit form must fit the mobile viewport");
    assert.equal(await page.locator("#habitFormPanel").getAttribute("role"), "dialog");
    assert.equal(await page.locator("#habitFormPanel").getAttribute("aria-modal"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#habitFormPanel").getAttribute("role"), null);

    await page.locator('.nav-tab[data-view="timeline"]:visible').click();
    await page.locator('[data-timeline-scale="compact"]').click();
    const compactHeight = await page.locator(".timeline-hour-slot").first().evaluate((node) => node.getBoundingClientRect().height);
    await page.locator('[data-timeline-scale="large"]').click();
    const largeHeight = await page.locator(".timeline-hour-slot").first().evaluate((node) => node.getBoundingClientRect().height);
    assert.ok(largeHeight > compactHeight, "large timeline scale should increase the touch target");
    assert.equal(await page.locator('[data-timeline-scale="large"]').getAttribute("aria-pressed"), "true");
    assert.deepEqual(pageErrors, []);

    console.log("e2e ok - archive, calendar periods, sync states, mobile dialogs, and timeline scale");
  } finally {
    await electronApp.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
