// Keeping work safe: big downloads kept in pieces, a full small store, what she was still typing, and two tabs open at once.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { goTo, builtHtml, tmpDir, openApp, answerDlg, appReady, openZip, pickFile, waitPaper, goToStudent, setTool, clickAt, score, settle, catchDownloads, idbRead, closeBox } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');
const { loadLegacy } = require('./helpers/legacy');
const { linkFolder, folderWait, folderRead, folderList, wipeBrowser, takeHome, openFile, bringIt } = require('./helpers/carry');
const { zipSync } = require('fflate');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const idOf = page => page.evaluate(() => window.__gs.state().batch.id);
const closeUp = async page => { await page.click('#closeBtn'); await page.waitForFunction(() => document.querySelector('#start').hidden === false); await sleep(200); };
const fullCopy = async (page, id) => { const w = await idbRead(page, 'grading-studio-keep', 'work'); return w.v[w.k.indexOf(id)]; };
const reopen = async (page, id) => { await page.evaluate(id => window.__gs.reopenKept(id), id); await page.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, {}, id); await waitPaper(page); };
const gradeIn = (page, key) => page.evaluate(k => window.__gs.state().batch.students.find(s => s.key === k).grade, key);
const scoreStudent = async (page, i, v) => { await page.bringToFront(); await goToStudent(page, i); await score(page, v); await settle(page); };
// A second tab beside the first, in the same browser.
async function twoTabs(server) {
  const a = await openApp(browser, { server });
  const b = await openApp(browser, { server: a.srv, context: a.ctx });
  return { a, b, close: a.close };
}
const openIn = async (page, name) => { await page.bringToFront(); await openZip(page, zip, name); await settle(page); };
// Closes a tab the way she does, which runs what the app does on the way out.
const closeTab = async page => { await page.close({ runBeforeUnload: true }); await sleep(500); };

/* a big download */
const bigBytes = n => { const u = new Uint8Array(n); for (let i = 0; i < n; i += 4096) u[i] = (i / 4096) % 251; u[n - 1] = 77; return u; };
const sumOf = (page, key, name) => page.evaluate((key, name) => {
  const f = window.__gs.state().batch.students.find(s => s.key === key).files.find(x => x.name === name), d = f.data; let s = 0;
  for (let i = 0; i < d.length; i += 4096) s = (s + d[i]) % 65521;
  return { n: d.length, s, end: d[d.length - 1] };
}, key, name);

test('a download over 127 MB is really kept, reopens, and goes through the take-home file and the folder', { timeout: 280000 }, async () => {
  const big = bigBytes(140 * 1024 * 1024), name = 'Talk recording.mp3', dir = tmpDir('big');
  const bytes = zipSync({ 'Aria Testwell/Essay.pdf': [await makePaper({ title: 'Aria Testwell essay' }), { level: 0 }], 'Bram Sample/Essay.pdf': [await makePaper({ title: 'Bram Sample essay' }), { level: 0 }], ['Bram Sample/' + name]: [big, { level: 0 }] });
  const want = { n: big.length, s: (() => { let s = 0; for (let i = 0; i < big.length; i += 4096) s = (s + big[i]) % 65521; return s; })(), end: 77 };
  const { page, srv, close } = await openApp(browser);
  try {
    const clean = await pickFile(page, '#fileIn', bytes, 'Talks.zip'); await waitPaper(page); clean();
    const id = await idOf(page);
    await page.waitForFunction(id => (window.__gs.kept().get(id) || {}).papers, { timeout: 120000, polling: 200 }, id);
    assert.ok(await page.evaluate(id => window.__gs.kept().get(id).size, id) > 140e6, 'it knows its size');
    await score(page, [3, 3, 3]); await settle(page);
    await page.reload(); await appReady(page);
    await page.waitForSelector('#vHome [data-kopen]');
    assert.doesNotMatch(await page.$eval('#vHome', e => e.textContent), /papers not kept/);
    await reopen(page, id);
    assert.deepEqual(await sumOf(page, 'Bram Sample', name), want, 'the recording comes back whole');
    await closeUp(page);

    // the take-home file has it, and a file that big goes on the private file system
    await page.evaluate(async () => window.__gs.takeUse(await (await navigator.storage.getDirectory()).getFileHandle('big.gswork', { create: true })));
    await goTo(page, '#/settings'); await page.click('#takeBtn'); await page.waitForSelector('#takeP1');
    assert.equal(await page.$('#takeLack'), null, 'nothing to warn about');
    for (const s of ['#takeP1', '#takeP2']) await page.$eval(s, e => { e.value = 'correct horse battery'; });
    await page.click('#takeGo');
    await page.waitForSelector('#takeDone', { timeout: 180000 });
    assert.match(await page.$eval('#takeDone', e => e.textContent), /^Done/);
    assert.ok(await page.evaluate(async () => (await (await (await navigator.storage.getDirectory()).getFileHandle('big.gswork')).getFile()).size) > 140e6, 'the papers are in the file');
    await closeBox(page);

    // and it comes in on a browser with nothing
    await wipeBrowser(page, srv);
    await page.evaluate(async () => window.__gs.bringFile(await (await (await navigator.storage.getDirectory()).getFileHandle('big.gswork')).getFile()));
    await page.waitForSelector('#takeP1');
    await page.$eval('#takeP1', e => { e.value = 'correct horse battery'; });
    await page.click('#takeGo');
    await page.waitForSelector('#bringBox', { timeout: 180000 });
    await bringIt(page);
    await page.waitForFunction(id => (window.__gs.kept().get(id) || {}).papers, { timeout: 60000 }, id);
    await reopen(page, id);
    assert.deepEqual(await sumOf(page, 'Bram Sample', name), want, 'brought in whole');
    assert.deepEqual((await gradeIn(page, 'Aria Testwell')).rubric, [3, 3, 3]);

    // a linked folder gets it as well
    await linkFolder(page, 'Big'); await folderWait(page);
    const info = await folderRead(page, 'downloads', id, 'info.json');
    assert.equal(info.papers.find(e => e.path.endsWith(name)).size, big.length);
    assert.ok((await folderList(page, 'files')).includes(info.papers.find(e => e.path.endsWith(name)).hash + '.dat'));
    await closeUp(page);

    // Forget takes all of it
    await page.evaluate(id => window.__gs.forgetKept(id), id);
    assert.deepEqual((await idbRead(page, 'grading-studio-keep', 'papers')).k, []);
    assert.deepEqual(page.errors, []);
  } finally { await close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a small download stays one record, as it always was', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); const id = await idOf(page);
  await page.waitForFunction(id => (window.__gs.kept().get(id) || {}).papers, {}, id);
  assert.deepEqual((await idbRead(page, 'grading-studio-keep', 'papers')).k, [id]);
  await close();
});

test('the take-home dialog and its result both say which downloads have no papers to carry', async () => {
  const { page, close } = await openApp(browser, { seed: { idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], edits: [], work: [['gs.b.nope', { t: 5, s: {} }]], meta: [['gs.b.nope', { id: 'gs.b.nope', name: 'Unit test essays', n: 3, t: 5, scored: 0 }]] } } } } });
  await page.waitForFunction(() => window.__gs.kept().size === 1);
  await goTo(page, '#/settings'); await page.click('#takeBtn'); await page.waitForSelector('#takeP1');
  assert.match(await page.$eval('#takeLack', e => e.textContent), /Unit test essays/);
  await closeBox(page);
  await page.evaluate(async () => window.__gs.takeUse(await (await navigator.storage.getDirectory()).getFileHandle('t.gswork', { create: true })));
  await goTo(page, '#/settings'); await page.click('#takeBtn'); await page.waitForSelector('#takeP1');
  for (const s of ['#takeP1', '#takeP2']) await page.$eval(s, e => { e.value = 'correct horse battery'; });
  await page.click('#takeGo');
  await page.waitForSelector('#takeDone', { timeout: 120000 });
  assert.match(await page.$eval('#takeDone', e => e.textContent), /Unit test essays/);
  await close();
});

