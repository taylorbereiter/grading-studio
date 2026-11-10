// Export one student's paper on its own, from the score panel, so feedback can go out right after marking them.
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
const say = page => page.$eval('#oneOutSay', e => e.textContent);

test('Export one student: just their marked file, named for them, and a sent tag that stays', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zipOf(files), 'River essay.zip');
  await markPage(page, 0);
  await settle(page);
  assert.match(await page.$eval('#oneOutBtn', e => e.textContent), /Export Aria Testwell’s paper/);
  const got = await dl.next(() => page.click('#oneOutBtn'));
  assert.equal(got.name, 'Aria Testwell - Essay.pdf', 'one file comes out as that PDF, named for the student');
  assert.ok(isPdf(got.bytes));
  assert.equal((await PDFDocument.load(got.bytes)).getPageCount(), 2, 'a marked file goes back whole');
  await page.waitForFunction(() => /Exported at/.test(document.querySelector('#oneOutSay').textContent));
  assert.equal(await page.$$eval('#stuList .stu .sent', els => els.length), 1, 'only Aria shows as sent');
  assert.match(await page.$eval('#stuList .stu.on', e => e.textContent), /sent/);

  // Dov has nothing marked: nothing downloads, and she's told why.
  await goToStudent(page, 3);
  assert.equal(await say(page), '', 'nothing said until one has gone out');
  assert.match(await page.$eval('#oneOutBtn', e => e.title), /just this student’s marked file/);
  await page.click('#oneOutBtn');
  await page.waitForFunction(() => /Nothing on .* is marked yet/.test(document.body.textContent), { timeout: 60000 });
  assert.equal(await page.$$eval('#stuList .stu .sent', els => els.length), 1);

  // The sent tag is kept with her marks.
  await goToStudent(page, 0);
  await page.evaluate(() => window.__gs.saveNow());
  await page.reload(); await appReady(page);
  await openZip(page, zipOf(files), 'River essay.zip');
  await page.waitForSelector('#stuList .stu .sent');
  assert.equal(await page.$$eval('#stuList .stu .sent', els => els.length), 1);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Export one student with two marked files: one ZIP named for them, files only theirs', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zipOf(files), 'River essay.zip');
  await goToStudent(page, 1);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  const last = await page.evaluate(() => window.__gs.state().pages.length - 1);
  assert.ok(last >= 1, 'Bram has two files');
  await drag(page, last, [[100, 300], [200, 330]]);
  await settle(page);
  const got = await dl.next(() => page.click('#oneOutBtn'));
  assert.equal(got.name, 'Bram Sample - River essay.zip');
  const un = unzipSync(got.bytes);
  assert.deepEqual(Object.keys(un).sort(), ['Bram Sample - Essay.pdf', 'Bram Sample - Extra notes.pdf']);
  for (const b of Object.values(un)) assert.ok(isPdf(b));
  assert.deepEqual(page.errors, []);
  await close();
});
