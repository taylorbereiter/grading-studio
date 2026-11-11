// The safety copy and the saved-data update steps. No real step exists yet, so these plant test steps in the built page,
// the same place a later phase adds a real one, and run them through the real start-up path on old-format work.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const { goTo, builtHtml, openApp, answerDlg, openZip, appReady, plant, waitPaper, pickFile, workOf, idbRead, score, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
const { loadLegacy, noEmpty } = require('./helpers/legacy');
const { openZipBackup, bringIt } = require('./helpers/carry');

let browser, L, RIVER;
before(async () => { browser = await launch(); L = await loadLegacy(); RIVER = L.expected.river.id; });
after(async () => { await browser.close(); });

const withSteps = steps => {
  const html = builtHtml(), mark = 'const MIGRATIONS = [';
  assert.ok(html.includes(mark), 'migrate.js should have its step list');
  return html.replace(mark, () => mark + steps);
};
const OK_STEP = `{ to: 2, name: 'Adds a test field', run: async m => { await m.eachWork(d => { d.v2 = true; }); m.lsSet('gs.fromStep', 'ran'); } },`;
const quick = html => { assert.ok(html.includes('STUCK_MS = 30000')); return html.replace('STUCK_MS = 30000', 'STUCK_MS = 150'); };
const newVersion = html => { assert.match(html, /APP_VERSION = "[^"]+"/); return html.replace(/APP_VERSION = "[^"]+"/, 'APP_VERSION = "99.0.0"'); };
const NEVER = `{ to: 2, name: 'Never finishes', run: async m => { await m.eachWork(d => { d.damage = (d.damage || 0) + 1; }); m.lsSet('gs.tries', (m.lsGet('gs.tries') || 0) + 1); await new Promise(() => {}); } },`;
// Read straight from the database, because the app isn't up while a step is stuck.
const copies = page => page.evaluate(async () => {
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-safety'); r.onsuccess = () => res(r.result); });
  const all = await new Promise(res => { const q = db.transaction('meta').objectStore('meta').getAll(); q.onsuccess = () => res(q.result); });
  db.close(); return all.sort((a, b) => b.t - a.t);
});
const tries = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.tries')));
const noteOf = page => page.$eval('#bootNote', e => e.textContent);
async function putBackRow(page, id) {
  await page.waitForSelector('#safetyList [data-putback="' + id + '"]');
  await goTo(page, '#/settings');
  const nav = page.waitForNavigation({ timeout: 30000 });
  await page.click('#safetyList [data-putback="' + id + '"]');
  await answerDlg(page);
  await nav; await appReady(page);
}
const oldest = async page => { const l = await copies(page); return l[l.length - 1].id; };
const dataOf = page => page.evaluate(id => ({
  v: window.__gs.gsData.version(), raw: localStorage.getItem('gs.dataV'), work: JSON.parse(localStorage.getItem(id) || 'null'), bank: JSON.parse(localStorage.getItem('gs.bank') || 'null'), setup: localStorage.getItem('gs.setup'), fromStep: JSON.parse(localStorage.getItem('gs.fromStep') || 'null'),
}), RIVER);
const snaps = page => page.evaluate(() => window.__gs.gsData.snapshots());
// gsData is there as soon as the page has run its first script, even while the app is waiting on a step.
const safetyData = (page, id) => page.evaluate(async id => {
  const d = await gsData.readCopy(id);
  return { ls: d.ls, stores: Object.fromEntries(Object.entries(d.stores).map(([k, s]) => [k, { k: s.k, work: k.endsWith('/work') ? s.v : undefined }])) };
}, id);
const safetyKeys = page => page.evaluate(async () => {
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-safety'); r.onsuccess = () => res(r.result); });
  if (!db.objectStoreNames.contains('data')) { db.close(); return []; }
  const k = await new Promise(res => { const q = db.transaction('data').objectStore('data').getAllKeys(); q.onsuccess = () => res(q.result); });
  db.close(); return k;
});
// Files as a full year of late work and scans leaves them, made here in the page. Each is filled with its own number, so a mix-up shows.
const plantBig = (page, bid, count, mb) => page.evaluate(async (bid, count, mb) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  for (let i = 0; i < count; i++) await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put({ bid, key: 'Big Kid', path: 'Scan ' + i + '.pdf', data: new Uint8Array(mb * 1e6).fill(i + 1), added: i }, bid + '|Big Kid|Scan ' + i + '.pdf'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  db.close();
}, bid, count, mb);
// For each download with planted files: how many, and how many bytes, counting only files that still have the right bytes all through.
const sumFiles = async () => {
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-added'); r.onsuccess = () => res(r.result); });
  const recs = await new Promise(res => { const out = []; const q = db.transaction('files').objectStore('files').openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return res(out); const v = c.value; if (v.bid.startsWith('gs.b.big')) { const want = +v.path.match(/\d+/)[0] + 1; out.push({ bid: v.bid, n: v.data.length, good: v.data.every(b => b === want) }); } c.continue(); }; });
  db.close();
  const ok = {}, tot = {}; let bytes = 0;
  for (const r of recs) { bytes += r.n; if (r.good) { const t = tot[r.bid] ||= [0, 0]; t[0]++; t[1] += r.n; ok[r.bid] = t[0] + ':' + t[1]; } }
  return { ok, bytes };
};
const dbNames = page => page.evaluate(async () => (await indexedDB.databases()).map(d => d.name).sort());
const idbWork = async page => { const w = await idbRead(page, 'grading-studio-keep', 'work'); return w.v[w.k.indexOf(RIVER)]; };
async function openRiver(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('#kept .krow')].some(r => r.textContent.includes('River essay')));
  await page.evaluate(() => [...document.querySelectorAll('#kept .krow')].find(r => r.textContent.includes('River essay')).querySelector('[data-kopen]').click());
  await waitPaper(page);
  await page.evaluate(() => window.__gs.scanAll());
}
function riverIntact(work) {
  for (const st of L.expected.river.students) {
    assert.deepEqual(work[st.key].grade, st.grade, st.key);
    const { partial, ...computed } = work[st.key].computed;   // the old build had no partial flag
    assert.deepEqual(computed, st.computed, st.key);
    for (const f of st.files) assert.deepEqual(work[st.key].files[f.path].marks, noEmpty(f.marks), f.path);
  }
}

