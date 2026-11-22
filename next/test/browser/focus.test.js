// Focus and time in the new app (stage 6): a session started from To do on the papers it suggests opens them, counts a paper only
// when it is marked, pauses, takes 5 more minutes and ends, and the current app reads the same session and the same day; the time
// tracker sums the grading and planning time she has, time added by hand comes and goes; Settings > Focus and goals keeps her
// lengths and goal where the current app reads them; a lesson's session asks if the lesson is ready. npm run next:browser.
// Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, PLAN_SETUP, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan, LESSONS } = require('./planseed.js');

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

async function page(ctx, errors, width = 1440) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: 900 });
  return p;
}
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const TODAY = '2026-10-27';

test('a focus session from To do: it opens the papers it suggests, counts a paper only when it is marked, pauses, takes 5 more minutes and ends; the current app reads the same session and the same day', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.evaluate(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); l.me = { ...(l.me || {}), focus: { goal: { k: 'papers', n: 4 } } }; localStorage.setItem('gs.lib', JSON.stringify(l)); });
  await m.goto(srv.url); await appReady(m);
  await openZip(m, await zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'My summer essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'A day at the lake' }) }));
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();

  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/todo');
  await p.waitForSelector('[data-fc-aside] [data-fc-start]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-fc-aside] [data-fc-goal]', e => e.dataset.fcGoal), '0/4', 'today against her goal');
  assert.ok(await p.$('[data-gp-aside]') && await p.$('[data-tk-aside]'), 'the grading plan and the time this week beside it');
  // it suggests the papers waiting, and Start opens them
  await p.click('[data-fc-aside] [data-fc-start]');
  await p.waitForFunction(id => location.hash === '#/mark/' + encodeURIComponent(id), { timeout: 20000 }, id);
  await p.waitForSelector('[data-fc-panel="run"]', { timeout: 20000 });
  const r0 = await ls(p, 'gsp.focusRun');
  assert.equal(r0.st, 'run'); assert.equal(r0.w, 'mark:' + id); assert.equal(r0.len, 10 * 60, 'her session length, 10 minutes by default');
  // away from the tab for a few minutes while the clock runs: on the way back the panel says how long, and Keep going carries on
  await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('gsp.focusRun')); r.hid = Date.now() - 5 * 60000; localStorage.setItem('gsp.focusRun', JSON.stringify(r)); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForSelector('[data-fc-panel="away"]', { timeout: 10000 });
  assert.match(await p.$eval('[data-fc-panel="away"]', e => e.textContent), /5 minutes/);
  await p.click('[data-fcaway="keep"]');
  await p.waitForSelector('[data-fc-panel="run"]');
  assert.equal((await ls(p, 'gsp.focusRun')).away, undefined);
  await p.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.read && window.__mark.state().cur === 0, { timeout: 60000 });

  // nothing counts until a paper is marked: two rows scored is not a paper finished, the third is
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  for (const k of ['3', '4']) await p.keyboard.press(k);
  await p.evaluate(() => window.__mark.saved());
  assert.equal((await ls(p, 'gsp.focusRun')).pg || 0, 0, 'a paper half scored is not counted');
  await p.keyboard.press('2');
  await p.waitForFunction(() => (window.__mark.state().batch.students[0].grade.rubric || []).filter(v => v != null).length === 3);
  await p.evaluate(() => window.__mark.saved());
  await p.waitForFunction(() => (JSON.parse(localStorage.getItem('gsp.focusRun')) || {}).pg === 1, { timeout: 10000, polling: 100 });
  await p.waitForSelector('[data-fc-panel="run"] [data-fc-got="1"]', { timeout: 10000 });
  await p.waitForFunction(d => { const f = JSON.parse(localStorage.getItem('gs.focus') || '{}'); return f.days && f.days[d] && f.days[d].p === 1; }, { timeout: 10000, polling: 100 }, TODAY);   // one paper today

  // Pause, carry on, 5 more minutes, end, close
  await p.click('[data-fc-pause]'); await p.waitForSelector('[data-fc-panel="paused"]');
  assert.equal((await ls(p, 'gsp.focusRun')).st, 'paused');
  await p.click('[data-fc-resume]'); await p.waitForSelector('[data-fc-panel="run"]');
  await p.click('[data-fc-more]');
  assert.equal((await ls(p, 'gsp.focusRun')).len, 15 * 60, 'five more minutes');
  // the current app, in another window, reads the same session and the same day
  const c = await page(ctx, errors);
  await c.goto(srv.url); await appReady(c);
  const cur = await c.evaluate(() => ({ r: window.__gs.fcRun(), p: window.__gs.fcPapersToday() }));
  assert.equal(cur.r.st, 'run'); assert.equal(cur.r.w, 'mark:' + id); assert.equal(cur.r.pg, 1); assert.equal(cur.p, 1, 'the current app counts the same paper');
  await c.close();
  await p.bringToFront();
  await p.click('[data-fc-stop]'); await p.waitForSelector('[data-fc-panel="done"]');
  const done = await ls(p, 'gsp.focusRun');
  assert.equal(done.st, 'done'); assert.equal(done.got, 1);
  assert.equal((await ls(p, 'gs.focus')).last, 'mark:' + id, 'the work picked last');
  await p.click('[data-fc-panel="done"] [data-fc-close]');
  await p.waitForFunction(() => !document.querySelector('[data-fc-panel]') && !localStorage.getItem('gsp.focusRun'), { timeout: 10000, polling: 100 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the time tracker sums her grading and planning time, time added by hand comes and goes; Settings > Focus and goals keeps her lengths and goal where the current app reads them', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.evaluate(() => {
    localStorage.setItem('gs.focus', JSON.stringify({ day: '2026-10-27', base: {}, days: { '2026-10-26': { s: 1200, g: 3600, a: { i5: 3600 }, pa: { i5: 4 }, p: 4 }, '2026-10-27': { g: 600, a: { '': 600 } } }, pace: [], last: '', add: [] }));
    localStorage.setItem('gsp.planTime', JSON.stringify({ days: { '2026-10-26': { l: 1800, a: { L3: 1800 } } }, names: { L3: 'Sonnets: the turn' } }));
  });
  await p.goto(srv.url + 'next/#/time');
  await p.waitForSelector('[data-tk-page] [data-tk-g]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-tk-g]', e => +e.dataset.tkG), 4200, 'an hour and ten minutes of grading this week');
  assert.equal(await p.$eval('[data-tk-l]', e => +e.dataset.tkL), 1800, 'half an hour of planning');
  const text = await p.$eval('[data-tk-page]', e => e.textContent);
  assert.ok(text.includes('Poetry analysis') && text.includes('Sonnets: the turn'), 'what the time went to');
  // time added by hand
  await p.click('[data-tk-add]'); await p.waitForSelector('[data-tk-form]');
  await p.$eval('[data-tk-min]', e => { e.value = ''; });
  await p.click('[data-tk-min]'); await p.keyboard.type('45');
  // what she typed stays when the form is drawn again (Planning, then Grading): the box took its 30 back on every redraw
  await p.evaluate(() => [...document.querySelectorAll('[data-tk-form] [role="radio"]')][1].click());
  await p.evaluate(() => [...document.querySelectorAll('[data-tk-form] [role="radio"]')][0].click());
  assert.equal(await p.$eval('[data-tk-min]', e => e.value), '45');
  await p.click('[data-tk-addok]');
  await p.waitForFunction(() => (JSON.parse(localStorage.getItem('gs.focus')).add || []).length === 1, { timeout: 10000, polling: 100 });
  const add = (await ls(p, 'gs.focus')).add[0];
  assert.equal(add.s, 45 * 60); assert.equal(add.k, 'g'); assert.equal(add.d, TODAY);
  await p.waitForFunction(() => +document.querySelector('[data-tk-g]').dataset.tkG === 4200 + 2700, { timeout: 10000 });
  await p.click('[data-tk-del]');
  await p.waitForFunction(() => { const L = JSON.parse(localStorage.getItem('gs.focus')); return L.add.length === 0 && L.addGone.length === 1; }, { timeout: 10000, polling: 100 });

  // Settings > Focus and goals
  await p.goto(srv.url + 'next/#/settings/focus');
  await p.waitForSelector('[data-fc-settings] select[data-fc-len]', { timeout: 30000 });
  await p.select('select[data-fc-len]', '25');
  await p.waitForFunction(() => ((JSON.parse(localStorage.getItem('gs.lib')).me || {}).focus || {}).len === 25, { timeout: 10000, polling: 100 });
  await p.click('[data-fc-settings] .seg [data-v="papers"]');
  await p.waitForFunction(() => { const f = (JSON.parse(localStorage.getItem('gs.lib')).me || {}).focus || {}; return f.goal && f.goal.k === 'papers' && f.goal.n === 10; }, { timeout: 10000, polling: 100 });
  assert.equal((await ls(p, 'gsp.timeCount')).len, 25, 'the Planner reads the same length');
  const c = await page(ctx, errors);
  await c.goto(srv.url); await appReady(c);
  const conf = await c.evaluate(() => window.__gs.fcConf());
  assert.equal(conf.len, 25); assert.deepEqual(conf.goal, { k: 'papers', n: 10, per: 'day', days: null });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a lesson\'s focus session: started on the lesson, it opens it, counts as planning, and asks at the end whether the lesson is ready', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed()); await plantPlan(p);
  await p.goto(srv.url + 'next/#/lesson/L3');
  await p.waitForSelector('[data-focus="lesson-focus"]', { timeout: 30000 });
  await p.click('[data-focus="lesson-focus"]');
  await p.waitForSelector('[data-fc-panel="run"]', { timeout: 20000 });
  const r = await ls(p, 'gsp.focusRun');
  assert.equal(r.k, 'l'); assert.equal(r.l, 'L3'); assert.equal(r.len, 45 * 60, 'a lesson session, 45 minutes by default');
  assert.equal(await p.evaluate(() => location.hash), '#/lesson/L3');
  await p.click('[data-fc-stop]'); await p.waitForSelector('[data-fc-panel="done"] [data-fc-ready]');
  await p.click('[data-fc-ready]');
  await p.waitForFunction(() => new Promise(res => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => { const g = q.result.transaction('lessons').objectStore('lessons').get('L3'); g.onsuccess = () => { res(!!(g.result && g.result.ready && g.result.ready.at)); q.result.close(); }; }; }), { timeout: 10000, polling: 200 });
  await p.click('[data-fc-panel="done"] [data-fc-close]');
  await p.waitForFunction(() => !localStorage.getItem('gsp.focusRun'), { timeout: 10000, polling: 100 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('shortest first: while a session runs on these papers with shortest first on, the next paper is the shortest one not finished', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.evaluate(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); l.me = { ...(l.me || {}), focus: { short: true } }; localStorage.setItem('gs.lib', JSON.stringify(l)); });
  await m.goto(srv.url); await appReady(m);
  await openZip(m, await zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ pages: 3 }), 'Bram Sample/Essay.pdf': await makePaper({ pages: 3 }), 'Cleo Madeup/Essay.pdf': await makePaper({ pages: 1 }) }));
  const { id, short } = await m.evaluate(() => { const b = window.__gs.state().batch; return { id: b.id, short: b.students.findIndex(s => (s.files || []).some(f => /Cleo/.test(JSON.stringify([f.name, f.path, f.orig])))) }; }); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.state().cur === 0, { timeout: 60000 });
  // without a session, the next one along
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('n');
  await p.waitForFunction(() => window.__mark.state().cur === 1, { timeout: 10000 });
  // with one on these papers: the shortest paper not finished
  await p.evaluate(id => localStorage.setItem('gsp.focusRun', JSON.stringify({ st: 'run', w: 'mark:' + id, len: 600, at: Date.now(), pg: 0, p0: 0, no: 1 })), id);
  await p.keyboard.press('n');
  assert.ok(short > 1, 'the shortest paper is not the next one along');
  await p.waitForFunction(i => window.__mark.state().cur === i, { timeout: 10000 }, short);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Home: the folder question with Not now for a week; the look back at the week from her chosen day, put away for this week where the current app reads it; and the lesson she worked on last to pick up', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('gs.lib')); l.me = { ...(l.me || {}), focus: { wk: 1 } }; localStorage.setItem('gs.lib', JSON.stringify(l));
    localStorage.setItem('gs.focus', JSON.stringify({ day: '2026-10-27', base: {}, days: { '2026-10-26': { s: 1200, g: 3600, a: { i5: 3600 }, pa: { i5: 4 }, p: 4 } }, pace: [], last: '', add: [] }));
  });
  await plantPlan(p, { lessons: LESSONS.map(l => (l.id === 'L3' ? { ...l, updated: Date.parse('2026-10-27T09:00:00Z') } : l)) });
  await p.goto(srv.url + 'next/#/home');
  await p.waitForSelector('[data-home="week"]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-wk-g]', e => +e.dataset.wkG), 3600, 'an hour of grading since Monday');
  assert.equal(await p.$eval('[data-wk-p]', e => +e.dataset.wkP), 4, 'four papers marked');
  const pick = await p.$eval('[data-home="needs"] [data-kind="pick"]', e => e.textContent);
  assert.ok(pick.includes('Pick up where you left off') && pick.includes('Sonnets: the turn'), pick);
  // no folder yet: Home asks first, and Not now puts it away for a week in this browser (src/safe.js)
  await p.waitForSelector('[data-home="folder"] [data-fask-later]');
  await p.click('[data-fask-later]');
  await p.waitForFunction(() => !document.querySelector('[data-home="folder"]') && +localStorage.getItem('gsc.folderLater') > 0, { timeout: 10000, polling: 100 });
  await p.click('[data-wk-hide]');
  await p.waitForFunction(() => !document.querySelector('[data-home="week"]') && (JSON.parse(localStorage.getItem('gs.focus')) || {}).lbHid === '2026-10-26', { timeout: 10000, polling: 100 });
  const c = await page(ctx, errors);
  await c.goto(srv.url); await appReady(c);
  assert.equal(await c.evaluate(() => window.__gs.gpLookHtml()), '', 'the current app has it put away too');
  await c.close();
  await p.reload(); await p.waitForSelector('[data-home="needs"]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 800)); assert.equal(await p.$('[data-home="week"]'), null, 'still away after a reload');
  assert.deepEqual(errors, []);
  await ctx.close();
});
