// Make a quiz, printed and read back: the code on each page gives it to its student, the right way up and in page order, and
// the bubbles are scored, with anything unclear left for the teacher. The scans are drawn here from the printed pages with
// fills, then turned, shrunk and tilted like a real stack. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, waitPaper, appReady } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Ava Mockridge', 'Ben Fixture', 'Cal Sampleton'];
// Six questions: two multiple choice, true or false, pick all that apply, a short answer with score bubbles, and one more multiple choice.
const ITEMS = [
  { id: 'q1', t: 'mc', text: 'Which word means having more than one meaning?', opts: ['ambiguous', 'concise', 'vivid', 'formal'], key: 'A', pts: 1 },
  { id: 'q2', t: 'mc', text: 'A writer who appeals to feelings uses…', opts: ['logos', 'ethos', 'pathos', 'kairos'], key: 'C', pts: 1 },
  { id: 'q3', t: 'tf', text: 'Concise writing uses more words than it needs.', opts: ['True', 'False'], key: 'F', pts: 1 },
  { id: 'q4', t: 'ms', text: 'Which of these are words of persuasion?', opts: ['rhetoric', 'thesis', 'appeal', 'margin'], key: 'AC', pts: 2 },
  { id: 'q5', t: 'sa', text: 'Use vivid in a sentence.', opts: [], key: '', pts: 2, lines: 24 },
  { id: 'q6', t: 'mc', text: 'Which is a claim?', opts: ['a fact', 'an opinion to argue', 'a quote', 'a source'], key: 'B', pts: 1 },
];

