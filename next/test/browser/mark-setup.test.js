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
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-setup-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  // GS_THROTTLE=6 runs the page that many times slower (CDP), to find what depends on timing before CI does
  if (+process.env.GS_THROTTLE > 1) await (await p.target().createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: +process.env.GS_THROTTLE });
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const RUB = { mode: 'rubric', criteria: ['Ideas', 'Organization', 'Language'] };
const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20', setup: RUB }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
const twoZip = async () => zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'An outline' }), 'Bram Sample/Outline.pdf': await makePaper({ title: 'Another outline' }) });
const su = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().setup)));
const rub = (p, i) => p.evaluate(i => window.__mark.state().batch.students[i].grade.rubric.slice(), i);
const tap = (p, sel) => p.$eval(sel, e => { e.scrollIntoView({ block: 'center' }); e.click(); });
const setupDo = async (p, label) => { await p.click('[data-setupopen]'); await p.waitForFunction(l => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => e.textContent.includes(l)), {}, label); await p.evaluate(l => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => e.textContent.includes(l)).click(), label); };
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
  await setupDo(p, 'Rubric setup');
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
  await setupDo(p, 'Rubric setup');
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

test('under the score: leave out of the average, extra credit, a retake that keeps the first try, which try counts, the retake taken off with Undo; the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  const z = path.join(dir, 'Speech2.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  const g = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().batch.students[0].grade)));
  const menu = async re => {
    await p.waitForSelector('[data-smmenu]');
    await p.click('[data-smmenu]');
    await p.waitForFunction(re => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => new RegExp(re).test(e.textContent)), {}, re);
    await p.evaluate(re => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => new RegExp(re).test(e.textContent)).click(), re);
  };
  for (const [r, v] of [[0, 3], [1, 2], [2, 4]]) { await p.click(`.mk-crit[data-row="${r}"] [data-v="${v}"]`); await p.waitForFunction((r, v) => window.__mark.state().batch.students[0].grade.rubric[r] === v, {}, r, v); }

  // Leave out of the average, then count it again with Undo
  await menu('^Leave out of the average');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.outAvg === true);
  await p.waitForSelector('[data-smout]');
  await p.click('[data-undo]');
  await p.waitForFunction(() => !window.__mark.state().batch.students[0].grade.outAvg);

  // Extra credit: 2 points
  await menu('^Extra credit');
  await p.waitForSelector('[data-smxc]');
  // extra credit that starts with 0 is kept as typed until she leaves the box (a save per key took "0" as none and closed the box)
  await p.type('[data-smxc]', '0.5'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.xc === 0.5, { timeout: 5000 });
  await p.click('[data-smxc]'); await p.$eval('[data-smxc]', e => e.select());
  await p.type('[data-smxc]', '2'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.xc === 2);
  const first = await g();

  // a retake: the first try kept, the score starts again; the retake scored lower; Highest counts, then Latest
  await menu('^Start a retake');
  await p.waitForFunction(() => (window.__mark.state().batch.students[0].grade.tries || []).length === 1);
  const t1 = (await g()).tries[0];
  assert.deepEqual([t1.rubric, t1.xc, t1.total, t1.pct], [first.rubric, 2, 11, await p.evaluate(() => window.__mark.state().batch.students[0].grade.tries[0].pct)]);
  assert.deepEqual((await g()).rubric, []);
  for (const [r, v] of [[0, 2], [1, 2], [2, 2]]) { await p.click(`.mk-crit[data-row="${r}"] [data-v="${v}"]`); await p.waitForFunction((r, v) => window.__mark.state().batch.students[0].grade.rubric[r] === v, {}, r, v); }
  await p.waitForSelector('[data-smtries]');
  const counts = () => p.evaluate(() => window.__mark.gradeOf(window.__mark.state().batch.students[0]).pct);
  const high = await counts();
  assert.equal(high, t1.pct, 'the highest try counts');
  await p.click('[data-smrule]');
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => /^Latest/.test(e.textContent)));
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /^Latest/.test(e.textContent)).click());
  await p.waitForFunction(() => window.__mark.state().lib.book && window.__mark.state().lib.book.retake === 'last');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).book.retake === 'last');
  assert.ok(await counts() < high, 'the latest try counts now');
  const withRetake = await g();

  // take the retake off: at once, and Undo brings it back
  await p.click('[data-smoff]');
  await p.waitForFunction(() => !window.__mark.state().batch.students[0].grade.tries);
  assert.deepEqual((await g()).rubric, first.rubric);
  await p.click('[data-undo]');
  await p.waitForFunction(() => (window.__mark.state().batch.students[0].grade.tries || []).length === 1);
  const back = await g();
  assert.deepEqual([back.rubric, back.tries], [withRetake.rubric, withRetake.tries]);

  const pctNew = await counts();
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const theirs = await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.students[0].grade)));
  assert.deepEqual([theirs.rubric, theirs.tries, theirs.xc], [back.rubric, back.tries, back.xc]);
  assert.equal(await m.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).pct), pctNew, 'the same try counts in the current app');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the rubric bank in Rubric setup: a saved rubric used (its rows by place), this one saved to the bank in a unit, deleted with Undo, a scale saved; the Planner\'s bank holds the same', async () => {
  const { plantPlan } = require('./planseed.js');
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard()); await plantPlan(p);
  const z = path.join(dir, 'Speech3.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const kvBank = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('bank'); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));
  const names = async () => { const b = await kvBank(); return [...b.rubrics.map(r => r.name), ...b.scales.map(s => s.name)]; };
  // the bank is written a moment after the screen shows it: wait for the write
  const until = async (f, why) => { for (let k = 0; k < 50; k++) { if (await f()) return; await new Promise(r => setTimeout(r, 200)); } assert.fail(why); };
  // Use the saved one: its rows, by place
  await setupDo(p, 'Rubric setup');
  await p.waitForSelector('dialog[open] [data-subuse="R1"]', { timeout: 10000 });
  await tap(p, 'dialog[open] [data-subuse="R1"]');
  await p.waitForFunction(() => document.querySelector('dialog[open] input[data-suname="0"]').value === 'Understanding');
  await tap(p, 'dialog[open] [data-susave]');
  await p.waitForFunction(() => !document.querySelector('dialog[open] [data-setup]'));
  assert.deepEqual((await su(p)).criteria, ['Understanding', 'Evidence', 'Language']);
  assert.equal((await su(p)).rubricName, 'Story analysis');
  // Save to the bank… in Unit 2
  await setupDo(p, 'Rubric setup');
  await p.waitForSelector('dialog[open] [data-subsave]');
  await typeIn(p, 'dialog[open] input[data-suname="2"]', 'Voice');
  await tap(p, 'dialog[open] [data-subsave]');
  await p.waitForSelector('dialog[open] [data-subname]');
  await typeIn(p, 'dialog[open] [data-subname]', 'Speech rubric');
  await p.select('dialog[open] [data-subunit]', 'U2');
  await tap(p, 'dialog[open] [data-subok]');
  // The name form closes once the Planner bank and the grading list are both saved.
  await p.waitForSelector('dialog[open] [data-suask]', { hidden: true });
  let b = await kvBank(); const r = b.rubrics.find(x => x.name === 'Speech rubric');
  assert.ok(r, 'in the Planner\'s bank'); assert.deepEqual(r.criteria, ['Understanding', 'Evidence', 'Voice']); assert.deepEqual(r.unit, { id: 'U2', course: 'Grade 9', title: 'Unit 2: Poetry' });
  assert.ok((await p.evaluate(() => JSON.parse(localStorage.getItem('gs.rubrics')))).some(x => x.name === 'Speech rubric'), 'and in grading\'s own list');
  // Delete it, then Undo
  await p.waitForSelector(`dialog[open] [data-subdel="${r.id}"]`); await tap(p, `dialog[open] [data-subdel="${r.id}"]`);
  await p.waitForFunction(id => !document.querySelector(`dialog[open] [data-subdel="${id}"]`), {}, r.id);
  await until(async () => !(await names()).includes('Speech rubric'), 'gone from the bank');
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(x => x.textContent.trim() === 'Undo').click());
  await p.waitForSelector(`dialog[open] [data-subdel="${r.id}"]`, { timeout: 8000 });
  await until(async () => (await names()).includes('Speech rubric'), 'Undo brings it back');
  // a grading scale, steps of 5, saved
  await tap(p, 'dialog[open] [data-supreset="fives"]');
  await p.waitForSelector('dialog[open] [data-suscsave]'); await tap(p, 'dialog[open] [data-suscsave]');
  await p.waitForSelector('dialog[open] [data-subname]'); await tap(p, 'dialog[open] [data-subok]');
  await p.waitForFunction(() => !document.querySelector('dialog[open] [data-suask]'));
  await until(async () => (await kvBank()).scales.some(x => x.name === 'Out of 12'), 'the scale in the bank');
  b = await kvBank(); const sc = b.scales.find(x => x.name === 'Out of 12');
  assert.ok(sc); assert.equal(sc.scale[12], 100); assert.equal(sc.scale[11], 95);
  // H-010: the Planner's database fails the read for a moment as she saves: nothing is saved, and every rubric and scale is still there
  const had = JSON.stringify(await kvBank());
  await p.evaluate(() => { const g = IDBObjectStore.prototype.get; window.__unbreak = () => { IDBObjectStore.prototype.get = g; }; IDBObjectStore.prototype.get = function (k) { if (this.name === 'kv' && k === 'bank') throw new DOMException('test: bank read blocked', 'InvalidStateError'); return g.call(this, k); }; });
  await tap(p, 'dialog[open] [data-subsave]');
  await p.waitForSelector('dialog[open] [data-subname]');
  await typeIn(p, 'dialog[open] [data-subname]', 'Broken save');
  await tap(p, 'dialog[open] [data-subok]');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /wasn’t saved to the bank/.test(t.textContent)), { timeout: 10000 });
  await p.evaluate(() => window.__unbreak());
  assert.equal(JSON.stringify(await kvBank()), had, 'H-010 the bank is unchanged');
  errors.splice(0, errors.length, ...errors.filter(e => !/bank read blocked/.test(e)));
  await tap(p, 'dialog[open] [data-sucancel]');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('learning goals in Rubric setup: a goal picked beside two rows is kept with the setup, and the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const seed = withCard(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.goals = [{ id: 'g1', name: 'Uses evidence' }, { id: 'g2', name: 'Clear structure' }]; seed.ls['gs.lib'] = JSON.stringify(lib);
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  const z = path.join(dir, 'Goals.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  await setupDo(p, 'Rubric setup');
  await p.waitForSelector('dialog[open] select[data-sugoal="0"]');
  assert.deepEqual((await p.$$eval('dialog[open] select[data-sugoal="0"] option', os => os.map(o => o.textContent))).slice(1), ['Uses evidence', 'Clear structure', 'New goal…'], 'her goals to pick from, then New goal… (B-044)');
  await p.select('dialog[open] select[data-sugoal="0"]', 'g1');
  await p.select('dialog[open] select[data-sugoal="2"]', 'g2');
  await tap(p, 'dialog[open] [data-susave]');
  await p.waitForFunction(() => JSON.stringify(window.__mark.state().setup.goals) === '["g1",null,"g2"]');
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => window.__gs.state().setup.goals), ['g1', null, 'g2']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// B-044 B-045: with no goals yet, Rubric setup has one quiet link to tag rows; with some, Edit goals… and New goal… in each picker,
// which picks the goal just made (src/goals.js goalPick, goalsSetupHtml)
test('B-044 B-045: Tag rows with learning goals… makes the first goal; New goal… in a row\'s picker makes another and picks it, kept with the setup', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  const z = path.join(dir, 'Goals b.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  await setupDo(p, 'Rubric setup');
  await p.waitForSelector('dialog[open] [data-sugoals]');
  assert.equal(await p.$('dialog[open] select[data-sugoal="0"]'), null, 'no pickers before a first goal');
  assert.match(await p.$eval('dialog[open] [data-sugoalline]', e => e.textContent), /^Tag rows with learning goals… Optional/);
  await p.click('dialog[open] [data-sugoals]');
  await p.waitForSelector('[data-goal-row="0"]');
  await p.type('[data-goal-row="0"]', 'Uses evidence'); await p.click('[data-goals-done]');
  await p.waitForSelector('dialog[open] select[data-sugoal="0"]', { timeout: 15000 });
  assert.equal(await p.$eval('dialog[open] [data-sugoals]', e => e.textContent), 'Edit goals…');
  const lib = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
  assert.deepEqual(lib.goals.map(g => g.name), ['Uses evidence']);
  // New goal… in row 2's picker: her list with a new line ready; the goal made is picked
  await p.select('dialog[open] select[data-sugoal="1"]', '+');
  await p.waitForSelector('[data-goal-row="1"]');
  await p.type('[data-goal-row="1"]', 'Clear structure'); await p.click('[data-goals-done]');
  await p.waitForFunction(() => { const s = document.querySelector('dialog[open] select[data-sugoal="1"]'); return s && s.selectedOptions[0] && s.selectedOptions[0].textContent === 'Clear structure'; }, { timeout: 15000 });
  await tap(p, 'dialog[open] [data-susave]');
  const ids = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).goals.map(g => g.id));
  await p.waitForFunction(g => JSON.stringify(window.__mark.state().setup.goals) === JSON.stringify([null, g, null]), { timeout: 15000 }, ids[1]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('an MYP class: the band asks for this task\'s criteria, the ticked ones become rows scored 0 to 8 as one step with Undo, the levels show in place of the total; the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const seed = withCard(), lib = JSON.parse(seed.ls['gs.lib']);
  Object.assign(lib.classes[0], { way: 'myp', ib: { group: 'sci' } }); seed.ls['gs.lib'] = JSON.stringify(lib);
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  const z = path.join(dir, 'Lab.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  await p.click('.mk-crit[data-row="0"] [data-v="3"]');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.rubric[0] === 3);
  await p.waitForSelector('[data-ibask]', { timeout: 30000 });
  assert.match(await p.$eval('[data-ibask]', e => e.textContent), /Grade 9 English is graded with MYP criteria\./);
  const before = await su(p);
  await p.click('[data-ibask] [data-ibset]');
  await p.waitForSelector('dialog[open] [data-ibtask]');
  const crits = await p.$$eval('dialog[open] [data-ibtk]', es => es.map(e => e.dataset.ibtk));
  assert.deepEqual(crits, ['A', 'B', 'C', 'D']);
  await p.click('dialog[open] [data-ibtk="A"]'); await p.click('dialog[open] [data-ibtk="C"]');
  await p.waitForSelector('dialog[open] [data-iblose]');
  assert.match(await p.$eval('dialog[open] [data-iblose]', e => e.textContent), /on 1 paper go/);
  await p.click('dialog[open] [data-ibsave]');
  await p.waitForFunction(() => JSON.stringify(window.__mark.state().setup.ib) === '["A","C"]');
  const after = await su(p);
  assert.equal(after.top, 8); assert.equal(after.criteria.length, 2); assert.match(after.criteria[0], /^A /); assert.match(after.criteria[1], /^C /);
  assert.deepEqual(await rub(p, 0), [null, null]);
  await p.waitForSelector('[data-ibtotal]');
  assert.equal(await p.$('[data-ibask]'), null, 'the band gives way to the Criteria link');
  // one step: Undo puts the rows and the score back, Redo makes the criteria again
  await p.click('[data-undo]');
  await p.waitForFunction(() => !window.__mark.state().setup.ib);
  assert.deepEqual(await su(p), before); assert.deepEqual(await rub(p, 0), [3]);
  await p.click('[data-redo]');
  await p.waitForFunction(() => JSON.stringify(window.__mark.state().setup.ib) === '["A","C"]');
  // a level on A: shown in place of the total, and in the list
  await p.click('.mk-crit[data-row="0"] [data-v="6"]');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.rubric[0] === 6);
  await p.waitForFunction(() => /A6/.test(document.querySelector('[data-ibtotal]').textContent) && /1 of 2 criteria marked/.test(document.querySelector('[data-ibtotal]').textContent));
  await p.waitForFunction(() => /6 –/.test(document.querySelector('[data-st="0"]').textContent));
  await p.evaluate(() => window.__mark.saved());
  const kept = await su(p);
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const theirs = await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().setup)));
  for (const k of ['mode', 'criteria', 'ib', 'top']) assert.deepEqual(theirs[k], kept[k], k);
  assert.deepEqual(await m.evaluate(() => window.__gs.state().batch.students[0].grade.rubric.slice()), [6, null]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Another window or the current app changing the rubric bank (src/rubrics.js bankChan 'gs-bank') redraws an open Rubric setup, and
// saved comments changed in another tab (src/saving.js storage gs.bank) are the ones this screen uses (audit H-065, H-044).
test('H-065 H-044: a rubric saved in another window shows in the open Rubric setup at once; saved comments changed in another tab are the ones used here', async () => {
  const { plantPlan } = require('./planseed.js');
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard()); await plantPlan(p);
  const z = path.join(dir, 'Speech4.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  await setupDo(p, 'Rubric setup');
  await p.waitForSelector('dialog[open] [data-subuse="R1"]', { timeout: 10000 });
  assert.equal(await p.$('dialog[open] [data-subuse="R9"]'), null);
  // another window saves a rubric to the bank and says so on the channel, as the current app does
  const q = await page(ctx, errors);
  await q.goto(srv.url + 'blank');
  await q.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onerror = () => rej(r.error); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'), o = tx.objectStore('kv'), g = o.get('bank');
    g.onsuccess = () => { const b = g.result, one = b.rubrics.find(x => x.id === 'R1'); b.rubrics.push({ ...one, id: 'R9', name: 'Lab rubric' }); o.put(b, 'bank'); }; tx.oncomplete = () => { r.result.close(); const ch = new BroadcastChannel('gs-bank'); ch.postMessage('changed'); ch.close(); res(); }; }; }));
  await p.waitForSelector('dialog[open] [data-subuse="R9"]', { timeout: 10000 });
  // saved comments changed in that tab
  await q.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['From the other tab.'])));
  await p.waitForFunction(() => JSON.stringify(window.__mark.state().bank) === JSON.stringify(['From the other tab.']), { timeout: 10000 });
  await q.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});