test('with no steps to run, old work isn’t touched and no safety copy is made', async () => {
  const { page, close } = await openApp(browser, { seed: L.seed() });
  const d = await dataOf(page);
  assert.equal(d.v, 1); assert.equal(d.raw, null, 'the version isn’t even written');
  assert.equal(JSON.stringify(d.work), JSON.stringify(JSON.parse(L.ls[RIVER])));
  assert.ok(!(await dbNames(page)).includes('grading-studio-safety'));
  assert.equal(await page.$eval('#bootNote', e => e.hidden), true);
  assert.equal(await page.$eval('#safetyList', e => e.hidden), true);
  await close();
});

test('old work: copied first, then updated in both places, and it still opens', async () => {
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), seed: L.seed() });
  const d = await dataOf(page);
  assert.equal(d.v, 2); assert.equal(d.raw, '2'); assert.equal(d.work.v2, true); assert.equal(d.fromStep, 'ran');
  assert.equal((await idbWork(page)).v2, true);
  const list = await snaps(page);
  assert.equal(list.length, 1); assert.equal(list[0].fromV, 1); assert.equal(list[0].toV, 2);
  assert.ok(Date.now() - list[0].t < 60000);
  const copy = await safetyData(page, list[0].id);
  assert.equal(copy.ls[RIVER], L.ls[RIVER], 'the copy has the work exactly as it was');
  assert.equal(copy.ls['gs.fromStep'], undefined, 'and was made before the step ran');
  assert.equal(copy.stores['grading-studio-keep/work'].work[0].v2, undefined);
  assert.equal(copy.stores['grading-studio-keep/papers'], undefined, 'papers stay out of it');
  assert.equal(copy.stores['grading-studio-added/files'].k.length, 2, 'late files and readings are in it');
  assert.equal(await page.$eval('#safetyList', e => e.hidden), false, 'it’s listed under Backup');
  assert.match(await page.$eval('#safetyList', e => e.textContent), /Safety copy from/);
  assert.equal(await page.$eval('#bootNote', e => e.hidden), true, 'no warning when it went fine');
  await page.reload(); await appReady(page);
  assert.equal((await snaps(page)).length, 1, 'it only happens once');
  await openRiver(page);
  riverIntact(await workOf(page));
  assert.deepEqual(page.errors, []);
  await close();
});

