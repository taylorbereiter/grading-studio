// Reading grades off papers: words a student could have typed never become a score on their own, her own marks do,
// and a grade goes when the mark holding it goes. Driven through the real built app.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync, zipSync, strToU8 } = require('fflate');
const { PDFDocument, PDFName, PDFString, PDFHexString } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, openZip, setTool, clickAt } = require('./helpers/app');
const { makePaper, makeDocx, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NOTHING = { total: null, pct: null, done: false };
// A fresh copy of the app with these files open. points: a saved "just the total, out of 12" setup.
async function stack(files, { points } = {}) {
  const app = await openApp(browser, points ? { beforeLoad: page => page.evaluateOnNewDocument(() => { if (!localStorage.getItem('gs.setup')) localStorage.setItem('gs.setup', JSON.stringify({ mode: 'points', outOf: 12 })); }) } : {});
  await openZip(app.page, zipOf(files), 'Reading.zip');
  await app.page.evaluate(() => window.__gs.scanAll());
  return app;
}
const stu = (page, i) => page.evaluate(i => { const G = window.__gs, st = G.state().batch.students[i]; return { computed: G.gradeOf(st), doubts: (st.doubts || []).map(d => d.text), asks: (st.doubts || []).map(G.readingDoubt), n: st.foundCount, points: st.grade.points, rubric: st.grade.rubric }; }, i);
const noErrors = page => assert.deepEqual(page.errors, []);
const useIt = async page => {
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForSelector('.rd-ask [data-rd="1"]', { timeout: 60000 });
  const n = await page.$$eval('.rd-ask', a => a.length);
  await page.click('.rd-ask [data-rd="1"]');
  await page.waitForFunction(n => document.querySelectorAll('.rd-ask').length < n, {}, n);
};
const shut = page => page.evaluate(() => document.querySelector('#dlgBox [data-close]').click());
async function typeBox(page, x, y, text) {
  await setTool(page, 'text');
  await clickAt(page, 0, x, y);
  await page.waitForSelector('textarea.ed');
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await setTool(page, 'select');
}
// A Word file with a table: labels down the side, the given columns across, and the [row, column] boxes shaded.
function wordTable(cols, side, shaded) {
  const cell = (t, on) => '<w:tc><w:tcPr>' + (on ? '<w:shd w:val="clear" w:color="auto" w:fill="FFF59D"/>' : '') + '</w:tcPr><w:p><w:r><w:t>' + t + '</w:t></w:r></w:p></w:tc>';
  const rows = side.map((s, r) => '<w:tr>' + cell(s) + cols.map((_, c) => cell('words', shaded.some(([a, b]) => a === r && b === c))).join('') + '</w:tr>').join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr>' + cell('Part') + cols.map(c => cell(c)).join('') + '</w:tr>' + rows + '</w:tbl></w:body></w:document>';
  return zipSync({ ...unzipSync(makeDocx('x')), 'word/document.xml': strToU8(xml) });
}
// A student's planning table: it happens to have numbered rows and two shaded boxes.
const planTable = (shaded = [[1, 0], [1, 1]]) => wordTable(['Claim', 'Evidence'], ['Paragraph 1', 'Paragraph 2', 'Paragraph 3'], shaded);
const lines = (...t) => makeDocx(t.join('</w:t></w:r></w:p><w:p><w:r><w:t>'));
const withNote = async text => {
  const doc = await PDFDocument.load(await makePaper({ title: 'Kami' })), ctx = doc.context;
  const note = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'FreeText', Rect: [60, 300, 300, 360], DA: PDFString.of('/Helv 12 Tf 0 g'), F: 4, Contents: PDFHexString.fromText(text) }));
  doc.getPage(0).node.set(PDFName.of('Annots'), ctx.obj([note]));
  return doc.save();
};

/* ---------------- a student's page text ---------------- */
test('a student’s own page text is only ever offered, however it’s written', async () => {
  const texts = ['12/12 = 100%', 'Peer score: 9/12 = 75%', '9.5 = 88%', 'Grade: 11/12 = 95%'];
  const files = Object.fromEntries(await Promise.all(texts.map(async (t, i) => ['Student' + i + ' Example/Essay.pdf', await makePaper({ title: 'S' + i, lines: ['A plain paragraph of body text.', t] })])));
  const { page, close } = await stack(files);
  for (let i = 0; i < texts.length; i++) {
    const s = await stu(page, i);
    assert.deepEqual(s.computed, NOTHING, texts[i]);
    assert.equal(s.doubts.length, 1, texts[i] + ' is asked about');
    assert.equal(s.n, 0);
  }
  assert.equal(await page.$eval('#stuList .stu[data-i="0"] .sc', e => e.textContent), '?');
  const c = await page.evaluate(() => window.__gs.exportCheck());
  assert.equal(c.unfinished.length, 4); assert.equal(c.doubts.length, 4);
  // she says yes, and it counts
  await useIt(page);
  assert.deepEqual((await stu(page, 0)).computed, { total: 12, pct: 100, done: true, paper: true });
  noErrors(page); await close();
});

test('Kami notes and her own marks in the promised forms still count on their own', async () => {
  const forms = [['9.5 = 88%', { total: 9.5, pct: 88, done: true, paper: true }], ['9.5/12 = 88%', { total: 9.5, pct: 88, done: true, paper: true }], ['10/12', { total: 10, pct: 91, done: true, paper: true }]];
  const files = Object.fromEntries(await Promise.all(forms.map(async ([t], i) => ['Kami' + i + ' Example/Essay.pdf', await withNote(t)])));
  files['Mark Example/Essay.pdf'] = await makePaper({ title: 'M' });
  const { page, close } = await stack(files);
  for (let i = 0; i < forms.length; i++) assert.deepEqual((await stu(page, i)).computed, forms[i][1], 'Kami: ' + forms[i][0]);
  for (const [t, want] of forms) {
    await page.evaluate(async t => { const G = window.__gs, f = G.state().batch.students[3].files[0]; f.marks[0] = [{ t: 'text', x: 80, y: 200, text: t, size: 14, color: 'red' }]; await G.scanAll(); }, t);
    assert.deepEqual((await stu(page, 3)).computed, want, 'her mark: ' + t);
  }
  noErrors(page); await close();
});

