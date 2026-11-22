// Stage 8, slice A: My setup's prompt read before it is copied and a setup chosen as a file (rebuild/audit/gaps.md A-044, A-045),
// and this address moving to a new one (A-046, A-127): the card at the top of Settings > Saving and the once-a-day box, as the
// current app's src/setupin.js and src/moving.js have them. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
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

test('A-044 A-045: My setup’s prompt can be read before it is copied, and a setup saved as a file is chosen and checked at once', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/settings/classes');
  await p.waitForSelector('[data-mysetup] [data-susee]', { timeout: 30000 });
  await p.click('[data-susee]');
  await p.waitForSelector('dialog[open] [data-suprompt]', { timeout: 15000 });
  const text = await p.$eval('[data-suprompt]', e => e.textContent);
  assert.match(text, /gradingStudioSetup/); assert.doesNotMatch(text, /~\/|\/Users\/|C:\\/);
  assert.ok(await p.$('dialog[open] [data-suseecopy]'), 'the box copies it too');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('[data-suprompt]'), { timeout: 5000 });
  // a setup her assistant wrote, saved as a file
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gs-setup-')), 'my-setup.json');
  fs.writeFileSync(f, JSON.stringify({ gradingStudioSetup: 1, classes: [{ name: 'Grade 7 Art', units: ['Colour'], students: ['Made Up One'] }] }));
  const [chooser] = await Promise.all([p.waitForFileChooser({ timeout: 10000 }), p.click('[data-sufile]')]);
  await chooser.accept([f]);
  await p.waitForSelector('[data-supreview] [data-supart="classes"]', { timeout: 15000 });
  assert.match(await p.$eval('textarea[data-supaste], [data-supaste] textarea', e => e.value), /Grade 7 Art/);
  assert.ok(await p.$('[data-suleft]'), 'its student list is left out');
  assert.deepEqual(errors, []); await ctx.close();
});

const move = to => `window.__gsMove = { address: location.origin + '/', movingTo: ${JSON.stringify(to)} };`;
test('A-046 A-127: while this address is moving, Settings > Saving has its card with Take my work with me, and someone with work is asked once a day', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.evaluateOnNewDocument(move('https://new.example.org/'));
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/home');
  // the box, with Later, Open the new address and Take my work with me
  await p.waitForSelector('dialog[open] [data-mvask]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-mvopen]', a => a.href), 'https://new.example.org/');
  assert.equal(await p.$eval('[data-mvask] [data-mvto]', a => a.textContent), 'https://new.example.org/');
  await p.click('[data-mvlater]');
  await p.waitForFunction(() => !document.querySelector('[data-mvask]'), { timeout: 5000 });
  // once a day: not again today
  await p.reload(); await p.waitForSelector('[data-home]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  assert.equal(await p.$('[data-mvask]'), null, 'asked once today');
  // the card at the top of Saving, whose Take my work with me opens the take-home file's box
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svmove] [data-mvtake]', { timeout: 30000 });
  assert.equal(await p.$eval('.card', e => e.hasAttribute('data-svmove')), true, 'it comes first');
  await p.click('[data-svmove] [data-mvtake]');
  await p.waitForSelector('dialog[open] [data-svp1]', { timeout: 15000 });
  await p.keyboard.press('Escape');
  // tomorrow the box asks again, and Take my work with me goes straight to the file's box
  await p.evaluate(() => localStorage.setItem('gsc.moveSeen', 'a day before'));
  await p.goto(srv.url + 'next/#/home'); await p.reload();
  await p.waitForSelector('dialog[open] [data-mvask]', { timeout: 30000 });
  await p.click('dialog[open] [data-mvtake]');
  await p.waitForSelector('dialog[open] [data-svp1]', { timeout: 15000 });
  assert.deepEqual(errors, []); await ctx.close();
});

test('A-046: nothing is said at the new address, or to a browser with no work', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.evaluateOnNewDocument(`window.__gsMove = { address: 'https://old.example.org/', movingTo: location.origin + '/' };`);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svsafe]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  assert.equal(await p.$('[data-svmove]'), null); assert.equal(await p.$('[data-mvask]'), null);
  const q = await page(ctx, errors);
  await q.evaluateOnNewDocument(move('https://new.example.org/'));
  await q.goto(srv.url + 'blank'); await q.evaluate(() => localStorage.clear());
  await q.goto(srv.url + 'next/#/');
  await q.waitForSelector('[data-welcome]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  assert.equal(await q.$('[data-mvask]'), null, 'a fresh browser is not asked');
  assert.deepEqual(errors, []); await ctx.close();
});