test('steps run in number order, and each only once', async () => {
  const log = `m.lsSet('gs.order', (m.lsGet('gs.order') || []).concat(`;
  const { page, close } = await openApp(browser, { html: withSteps(`{ to: 3, name: 'b', run: async m => { ${log}3)); } }, { to: 2, name: 'a', run: async m => { ${log}2)); } },`), seed: L.seed() });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.order'))), [2, 3]);
  assert.equal((await dataOf(page)).v, 3);
  await close();
  const upTo2 = await openApp(browser, { html: withSteps(`{ to: 3, name: 'b', run: async m => { ${log}3)); } }, { to: 2, name: 'a', run: async m => { ${log}2)); } },`), seed: { ls: { ...L.ls, 'gs.dataV': '2' } } });
  assert.deepEqual(await upTo2.page.evaluate(() => JSON.parse(localStorage.getItem('gs.order'))), [3], 'a browser already at 2 runs only 3');
  await upTo2.close();
});

test('a step that fails: everything goes back as it was, and the app still opens', async () => {
  const steps = OK_STEP + `{ to: 3, name: 'Breaks halfway', run: async m => { await m.eachWork(d => { d.broken = true; d.s = {}; }); m.lsSet('gs.bank', ['junk']); localStorage.removeItem('gs.setup'); throw new Error('boom'); } },`;
  const { page, close } = await openApp(browser, { html: withSteps(steps), seed: L.seed() });
  const d = await dataOf(page);
  assert.equal(d.v, 1, 'still on the old version'); assert.equal(d.raw, null);
  assert.equal(JSON.stringify(d.work), JSON.stringify(JSON.parse(L.ls[RIVER])), 'even the first step is undone');
  assert.deepEqual(d.bank, ['Check your citations.']); assert.equal(d.setup, L.ls['gs.setup']); assert.equal(d.fromStep, null);
  const w = await idbWork(page);
  assert.equal(w.broken, undefined); assert.equal(w.v2, undefined); assert.ok(Object.keys(w.s).length > 0);
  assert.equal(await page.$eval('#bootNote', e => e.hidden), false);
  assert.match(await page.$eval('#bootNote', e => e.textContent), /put back exactly as it was/);
  assert.equal((await snaps(page)).length, 1, 'the safety copy stays');
  await openRiver(page);
  riverIntact(await workOf(page));
  await close();
});

test('a step can’t change the papers', async () => {
  const { page, close } = await openApp(browser, { html: withSteps(`{ to: 2, name: 'Bad', run: async m => { await m.eachRecord('grading-studio-keep', 'papers', p => { p.entries = []; }); } },`), seed: L.seed() });
  assert.equal((await dataOf(page)).v, 1);
  assert.match(await page.$eval('#bootNote', e => e.textContent), /put back/);
  await openRiver(page);
  riverIntact(await workOf(page));
  await close();
});

test('no room for a safety copy: nothing changes, and it says so', async () => {
  const noRoom = page => page.evaluateOnNewDocument(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, ...a) { if (name === 'grading-studio-safety') throw new DOMException('Full', 'QuotaExceededError'); return open.call(this, name, ...a); };
  });
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), seed: L.seed(), beforeLoad: noRoom });
  const d = await dataOf(page);
  assert.equal(d.v, 1); assert.equal(d.fromStep, null, 'the step never ran'); assert.equal(d.work.v2, undefined);
  assert.equal(await page.$eval('#bootNote', e => e.hidden), false);
  assert.match(await page.$eval('#bootNote', e => e.textContent), /doesn’t have room for a safety copy/);
  await openRiver(page);
  riverIntact(await workOf(page));
  await close();
});

test('a safety copy that can’t be made for some other reason doesn’t blame the disk', async () => {
  const broken = page => page.evaluateOnNewDocument(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, ...a) { if (name === 'grading-studio-safety') throw new DOMException('Nope', 'UnknownError'); return open.call(this, name, ...a); };
  });
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), seed: L.seed(), beforeLoad: broken });
  const d = await dataOf(page);
  assert.equal(d.v, 1); assert.equal(d.fromStep, null, 'the step never ran');
  const note = await noteOf(page);
  assert.match(note, /safety copy that comes first couldn’t be made/); assert.doesNotMatch(note, /disk|room/);
  await close();
});

test('really out of room: the browser’s own limit says so, no part of a copy stays behind, and nothing changes', async () => {
  const server = await serve(withSteps(OK_STEP));
  const limit = async page => {   // the limit goes on first, because the browser holds on to what it last knew about the room left
    await page.goto(server.url + 'blank');
    const cdp = await page.createCDPSession();
    await cdp.send('Storage.overrideQuotaForOrigin', { origin: new URL(page.url()).origin, quotaSize: 30e6 });
    await plant(page, L.seed()); await plantBig(page, 'gs.b.bigone', 10, 5);
  };
  const { page, close } = await openApp(browser, { server, beforeLoad: limit });
  const d = await dataOf(page);
  assert.equal(d.v, 1); assert.equal(d.fromStep, null, 'the step never ran'); assert.equal(d.work.v2, undefined);
  assert.match(await noteOf(page), /doesn’t have room for a safety copy/);
  assert.deepEqual(await copies(page), []);
  assert.deepEqual(await safetyKeys(page), [], 'and its slices are gone too');
  await openRiver(page);
  riverIntact(await workOf(page));
  await close(); await server.close();
});

