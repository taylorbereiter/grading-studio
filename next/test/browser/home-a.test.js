// Stage 8, slice A: Home's lists and today's classes (rebuild/audit/gaps.md A-060, A-075, A-050, A-073, A-071, A-072, A-058, A-059, A-067, A-068, A-069, A-070, A-074), as the current app's
// Today has them (src/today.js oldRow, src/shell.js renderNeedsOnly, src/app/kept.js forgetKept). Made-up downloads only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, PLAN_SETUP, STEADY } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });


// Made-up downloads: one partly scored with its papers here, one whose papers aren't kept, four handed back already (earlier work),
// her last take-home file ten days old, and the folder question put away for now. The clock stands at 27 October 2026, 10:20.
const NOW = Date.parse('2026-10-27T10:20:00Z');
function seed() {
  const s = gradingSeed(), meta = s.idb['grading-studio-keep'].stores.meta;
  for (const [id, m] of meta) { if (id === 'gs.b.n2') Object.assign(m, { papers: 1, scored: 4, partial: 2 }); }
  for (const [i, nm] of ['Book report', 'Lab write-up', 'Short story', 'Speech outline'].entries()) {
    const id = 'gs.b.o' + i, t = Date.parse('2026-09-0' + (i + 1) + 'T12:00:00Z');
    meta.push([id, { id, name: nm, n: 6, scored: 6, t, back: t + 864e5, papers: 1 }]);
  }
  s.ls['gs.lastBackup'] = String(NOW - 10 * 864e5); s.ls['gsc.folderLater'] = String(NOW);
  s.idb['gs-lessons'] = { version: 1, stores: { lessons: [], kv: [['setup', PLAN_SETUP]] } };
  return s;
}
async function home(errors) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 900 });
  await p.goto(srv.url + 'blank'); await plant(p, seed());
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-home="earlier"]', { timeout: 30000 });
  p.ctx = ctx; return p;
}
const rows = (p, sel) => p.$$eval(sel + ' li.hl', l => l.map(e => ({ kind: e.dataset.kind, id: e.dataset.id || '', text: e.textContent, go: (e.querySelector('a.go') || {}).hash || '' })));

test('A-068 A-069 A-070: Needs a look lists papers partly scored (opening them), papers not kept here, and work not backed up for a week', async () => {
  const errors = [], p = await home(errors);
  const look = await rows(p, '[data-home="look"]');
  const part = look.find(r => r.kind === 'partial'), gone = look.find(r => r.kind === 'notkept'), bk = look.find(r => r.kind === 'backup');
  assert.ok(part && /2 papers are partly scored/.test(part.text) && /Poetry analysis/.test(part.text), JSON.stringify(look));
  assert.equal(part.go, '#/mark/gs.b.n2');
  assert.ok(gone && /Papers not kept in this browser/.test(gone.text) && /Narrative essay: drop the download in again/.test(gone.text));
  assert.ok(bk && /Your take-home file is 10 days old/.test(bk.text) && bk.go === '#/settings/saving');
  assert.equal(await p.$eval('[data-home="look"] .hcount', e => e.textContent), String(look.length));
  // the partly scored row opens the papers
  await p.click('[data-home="look"] li[data-kind="partial"] a.go');
  await p.waitForFunction(() => location.hash === '#/mark/gs.b.n2', { timeout: 10000 });
  assert.deepEqual(errors, []); await p.ctx.close();
});

test('A-058 A-059 A-067 A-074: Earlier work shows the newest three, Show all and back, and Forget takes a download out after asking', async () => {
  const errors = [], p = await home(errors);
  let old = await rows(p, '[data-home="earlier"]');
  assert.deepEqual(old.map(r => r.id), ['gs.b.o3', 'gs.b.o2', 'gs.b.o1'], 'the newest three');
  assert.match(old[0].text, /Speech outline.*returned.*6 of 6 scored/s);
  assert.equal(await p.$eval('[data-earlier-all]', e => e.textContent), 'Show all 4');
  await p.click('[data-earlier-all]');
  old = await rows(p, '[data-home="earlier"]');
  assert.equal(old.length, 4);
  assert.equal(await p.$eval('[data-earlier-all]', e => e.textContent), 'Show only the newest');
  await p.click('[data-earlier-all]');
  assert.equal((await rows(p, '[data-home="earlier"]')).length, 3);
  // Forget, from the row's menu: asked first; Cancel keeps it, Forget takes it out of this browser
  await p.click('[data-hmenu="gs.b.o3"]');
  await p.waitForSelector('[role="menuitem"]', { visible: true });
  await p.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].find(e => e.textContent.includes('Forget')).click());
  await p.waitForSelector('[data-fgok]', { visible: true, timeout: 15000 });
  assert.match(await p.$eval('dialog[open], [role="dialog"]', e => e.textContent), /Forget the papers for “Speech outline”\?/);
  await p.click('[data-fgok]');
  await p.waitForFunction(() => !document.querySelector('[data-home="earlier"] li[data-id="gs.b.o3"]'), { timeout: 15000 });
  const kept = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => { const q = r.result.transaction('meta').objectStore('meta').getAllKeys(); q.onsuccess = () => { res(q.result); r.result.close(); }; }; }));
  assert.ok(!kept.includes('gs.b.o3') && kept.includes('gs.b.o2'), JSON.stringify(kept));
  assert.equal((await rows(p, '[data-home="earlier"]')).length, 3, 'the next one moves up');
  assert.equal(await p.$('[data-earlier-all]'), null, 'three left: nothing more to show');
  // the papers still to mark and to hand back have the same menu
  assert.ok(await p.$('[data-home="needs"] [data-hmenu="gs.b.n2"]'));
  assert.deepEqual(errors, []); await p.ctx.close();
});

