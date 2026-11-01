// Saving to a linked folder, in the real built app. The folder is one from the browser's private file system (see helpers/carry.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, openZip, waitPaper, appReady, goToStudent, setTool, drag, score, settle, workOf, idbRead } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { loadLegacy } = require('./helpers/legacy');
const { linkFolder, folderWait, folderInfo, folderRead, folderWrite, folderList, wipeBrowser, takeHome, openFile, bringIt } = require('./helpers/carry');

let browser, zip, L;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); L = await loadLegacy(); });
after(async () => { await browser.close(); });

const idOf = page => page.evaluate(() => window.__gs.state().batch.id);
const topBar = page => page.$eval('#saveWhere', e => e.textContent);
async function openKept(page, name) {
  await page.waitForFunction(n => [...document.querySelectorAll('#kept .krow')].some(r => r.textContent.includes(n)), { timeout: 30000 }, name);
  await page.evaluate(n => [...document.querySelectorAll('#kept .krow')].find(r => r.textContent.includes(n)).querySelector('[data-kopen]').click(), name);
  await page.waitForFunction(n => { const s = window.__gs.state(); return s.batch && s.batch.name === n; }, {}, name);
  await waitPaper(page);
}
const commentOf = (page, key) => page.evaluate(k => window.__gs.state().batch.students.find(s => s.key === k).grade.comment, key);

test('once linked, a save goes to the browser and the folder, and the top bar says so', async () => {
  const { page, close } = await openApp(browser);
  assert.equal((await page.$eval('#whereLine', e => e.textContent)).includes('only in this browser'), true);
  await openZip(page, zip, 'River essay.zip');
  assert.equal(await topBar(page), 'Only in this browser');
  await linkFolder(page, 'One');
  assert.match(await topBar(page), /^In this browser and your “One” folder$/);
  const id = await idOf(page);
  await score(page, [3.5, 3.5, 3.5]);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [160, 330], [220, 300]]);
  await settle(page); await folderWait(page);
  const w = await folderRead(page, 'downloads', id, 'work.json');
  assert.deepEqual(w.s['Aria Testwell'].g.rubric, [3.5, 3.5, 3.5]);
  assert.ok(w.s['Aria Testwell'].v, 'with its stamps');
  assert.ok(w.s['Aria Testwell'].ft['Aria Testwell/Essay.pdf'], 'and when the marks on that file changed');
  assert.equal(w.s['Aria Testwell'].f['Aria Testwell/Essay.pdf'][0].length, 1);
  const info = await folderRead(page, 'downloads', id, 'info.json');
  assert.equal(info.papers.length, 6, 'the papers');
  const files = await folderList(page, 'files');
  for (const e of info.papers) assert.ok(files.includes(e.hash + '.dat'), e.path + ' is stored');
  assert.deepEqual(await folderList(page, 'downloads', id), ['info.json', 'work.json'], 'no half-done file is left behind');
  assert.ok((await folderList(page)).includes('README.txt'));
  assert.ok((await folderList(page, 'snapshots')).some(n => / daily\.gsnap$/.test(n)), 'a dated snapshot');
  assert.deepEqual(page.errors, []);
  await close();
});

test('papers are stored once, however many downloads share them', async () => {
  const { page, close } = await openApp(browser);
  await linkFolder(page, 'Once');
  const f = await standardFiles();
  await openZip(page, zipOf(f), 'One.zip');
  await folderWait(page);
  const before_ = (await folderList(page, 'files')).length;
  const key = Object.keys(f)[0];
  await page.click('#closeBtn');
  await openZip(page, zipOf({ ...f, [key.split('/')[0] + '/Extra.txt']: new TextEncoder().encode('One more file') }), 'Two.zip');
  await folderWait(page);
  assert.equal((await folderList(page, 'files')).length, before_ + 1);
  await close();
});

