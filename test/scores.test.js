// Everything about scores, through the real built app: partial scores, 0, missing/excused/late, when a score changed,
// doubtful readings, the check before exporting, and safe spreadsheets.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync, zipSync, strToU8 } = require('fflate');
const { PDFDocument, PDFName, PDFString, PDFHexString } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, openZip, goToStudent, score, settle, catchDownloads, appReady, setTool, clickAt, workOf, closeBox } = require('./helpers/app');
const { standardFiles, makePaper, makeDocx, zipOf } = require('./helpers/fixtures');
const { loadLegacy } = require('./helpers/legacy');

let browser, zip, printedZip;
before(async () => { browser = await launch(); const f = await standardFiles(); printedZip = zipOf(f); zip = zipOf({ ...f, 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'Cleo Fixture essay' }) }); });
after(async () => { await browser.close(); });

// A fresh copy of the app with the standard stack open, with nothing printed on Cleo's paper. In printedZip the student at index 2 has "9.5/12 = 88%" printed on the paper.
async function stack(z = zip, name = 'River essay.zip') {
  const app = await openApp(browser);
  await openZip(app.page, z, name);
  return app;
}
const stu = (page, i) => page.evaluate(i => { const G = window.__gs, st = G.state().batch.students[i]; return { grade: st.grade, computed: G.gradeOf(st), key: st.key, found: st.found, doubts: (st.doubts || []).map(d => d.text), n: st.foundCount }; }, i);
// Her "Use it" for the student's first reading waiting to be confirmed.
const useReading = (page, i) => page.evaluate(i => { const G = window.__gs, st = G.state().batch.students[i]; G.setReading(st, G.readKey(st.doubts[0]), '1'); }, i);
const clipOn = page => page.evaluate(() => { window.__clip = null; navigator.clipboard.writeText = t => { window.__clip = t; return Promise.resolve(); }; });
const clip = page => page.waitForFunction(() => window.__clip != null).then(() => page.evaluate(() => window.__clip));
const noErrors = page => assert.deepEqual(page.errors, []);
// Types a comment on page 1 of a student's file, the way the Text tool leaves it, then reads every paper again.
const addText = (page, i, text) => page.evaluate(async (i, text) => {
  const G = window.__gs, f = G.state().batch.students[i].files[0];
  (f.marks[0] ||= []).push({ t: 'text', x: 80, y: 200, text, size: 14, color: 'red' });
  await G.scanAll();
}, i, text);

/* ---------------- partial scores ---------------- */
test('a partial rubric score says so in the panel, the student list, the Grades list and on the way out', async () => {
  const { page, close } = await stack();
  await score(page, [4]);
  const s = await stu(page, 0);
  assert.deepEqual(s.computed, { total: 4, pct: 64, done: false, partial: true });
  assert.match(await page.$eval('#grade .total', e => e.textContent), /Partial: 1 of 3 rows scored/);
  assert.match(await page.$eval('#stuList .stu[data-i="0"]', e => e.textContent), /4partial/);
  await page.click('#gradesBtn');
  await page.waitForSelector('table.gl');
  assert.match(await page.$eval('.bh .muted', e => e.textContent), /0 of 4 scored · 1 partial/);
  const row = await page.$eval('tr.go[data-i="0"]', e => e.textContent);
  assert.match(row, /4 partial/);
  assert.equal(await page.$$eval('tr.go[data-i="0"] td.part', a => a.length), 2, 'total and percent are flagged');
  const head = await page.evaluate(() => window.__gs.tableHead()), cells = await page.evaluate(() => window.__gs.tableRow(window.__gs.state().batch.students[0], 0));
  assert.equal(cells[head.indexOf('Total / 12')], '4 (partial)');
  assert.equal(cells[head.indexOf('Percent')], '64 (partial)');
  assert.equal(cells[head.indexOf('Status')], 'Partial: 1 of 3 rows scored');
  noErrors(page); await close();
});

test('a whole rubric is not partial, and an empty one is not partial', async () => {
  const { page, close } = await stack();
  await score(page, [3.5, 3.5, 3.5]);
  assert.deepEqual((await stu(page, 0)).computed, { total: 10.5, pct: 93, done: true });
  assert.deepEqual((await stu(page, 1)).computed, { total: null, pct: null, done: false });
  noErrors(page); await close();
});

test('copying warns before a partial score goes out, marks it, and can be called off', async () => {
  const { page, close } = await stack();
  await clipOn(page);
  await score(page, [4]);
  await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
  await page.click('[data-cp="total"]');
  await answerDlg(page);
  assert.deepEqual((await clip(page)).split('\n').slice(0, 2), ['4 (partial)', ''], 'marked, in place');
  assert.match(page.lastDialog, /1 student has only part of the rubric scored: Aria Testwell/);
  // saying no copies nothing
  await page.evaluate(() => { window.__clip = null; });
  await page.click('[data-cp="pct"]');
  await answerDlg(page, { yes: false });
  await new Promise(r => setTimeout(r, 200));
  assert.equal(await page.evaluate(() => window.__clip), null);
  // a single partial cell, her usual way of copying, asks too
  await page.click('tr.go[data-i="0"] td.part');
  await answerDlg(page, { yes: false });
  await new Promise(r => setTimeout(r, 200));
  assert.equal(await page.evaluate(() => window.__clip), null);
  await page.click('tr.go[data-i="0"] td.part');
  await answerDlg(page);
  assert.equal(await clip(page), '4');
  assert.match(page.lastDialog, /1 of 3 rows scored, so 4 isn’t final/);
  noErrors(page); await close();
});

test('nothing partial, no question', async () => {
  const { page, close } = await stack();
  await clipOn(page);
  await score(page, [3, 3, 3]);
  await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
  await page.click('[data-cp="total"]');
  assert.equal((await clip(page)).split('\n')[0], '9');
  assert.equal(await page.$('#askDlg'), null);
  noErrors(page); await close();
});

