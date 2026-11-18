// To do in the new app (stage 6): her own lines and the app's, added the way she would say it, ticked, moved, edited at the side
// (moving quickly between boxes loses nothing), by category, the week with a line typed into a day and one dragged to another,
// the kinds the app adds switched off, N from anywhere. The sidebar, Home and To do count the same, and the current app opens the
// same list with the same count. npm run next:browser. Every student and colleague here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { gradingSeed, PLAN_SETUP, STEADY } = require('../../../test/helpers/steady.js');

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

// The made-up work, with three lines of her own (one overdue, one for today naming a colleague, one with no day) and two people on
// the School page. The clock stands at Tuesday 27 October 2026, 10:20.
const PEOPLE = { people: [{ id: 'p1', name: 'Rowan Placeholder', role: 'Principal', email: 'rowan@example.org' }, { id: 'p2', name: 'Sky Standin', role: 'Coordinator', email: '' }] };
function seed() {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']), t0 = Date.parse('2026-10-20T09:00:00Z');
  lib.todo = { items: [
    { id: 'tdA', x: 'Notes from the department meeting', d: '2026-10-26', c: '', who: '', a: '', rep: '', note: '', done: 0, made: t0, t: t0 },
    { id: 'tdB', x: 'Email the principal about the trip', d: '2026-10-27', c: 'c1', who: '', a: '', rep: '', note: '', done: 0, made: t0, t: t0, ppl: ['p1'] },
    { id: 'tdC', x: 'Order lab supplies', d: '', c: '', who: '', a: '', rep: '', note: '', done: 0, made: t0, t: t0 },
  ] };
  s.ls['gs.lib'] = JSON.stringify(lib); s.ls['gs.school'] = JSON.stringify(PEOPLE);
  s.idb['gs-lessons'] = { version: 1, stores: { lessons: [], kv: [['setup', PLAN_SETUP]] } };
  return s;
}
async function fresh(width = 1440) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: 900 });
  await p.goto(srv.url + 'blank'); await plant(p, seed());
  p.errors = errors; p.ctx = ctx; return p;
}
const lib = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
const items = async p => ((await lib(p)).todo.items || []).filter(it => it && it.id && !it.gone);
const todoUp = p => p.waitForSelector('[data-td-list], [data-td-none], [data-td-week]', { timeout: 20000 });
// Waits for a box to have focus before typing (stage 5: keys pressed before focus land nowhere).
async function typeIn(p, sel, text) { await p.click(sel); await p.waitForFunction(s => document.activeElement === document.querySelector(s), {}, sel); await p.keyboard.type(text); }
// The current app's own list and count for the same saved work.
async function currentApp(p) {
  await p.goto(srv.url); await appReady(p);   // Today reads the timetable, as it does when the app opens
  await p.waitForFunction(() => window.__gs.bgBusy && !window.__gs.bgBusy(), { timeout: 20000 });
  return p.evaluate(() => ({ count: window.__gs.todoCount(), rows: window.__gs.todoRows().map(r => [r.id, r.d || '', !!r.done]).sort() }));
}