test('a half-written file is never the only copy', async () => {
  const { page, close, srv } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'Half');
  await page.type('#cmtIn', 'Saved properly');
  await settle(page); await folderWait(page);
  const id = await idOf(page), whole = await folderRead(page, 'downloads', id, 'work.json');
  // The tab closed while writing work.json: the .new from just before is whole, and the file itself is cut short.
  await folderWrite(page, ['downloads', id, 'work.json.new'], whole);
  await folderWrite(page, ['downloads', id, 'work.json'], JSON.stringify(whole).slice(0, 80));
  await wipeBrowser(page, srv);
  await linkFolder(page, 'Half');
  await openKept(page, 'River essay');
  assert.equal(await commentOf(page, 'Aria Testwell'), 'Saved properly');
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).s['Aria Testwell'].g.comment, 'Saved properly', 'and the cut-short file is whole again');
  assert.deepEqual(await folderList(page, 'downloads', id), ['info.json', 'work.json']);
  // The other way: the .new is cut short, and the file itself is whole.
  await folderWait(page);
  await folderWrite(page, ['downloads', id, 'work.json.new'], '{"t":1,"s":{"Aria');
  await page.click('#closeBtn');
  await wipeBrowser(page, srv);
  await linkFolder(page, 'Half');
  await openKept(page, 'River essay');
  assert.equal(await commentOf(page, 'Aria Testwell'), 'Saved properly');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a browser with nothing in it gets everything back from the folder', async () => {
  const { page, close, srv } = await openApp(browser, { seed: L.seed() });
  await page.waitForFunction(() => window.__gs.kept().size === 2);
  await linkFolder(page, 'Rebuild');
  const was = await page.evaluate(() => ({ names: window.__gs.state().lib.classes[0].names, unit: window.__gs.state().lib.classes[0].units[0].items[0].name, bank: JSON.parse(localStorage.getItem('gs.bank')) }));
  await openKept(page, 'River essay');
  await page.evaluate(() => window.__gs.scanAll());
  const before_ = await workOf(page);
  const refs = await page.evaluate(() => window.__gs.refs().map(r => [r.name, r.data.length]));
  const word = await page.evaluate(() => window.__gs.state().batch.students.find(x => x.key === 'Dov Madeup').files.find(f => f.name === 'Essay.docx').data.length);
  await page.click('#closeBtn'); await folderWait(page);
  await wipeBrowser(page, srv);
  assert.equal(await page.evaluate(() => window.__gs.kept().size), 0, 'it really is empty');
  assert.match(await page.$eval('#whereLine', e => e.textContent), /only in this browser/);
  await linkFolder(page, 'Rebuild');
  assert.equal(await page.evaluate(() => window.__gs.kept().size), 2);
  await openKept(page, 'River essay');
  await page.evaluate(() => window.__gs.scanAll());
  assert.deepEqual(await workOf(page), before_);
  assert.deepEqual(await page.evaluate(() => window.__gs.refs().map(r => [r.name, r.data.length])), refs, 'readings');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.find(x => x.key === 'Dov Madeup').files.find(f => f.name === 'Essay.docx').data.length), word, 'the Word edit');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.find(x => x.key === 'Dov Madeup').files.find(f => f.name === 'Essay.docx').edited > 0), true);
  const now = await page.evaluate(() => ({ names: window.__gs.state().lib.classes.find(c => c.names.length).names, unit: window.__gs.state().lib.classes.find(c => c.names.length).units[0].items[0].name, bank: JSON.parse(localStorage.getItem('gs.bank')) }));
  assert.deepEqual(now, was, 'rosters, units and saved comments');
  assert.equal(await page.evaluate(() => window.__gs.state().lib.classes.filter(c => /12EL-1/.test(c.name)).length), 1, 'no doubled starter classes');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the folder going away is said plainly, and it catches up when it comes back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await linkFolder(page, 'Away');
  const id = await idOf(page);
  await page.evaluate(async () => { await (await navigator.storage.getDirectory()).removeEntry('Away', { recursive: true }); });
  await page.type('#cmtIn', 'Written while the folder was away');
  await settle(page);
  await page.waitForFunction(() => window.__gs.folderState().state === 'lost', { timeout: 15000 });
  assert.match(await topBar(page), /Only in this browser\. Can’t reach “Away”/);
  assert.match(await page.$eval('#saveState', e => e.textContent), /Saved/, 'and her work is still safe in the browser');
  await page.evaluate(async () => { await (await navigator.storage.getDirectory()).getDirectoryHandle('Away', { create: true }); });
  await page.evaluate(() => window.__gs.folderResume(false));
  await folderWait(page);
  assert.equal((await folderInfo(page)).state, 'ok');
  assert.match(await topBar(page), /In this browser and your “Away” folder/);
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).s['Aria Testwell'].g.comment, 'Written while the folder was away');
  assert.deepEqual(await bytesOf(page, id), { listed: 6, papers: 6, missing: 0 }, 'even the papers, in a folder emptied meanwhile');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a folder that needs a click says so, and the click brings it back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await linkFolder(page, 'Ask');
  await page.evaluate(() => {
    const h = window.__gs.folderState().picked;
    h.queryPermission = async () => (h.ok ? 'granted' : 'prompt');
    h.requestPermission = async () => { h.ok = true; return 'granted'; };
  });
  await page.evaluate(() => window.__gs.folderResume(false));
  assert.equal((await folderInfo(page)).state, 'ask');
  assert.match(await topBar(page), /Only in this browser\. “Ask” needs a click to reconnect/);
  await page.click('#saveWhere');
  await page.waitForFunction(() => window.__gs.folderState().state === 'ok', { timeout: 15000 });
  assert.match(await topBar(page), /In this browser and your “Ask” folder/);
  await close();
});

test('the link survives closing the tab: the folder comes back by itself when the browser still allows it', async () => {
  const { page, close } = await openApp(browser);
  await linkFolder(page, 'Stays');
  await page.reload(); await appReady(page);
  await page.waitForFunction(() => window.__gs.folderState().state === 'ok', { timeout: 15000 });
  assert.match(await page.$eval('#whereLine', e => e.textContent), /“Stays”/);
  await close();
});

test('newer work in the folder comes into the browser, per student, with no question', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await linkFolder(page, 'Other');
  await page.type('#cmtIn', 'From the browser');
  await settle(page); await folderWait(page);
  const id = await idOf(page), w = await folderRead(page, 'downloads', id, 'work.json');
  const r = w.s['Aria Testwell'];
  // Another computer scored Bram, and left Aria alone. Its clock is years behind, which doesn't matter.
  w.s['Bram Sample'] = { f: {}, g: { rubric: [2, 2, 2], points: '', comment: 'From the other computer', at: 5 }, h: {}, v: { other: 5 }, at: 5 };
  w.t = 5;
  await folderWrite(page, ['downloads', id, 'work.json'], w);
  await page.evaluate(() => window.__gs.folderReconcile());
  await folderWait(page);
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.pages.length > 0 && s.batch.students.some(x => x.key === 'Bram Sample' && x.grade.comment); }, { timeout: 30000 });
  assert.equal(await commentOf(page, 'Bram Sample'), 'From the other computer');
  assert.equal(await commentOf(page, 'Aria Testwell'), 'From the browser');
  assert.deepEqual((await folderRead(page, 'downloads', id, 'work.json')).s['Aria Testwell'].v, r.v);
  assert.deepEqual(page.errors, []);
  await close();
});