for (const [label, sizes] of [['just over the limit for one record', [[27, 5]]], ['far over it, with a very large file in the mix', [[24, 5], [1, 110]]]]) test('a safety copy ' + label + ' is made, kept and put back byte for byte', async () => {
  const total = sizes.reduce((n, [c, mb]) => n + c * mb, 0);
  assert.ok(total >= 135, 'a browser takes about 130 MB in one record, and this has to be more');
  const big = async page => { for (const [i, [c, mb]] of sizes.entries()) await plantBig(page, 'gs.b.big' + i, c, mb); };
  const fails = `{ to: 2, name: 'Wrecks the files', run: async m => { await m.eachRecord('grading-studio-added', 'files', r => { r.data = new Uint8Array(1); }); throw new Error('boom'); } },`;
  let html = withSteps(fails);
  const server = await serve(() => html), { page, close } = await openApp(browser, { server, seed: L.seed(), beforeLoad: big });
  assert.match(await noteOf(page), /put back exactly as it was/, 'a failed step goes back to the copy');
  assert.equal(await page.evaluate(() => window.__gs.gsData.version()), 1);
  const want = await page.evaluate(sumFiles);
  assert.equal(want.bytes >= total * 1e6, true);
  for (const [i, [c, mb]] of sizes.entries()) assert.equal(want.ok['gs.b.big' + i], c + ':' + c * mb * 1e6, 'every file back, with its bytes');
  html = withSteps(OK_STEP);
  await page.reload(); await appReady(page);
  assert.equal(await page.$eval('#bootNote', e => e.hidden), true, 'no warning');
  const d = await dataOf(page);
  assert.equal(d.v, 2); assert.equal(d.fromStep, 'ran');
  const list = await copies(page);
  assert.equal(list.length, 1); assert.equal(list[0].state, 'done');
  const keys = await safetyKeys(page);
  assert.ok(keys.length > 2, 'it’s in slices');
  await page.evaluate(() => window.__gs.gsData.forget('gs.b.big0'));   // a slice at a time, taking only that download's files
  await putBackRow(page, list[0].id);
  const after = await page.evaluate(sumFiles);
  assert.equal(after.ok['gs.b.big0'], undefined, 'Forget reached every slice');
  if (sizes.length > 1) assert.equal(after.ok['gs.b.big1'], want.ok['gs.b.big1'], 'and left the other download alone');
  await openRiver(page);
  riverIntact(await workOf(page));
  assert.deepEqual(page.errors, []);
  await close(); await server.close();
});

test('a brand-new browser: no safety copy of nothing, and no warning', async () => {
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), newTeacher: true });
  assert.equal((await dataOf(page)).v, 2);
  assert.deepEqual(await snaps(page), []);
  assert.equal(await page.$eval('#bootNote', e => e.hidden), true);
  await close();
});

test('work saved by a newer copy of the app: no step runs, and it says so', async () => {
  const { page, close } = await openApp(browser, { seed: { ...L.seed(), ls: { ...L.ls, 'gs.dataV': '99' } } });
  assert.equal((await dataOf(page)).v, 99);
  assert.match(await page.$eval('#bootNote', e => e.textContent), /newer copy/);
  assert.deepEqual(await snaps(page), []);
  await close();
});