/* ---------------- 0 ---------------- */
test('0 on a rubric row is a real score everywhere', async () => {
  const { page, close } = await stack();
  await clipOn(page);
  await score(page, [0, 0, 0]);
  assert.deepEqual((await stu(page, 0)).computed, { total: 0, pct: 48, done: true }, 'the scale itself is unchanged');
  assert.equal(await page.$eval('.scores[data-c="0"] button[data-v="0"]', b => b.getAttribute('aria-pressed')), 'true');
  assert.match(await page.$eval('.crit .cn em', e => e.textContent), /^0 \/ 4$/);
  assert.equal(await page.$eval('#grade .total b', e => e.textContent), '0');
  assert.equal(await page.$eval('#stuList .stu[data-i="0"] .sc', e => e.textContent), '0');
  await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
  assert.deepEqual(await page.$$eval('tr.go[data-i="0"] td.c', a => a.map(c => c.dataset.copy)), ['0', '0', '0', '0', '48']);
  await page.click('[data-cp="total"]');
  assert.equal((await clip(page)).split('\n')[0], '0');
  await closeBox(page);
  // one 0 among other rows, and undoing it
  await goToStudent(page, 1);
  await score(page, [0, 4]);
  assert.deepEqual((await stu(page, 1)).computed, { total: 4, pct: 64, done: false, partial: true });
  await score(page, [0]);
  assert.equal((await stu(page, 1)).grade.rubric[0], null, 'a second click takes it off');
  await settle(page);
  await page.reload(); await appReady(page);
  await openZip(page, zip, 'River essay.zip');
  assert.deepEqual((await stu(page, 0)).grade.rubric, [0, 0, 0], 'a 0 comes back after a reload');
  assert.deepEqual((await stu(page, 0)).computed, { total: 0, pct: 48, done: true });
  noErrors(page); await close();
});

test('a typed 0 on the Grade sheet is kept and counts', async () => {
  const { page, close } = await stack();
  const g = await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[1]; st.grade.sheet = 0; G.saveNow(); return { c: G.gradeOf(st), saved: JSON.parse(localStorage.getItem(G.state().batch.id)).s[st.key] && JSON.parse(localStorage.getItem(G.state().batch.id)).s[st.key].g.sheet }; });
  assert.equal(g.saved, 0, 'saved even as the number 0');
  assert.equal(g.c.total, 0);
  noErrors(page); await close();
});

/* ---------------- missing, excused, late ---------------- */
test('missing and excused are their own states, with no number and no penalty', async () => {
  const { page, close } = await stack();
  await clipOn(page);
  await page.click('[data-status="missing"]');
  assert.deepEqual((await stu(page, 0)).computed, { total: null, pct: null, done: true, status: 'missing' });
  assert.equal((await stu(page, 0)).grade.status, 'missing');
  assert.match(await page.$eval('#stuList .stu[data-i="0"]', e => e.textContent), /Missing/);
  assert.match(await page.$eval('#grade .total', e => e.textContent), /Missing/);
  assert.match(await page.$eval('#progS .ph', e => e.textContent), /0 of 3 scored · 1 missing or excused/);
  await goToStudent(page, 1);
  await page.click('[data-status="excused"]');
  await page.evaluate(() => window.__gs.scanAll());
  await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
  assert.match(await page.$eval('tr.go[data-i="1"]', e => e.textContent), /excused/);
  await page.click('[data-cp="total"]');
  assert.deepEqual((await clip(page)).split('\n').slice(0, 3), ['Missing', 'Excused', ''], 'the words hold their places');
  const R = await page.evaluate(() => { const G = window.__gs, s = G.state().batch.students; return [G.tableHead(), G.tableRow(s[0], 0), G.tableRow(s[1], 1)]; });
  assert.equal(R[1][R[0].indexOf('Status')], 'Missing');
  assert.equal(R[2][R[0].indexOf('Status')], 'Excused');
  assert.equal(R[1][R[0].indexOf('Total / 12')], '', 'no number stands in for missing');
  await closeBox(page);
  await page.evaluate(() => { window.__gs.openStudent(1); window.__gs.nextUnscored(); });
  await page.waitForFunction(() => window.__gs.state().cur === 2, { timeout: 15000 });   // skips 1 (excused), and goes to the next without a score
  noErrors(page); await close();
});

test('a late student keeps the score, and the mark stays apart from it', async () => {
  const { page, close } = await stack();
  await score(page, [3, 3, 3]);
  await page.click('[data-status="late"]');
  assert.deepEqual((await stu(page, 0)).computed, { total: 9, pct: 86, done: true, status: 'late' }, 'same as not late');
  assert.match(await page.$eval('#stuList .stu[data-i="0"]', e => e.textContent), /late/);
  const R = await page.evaluate(() => { const G = window.__gs, s = G.state().batch.students; return [G.tableHead(), G.tableRow(s[0], 0)]; });
  assert.equal(R[1][R[0].indexOf('Status')], 'Late');
  assert.equal(R[1][R[0].indexOf('Total / 12')], '9');
  await page.click('[data-status="late"]');
  assert.deepEqual((await stu(page, 0)).computed, { total: 9, pct: 86, done: true }, 'clicking again takes it off');
  assert.equal((await stu(page, 0)).grade.status, '');
  noErrors(page); await close();
});

test('giving a score takes missing off, and an unmarked student gets the old rows back', async () => {
  const { page, close } = await stack();
  await score(page, [3, 3, 3]);
  await page.click('[data-status="excused"]');
  assert.equal((await stu(page, 0)).computed.total, null);
  await page.click('[data-status="excused"]');
  assert.deepEqual((await stu(page, 0)).computed, { total: 9, pct: 86, done: true }, 'her rows were kept');
  await page.click('[data-status="missing"]');
  await score(page, [4]);
  const s = await stu(page, 0);
  assert.equal(s.grade.status, '');
  assert.deepEqual(s.computed, { total: 10, pct: 91, done: true });
  noErrors(page); await close();
});

test('a status comes back after a reload', async () => {
  const { page, close } = await stack();
  await page.click('[data-status="missing"]');
  await goToStudent(page, 1);
  await score(page, [3, 3, 3]);
  await page.click('[data-status="late"]');
  await settle(page);
  await page.reload(); await appReady(page);
  await openZip(page, zip, 'River essay.zip');
  assert.equal((await stu(page, 0)).computed.status, 'missing');
  assert.deepEqual((await stu(page, 1)).computed, { total: 9, pct: 86, done: true, status: 'late' });
  noErrors(page); await close();
});

test('points mode: 0 and the statuses work there too', async () => {
  const { page, close } = await stack();
  await page.evaluate(() => { const s = window.__gs.state().setup; s.mode = 'points'; s.outOf = 20; window.__gs.openStudent(0); });
  await page.waitForSelector('#ptsIn');
  await page.type('#ptsIn', '0');
  assert.deepEqual((await stu(page, 0)).computed, { total: 0, pct: 0, done: true });
  await page.click('[data-status="missing"]');
  assert.equal((await stu(page, 0)).computed.status, 'missing');
  await page.type('#ptsIn', '5');
  const s = await stu(page, 0);
  assert.equal(s.grade.status, '', 'typing a score takes missing off');
  assert.equal(await page.$eval('[data-status="missing"]', b => b.getAttribute('aria-pressed')), 'false');
  noErrors(page); await close();
});