test('changed in both places: she sees both, each place keeps its own until she picks, and her pick reaches both', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await linkFolder(page, 'Both');
  await page.type('#cmtIn', 'Start');
  await settle(page); await folderWait(page);
  const id = await idOf(page), w = await folderRead(page, 'downloads', id, 'work.json');
  const base = w.s['Aria Testwell'].v;
  await page.type('#cmtIn', ' here');
  await settle(page); await folderWait(page);
  w.s['Aria Testwell'].g.comment = 'Start there'; w.s['Aria Testwell'].v = { ...base, other: 7 };
  await folderWrite(page, ['downloads', id, 'work.json'], w);
  await page.evaluate(() => window.__gs.folderReconcile());
  await page.waitForSelector('#cfBox');
  const text = await page.$eval('#cfBox', e => e.innerText);
  assert.match(text, /Aria Testwell/); assert.match(text, /Start here/); assert.match(text, /Start there/);
  assert.match(text, /On this computer/); assert.match(text, /In your folder/);
  // Later: each keeps its own, and saving here doesn't overwrite the folder's version of her.
  await page.click('[data-cflater]');
  await folderWait(page);
  assert.match(await topBar(page), /1 thing to decide/);
  assert.equal(await commentOf(page, 'Aria Testwell'), 'Start here');
  await goToStudent(page, 1);
  await page.type('#cmtIn', 'Unrelated');
  await settle(page); await folderWait(page);
  const held = await folderRead(page, 'downloads', id, 'work.json');
  assert.equal(held.s['Aria Testwell'].g.comment, 'Start there', 'the folder keeps its version');
  assert.equal(held.s['Bram Sample'].g.comment, 'Unrelated', 'and everyone else still saves');
  await page.click('#saveWhere');
  await page.waitForSelector('#cfBox');
  await page.click('.cfside input[value="b"]');
  await page.click('[data-cfok]');
  await page.waitForFunction(() => window.__gs.folderState().asks.length === 0 && window.__gs.folderState().state === 'ok', { timeout: 15000 });
  await folderWait(page);
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.pages.length > 0 && s.batch.students.find(x => x.key === 'Aria Testwell').grade.comment === 'Start there'; }, { timeout: 30000 });
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).s['Aria Testwell'].g.comment, 'Start there');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a merge from the folder can be undone: a snapshot from before it goes back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'Undo');
  await page.type('#cmtIn', 'Keep this');
  await settle(page); await folderWait(page);
  const id = await idOf(page), w = await folderRead(page, 'downloads', id, 'work.json');
  w.s['Aria Testwell'].g.comment = 'A bad merge'; w.s['Aria Testwell'].v = { ...w.s['Aria Testwell'].v, other: 9 };
  await folderWrite(page, ['downloads', id, 'work.json'], w);
  await page.evaluate(() => window.__gs.folderReconcile());
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.pages.length > 0 && s.batch.students.find(x => x.key === 'Aria Testwell').grade.comment === 'A bad merge'; }, { timeout: 30000 });
  await folderWait(page);
  const snaps = await page.evaluate(() => window.__gs.snapList());
  const undo = snaps.find(s => /Before bringing in work/.test(s.why));
  assert.ok(undo, 'a snapshot from just before the merge');
  await page.click('#closeBtn');
  await folderWait(page);
  await page.waitForSelector('[data-wopen]'); await page.evaluate(() => document.querySelector('[data-wopen]').click());
  await page.waitForSelector('[data-snap]');
  assert.match(await page.$eval('#snapBox', e => e.innerText), /before bringing in work/);
  const nav = page.waitForNavigation({ timeout: 60000 });
  await page.evaluate(n => document.querySelector('[data-snap="' + n + '"]').click(), undo.name);
  await answerDlg(page);
  await nav;
  await appReady(page);
  await page.waitForFunction(() => window.__gs.folderState().state === 'ok', { timeout: 30000 });
  await folderWait(page);
  await openKept(page, 'River essay');
  assert.equal(await commentOf(page, 'Aria Testwell'), 'Keep this');
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).s['Aria Testwell'].g.comment, 'Keep this', 'and the folder went back with it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('putting back a safety copy takes the folder with it', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await linkFolder(page, 'PutBack');
  await page.type('#cmtIn', 'Before');
  await settle(page); await folderWait(page);
  const id = await idOf(page);
  await page.evaluate(() => window.__gs.gsData.snapshot('Test copy', window.__gs.gsData.version()));
  await page.type('#cmtIn', ' and after');
  await settle(page); await folderWait(page);
  await page.click('#closeBtn');
  await page.waitForSelector('[data-putback]');
  const nav = page.waitForNavigation({ timeout: 60000 });
  await page.click('[data-putback]');
  await answerDlg(page);
  await nav;
  await appReady(page);
  await page.waitForFunction(() => window.__gs.folderState().state === 'ok', { timeout: 30000 });
  await folderWait(page);
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).s['Aria Testwell'].g.comment, 'Before');
  await close();
});

