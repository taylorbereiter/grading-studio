// Units on the class page of the new app (stage 4, part c): + Unit, Rename, an assignment moved with Move to…, and a unit deleted
// at once and brought back with Undo, each one undo step; the current app reads the same library. npm run next:browser. Made-up classes only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { makePaper } = require('../../../test/helpers/fixtures.js');
const { plantPlan } = require('./planseed.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20' }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
const libOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
const units = l => l.classes[0].units.map(u => ({ name: u.name, items: u.items.map(i => i.id) }));
const undoToast = p => p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => /Undo/.test(b.textContent)).click());
const pickItem = async (p, trigger, re) => {
  await p.click(trigger);
  await p.waitForFunction(re => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => new RegExp(re).test(e.textContent)), {}, re);
  await p.evaluate(re => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => new RegExp(re).test(e.textContent)).click(), re);
};

test('units on the class page: added, renamed, an assignment moved into one, and the unit deleted and brought back with Undo; the current app reads the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  const start = units(await libOf(p));

  // + Unit: named and added at the end
  await p.click('[data-addunit]');
  await p.waitForSelector('dialog[open] input[data-uname]');
  await p.$eval('dialog[open] input[data-uname]', e => e.select());
  await p.type('dialog[open] input[data-uname]', 'Poetry');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.name === 'Poetry'));
  const poetry = (await libOf(p)).classes[0].units.find(u => u.name === 'Poetry').id;
  await p.waitForSelector(`[data-unit="${poetry}"]`);

  // Rename
  await pickItem(p, `[data-umenu="${poetry}"]`, '^Rename');
  await p.waitForSelector('dialog[open] input[data-uname]');
  await p.$eval('dialog[open] input[data-uname]', e => e.select());
  await p.type('dialog[open] input[data-uname]', 'Poems');
  await p.click('dialog[open] [data-uok]');
  await p.waitForFunction(id => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.find(u => u.id === id).name === 'Poems', {}, poetry);

  // Move to… the Speech card into Poems
  await pickItem(p, '[data-more-for="i9"]', '^Move to');
  await p.waitForSelector(`dialog[open] [data-moveto="${poetry}"]`);
  await p.click(`dialog[open] [data-moveto="${poetry}"]`);
  await p.waitForFunction(id => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.find(u => u.id === id).items.some(i => i.id === 'i9'), {}, poetry);
  await p.waitForSelector(`[data-unit="${poetry}"] [data-item="i9"]`);
  const moved = units(await libOf(p));

  // Delete unit: asked first since it has an assignment, and Undo brings it back with it
  await pickItem(p, `[data-umenu="${poetry}"]`, '^Delete unit');
  // it holds an assignment, so it asks first (B-010)
  await p.waitForSelector('dialog[open] [data-udel-ok]'); await p.click('dialog[open] [data-udel-ok]');
  await p.waitForFunction(id => !JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.id === id), {}, poetry);
  await p.waitForFunction(id => !document.querySelector(`[data-unit="${id}"]`), {}, poetry);
  await undoToast(p);
  await p.waitForFunction(id => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.id === id), {}, poetry);
  assert.deepEqual(units(await libOf(p)), moved, 'Undo put the unit back, its assignment too');
  await p.waitForSelector(`[data-unit="${poetry}"] [data-item="i9"]`);
  assert.equal(start.length + 1, moved.length);
  await p.close();

  // the current app's class page shows the same units
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  assert.deepEqual(await m.evaluate(() => window.__gs.state().lib.classes[0].units.map(u => ({ name: u.name, items: u.items.map(i => i.id) }))), moved);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('an assignment row: early returns shown on the row, and its details say how many are scored, partial, missing and returned early', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const seed = withCard(), meta = seed.idb['grading-studio-keep'].stores.meta, n2 = meta.find(([id]) => id === 'gs.b.n2')[1];
  Object.assign(n2, { n: 6, scored: 3, partial: 1, off: 1, sent: 2, sentT: Date.parse('2026-10-24T09:00') });
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-item="i5"] [data-wearly]', { timeout: 60000 });
  assert.equal(await p.$eval('[data-item="i5"] [data-wearly]', e => e.textContent), 'Returned 2/5');
  assert.equal(await p.$('[data-wdet="i5"]'), null, 'details start closed');
  await p.click('[data-wmore="i5"]');
  await p.waitForSelector('[data-wdet="i5"]');
  assert.equal(await p.$eval('[data-wmore="i5"]', e => e.getAttribute('aria-expanded')), 'true');
  assert.equal(await p.$eval('[data-wdet="i5"] [data-wsay]', e => e.textContent), '3 of 5 scored · 1 partial · 1 missing or excused');
  const more = await p.$eval('[data-wdet="i5"]', e => e.textContent);
  assert.match(more, /2 students got theirs early/);
  assert.match(more, /aren’t kept in this browser/, 'no papers here, so no ways to the marking steps');
  assert.equal(await p.$('[data-wdet="i5"] [data-wgo]'), null);
  // an assignment with no papers yet says so; the details close again
  await p.click('[data-wmore="i9"]');
  await p.waitForSelector('[data-wdet="i9"]');
  assert.match(await p.$eval('[data-wdet="i9"]', e => e.textContent), /No papers yet/);
  await p.click('[data-wmore="i5"]');
  await p.waitForFunction(() => !document.querySelector('[data-wdet="i5"]'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Files to match to a roster: outside files matched to the class names, one fixed by hand, opened as the assignment\'s papers for that class', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-match-'));
  const files = [['Aria Testwell speech.pdf', 'Aria'], ['Cleo notes.pdf', 'Cleo'], ['untitled.pdf', 'Who']].map(([n, title]) => { const f = path.join(dir, n); return f; });
  for (const f of files) fs.writeFileSync(f, await makePaper({ title: path.basename(f) }));
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => /match to a roster/.test(e.textContent)));
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /match to a roster/.test(e.textContent)).click());
  // D-002: files or a whole folder first, with what it's for
  await p.waitForSelector('dialog[open] [data-fof="match"]', { timeout: 30000 });
  const [ch] = await Promise.all([p.waitForFileChooser(), p.click('dialog[open] [data-pf]')]);
  await ch.accept(files);
  await p.waitForSelector('[data-mr]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-mrcls]', e => e.value), 'c1');
  const tags = await p.$$eval('[data-mrrow]', rs => rs.map(r => [r.querySelector('.bf-path').textContent, r.querySelector('select').value, r.lastElementChild.textContent]));
  assert.deepEqual(tags, [['Aria Testwell speech.pdf', '0', 'Matched by name'], ['Cleo notes.pdf', '2', 'Check'], ['untitled.pdf', '-1', 'Choose']]);
  assert.match(await p.$eval('[data-mrmissing]', e => e.textContent), /No file yet: Bram Sample, Dov Madeup, Esme Placeholder, Finn Example/);
  await p.select('[data-mrto="2"]', '5');
  assert.equal(await p.$eval('[data-mrgo]', e => e.textContent), 'Open 3 files for 3 students');
  await p.click('[data-mrgo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  const got = await p.evaluate(() => { const b = window.__mark.state().batch; return { cls: b.classId, have: b.students.filter(s => s.files.length).map(s => [s.key, s.files.map(f => f.name)]) }; });
  assert.equal(got.cls, 'c1');
  assert.deepEqual(got.have.sort(), [['Aria Testwell', ['Aria Testwell speech.pdf']], ['Cleo Fixture', ['Cleo notes.pdf']], ['Finn Example', ['untitled.pdf']]]);
  assert.equal((await libOf(p)).classes[0].units[0].items.find(i => i.id === 'i9').batchId != null, true, 'the card is linked to the papers');
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

// New assignment and Edit assignment (src/app/screens.js editAssignment): made in two linked classes at once, changed, shown on the
// week reached from Home and in the Gradebook, deleted and brought back with Undo; the current app reads the same cards.
const linkedSeed = () => { const seed = withCard(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].course = 'English'; lib.classes[1].course = 'English'; seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
const setDate = (p, sel, v) => p.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
// a card as the teacher made it: without the sync stamps (v, at, fv) a save puts on
const cards = (l, name) => [...l.classes, l.loose].flatMap(c => c.units.flatMap(u => u.items.filter(i => i.name === name).map(({ v, at, fv, ...i }) => ({ ...i, unit: u.name, in: c.id }))));
test('New assignment in two linked classes, edited, on the week and in the Gradebook, deleted and brought back; the current app reads them', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, linkedSeed());
  await plantPlan(p);
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-newasg]', { timeout: 60000 });
  // every unit has its own + Assignment at its end
  assert.deepEqual(await p.$$eval('[data-additem]', b => b.map(x => x.dataset.additem)), ['u1', 'u2']);

  await p.click('[data-newasg]');
  await p.waitForSelector('dialog[open] [data-asg-dlg]');
  assert.deepEqual(await p.$$eval('[data-asg-cls]', s => s.map(x => [x.dataset.asgCls, x.querySelector('input').checked])), [['c1', true], ['c2', true], ['', false]], 'the linked class is ticked');
  assert.match(await p.$eval('dialog[open]', d => d.textContent), /Linked classes are ticked/);
  await p.type('dialog[open] input[data-asg-name]', 'Book talk');
  await p.select('dialog[open] select[data-asg-unit]', 'Unit 2: Poetry');
  assert.match(await p.$eval('[data-asg-made]', e => e.textContent), /Grade 10 Literature has no unit called “Unit 2: Poetry” yet/);
  await p.click('dialog[open] .seg [data-v="sum"]');
  await setDate(p, 'dialog[open] input[data-asg-due]', '2026-10-29');
  assert.equal(await p.$eval('[data-asg-ok]', b => b.textContent), 'Add to 2 classes');
  await p.click('[data-asg-ok]');
  await p.waitForFunction(() => /Book talk/.test(localStorage.getItem('gs.lib')));
  let made = cards(await libOf(p), 'Book talk');
  assert.deepEqual(made.map(x => [x.in, x.classId, x.unit, x.type, x.due]), [['c1', 'c1', 'Unit 2: Poetry', 'sum', '2026-10-29'], ['c2', 'c2', 'Unit 2: Poetry', 'sum', '2026-10-29']]);
  assert.ok(made[0].group && made[0].group === made[1].group && made[0].id !== made[1].id, 'the copies share a group, each its own card');
  const id = made[0].id, twin = made[1].id;
  await p.waitForSelector(`[data-unit="u2"] [data-item="${id}"]`);

  // Edit assignment…: name, type and date, the copy too; the card keeps its id
  await pickItem(p, `[data-more-for="${id}"]`, '^Edit assignment');
  await p.waitForSelector('dialog[open] [data-asg-dlg]');
  assert.equal(await p.$eval('dialog[open] select[data-asg-class]', s => s.value), 'c1');
  await p.$eval('dialog[open] input[data-asg-name]', e => e.select());
  await p.type('dialog[open] input[data-asg-name]', 'Book talk 2');
  await p.click('dialog[open] .seg [data-v="ic"]');
  await setDate(p, 'dialog[open] input[data-asg-due]', '2026-10-29');
  await p.click('[data-asg-ok]');
  await p.waitForFunction(() => /Book talk 2/.test(localStorage.getItem('gs.lib')));
  made = cards(await libOf(p), 'Book talk 2');
  assert.deepEqual(made.map(x => [x.id, x.type, x.due]), [[id, 'ic', '2026-10-29'], [twin, 'ic', '2026-10-29']]);

  // Home: This week shows it due on Thursday
  await p.goto(srv.url + 'next/#/');
  await p.waitForSelector('a[href="#/calendar"]', { timeout: 30000 });
  await p.click('a[href="#/calendar"]');
  await p.waitForFunction(() => [...document.querySelectorAll('.due')].some(e => /Book talk 2/.test(e.textContent)), { timeout: 30000, polling: 200 });

  // No papers: just type the scores: its own column in the Gradebook, typed into
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector(`[data-bring-for="${id}"]`, { timeout: 30000 });
  await pickItem(p, `[data-bring-for="${id}"]`, 'just type the scores');
  await p.waitForSelector('[data-add] [data-add-v]', { timeout: 30000 });
  assert.equal(await p.evaluate(() => location.hash), '#/class/c1/grades');
  await p.type('[data-add] [data-add-v]', '85');
  await p.click('[data-add-save]');
  await p.waitForSelector(`th[data-col="${id}"]`, { timeout: 30000 });

  // Delete, at once after the question, and Undo brings the card back with its id and scores
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector(`[data-item="${id}"]`, { timeout: 30000 });
  const before = cards(await libOf(p), 'Book talk 2').find(x => x.id === id);
  assert.ok(before.typed, 'the typed score is on the card');
  await pickItem(p, `[data-more-for="${id}"]`, '^Edit assignment');
  await p.waitForSelector('dialog[open] [data-asg-del]');
  await p.click('dialog[open] [data-asg-del]');
  await p.waitForSelector('dialog[open] [data-asg-delok]');
  await p.click('dialog[open] [data-asg-delok]');
  const gone = id => p.waitForFunction(id => !JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.items.some(i => i.id === id)), {}, id);
  await gone(id);
  assert.equal(cards(await libOf(p), 'Book talk 2').length, 1, 'the copy in the linked class stays');
  await undoToast(p);
  await p.waitForFunction(id => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.items.some(i => i.id === id)), {}, id);
  assert.deepEqual(cards(await libOf(p), 'Book talk 2').find(x => x.id === id), before);
  await p.waitForSelector(`[data-item="${id}"]`);
  const lib = await libOf(p);
  await p.close();

  // the current app reads both cards as they are
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  assert.deepEqual(cards(await m.evaluate(() => window.__gs.state().lib), 'Book talk 2'), cards(lib, 'Book talk 2'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Find's New assignment: #/class/<id>/work/new opens the box on that class's tab
test('Find: New assignment opens the box, with the class ticked and its first unit', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.goto(srv.url + 'next/#/class/c1/work/new');
  await p.waitForSelector('dialog[open] [data-asg-dlg]', { timeout: 60000 });
  await p.waitForFunction(() => location.hash === '#/class/c1/work');
  assert.deepEqual(await p.$$eval('[data-asg-cls]', s => s.map(x => [x.dataset.asgCls, x.querySelector('input').checked])), [['c1', true], ['c2', false], ['', false]]);
  await p.type('dialog[open] input[data-asg-name]', 'Exit ticket');
  assert.equal(await p.$eval('[data-asg-ok]', b => b.textContent), 'Save');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => /Exit ticket/.test(localStorage.getItem('gs.lib')));
  assert.deepEqual(cards(await libOf(p), 'Exit ticket').map(x => [x.in, x.unit, x.type, x.due, x.group]), [['c1', 'Unit 1: Stories', undefined, undefined, undefined]]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// No papers: a notes page for every student, opened for marking; then Forget these papers, asked first.
test('No papers: presentations or videos makes a notes page for each student; Forget these papers lets the download go', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await pickItem(p, '[data-bring-for="i9"]', 'presentations or videos');
  await p.waitForSelector('dialog[open] [data-sngo]:not([disabled])', { timeout: 30000 });
  assert.match(await p.$eval('dialog[open]', d => d.textContent), /Each of the 6 students in Grade 9 English/);
  await p.click('dialog[open] [data-np="cols"]');
  await p.click('dialog[open] [data-sngo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  const got = await p.evaluate(() => window.__mark.state().batch.students.map(s => [s.key, s.files.map(f => f.name)]));
  assert.equal(got.length, 6);
  assert.ok(got.every(([, f]) => f.length === 1 && f[0] === 'Speech notes.pdf'), JSON.stringify(got));
  const bid = (await libOf(p)).classes[0].units[0].items.find(i => i.id === 'i9').batchId;
  assert.ok(bid, 'the card is linked to the pages');

  // a safety copy made since (as the current app's are: localStorage, and the stores in slices) holds this download's work
  const safe = (fn, ...a) => p.evaluate(fn, ...a);
  await safe(id => new Promise((res, rej) => { const r = indexedDB.open('grading-studio-safety', 1); r.onupgradeneeded = () => { r.result.createObjectStore('meta'); r.result.createObjectStore('data'); };
    r.onsuccess = () => { const tx = r.result.transaction(['meta', 'data'], 'readwrite'); tx.objectStore('meta').put({ id: 'c1', t: Date.now(), why: 'Before bringing work in', app: 'test', fromV: 1, toV: 1 }, 'c1');
      tx.objectStore('data').put({ ls: { 'gs.batches': JSON.stringify({ [id]: 1, other: 1 }), ['gsc.saved.' + id]: '1' } }, 'c1'); tx.objectStore('data').put({ where: 'grading-studio-keep/work', k: [id, 'other'], v: [{ s: {} }, { s: {} }] }, 'c1|0');
      tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }), bid);

  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-again-for="i9"]', { timeout: 30000 });
  await pickItem(p, '[data-again-for="i9"]', '^Forget these papers');
  await p.waitForSelector('dialog[open] [data-fgok]');
  assert.match(await p.$eval('dialog[open]', d => d.textContent), /To get the papers back, bring the download in again on this card/, 'the box says how to get them back');
  await p.click('dialog[open] [data-fgok]');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 30000 });
  assert.ok(JSON.parse(await p.evaluate(() => localStorage.getItem('gs.tomb')))[bid], 'a tombstone, so a synced copy lets it go too');
  assert.equal(await p.evaluate(id => new Promise(r => { const q = indexedDB.open('grading-studio-keep'); q.onsuccess = () => { const g = q.result.transaction('meta').objectStore('meta').get(id); g.onsuccess = () => r(g.result == null); }; }), bid), true, 'its row is gone from this browser');
  // out of the safety copy too, as the current app does (src/migrate.js gsData.forget): Put back can't bring its work back
  const copy = await safe(() => new Promise(res => { const r = indexedDB.open('grading-studio-safety'); r.onsuccess = () => { const o = r.result.transaction('data').objectStore('data'), a = o.get('c1'), b = o.get('c1|0'); b.onsuccess = () => res({ ls: a.result.ls, k: b.result.k }); }; }));
  assert.deepEqual(copy, { ls: { 'gs.batches': JSON.stringify({ other: 1 }) }, k: ['other'] });

  // brought in again on the card: the same pages, kept and saved at once, and not forgotten any more
  await pickItem(p, '[data-bring-for="i9"]', 'presentations or videos');
  await p.waitForSelector('dialog[open] [data-sngo]:not([disabled])', { timeout: 30000 });
  await p.click('dialog[open] [data-np="cols"]');
  await p.click('dialog[open] [data-sngo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  assert.equal(await p.evaluate(() => window.__mark.state().batch.id), bid, 'the same download');
  await p.waitForFunction(id => !(JSON.parse(localStorage.getItem('gs.tomb') || '{}'))[id], {}, bid);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Order and place: a card up in its unit, a unit up, a unit to another class and back, a unit's plan link, the class down in the
// sidebar, and the class deleted (its cards to No class) and brought back with Undo. Each one undo step.
test('order: cards and units moved, a unit to another class, its plan link; a class moved in the sidebar, deleted and brought back', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-more-for="i9"]', { timeout: 60000 });
  const order = async () => (await libOf(p)).classes.map(c => [c.id, c.units.map(u => [u.id, u.items.map(i => i.id)])]);
  await pickItem(p, '[data-more-for="i4"]', '^Move up');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units[0].items.map(i => i.id).join() === 'i1,i2,i4,i3,i9');
  // dragged: a card onto another card goes before it
  const drag = (from, to) => p.evaluate((from, to) => { const dt = new DataTransfer(), a = document.querySelector(from), b = document.querySelector(to);
    a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); for (const k of ['dragover', 'drop']) b.dispatchEvent(new DragEvent(k, { bubbles: true, cancelable: true, dataTransfer: dt })); }, from, to);
  await drag('[data-item="i9"]', '[data-item="i1"]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units[0].items.map(i => i.id).join() === 'i9,i1,i2,i4,i3');
  await pickItem(p, '[data-umenu="u2"]', '^Move up');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.map(u => u.id).join() === 'u2,u1');
  await pickItem(p, '[data-umenu="u2"]', '^Move to another class');
  await p.waitForSelector('dialog[open] [data-unitto="c2"]');
  await p.click('dialog[open] [data-unitto="c2"]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[1].units.map(u => u.id).join() === 'u2');
  assert.deepEqual((await libOf(p)).classes[1].units[0].items.map(i => i.classId), ['c2', 'c2'], 'its cards take that class');
  await undoToast(p);
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.map(u => u.id).join() === 'u2,u1');
  // the unit's plan link
  await pickItem(p, '[data-umenu="u1"]', '^Link to a unit plan');
  await p.waitForSelector('dialog[open] input[data-ulink]');
  await p.type('dialog[open] input[data-ulink]', 'example.org/units/stories');
  await p.click('dialog[open] [data-ulok]');
  await p.waitForSelector('[data-uatlas="u1"]');
  assert.equal(await p.$eval('[data-uatlas="u1"]', a => a.href), 'https://example.org/units/stories');
  const placed = await order();

  // Edit roster: the class one down in the sidebar, then deleted (its units to No class), and Undo puts it back where it was
  await p.goto(srv.url + 'next/#/class/c1/people');
  await p.waitForSelector('[data-roster-edit]', { timeout: 30000 });
  await p.click('[data-roster-edit]');
  await p.waitForSelector('dialog[open] [data-class-down]');
  assert.equal(await p.$eval('dialog[open] [data-class-up]', b => b.disabled), true, 'the first class goes no higher');
  await p.click('dialog[open] [data-class-down]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes.map(c => c.id).join() === 'c2,c1');
  await p.waitForFunction(() => [...document.querySelectorAll('a[href="#/class/c1"], a[href="#/class/c2"]')].map(x => x.getAttribute('href')).join() === '#/class/c2,#/class/c1');
  await p.waitForFunction(() => document.querySelector('dialog[open] [data-class-down]').disabled);
  await p.waitForSelector('dialog[open] [data-class-del]');
  await p.click('dialog[open] [data-class-del]');
  await p.waitForSelector('dialog[open] [data-class-delok]');
  await p.click('dialog[open] [data-class-delok]');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); return l.classes.length === 1 && l.loose.units.length === 2; });
  assert.ok((await libOf(p)).loose.units.every(u => u.items.every(i => i.classId === '')));
  await p.waitForFunction(() => location.hash === '#/class/-/work');
  await undoToast(p);
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes.map(c => c.id).join() === 'c2,c1');
  const back = await libOf(p);
  assert.deepEqual(back.loose.units, []);
  assert.deepEqual(back.classes.map(c => [c.id, c.units.map(u => [u.id, u.items.map(i => i.id)])]), [placed[1], placed[0]]);
  assert.ok(back.classes[1].units.every(u => u.items.every(i => i.classId === 'c1')));
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Stage 8 slice D: D-002 a whole folder to match (the Mac app's own folder chooser, D-005, stands in for the browser's), B-009 the
// Again menu's scan, match and no papers for an assignment with papers, D-028 Find's "Match files to a roster" with no assignment.
test('Match files (D-002 D-005 D-028 B-009): a whole folder through the Mac app chooser, the Again menu, and Find with no assignment', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const pdfs = await Promise.all(['Aria Testwell', 'Bram Sample'].map(n => makePaper({ title: n })));
  await p.evaluateOnNewDocument(b64s => {
    const bytes = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
    window.gsNative = { pickFolder: async () => ({ name: 'Speeches' }), readFolder: async () => ({ name: 'Speeches', files: [{ rel: 'Aria Testwell/speech.pdf', data: bytes(b64s[0]), mtime: 1 }, { rel: 'Bram Sample/speech.pdf', data: bytes(b64s[1]), mtime: 1 }] }) };
  }, pdfs.map(b => Buffer.from(b).toString('base64')));
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  // D-028: Find's job opens the matcher straight away, with no assignment
  await p.goto(srv.url + 'next/#/class/c1/work/match');
  await p.waitForSelector('dialog[open] [data-fof="match"]', { timeout: 60000 });
  await p.click('dialog[open] [data-pd]');
  await p.waitForSelector('[data-mr]', { timeout: 30000 });
  const tags = await p.$$eval('[data-mrrow]', rs => rs.map(r => [r.querySelector('.bf-path').textContent, r.lastElementChild.textContent]));
  assert.deepEqual(tags, [['Speeches/Aria Testwell/speech.pdf', 'Matched by name'], ['Speeches/Bram Sample/speech.pdf', 'Matched by name']], 'folder names kept, so the names match');
  await p.click('[data-mrgo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  const got = await p.evaluate(() => { const b = window.__mark.state().batch; return { name: b.name, cls: b.classId, have: b.students.filter(s => s.files.length).map(s => s.key).sort() }; });
  assert.equal(got.name, 'Matched files'); assert.equal(got.cls, 'c1'); assert.deepEqual(got.have, ['Aria Testwell', 'Bram Sample']);
  // B-009: an assignment with papers: the Again menu has the scan, the match and no papers, as Open other papers… does
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => /match to a roster/.test(e.textContent)));
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /match to a roster/.test(e.textContent)).click());
  await p.waitForSelector('dialog[open] [data-fof="match"]', { timeout: 30000 });
  await p.click('dialog[open] [data-pd]');
  await p.waitForSelector('[data-mrgo]:not([disabled])', { timeout: 30000 });
  await p.click('[data-mrgo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-again-for="i9"]', { timeout: 60000 });
  await p.click('[data-again-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const items = await p.$$eval('.pop [role="menuitem"]', es => es.map(e => e.textContent));
  for (const want of [/A scan to split/, /match to a roster/, /No papers/]) assert.ok(items.some(x => want.test(x)), String(want));
  assert.deepEqual(errors, []);
  await ctx.close();
});

