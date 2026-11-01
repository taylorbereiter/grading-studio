// Her own Word rubric in the Export, an older rubric's highlights, and Not now while newer work comes in from the folder. In the real built app, with made-up names.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync, strFromU8, zipSync, strToU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, openZip, pickFile, settle, catchDownloads, score, waitPaper } = require('./helpers/app');
const { makePaper, makeDocx, zipOf } = require('./helpers/fixtures');
const { linkFolder, folderWait, folderRead, folderWrite } = require('./helpers/carry');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const papers = async () => zipOf({ 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann Alpha essay' }), 'Ben Beta/Essay.pdf': await makePaper({ title: 'Ben Beta essay' }) });
function wordRubric() {
  const cell = t => '<w:tc><w:tcPr></w:tcPr><w:p><w:r><w:t>' + t + '</w:t></w:r></w:p></w:tc>', levels = [4, 3, 2, 1, 0];
  const rows = ['Thesis', 'Evidence', 'Style'].map(n => '<w:tr>' + cell(n) + levels.map(l => cell(String(l))).join('') + '</w:tr>').join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr>' + cell('Criterion') + levels.map(l => cell(String(l))).join('') + '</w:tr>' + rows + '</w:tbl></w:body></w:document>';
  return zipSync({ ...unzipSync(makeDocx('x')), 'word/document.xml': strToU8(xml) });
}
const addRubric = async (page, name) => {
  await page.click('#editRubric'); await page.waitForSelector('#setupBody');
  const done = await pickFile(page, '#rpIn', wordRubric(), name); await sleep(500); done();
  await page.click('#dlgBox [data-save]'); await sleep(600);
  if (await page.$('#askDlg [data-ok]')) await answerDlg(page);
  await page.waitForFunction(() => document.querySelector('#dlg').hidden); await page.waitForSelector('td.rcell');
};
const click3 = async page => { const c = await page.$$('td.rcell'); await c[1].click(); await sleep(100); await c[6].click(); await sleep(100); await c[11].click(); await sleep(1000); };
const exportZip = async (page, dl) => {
  await page.click('#exportBtn'); await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 40000 });
  return unzipSync((await dl.next(() => page.click('#dlgBox [data-go="zip"]'))).bytes);
};

test('a highlighted copy of her own Word rubric comes back in the Export, even with nothing else marked, and blank copies stay out', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, await papers(), 'Tide.zip');
  await addRubric(page, 'My rubric.docx');
  await click3(page); await settle(page);
  const un = await exportZip(page, dl), names = Object.keys(un);
  assert.ok(names.includes('Ann Alpha/My rubric.docx'), 'her highlighted copy is in the ZIP: ' + names.join(', '));
  assert.ok(!names.includes('Ben Beta/My rubric.docx'), 'a blank copy isn’t');
  const doc = strFromU8(unzipSync(un['Ann Alpha/My rubric.docx'])['word/document.xml']);
  assert.ok((doc.match(/w:shd/g) || []).length >= 3, 'with the highlights in it');
  await close();
});

test('highlights on a rubric replaced under a new name elsewhere: she’s told, and the file list stays as it is', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await papers(), 'Tide.zip');
  await addRubric(page, 'My rubric v2.docx');
  await settle(page);
  const id = await page.evaluate(async () => {
    const id = window.__gs.state().batch.id;
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('edits', 'readwrite'); tx.objectStore('edits').put({ data: new Uint8Array([1]), t: Date.now() }, id + '|Ben Beta/My rubric.docx'); tx.oncomplete = res; });
    db.close(); return id;
  });
  await page.click('#closeBtn'); await page.waitForFunction(() => !document.querySelector('#start').hidden);
  await page.evaluate(id => { window.__gs.reopenKept(id); }, id);
  await page.waitForFunction(() => /older rubric is kept for 1 student/.test(document.body.textContent), { timeout: 20000 });
  await close();
});

test('Not now while newer work comes in from the folder: the out-of-date copy leaves the screen and can’t write over it', async () => {
  const setup = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'] };
  const lib = JSON.stringify({ classes: [{ id: 'c1', name: '9A', names: [], units: [{ id: 'u1', name: 'Rivers', items: [{ id: 'asg1', classId: 'c1', name: 'River card', setup }] }] }], loose: { id: '', units: [] } });
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': lib } } });
  await page.evaluate(() => [...document.querySelectorAll('.card')].find(x => x.textContent.includes('River card')).querySelector('[data-open-asg]').click());
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', await papers(), 'River.zip');
  await waitPaper(page); clean();
  await linkFolder(page, 'NotNow');
  await score(page, [3, 3, 3]); await settle(page); await folderWait(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id), now = Date.now();
  // The other computer scored Ben, and its card has a row more, with the work as it was.
  const there = await folderRead(page, 'downloads', id, 'work.json');
  there.s['Ben Beta'] = { ...(there.s['Ben Beta'] || { f: {}, h: {} }), g: { rubric: [4, 4, 4], points: '', comment: 'from other', at: now }, v: { other: now } };
  there.t = now; there.sv = { ...there.sv, other: now };
  await folderWrite(page, ['downloads', id, 'work.json'], there);
  const lf = await folderRead(page, 'library.json'), l = JSON.parse(lf.ls['gs.lib']), it = l.classes[0].units[0].items[0];
  it.setup = { ...it.setup, criteria: ['Thesis', 'Evidence', 'Style', 'Voice'] }; it.v = { ...(it.v || {}), other: now }; it.fv = { ...(it.fv || {}), setup: { other: now } }; it.at = now;
  lf.ls['gs.lib'] = JSON.stringify(l);
  await folderWrite(page, ['library.json'], lf);
  await page.evaluate(() => { window.__rec = 'running'; window.__gs.folderReconcile().then(() => { window.__rec = 'done'; }, e => { window.__rec = 'err ' + e; }); });
  await page.waitForFunction(() => document.querySelector('#cfBox') || window.__rec !== 'running', { timeout: 30000 });
  const asked = !!(await page.$('#cfBox'));
  if (asked) await page.click('[data-cflater]');
  await page.waitForFunction(() => window.__rec !== 'running', { timeout: 30000 });
  await sleep(500);
  const st = await page.evaluate(() => ({ batch: !!window.__gs.state().batch, start: !document.querySelector('#start').hidden, rec: window.__rec }));
  assert.equal(st.rec, 'done');
  assert.ok(asked, 'the rubrics disagree, so she is asked');
  assert.deepEqual([st.batch, st.start], [false, true], 'Not now leaves the start screen, with no out-of-date copy open');
  await sleep(1500);
  await folderWait(page);
  const after = await folderRead(page, 'downloads', id, 'work.json');
  assert.deepEqual(after.s['Ben Beta'].g.rubric, [4, 4, 4], 'what came in is still there');
  await close();
});