test('with the save dialog blocked, the take-home file still comes, as a plain download', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); await settle(page); await closeUp(page);
  await page.evaluate(() => { window.showSaveFilePicker = async () => { throw new DOMException('Blocked by policy', 'SecurityError'); }; });
  const dl = await catchDownloads(page);
  await goTo(page, '#/settings'); await page.click('#takeBtn'); await page.waitForSelector('#takeP1');
  for (const s of ['#takeP1', '#takeP2']) await page.$eval(s, e => { e.value = 'correct horse battery'; });
  const got = await dl.next(() => page.click('#takeGo'));
  assert.match(got.name, /\.gswork$/);
  assert.equal(new TextDecoder().decode(got.bytes.subarray(0, 8)), 'GSWORK1\n');
  await dl.close(); await close();
});

/* two tabs */
async function staleCloseCase(a, b) {
  await openIn(a.page, 'Mine.zip');
  await scoreStudent(a.page, 0, [3, 3, 3]);
  const id = await idOf(a.page);
  await openIn(b.page, 'Mine.zip');
  await scoreStudent(b.page, 1, [4, 4, 4]);
  await b.page.type('#cmtIn', 'Written in the second tab'); await settle(b.page);
  await closeTab(a.page);
  const rec = (await fullCopy(b.page, id)).s['Bram Sample'];
  assert.deepEqual(rec.g.rubric, [4, 4, 4], 'the second tab’s score is still there');
  assert.equal(rec.g.comment, 'Written in the second tab');
  await b.page.reload(); await appReady(b.page);
  await reopen(b.page, id);
  assert.deepEqual((await gradeIn(b.page, 'Bram Sample')).rubric, [4, 4, 4]);
  assert.deepEqual((await gradeIn(b.page, 'Aria Testwell')).rubric, [3, 3, 3]);
}
test('closing an old tab doesn’t overwrite newer work from a second tab', async () => {
  const { a, b, close } = await twoTabs();
  await staleCloseCase(a, b);
  await close();
});

test('an old tab that goes on working keeps the other tab’s work, per student', async () => {
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  await scoreStudent(a.page, 0, [3, 3, 3]);
  const id = await idOf(a.page);
  await openIn(b.page, 'Mine.zip');
  await scoreStudent(b.page, 1, [4, 4, 4]);
  // Scored in the old tab, without it having come to the front since: as a save from something still running there would.
  await a.page.evaluate(() => { const s = window.__gs.state().batch.students.find(x => x.key === 'Cleo Fixture'); s.grade.rubric = [2, 2, 2]; return window.__gs.saveNow(); });
  await sleep(300);
  let s = (await fullCopy(b.page, id)).s;
  assert.deepEqual(s['Bram Sample'].g.rubric, [4, 4, 4], 'it took nothing from the other tab');
  assert.deepEqual(s['Cleo Fixture'].g.rubric, [2, 2, 2], 'and its own change went in');
  assert.deepEqual(s['Aria Testwell'].g.rubric, [3, 3, 3]);
  // And again: a later save from the old tab mustn't bring its old copy of Bram back.
  await a.page.evaluate(() => { const st = window.__gs.state().batch.students.find(x => x.key === 'Cleo Fixture'); st.grade.rubric = [1, 1, 1]; return window.__gs.saveNow(); });
  await sleep(300);
  s = (await fullCopy(b.page, id)).s;
  assert.deepEqual(s['Bram Sample'].g.rubric, [4, 4, 4]);
  assert.deepEqual(s['Cleo Fixture'].g.rubric, [1, 1, 1]);
  // The second tab has its own old copy of Cleo now, and the same goes for it.
  await scoreStudent(b.page, 0, [4, 4, 4]);
  s = (await fullCopy(b.page, id)).s;
  assert.deepEqual(s['Cleo Fixture'].g.rubric, [1, 1, 1]);
  assert.deepEqual(s['Aria Testwell'].g.rubric, [4, 4, 4]);
  await close();
});

