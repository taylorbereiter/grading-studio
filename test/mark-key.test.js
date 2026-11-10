// The mark key: a page at the end of a returned file saying what each proofreading mark used on it means,
// with the words each teacher writes under More > Mark key. Made-up students and papers only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, menuPick, openZip, at, settle, catchDownloads, probePdf, press, closeBox } = require('./helpers/app');
const { zipOf } = require('./helpers/fixtures');

let browser, zip;
async function typedPaper() {
  const doc = await PDFDocument.create(), f = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 0; n < 2; n++) { const pg = doc.addPage([612, 792]); for (let i = 0; i < 12; i++) pg.drawText('A made-up sentence for a made-up essay about rivers and towns', { x: 72, y: 792 - (100 + i * 18), size: 12, font: f, color: rgb(0, 0, 0) }); }
  doc.setCreationDate(new Date('2026-09-01T12:00:00Z')); doc.setModificationDate(new Date('2026-09-01T12:00:00Z'));
  return doc.save();
}
before(async () => {
  browser = await launch();
  zip = zipOf({ 'Aria Testwell/Essay.pdf': await typedPaper(), 'Bram Sample/Essay.pdf': await typedPaper(), 'Cleo Madeup/Essay.pdf': await typedPaper() });
});
after(async () => { await browser.close(); });

async function open(page) {
  await openZip(page, zip, 'Key.zip');
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p && p.bmp && p.tl; });
}
async function stamp(page, k, x, y) {
  for (let i = 0; i < 3; i++) {
    const p = await at(page, 0, x, y);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    if (await page.waitForSelector('.stampmenu', { timeout: 1500 }).catch(() => null)) break;
  }
  await menuPick(page, '[data-mark="' + k + '"]');
}
async function exportZip(page, dl, { key } = {}) {
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  if (key !== undefined) await page.evaluate(on => { const b = document.querySelector('#xKey'); if (b.checked !== on) b.click(); }, key);
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  return unzipSync(got.bytes);
}