test('A-071 A-072: each of today’s classes presents its lesson, opens it, or plans it, and says where the class got to', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 900 });
  const s = seed(), slides = [1, 2, 3].map(i => ({ layout: 'content', title: 'Part ' + i, body: '' }));
  s.idb['gs-lessons'].stores.lessons = [['LB', { id: 'LB', title: 'Unreliable narrators', slots: [{ classId: 'B1', date: '2026-10-27' }], slides, taught: [{ classId: 'B1', date: '2026-10-27', slide: 2, of: 3 }], updated: NOW }]];
  await p.goto(srv.url + 'blank'); await plant(p, s);
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-teach]', { timeout: 30000 });
  const day = await p.$$eval('[data-home="teach"] .day li', l => l.map(e => ({ cls: e.querySelector('[data-teach]').dataset.teach, href: e.querySelector('a').hash, label: e.querySelector('a').getAttribute('aria-label'), note: e.querySelector('.tm').textContent })));
  assert.deepEqual(day.map(d => [d.cls, d.href]), [['B1', '#/lesson/LB/present/B1'], ['A1', '#/class/A1']]);
  assert.equal(day[0].label, 'Grade 10 Literature: Present'); assert.equal(day[1].label, 'Grade 9 English: Plan it');
  assert.match(day[0].note, /taught to slide 2 of 3/);
  // the class on next presents from its own button too
  assert.equal(await p.$eval('[data-now-present]', a => a.hash), '#/lesson/LB/present/B1');
  await p.click('[data-teach="B1"]');
  await p.waitForFunction(() => location.hash === '#/lesson/LB/present/B1', { timeout: 10000 });
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-050 A-073: the To do card has today’s lines and the late ones, ticks them, takes a new line for today, and says how many more', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 1200 });
  const s = seed(), lib = JSON.parse(s.ls['gs.lib']), t0 = Date.parse('2026-10-20T09:00:00Z');
  const line = (id, x, d) => ({ id, x, d, c: '', who: '', a: '', rep: '', note: '', done: 0, made: t0, t: t0 });
  lib.todo = { items: [line('tdA', 'Notes from the department meeting', '2026-10-26'), line('tdB', 'Collect the permission slips', '2026-10-27'), line('tdC', 'Order lab supplies', '')] };
  s.ls['gs.lib'] = JSON.stringify(lib);
  await p.goto(srv.url + 'blank'); await plant(p, s);
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-home="todo"] [data-td]', { timeout: 30000 });
  const shown = () => p.$$eval('[data-home="todo"] [data-td]', l => l.map(e => e.dataset.td + (e.classList.contains('done') ? ':done' : '')));
  assert.deepEqual(await shown(), ['tdA', 'tdB']);
  assert.match(await p.$eval('[data-home="todo"] .tdfoot', e => e.textContent), /1 more on your list/);
  assert.equal(await p.$eval('[data-tdcard-all]', a => a.hash), '#/todo');
  const saved = id => p.evaluate(id => (JSON.parse(localStorage.getItem('gs.lib')).todo.items.find(x => x.id === id || x.x === id) || null), id);
  await p.click('[data-tdtick="tdB"]');
  await p.waitForFunction(() => document.querySelector('[data-td="tdB"]').classList.contains('done'), { timeout: 10000 });
  assert.ok((await saved('tdB')).done > 0, 'ticked where the current app reads it');
  assert.deepEqual(await shown(), ['tdA', 'tdB:done'], 'ticked today: it stays, crossed out, below the rest');
  await p.click('[data-tdcard-in]'); await p.keyboard.type('Call the museum'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => [...document.querySelectorAll('[data-home="todo"] [data-td]')].some(e => e.textContent.includes('Call the museum')), { timeout: 10000 });
  const nw = await saved('Call the museum');
  assert.equal(nw.d, '2026-10-27', 'a line typed on Home with no day is for today');
  assert.equal(await p.$eval('[data-tdcard-in]', e => e.value), '');
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-060 A-075: what the class needs next, from the newest finished rubric set: the weakest row, the bars, how many to sit down with, and See who', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 1400 });
  const s = gradingSeed(); for (const [id, m] of s.idb['grading-studio-keep'].stores.meta) if (id === 'gs.b.n2') m.papers = 1;
  s.idb['gs-lessons'] = { version: 1, stores: { lessons: [], kv: [['setup', PLAN_SETUP]] } };
  await p.goto(srv.url + 'blank'); await plant(p, s);
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-home="next"]', { timeout: 30000 });
  const card = await p.$eval('[data-home="next"]', e => ({ text: e.textContent, bars: e.querySelector('.bars').getAttribute('aria-label'), low: [...e.querySelectorAll('.bt i')].map(i => i.className) }));
  assert.match(card.text, /Grade 9 English: Language was the weakest row on Poetry analysis\./);
  assert.match(card.text, /4 students scored 2 or below on Language\./);
  assert.equal(card.bars, 'Ideas 3.3 of 4, Organization 2.8 of 4, Language 2.3 of 4');
  assert.deepEqual(card.low, ['', '', 'low']);
  assert.equal(await p.$eval('[data-next-go]', a => a.textContent + '|' + a.hash), 'See who|#/mark/gs.b.n2/insights');
  // no student's name is on the card
  for (const n of ['Aria', 'Bram', 'Cleo', 'Dov', 'Esme', 'Finn']) assert.ok(!card.text.includes(n));
  assert.deepEqual(errors, []); await ctx.close();
});