test('an old tab whose save failed still gets its change in once saving works again', async () => {
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  const id = await idOf(a.page);
  await openIn(b.page, 'Mine.zip');
  await scoreStudent(b.page, 1, [4, 4, 4]);
  await a.page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('no room', 'QuotaExceededError'); }; });
  await a.page.evaluate(() => { window.__gs.state().batch.students.find(x => x.key === 'Cleo Fixture').grade.rubric = [2, 2, 2]; return window.__gs.saveNow(); });
  await a.page.waitForFunction(() => window.__gs.saveTrouble().length === 1, { polling: 100 });
  await a.page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; return window.__gs.saveNow(); });
  await a.page.waitForFunction(() => window.__gs.saveTrouble().length === 0, { polling: 100, timeout: 15000 });
  const s = (await fullCopy(b.page, id)).s;
  assert.deepEqual(s['Cleo Fixture'].g.rubric, [2, 2, 2]);
  assert.deepEqual(s['Bram Sample'].g.rubric, [4, 4, 4]);
  await close();
});

test('coming back to an old tab shows the newer work, and she carries on from it', async () => {
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  await scoreStudent(a.page, 0, [3, 3, 3]);
  await goToStudent(a.page, 2);
  await settle(a.page);
  await openIn(b.page, 'Mine.zip');
  await scoreStudent(b.page, 1, [4, 4, 4]);
  await a.page.bringToFront();
  await a.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await a.page.waitForFunction(() => { const st = window.__gs.state().batch; return st.students.find(x => x.key === 'Bram Sample').grade.rubric.length === 3; }, { timeout: 30000 });
  await waitPaper(a.page);
  assert.equal(await a.page.evaluate(() => { const s = window.__gs.state(); return s.batch.students[s.cur].key; }), 'Cleo Fixture', 'on the student she was on here');
  assert.deepEqual(a.page.errors, []);
  await close();
});

test('just opening a download in a second tab changes nothing for the first', async () => {
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  await scoreStudent(a.page, 0, [3, 3, 3]);
  const batch0 = await a.page.evaluateHandle(() => window.__gs.state().batch);
  await openIn(b.page, 'Mine.zip');
  await settle(b.page);
  await a.page.bringToFront();
  await a.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await sleep(500);
  assert.ok(await a.page.evaluate(b => window.__gs.state().batch === b, batch0), 'no need to reopen anything');
  await close();
});

test('rosters set in two tabs both stay', async () => {
  const lib = { seed2627: true, classes: [{ id: 'c1', name: '12EL-1', names: [], units: [] }, { id: 'c2', name: '12EL-2', names: [], units: [] }], loose: { id: '', units: [] } };
  const a = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  const b = await openApp(browser, { server: a.srv, context: a.ctx });
  // The old tab has missed the news: its own copy of the library is as it was when it opened.
  await b.page.evaluate(() => { window.__heldLib = true; });
  const setNames = (page, id, names) => page.evaluate((id, names) => { const c = window.__gs.state().lib.classes.find(x => x.id === id); c.names = names; window.__gs.saveLib(); }, id, names);
  await a.page.evaluate(() => window.addEventListener('storage', e => { if (e.key === 'gs.lib') e.stopImmediatePropagation(); }, true));
  await setNames(b.page, 'c1', ['Aria Testwell', 'Bram Sample']);
  await sleep(200);
  await setNames(a.page, 'c2', ['Cleo Fixture', 'Dov Madeup']);
  await sleep(200);
  const saved = await a.page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).classes.map(c => [c.id, c.names]));
  assert.deepEqual(saved, [['c1', ['Aria Testwell', 'Bram Sample']], ['c2', ['Cleo Fixture', 'Dov Madeup']]]);
  await a.close();
});

const leftIn = page => page.evaluate(() => {
  const ls = Object.keys(localStorage).filter(k => /^gs\.b\./.test(k));
  return { ls, lib: (JSON.parse(localStorage.getItem('gs.lib') || '{}').classes || []).flatMap(c => c.names || []) };
});
async function removeCase(a, b) {
  await openIn(a.page, 'Mine.zip');
  await scoreStudent(a.page, 0, [3, 3, 3]);
  await a.page.type('#cmtIn', 'A comment'); await settle(a.page);
  await b.page.bringToFront();
  await b.page.waitForFunction(() => window.__gs.kept().size === 1 || !!document.querySelector('#removeBtn'));
  await b.page.evaluate(() => window.__gs.reloadKept());
  const moved = a.page.waitForNavigation({ timeout: 30000 }), nav = b.page.waitForNavigation({ timeout: 30000 });
  await goTo(b.page, '#/settings'); await b.page.click('#removeBtn');
  await answerDlg(b.page, { typed: 'REMOVE' });
  await nav; await moved;
  await appReady(a.page); await appReady(b.page);
  assert.equal(await a.page.evaluate(() => window.__gs.state().batch), null, 'the other tab let go of it, and shows nothing of it');
  await sleep(300);
  await closeTab(a.page);
  assert.deepEqual((await leftIn(b.page)).ls, [], 'closing the other tab brought nothing back');
  for (const s of ['papers', 'work', 'meta', 'edits']) assert.deepEqual((await idbRead(b.page, 'grading-studio-keep', s)).k, [], s);
}
test('Remove from this computer isn’t undone by another open tab', async () => {
  const { a, b, close } = await twoTabs();
  await removeCase(a, b);
  await close();
});