/* ---------------- when a score last changed ---------------- */
test('work saved by the old build opens with no status or times, and its partial score is now flagged', async () => {
  const L = await loadLegacy();
  const { page, close } = await openApp(browser, { seed: L.seed() });
  await page.waitForFunction(() => [...document.querySelectorAll('#vHome .krow')].some(r => r.textContent.includes('River essay')));
  await page.evaluate(() => [...document.querySelectorAll('#vHome .krow')].find(r => r.textContent.includes('River essay')).querySelector('[data-kopen]').click());
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.batch.name === 'River essay' && s.pages.length; });
  const w = await workOf(page);
  assert.deepEqual(w['Bram Sample'].computed, { total: 4, pct: 64, done: false, partial: true });
  assert.deepEqual(w['Aria Testwell'].computed, { total: 10.5, pct: 93, done: true });
  for (const k of ['status', 'at', 'atR', 'reads']) assert.equal(w['Aria Testwell'].grade[k], undefined, k);
  noErrors(page); await close();
});

test('every way of changing a score, comment or status records the time', async () => {
  const { page, close } = await stack();
  const fresh = async fn => { const t0 = await page.evaluate(() => Date.now()); await fn(); await new Promise(r => setTimeout(r, 5)); return t0; };
  const check = async (i, t0, what) => { const s = await stu(page, i); assert.ok(s.grade.at >= t0, what + ': at is recorded'); return s.grade; };
  assert.equal((await stu(page, 0)).grade.at, undefined, 'nothing yet');
  let t = await fresh(() => page.click('.scores[data-c="1"] button[data-v="3"]'));
  let g = await check(0, t, 'rubric row');
  assert.ok(g.atR['1'] >= t); assert.equal(g.atR['0'], undefined, 'only that row');
  t = await fresh(() => page.click('.scores[data-c="1"] button[data-v="3"]'));
  g = await check(0, t, 'clearing a row');
  assert.ok(g.atR['1'] >= t);
  t = await fresh(() => page.type('#cmtIn', 'Nice'));
  await check(0, t, 'comment');
  await goToStudent(page, 1);
  t = await fresh(() => page.click('[data-status="late"]'));
  await check(1, t, 'status');
  await goToStudent(page, 2);
  // points
  await page.evaluate(() => { const s = window.__gs.state().setup; s.mode = 'points'; s.outOf = 12; window.__gs.openStudent(2); });
  await page.waitForSelector('#ptsIn');
  t = await fresh(() => page.type('#ptsIn', '7'));
  await check(2, t, 'points');
  await page.evaluate(() => { const s = window.__gs.state().setup; s.mode = 'rubric'; });
  // the time is saved, and cleared work is saved too (it's a real change)
  await settle(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__gs.state().batch.id)).s['Aria Testwell'].g);
  assert.ok(saved.at > 0);
  noErrors(page); await close();
});

test('a score typed on the Grade sheet, a Claude comment and a time stamp record the time', async () => {
  const { page, close } = await stack();
  const t = await page.evaluate(() => Date.now());
  await page.evaluate(async () => {
    const G = window.__gs; G.state().setup.spot = { x: 0.1, y: 0.1, w: 0.2, h: 0.1, page: 0 };
    await G.openSheet(true);
  });
  await page.waitForSelector('[data-typed="0"]');
  await page.type('[data-typed="0"]', '8.5');
  const s = await stu(page, 0);
  assert.ok(s.grade.at >= t); assert.equal(s.grade.sheet, '8.5');
  assert.deepEqual(s.computed.total, 8.5);
  const st = await page.evaluate(() => { const G = window.__gs, x = G.state().batch.students[1], was = x.grade.at; G.addStamp(x, 75); return [was, x.grade.at, x.grade.comment]; });
  assert.equal(st[0], null); assert.ok(st[1] >= t); assert.match(st[2], /\[1:15\]/);
  noErrors(page); await close();
});

test('a comment brought back from Claude records the time', async () => {
  const { page, close } = await stack();
  const code = await page.evaluate(() => { const G = window.__gs; G.openShare(); return G.state().batch.share.codes['Aria Testwell']; });
  await closeBox(page);
  await page.evaluate(() => window.__gs.openBringBack());
  await page.waitForSelector('#bbText');
  const t = await page.evaluate(() => Date.now());
  await page.type('#bbText', code + '\nClear thesis.');
  await page.click('[data-read]');
  await page.waitForFunction(() => !document.querySelector('[data-apply]').disabled);
  await page.click('[data-apply]');
  const s = await stu(page, 0);
  assert.match(s.grade.comment, /Clear thesis/);
  assert.ok(s.grade.at >= t);
  noErrors(page); await close();
});

/* ---------------- Word rubrics ---------------- */
// A Word file with a rubric table. high: the level highlighted per row, null for none.
function wordRubric(high, levels = [4, 3, 2, 1, 0]) {
  const cell = (t, on) => '<w:tc><w:tcPr>' + (on ? '<w:shd w:val="clear" w:color="auto" w:fill="FFF59D"/>' : '') + '</w:tcPr><w:p><w:r><w:t>' + t + '</w:t></w:r></w:p></w:tc>';
  const rows = high.map((h, i) => '<w:tr>' + cell(['Thesis', 'Evidence', 'Style'][i]) + levels.map(l => cell(String(l), h === l)).join('') + '</w:tr>').join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr>' + cell('Criterion') + levels.map(l => cell(String(l))).join('') + '</w:tr>' + rows + '</w:tbl></w:body></w:document>';
  const base = unzipSync(makeDocx('x'));
  return zipSync({ ...base, 'word/document.xml': strToU8(xml) });
}
const wordStack = async high => stack(zipOf({ 'Ana Example/Essay.pdf': await makePaper({ title: 'Ana Example essay' }), 'Ben Example/Rubric.docx': wordRubric(high) }), 'Word rubrics.zip');