test('B-064: each of today’s classes with a roster says whether attendance was taken, and opens the attendance page', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 900 });
  const s = seed(), lib = JSON.parse(s.ls['gs.lib']), c1 = lib.classes[0];
  c1.att = { '2026-10-27': { t: NOW, m: { [c1.names[0]]: 'l' }, n: {} } };
  lib.classes.push({ id: 'c2', name: 'Grade 10 Literature', names: ['Avery Stone', 'Blake Rivers'], units: [] });
  s.ls['gs.lib'] = JSON.stringify(lib);
  await p.goto(srv.url + 'blank'); await plant(p, s);
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-tatt]', { timeout: 30000 });
  const att = await p.$$eval('[data-home="teach"] [data-tatt]', l => l.map(a => [a.dataset.tatt, a.textContent, a.hash]));
  assert.deepEqual(att, [['c2', 'Take attendance', '#/class/c2/people/attendance'], ['c1', 'Attendance taken · 1 late', '#/class/c1/people/attendance']]);
  await p.click('[data-tatt="c2"]');
  await p.waitForFunction(() => location.hash === '#/class/c2/people/attendance', { timeout: 10000 });
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-902: pressing anywhere on a Needs you row opens it, and its menu still opens on its own', async () => {
  const errors = [], p = await home(errors);
  const row = await p.$('[data-home="needs"] li.hl[data-id="gs.b.n2"]'), go = await row.$eval('a.go', a => a.hash);
  await p.click('[data-home="needs"] [data-hmenu="gs.b.n2"]');
  await p.waitForSelector('[role="menu"]', { visible: true, timeout: 5000 });
  assert.equal(await p.evaluate(() => location.hash), '#/home');
  await p.keyboard.press('Escape');
  const box = await (await row.$('.tx b')).boundingBox();
  await p.mouse.click(box.x + 5, box.y + box.height / 2);
  await p.waitForFunction(h => location.hash === h, { timeout: 10000 }, go);
  assert.deepEqual(errors, []); await p.ctx.close();
});

test('A-076: in the sample, the strip lists things to try, each opening its page', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 900 });
  const s = seed(), lib = JSON.parse(s.ls['gs.lib']), items = lib.classes[0].units[0].items;
  Object.assign(items.find(i => i.id === 'i3'), { sampleKey: 'essay' });
  items.push({ id: 'smp-quiz', sampleKey: 'quiz', name: 'Quiz', classId: 'c1', type: 'ic', batchId: 'gs.b.n2' });
  s.ls['sample:gs.lib'] = JSON.stringify(lib); s.ls['sample:gs.sampleBuilt'] = '"made-up"'; s.ls['gs.sampleOn'] = '1';
  await p.goto(srv.url + 'blank'); await plant(p, s);
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-sampletry="paper"]', { timeout: 30000 });
  const links = await p.$$eval('[data-sampletry]', l => l.map(a => [a.dataset.sampletry, a.hash]));
  assert.deepEqual(links, [['paper', '#/mark/gs.b.n1'], ['quiz', '#/mark/gs.b.n2'], ['book', '#/class/c1/grades'], ['charts', '#/class/c1/grades/charts'],
    ['missing', '#/class/c1/todo/missing'], ['seats', '#/class/c1/people/seating'], ['plan', '#/week']]);
  await p.click('[data-sampletry="charts"]');
  await p.waitForSelector('dialog[open] [data-charts]', { timeout: 15000 });
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-061 A-062: Home ends with where the work is kept and Try it with a sample class, which opens the sample', async () => {
  const errors = [], p = await home(errors);
  assert.match(await p.$eval('[data-home-foot]', e => e.textContent), /kept in this browser/);
  await p.click('[data-home-sample]');
  await p.waitForFunction(() => window.__gsSample && window.__gsSample.on, { timeout: 15000 });
  assert.deepEqual(errors.filter(e => !/sample/i.test(e)), []); await p.ctx.close();
});
