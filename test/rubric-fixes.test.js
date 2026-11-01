// Scores and Rubric setup: the row a score belongs to, which setup a download opens with, and scores that follow a Word rubric. In the real built app. Every name here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { unzipSync, zipSync, strToU8 } = require('fflate');
const { PDFDocument, PDFName, PDFString, PDFHexString } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, appReady, openZip, pickFile, goToStudent, score, settle, waitPaper, tmpDir, catchDownloads } = require('./helpers/app');
const { makePaper, makeDocx, zipOf, quizFiles } = require('./helpers/fixtures');

let browser, zip3;
const POINTS = { mode: 'points', criteria: ['Criterion 1'], outOf: 12, scale: { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 } };
before(async () => {
  browser = await launch();
  zip3 = zipOf({ 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann Alpha essay' }), 'Ben Beta/Essay.pdf': await makePaper({ title: 'Ben Beta essay' }), 'Cal Gamma/Essay.pdf': await makePaper({ title: 'Cal Gamma essay' }) });
});
after(async () => { await browser.close(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const closed = page => page.waitForFunction(() => document.querySelector('#dlg').hidden);
const editSetup = async page => { await page.click('#editRubric'); await page.waitForSelector('#setupBody'); };
const grade = (page, i = 0) => page.evaluate(i => { const G = window.__gs, st = G.state().batch.students[i]; return { ...G.gradeOf(st), rubric: st.grade.rubric, points: st.grade.points, atR: st.grade.atR, at: st.grade.at }; }, i);
const panelRows = page => page.$$eval('.crit .cn', a => a.map(c => c.textContent));
const seedPoints = { ls: { 'gs.setup': JSON.stringify(POINTS) } };
// A Word rubric: high[i] is the box highlighted on row i, or null.
function wordRubric(high, levels = [4, 3, 2, 1, 0], extra = '') {
  const names = ['Thesis', 'Evidence', 'Style', 'Fourth'];
  const cell = (t, on) => '<w:tc><w:tcPr>' + (on ? '<w:shd w:val="clear" w:color="auto" w:fill="FFF59D"/>' : '') + '</w:tcPr><w:p><w:r><w:t>' + t + '</w:t></w:r></w:p></w:tc>';
  const rows = high.map((h, i) => '<w:tr>' + cell(names[i]) + levels.map(l => cell(String(l), h === l)).join('') + '</w:tr>').join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr>' + cell('Criterion') + levels.map(l => cell(String(l))).join('') + '</w:tr>' + rows + '</w:tbl>' + extra + '</w:body></w:document>';
  return zipSync({ ...unzipSync(makeDocx('x')), 'word/document.xml': strToU8(xml) });
}
const wordDoc = paras => zipSync({ ...unzipSync(makeDocx('x')), 'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paras.map(t => '<w:p><w:r><w:t>' + t + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>') });
const wordZip = async (high, levels, extra) => zipOf({ 'Ana Example/Essay.pdf': await makePaper({ title: 'Ana' }), 'Ben Example/Rubric.docx': wordRubric(high, levels, extra) });
// Her "Use it" for the student's first reading waiting to be confirmed: a student's own text and tables are only offered.
const useReading = async (page, i) => {
  await page.waitForFunction(i => (window.__gs.state().batch.students[i].doubts || []).length > 0, {}, i);
  await page.evaluate(i => { const G = window.__gs, st = G.state().batch.students[i]; G.setReading(st, G.readKey(st.doubts[0]), '1'); }, i);
};
// A paper with her grade on it as a Kami text box, which counts with no question.
const notedPaper = async (title, text) => {
  const doc = await PDFDocument.load(await makePaper({ title })), ctx = doc.context;
  doc.getPage(0).node.set(PDFName.of('Annots'), ctx.obj([ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'FreeText', Rect: [60, 300, 300, 360], DA: PDFString.of('/Helv 12 Tf 0 g'), F: 4, Contents: PDFHexString.fromText(text) }))]));
  return doc.save();
};
const clickBox = async (page, k) => { const c = await page.$$('td.rcell'); await c[k].click(); await sleep(150); };

/* ---------------- a leftover dialog can't answer the next one ---------------- */
test('nothing of Arrange pages is left on the dialog box once it has closed', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip3);
  const layout = () => page.evaluate(() => { const s = window.__gs.state(); return s.batch.students[s.cur].layout || null; });
  await page.click('#arrangeBtn');
  await page.waitForSelector('#arrBody [data-rm]');
  await page.click('#arrBody .ath');   // a page is picked, so the old key handler would act on it
  await page.click('#arrBody [data-rm]');
  await page.click('#arrBody .ath').catch(() => {});
  await page.click('#dlgBox .bf [data-cancel]');
  await closed(page);
  assert.equal(await layout(), null);
  assert.deepEqual(await page.$eval('#dlgBox', b => [b.onclick, b.onchange, b.oninput, b.ondblclick, b.onkeydown]), [null, null, null, null, null]);

  await editSetup(page);
  assert.deepEqual(await page.$eval('#dlgBox', b => [b.onclick, b.onchange, b.oninput, b.ondblclick, b.onkeydown]), [null, null, null, null, null]);
  await page.focus('#dlgBox [data-add]');
  await page.keyboard.press('Delete');   // Arrange's key handler took a page out here, and then threw
  await page.keyboard.press('ArrowRight');
  await page.click('#dlgBox [data-add]');
  await page.$eval('[data-lvrow="0"]', d => { d.open = true; });
  await page.click('[data-lvi="0"][data-lvv="4"]'); await page.keyboard.type('Clear thesis');
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  const su = await page.evaluate(() => window.__gs.state().setup);
  assert.equal(su.criteria.length, 4, 'the new row is kept');
  assert.equal(su.levels[0][4], 'Clear thesis', 'the words are kept');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.setup')).criteria.length), 4, 'and remembered');
  assert.equal(await layout(), null, 'the page she cancelled taking out stays in');
  assert.equal(await page.$$eval('.crit', a => a.length), 4);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Arrange pages Save still saves, and the next dialog’s Save is its own', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip3);
  await page.click('#arrangeBtn');
  await page.waitForSelector('#arrBody [data-rm]');
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  await editSetup(page);
  await page.click('#dlgBox [data-add]');
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  assert.equal((await page.evaluate(() => window.__gs.state().setup.criteria)).length, 4);
  await page.click('#arrangeBtn');
  await page.waitForSelector('#arrBody .ath');
  await page.$eval('#arrBody [data-name]', e => { e.value = 'Renamed.pdf'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  assert.equal(await page.evaluate(() => { const s = window.__gs.state(); return s.batch.students[s.cur].layout[0].name; }), 'Renamed.pdf', 'Arrange’s own typing still reaches it when it opens again');
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- removing a row ---------------- */
/* ---------------- Match files to a roster: its buttons keep working after every redraw ---------------- */
const seedMatch = { ls: { 'gs.lib': JSON.stringify({ classes: [{ id: 'c1', name: 'Period 1', names: ['Ann Alpha', 'Ben Beta', 'Cal Gamma'], units: [] }, { id: 'c2', name: 'Period 2', names: ['Dee Delta', 'Eli Echo'], units: [] }], loose: { id: '', units: [] }, units: [] }) } };
const matchOpen = async () => {
  const { page, close } = await openApp(browser, { seed: seedMatch });
  const dir = tmpDir('match'), paths = [path.join(dir, 'zzz unknown.pdf'), path.join(dir, 'Ben Beta rubric.pdf')];
  fs.writeFileSync(paths[0], await makePaper({ title: 'First' })); fs.writeFileSync(paths[1], await makePaper({ title: 'Second' }));
  await page.click('#pickMatch');
  await page.waitForSelector('#dlgBox [data-pf]');
  const [fc] = await Promise.all([page.waitForFileChooser(), page.click('#dlgBox [data-pf]')]);
  await fc.accept(paths);
  await page.waitForSelector('#dlgBox select[data-row]');
  return { page, close: async () => { await close(); fs.rmSync(dir, { recursive: true, force: true }); } };
};
const goLabel = page => page.$eval('#dlgBox [data-go]', b => b.textContent);
// The dialog redraws itself, so this waits to see the new number there.
const goSays = (page, text) => page.waitForFunction(t => document.querySelector('#dlgBox [data-go]').textContent === t, { timeout: 5000 }, text);
const opened = (page, classId) => page.waitForFunction(c => { const b = window.__gs.state().batch; return b && b.classId === c; }, { timeout: 30000 }, classId);
const filesOf = page => page.evaluate(() => Object.fromEntries(window.__gs.state().batch.students.filter(s => s.files.length).map(s => [s.key, s.files.length])));

test('Match files: changing a student, then Open, opens what she chose', async () => {
  const { page, close } = await matchOpen();
  assert.equal(await goLabel(page), 'Open 1 file for 1 student', 'Ben is matched by the file name');
  await page.select('#dlgBox select[data-row="0"]', '0');   // the unknown file goes to Ann
  await goSays(page, 'Open 2 files for 2 students');
  await page.select('#dlgBox select[data-row="1"]', '-2');  // and the other one is skipped
  await goSays(page, 'Open 1 file for 1 student');
  await page.select('#dlgBox select[data-row="1"]', '2');   // no, it goes to Cal
  await goSays(page, 'Open 2 files for 2 students');
  await page.click('#dlgBox [data-go]');
  await closed(page);
  await opened(page, 'c1');
  assert.deepEqual(await filesOf(page), { 'Ann Alpha': 1, 'Cal Gamma': 1 });
  assert.deepEqual(page.errors, []);
  await close();
});

test('Match files: changing the class, then choosing, follows the new class and opens in it', async () => {
  const { page, close } = await matchOpen();
  await page.select('#mrCls', 'c2');
  await goSays(page, 'Open 0 files for 0 students');
  assert.deepEqual(await page.$eval('#dlgBox select[data-row="0"]', s => [...s.options].map(o => o.textContent)), ['Choose a student…', 'Dee Delta', 'Eli Echo', 'Skip this file']);
  await page.select('#dlgBox select[data-row="0"]', '1');
  await goSays(page, 'Open 1 file for 1 student');
  await page.click('#dlgBox [data-go]');
  await closed(page);
  await opened(page, 'c2');
  assert.deepEqual(await filesOf(page), { 'Eli Echo': 1 });
  assert.deepEqual(page.errors, []);
  await close();
});

for (const [name, sel] of [['Cancel', '#dlgBox .bf [data-close]'], ['the X', '#dlgBox .bh [data-close]']]) test('Match files: ' + name + ' still closes it after a change, and opens nothing', async () => {
  const { page, close } = await matchOpen();
  await page.select('#dlgBox select[data-row="0"]', '0');
  await goSays(page, 'Open 2 files for 2 students');
  await page.click(sel);
  await closed(page);
  assert.ok(!await page.evaluate(() => window.__gs.state().batch), 'nothing opened');
  assert.deepEqual(await page.$eval('#dlgBox', b => [b.onclick, b.onchange]), [null, null], 'nothing is left on the box');
  assert.deepEqual(page.errors, []);
  await close();
});

test('removing a rubric row keeps every score with its own row, after asking', async () => {
  const { page, close, srv } = await openApp(browser);
  await openZip(page, zip3);
  await score(page, [1, 3, 4]);
  await goToStudent(page, 1);
  await score(page, [2, 2, 2]);
  await goToStudent(page, 2);   // no score on the row that goes
  await score(page, [null, 4, 4]);
  await goToStudent(page, 0);
  assert.equal((await grade(page)).total, 8);
  const before = await grade(page);
  await editSetup(page);
  await page.$eval('[data-lvrow="1"]', d => { d.open = true; });
  await page.click('[data-lvi="1"][data-lvv="3"]'); await page.keyboard.type('Good evidence');
  await page.click('#dlgBox [data-rm="0"]');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page, { yes: false });   // she can go back
  assert.match(page.lastDialog, /2 students/, page.lastDialog);
  assert.deepEqual((await grade(page)).rubric, [1, 3, 4], 'nothing changes yet');
  assert.ok(await page.$('#setupBody'), 'the setup stays open');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page);
  await closed(page);
  assert.deepEqual(await panelRows(page), ['Criterion 23 / 4', 'Criterion 34 / 4']);
  const g = await grade(page);
  assert.deepEqual(g.rubric, [3, 4]);
  assert.equal(g.total, 7, 'the right total');
  assert.equal(g.done, true);
  assert.ok(g.at > before.at, 'the score counts as changed');
  assert.equal(g.atR[0], before.atR[1], 'each row keeps its own time');
  assert.equal(g.atR[1], before.atR[2]);
  assert.equal(g.atR[2], undefined);
  assert.deepEqual((await grade(page, 1)).rubric, [2, 2]);
  assert.deepEqual((await grade(page, 2)).rubric, [4, 4]);
  assert.equal(await page.evaluate(() => window.__gs.state().setup.levels[0][3]), 'Good evidence', 'the words stay with the row');

  await settle(page);   // and they're still there when it opens again
  await page.goto(srv.url); await appReady(page); await sleep(300);
  await openZip(page, zip3);
  assert.deepEqual((await grade(page)).rubric, [3, 4]);
  assert.equal((await grade(page)).total, 7);
  assert.deepEqual(page.errors, []);
  await close();
});

test('removing a row leaves later scores on their own rows when an earlier row was skipped this session', async () => {
  const { page, close, srv } = await openApp(browser);
  await openZip(page, zip3);
  await score(page, [null, 4, 2]);   // Criterion 1 never clicked, so this session's list has a gap there
  await goToStudent(page, 1);
  await score(page, [null, null, 3]);
  await goToStudent(page, 2);
  await score(page, [1, null, 3]);
  const benAt = (await grade(page, 1)).atR[2];
  await goToStudent(page, 0);
  await editSetup(page);
  await page.click('#dlgBox [data-rm="1"]');   // Criterion 2, after the gap
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page);
  await closed(page);
  assert.deepEqual(await panelRows(page), ['Criterion 1', 'Criterion 32 / 4'], 'the 2 stays on Criterion 3');
  assert.deepEqual((await grade(page)).rubric, [null, 2]);
  const ben = await grade(page, 1);
  assert.deepEqual(ben.rubric, [null, 3], 'the row before stays empty');
  assert.deepEqual(Object.keys(ben.atR), ['1'], 'the time moves with the score');
  assert.equal(ben.atR[1], benAt);
  assert.deepEqual((await grade(page, 2)).rubric, [1, 3]);

  await score(page, [3]);   // filling the row that looks empty adds up
  assert.deepEqual((await grade(page)).rubric, [3, 2]);
  assert.equal((await grade(page)).total, 5);
  await settle(page);
  await page.goto(srv.url); await appReady(page); await sleep(300);
  await openZip(page, zip3);
  assert.deepEqual((await grade(page)).rubric, [3, 2], 'still right when it opens again');
  assert.deepEqual((await grade(page, 1)).rubric, [null, 3]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a points score’s time stays when a row goes, and rows keep theirs', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip3);
  await score(page, [1, 3, 4]);
  await page.evaluate(() => { const g = window.__gs.state().batch.students[0].grade; g.atR.points = 1234; });
  const before = await grade(page);
  await editSetup(page);
  await page.click('#dlgBox [data-rm="0"]');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page);
  await closed(page);
  const g = await grade(page);
  assert.deepEqual(g.rubric, [3, 4]);
  assert.equal(g.atR.points, 1234, 'a points score’s time isn’t a row’s');
  assert.equal(g.atR[0], before.atR[1]);
  assert.equal(g.atR[1], before.atR[2]);
  assert.deepEqual(Object.keys(g.atR).sort(), ['0', '1', 'points']);
  assert.deepEqual(page.errors, []); await close();
});

