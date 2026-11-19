// Languages in the new app (stage 6, item 9): a teacher who chose a language in either version sees the new app in it, with the
// current app's own wording (next/lang/<code>.json); a name she typed stays as typed; choosing another in Settings starts the page
// again in it. Every student and class here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/next/') p = '/next/index.html';
    const ok = /^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function fresh(lang) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  if (lang) await p.evaluate(l => localStorage.setItem('gs.lang', JSON.stringify(l)), lang);
  p.errors = errors; p.ctx = ctx; return p;
}
const navText = p => p.$$eval('[data-shell-nav] a, [data-shell-nav] button', l => l.map(e => e.textContent.trim()).join(' | '));

test('a language chosen in the current app: the new app opens in it, with the current app\'s wording, and class names stay as typed', async () => {
  const p = await fresh('de');
  await p.goto(srv.url + 'next/#/');
  await p.waitForSelector('[data-shell-nav]', { timeout: 30000 });
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'de');
  const nav = await navText(p);
  for (const w of ['Kalender', 'Bibliothek', 'Einstellungen', 'Hilfe']) assert.ok(nav.includes(w), w + ' in ' + nav);
  const names = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).classes.map(c => c.name));
  for (const n of names) assert.ok(nav.includes(n), 'the class name ' + n + ' as typed');
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
  // a language outside the Latin letters: its chunk carries the letters as themselves (next/build.js), and they arrive whole
  const j = await fresh('ja');
  await j.goto(srv.url + 'next/#/');
  await j.waitForSelector('[data-shell-nav]', { timeout: 30000 });
  assert.ok((await navText(j)).includes('設定'), 'Japanese Settings in ' + await navText(j));
  assert.deepEqual(j.errors, []);
  await j.ctx.close();
});

test('choosing a language in Settings starts the page again in it, and English comes back the same way', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/settings/display');
  await p.waitForSelector('[data-shell-nav] select, main select', { timeout: 30000 });
  assert.ok((await navText(p)).includes('Calendar'));
  const sel = await p.$$eval('main select', l => l.findIndex(s => [...s.options].some(o => o.value === 'es')));
  const handle = (await p.$$('main select'))[sel];
  await Promise.all([p.waitForNavigation({ timeout: 20000 }), handle.select('es')]);
  await p.waitForSelector('[data-shell-nav]', { timeout: 30000 });
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.lang'))), 'es', 'kept as the current app keeps it');
  assert.ok((await navText(p)).includes('Calendario'), await navText(p));
  await p.waitForFunction(i => document.querySelectorAll('main select')[i], {}, sel);
  await Promise.all([p.waitForNavigation({ timeout: 20000 }), (await p.$$('main select'))[sel].select('en')]);
  await p.waitForSelector('[data-shell-nav]', { timeout: 30000 });
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.lang')), null, 'English is no setting at all');
  assert.ok((await navText(p)).includes('Calendar'));
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});
