// Rubric setup on the new marking screen (stage 4, part c): rows renamed, taken out and added, what a score means, a grading scale,
// Save as one undo step, and a made-up rubric PDF brought in for every student; the current app opens the same. npm run next:browser.
// Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
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

let browser, srv, dir;
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-setup-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const RUB = { mode: 'rubric', criteria: ['Ideas', 'Organization', 'Language'] };
const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20', setup: RUB }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
const twoZip = async () => zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'An outline' }), 'Bram Sample/Outline.pdf': await makePaper({ title: 'Another outline' }) });
const su = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().setup)));
const rub = (p, i) => p.evaluate(i => window.__mark.state().batch.students[i].grade.rubric.slice(), i);
const tap = (p, sel) => p.$eval(sel, e => { e.scrollIntoView({ block: 'center' }); e.click(); });
const typeIn = async (p, sel, text) => { await p.$eval(sel, e => e.select()); await p.type(sel, text); };

test('rubric setup: rows renamed, taken out (the scores after it move up), added, what a score means, a grading scale, Save as one step with Undo and Redo, her own rubric brought in for everyone; the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  const z = path.join(dir, 'Speech.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  assert.deepEqual((await su(p)).criteria, RUB.criteria);

  // Aria's scores on the three rows
  for (const [r, v] of [[0, 3], [1, 2], [2, 4]]) { await p.click(`.mk-crit[data-row="${r}"] [data-v="${v}"]`); await p.waitForFunction((r, v) => window.__mark.state().batch.students[0].grade.rubric[r] === v, {}, r, v); }
  const before = await su(p);

  // Setup: Ideas becomes Thesis, Organization comes out (its score goes, Language's moves up), a row added, what 4 means on Thesis, steps of 5
  await p.click('[data-setupopen]');
  await p.waitForSelector('dialog[open] [data-setup]');
  await typeIn(p, 'dialog[open] input[data-suname="0"]', 'Thesis');
  await tap(p, 'dialog[open] [data-surm="1"]');
  await p.waitForSelector('dialog[open] [data-susay]');
  assert.match(await p.$eval('dialog[open] [data-susay]', e => e.textContent), /1 student has a score on a row you took out/);
  await tap(p, 'dialog[open] [data-suadd]');
  await p.waitForSelector('dialog[open] input[data-suname="2"]');
  await p.$eval('dialog[open] [data-sulv="0"]', e => { e.scrollIntoView(); e.click(); });
  await p.waitForSelector('dialog[open] textarea[data-sulvi="0:4"]');
  await p.type('dialog[open] textarea[data-sulvi="0:4"]', 'A clear claim');
  await tap(p, 'dialog[open] [data-supreset="fives"]');
  await p.waitForSelector('dialog[open] input[data-susk="12"]');
  await tap(p, 'dialog[open] [data-susave]');
  await p.waitForFunction(() => !document.querySelector('dialog[open] [data-setup]'));
  await p.waitForFunction(() => JSON.stringify(window.__mark.state().setup.criteria) === '["Thesis","Language","Criterion 3"]');
  const after = await su(p);
  assert.deepEqual(after.levels, [{ 4: 'A clear claim' }, {}, {}]);
  assert.equal(after.scale[12], 100); assert.equal(after.scale[11], 95);
  assert.deepEqual(await rub(p, 0), [3, 4], 'Language’s score moved up with its row');
  await p.waitForFunction(() => document.querySelectorAll('.mk-crit').length === 3);

  // one step: Undo puts the setup and the scores back; Redo makes it again
  await p.click('[data-undo]');
  await p.waitForFunction(() => window.__mark.state().setup.criteria.length === 3 && window.__mark.state().setup.criteria[1] === 'Organization');
  assert.deepEqual(await su(p), before);
  assert.deepEqual(await rub(p, 0), [3, 2, 4]);
  await p.click('[data-redo]');
  await p.waitForFunction(() => window.__mark.state().setup.criteria[0] === 'Thesis');
  assert.deepEqual(await rub(p, 0), [3, 4]);

  // her own rubric, a PDF, for every student: each gets a page of it after their work
  fs.writeFileSync(path.join(dir, 'My rubric.pdf'), await makePaper({ title: 'My rubric' }));
  await p.click('[data-setupopen]');
  await p.waitForSelector('dialog[open] [data-suup]');
  const [ch2] = await Promise.all([p.waitForFileChooser(), tap(p, 'dialog[open] [data-suup]')]);
  await ch2.accept([path.join(dir, 'My rubric.pdf')]);
  await p.waitForSelector('dialog[open] [data-surprm]', { timeout: 30000 });
  await p.waitForFunction(() => !document.querySelector('dialog[open] [data-susave]').disabled);
  await tap(p, 'dialog[open] [data-susave]');
  await p.waitForFunction(() => { const s = window.__mark.state(); return s.setup.rubricPage && s.batch.students.every(st => st.files.some(f => f.virtual)); }, { timeout: 30000 });
  const rp = (await su(p)).rubricPage;
  assert.equal(rp.name, 'My rubric.pdf');
  assert.ok(await p.evaluate(k => !!localStorage.getItem('gs.rp.' + k), rp.id), 'her rubric is kept in this browser');

  await p.evaluate(() => window.__mark.saved());
  const kept = await su(p), scores = await rub(p, 0);
  const pages = await p.evaluate(() => window.__mark.state().batch.students.filter(st => st.files.some(f => !f.virtual)).map(st => st.files.filter(f => f.virtual).map(f => f.path)));
  await p.close();
  // the current app opens the same setup, scores and rubric page
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const theirs = await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().setup)));
  for (const k of ['mode', 'criteria', 'levels', 'scale', 'rubricPage']) assert.deepEqual(theirs[k], kept[k], k);
  assert.deepEqual(await m.evaluate(() => window.__gs.state().batch.students[0].grade.rubric.slice()), scores);
  await m.waitForFunction(() => window.__gs.state().batch.students.filter(st => st.files.some(f => !f.virtual)).every(st => st.files.some(f => f.virtual)), { timeout: 30000 });
  assert.deepEqual(await m.evaluate(() => window.__gs.state().batch.students.filter(st => st.files.some(f => !f.virtual)).map(st => st.files.filter(f => f.virtual).map(f => f.path))), pages, 'the same rubric pages for every student with work');
  assert.deepEqual(errors, []);
  await ctx.close();
});