test('an old tab that missed the news still can’t save after Remove from this computer', async () => {
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  await scoreStudent(a.page, 0, [3, 3, 3]);
  const id = await idOf(a.page);
  await a.page.evaluate(() => { window.__hold = e => e.stopImmediatePropagation(); window.addEventListener('storage', window.__hold, true); });   // asleep in the background
  await b.page.bringToFront();
  await b.page.evaluate(() => window.__gs.reloadKept());
  await goTo(b.page, '#/settings');
  const nav = b.page.waitForNavigation({ timeout: 30000 });
  await b.page.click('#removeBtn');
  await answerDlg(b.page, { typed: 'REMOVE' });
  await nav; await appReady(b.page);
  // Something still going on there may have looked already, which is the check this is about: it hears nothing but looks before writing.
  await a.page.evaluate(() => { const b = window.__gs.state().batch; if (b) { b.students[0].grade.comment = 'Too late'; window.__gs.saveNow(); } }).catch(() => {});
  await sleep(500);
  assert.deepEqual((await leftIn(b.page)).ls, []);
  assert.deepEqual((await idbRead(b.page, 'grading-studio-keep', 'work')).k, []);
  void id;
  await close();
});

test('two tabs from a file:// copy look after each other too', async () => {
  const dir = tmpDir('file'), f = path.join(dir, 'Grading Studio.html');
  fs.writeFileSync(f, builtHtml());
  const url = 'file:///' + f.replace(/\\/g, '/');
  const ctx = await browser.createBrowserContext();
  try {
    const tab = async () => { const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e))); page.on('dialog', d => d.accept()); await page.goto(url); await appReady(page); return { page }; };
    const a = await tab(), b = await tab();
    await staleCloseCase(a, b);
    const a2 = await tab();
    await b.page.bringToFront();
    await closeUp(b.page);
    await removeCase(a2, b);
  } finally { await ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

/* the small store full */
// Fills localStorage to the last few bytes with quick copies of downloads whose full copies are kept, as writeWork leaves it after many marked-up downloads.
async function fillQuick(page) {
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-keep', 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const put = (n, k, v) => new Promise((res, rej) => { const tx = db.transaction(n, 'readwrite'); tx.objectStore(n).put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    const idx = JSON.parse(localStorage.getItem('gs.batches') || '{}');
    for (let i = 0, size = 400000; size >= 2000; i++) {
      const id = 'gs.b.fill' + i, t = 1000 + i, data = { t, s: {}, pad: 'x'.repeat(size) };
      try { localStorage.setItem(id, JSON.stringify(data)); idx[id] = t; await put('work', id, { t, s: {} }); await put('meta', id, { id, name: 'Filler ' + i, n: 0, t, scored: 0 }); }
      catch { size = Math.floor(size / 2); }
    }
    try { localStorage.setItem('gs.batches', JSON.stringify(idx)); } catch { const k = Object.keys(localStorage).find(x => x.startsWith('gs.b.fill')); localStorage.removeItem(k); localStorage.setItem('gs.batches', JSON.stringify(idx)); }
    for (let n = 2000, i = 0; n >= 1; i++) { try { localStorage.setItem('gs.b.last' + i, 'x'.repeat(n)); } catch { n = Math.floor(n / 2); } }
    db.close();
  });
  await page.evaluate(() => window.__gs.reloadKept());
}
const ROSTER = { classes: [{ id: 'c2', name: '12EL-2', names: ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Yuki Newperson'], units: [] }], loose: { id: '', units: [] } };
const pickClass = (page, id) => page.evaluate(id => { const sel = document.querySelector('#classSel'); sel.value = id; sel.dispatchEvent(new Event('change')); }, id);

test('Bring work in with the small store full: rosters aren’t dropped, and a score with no paper survives both ways', { timeout: 200000 }, async () => {
  const home = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(ROSTER) } } });
  await openZip(home.page, zip); const id = await idOf(home.page);
  await pickClass(home.page, 'c2'); await sleep(200);
  const yuki = await home.page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Yuki Newperson'));
  assert.ok(yuki >= 0);
  await scoreStudent(home.page, yuki, [4, 4, 4]);
  await closeUp(home.page);
  const bytes = await takeHome(home.page);

  const lap = await openApp(browser);
  await fillQuick(lap.page);
  const { preview } = await openFile(lap.page, bytes);
  assert.match(preview, /Yuki Newperson/);
  await bringIt(lap.page);
  const names = await lap.page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).classes.flatMap(c => c.names));
  assert.ok(names.includes('Yuki Newperson'), 'the roster got its room');
  await lap.page.waitForFunction(id => (window.__gs.kept().get(id) || {}).papers, {}, id);
  await lap.page.evaluate(id => window.__gs.reopenKept(id), id);   // back on Yuki, who has no paper to wait for
  await lap.page.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id && !document.querySelector('#app').hidden; }, {}, id);
  assert.deepEqual((await gradeIn(lap.page, 'Yuki Newperson')).rubric, [4, 4, 4]);
  await scoreStudent(lap.page, 0, [2, 2, 2]);
  assert.deepEqual((await fullCopy(lap.page, id)).s['Yuki Newperson'].g.rubric, [4, 4, 4]);
  await lap.close(); await home.close();
});