test('forget reaches the folder, its snapshots and its files, and the download stays forgotten', async () => {
  const { page, close, srv } = await openApp(browser);
  await linkFolder(page, 'Forget');
  await openZip(page, zip);
  await page.type('#cmtIn', 'To be forgotten');
  await settle(page); await folderWait(page);
  const id = await idOf(page);
  await page.click('#closeBtn');
  await page.evaluate(i => window.__gs.forgetKept(i), id);
  await folderWait(page);
  assert.deepEqual(await folderList(page, 'downloads'), []);
  assert.deepEqual(await folderList(page, 'files'), [], 'its papers are gone');
  assert.ok((await folderRead(page, 'tombstones.json'))[id], 'and the folder remembers');
  const inSnaps = await page.evaluate(async () => {
    const d = await window.__gs.folderState().root.getDirectoryHandle('snapshots'), out = [];
    for await (const [, h] of d.entries()) out.push(await new Response((await h.getFile()).stream().pipeThrough(new DecompressionStream('gzip'))).text());
    return out.join('');
  });
  assert.ok(!inSnaps.includes('To be forgotten'), 'nor can a snapshot bring it back');
  // A browser with nothing in it, linked again: it stays gone.
  await wipeBrowser(page, srv);
  await linkFolder(page, 'Forget');
  assert.equal(await page.evaluate(() => window.__gs.kept().size), 0);
  assert.ok(await page.evaluate(i => !!JSON.parse(localStorage.getItem('gs.tomb'))[i], id));
  // Opening the same download again on purpose is different.
  await openZip(page, zip);
  await page.type('#cmtIn', 'Second life');
  await settle(page); await folderWait(page);
  assert.equal(await page.evaluate(i => !!(JSON.parse(localStorage.getItem('gs.tomb') || '{}'))[i], id), false);
  await page.evaluate(() => window.__gs.folderReconcile());
  await folderWait(page);
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).s['Aria Testwell'].g.comment, 'Second life');
  assert.equal((await folderRead(page, 'tombstones.json'))[id], undefined);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a late file taken off stays off after a merge', async () => {
  const { page, close, srv } = await openApp(browser);
  await openZip(page, zip);
  await linkFolder(page, 'Late');
  await page.evaluate(() => window.__gs.addFiles(window.__gs.state().batch.students[0], [{ path: 'late.txt', file: new File(['Late work'], 'late.txt') }], true));
  await page.evaluate(() => window.__gs.saveNow());
  await folderWait(page);
  const id = await idOf(page), key = 'Aria Testwell|Aria Testwell/late.txt';
  assert.ok((await folderRead(page, 'downloads', id, 'info.json')).added[key], 'in the folder');
  const file = await folderRead(page, 'downloads', id, 'info.json');
  await page.evaluate(() => window.__gs.removeAdded(window.__gs.state().batch.students[0], 'Aria Testwell/late.txt'));
  await page.evaluate(() => window.__gs.saveNow());
  await folderWait(page);
  assert.equal((await folderRead(page, 'downloads', id, 'info.json')).added[key], undefined, 'gone from the folder too');
  // An older copy of the folder still has it: the browser's list of what was taken off wins.
  await folderWrite(page, ['downloads', id, 'info.json'], file);
  await page.evaluate(() => window.__gs.folderReconcile());
  await folderWait(page);
  const got = await page.evaluate(() => window.__gs.state().batch.students[0].files.map(f => f.name));
  assert.ok(!got.includes('late.txt'));
  assert.equal((await folderRead(page, 'downloads', id, 'info.json')).added[key], undefined);
  await close();
  void srv;
});

