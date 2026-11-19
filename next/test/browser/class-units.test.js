// Units on the class page of the new app (stage 4, part c): + Unit, Rename, an assignment moved with Move to…, and a unit deleted
// at once and brought back with Undo, each one undo step; the current app reads the same library. npm run next:browser. Made-up classes only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { makePaper } = require('../../../test/helpers/fixtures.js');

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

test('an assignment row: early returns shown on the row, and its details say how many are scored, partial, missing and returned early', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const seed = withCard(), meta = seed.idb['grading-studio-keep'].stores.meta, n2 = meta.find(([id]) => id === 'gs.b.n2')[1];
  Object.assign(n2, { n: 6, scored: 3, partial: 1, off: 1, sent: 2, sentT: Date.parse('2026-10-24T09:00') });
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-item="i5"] [data-wearly]', { timeout: 60000 });
  assert.equal(await p.$eval('[data-item="i5"] [data-wearly]', e => e.textContent), 'Returned 2/5');
  assert.equal(await p.$('[data-wdet="i5"]'), null, 'details start closed');
  await p.click('[data-wmore="i5"]');
  await p.waitForSelector('[data-wdet="i5"]');
  assert.equal(await p.$eval('[data-wmore="i5"]', e => e.getAttribute('aria-expanded')), 'true');
  assert.equal(await p.$eval('[data-wdet="i5"] [data-wsay]', e => e.textContent), '3 of 5 scored · 1 partial · 1 missing or excused');
  const more = await p.$eval('[data-wdet="i5"]', e => e.textContent);
  assert.match(more, /2 students got theirs early/);
  assert.match(more, /aren’t kept in this browser/, 'no papers here, so no ways to the marking steps');
  assert.equal(await p.$('[data-wdet="i5"] [data-wgo]'), null);
  // an assignment with no papers yet says so; the details close again
  await p.click('[data-wmore="i9"]');
  await p.waitForSelector('[data-wdet="i9"]');
  assert.match(await p.$eval('[data-wdet="i9"]', e => e.textContent), /No papers yet/);
  await p.click('[data-wmore="i5"]');
  await p.waitForFunction(() => !document.querySelector('[data-wdet="i5"]'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Files to match to a roster: outside files matched to the class names, one fixed by hand, opened as the assignment\'s papers for that class', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-match-'));
  const files = [['Aria Testwell speech.pdf', 'Aria'], ['Cleo notes.pdf', 'Cleo'], ['untitled.pdf', 'Who']].map(([n, title]) => { const f = path.join(dir, n); return f; });
  for (const f of files) fs.writeFileSync(f, await makePaper({ title: path.basename(f) }));
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => /match to a roster/.test(e.textContent)));
  const [ch] = await Promise.all([p.waitForFileChooser(), p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /match to a roster/.test(e.textContent)).click())]);
  await ch.accept(files);
  await p.waitForSelector('[data-mr]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-mrcls]', e => e.value), 'c1');
  const tags = await p.$$eval('[data-mrrow]', rs => rs.map(r => [r.querySelector('.bf-path').textContent, r.querySelector('select').value, r.lastElementChild.textContent]));
  assert.deepEqual(tags, [['Aria Testwell speech.pdf', '0', 'Matched by name'], ['Cleo notes.pdf', '2', 'Check'], ['untitled.pdf', '-1', 'Choose']]);
  assert.match(await p.$eval('[data-mrmissing]', e => e.textContent), /No file yet: Bram Sample, Dov Madeup, Esme Placeholder, Finn Example/);
  await p.select('[data-mrto="2"]', '5');
  assert.equal(await p.$eval('[data-mrgo]', e => e.textContent), 'Open 3 files for 3 students');
  await p.click('[data-mrgo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  const got = await p.evaluate(() => { const b = window.__mark.state().batch; return { cls: b.classId, have: b.students.filter(s => s.files.length).map(s => [s.key, s.files.map(f => f.name)]) }; });
  assert.equal(got.cls, 'c1');
  assert.deepEqual(got.have.sort(), [['Aria Testwell', ['Aria Testwell speech.pdf']], ['Cleo Fixture', ['Cleo notes.pdf']], ['Finn Example', ['untitled.pdf']]]);
  assert.equal((await libOf(p)).classes[0].units[0].items.find(i => i.id === 'i9').batchId != null, true, 'the card is linked to the papers');
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});
