// The shell in a real browser: the root's service worker beside the previous version's (classic/), the update control on a phone,
// the previous version's addresses landing on the new screens, the keyboard (the command bar, the sidebar, the shortcut list), and
// every word through t(). The site is served from the repo the way the web address serves it: the new app at the root, the previous
// version at classic/ (since the switch). Made-up saved work only (test/helpers/steady.js).
// npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { holdWorkIndex } = require('./classseed.js');
const { gradingSeed, PLAN_SETUP } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
// What the site serves, and nothing else. nextBuild, when set, stands in for version.json's build: a newer version going up.
const site = { nextBuild: null };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html'; if (p === '/classic/') p = '/classic/index.html';
    // Since the switch: the new app at the root, the previous version at classic/, and next/'s page and retiring worker.
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/dist\/[\w-]+\.(js|css|woff2|webp)$|^\/classic\/(index\.html|planner\.html|sw\.js|version\.json|sample\.js|lang\/[\w-]+\.js)$|^\/next\/(index\.html|sw\.js)$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(f);
    if (p === '/version.json' && site.nextBuild) body = JSON.stringify({ ...JSON.parse(body), build: site.nextBuild });
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

const whole = (p, name, at) => p.waitForFunction(async (name, at) => (await caches.keys()).includes(name) && !!(await (await caches.open(name)).match(new URL(at, location.origin).href)), { timeout: 30000, polling: 300 }, name, at);

