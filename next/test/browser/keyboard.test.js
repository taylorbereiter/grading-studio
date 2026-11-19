// Keyboard runs (stage 6 brief): To do and Settings worked from the keys alone. N reaches the to-do box from anywhere, Enter adds,
// Tab reaches the new line's tick and Space ticks it; in Settings, Tab reaches a group in the list and Enter opens it, a choice is
// changed with the arrow keys, and a set of colours is one stop that the arrow keys move through. npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

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

async function page(ctx, errors, width = 1440) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: 900 });
  return p;
}
const lib = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
// Tab (or Shift Tab) until the focused thing matches, at most n presses; the number taken.
async function tabTo(p, sel, n = 60, back = false) {
  for (let i = 1; i <= n; i++) {
    if (back) await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); if (back) await p.keyboard.up('Shift');
    if (await p.evaluate(s => !!document.activeElement && document.activeElement.matches(s), sel)) return i;
  }
  throw new Error('Tab never reached ' + sel);
}

test('keyboard run, To do: N from anywhere, a line typed and added with Enter, its tick reached with Tab and ticked with Space', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/todo');
  await p.waitForSelector('[data-td-new]', { timeout: 30000 });
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('n');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-td-new]'), { timeout: 5000 });
  await p.keyboard.type('Call the office about the field trip');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => ((JSON.parse(localStorage.getItem('gs.lib')).todo || {}).items || []).some(i => /field trip/.test(i.x)), { timeout: 10000, polling: 100 });
  const it = (await lib(p)).todo.items.find(i => /field trip/.test(i.x));
  await p.waitForSelector('[data-td-tick="' + it.id + '"]', { timeout: 10000 });   // drawn once the save is read back
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-td-new]'), { timeout: 5000 });
  const n = await tabTo(p, '[data-td-tick="' + it.id + '"]');
  assert.ok(n < 40, 'the new line is ' + n + ' presses from the box');
  await p.keyboard.press('Space');
  await p.waitForFunction(id => ((JSON.parse(localStorage.getItem('gs.lib')).todo || {}).items || []).some(i => i.id === id && i.done), { timeout: 10000, polling: 100 }, it.id);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('keyboard run, Settings: a group opened from the list with Enter, a length changed with the arrow keys, and a colour set as one stop', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/settings/classes');
  await p.waitForSelector('.setnav', { timeout: 30000 });
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await tabTo(p, '.setnav a[href="#/settings/focus"]');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => location.hash === '#/settings/focus');
  await p.waitForSelector('select[data-fc-len]', { timeout: 30000 });
  const was = await p.$eval('select[data-fc-len]', e => e.value);
  await tabTo(p, 'select[data-fc-len]');
  await p.keyboard.press('ArrowDown');
  await p.waitForFunction(w => { const f = (JSON.parse(localStorage.getItem('gs.lib')).me || {}).focus || {}; return f.len && String(f.len) !== w; }, { timeout: 10000, polling: 100 }, was);
  // Marking: the colours of the ✗ and the pen are one stop; the arrow keys move along them and Space picks one
  await p.evaluate(() => { location.hash = '#/settings/marking'; });
  await p.waitForSelector('[data-sgink]', { timeout: 30000 });
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await tabTo(p, '[data-sgink]');
  const first = await p.evaluate(() => document.activeElement.dataset.sgink);
  await p.keyboard.press('ArrowRight');
  const next = await p.evaluate(() => document.activeElement.dataset.sgink);
  assert.notEqual(next, first, 'the arrow moved along the colours');
  await p.keyboard.press('Space');
  await p.waitForFunction(k => JSON.parse(localStorage.getItem('gs.ink') || 'null') === k || localStorage.getItem('gs.ink') === k, { timeout: 10000, polling: 100 }, next);
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => !!document.activeElement.closest('[data-sgink]') || document.activeElement.hasAttribute('data-sgink')), false, 'Tab leaves the colours in one press');
  assert.deepEqual(errors, []);
  await ctx.close();
});