test('page text she boxed by hand counts, and one box used for every paper still asks', async () => {
  const { page, close } = await stack({ 'Ana Example/Essay.pdf': await makePaper({ lines: ['9.5/12 = 88%'] }), 'Ben Example/Essay.pdf': await makePaper({ lines: ['11/12 = 95%'] }) });
  const out = await page.evaluate(async () => {
    const G = window.__gs, S = G.state().batch.students;
    S[0].files[0].hand = { page: 0, x: 0, y: 0, w: 1, h: 1 };
    await G.scanAll();
    const a = G.gradeOf(S[0]);
    S[0].files[0].hand = null; G.state().setup.spot = { page: 0, x: 0, y: 0, w: 1, h: 1 };
    await G.scanAll();
    return { a, b: G.gradeOf(S[1]), nb: S[1].doubts.length };
  });
  assert.equal(out.a.total, 9.5, 'she drew the box around it');
  assert.equal(out.b.total, null, 'a box drawn on another paper says nothing about this one');
  assert.equal(out.nb, 1);
  noErrors(page); await close();
});

/* ---------------- a student's Word file ---------------- */
test('a number typed in a student’s Word file is offered only when it’s written out as a grade', async () => {
  const files = { 'Aya Example/Essay.pdf': await makePaper({ title: 'Aya' }), 'Ben Example/Essay.docx': lines('Ben Example', 'English 12', '10/12', 'In chapter 3 the water rises 2 metres, and 3/4 of the village leaves.'), 'Cal Example/Essay.docx': lines('Total: 10/12'), 'Dee Example/Essay.docx': lines('Date: 10/12'), 'Eve Example/Essay.docx': lines('9/12 = 75%') };
  const { page, close } = await stack(files);
  const a = await stu(page, 1);
  assert.deepEqual(a.computed, NOTHING);
  assert.deepEqual(a.doubts, [], 'a date and a count in an essay are the essay');
  assert.deepEqual((await stu(page, 2)).computed, NOTHING, 'with a label it’s offered, and still only offered');
  assert.equal((await stu(page, 2)).doubts.length, 1);
  assert.deepEqual((await stu(page, 3)).doubts, [], 'a date stays nothing');
  assert.equal((await stu(page, 4)).doubts.length, 1, 'worked out to a percent, it’s offered');
  await useIt(page);
  assert.deepEqual((await stu(page, 2)).computed, { total: 10, pct: 91, done: true, paper: true });
  noErrors(page); await close();
});

test('a reading from a student’s Word file that she already accepted stays, though it wouldn’t be offered now', async () => {
  const { page, close } = await stack({ 'Aya Example/Essay.pdf': await makePaper({ title: 'Aya' }), 'Ben Example/Essay.docx': lines('Ben Example', '10/12', 'My essay begins here.') });
  assert.deepEqual((await stu(page, 1)).doubts, []);
  // as saved by a copy of the app that offered it
  await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[1]; st.grade.reads = { 'w|10/12': 1 }; G.refound(st); });
  assert.deepEqual((await stu(page, 1)).computed, { total: 10, pct: 91, done: true, paper: true });
  noErrors(page); await close();
});

// Turns on scoring with the table in the student's file on screen.
const scoreWithIt = async page => { await page.waitForSelector('[data-wtabon]'); await page.click('[data-wtabon]'); await page.waitForSelector('td.rcell'); };

test('a student’s own table is not a rubric: no score, nothing offered, and a click in it does nothing', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Plan.docx': planTable() }, { points: true });
  await page.evaluate(() => window.__gs.wordScoresAll());
  await new Promise(r => setTimeout(r, 200));
  const setup = await page.evaluate(() => ({ now: window.__gs.state().setup.outOf, saved: JSON.parse(localStorage.getItem('gs.setup')).outOf }));
  assert.equal(+setup.now, 12); assert.equal(+setup.saved, 12);
  let b = await stu(page, 1);
  assert.deepEqual(b.computed, NOTHING); assert.equal(b.points, '');
  assert.deepEqual(b.doubts, [], 'its shaded boxes aren’t offered as a grade');
  // on screen it's the student's table: no score line over it, and clicking a box shades nothing and scores nothing
  await page.evaluate(() => window.__gs.openStudent(1));
  await page.waitForSelector('[data-wtabon]');
  assert.equal(await page.$('td.rcell'), null);
  assert.equal(await page.$('.rinfo:not(.roff)'), null);
  await page.click('#paper .dpage td:nth-child(2)');
  await new Promise(r => setTimeout(r, 900));
  b = await stu(page, 1);
  assert.deepEqual(b.computed, NOTHING);
  assert.equal(await page.evaluate(() => !!window.__gs.state().batch.students[1].files[0].edited), false, 'the file is untouched');
  // Ann's typed score means what it did
  await page.evaluate(() => { window.__gs.state().batch.students[0].grade.points = '10'; });
  assert.deepEqual((await stu(page, 0)).computed, { total: 10, pct: 91, done: true });
  // she can say it is a rubric: then its boxes are offered, and count for Ben alone, out of what the table says
  await scoreWithIt(page);
  b = await stu(page, 1);
  assert.deepEqual(b.computed, NOTHING); assert.equal(b.doubts.length, 1, 'now it’s offered');
  assert.equal(+(await page.evaluate(() => window.__gs.state().setup.outOf)), 12);
  await useIt(page);
  b = await stu(page, 1);
  assert.deepEqual(b.computed, { total: 4, pct: 67, done: true, paper: true, outOf: 6 });
  assert.equal(+(await page.evaluate(() => window.__gs.state().setup.outOf)), 12);
  noErrors(page); await close();
});

test('a table that reads as a rubric in a student’s file still scores by its boxes', async () => {
  // levels counting down across the top, as on a rubric
  const cell = t => '<w:tc><w:tcPr></w:tcPr><w:p><w:r><w:t>' + t + '</w:t></w:r></w:p></w:tc>';
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>' + [['Criterion', '4', '3', '2', '1'], ['Thesis', 'a', 'b', 'c', 'd'], ['Evidence', 'a', 'b', 'c', 'd'], ['Style', 'a', 'b', 'c', 'd']].map(r => '<w:tr>' + r.map(cell).join('') + '</w:tr>').join('') + '</w:tbl></w:body></w:document>';
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Rubric.docx': zipSync({ ...unzipSync(makeDocx('x')), 'word/document.xml': strToU8(xml) }) }, { points: true });
  await page.evaluate(() => window.__gs.openStudent(1));
  await page.waitForSelector('td.rcell');
  assert.equal(await page.$('[data-wtabon]'), null);
  await page.evaluate(() => document.querySelector('td.rcell').click());
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[1]).total === 4);
  noErrors(page); await close();
});

