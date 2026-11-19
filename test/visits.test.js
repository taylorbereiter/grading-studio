// The daily count of browsers that open the app (src/visits.js). Nothing reaches the real counter: every request a page makes is
// answered here, the app's own address from this folder and the counter by a stand-in that only writes down what it was asked.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { openApp } = require('./helpers/app');
const BASE = require('./helpers/base');   // the current app's pages: classic/ since the switch

const ROOT = path.join(__dirname, '..'), HOME = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8')).address;
const COUNTER = 'https://abacus.jasoncameron.dev/';
const TYPES = { html: 'text/html', js: 'text/javascript', json: 'application/json', png: 'image/png', webmanifest: 'application/manifest+json' };
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// A page that believes it is at the app's own address. asked lists every request that went to the counter.
async function atHome({ webdriver = false } = {}) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), asked = [];
  page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
  await page.setBypassServiceWorker(true);
  if (!webdriver) await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (u.startsWith(COUNTER)) { asked.push({ url: u, referer: r.headers().referer || '', cookie: r.headers().cookie || '' }); return r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"value":1}' }); }
    if (u.startsWith(HOME)) {
      let rel = new URL(u).pathname.slice(new URL(HOME).pathname.length) || 'index.html';
      const f = path.join(ROOT, rel);
      if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) return r.respond({ status: 200, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.respond({ status: 404, body: '' });
    }
    r.abort();
  });
  return { page, asked, close: () => ctx.close() };
}
const today = () => new Date().toISOString().slice(0, 10);
const wait = ms => new Promise(r => setTimeout(r, ms));

test('only the pages at the web address carry the count, never the double-click copies', () => {
  for (const f of ['index.html', 'planner.html']) assert.equal(fs.readFileSync(path.join(BASE, f), 'utf8').split(COUNTER).length, 2, f);
  for (const f of ['Grading Studio.html', 'Planner.html']) assert.equal(fs.readFileSync(path.join(BASE, f), 'utf8').includes(COUNTER), false, f);
  // the new app's page at the main address counts too, with the very same lines
  assert.equal(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split(COUNTER).length, 2, 'the new app');
});

test('a browser at the address is counted once a day, as new the first time, and nothing else is sent', async () => {
  const { page, asked, close } = await atHome();
  await page.goto(HOME, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => localStorage.getItem('gsc.counted'), { timeout: 15000 });
  await wait(500);
  const d = today();
  assert.deepEqual(asked.map(a => a.url.slice(COUNTER.length)), ['hit/gradingstudio-app-v1/day-' + d, 'hit/gradingstudio-app-v1/new-' + d]);
  assert.ok(asked.every(a => !a.referer && !a.cookie), 'no referrer and no cookie');
  await page.goto(HOME + 'planner.html', { waitUntil: 'domcontentloaded' });
  await page.goto(HOME, { waitUntil: 'domcontentloaded' });
  await wait(6500);
  assert.equal(asked.length, 2, 'not again the same day, on either page');
  // The next day (as far as this browser knows) counts once more, and not as new.
  await page.evaluate(() => localStorage.setItem('gsc.counted', '2000-01-01'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => localStorage.getItem('gsc.counted') !== '2000-01-01', { timeout: 15000 });
  await wait(500);
  assert.deepEqual(asked.slice(2).map(a => a.url.slice(COUNTER.length)), ['hit/gradingstudio-app-v1/day-' + d]);
  await close();
});

test('not in the sample, not under test automation, and not counted when the counter cannot be reached', async () => {
  let { page, asked, close } = await atHome();
  await page.goto(HOME + 'version.json');
  await page.evaluate(() => localStorage.setItem('gs.sampleOn', '1'));
  await page.goto(HOME, { waitUntil: 'domcontentloaded' });
  await wait(6500);
  assert.equal(asked.length, 0, 'the sample is never counted');
  await close();

  ({ page, asked, close } = await atHome({ webdriver: true }));
  await page.goto(HOME, { waitUntil: 'domcontentloaded' });
  await wait(6500);
  assert.equal(asked.length, 0, 'a browser driven by a test is never counted');
  await close();

  ({ page, asked, close } = await atHome());
  page.removeAllListeners('request');
  page.on('request', r => r.url().startsWith(COUNTER) ? r.abort('internetdisconnected') : r.url().startsWith(HOME) ? r.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(BASE, 'index.html')) }) : r.abort());
  await page.goto(HOME, { waitUntil: 'domcontentloaded' });
  await wait(6500);
  assert.equal(await page.evaluate(() => localStorage.getItem('gsc.counted')), null, 'tried again next time the app opens');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a page anywhere else (here, this computer) is never counted', async () => {
  const { page, close } = await openApp(browser);
  const asked = []; page.on('request', r => { if (r.url().startsWith(COUNTER)) asked.push(r.url()); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(6500);
  assert.equal(asked.length, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('gsc.counted')), null);
  await close();
});