test('a returned paper gets a key page listing only the proofreading marks used on it', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await open(page);
  // Aria: awk twice, sp, a comma and a sticker. Bram: only a sticker. Cleo: nothing.
  await stamp(page, 'awk', 150, 120); await stamp(page, 'sp', 300, 200); await stamp(page, 'awk', 200, 260);
  await stamp(page, 'comma', 250, 320); await stamp(page, 'star', 450, 600);
  await page.evaluate(() => window.__gs.openStudent(1));
  await page.waitForFunction(() => { const s = window.__gs.state(), p = s.pages[0]; return s.cur === 1 && p && p.bmp && p.tl; });
  await page.evaluate(() => window.__gs.placeStamp(window.__gs.state().pages[0], 'star', 300, 300));
  await settle(page);

  // The rows: proofreading and punctuation only, once each, in menu order, in the ink used.
  const rows = await page.evaluate(() => window.__gs.keyRows(Object.values(window.__gs.state().batch.students[0].files[0].marks).flat()));
  assert.deepEqual(rows.map(r => r.k), ['sp', 'awk', 'comma']);
  assert.deepEqual(rows.map(r => r.name), ['Spelling', 'Awkward', 'Add a comma']);
  assert.ok(rows.every(r => r.mean.length > 5 && /^#[0-9A-F]{6}$/i.test(r.color)));

  // The export box says how many files get one.
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox #xKey');
  assert.equal(await page.$eval('#xKey', b => b.checked), true, 'on by default');
  assert.match(await page.$eval('#xKey', b => b.closest('label').nextElementSibling.textContent), /^1 of the 2 files gets one\./);
  await closeBox(page, '#dlgBox .bf [data-close]');

  let un = await exportZip(page, dl);
  const aria = await probePdf(page, un['Aria Testwell/Essay.pdf'], 3, [[55, 105, 46, 200], [400, 105, 150, 600]]);
  assert.equal(aria.n, 3, 'two pages and the key');
  assert.deepEqual([aria.W, aria.H], [612, 792], 'the same size as the paper');
  assert.ok(aria.ink[0].red > 40, 'the marks are drawn in the key, in her ink: ' + JSON.stringify(aria.ink[0]));
  assert.equal(aria.ink[1].red, 0, 'and only in the picture column');
  const bram = await probePdf(page, un['Bram Sample/Essay.pdf'], 1, []);
  assert.equal(bram.n, 2, 'a sticker alone gets no key');
  assert.equal(un['Cleo Madeup/Essay.pdf'], undefined, 'an unmarked paper still stays out');

  // Off in the export box: no key, and it's remembered.
  un = await exportZip(page, dl, { key: false });
  assert.equal((await probePdf(page, un['Aria Testwell/Essay.pdf'], 1, [])).n, 2);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.markKey')).on), false);
  await page.evaluate(() => { localStorage.removeItem('gs.markKey'); });

  // An editable export brought back in comes back as the paper only, with its marks.
  un = await exportZip(page, dl);
  const back = await page.evaluate(async b64 => {
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const r = await window.__gs.unpackExport(u); const d = await PDFLib.PDFDocument.load(r.data); return [d.getPageCount(), Object.values(r.marks).flat().length];
  }, Buffer.from(un['Aria Testwell/Essay.pdf']).toString('base64'));
  assert.deepEqual(back, [2, 5], 'the key page doesn’t come back in');
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('More > Mark key: her own names and meanings are used in the menu and the key, and Back to the usual wording undoes one', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await press(page, '#mkeyBtn');
  await page.waitForSelector('#dlgBox .mk');
  assert.equal(await page.$$eval('#dlgBox .mkrow', r => r.length), 26, 'every proofreading and punctuation mark');
  assert.equal(await page.$$eval('#dlgBox .mkrow canvas', r => r.length), 26, 'each with its picture');
  const name = await page.$('#dlgBox [data-n="awk"]'), mean = await page.$('#dlgBox [data-m="awk"]');
  await name.evaluate(i => { i.focus(); i.select(); }); await name.type('Awkward phrasing');
  await mean.evaluate(i => { i.focus(); i.select(); }); await page.keyboard.press('Backspace'); await mean.type('Read it out loud and fix it.');
  assert.equal(await page.$eval('#dlgBox [data-usual="awk"]', b => b.hidden), false);
  assert.deepEqual(await page.evaluate(() => [window.__gs.markLabel('awk'), window.__gs.markMean('awk'), window.__gs.markLabel('sp')]), ['Awkward phrasing', 'Read it out loud and fix it.', 'Spelling']);
  // A blank meaning shows just the name.
  const sp = await page.$('#dlgBox [data-m="sp"]'); await sp.evaluate(i => { i.focus(); i.select(); }); await page.keyboard.press('Backspace');
  assert.equal(await page.evaluate(() => window.__gs.markMean('sp')), '');
  await closeBox(page, '#dlgBox .bf [data-close]');
  // The right-click menu says her name for it.
  const p = await at(page, 0, 200, 200); await page.mouse.click(p.x, p.y, { button: 'right' });
  await page.waitForSelector('.stampmenu');
  assert.equal(await page.$eval('.stampmenu [data-mark="awk"]', b => b.title), 'Awkward phrasing');
  await page.keyboard.press('Escape');
  // Back to the usual wording.
  await press(page, '#mkeyBtn');
  await page.waitForSelector('#dlgBox .mk');
  assert.equal(await page.$eval('#dlgBox [data-n="awk"]', i => i.value), 'Awkward phrasing', 'kept');
  await page.click('#dlgBox [data-usual="awk"]');
  assert.deepEqual(await page.evaluate(() => [window.__gs.markLabel('awk'), window.__gs.markMean('awk')]), ['Awkward', 'This is hard to read. Try saying it out loud and rewording it.']);
  assert.equal(await page.$eval('#dlgBox [data-n="awk"]', i => i.value), 'Awkward');
  await closeBox(page, '#dlgBox .bf [data-close]');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a key too long for one page goes on to a second', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  const pages = await page.evaluate(() => {
    const kinds = window.__gs.STAMP_KINDS.proof.concat(window.__gs.STAMP_KINDS.punct);
    const rows = window.__gs.keyRows(kinds.map(k => ({ t: 'stamp', k, x: 1, y: 1, color: '#D7263D' })));
    const c = document.createElement('canvas'); c.width = 612; c.height = 792; const ctx = c.getContext('2d');
    const per = []; for (let from = 0; from < rows.length;) { const n = window.__gs.drawKeyPage(ctx, rows, from, 612, 792); per.push(n); from += n; }
    return { n: rows.length, per };
  });
  assert.equal(pages.n, 26);
  assert.ok(pages.per.length >= 2 && pages.per.every(n => n > 0), 'split over pages: ' + pages.per);
  assert.deepEqual(page.errors, []);
  await close();
});
