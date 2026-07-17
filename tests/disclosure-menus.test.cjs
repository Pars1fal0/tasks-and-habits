const assert = require("node:assert/strict");
const { chooseMenuDirection } = require("../disclosure-menus.js");

module.exports = [
  {
    name: "opens a disclosure menu down when it fits below the trigger",
    fn() {
      assert.equal(chooseMenuDirection({ top: 100, bottom: 140 }, 180, 800), "down");
    },
  },
  {
    name: "opens a disclosure menu up near the bottom of the viewport",
    fn() {
      assert.equal(chooseMenuDirection({ top: 720, bottom: 760 }, 180, 800), "up");
    },
  },
  {
    name: "uses the side with more room when a menu cannot fully fit",
    fn() {
      assert.equal(chooseMenuDirection({ top: 500, bottom: 540 }, 480, 800), "up");
    },
  },
];
