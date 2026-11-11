// A newer copy of a download: her work comes over per student and per file, the older copy stays, and she's told what happened.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, appReady, goToStudent, setTool, drag, score, settle, workOf, idbRead, catchDownloads, closeBox: shutBox } = require('./helpers/app');
const { standardFiles, makePaper, makeDocx, zipOf } = require('./helpers/fixtures');

let browser, v1, v2;
before(async () => {
  browser = await launch();
  v1 = await standardFiles();
  for (const k of ['Gia Steady', 'Hal Steady', 'Ivy Steady']) v1[k + '/Essay.pdf'] = await makePaper({ title: k + ' essay' });
  v2 = { ...v1, 'Bram Sample/Essay.pdf': await makePaper({ title: 'Bram Sample essay, fixed and sent again', pages: 2 }), 'Bram Sample/Late.pdf': await makePaper({ title: 'Bram Sample late page' }), 'Eve Newcomer/Essay.pdf': await makePaper({ title: 'Eve Newcomer essay' }) };
  delete v2['Bram Sample/Extra notes.pdf']; delete v2['Dov Madeup/Essay.docx']; delete v2['Dov Madeup/notes.txt'];
});
after(async () => { await browser.close(); });

const pen = async (page, k = 0) => { await setTool(page, 'pen'); await drag(page, k, [[100, 300], [200, 330]]); };
const idOf = page => page.evaluate(() => window.__gs.state().batch.id);
const carryBox = page => page.waitForSelector('#carryBox', { timeout: 20000 }).then(() => page.$eval('#carryBox', e => e.textContent));
const closeBox = page => shutBox(page, '#dlgBox .bf [data-close]');
const noBox = async page => { await new Promise(r => setTimeout(r, 300)); assert.equal(await page.$('#carryBox'), null, 'no message about older copies'); };
// Answers the app's own question whenever it comes up, even across a reload, and notes its text.
const answer = (page, yes) => {
  page.asked = []; clearInterval(page.answering);
  page.answering = setInterval(() => page.evaluate(yes => {
    const d = document.querySelector('#askDlg'); if (!d) return null;
    const t = d.querySelector('#askText').textContent; d.querySelector(yes ? '[data-ok]' : '[data-no]').click(); return t;
  }, yes).then(t => { if (t != null) page.asked.push(t); }, () => {}), 50);
  page.answering.unref();
};
const workRecord = (page, id) => page.evaluate(async id => {
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
  const w = await new Promise(res => { const q = db.transaction('work').objectStore('work').get(id); q.onsuccess = () => res(q.result); });
  db.close(); return { idb: w, ls: JSON.parse(localStorage.getItem(id)) };
}, id);
// Marks and scores on the first copy: Aria (kept file), Bram (a file that changes, and one that goes), and Dov (who isn't in the new download).
async function workOnFirst(page) {
  await openZip(page, zipOf(v1), 'River essay.zip');
  await pen(page); await score(page, [3.5, 3.5, 3.5]); await page.type('#cmtIn', 'Strong ideas.');
  await goToStudent(page, 1); await pen(page); await score(page, [2, 2, 2]);
  await goToStudent(page, 3); await score(page, [4, 4, 4]);
  await settle(page);
  return idOf(page);
}

