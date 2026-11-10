// Work saved by the code from before saved-data versions must keep opening. The fixture was written by that old code.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { unzipSync, strFromU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { classPage, MARK_BOXES, openApp, answerDlg, openZip, pickFile, waitPaper, appReady, goToStudent, setTool, drag, settle, catchDownloads, probePdf, probeScreen, workOf, idbRead, closeBox } = require('./helpers/app');
const { loadLegacy, noEmpty } = require('./helpers/legacy');
const { makePaper, zipOf } = require('./helpers/fixtures');
const { takeHome, openFile, bringIt, openZipBackup } = require('./helpers/carry');

let browser, L;
before(async () => { browser = await launch(); L = await loadLegacy(); });
after(async () => { await browser.close(); });

const ARIA = 'Aria Testwell/Essay.pdf';
async function openKept(page, name) {
  await page.waitForFunction(n => [...document.querySelectorAll('#kept .krow')].some(r => r.textContent.includes(n)), {}, name);
  await page.evaluate(n => [...document.querySelectorAll('#kept .krow')].find(r => r.textContent.includes(n)).querySelector('[data-kopen]').click(), name);
  await page.waitForFunction(n => { const s = window.__gs.state(); return s.batch && s.batch.name === n; }, {}, name);
  await waitPaper(page);
  await page.evaluate(() => window.__gs.scanAll());
}
// Everything the old build had for this download is here, for each student.
function sameAsOldBuild(work, oldBatch, { edited = true } = {}) {
  for (const st of oldBatch.students) {
    const w = work[st.key];
    assert.ok(w, st.key + ' is there');
    assert.deepEqual(w.grade, st.grade, st.key + ': scores and comment');
    const { partial, ...computed } = w.computed;   // the old build had no partial flag
    assert.deepEqual(computed, st.computed, st.key + ': total and percent');
    assert.deepEqual(w.inc, st.inc, st.key + ': files left out');
    for (const f of st.files) {
      const g = w.files[f.path];
      assert.ok(g, f.path + ' is there');
      assert.deepEqual(g.marks, noEmpty(f.marks), f.path + ': marks');
      assert.deepEqual(g.rot, f.rot, f.path + ': page turns');
      assert.equal(g.added, f.added, f.path + ': added by her');
    }
  }
  if (edited && work['Dov Madeup']) assert.equal(work['Dov Madeup'].files['Dov Madeup/Essay.docx'].edited, true, 'her Word edit');
}
const ids = () => [L.expected.river.id, L.expected.quiz.id];

test('the fixture really is what the old build wrote', () => {
  const j = L.backup;
  assert.equal(j.info.app, 'Grading Studio'); assert.equal(j.info.v, 1); assert.equal(j.info.dataV, undefined, 'no versions back then');
  assert.equal(L.ls['gs.dataV'], undefined);
  assert.equal(j.keep.work.k.length, 2); assert.ok(L.ls[ids()[0]]);
  const un = unzipSync(L.zip());
  assert.equal(JSON.parse(strFromU8(un['backup.json'])).info.t, j.info.t);
});

test('old saved work opens: marks, scores, comments, turns, late files, readings and Word edits', async () => {
  const { page, close } = await openApp(browser, { seed: L.seed() });
  assert.equal(await page.evaluate(() => window.__gs.kept().size), 2);
  await openKept(page, 'River essay');
  sameAsOldBuild(await workOf(page), L.expected.river);
  const s = await page.evaluate(() => { const s = window.__gs.state(), dov = s.batch.students.find(x => x.key === 'Dov Madeup'); return {
    order: s.batch.students.map(x => x.key), criteria: s.setup.criteria, scale: s.setup.scale,
    word: dov.files.find(f => f.name === 'Essay.docx').data.length, refs: window.__gs.refs().map(r => r.name), names: s.lib.classes[0].names, unit: s.lib.classes[0].units[0].items[0].name,
  }; });
  assert.deepEqual(s.order, L.expected.roster, 'in roster order, with the student who has no paper');
  assert.deepEqual(s.criteria, ['Ideas', 'Organization', 'Language']);
  assert.equal(s.scale[10], 91);
  assert.equal(s.word, L.gen['Essay edited.docx'].length, 'the edited Word file, not the original');
  assert.deepEqual(s.refs, ['Reading.pdf']);
  assert.deepEqual(s.names, L.expected.roster); assert.equal(s.unit, 'River essay');
  assert.deepEqual(page.errors, []);
  await close();
});