test('clicking a box in a student’s table on another scale asks before touching the whole class', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Plan.docx': planTable([]) }, { points: true });
  await page.evaluate(() => window.__gs.openStudent(1));
  await scoreWithIt(page);
  await page.evaluate(() => document.querySelector('td.rcell').click());
  await answerDlg(page, { yes: false });
  assert.match(page.lastDialog, /6.*12/s);
  assert.equal(+(await page.evaluate(() => window.__gs.state().setup.outOf)), 12, 'no: the class stays');
  await page.waitForFunction(() => !document.querySelector('#askDlg [data-ok]'));
  await page.evaluate(() => [...document.querySelectorAll('td.rcell')][1].click());
  await new Promise(r => setTimeout(r, 200));
  assert.equal(await page.evaluate(() => !!document.querySelector('#askDlg [data-ok]')), false, 'she was asked once for this table');
  assert.equal(+(await page.evaluate(() => window.__gs.state().setup.outOf)), 12);
  noErrors(page); await close();
});

test('if she says yes, the whole class follows the table she is clicking', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Plan.docx': planTable([]) }, { points: true });
  await page.evaluate(() => window.__gs.openStudent(1));
  await scoreWithIt(page);
  await page.evaluate(() => document.querySelector('td.rcell').click());
  await answerDlg(page);
  await page.waitForFunction(() => +window.__gs.state().setup.outOf === 6);
  await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.points !== '');
  assert.equal(+(await stu(page, 1)).points, 1);
  noErrors(page); await close();
});

/* ---------------- a rubric highlighted in Word ---------------- */
test('a highlighted Word rubric waits for her, then brings its rows in; Undo takes them out', async () => {
  const rubric = wordTable(['Thesis', 'Evidence', 'Style'], ['4', '3', '2', '1', '0'], [[1, 0], [4, 1], [0, 2]]);
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Rubric.docx': rubric });
  await page.evaluate(() => window.__gs.wordScoresAll());
  let b = await stu(page, 1);
  assert.deepEqual(b.computed, NOTHING);
  assert.equal(b.doubts.length, 1);
  await useIt(page);
  b = await stu(page, 1);
  assert.deepEqual(b.rubric, [3, 0, 4]);
  assert.deepEqual(b.computed, { total: 7, pct: 77, done: true });
  assert.deepEqual(b.doubts, []);
  await page.click('.rd-no [data-rd=""]');
  await page.waitForSelector('.rd-ask');
  b = await stu(page, 1);
  assert.deepEqual(b.computed, NOTHING, 'Undo takes the score back out');
  // a score already brought in by an older copy of the app stands, and isn't asked about
  await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[1]; st.grade.rubric = [3, 0, 4]; G.refound(st); });
  b = await stu(page, 1);
  assert.deepEqual(b.computed, { total: 7, pct: 77, done: true });
  assert.deepEqual(b.doubts, []);
  noErrors(page); await close();
});

// Her score matching a table keeps it quiet. It never makes the table a score: take hers away and it asks again, with or without the Grade sheet in between.
test('a student’s table can’t become a silent score after she types a matching one and clears it', async () => {
  const files = { 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Plan.docx': wordTable(['Thesis', 'Evidence', 'Style'], ['4', '3', '2', '1', '0'], [[0, 0], [0, 1], [1, 2]]) };
  const { page, close } = await stack(files, { points: true });
  await page.evaluate(() => window.__gs.wordScoresAll());
  await page.evaluate(() => window.__gs.openStudent(1));
  await page.waitForSelector('#ptsIn');
  assert.deepEqual((await stu(page, 1)).computed, NOTHING);
  for (const sheet of [true, false]) {
    await page.click('#ptsIn'); await page.keyboard.type('11'); await page.keyboard.press('Enter');
    let b = await stu(page, 1);
    assert.deepEqual(b.computed, { total: 11, pct: 95, done: true });
    assert.deepEqual(b.doubts, [], 'nothing to ask while her score matches');
    if (sheet) {
      await page.evaluate(() => window.__gs.openSheet());
      await page.waitForSelector('#dlgBox table.gl', { timeout: 60000 });
      assert.equal(await page.$$eval('.rd-ask', a => a.length), 0);
      await shut(page);
    }
    await page.click('#ptsIn'); await page.keyboard.press('End'); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.press('Enter');
    b = await stu(page, 1);
    assert.deepEqual(b.computed, NOTHING, 'cleared: no score');
    assert.equal(b.doubts.length, 1, 'cleared: it asks again');
    const c = await page.evaluate(() => { const x = window.__gs.exportCheck(); return { unfinished: x.unfinished.filter(o => o.i === 1).length, doubts: x.doubts.filter(o => o.i === 1).length, cell: document.querySelector('#stuList .stu[data-i="1"] .sc').textContent }; });
    assert.deepEqual(c, { unfinished: 1, doubts: 1, cell: '?' });
  }
  noErrors(page); await close();
});

test('on a rubric, clicking a table’s scores on and off leaves no score behind', async () => {
  const rubric = wordTable(['Thesis', 'Evidence', 'Style'], ['4', '3', '2', '1', '0'], [[1, 0], [4, 1], [0, 2]]);
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Rubric.docx': rubric });
  await page.evaluate(() => window.__gs.wordScoresAll());
  await page.evaluate(() => window.__gs.openStudent(1));
  await page.waitForSelector('#grade .scores button');
  const click = (row, v) => page.click('#grade .scores[data-c="' + row + '"] button[data-v="' + v + '"]');
  const scores = [[0, 3], [1, 0], [2, 4]];
  for (const [r, v] of scores) await click(r, v);
  let b = await stu(page, 1);
  assert.deepEqual(b.computed, { total: 7, pct: 77, done: true }); assert.deepEqual(b.doubts, []);
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForSelector('#dlgBox table.gl', { timeout: 60000 });
  await shut(page);
  for (const [r, v] of scores) await click(r, v);
  b = await stu(page, 1);
  assert.deepEqual(b.computed, NOTHING); assert.equal(b.doubts.length, 1);
  noErrors(page); await close();
});

/* ---------------- a grade goes with its mark ---------------- */
test('deleting a text box that held the grade takes the grade away at once, everywhere', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Essay.pdf': await makePaper({ title: 'Ben' }) });
  await typeBox(page, 100, 500, 'Total 10/12');
  // counted without any Grade sheet or export
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total === 10, { timeout: 30000 });
  await page.waitForFunction(() => { const e = document.querySelector('#stuList .stu[data-i="0"] .sc'); return e && e.textContent === '10'; }, { timeout: 5000 });
  // select the box and delete it
  await clickAt(page, 0, 300, 700);
  await clickAt(page, 0, 105, 508);
  await page.keyboard.press('Delete');
  assert.equal(await page.evaluate(() => Object.values(window.__gs.state().batch.students[0].files[0].marks).flat().length), 0, 'the box is gone');
  assert.deepEqual((await stu(page, 0)).computed, NOTHING, 'right away');
  await page.click('#gradesBtn');
  await page.waitForSelector('table.gl');
  assert.ok(!/\(paper\)/.test(await page.$eval('table.gl', e => e.textContent)));
  await shut(page);
  // undo brings it back, redo takes it away
  await page.evaluate(() => window.__gs.undo());
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total === 10, { timeout: 30000 });
  await page.evaluate(() => window.__gs.redo());
  assert.deepEqual((await stu(page, 0)).computed, NOTHING);
  noErrors(page); await close();
});

