// The right-click menu: proofreading marks and stickers, through the same right-click she uses, and through save, reopen, turn and export.
// Also how a comment's highlight looks next to a plain one.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, menuPick, openZip, appReady, at, clickAt, drag, setTool, settle, catchDownloads, probePdf } = require('./helpers/app');
const { zipOf } = require('./helpers/fixtures');

const LINE = 'The quick brown fox jumps over the lazy dog and keeps on running far away';
let browser, zip;
const SHOTS = process.env.GS_SHOTS;   // a folder: when set, the tests also save pictures of the menu and the page to look at

async function typedPaper() {
  const doc = await PDFDocument.create(), f = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 0; n < 2; n++) { const pg = doc.addPage([612, 792]); for (let i = 0; i < 12; i++) pg.drawText(LINE, { x: 72, y: 792 - (100 + i * 18), size: 12, font: f, color: rgb(0, 0, 0) }); }
  doc.setCreationDate(new Date('2026-09-01T12:00:00Z')); doc.setModificationDate(new Date('2026-09-01T12:00:00Z'));
  return doc.save();
}
before(async () => {
  browser = await launch();
  zip = zipOf({ 'Aria Testwell/Essay.pdf': await typedPaper(), 'Bram Sample/Essay.pdf': await typedPaper() });
});
after(async () => { await browser.close(); });

const marks = (page, k = 0) => page.evaluate(k => JSON.parse(JSON.stringify(window.__gs.state().pages[k].marks())), k);
async function open(page) {
  await openZip(page, zip, 'Stamps.zip');
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p && p.bmp && p.tl; });
  await page.evaluate(() => window.__gs.stickersReady);
}
async function rightClick(page, k, x, y) {
  // The page can still shift while the opened-files bar comes in, so the spot is found again right before each try.
  for (let i = 0; i < 3; i++) {
    const p = await at(page, k, x, y);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    if (await page.waitForSelector('.stampmenu', { timeout: 1500 }).catch(() => null)) return;
  }
  throw new Error('the menu did not open');
}
// Counts the pixels in a box of the page on screen that aren't paper white or the typed text's black.
const colorIn = (page, k, [x, y, w, h]) => page.evaluate((k, x, y, w, h) => {
  const pg = window.__gs.state().pages[k], s = pg.canvas.width / (pg.W + pg.side), q = pg.canvas.getContext('2d').getImageData(Math.round(x * s), Math.round(y * s), Math.round(w * s), Math.round(h * s)).data;
  let n = 0; for (let i = 0; i < q.length; i += 4) { const mx = Math.max(q[i], q[i + 1], q[i + 2]), mn = Math.min(q[i], q[i + 1], q[i + 2]); if (mx - mn > 40 || mx < 90) n++; }
  return n;
}, k, x, y, w, h);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + name + '.png' }); };

test('right-click opens the menu; a proofreading mark and a sticker land where she clicked, in one undo each', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await rightClick(page, 0, 150, 300);
  await shot(page, 'menu');
  const names = await page.$$eval('.stampmenu [data-mark]', bs => bs.map(b => b.title));
  for (const n of ['Capitalize', 'Make lowercase', 'Insert', 'New paragraph', 'Delete', 'Swap order', 'Spelling', 'Run-on', 'Fragment', 'Star', 'Add evidence', 'Look here', 'Crying thumbs up'])
    assert.ok(names.includes(n), n + ' is in the menu');
  assert.ok(!names.some(n => /heart|proud/i.test(n)), 'no heart and no "proud of you"');
  // The proofreading mark: in her ink color, at the spot.
  await menuPick(page, '[data-mark="cap"]');
  assert.equal(await page.$('.stampmenu'), null, 'the menu closes');
  let ms = await marks(page);
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].t, ms[0].k], ['stamp', 'cap']);
  assert.ok(Math.abs(ms[0].x - 150) < 1.5 && Math.abs(ms[0].y - 300) < 1.5, 'where she clicked: ' + [ms[0].x, ms[0].y]);
  assert.match(ms[0].color, /^#[0-9A-F]{6}$/i);
  assert.ok(await colorIn(page, 0, [140, 294, 20, 12]) > 5, 'the three lines show');
  // A sticker.
  await rightClick(page, 0, 400, 500);
  await menuPick(page, '[data-mark="star"]');
  ms = await marks(page);
  assert.deepEqual([ms[1].t, ms[1].k], ['stamp', 'star']);
  assert.ok(Math.abs(ms[1].x - 400) < 1.5 && Math.abs(ms[1].y - 500) < 1.5, 'where she clicked: ' + [ms[1].x, ms[1].y]);
  assert.ok(await colorIn(page, 0, [390, 490, 20, 20]) > 50, 'the star shows');
  // Recent picks come first next time.
  await rightClick(page, 0, 300, 650);
  assert.deepEqual(await page.$$eval('.stampmenu .st-recent [data-mark]', bs => bs.map(b => b.dataset.mark)), ['star', 'cap']);
  await page.keyboard.press('Escape');
  assert.equal(await page.$('.stampmenu'), null, 'Escape closes it');
  // Undo takes them off one at a time.
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, 1);
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, 0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('every proofreading mark and sticker draws, picks, moves and erases', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  const kinds = await page.evaluate(() => window.__gs.STAMP_KINDS);
  assert.equal(kinds.proof.length, 16); assert.equal(kinds.stickers.length, 15);
  const all = [...kinds.proof, ...kinds.stickers];
  await page.evaluate(all => {
    const s = window.__gs.state(), pg = s.pages[0];
    all.forEach((k, i) => window.__gs.placeStamp(pg, k, 60 + (i % 6) * 90, 120 + Math.floor(i / 6) * 110));
  }, all);
  await shot(page, 'all-stamps');
  for (let i = 0; i < all.length; i++) {
    const x = 60 + (i % 6) * 90, y = 120 + Math.floor(i / 6) * 110;
    assert.ok(await colorIn(page, 0, [x - 12, y - 12, 24, 24]) > 3, all[i] + ' shows');
  }
  // Pick the star with the Select tool and drag it.
  await setTool(page, 'select');
  const i = all.indexOf('star'), x = 60 + (i % 6) * 90, y = 120 + Math.floor(i / 6) * 110;
  await drag(page, 0, [[x, y], [x + 30, y + 20]]);
  const ms = await marks(page), star = ms.find(m => m.k === 'star');
  assert.ok(Math.abs(star.x - x - 30) < 1.5 && Math.abs(star.y - y - 20) < 1.5, 'moved: ' + [star.x, star.y]);
  // The eraser takes one off.
  await setTool(page, 'erase');
  await clickAt(page, 0, star.x, star.y);
  assert.ok(!(await marks(page)).some(m => m.k === 'star'));
  assert.equal((await marks(page)).length, all.length - 1);
  assert.deepEqual(page.errors, []);
  await close();
});