test('one changed and one new file: marks and scores come over per student and file, flagged, and the older copy stays', async () => {
  const { page, close } = await openApp(browser);
  answer(page, false);
  const oldId = await workOnFirst(page), was = await workOf(page);
  await page.click('#closeBtn');
  await new Promise(r => setTimeout(r, 300));
  const oldRec = await workRecord(page, oldId);
  await openZip(page, zipOf(v2), 'River essay (2).zip');
  const said = await carryBox(page);
  const newId = await idOf(page);
  assert.notEqual(newId, oldId, 'a different download, by its file names and sizes');
  assert.match(said, /newer copy of River essay/);
  assert.deepEqual(page.asked, [], 'most files are exactly the same, so there’s nothing to ask');
  assert.match(said, /for 2 students/, 'Aria and Bram, and Dov’s isn’t in this download');
  assert.match(said, /Changed.*Bram Sample\/Essay\.pdf/);
  assert.match(said, /New in this download.*Bram Sample\/Late\.pdf.*Eve Newcomer\/Essay\.pdf/);
  assert.match(said, /Not in this download.*Dov Madeup.*whole student/);
  assert.match(said, /older copy hasn’t changed/);
  await closeBox(page);

  const w = await workOf(page);
  const aria = 'Aria Testwell/Essay.pdf', bram = 'Bram Sample/Essay.pdf';
  assert.deepEqual(w['Aria Testwell'].grade.rubric, [3.5, 3.5, 3.5]);
  assert.equal(w['Aria Testwell'].grade.comment, 'Strong ideas.');
  assert.deepEqual(w['Aria Testwell'].computed, { total: 10.5, pct: 93, done: true });
  assert.deepEqual(w['Aria Testwell'].files[aria].marks, was['Aria Testwell'].files[aria].marks);
  assert.deepEqual(w['Bram Sample'].files[bram].marks, was['Bram Sample'].files[bram].marks, 'a changed file keeps its marks');
  assert.deepEqual(w['Bram Sample'].grade.rubric, [2, 2, 2]);
  assert.deepEqual(w['Eve Newcomer'].grade.rubric, [], 'someone new starts empty');
  assert.equal(w['Dov Madeup'], undefined);

  const pills = await page.$$eval('#stuList .stu', els => els.map(e => [e.querySelector('.nm').textContent, !![...e.querySelectorAll('.add')].length]));
  assert.deepEqual(pills, [['Aria Testwell', false], ['Bram Sample', true], ['Cleo Fixture', false], ['Eve Newcomer', true], ['Gia Steady', false], ['Hal Steady', false], ['Ivy Steady', false]]);
  await goToStudent(page, 1);
  await page.waitForFunction(() => document.querySelectorAll('#paper .carrytag').length === 2);
  const tags = await page.$$eval('#paper .carrytag', e => e.map(x => x.textContent).sort());
  assert.deepEqual(tags, ['Changed in this download', 'New in this download']);
  await settle(page);
  assert.deepEqual(await workRecord(page, oldId), oldRec, 'the older copy wasn’t written to, in either place');

  // She looks, and takes one flag off. It stays off, the other stays on, and nothing asks again.
  await page.click('[data-carryok="Bram Sample/Late.pdf"]');
  assert.equal((await page.$$('#paper .carrytag')).length, 1);
  await settle(page);
  await page.waitForFunction(id => { const d = JSON.parse(localStorage.getItem(id)); return d.carry && !d.carry.flags['Bram Sample/Late.pdf']; }, {}, newId);
  await page.reload(); await appReady(page);
  await page.waitForSelector('#vHome [data-kopen="' + newId + '"]');
  assert.match(await page.$eval('#vHome', e => e.textContent), /an older copy/, 'the list says which is which');
  await page.click('#vHome [data-kopen="' + newId + '"]');
  await waitPaper(page);
  await noBox(page);
  await goToStudent(page, 1);
  await page.waitForFunction(() => document.querySelectorAll('#paper .carrytag').length === 1);
  assert.equal(await page.$eval('#paper .carrytag', e => e.textContent), 'Changed in this download');

  // The older copy still opens, whole, with Dov.
  await page.click('#closeBtn');
  await page.waitForSelector('#vHome [data-kopen="' + oldId + '"]');
  await page.click('#vHome [data-kopen="' + oldId + '"]');
  await page.waitForFunction(id => { const b = window.__gs.state().batch; return b && b.id === id; }, { timeout: 30000 }, oldId);   // she left off on Dov, whose files are Word and text
  await noBox(page);
  const o = await workOf(page);
  assert.deepEqual(o['Dov Madeup'].grade.rubric, [4, 4, 4]);
  assert.deepEqual(o[ 'Bram Sample'].files[bram].marks, was['Bram Sample'].files[bram].marks);
  assert.ok(o['Bram Sample'].files['Bram Sample/Extra notes.pdf']);
  assert.equal(await page.$('#paper .carrytag'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('dropping the same newer copy again just opens it', async () => {
  const { page, close } = await openApp(browser);
  await workOnFirst(page);
  await page.click('#closeBtn');
  await openZip(page, zipOf(v2)); await carryBox(page); await closeBox(page);
  await goToStudent(page, 2); await score(page, [1, 1, 1]); await settle(page);
  await page.click('#closeBtn');
  await openZip(page, zipOf(v2));
  await noBox(page);
  assert.deepEqual((await workOf(page))['Cleo Fixture'].grade.rubric, [1, 1, 1], 'its own work, not the older copy’s');
  await close();
});

test('another assignment from the same class starts empty, and nothing asks', async () => {
  const { page, close } = await openApp(browser);
  answer(page, true);
  await workOnFirst(page);
  await page.click('#closeBtn');
  const next = {};
  for (const k of ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup']) next[k + '/Poem ' + k + '.pdf'] = await makePaper({ title: k + ' poem' });
  await openZip(page, zipOf(next), 'Poems.zip');
  await noBox(page);
  assert.deepEqual(page.asked, []);
  assert.deepEqual((await workOf(page))['Aria Testwell'].grade.rubric, []);
  await close();
});

for (const yes of [true, false]) test('same names but every file different: it asks, and ' + (yes ? 'yes brings the work over' : 'no starts fresh and doesn’t ask again'), async () => {
  const { page, close } = await openApp(browser);
  answer(page, yes);
  await workOnFirst(page);
  await page.click('#closeBtn');
  const redone = {};
  for (const k of Object.keys(v1)) if (k.endsWith('.pdf')) redone[k] = await makePaper({ title: 'A different assignment for ' + k, pages: 3 });
  await openZip(page, zipOf(redone), 'Maybe.zip');
  assert.equal(page.asked.length, 1);
  assert.match(page.asked[0], /may be an older copy/);
  if (yes) {
    assert.match(await carryBox(page), /Marks and scores for/);
    await closeBox(page);
    assert.deepEqual((await workOf(page))['Aria Testwell'].grade.rubric, [3.5, 3.5, 3.5]);
  } else {
    await noBox(page);
    assert.deepEqual((await workOf(page))['Aria Testwell'].grade.rubric, []);
    await page.reload(); await appReady(page);
    await openZip(page, zipOf(redone), 'Maybe.zip');
    assert.equal(page.asked.length, 1, 'it remembers the answer');
    await noBox(page);
  }
  await close();
});

test('older work with no papers kept: the names on her marks are enough to ask, and it says it couldn’t compare', async () => {
  const { page, close } = await openApp(browser);
  answer(page, true);
  const mark = { t: 'check', color: '#D7263D', x: 100, y: 100 };
  await page.evaluate(mark => localStorage.setItem('gs.b.oldcopy', JSON.stringify({ t: 5, cur: 0, s: { 'Aria Testwell': { f: { 'Aria Testwell/Essay.pdf': { 0: [mark] } }, g: { rubric: [3, 3, 3], points: '', comment: '' }, h: {} } } })), mark);
  await openZip(page, zipOf(v1), 'River essay.zip');
  assert.equal(page.asked.length, 1);
  assert.match(page.asked[0], /aren’t kept here to compare/);
  assert.match(await carryBox(page), /which files changed couldn’t be checked/);
  await closeBox(page);
  const w = await workOf(page);
  assert.deepEqual(w['Aria Testwell'].files['Aria Testwell/Essay.pdf'].marks, { 0: [mark] });
  assert.deepEqual(w['Aria Testwell'].grade.rubric, [3, 3, 3]);
  await close();
});

test('an exported ZIP brings its own marks, and isn’t taken for a newer copy', async () => {
  const { page, close } = await openApp(browser);
  answer(page, true);
  const dl = await catchDownloads(page);
  await openZip(page, zipOf(v1), 'River essay.zip');
  await pen(page); await score(page, [3, 3, 3]); await settle(page);
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  await page.click('#closeBtn');
  await openZip(page, got.bytes, 'Marked - River essay.zip');
  await noBox(page);
  assert.deepEqual(page.asked, []);
  assert.equal(Object.values((await workOf(page))['Aria Testwell'].files['Aria Testwell/Essay.pdf'].marks).flat().length, 1);
  await dl.close(); await close();
});

// A late PDF added to Bram, with a mark on it.
async function addLate(page) {
  const b64 = Buffer.from(await makePaper({ title: 'Late note' })).toString('base64');
  await page.evaluate(async b64 => {
    const bin = atob(b64), u = Uint8Array.from(bin, c => c.charCodeAt(0)), s = window.__gs.state(), st = s.batch.students[1];
    await window.__gs.addFiles(st, [{ path: 'Late note.pdf', file: new File([u], 'Late note.pdf') }], true);
    st.files.find(f => f.added).marks[0] = [{ t: 'check', color: '#D7263D', x: 100, y: 100 }];
  }, b64);
}
test('a file with the same bytes under a new name keeps its marks; late files, readings and unchanged Word edits come too', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(v1), 'River essay.zip');
  await pen(page);
  await addLate(page);
  await goToStudent(page, 0); await score(page, [3, 3, 3]);
  await page.evaluate(() => window.__gs.addRefs([new File(['A reading'], 'Reading.txt')]));
  await settle(page);
  const oldId = await idOf(page);
  await page.evaluate(async id => {   // a Word edit she made, as the app keeps it
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('edits', 'readwrite'); tx.objectStore('edits').put({ data: new Uint8Array([1, 2, 3]), orig: null, t: 9 }, id + '|Dov Madeup/Essay.docx'); tx.oncomplete = res; });
    db.close();
  }, oldId);
  await page.click('#closeBtn');
  const moved = { ...v1, 'Aria Testwell/Essay final.pdf': v1['Aria Testwell/Essay.pdf'], 'Cleo Fixture/Second try.pdf': await makePaper({ title: 'Another page' }) };
  delete moved['Aria Testwell/Essay.pdf'];
  await openZip(page, zipOf(moved), 'River essay again.zip');
  await carryBox(page); await closeBox(page);
  const newId = await idOf(page), w = await workOf(page);
  assert.equal(Object.values(w['Aria Testwell'].files['Aria Testwell/Essay final.pdf'].marks).flat().length, 1, 'the marks followed the file');
  const late = w['Bram Sample'].files['Bram Sample/Late note.pdf'];
  assert.equal(late.added, true, 'the late file came over');
  assert.equal(late.marks[0].length, 1, 'with her mark on it');
  assert.deepEqual(await page.evaluate(() => window.__gs.refs().map(r => r.name)), ['Reading.txt']);
  const edits = await idbRead(page, 'grading-studio-keep', 'edits');
  assert.ok(edits.k.includes(newId + '|Dov Madeup/Essay.docx'), 'the Word edit was copied');
  assert.ok(edits.k.includes(oldId + '|Dov Madeup/Essay.docx'), 'and stays with the older copy');
  const added = await idbRead(page, 'grading-studio-added', 'files');
  assert.equal(added.k.filter(k => k.startsWith(oldId)).length, 2, 'the older copy keeps its own');
  assert.equal(added.k.filter(k => k.startsWith(newId)).length, 2);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a Word edit on a file that has changed stays behind, and she’s told', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(v1), 'River essay.zip');
  await pen(page); await settle(page);
  const oldId = await idOf(page);
  await page.evaluate(async id => {
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('edits', 'readwrite'); tx.objectStore('edits').put({ data: new Uint8Array([1, 2, 3]), orig: null, t: 9 }, id + '|Dov Madeup/Essay.docx'); tx.oncomplete = res; });
    db.close();
  }, oldId);
  await page.click('#closeBtn');
  await openZip(page, zipOf({ ...v1, 'Dov Madeup/Essay.docx': makeDocx('Dov Madeup sent a new version.') }));
  assert.match(await carryBox(page), /Word edits left in the older copy.*Dov Madeup\/Essay\.docx/);
  const edits = await idbRead(page, 'grading-studio-keep', 'edits');
  assert.deepEqual(edits.k, [oldId + '|Dov Madeup/Essay.docx']);
  await close();
});

