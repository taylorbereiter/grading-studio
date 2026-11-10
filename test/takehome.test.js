// The take-home file: Take my work with me, Bring work in, old backup ZIPs, and Remove from this computer, in the real built app.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { goTo, openApp, answerDlg, openZip, waitPaper, appReady, goToStudent, setTool, drag, score, settle, catchDownloads, workOf, idbRead, closeBox } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');
const { loadLegacy } = require('./helpers/legacy');
const { linkFolder, folderWait, folderList, takeHome, openFile, bringIt, openZipBackup } = require('./helpers/carry');

let browser, zip, L;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); L = await loadLegacy(); });
after(async () => { await browser.close(); });

async function openKept(page, name) {
  await page.waitForFunction(n => [...document.querySelectorAll('#kept .krow')].some(r => r.textContent.includes(n)), { timeout: 30000 }, name);
  await page.evaluate(n => [...document.querySelectorAll('#kept .krow')].find(r => r.textContent.includes(n)).querySelector('[data-kopen]').click(), name);
  await page.waitForFunction(n => { const s = window.__gs.state(); return s.batch && s.batch.name === n; }, {}, name);
  await waitPaper(page);
}
const gradeOf = (page, key) => page.evaluate(k => window.__gs.state().batch.students.find(s => s.key === k).grade, key);
const has = (bytes, text) => Buffer.from(bytes).includes(Buffer.from(text));
const closeUp = async page => { await page.click('#closeBtn'); await page.waitForFunction(() => document.querySelector('#start').hidden === false); await new Promise(r => setTimeout(r, 200)); };
// A laptop with one download, with some work on it.
async function laptop() {
  const a = await openApp(browser);
  await openZip(a.page, zip, 'River essay.zip');
  await score(a.page, [3, 3, 3]);
  await a.page.type('#cmtIn', 'Laptop comment');
  await goToStudent(a.page, 1);
  await score(a.page, [2, 2, 2]);
  await settle(a.page);
  await closeUp(a.page);
  return a;
}

test('everything goes to another computer: papers, marks, scores, comments, rosters, rubrics, readings, Word edits and added files', async () => {
  const a = await openApp(browser, { seed: L.seed() });
  await a.page.waitForFunction(() => window.__gs.kept().size === 2);
  await a.page.evaluate(async () => {   // Lessons stay out, and a lesson named something unmistakable shows it
    const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons', 1); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise(res => { const tx = db.transaction('lessons', 'readwrite'); tx.objectStore('lessons').put({ id: 'l1', title: 'A LESSON THAT STAYS HOME' }); tx.oncomplete = res; }); db.close();
  });
  await openKept(a.page, 'River essay');
  await a.page.evaluate(() => window.__gs.scanAll());
  const was = await workOf(a.page);
  const refs = await a.page.evaluate(() => window.__gs.refs().map(r => [r.name, r.data.length]));
  const word = await a.page.evaluate(() => window.__gs.state().batch.students.find(x => x.key === 'Dov Madeup').files.find(f => f.name === 'Essay.docx').data.length);
  await closeUp(a.page);
  const bytes = await takeHome(a.page);
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 8)), 'GSWORK1\n');
  for (const t of ['Aria Testwell', 'River essay', 'Check your citations', '%PDF']) assert.ok(!has(bytes, t), t + ' is not readable in the file');
  await a.close();

  const b = await openApp(browser);
  const { preview, error } = await openFile(b.page, bytes);
  assert.equal(error, undefined);
  assert.match(preview, /2 new downloads/); assert.match(preview, /River essay/); assert.match(preview, /Quiz/);
  assert.match(preview, /safety copy/);
  await bringIt(b.page);
  await b.page.waitForFunction(() => window.__gs.kept().size === 2);
  await openKept(b.page, 'River essay');
  await b.page.evaluate(() => window.__gs.scanAll());
  assert.deepEqual(await workOf(b.page), was, 'marks, scores, comments, turns, added files');
  assert.deepEqual(await b.page.evaluate(() => window.__gs.refs().map(r => [r.name, r.data.length])), refs, 'readings');
  const f = await b.page.evaluate(() => { const f = window.__gs.state().batch.students.find(x => x.key === 'Dov Madeup').files.find(f => f.name === 'Essay.docx'); return { n: f.data.length, edited: f.edited > 0, orig: !!f.orig }; });
  assert.deepEqual(f, { n: word, edited: true, orig: true }, 'the Word edit, and its original');
  const lib = await b.page.evaluate(() => { const c = window.__gs.state().lib.classes.find(x => x.names.length); return { names: c.names, item: c.units[0].items[0].name, bank: JSON.parse(localStorage.getItem('gs.bank')) }; });
  assert.deepEqual(lib.names, L.expected.roster); assert.ok(lib.item); assert.deepEqual(lib.bank, ['Check your citations.']);
  assert.equal(await b.page.evaluate(() => window.__gs.state().lib.classes.filter(c => /12EL-1/.test(c.name)).length), 1, 'no doubled classes');
  assert.equal(await b.page.evaluate(async () => (await indexedDB.databases()).some(d => d.name === 'gs-lessons') ? (await new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('lessons')) return res(0); const q = db.transaction('lessons').objectStore('lessons').count(); q.onsuccess = () => { db.close(); res(q.result); }; }; })) : 0), 0, 'Lessons stayed home');
  assert.deepEqual(b.page.errors, []);
  await b.close();
});