test('a roster edit with the small store full gets its room from quick copies that can safely go', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(ROSTER) } } });
  await fillQuick(page);
  await page.evaluate(() => { window.__gs.state().lib.classes[0].names.push('Zed Lastname Who Has A Rather Long Name To Need Some Room Here'); window.__gs.saveLib(); });
  await page.reload(); await appReady(page);
  assert.ok(await page.evaluate(() => window.__gs.state().lib.classes[0].names.some(n => n.startsWith('Zed'))));
  assert.equal((await page.$$eval('.toast', t => t.map(e => e.textContent).join(''))).includes('out of room'), false);
  await close();
});

test('a saved score for a student no longer on the list isn’t blanked by the next save', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); const id = await idOf(page);
  await score(page, [3, 3, 3]); await settle(page); await closeUp(page);
  await page.evaluate(async id => {   // a score on someone with no paper, from when the roster here had them
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep', 2); r.onsuccess = () => res(r.result); });
    const w = await new Promise(res => { const q = db.transaction('work').objectStore('work').get(id); q.onsuccess = () => res(q.result); });
    w.s['Yuki Newperson'] = { f: {}, g: { rubric: [4, 4, 4], points: '', comment: 'Kept' }, h: {}, v: { d1: 5 }, at: 5 };
    w.t += 5;
    await new Promise(res => { const tx = db.transaction('work', 'readwrite'); tx.objectStore('work').put(w, id); tx.oncomplete = res; });
    localStorage.removeItem(id); db.close();
  }, id);
  await reopen(page, id);
  await goToStudent(page, 1); await score(page, [2, 2, 2]); await settle(page);
  const y = (await fullCopy(page, id)).s['Yuki Newperson'];
  assert.deepEqual(y.g.rubric, [4, 4, 4]);
  assert.deepEqual(y.v, { d1: 5 }, 'and not counted as a change');
  await close();
});

test('with nothing in the small store that can safely go, Bring work in says so and changes nothing', { timeout: 120000 }, async () => {
  const home = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(ROSTER) } } });
  await openZip(home.page, zip); await settle(home.page); await closeUp(home.page);
  const bytes = await takeHome(home.page);
  const lap = await openApp(browser);
  await lap.page.evaluate(() => { for (let n = 400000, i = 0; n >= 1; i++) { try { localStorage.setItem('gs.pad' + i, 'x'.repeat(n)); } catch { n = Math.floor(n / 2); } } });
  const { preview } = await openFile(lap.page, bytes);
  assert.match(preview, /Yuki Newperson/);
  await lap.page.click('#bringGo');
  await lap.page.waitForSelector('#askDlg', { timeout: 60000 });
  assert.match(await lap.page.$eval('#askText', e => e.textContent), /small store for rosters and settings is full/);
  assert.equal((await idbRead(lap.page, 'grading-studio-keep', 'work')).k.length, 0, 'no marks or scores went in');
  assert.deepEqual((await idbRead(lap.page, 'grading-studio-keep', 'papers')).k, [], 'nor papers');
  await lap.close(); await home.close();
});

/* still typing */
const marksOn = (page, key) => page.evaluate(key => window.__gs.state().batch.students.find(s => s.key === key).files.flatMap(f => Object.values(f.marks).flat()).map(m => ({ t: m.t, text: m.text })), key);

test('text still being typed when she presses close comes back on reopening', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); const id = await idOf(page); await settle(page);
  await setTool(page, 'text'); await clickAt(page, 0, 100, 560);
  await page.waitForSelector('textarea.ed'); await page.keyboard.type('Typed then closed');
  await page.evaluate(() => document.querySelector('#closeBtn').click());
  await page.waitForFunction(() => document.querySelector('#start').hidden === false);
  await sleep(300);
  await reopen(page, id);
  assert.ok((await marksOn(page, 'Aria Testwell')).some(m => m.text === 'Typed then closed'));
  await close();
});

test('a margin comment still being typed when she presses close is kept', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); const id = await idOf(page); await settle(page);
  await setTool(page, 'note'); await clickAt(page, 0, 300, 620);
  await page.waitForSelector('.pop textarea'); await page.keyboard.type('Typed in the popup');
  await page.evaluate(() => document.querySelector('#closeBtn').click());
  await page.waitForFunction(() => document.querySelector('#start').hidden === false);
  await sleep(300);
  await reopen(page, id);
  assert.ok((await marksOn(page, 'Aria Testwell')).some(m => m.text === 'Typed in the popup'));
  await close();
});

test('reloading with a text box open keeps what was typed', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); const id = await idOf(page); await settle(page);
  await setTool(page, 'text'); await clickAt(page, 0, 100, 560);
  await page.waitForSelector('textarea.ed'); await page.keyboard.type('Typed then reloaded');
  await page.reload(); await appReady(page);
  await reopen(page, id);
  assert.ok((await marksOn(page, 'Aria Testwell')).some(m => m.text === 'Typed then reloaded'));
  await close();
});