test('editing the box to another grade follows it, and the Grades list waits for a fresh read', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) });
  await typeBox(page, 100, 500, 'Total 10/12');
  await page.click('#gradesBtn');   // straight away, before the read has had time to finish
  await page.waitForSelector('table.gl');
  assert.match(await page.$eval('table.gl', e => e.textContent), /10 \(paper\)/);
  await shut(page);
  // edit it the way she does: the first click picks a box she's just finished, clicking what's picked opens it, then change the words and leave
  await clickAt(page, 0, 120, 508);   // on the words: the first few pixels inside a picked box's edge belong to its grip
  await clickAt(page, 0, 120, 508);
  await page.waitForSelector('textarea.ed');
  await page.$eval('textarea.ed', e => { e.value = 'Total 9/12'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.keyboard.press('Escape');
  assert.deepEqual((await stu(page, 0)).computed, NOTHING, 'the old grade is gone at once');
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total === 9, { timeout: 30000 });
  noErrors(page); await close();
});

test('a comment with no grade in it doesn’t read the file again', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) });
  await page.evaluate(() => { window.__scan0 = window.__gs.state().batch.students[0].files[0].scan; });
  await typeBox(page, 100, 500, 'Nice start');
  await new Promise(r => setTimeout(r, 800));
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].files[0].scan === window.__scan0), true);
  noErrors(page); await close();
});

/* ---------------- what's in one comment ---------------- */
test('one labelled grade beside an unlabelled one asks, however it’s worded, and a part or a count doesn’t', async () => {
  const files = { 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Essay.pdf': await withNote('Grade: 8/12. Revised: 10/12') };
  const { page, close } = await stack(files);
  const read = t => page.evaluate(t => { const G = window.__gs, g = G.parseGrade(t, false); return g && { score: g.score, outOf: g.outOf, pct: g.pct, doubt: G.readingDoubt(g) }; }, t);
  for (const [t, score, pct] of [
    ['Grade: 8/12. Revised: 10/12', 10], ['Score: 8/12, revised to 10/12', 10], ['Total 8/12 → 10/12', 10], ['Grade 8/12. Rewrite 10/12', 10],
    ['Score 8/12, now 10/12', 10], ['Score: 8/12 -> 10/12', 10], ['Total: 8/12. After revision 10/12', 10], ['Score: 8/12, 10/12 after revision', 10], ['Score: 8/12. 10/12 this time', 10],
    ['Draft: 8/12. Final: 10/12', 10], ['Final: 10/12. Draft: 8/12', 8], ['Was 8/12, now 10/12', 10],
    ['Grade: 80%. Revised: 90%', null, 90], ['Total: 8/12. Revised: 95%', 8],
    ['Total: 10/12. Grade: 95%', 10], ['Grade: 95%. Total: 10/12', 10], ['Grade: 80%. Total: 10/12', 10], ['Final grade: 80%, Score: 10/12', 10], ['Total: 10/12 = 91%. Grade: 95%', 10],
    ['Score: 10/15. Score: 10/12', 10],
  ]) {
    const g = await read(t);
    assert.equal(g.score, score, t); if (pct != null) assert.equal(g.pct, pct, t);
    assert.match(g.doubt, /more than one grade/, t);
  }
  assert.equal((await read('Score: 10/12. Score: 10/15')).outOf, 12);
  // one grade, with a date, a part, a count or its own percent beside it
  for (const [t, score, pct] of [
    ['3/12 sources cited. Total 10/12', 10], ['Due 10/12. Grade 9/12', 9], ['Thesis 3/4. Evidence 3/4. Total 10/12', 10], ['Total 10/12. Thesis 3/4', 10], ['Grade: 91%. Thesis 3/4', null, 91],
    ['Total 10/12. Yes, 10/12 overall', 10], ['Total: 10/12. Grade: 91%', 10], ['Grade: 91%. Total: 10/12', 10], ['Total: 10/12. Grade: 83%', 10], ['Total: 10/12 = 91%. Grade: 91%', 10],
    ['Score: 8/12. 90% of the class did this', 8], ['Great work!\nTotal: 10/12', 10], ['5/12 correct on the quiz. Total 10/12', 10], ['Total 10/12, up from 8/12', 10],
  ]) {
    const g = await read(t);
    assert.equal(g.score, score, t); if (pct != null) assert.equal(g.pct, pct, t);
    assert.equal(g.doubt, '', t);
  }
  // the promised forms still stand alone
  for (const t of ['9.5 = 88%', '9.5/12 = 88%', '10/12', '10 / 12', '10 out of 12', 'Total 11/12', '95%', 'Your grade: 10/12', '10/12 points']) assert.equal((await read(t)).doubt, '', t);
  // a Kami note and her own text box both wait for her
  const b = await stu(page, 1);
  assert.deepEqual(b.computed, NOTHING); assert.equal(b.doubts.length, 1);
  await typeBox(page, 100, 500, 'Score: 8/12, revised to 10/12');
  await page.waitForFunction(() => (window.__gs.state().batch.students[0].doubts || []).length === 1, { timeout: 30000 });
  const a = await stu(page, 0);
  assert.deepEqual(a.computed, NOTHING);
  assert.equal(await page.evaluate(() => window.__gs.exportCheck().doubts.filter(d => d.i === 0).length), 1, 'the export check lists it');
  noErrors(page); await close();
});

// Whatever ordinary word follows a second grade, it asks. Only a short list of things that get counted keeps a number out of it.
test('a second grade with any word after it still asks; only a real count stays quiet', async () => {
  const notes = ['Grade: 8/12. Revised: 10/12 shows real growth', 'Grade 8/12. Rewrite 10/12 looks much better', 'Total 8/12, rewrite 10/12 thanks'];
  const files = { 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) };
  for (let i = 0; i < notes.length; i++) files['Note' + i + ' Example/Essay.pdf'] = await withNote(notes[i]);
  const { page, close } = await stack(files);
  const read = t => page.evaluate(t => { const G = window.__gs, g = G.parseGrade(t, false); return g && { score: g.score, outOf: g.outOf, pct: g.pct, doubt: G.readingDoubt(g) }; }, t);
  for (const t of [
    ...notes, 'Grade: 8/12. Rewrite 10/12 needs no changes', 'Total 8/12. Rewrite 10/12 reflects more effort', 'Score 8/12. Revised 10/12 earns full credit', 'Grade 8/12. Rewrite 10/12 thanks to your edits',
    'Grade 8/12. Rewrite 10/12 done', 'Score 8/12. Revision 10/12 complete', 'Grade 8/12. 10/12 done', 'Grade 8/12. 10/12 complete', 'Grade 8/12. 10/12 shows growth', 'Grade 8/12. 10/12 works', 'Grade: 80%. Rewrite 90% shows growth', 'Total 10/12. 95% thanks',
    // a word that can count something, used as anything else
    'Grade 8/12. 10/12 quotes the text well', 'Grade 8/12. 10/12 answers the prompt', 'Grade 8/12. 10/12 right now', 'Grade 8/12. 10/12 correct?', 'Grade 8/12. 10/12 missing one source',
    // right after a rewrite word it's a grade, whatever follows it
    'Grade 8/12. Rewrite 10/12 sentences are stronger', 'Grade 8/12. Rewrite 10/12 correct', 'Grade 8/12. Revised: 10/12 of it is better', 'Grade: 8/12. Revised: 10/15', 'Grade 10/12. Rewrite 12/15',
  ]) assert.match((await read(t)).doubt, /more than one grade/, t);
  for (const [t, score] of [
    ['3/12 sources cited. Total 10/12', 10], ['3/12 quotes cited. Grade: 10/12', 10], ['You cited 3/12 sources. Total 10/12', 10], ['3/12 sentences are weak. Total 10/12', 10], ['5/12 correct on the quiz. Total 10/12', 10], ['5/12 questions right. Total 10/12', 10], ['Total 10/12. 3/12 citations are missing', 10], ['Score: 8/12. 90% of the class did this', 8],
    ['Grade 10/12. Rewrite 10/12 shows growth', 10], ['Total 10/12. 91% thanks', 10],
  ]) {
    const g = await read(t);
    assert.equal(g.score, score, t); assert.equal(g.doubt, '', t);
  }
  // the same comments on real papers: no score, and the Grades list and the export check both say so
  for (let i = 0; i < notes.length; i++) {
    const s = await stu(page, i + 1);
    assert.deepEqual(s.computed, NOTHING, notes[i]); assert.equal(s.doubts.length, 1, notes[i]);
  }
  await typeBox(page, 100, 500, notes[0]);
  await page.waitForFunction(() => (window.__gs.state().batch.students[0].doubts || []).length === 1, { timeout: 30000 });
  assert.deepEqual((await stu(page, 0)).computed, NOTHING);
  const c = await page.evaluate(() => { const x = window.__gs.exportCheck(); return { unfinished: x.unfinished.length, doubts: x.doubts.map(d => d.i), cell: document.querySelector('#stuList .stu[data-i="0"] .sc').textContent }; });
  assert.deepEqual(c, { unfinished: 4, doubts: [0, 1, 2, 3], cell: '?' });
  noErrors(page); await close();
});