test('old points-based work opens with its own setup', async () => {
  const { page, close } = await openApp(browser, { seed: L.seed() });
  await openKept(page, 'Quiz');
  sameAsOldBuild(await workOf(page), L.expected.quiz, { edited: false });
  assert.equal((await workOf(page))['Fen Placeholder'].computed.pct, 85);
  assert.equal(await page.evaluate(() => window.__gs.state().setup.mode), 'points');
  await close();
});

test('old marks still draw, move, turn and export', async () => {
  const { page, close } = await openApp(browser, { seed: L.seed() });
  const dl = await catchDownloads(page);
  await openKept(page, 'River essay');
  await goToStudent(page, 1);   // Aria sits second in roster order
  await page.waitForFunction(() => window.__gs.state().batch.students[window.__gs.state().cur].key === 'Aria Testwell');
  const aria = () => page.evaluate(() => window.__gs.state().batch.students.find(s => s.key === 'Aria Testwell').files[0].marks);
  const { PEN, HL, OVAL, CHECK, TEXT, BLANK } = MARK_BOXES;

  // Drawing on screen
  const seen = await probeScreen(page, 0, [PEN, HL, OVAL, CHECK, TEXT, BLANK]);
  assert.ok(seen[0].red > 20, 'pen'); assert.ok(seen[1].yellow > seen[1].n / 2, 'highlight'); assert.ok(seen[2].red > 20, 'circle'); assert.ok(seen[3].green > 5 && seen[3].red === 0, 'a check saved in red draws green'); assert.ok(seen[4].red > 5, 'text'); assert.equal(seen[5].red, 0);

  // Moving: pick the pen line with the Select tool and drag it
  const pen0 = (await aria())[0].find(m => m.t === 'pen');
  const [mx, my] = pen0.pts[Math.floor(pen0.pts.length / 2)];
  await setTool(page, 'select');
  await drag(page, 0, [[mx, my], [mx + 30, my + 40]]);
  const pen1 = (await aria())[0].find(m => m.t === 'pen');
  assert.ok(Math.abs(pen1.pts[0][0] - pen0.pts[0][0] - 30) < 1.5 && Math.abs(pen1.pts[0][1] - pen0.pts[0][1] - 40) < 1.5, 'moved by what she dragged');
  await page.keyboard.press('Escape');
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  assert.deepEqual((await aria())[0].find(m => m.t === 'pen').pts, pen0.pts, 'undo puts it back');

  // Exporting as they are, with the turned page and the mark on it
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  const un = unzipSync(got.bytes), pdf = un[ARIA];
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 2);
  const p1 = await probePdf(page, pdf, 1, [PEN, HL, OVAL, CHECK, TEXT, BLANK]);
  assert.ok(p1.ink[0].red > 50 && p1.ink[1].yellow > p1.ink[1].n / 2 && p1.ink[2].red > 50 && p1.ink[3].green > 15 && p1.ink[3].red === 0 && p1.ink[4].red > 15, JSON.stringify(p1.ink));
  assert.equal(p1.ink[5].red, 0);
  const p2 = await probePdf(page, pdf, 2, [[490, 110, 140, 50]]);
  assert.equal(p2.W, 792, 'the page turned in the old build is still turned'); assert.ok(p2.ink[0].red > 20);

  // Turning: page 1 goes a quarter turn with its marks on it, and they're found there in the export
  await page.evaluate(() => document.querySelectorAll('[data-rot="1"]')[0].click());
  await page.waitForFunction(() => { const f = window.__gs.state().batch.students.find(s => s.key === 'Aria Testwell').files[0]; return f.rot && f.rot[0] === 90; });
  await page.waitForFunction(() => window.__gs.state().pages[0].W > 700);
  const turned = (await aria())[0].find(m => m.t === 'pen').pts;
  assert.ok(Math.abs(turned[0][0] - (792 - pen0.pts[0][1])) < 1.5 && Math.abs(turned[0][1] - pen0.pts[0][0]) < 1.5, 'a quarter turn to the right moves the mark with the page');
  const xs = turned.map(p => p[0]), ys = turned.map(p => p[1]), penBox = [Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) - Math.min(...xs) + 6, Math.max(...ys) - Math.min(...ys) + 6];
  assert.ok((await probeScreen(page, 0, [penBox]))[0].red > 20, 'drawn where it went');
  const out = await page.evaluate(async () => { const G = window.__gs, st = G.state().batch.students.find(s => s.key === 'Aria Testwell'); const b = await G.flattenDoc(st, G.layoutOf(st)[0], 150, false); return Array.from(b); });
  const flat = await probePdf(page, new Uint8Array(out), 1, [penBox]);
  assert.equal(flat.H, 612, 'the turn comes out in the export'); assert.ok(flat.ink[0].red > 20, 'with the mark in the same place');
  await page.evaluate(() => document.querySelectorAll('[data-rot="-1"]')[0].click());
  await page.waitForFunction(() => { const f = window.__gs.state().batch.students.find(s => s.key === 'Aria Testwell').files[0]; return !f.rot || !f.rot[0]; });
  const back = (await aria())[0].find(m => m.t === 'pen').pts;
  back.forEach((p, i) => assert.ok(Math.abs(p[0] - pen0.pts[i][0]) < 0.5 && Math.abs(p[1] - pen0.pts[i][1]) < 0.5, 'turning back returns it'));

  // And a new mark goes in beside the old ones, and saves
  await setTool(page, 'check');
  const p = await page.evaluate(() => { const pg = window.__gs.state().pages[0]; pg.canvas.scrollIntoView({ block: 'center' }); const r = pg.canvas.getBoundingClientRect(); return { x: r.left + 500 * pg.s, y: r.top + 300 * pg.s }; });
  await page.mouse.click(p.x, p.y);
  await settle(page);
  assert.equal(((await aria())[0]).length, 7);
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('work saved only in localStorage, from before papers were kept, comes back when the download is dropped in', async () => {
  const ls = Object.fromEntries(Object.entries(L.ls).filter(([k]) => k !== ids()[1]));
  const { page, close } = await openApp(browser, { seed: { ls } });
  assert.equal(await page.evaluate(() => window.__gs.kept().size), 0);
  const files = {}; for (const k of Object.keys(L.gen)) if (k.includes('/') && !/Quiz/.test(k)) files[k] = L.gen[k];
  await openZip(page, zipOf(files), 'River essay.zip');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.id), L.expected.river.id, 'the same download by its files');
  await page.evaluate(() => window.__gs.scanAll());
  const w = await workOf(page);
  assert.deepEqual(w['Aria Testwell'].files[ARIA].marks, noEmpty(L.expected.river.students[0].files[0].marks));
  assert.deepEqual(w['Aria Testwell'].computed, { total: 10.5, pct: 93, done: true });
  await close();
});