test('stop using a folder leaves its files alone', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await linkFolder(page, 'Stop');
  await page.click('#closeBtn');
  await folderWait(page);
  await page.waitForSelector('[data-wopen]'); await page.evaluate(() => document.querySelector('[data-wopen]').click());
  await page.waitForSelector('[data-wstop]');
  await page.click('[data-wstop]');
  await page.waitForSelector('#askDlg');
  assert.match(await page.$eval('#askText', e => e.textContent), /Nothing in it is deleted/);
  await answerDlg(page);
  await page.waitForFunction(() => window.__gs.folderState().state === 'none');
  const left = await page.evaluate(async () => { const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Stop')).getDirectoryHandle('Grading Studio'); const o = []; for await (const [n] of d.entries()) o.push(n); return o; });
  assert.ok(left.includes('downloads'));
  await close();
});

/* undoing a merge, and bytes the browser or the folder hasn't got */
async function setRoster(page, name, names) {
  const ci = await page.evaluate(n => window.__gs.state().lib.classes.findIndex(c => c.name === n), name);
  await page.evaluate(i => document.querySelector('[data-edit-class="' + i + '"]').click(), ci);
  await page.waitForSelector('#cNames');
  await page.$eval('#cNames', (e, v) => { e.value = v; }, names.join('\n'));
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
}
const rosterOf = (page, name) => page.evaluate(n => window.__gs.state().lib.classes.find(c => c.name === n).names, name);
const settled = async page => { await page.waitForFunction(() => ['ok', 'decide'].includes(window.__gs.folderState().state), { timeout: 30000 }); await folderWait(page); };
const closeUp = async page => { await page.click('#closeBtn'); await page.waitForFunction(() => document.querySelector('#start').hidden === false); await folderWait(page); };
const inStore = (db, store) => async page => ((await idbRead(page, db, store)) || { k: [] }).k.slice().sort();
const addedKeys = inStore('grading-studio-added', 'files'), editKeys = inStore('grading-studio-keep', 'edits');
const bytesOf = (page, id) => page.evaluate(async id => {   // does the folder really hold the bytes it lists?
  const root = window.__gs.folderState().root, have = new Set();
  try { for await (const [n] of (await root.getDirectoryHandle('files')).entries()) have.add(n); } catch {}
  const d = await (await root.getDirectoryHandle('downloads')).getDirectoryHandle(encodeURIComponent(id));
  const info = JSON.parse(await (await (await d.getFileHandle('info.json')).getFile()).text());
  const refs = [...(info.papers || []), ...Object.values(info.added), ...Object.values(info.edits).flatMap(e => [e.data, e.orig])].filter(r => r && r.hash);
  return { listed: refs.length, papers: (info.papers || []).length, missing: refs.filter(r => !have.has(r.hash + '.dat')).length };
}, id);
const dropBlob = (page, hash) => page.evaluate(async h => { await (await window.__gs.folderState().root.getDirectoryHandle('files')).removeEntry(h + '.dat'); }, hash);
// A Word edit, as the app stores one.
const putEdit = (page, id, p, text) => page.evaluate(async (id, p, text) => {
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
  const b = new TextEncoder().encode(text);
  await new Promise(res => { const tx = db.transaction('edits', 'readwrite'); tx.objectStore('edits').put({ t: Date.now(), data: b, orig: new TextEncoder().encode('Original ' + text) }, id + '|' + p); tx.oncomplete = res; });
  db.close();
}, id, p, text);
const addLate = (page, i, name) => page.evaluate(async (i, name) => { await window.__gs.addFiles(window.__gs.state().batch.students[i], [{ path: name, file: new File(['late ' + name], name) }], true); await window.__gs.saveNow(); }, i, name);

for (const how of ['Put back', 'Go back']) test(how + ' undoes a bad merge with a folder linked: rosters, saved comments and rubrics too', async () => {
  const a = await openApp(browser);
  await setRoster(a.page, '12EL-1', ['Aria Testwell', 'Bram Sample', 'Cleo Fixture']);
  await a.page.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['From the laptop'])));
  await linkFolder(a.page, 'Undo' + how[0]);
  await openZip(a.page, zip, 'River essay.zip');
  await closeUp(a.page);
  const file = await takeHome(a.page);
  const b = await openApp(browser);
  await openFile(b.page, file); await bringIt(b.page);
  await setRoster(b.page, '12EL-1', ['Aria Testwell', 'Zed Wrongly']);
  await b.page.evaluate(() => { localStorage.setItem('gs.bank', JSON.stringify(['From the laptop', 'From home'])); localStorage.setItem('gs.rp.fromHome', '"a rubric made at home"'); });
  const back = await takeHome(b.page);
  await b.close();
  await openFile(a.page, back); await bringIt(a.page);
  await settled(a.page);
  assert.deepEqual(await rosterOf(a.page, '12EL-1'), ['Aria Testwell', 'Zed Wrongly'], 'the bad merge happened');
  assert.ok(await a.page.evaluate(() => !!localStorage.getItem('gs.rp.fromHome')));
  const nav = a.page.waitForNavigation({ timeout: 60000 });
  if (how === 'Put back') {
    await a.page.waitForSelector('[data-putback]');
    await a.page.evaluate(() => document.querySelector('[data-putback]').click());
  } else {
    const snap = (await a.page.evaluate(() => window.__gs.snapList())).find(s => /Before bringing work in/.test(s.why));
    await a.page.evaluate(() => document.querySelector('[data-wopen]').click());
    await a.page.waitForSelector('[data-snap]');
    await a.page.evaluate(n => document.querySelector('[data-snap="' + n + '"]').click(), snap.name);
  }
  await answerDlg(a.page); await nav; await appReady(a.page);
  await settled(a.page);
  assert.deepEqual(await rosterOf(a.page, '12EL-1'), ['Aria Testwell', 'Bram Sample', 'Cleo Fixture']);
  assert.deepEqual(await a.page.evaluate(() => JSON.parse(localStorage.getItem('gs.bank'))), ['From the laptop']);
  assert.equal(await a.page.evaluate(() => localStorage.getItem('gs.rp.fromHome')), null);
  const lib = await folderRead(a.page, 'library.json');
  assert.deepEqual(JSON.parse(lib.ls['gs.lib']).classes.find(c => c.name === '12EL-1').names, ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'], 'the folder went back too');
  assert.equal(lib.ls['gs.rp.fromHome'], undefined);
  await a.page.reload(); await appReady(a.page); await settled(a.page);
  assert.deepEqual(await rosterOf(a.page, '12EL-1'), ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'], 'and it stays that way');
  assert.deepEqual(a.page.errors, []);
  await a.close();
});

