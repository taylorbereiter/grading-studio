// One bad file doesn't lose the rest of the export, and every file left out is named, with the reason.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { unzipSync, strToU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, setTool, drag, settle, catchDownloads, closeBox } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');

let browser, files;
before(async () => { browser = await launch(); files = await standardFiles(); });
after(async () => { await browser.close(); });

const scribble = async (page, i) => { await goToStudent(page, i); await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]); };
const breakFile = (page, i) => page.evaluate(i => { window.__gs.state().batch.students[i].files[0].data = new TextEncoder().encode('%PDF-1.7 this file got damaged'); }, i);
async function runExport(page, go = 'zip') {
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="' + go + '"]', { timeout: 60000 });
}
const finished = page => page.waitForFunction(() => /^(Done\.|Nothing could)/.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
const report = page => page.$eval('#xFails', e => e.textContent);

test('a marked file that can’t be made: the others come out, and the bad one is named with its reason', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zipOf(files), 'River essay.zip');
  await scribble(page, 0); await scribble(page, 1); await goToStudent(page, 2); await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await settle(page);
  await breakFile(page, 1);
  await runExport(page);
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await finished(page);
  const un = unzipSync(got.bytes);
  assert.ok(un['Aria Testwell/Essay.pdf'], 'before the bad file');
  assert.ok(un['Cleo Fixture/Essay.pdf'], 'after the bad file');
  assert.ok(un['Grade sheet - River essay.pdf']);
  assert.equal(un['Bram Sample/Essay.pdf'], undefined);
  assert.equal((await PDFDocument.load(un['Aria Testwell/Essay.pdf'])).getPageCount(), 2);
  assert.match(await page.$eval('#xStatus', e => e.textContent), /^Done\. 2 files in the ZIP\.$/, 'counts what’s really in it');
  const r = await report(page);
  assert.match(r, /1 file isn’t in this export/);
  assert.match(r, /Bram Sample\/Essay\.pdf: the PDF is damaged/);
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('a paper that never opened is named too, instead of quietly missing', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  const paper = await makePaper();
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Eli Broken/Essay.pdf': strToU8('%PDF-1.7 not really'), 'Fay Fine/Essay.pdf': paper }), 'Mixed.zip');
  await scribble(page, 0); await scribble(page, 2); await settle(page);
  await runExport(page);
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await finished(page);
  const un = unzipSync(got.bytes);
  assert.ok(un['Aria Testwell/Essay.pdf'] && un['Fay Fine/Essay.pdf']);
  assert.match(await report(page), /Eli Broken\/Essay\.pdf: the PDF is damaged/);
  await dl.close(); await close();
});

test('Save into a folder: a file the folder refuses is named, and the rest are written', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  await scribble(page, 0); await scribble(page, 1); await settle(page);
  await page.evaluate(() => {
    window.__wrote = [];
    const dir = pre => ({ name: 'Marked', getDirectoryHandle: async n => dir(pre + n + '/'), getFileHandle: async n => {
      if (pre === 'Bram Sample/') throw new DOMException('refused', 'NotAllowedError');
      return { createWritable: async () => ({ write: async () => {}, close: async () => { window.__wrote.push(pre + n); } }) };
    } });
    window.showDirectoryPicker = async () => dir('');
  });
  await runExport(page, 'dir');
  await page.click('#dlgBox [data-go="dir"]');
  await finished(page);
  const wrote = await page.evaluate(() => window.__wrote);
  assert.ok(wrote.includes('Aria Testwell/Essay.pdf'), wrote.join());
  assert.ok(wrote.includes('Cleo Fixture/Essay.pdf'), 'a file after the refused one: ' + wrote.join());
  assert.match(await report(page), /Bram Sample\/Essay\.pdf: the folder didn’t allow saving it/);
  await close();
});

test('when nothing at all could be made: it says so, and there’s no empty ZIP', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': await makePaper(), 'Bram Sample/Notes.txt': strToU8('words') }), 'One.zip');
  await scribble(page, 0); await settle(page);
  await breakFile(page, 0);
  await runExport(page);
  await page.click('#xOpts summary');
  await page.click('#xSheet');
  await page.evaluate(() => { window.__blobs = 0; const u = URL.createObjectURL; URL.createObjectURL = b => { window.__blobs++; return u.call(URL, b); }; });
  await page.click('#dlgBox [data-go="zip"]');
  await finished(page);
  assert.equal(await page.$eval('#xStatus', e => e.textContent), 'Nothing could be exported.');
  assert.equal(await page.evaluate(() => window.__blobs), 0);
  assert.match(await report(page), /Aria Testwell\/Essay\.pdf/);
  await close();
});

test('a page too big to draw on: the export finishes, the others come out, and the big one is named', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': await makePaper(), 'Bo Poster/Scan.pdf': await makePaper({ title: 'A poster', size: [9000, 14000] }), 'Cleo Fixture/Essay.pdf': await makePaper() }), 'Big.zip');
  await page.evaluate(() => { for (const st of window.__gs.state().batch.students) st.files[0].marks[0] = [{ t: 'check', color: '#D7263D', x: 100, y: 100, size: 22 }]; window.__gs.saveNow(); });
  await settle(page);
  await runExport(page);
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await finished(page);
  const un = unzipSync(got.bytes);
  assert.ok(un['Aria Testwell/Essay.pdf'] && un['Cleo Fixture/Essay.pdf'], 'before and after the big one');
  assert.equal(un['Bo Poster/Scan.pdf'], undefined);
  assert.match(await report(page), /Bo Poster\/Scan\.pdf: one of its pages is too big/);
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('during anonymous grading the report says which paper, with no names', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zipOf(files), 'River essay.zip');
  await page.evaluate(() => window.__gs.setAnon(true));
  await scribble(page, 0); await scribble(page, 1); await settle(page);
  await breakFile(page, 1);
  await runExport(page);
  await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await finished(page);
  const r = await report(page), shown = await page.$$eval('#stuList .nm', e => e.map(x => x.textContent));
  assert.match(r, /1 file isn’t in this export/);
  const named = /(Paper \d+): the PDF is damaged/.exec(r);
  assert.ok(named && shown.includes(named[1]), r);
  assert.doesNotMatch(r, /Bram|Essay/);
  await dl.close(); await close();
});

test('Closing the export box while it runs doesn’t lose the export: the ZIP still comes, and it says so', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  const paper = await makePaper();
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Essay.pdf': paper }), 'Mine.zip');
  await scribble(page, 0); await settle(page);
  await runExport(page);
  const got = await dl.next(async () => { await page.click('#dlgBox [data-go="zip"]'); await closeBox(page, '#dlgBox .bf [data-close]'); });
  assert.match(got.name, /Marked - /);
  await page.waitForFunction(() => /Done\. 1 file in the ZIP/.test((document.querySelector('.toast') || {}).textContent || ''), { timeout: 15000 });
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});
