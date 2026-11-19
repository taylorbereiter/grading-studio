// The shell in a real browser (stage 2): its own service worker beside the current app's, the update control on a phone, the
// keyboard (the command bar, the sidebar, the shortcut list), and every word through t(). The site is served from the repo the way
// the web address serves it, the current app at the root and the new one at next/. Made-up saved work only (test/helpers/steady.js).
// npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, PLAN_SETUP } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
// What the site serves, and nothing else. nextBuild, when set, stands in for next/version.json's build: a newer version going up.
const site = { nextBuild: null };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(f);
    if (p === '/next/version.json' && site.nextBuild) body = JSON.stringify({ ...JSON.parse(body), build: site.nextBuild });
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

// A page in a fresh profile (an incognito context), with the made-up saved work planted first.
async function fresh(width = 1366) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.setViewport({ width, height: width < 700 ? 844 : 900 });
  await p.goto(srv.url + 'blank');
  const seed = gradingSeed(); seed.idb['gs-lessons'] = { version: 1, stores: { lessons: [], kv: [['setup', PLAN_SETUP]] } };
  await plant(p, seed);
  p.errors = errors; p.ctx = ctx; return p;
}
const shellUp = p => p.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 20000 });
const cacheList = p => p.evaluate(async () => { const out = {}; for (const n of (await caches.keys()).sort()) out[n] = (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname).sort(); return out; });

test('the new app’s service worker has its own scope and leaves the current app’s worker and caches alone', async () => {
  const p = await fresh();
  // The current app first, with its worker (?sw=1 turns it on away from https), until it has kept its version.
  await p.goto(srv.url + 'index.html?sw=1#/');
  await p.waitForFunction(async () => (await caches.keys()).includes('gs-app-1') && !!(await (await caches.open('gs-app-1')).match(new URL('version.json', location.href).href)), { timeout: 30000, polling: 300 });
  const before = await cacheList(p);
  await p.goto(srv.url + 'next/#/home'); await shellUp(p);
  await p.waitForFunction(async () => (await caches.keys()).includes('gsn-app-1') && !!(await (await caches.open('gsn-app-1')).match(new URL('version.json', location.href).href)), { timeout: 30000, polling: 300 });
  const regs = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname).sort());
  assert.deepEqual(regs, ['/', '/next/'], 'one worker for each version, each at its own scope');
  const after = await cacheList(p);
  for (const [n, files] of Object.entries(before)) assert.deepEqual(after[n], files, 'the current app’s cache ' + n + ' is as it was');
  for (const n of Object.keys(after)) assert.ok(n in before || /^gsn-/.test(n), 'a cache that is neither the current app’s nor gsn-*: ' + n);
  assert.ok(after['gsn-app-1'].every(f => f.startsWith('/next/')), 'the new app keeps only its own files');
  // The current app's pages are still answered by the current app's worker.
  // (in a new tab of the same profile: the next/ page is left as it is rather than navigated away mid-update)
  const errs = p.errors, q = await p.ctx.newPage(); await p.close();
  await q.goto(srv.url + 'index.html?sw=1#/');
  await q.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 });
  assert.equal(await q.evaluate(() => new URL(navigator.serviceWorker.controller.scriptURL).pathname), '/sw.js');
  assert.deepEqual(errs, []); await p.ctx.close();
});