test('a row removed and then cancelled changes nothing; a last row or an unscored row just goes', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip3);
  await score(page, [1, 3, null]);
  await editSetup(page);
  await page.click('#dlgBox [data-rm="0"]');
  await page.click('#dlgBox .bf [data-cancel]');
  await closed(page);
  assert.deepEqual((await grade(page)).rubric, [1, 3]);
  assert.equal(await page.$$eval('.crit', a => a.length), 3);

  await editSetup(page);   // no one has a score on the last row, so nothing is at stake
  await page.click('#dlgBox [data-rm="2"]');
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  assert.deepEqual((await grade(page)).rubric.slice(0, 2), [1, 3]);
  assert.equal((await grade(page)).total, 4);

  await editSetup(page);   // a row removed with a new one added after: the new row starts empty
  await page.click('#dlgBox [data-add]');
  await page.click('#dlgBox [data-rm="0"]');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page);
  await closed(page);
  const g = await grade(page);
  assert.equal(g.rubric[0], 3);
  assert.equal(g.rubric[1] == null, true);
  assert.equal(g.total, 3);
  assert.equal(g.partial, true);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a row taken away and then a saved rubric used goes by place, as Use says', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip3);
  await page.evaluate(() => localStorage.setItem('gs.rubrics', JSON.stringify([{ id: 'r1', name: 'Two rows', criteria: ['Thesis', 'Style'], at: 1 }])));
  await score(page, [1, 3, null]);
  await editSetup(page);
  await page.click('#dlgBox [data-rm="0"]');
  await page.click('#dlgBox [data-rbuse="r1"]');
  await answerDlg(page);
  await page.waitForFunction(() => document.querySelector('#setupBody [data-ci]').value === 'Thesis');
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  assert.deepEqual((await grade(page)).rubric.slice(0, 2), [1, 3]);
  assert.deepEqual(await panelRows(page), ['Thesis1 / 4', 'Style3 / 4']);
  await close();
});