test('a Word rubric she confirms still scores, 0 included, and a partly highlighted one is partial', async () => {
  let { page, close } = await wordStack([3, 0, 4]);
  await page.evaluate(() => window.__gs.wordScoresAll());
  assert.deepEqual((await stu(page, 1)).computed, { total: null, pct: null, done: false }, 'not before she says so');
  await useReading(page, 1);
  assert.deepEqual((await stu(page, 1)).grade.rubric, [3, 0, 4]);
  assert.deepEqual((await stu(page, 1)).computed, { total: 7, pct: 77, done: true });
  assert.ok((await stu(page, 1)).grade.atR['1'] > 0, 'bringing it in records the time');
  // the rubric was in the wrong folder: its score leaves with it, and that's a change too
  const t = await page.evaluate(() => Date.now() + 1); await new Promise(r => setTimeout(r, 5));
  await page.evaluate(() => { const G = window.__gs, b = G.state().batch.students; G.moveFile(b[1], b[1].files[0].path, b[0]); });
  await page.waitForFunction(() => window.__gs.state().batch.students[0].files.length === 2);
  assert.ok((await stu(page, 1)).grade.at >= t);
  noErrors(page); await close();
  ({ page, close } = await wordStack([3, null, null]));
  await page.evaluate(() => window.__gs.wordScoresAll());
  await useReading(page, 1);
  assert.deepEqual((await stu(page, 1)).computed, { total: 3, pct: 60, done: false, partial: true });
  noErrors(page); await close();
});

test('a Word rubric on a plain points setup: partial while part-highlighted, not partial once done', async () => {
  const { page, close } = await wordStack([3, null, null]);
  await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[1], s = G.state().setup; s.mode = 'points'; s.outOf = 12; st.grade.rubric = []; G.wordScoresAll(); });
  await useReading(page, 1);
  const s = await stu(page, 1);
  assert.equal(s.grade.points, '3');
  assert.deepEqual(s.computed, { total: 3, pct: await page.evaluate(() => window.__gs.percentFor(3)), done: false, partial: true });
  const copied = await page.evaluate(() => window.__gs.tableRow(window.__gs.state().batch.students[1], 1));
  assert.ok(copied.includes('Partial: 1 of 3 rows scored'));
  assert.ok(copied.includes('3 (partial)'));
  noErrors(page); await close();
});

test('clicking a Word rubric box on screen scores it and takes missing off', async () => {
  const { page, close } = await wordStack([null, null, null]);
  await page.evaluate(() => window.__gs.openStudent(1));
  await page.waitForSelector('[data-status="missing"]');
  await page.click('[data-status="missing"]');
  await page.waitForSelector('td.rcell');
  const t = await page.evaluate(() => Date.now());
  await page.evaluate(() => { const td = [...document.querySelectorAll('td.rcell')].find(c => c.textContent.trim() === '0'); td.click(); });
  await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.rubric[0] === 0);
  const s = await stu(page, 1);
  assert.equal(s.grade.status, '');
  assert.ok(s.grade.atR['0'] >= t);
  assert.equal(s.computed.partial, true);
  noErrors(page); await close();
});

/* ---------------- reading grades ---------------- */
// [text, what it reads as (null: nothing), whether it stands on its own with a 12-point assignment]
const READS = [
  ['Due 10/12', null],
  ['due: 10/12', null],
  ['page 3/12', null],
  ['Page 3/12', null],
  ['p. 3/12', null],
  ['pg 3/12', null],
  ['Question 3/12', null],
  ['#3/12', null],
  ['Turned in 10/12', null],
  ['Due 10/12 - 50%', { score: null, pct: 50 }, false],
  ['2026/10/12', null],
  ['10/12/26', null],
  ['9.5 = 88%', { score: 9.5, pct: 88 }, true],
  ['9.5/12 = 88%', { score: 9.5, outOf: 12, pct: 88 }, true],
  ['10/12', { score: 10, outOf: 12 }, true],
  ['Total 11/12 → 95%', { score: 11, pct: 95 }, true],
  ['Your grade: 10/12', { score: 10, outOf: 12 }, true],
  ['Grade: 9.5/12 = 88% well done', { score: 9.5, pct: 88 }, true],
  ['10/12 points', { score: 10, outOf: 12 }, true],
  ['Nice work! 9.5 = 88%', { score: 9.5, pct: 88 }, true],
  ['88%', { pct: 88 }, true],
  ['Final grade 88 %', { pct: 88 }, true],
  ['9.5', { score: 9.5 }, true],
  ['0/12', { score: 0, outOf: 12 }, true],
  ['10/15', { score: 10, outOf: 15 }, false],
  ['10/12 sources are cited here', { score: 10, outOf: 12 }, false],
  ['Nice argument. 10/12', { score: 10, outOf: 12 }, false],
  ['Only 40% of your sources', { pct: 40 }, false],
  ['3', { score: 3 }, false],
  ['17/20 = 85%', { score: 17, outOf: 20, pct: 85 }, false],
  ['14 = 80%', { score: 14, pct: 80 }, false],
  ['Of 200, 50% agreed', { score: 200, pct: 50 }, false],
  ['Of 200 people, 50% agreed', { score: null, pct: 50 }, false],
];
test('what counts as a grade, what is doubtful, and what is nothing', async () => {
  const { page, close } = await stack();
  for (const [text, want, sure] of READS) {
    const r = await page.evaluate(t => { const G = window.__gs, g = G.parseGrade(t, false); return g && { ...g, doubt: G.readingDoubt(g) }; }, text);
    if (!want) { assert.equal(r, null, text); continue; }
    assert.ok(r, text + ' should read');
    for (const [k, v] of Object.entries(want)) assert.equal(r[k], v, text + ' ' + k);
    assert.equal(!r.doubt, sure, text + ' → ' + r.doubt);
  }
  noErrors(page); await close();
});
test('a real grade beats a date in the same comment', async () => {
  const { page, close } = await stack();
  const g = await page.evaluate(() => [window.__gs.parseGrade('Due 10/12. Grade 9/12', false), window.__gs.parseGrade('3/12 sources cited. Total 10/12', false)]);
  assert.deepEqual([g[0].score, g[0].loose], [9, false]);
  assert.deepEqual([g[1].score, g[1].loose], [10, false]);
  noErrors(page); await close();
});

