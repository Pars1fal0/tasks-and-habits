const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "icon.svg");

Promise.all([192, 512].map((size) =>
  sharp(source)
    .resize(size, size)
    .png()
    .toFile(path.join(root, `icon-${size}.png`)),
)).then(() => {
  console.log("application icons updated");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