/* ---------------- a card with no setup of its own ---------------- */
const cardSeed = { ls: { 'gs.lib': JSON.stringify({ classes: [{ id: 'c1', name: 'Period 1', names: ['Ann Alpha', 'Ben Beta', 'Cal Gamma'], units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'it1', name: 'River essay', classId: 'c1' }] }] }], loose: { id: '', units: [] }, units: [] }) } };
const openCard = (page, z) => page.evaluate(async ents => { const G = window.__gs, it = G.state().lib.classes[0].units[0].items[0]; await G.intake(ents.map(([p, a]) => ({ path: p, data: new Uint8Array(a) })), 'River', it); }, Object.entries(unzipSync(z)).map(([p, b]) => [p, [...b]]));
for (const [name, change, want] of [
  ['only a different scale', async page => { await page.click('#dlgBox [data-preset="fives"]'); }, { total: 9, pct: 86 }],
  ['Just the total, out of 20', async page => { await page.click('#dlgBox [data-m="points"]'); await page.$eval('#outOf', e => { e.value = '20'; e.dispatchEvent(new Event('input', { bubbles: true })); }); }, { total: 9, pct: 86 }],
]) test('a card reopens with its own setup after another download saved ' + name, async () => {
  const { page, close, srv } = await openApp(browser, { seed: cardSeed });
  await openCard(page, zip3);
  await waitPaper(page); await sleep(300);
  await score(page, [3, 3, 3]);
  assert.equal((await grade(page)).pct, 86);
  await settle(page);
  await page.goto(srv.url); await appReady(page); await sleep(300);
  await openZip(page, zipOf(await quizFiles()), 'quiz.zip');
  await editSetup(page);
  await change(page);
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  await sleep(100); await settle(page);
  await page.goto(srv.url); await appReady(page); await sleep(300);
  await openCard(page, zip3);
  await waitPaper(page); await sleep(300);
  const g = await grade(page);
  assert.equal(g.total, want.total);
  assert.equal(g.pct, want.pct);
  assert.deepEqual(await panelRows(page), ['Criterion 13 / 4', 'Criterion 23 / 4', 'Criterion 33 / 4']);
  assert.ok(await page.evaluate(() => !!window.__gs.state().batch.assignment.setup), 'the card now keeps it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a card opened for the first time still starts from the last setup, and a card’s own setup still wins', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { ...cardSeed.ls, 'gs.setup': JSON.stringify(POINTS) } } });
  await openCard(page, zip3);
  await waitPaper(page); await sleep(200);
  const su = await page.evaluate(() => window.__gs.state().setup);
  assert.equal(su.mode, 'points');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.assignment.setup.mode), 'points');
  await close();
});

