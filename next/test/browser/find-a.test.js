// Stage 8, slice A: Find anything (the command bar) reaches what the current app's Find reached from any screen
// (rebuild/audit/gaps.md A-006, A-007, A-009, A-010, A-011, A-012, A-013). Each row is pressed and its effect seen.
// Made-up saved work only (test/helpers/steady.js). npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, PLAN_SETUP } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/next/') p = '/next/index.html';
    const ok = /^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p), f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

// A fresh profile with the made-up work, plus one download kept in this browser that no card holds, and an assistant chosen.
async function fresh() {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.setViewport({ width: 1366, height: 900 });
  await p.goto(srv.url + 'blank');
  const seed = gradingSeed(); seed.idb['gs-lessons'] = { version: 1, stores: { lessons: [], kv: [['setup', PLAN_SETUP]] } };
  seed.idb['grading-studio-keep'].stores.meta.push(['gs.b.loose', { id: 'gs.b.loose', name: 'Lab report drafts', n: 3, scored: 0, t: Date.parse('2026-10-25T12:00:00Z'), papers: 3 }]);
  seed.ls['gs.words'] = JSON.stringify({ ai: 'Gemini' });
  await plant(p, seed);
  p.errors = errors; p.ctx = ctx; return p;
}
const shellUp = p => p.waitForSelector('[data-shell-nav]', { timeout: 20000 });
// Opens Find, types, and waits for a row whose label is exactly the text; returns its text with what is beside it.
async function find(p, text) {
  if (!await p.$('dialog.cmd[open]')) { await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await p.waitForSelector('dialog.cmd[open] input'); }
  await p.$eval('dialog.cmd[open] input', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.type('dialog.cmd[open] input', text);
  return p.waitForFunction(t => { const r = [...document.querySelectorAll('dialog.cmd[open] [role=option]')].find(o => (o.querySelector('b,.lbl,span') || o).textContent.trim() === t || o.textContent.trim().startsWith(t)); return r ? r.textContent : null; }, { timeout: 15000, polling: 200 }, text).then(h => h.jsonValue());
}
async function press(p, text) {
  await find(p, text);
  await p.evaluate(t => [...document.querySelectorAll('dialog.cmd[open] [role=option]')].find(o => o.textContent.trim().startsWith(t)).click(), text);
}

test('A-006, A-007, A-010: To do by week, Examples and Learning goals are found from any screen', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/home'); await shellUp(p);
  await press(p, 'To do, by week'); await p.waitForFunction(() => location.hash === '#/todo/week', { timeout: 10000 });
  await press(p, 'Examples'); await p.waitForFunction(() => location.hash === '#/library/examples', { timeout: 10000 });
  await press(p, 'Learning goals'); await p.waitForFunction(() => location.hash === '#/settings/grading', { timeout: 10000 });
  await p.waitForFunction(() => document.querySelector('main').textContent.includes('Learning goals'), { timeout: 15000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('A-009: a download kept in this browser that no card holds is found, and opens', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/home'); await shellUp(p);
  // found by its name, and by where it is kept
  await find(p, 'Lab report drafts');
  await p.$eval('dialog.cmd[open] input', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.type('dialog.cmd[open] input', 'Kept in this browser');
  await p.waitForFunction(() => [...document.querySelectorAll('dialog.cmd[open] [role=option]')].some(o => o.textContent.includes('Lab report drafts')), { timeout: 10000 });
  await press(p, 'Lab report drafts');
  await p.waitForFunction(() => location.hash === '#/mark/gs.b.loose', { timeout: 10000 });
  await p.ctx.close();
});

test('A-011: Dark mode and Light mode switch the look in one press, back to the light look she had', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/settings/display'); await shellUp(p);
  await p.click('[data-shell-nav] [role=radio][aria-label="Ocean"]').catch(async () => { await p.evaluate(() => [...document.querySelectorAll('[data-shell-nav] [role=radio]')][2].click()); });
  await p.waitForFunction(() => document.documentElement.dataset.look === 'ocean');
  await press(p, 'Dark mode'); await p.waitForFunction(() => document.documentElement.dataset.look === 'midnight', { timeout: 5000 });
  await press(p, 'Light mode'); await p.waitForFunction(() => document.documentElement.dataset.look === 'ocean', { timeout: 5000 });
  assert.equal(await p.evaluate(() => location.hash), '#/settings/display', 'the screen stays where it was');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('A-012: Screenshot starts from a screen other than marking', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/calendar'); await shellUp(p);
  await press(p, 'Screenshot');
  await p.waitForSelector('[data-sniplayer]', { timeout: 15000 });
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('[data-sniplayer]'), { timeout: 5000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('A-013: her assistant opens beside Grading Studio from Find', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/home'); await shellUp(p);
  await find(p, 'Open Gemini beside');
  await new Promise(r => setTimeout(r, 600));   // Settings' rest is fetched as Find opens, so the window opens at once on the press
  const opened = new Promise(r => p.ctx.once('targetcreated', t => r(t)));
  await press(p, 'Open Gemini beside Grading Studio');
  const tg = await Promise.race([opened, new Promise(r => setTimeout(() => r(null), 10000))]);
  assert.ok(tg, 'a window opened');
  const w = await tg.page(); if (w) await w.waitForFunction(() => location.href !== 'about:blank', { timeout: 10000 }).catch(() => {});
  assert.match(tg.url(), /gemini\.google\.com|about:blank/);
  await p.ctx.close();
});