test('two clear grades in one comment: she’s asked, whichever form they’re in', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) });
  const read = t => page.evaluate(t => { const G = window.__gs, g = G.parseGrade(t, false); return g && { score: g.score, outOf: g.outOf, pct: g.pct, doubt: G.readingDoubt(g) }; }, t);
  for (const [t, score] of [
    ['First draft score: 8/12. Revised score: 10/12.', 10],
    ['Old grade 8/12, new grade 10/12', 10],
    ['Rubric: 3/4, then Total: 10/12', 10],
    ['Total: 10/12. Rubric: 3/4', 10],
    ['Draft 8/12 = 82%. Revised 10/12 = 91%', 10],
    ['Old grade 8/12, new grade 10/12 = 91%', 10],
  ]) {
    const g = await read(t);
    assert.equal(g.score, score, t);
    assert.match(g.doubt, /more than one grade/, t);
  }
  // the same grade twice, or one beside a date or a stray number, is still one grade
  for (const [t, score] of [['Total 10/12. Yes, 10/12 overall', 10], ['Total: 10/12 = 91%. Grade: 91%', 10], ['Due 10/12. Grade 9/12', 9], ['3/12 sources cited. Total 10/12', 10], ['Total 9.5/12 = 88%', 9.5]]) {
    const g = await read(t);
    assert.equal(g.score, score, t); assert.equal(g.doubt, '', t);
  }
  await page.evaluate(async () => { const G = window.__gs, f = G.state().batch.students[0].files[0]; f.marks[0] = [{ t: 'text', x: 80, y: 200, text: 'First draft score: 8/12. Revised score: 10/12.', size: 14, color: 'red' }]; await G.scanAll(); });
  const s = await stu(page, 0);
  assert.deepEqual(s.computed, NOTHING); assert.equal(s.doubts.length, 1);
  noErrors(page); await close();
});

