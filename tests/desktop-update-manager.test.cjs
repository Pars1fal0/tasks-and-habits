const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createUpdateManager, readableUpdateError } = require("../desktop/update-manager.cjs");

module.exports = [
  {
    name: "keeps update checks offline in development builds",
    async fn() {
      const handlers = new Map();
      const manager = createUpdateManager({
        app: {
          getVersion: () => "1.2.3",
          isPackaged: false,
        },
        ipcMain: {
          handle(name, handler) {
            handlers.set(name, handler);
          },
        },
        shell: {
          openExternal: async () => {},
        },
        getMainWindow: () => null,
      });

      manager.registerIpc();
      manager.start();

      const status = await handlers.get("updates:get-status")();
      assert.equal(status.state, "development");
      assert.equal(status.currentVersion, "1.2.3");
      assert.equal(status.canAutoUpdate, false);
      assert.match(status.message, /установленной версии/i);
      manager.stop();
    },
  },
  {
    name: "turns network errors into a useful message",
    fn() {
      assert.match(readableUpdateError(new Error("net::ERR_INTERNET_DISCONNECTED")), /нет связи с GitHub/i);
    },
  },
  {
    name: "exposes a downloaded update and installs it on request",
    async fn() {
      const handlers = new Map();
      const updater = new EventEmitter();
      updater.checkForUpdates = async () => {};
      updater.quitAndInstall = (...args) => {
        updater.installArgs = args;
      };
      const manager = createUpdateManager({
        app: {
          getVersion: () => "1.2.3",
          isPackaged: true,
        },
        ipcMain: {
          handle(name, handler) {
            handlers.set(name, handler);
          },
        },
        shell: {
          openExternal: async () => {},
        },
        getMainWindow: () => null,
        updater,
      });

      manager.registerIpc();
      manager.start();
      updater.emit("update-downloaded", { version: "1.3.0" });

      const status = await handlers.get("updates:get-status")();
      assert.equal(status.state, "downloaded");
      assert.equal(status.version, "1.3.0");
      assert.equal(status.percent, 100);
      assert.deepEqual(await handlers.get("updates:install")(), { ok: true });
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(updater.installArgs, [false, true]);
      manager.stop();
    },
  },
];