// The words before a number only rule it out when they sit right against it on the same line. Anything else gets asked about, never dropped.
const CONTEXT = [
  // a sentence or a line ends before the grade
  ['See me after.\n10/12', { score: 10, outOf: 12 }, false],
  ['Good work on this section\n10/12', { score: 10, outOf: 12 }, false],
  ['Fix the last paragraph.\n10/12', { score: 10, outOf: 12 }, false],
  ['Read it again, it is due\n10/12', { score: 10, outOf: 12 }, false],
  ['Strong final paragraph. 9.5/12 = 88%', { score: 9.5, outOf: 12, pct: 88 }, true],
  ['Best part.\n9.5/12 = 88%', { score: 9.5, outOf: 12, pct: 88 }, true],
  ['See next page.\n10.5/12 = 93%', { score: 10.5, outOf: 12, pct: 93 }, true],
  // ordinary words that also number things: asked about, not dropped
  ['Strong final paragraph 9.5/12 = 88%', { score: 9.5, outOf: 12, pct: 88 }, true],
  ['Best part 10/12', { score: 10, outOf: 12 }, false],
  ['Chapter 3/12', { score: 3, outOf: 12 }, false],
  // a percent worked out is no date or page, but those words still make it worth asking
  ['See next page 10.5/12 = 93%', { score: 10.5, outOf: 12, pct: 93 }, false],
  ['Due 10/12 = 88%', { score: 10, outOf: 12, pct: 88 }, false],
  // still dates and pages
  ['Redo by 10/12', null], ['Meet on 10/12', null], ['Mon 10/12', null], ['Page: 3/12', null], ['Page #3/12', null], ['pg. 3/12', null], ['Q. 3/12', null],
  // a grade word further back, or inside another word, doesn't make it a grade
  ['Final draft 10/12', { score: 10, outOf: 12 }, false],
  ['Final copy 10/12', { score: 10, outOf: 12 }, false],
  ['Final exam 10/12', { score: 10, outOf: 12 }, false],
  ['Mark your calendar 3/12', { score: 3, outOf: 12 }, false],
  ['Point of view 3/12', { score: 3, outOf: 12 }, false],
  ['Good point 3/12', { score: 3, outOf: 12 }, false],
  ['Score higher next time 3/12', { score: 3, outOf: 12 }, false],
  ['Overall good, see me 3/12', { score: 3, outOf: 12 }, false],
  ['Points off 3/12', { score: 3, outOf: 12 }, false],
  ['Marked 10/12', { score: 10, outOf: 12 }, false],
  ['Graded 10/12', { score: 10, outOf: 12 }, false],
  ['Final draft 88%', { pct: 88 }, false],
  ['3/12 points off', { score: 3, outOf: 12 }, false],
  ['3/12 total sources', { score: 3, outOf: 12 }, false],
  // a label right before it, or right after it, is the grade
  ['Total: 10/12', { score: 10, outOf: 12 }, true],
  ['Final 10/12', { score: 10, outOf: 12 }, true],
  ['Final grade is 10/12', { score: 10, outOf: 12 }, true],
  ['Total score = 10/12', { score: 10, outOf: 12 }, true],
  ['You scored 10/12', { score: 10, outOf: 12 }, true],
  ['Overall: 3/12', { score: 3, outOf: 12 }, true],
  ['10/12 total', { score: 10, outOf: 12 }, true],
  ['10/12 points, nice work', { score: 10, outOf: 12 }, true],
];
test('the words around a number: a sentence end breaks them off, and only a label right beside it makes it sure', async () => {
  const { page, close } = await stack();
  for (const [text, want, sure] of CONTEXT) {
    const r = await page.evaluate(t => { const G = window.__gs, g = G.parseGrade(t, false); return g && { ...g, doubt: G.readingDoubt(g) }; }, text);
    if (!want) { assert.equal(r, null, text); continue; }
    assert.ok(r, text + ' should read');
    for (const [k, v] of Object.entries(want)) assert.equal(r[k], v, text + ' ' + k);
    assert.equal(!r.doubt, sure, text + ' → ' + r.doubt);
  }
  noErrors(page); await close();
});
test('on a real paper: her grade after a sentence counts, and a lookalike waits to be confirmed', async () => {
  const { page, close } = await stack();
  const clear = () => page.evaluate(() => { window.__gs.state().batch.students[0].files[0].marks[0].length = 0; });
  await addText(page, 0, 'Strong final paragraph. 9.5/12 = 88%');
  assert.deepEqual((await stu(page, 0)).computed, { total: 9.5, pct: 88, done: true, paper: true });
  await clear();
  await addText(page, 0, 'See me after.\n10/12');
  let s = await stu(page, 0);
  assert.deepEqual(s.doubts, ['See me after.\n10/12'], 'she gets asked');
  assert.deepEqual(s.computed, { total: null, pct: null, done: false });
  await clear();
  for (const text of ['Final draft 10/12', 'Mark your calendar 3/12']) {
    await addText(page, 0, text);
    s = await stu(page, 0);
    assert.deepEqual(s.computed, { total: null, pct: null, done: false }, text);
    assert.deepEqual(s.doubts, [text]);
    assert.ok((await page.evaluate(() => window.__gs.exportCheck())).unfinished.some(o => o.i === 0), text + ' is still unfinished');
    await clear();
  }
  noErrors(page); await close();
});
test('page text: a grade on the line after a sentence is offered, whatever word the sentence ends on', async () => {
  const tails = ['and that was the end of the day.', 'and that was the end of the story.', 'and that was the last paragraph', 'this one was late, it was due', 'turn to the next page'];
  const z = zipOf(Object.fromEntries(await Promise.all(tails.map(async (t, i) => ['Student' + i + ' Example/Essay.pdf', await makePaper({ title: 'S' + i, lines: [t, '9.5/12 = 88%'] })]))));
  const { page, close } = await stack(z, 'Tails.zip');
  await page.evaluate(() => window.__gs.scanAll());
  for (let i = 0; i < tails.length; i++) {
    const s = await stu(page, i);
    assert.deepEqual(s.computed, { total: null, pct: null, done: false }, tails[i]);
    assert.deepEqual(s.doubts, ['9.5/12 = 88%'], tails[i]);
  }
  noErrors(page); await close();
});
test('a Kami comment keeps its line breaks when read for a grade', async () => {
  const withNote = async text => {
    const doc = await PDFDocument.load(await makePaper({ title: 'Kami' })), ctx = doc.context;
    const note = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'FreeText', Rect: [60, 300, 300, 360], DA: PDFString.of('/Helv 12 Tf 0 g'), F: 4, Contents: PDFHexString.fromText(text) }));
    doc.getPage(0).node.set(PDFName.of('Annots'), ctx.obj([note]));
    return doc.save();
  };
  const z = zipOf({ 'Ana Example/Essay.pdf': await withNote('Look at the next page\n10/12'), 'Ben Example/Essay.pdf': await withNote('See page 10/12') });
  const { page, close } = await stack(z, 'Kami.zip');
  await page.evaluate(() => window.__gs.scanAll());
  assert.deepEqual((await stu(page, 0)).doubts, ['Look at the next page 10/12'], 'asked, not lost');
  const b = await stu(page, 1);
  assert.deepEqual([b.found, b.doubts], [null, []], 'on one line it is a page');
  noErrors(page); await close();
});