/* ---------------- more than one grade on the paper ---------------- */
test('two grades in two boxes: she’s asked, none of them stands, and the check doesn’t say All clear', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann', pages: 2 }), 'Ben Example/Essay.pdf': await makePaper({ title: 'Ben' }) });
  await typeBox(page, 100, 300, 'Grade: 8/12');
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total === 8, { timeout: 30000 });
  await typeBox(page, 100, 600, 'Revised: 10/12 shows real growth');
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total == null, { timeout: 30000 });
  await page.waitForFunction(() => (window.__gs.state().batch.students[0].doubts || []).length === 1, { timeout: 30000 });
  assert.deepEqual((await stu(page, 0)).computed, NOTHING);
  assert.equal(await page.$eval('#stuList .stu[data-i="0"] .sc', e => e.textContent), '?');
  const c = await page.evaluate(() => { const x = window.__gs.exportCheck(); return { unfinished: x.unfinished.filter(d => d.i === 0).length, doubts: x.doubts.filter(d => d.i === 0).map(d => d.note) }; });
  assert.deepEqual(c, { unfinished: 1, doubts: ['2 grades found on the paper'] });
  await page.evaluate(() => window.__gs.openExport());
  await page.waitForSelector('#xCheck');
  const said = await page.$eval('#xCheck', e => e.textContent);
  assert.doesNotMatch(said, /All clear/); assert.match(said, /2 grades found on the paper/);
  await page.evaluate(() => document.querySelector('#dlgBox [data-close], #dlgBox [data-cancel]').click());

  // Both are asked about on the Grade sheet, the one that looked sure as well, and picking one settles it.
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForSelector('.rd-ask [data-rd="1"]', { timeout: 60000 });
  const asked = () => page.$$eval('.rd-ask', a => a.map(x => x.querySelector('b').textContent));
  assert.deepEqual((await asked()).sort(), ['10/12', '8/12']);
  assert.match(await page.$eval('#shBody', e => e.textContent), /2 grades found, check/);
  assert.equal(await page.$$eval('#shBody .big-sc', a => a.length), 0, 'neither is shown as the score');
  const rowOf = v => page.evaluateHandle(v => [...document.querySelectorAll('.rd-ask')].find(x => x.querySelector('b').textContent === v), v);
  await (await rowOf('10/12')).asElement().$('[data-rd="1"]').then(b => b.click());
  await page.waitForFunction(() => !document.querySelector('.rd-ask'));
  assert.deepEqual((await stu(page, 0)).computed, { total: 10, pct: 91, done: true, paper: true });
  assert.match(await page.$eval('#shBody', e => e.textContent), /“8\/12” isn’t a grade/);

  // Taking it back asks again, and nothing stands in the meantime.
  await page.evaluate(() => [...document.querySelectorAll('.rd-no')].find(x => /10\/12/.test(x.textContent)).querySelector('[data-rd]').click());
  await page.waitForFunction(() => document.querySelectorAll('.rd-ask').length === 1);
  assert.deepEqual((await stu(page, 0)).computed, NOTHING);
  await page.evaluate(() => [...document.querySelectorAll('.rd-no')].find(x => /8\/12/.test(x.textContent)).querySelector('[data-rd]').click());
  await page.waitForFunction(() => document.querySelectorAll('.rd-ask').length === 2);
  assert.deepEqual((await stu(page, 0)).computed, NOTHING);

  // Not a grade on one: the other then stands if it can stand alone, because she has said so about this one.
  await (await rowOf('10/12')).asElement().$('[data-rd="0"]').then(b => b.click());
  await page.waitForFunction(() => document.querySelectorAll('.rd-ask').length === 0);
  assert.equal((await stu(page, 0)).computed.total, 8);
  await shut(page);

  // A new grade after she has chosen asks again.
  await page.evaluate(() => window.__gs.openStudent(0));
  await typeBox(page, 100, 450, 'Total 11/12');
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total == null, { timeout: 30000 });
  noErrors(page); await close();
});

test('more than one grade anywhere: on other pages, in other files, in the page’s own text, all ask', async () => {
  const twoFiles = { 'Two Files/Essay.pdf': await withNote('Total 8/12'), 'Two Files/Rewrite.pdf': await withNote('Total 10/12') };
  const theirs = await makePaper({ title: 'Text', lines: ['A plain paragraph of body text.', 'Grade: 11/12 = 95%'] });
  const { page, close } = await stack({ ...twoFiles, 'Page Text/Essay.pdf': theirs, 'One Grade/Essay.pdf': await withNote('9.5/12 = 88%'), 'Same Two/Essay.pdf': await makePaper({ title: 'Same', pages: 2 }), 'Other Page/Essay.pdf': await makePaper({ title: 'Other', pages: 2 }), 'Count Beside/Essay.pdf': await makePaper({ title: 'Count' }) });
  const who = n => page.evaluate(n => window.__gs.state().batch.students.findIndex(s => s.key === n), n);
  const put = (n, marks) => page.evaluate(async (n, marks) => { const G = window.__gs, st = G.state().batch.students.find(s => s.key === n); for (const [p, text, y] of marks) (st.files[0].marks[p] ||= []).push({ t: 'text', x: 80, y, text, size: 14, color: 'red' }); await G.scanAll(); }, n, marks);
  // her mark beside text printed on the page
  await put('Page Text', [[0, '10/12', 400]]);
  await put('Other Page', [[0, 'Grade 8/12', 200], [1, 'Nice work on this, 10/12', 200]]);
  await put('Same Two', [[0, 'Total 10/12', 200], [0, 'Total 10/12', 500]]);
  await put('Count Beside', [[0, 'Total 10/12', 200], [0, '3/12 sources cited', 500]]);
  for (const n of ['Two Files', 'Page Text', 'Other Page', 'Same Two']) {
    const s = await stu(page, await who(n));
    assert.deepEqual(s.computed, NOTHING, n);
    assert.deepEqual(await page.evaluate(i => window.__gs.exportCheck().doubts.filter(d => d.i === i).map(d => d.note), await who(n)), ['2 grades found on the paper'], n);
  }
  // one grade worked out in one place is one grade, and a count isn't a grade
  assert.deepEqual((await stu(page, await who('One Grade'))).computed, { total: 9.5, pct: 88, done: true, paper: true });
  assert.equal((await stu(page, await who('Count Beside'))).computed.total, 10);
  // her own score still stands, and the check says where it differs from both
  const i = await who('Other Page');
  const own = await page.evaluate(i => { const G = window.__gs, st = G.state().batch.students[i]; st.grade.rubric = [1, 1, 1]; const g = G.gradeOf(st), c = G.exportCheck(); return { total: g.total, disagree: c.disagree.filter(d => d.i === i).map(d => d.note) }; }, i);
  assert.deepEqual(own, { total: 3, disagree: ['Your score is 3, the paper says 8 and 10'] });
  // the same words twice on a page: one yes is one answer
  const same = await who('Same Two');
  const ans = await page.evaluate(i => { const G = window.__gs, st = G.state().batch.students[i]; G.setReading(st, G.readKey(st.foundAll[0]), '1'); return G.gradeOf(st).total; }, same);
  assert.equal(ans, 10);
  noErrors(page); await close();
});

