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
    assert.equal(await page.evaluate(() => window.location.hash), "#calendar/week");
    await page.reload();
    await page.waitForSelector('body[data-view="overview"]');
    assert.equal(await page.locator("#pageTitle").textContent(), "Календарь");
    await page.locator('[data-overview-mode="month"]').click();
    assert.equal(await page.evaluate(() => window.location.hash), "#calendar/month");
    assert.equal(await page.locator("#overviewHeading").textContent(), "Обзор месяца");
    assert.match(await page.locator("#weeklyTaskText").textContent(), /за месяц/);
    await page.reload();
    await page.waitForSelector('body[data-view="overview"]');
    assert.equal(await page.locator("#overviewHeading").textContent(), "Обзор месяца");
    assert.equal(
      await page.locator('[data-overview-mode="month"]').evaluate((node) => node.classList.contains("is-active")),
      true,
    );
    await page.locator("#activeDate").fill("2026-07-20");
    await page.locator("#activeDate").dispatchEvent("change");
    await page.reload();
    await page.waitForSelector('body[data-view="overview"]');
    assert.equal(await page.locator("#activeDate").inputValue(), "2026-07-20");

    await page.locator('.nav-tab[data-view="settings"]:visible').click();
    assert.equal(await page.evaluate(() => window.location.hash), "#settings");
    assert.equal(await page.locator(".settings-accordion").first().getAttribute("open"), null);
    assert.equal(await page.locator("#remoteSyncPushButton").isDisabled(), true);
    assert.equal(await page.locator("#remoteSyncPullButton").isDisabled(), true);

    await page.setViewportSize({ height: 780, width: 390 });
    assert.equal(await page.locator(".task-filter-disclosure").getAttribute("open"), null);
    assert.equal(await page.locator(".quick-task-disclosure").getAttribute("open"), null);
    assert.equal(await page.locator(".timeline-unscheduled-panel").getAttribute("open"), null);

    await page.locator(".nav-more-summary").click();
    await page.locator('.nav-more-menu .nav-tab[data-view="archive"]').click();
    const archiveToolbarFits = await page.locator(".archive-toolbar").evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
    assert.equal(archiveToolbarFits, true, "archive filters must fit the mobile viewport");

    await page.locator('.nav-tab[data-view="overview"]:visible').click();
    await page.locator('[data-overview-mode="week"]').click();
    assert.equal(await page.locator(".focus-board").evaluate((node) => getComputedStyle(node).display), "none");
    const weekPanelTop = await page.locator('[data-overview-panel="week"]').evaluate((node) => node.getBoundingClientRect().top);
    const overviewMetricTop = await page.locator("#overviewView .metric-panel").first().evaluate((node) => node.getBoundingClientRect().top);
    assert.ok(weekPanelTop < overviewMetricTop, "the selected calendar period must appear before summary metrics on mobile");
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

    for (const width of [320, 360]) {
      await page.setViewportSize({ height: 720, width });
      const bodyFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      assert.equal(bodyFits, true, `page must not overflow at ${width}px`);
      const navigationBox = await page.locator(".nav-tabs").boundingBox();
      assert.ok(
        navigationBox && navigationBox.x >= 0 && navigationBox.x + navigationBox.width <= width + 0.5,
        `navigation must fit ${width}px`,
      );
      const mobileLabels = await page.locator(".nav-tabs > .nav-tab[data-mobile-label] span").evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node, "::after").content.replaceAll('"', "")),
      );
      assert.deepEqual(mobileLabels, ["Задачи", "Время", "Привыч.", "Кален."]);
    }

    await page.locator('.nav-tab[data-view="tasks"]:visible').click();
    await page.locator("#openTaskForm").click();
    const scheduleModesFit = await page.locator(".schedule-mode-control").evaluate((node) =>
      node.scrollWidth <= node.clientWidth + 1,
    );
    assert.equal(scheduleModesFit, true, "task schedule modes must fit 320px without horizontal scrolling");
    await page.keyboard.press("Escape");

    await page.setViewportSize({ height: 780, width: 390 });
    await page.locator('.nav-tab[data-view="timeline"]:visible').click();
    assert.equal(await page.locator(".timeline-hour-slot").count(), 24);
    assert.equal(await page.locator(".timeline-hour-slot").first().getAttribute("data-hour"), "0");
    assert.equal(await page.locator(".timeline-hour-slot").last().getAttribute("data-hour"), "23");
    await page.locator('[data-timeline-scale="compact"]').click();
    const compactHeight = await page.locator(".timeline-hour-slot").first().evaluate((node) => node.getBoundingClientRect().height);
    await page.locator('[data-timeline-scale="large"]').click();
    const largeHeight = await page.locator(".timeline-hour-slot").first().evaluate((node) => node.getBoundingClientRect().height);
    assert.ok(largeHeight > compactHeight, "large timeline scale should increase the touch target");
    assert.equal(await page.locator('[data-timeline-scale="large"]').getAttribute("aria-pressed"), "true");
    await page.goBack();
    await page.waitForSelector('body[data-view="tasks"]');
    assert.equal(await page.evaluate(() => window.location.hash), "#tasks");

    await page.locator('.nav-tab[data-view="tasks"]:visible').click();
    await page.evaluate(() => {
      const originalSetItem = Storage.prototype.setItem;
      window.__restoreStorageSetItem = () => { Storage.prototype.setItem = originalSetItem; };
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === "rhythm-day-state-v1") throw new DOMException("Quota exceeded", "QuotaExceededError");
        return originalSetItem.call(this, key, value);
      };
    });
    await page.locator(".quick-task-disclosure").evaluate((node) => { node.open = true; });
    await page.locator("#quickTaskInput").fill("Проверить сохранение");
    await page.locator("#quickTaskForm").evaluate((form) => form.requestSubmit());
    assert.match(await page.locator("#saveStatus").textContent(), /хранилище заполнено/i);
    assert.equal(await page.locator(".task-item").filter({ hasText: "Проверить сохранение" }).count(), 1);
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem("rhythm-day-ui-v1") || "{}").remoteSyncPending),
      true,
      "a failed local write must still queue the in-memory change for cloud sync",
    );
    await page.evaluate(() => window.__restoreStorageSetItem?.());
    assert.deepEqual(pageErrors, []);

    console.log("e2e ok - archive, calendar periods, sync states, mobile dialogs, timeline scale, and quota recovery");
  } finally {
    await electronApp.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