/* ---------------- a Word rubric's score ---------------- */
for (const mode of ['points', 'rubric']) test('un-highlighting a Word rubric takes its score away, ' + mode, async () => {
  const { page, close } = await openApp(browser, mode === 'points' ? { seed: seedPoints } : {});
  await openZip(page, await wordZip([null, null, null]));
  await goToStudent(page, 1); await page.waitForSelector('td.rcell'); await sleep(200);
  await clickBox(page, 1);   // 3 on the first row
  let g = await grade(page, 1);
  assert.equal(g.total, 3);
  await clickBox(page, 1);
  g = await grade(page, 1);
  assert.equal(g.total, null, 'no score now');
  assert.equal(g.done, false);
  assert.equal(g.partial, undefined);
  assert.equal(await page.evaluate(() => /–\s*\/\s*12/.test(document.querySelector('.rinfo').textContent)), true);
  assert.match(await page.$eval('#grade .total', e => e.textContent), /^–/);
  assert.match(await page.$eval('#stuList .stu[data-i="1"]', e => e.textContent), /^(?!.*\b3\b)/);
  await sleep(900);   // the file is saved, and reading it again changes nothing
  await page.evaluate(() => window.__gs.wordScoresAll()); await sleep(100);
  assert.equal((await grade(page, 1)).total, null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('un-highlighting leaves a score she typed herself, and blanks the rubric’s own Total line', async () => {
  const blank = '<w:p><w:r><w:t>Total score: ____ / 12 = ____ %</w:t></w:r></w:p>';
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, await wordZip([null, null, null], undefined, blank));
  await goToStudent(page, 1); await page.waitForSelector('td.rcell'); await sleep(200);
  await clickBox(page, 1);
  assert.match(await page.$eval('.dpage', e => e.textContent), /Total score:\s*3 \/ 12 = 60%/);
  await clickBox(page, 1);
  assert.doesNotMatch(await page.$eval('.dpage', e => e.textContent), /\b3 \/ 12|60%/);
  await sleep(900);
  await page.evaluate(() => window.__gs.wordScoresAll()); await sleep(100);
  await page.evaluate(() => window.__gs.scanAll()); await sleep(200);
  assert.equal((await grade(page, 1)).total, null, 'the blank line isn’t read back as a grade');

  await clickBox(page, 1);   // 3, then she types her own, then un-highlights
  await page.$eval('#ptsIn', e => { e.value = '7'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await clickBox(page, 1);
  assert.equal((await grade(page, 1)).total, 7, 'her own score stays');
  await close();
});

test('Back to the original takes away what the Word rubric gave, and brings in what the original has', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, await wordZip([null, null, null]));
  await goToStudent(page, 1); await page.waitForSelector('td.rcell'); await sleep(200);
  for (const k of [1, 6, 11]) await clickBox(page, k);
  assert.equal((await grade(page, 1)).total, 9);
  await sleep(900);
  await page.click('[data-wedit]');
  await page.waitForSelector('[data-wreset]');
  await page.click('[data-wreset]');
  await page.waitForFunction(() => { const r = document.querySelector('.rinfo'); return r && /^–/.test(r.textContent) && !document.querySelector('.wbar:not([hidden])'); });
  const g = await grade(page, 1);
  assert.equal(g.total, null);
  assert.equal(g.points, '');
  assert.equal(g.done, false);
  assert.deepEqual(page.errors, []);
  await close();
});

test('clearing a box’s color in Edit counts the same as clicking it off', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, await wordZip([null, null, null]));
  await goToStudent(page, 1); await page.waitForSelector('td.rcell'); await sleep(200);
  await clickBox(page, 1);
  assert.equal((await grade(page, 1)).total, 3);
  await page.click('[data-wedit]');
  await page.waitForSelector('.wbar [data-cell=""]');
  await clickBox(page, 1);
  await page.click('.wbar [data-cell=""]');
  await sleep(150);
  assert.equal((await grade(page, 1)).total, null);
  await close();
});

