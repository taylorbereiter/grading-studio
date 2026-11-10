// Draws the app's icons (icons/*.png) from the same letters as the sidebar's mark: G in white, S a shade lighter, on the app's blue.
// Run by hand when the mark changes: node test/tools/make-icons.js. The pictures are kept in the repo, so a build needs no browser.
const fs = require('fs'), path = require('path');
const { launch } = require('../helpers/chrome');
const ROOT = path.join(__dirname, '..', '..'), font = fs.readFileSync(path.join(ROOT, 'src/fonts/inter-latin-wght-normal.woff2')).toString('base64');
// A maskable icon is cropped to a circle or a rounded square by the computer, so its mark keeps to the middle and the blue runs to the edge.
const page = (size, maskable) => `<!doctype html><style>
@font-face{font-family:Inter;font-weight:100 900;src:url(data:font/woff2;base64,${font}) format("woff2")}
html,body{margin:0;background:transparent}
div{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:#1F6FB2;border-radius:${maskable ? 0 : size * 0.22}px;
  font:700 ${size * (maskable ? 0.36 : 0.46)}px Inter;letter-spacing:-.04em;color:#fff}
i{font-style:normal;font-weight:500;color:#CFE3F5}
</style><div>G<i>S</i></div>`;
(async () => {
  const browser = await launch();
  try {
    fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
    for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true]]) {
      const p = await browser.newPage();
      await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
      await p.setContent(page(size, maskable));
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(ROOT, 'icons', name), omitBackground: true });
      await p.close();
      console.log('icons/' + name);
    }
  } finally { await browser.close(); }
})();
