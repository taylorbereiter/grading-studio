// Check for an update in Settings > About and updates, for a browser that keeps an older version (next/sw.js, app/update.js):
// pressing it always answers in the card, a slow site or one file that fails once doesn't lose the download, and a worker kept
// from an older version (which says nothing until its whole download is done) still gets an answer from the page itself.
// The site is next/ served from the repo; the older version is the same build with every page and script changed by a comment,
// so the newer one has to be fetched file by file, as a real update is. Made-up saved work only (test/helpers/steady.js).
// npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, PLAN_SETUP } = require('../../../test/helpers/steady.js');

const NEXT = path.join(__dirname, '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp' };
// old: serve the older version. delay: ms before each file of the version is answered. failOnce: a file answered 503 the first time.
const site = { old: false, delay: 0, failOnce: null, asked: [] };
const OLD = { version: '1.28.70-next', build: 'kept-before-the-test' };
const changed = p => /\.(js|html)$/.test(p);
const olden = (p, body) => (changed(p) ? Buffer.concat([body, Buffer.from(p.endsWith('.html') ? '\n<!-- older -->\n' : '\n/* older */\n')]) : body);
let oldVersion = null;
function versionFile() {
  const v = JSON.parse(fs.readFileSync(path.join(NEXT, 'version.json'), 'utf8'));
  if (!site.old) return JSON.stringify(v);
  if (!oldVersion) {
    const files = {};
    for (const [p, sum] of Object.entries(v.files)) files[p] = changed(p) ? crypto.createHash('sha256').update(olden(p, fs.readFileSync(path.join(NEXT, p)))).digest('hex') : sum;
    oldVersion = JSON.stringify({ ...v, ...OLD, files });
  }
  return oldVersion;
}
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/next/') p = '/next/index.html';
    site.asked.push(p);
    const m = /^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.exec(p), f = m && path.join(NEXT, m[1]);
    if (!m || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    const send = () => {
      if (site.failOnce === m[1]) { site.failOnce = null; res.writeHead(503); return res.end(); }
      const body = m[1] === 'version.json' ? versionFile() : site.old ? olden(m[1], fs.readFileSync(f)) : fs.readFileSync(f);
      res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()], 'Cache-Control': 'no-store' }); res.end(body);
    };
    if (site.delay && /^(index\.html|dist\/)/.test(m[1])) setTimeout(send, site.delay); else send();
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

// A teacher who set up here before, on the older version, in a fresh profile: About and updates open, the older version kept whole.
async function onOlderVersion() {
  Object.assign(site, { old: true, delay: 0, failOnce: null });
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.setViewport({ width: 1366, height: 900 });
  await p.goto(srv.url + 'blank');
  const seed = gradingSeed(); seed.idb['gs-lessons'] = { version: 1, stores: { lessons: [], kv: [['setup', PLAN_SETUP]] } };
  await plant(p, seed);
  p.errors = errors; p.ctx = ctx;
  await p.goto(srv.url + 'next/#/settings/about');
  await p.waitForFunction(async b => { const c = (await caches.keys()).includes('gsn-app-1') && await (await caches.open('gsn-app-1')).match(new URL('version.json', location.href).href); return !!c && (await c.json()).build === b; }, { timeout: 60000, polling: 300 }, OLD.build);
  await p.waitForFunction(v => document.querySelector('.setbody').textContent.includes('Version in use: ' + v), { timeout: 20000 }, OLD.version);
  return p;
}
const card = p => p.$eval('.setbody .card', c => c.textContent);
const press = p => p.$$eval('.setbody .card button', bs => bs.find(b => b.textContent === 'Check for an update').click());
const says = (p, text, timeout) => p.waitForFunction(x => document.querySelector('.setbody .card').textContent.includes(x), { timeout, polling: 100 }, text);

test('Check for an update answers at once, and an older version gets the newer one over a slow site where one file fails once', async () => {
  const p = await onOlderVersion();
  const v = JSON.parse(fs.readFileSync(path.join(NEXT, 'version.json'), 'utf8'));
  // The site goes up to the current version; every file waits a little, and one fails the first time it is asked for.
  Object.assign(site, { old: false, delay: 40, failOnce: Object.keys(v.files).find(f => f.startsWith('dist/chunk-')) });
  await press(p);
  // never silent: the card says so at once (Checking…, or how far the download is)
  await p.waitForFunction(() => /Checking for an update…|Getting version/.test(document.querySelector('.setbody .card').textContent), { timeout: 1500, polling: 50 });
  await says(p, 'Version ' + v.version + ' (' + v.build.slice(0, 7) + ') is ready.', 60000);
  assert.equal(site.failOnce, null, 'the failing file was asked for, and asked again');
  await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.$$eval('.setbody .card button', bs => bs.find(b => b.textContent === 'Update now').click())]);
  await p.waitForSelector('.setbody .card', { timeout: 20000 });   // the reloaded page's own card, before reading it
  await says(p, 'Version in use: ' + v.version, 20000);
  // pressing again on the newest version says so
  await press(p);
  await says(p, 'You have the newest version, ' + v.version, 15000);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('a worker kept from an older version that says nothing until it is done: the page asks for the newest worker and answers itself', async () => {
  const p = await onOlderVersion();
  site.old = true;   // nothing newer on the site
  // The kept worker answers state but not the check (an older worker answers it only when its whole download is done).
  await p.evaluate(() => { const c = navigator.serviceWorker.controller, send = c.postMessage.bind(c); c.postMessage = m => { if (!m || m.type !== 'gsn-check') send(m); }; });
  site.asked = [];
  await press(p);
  await says(p, 'Checking for an update…', 1500);
  await says(p, 'You have the newest version, ' + OLD.version, 20000);
  assert.ok(site.asked.includes('/next/sw.js'), 'the browser was asked to look for a newer worker');
  assert.ok(site.asked.includes('/next/version.json'), 'the page looked at the site\'s version itself');
  assert.match(await card(p), /Check for an update/);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