test('a Word rubric’s percent follows the setup, on the Grade sheet too', async () => {
  const z = await wordZip([3, 3, 3]);
  const sheetRow = async page => {
    await page.evaluate(() => window.__gs.openSheet(true));
    await page.waitForSelector('#shBody table');
    await page.waitForFunction(() => [...document.querySelectorAll('#shBody tbody tr')].some(t => /Ben/.test(t.textContent) && /%/.test(t.textContent)));
    const t = await page.$$eval('#shBody tbody tr', a => a.map(t => t.textContent.replace(/\s+/g, ' ')).filter(t => /Ben/.test(t)));
    await page.click('#dlgBox [data-close]');
    await closed(page);
    return t[0];
  };
  // out of 10 when it opens; her own rubric page makes it out of 12 (a student's table never changes the class)
  { const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify({ ...POINTS, outOf: 10, rubricPage: { id: 'r1', name: 'Rubric.docx' }, rubricPos: 'end' }), 'gs.rp.r1': JSON.stringify(Buffer.from(wordRubric([3, 3, 3])).toString('base64')) } } });
    await openZip(page, zip3); await page.waitForFunction(() => window.__gs.state().setup.outOf === 12 && window.__gs.state().batch.students[1].grade.points === '9');
    assert.equal((await grade(page, 1)).pct, 86);
    assert.match(await sheetRow(page), /= 86%/);
    await close(); }
  // she changes the scale afterwards
  { const { page, close } = await openApp(browser, { seed: seedPoints });
    await openZip(page, z); await useReading(page, 1); await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.points === '9');
    assert.match(await sheetRow(page), /= 86%/);
    await editSetup(page);
    await page.click('#dlgBox [data-preset="fives"]');
    await page.click('#dlgBox .bf [data-save]');
    await closed(page);
    assert.equal((await grade(page, 1)).pct, 85);
    assert.match(await sheetRow(page), /= 85%/);
    assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].files[0].wscore.pct), 85);
    await close(); }
});

test('a grade typed in a Word file follows the scale too, unless the file says the percent itself', async () => {
  const z = zipOf({ 'Abe Paper/E.pdf': await makePaper({ title: 'a' }), 'Ann Alpha/Essay.docx': wordDoc(['Total 10/12']), 'Ben Beta/Essay.docx': wordDoc(['Total 10/12 = 77%']) });
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, z, 'd.zip');
  await useReading(page, 1); await useReading(page, 2);
  assert.equal((await grade(page, 1)).pct, 91);
  assert.equal((await grade(page, 2)).pct, 77);
  await editSetup(page);
  await page.click('#dlgBox [data-preset="fives"]');
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  await page.evaluate(() => window.__gs.scanAll()); await sleep(200);
  assert.equal((await grade(page, 1)).pct, await page.evaluate(() => window.__gs.percentFor(10)));
  assert.equal((await grade(page, 1)).pct, 90);
  assert.equal((await grade(page, 2)).pct, 77, 'what the file says stays');
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- the points box ---------------- */
test('the up and down arrows in the points box move between students and leave the score alone', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, zip3);
  await page.click('#ptsIn');
  await page.keyboard.type('10');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__gs.state().cur === 1);
  await sleep(200);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.points), '10');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].grade.points), '', 'and it moved just one student');
  assert.equal(await page.evaluate(() => window.__gs.state().cur), 1);
  await page.click('#ptsIn');
  await page.keyboard.type('8');
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => window.__gs.state().cur === 0);
  await sleep(200);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].grade.points), '8');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.points), '10');
  // nor does the wheel change it
  await page.click('#ptsIn');
  const r = await page.$eval('#ptsIn', e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(r.x, r.y); await page.mouse.wheel({ deltaY: 100 }); await sleep(150);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.points), '10', 'the wheel leaves it alone');
  // left and right still move the cursor in the box
  await page.click('#ptsIn');
  await page.keyboard.press('ArrowLeft');
  await sleep(100);
  assert.equal(await page.evaluate(() => window.__gs.state().cur), 0);
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- switching how it's scored ---------------- */
test('switching to Just the total asks when row scores would stop counting, and they come back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip3);
  await score(page, [3, 3, 3]);
  await editSetup(page);
  await page.click('#dlgBox [data-m="points"]');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page, { yes: false });
  assert.match(page.lastDialog, /1 student/, page.lastDialog);
  assert.match(page.lastDialog, /won’t count/, page.lastDialog);
  assert.ok(await page.$('#setupBody'), 'the setup stays open');
  assert.equal(await page.evaluate(() => window.__gs.state().setup.mode), 'rubric');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page);
  await closed(page);
  assert.equal(await page.evaluate(() => window.__gs.state().setup.mode), 'points');
  assert.equal((await grade(page)).total, null);
  assert.deepEqual((await grade(page)).rubric, [3, 3, 3], 'still saved');

  await page.click('#ptsIn'); await page.keyboard.type('10');   // and back: a total stops counting, the rows return
  await editSetup(page);
  await page.click('#dlgBox [data-m="rubric"]');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page);
  assert.match(page.lastDialog, /1 student has a total/, page.lastDialog);
  await closed(page);
  assert.equal((await grade(page)).total, 9);
  assert.equal((await grade(page)).points, '10', 'the total is still saved');
  assert.deepEqual(page.errors, []);
  await close();
});

