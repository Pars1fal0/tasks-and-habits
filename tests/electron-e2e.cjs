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

    await page.locator('.nav-tab[data-view="journal"]:visible').click();
    assert.equal(await page.evaluate(() => window.location.hash), "#journal");
    await page.locator("#journalText").fill("Сегодня проверил дневник дня.\n\nЗапись сохранилась.");
    await page.waitForTimeout(650);
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem("rhythm-day-state-v1")).journalEntries[0].date),
      "2026-07-20",
    );
    await page.reload();
    await page.waitForSelector('body[data-view="journal"]');
    assert.match(await page.locator("#journalText").inputValue(), /Запись сохранилась/);

    assert.equal(await page.locator(".journal-calendar-day").count(), 42);
    await page.locator("#journalSearch").evaluate((node) => node.closest("details")?.querySelector("summary")?.click());
    await page.locator("#journalSearch").fill("дневник");
    assert.equal(await page.locator(".journal-search-result").count(), 1);
    await page.locator("#globalSearchButton").click();
    await page.locator("#globalSearchInput").fill("дневник");
    assert.equal(await page.locator(".global-search-result").count(), 1);
    await page.locator("#globalSearchInput").press("Enter");
    assert.equal(await page.evaluate(() => window.location.hash), "#journal");

    await page.locator('.nav-tab[data-view="nutrition"]:visible').click();
    assert.equal(await page.evaluate(() => window.location.hash), "#nutrition");
    assert.equal(await page.locator(".nutrition-day-column").count(), 7);
    await page.locator("#nutritionAddMeal").click();
    await page.locator("#nutritionMealTitle").fill("Тестовый обед");
    await page.locator("#nutritionMealDate").fill("2026-07-20");
    await page.locator("#nutritionMealType").selectOption("lunch");
    await page.locator("#nutritionMealIngredients").fill("Рис | 100 | г");
    await page.locator("#nutritionMealCalories").fill("350");
    await page.locator("#nutritionMealForm button[type=submit]").click();
    assert.equal(await page.locator(".nutrition-meal-card").count(), 1);
    assert.match(await page.locator(".nutrition-meal-card").textContent(), /Тестовый обед/);
    await page.reload();
    await page.waitForSelector('body[data-view="nutrition"]');
    assert.equal(await page.locator(".nutrition-meal-card").count(), 1);

    await page.locator('.nav-tab[data-view="board"]:visible').click();
    assert.equal(await page.evaluate(() => window.location.hash), "#board");
    await page.locator("#boardAddText").click();
    await page.locator(".board-text-editor").fill("Идея для проверки");
    await page.locator("#boardImageInput").setInputFiles(path.resolve(__dirname, "..", "icon-192.png"));
    await page.waitForFunction(() => document.querySelector(".board-image-content")?.naturalWidth > 0);
    assert.equal(await page.locator(".board-item").count(), 2);
    assert.match(await page.locator(".board-image-content").getAttribute("src"), /^blob:/);

    await page.locator('.nav-tab[data-view="settings"]:visible').click();
    assert.equal(await page.evaluate(() => window.location.hash), "#settings");
    assert.equal(await page.locator(".settings-accordion").first().getAttribute("open"), null);
    assert.equal(await page.locator("#remoteSyncPushButton").isDisabled(), true);
    assert.equal(await page.locator("#remoteSyncPullButton").isDisabled(), true);
    await page.locator(".settings-accordion").first().locator("summary").click();
    await page.locator('.accent-option:has(input[value="blue"])').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.accent), "blue");
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem("rhythm-day-ui-v1")).accentPreference),
      "blue",
    );
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--teal").trim()),
      "#5aa7ff",
    );
    await page.locator("#timeZoneSetting").fill("Asia/Yekaterinburg");
    await page.locator("#timeZoneSetting").dispatchEvent("change");
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem("rhythm-day-state-v1")).profile.timeZone),
      "Asia/Yekaterinburg",
    );
    await page.locator("#mcpJournalRead").evaluate((node) => node.closest("details")?.querySelector("summary")?.click());
    await page.locator("#mcpJournalRead").selectOption("off");
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem("rhythm-day-state-v1")).profile.journalAccess.read),
      false,
    );
    await page.evaluate(() => {
      window.__verificationResult = null;
      window.confirmAction({
        confirmLabel: "Delete",
        title: "Verification test",
        verificationLabel: "Enter email",
        verificationText: "owner@example.com",
      }).then((value) => {
        window.__verificationResult = value;
      });
    });
    assert.equal(await page.locator("#confirmVerification").isVisible(), true);
    assert.equal(await page.locator("#confirmAccept").isDisabled(), true);
    await page.locator("#confirmVerificationInput").fill("OWNER@example.com");
    assert.equal(await page.locator("#confirmAccept").isDisabled(), false);
    await page.locator("#confirmAccept").click();
    assert.equal(await page.evaluate(() => window.__verificationResult), true);

    await page.setViewportSize({ height: 780, width: 390 });
    await page.waitForFunction(() => !document.querySelector(".task-filter-disclosure")?.hasAttribute("open"));
    assert.equal(await page.locator(".task-filter-disclosure").getAttribute("open"), null);
    assert.equal(await page.locator(".quick-task-disclosure").getAttribute("open"), null);
    assert.equal(await page.locator(".timeline-unscheduled-panel").getAttribute("open"), null);

    await page.locator(".nav-more-summary").click();
    await page.locator('.nav-more-menu .nav-tab[data-view="board"]').click();
    await page.waitForTimeout(100);
    const boardContentVisible = await page.locator(".board-item").first().evaluate((node) => {
      const item = node.getBoundingClientRect();
      const viewport = document.querySelector("#boardViewport").getBoundingClientRect();
      return item.right > viewport.left && item.left < viewport.right && item.bottom > viewport.top && item.top < viewport.bottom;
    });
    assert.equal(boardContentVisible, true, "board content must stay in view after a mobile resize");
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

    console.log("e2e ok - journal, archive, calendar periods, sync states, mobile dialogs, timeline scale, and quota recovery");
  } finally {
    await electronApp.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