const noQuickCopies = () => Object.fromEntries(Object.entries(L.ls).filter(([k]) => !k.startsWith('gs.b.')));
test('old work kept only in IndexedDB opens, and goes into a take-home file', async () => {
  const a = await openApp(browser, { seed: { ...L.seed(), ls: noQuickCopies() } });
  assert.equal(await a.page.evaluate(id => localStorage.getItem(id), ids()[0]), null, 'no quick copy in localStorage');
  await openKept(a.page, 'River essay');
  sameAsOldBuild(await workOf(a.page), L.expected.river);
  await a.page.click('#closeBtn');
  await a.page.evaluate(ids => ids.forEach(id => localStorage.removeItem(id)), ids());   // closing saved one: it's the IndexedDB copy this is about
  const bytes = await takeHome(a.page);
  await a.close();
  const b = await openApp(browser);
  assert.match((await openFile(b.page, bytes)).preview, /2 new downloads/, 'both downloads’ work is in the file');
  await bringIt(b.page);
  await openKept(b.page, 'River essay');
  sameAsOldBuild(await workOf(b.page), L.expected.river);
  await b.page.click('#closeBtn');
  await openKept(b.page, 'Quiz');
  sameAsOldBuild(await workOf(b.page), L.expected.quiz, { edited: false });
  assert.deepEqual(b.page.errors, []);
  await b.close();
});

test('a download past the 12 newest loses its quick copy when saving, and still opens with all its work', async () => {
  const now = Date.now() + 60000, batches = { [ids()[0]]: 1000, [ids()[1]]: 1000 };
  for (let i = 0; i < 12; i++) batches['gs.b.newer' + i] = now + i;
  const { page, close } = await openApp(browser, { seed: { ...L.seed(), ls: { ...L.ls, 'gs.batches': JSON.stringify(batches) } } });
  await openKept(page, 'Quiz');
  await page.type('#cmtIn', ' And one more thing.');
  await page.waitForFunction(id => !localStorage.getItem(id), {}, ids()[0]);
  await page.click('#closeBtn');
  await page.reload(); await appReady(page);
  assert.equal(await page.evaluate(id => localStorage.getItem(id), ids()[0]), null);
  await openKept(page, 'River essay');
  sameAsOldBuild(await workOf(page), L.expected.river);
  assert.deepEqual(page.errors, []);
  await close();
});