test('switching to rows asks when typed totals would stop counting; nothing to lose asks nothing', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, zip3);
  await editSetup(page);   // no scores: no question
  await page.click('#dlgBox [data-m="rubric"]');
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  await editSetup(page);
  await page.click('#dlgBox [data-m="points"]');
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  await page.click('#ptsIn'); await page.keyboard.type('10');
  await editSetup(page);
  await page.click('#dlgBox [data-m="rubric"]');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page);
  assert.match(page.lastDialog, /1 student has a total/, page.lastDialog);
  await closed(page);
  assert.equal((await grade(page)).points, '10', 'still saved');
  assert.deepEqual(page.errors, []);
  await close();
});

test('bringing in a rubric that swaps the generic rows for a total asks before row scores stop counting', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip3);
  await score(page, [3, 3, 3]);
  await editSetup(page);
  const done = await pickFile(page, '#rpIn', await makePaper({ title: 'My rubric' }), 'Rubric.pdf');
  await page.waitForFunction(() => /Rubric\.pdf/.test(document.querySelector('#setupBody').textContent));
  done();
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page, { yes: false });
  assert.match(page.lastDialog, /won’t count/, page.lastDialog);
  await page.click('#dlgBox [data-m="rubric"]');   // she can keep her rows and still have the rubric page
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  assert.equal(await page.evaluate(() => window.__gs.state().setup.mode), 'rubric');
  assert.equal((await grade(page)).total, 9);
  await close();
});

test('using a saved rubric, which already asks, doesn’t ask a second time at Save', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, zip3);
  await page.evaluate(() => localStorage.setItem('gs.rubrics', JSON.stringify([{ id: 'r1', name: 'Two rows', criteria: ['Thesis', 'Style'], at: 1 }])));
  await page.click('#ptsIn'); await page.keyboard.type('10');
  await editSetup(page);
  await page.click('#dlgBox [data-rbuse="r1"]');
  await answerDlg(page);
  assert.match(page.lastDialog, /won’t count/);
  await page.waitForFunction(() => document.querySelector('#setupBody [data-ci]'));
  await page.click('#dlgBox .bf [data-save]');
  await closed(page);
  assert.equal(await page.evaluate(() => window.__gs.state().setup.mode), 'rubric');
  await close();
});

/* ---------------- smaller things ---------------- */
test('a Word rubric moved to another student clears each row’s time along with its score', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await wordZip([3, 3, 3]));
  await useReading(page, 1);
  await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.rubric.length === 3);
  const r = await page.evaluate(async () => {
    const G = window.__gs, S = G.state().batch.students, st = S[1], t0 = 1000;
    st.grade.at = t0; st.grade.atR = { 0: t0, 1: t0, 2: t0 };
    await G.moveFile(st, st.files[0].path, S[0]);
    return { rubric: st.grade.rubric, atR: st.grade.atR, at: st.grade.at };
  });
  assert.deepEqual(r.rubric, []);
  assert.ok(r.at > 1000);
  for (const k of [0, 1, 2]) assert.ok(r.atR[k] > 1000, 'row ' + k);
  await close();
});

test('the start screen counts scores the way the Grades list does, and follows the roster', async () => {
  const z = zipOf({ 'Ann One/E.pdf': await makePaper({ title: 'a' }), 'Ben Two/E.pdf': await makePaper({ title: 'b' }), 'Cal Three/E.pdf': await makePaper({ title: 'c' }), 'Dee Four/E.pdf': await makePaper({ title: 'd', lines: ['9.5 = 88%'] }), 'Eli Five/E.pdf': await makePaper({ title: 'e' }) });
  const { page, close } = await openApp(browser);
  await openZip(page, z);
  await score(page, [3, 3, 3]);          // a full score
  await goToStudent(page, 1);
  await score(page, [3, null, null]);    // a partial
  await goToStudent(page, 2);
  await page.click('[data-status="missing"]');
  await goToStudent(page, 3);            // Dee: read from the paper, and she says it's the grade
  await useReading(page, 3);
  await goToStudent(page, 0);
  const shown = await page.evaluate(() => { const G = window.__gs, S = G.state().batch.students, on = S.filter(s => !G.noScore(s)); return on.filter(s => G.gradeOf(s).done).length + ' of ' + on.length; });
  assert.equal(shown, '2 of 4');
  await page.evaluate(() => window.__gs.saveNow());
  await settle(page);
  await page.click('#closeBtn');
  await page.waitForSelector('#kept .krow');
  const row = await page.$eval('#kept .krow', e => e.textContent);
  assert.match(row, /5 students · 2 scored · 1 partial · 1 missing or excused/, row);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a Word rubric whose rows go to 5 says it won’t match rows that go to 4', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await wordZip([4, 3, 3], [5, 4, 3, 2, 1, 0]));
  await goToStudent(page, 1); await page.waitForSelector('.rinfo'); await sleep(200);
  assert.match(await page.$eval('.rinfo', e => e.textContent), /This rubric is out of 15, but Rubric setup is out of 12/);
  await close();
  const pts = await openApp(browser, { seed: seedPoints });
  await openZip(pts.page, await wordZip([4, 3, 3]));
  await goToStudent(pts.page, 1); await pts.page.waitForSelector('.rinfo'); await sleep(200);
  assert.doesNotMatch(await pts.page.$eval('.rinfo', e => e.textContent), /Rubric setup is out of/);
  await pts.close();
});

