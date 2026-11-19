// Past work beside this one on the new marking screen (stage 4, b2): the student's scores and comments from other downloads, matched
// through the roster; a close name or one from another class stays hidden until Same student, and the current app reads the same answer.
// npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
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

let browser, srv, zip, dir;
before(async () => { srv = await serveSite(); browser = await launch(); zip = zipOf(await standardFiles()); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-past-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const KEY = 'Bram Sample';
const CRIT = ['Thesis', 'Evidence', 'Style'], SETUP = { mode: 'rubric', criteria: CRIT, outOf: 10, scale: { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 } };
const g = (rubric, comment = '', more = {}) => ({ f: {}, h: {}, g: { rubric, points: '', comment, ...more } });
const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
function savedWork() {
  const lib = { classes: [{ id: 'c1', name: '12EL-1', names: NAMES, units: [] }, { id: 'c2', name: '11EL-2', names: ['Aria Testwell', 'Nia Elsewhere'], units: [] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const past1 = { t: Date.UTC(2026, 8, 20), cls: 'c1', setup: SETUP, s: { 'Testwell, Aria': g([3.5, 3.5, 3.5], 'PAST-COMMENT strong thesis'), 'Bram Sampel': g([2, 2, 2], 'TYPO-COMMENT needs evidence') } };
  const past2 = { t: Date.UTC(2025, 8, 20), cls: 'c2', setup: SETUP, s: { 'Aria Testwell': g([1, 1, 1], 'OTHER-CLASS-COMMENT') } };
  const rec = (id, name, more) => [id, { id, name, n: 4, t: Date.UTC(2026, 8, 21), ...more }];
  return { ls: { 'gs.lib': JSON.stringify(lib), 'gs.b.past1': JSON.stringify(past1), 'gs.b.past2': JSON.stringify(past2) },
    idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta: [rec('gs.b.past1', 'River essay'), rec('gs.b.past2', 'Last year quiz')] } } } };
}

test('past work: the sure match shows with its score and comment, a close name waits for Same student, and the current app reads the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, savedWork());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zip);
  const id = await m.evaluate(() => window.__gs.state().batch.id);
  await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const at = k => p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), k);
  await p.click('[data-st="' + await at('Aria Testwell') + '"]');
  await p.waitForSelector('[data-pw]', { timeout: 30000 });
  assert.match(await p.$eval('[data-pwsum]', e => e.textContent), /Past work.*1 earlier · last 93%.*1 to check/);
  await p.click('[data-pwsum]');
  await p.waitForFunction(() => document.querySelector('[data-pw]').open);
  const aria = await p.$eval('[data-pw]', e => e.textContent);
  assert.match(aria, /River essay/); assert.match(aria, /PAST-COMMENT strong thesis/); assert.match(aria, /10\.5 \/ 12 · 93%/);
  assert.match(aria, /The same name, but in 11EL-2\. It may be someone else\./);
  assert.doesNotMatch(aria, /OTHER-CLASS-COMMENT/, 'hidden until she says');
  // Bram: a close name, shown once she says it is him; Undo hides it again
  await p.click('[data-st="' + await at('Bram Sample') + '"]');
  await p.waitForSelector('[data-pwask="Bram Sampel"]', { timeout: 30000 });
  assert.match(await p.$eval('[data-pw]', e => e.textContent), /The name is close, but it isn’t a sure match/);
  assert.doesNotMatch(await p.$eval('[data-pw]', e => e.textContent), /TYPO-COMMENT/);
  await p.click('[data-pwask="Bram Sampel"] [data-pwsame]');
  await p.waitForFunction(() => /TYPO-COMMENT needs evidence/.test(document.querySelector('[data-pw]').textContent));
  assert.match(await p.$eval('[data-pw]', e => e.textContent), /You said “Bram Sampel” is this student\./);
  const said = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.histSame')));
  assert.deepEqual(Object.values(said), [1]);
  // the current app reads her answer the same way
  const m2 = await page(ctx, errors);
  await m2.goto(srv.url); await appReady(m2);
  await m2.evaluate(id => window.__gs.reopenKept(id), id);
  await m2.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  await m2.waitForFunction(() => { try { const b = window.__gs.state().batch; return window.__gs.histFind(b.students.find(s => s.key === 'Bram Sample'), [{ id: 'gs.b.past1', cls: 'c1', s: { 'Bram Sampel': { rubric: [2, 2, 2], comment: 'x' } }, setup: null, t: 1, name: 'River essay' }]).sure.length === 1; } catch { return false; } }, { timeout: 30000 });
  await m2.close();
  // and Undo in the new app takes it back
  await p.click('[data-pwback]');
  await p.waitForSelector('[data-pwask="Bram Sampel"]');
  assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.histSame'))), {});
  assert.deepEqual(errors, []);
  await ctx.close();
});