test('a wrong passphrase says so and changes nothing', async () => {
  const a = await laptop();
  const bytes = await takeHome(a.page);
  await a.close();
  const b = await openApp(browser);
  const before_ = await b.page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const r = await openFile(b.page, bytes, 'not the passphrase');
  assert.match(r.error, /passphrase doesn’t open this file/);
  assert.equal(await b.page.$eval('#takeP1', e => e.value), '', 'she can try again');
  assert.equal(await b.page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())), before_);
  assert.equal(await b.page.evaluate(() => window.__gs.kept().size), 0);
  assert.equal((await idbRead(b.page, 'grading-studio-keep', 'papers')).k.length, 0);
  assert.deepEqual(b.page.errors, []);
  await b.close();
});

test('a changed or cut-off file says so and changes nothing', async () => {
  const a = await laptop();
  const bytes = await takeHome(a.page);
  await a.close();
  const CHUNK = 4 * 1024 * 1024 + 16;
  const hdrEnd = 12 + new DataView(bytes.buffer, bytes.byteOffset).getUint32(8) + 32;
  const flip = at => { const c = bytes.slice(); c[at] ^= 1; return c; };
  const cases = {
    'a byte in the middle': flip(bytes.length >> 1),
    'a byte in the first chunk': flip(hdrEnd + 5),
    'a byte in the last tag': flip(bytes.length - 1),
    'cut off': bytes.slice(0, bytes.length - 100),
    'cut to the first chunk': bytes.length > hdrEnd + CHUNK ? bytes.slice(0, hdrEnd + CHUNK) : bytes.slice(0, hdrEnd + 1000),
    'something added': new Uint8Array([...bytes.slice(0, 1000), ...bytes.slice(1000), 1, 2, 3]),
  };
  const b = await openApp(browser);
  for (const [why, c] of Object.entries(cases)) {
    const r = await openFile(b.page, c);
    assert.match(r.error, /damaged, or it’s been changed/, why);
    await answerDlg(b.page);
    assert.equal(await b.page.evaluate(() => window.__gs.kept().size), 0, why);
    assert.equal((await idbRead(b.page, 'grading-studio-keep', 'papers')).k.length, 0, why);
  }
  // The header's own settings, like the salt, are protected the same way: the passphrase check fails.
  const salted = bytes.slice(); const hdrAt = 12, txt = new TextDecoder().decode(salted.subarray(hdrAt, hdrAt + 200)), i = txt.indexOf('"salt":"') + 8;
  salted[hdrAt + i] = salted[hdrAt + i] === 65 ? 66 : 65;
  const r = await openFile(b.page, salted);
  assert.match(r.error, /passphrase doesn’t open/);
  assert.deepEqual(b.page.errors, []);
  await b.close();
});