/* a rubric page, and a student whose only viewable file is a late one */
test('marks on the rubric page stay for a student whose only viewable file is a late one', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); const id = await idOf(page); await settle(page);
  const late = await makePaper({ title: 'Dov Madeup late' }), rp = await makePaper({ title: 'Rubric page' });
  const b64 = Buffer.from(late).toString('base64'), rb64 = Buffer.from(rp).toString('base64');
  await page.evaluate(async b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const s = window.__gs.state().batch.students.find(x => x.key === 'Dov Madeup'); await window.__gs.addFiles(s, [{ path: 'Late.pdf', file: new File([u], 'Late.pdf', { type: 'application/pdf' }) }], true); }, b64);
  await page.evaluate(async rb64 => { localStorage.setItem('gs.rp.t1', JSON.stringify(rb64)); window.__gs.state().setup.rubricPage = { id: 't1', name: 'Rubric.pdf' }; await window.__gs.applyRubricPage(); }, rb64);
  const dov = await page.evaluate(() => window.__gs.state().batch.students.findIndex(x => x.key === 'Dov Madeup'));
  const path = await page.evaluate(i => window.__gs.state().batch.students[i].files.find(f => f.virtual).path, dov);
  assert.equal(path, 'Dov Madeup/Rubric page.pdf');
  await page.evaluate((i, p) => { window.__gs.state().batch.students[i].files.find(f => f.path === p).marks = { 0: [{ t: 'check', x: 10, y: 10 }] }; return window.__gs.saveNow(); }, dov, path);
  await settle(page); await closeUp(page);
  await reopen(page, id);
  const after = await page.evaluate(k => { const f = window.__gs.state().batch.students.find(x => x.key === k).files.find(x => x.virtual); return f && { path: f.path, n: (f.marks[0] || []).length }; }, 'Dov Madeup');
  assert.deepEqual(after, { path, n: 1 });
  assert.deepEqual(page.errors, []);
  await close();
});

/* smaller things */
test('very old work with no record in the big store comes across with a proper row', async () => {
  const L = await loadLegacy(), seed = L.seed();
  const a = await openApp(browser, { seed: { ls: seed.ls } });
  await sleep(300);
  const bytes = await takeHome(a.page);
  const b = await openApp(browser);
  const { preview } = await openFile(b.page, bytes);
  assert.doesNotMatch(preview, /1 students/);
  assert.doesNotMatch(preview, /undefined/);
  await bringIt(b.page);
  await b.page.waitForSelector('#vHome .krow');
  const rows = await b.page.$eval('#vHome', e => e.textContent);
  assert.doesNotMatch(rows, /undefined/);
  await b.close(); await a.close();
});

test('a take-home file put in the papers box says where it goes, and opens nothing', async () => {
  const { page, close } = await openApp(browser);
  const clean = await pickFile(page, '#fileIn', new Uint8Array(100), 'My work.gswork');
  await page.waitForSelector('#askDlg');
  assert.match(await page.$eval('#askText', e => e.textContent), /Bring work in/);
  clean();
  assert.equal(await page.evaluate(() => window.__gs.state().batch), null);
  await close();
});

test('opening one download doesn’t read every other download’s late files', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); const id = await idOf(page); await settle(page); await closeUp(page);
  const got = await page.evaluate(async id => {
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put({ bid: 'gs.b.other', key: 'Someone', path: 'Someone/x.pdf', name: 'x.pdf', data: new Uint8Array(10), added: 1 }, 'gs.b.other|Someone|Someone/x.pdf'); tx.oncomplete = res; });
    db.close();
    const seen = []; const was = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (q) { if (this.name === 'files' && !q) seen.push('everything'); return was.call(this, q); };
    await window.__gs.reopenKept(id);
    IDBObjectStore.prototype.getAll = was;
    return seen;
  }, id);
  assert.deepEqual(got, []);
  await close();
});
test('a folder needing a click says so at the top of the start screen, and a long name still leaves room to say what to do', async () => {
  const name = 'A rather long folder name for this year of grading';
  const { page, close } = await openApp(browser);
  await linkFolder(page, name);
  assert.equal(await page.$eval('#whereTop', e => e.hidden), true, 'nothing to say while it works');
  await page.evaluate(() => {
    const h = window.__gs.folderState().picked;
    h.queryPermission = async () => (h.ok ? 'granted' : 'prompt');
    h.requestPermission = async () => { h.ok = true; return 'granted'; };
  });
  await page.evaluate(() => window.__gs.folderResume(false));
  assert.equal(await page.$eval('#whereTop', e => e.hidden), false);
  const text = await page.$eval('#whereTop', e => e.textContent);
  assert.match(text, /needs a click to reconnect/);
  assert.doesNotMatch(text, /this year of grading/);
  const pos = await page.$eval('#whereTop', e => e.getBoundingClientRect().top < innerHeight);
  assert.ok(pos, 'on screen without scrolling');
  await page.click('#whereTop [data-wact]');
  await page.waitForFunction(() => window.__gs.folderState().state === 'ok', { timeout: 15000 });
  assert.equal(await page.$eval('#whereTop', e => e.hidden), true);
  await close();
});

test('running out of room in the browser isn’t called the folder’s disk being full', async () => {
  const { page, close } = await openApp(browser);
  await linkFolder(page, 'Room');
  await page.evaluate(() => { window.__gs.folderTroubleTest(new DOMException('Full', 'QuotaExceededError')); });
  await page.waitForFunction(() => /out of room/.test(document.querySelector('#whereLine').textContent));
  assert.doesNotMatch(await page.$eval('#whereLine', e => e.textContent), /disk/);
  await close();
});

test('forgotten in another tab: the open tab lets go, and its saves don’t bring the download back', async () => {
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  const id = await idOf(a.page);
  await b.page.bringToFront();
  await b.page.evaluate(() => window.__gs.reloadKept());
  await b.page.waitForFunction(id => window.__gs.kept().has(id), {}, id);
  await b.page.evaluate(id => window.__gs.forgetKept(id), id);
  await a.page.waitForFunction(() => window.__gs.state().batch === null, { timeout: 15000, polling: 100 });
  await sleep(300);
  assert.deepEqual((await idbRead(b.page, 'grading-studio-keep', 'work')).k, []);
  assert.ok(await b.page.evaluate(id => !!JSON.parse(localStorage.getItem('gs.tomb') || '{}')[id], id), 'it stays forgotten');
  await close();
});

