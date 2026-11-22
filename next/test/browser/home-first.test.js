// Stage 8, slice A: Home and the first run, as the current app's Today and welcome have them (rebuild/audit/gaps.md A-077, A-139,
// A-901, A-072, A-078, A-079): a sample class from before with its card, the welcome's language, Google and the phone on Home's
// header, the folder question's line for a folder she already has, and each of today's classes with its to-dos. Made-up work only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { gradingSeed, PLAN_SETUP, STEADY } = require('../../../test/helpers/steady.js');
const { fakeDrive } = require('./fakedrive.js');

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

const NOW = Date.parse('2026-10-27T10:20:00Z');
async function page(ctx, errors, D) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await p.setBypassServiceWorker(true);
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 1000 });
  if (D) await D.hook(p);
  return p;
}
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const metaKeys = p => p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => { const q = r.result.transaction('meta').objectStore('meta').getAllKeys(); q.onsuccess = () => { res(q.result); r.result.close(); }; }; }));
function seed(more) {
  const s = gradingSeed();
  s.ls['gsc.folderLater'] = String(NOW);
  s.idb['gs-lessons'] = { version: 1, stores: { lessons: [], kv: [['setup', PLAN_SETUP]] } };
  if (more) { const lib = JSON.parse(s.ls['gs.lib']); more(lib, s); s.ls['gs.lib'] = JSON.stringify(lib); }
  return s;
}
async function home(ctx, errors, s, D) {
  const p = await page(ctx, errors, D);
  await p.goto(srv.url + 'blank'); await plant(p, s);
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-home="teach"]', { timeout: 30000 });
  return p;
}

