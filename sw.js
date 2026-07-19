const CACHE_PREFIX = "rhythm-day-";
const CACHE_NAME = `${CACHE_PREFIX}app-v51-__BUILD_HASH__`;
const APP_SHELL = [
  "./",
  "index.html",
  "styles.css",
  "disclosure-menus.css",
  "app-utils.js",
  "quick-input.js",
  "recurrence.js",
  "remote-auth.js",
  "remote-auth-controller.js",
  "remote-sync.js",
  "remote-sync-controller.js",
  "sync-history.js",
  "settings-state.js",
  "data-normalizers.js",
  "sync-metadata.js",
  "tombstone-retention.js",
  "habit-title-history.js",
  "habit-config-history.js",
  "pwa-controller.js",
  "state-normalizer.js",
  "state-controller.js",
  "state-merge.js",
  "date-rollover.js",
  "device-sync-controller.js",
  "planning-history.js",
  "storage.js",
  "navigation-state.js",
  "archive-view.js",
  "disclosure-menus.js",
  "app-events.js",
  "heatmap-view.js",
  "calendar-view.js",
  "calendar-drag-controller.js",
  "confirm-dialog.js",
  "form-dialog.js",
  "categories.js",
  "goal-checkpoint-editor.js",
  "goals-view.js",
  "habit-form.js",
  "habits-view.js",
  "import-export.js",
  "notifications.js",
  "overdue-controller.js",
  "task-form.js",
  "task-schedule.js",
  "tasks-view.js",
  "task-moves.js",
  "task-state.js",
  "settings-sync.js",
  "settings-transfer.js",
  "save-status.js",
  "settings-controller.js",
  "timeline-layout.js",
  "timeline-menu.js",
  "timeline-drag.js",
  "timeline-view.js",
  "timeline-controller.js",
  "view-renderer.js",
  "app-shell-controller.js",
  "toast.js",
  "app.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("index.html", { ignoreSearch: true })),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;

        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