test('units from when they were shared across classes move into each class', async () => {
  const lib = { classes: [{ id: 'cls00001', name: '9A', names: ['Aria Testwell'] }], units: [{ id: 'u1', name: 'Poetry', items: [{ id: 'a1', name: 'Poem one', classId: 'cls00001' }, { id: 'a2', name: 'Poem two', classId: '' }] }] };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  const got = await page.evaluate(() => window.__gs.state().lib);
  assert.deepEqual(got.units, []);
  const c = got.classes.find(x => x.id === 'cls00001');
  assert.equal(c.units[0].name, 'Poetry'); assert.equal(c.units[0].items[0].name, 'Poem one');
  assert.equal(got.loose.units[0].items[0].name, 'Poem two');
  await classPage(page, 'cls00001');
  assert.match(await page.$eval('#classes', e => e.textContent), /Poem one/);
  await close();
});

async function restore(page, bytes) {
  page.lastDialog = await openZipBackup(page, bytes);
  await bringIt(page);
}

test('an old backup ZIP restores into an empty browser', async () => {
  const { page, close } = await openApp(browser);
  await restore(page, L.zip());
  assert.match(page.lastDialog, /2 downloads/);
  await page.waitForFunction(() => window.__gs.kept().size === 2);
  await openKept(page, 'River essay');
  sameAsOldBuild(await workOf(page), L.expected.river);
  const s = await page.evaluate(() => ({ names: window.__gs.state().lib.classes[0].names, bank: JSON.parse(localStorage.getItem('gs.bank')), refs: window.__gs.refs().length }));
  assert.deepEqual(s.names, L.expected.roster); assert.deepEqual(s.bank, ['Check your citations.']); assert.equal(s.refs, 1);
  assert.equal((await idbRead(page, 'grading-studio-keep', 'papers')).k.length, 2);
  await page.click('#closeBtn');
  await openKept(page, 'Quiz');
  sameAsOldBuild(await workOf(page), L.expected.quiz, { edited: false });
  assert.deepEqual(page.errors, []);
  await close();
});

test('restoring an old backup keeps other downloads already in this browser', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Hana Pretend/Test.pdf': await makePaper({ title: 'Hana Pretend test' }), 'Ivo Imaginary/Test.pdf': await makePaper({ title: 'Ivo Imaginary test' }) }), 'Unit test.zip');
  await page.click('.scores[data-c="0"] button[data-v="3"]');
  await settle(page);
  await page.click('#closeBtn');
  await restore(page, L.zip());
  await page.waitForFunction(() => window.__gs.kept().size === 3);
  await openKept(page, 'Unit test');
  assert.deepEqual((await workOf(page))['Hana Pretend'].grade.rubric, [3]);
  await close();
});

test('a take-home file made today from old work comes back just the same', async () => {
  const a = await openApp(browser, { seed: L.seed() });
  await a.page.waitForFunction(() => window.__gs.kept().size === 2);
  const bytes = await takeHome(a.page);
  await a.close();
  const b = await openApp(browser);
  await openFile(b.page, bytes);
  await bringIt(b.page);
  await openKept(b.page, 'River essay');
  sameAsOldBuild(await workOf(b.page), L.expected.river);
  assert.deepEqual(b.page.errors, []);
  await b.close();
});

test('a PDF exported with editable marks by the old format opens with its marks', async () => {
  const original = await makePaper({ title: 'Jun Fictional essay', pages: 2 });
  const marks = [{ t: 'pen', color: '#D7263D', w: 2, pts: [[100, 300], [160, 330], [220, 300]] }, { t: 'text', color: '#D7263D', x: 100, y: 560, size: 14, text: 'Old note' }];
  const out = await PDFDocument.create(); out.addPage([612, 792]); out.addPage([792, 612]);
  await out.attach(original, 'gs-original-1.pdf', { mimeType: 'application/pdf', description: 'Original pages, for reopening in Grading Studio' });
  await out.attach(new TextEncoder().encode(JSON.stringify({ v: 1, pages: [[0, 0, marks, 0], [0, 1, [], 90]] })), 'grading-studio.json', { mimeType: 'application/json', description: 'Marks, for reopening in Grading Studio' });
  const body = await out.save(), tail = new TextEncoder().encode('\n%GradingStudio-editable\n'), all = new Uint8Array(body.length + tail.length);
  all.set(body); all.set(tail, body.length);
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Jun Fictional/Essay.pdf': all }));
  const f = (await workOf(page))['Jun Fictional'].files['Jun Fictional/Essay.pdf'];
  assert.deepEqual(f.marks, { 0: marks }); assert.deepEqual(f.rot, { 1: 90 });
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].files[0].data.length), original.length);
  await close();
});
