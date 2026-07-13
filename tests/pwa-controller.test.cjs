const assert = require("node:assert/strict");
const { createPwaController } = require("../pwa-controller.js");

module.exports = [
  {
    name: "registers the production worker without browser cache",
    async fn() {
      const calls = [];
      const controller = createPwaController({
        hostname: "parsitasks.ru",
        navigator: {
          serviceWorker: {
            register: async (...args) => {
              calls.push(args);
              return { update: async () => calls.push(["update"]) };
            },
          },
        },
      });

      assert.equal(await controller.register(), true);
      assert.deepEqual(calls[0], ["sw.js", { updateViaCache: "none" }]);
      assert.deepEqual(calls[1], ["update"]);
    },
  },
  {
    name: "clears stale app caches on localhost instead of registering a worker",
    async fn() {
      const removed = [];
      const controller = createPwaController({
        hostname: "localhost",
        caches: {
          delete: async (key) => removed.push(key),
          keys: async () => ["rhythm-day-old", "other-cache"],
        },
        navigator: {
          serviceWorker: {
            getRegistrations: async () => [{ unregister: async () => removed.push("registration") }],
          },
        },
      });

      assert.equal(await controller.register(), false);
      assert.deepEqual(removed, ["registration", "rhythm-day-old"]);
    },
  },
];