test('Put back returns the work as it was, then the update runs again', async () => {
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), seed: L.seed() });
  await page.evaluate(async id => {
    localStorage.setItem('gs.bank', JSON.stringify(['Changed later']));
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('work', 'readwrite'); tx.objectStore('work').delete(id); tx.oncomplete = res; });
    db.close();
  }, RIVER);
  await page.waitForSelector('#safetyList [data-putback]');
  await goTo(page, '#/settings');
  const nav = page.waitForNavigation({ timeout: 30000 });
  await page.click('#safetyList [data-putback]');
  await answerDlg(page);
  await nav; await appReady(page);
  assert.match(page.lastDialog, /Put back this safety copy/);
  const d = await dataOf(page);
  assert.deepEqual(d.bank, ['Check your citations.'], 'the change since then is gone');
  assert.equal(d.v, 2, 'the update ran again on what came back'); assert.equal(d.work.v2, true);
  assert.equal((await idbWork(page)).v2, true, 'the deleted record came back');
  const list = await snaps(page);
  assert.equal(list.length, 3, 'the first copy, one from before putting back, and one from the new update');
  assert.ok(list.some(s => /Before putting back/.test(s.why)));
  const rows = await page.$eval('#safetyList', e => e.textContent);
  assert.match(rows, /Before updating how your work is saved/); assert.match(rows, /Before putting back an earlier safety copy/);
  assert.match(rows, /:\d\d:\d\d/, 'down to the second, so copies made close together can be told apart');
  const undo = await safetyData(page, list.find(s => /Before putting back/.test(s.why)).id);
  assert.deepEqual(JSON.parse(undo.ls['gs.bank']), ['Changed later'], 'so a wrong click can be undone too');
  await openRiver(page);
  riverIntact(await workOf(page));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a tab closed halfway through an update: it runs again next time, and work is intact', async () => {
  const steps = `{ to: 2, name: 'Slow', run: async m => { await m.eachWork(d => { d.v2 = true; }); m.lsSet('gs.runs', (m.lsGet('gs.runs') || 0) + 1); await new Promise(r => setTimeout(r, 5000)); } },`;
  const { page, close } = await openApp(browser, { html: withSteps(steps), seed: L.seed(), noWait: true });
  await page.waitForFunction(() => localStorage.getItem('gs.runs'), { polling: 50 });
  assert.equal(await page.$eval('#bootNote', e => e.textContent), 'Updating how your work is saved. One moment…');
  await page.reload();   // the version was never raised, so the step starts over; the app stays waiting for it, and then opens
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gs.runs')) === 2, { polling: 50 });
  await appReady(page);
  assert.equal((await dataOf(page)).v, 2);
  await openRiver(page);
  riverIntact(await workOf(page));
  await close();
});

test('only the last three safety copies are kept', async () => {
  const { page, close } = await openApp(browser, { seed: L.seed() });
  for (let i = 0; i < 5; i++) { await page.evaluate(i => window.__gs.gsData.snapshot('Test ' + i, 1), i); await new Promise(r => setTimeout(r, 5)); }
  const list = await snaps(page);
  assert.deepEqual(list.map(s => s.why), ['Test 4', 'Test 3', 'Test 2']);
  const keys = await safetyKeys(page), have = list.map(s => s.id);
  assert.deepEqual(keys.filter(k => !have.includes(k.split('|')[0])), [], 'the older copies’ data goes too, every slice of it');
  await close();
});

test('restoring an old backup into an updated browser updates what it brought in', async () => {
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), newTeacher: true });
  assert.equal((await dataOf(page)).v, 2);
  await page.click('#welcome [data-wlbring]');   // a new browser opens on the welcome; this is its way to work from another computer
  await openZipBackup(page, L.zip());
  await bringIt(page);
  const d = await dataOf(page);
  assert.equal(d.v, 2); assert.equal(d.raw, '2');
  assert.equal((await idbWork(page)).v2, true, 'the old work got the update');
  assert.deepEqual((await snaps(page)).map(s => s.why).sort(), ['Before bringing work in', 'Before updating how your work is saved']);
  await openRiver(page);
  riverIntact(await workOf(page));
  await close();
});

test('two tabs starting together run the update once', async () => {
  const steps = `{ to: 2, name: 'Counts', run: async m => { m.lsSet('gs.count', (m.lsGet('gs.count') || 0) + 1); await new Promise(r => setTimeout(r, 300)); } },`;
  const server = await serve(withSteps(steps)), ctx = await browser.createBrowserContext(), tab1 = await ctx.newPage(), tab2 = await ctx.newPage();
  await tab1.goto(server.url + 'blank'); await plant(tab1, L.seed());
  await Promise.all([tab1.goto(server.url), tab2.goto(server.url)]);
  await appReady(tab1); await appReady(tab2);
  assert.equal(await tab1.evaluate(() => JSON.parse(localStorage.getItem('gs.count'))), 1);
  assert.equal(await tab1.evaluate(() => window.__gs.gsData.version()), 2);
  assert.equal((await snaps(tab1)).length, 1);
  await ctx.close(); await server.close();
});