test('the overview waits for the papers, and says it’s her score that’s off the scale, not the paper', async () => {
  const z = zipOf({ 'Ann One/E.pdf': await makePaper({ title: 'a' }), 'Ben Two/E.pdf': await makePaper({ title: 'b' }), 'Cal Three/E.pdf': await makePaper({ title: 'c' }), 'Dee Four/E.pdf': await notedPaper('d', '9.5 = 88%') });
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, z);
  await page.evaluate(() => window.__gs.openOverview());
  await page.waitForSelector('#ovLeft');
  assert.match(await page.$eval('#ovLeft', e => e.textContent), /^Counted: 1 of 4/);
  await page.click('#dlgBox .bf [data-close]');
  await closed(page);
  // while the papers are still being read, from the Grades list
  await page.evaluate(async () => { const G = window.__gs; G.openGrades(); const p = G.scanAll(); document.querySelector('#dlgBox [data-ovopen]').click(); await p; });
  await page.waitForSelector('#ovLeft');
  await page.$eval('#ptsIn', e => { e.value = '13'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await goToStudent(page, 1);
  await page.$eval('#ptsIn', e => { e.value = '-1'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => window.__gs.openOverview());
  await page.waitForSelector('#ovLeft');
  const left = await page.$eval('#ovLeft', e => e.textContent), who = await page.$eval('#ovWho', e => e.textContent);
  assert.match(left, /2 above the total or below 0/, left);
  assert.doesNotMatch(left, /from the paper/, left);
  assert.match(who, /You gave 13, out of 12/);
  assert.doesNotMatch(who, /The paper says/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the spread chart keeps to a few ticks and a short tip with big classes, and labels a decimal top', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, zip3);
  const r = await page.evaluate(() => {
    const G = window.__gs, s = G.state(), st = s.batch.students;
    const many = []; for (let i = 0; i < 150; i++) many.push({ name: 'Student ' + i, total: 9 });
    const bins = G.spreadBins(many, 12);
    s.setup.outOf = 12.5;
    return { top: G.spreadBins([{ name: 'A', total: 12.5 }], 12.5).pop(), n: bins[9].who.length };
  });
  assert.equal(r.n, 150);
  assert.equal(r.top.label, '12 to 12.5');
  assert.deepEqual(r.top.who, ['A']);
  await close();
});

test('copy all scores keeps the percent sign on a percent-only reading', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip3);
  const r = await page.evaluate(() => { const T = window.__gs.scoreText; return [T({ total: null, pct: 85 }, 'any'), T({ total: 9, pct: 85 }, 'any'), T({ total: 9, pct: 85 }, 'pct'), T({ total: 3, pct: 60, partial: true }, 'any')]; });
  assert.deepEqual(r, ['85%', '9', '85', '3 (partial)']);
  await close();
});

test('the printed grade sheet says her own score, missing and excused, and where they differ from the paper', async () => {
  const z = zipOf({ 'Ann One/E.pdf': await makePaper({ title: 'a', lines: ['10/12 = 91%'] }), 'Ben Two/E.pdf': await makePaper({ title: 'b' }), 'Cal Three/E.pdf': await makePaper({ title: 'c' }) });
  const { page, close } = await openApp(browser);
  await openZip(page, z);
  await useReading(page, 0);
  await score(page, [3, 3, 3]);
  await goToStudent(page, 2);
  await page.click('[data-status="excused"]');
  await page.evaluate(() => { window.__said = []; const was = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__said.push(String(t)); return was.call(this, t, ...a); }; });
  await page.evaluate(() => window.__gs.openSheet(false));
  await page.waitForSelector('#dlgBox [data-pdf]');
  await page.click('#dlgBox [data-pdf]');
  await page.waitForFunction(() => window.__said.some(t => /Excused/.test(t)));
  const said = await page.evaluate(() => window.__said);
  assert.ok(said.includes('Your score: 9 / 12 = 86%'), said.join(' | '));
  assert.ok(said.includes('The paper says 10'), said.join(' | '));
  assert.ok(said.includes('Excused'));
  assert.deepEqual(page.errors, []);
  await close();
});

const docText = bytes => Buffer.from(unzipSync(bytes)['word/document.xml']).toString('utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const LINE = '<w:p><w:r><w:t>Total: ____ / 12 = ____%</w:t></w:r></w:p>';
const clickBoxes = async (page, n = 0) => { await page.waitForSelector('td.rcell'); await sleep(200); const c = await page.$$('td.rcell'); for (const k of [1, 6, 11]) { await c[n + k].click(); await sleep(100); } await sleep(1000); };
const onScreenLine = page => page.evaluate(() => [...document.querySelectorAll('.dpage p.wp')].map(p => p.textContent).filter(t => /Total/.test(t)).join());

test('a Word rubric’s own Total line follows a new grading scale, on screen, in a file not on screen, and in the export', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, zipOf({ 'Aaa First/Essay.pdf': await makePaper({ title: 'First' }), 'Ana Example/Rubric.docx': wordRubric([null, null, null], [4, 3, 2, 1, 0], LINE), 'Ben Example/Rubric.docx': wordRubric([null, null, null], [4, 3, 2, 1, 0], LINE), 'Cy Blank/Rubric.docx': wordRubric([null, null, null], [4, 3, 2, 1, 0], LINE) }));
  await goToStudent(page, 1); await clickBoxes(page);
  await goToStudent(page, 2); await clickBoxes(page);
  assert.match(await onScreenLine(page), /Total: 9 \/ 12 = 86%/);
  await editSetup(page); await page.click('#dlgBox [data-preset="fives"]'); await page.click('#dlgBox .bf [data-save]'); await closed(page);
  await page.waitForFunction(() => /= 85%/.test([...document.querySelectorAll('.dpage p.wp')].map(p => p.textContent).join()));
  assert.equal((await grade(page, 2)).pct, 85);
  await sleep(1000);
  const inFile = i => page.evaluate(i => { const b = window.__gs.state().batch.students[i].files[0].data; let s = ''; for (let k = 0; k < b.length; k++) s += String.fromCharCode(b[k]); return btoa(s); }, i).then(s => docText(Buffer.from(s, 'base64')));
  assert.match(await inFile(1), /Total: 9 \/ 12 = 85%/, 'the file of a student not on screen');
  assert.match(await inFile(2), /Total: 9 \/ 12 = 85%/, 'the file on screen');
  assert.match(await inFile(3), /Total: ____ \/ 12 = ____%/, 'a line never filled in waits for a click');
  await goToStudent(page, 1); await page.waitForSelector('td.rcell'); await sleep(300);
  assert.match(await onScreenLine(page), /Total: 9 \/ 12 = 85%/);
  await settle(page);
  // It stays that way when the download is opened again.
  await page.reload(); await appReady(page);
  await page.waitForSelector('#kept [data-kopen]'); await page.click('#kept [data-kopen]');
  await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && !a.hidden && !!window.__gs.state().batch; });
  await sleep(500);
  const dl = await catchDownloads(page);
  await page.click('#exportBtn'); await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  const un = unzipSync(got.bytes), names = Object.keys(un).filter(k => /Rubric\.docx$/.test(k));
  assert.ok(names.length >= 2, names.join());
  for (const k of names) assert.match(docText(un[k]), /Total: 9 \/ 12 = 85%/, k);
  await dl.close();
  assert.deepEqual(page.errors, []);
  await close();
});