test('the root’s worker and the previous version’s each keep to their own scope and caches', async () => {
  const p = await fresh();
  await p.goto(srv.url + '#/home'); await shellUp(p);
  await whole(p, 'gs-app-2', '/version.json');
  // Settings, About opens the previous version, which keeps its own worker (?sw=1 turns it on away from https) and its own caches.
  await p.goto(srv.url + '#/settings/about'); await shellUp(p);
  const prev = await p.waitForSelector('a[data-focus="previous-version"]');
  assert.equal(await prev.evaluate(a => a.href), srv.url + 'classic/');
  await p.goto(srv.url + 'classic/?sw=1#/');
  await p.waitForSelector('#rail', { timeout: 30000 });
  await whole(p, 'gsc-app-1', '/classic/version.json');
  const regs = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname).sort());
  assert.deepEqual(regs, ['/', '/classic/'], 'one worker for each version, each at its own scope');
  assert.equal(await p.evaluate(() => new URL(navigator.serviceWorker.controller.scriptURL).pathname), '/classic/sw.js');
  const c = await cacheList(p);
  assert.deepEqual(Object.keys(c), ['gs-app-2', 'gsc-app-1'], 'no cache but each version’s own');
  assert.ok(c['gs-app-2'].every(f => !/^\/(classic|next)\//.test(f)) && c['gs-app-2'].includes('/index.html') && c['gs-app-2'].includes('/planner.html'), 'the root keeps only the new app’s files');
  assert.deepEqual(c['gsc-app-1'], ['/classic/index.html', '/classic/planner.html', '/classic/version.json'], 'classic/ keeps only its own pages');
  // The way back: About in the previous version opens the new one.
  await p.goto(srv.url + 'classic/?sw=1#/settings/about');
  const back = await p.waitForSelector('#setAbout a[data-newapp]', { timeout: 30000 });
  assert.equal(await back.evaluate(a => a.href), srv.url);
  await p.goto(srv.url + '#/home'); await shellUp(p);
  assert.equal(await p.evaluate(() => new URL(navigator.serviceWorker.controller.scriptURL).pathname), '/sw.js');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('the previous version’s addresses, the Planner’s and next/ land on the matching new screen', async () => {
  const p = await fresh();
  const lands = async (url, want) => { await p.goto(srv.url + url); await p.waitForFunction(w => location.pathname === '/' && location.hash === w, { timeout: 15000 }, want).catch(() => {}); assert.equal(await p.evaluate(() => location.pathname + location.hash), '/' + want, url); };
  await lands('#/a/b123/grades/sheet', '#/mark/b123/grades');
  await lands('#/a/b123', '#/mark/b123');
  await lands('#/class/c1/gradebook', '#/class/c1/grades');
  await lands('#/class/c1/students/2', '#/class/c1/people/2');
  await lands('#/settings/claude', '#/settings/ai');
  await lands('#/settings/keys', '#/help/keys');
  await lands('#/help/return', '#/help/return');   // a help topic of the new app's too
  await lands('#/plans', '#/calendar');
  await lands('#/scores/c1', '#/class/c1/grades');
  await lands('planner.html#rubrics', '#/library/rubrics');
  await lands('planner.html#timetable', '#/settings/timetable');
  await lands('planner.html#present/L1/A1', '#/lesson/L1/slides');
  await lands('planner.html', '#/week');
  await lands('next/#/calendar', '#/calendar');
  // the new app's own addresses stay as they are, and Google's sign-in coming back is never taken for a screen
  await lands('#/class/c1/people', '#/class/c1/people');
  await p.goto(srv.url + '#access_token=abc&state=1'); await shellUp(p);
  assert.ok(await p.$('main h1'), 'Home is drawn');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('on a phone, a newer version shows Update now on More, and pressing it takes the new version whole', async () => {
  const p = await fresh(390);
  await p.goto(srv.url + '#/more'); await shellUp(p);
  const kept = () => p.evaluate(async () => { const r = await (await caches.open('gs-app-2')).match(new URL('version.json', location.href).href); return r ? (await r.json()).build : null; });
  await p.waitForFunction(async () => (await caches.keys()).includes('gs-app-2'), { timeout: 30000, polling: 300 });
  // The worker writes version.json last, so a cache without it is still being filled.
  await p.waitForFunction(async () => !!(await (await caches.open('gs-app-2')).match(new URL('version.json', location.href).href)), { timeout: 30000, polling: 300 });
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
  await p.waitForFunction(() => localStorage.getItem('gs.phone') === '0', { timeout: 10000 });   // the setting is kept a moment after the press
  await p.reload(); await shellUp(p);
  assert.equal(await p.$eval('meta[name=viewport]', e => e.content), 'width=1100', 'a phone lays the page out 1100 wide');
  await p.waitForSelector('[data-stphone] [role="switch"]', { timeout: 30000 });
  await p.click('[data-stphone] [role="switch"]');
  await p.waitForFunction(() => localStorage.getItem('gs.phone') === null, { timeout: 10000 });
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
    await p.waitForSelector('dialog.cmd[open] [role="combobox"]:focus');
    await p.keyboard.type(say);
    // The lesson-search option also contains the query. Enter runs the selected option.
    await p.waitForFunction(label => document.querySelector('dialog.cmd[open] [role="option"][aria-selected="true"]')?.textContent === label, { timeout: 10000 }, say);
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

test('Find keeps the selected assignment available while its next refresh reads the papers index', async () => {
  const p = await fresh();
  try {
    await p.goto(srv.url + 'next/#/help/keys'); await p.waitForSelector('main kbd');
    const openFind = async () => {
      await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
      await p.waitForSelector('dialog.cmd[open] [role="combobox"]:focus');
    };
    const selected = () => document.querySelector('dialog.cmd [aria-selected="true"]')?.textContent === 'Poetry analysis';
    await openFind(); await p.keyboard.type('Poetry analysis');
    await p.waitForFunction(selected);
    await p.keyboard.press('Escape'); await p.waitForSelector('dialog.cmd[open]', { hidden: true });

    await holdWorkIndex(p);
    await p.evaluate(() => {
      const getKeys = IDBObjectStore.prototype.getAllKeys;
      IDBObjectStore.prototype.getAllKeys = function (...args) {
        if (this.name === 'meta' && this.transaction.db.name === 'grading-studio-keep') {
          IDBObjectStore.prototype.getAllKeys = getKeys;
          window.findReadPending = true;
        }
        return getKeys.apply(this, args);
      };
    });
    await openFind();
    await p.waitForFunction(() => window.findReadPending, { timeout: 10000 });
    await p.keyboard.type('Poetry analysis');
    assert.ok(await p.evaluate(selected), 'the assignment stays selected while the index is busy');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => location.hash === '#/mark/gs.b.n2', { timeout: 10000 });
    await p.evaluate(() => window.releaseWorkIndex());
    assert.deepEqual(p.errors, []);
  } finally { await p.ctx.close(); }
});

test('keyboard: the command bar goes to a screen, the sidebar is reachable with Tab, and Shift+? opens the shortcut list', async () => {
  const p = await fresh();
  await p.goto(srv.url + '#/home'); await shellUp(p);
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

async function delayedBack(useSidebar) {
  const p = await fresh();
  try {
    await p.setViewport({ width: 1280, height: 560 });
    await p.goto(srv.url + 'next/#/class/c1/work'); await p.waitForSelector('[data-newasg]');
    const top = await p.$eval('main', el => {
      el.querySelector('#tab-work').focus({ preventScroll: true });
      el.scrollTop = 485;
      return el.scrollTop;
    });
    assert.ok(top > 0, 'the saved position is below the top');
    await p.evaluate(() => { location.hash = '#/help/keys'; });
    await p.waitForSelector('main[data-route="help/keys"] h1:focus');

    await holdWorkIndex(p);
    await p.goBack();
    await p.waitForSelector('main[data-route="class/c1/work"] [aria-busy="true"]');
    let sidebarControl, sidebarTop;
    if (useSidebar) {
      await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift');
      sidebarControl = await p.waitForSelector('[data-shell-nav] :focus');
      sidebarTop = await p.$eval('main', el => el.scrollTop);
    }
    // A slow read outlasts the former route timer. The full scroll area only exists after release.
    await p.evaluate(() => new Promise(resolve => setTimeout(() => { window.releaseWorkIndex(); resolve(); }, 100)));
    await p.waitForSelector('[data-newasg]');
    if (useSidebar) {
      assert.ok(await sidebarControl.evaluate(el => el === document.activeElement), 'focus stays on the chosen sidebar control');
      assert.equal(await p.$eval('main', el => el.scrollTop), sidebarTop);
    } else {
      await p.waitForFunction(top => document.activeElement.id === 'tab-work' && document.querySelector('main').scrollTop === top, { timeout: 10000 }, top);
    }
    assert.deepEqual(p.errors, []);
  } finally { await p.ctx.close(); }
}
test('Back restores the class tab and scroll position after its assignments finish loading', () => delayedBack(false));
test('Shift+Tab into the sidebar during Back keeps the new focus and scroll position', () => delayedBack(true));

for (const [route, ready] of [['home', '[data-home="say"]'], ['time', '[data-tk-page]']]) {
  test(route + ' focuses the loaded heading on first navigation and browser Forward', async () => {
    const p = await fresh();
    try {
      await p.goto(srv.url + 'next/#/help/keys'); await p.waitForSelector('main kbd');
      for (const warm of [false, true]) {
        await holdWorkIndex(p);
        if (warm) await p.goForward();
        else await p.evaluate(to => { location.hash = '#/' + to; }, route);
        await p.waitForSelector('main[data-route="' + route + '"] h1');
        await p.evaluate(() => window.releaseWorkIndex());
        await p.waitForSelector(ready);
        assert.ok(await p.$eval('main h1', el => el === document.activeElement), 'the loaded heading has focus');
        if (!warm) { await p.goBack(); await p.waitForSelector('main kbd'); }
      }
      assert.deepEqual(p.errors, []);
    } finally { await p.ctx.close(); }
  });
}

test('Back after an arrow-key tab change returns focus to the selected class tab', async () => {
  const p = await fresh();
  try {
    await p.goto(srv.url + 'next/#/class/c1/work'); await p.waitForSelector('[data-newasg]');
    await p.focus('#tab-work'); await p.keyboard.press('ArrowRight');
    await p.waitForSelector('#tab-people[aria-selected="true"]:focus');
    await p.goBack(); await p.waitForSelector('#tab-work[aria-selected="true"]');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'tab-work');
    await p.goForward(); await p.waitForSelector('#tab-people[aria-selected="true"]:focus');
    assert.deepEqual(p.errors, []);
  } finally { await p.ctx.close(); }
});

test('every word on the shell, Home and Settings comes through t() or is the teacher’s own text', async () => {
  for (const w of [1366, 390]) {
    const p = await fresh(w);
    for (const hash of ['#/home', '#/settings/display', '#/settings/about', '#/help/keys', '#/todo', w < 700 ? '#/more' : '#/library']) {
      await p.goto(srv.url + '?keys=1' + hash); await shellUp(p);
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