test('on a real paper: dates and pages never reach the grade, and the promised forms do', async () => {
  const { page, close } = await stack();
  for (const text of ['Due 10/12', 'page 3/12']) {
    await addText(page, 0, text);
    const s = await stu(page, 0);
    assert.equal(s.found, null, text); assert.deepEqual(s.doubts, []); assert.deepEqual(s.computed, { total: null, pct: null, done: false }, text);
    await page.evaluate(() => { window.__gs.state().batch.students[0].files[0].marks[0].length = 0; });
  }
  for (const [text, want] of [['9.5 = 88%', { total: 9.5, pct: 88, done: true, paper: true }], ['9.5/12 = 88%', { total: 9.5, pct: 88, done: true, paper: true }], ['10/12', { total: 10, pct: 91, done: true, paper: true }]]) {
    await addText(page, 0, text);
    assert.deepEqual((await stu(page, 0)).computed, want, text);
    await page.evaluate(() => { window.__gs.state().batch.students[0].files[0].marks[0].length = 0; });
  }
  // printed on the page itself
  noErrors(page); await close();
});
test('printed on the page itself, a grade is only offered, and counts once she says so', async () => {
  const { page, close } = await stack(printedZip);
  await page.evaluate(() => window.__gs.scanAll());
  let printed = await stu(page, 2);
  assert.deepEqual(printed.computed, { total: null, pct: null, done: false });
  assert.deepEqual(printed.doubts, ['9.5/12 = 88%']);
  await useReading(page, 2);
  printed = await stu(page, 2);
  assert.deepEqual(printed.computed, { total: 9.5, pct: 88, done: true, paper: true });
  noErrors(page); await close();
});

test('page text: a grade is offered, and the essay’s numbers aren’t', async () => {
  const z = zipOf({
    'Ana Example/Essay.pdf': await makePaper({ title: 'Ana', lines: ['Of 200, 50% agreed with the speaker.', 'Results for 2019, 40% of voters left.'] }),
    'Ben Example/Essay.pdf': await makePaper({ title: 'Ben', lines: ['Grade: 9.5/12 = 88%', 'Of 200, 50% agreed with the speaker.'] }),
  });
  const { page, close } = await stack(z, 'Numbers.zip');
  await page.evaluate(() => window.__gs.scanAll());
  const a = await stu(page, 0), b = await stu(page, 1);
  assert.deepEqual(a.computed, { total: null, pct: null, done: false }); assert.deepEqual(a.doubts, []);
  assert.deepEqual(b.computed, { total: null, pct: null, done: false }); assert.deepEqual(b.doubts, ['9.5/12 = 88%'], 'one grade, not two to check');
  noErrors(page); await close();
});

test('a doubtful reading waits for her on the Grade sheet, and counts once she says so', async () => {
  const { page, close } = await stack();
  await addText(page, 0, '10/15');
  let s = await stu(page, 0);
  assert.deepEqual(s.computed, { total: null, pct: null, done: false }, 'not on its own');
  assert.deepEqual(s.doubts, ['10/15']);
  assert.equal(await page.$eval('#stuList .stu[data-i="0"] .sc', e => e.textContent), '?');
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForSelector('[data-rd="1"]');
  assert.match(await page.$eval('.rd-ask', e => e.textContent), /Is this the grade\?.*10\/15.*out of 15, but this assignment is out of 12/s);
  assert.match(await page.$eval('#shSub', e => e.textContent), /1 to confirm/);
  await page.click('[data-rd="1"]');
  await page.waitForFunction(() => !document.querySelector('.rd-ask'));
  s = await stu(page, 0);
  assert.deepEqual(s.computed, { total: 10, pct: 67, done: true, paper: true, outOf: 15 }, 'a confirmed 10/15 is worked out of 15');
  assert.ok(s.grade.at > 0);
  await settle(page);
  // her answer holds after a reload and a fresh read of the paper
  await page.reload(); await appReady(page);
  await openZip(page, zip, 'River essay.zip');
  await page.evaluate(() => window.__gs.scanAll());
  s = await stu(page, 0);
  assert.equal(s.computed.total, 10);
  assert.deepEqual(s.doubts, []);
  noErrors(page); await close();
});

test('a comment typed with the Text tool since the last read is in the check before exporting', async () => {
  const { page, close } = await stack();
  await page.evaluate(() => window.__gs.scanAll());
  await setTool(page, 'text'); await clickAt(page, 0, 100, 560);
  await page.waitForSelector('textarea.ed'); await page.keyboard.type('10/15'); await page.keyboard.press('Escape');
  await setTool(page, 'select');
  await page.click('#exportBtn');
  await page.waitForSelector('#xCheck', { timeout: 60000 });
  assert.match(await page.$eval('#xCheck', e => e.textContent), /Grades to confirm \(1\).*Is “10\/15” the grade\?/s);
  await page.click('#xCheck summary');
  await page.click('#xCheck [data-chksheet]');
  await page.waitForSelector('.rd-ask', { timeout: 60000 });
  noErrors(page); await close();
});

test('a reading waiting for her shows in the Grades list, and Copy all scores warns about partial ones', async () => {
  const { page, close } = await stack();
  await clipOn(page);
  await addText(page, 1, '10/15');
  await score(page, [4]);
  await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
  assert.match(await page.$eval('tr.go[data-i="1"]', e => e.textContent), /to confirm/);
  await closeBox(page);
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForSelector('.rd-ask', { timeout: 60000 });
  await page.click('#dlgBox .bf [data-cp]');
  await answerDlg(page);
  assert.deepEqual((await clip(page)).split('\n').slice(0, 3), ['4 (partial)', '', '']);
  assert.match(page.lastDialog, /only part of the rubric/);
  noErrors(page); await close();
});

test('anonymous grading: the check keeps names and file names hidden', async () => {
  const { page, close } = await stack();
  const c = await page.evaluate(async () => { const G = window.__gs; await G.scanAll(); G.setAnon(true); return G.exportCheck(); });
  const all = JSON.stringify(c, (k, v) => k === 'file' ? undefined : v);   // file is only the link's target, never shown
  assert.ok(!/Aria|Bram|Cleo|Dov|Essay/.test(all), all);
  assert.match(all, /Paper \d/);
  noErrors(page); await close();
});

test('Not a grade stays out, and Undo asks again', async () => {
  const { page, close } = await stack();
  await addText(page, 0, 'Nice argument. 10/12');
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForSelector('[data-rd="0"]');
  await page.click('[data-rd="0"]');
  await page.waitForSelector('.rd-no');
  let s = await stu(page, 0);
  assert.deepEqual(s.computed, { total: null, pct: null, done: false });
  assert.deepEqual(s.doubts, []);
  await page.click('.rd-no [data-rd=""]');
  await page.waitForSelector('.rd-ask');
  s = await stu(page, 0);
  assert.equal(s.doubts.length, 1);
  noErrors(page); await close();
});

