// A focus session goes on in the Planner (src/planner/plfocus.js): the panel shows there, the clock keeps running, and what a session
// that ends there came to is written into the grading log when the grading page opens again. Nothing about students is involved.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { builtHtml, ROOT } = require('./helpers/app');

let browser, srv;
before(async () => {
  builtHtml(); browser = await launch();
  const s = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  });
  await new Promise(r => s.listen(0, '127.0.0.1', r)); s.unref();
  srv = { url: 'http://localhost:' + s.address().port + '/', close: () => new Promise(d => { s.closeAllConnections(); s.close(d); }) };
});
after(async () => { await browser.close(); await srv.close(); });

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const run = page => page.evaluate(() => JSON.parse(localStorage.getItem('gsp.focusRun') || 'null'));
const gradingReady = page => page.waitForFunction(() => window.__gs && window.__gs.fcStart && document.querySelector('#fcCard'));
const plannerReady = page => page.waitForFunction(() => window.__planner && window.__plfocus && document.querySelector('#lessons .ls-top'));

test('a session started on the grading page keeps going in the Planner, and its minutes reach the grading log', async () => {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(srv.url, { waitUntil: 'load' }); await gradingReady(page);
    await page.evaluate(() => window.__gs.fcStart(25, '', false));
    assert.equal((await run(page)).st, 'run');
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    // the panel shows, with the clock going down
    await page.waitForFunction(() => { const p = document.querySelector('#fcPanel'); return p && !p.hidden && /^2[45]:\d\d$/.test(p.querySelector('.fct').textContent); });
    assert.equal(await page.$eval('#fcPanel .tcap', e => e.textContent), 'Focusing');
    await page.waitForFunction(() => /^2[45]:\d\d · /.test(document.title));   // the time left is in the tab’s name
    // pause and carry on
    await page.click('#fcPanel [data-pf="pause"]');
    assert.equal((await run(page)).st, 'paused');
    await page.click('#fcPanel [data-pf="resume"]');
    assert.equal((await run(page)).st, 'run');
    await page.click('#fcPanel [data-pf="more"]');
    assert.equal((await run(page)).len, 30 * 60, '+5 minutes');
    // the time runs out here: it is written down to wait for the grading page, once
    await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('gsp.focusRun')); r.at -= r.len * 1000 + 1000; localStorage.setItem('gsp.focusRun', JSON.stringify(r)); window.__plfocus.tick(); window.__plfocus.tick(); });
    assert.equal((await run(page)).st, 'up');
    const q = await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.focusQ')));
    assert.equal(q.length, 1); assert.equal(q[0].s, 1800); assert.equal(q[0].m, 0); assert.equal(q[0].d, iso(new Date()));
    await page.click('#fcPanel [data-pf="break"]');
    assert.equal((await run(page)).st, 'brk');
    await page.click('#fcPanel [data-pf="stop"]');
    assert.equal((await run(page)).st, 'done');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.focusQ')))).length, 1, 'ending the break adds nothing');
    await page.click('#fcPanel [data-pf="close"]');
    assert.equal(await run(page), null);
    assert.equal(await page.$eval('#fcPanel', e => e.hidden), true);
    // back on the grading page, the session is in today's log
    await page.goto(srv.url, { waitUntil: 'load' }); await gradingReady(page);
    const L = await page.evaluate(() => JSON.parse(localStorage.getItem('gs.focus')));
    assert.equal(L.days[iso(new Date())].s, 1800); assert.equal(L.days[iso(new Date())].n, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('gsp.focusQ')), null);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('a session kept under the old name carries on; the Planner shows nothing when no session is on', async () => {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    assert.equal(await page.$eval('#fcPanel', e => e.hidden), true);
    await page.evaluate(() => localStorage.setItem('gs.focusRun', JSON.stringify({ st: 'run', len: 600, at: Date.now(), w: '', one: 0, p0: 1e9, pg: 0, fold: false, no: 1 })));
    // an entry two tabs both read is written in once
    await page.evaluate(d => localStorage.setItem('gsp.focusQ', JSON.stringify([{ id: 'a1', d, s: 300, m: 0, x: 0, got: 0 }, { id: 'a1', d, s: 300, m: 0, x: 0, got: 0 }])), iso(new Date()));
    await page.goto(srv.url, { waitUntil: 'load' }); await gradingReady(page);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('gs.focus')))).days[iso(new Date())].s, 300);
    assert.equal((await run(page)).len, 600);
    assert.equal(await page.evaluate(() => localStorage.getItem('gs.focusRun')), null);
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    await page.waitForFunction(() => !document.querySelector('#fcPanel').hidden);
    // folded to a pill and back
    await page.click('#fcPanel [data-pf="fold"]');
    await page.waitForSelector('#fcPanel .fcpill');
    await page.click('#fcPanel [data-pf="unfold"]');
    await page.waitForSelector('#fcPanel .fcclock');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('a lesson session: picked on the grading page, 45 minutes, the lesson made in the Planner, papers never count, minutes go to planning time', async () => {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    // a made-up class that meets every day, late, so today's meeting isn't over
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    await page.evaluate(() => window.__planner.applySetup({ kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-01-05', semEnd: '2030-12-20',
      classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, start: '23:58', end: '23:59' })) }], daysOff: [], events: [] }));
    await page.goto(srv.url, { waitUntil: 'load' }); await gradingReady(page);
    await page.waitForFunction(() => window.__gs.fcWorks().some(w => w.les));
    const works = await page.evaluate(() => window.__gs.fcWorks().filter(w => w.les));
    const day = iso(new Date(Date.now() + 864e5));
    const fresh = works.find(w => w.key === 'les:+A1|' + day);
    assert.ok(fresh && fresh.fresh, 'a class with nothing planned is offered');
    // the card's suggestion is never a lesson on its own: grading stays the default
    assert.doesNotMatch(await page.$eval('#fcCardBody', e => e.textContent), /A new lesson to plan/);
    // picked, it starts at the lesson length and opens the Planner, where the lesson is made
    await page.evaluate(() => { const s = document.querySelector('#fcCardBody [data-fcchg]'); if (s) s.click(); });
    await page.select('#fcCardBody [data-fcwork]', fresh.key);
    assert.match(await page.$eval('#fcCardBody [data-fcstart]', e => e.textContent), /Start 45 minutes/);
    assert.equal(await page.$('#fcCardBody [data-fcone]'), null, 'no Just one paper for a lesson');
    await Promise.all([page.waitForNavigation(), page.evaluate(() => document.querySelector('#fcCardBody [data-fcstart]').click())]);   // the welcome covers the card for a new teacher
    await plannerReady(page);
    await page.waitForFunction(() => { const r = window.__plfocus.run(); return r && r.l; });
    const r = await run(page);
    assert.equal(r.k, 'l'); assert.equal(r.len, 45 * 60); assert.equal(r.t, 'New lesson'); assert.equal(r.nw, undefined);
    assert.ok(await page.evaluate(id => window.__planner.L.open && window.__planner.L.open.id === id, r.l), 'the new lesson is open in the editor');
    assert.equal(await page.$eval('#fcPanel .fcwhat', e => e.textContent.includes('A lesson to plan')), true);
    // back on the grading page, a paper's save doesn't touch it, and its end goes to planning time, not the grading log
    await page.goto(srv.url, { waitUntil: 'load' }); await gradingReady(page);
    await page.evaluate(() => window.__gs.fcGain({ id: 'x', scored: 1, marked: 1, of: 5, done: 1 }, { id: 'x', scored: 3, marked: 3, of: 5, done: 3 }));
    assert.equal((await run(page)).pg, undefined);
    assert.match(await page.$eval('#fcPanel', e => e.textContent), /Open the lesson/);
    assert.doesNotMatch(await page.$eval('#fcPanel', e => e.textContent), /paper/);
    await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('gsp.focusRun')); r.at -= 1200e3; localStorage.setItem('gsp.focusRun', JSON.stringify(r)); });
    await page.evaluate(() => document.querySelector('#fcPanel [data-fcstop]').click());
    const P = await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.planTime')));
    const pd = P.days[iso(new Date())]; assert.ok(pd.a[r.l] >= 1200 && pd.a[r.l] < 1260, 'twenty minutes'); assert.equal(pd.f, pd.a[r.l]);
    const L = await page.evaluate(() => JSON.parse(localStorage.getItem('gs.focus') || '{}'));
    assert.ok(!((L.days || {})[iso(new Date())] || {}).s, 'not in the grading log');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('a lesson session in the Planner: a stretch with nothing done for the idle minutes is not counted, and the end says what the lesson has had', async () => {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    // an hour of planning on this lesson yesterday, and a session that began 40 minutes ago with the last thing done 35 minutes ago
    const yest = iso(new Date(Date.now() - 864e5));
    await page.evaluate(y => {
      localStorage.setItem('gsp.planTime', JSON.stringify({ days: { [y]: { l: 3600, a: { x1: 3600 }, f: 3600, n: 1 } }, names: { x1: 'Made-up lesson' } }));
      const now = Date.now();
      localStorage.setItem('gsp.focusRun', JSON.stringify({ k: 'l', id: 'r1', st: 'run', len: 2700, at: now - 40 * 60e3, seen: now - 35 * 60e3, w: 'les:x1', l: 'x1', t: 'Made-up lesson', one: 0, fold: false, no: 1 }));
      window.__plfocus.tick();
    }, yest);
    let r = await run(page);
    assert.ok(Math.abs(r.ii - (r.seen + 5 * 60e3)) < 1000, 'the idle stretch began five minutes after the last thing done');
    // she comes back and clicks: the stretch ends, and none of it counts
    await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    r = await run(page);
    assert.equal(r.ii, undefined); assert.ok(r.idl >= 30 * 60 - 5 && r.idl <= 30 * 60 + 5, 'thirty minutes away');
    await page.click('#fcPanel [data-pf="stop"]');
    r = await run(page);
    assert.ok(r.secs >= 595 && r.secs <= 610, 'ten minutes, not the 25 the old rule gave');
    const P = await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.planTime')));
    assert.equal(P.days[iso(new Date())].a.x1, r.secs);
    assert.match(await page.$eval('#fcPanel', e => e.textContent), /Done for now\s*This lesson so far\s*1 hr 10 min/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('after a lesson session in the Planner: is this lesson ready? Ready is kept on the lesson with an Undo, the editor says so, and Not yet asks no more', async () => {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    await page.evaluate(() => window.__planner.applySetup({ kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-01-05', semEnd: '2030-12-20',
      classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, start: '23:58', end: '23:59' })) }], daysOff: [], events: [] }));
    await page.evaluate(d => window.__planner.createLesson([{ classId: 'A1', date: d }]), iso(new Date()));
    await page.waitForFunction(() => window.__planner.L.view === 'edit' && window.__planner.L.open);
    const id = await page.evaluate(() => window.__planner.L.open.id);
    const ready = () => page.evaluate(id => { const l = window.__planner.L.lessons.find(x => x.id === id); return l.ready ? l.ready.at : null; }, id);
    const quiet = () => page.$eval('#lsReady', e => !e.hidden && e.matches('[data-pfready]:not(.primary)') && e.textContent);
    assert.equal(await quiet(), 'Ready', 'not ready yet: a quiet Ready button, no chip');
    // a session on it runs out: the panel asks
    await page.click('[data-pfstart]');
    await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('gsp.focusRun')); r.at -= r.len * 1000 + 1000; r.seen = Date.now(); localStorage.setItem('gsp.focusRun', JSON.stringify(r)); window.__plfocus.tick(); });
    await page.waitForSelector('#fcPanel .pfask');
    assert.match(await page.$eval('#fcPanel .pfask', e => e.textContent), /^Is this lesson ready\?ReadyNot yet$/);
    assert.equal(await page.$$eval('#fcPanel .pfask .btn.primary', b => b.length), 0, 'the panel keeps its one blue button');
    // Ready: kept on the lesson, the chip in the editor's top bar, and an Undo
    await page.click('#fcPanel [data-pf="ready"]');
    await page.waitForSelector('#fcPanel .pfready');
    assert.ok(await ready() > 0);
    assert.equal(await page.$eval('#lsReady', e => e.hidden ? '' : e.textContent), 'Ready ✓');
    assert.equal(await page.$('#fcPanel .pfpace'), null, 'one ready lesson: no pace yet');
    await page.waitForSelector('.toast:not([hidden]) button.link');
    assert.match(await page.$eval('.toast', e => e.textContent), /^Marked ready/);
    await page.click('.toast button.link');
    await page.waitForFunction(id => !window.__planner.L.lessons.find(x => x.id === id).ready, {}, id);
    assert.equal(await quiet(), 'Ready');
    await page.waitForSelector('#fcPanel .pfask');
    // kept through a reload, as any change to a lesson is; the chip takes it back
    await page.click('#fcPanel [data-pf="ready"]'); await page.waitForSelector('#fcPanel .pfready');
    await page.evaluate(() => { window.__plfocus.act('stop'); window.__plfocus.act('close'); return new Promise(r => setTimeout(r, 400)); });
    await page.reload(); await plannerReady(page);
    await page.evaluate(id => window.__planner.openLessonForTest(window.__planner.L.lessons.find(x => x.id === id)), id);
    await page.waitForSelector('#lsReady[data-pfunready]');
    assert.ok(await ready() > 0);
    await page.click('#lsReady');
    await page.waitForFunction(id => !window.__planner.L.lessons.find(x => x.id === id).ready, {}, id);
    assert.equal(await quiet(), 'Ready');
    assert.match(await page.$eval('.toast', e => e.textContent), /^No longer marked ready/);
    // Not yet: a session ended early asks too, and Not yet leaves the lesson as it is and asks no more
    await page.click('[data-pfstart]');
    await page.evaluate(() => window.__plfocus.act('stop'));
    await page.waitForSelector('#fcPanel .pfask');
    await page.click('#fcPanel [data-pf="notyet"]');
    await page.waitForFunction(() => !document.querySelector('#fcPanel .pfask'));
    assert.match(await page.$eval('#fcPanel', e => e.textContent), /Done for now/);
    assert.equal(await ready(), null);
    // with two more ready lessons that had planning time, Ready shows her pace: the middle of 20, 30 and 60 minutes
    const yest = iso(new Date(Date.now() - 864e5));
    await page.evaluate((id, y) => {
      for (const [x, at] of [['O1', 100], ['O2', 200]]) window.__planner.L.lessons.push(window.__planner.normLesson({ id: x, title: 'Older ' + x, ready: { at } }));
      localStorage.setItem('gsp.planTime', JSON.stringify({ days: { [y]: { l: 6600, a: { O1: 1200, O2: 3600, [id]: 1800 } } }, names: {} }));
      window.__plfocus.act('close');
    }, id, yest);
    await page.click('[data-pfstart]');
    await page.evaluate(() => window.__plfocus.act('stop'));
    await page.click('#fcPanel [data-pf="ready"]'); await page.waitForSelector('#fcPanel .pfpace');
    assert.match(await page.$eval('#fcPanel .pfpace', e => e.textContent), /^Your paceabout 30 minutes a lesson, from your last 3$/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('a lesson can be marked ready from the editor’s top bar, with no focus session: a quiet Ready button, kept with an Undo', async () => {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    await page.evaluate(() => window.__planner.applySetup({ kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-01-05', semEnd: '2030-12-20',
      classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, start: '23:58', end: '23:59' })) }], daysOff: [], events: [] }));
    await page.evaluate(d => window.__planner.createLesson([{ classId: 'A1', date: d }]), iso(new Date()));
    await page.waitForFunction(() => window.__planner.L.view === 'edit' && window.__planner.L.open);
    const id = await page.evaluate(() => window.__planner.L.open.id);
    const ready = () => page.evaluate(id => { const l = window.__planner.L.lessons.find(x => x.id === id); return l.ready ? l.ready.at : null; }, id);
    assert.equal(await page.$eval('#lsReady', e => e.textContent), 'Ready');
    assert.equal(await page.$eval('#lsReady', e => e.classList.contains('primary')), false, 'quiet, not blue');
    assert.ok(await page.$$eval('#lessons .ls-top .btn.primary', b => b.length) <= 1, 'the top bar keeps at most one blue button');
    assert.equal(await page.$('#fcPanel .pfask'), null, 'no focus session');
    await page.click('#lsReady');
    await page.waitForSelector('#lsReady[data-pfunready]');
    assert.ok(await ready() > 0);
    assert.equal(await page.$eval('#lsReady', e => e.textContent), 'Ready ✓');
    await page.waitForSelector('.toast:not([hidden]) button.link');
    assert.match(await page.$eval('.toast', e => e.textContent), /^Marked ready/);
    await page.click('.toast button.link');
    await page.waitForFunction(id => !window.__planner.L.lessons.find(x => x.id === id).ready, {}, id);
    await page.waitForSelector('#lsReady[data-pfready]');
    // kept through a reload
    await page.click('#lsReady'); await page.waitForSelector('#lsReady[data-pfunready]');
    await new Promise(r => setTimeout(r, 400));
    await page.reload(); await plannerReady(page);
    assert.ok(await ready() > 0);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