test('an assignment on the start screen: the newer copy takes its place, and a download dropped on the assignment itself comes over without asking', async () => {
  const { page, close } = await openApp(browser);
  answer(page, true);
  const asEntries = files => Object.entries(files).map(([path, d]) => ({ path, data: [...d] }));
  const open = (files, label, withAsg) => page.evaluate((list, label, withAsg) => {
    const lib = window.__gs.state().lib;
    let it = lib.loose.units.flatMap(u => u.items)[0];
    if (!it) { it = { id: 'asg1', name: 'River essay' }; lib.loose.units.push({ id: 'u1', name: 'Unit', items: [it] }); }
    return window.__gs.intake(list.map(e => ({ path: e.path, data: new Uint8Array(e.data) })), label, withAsg ? it : null);
  }, asEntries(files), label, withAsg);
  await open(v1, 'One', true); await waitPaper(page);
  await pen(page); await score(page, [3, 3, 3]); await settle(page);
  const first = await idOf(page);
  await page.click('#closeBtn');
  await open(v2, 'Two', false); await carryBox(page); await closeBox(page); await waitPaper(page);
  const second = await idOf(page);
  const asg = await page.evaluate(() => { const s = window.__gs.state(); return { name: s.batch.name, on: s.batch.assignment && s.batch.assignment.id, id: s.batch.assignment && s.batch.assignment.batchId }; });
  assert.deepEqual(asg, { name: 'River essay', on: 'asg1', id: second }, 'the assignment now opens the newer copy');
  assert.notEqual(second, first);
  await settle(page);
  await page.click('#closeBtn');
  // Every file different, which would normally ask. Dropped on the assignment, it's the same one.
  const third = {}; for (const k of Object.keys(v2)) third[k] = await makePaper({ title: 'Third round of ' + k });
  await open(third, 'Three', true); await carryBox(page); await closeBox(page);
  assert.deepEqual(page.asked, []);
  assert.deepEqual((await workOf(page))['Aria Testwell'].grade.rubric, [3, 3, 3]);
  await close();
});