test('a line in a student’s own file that isn’t her score doesn’t change with the scale', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, zipOf({ 'Ana Example/Essay.pdf': await makePaper({ title: 'Ana' }), 'Ben Example/Rubric.docx': wordRubric([4, 3, 2], [4, 3, 2, 1, 0], '<w:p><w:r><w:t>Total: 9 / 12 = 90%</w:t></w:r></w:p>') }));
  await goToStudent(page, 1); await page.waitForSelector('td.rcell');
  await page.click('[data-wedit]'); await page.click('[data-wedit]'); await sleep(500);   // saved as edited, with no score of hers
  await editSetup(page); await page.click('#dlgBox [data-preset="fives"]'); await page.click('#dlgBox .bf [data-save]'); await closed(page);
  await sleep(1000);
  assert.match(await onScreenLine(page), /= 90%/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('replacing a Word rubric under a new name asks, and a copy she highlighted stays hers, through a reopen', async () => {
  const { page, close } = await openApp(browser, { seed: seedPoints });
  await openZip(page, zip3);
  await editSetup(page);
  let done = await pickFile(page, '#rpIn', wordRubric([null, null, null]), 'My rubric.docx'); await page.waitForFunction(() => /My rubric\.docx/.test(document.querySelector('#setupBody').textContent)); done();
  await page.click('#dlgBox .bf [data-save]'); await closed(page);
  await clickBoxes(page);
  assert.equal((await grade(page, 0)).total, 9);
  await settle(page);
  await editSetup(page);
  done = await pickFile(page, '#rpIn', wordRubric([null, null, null], [4, 3, 2, 1, 0], '<w:p><w:r><w:t>Second version</w:t></w:r></w:p>'), 'My rubric v2.docx'); await page.waitForFunction(() => /v2\.docx/.test(document.querySelector('#setupBody').textContent)); done();
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page, { yes: false });   // Go back loses nothing
  assert.match(page.lastDialog, /1 student already has highlights or typing on their copy of your rubric\. That copy stays as it is/, page.lastDialog);
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page);
  await closed(page);
  const shaded = () => page.$$eval('td.rcell', a => a.filter(t => t.style.backgroundColor && t.style.backgroundColor !== 'white').length);
  const files = i => page.evaluate(i => window.__gs.state().batch.students[i].files.filter(f => f.virtual).map(f => [f.path, !!f.edited]), i);
  await page.waitForFunction(() => window.__gs.state().batch.students[0].files.some(f => /v2/.test(f.path)));
  await page.waitForSelector('td.rcell'); await sleep(500);
  assert.equal(await shaded(), 3);
  assert.deepEqual(await files(0), [['Ann Alpha/My rubric v2.docx', true]]);
  assert.deepEqual(await files(1), [['Ben Beta/My rubric v2.docx', false]], 'someone with nothing on their copy gets the new one');
  assert.deepEqual([(await grade(page, 0)).total, (await grade(page, 0)).pct], [9, 86]);
  await settle(page);
  await page.reload(); await appReady(page);
  await page.waitForSelector('#kept [data-kopen]'); await page.click('#kept [data-kopen]');
  await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && !a.hidden && !!window.__gs.state().batch; });
  await page.waitForSelector('td.rcell'); await sleep(500);
  assert.equal(await shaded(), 3, 'after opening it again');
  assert.deepEqual([(await grade(page, 0)).total, (await grade(page, 0)).pct], [9, 86]);
  // Back to the original starts her over on the new rubric.
  await page.click('[data-wedit]'); await page.click('[data-wreset]');
  await page.waitForFunction(() => /Second version/.test([...document.querySelectorAll('.dpage')].map(p => p.textContent).join()));
  // Taking the rubric off says what goes.
  await page.waitForFunction(() => document.querySelector('td.rcell'));
  await clickBoxes(page);
  await settle(page);
  await editSetup(page);
  await page.click('#dlgBox [data-rprm]');
  await page.click('#dlgBox .bf [data-save]');
  await answerDlg(page, { yes: false });
  assert.match(page.lastDialog, /1 student has marks on their copy of your rubric\. That copy goes, along with what’s on it\. Scores stay as they are\./, page.lastDialog);
  await page.click('#dlgBox .bf [data-cancel]');
  assert.deepEqual(page.errors, []);
  await close();
});
