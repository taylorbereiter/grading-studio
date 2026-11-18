// Pictures of the parts gallery: each section, and the floating parts open, in all six themes, at computer and phone width.
// node next/tools/gallery-shots.js [--out dir]   (npm run next:shots). Fails on any error on the page. Nothing is compared with a
// kept picture: the pictures are for people to look at (CI keeps them with the run; stage reviews get them in project files).
const fs = require('fs'), path = require('path');
const { launch } = require('../../test/helpers/chrome.js');
const { serveNext } = require('./serve-next.js');
const OUT = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(__dirname, '..', '..', 'out', 'gallery'));
const LOOKS = ['graphite', 'porcelain', 'ocean', 'ink', 'plum', 'midnight'];
const WIDTHS = [['computer', 1366, 900], ['phone', 390, 844]];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const srv = await serveNext(), args = process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [];
  const browser = await launch({ args: [...args, '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
  const errors = []; let n = 0;
  for (const look of LOOKS) for (const [wname, w, hgt] of WIDTHS) {
    const dir = path.join(OUT, look + '-' + wname); fs.mkdirSync(dir, { recursive: true });
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(look + ' ' + wname + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(look + ' ' + wname + ': ' + m.text()); });
    await p.setViewport({ width: w, height: hgt, deviceScaleFactor: 2 });
    const url = srv.url + 'gallery.html?still=1&look=' + look + (w < 600 ? '&frame=1' : '');
    const fresh = async () => { await p.goto(url); await p.waitForFunction(() => window.__gallery && window.__gallery.ready); await p.evaluate(() => document.fonts.ready); };
    await fresh();
    for (const id of await p.$$eval('[data-shot]', l => l.map(e => e.dataset.shot))) {
      const el = await p.$('[data-shot="' + id + '"]'); await el.screenshot({ path: path.join(dir, id + '.png') }); n++;
    }
    // The floating parts, open.
    const shot = async name => { await new Promise(r => setTimeout(r, 120)); await p.screenshot({ path: path.join(dir, 'open-' + name + '.png') }); n++; };
    const scrollTo = sel => p.$eval(sel, e => e.scrollIntoView({ block: 'center' }));
    await scrollTo('[data-test="menu"]'); await p.click('[data-test="menu"]'); await p.waitForSelector('[role="menu"]'); await shot('menu'); await p.keyboard.press('Escape');
    await p.click('[data-test="sheet"]'); await p.waitForSelector('dialog.sheet[open]'); await shot('sheet'); await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.click('[data-test="dialog"]'); await p.waitForSelector('dialog.dlg[open]'); await shot('dialog'); await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.click('[data-test="cmd"]'); await p.waitForSelector('dialog.cmd[open]'); await p.keyboard.type('c'); await shot('command-bar'); await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.click('[data-test="toast-undo"]'); await p.waitForSelector('.toast'); await shot('toast');
    await p.close();
  }
  await browser.close(); await srv.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(n + ' pictures in ' + path.relative(process.cwd(), OUT));
})().catch(e => { console.error(e); process.exit(1); });