test('a Mac spelling of an accented name still finds the older copy', async () => {
  const { page, close } = await openApp(browser);
  const paper = await makePaper(), other = await makePaper({ title: 'A second student' });
  const nfc = { ['José Núñez/Essay.pdf'.normalize('NFC')]: paper, ['Zoë Prueba/Essay.pdf'.normalize('NFC')]: other };
  await openZip(page, zipOf(nfc));
  await pen(page); await score(page, [3, 3, 3]); await settle(page);
  await page.click('#closeBtn');
  const nfd = { ['José Núñez/Essay.pdf'.normalize('NFD')]: paper, ['Zoë Prueba/Essay.pdf'.normalize('NFD')]: other, 'Ana Nueva/Essay.pdf': await makePaper({ title: 'New' }) };
  await openZip(page, zipOf(nfd));
  await carryBox(page); await closeBox(page);
  const w = await workOf(page), jose = Object.keys(w).find(k => k.normalize('NFC') === 'José Núñez'.normalize('NFC'));
  assert.deepEqual(w[jose].grade.rubric, [3, 3, 3]);
  assert.equal(Object.values(Object.values(w[jose].files)[0].marks).flat().length, 1);
  await close();
});

// Her rubric page, set up before the app first runs, and three students to put it on.
const withRubric = (name, bytes) => ({ seed: { ls: { 'gs.setup': JSON.stringify({ mode: 'rubric', criteria: ['A', 'B', 'C'], rubricPage: { id: 'r1', name }, rubricPos: 'end' }), 'gs.rp.r1': JSON.stringify(Buffer.from(bytes).toString('base64')) } } });
const three = async () => { const o = {}; for (const k of ['Ann Alpha', 'Ben Beta', 'Cal Gamma']) o[k + '/Essay.pdf'] = await makePaper({ title: k }); return o; };
const check = { t: 'check', color: '#D7263D', x: 100, y: 100, size: 22 };
const markRubric = (page, key, mark) => page.evaluate((key, mark) => { const f = window.__gs.state().batch.students.find(s => s.key === key).files.find(f => f.virtual); f.marks[0] = [mark]; f.rot = { 0: 90 }; window.__gs.saveNow(); }, key, mark);
const plantEdit = (page, key, data) => page.evaluate(async (key, data) => {
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
  await new Promise(res => { const tx = db.transaction('edits', 'readwrite'); tx.objectStore('edits').put({ data: new Uint8Array(data), orig: null, t: 9 }, key); tx.oncomplete = res; });
  db.close();
}, key, [...data]);