async function setUp(page) {
  return page.evaluate((NAMES, ITEMS) => {
    const G = window.__gs, lib = G.state().lib;
    lib.classes.push({ id: 'qzc', name: 'Quiz Class', names: NAMES.slice(), units: [{ id: 'qzu', name: 'Unit 1', items: [{ id: 'qzi', name: 'Mock quiz', classId: 'qzc' }] }] });
    const it = G.findItem('qzi').it, m = { id: 77, items: JSON.parse(JSON.stringify(ITEMS)), sheet: 0, blank: 1, names: NAMES.slice() };
    const Q = G.qmkBoxes(m, it.name); m.pv = m.ver; m.lay = JSON.stringify(Q.qs.map(q => [q.n, q.auto.b]));
    it.quiz = { ...Q, made: m }; G.saveLib();
    return { pages: Math.max(...Q.qs.map(q => q.n)) + 1, ns: Q.qs.map(q => q.n) };
  }, NAMES, ITEMS);
}
// Each student's printed pages with the given fills ({ question index: { bubble: 'f' | 'faint' | 'x' } }), drawn as scans.
async function scanOf(page, fills, looks) {
  const html = await page.evaluate((NAMES, fills) => {
    const G = window.__gs, it = G.findItem('qzi').it, m = it.quiz.made;
    return NAMES.map((n, k) => G.qmkPages({ ...m, fill: fills[k] }, it.name, n, k + 1));
  }, NAMES, fills);
  const css = await page.evaluate(() => [...document.styleSheets].map(s => { try { return [...s.cssRules].filter(r => r instanceof CSSFontFaceRule || /\.qf/.test(r.cssText)).map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n'));
  const p = await browser.newPage();
  await p.setViewport({ width: 900, height: 1150, deviceScaleFactor: 1.4 });
  const out = [];
  for (const [k, pages] of html.entries()) for (const [n, h] of pages.entries()) {
    const look = looks[k + ':' + n] || '', [tf, more] = look.split('|');
    await p.setContent('<!doctype html><style>' + css + 'body{margin:0;background:#fff}.qfpage{box-shadow:none;transform:' + (tf || 'none') + ';transform-origin:50% 50%}' + (more || '') + '#w{width:816px;height:1056px;overflow:hidden;background:#fff}</style><div id="w">' + h + '</div>');
    await p.evaluate(() => document.fonts.ready);
    out.push({ k, n, png: await (await p.$('#w')).screenshot({ type: 'png' }) });
  }
  await p.close();
  return out;
}
async function pdfOf(shots, order) {
  const doc = await PDFDocument.create();
  for (const i of order) { const im = await doc.embedPng(shots[i].png), pg = doc.addPage([612, 792]); pg.drawImage(im, { x: 0, y: 0, width: 612, height: 792 }); }
  return Buffer.from(await doc.save());
}
const openScan = (page, pdf) => page.evaluate(async b64 => { const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await window.__gs.openSplit(new File([b], 'Stack.pdf'), window.__gs.findItem('qzi').it, false); }, pdf.toString('base64'));

test('a quiz made here: pages find their students by the code, and the bubbles score themselves', async () => {
  const { page, close } = await openApp(browser);
  const lay = await setUp(page);
  assert.equal(lay.pages, 2, 'six questions with a long short answer take two pages: ' + JSON.stringify(lay.ns));
  // Ava: all right. Ben: two wrong, a crossed-out change, light pencil on one. Cal: two filled on one, a blank, a teacher score of 1.
  const fills = [
    { 0: { 0: 'f' }, 1: { 2: 'f' }, 2: { 1: 'f' }, 3: { 0: 'f', 2: 'f' }, 4: { 2: 'f' }, 5: { 1: 'f' } },
    { 0: { 1: 'f' }, 1: { 0: 'x', 2: 'f' }, 2: { 0: 'f' }, 3: { 0: 'f' }, 5: { 1: 'faint' } },
    { 0: { 0: 'f', 3: 'f' }, 1: { 2: 'f' }, 3: { 0: 'f', 2: 'f' }, 4: { 1: 'f' }, 5: { 1: 'f' } },
  ];
  // Ava's first page lost a corner square (a staple); Ben's first page is upside down; Cal's pages were shrunk to fit and tilted
  // a little, and the second is a pale, soft scan.
  const shots = await scanOf(page, fills, { '0:0': 'none|.qfreg.br{visibility:hidden}', '1:0': 'rotate(180deg)', '2:0': 'scale(.94) rotate(1.2deg)', '2:1': 'scale(.95) rotate(-.8deg)|#w{filter:blur(.8px) contrast(.7) brightness(1.1)}' });
  // The stack in a muddled order: second pages first, Cal before Ben.
  await openScan(page, await pdfOf(shots, [1, 5, 3, 0, 4, 2]));
  await page.waitForFunction(() => { const s = window.__gs.sp(); return s && s.thumbs.filter(Boolean).length === 6 && /found by the code/.test((document.querySelector('#spStat') || {}).textContent || ''); }, { timeout: 90000 });
  const sp = await page.evaluate(() => { const s = window.__gs.sp(); return { owner: s.owner, rot: s.rot, qpg: s.qpg }; });
  assert.deepEqual(sp.owner, ['Ava Mockridge', 'Cal Sampleton', 'Ben Fixture', 'Ava Mockridge', 'Cal Sampleton', 'Ben Fixture']);
  assert.deepEqual(sp.qpg, { 0: 1, 1: 1, 2: 1, 3: 0, 4: 0, 5: 0 });
  assert.equal(sp.rot[5], 180, 'Ben’s upside-down page is turned');
  await page.click('#spGo');
  await waitPaper(page);
  await page.waitForFunction(() => { const b = window.__gs.state().batch; return b && b.quiz && b.quiz.lastRead; }, { timeout: 90000 });
  const got = await page.evaluate(() => { const b = window.__gs.state().batch; return { q: Object.fromEntries(b.students.map(s => [s.key, s.grade.q || {}])), qa: Object.fromEntries(b.students.map(s => [s.key, s.grade.qa || {}])), pts: Object.fromEntries(b.students.map(s => [s.key, s.grade.points])), look: b.quiz.look, read: b.quiz.lastRead }; });
  assert.deepEqual(got.q['Ava Mockridge'], { q1: 1, q2: 1, q3: 1, q4: 2, q5: 2, q6: 1 }, JSON.stringify(got));
  assert.equal(got.pts['Ava Mockridge'], '8');
  assert.deepEqual(got.qa['Ben Fixture'], { q1: 'B', q3: 'T', q4: 'A' }, 'Ben’s clear answers: ' + JSON.stringify(got.qa));
  assert.deepEqual(got.q['Ben Fixture'], { q1: 0, q3: 0, q4: 0 });
  assert.deepEqual(got.q['Cal Sampleton'], { q2: 1, q3: 0, q4: 2, q5: 1, q6: 1 }, 'a question left blank scores 0');
  const look = Object.fromEntries((got.look || []).map(l => [l.s + ' ' + l.q, l.why + ' ' + l.guess]));
  assert.deepEqual(look, { 'Ben Fixture q2': 'Another bubble marked C', 'Ben Fixture q6': 'Very light B', 'Cal Sampleton q1': 'Two bubbles filled ' }, JSON.stringify(got.look));
  // The unclear ones: one click each, and Ctrl Z takes them back.
  await page.waitForSelector('.qfread .qfrr');
  assert.equal(await page.$$eval('.qfread .qfrr', r => r.length), 3);
  await page.click('.qfread .qfrr[data-k="1"] [data-ans="B"]');
  await page.click('.qfread [data-qfdone]');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Ben Fixture').grade.q.q6 === 1, { polling: 200, timeout: 20000 });
  const after = await page.evaluate(() => { const b = window.__gs.state().batch, ben = b.students.find(s => s.key === 'Ben Fixture'); return { q2: ben.grade.q.q2, look: b.quiz.look.map(l => l.q) }; });
  assert.equal(after.q2, 1, 'the guess was already picked for the crossed-out one');
  assert.deepEqual(after.look, ['q1'], 'Cal’s double fill is still waiting');
  await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control'); await page.keyboard.press('z'); await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Ben Fixture').grade.q.q6 == null, { polling: 200, timeout: 10000 });
  assert.deepEqual(page.errors, []);
  await close();
});

test('making a quiz: typed in the box, printed with a named copy for each student, and a change that moves bubbles after printing is a new printing', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(NAMES => { const G = window.__gs, lib = G.state().lib; lib.classes.push({ id: 'qzc', name: 'Quiz Class', names: NAMES.slice(), units: [{ id: 'qzu', name: 'Unit 1', items: [{ id: 'qzi', name: 'Mock quiz', classId: 'qzc' }] }] }); G.saveLib(); G.openQuizMaker('qzi'); }, NAMES);
  await page.waitForSelector('.qfdlg .qfc');
  // The box starts with two multiple choice, a true or false and a short answer. Type the first and set its answer.
  await page.type('.qfc[data-i="0"] [data-qx]', 'Which word means clear and brief?');
  for (const [k, w] of ['concise', 'vivid', 'formal', 'ambiguous'].entries()) await page.type('.qfc[data-i="0"] [data-qo="' + k + '"]', w);
  await page.click('.qfc[data-i="0"] [data-qk="A"]');
  await page.click('.qfc[data-i="2"] [data-qk="T"]');
  await page.click('[data-qnew="ms"]');
  await page.click('.qfc[data-i="4"] [data-qk="B"]'); await page.click('.qfc[data-i="4"] [data-qk="D"]');
  assert.match(await page.$eval('#qfPages', e => e.textContent), /Which word means clear and brief\?[\s\S]*concise/);
  assert.match(await page.$eval('#qfSum', e => e.textContent), /5 questions, 6 points · 1 page each · 4 scored by the scan, 1 marked by you/);
  assert.match(await page.$eval('.qfc[data-i="4"]', e => e.textContent), /Right answers: B, D/);
  // The print window, caught: what goes in it, and that it is printed once its font is ready.
  await page.evaluate(() => { window.__printed = { html: '', n: 0 }; window.open = () => ({ document: { write: h => { window.__printed.html += h; }, close() { }, fonts: { ready: Promise.resolve() } }, print: () => { window.__printed.n++; } }); });
  await page.click('[data-qfprint]');
  await page.waitForFunction(() => window.__printed.n === 1, { polling: 200 });
  const printed = await page.evaluate(() => { const d = new DOMParser().parseFromString(window.__printed.html, 'text/html'); return { names: [...d.querySelectorAll('.qfname b')].map(b => b.textContent), font: /@font-face/.test(window.__printed.html) }; });
  assert.deepEqual(printed.names, [...NAMES, '', ''], 'one copy each, in roster order, and the two blank copies');
  assert.ok(printed.font, 'the print window has the font the bubbles were measured with');
  const it = await page.evaluate(() => { const q = window.__gs.findItem('qzi').it.quiz; return { names: q.made.names, ver: q.made.ver, qs: q.qs.map(x => [x.lab, x.kind, x.pts, x.key, x.auto.b.length]) }; });
  assert.deepEqual(it.names, NAMES);
  assert.deepEqual(it.qs, [['1', 'rw', 1, 'A: concise', 4], ['2', 'rw', 1, '', 4], ['3', 'rw', 1, 'True', 2], ['4', 'scale', 2, '', 3], ['5', 'rw', 1, 'B, D', 4]]);
  // A longer first question pushes every bubble down: saved, it is a new printing, and she is told to print again.
  await page.evaluate(() => window.__gs.openQuizMaker('qzi'));
  await page.waitForSelector('.qfdlg .qfc');
  await page.type('.qfc[data-i="0"] [data-qx]', ' It is the word for writing that says what it means in as few words as it can, with nothing extra.');
  await page.click('[data-qfsave]');
  await page.waitForFunction(() => /print it again/.test(document.body.textContent), { polling: 200 });
  assert.equal(await page.evaluate(() => window.__gs.findItem('qzi').it.quiz.made.ver), 1);
  assert.deepEqual(page.errors, []);
  await close();
});
