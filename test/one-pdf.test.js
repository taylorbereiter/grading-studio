// One PDF a student: every paper of theirs, with the feedback page first, in one file. On unless the teacher turns it off
// under Options on the Return tab; then each paper goes back as its own file, as before.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, markPage, setTool, drag, score, settle, catchDownloads, closeBox } = require('./helpers/app');
const { standardFiles, makePaper, makeDocx, zipOf } = require('./helpers/fixtures');

let browser, files;
before(async () => { browser = await launch(); files = await standardFiles(); });
after(async () => { await browser.close(); });

const pages = async u => (await PDFDocument.load(u)).getPageCount();
// Bram turned in two files; both get a mark and he gets a score.
async function bramMarked(page) {
  await openZip(page, zipOf(files), 'River essay.zip');
  await goToStudent(page, 1);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  const last = await page.evaluate(() => window.__gs.state().pages.length - 1);
  await drag(page, last, [[100, 300], [200, 330]]);
  await score(page, [3, 3, 3]);
  await settle(page);
}
async function exportZip(page, dl) {
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  return unzipSync(got.bytes);
}

test('Return marked files: a student with two papers gets one PDF, the feedback page first; the checkbox turns it off', async () => {
  const { page, close } = await openApp(browser, { one: true, names: true, feedback: true });
  const dl = await catchDownloads(page);
  await bramMarked(page);
  let z = await exportZip(page, dl);
  const bram = Object.keys(z).filter(k => k.startsWith('Bram'));
  assert.deepEqual(bram, ['Bram Sample/Bram Sample - River essay - Graded.pdf'], 'one file, in his folder');
  assert.equal(await pages(z[bram[0]]), 3, 'the feedback page, then a page from each paper');

  // The Options say it and the checkbox turns it off, remembered; then each paper goes back on its own.
  await page.click('#exportBtn');
  await page.waitForSelector('#xOne');
  await page.evaluate(() => { document.querySelector('#xOpts').open = true; });
  assert.equal(await page.$eval('#xOne', e => e.checked), true);
  assert.match(await page.$eval('#xOptsSay', e => e.textContent), /one PDF a student/);
  await page.click('#xOne');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.xone')), 'false');
  await page.waitForFunction(() => document.querySelector('#xOne') && !document.querySelector('#xOne').checked);
  await closeBox(page, '#dlgBox .bf [data-close]');
  z = await exportZip(page, dl);
  assert.deepEqual(Object.keys(z).filter(k => k.startsWith('Bram')).sort(), ['Bram Sample/Bram Sample - River essay - Graded - Essay.pdf', 'Bram Sample/Bram Sample - River essay - Graded - Extra notes.pdf']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Export one student: two papers come down as one PDF, not a ZIP', async () => {
  const { page, close } = await openApp(browser, { one: true, names: true, feedback: true });
  const dl = await catchDownloads(page);
  await bramMarked(page);
  const got = await dl.next(() => page.click('#oneOutBtn'));
  assert.equal(got.name, 'Bram Sample - River essay - Graded.pdf');
  assert.equal(await pages(got.bytes), 3);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a Word paper joins the PDF as pages; names off, the file is the student and the assignment', async () => {
  const mine = {
    'Eli Pretend/Essay.pdf': await makePaper({ title: 'Eli Pretend essay' }),
    'Eli Pretend/Reflection.docx': makeDocx('Eli Pretend wrote a short reflection in Word.'),
    'Fay Notreal/Essay.pdf': await makePaper({ title: 'Fay Notreal essay' }),
  };
  const { page, close } = await openApp(browser, { one: true, seed: { ls: { 'gs.xall': 'true' } } });
  await openZip(page, zipOf(mine), 'River essay.zip');
  await markPage(page, 0);
  await settle(page);
  const plan = await page.evaluate(() => window.__gs.exportPlan(true).filter(o => o.st.key === 'Eli Pretend').map(o => [o.path, !!o.one, o.d ? o.d.pages.length : -1, o.d && o.d.words ? o.d.words.length : 0]));
  assert.deepEqual(plan, [['Eli Pretend/Eli Pretend - River essay.pdf', true, 1, 1]]);
  const dl = await catchDownloads(page);
  const got = await dl.next(() => page.click('#oneOutBtn'));
  assert.equal(got.name, 'Eli Pretend - River essay.pdf');
  assert.ok(await pages(got.bytes) >= 2, 'the marked page, then the Word paper');
  assert.deepEqual(page.errors, []);
  await close();
});