test('marks on the rubric page come over with the student, and the older copy keeps its own', async () => {
  const files = await three();
  const { page, close } = await openApp(browser, withRubric('Rubric page.pdf', await makePaper({ title: 'Rubric' })));
  await openZip(page, zipOf(files), 'R.zip');
  const rub = 'Ann Alpha/Rubric page.pdf';
  await markRubric(page, 'Ann Alpha', check);
  await pen(page); await score(page, [3, 3, 3]); await settle(page);
  const was = await workOf(page), oldId = await idOf(page);
  assert.equal(was['Ann Alpha'].files[rub].marks[0].length, 1);
  await page.click('#closeBtn');
  await new Promise(r => setTimeout(r, 300));
  const oldRec = await workRecord(page, oldId);
  await openZip(page, zipOf({ ...files, 'Dee Delta/Essay.pdf': await makePaper({ title: 'Dee' }) }), 'R2.zip');
  const said = await carryBox(page); await closeBox(page);
  assert.doesNotMatch(said, /Rubric page/, 'nothing to report: it came over');
  const w = await workOf(page);
  assert.deepEqual(w['Ann Alpha'].files[rub].marks, was['Ann Alpha'].files[rub].marks);
  assert.deepEqual(w['Ann Alpha'].files[rub].rot, { 0: 90 });
  assert.equal(Object.values(w['Ann Alpha'].files['Ann Alpha/Essay.pdf'].marks).flat().length, 1);
  assert.deepEqual(await workRecord(page, oldId), oldRec);
  await close();
});

test('the rubric page isn’t set up any more: its marks stay in the older copy, and she’s told', async () => {
  const files = await three();
  const { page, close } = await openApp(browser, withRubric('Rubric page.pdf', await makePaper({ title: 'Rubric' })));
  await openZip(page, zipOf(files), 'R.zip');
  await markRubric(page, 'Ben Beta', check); await settle(page);
  await page.click('#closeBtn');
  await page.evaluate(() => localStorage.removeItem('gs.rp.r1'));
  await openZip(page, zipOf({ ...files, 'Dee Delta/Essay.pdf': await makePaper({ title: 'Dee' }) }), 'R2.zip');
  assert.match(await carryBox(page), /Not in this download.*Ben Beta\/Rubric page\.pdf/);
  await close();
});

test('a different rubric page on the assignment now: the marks on the old one stay behind, and she’s told', async () => {
  const files = await three(), other = Buffer.from(await makePaper({ title: 'A new rubric' })).toString('base64');
  const { page, close } = await openApp(browser, withRubric('Rubric page.pdf', await makePaper({ title: 'Rubric' })));
  await openZip(page, zipOf(files), 'R.zip');
  await markRubric(page, 'Ben Beta', check); await settle(page);
  const setup = await page.evaluate(() => window.__gs.state().setup);
  await page.click('#closeBtn');
  const entries = Object.entries({ ...files, 'Dee Delta/Essay.pdf': await makePaper({ title: 'Dee' }) }).map(([path, d]) => ({ path, data: [...d] }));
  await page.evaluate((entries, setup, other) => {
    localStorage.setItem('gs.rp.r2', JSON.stringify(other));
    const it = { id: 'asg1', name: 'River essay', setup: { ...setup, rubricPage: { id: 'r2', name: 'Rubric page.pdf' } } };
    window.__gs.state().lib.loose.units.push({ id: 'u1', name: 'Unit', items: [it] });
    return window.__gs.intake(entries.map(e => ({ path: e.path, data: new Uint8Array(e.data) })), 'Two', it);
  }, entries, setup, other);
  assert.match(await carryBox(page), /Not in this download.*Ben Beta\/Rubric page\.pdf/);
  await closeBox(page);
  assert.deepEqual((await workOf(page))['Ben Beta'].files['Ben Beta/Rubric page.pdf'].marks, {});
  await close();
});

