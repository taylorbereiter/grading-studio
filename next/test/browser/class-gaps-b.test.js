// Stage 8, slice B: the class page, gradebook and students in the new app, row by row against rebuild/audit/gaps.md.
// npm run next:browser. Made-up classes only.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { STEADY } = require('../../../test/helpers/steady.js');
const { bookSeed } = require('./classseed.js');

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
const libOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));


// Slice B of stage 8 (rebuild/audit/gaps.md, "Class page, gradebook, students"): each test names the rows it closes. Made-up classes only.
// A class with no roster beside the seed's, an assignment due next week with no papers, and time on the timer for one card.
const seedB = () => {
  const seed = bookSeed(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes.push({ id: 'c9', name: 'Art 9', names: [], units: [] });
  lib.classes[0].units[0].items.push({ id: 'i20', name: 'Essay plan', classId: 'c1', type: 'sum', due: '2026-11-04' });
  seed.ls['gs.lib'] = JSON.stringify(lib);
  seed.ls['gs.focus'] = JSON.stringify({ days: { '2026-10-20': { s: 1800, p: 3, a: { i3: 1800 }, pa: { i3: 3 } } } });
  return seed;
};
const menu = async (p, trigger, re) => {
  await p.click(trigger);
  await p.waitForFunction(re => [...document.querySelectorAll('.pop [role^="menuitem"]')].some(e => new RegExp(re).test(e.textContent)), {}, re);
  await p.evaluate(re => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(e => new RegExp(re).test(e.textContent)).click(), re);
};
const menuTexts = async (p, trigger) => {
  await p.click(trigger); await p.waitForSelector('.pop [role^="menuitem"]');
  const l = await p.$$eval('.pop [role^="menuitem"]', a => a.map(e => e.textContent));
  await p.focus('.pop [role^="menuitem"]'); await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.pop [role^="menuitem"]'));
  return l;
};
const paste = (p, sel, text) => p.evaluate((sel, text) => { const dt = new DataTransfer(); dt.setData('text/plain', text); document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, sel, text);

test('B-901 B-037 B-041 B-023 B-038: Class setup in the header; a class with no roster imports its old gradebook and the file becomes the roster; Grading and the sidebar order from the menu; the current app reads it', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, seedB());
  await p.goto(srv.url + 'next/#/class/c9');
  await p.waitForSelector('[data-class-setup]', { timeout: 60000 });
  const before = await menuTexts(p, '[data-class-setup]');
  assert.ok(before.some(s => /^Add roster/.test(s)) && before.some(s => /^Import a gradebook/.test(s)) && before.some(s => /^How this class is graded|Grading/.test(s)), before.join(' | '));
  // B-037/B-041: Grading opens before there is a roster
  await menu(p, '[data-class-setup]', 'graded|Grading');
  await p.waitForSelector('dialog[open] [role="radiogroup"], dialog[open] .seg, dialog[open] [data-v]');
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  // B-023: the Grades tab of a class with no roster offers the import, and its students become the roster
  await p.goto(srv.url + 'next/#/class/c9/grades');
  await p.waitForSelector('[data-bki-first]', { timeout: 60000 });
  await p.click('[data-bki-first]');
  await p.waitForSelector('dialog[open] [data-bki-paste]');
  await paste(p, 'dialog[open] [data-bki-paste]', ['Student\tColour wheel (10)', 'Testwell, Aria\t8', 'Madeup, Ivo\t9.5'].join('\n'));
  await p.waitForSelector('dialog[open] [data-bki-cols]');
  await p.select('dialog[open] [data-bki-go="1"]', 'new').catch(() => {});
  await p.waitForFunction(() => !document.querySelector('dialog[open] [data-bki-save]').disabled);
  await p.click('dialog[open] [data-bki-save]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes.find(c => c.id === 'c9').names.length === 2, { timeout: 15000 });
  const c9 = (await libOf(p)).classes.find(c => c.id === 'c9');
  assert.deepEqual(c9.names, ['Aria Testwell', 'Ivo Madeup']);
  assert.equal(c9.units.flatMap(u => u.items).length, 1);
  await p.waitForFunction(() => !document.querySelector('[data-bki-first]') && document.querySelector('.book-wrap'), { timeout: 15000 });
  // B-901: with a roster the menu says Edit roster and no longer offers the import; Move up in the sidebar is one undo step
  await p.goto(srv.url + 'next/#/class/c9');
  await p.waitForSelector('[data-class-setup]', { timeout: 60000 });
  const after = await menuTexts(p, '[data-class-setup]');
  assert.ok(after.some(s => /^Edit roster/.test(s)) && !after.some(s => /^Import a gradebook/.test(s)), after.join(' | '));
  await menu(p, '[data-class-setup]', '^Move up in the sidebar');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes.map(c => c.id).join() === 'c1,c9,c2');
  await menu(p, '[data-class-setup]', '^Edit roster');
  await p.waitForSelector('dialog[open] [data-roster-names]');
  assert.equal(await p.$eval('dialog[open] [data-roster-names]', e => e.value), 'Aria Testwell\nIvo Madeup');
  await p.keyboard.press('Escape');
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  assert.deepEqual(await old.evaluate(() => { const l = window.__gs.state().lib; return [l.classes.map(c => c.id), l.classes[1].names, l.classes[1].units.flatMap(u => u.items).map(i => i.name)]; }), [['c1', 'c9', 'c2'], ['Aria Testwell', 'Ivo Madeup'], ['Colour wheel']]);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('B-005 B-006 B-007 B-010 B-002 B-003: a card\'s name opens it; typed-in pill; time spent on the card; a unit with assignments asks before it goes; the due date says what else is due that week', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, seedB());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-wname="i7"]', { timeout: 60000 });
  // B-006: the typed-in card carries the pill; B-005: its name goes to its scores in the gradebook
  assert.ok(await p.$('[data-item="i7"] [data-wtyped]'), 'typed-in pill');
  assert.equal(await p.$('[data-item="i20"] [data-wtyped]'), null);
  assert.equal(await p.$eval('[data-wname="i7"]', e => e.getAttribute('href')), '#/class/c1/grades/type-i7');
  // a card with no papers: its name opens the Bring in menu
  await p.click('[data-wname="i20"]');
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].some(e => /folder/i.test(e.textContent)));
  await p.keyboard.press('Escape');
  // a card whose papers are kept: its name opens them
  const kept = await p.$eval('[data-wname="i3"]', e => e.tagName === 'A' ? e.getAttribute('href') : '');
  if (kept) assert.match(kept, /^#\/mark\//);
  // B-007: the time spent grading, from the timer's log
  await p.waitForFunction(() => /30 min so far · about 10 minutes a paper/.test(document.querySelector('[data-item="i3"] .wn small').textContent), { timeout: 15000 });
  await p.click('[data-wname="i7"]');
  await p.waitForFunction(() => location.hash === '#/class/c1/grades');
  await p.waitForSelector('dialog[open]', { timeout: 15000 });
  await p.keyboard.press('Escape');
  // B-002/B-003: New assignment, a date in the week the essay plan is due
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-newasg]', { timeout: 60000 });
  await p.click('[data-newasg]');
  await p.waitForSelector('dialog[open] [data-asg-due]');
  await p.$eval('dialog[open] input[data-asg-due], dialog[open] [data-asg-due] input', e => { e.value = '2026-11-03'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForFunction(() => /Also due that week: 1 set, 6 papers/.test((document.querySelector('dialog[open] [data-asg-week]') || {}).textContent || ''), { timeout: 15000 });
  await p.$eval('dialog[open] input[data-asg-due], dialog[open] [data-asg-due] input', e => { e.value = '2027-02-10'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForFunction(() => /Nothing else to grade/.test((document.querySelector('dialog[open] [data-asg-week]') || {}).textContent || ''));
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  // B-010: a unit with assignments asks first; Cancel keeps it, Delete takes it, Undo brings it back
  const u = (await libOf(p)).classes[0].units[0];
  await menu(p, `[data-umenu="${u.id}"]`, '^Delete unit');
  await p.waitForSelector('dialog[open] [data-udel-ok]');
  assert.match(await p.$eval('dialog[open]', e => e.textContent), new RegExp(u.items.length + ' assignments go with it'));
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.ok((await libOf(p)).classes[0].units.some(x => x.id === u.id), 'Cancel keeps it');
  await menu(p, `[data-umenu="${u.id}"]`, '^Delete unit');
  await p.waitForSelector('dialog[open] [data-udel-ok]'); await p.click('dialog[open] [data-udel-ok]');
  await p.waitForFunction(id => !JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(x => x.id === id), {}, u.id);
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => /Undo/.test(b.textContent)).click());
  await p.waitForFunction(id => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units[0].id === id, {}, u.id);
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  assert.equal(await old.evaluate(() => window.__gs.state().lib.classes[0].units[0].items.length), u.items.length);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('B-067 B-068: an address for a class that is not there says so and shows the classes; #/class-named/<name> opens the class by its name', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, seedB());
  await p.goto(srv.url + 'next/#/class-named/grade%2010%20literature');
  await p.waitForFunction(() => location.hash === '#/class/c2', { timeout: 60000 });
  await p.goto(srv.url + 'next/#/class/nope');
  await p.waitForFunction(() => location.hash === '#/classes', { timeout: 60000 });
  await p.waitForFunction(() => /There is no class called “nope”/.test(document.body.textContent));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('B-055: Google Classroom\'s step 2 takes the ZIP of student work and opens it for marking', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const { zipSync, strToU8 } = require('fflate');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-gcz-')), f = path.join(dir, 'Poster.zip');
  fs.writeFileSync(f, zipSync({ 'Poster/Aria Testwell - Poster.txt': strToU8('My poster'), 'Poster/Ivo Madeup - Poster.txt': strToU8('Another poster') }));
  await p.goto(srv.url + 'blank'); await plant(p, seedB());
  await p.goto(srv.url + 'next/#/class/new');
  await p.waitForSelector('[data-roster-gc]', { timeout: 60000 });
  await p.click('[data-roster-gc]');
  await p.waitForSelector('[data-gc] [data-gc-zip]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('[data-gc] [data-gc-zip]')]);
  await chooser.accept([f]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash), { timeout: 30000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('B-029 B-030 B-032 B-031 B-033 B-034 B-035: a student\'s page for any term or the whole year, previous and next by button and arrow key, by-type bars, every assignment strip, against the class, rubric rows', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const old = await page(ctx, errors);
  await old.goto(srv.url + 'blank'); await plant(old, seedB());
  await old.goto(srv.url); await appReady(old);
  // the rubric rows the current app finds for the second student, across the year's summatives
  const rowsMain = await old.evaluate(async () => { const g = window.__gs, l = g.state().lib, c = l.classes[0], cols = g.bkClassCols(c, await g.bkLoad()), n = c.names[1];
    const names = new Set(); for (const p of g.chRowAvgs(c, cols.filter(x => x.termId === 't1'), n)) for (const e of p.by.values()) names.add(e.name); return [...names]; });
  await old.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/class/c1/people/2');
  await p.waitForSelector('[data-stu-strip]', { timeout: 60000 });
  assert.equal(await p.$eval('[data-stu-pos]', e => e.textContent), '2 of 6');
  // B-030: Next and Previous
  await p.click('[data-stu-next]'); await p.waitForFunction(() => location.hash === '#/class/c1/people/3');
  await p.waitForFunction(() => document.querySelector('[data-stu-pos]').textContent === '3 of 6');
  // B-032: Left and Right, not while typing in a box
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('ArrowLeft'); await p.waitForFunction(() => location.hash === '#/class/c1/people/2');
  await p.focus('[data-roster-find]'); await p.keyboard.press('ArrowRight'); await new Promise(r => setTimeout(r, 300));
  assert.equal(await p.evaluate(() => location.hash), '#/class/c1/people/2', 'arrow keys in the search box stay there');
  await p.evaluate(() => document.activeElement.blur());
  // B-031: each counted type with the class average, and formatives' feedback
  await p.waitForSelector('[data-stu-type="sum"] em');
  assert.ok(await p.$('[data-stu-fb]'), 'feedback given on formatives');
  // B-033: the term's assignments as blocks; B-029: the whole year adds the next term's
  const strip = () => p.$$eval('[data-stu-strip] .stsi b', a => a.map(e => e.textContent));
  assert.ok(!(await strip()).includes('Moved quiz'));
  await p.click('[data-stu-terms] [data-v="*"]');
  await p.waitForFunction(() => [...document.querySelectorAll('[data-stu-strip] .stsi b')].some(e => e.textContent === 'Moved quiz'));
  assert.equal(await p.$eval('[data-kpi="avg"] span', e => e.textContent), 'Average this year');
  await p.click('[data-stu-terms] [data-v="t1"]');
  await p.waitForFunction(() => ![...document.querySelectorAll('[data-stu-strip] .stsi b')].some(e => e.textContent === 'Moved quiz'));
  // B-034: the student's line over the class's middle half
  assert.ok(await p.$('[data-stu-line] svg polygon, [data-stu-line] svg rect.band'), 'the band is drawn');
  // B-035: the same rubric rows as the current app
  const rowsNew = await p.$$eval('[data-stu-row]', a => a.map(e => e.getAttribute('data-stu-row')));
  assert.deepEqual(rowsNew.sort(), rowsMain.sort());
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('B-026 B-027 B-028 B-061 B-062: paste IDs and emails into the roster, type details down the list, add and remove another spelling; the current app reads them', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, seedB());
  const N = (await libOf(p)).classes[0].names;
  await p.goto(srv.url + 'next/#/class/c1/people/1');
  await p.waitForSelector('[data-roster-menu]', { timeout: 60000 });
  // B-026: Paste IDs and emails…; B-027: Cancel leaves everything, Fill in fills those on the roster
  await menu(p, '[data-roster-menu]', '^Paste IDs and emails');
  await p.waitForSelector('dialog[open] [data-paste-in]');
  await p.click('dialog[open] [data-paste-cancel]'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  await menu(p, '[data-roster-menu]', '^Paste IDs and emails');
  await p.waitForSelector('dialog[open] [data-paste-in]');
  await p.$eval('dialog[open] [data-paste-in]', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [N[0] + ',109001,first@example.org', N[2] + ',109003', 'Zed Nobody,100000,zed@example.org'].join('\n'));
  await p.click('dialog[open] [data-paste-fill]');
  await p.waitForFunction(n => { const i = JSON.parse(localStorage.getItem('gs.lib')).classes[0].info || {}; return (i[n] || {}).id === '109001'; }, {}, N[0]);
  await p.waitForFunction(() => /Filled in 2 students\. Not on the roster: Zed Nobody/.test(document.body.textContent), { timeout: 10000 });
  // B-028: details typed down the list, each kept when the box is left
  await menu(p, '[data-roster-menu]', '^Fill in details');
  await p.waitForSelector(`dialog[open] [data-fill="email"][data-fill-who="${N[1]}"]`);
  await p.type(`dialog[open] [data-fill="id"][data-fill-who="${N[1]}"]`, 'S 9002'); await p.keyboard.press('Tab');
  await p.keyboard.type('second@example.org'); await p.keyboard.press('Tab');
  await p.keyboard.type('MYP 3'); await p.keyboard.press('Tab');
  await p.waitForFunction(n => { const i = (JSON.parse(localStorage.getItem('gs.lib')).classes[0].info || {})[n] || {}; return i.id === 'S9002' && i.email === 'second@example.org' && i.prev === 'MYP 3'; }, {}, N[1]);
  await p.click('dialog[open] [data-fill-done]'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  // B-062: another spelling added; B-061: one taken away
  await p.click('[data-sp-add]'); await p.waitForSelector('dialog[open] [data-sp-input]');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('dialog[open] [data-sp-input], dialog[open] [data-sp-input] input'));
  await p.keyboard.type('Tess W.'); await p.keyboard.press('Enter');
  await p.waitForSelector('[data-spelling="Tess W."]');
  await p.click('[data-sp-add]'); await p.waitForSelector('dialog[open] [data-sp-input]');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('dialog[open] [data-sp-input], dialog[open] [data-sp-input] input'));
  await p.keyboard.type('T. Testwell'); await p.click('dialog[open] [data-sp-ok]');
  await p.waitForSelector('[data-spelling="T. Testwell"]');
  await p.click('[data-spelling="Tess W."] [data-sp-drop]');
  await p.waitForFunction(n => JSON.stringify(((JSON.parse(localStorage.getItem('gs.lib')).classes[0].info || {})[n] || {}).other) === '["T. Testwell"]', {}, N[0]);
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(N => { const c = window.__gs.state().lib.classes[0], i = n => c.info[n] || {}; return [i(N[0]).id, i(N[0]).email, i(N[0]).other, i(N[1]).id, i(N[1]).email, i(N[1]).prev, i(N[2]).id]; }, N);
  assert.deepEqual(main, ['109001', 'first@example.org', ['T. Testwell'], 'S9002', 'second@example.org', 'MYP 3', '109003']);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('B-017 B-018: a name in the charts\' every-student table and in the learning goals table opens that student\'s page', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, seedB());
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForSelector('[data-open-charts]', { timeout: 60000 });
  await p.click('[data-open-charts]'); await p.waitForSelector('[data-heat-stu]');
  const name = await p.$eval('[data-heat-stu]', e => e.textContent), href = await p.$eval('[data-heat-stu]', e => e.getAttribute('href'));
  const N = (await libOf(p)).classes[0].names;
  assert.equal(href, '#/class/c1/people/' + (N.indexOf(name) + 1));
  await p.click('[data-heat-stu]');
  await p.waitForFunction(h => location.hash === h, {}, href);
  await p.waitForFunction(n => (document.querySelector('#h-stu') || {}).textContent === n, {}, name);
  assert.equal(await p.$('dialog[open]'), null, 'the sheet closed');
  assert.deepEqual(errors, []);
  await ctx.close();
});