// She said two things that look like grades always ask, so 9.5 no longer stands here while 3/12 waits. It used to.
test('a doubtful reading beside a sure one: neither stands until she says, and a plain count beside it changes nothing', async () => {
  const { page, close } = await stack();
  await addText(page, 2, '9.5/12 = 88%');
  await addText(page, 2, 'Nice argument. 3/12');
  const s = await stu(page, 2);
  assert.equal(s.n, 1);
  assert.equal(s.computed.total, null);
  assert.equal(s.doubts.length, 1);
  await addText(page, 0, '9.5/12 = 88%');
  await addText(page, 0, 'You cited 3/12 sources');
  const c = await stu(page, 0);
  assert.equal(c.n, 1);
  assert.equal(c.computed.total, 9.5);
  assert.equal(c.doubts.length, 1);
  noErrors(page); await close();
});

test('changing what the assignment is out of settles the readings again', async () => {
  const { page, close } = await stack();
  await addText(page, 0, '10/15');
  assert.equal((await stu(page, 0)).computed.total, null);
  await page.evaluate(() => { const G = window.__gs, s = G.state().setup; s.mode = 'points'; s.outOf = 15; G.state().batch.students.forEach(G.refound); });
  assert.equal((await stu(page, 0)).computed.total, 10);
  noErrors(page); await close();
});

test('a reading inside a box she drew counts without asking', async () => {
  const { page, close } = await stack();
  const out = await page.evaluate(async () => {
    const G = window.__gs, st = G.state().batch.students[0], f = st.files[0];
    (f.marks[0] ||= []).push({ t: 'text', x: 80, y: 200, text: 'Nice argument. 10/12', size: 14, color: 'red' });
    f.hand = { page: 0, x: 0, y: 0, w: 1, h: 1 };
    await G.scanAll();
    return { d: G.gradeOf(st), n: st.doubts.length };
  });
  assert.equal(out.d.total, 10); assert.equal(out.n, 0);
  noErrors(page); await close();
});

test('a grade typed in a student’s Word file is offered when it’s written out as one', async () => {
  const z = zipOf({ 'Ana Example/Essay.pdf': await makePaper({ title: 'Ana' }), 'Ben Example/Essay.docx': makeDocx('Due 10/12'), 'Cal Example/Essay.docx': makeDocx('Total: 10/12'), 'Dee Example/Essay.docx': makeDocx('Nice argument. 10/15'), 'Eve Example/Essay.docx': makeDocx('10/12 = 91%') });
  const { page, close } = await stack(z, 'Word typed.zip');
  await page.evaluate(() => window.__gs.scanAll());
  assert.deepEqual((await stu(page, 1)).computed, { total: null, pct: null, done: false });
  const c = await stu(page, 2);
  assert.equal(c.computed.total, null, 'a student could have typed it'); assert.equal(c.doubts.length, 1);
  const d = await stu(page, 3);
  assert.equal(d.computed.total, null); assert.equal(d.doubts.length, 0, 'a number in a sentence of theirs is their sentence');
  assert.equal((await stu(page, 4)).doubts.length, 1);
  await page.evaluate(() => window.__gs.openSheet());
  for (let n = 2; n > 0; n--) {
    await page.waitForSelector('.rd-ask [data-rd="1"]', { timeout: 60000 });
    await page.click('.rd-ask [data-rd="1"]');
    await page.waitForFunction(n => document.querySelectorAll('.rd-ask').length < n, {}, n);
  }
  assert.equal((await stu(page, 2)).computed.total, 10);
  assert.equal((await stu(page, 4)).computed.total, 10);
  noErrors(page); await close();
});

/* ---------------- the check before exporting ---------------- */
test('the pre-export check names unfinished scores, no paper, disagreements, unmarked files and readings to confirm', async () => {
  const z = zipOf({ ...(await standardFiles()) });
  const { page, close } = await stack(z);
  // Aria partial, Bram not scored, Cleo disagrees with the 9.5 written on her paper
  await score(page, [4]);
  await goToStudent(page, 2); await score(page, [3, 3, 3]);
  await goToStudent(page, 0);
  await page.evaluate(() => { const G = window.__gs, b = G.state().batch; b.students.push({ key: 'Zed Nopaper', files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }); b.students.push({ key: 'Yan Gone', files: [], grade: { rubric: [], points: '', comment: '', status: 'missing' }, layout: null, inc: {} }); });
  await addText(page, 1, '10/15');
  await addText(page, 2, '9.5 = 88%');
  await addText(page, 2, 'Nice. 3/12 sources');   // her own score stands, so this one doesn't need asking about
  await page.click('#exportBtn');
  await page.waitForSelector('#xCheck', { timeout: 60000 });
  const c = await page.evaluate(() => window.__gs.exportCheck());
  const names = l => l.map(o => o.name);
  assert.deepEqual(names(c.unfinished), ['Aria Testwell', 'Bram Sample', 'Dov Madeup', 'Zed Nopaper']);
  assert.match(c.unfinished[0].note, /Partial: 1 of 3/);
  assert.match(c.unfinished[1].note, /Not scored yet/);
  assert.deepEqual(names(c.noPaper), ['Zed Nopaper'], 'marked missing isn’t asked about');
  assert.deepEqual(c.disagree.map(o => [o.name, o.note]), [['Cleo Fixture', 'Your score is 9, the paper says 9.5']]);
  assert.ok(c.unmarked.some(o => o.name === 'Aria Testwell' && o.note === 'Essay.pdf'));
  assert.ok(c.unmarked.some(o => o.name === 'Dov Madeup' && o.note === 'Essay.docx'), 'Word files count');
  assert.ok(!c.unmarked.some(o => o.note === 'notes.txt'), 'other files can’t be marked');
  assert.ok(!c.unmarked.some(o => o.name === 'Yan Gone'));
  assert.ok(!c.unmarked.some(o => o.name === 'Cleo Fixture'), 'a grade on the paper counts as marked');
  assert.deepEqual(c.doubts.map(o => o.name), ['Bram Sample']);
  const html = await page.$eval('#xCheck', e => e.textContent);
  for (const t of ['to look at before you return these', 'Scores not finished (4)', 'No paper (1)', 'Scores that disagree with the paper (1)', 'Grades to confirm (1)', 'Your score is 9, the paper says 9.5']) assert.ok(html.includes(t), t);
  // a name goes to that student, and the dialog gets out of the way
  await page.click('#xCheck summary');
  await page.click('#xCheck [data-chk="2"]');
  await page.waitForFunction(() => window.__gs.state().cur === 2 && document.querySelector('#dlg').hidden);
  noErrors(page); await close();
});