test('there and back: each trip merges per student, and nothing done on either computer is lost', async () => {
  const a = await laptop();
  const out = await takeHome(a.page);
  const b = await openApp(browser);
  await openFile(b.page, out); await bringIt(b.page);
  // At home: Aria's score is cleared, and Cy gets a score. At school meanwhile: Bram's comment.
  await openKept(b.page, 'River essay');
  await goToStudent(b.page, 0);
  for (const i of [0, 1, 2]) await b.page.click('.scores[data-c="' + i + '"] button[data-v="3"]');
  await goToStudent(b.page, 2);
  await score(b.page, [4, 4, 4]);
  await setTool(b.page, 'pen'); await drag(b.page, 0, [[100, 300], [200, 330]]);
  await settle(b.page);
  await closeUp(b.page);
  await openKept(a.page, 'River essay');
  await goToStudent(a.page, 1);
  await a.page.type('#cmtIn', 'Bram from school');
  await settle(a.page);
  await closeUp(a.page);
  const home = await takeHome(b.page);
  const { preview } = await openFile(a.page, home);
  assert.match(preview, /2 students come in from this file/);
  assert.match(preview, /Aria Testwell/); assert.match(preview, /Cleo Fixture/);
  assert.match(preview, /1 student stays the same here/);
  assert.match(preview, /Bram Sample/);
  await bringIt(a.page);
  await openKept(a.page, 'River essay');
  assert.deepEqual((await gradeOf(a.page, 'Aria Testwell')).rubric.filter(v => v != null), [], 'a cleared score came over');
  assert.equal((await gradeOf(a.page, 'Aria Testwell')).comment, 'Laptop comment');
  assert.equal((await gradeOf(a.page, 'Bram Sample')).comment, 'Bram from school', 'newer here stays');
  const third = await a.page.evaluate(() => window.__gs.state().batch.students[2].key);
  assert.deepEqual((await gradeOf(a.page, third)).rubric, [4, 4, 4]);
  const w = await workOf(a.page);
  assert.equal(Object.values(w[third].files)[0].marks[0].length, 1, 'marks from home too');
  await closeUp(a.page);
  // The same file again changes nothing.
  const again = await openFile(a.page, home);
  assert.match(again.preview, /Nothing to bring in/);
  await closeBox(a.page);
  // And the trip the other way: the laptop's Bram reaches home.
  const back = await takeHome(a.page);
  await openFile(b.page, back); await bringIt(b.page);
  await openKept(b.page, 'River essay');
  assert.equal((await gradeOf(b.page, 'Bram Sample')).comment, 'Bram from school');
  assert.deepEqual(a.page.errors, []); assert.deepEqual(b.page.errors, []);
  await a.close(); await b.close();
});

test('changed on both computers: she sees both versions, and nothing goes in until she picks', async () => {
  const a = await laptop();
  const out = await takeHome(a.page);
  const b = await openApp(browser);
  await openFile(b.page, out); await bringIt(b.page);
  await openKept(b.page, 'River essay');
  await goToStudent(b.page, 0);
  await b.page.type('#cmtIn', ' plus home');
  await settle(b.page);
  await closeUp(b.page);
  await openKept(a.page, 'River essay');
  await goToStudent(a.page, 0);
  await a.page.type('#cmtIn', ' plus school');
  await settle(a.page);
  await closeUp(a.page);
  const home = await takeHome(b.page);
  const { preview } = await openFile(a.page, home);
  assert.match(preview, /Changed in both places/);
  assert.match(preview, / plus schoolLaptop comment/); assert.match(preview, / plus homeLaptop comment/);
  assert.match(preview, /On this computer/); assert.match(preview, /In the file/);
  await a.page.click('#bringGo');   // nothing picked yet
  await a.page.waitForFunction(() => /choose a version/.test(document.querySelector('.toast').textContent));
  assert.ok(await a.page.$('#bringBox'), 'still waiting for her');
  await a.page.click('input[name="cf0"][value="b"]');
  await bringIt(a.page);
  await openKept(a.page, 'River essay');
  assert.equal((await gradeOf(a.page, 'Aria Testwell')).comment, ' plus homeLaptop comment');
  // A safety copy from just before lets her undo it.
  await closeUp(a.page);
  await a.page.waitForSelector('[data-putback]');
  assert.match(await a.page.$eval('#safetyList', e => e.textContent), /Before bringing work in/);
  await goTo(a.page, '#/settings');
  const nav = a.page.waitForNavigation({ timeout: 60000 });
  await a.page.click('[data-putback]');
  await answerDlg(a.page);
  await nav; await appReady(a.page);
  await openKept(a.page, 'River essay');
  assert.equal((await gradeOf(a.page, 'Aria Testwell')).comment, ' plus schoolLaptop comment', 'undone');
  assert.deepEqual(a.page.errors, []);
  await a.close(); await b.close();
});