test('a tab closed again and again keeps the one clean copy, and a failure then goes back to it', async () => {
  let html = withSteps(NEVER);
  const server = await serve(() => html), { page, close } = await openApp(browser, { server, seed: L.seed(), noWait: true });
  for (let n = 1; n <= 4; n++) {
    await page.waitForFunction(n => JSON.parse(localStorage.getItem('gs.tries')) === n, { polling: 50 }, n);
    if (n < 4) await page.reload();
  }
  const list = await copies(page);
  assert.equal(list.length, 1, 'half-changed work isn’t copied over and over');
  assert.equal(list[0].state, 'running');
  const copy = await safetyData(page, list[0].id);
  assert.equal(copy.ls[RIVER], L.ls[RIVER], 'it’s the work from before the update');
  assert.equal(copy.ls['gs.tries'], undefined);
  assert.equal(copy.stores['grading-studio-keep/work'].work[0].damage, undefined);
  html = withSteps(`{ to: 2, name: 'Fails', run: async () => { throw new Error('boom'); } },`);
  await page.reload(); await appReady(page);
  const d = await dataOf(page);
  assert.equal(JSON.stringify(d.work), JSON.stringify(JSON.parse(L.ls[RIVER])), 'back to before the first try, not the last');
  assert.equal(await tries(page), null);
  assert.equal((await idbWork(page)).damage, undefined);
  assert.equal((await copies(page))[0].state, 'failed');
  await close(); await server.close();
});

test('an update that finished, but wasn’t marked finished, isn’t mistaken for a cut-short one later', async () => {
  let html = withSteps(OK_STEP);
  const server = await serve(() => html), { page, close } = await openApp(browser, { server, seed: L.seed() });
  await page.evaluate(async () => {
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-safety'); r.onsuccess = () => res(r.result); });
    const all = await new Promise(res => { const q = db.transaction('meta').objectStore('meta').getAll(); q.onsuccess = () => res(q.result); });
    await new Promise(res => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ ...all[0], state: 'running' }, all[0].id); tx.oncomplete = res; });
    db.close();
    localStorage.setItem('gs.bank', JSON.stringify(['Written since']));
  });
  html = withSteps(OK_STEP + `{ to: 3, name: 'Fails', run: async () => { throw new Error('boom'); } },`);
  await page.reload(); await appReady(page);
  const d = await dataOf(page);
  assert.equal(d.v, 2); assert.deepEqual(d.bank, ['Written since'], 'what she wrote since isn’t rolled back');
  await close(); await server.close();
});

test('a copy from a cut-short update isn’t reused once she has worked since', async () => {
  let html = withSteps(NEVER);
  const server = await serve(() => html), { page, close } = await openApp(browser, { server, seed: L.seed(), noWait: true });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gs.tries')) === 1, { polling: 50 });
  const stale = (await copies(page))[0].id;
  html = withSteps('');   // the step is taken out again, and she carries on grading
  await page.reload(); await appReady(page);
  await page.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['Written since'])));
  html = withSteps(`{ to: 2, name: 'Fails', run: async () => { throw new Error('boom'); } },`);
  await page.reload(); await appReady(page);
  const d = await dataOf(page);
  assert.deepEqual(d.bank, ['Written since'], 'what she wrote since isn’t rolled back');
  const list = await copies(page);
  assert.notEqual(list[0].id, stale, 'a fresh copy was made');
  assert.equal((await safetyData(page, list[0].id)).ls['gs.bank'], JSON.stringify(['Written since']));
  assert.equal(await page.evaluate(() => localStorage.getItem('gsm.try')), null);
  await close(); await server.close();
});

test('a step can’t change a store the safety copy doesn’t hold', async () => {
  const server = await serve(() => withSteps(`{ to: 2, name: 'Lessons', run: async m => { await m.eachRecord('gs-lessons', 'kv', () => {}); } },`));
  const { page, close } = await openApp(browser, { server, seed: L.seed() });
  assert.equal(await page.evaluate(() => window.__gs.gsData.version()), 1);
  assert.match(await noteOf(page), /put back/);
  await close(); await server.close();
});

