// The feedback page: the first page of a returned paper. The score, each rubric row with the level given and what that level
// means, the teacher's comment, and each comment on the paper with its page. It is made when the paper is exported and never
// comes back in as a page. Every student and paper here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { PDFDocument } = require('pdf-lib');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { ROOT, openApp, openZip, goToStudent, markPage, setTool, drag, score, settle, catchDownloads, probePdf, closeBox } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], levels: [
  { 4: 'A clear claim that answers the question and guides the whole essay.', 3: 'A claim that answers the question.' },
  { 3: 'Quotes fit the claim, and most are explained. To reach 4, explain every quote.' }, {}] };
const seed = { ls: { 'gs.setup': JSON.stringify(SETUP) } };
const pages = async bytes => (await PDFDocument.load(bytes)).getPageCount();
async function exportZip(page, dl, before) {
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  if (before) await before();
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  return { un: unzipSync(got.bytes), bytes: got.bytes };
}
// Aria: marked, scored on every row (a half point on one), with a comment. Bram: a pen mark and nothing else.
async function marked(page) {
  await openZip(page, zip, 'River essay.zip');
  await markPage(page, 0);
  await score(page, [4, 3.5, 3]);
  await page.type('.cmt textarea', 'A clear reading of the three pictures.\nNext time, explain each quote.');
  await goToStudent(page, 1);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await settle(page);
}

test('a returned paper starts with a feedback page: score, rubric rows with what the level means, her comment, comments by page', async () => {
  const { page, close } = await openApp(browser, { seed, feedback: true });
  const dl = await catchDownloads(page);
  await marked(page);
  // what the page says
  const d = await page.evaluate(() => window.__gs.fbData(0));
  assert.equal(d.title, 'River essay');
  assert.match(d.sub, /^Aria Testwell · returned \w+ \d+$/);
  assert.deepEqual([d.total, d.max, d.pct], [10.5, 12, await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).pct)]);
  assert.deepEqual(d.rows, [
    { name: 'Thesis', v: 4, text: 'A clear claim that answers the question and guides the whole essay.' },
    { name: 'Evidence', v: 3.5, text: 'Quotes fit the claim, and most are explained. To reach 4, explain every quote.' },   // a half point reads as the level below it
    { name: 'Style', v: 3, text: '' }]);
  assert.equal(d.comment, 'A clear reading of the three pictures.\nNext time, explain each quote.');
  assert.deepEqual(d.notes.map(n => [n.text, n.page]), [['See rubric row 2', 0]]);
  assert.equal(await page.evaluate(() => window.__gs.fbData(1)), null, 'a pen mark alone gives the page nothing to say');

  // the option is on unless she turns it off, and the Options line says so
  const { un } = await exportZip(page, dl, async () => {
    assert.ok(await page.$eval('#xFb', e => e.checked));
    assert.match(await page.$eval('#xOptsSay', e => e.textContent), /feedback page/);
  });
  const aria = un['Aria Testwell/Essay.pdf'];
  assert.equal(await pages(aria), 3, 'the feedback page, then her two pages');
  assert.equal(await pages(un['Bram Sample/Essay.pdf']), 1, 'no feedback page where there is nothing to say');
  // page 1 is a plain sheet with no comment margin; blue is the score bars, pale blue the comment box
  const p1 = await probePdf(page, aria, 1, [[58, 40, 300, 40], [58, 120, 500, 200], [460, 40, 100, 50]]);
  assert.deepEqual([p1.W, p1.H], [612, 792]);
  assert.ok(p1.ink[0].n > 200, 'the assignment’s name');
  assert.ok(p1.ink[2].n > 200, 'the score');
  const p2 = await probePdf(page, aria, 2, [[0, 0, 10, 10]]);
  assert.ok(p2.W > 800, 'her own first page follows, with its comment margin');
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out', 'feedback-sample.pdf'), aria);

  // one student's paper on its own gets it too
  await goToStudent(page, 0);
  const one = await dl.next(() => page.click('#oneOutBtn'));
  assert.equal(await pages(one.bytes), 3);

  // bringing the export back in opens her pages, not the feedback page
  await page.click('#closeBtn');
  const tmp = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'gs-test-fb-')), 'Marked again.zip');
  fs.writeFileSync(tmp, Buffer.from(zipOf(Object.fromEntries(Object.entries(un).filter(([k]) => !k.startsWith('Grade sheet'))))));
  await openZip(page, fs.readFileSync(tmp), 'Marked again.zip');
  await page.waitForFunction(() => window.__gs.state().pages.length >= 2);   // pages are drawn one after another
  await settle(page);
  assert.equal(await page.evaluate(() => window.__gs.state().pages.length), 2, 'her two pages, and no feedback page among them');
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('the feedback page can be left off, and that is remembered', async () => {
  const { page, close } = await openApp(browser, { seed, feedback: true });
  const dl = await catchDownloads(page);
  await marked(page);
  const { un } = await exportZip(page, dl, async () => { await page.evaluate(() => { document.querySelector('#xOpts').open = true; }); await page.click('#xFb'); });
  assert.equal(await pages(un['Aria Testwell/Essay.pdf']), 2);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.xfb')), 'false');
  await page.click('#exportBtn'); await page.waitForSelector('#xFb');
  assert.equal(await page.$eval('#xFb', e => e.checked), false);
  assert.ok(!/feedback page/.test(await page.$eval('#xOptsSay', e => e.textContent)));
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('a long comment and many comments on the paper run onto a second feedback page, and page numbers count both', async () => {
  const { page, close } = await openApp(browser, { seed, feedback: true });
  const dl = await catchDownloads(page);
  await openZip(page, zip, 'River essay.zip');
  await score(page, [2, 2, 2]);
  await page.$eval('.cmt textarea', (t, v) => { t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, Array.from({ length: 22 }, (_, i) => 'Sentence ' + (i + 1) + ' of a long comment about the essay and what to try next time.').join(' '));
  for (let i = 0; i < 6; i++) {
    await setTool(page, 'note'); await require('./helpers/app').clickAt(page, 0, 300, 200 + i * 60);
    await page.waitForSelector('.pop textarea'); await page.keyboard.type('Comment number ' + (i + 1) + ' on this page, long enough to take up a line or two of the list.'); await page.click('.pop [data-a="ok"]');
  }
  await setTool(page, 'select'); await settle(page);
  const { un } = await exportZip(page, dl);
  const aria = un['Aria Testwell/Essay.pdf'];
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out', 'feedback-long.pdf'), aria);
  assert.equal(await pages(aria), 4, 'two feedback pages, then her two');
  assert.deepEqual((await page.evaluate(() => window.__gs.fbData(0))).notes.map(n => n.page), [0, 0, 0, 0, 0, 0], 'all six are on her first page, which the list calls p. 3');
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});