test('during anonymous grading the preview counts students and names nobody', async () => {
  const a = await laptop();
  const out = await takeHome(a.page);
  const b = await openApp(browser);
  await openFile(b.page, out); await bringIt(b.page);
  await openKept(b.page, 'River essay');
  await goToStudent(b.page, 2);
  await score(b.page, [4, 4, 4]);
  await settle(b.page);
  await closeUp(b.page);
  await openKept(a.page, 'River essay');
  await a.page.evaluate(() => window.__gs.setAnon(true));
  await settle(a.page);
  await closeUp(a.page);
  const { preview } = await openFile(a.page, await takeHome(b.page));
  assert.match(preview, /1 student comes in/);
  for (const n of ['Aria', 'Bram', 'Cleo', 'Dov']) assert.ok(!preview.includes(n), n);
  await a.close(); await b.close();
});

test('forgotten at home, forgotten at school, and an older file can’t bring it back', async () => {
  const a = await laptop();
  const id = await a.page.evaluate(() => [...window.__gs.kept().keys()][0]);
  const out = await takeHome(a.page);
  const b = await openApp(browser);
  await openFile(b.page, out); await bringIt(b.page);
  await b.page.waitForFunction(() => window.__gs.kept().size === 1);
  await b.page.evaluate(i => window.__gs.forgetKept(i), id);
  const home = await takeHome(b.page);
  const { preview } = await openFile(a.page, home);
  assert.match(preview, /River essay was forgotten on the other computer, so it’s removed here too/);
  await bringIt(a.page);
  assert.equal(await a.page.evaluate(() => window.__gs.kept().size), 0);
  assert.equal((await idbRead(a.page, 'grading-studio-keep', 'papers')).k.length, 0);
  const old = await openFile(a.page, out);
  assert.match(old.preview, /River essay stays forgotten/);
  await a.page.click('#bringGo').catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  await appReady(a.page);
  assert.equal(await a.page.evaluate(() => window.__gs.kept().size), 0);
  await a.close(); await b.close();
});

test('without a save dialog the file still comes out, as a download', async () => {
  const a = await laptop();
  await a.page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const dl = await catchDownloads(a.page);
  await goTo(a.page, '#/settings'); await a.page.click('#takeBtn');
  await a.page.waitForSelector('#takeP1');
  await a.page.$eval('#takeP1', e => { e.value = 'correct horse battery'; });
  await a.page.$eval('#takeP2', e => { e.value = 'correct horse battery'; });
  const got = await dl.next(() => a.page.click('#takeGo'));
  assert.match(got.name, /^Grading Studio work .*\.gswork$/);
  await a.close();
  const b = await openApp(browser);
  const { preview } = await openFile(b.page, got.bytes);
  assert.match(preview, /River essay/);
  await b.close(); await dl.close();
});

