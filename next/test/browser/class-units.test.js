// Units on the class page of the new app (stage 4, part c): + Unit, Rename, an assignment moved with Move to…, and a unit deleted
// at once and brought back with Undo, each one undo step; the current app reads the same library. npm run next:browser. Made-up classes only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
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
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20' }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
const libOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
const units = l => l.classes[0].units.map(u => ({ name: u.name, items: u.items.map(i => i.id) }));
const undoToast = p => p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => /Undo/.test(b.textContent)).click());
const pickItem = async (p, trigger, re) => {
  await p.click(trigger);
  await p.waitForFunction(re => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => new RegExp(re).test(e.textContent)), {}, re);
  await p.evaluate(re => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => new RegExp(re).test(e.textContent)).click(), re);
};

test('units on the class page: added, renamed, an assignment moved into one, and the unit deleted and brought back with Undo; the current app reads the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  const start = units(await libOf(p));

  // + Unit: named and added at the end
  await p.click('[data-addunit]');
  await p.waitForSelector('dialog[open] input[data-uname]');
  await p.$eval('dialog[open] input[data-uname]', e => e.select());
  await p.type('dialog[open] input[data-uname]', 'Poetry');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.name === 'Poetry'));
  const poetry = (await libOf(p)).classes[0].units.find(u => u.name === 'Poetry').id;
  await p.waitForSelector(`[data-unit="${poetry}"]`);

  // Rename
  await pickItem(p, `[data-umenu="${poetry}"]`, '^Rename');
  await p.waitForSelector('dialog[open] input[data-uname]');
  await p.$eval('dialog[open] input[data-uname]', e => e.select());
  await p.type('dialog[open] input[data-uname]', 'Poems');
  await p.click('dialog[open] [data-uok]');
  await p.waitForFunction(id => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.find(u => u.id === id).name === 'Poems', {}, poetry);

  // Move to… the Speech card into Poems
  await pickItem(p, '[data-more-for="i9"]', '^Move to');
  await p.waitForSelector(`dialog[open] [data-moveto="${poetry}"]`);
  await p.click(`dialog[open] [data-moveto="${poetry}"]`);
  await p.waitForFunction(id => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.find(u => u.id === id).items.some(i => i.id === 'i9'), {}, poetry);
  await p.waitForSelector(`[data-unit="${poetry}"] [data-item="i9"]`);
  const moved = units(await libOf(p));

  // Delete unit: at once, and Undo brings it back with its assignment
  await pickItem(p, `[data-umenu="${poetry}"]`, '^Delete unit');
  await p.waitForFunction(id => !JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.id === id), {}, poetry);
  await p.waitForFunction(id => !document.querySelector(`[data-unit="${id}"]`), {}, poetry);
  await undoToast(p);
  await p.waitForFunction(id => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.id === id), {}, poetry);
  assert.deepEqual(units(await libOf(p)), moved, 'Undo put the unit back, its assignment too');
  await p.waitForSelector(`[data-unit="${poetry}"] [data-item="i9"]`);
  assert.equal(start.length + 1, moved.length);
  await p.close();

  // the current app's class page shows the same units
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  assert.deepEqual(await m.evaluate(() => window.__gs.state().lib.classes[0].units.map(u => ({ name: u.name, items: u.items.map(i => i.id) }))), moved);
  assert.deepEqual(errors, []);
  await ctx.close();
});
