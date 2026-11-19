// Settings > Grading and scales, Marking and Classes and terms in the new app (stage 4, part c): how she usually grades, the usual
// row scale, where each letter starts, the points colour and the unit plan tool's name; the current app reads the same. npm run next:browser.
// Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
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

let browser, srv, dir;
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-sg-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}

const lib = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
const undoToast = async p => { await p.waitForFunction(() => [...document.querySelectorAll('.toast button')].some(b => b.textContent.trim() === 'Undo')); await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent.trim() === 'Undo').click()); };
const until = async (f, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return v; await new Promise(r => setTimeout(r, 100)); } };
// What the current app makes of the same saved work: what a new assignment starts with, and the words the Planner reads
async function current(ctx) {
  const q = await ctx.newPage(); await q.evaluateOnNewDocument(STEADY);
  await q.goto(srv.url + 'index.html'); await q.waitForFunction(() => window.__gs && window.__gs.DEFAULT_SETUP, { timeout: 60000 });
  const out = await q.evaluate(() => ({ d: JSON.parse(JSON.stringify(window.__gs.DEFAULT_SETUP)), words: JSON.parse(localStorage.getItem('gs.words') || 'null') }));
  await q.close(); return out;
}

test('how she usually grades: letters with where each letter starts, Undo, the usual row scale; the next assignment starts from it in both apps', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/settings/grading');
  await p.waitForSelector('[data-sgway="letters"]', { timeout: 60000 });
  assert.ok(await p.$('[data-sgnone]'), 'not chosen yet says so');
  await p.click('[data-sgway="letters"]');
  await until(async () => ((await lib(p)).me || {}).grade);
  let L = await lib(p);
  assert.equal(L.me.grade.way, 'letters'); assert.deepEqual(L.me.grade.bands, [[90, 'A'], [80, 'B'], [70, 'C'], [60, 'D'], [0, 'F']]);
  assert.equal(L.me.unit, 'Atlas', 'what she had stays');
  assert.equal((await ls(p, 'gs.setup')).outOf, 100);
  await p.waitForSelector('[data-sgbp="1"]');
  await p.$eval('[data-sgbp="1"]', e => { e.focus(); e.value = ''; }); await p.type('[data-sgbp="1"]', '82'); await p.keyboard.press('Tab');
  await until(async () => (await lib(p)).me.grade.bands[1][0] === 82);
  assert.deepEqual((await lib(p)).me.grade.bands[1], [82, 'B']);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  assert.ok(await until(async () => (await lib(p)).me.grade.bands[1][0] === 80), 'Ctrl+Z puts the letter back');
  let c = await current(ctx);
  assert.equal(c.d.outOf, 100); assert.equal(c.d.mode, 'points');
  // rubric rows, scored 0 to 6 without half points
  await p.click('[data-sgway="rubric"]');
  await p.waitForSelector('[data-sgtop]');
  await p.select('[data-sgtop]', '6');
  await until(async () => (await ls(p, 'gs.setup')).top === 6);
  await p.$eval('.sg-rows [role="switch"]', b => b.click());
  await until(async () => (await ls(p, 'gs.setup')).half === false);
  L = await lib(p);
  assert.equal(L.me.grade.way, 'rubric'); assert.equal(L.me.grade.setup.top, 6); assert.equal(L.me.grade.setup.half, false); assert.ok(!L.me.grade.bands);
  c = await current(ctx);
  assert.equal(c.d.mode, 'rubric'); assert.equal(c.d.top, 6); assert.equal(c.d.half, false);
  // the way change, undone with its toast: letters come back, with its last setup
  await p.click('[data-sgway="percent"]'); await undoToast(p);
  assert.ok(await until(async () => (await lib(p)).me.grade.way === 'rubric'));
  assert.equal((await ls(p, 'gs.setup')).top, 6);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('mark colours, points colour, paper and text, and the unit plan tool name: kept, said, undone, and read by the current app and the Planner', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/settings/marking');
  await p.waitForSelector('[data-sgpts="credit"]', { timeout: 60000 });
  await p.click('[data-sgpts="credit"]');
  assert.equal(await ls(p, 'gs.ptsInk'), 'credit');
  await p.click('[data-sgpts=""]');
  assert.equal(await ls(p, 'gs.ptsInk'), null);
  await p.click('[data-sgpts="blue"]');
  assert.equal(await ls(p, 'gs.ptsInk'), 'blue');
  await p.click('[data-sgink="purple"]'); assert.equal(await ls(p, 'gs.ink'), 'purple');
  await p.click('[data-sgchk="blue"]'); assert.equal(await ls(p, 'gs.checkInk'), 'blue');
  await p.evaluate(() => [...document.querySelectorAll('.seg button, [role=radio]')].find(b => b.textContent.trim() === 'Fit whole page').click());
  await p.evaluate(() => [...document.querySelectorAll('.seg button, [role=radio]')].find(b => b.textContent.trim() === 'Roomy').click());
  const d = await ls(p, 'gs.disp'); assert.equal(d.fit, 'page'); assert.equal(d.dlh, 1.8);
  await p.goto(srv.url + 'blank'); await p.goto(srv.url + 'next/#/settings/classes');
  await p.waitForSelector('[data-sgunit]', { timeout: 60000 });
  assert.equal(await p.$eval('[data-sgunit]', e => e.value), 'Atlas');
  await p.$eval('[data-sgunit]', e => { e.focus(); e.value = ''; }); await p.type('[data-sgunit]', 'Unit Planner'); await p.keyboard.press('Enter');
  await until(async () => ((await lib(p)).me || {}).unit === 'Unit Planner');
  assert.ok(await until(async () => ((await lib(p)).me || {}).unit === 'Unit Planner'));
  let c = await current(ctx);
  assert.equal(c.words.unit, 'Unit Planner');
  await undoToast(p);
  assert.ok(await until(async () => !(await lib(p)).me), 'Undo puts back a library with no setup of her own');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('while marking, saved comments and the mark key: the list kept or folded, Enter, a comment added, changed, moved and removed with Undo, a mark renamed and its meaning changed and put back; kept under the current app\'s keys', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/settings/marking');
  await p.waitForSelector('[data-sglist] [role="switch"]', { timeout: 60000 });
  await p.click('[data-sglist] [role="switch"]'); assert.equal(await ls(p, 'gs.listOpen'), false);
  await p.click('[data-sglist] [role="switch"]'); assert.equal(await ls(p, 'gs.listOpen'), true);
  await p.click('[data-sgenter] [role="switch"]'); assert.equal(await ls(p, 'gs.enterNext'), false);
  await p.click('[data-sgenter] [role="switch"]'); assert.equal(await ls(p, 'gs.enterNext'), null);
  // saved comments: two added (newest first), the second moved up, one changed, one taken out with Undo
  await p.waitForSelector('[data-sgcbnew]');
  for (const c of ['Good evidence.', 'Check your spelling.']) { await p.type('[data-sgcbnew]', c); await p.click('[data-sgcbadd]'); await until(async () => ((await ls(p, 'gs.bank')) || []).includes(c)); }
  assert.deepEqual(await ls(p, 'gs.bank'), ['Check your spelling.', 'Good evidence.']);
  await p.click('[data-sgcbup="1"]');
  assert.ok(await until(async () => (await ls(p, 'gs.bank'))[0] === 'Good evidence.'));
  await p.$eval('[data-sgcb="1"] input', e => { e.focus(); e.select(); }); await p.keyboard.type('Check spelling and capitals.'); await p.keyboard.press('Enter');
  assert.ok(await until(async () => (await ls(p, 'gs.bank'))[1] === 'Check spelling and capitals.'));
  await p.click('[data-sgcbrm="0"]');
  assert.ok(await until(async () => (await ls(p, 'gs.bank')).length === 1));
  await undoToast(p);
  assert.ok(await until(async () => JSON.stringify(await ls(p, 'gs.bank')) === JSON.stringify(['Good evidence.', 'Check spelling and capitals.'])), 'Undo puts the comment back where it was');
  // H-012: one taken out, then a comment comes in from elsewhere (a sync, another tab), then Undo: both are there
  await p.click('[data-sgcbrm="0"]');
  assert.ok(await until(async () => (await ls(p, 'gs.bank')).length === 1));
  await p.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['From the phone.', 'Check spelling and capitals.'])));
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  assert.ok(await until(async () => JSON.stringify(await ls(p, 'gs.bank')) === JSON.stringify(['From the phone.', 'Good evidence.', 'Check spelling and capitals.'])), 'H-012 Undo keeps the comment that came in since');
  await p.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['Good evidence.', 'Check spelling and capitals.'])));
  // the mark key: the key page off, a mark renamed and its meaning changed, then put back to the usual wording
  await p.click('[data-sgmkon] [role="switch"]'); assert.equal((await ls(p, 'gs.markKey')).on, false);
  await p.$eval('[data-sgmk="sp"] input', e => { e.focus(); e.select(); }); await p.keyboard.type('Spell check'); await p.keyboard.press('Enter');
  assert.ok(await until(async () => ((await ls(p, 'gs.markKey')).names || {}).sp === 'Spell check'));
  await p.$$eval('[data-sgmk="sp"] input', l => { l[1].focus(); l[1].select(); }); await p.keyboard.type('Look this word up.'); await p.keyboard.press('Enter');
  assert.ok(await until(async () => ((await ls(p, 'gs.markKey')).means || {}).sp === 'Look this word up.'));
  await p.click('[data-sgmkusual="sp"]');
  const k = await ls(p, 'gs.markKey'); assert.ok(!(k.names || {}).sp && !('sp' in (k.means || {})), 'back to the usual wording');
  // typing on straight away in the next box: the save of the box just left never takes back what she has started typing
  await p.waitForFunction(() => document.querySelector('[data-sgmk="sp"] input') && !document.querySelector('[data-sgmkusual="sp"]'));
  await p.$eval('[data-sgmk="sp"] input', e => { e.focus(); e.select(); });
  await p.waitForFunction(() => document.activeElement && document.activeElement.closest('[data-sgmk="sp"]'));
  await p.keyboard.type('Sp'); await p.keyboard.press('Tab'); await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control');
  await p.keyboard.type('Spelling, look it up.'); await p.keyboard.press('Tab');
  assert.ok(await until(async () => { const m = await ls(p, 'gs.markKey'); return (m.names || {}).sp === 'Sp' && (m.means || {}).sp === 'Spelling, look it up.'; }), 'both boxes kept');
  assert.deepEqual(await p.$$eval('[data-sgmk="sp"] input', l => l.map(e => e.value)), ['Sp', 'Spelling, look it up.']);
  // the current app reads the same saved comments and mark key
  const q = await ctx.newPage(); await q.evaluateOnNewDocument(STEADY);
  await q.goto(srv.url); await q.waitForFunction(() => window.__gs && window.__gs.state, { timeout: 60000 });
  assert.deepEqual(await q.evaluate(() => JSON.parse(localStorage.getItem('gs.bank'))), ['Good evidence.', 'Check spelling and capitals.']);
  await q.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});