// The same mistake with the slash left off: a number with a label or points beside it is asked about, and everyday numbers in a comment aren't.
test('a second grade with no slash or percent asks, and the check doesn’t say All clear', async () => {
  const seconds = ['Revised: 10', 'Total: 10', 'Score 10', 'Your score was 10', 'Rewrite 10 points', '10 points', '10 pts', '10 pts.', 'Revised: 10 of 12', '10 of 12', 'Revised: 10 shows real growth', 'Rewrite 10 looks much better', 'Now 10', 'You got 10 points', 'Good rewrite, 10 points', 'Total\n10', 'Revised to 10'];
  const files = { 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Essay.pdf': await makePaper({ title: 'Ben' }) };
  seconds.forEach((_, i) => { files['Note' + (10 + i) + ' Example/Essay.pdf'] = files['Ann Example/Essay.pdf']; });
  const { page, close } = await stack(files);
  const read = t => page.evaluate(t => { const G = window.__gs, g = G.parseGrade(t, false); return g && { score: g.score, outOf: g.outOf, pct: g.pct, doubt: G.readingDoubt(g) }; }, t);
  // Alone it never stands by itself, whatever the size: it may be the class ("Grade 10").
  for (const t of [...seconds, 'Grade 10', 'Total: 3']) {
    const g = await read(t);
    assert.ok(g, t + ' should read'); assert.equal(g.score, /3$/.test(t) ? 3 : 10, t); assert.ok(g.doubt, t + ' should ask');
  }
  // In one comment, against another grade: she's asked, and offered the later one.
  for (const [t, score] of [['Grade: 8/12. Revised: 10', 10], ['Score 8/12, now 10', 10], ['8/12 -> 10', 10], ['Grade: 80%. Total: 10', 10], ['Total: 10. Grade: 8/12', 8]]) {
    const g = await read(t);
    assert.equal(g.score, score, t); assert.match(g.doubt, /more than one grade/, t);
  }
  // The same grade said twice is one grade, and the clearer way of saying it stands.
  for (const [t, score] of [['Total 10/12. Score 10', 10], ['Score 10. Total 10/12', 10], ['Grade: 91%. Total: 10', null]]) {
    const g = await read(t);
    assert.equal(g.score, score, t); assert.equal(g.doubt, '', t);
  }
  // Everyday numbers aren't read at all.
  for (const t of ['Lost 2 points here.', '-2 pts', '2 points off', 'Worth 5 points.', 'Thesis 3 points', 'Evidence: 4 pts', 'Grade 10 English', 'Draft 2 looks better', 'Final 2 weeks', 'Rewrite 2 paragraphs', 'Rewrite 2 of them', 'Total 5 sources', 'Total: 5 sources', 'Score: 3 errors', 'Good rewrite, 10', 'See page 10', 'Due 10', 'Turned in 10 points', '10 sources', 'Rewrite 2: much better', 'Total 300', 'Total 10-12', '10 of 12 sources', '12 of 10']) assert.equal(await read(t), null, t);
  for (const [t, score] of [['Draft 1: 8/12. Draft 2: 10/12', 10], ['Thesis 3 pts. Evidence 4 pts. Total: 10/12', 10], ['Grade: 10/12. Lost 2 points on citations', 10], ['Grade 10 English. Total: 9/12', 9]]) assert.equal((await read(t)).score, score, t);
  assert.equal((await read('Thesis 3 pts. Evidence 4 pts. Total: 10/12')).doubt, '');
  assert.equal((await read('Grade: 10/12. Lost 2 points on citations')).doubt, '');
  // Beside a grade in another box, on a real paper, however it's worded.
  const out = await page.evaluate(async seconds => {
    const G = window.__gs, S = G.state().batch.students, of = seconds.map((_, i) => S.find(s => s.key === 'Note' + (10 + i) + ' Example'));
    of.forEach((st, i) => { st.files[0].marks[0] = [{ t: 'text', x: 80, y: 200, text: 'Grade: 8/12', size: 14, color: 'red' }, { t: 'text', x: 80, y: 500, text: seconds[i], size: 14, color: 'red' }]; });
    S[1].files[0].marks[0] = [{ t: 'text', x: 80, y: 200, text: 'Grade: 8/12', size: 14, color: 'red' }, { t: 'text', x: 80, y: 500, text: 'Lost 2 points on citations', size: 14, color: 'red' }];
    await G.scanAll();
    const c = G.exportCheck();
    return { total: of.map(st => G.gradeOf(st).total), notes: of.map(st => c.doubts.filter(d => d.i === S.indexOf(st)).map(d => d.note)), ben: G.gradeOf(S[1]).total };
  }, seconds);
  assert.deepEqual(out.total, seconds.map(() => null));
  assert.deepEqual(out.notes, seconds.map(() => ['2 grades found on the paper']));
  assert.equal(out.ben, 8, 'marks taken off isn’t a second grade');
  // Typed for real, the way she'd do it, and her answer.
  await typeBox(page, 100, 300, 'Grade: 8/12');
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total === 8, { timeout: 30000 });
  await typeBox(page, 100, 600, 'Revised: 10');
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total == null, { timeout: 30000 });
  assert.equal(await page.$eval('#stuList .stu[data-i="0"] .sc', e => e.textContent), '?');
  await page.evaluate(() => window.__gs.openExport());
  await page.waitForSelector('#xCheck');
  const said = await page.$eval('#xCheck', e => e.textContent);
  assert.doesNotMatch(said, /All clear/); assert.match(said, /2 grades found on the paper/);
  await page.evaluate(() => document.querySelector('#dlgBox [data-close], #dlgBox [data-cancel]').click());
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForFunction(() => [...document.querySelectorAll('.rd-ask')].some(x => x.querySelector('b').textContent === '10'), { timeout: 60000 });
  await page.evaluate(() => [...document.querySelectorAll('.rd-ask')].find(x => x.querySelector('b').textContent === '10').querySelector('[data-rd="1"]').click());
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total === 10, { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).pct), 91);
  noErrors(page); await close();
});

