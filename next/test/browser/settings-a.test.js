// Stage 8, slice A: Settings rows (rebuild/audit/gaps.md A-028 to A-033, A-035, A-039, A-040) as the current app's src/settings.js has
// them: Classes and rosters, the language that couldn't be fetched, Terms and weights and the rubric bank. Every student is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

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
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await p.setBypassServiceWorker(true);
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 1000 });
  return p;
}


const until = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return v; await new Promise(r => setTimeout(r, 100)); } };
const lib = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
async function open(ctx, errors, where, s = gradingSeed()) {
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, s);
  await p.goto(srv.url + 'next/#/settings/' + where);
  return p;
}
const menuItem = (p, text) => p.evaluate(x => { const m = [...document.querySelectorAll('[role="menuitem"]')].find(e => e.textContent.includes(x)); if (m) m.click(); return !!m; }, text);

test('A-028 to A-033: Settings > Classes lists each class with its roster and link, opens it, edits its name and roster and its link, and has Add a class and From Google Classroom…', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await open(ctx, errors, 'classes');
  await p.waitForSelector('[data-stclasses] [data-stcls="c1"]', { timeout: 30000 });
  assert.match(await p.$eval('[data-stcls="c1"]', e => e.textContent), /Grade 9 English.*6 students.*No Class page link/s);
  assert.equal(await p.$eval('[data-stcls-add]', a => a.getAttribute('href')), '#/class/new');
  // its link, from its menu, saved through the class page's own box
  await p.click('[data-stcls="c1"] [data-stcls-menu]'); await p.waitForSelector('[role="menuitem"]', { visible: true });
  assert.ok(await menuItem(p, 'Add the Class page link'));
  await p.waitForSelector('dialog[open] [data-clink-url]');
  await p.type('dialog[open] [data-clink-url] input, dialog[open] input[data-clink-url]', 'https://school.example.org/class/9e');
  await p.click('[data-clink-save]');
  await p.waitForFunction(() => /Class page link saved/.test(document.querySelector('[data-stcls="c1"]').textContent), { timeout: 15000 });
  // Name and roster: the class page's roster box
  await p.click('[data-stcls="c2"] [data-stcls-menu]'); await p.waitForSelector('[role="menuitem"]', { visible: true });
  assert.ok(await menuItem(p, 'Name and roster'));
  await p.waitForSelector('dialog[open] textarea', { timeout: 15000 });
  assert.match(await p.$eval('dialog[open] textarea', e => e.value), /\S/);
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open] textarea'));
  // From Google Classroom…
  await p.click('[data-stcls-gc]');
  await p.waitForSelector('dialog[open]', { timeout: 15000 });
  assert.match(await p.$eval('dialog[open]', e => e.textContent), /Google Classroom/);
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  // Open: the class's page
  await p.click('[data-stcls="c1"] [data-stcls-open]');
  await p.waitForFunction(() => location.hash === '#/class/c1', { timeout: 10000 });
  assert.equal((await lib(p)).classes.find(c => c.id === 'c1').mb, 'https://school.example.org/class/9e');
  // No classes yet
  const s = gradingSeed(), l = JSON.parse(s.ls['gs.lib']); l.classes = []; s.ls['gs.lib'] = JSON.stringify(l);
  const q = await open(ctx, errors, 'classes', s);
  await q.waitForSelector('[data-stcls-none]', { timeout: 30000 });
  assert.match(await q.$eval('[data-stcls-none]', e => e.textContent), /No classes yet/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-039 A-040: Settings > Grading has Terms and weights with Term setup, and the rubric bank with its count', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await open(ctx, errors, 'grading');
  await p.waitForSelector('[data-stterms] [data-stterms-open]', { timeout: 30000 });
  assert.deepEqual(await p.$$eval('[data-stterm]', l => l.map(e => e.textContent)), ['Term 1Aug 10 to Dec 18']);
  assert.match(await p.$eval('[data-stweights]', e => e.textContent), /50%/);
  await p.click('[data-stterms-open]');
  await p.waitForSelector('[data-setup] [data-term-add]', { timeout: 15000 });
  await p.click('[data-term-add]');
  const day = (f, v) => p.evaluate((f, v) => { const el = document.querySelector('[data-term-row="1"] [data-tf="' + f + '"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, f, v);
  await day('start', '2027-01-04'); await day('end', '2027-06-11');
  await p.click('[data-setup-save]');
  await p.waitForFunction(() => document.querySelectorAll('[data-stterm]').length === 2, { timeout: 15000 });
  assert.equal((await lib(p)).book.terms.length, 2);
  await p.waitForSelector('[data-stbank-n]', { timeout: 15000 });
  assert.match(await p.$eval('[data-stbank-n]', e => e.textContent), /You have .*saved rubric.* and .*saved grading scale/);
  await p.click('[data-stbank-open]');
  await p.waitForFunction(() => location.hash === '#/library/rubrics', { timeout: 10000 });
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-035: a language that could not be fetched says so in Settings > Display, and the visit is in English', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const de = fs.readdirSync(path.join(ROOT, 'next/dist')).filter(f => /\.js$/.test(f) && fs.readFileSync(path.join(ROOT, 'next/dist', f), 'utf8').includes('konnte gerade nicht geladen werden'));
  assert.equal(de.length, 1, 'the German Settings lines are one chunk');
  const p = await page(ctx, errors);
  await p.setRequestInterception(true);
  p.on('request', r => (r.url().endsWith('/' + de[0]) ? r.abort() : r.continue()));
  await p.goto(srv.url + 'blank'); const s = gradingSeed(); s.ls['gs.lang'] = '"de"'; await plant(p, s);
  await p.goto(srv.url + 'next/#/settings/display');
  await p.waitForSelector('[data-stlangmiss]', { timeout: 30000 });
  assert.match(await p.$eval('[data-stlangmiss]', e => e.textContent), /Deutsch could not be fetched just now, so this visit is in English/);
  assert.deepEqual(errors.filter(e => !/Failed to fetch dynamically imported module|net::ERR_FAILED/.test(e)), []); await ctx.close();
});