test('stamps survive saving and reopening, turn with the page staying upright, and go out in the export', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await open(page);
  await rightClick(page, 0, 120, 200); await menuPick(page, '[data-mark="sp"]');
  await rightClick(page, 0, 400, 600); await menuPick(page, '[data-mark="lightbulb"]');
  await settle(page);
  const was = await marks(page);
  // Back in from saved work.
  await page.reload(); await appReady(page);
  await open(page);
  assert.deepEqual(await marks(page), was);
  // The export has them.
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  const un = unzipSync(got.bytes), bytes = un['Aria Testwell/Essay.pdf'];
  assert.ok(bytes, 'the marked file goes back');
  const out = await page.evaluate(async b64 => {
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise, p = await d.getPage(1), vp = p.getViewport({ scale: 1 });
    const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await p.render({ canvasContext: x, viewport: vp }).promise;
    const count = (X, Y, W, H) => { const q = x.getImageData(X, Y, W, H).data; let n = 0; for (let i = 0; i < q.length; i += 4) { if (Math.max(q[i], q[i + 1], q[i + 2]) - Math.min(q[i], q[i + 1], q[i + 2]) > 40) n++; } return n; };
    return [count(108, 192, 24, 16), count(390, 590, 20, 20), count(500, 300, 40, 40)];
  }, Buffer.from(bytes).toString('base64'));
  assert.ok(out[0] > 5, 'the circled sp is in the export');
  assert.ok(out[1] > 50, 'the lightbulb is in the export');
  assert.equal(out[2], 0, 'and nothing where there was nothing');
  await page.click('#dlgBox .bf [data-close]');
  // A turned page: the stamps move with it and stay upright.
  const turned = await page.evaluate(() => { const m = [{ t: 'stamp', k: 'star', x: 100, y: 200, size: 44, rot: 3 }]; window.__gs.turnMarks(m, 612, 792, 1); return m[0]; });
  assert.deepEqual([turned.x, turned.y, turned.rot], [592, 100, 3]);
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test("a comment's highlight looks different from a plain one: lighter, underlined, and numbered like its card", async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  const px = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 120; const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 120);
    window.__gs.drawMarks(x, [
      { t: 'hl', color: '#FFE45C', x: 10, y: 10, w: 100, h: 14 },
      { t: 'note', color: '#D92D20', ax: 210, ay: 24, hl: { x: 10, y: 50, w: 100, h: 14 }, hc: '#FFE45C', text: 'Why?' },
    ], 200, 120, 200, null);
    const at = (X, Y) => [...x.getImageData(X, Y, 1, 1).data].slice(0, 3);
    return { plain: at(50, 17), comment: at(50, 57), under: at(50, 64), badge: at(108, 47), card: at(210, 12) };
  });
  assert.ok(px.comment[2] > px.plain[2] + 20, 'the comment highlight is a lighter tint: ' + px.plain + ' vs ' + px.comment);
  assert.ok(px.under[0] < 200 && px.under[1] < 100, 'a line in the comment color under the words: ' + px.under);
  assert.ok(px.badge[0] < 230 && px.badge[1] < 100, 'its number by the words: ' + px.badge);
  assert.ok(px.card[1] < 100, 'and the same number on its card: ' + px.card);
  // Through her own moves, for the pictures.
  await setTool(page, 'hl'); await drag(page, 0, [[80, 96], [300, 96]]);
  await setTool(page, 'note'); await drag(page, 0, [[80, 132], [300, 132]]);
  await page.waitForSelector('.pop textarea'); await page.keyboard.type('Explain how this supports your claim.'); await page.click('.pop [data-a="ok"]');
  await shot(page, 'comment-vs-highlight');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the menu does not open off the page, and a sticker near the edge stays on the page', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  const m = await page.evaluate(() => { const pg = window.__gs.state().pages[0]; return window.__gs.placeStamp(pg, 'trophy', pg.W - 2, pg.H - 2); });
  const bb = await page.evaluate(m => window.__gs.stampBox(m), m);
  assert.ok(bb.x + bb.w <= 612.5 && bb.y + bb.h <= 792.5, 'kept on the page: ' + JSON.stringify(bb));
  await rightClick(page, 0, 600, 420);
  const r = await page.$eval('.stampmenu', e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth, innerHeight]; });
  assert.ok(r[0] >= 0 && r[1] >= 0 && r[2] <= r[4] && r[3] <= r[5], 'menu fits the window: ' + r);
  assert.deepEqual(page.errors, []);
  await close();
});