test('rubric page marks with no older papers kept: they aren’t counted as a file that’s gone', async () => {
  const files = await three();
  const { page, close } = await openApp(browser, withRubric('Rubric page.pdf', await makePaper({ title: 'Rubric' })));
  answer(page, true);
  await page.evaluate(check => localStorage.setItem('gs.b.oldcopy', JSON.stringify({ t: 5, cur: 0, setup: { mode: 'rubric', criteria: ['A', 'B', 'C'], rubricPage: { id: 'r1', name: 'Rubric page.pdf' }, rubricPos: 'end' }, s: { 'Ann Alpha': { f: { 'Ann Alpha/Essay.pdf': { 0: [check] }, 'Ann Alpha/Rubric page.pdf': { 0: [check] } }, g: { rubric: [3, 3, 3], points: '', comment: '' }, h: {} } } })), check);
  await openZip(page, zipOf(files), 'R.zip');
  assert.doesNotMatch(await carryBox(page), /Rubric page/);
  assert.deepEqual((await workOf(page))['Ann Alpha'].files['Ann Alpha/Rubric page.pdf'].marks, { 0: [check] });
  await close();
});

test('a filled-in Word rubric comes over, and she isn’t told it changed', async () => {
  const files = await three(), filled = makeDocx('Rubric row A, filled in by hand');
  const { page, close } = await openApp(browser, withRubric('Rubric.docx', makeDocx('Rubric row A')));
  await openZip(page, zipOf(files), 'W.zip');
  await score(page, [3, 3, 3]); await settle(page);
  const oldId = await idOf(page);
  await plantEdit(page, oldId + '|Ann Alpha/Rubric.docx', filled);
  await plantEdit(page, oldId + '|Ann Alpha/Essay.docx', [1, 2, 3]);   // a file this download doesn't have: that one does stay behind
  await page.click('#closeBtn');
  await openZip(page, zipOf({ ...files, 'Dee Delta/Essay.pdf': await makePaper({ title: 'Dee' }) }), 'W2.zip');
  const said = await carryBox(page); await closeBox(page);
  assert.doesNotMatch(said, /Rubric\.docx/);
  assert.match(said, /Word edits left in the older copy.*Ann Alpha\/Essay\.docx/);
  const newId = await idOf(page), edits = await idbRead(page, 'grading-studio-keep', 'edits');
  assert.ok(edits.k.includes(newId + '|Ann Alpha/Rubric.docx'), 'copied');
  assert.ok(edits.k.includes(oldId + '|Ann Alpha/Rubric.docx'), 'and still with the older copy');
  const f = await page.evaluate(() => { const f = window.__gs.state().batch.students[0].files.find(f => f.virtual); return { n: f.data.length, edited: !!f.edited }; });
  assert.deepEqual(f, { n: filled.length, edited: true }, 'the rubric she opens is the one she filled in');
  await close();
});