// D-022: an assignment with no papers starts with Videos and partners (src/video.js openStartNotes): a link for one student, a partner
// picked, their own scores; once the pages open the video is added, the partner gets it and the group is made, as the current app reads.
test('D-022: No papers with a video and a partner: the pages open with the video added and the group made; the current app reads the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await pickItem(p, '[data-bring-for="i9"]', 'presentations or videos');
  await p.waitForSelector('dialog[open] [data-pv] [data-pvlink="0"]', { timeout: 30000 });
  assert.match(await p.$eval('dialog[open]', d => d.textContent), /Videos and partners/);
  const [a, b] = await p.$$eval('[data-pvrow]', rs => rs.slice(0, 2).map(r => r.dataset.pvrow));
  await p.type('[data-pvlink="0"]', 'https://www.youtube.com/watch?v=abcdefghijk');
  await p.click('[data-pvp="0"]');
  await p.waitForSelector(`[data-pvto="${b}"]`);
  await p.click(`[data-pvto="${b}"]`);
  await p.click('[data-pvdone]');
  assert.match(await p.$eval(`[data-pvrow="${b}"]`, e => e.textContent), new RegExp('Same video as: ' + a));
  await p.evaluate(() => [...document.querySelectorAll('dialog[open] [data-pv] .seg button, dialog[open] [data-pv] [role="radio"]')].find(x => /Their own scores/.test(x.textContent)).click());
  await p.click('dialog[open] [data-sngo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.waitForFunction((a, b) => { const g = window.__mark.state().batch.groups || []; return g.length === 1 && g[0].k[0] === a && g[0].k.includes(b) && g[0].own; }, { timeout: 60000 }, a, b);
  const files = await p.evaluate((a, b) => [a, b].map(k => window.__mark.state().batch.students.find(s => s.key === k).files.map(f => f.name).sort()), a, b);
  assert.ok(files[0].includes('Presentation video.url') && files[1].includes('Presentation video.url'), JSON.stringify(files));
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  const made = await p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().batch.groups)));
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.groups || []))), made);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// A rubric brought in from the card (src/rubricup.js): a Word rubric's table read for its rows, a PDF with no table kept as the copy
// to mark on. D-901 B-001: New assignment's Rubric, applied on Save and shared with the group's copies. B-008: Edit assignment's
// Rubric, to the linked copy too. B-004: Bring in my rubric… on the card's Bring in menu, used at once, then the papers open with it.
const { makeDocx } = require('../../../test/helpers/fixtures.js');
const { zipSync, unzipSync, strToU8 } = require('fflate');
const wordRubric = () => {
  const cell = t => '<w:tc><w:p><w:r><w:t>' + t + '</w:t></w:r></w:p></w:tc>', row = r => '<w:tr>' + r.map(cell).join('') + '</w:tr>';
  const tbl = '<w:tbl>' + row(['Criteria', '4', '3', '2', '1']) + row(['Voice', 'Clear and confident', 'Mostly clear', 'Hard to hear', 'Not heard']) + row(['Evidence', 'Strong evidence', 'Some evidence', 'Little evidence', 'None']) + row(['Structure', 'Logical', 'Mostly logical', 'Hard to follow', 'No order']) + '</w:tbl>';
  return zipSync({ ...unzipSync(makeDocx('x')), 'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + tbl + '</w:body></w:document>') });
};
const rubricFile = async (p, file) => { const inp = await p.waitForSelector('dialog[open] input[data-rufile]'); await inp.uploadFile(file); await p.waitForSelector('dialog[open] [data-rugot]', { timeout: 30000 }); };
const waitCards = async (p, name, ok) => { for (let i = 0; i < 150; i++) { const c = cards(await libOf(p), name); if (ok(c)) return c; await new Promise(r => setTimeout(r, 200)); } throw new Error('the cards called ' + name + ' never changed'); };
const ticked = (p, sel) => p.$eval(`dialog[open] ${sel} input`, e => e.checked);

test('D-901 B-001 B-008: New and Edit assignment bring in a rubric: a Word rubric\'s rows and a copy for every student, a PDF as the copy only, to the linked copy too; the current app reads the cards', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-rub-'));
  const docx = path.join(dir, 'Speech rubric.docx'), pdf = path.join(dir, 'Plain rubric.pdf');
  fs.writeFileSync(docx, wordRubric()); fs.writeFileSync(pdf, await makePaper({ title: 'Plain rubric' }));
  await p.goto(srv.url + 'blank'); await plant(p, linkedSeed());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-newasg]', { timeout: 60000 });
  await p.click('[data-newasg]');
  await p.waitForSelector('dialog[open] [data-asg-dlg]');
  await p.type('dialog[open] input[data-asg-name]', 'Book talk');
  assert.match(await p.$eval('dialog[open] [data-rubup]', e => e.textContent), /Not set yet/);
  await rubricFile(p, docx);
  const got = await p.$eval('dialog[open] [data-rugot]', e => e.textContent);
  for (const w of ['Speech rubric.docx', 'Voice', 'Evidence', 'Structure', '4: Clear and confident']) assert.ok(got.includes(w), w + ' in ' + got + errors.join('|'));
  assert.equal(await ticked(p, '[data-rurows]'), true, 'rows found: Score with these rows is ticked');
  assert.equal(await ticked(p, '[data-rucopy]'), false);
  await p.$eval('dialog[open] [data-rucopy] input', e => e.click());
  await p.click('[data-asg-ok]');
  let made = await waitCards(p, 'Book talk', c => c.length === 2 && c.every(i => i.setup && i.setup.rubricPage));
  for (const c of made) {
    assert.equal(c.setup.mode, 'rubric');
    assert.deepEqual(c.setup.criteria, ['Voice', 'Evidence', 'Structure']);
    assert.equal(c.setup.levels[0][4], 'Clear and confident');
    assert.equal(c.setup.rubricPage.name, 'Speech rubric.docx');
    assert.equal(c.setup.rubricPos, 'start', 'a Word rubric sits above their work');
  }
  assert.ok(await p.evaluate(id => !!localStorage.getItem('gs.rp.' + id), made[0].setup.rubricPage.id), 'the copy to mark on is kept');
  const id = made[0].id;
  await p.waitForSelector(`[data-item="${id}"]`);

  // Edit assignment…: what it has now, and a PDF with no table: just the copy, the linked copy too
  await pickItem(p, `[data-more-for="${id}"]`, '^Edit assignment');
  await p.waitForSelector('dialog[open] [data-rubup]');
  assert.match(await p.$eval('dialog[open] [data-rusays]', e => e.textContent), /Rubric rows: Voice · Evidence · Structure.*Speech rubric\.docx/);
  await rubricFile(p, pdf);
  assert.ok(await p.$('dialog[open] [data-runo]'), 'no table: says so');
  assert.equal(await p.$('dialog[open] [data-rurows]'), null);
  assert.equal(await ticked(p, '[data-rucopy]'), true, 'no rows: the copy is ticked');
  assert.equal(await p.$eval('dialog[open] [data-asg-also] input', e => e.checked), true);
  await p.click('[data-asg-ok]');
  made = await waitCards(p, 'Book talk', c => c.every(i => i.setup.rubricPage.name === 'Plain rubric.pdf'));
  for (const c of made) { assert.deepEqual(c.setup.criteria, ['Voice', 'Evidence', 'Structure'], 'the rows stay'); assert.equal(c.setup.rubricPos, 'end'); }
  const lib = await libOf(p);
  await p.close();

  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  assert.deepEqual(cards(await m.evaluate(() => window.__gs.state().lib), 'Book talk'), cards(lib, 'Book talk'));
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('B-004: Bring in my rubric… from the card\'s Bring in menu, used at once; the papers open with its rows and a copy each; the current app opens them the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-rub-'));
  const docx = path.join(dir, 'Speech rubric.docx'); fs.writeFileSync(docx, wordRubric());
  const papers = ['Aria Testwell speech.pdf', 'Bram Sample speech.pdf'].map(n => path.join(dir, n));
  for (const f of papers) fs.writeFileSync(f, await makePaper({ title: path.basename(f) }));
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await pickItem(p, '[data-bring-for="i9"]', 'Bring in my rubric');
  await p.waitForSelector('dialog[open] [data-rubup]', { timeout: 30000 });
  assert.match(await p.$eval('dialog[open]', d => d.textContent), /Rubric for “Speech”/);
  await rubricFile(p, docx);
  await p.$eval('dialog[open] [data-rucopy] input', e => e.click());
  await p.click('dialog[open] [data-ruuse]');
  await p.waitForFunction(() => !document.querySelector('dialog[open] [data-rubup]'));
  const [card] = await waitCards(p, 'Speech', c => c[0] && c[0].setup && c[0].setup.rubricPage);
  assert.deepEqual(card.setup.criteria, ['Voice', 'Evidence', 'Structure']);
  // the papers come in and open with it
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [ch] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await ch.accept(papers);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.waitForFunction(() => { const s = window.__mark.state(); return s.setup.rubricPage && s.batch.students.filter(st => st.files.length).every(st => st.files.some(f => f.virtual)); }, { timeout: 30000 });
  const su = await p.evaluate(() => { const s = window.__mark.state().setup; return { criteria: s.criteria, page: s.rubricPage, pos: s.rubricPos }; });
  assert.deepEqual(su, { criteria: ['Voice', 'Evidence', 'Structure'], page: card.setup.rubricPage, pos: 'start' });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => { const s = window.__gs.state().setup; return { criteria: s.criteria, page: s.rubricPage, pos: s.rubricPos }; }), su);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});
