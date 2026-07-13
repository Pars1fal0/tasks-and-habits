const CACHE_PREFIX = "rhythm-day-";
const CACHE_NAME = `${CACHE_PREFIX}app-v45-__BUILD_HASH__`;
const APP_SHELL = [
  "./",
  "index.html",
  "styles.css",
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
  "habit-title-history.js",
  "pwa-controller.js",
  "state-normalizer.js",
  "state-merge.js",
  "date-rollover.js",
  "device-sync-controller.js",
  "planning-history.js",
  "storage.js",
  "archive-view.js",
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
  "settings-controller.js",
  "timeline-layout.js",
  "timeline-menu.js",
  "timeline-drag.js",
  "timeline-view.js",
  "timeline-controller.js",
  "view-renderer.js",
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
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
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
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