test('students with no paper in the newer copy: on the roster they keep their scores, and only someone really gone is listed', async () => {
  const files = { ...await three(), 'Dov Madeup/Essay.pdf': await makePaper({ title: 'Dov' }), 'Ula Gone/Essay.pdf': await makePaper({ title: 'Ula' }) };
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'G.zip');
  await score(page, [3, 3, 3]);
  await page.evaluate(() => {
    window.__gs.state().lib.classes.push({ id: 'c1', name: 'Period 1', names: ['Ann Alpha', 'Ben Beta', 'Cal Gamma', 'Madeup, Dov', 'Zed Nopaper', 'Yan Lateonly'], units: [] });
    const sel = document.querySelector('#classSel'); sel.insertAdjacentHTML('beforeend', '<option value="c1">Period 1</option>'); sel.value = 'c1'; sel.dispatchEvent(new Event('change'));
  });
  const at = key => page.evaluate(key => window.__gs.state().batch.students.findIndex(s => s.key === key), key);
  await goToStudent(page, await at('Zed Nopaper')); await score(page, [2, 2, 2]);
  await page.evaluate(() => { window.__gs.state().batch.students.find(s => s.key === 'Zed Nopaper').grade.status = 'excused'; });
  await goToStudent(page, await at('Dov Madeup')); await pen(page); await score(page, [1, 1, 1]);
  await goToStudent(page, await at('Ula Gone')); await score(page, [4, 4, 4]);
  await goToStudent(page, 0);
  // A late file added from Yan's name, with a mark on it and a score.
  const late = Buffer.from(await makePaper({ title: 'Yan late' })).toString('base64');
  await page.evaluate(async b64 => {
    const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), st = window.__gs.state().batch.students.find(s => s.key === 'Yan Lateonly');
    await window.__gs.addFiles(st, [{ path: 'Late.pdf', file: new File([u], 'Late.pdf') }], true);
    st.files[0].marks[0] = [{ t: 'check', color: '#D7263D', x: 100, y: 100, size: 22 }]; st.grade.rubric = [2, 3, 2];
    window.__gs.saveNow();
  }, late);
  await settle(page);
  await page.click('#closeBtn');
  await new Promise(r => setTimeout(r, 300));
  const v = { ...files, 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann fixed', pages: 2 }) };
  delete v['Dov Madeup/Essay.pdf']; delete v['Ula Gone/Essay.pdf'];
  await openZip(page, zipOf(v), 'G2.zip');
  const said = await carryBox(page); await closeBox(page);
  const w = await workOf(page);
  assert.deepEqual(w['Zed Nopaper'].grade.rubric, [2, 2, 2], 'his score stays on the list');
  assert.deepEqual(w['Zed Nopaper'].computed, { total: null, pct: null, done: true, status: 'excused' }, 'excused has no number until the mark comes off');
  assert.equal(w['Zed Nopaper'].grade.status, 'excused');
  assert.deepEqual(w['Madeup, Dov'].grade.rubric, [1, 1, 1], 'found by his roster name');
  assert.deepEqual(w['Yan Lateonly'].grade.rubric, [2, 3, 2]);
  assert.equal(w['Yan Lateonly'].files['Yan Lateonly/Late.pdf'].marks[0].length, 1, 'the late file keeps its mark');
  assert.equal(w['Ula Gone'], undefined);
  assert.doesNotMatch(said, /Zed|Yan/);
  assert.match(said, /Not in this download.*Dov Madeup\/Essay\.pdf/, 'his paper and its marks are what stayed behind');
  assert.doesNotMatch(said, /Dov Madeup \(the whole student\)/);
  assert.match(said, /Ula Gone \(the whole student\)/);
  assert.match(said, /for 4 students/, 'Ann, Zed, Dov and Yan: Ula isn’t on the list');
  assert.deepEqual(page.errors, []);
  await close();
});

test('during anonymous grading the box counts what changed, with no names', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(v1), 'River essay.zip');
  await page.evaluate(() => window.__gs.setAnon(true));
  await goToStudent(page, 0); await pen(page); await score(page, [3, 3, 3]);
  await goToStudent(page, 3); await score(page, [2, 2, 2]);   // someone who isn't in the newer copy
  await settle(page);
  await plantEdit(page, await idOf(page) + '|' + (await page.evaluate(() => window.__gs.state().batch.students[3].files[0].path)), [1, 2, 3]);
  await page.click('#closeBtn');
  await new Promise(r => setTimeout(r, 300));
  await openZip(page, zipOf(v2), 'River essay (2).zip');
  const said = await carryBox(page);
  assert.equal(await page.evaluate(() => window.__gs.anonOn()), true);
  assert.doesNotMatch(said, /Aria|Bram|Cleo|Dov|Eve|Gia|Hal|Ivy|Essay|Late/);
  assert.match(said, /Changed.*1 file/);
  assert.match(said, /New in this download.*2 files/);
  assert.match(said, /Not in this download.*1 whole student/);
  assert.match(said, /Word edits left.*1 file/);
  await close();
});

