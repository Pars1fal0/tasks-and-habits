const assert = require("node:assert/strict");
const { createRemoteSyncController } = require("../remote-sync-controller.js");

module.exports = [
  {
    name: "generates a strong private sync key",
    fn() {
      const controller = createRemoteSyncController({
        crypto: { getRandomValues: (bytes) => bytes.fill(10) },
      });
      const key = controller.generatePrivateKey();
      assert.equal(controller.isSecurePrivateKey(key), true);
      assert.equal(controller.isSecurePrivateKey("me@example.com"), false);
    },
  },
];