test('A-077: a sample class from before has its card on Home: Set up my own classes, Open the sample papers, and Remove the sample class', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const s = seed((lib, s) => {
    lib.me = { sys: '', unit: '' };   // a browser from before the three questions
    lib.classes.push({ id: 'smp', name: 'Sample class', sample: true, names: ['Ada Madeup', 'Ben Standin'], units: [{ id: 'su', name: 'Sample unit', items: [{ id: 'si', name: 'Sample essay', classId: 'smp', type: 'sum', batchId: 'gs.b.smp' }] }] });
    s.ls['gs.b.smp'] = JSON.stringify({ t: NOW - 864e5, cls: 'smp', s: {} });
    s.idb['grading-studio-keep'].stores.meta.push(['gs.b.smp', { id: 'gs.b.smp', name: 'Sample essay', n: 2, scored: 0, t: NOW - 864e5, asg: 'si' }]);
  });
  let p = await home(ctx, errors, s);
  await p.waitForSelector('[data-home="oldsample"]', { timeout: 15000 });
  assert.match(await p.$eval('[data-home="oldsample"]', e => e.textContent), /You’re looking at a sample class.*made up/s);
  // never asked the three questions here: Set up my own classes opens them
  await p.click('[data-os-setup]');
  await p.waitForSelector('[data-welcome]', { timeout: 15000 });
  await p.reload(); await p.waitForSelector('[data-home="oldsample"]', { timeout: 30000 });
  await p.click('[data-os-open]');
  await p.waitForFunction(() => location.hash === '#/class/smp', { timeout: 10000 });
  await p.goto(srv.url + 'next/#/home'); await p.waitForSelector('[data-home="oldsample"] [data-os-rm]', { timeout: 30000 });
  await p.click('[data-os-rm]');
  await p.waitForFunction(() => !document.querySelector('[data-home="oldsample"]'), { timeout: 20000 });
  const lib = await ls(p, 'gs.lib');
  assert.deepEqual(lib.classes.map(c => c.id), ['c1', 'c2'], 'the sample class is gone and her own stay');
  const keys = await metaKeys(p);
  assert.ok(!keys.includes('gs.b.smp') && keys.includes('gs.b.n1'), 'its papers are forgotten, hers are kept: ' + JSON.stringify(keys));
  assert.ok((await ls(p, 'gs.tomb') || {})['gs.b.smp'], 'its tombstone, so a folder or Drive lets it go too');
  // the current app opens the library as it is now
  const old = await page(ctx, errors); await old.goto(srv.url); await appReady(old);
  assert.deepEqual(await old.evaluate(() => window.__gs.state().lib.classes.map(c => c.id)), ['c1', 'c2']);
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-077: once the three questions were answered, the card has no Set up my own classes', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const s = seed(lib => { lib.me = { sys: '', unit: '', hi: NOW }; lib.classes.push({ id: 'smp', name: 'Sample class', sample: true, names: [], units: [] }); });
  const p = await home(ctx, errors, s);
  await p.waitForSelector('[data-home="oldsample"] [data-os-open]', { timeout: 15000 });
  assert.equal(await p.$('[data-os-setup]'), null);
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-139: the welcome has the language picker; a language picked there draws the questions again in it', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/');
  await p.waitForSelector('[data-welcome] [data-wllang] select', { timeout: 30000 });
  assert.equal(await p.$eval('[data-wllang] select', e => e.value), 'en');
  const nav = p.waitForNavigation({ timeout: 20000 });
  await p.select('[data-wllang] select', 'es');
  await nav;
  await p.waitForSelector('[data-welcome] [data-wllang] select', { timeout: 30000 });
  assert.equal(await ls(p, 'gs.lang'), 'es');
  assert.equal(await p.$eval('[data-wllang] select', e => e.value), 'es');
  const h = await p.$eval('#wlH', e => e.textContent), lead = await p.$eval('[data-wlnext]', e => e.textContent);
  assert.ok(h && !/Mark papers/.test(h), 'the heading is not the English one: ' + h);
  assert.notEqual(lead, 'Continue');
  assert.equal(await ls(p, 'gs.lib'), null, 'nothing of hers was made by picking a language');
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-901 A-078 A-079: Home’s header signs in with Google and out again, shows the account and its state, and has Use on your phone; the folder question says a folder she has brings her work back', async () => {
  const errors = [], D = fakeDrive(), ctx = await browser.createBrowserContext();
  const s = seed(); delete s.ls['gsc.folderLater'];
  const p = await home(ctx, errors, s, D);
  await p.waitForSelector('[data-home="folder"] [data-fask-have]', { timeout: 15000 });
  assert.equal(await p.$eval('[data-fask-have]', e => e.textContent), 'Already have a Grading Studio folder? Choose it and your work comes back.');
  await p.waitForSelector('.hello [data-hg-in]', { timeout: 15000 });
  await p.click('.hello [data-hg-in]');
  await p.waitForSelector('.hello [data-hg-acct]', { timeout: 20000 });
  assert.match(await p.$eval('[data-hg-acct]', e => e.textContent), /Google: teacher@example\.com/);
  assert.equal(await ls(p, 'gs.gEmail'), 'teacher@example.com');
  // Use on your phone: the QR code of this page and the steps
  await p.click('.hello [data-gphone]');
  await p.waitForSelector('[data-phhow] svg', { timeout: 15000 });
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('[data-phhow]'), { timeout: 5000 });
  // the account's menu: Sync now and Sign out
  await p.click('[data-hg-acct]');
  await p.waitForSelector('[role="menuitem"]', { visible: true });
  const items = await p.$$eval('[role="menuitem"]', l => l.map(e => e.textContent));
  assert.deepEqual(items, ['Sync now', 'Sign out']);
  await p.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].find(e => e.textContent === 'Sign out').click());
  await p.waitForSelector('.hello [data-hg-in]', { timeout: 10000 });
  assert.equal(await ls(p, 'gs.gEmail'), null);
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-072: each of today’s classes says how many of its to-dos are for today or late, and opens its To do tab', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), t0 = NOW - 3 * 864e5;
  const line = (id, x, d, c, done = 0) => ({ id, x, d, c, who: '', a: '', rep: '', note: '', done, made: t0, t: t0 });
  const s = seed(lib => { lib.todo = { items: [line('t1', 'Return the quizzes', '2026-10-27', 'c1'), line('t2', 'Seating changes', '2026-10-26', 'c1'), line('t3', 'Next week', '2026-10-30', 'c1'), line('t4', 'Done already', '2026-10-27', 'c1', t0), line('t5', 'Not for a class', '2026-10-27', '')] }; });
  const p = await home(ctx, errors, s);
  await p.waitForSelector('[data-ttodo]', { timeout: 15000 });
  assert.deepEqual(await p.$$eval('[data-home="teach"] [data-ttodo]', l => l.map(a => [a.dataset.ttodo, a.textContent, a.hash])), [['c1', '2 to do', '#/class/c1/todo']]);
  await p.click('[data-ttodo="c1"]');
  await p.waitForFunction(() => location.hash === '#/class/c1/todo', { timeout: 10000 });
  assert.deepEqual(errors, []); await ctx.close();
});