test('asks for a real passphrase, twice', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings'); await page.click('#takeBtn');
  await page.waitForSelector('#takeP1');
  await page.$eval('#takeP1', e => { e.value = 'short'; }); await page.$eval('#takeP2', e => { e.value = 'short'; });
  await page.click('#takeGo');
  assert.match(await page.$eval('#takeErr', e => e.textContent), /at least 8/);
  await page.$eval('#takeP1', e => { e.value = 'long enough here'; }); await page.$eval('#takeP2', e => { e.value = 'long enough there'; });
  await page.click('#takeGo');
  assert.match(await page.$eval('#takeErr', e => e.textContent), /don’t match/);
  await close();
});

test('an old backup ZIP no longer overwrites newer work or replaces rosters', async () => {
  const seed = L.seed(), lib = JSON.parse(seed.ls['gs.lib']);
  const a = await openApp(browser, { seed });
  await a.page.waitForFunction(() => window.__gs.kept().size === 2);
  const riverId = L.expected.river.id, c0 = lib.classes[0].id;
  await openKept(a.page, 'River essay');
  await goToStudent(a.page, 0);
  const key = await a.page.evaluate(() => window.__gs.state().batch.students[0].key);
  await a.page.$eval('#cmtIn', e => { e.value = ''; });
  await a.page.type('#cmtIn', 'Newer than the backup');
  await settle(a.page);
  await closeUp(a.page);
  // Her roster has moved on, and the settings too.
  await a.page.evaluate(id => {
    const l = window.__gs.state().lib, c = l.classes.find(x => x.id === id);
    c.names = c.names.filter((_, i) => i > 0).concat('Zed Newstudent');
    localStorage.setItem('gs.lib', JSON.stringify(l)); localStorage.setItem('gs.setup', JSON.stringify({ mode: 'points', outOf: 20 }));
  }, c0);
  await a.page.reload(); await appReady(a.page);
  const preview = await openZipBackup(a.page, L.zip());
  assert.match(preview, /stay the same here, because this copy is newer: Cleo Fixture/);
  assert.match(preview, /Roster/);
  await bringIt(a.page);
  await openKept(a.page, 'River essay');
  assert.equal((await gradeOf(a.page, key)).comment, 'Newer than the backup', 'her newer work stayed');
  const got = await a.page.evaluate(id => ({ names: window.__gs.state().lib.classes.find(x => x.id === id).names, setup: JSON.parse(localStorage.getItem('gs.setup')) }), c0);
  assert.ok(got.names.includes('Zed Newstudent'), 'her newer name stayed');
  for (const n of L.expected.roster) assert.ok(got.names.includes(n), n + ' is on the list');
  assert.equal(got.setup.mode, 'points', 'settings are not replaced');
  void riverId;
  assert.deepEqual(a.page.errors, []);
  await a.close();
});

