// The welcome in the new app (src/welcome.js; next/src/app/screens/welcome.jsx): a browser nobody has used yet opens on three questions, and the answers become her
// classes and her own settings, which the current app reads the same; a browser with work, or one opened on another screen, is
// never asked; from the welcome she can look around the sample instead. npm run next:browser. Every class here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plant, appReady } = require('../../../test/helpers/app.js');

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
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);

test('a browser nobody has used: three questions, and her classes, her school\'s system and how she grades are kept where the current app reads them', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/');
  await p.waitForSelector('[data-welcome] [data-wlc="0"]', { timeout: 30000 });
  await p.waitForFunction(() => document.activeElement && document.activeElement.dataset.wlc === '0');
  await p.keyboard.type('Biology 9');
  await p.type('[data-wlc="1"]', 'Chemistry 11');
  await p.type('[data-wlc="2"]', 'Biology 9');   // the same name twice is one class
  await p.waitForSelector('[data-wlc="3"]');   // a new empty line once the last one has something in it
  await p.select('[data-wlsys]', 'Canvas');
  await p.click('[data-wlnext]');
  await p.waitForSelector('[data-wlway="points"]');
  await p.click('[data-wlway="points"]');
  await p.click('[data-wlnext]');
  await p.waitForSelector('[data-wlnext]');
  assert.ok(await p.$('[data-wlback]'), 'Back is there from the second question on');
  await p.click('[data-wlnext]');
  await p.waitForFunction(() => !document.querySelector('[data-welcome]'), { timeout: 10000 });
  const lib = await ls(p, 'gs.lib');
  assert.deepEqual(lib.classes.map(c => c.name), ['Biology 9', 'Chemistry 11']);
  assert.equal(lib.me.sys, 'Canvas'); assert.equal(lib.me.grade.way, 'points'); assert.ok(lib.me.hi > 0, 'asked, so not asked again');
  assert.equal(lib.me.ai, '', 'no assistant named for her');
  await p.waitForFunction(() => [...document.querySelectorAll('[data-shell-nav] a')].some(a => a.textContent.includes('Chemistry 11')));
  // opened again: not asked
  await p.reload(); await p.waitForSelector('[data-shell-nav]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 800)); assert.equal(await p.$('[data-welcome]'), null);
  // the current app reads the same classes and settings
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const m = await old.evaluate(() => ({ cls: [...document.querySelectorAll('#railClasses a[data-railcls]')].map(a => a.textContent).join(' | '), sys: window.__gs.sysName(), asked: !window.__gs.wlShown() }));
  assert.ok(m.cls.includes('Biology 9') && m.cls.includes('Chemistry 11'), m.cls);
  assert.equal(m.sys, 'Canvas'); assert.equal(m.asked, true);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the welcome is not for a browser with work, nor for one opened on another screen; from it she can bring her work in instead', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/'); await p.waitForSelector('[data-shell-nav]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 800)); assert.equal(await p.$('[data-welcome]'), null, 'a browser with work is never asked');
  const q = await (await browser.createBrowserContext()).newPage();
  await q.evaluateOnNewDocument(STEADY); await q.setViewport({ width: 1440, height: 900 });
  await q.goto(srv.url + 'next/#/settings'); await q.waitForSelector('[data-shell-nav]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 800)); assert.equal(await q.$('[data-welcome]'), null, 'opened on another screen: not asked');
  await q.goto(srv.url + 'next/#/home'); await q.reload();
  await q.waitForSelector('[data-welcome] [data-wlbring]', { timeout: 30000 });
  await q.click('[data-wlbring]');
  await q.waitForFunction(() => location.hash === '#/settings/saving' && !document.querySelector('[data-welcome]'));
  assert.equal(await q.evaluate(() => localStorage.getItem('gs.lib')), null, 'nothing kept for her by leaving');
  await q.browserContext().close();
  assert.deepEqual(errors, []);
  await ctx.close();
});
