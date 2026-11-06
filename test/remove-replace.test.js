// Remove and Replace on any file of a student's paper, including files that came with the download. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goToStudent, markPage, answerDlg, settle, catchDownloads } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip, retake;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); retake = Array.from(await makePaper({ title: 'Bram Sample retake', pages: 3 })); });
after(async () => { await browser.close(); });

const ESSAY = 'Bram Sample/Essay.pdf', NOTES = 'Bram Sample/Extra notes.pdf';
const bram = page => page.evaluate(() => { const st = window.__gs.state().batch.students.find(s => s.key === 'Bram Sample'); const n = f => Object.values(f.marks).reduce((a, m) => a + m.length, 0); return { files: st.files.map(f => f.path), gone: (st.gone || []).map(f => [f.path, n(f)]) }; });
const goneSays = (page, rx) => page.waitForFunction(src => { const e = document.querySelector('.gonelist'); return e && new RegExp(src, 's').test(e.textContent); }, { timeout: 15000 }, rx.source);
const twoClicks = async (page, sel) => { await page.waitForSelector(sel); await page.click(sel); await page.waitForFunction(s => document.querySelector(s).dataset.armed, {}, sel); await page.click(sel); };

test('Remove, Undo, Bring back and Replace on downloaded files, kept after reopening and left out of the export', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zip, 'River essay.zip');
  await goToStudent(page, 1);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].key), 'Bram Sample');
  await markPage(page, 0);
  await settle(page);
  const marks = (await page.evaluate(() => window.__gs.state().batch.students[1].files[0].marks[0].length));
  assert.ok(marks > 0);

  // No marks on the notes: two clicks and it's gone, with Undo in the note.
  await twoClicks(page, '[data-rmfile="' + NOTES + '"]');
  await page.waitForSelector('.gonelist');
  assert.deepEqual(await bram(page), { files: [ESSAY], gone: [[NOTES, 0]] });
  await goneSays(page, /Removed files.*Extra notes\.pdf · 1 page · removed/);
  await page.click('.toast .tact');
  await page.waitForFunction(() => !document.querySelector('.gonelist'));
  assert.deepEqual((await bram(page)).files.sort(), [ESSAY, NOTES]);
  await twoClicks(page, '[data-rmfile="' + NOTES + '"]');
  await page.waitForSelector('.gonelist');

  // The marked essay asks first, and keeps its marks while it's out.
  await twoClicks(page, '[data-rmfile="' + ESSAY + '"]');
  await answerDlg(page);
  assert.match(page.lastDialog, /You have \d+ marks on it/);
  await page.waitForFunction(() => document.querySelectorAll('.gonerow').length === 2);
  assert.deepEqual(await bram(page), { files: [], gone: [[NOTES, 0], [ESSAY, marks]] });
  await page.click('[data-backfile="' + ESSAY + '"]');
  await page.waitForFunction(() => document.querySelectorAll('.gonerow').length === 1);
  assert.deepEqual(await bram(page), { files: [ESSAY], gone: [[NOTES, 0]] });

  // Replace: the new file takes the essay's place; the essay waits with its marks.
  await page.evaluate(b => { const st = window.__gs.state().batch.students[1]; return window.__gs.replaceFile(st, 'Bram Sample/Essay.pdf', new File([new Uint8Array(b)], 'Retake scan.pdf', { type: 'application/pdf' })); }, retake);
  await waitPaper(page);
  assert.deepEqual(await bram(page), { files: ['Bram Sample/Retake scan.pdf'], gone: [[NOTES, 0], [ESSAY, marks]] });
  assert.match(await page.$eval('#paper .addtag', e => e.textContent), /^Replaced Essay\.pdf · /);
  await goneSays(page, /Essay\.pdf · 1 page · \d+ marks · replaced/);
  await markPage(page, 0);
  await settle(page);

  // Reopen the download: still removed, marks still on the essay.
  await page.reload();
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, 1);
  assert.deepEqual(await bram(page), { files: ['Bram Sample/Retake scan.pdf'], gone: [[NOTES, 0], [ESSAY, marks]] });
  await page.waitForSelector('.gonelist');

  // The export has the retake and not the removed essay.
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  const names = Object.keys(unzipSync(got.bytes)).filter(n => n.startsWith('Bram Sample/'));
  assert.deepEqual(names, ['Bram Sample/Retake scan.pdf']);
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('with her rubric page on the end of each paper, the file still has Move to, Replace and Remove', async () => {
  const rubric = Buffer.from(await makePaper({ title: 'Rubric page' })).toString('base64');
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify({ mode: 'rubric', criteria: ['A', 'B', 'C'], rubricPage: { id: 'r1', name: 'Rubric page.pdf' }, rubricPos: 'end' }), 'gs.rp.r1': JSON.stringify(rubric) } } });
  await openZip(page, zip, 'River essay.zip');
  await page.waitForFunction(() => window.__gs.state().batch.students[0].files.some(f => f.virtual));
  await goToStudent(page, 0);
  await page.waitForSelector('[data-rmfile="Aria Testwell/Essay.pdf"]');
  assert.ok(await page.$('[data-rplfile="Aria Testwell/Essay.pdf"]'));
  assert.ok(await page.$('[data-mvfile="Aria Testwell/Essay.pdf"]'));
  assert.deepEqual(page.errors, []);
  await close();
});