test('a step that never finishes: a way out, her work back, and no more waiting on the next load', async () => {
  const stuck = `{ to: 2, name: 'Stuck', run: async m => { await m.eachWork(d => { d.half = true; }); m.lsSet('gs.tries', 1); await new Promise(r => { window.__letGo = r; }); m.lsSet('gs.late', 1); } },`;
  let html = quick(withSteps(stuck));
  const server = await serve(() => html), { page, close } = await openApp(browser, { server, seed: L.seed(), noWait: true });
  await page.waitForSelector('#bootStop', { timeout: 30000 });
  assert.match(await noteOf(page), /taking longer than it should/);
  assert.equal(await tries(page), 1); assert.equal(await page.evaluate(() => !!window.__gs), false, 'the app is still waiting');
  await page.click('#bootStop');
  await appReady(page);
  assert.match(await noteOf(page), /You stopped an update.*put back exactly as it was/);
  assert.equal(await page.$('#bootStop'), null);
  const d = await dataOf(page);
  assert.equal(d.v, 1); assert.equal(d.raw, null); assert.equal(JSON.stringify(d.work), JSON.stringify(JSON.parse(L.ls[RIVER])));
  assert.equal(await tries(page), null); assert.equal((await idbWork(page)).half, undefined);
  await page.evaluate(() => window.__letGo());   // it wakes up later, and can't change anything any more
  await new Promise(r => setTimeout(r, 100));
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.late')), null);
  await openRiver(page);
  riverIntact(await workOf(page));
  assert.deepEqual(page.errors, []);
  await page.reload(); await appReady(page);
  assert.match(await noteOf(page), /on hold/); assert.equal(await tries(page), null, 'the same copy of the app doesn’t try again');
  assert.equal((await copies(page)).length, 1); assert.equal((await copies(page))[0].state, 'stopped');
  html = newVersion(html);
  await page.reload();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gs.tries')) === 1 && window.__letGo, { polling: 50 });
  await page.evaluate(() => window.__letGo());
  await appReady(page);
  assert.equal((await dataOf(page)).v, 2, 'a new version tries again');
  assert.deepEqual((await copies(page)).map(c => c.state), ['done'], 'in place of the stopped try’s copy');
  await close(); await server.close();
});

test('a second tab waiting on a stuck one says so, and carries on when that tab closes', async () => {
  const server = await serve(quick(withSteps(NEVER))), ctx = await browser.createBrowserContext(), tab1 = await ctx.newPage(), tab2 = await ctx.newPage();
  await tab1.goto(server.url + 'blank'); await plant(tab1, L.seed());
  await tab1.goto(server.url);
  await tab1.waitForSelector('#bootStop', { timeout: 30000 });
  await tab2.goto(server.url);
  await tab2.waitForFunction(() => /Another Grading Studio tab/.test(document.querySelector('#bootNote').textContent), { polling: 50, timeout: 30000 });
  assert.equal(await tab2.$('#bootStop'), null, 'the way out is in the tab that’s stuck');
  await tab1.close();
  await tab2.waitForSelector('#bootStop', { timeout: 30000 });
  await ctx.close(); await server.close();
});

test('a step that fails on every load uses one safety copy, and keeps what she did between loads', async () => {
  const steps = `{ to: 2, name: 'Fails', run: async m => { await m.eachWork(d => { d.broken = true; }); throw new Error('boom'); } },`;
  const { page, close } = await openApp(browser, { html: withSteps(steps), seed: L.seed() });
  const first = (await copies(page))[0].id;
  for (const w of ['Good state A', 'Good state B']) { await page.evaluate(w => window.__gs.gsData.snapshot(w, 1), w); await new Promise(r => setTimeout(r, 5)); }
  await page.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['Written since'])));
  for (let i = 0; i < 3; i++) { await page.reload(); await appReady(page); }
  const list = await copies(page);
  assert.equal(list.length, 3);
  assert.deepEqual(list.filter(c => c.state !== 'failed').map(c => c.why).sort(), ['Good state A', 'Good state B'], 'copies from good states stay');
  const failed = list.filter(c => c.state === 'failed');
  assert.equal(failed.length, 1); assert.notEqual(failed[0].id, first);
  assert.deepEqual(JSON.parse((await safetyData(page, failed[0].id)).ls['gs.bank']), ['Written since']);
  assert.deepEqual((await dataOf(page)).bank, ['Written since'], 'going back doesn’t lose it');
  assert.match(await page.$eval('#safetyList', e => e.textContent), /Before updating how your work is saved, which didn’t finish/);
  await close();
});