test('a roster that comes in from the folder alone makes a snapshot to undo it with', async () => {
  const { page, close } = await openApp(browser);
  await setRoster(page, '12EL-1', ['Aria Testwell', 'Bram Sample']);
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'RosterOnly');
  await closeUp(page);
  const lib = await folderRead(page, 'library.json'), l = JSON.parse(lib.ls['gs.lib']), c = l.classes.find(x => x.name === '12EL-1');
  c.names = ['Zed Wrongly']; c.v = { ...c.v, other: 9 };
  lib.ls['gs.lib'] = JSON.stringify(l);
  await folderWrite(page, ['library.json'], lib);
  await page.evaluate(() => window.__gs.folderReconcile());
  await settled(page);
  assert.deepEqual(await rosterOf(page, '12EL-1'), ['Zed Wrongly']);
  assert.ok((await page.evaluate(() => window.__gs.snapList())).some(s => /Before bringing in work/.test(s.why)));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a merge from the folder brings in late files, readings and Word edits this browser hasn’t got', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'Second');
  await score(page, [3, 3, 3]);
  await settle(page); await folderWait(page);
  await closeUp(page);
  const id = await page.evaluate(() => [...window.__gs.kept().keys()][0]);
  const old = await page.evaluate(async id => {
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    const w = await new Promise(res => { const q = db.transaction('work').objectStore('work').get(id); q.onsuccess = () => res(q.result); });
    db.close();
    return { w, ls: localStorage.getItem(id) };
  }, id);
  await openKept(page, 'River essay');
  await goToStudent(page, 1);
  await score(page, [2, 2, 2]);
  await page.evaluate(() => window.__gs.addRefs([new File(['reading text'], 'Reading.txt')]));
  await addLate(page, 1, 'Late.txt');
  await putEdit(page, id, 'Dov Madeup/Essay.docx', 'Edited in Word');
  await settle(page); await page.evaluate(() => window.__gs.saveNow()); await folderWait(page);
  await closeUp(page);
  const had = await folderRead(page, 'downloads', id, 'info.json');
  assert.equal(Object.keys(had.added).length, 2, 'the folder has them'); assert.equal(Object.keys(had.edits).length, 1);
  const lateKey = Object.keys(had.added).find(k => /Late\.txt$/.test(k));
  // What a second browser on the same folder looks like: its work is older and it has none of these files.
  const base = page.url();
  await page.goto(base + 'blank');
  await page.evaluate(async (id, o) => {
    localStorage.setItem(id, o.ls);
    const open = n => new Promise(res => { const r = indexedDB.open(n); r.onsuccess = () => res(r.result); });
    const k = await open('grading-studio-keep');
    await new Promise(res => { const tx = k.transaction(['work', 'edits'], 'readwrite'); tx.objectStore('work').put(o.w, id); tx.objectStore('edits').clear(); tx.oncomplete = res; }); k.close();
    const d = await open('grading-studio-added');
    await new Promise(res => { const tx = d.transaction('files', 'readwrite'); tx.objectStore('files').clear(); tx.oncomplete = res; }); d.close();
  }, id, old);
  await page.goto(base); await appReady(page); await settled(page);
  assert.deepEqual(await addedKeys(page), Object.keys(had.added).map(k => id + '|' + k).sort(), 'they came in');
  assert.deepEqual(await editKeys(page), [id + '|Dov Madeup/Essay.docx']);
  const later = await folderRead(page, 'downloads', id, 'info.json');
  assert.deepEqual(Object.keys(later.added).sort(), Object.keys(had.added).sort(), 'and the folder still has them');
  assert.deepEqual(Object.keys(later.edits), ['Dov Madeup/Essay.docx']);
  const text = await page.evaluate(async k => {
    const d = await new Promise(res => { const r = indexedDB.open('grading-studio-added'); r.onsuccess = () => res(r.result); });
    const rec = await new Promise(res => { const q = d.transaction('files').objectStore('files').get(k); q.onsuccess = () => res(q.result); });
    d.close();
    return new TextDecoder().decode(rec.data);
  }, id + '|' + lateKey);
  assert.equal(text, 'late Late.txt', 'with the right bytes');
  await openKept(page, 'River essay');
  assert.deepEqual((await page.evaluate(() => window.__gs.state().batch.students[1].grade)).rubric, [2, 2, 2]);
  assert.ok(await page.evaluate(() => window.__gs.state().batch.students[1].files.some(f => f.name === 'Late.txt')));
  assert.deepEqual(page.errors, []);
  await close();
});

test('going back takes off late files and Word edits made since, and returns ones taken off since', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'BackFiles');
  const id = await idOf(page);
  await addLate(page, 0, 'Kept.txt');
  await folderWait(page);
  const point = await page.evaluate(async () => { await window.__gs.folderSnapshot('Test point'); return (await window.__gs.snapList()).find(s => s.why === 'Test point').name; });
  await page.evaluate(() => window.__gs.removeAdded(window.__gs.state().batch.students[0], 'Aria Testwell/Kept.txt'));
  await addLate(page, 0, 'Newer.txt');
  await putEdit(page, id, 'Dov Madeup/Essay.docx', 'Edited after');
  await page.evaluate(() => window.__gs.saveNow()); await folderWait(page);
  await closeUp(page);
  assert.deepEqual(Object.keys((await folderRead(page, 'downloads', id, 'info.json')).added), ['Aria Testwell|Aria Testwell/Newer.txt']);
  await page.evaluate(n => window.__gs.folderGoBack(n), point);
  await page.reload(); await appReady(page); await settled(page);
  const key = 'Aria Testwell|Aria Testwell/Kept.txt';
  const check = async () => {
    assert.deepEqual(await addedKeys(page), [id + '|' + key], 'what it was then, in the browser');
    assert.deepEqual(await editKeys(page), []);
    const info = await folderRead(page, 'downloads', id, 'info.json');
    assert.deepEqual(Object.keys(info.added), [key], 'and in the folder');
    assert.deepEqual(info.edits, {});
  };
  await check();
  await page.evaluate(() => window.__gs.folderReconcile()); await settled(page);
  await check();
  await page.reload(); await appReady(page); await settled(page);
  await check();
  assert.deepEqual(page.errors, []);
  await close();
});

test('a linked folder deleted while the tab is open really catches up, and can rebuild an empty browser', async () => {
  const { page, close, srv } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'Docs');   // so the data is in Docs/Grading Studio
  const id = await idOf(page);
  await addLate(page, 0, 'Late.txt');
  await folderWait(page);
  await page.evaluate(async () => { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('Docs'); await d.removeEntry('Grading Studio', { recursive: true }); });
  await page.type('#cmtIn', 'After the folder went');
  await settle(page);
  await page.waitForFunction(() => window.__gs.folderState().state === 'lost', { timeout: 15000 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));   // back to the tab
  await page.waitForFunction(() => window.__gs.folderState().state === 'ok', { timeout: 30000 });
  await folderWait(page);
  assert.match(await topBar(page), /In this browser and your “Docs” folder/);
  const b = await bytesOf(page, id);
  assert.equal(b.papers, 6, 'it lists the papers'); assert.equal(b.missing, 0, 'and has all their bytes');
  assert.ok((await folderList(page, 'snapshots')).some(n => / daily\.gsnap$/.test(n)), 'with a snapshot in the new folder');
  await closeUp(page);
  await wipeBrowser(page, srv);
  await linkFolder(page, 'Docs');
  assert.equal((await folderInfo(page)).state, 'ok');
  await openKept(page, 'River essay');
  assert.equal(await commentOf(page, 'Aria Testwell'), 'After the folder went');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.flatMap(s => s.files).length), 7, 'all the papers and the late file');
  assert.deepEqual(page.errors, []);
  await close();
});