test('on a phone, a newer version shows Update now on More, and pressing it takes the new version whole', async () => {
  const p = await fresh(390);
  await p.goto(srv.url + 'next/#/more'); await shellUp(p);
  const kept = () => p.evaluate(async () => { const r = await (await caches.open('gsn-app-1')).match(new URL('version.json', location.href).href); return r ? (await r.json()).build : null; });
  // The worker writes version.json last, so a cache without it is still being filled.
  await p.waitForFunction(async () => (await caches.keys()).includes('gsn-app-1') && !!(await (await caches.open('gsn-app-1')).match(new URL('version.json', location.href).href)), { timeout: 30000, polling: 300 });
  const first = await kept(); assert.ok(first);
  site.nextBuild = 'newer-build-for-the-test';
  try {
    await p.reload(); await shellUp(p);
    const btn = await p.waitForSelector('.upd.big [data-focus="update-now"]', { visible: true, timeout: 60000 });   // the sidebar's own is hidden on a phone
    assert.ok(await p.evaluate(() => getComputedStyle(document.querySelector('nav.tabbar')).display !== 'none'), 'the bottom tabs show at 390 px');
    const box = await btn.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= 390, 'Update now is on screen');
    // the same just above the tabs, on every screen (src/phone.js phUpd)
    assert.ok(await p.$eval('nav.tabbar .upd [data-focus="update-now"]', e => e.getBoundingClientRect().height > 0), 'Update now above the tabs');
    // Google sign-in and Sync now on More, as in Settings > Saving and sync
    await p.waitForSelector('[data-moregoogle] [data-svgoogle]');
    await Promise.all([p.waitForNavigation({ timeout: 30000 }), btn.click()]);
    await shellUp(p);
    assert.equal(await kept(), 'newer-build-for-the-test');
  } finally { site.nextBuild = null; }
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('Settings > Display > Phone layout: off keeps a phone laid out as a computer (gs.phone 0, as the current app keeps it), on again takes it away', async () => {
  const p = await fresh(390);
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });   // a phone's screen, as the page reads it
  await p.goto(srv.url + 'next/#/settings/display'); await shellUp(p);
  await p.waitForSelector('[data-stphone] [role="switch"]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-stphone] [role="switch"]', e => e.getAttribute('aria-checked')), 'true');
  await p.click('[data-stphone] [role="switch"]');
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.phone')), '0');
  await p.reload(); await shellUp(p);
  assert.equal(await p.$eval('meta[name=viewport]', e => e.content), 'width=1100', 'a phone lays the page out 1100 wide');
  await p.waitForSelector('[data-stphone] [role="switch"]', { timeout: 30000 });
  await p.click('[data-stphone] [role="switch"]');
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.phone')), null);
  await p.reload(); await shellUp(p);
  assert.equal(await p.$eval('meta[name=viewport]', e => e.content), 'width=device-width,initial-scale=1');
  assert.ok(await p.waitForSelector('[data-stphonewin]', { timeout: 15000 }), 'the phone version can be opened in a narrow window');   // the screen draws after the shell
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('Find has the settings people look for by name, each opening its group', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/home'); await shellUp(p);
  for (const [say, to] of [['Remove from this computer', '#/settings/saving'], ['Start a new school year', '#/settings/saving'], ['Tablet and pencil', '#/settings/marking'], ['App text size', '#/settings/display']]) {
    await p.goto(srv.url + 'next/#/home'); await shellUp(p);
    await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
    await p.waitForSelector('dialog.cmd[open]');
    await p.keyboard.type(say);
    await p.waitForFunction(s => [...document.querySelectorAll('dialog.cmd[open] [role="option"]')].some(o => o.textContent.includes(s)), { timeout: 10000 }, say);
    await p.keyboard.press('Enter');
    await p.waitForFunction(h => location.hash === h, { timeout: 10000 }, to);
  }
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('Find reaches every assignment, each class page, the common jobs and the shortcuts that can run now (src/shell.js findRows; the open assignment\'s students are in mark-out.test.js)', async () => {
  const p = await fresh();
  for (const [say, to] of [['Grade 10 Literature: people', '#/class/c2/people'], ['Add a class', '#/class/new'], ['Show the shortcuts', '#/help/keys'], ['Poetry analysis', '#/mark/gs.b.n2']]) {
    await p.goto(srv.url + 'next/#/home'); await shellUp(p);
    await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
    await p.waitForSelector('dialog.cmd[open]');
    await p.waitForFunction(() => document.activeElement && document.activeElement.matches('dialog.cmd input'));
    await p.keyboard.type(say);
    await p.waitForFunction(s => { const o = document.querySelector('dialog.cmd[open] [role="option"][aria-selected="true"]'); return o && o.textContent.includes(s) && !o.textContent.startsWith('Search inside'); }, { timeout: 10000 }, say);   // not the row that searches inside lessons for what was typed
    await p.keyboard.press('Enter');
    await p.waitForFunction(h => decodeURIComponent(location.hash) === h, { timeout: 10000 }, to);
  }
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('keyboard: the command bar goes to a screen, the sidebar is reachable with Tab, and Shift+? opens the shortcut list', async () => {
  const p = await fresh();
  await p.goto(srv.url + 'next/#/home'); await shellUp(p);
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open]');
  await p.keyboard.type('settings'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => location.hash.startsWith('#/settings'));
  await p.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'H1', { timeout: 5000 });
  // From the screen's heading, Shift+Tab goes back into the sidebar and reaches its links; Enter on one goes there.
  let reached = false;
  for (let i = 0; i < 30 && !reached; i++) { await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); reached = await p.evaluate(() => { const a = document.activeElement; return !!(a && a.closest('[data-shell-nav]') && a.getAttribute('href') === '#/home'); }); }
  assert.ok(reached, 'Home in the sidebar is reached with Shift+Tab');
  await p.keyboard.press('Enter'); await p.waitForFunction(() => location.hash === '#/home');
  await p.keyboard.down('Shift'); await p.keyboard.press('?'); await p.keyboard.up('Shift');
  await p.waitForFunction(() => location.hash === '#/help/keys');
  await p.waitForFunction(() => document.querySelectorAll('main kbd').length > 3, { timeout: 10000 });   // the shortcut list shows the keys
  // Back goes back.
  await p.goBack(); await p.waitForFunction(() => location.hash === '#/home');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('every word on the shell, Home and Settings comes through t() or is the teacher’s own text', async () => {
  for (const w of [1366, 390]) {
    const p = await fresh(w);
    for (const hash of ['#/home', '#/settings/display', '#/settings/about', '#/help/keys', '#/todo', w < 700 ? '#/more' : '#/library']) {
      await p.goto(srv.url + 'next/?keys=1' + hash); await shellUp(p);
      await p.waitForFunction(() => !document.querySelector('[data-loading]'), { timeout: 10000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 400));
      const loose = await p.evaluate(() => {
        const bad = [], ok = s => !/[A-Za-z]/.test(s.replace(/⟦[^⟧]*⟧/g, ''));
        const skip = el => el.closest('[data-raw],code,script,style,svg,kbd,.gic');
        const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) { if (!n.nodeValue.trim() || skip(n.parentElement)) continue; if (!ok(n.nodeValue)) bad.push(n.nodeValue.trim()); }
        for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) for (const a of ['aria-label', 'title', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && !skip(el) && !ok(v)) bad.push(a + '=' + v); }
        return bad;
      });
      // With ?keys=1 every line shows as ⟦key⟧; a word outside the marks did not come through t().
      assert.deepEqual(loose, [], 'words not from t() on ' + hash + ' at ' + w + ' px');
    }
    assert.deepEqual(p.errors, [], 'errors at ' + w + ' px'); await p.ctx.close();
  }
});