test('Forget takes a download out of every safety copy, and Put back can’t bring it back', async () => {
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), seed: L.seed() });
  await page.waitForFunction(() => window.__gs.kept().size === 2);
  const QUIZ = L.expected.quiz.id;
  await page.evaluate(() => window.__gs.gsData.snapshot('A second copy', 2));
  await page.evaluate(id => window.__gs.forgetKept(id), RIVER);
  for (const c of await copies(page)) {
    const d = await page.evaluate(async id => { const x = await gsData.readCopy(id); return { ls: x.ls, keys: Object.fromEntries(Object.entries(x.stores).map(([k, s]) => [k, s.k])) }; }, c.id);
    assert.equal(Object.keys(d.ls).filter(k => k.includes(RIVER)).length, 0, c.why);
    assert.equal(JSON.parse(d.ls['gs.batches'])[RIVER], undefined);
    for (const [where, keys] of Object.entries(d.keys)) assert.deepEqual(keys.filter(k => String(k).startsWith(RIVER)), [], c.why + ': ' + where);
    assert.ok(d.keys['grading-studio-keep/work'].includes(QUIZ), 'the other download stays');
  }
  await putBackRow(page, await oldest(page));
  await page.waitForFunction(() => window.__gs.kept().size === 1);
  assert.doesNotMatch(await page.$eval('#kept', e => e.textContent), /River essay/);
  assert.match(await page.$eval('#kept', e => e.textContent), /Quiz/);
  assert.equal(await page.evaluate(id => localStorage.getItem(id), RIVER), null);
  assert.ok(!(await idbRead(page, 'grading-studio-keep', 'work')).k.includes(RIVER));
  assert.ok(!(await idbRead(page, 'grading-studio-added', 'files')).k.some(k => k.startsWith(RIVER)), 'late files and readings too');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Put back: a download opened since stays listed with no marks, Forget still reaches it, and it can be undone', async () => {
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), seed: L.seed() });
  await page.waitForFunction(() => window.__gs.kept().size === 2);
  const firstCopy = await oldest(page), paper = await makePaper({ title: 'Hana Pretend test' });
  await openZip(page, zipOf({ 'Hana Pretend/Test.pdf': paper, 'Ivo Imaginary/Test.pdf': paper }), 'Unit test.zip');
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await score(page, [3, 3, 3]); await settle(page);
  await page.click('#closeBtn');
  await putBackRow(page, firstCopy);
  await page.waitForFunction(() => window.__gs.kept().size === 3);
  assert.match(await page.$eval('#kept', e => e.textContent), /Unit test.*2 students.*0 scored/s);
  assert.equal(await page.evaluate(id => localStorage.getItem(id), id), null);
  assert.ok(!(await idbRead(page, 'grading-studio-keep', 'work')).k.includes(id), 'the marks went');
  assert.ok((await idbRead(page, 'grading-studio-keep', 'papers')).k.includes(id), 'the papers stayed');
  await putBackRow(page, (await copies(page)).find(c => /Before putting back/.test(c.why)).id);   // a wrong click, undone
  await page.waitForFunction(() => window.__gs.kept().size === 3);
  assert.match(await page.$eval('#kept', e => e.textContent), /Unit test.*2 students.*1 scored/s);
  await page.evaluate(id => [...document.querySelectorAll('[data-kopen]')].find(b => b.dataset.kopen === id).click(), id);
  await waitPaper(page);
  assert.deepEqual((await workOf(page))['Hana Pretend'].grade.rubric, [3, 3, 3]);
  await page.click('#closeBtn');
  await page.evaluate(id => window.__gs.forgetKept(id), id);
  assert.ok(!(await idbRead(page, 'grading-studio-keep', 'papers')).k.includes(id));
  assert.ok(!(await idbRead(page, 'grading-studio-keep', 'meta')).k.includes(id));
  assert.deepEqual(page.errors, []);
  await close();
});

test('Put back of a copy from before the stores existed clears what came later', async () => {
  const { page, close } = await openApp(browser, { html: withSteps(OK_STEP), seed: { ls: { 'gs.bank': JSON.stringify(['Check your citations.']), 'gs.setup': L.ls['gs.setup'] } } });
  const first = await oldest(page);
  assert.deepEqual((await safetyData(page, first)).stores, {}, 'the copy has only localStorage in it');
  await openZip(page, zipOf({ 'Quin Example/Test.pdf': await makePaper(), 'Rae Example/Test.pdf': await makePaper() }), 'Q.zip');
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await score(page, [3, 3, 3]); await settle(page);
  await page.click('#closeBtn');
  await page.evaluate(async id => {
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put({ bid: id, key: 'Quin Example', path: 'Late.txt', data: new Uint8Array(4), added: 5 }, id + '|Quin Example|Late.txt'); tx.oncomplete = res; });
    db.close();
  }, id);
  await putBackRow(page, first);
  await page.waitForFunction(() => window.__gs.kept().size === 1);
  assert.equal(await page.evaluate(id => localStorage.getItem(id), id), null);
  assert.deepEqual((await idbRead(page, 'grading-studio-keep', 'work')).k, [], 'the marks went');
  assert.deepEqual((await idbRead(page, 'grading-studio-added', 'files')).k, [], 'and so did the late file');
  assert.match(await page.$eval('#kept', e => e.textContent), /0 scored/);
  assert.deepEqual(page.errors, []);
  await close();
});