test('an old tab keeps a saved comment made in another tab', async () => {
  const { a, b, close } = await twoTabs();
  await a.page.evaluate(() => { localStorage.setItem('gs.bank', JSON.stringify(['Nice work'])); });
  await sleep(200);
  assert.deepEqual(await b.page.evaluate(() => window.__gs.bank()), ['Nice work']);
  await close();
});

/* a preview of Bring work in left open while another tab goes on working */
// A take-home file from another computer, made up of whatever mutate does there.
async function homeFile(mutate) {
  const h = await openApp(browser);
  await openZip(h.page, zip, 'Mine.zip'); await settle(h.page);
  await mutate(h.page);
  await closeUp(h.page);
  const bytes = await takeHome(h.page);
  await h.close();
  return bytes;
}
const rubricOf = async (page, id, key) => ((await fullCopy(page, id)).s[key] || { g: {} }).g.rubric;

test('work saved in another tab while the preview sits open is still there after Bring it in', async () => {
  const bytes = await homeFile(async p => {
    await goToStudent(p, 2); await score(p, [2, 2, 2]); await settle(p);
    await p.evaluate(() => { window.__gs.state().lib.classes.push({ id: 'home1', name: 'Home class', names: ['Eve Example'], units: [] }); window.__gs.saveLib(); localStorage.setItem('gs.bank', JSON.stringify(['From home'])); });
  });
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  const id = await idOf(a.page);
  await scoreStudent(a.page, 0, [3, 3, 3]);
  await b.page.bringToFront();
  await openFile(b.page, bytes);
  // Stopped at the preview. Back in the other tab: a score, a name on a roster, and a comment saved for reuse.
  await scoreStudent(a.page, 1, [4, 4, 4]);
  await a.page.evaluate(() => { window.__gs.state().lib.classes[0].names = ['Dov Madeup']; window.__gs.saveLib(); localStorage.setItem('gs.bank', JSON.stringify(['From the other tab'])); });
  await sleep(200);
  await b.page.bringToFront();
  const moved = a.page.waitForNavigation({ timeout: 60000 });
  await bringIt(b.page);
  await moved;
  assert.deepEqual(await rubricOf(b.page, id, 'Bram Sample'), [4, 4, 4], 'the other tab’s score stays');
  assert.deepEqual(await rubricOf(b.page, id, 'Aria Testwell'), [3, 3, 3]);
  assert.deepEqual(await rubricOf(b.page, id, 'Cleo Fixture'), [2, 2, 2], 'and the file’s came in');
  const left = await b.page.evaluate(() => ({ lib: JSON.parse(localStorage.getItem('gs.lib')).classes.flatMap(c => c.names), bank: JSON.parse(localStorage.getItem('gs.bank')) }));
  assert.ok(left.lib.includes('Dov Madeup'), 'the other tab’s roster stays');
  assert.ok(left.lib.includes('Eve Example'), 'and the file’s came in');
  assert.deepEqual(left.bank, ['From the other tab', 'From home']);
  await close();
});

test('a new clash from another tab during the preview: nothing goes in until she has seen it and picked', async () => {
  const bytes = await homeFile(async p => { await goToStudent(p, 1); await score(p, [2, 2, 2]); await settle(p); });
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  const id = await idOf(a.page);
  await scoreStudent(a.page, 0, [3, 3, 3]);
  await b.page.bringToFront();
  const { preview } = await openFile(b.page, bytes);
  assert.doesNotMatch(preview, /Changed in both places/, 'nothing to ask yet');
  await scoreStudent(a.page, 1, [4, 4, 4]);
  await b.page.bringToFront();
  let moved = a.page.waitForNavigation({ timeout: 60000 });
  await b.page.click('#bringGo');
  await b.page.waitForSelector('#bringAgain', { timeout: 60000 });
  await moved; await appReady(a.page);
  assert.match(await b.page.$eval('#bringBox', e => e.innerText), /Changed in both places[\s\S]*Rubric: 4, 4, 4/);
  assert.deepEqual(await rubricOf(b.page, id, 'Bram Sample'), [4, 4, 4], 'not touched');

  // She picks the file's, but that tab changed Bram again first: what she picked over is no longer what's here, so she's asked again.
  await a.page.bringToFront();
  await reopen(a.page, id);
  await scoreStudent(a.page, 1, [1, 1, 1]);
  await b.page.bringToFront();
  await b.page.click('input[name="cf0"][value="b"]');
  moved = a.page.waitForNavigation({ timeout: 60000 });
  await b.page.click('#bringGo');
  await b.page.waitForFunction(() => /Rubric: 1, 1, 1/.test((document.querySelector('#bringBox') || {}).innerText || ''), { timeout: 60000 });
  await moved; await appReady(a.page);
  assert.deepEqual(await rubricOf(b.page, id, 'Bram Sample'), [1, 1, 1], 'still not touched');

  // A choice she made with the newest in front of her does go in.
  await b.page.click('input[name="cf0"][value="a"]');
  moved = a.page.waitForNavigation({ timeout: 60000 });
  await bringIt(b.page);
  await moved;
  assert.deepEqual(await rubricOf(b.page, id, 'Bram Sample'), [1, 1, 1]);
  assert.deepEqual(await rubricOf(b.page, id, 'Aria Testwell'), [3, 3, 3]);
  assert.deepEqual(b.page.errors, []);
  await close();
});

