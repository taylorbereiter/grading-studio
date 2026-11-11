// Returned files are named for the student, the assignment, and what they are: "Aria Testwell - River essay - Graded.pdf",
// or "- Feedback" when there is no score. Folders stay as they came in. One checkbox under Options turns it off.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, markPage, setTool, drag, score, settle, catchDownloads, closeBox } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, files;
before(async () => { browser = await launch(); files = await standardFiles(); });
after(async () => { await browser.close(); });

async function marked(page) {
  await openZip(page, zipOf(files), 'River essay.zip');
  await markPage(page, 0);
  await score(page, [3.5, 3.5, 3.5]);   // Aria has a score
  await goToStudent(page, 1);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);   // Bram: a mark, no score
  await settle(page);
}
async function exportZip(page, dl) {
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  return Object.keys(unzipSync(got.bytes)).sort();
}

test('Return marked files: each file is named student, assignment, and Graded or Feedback, in its student’s folder', async () => {
  const { page, close } = await openApp(browser, { names: true });
  const dl = await catchDownloads(page);
  await marked(page);
  assert.deepEqual(await exportZip(page, dl), [
    'Aria Testwell/Aria Testwell - River essay - Graded.pdf',
    'Bram Sample/Bram Sample - River essay - Feedback.pdf',
    'Cleo Fixture/Cleo Fixture - River essay - Graded.pdf',   // a grade typed on the paper is a score
    'Grade sheet - River essay.pdf',
  ]);

  // The Options say what the names will look like, and the checkbox turns it off, remembered.
  await page.click('#exportBtn');
  await page.waitForSelector('#xNames');
  await page.evaluate(() => { document.querySelector('#xOpts').open = true; });
  assert.match(await page.$eval('#xNamesSay', e => e.textContent), /Like “Aria Testwell - River essay - Graded\.pdf”/);
  await page.click('#xNames');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.xnames')), 'false');
  assert.match(await page.$eval('#xNamesSay', e => e.textContent), /keep the names they were turned in with/);
  await closeBox(page, '#dlgBox .bf [data-close]');
  assert.deepEqual(await exportZip(page, dl), ['Aria Testwell/Essay.pdf', 'Bram Sample/Essay.pdf', 'Cleo Fixture/Essay.pdf', 'Grade sheet - River essay.pdf']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Export one student: the file and the ZIP carry the same name, and two files keep their own names on the end', async () => {
  const { page, close } = await openApp(browser, { names: true });
  const dl = await catchDownloads(page);
  await openZip(page, zipOf(files), 'River essay.zip');
  await markPage(page, 0);
  await score(page, [4, 4, 4]);
  await settle(page);
  let got = await dl.next(() => page.click('#oneOutBtn'));
  assert.equal(got.name, 'Aria Testwell - River essay - Graded.pdf');

  await goToStudent(page, 1);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  const last = await page.evaluate(() => window.__gs.state().pages.length - 1);
  await drag(page, last, [[100, 300], [200, 330]]);
  await settle(page);
  got = await dl.next(() => page.click('#oneOutBtn'));
  assert.equal(got.name, 'Bram Sample - River essay - Feedback.zip');
  assert.deepEqual(Object.keys(unzipSync(got.bytes)).sort(), ['Bram Sample - River essay - Feedback - Essay.pdf', 'Bram Sample - River essay - Feedback - Extra notes.pdf']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('names: the assignment’s own name, Feedback for a formative, and nothing a file system refuses', async () => {
  const { page, close } = await openApp(browser, { names: true });
  await openZip(page, zipOf(files), 'River essay.zip');
  await markPage(page, 0);
  await score(page, [4, 4, 4]);
  await settle(page);
  const names = () => page.evaluate(() => window.__gs.nameOut(window.__gs.exportPlan(true)).map(o => o.path).filter(p => p.startsWith('Aria')));
  await page.evaluate(() => { window.__gs.state().batch.assignment = { id: 'nope', name: 'Unit 2: Rivers / essay?', type: 'sa' }; });
  assert.deepEqual(await names(), ['Aria Testwell/Aria Testwell - Unit 2 Rivers essay - Graded.pdf']);
  await page.evaluate(() => { window.__gs.state().batch.assignment = { id: 'nope', name: 'River lab', type: 'fm' }; });
  assert.deepEqual(await names(), ['Aria Testwell/Aria Testwell - River lab - Feedback.pdf'], 'a formative is feedback only, even with a number on it');
  assert.deepEqual(page.errors, []);
  await close();
});