test('a count or a part before an unlabelled grade doesn’t hide it', async () => {
  const note = 'Only 3/12 sources cited. Good rewrite, 10/12';
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Example/Essay.pdf': await withNote(note) });
  const read = t => page.evaluate(t => { const G = window.__gs, g = G.parseGrade(t, false); return g && { score: g.score, outOf: g.outOf, pct: g.pct, counts: !!g.counts, doubt: G.readingDoubt(g) }; }, t);
  for (const [t, score, pct] of [[note, 10], ['5/12 correct on the quiz. Nice work, 9/12', 9], ['Thesis 3/4. Nice work, 10/12', 10], ['You cited 3/12 sources. Nice work, 91%', null, 91], ['3/12 sources cited. Good try, 9/12 = 86%', 9, 86]]) {
    const g = await read(t);
    assert.equal(g.score, score, t); if (pct != null) assert.equal(g.pct, pct, t);
    assert.equal(g.counts, false, t);
  }
  assert.ok((await read(note)).doubt, 'it’s inside a sentence, so she’s asked');
  // A count with nothing else stays a count.
  assert.equal((await read('You cited 3/12 sources')).counts, true);
  // Alone on a paper, the grade is what she's asked about.
  const asked = await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[1]; return { total: G.gradeOf(st).total, doubts: st.doubts.map(g => g.score + '/' + g.outOf) }; });
  assert.deepEqual(asked, { total: null, doubts: ['10/12'] });
  // Beside another grade, both are asked about.
  await typeBox(page, 100, 300, 'Grade: 8/12');
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total === 8, { timeout: 30000 });
  await typeBox(page, 100, 600, note);
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total == null, { timeout: 30000 });
  await page.evaluate(() => window.__gs.openExport());
  await page.waitForSelector('#xCheck');
  assert.doesNotMatch(await page.$eval('#xCheck', e => e.textContent), /All clear/);
  await page.evaluate(() => document.querySelector('#dlgBox [data-close], #dlgBox [data-cancel]').click());
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForFunction(() => document.querySelectorAll('.rd-ask').length >= 2, { timeout: 60000 });
  const row = await page.$$eval('.rd-ask', a => a.map(x => x.querySelector('b').textContent));
  assert.ok(row.includes('8/12') && row.includes('10/12'), JSON.stringify(row));
  noErrors(page); await close();
});

test('a label on its own line above the number counts as a label', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) });
  for (const t of ['Total\n10/12', 'Grade\n10/12', 'Final grade:\n10/12', 'Nice work.\nYour grade:\n10/12']) {
    const g = await page.evaluate(t => { const G = window.__gs, g = G.parseGrade(t, false); return { score: g.score, doubt: G.readingDoubt(g) }; }, t);
    assert.deepEqual(g, { score: 10, doubt: '' }, t);
  }
  for (const t of ['See me after.\n10/12', 'Your total was low\n10/12']) assert.ok(await page.evaluate(t => { const G = window.__gs; return !!G.readingDoubt(G.parseGrade(t, false)); }, t), t);
  noErrors(page); await close();
});

/* ---------------- a rubric page printed with its scale ---------------- */
test('a rubric PDF that prints its scale reads nothing, and her marks on it still count', async () => {
  const rubricPdf = await makePaper({ title: 'Rubric', lines: ['12 = 100%', '11 = 95%', '10 = 91%', '9 = 86%'] });
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await withNote('9.5/12 = 88%'), 'Ben Example/Essay.pdf': await makePaper({ title: 'Ben' }) });
  const out = await page.evaluate(async b64 => {
    const G = window.__gs, S = G.state().batch.students, data = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    for (const st of S) st.files.push({ path: st.key + '/Rubric page.pdf', name: 'Rubric page', kind: 'pdf', data, size: data.length, marks: {}, virtual: true, numPages: 1 });
    await G.scanAll();
    const a = { d: G.gradeOf(S[0]), n: S[0].foundCount, asks: S[0].doubts.length, bAsks: S[1].doubts.length };
    S[1].files[1].marks[0] = [{ t: 'text', x: 80, y: 200, text: '10/12', size: 14, color: 'red' }];
    await G.scanAll();
    return { ...a, b: G.gradeOf(S[1]) };
  }, Buffer.from(rubricPdf).toString('base64'));
  assert.equal(out.d.total, 9.5); assert.equal(out.n, 1); assert.equal(out.asks, 0); assert.equal(out.bAsks, 0);
  assert.equal(out.b.total, 10, 'her mark on the rubric page');
  noErrors(page); await close();
});

/* ---------------- out of another total ---------------- */
test('a confirmed reading out of another total says so wherever it shows', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) });
  await typeBox(page, 100, 500, 'Nice try 10/15');
  await useIt(page);
  await shut(page);
  const out = await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[0], g = G.gradeOf(st); return { g, total: G.scoreText(g, 'total'), any: G.scoreText(g, 'any'), row: G.tableRow(st, 0) }; });
  assert.deepEqual(out.g, { total: 10, pct: 67, done: true, paper: true, outOf: 15 });
  assert.equal(out.total, '10 out of 15'); assert.equal(out.any, '10 out of 15');
  assert.ok(out.row.includes('10 out of 15'));
  await page.evaluate(() => window.__gs.openStudent(0));
  await page.waitForSelector('#grade .total');
  assert.match(await page.$eval('#grade .total', e => e.textContent), /10\/ 15/);
  await page.click('#gradesBtn');
  await page.waitForSelector('table.gl');
  const cells = await page.$$eval('table.gl tbody tr td.c', es => es.map(e => [e.textContent, e.dataset.copy]));
  assert.ok(cells.some(([t, c]) => /10 out of 15/.test(t) && c === '10 out of 15'), JSON.stringify(cells));
  noErrors(page); await close();
});

/* ---------------- the check before exporting ---------------- */
test('the check says when her score matches neither of two grades on the paper', async () => {
  const { page, close } = await stack({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) });
  const check = () => page.evaluate(async () => { const G = window.__gs; await G.scanAll(); return G.exportCheck().disagree.map(d => d.note); });
  await page.evaluate(() => { const st = window.__gs.state().batch.students[0]; st.files[0].marks[0] = [{ t: 'text', x: 80, y: 200, text: '9/12', size: 14, color: 'red' }, { t: 'text', x: 80, y: 400, text: '10/12', size: 14, color: 'red' }]; st.grade.rubric = [1, 1, 1]; });
  assert.deepEqual(await check(), ['Your score is 3, the paper says 9 and 10']);
  await page.evaluate(() => { window.__gs.state().batch.students[0].grade.rubric = [4, 3, 3]; });
  assert.deepEqual(await check(), [], 'it matches one of them');
  noErrors(page); await close();
});