test('To do: the groups, a line added the way she would say it, ticked and taken back, an app line hidden; the sidebar counts what the list shows, and the current app opens the same list', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/todo'); await todoUp(p);
  const groups = await p.$$eval('[data-td-group]', l => l.map(e => e.dataset.tdGroup));
  assert.deepEqual(groups.slice(0, 2), ['late', 'now'], 'overdue first, then today');
  assert.ok((await p.$eval('[data-td-group="late"]', e => e.textContent)).includes('Notes from the department meeting'));
  assert.ok((await p.$eval('[data-td-row="tdB"]', e => e.textContent)).includes('Rowan Placeholder'), 'the colleague it names');
  assert.ok((await p.$$('[data-td-list] .tdck.app')).length > 0, 'the app noticed lines in the work');
  // the count in the sidebar is the overdue and today lines, hers and the app's
  const due = await p.$$eval('[data-td-group="late"] [data-td-row], [data-td-group="now"] [data-td-row]', l => l.filter(e => !e.classList.contains('done')).length);
  await p.waitForFunction(n => { const a = document.querySelector('nav a[href="#/todo"]'); return a && a.textContent.replace(/\D+/g, ' ').trim().split(' ').pop() === String(n); }, { timeout: 10000 }, due);

  // the way she would say it: a day at the end, a class named in it, read before it is saved
  await typeIn(p, '[data-td-new]', 'Print handouts for Grade 9 English tomorrow');
  await p.waitForSelector('[data-td-parse] [data-td-drop="d"]');
  assert.ok(await p.$('[data-td-parse] [data-td-drop="c"]'), 'the class is understood');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).todo.items.length === 4, { timeout: 10000 });
  await p.waitForFunction(() => [...document.querySelectorAll('[data-td-group="week"] [data-td-row]')].some(e => e.textContent.includes('Print handouts')), { timeout: 10000 });
  let mine = await items(p), added = mine.find(it => it.x === 'Print handouts for Grade 9 English');
  assert.ok(added, 'saved without the day words');
  assert.equal(added.d, '2026-10-28'); assert.equal(added.c, 'c1');
  assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.matches('[data-td-new]')), true, 'the box keeps focus for the next one');

  // ticked, then Undo takes it back
  await p.click('[data-td-tick="tdA"]');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')).todo.items.find(x => x.id === 'tdA'); return l && l.done; });
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')).todo.items.find(x => x.id === 'tdA'); return l && !l.done; });

  // an app line hidden: it goes, and is kept hidden at its signature
  const app = await p.$eval('[data-td-list] .tdck.app', e => e.dataset.tdTick);
  await p.click('[data-td-tick="' + app + '"]');
  await p.waitForFunction(id => !document.querySelector('[data-td-row="' + id + '"]'), {}, app);
  const auto = (await lib(p)).todo.auto;
  assert.ok(auto[app.slice(5)] && auto[app.slice(5)].h != null, 'hidden at its signature');

  const due2 = await p.$$eval('[data-td-group="late"] [data-td-row], [data-td-group="now"] [data-td-row]', l => l.filter(e => !e.classList.contains('done')).length);
  await p.waitForFunction(n => { const a = document.querySelector('nav a[href="#/todo"]'); return a && a.textContent.replace(/\D+/g, ' ').trim().split(' ').pop() === String(n); }, { timeout: 10000 }, due2);
  const newCount = String(due2);
  const rows = (await p.$$eval('[data-td-row]', l => l.map(e => e.dataset.tdRow))).filter(x => !x.startsWith('auto:'));

  // the current app: the same lines and the same count
  const cur = await currentApp(p);
  assert.equal(String(cur.count), newCount, 'the same count in the current app');
  for (const id of rows) assert.ok(cur.rows.some(r => r[0] === id), 'the current app has ' + id);
  assert.ok(!cur.rows.some(r => r[0] === app), 'and the hidden line stays hidden there');
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('To do: a line edited at the side, moving quickly from box to box loses nothing; people, repeats, a new category, by category; deleted and put back', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/todo'); await todoUp(p);
  await p.click('[data-td-row="tdC"] .tdmain');
  await p.waitForSelector('[data-td-pane="tdC"]');
  // the words, then straight to the note, then straight to the class: each saved, none over another
  await p.click('[data-td-x]'); await p.evaluate(() => document.querySelector('[data-td-x]').select()); await p.keyboard.type('Order lab supplies for the friction lab');
  await p.click('[data-td-note]'); await p.keyboard.type('Ask for twenty spring scales');
  await p.select('[data-td-cls]', 'c1');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')).todo.items.find(x => x.id === 'tdC'); return l && l.c === 'c1' && l.note && l.x.includes('friction'); }, { timeout: 10000 });
  let it = (await items(p)).find(x => x.id === 'tdC');
  assert.equal(it.x, 'Order lab supplies for the friction lab'); assert.equal(it.note, 'Ask for twenty spring scales');
  // goes with a student, a colleague added, every week
  await p.waitForSelector('[data-td-with]');
  await p.select('[data-td-with]', 's:1');
  await p.select('[data-td-ppl]', 'p2');
  // the pane grows a line for the student's page: press Every week where it is drawn now
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')).todo.items.find(x => x.id === 'tdC'); return l && l.who && (l.ppl || []).includes('p2'); });
  await new Promise(r => setTimeout(r, 150));
  await p.click('[data-td-rep="week"]');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')).todo.items.find(x => x.id === 'tdC'); return l && l.rep === 'week' && (l.ppl || []).includes('p2') && l.who; });
  it = (await items(p)).find(x => x.id === 'tdC');
  assert.equal(it.who, 'Bram Sample'); assert.equal(it.d, '2026-10-27', 'a repeat with no day starts today');
  // a new category of her own, picked for this line
  await p.select('[data-td-cat]', '+');
  await p.waitForSelector('[data-td-catname]');
  await typeIn(p, '[data-td-catname]', 'Science fair');
  await p.click('[data-td-catok]');
  await p.waitForFunction(() => { const t = JSON.parse(localStorage.getItem('gs.lib')).todo; const c = (t.cats || []).find(x => x.name === 'Science fair'); const l = t.items.find(x => x.id === 'tdC'); return c && l.k === c.id; });
  // by category: her category is a group with the line in it
  await p.click('[data-td-pane] .tdclose');
  await p.click('[data-td-by="cat"]');
  await p.waitForFunction(() => [...document.querySelectorAll('[data-td-group^="cat:"] h2')].some(h => h.textContent.includes('Science fair')));
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.tdBy')), 'cat', 'kept for this browser, as the current app keeps it');
  await p.click('[data-td-by="day"]');
  // deleted, and Undo puts it back
  await p.click('[data-td-row="tdC"] .tdmain'); await p.waitForSelector('[data-td-del]');
  await p.click('[data-td-del]');
  await p.waitForFunction(() => !document.querySelector('[data-td-row="tdC"]'));
  assert.ok(!(await items(p)).some(x => x.id === 'tdC'), 'kept as deleted');
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForSelector('[data-td-row="tdC"]');
  // the current app reads the same line
  const cur = await currentApp(p);
  const there = await p.evaluate(() => window.__gs.todoRows().find(r => r.id === 'tdC'));
  assert.equal(there.it.x, 'Order lab supplies for the friction lab'); assert.equal(there.it.who, 'Bram Sample'); assert.equal(there.it.rep, 'week');
  assert.ok(cur.rows.some(r => r[0] === 'tdC'));
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('To do: the week, a line typed into a day and one dragged to another, the kinds switched off, and N from anywhere', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/todo/week'); await p.waitForSelector('[data-td-week]');
  const days = await p.$$eval('[data-td-day]', l => l.map(e => e.dataset.tdDay));
  assert.deepEqual(days.slice(0, 5), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  assert.ok(await p.$('[data-td-day="2026-10-27"] [data-td-row="tdA"]'), 'not done by its day: it is today’s now');
  // typed into Thursday
  await typeIn(p, '[data-td-day="2026-10-29"] .tdwadd input', 'Collect permission slips');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).todo.items.some(x => x.x === 'Collect permission slips' && x.d === '2026-10-29'));
  // dragged to Friday
  const dragged = await p.evaluate(async () => {
    const src = document.querySelector('[data-td-row="tdB"]'), dst = document.querySelector('[data-td-day="2026-10-30"]'), dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  });
  assert.ok(dragged);
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).todo.items.find(x => x.id === 'tdB').d === '2026-10-30');
  // the list again: the kinds the app adds, one switched off
  await p.click('[data-td-view]'); await todoUp(p);
  await p.waitForSelector('[data-td-kind="back"] [role="switch"]', { timeout: 20000 });
  // counted once the list has finished drawing (the same count twice, a moment apart)
  const before = await p.evaluate(async () => { let n = -1; for (;;) { const m = document.querySelectorAll('[data-td-list] .tdck.app').length; if (m === n) return m; n = m; await new Promise(r => setTimeout(r, 400)); } });
  // pressed until it is kept: a press that lands while the list is still drawing is lost
  for (let i = 0; i < 5; i++) {
    await p.$eval('[data-td-kind="back"] [role="switch"]', e => e.click());
    try { await p.waitForFunction(() => (JSON.parse(localStorage.getItem('gs.lib')).todo.off || {}).back === 1, { timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; }
  }
  await p.waitForFunction(n => document.querySelectorAll('[data-td-list] .tdck.app').length <= n, {}, before);
  // N from Home opens To do with the box ready
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-home]', { timeout: 20000 });
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('n');
  await p.waitForFunction(() => location.hash === '#/todo' && document.activeElement && document.activeElement.matches('[data-td-new]'), { timeout: 10000 });
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});