test('bytes gone from the folder alone are written again from the browser', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await linkFolder(page, 'Patch');
  const id = await idOf(page);
  await addLate(page, 0, 'Late.txt');
  await putEdit(page, id, 'Dov Madeup/Essay.docx', 'Edited');
  await page.evaluate(() => window.__gs.saveNow()); await folderWait(page);
  await page.evaluate(() => window.__gs.folderReconcile()); await settled(page);   // the edit's first sync
  const info = await folderRead(page, 'downloads', id, 'info.json');
  await dropBlob(page, info.papers[0].hash);
  await dropBlob(page, Object.values(info.added)[0].hash);
  await dropBlob(page, Object.values(info.edits)[0].data.hash);
  assert.equal((await bytesOf(page, id)).missing, 3);
  await page.evaluate(() => window.__gs.folderReconcile()); await settled(page);
  assert.deepEqual(await bytesOf(page, id), { listed: 9, papers: 6, missing: 0 });
  assert.deepEqual(page.errors, []);
  await close();
});

test('a file missing from the folder doesn’t stop an empty browser getting the rest back, and she’s told', async () => {
  const { page, close, srv } = await openApp(browser);
  await setRoster(page, '12EL-1', ['Aria Testwell', 'Bram Sample']);
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'Short');
  const id = await idOf(page);
  await page.type('#cmtIn', 'Still here');
  await addLate(page, 0, 'Late.txt');
  await addLate(page, 1, 'Second.txt');
  await settle(page); await folderWait(page);
  await closeUp(page);
  const info = await folderRead(page, 'downloads', id, 'info.json');
  await dropBlob(page, info.papers[0].hash);
  await dropBlob(page, info.added['Bram Sample|Bram Sample/Second.txt'].hash);
  await wipeBrowser(page, srv);
  await page.evaluate(async () => { const h = await (await navigator.storage.getDirectory()).getDirectoryHandle('Short'); window.__gs.folderUse(h); });
  await page.waitForSelector('#askDlg', { timeout: 30000 });
  const said = await page.$eval('#askText', e => e.textContent);
  assert.match(said, /couldn’t come back/); assert.match(said, /River essay/); assert.match(said, /drop the same download in again/);
  await answerDlg(page);
  await folderWait(page);
  assert.equal((await folderInfo(page)).state, 'ok', 'the rest of the folder is fine');
  assert.deepEqual(await rosterOf(page, '12EL-1'), ['Aria Testwell', 'Bram Sample'], 'rosters came back');
  await page.waitForFunction(() => document.querySelector('#kept .krow'));
  assert.match(await page.$eval('#kept .krow', e => e.textContent), /papers not kept, drop the download again/);
  assert.deepEqual(await addedKeys(page), [id + '|Aria Testwell|Aria Testwell/Late.txt'], 'the late file that is there came back');
  // Told once: the next visit doesn't ask again.
  await page.reload(); await appReady(page); await settled(page);
  assert.equal(await page.$('#askDlg'), null);
  // The same download dropped in again: papers and marks together, and the folder is whole again on the next sync.
  await openZip(page, zip, 'River essay.zip');
  assert.equal(await commentOf(page, 'Aria Testwell'), 'Still here');
  await settle(page); await folderWait(page);
  await page.evaluate(() => window.__gs.folderReconcile()); await settled(page);
  assert.equal((await bytesOf(page, id)).missing, 0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('opening a download doesn’t take off a late file another browser has just put in the folder', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'Opening');
  const id = await idOf(page);
  await addLate(page, 0, 'Late.txt');
  await folderWait(page);
  await closeUp(page);
  const key = id + '|Aria Testwell|Aria Testwell/Late.txt';
  // This browser hasn't got it, and the folder's work was written by someone else since this tab looked.
  await page.evaluate(async k => {
    const d = await new Promise(res => { const r = indexedDB.open('grading-studio-added'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = d.transaction('files', 'readwrite'); tx.objectStore('files').delete(k); tx.oncomplete = res; }); d.close();
  }, key);
  await folderWrite(page, ['downloads', id, 'work.json'], await folderRead(page, 'downloads', id, 'work.json'));
  await openKept(page, 'River essay');
  await settled(page);
  assert.ok((await folderRead(page, 'downloads', id, 'info.json')).added['Aria Testwell|Aria Testwell/Late.txt'], 'still in the folder');
  assert.deepEqual(await addedKeys(page), [key], 'and now here too');
  assert.deepEqual(page.errors, []);
  await close();
});

// Two browsers on one folder, both changing Dov, with a Word edit on either side or both. The other browser's edit is really made in this one, which then goes back to how it was.
const DOV = 'Dov Madeup', DOV_DOCX = DOV + '/Essay.docx';
const editText = (page, id) => page.evaluate(async k => {
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
  const rec = await new Promise(res => { const q = db.transaction('edits').objectStore('edits').get(k); q.onsuccess = () => res(q.result); });
  db.close();
  return rec ? new TextDecoder().decode(rec.data) : null;
}, id + '|' + DOV_DOCX);
const folderEditText = (page, id) => page.evaluate(async (id, p) => {
  const root = window.__gs.folderState().root, d = await (await root.getDirectoryHandle('downloads')).getDirectoryHandle(encodeURIComponent(id));
  const r = JSON.parse(await (await (await d.getFileHandle('info.json')).getFile()).text()).edits[p];
  return r ? await (await (await (await root.getDirectoryHandle('files')).getFileHandle(r.data.hash + '.dat')).getFile()).text() : null;
}, id, DOV_DOCX);
for (const [folderHas, hereHas, pick, ends] of [
  ['In Word there', null, 'b', 'In Word there'],
  ['In Word there', null, 'a', 'In Word there'],
  ['In Word there', 'In Word here', 'b', 'In Word there'],
  [null, 'In Word here', 'b', 'In Word here'],
]) test('changed in both places, Word edit ' + (folderHas ? 'in the folder' : '') + (folderHas && hereHas ? ' and ' : '') + (hereHas ? 'in this browser' : '') + ', picking ' + (pick === 'a' ? 'this browser' : 'the folder') + ': the edit isn’t lost', async () => {
  const { page, close } = await openApp(browser);
  const closeNow = async () => { await page.click('#closeBtn'); await page.waitForFunction(() => document.querySelector('#start').hidden === false); };
  const save = async () => { await settle(page); await page.evaluate(() => window.__gs.saveNow()); };
  await openZip(page, zip, 'River essay.zip');
  await linkFolder(page, 'Held' + (folderHas ? 'F' : '') + (hereHas ? 'H' : '') + pick);
  const id = await idOf(page), base = page.url(), dov = await page.evaluate(k => window.__gs.state().batch.students.findIndex(s => s.key === k), DOV);
  await goToStudent(page, dov);
  await page.type('#cmtIn', 'Start'); await save(); await folderWait(page);
  await goToStudent(page, 0); await closeUp(page);   // so each opening lands on a paper that draws
  const old = await page.evaluate(async id => {
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    const w = await new Promise(res => { const q = db.transaction('work').objectStore('work').get(id); q.onsuccess = () => res(q.result); });
    db.close();
    return { w, ls: localStorage.getItem(id) };
  }, id);
  if (folderHas) await putEdit(page, id, DOV_DOCX, folderHas);
  await openKept(page, 'River essay');
  await goToStudent(page, dov);
  await page.type('#cmtIn', ' Folder'); await save(); await folderWait(page);
  await goToStudent(page, 0); await closeUp(page);
  assert.equal(await folderEditText(page, id), folderHas, 'the other browser has left');
  await page.evaluateOnNewDocument(() => { const P = FileSystemDirectoryHandle.prototype; let ok = false; P.queryPermission = async function () { return ok ? 'granted' : 'prompt'; }; P.requestPermission = async function () { ok = true; return 'granted'; }; });
  await page.goto(base + 'blank');
  await page.evaluate(async (id, o) => {
    localStorage.setItem(id, o.ls); localStorage.setItem('gsc.dev', 'dSecondBrowser1');
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction(['work', 'edits'], 'readwrite'); tx.objectStore('work').put(o.w, id); tx.objectStore('edits').clear(); tx.oncomplete = res; }); db.close();
  }, id, old);
  await page.goto(base); await appReady(page);
  if (hereHas) await putEdit(page, id, DOV_DOCX, hereHas);
  await openKept(page, 'River essay');
  await goToStudent(page, dov);
  await page.type('#cmtIn', ' Browser'); await save();
  await goToStudent(page, 0); await save(); await closeNow();
  await page.evaluate(() => { window.__gs.folderResume(true); });
  await page.waitForSelector('#cfBox', { timeout: 30000 });
  const eachKeeps = async why => {
    assert.equal(await folderEditText(page, id), folderHas, 'the folder keeps its own ' + why);
    assert.equal(await editText(page, id), hereHas, 'and so does this browser ' + why);
  };
  await eachKeeps('when she’s asked');
  // Saving someone else while she hasn't decided mustn't touch it either.
  await page.click('[data-cflater]');
  await page.waitForFunction(() => window.__gs.folderState().state === 'decide');
  await openKept(page, 'River essay');
  await goToStudent(page, 0);
  await page.type('#cmtIn', 'Unrelated'); await save(); await folderWait(page);
  await closeUp(page);
  await eachKeeps('after another save');
  await page.evaluate(() => document.querySelector('[data-wact]').click());
  await page.waitForSelector('#cfBox');
  await page.click('.cfside input[value="' + pick + '"]');
  await page.click('[data-cfok]');
  await page.waitForFunction(() => window.__gs.folderState().asks.length === 0 && window.__gs.folderState().state === 'ok', { timeout: 30000 });
  await folderWait(page);
  assert.equal(await editText(page, id), ends, 'in this browser, after she picked');
  assert.equal(await folderEditText(page, id), ends, 'and in the folder');
  await openKept(page, 'River essay');
  const f = await page.evaluate(k => { const f = window.__gs.state().batch.students.find(s => s.key === k).files.find(x => x.name === 'Essay.docx'); return { edited: f.edited, text: new TextDecoder().decode(f.data) }; }, DOV);
  assert.ok(f.edited > 0); assert.equal(f.text, ends, 'the paper opens with it');
  assert.match(await commentOf(page, DOV), pick === 'a' ? /Browser/ : /Folder/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('closing a download while a student is still opening is harmless', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.evaluate(() => { window.__gs.openStudent(3); document.querySelector('#closeBtn').click(); });
  await new Promise(r => setTimeout(r, 500));
  assert.deepEqual(page.errors, []);
  await close();
});