/* words still being typed in another tab when one tab replaces everything */
const typeNote = async (page, text) => { await setTool(page, 'note'); await clickAt(page, 0, 300, 620); await page.waitForSelector('.pop textarea'); await page.keyboard.type(text); };
const typeBox = async (page, text) => { await setTool(page, 'text'); await clickAt(page, 0, 100, 560); await page.waitForSelector('textarea.ed'); await page.keyboard.type(text); };
const markTexts = (work, key) => Object.values((work.s[key] || {}).f || {}).flatMap(f => Object.values(f).flat()).map(m => m.text);
const pressBring = async (a, b) => { await b.page.bringToFront(); const moved = a.page.waitForNavigation({ timeout: 60000 }); await bringIt(b.page); await moved; await appReady(a.page); };

for (const [what, type] of [['margin comment', typeNote], ['text box', typeBox]]) test('a ' + what + ' half typed in another tab is kept when Bring it in runs', async () => {
  const bytes = await homeFile(async p => { await goToStudent(p, 2); await score(p, [2, 2, 2]); await settle(p); });
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  const id = await idOf(a.page);
  await scoreStudent(a.page, 0, [3, 3, 3]);
  await b.page.bringToFront();
  await openFile(b.page, bytes);
  await a.page.bringToFront();
  await goToStudent(a.page, 1);
  await type(a.page, 'Half typed words');
  await sleep(700);
  await pressBring(a, b);
  const w = await fullCopy(b.page, id);
  assert.deepEqual(markTexts(w, 'Bram Sample'), ['Half typed words']);
  assert.deepEqual(w.s['Cleo Fixture'].g.rubric, [2, 2, 2], 'the file’s work came in too');
  assert.deepEqual(w.s['Aria Testwell'].g.rubric, [3, 3, 3]);
  assert.deepEqual(a.page.errors, []); assert.deepEqual(b.page.errors, []);
  await close();
});

test('a score just typed in another tab, not saved yet, is kept when Bring it in runs', async () => {
  const bytes = await homeFile(async p => { await goToStudent(p, 2); await score(p, [2, 2, 2]); await settle(p); });
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  const id = await idOf(a.page);
  await b.page.bringToFront();
  await openFile(b.page, bytes);
  await a.page.bringToFront();
  await goToStudent(a.page, 1);
  await score(a.page, [4, 4, 4]);
  await pressBring(a, b);
  assert.deepEqual(await rubricOf(b.page, id, 'Bram Sample'), [4, 4, 4]);
  await close();
});

test('half typed words that make a new clash: they’re kept, she’s asked, and nothing else has gone in', async () => {
  const bytes = await homeFile(async p => { await goToStudent(p, 1); await score(p, [2, 2, 2]); await settle(p); });
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  const id = await idOf(a.page);
  await scoreStudent(a.page, 0, [3, 3, 3]);
  await b.page.bringToFront();
  const { preview } = await openFile(b.page, bytes);
  assert.doesNotMatch(preview, /Changed in both places/, 'nothing to ask yet');
  await a.page.bringToFront();
  await goToStudent(a.page, 1);
  await typeNote(a.page, 'Half typed words');
  await b.page.bringToFront();
  const moved = a.page.waitForNavigation({ timeout: 60000 });
  await b.page.click('#bringGo');
  await b.page.waitForSelector('#bringAgain', { timeout: 60000 });
  await moved; await appReady(a.page);
  assert.deepEqual(markTexts(await fullCopy(b.page, id), 'Bram Sample'), ['Half typed words'], 'in storage, though nothing was brought in');
  assert.equal(await rubricOf(b.page, id, 'Bram Sample').then(r => r.some(v => v != null)), false, 'and the file’s Bram hasn’t gone in');
  // Keeping this copy goes through, with no new question: the tab that reloaded has nothing more to save.
  await b.page.click('input[name="cf0"][value="a"]');
  await pressBring(a, b);
  assert.deepEqual(markTexts(await fullCopy(b.page, id), 'Bram Sample'), ['Half typed words']);
  await close();
});

test('Put back: words half typed in another tab are in the safety copy made first', async () => {
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  await scoreStudent(a.page, 0, [3, 3, 3]);
  await b.page.bringToFront();
  await b.page.evaluate(() => window.__gs.gsData.snapshot('A test copy', window.__gs.gsData.version()));
  await b.page.reload(); await appReady(b.page);
  await a.page.bringToFront();
  await goToStudent(a.page, 1);
  await typeNote(a.page, 'Half typed words');
  await b.page.bringToFront();
  await b.page.waitForSelector('#safetyList [data-putback]');
  const moved = [a, b].map(t => t.page.waitForNavigation({ timeout: 60000 }));
  await b.page.evaluate(() => document.querySelector('#safetyList [data-putback]').click());
  await answerDlg(b.page);
  await Promise.all(moved); await appReady(b.page);
  const kept = await b.page.evaluate(async () => {
    const gd = window.__gs.gsData, list = await gd.snapshots(), rec = await gd.readCopy(list.find(s => /Before putting back/.test(s.why)).id);
    return JSON.stringify(rec, (k, v) => v instanceof Uint8Array ? 0 : v).includes('Half typed words');
  });
  assert.equal(kept, true);
  await close();
});

test('an open tab with nothing new doesn’t save when another tab asks, so it can’t look like news', async () => {
  const { a, b, close } = await twoTabs();
  await openIn(a.page, 'Mine.zip');
  const id = await idOf(a.page);
  await scoreStudent(a.page, 0, [3, 3, 3]);
  await sleep(700);
  const was = (await fullCopy(a.page, id)).t;
  await b.page.bringToFront();
  await b.page.evaluate(() => localStorage.setItem('gsc.finish', 'test'));
  await sleep(1000);
  assert.equal((await fullCopy(a.page, id)).t, was);
  await close();
});
