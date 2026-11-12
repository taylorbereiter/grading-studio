// Anchor papers: tag the high, middle and low paper of a summative under the score, see them on the Return tab, and export them
// in one go, named for the assignment and the level, with names covered. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, appReady, openZip, goToStudent, markPage, setTool, drag, settle, catchDownloads } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, files;
before(async () => { browser = await launch(); files = await standardFiles(); });
after(async () => { await browser.close(); });

const isPdf = u => new TextDecoder().decode(u.subarray(0, 5)) === '%PDF-';
const pressed = page => page.$$eval('#anchRow [data-anchor][aria-pressed="true"]', els => els.map(e => e.dataset.anchor));
// The words left in a PDF's text layer, read in the page with the app's own PDF reader.
const textOf = (page, bytes) => page.evaluate(async arr => {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arr), isEvalSupported: false }).promise; let s = '';
  for (let i = 1; i <= doc.numPages; i++) s += (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join(' ');
  doc.destroy(); return s;
}, [...bytes]);
async function toReturn(page) {
  await page.click('#exportBtn'); await page.waitForSelector('#rtAnchors');
}

test('Anchor papers: one paper per level, a tag in the list, kept with the marks', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  assert.deepEqual(await page.$$eval('#anchRow [data-anchor]', els => els.map(e => e.textContent)), ['High', 'Mid', 'Low']);
  await page.click('#anchRow [data-anchor="high"]');
  assert.deepEqual(await pressed(page), ['high']);
  assert.match(await page.$eval('#stuList .stu.on', e => e.textContent), /high/);

  // Bram becomes High: Aria loses it.
  await goToStudent(page, 1);
  await page.click('#anchRow [data-anchor="high"]');
  await page.waitForFunction(() => document.querySelectorAll('#stuList .stu .anch').length === 1);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.anchor), undefined);
  // Clicking it again takes it off.
  await page.click('#anchRow [data-anchor="high"]');
  assert.deepEqual(await pressed(page), []);
  await page.click('#anchRow [data-anchor="mid"]');
  await goToStudent(page, 0);
  await page.click('#anchRow [data-anchor="low"]');
  await settle(page);

  await page.evaluate(() => window.__gs.saveNow());
  await page.reload(); await appReady(page);
  await openZip(page, zipOf(files), 'River essay.zip');
  await page.waitForSelector('#stuList .stu .anch');
  assert.deepEqual(await page.$$eval('#stuList .stu .anch', els => els.map(e => e.textContent)).then(a => a.sort()), ['low', 'mid']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Anchor papers: the Return tab lists them and exports them named for the level, names covered', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zipOf(files), 'River essay.zip');
  await markPage(page, 0);
  await page.click('#anchRow [data-anchor="high"]');
  await goToStudent(page, 2);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await page.click('#anchRow [data-anchor="low"]');
  await settle(page);

  await toReturn(page);
  const card = await page.$eval('#rtAnchors', e => e.textContent);
  assert.match(card, /High\s*Aria Testwell/);
  assert.match(card, /Mid\s*Not picked yet/);
  assert.match(card, /River essay - Summative High\.pdf/);
  assert.equal(await page.$eval('#anchCover', e => e.checked), true, 'names are covered unless she says otherwise');

  const got = await dl.next(() => page.click('[data-anchout]'));
  assert.equal(got.name, 'Anchor papers - River essay.zip');
  const un = unzipSync(got.bytes);
  assert.deepEqual(Object.keys(un).sort(), ['River essay - Summative High.pdf', 'River essay - Summative Low.pdf']);
  for (const b of Object.values(un)) {
    assert.ok(isPdf(b));
    const doc = await PDFDocument.load(b);
    assert.equal(doc.getAuthor() || '', '');
  }
  const hi = un['River essay - Summative High.pdf'];
  assert.equal((await PDFDocument.load(hi)).getPageCount(), 2, 'the whole paper goes');
  assert.equal((await textOf(page, hi)).trim(), '', 'covered: pages are pictures, with no text left to give a name away');
  assert.doesNotMatch(new TextDecoder('latin1').decode(hi), /Testwell|gs-original/);

  // Covers off: the paper as Export marked makes it, still named for the level.
  await page.click('#anchCover');
  await page.waitForFunction(() => /Names stay as they are/.test(document.querySelector('#rtAnchors').textContent));
  const got2 = await dl.next(() => page.click('[data-anchout]'));
  const un2 = unzipSync(got2.bytes);
  assert.match(await textOf(page, un2['River essay - Summative High.pdf']), /Testwell/);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.anchorCover')), 'false');
  assert.deepEqual(page.errors, []);
  await close();
});