/* ---------------- what a changed file says about itself ---------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const toBytes = s => new TextEncoder().encode(s);
const flagsOf = page => page.evaluate(() => window.__gs.state().batch.carry.flags);

test('With the rubric page placed first, a changed first file still gets its tag and its Looks fine', async () => {
  const rubric = Buffer.from(await makePaper({ title: 'Rubric page' })).toString('base64');
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify({ mode: 'rubric', criteria: ['A', 'B', 'C'], rubricPage: { id: 'r1', name: 'Rubric page.pdf' }, rubricPos: 'start' }), 'gs.rp.r1': JSON.stringify(rubric) } } });
  const first = await three();
  await openZip(page, zipOf(first), 'R.zip');
  await score(page, [3, 3, 3]); await settle(page);
  await page.click('#closeBtn'); await sleep(300);
  await openZip(page, zipOf({ ...first, 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann fixed and longer', pages: 2 }) }), 'R2.zip');
  await carryBox(page); await closeBox(page);
  await goToStudent(page, 0);
  await page.waitForSelector('#paper [data-carryok="Ann Alpha/Essay.pdf"]', { timeout: 15000 });
  assert.equal(await page.$eval('#paper .carrytag', e => e.textContent), 'Changed in this download');
  await page.click('#paper [data-carryok="Ann Alpha/Essay.pdf"]');
  assert.deepEqual(await flagsOf(page), {});
  assert.deepEqual(page.errors, []);
  await close();
});

test('A changed recording or spreadsheet has a tag and Looks fine too, so the ! can always be cleared', async () => {
  const { page, close } = await openApp(browser);
  const fill = n => new Uint8Array(n).fill(65);
  const first = { ...(await three()), 'Ann Alpha/Talk.mp3': fill(2000), 'Ann Alpha/Data.csv': toBytes('a,b') };
  await openZip(page, zipOf(first), 'M.zip');
  await score(page, [3, 3, 3]); await settle(page);
  await page.click('#closeBtn'); await sleep(300);
  await openZip(page, zipOf({ ...first, 'Ann Alpha/Talk.mp3': fill(3000), 'Ann Alpha/Data.csv': toBytes('a,b,c') }), 'M2.zip');
  await carryBox(page); await closeBox(page);
  await goToStudent(page, 0);
  for (const p of ['Ann Alpha/Talk.mp3', 'Ann Alpha/Data.csv']) { await page.waitForSelector('[data-carryok="' + p + '"]', { timeout: 15000 }); await page.click('[data-carryok="' + p + '"]'); }
  assert.deepEqual(await flagsOf(page), {});
  assert.equal(await page.$eval('#stuList .stu', e => !!e.querySelector('.add')), false, 'and the ! has gone');
  assert.deepEqual(page.errors, []);
  await close();
});

test('A file changed but the same size is flagged, her work stays, and the new one is what reopens', async () => {
  const { page, close } = await openApp(browser);
  const first = { ...(await three()), 'Ann Alpha/Notes.txt': toBytes('Score ten out of twelve') };
  await openZip(page, zipOf(first), 'Z.zip');
  await score(page, [3, 3, 3]); await settle(page);
  const id = await idOf(page);
  await page.click('#closeBtn'); await sleep(300);
  await openZip(page, zipOf({ ...first, 'Ann Alpha/Notes.txt': toBytes('Score n1ne out of twelv') }), 'Z2.zip');
  assert.equal(await idOf(page), id, 'still the same download');
  assert.deepEqual(await flagsOf(page), { 'Ann Alpha/Notes.txt': 'changed' });
  assert.deepEqual((await workOf(page))['Ann Alpha'].grade.rubric, [3, 3, 3]);
  await settle(page);
  await page.click('#closeBtn'); await sleep(300);
  await page.waitForFunction(id => !!document.querySelector('#vHome [data-kopen="' + id + '"]'), { timeout: 15000 }, id);
  await page.click('#vHome [data-kopen="' + id + '"]');
  await waitPaper(page);
  const text = await page.evaluate(() => new TextDecoder().decode(window.__gs.state().batch.students[0].files.find(f => /txt$/.test(f.path)).data));
  assert.equal(text, 'Score n1ne out of twelv');
  assert.deepEqual(await flagsOf(page), { 'Ann Alpha/Notes.txt': 'changed' }, 'the flag is kept until she clears it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('A newer download opened blank before this update is still offered the older work', async () => {
  const { page, close } = await openApp(browser);
  const first = await three();
  await openZip(page, zipOf(first), 'B.zip');
  await score(page, [3, 3, 3]); await settle(page);
  await page.click('#closeBtn'); await sleep(300);
  const second = { ...first, 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann fixed', pages: 2 }) };
  await page.evaluate(list => { const id = window.__gs.batchIdOf(list.map(e => ({ path: e.path, data: { length: e.len } }))); localStorage.setItem(id, JSON.stringify({ t: Date.now(), cur: 0, s: {} })); }, Object.entries(second).map(([p, d]) => ({ path: p, len: d.length })));
  await openZip(page, zipOf(second), 'B2.zip');
  await carryBox(page); await closeBox(page);
  assert.deepEqual((await workOf(page))['Ann Alpha'].grade.rubric, [3, 3, 3]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('A mark on a page the new file no longer has is said, in the box and on the file, and the file stays in the export', async () => {
  const { page, close } = await openApp(browser);
  const first = { 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann', pages: 3 }), 'Ben Beta/Essay.pdf': await makePaper({ title: 'Ben' }), 'Cal Gamma/Essay.pdf': await makePaper({ title: 'Cal' }) };
  await openZip(page, zipOf(first), 'P.zip');
  await page.waitForFunction(() => window.__gs.state().pages.length === 3);
  await pen(page, 2); await goToStudent(page, 1); await pen(page, 0); await settle(page);
  await page.click('#closeBtn'); await sleep(300);
  await openZip(page, zipOf({ ...first, 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann shorter', pages: 1 }) }), 'P2.zip');
  assert.match(await carryBox(page), /marks on pages they no longer have[\s\S]*Essay\.pdf, page 3/);
  await closeBox(page);
  await goToStudent(page, 0);
  await page.waitForFunction(() => /A mark on page 3 has no page in this file now/.test(document.querySelector('#paper').textContent), { timeout: 15000 });
  assert.equal(await page.evaluate(() => /No marks, left out/.test(document.querySelector('#paper').textContent)), false);
  assert.ok((await page.evaluate(() => window.__gs.exportPlan(true).map(o => o.path))).includes('Ann Alpha/Essay.pdf'));
  assert.deepEqual(page.errors, []);
  await close();
});