test('a clean class gets an all clear, and export still works with problems listed', async () => {
  const z = zipOf({ 'Ana Example/Essay.pdf': await makePaper({ title: 'Ana' }), 'Ben Example/Essay.pdf': await makePaper({ title: 'Ben' }) });
  const { page, close } = await stack(z, 'Clean.zip');
  await addText(page, 0, '9.5/12 = 88%');
  await addText(page, 1, '10/12 = 91%');
  await page.click('#exportBtn');
  await page.waitForSelector('#xCheck.ok', { timeout: 60000 });
  assert.match(await page.$eval('#xCheck', e => e.textContent), /All clear/);
  await closeBox(page, '#dlgBox .bf [data-close]');
  await page.evaluate(() => { window.__gs.state().batch.students[0].grade.rubric = [3]; });
  await addText(page, 1, 'Nice argument. 3/12');   // the grade sheet PDF prints it as one to confirm
  await page.click('#exportBtn');
  await page.waitForSelector('#xCheck:not(.ok)', { timeout: 60000 });
  const d = await catchDownloads(page);
  const got = await d.next(() => page.click('#dlgBox [data-go="zip"]'));
  assert.match(got.name, /^Marked - /);
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  assert.ok(Object.keys(unzipSync(got.bytes)).some(n => /^Grade sheet/.test(n)));
  await d.close();
  noErrors(page); await close();
});

/* ---------------- safe spreadsheets ---------------- */
test('csvCell makes formulas plain text and leaves the rest alone', async () => {
  const { page, close } = await stack();
  const out = await page.evaluate(() => ['=1+1', '+1', '-1', '@x', '  =1', '\t=1', '\r=1', '＝1', 'Good, "ok"', 'line\nbreak', '9.5', '0', '', 'A=B', '4 (partial)', '-'].map(window.__gs.csvCell));
  assert.deepEqual(out, ["'=1+1", "'+1", "'-1", "'@x", "'  =1", "\"'\t=1\"", "\"'\r=1\"", "'＝1", '"Good, ""ok"""', '"line\nbreak"', '9.5', '0', '', 'A=B', '4 (partial)', "'-"]);
  noErrors(page); await close();
});

test('the CSV download: names and comments can’t run as formulas, and partial and status show', async () => {
  const z = zipOf({ '=HYPERLINK("http-evil","x")/Essay.pdf': await makePaper({ title: 'One' }), '+Plus Name/Essay.pdf': await makePaper({ title: 'Two' }), 'Ana Example/Essay.pdf': await makePaper({ title: 'Three' }), '@At Name/Essay.pdf': await makePaper({ title: 'Four' }) });
  const { page, close } = await stack(z, 'Odd names.zip');
  const dl = await catchDownloads(page);
  await page.evaluate(() => { const b = window.__gs.state().batch.students; const by = k => b.find(s => s.key.includes(k)); by('Ana').grade.comment = '=cmd|calc\nsecond line'; by('Ana').grade.rubric = [4]; by('Plus').grade.status = 'late'; by('Plus').grade.rubric = [3, 3, 3]; by('At').grade.status = 'missing'; });
  await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
  const got = await dl.next(() => page.click('[data-csv]'));
  const text = new TextDecoder().decode(got.bytes);
  assert.equal(got.name, 'Grades - Odd names.csv');
  const lines = text.replace(/^﻿/, '').split('\r\n');
  assert.deepEqual(lines[0].split(','), ['#', 'Student', 'Criterion 1', 'Criterion 2', 'Criterion 3', 'Total / 12', 'Percent', 'Status', 'Comment']);
  assert.ok(lines.some(l => l.includes("\"'=HYPERLINK(\"\"http-evil\"\",\"\"x\"\")\"") ), 'quoted and defused: ' + text);
  assert.ok(lines.some(l => l.includes(",'+Plus Name,3,3,3,9,86,Late,")), text);
  assert.ok(lines.some(l => l.includes(",'@At Name,,,,,,Missing,")), text);
  assert.ok(lines.some(l => l.includes('Ana Example,4,,,4 (partial),64 (partial),Partial: 1 of 3 rows scored,\'=cmd|calc second line')), text);
  for (const l of lines) for (const c of l.split(',')) assert.ok(!/^["]?[=+@]/.test(c), 'no cell starts a formula: ' + c);
  await dl.close();
  noErrors(page); await close();
});

test('Copy as a table is defused too, and a tab in a comment can’t shift the columns', async () => {
  const { page, close } = await stack();
  await clipOn(page);
  await page.evaluate(() => { const s = window.__gs.state().batch.students[0]; s.grade.comment = '=1+1\tmore'; });
  await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
  await page.click('[data-cp="tsv"]');
  const L = (await clip(page)).split('\n');
  assert.deepEqual(L[0].split('\t'), ['#', 'Student', 'Criterion 1', 'Criterion 2', 'Criterion 3', 'Total / 12', 'Percent', 'Status', 'Comment']);
  const row = L[1].split('\t');
  assert.equal(row.length, 9);
  assert.equal(row[8], "'=1+1 more");
  noErrors(page); await close();
});

test('the Claude package: scores.csv is defused and shows partial and status', async () => {
  const { page, close } = await stack();
  await score(page, [4]);
  await page.type('#cmtIn', '=SUM(1,1)');
  await goToStudent(page, 1);
  await page.click('[data-status="missing"]');
  await addText(page, 0, 'Nice start');   // only marked papers go in the package
  await addText(page, 1, 'Nice start');
  const dl = await catchDownloads(page);
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#dlgBox [data-make]');
  const got = await dl.next(() => page.click('#dlgBox [data-make]'));
  const un = unzipSync(got.bytes), csv = new TextDecoder().decode(un['scores.csv']);
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  assert.match(lines[0], /total \/ 12,percent,status,teacher comment$/);
  assert.ok(lines.some(l => /,4 \(partial\),64 \(partial\),Partial: 1 of 3 rows scored,"'=SUM\(1,1\)"$/.test(l)), csv);
  assert.ok(lines.some(l => /,,,,,,Missing,$/.test(l)), csv);
  assert.match(new TextDecoder().decode(un['README.txt']), /status \(partial, missing, excused or late\)/);
  assert.match(JSON.parse(new TextDecoder().decode(un['rubric.json'])).levels, /^0 to 4/);
  await dl.close();
  noErrors(page); await close();
});
