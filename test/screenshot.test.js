// Screenshot (S on a paper, ⌥S anywhere): drag over part of the screen and a picture of it goes on the clipboard. On a paper
// the page is drawn fresh, so typed names stay covered, and her marks come or go with "With my marks". Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, catchDownloads } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({
    'Ann Example/Essay.pdf': await makePaper({ title: 'Ann Example essay', pages: 1 }),
    'Ben Specimen/Essay.pdf': await makePaper({ title: 'Ben Specimen essay', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

// The picture last put on the clipboard, read back: its size, the black of a name cover, and any green (her pen mark).
const caught = page => page.evaluate(() => { window.__pic = null; navigator.clipboard.write = async items => { window.__types = items[0].types; window.__pic = await items[0].getType('image/png'); }; });
const looked = page => page.waitForFunction(() => window.__pic, { timeout: 30000 }).then(() => page.evaluate(async () => {
  const b = window.__pic, im = await createImageBitmap(b), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let cover = 0, green = 0, gy = 0;
  for (let i = 0; i < d.length; i += 4) { const [r, g, bl] = [d[i], d[i + 1], d[i + 2]]; if (Math.abs(r - 17) < 3 && Math.abs(g - 17) < 3 && Math.abs(bl - 17) < 3) cover++; if (g > 120 && g > r + 60 && g > bl + 40) { green++; gy += Math.floor(i / 4 / c.width); } }
  return { type: b.type, types: window.__types, w: c.width, h: c.height, cover, green, gy: green ? gy / green / c.height : null };
}));
async function openPaper(page) {
  await openZip(page, zip, 'Essay.zip');
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.pages.length && s.pages[0].bmp; }, { timeout: 60000 });
  // A thick green pen line across the page, under the title
  await page.evaluate(() => { const pg = window.__gs.state().pages[0]; pg.marks().push({ t: 'pen', pts: [[80, 140], [500, 140]], color: '#10A050', w: 8 }); window.__gs.redrawAll(); });
  return page.$eval('#paper .pg canvas', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
}
async function drag(page, a, b) {
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  await page.mouse.move(b[0], b[1], { steps: 6 }); await page.mouse.up();
}

test('S on a paper: drag over part of the page; the name stays covered and the marks come or go', async () => {
  const { page, close } = await openApp(browser);
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  const r = await openPaper(page);
  await caught(page);
  await page.keyboard.press('s');
  await page.waitForSelector('#snipLayer');
  assert.match(await page.$eval('.snipbar', e => e.textContent), /name covers are painted in/);
  assert.equal(await page.$eval('#snipMk', e => e.checked), true, 'with my marks, at first');
  const w = Math.round(r.w * 0.6), h = Math.round(r.h * 0.3);
  await drag(page, [r.x + 10, r.y + 10], [r.x + 10 + w, r.y + 10 + h]);
  const a = await looked(page);
  assert.deepEqual(a.types, ['image/png']);
  assert.equal(await page.$('#snipLayer'), null, 'the layer goes once the picture is taken');
  const k = await page.evaluate(() => Math.min(3, Math.max(2, devicePixelRatio || 1)));
  assert.ok(Math.abs(a.w - w * k) <= 2 * k && Math.abs(a.h - h * k) <= 2 * k, 'the size of the area: ' + a.w + '×' + a.h);
  assert.ok(a.cover > 1500, 'the typed name is covered: ' + a.cover);
  assert.ok(a.green > 500, 'her pen mark is on it: ' + a.green);
  const at = (140 / 792 * r.h - 10) / h;
  assert.ok(Math.abs(a.gy - at) < 0.03, 'the mark is where it is on screen: ' + a.gy.toFixed(3) + ' for ' + at.toFixed(3));
  assert.match(await page.$eval('.toast', e => e.textContent), /Picture copied/);
  // Without her marks, remembered for next time
  await caught(page);
  await page.click('#snipBtn');
  await page.waitForSelector('#snipMk');
  await page.click('#snipMk');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.snipMarks')), '0');
  await drag(page, [r.x + 10, r.y + 10], [r.x + 10 + w, r.y + 10 + h]);
  const b = await looked(page);
  assert.equal(b.green, 0, 'no pen mark');
  assert.ok(b.cover > 1500, 'still covered: ' + b.cover);
  await page.keyboard.press('s');
  await page.waitForSelector('#snipMk');
  assert.equal(await page.$eval('#snipMk', e => e.checked), false, 'remembered');
  // Esc leaves without copying
  await caught(page);
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#snipLayer'), null);
  assert.equal(await page.evaluate(() => window.__pic), null);
  assert.deepEqual(logs, []); assert.deepEqual(page.errors, []);
  await close();
});

test('a click on a page copies all of it; Enter copies the whole screen', async () => {
  const { page, close } = await openApp(browser);
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  const r = await openPaper(page);
  await caught(page);
  await page.keyboard.press('s');
  await page.waitForSelector('#snipLayer');
  await page.mouse.click(r.x + r.w * 0.3, r.y + r.h * 0.5);
  const a = await looked(page);
  assert.equal(a.w, 1700, 'the page alone, about 1700 across: ' + a.w);
  assert.ok(Math.abs(a.h / a.w - 792 / 612) < 0.01, 'a whole letter page: ' + a.w + '×' + a.h);
  assert.ok(a.cover > 1500 && a.green > 500, 'covered, with the mark: ' + a.cover + ', ' + a.green);
  await caught(page);
  await page.keyboard.press('s');
  await page.waitForSelector('#snipLayer');
  await page.keyboard.press('Enter');
  const b = await looked(page);
  const [vw, vh, k] = await page.evaluate(() => [innerWidth, innerHeight, Math.min(3, Math.max(2, devicePixelRatio || 1))]);
  assert.equal(b.w, vw * k); assert.equal(b.h, vh * k);
  assert.ok(b.cover > 1500, 'the name on the page is covered on the whole screen too: ' + b.cover);
  assert.deepEqual(logs, []); assert.deepEqual(page.errors, []);
  await close();
});

test('Alt S works away from the papers too, and where the browser can’t copy pictures it saves one', async () => {
  const { page, close } = await openApp(browser);
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await page.waitForSelector('#findBtn');
  await caught(page);
  await page.keyboard.down('Alt'); await page.keyboard.press('KeyS'); await page.keyboard.up('Alt');
  await page.waitForSelector('#snipLayer');
  assert.equal(await page.$('#snipMk'), null, 'no marks to choose away from a paper');
  await drag(page, [40, 40], [440, 340]);
  const a = await looked(page);
  const k = await page.evaluate(() => Math.min(3, Math.max(2, devicePixelRatio || 1)));
  assert.equal(a.w, 400 * k); assert.equal(a.h, 300 * k);
  // Find anything has it too
  const rows = await page.evaluate(() => window.__gs.findMatch(window.__gs.findRows(), 'screenshot').map(r => r.label));
  assert.ok(rows.includes('Screenshot'), 'in Find anything: ' + rows.join(', '));
  await page.evaluate(() => { window.ClipboardItem = undefined; });
  const dl = await catchDownloads(page);
  const got = await dl.next(async () => { await page.evaluate(() => window.__gs.snipStart()); await page.waitForSelector('#snipLayer'); await page.keyboard.press('Enter'); });
  assert.equal(got.name, 'Screenshot.png');
  assert.deepEqual([...got.bytes.slice(1, 4)], [80, 78, 71], 'a PNG');
  await dl.close();
  assert.deepEqual(logs, []); assert.deepEqual(page.errors, []);
  await close();
});