test('Remove from this computer: a strong warning first, then the student work is gone and the folder and Lessons are not', async () => {
  const a = await laptop();
  await linkFolder(a.page, 'Stays');
  await folderWait(a.page);
  await a.page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons', 1); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise(res => { const tx = db.transaction('lessons', 'readwrite'); tx.objectStore('lessons').put({ id: 'l1', title: 'A lesson' }); tx.oncomplete = res; }); db.close();
  });
  await a.page.evaluate(() => window.__gs.gsData.snapshot('Test', 1));
  // Not the right word: nothing happens.
  await goTo(a.page, '#/settings'); await a.page.click('#removeBtn');
  await a.page.waitForSelector('#askDlg');
  const warn = await a.page.$eval('#askText', e => e.textContent);
  assert.match(warn, /1 download/); assert.match(warn, /haven’t made a take-home file/);
  assert.match(warn, /“Stays” isn’t touched/); assert.match(warn, /Type REMOVE/); assert.match(warn, /can’t be undone/);
  await answerDlg(a.page, { typed: 'yes' });
  await a.page.waitForFunction(() => /nothing was removed/.test((document.querySelector('#askText') || {}).textContent || ''));
  await answerDlg(a.page);
  assert.equal(await a.page.evaluate(() => window.__gs.kept().size), 1);
  // Cancel: nothing happens.
  await goTo(a.page, '#/settings'); await a.page.click('#removeBtn');
  await a.page.waitForSelector('#askDlg');
  await answerDlg(a.page, { yes: false });
  assert.equal(await a.page.evaluate(() => window.__gs.kept().size), 1);
  // The right word.
  await goTo(a.page, '#/settings'); await a.page.click('#removeBtn');
  await a.page.waitForSelector('#askDlg');
  const nav = a.page.waitForNavigation({ timeout: 60000 });
  await answerDlg(a.page, { typed: 'remove' });
  await nav; await appReady(a.page);
  assert.equal(await a.page.evaluate(() => window.__gs.kept().size), 0);
  for (const s of ['papers', 'work', 'meta', 'edits']) assert.equal((await idbRead(a.page, 'grading-studio-keep', s)).k.length, 0, s);
  assert.equal((await idbRead(a.page, 'grading-studio-added', 'files')).k.length, 0);
  assert.equal(await a.page.evaluate(async () => (await indexedDB.databases()).some(d => d.name === 'grading-studio-safety')), false, 'safety copies hold student work too');
  const left = await a.page.evaluate(() => Object.keys(localStorage).filter(k => /^gs\.(b\.|batches|setup|bank|rp\.|rd\.|tomb)/.test(k)));
  assert.deepEqual(left, []);
  const names = await a.page.evaluate(() => window.__gs.state().lib.classes.flatMap(c => c.names));
  assert.deepEqual(names, [], 'rosters');
  assert.equal(await a.page.evaluate(() => window.__gs.folderState().state), 'none', 'and it isn’t linked any more, so it doesn’t refill');
  const folder = await a.page.evaluate(async () => { const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Stays')).getDirectoryHandle('Grading Studio'); const o = []; for await (const [, h] of (await d.getDirectoryHandle('downloads')).entries()) o.push(h.name); return o; });
  assert.equal(folder.length, 1, 'what’s in the folder is still there');
  assert.equal((await idbRead(a.page, 'gs-lessons', 'lessons')).k.length, 1, 'Lessons is not touched');
  assert.deepEqual(a.page.errors, []);
  await a.close();
  void folderList;
});

test('a rubric row taken out on one computer: scores brought in from the other land on their own rows, and the total is right', async () => {
  const a = await openApp(browser);
  const three = zipOf({ 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Beta/Essay.pdf': await makePaper({ title: 'Ben' }), 'Cal Gamma/Essay.pdf': await makePaper({ title: 'Cal' }) });
  await openZip(a.page, three, 'Tide.zip');
  await score(a.page, [1, 3, 4]);
  await settle(a.page); await closeUp(a.page);
  const b = await openApp(browser);
  await openFile(b.page, await takeHome(a.page)); await bringIt(b.page);
  await openKept(b.page, 'Tide'); await openKept(a.page, 'Tide');
  await goToStudent(a.page, 1);
  await score(a.page, [2, 3, 4]);
  await settle(a.page); await closeUp(a.page);
  await b.page.click('#editRubric'); await b.page.waitForSelector('#setupBody');
  await b.page.click('#dlgBox [data-rm="0"]'); await b.page.click('#dlgBox .bf [data-save]');
  await answerDlg(b.page);
  await b.page.waitForFunction(() => document.querySelector('#dlg').hidden);
  await settle(b.page); await closeUp(b.page);
  const r = await openFile(b.page, await takeHome(a.page));
  assert.match(r.preview, /1 student comes in from this file: Ben Beta/, r.preview);
  assert.match(r.preview, /don’t have the same rubric rows, so each score goes to its own row by the row’s name: Ben Beta/, r.preview);
  await bringIt(b.page);
  await openKept(b.page, 'Tide');
  const ben = await b.page.evaluate(() => { const G = window.__gs, st = G.state().batch.students.find(s => s.key === 'Ben Beta'), g = G.gradeOf(st); return { rubric: st.grade.rubric, total: g.total, pct: g.pct }; });
  assert.deepEqual(ben, { rubric: [3, 4], total: 7, pct: 88 });
  assert.deepEqual(a.page.errors, []); assert.deepEqual(b.page.errors, []);
  await a.close(); await b.close();
});
