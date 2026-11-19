// The gradebook in the new app (stage 5): one table of terms, weights, types, typed scores and kept papers run through the current
// app's own functions (window.__gs) and through the lifted engine in the new app (window.__class), the same numbers out of both;
// Home's missing-work lines as main's To do counts them; the Grades and People tabs drawn from it; and the roster edited, a student
// moved and taken off, each one undo step that the current app reads. npm run next:browser. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
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

// The ways a teacher can set up the term: weights, an empty type as 0, extra credit's place and cap, the retake rule.
const CONFS = [
  {},
  { w: { sum: 60, ic: 40, fm: 0, k1: 20 }, empty: 'zero', xcTo: 'ic', xcCap: false, retake: 'last' },
  { w: { sum: 50, ic: 30, fm: 20, k1: 0 }, xcCap: true, retake: 'avg' },
];
// Run on either app: api = { lib, cols, conf(), classCols(c, cols), grade(n, cols, conf), owes(c, cols) }.
const runBook = `(api, confs) => {
  const out = [], base = JSON.parse(JSON.stringify(api.lib.book || {}));
  const cellOut = m => JSON.stringify([...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1));
  for (const bc of confs) {
    api.lib.book = { ...JSON.parse(JSON.stringify(base)), ...JSON.parse(JSON.stringify(bc)) };
    const conf = api.conf();
    for (const c of api.lib.classes) {
      if (!c.names.length) continue;
      const all = api.classCols(c, api.cols);
      out.push(JSON.stringify(all.map(x => [x.key, x.name, x.type, x.due, x.termId, cellOut(x.cells)])));
      for (const term of conf.terms.map(t => t.id).concat(['', '*'])) {
        const cols = term === '*' ? all : all.filter(x => x.termId === term);
        for (const n of c.names) out.push(JSON.stringify([c.id, term, n, api.grade(n, cols, conf)]));
        out.push(JSON.stringify([c.id, term, 'owes', api.owes(c, cols).map(s => [s.n, s.cols.map(x => x.key)])]));
      }
    }
  }
  api.lib.book = base;
  return out;
}`;

test('the gradebook: one table of terms, weights and scores comes out the same in both apps', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await page(ctx, errors);
  await old.goto(srv.url + 'blank'); await plant(old, bookSeed());
  await old.goto(srv.url); await appReady(old);
  const was = await old.evaluate(async (fn, confs) => {
    const g = window.__gs, cols = await g.bkLoad();
    return eval(fn)({ lib: g.state().lib, cols, conf: () => g.bkConf(), classCols: (c, cs) => g.bkClassCols(c, cs), grade: (n, cs, cf) => g.bkGrade(n, cs, cf), owes: (c, cs) => g.misByStu(c, cs) }, confs);
  }, runBook, CONFS);
  await old.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForFunction(() => window.__class && document.querySelector('table.book'), { timeout: 60000 });
  const now = await p.evaluate(async (fn, confs) => {
    const k = window.__class, b = await k.readBook(), B = k.B;
    B.bookUse({ lib: b.lib }); return eval(fn)({ lib: b.lib, cols: b.cols, conf: () => B.bkConf(), classCols: (c, cs) => { B.bkUse({ cls: c.id }); return B.bkClassCols(c, cs); }, grade: (n, cs, cf) => B.bkGrade(n, cs, cf), owes: (c, cs) => B.misByStu(c, cs) }, confs);
  }, runBook, CONFS);
  assert.ok(was.length > 50, 'the table has rows');
  assert.ok(was.some(r => /"grade":\d/.test(r)), 'grades'); assert.ok(was.some(r => /missing/.test(r)), 'missing'); assert.ok(was.some(r => /tries/.test(r)), 'a retake: ' + was[0].slice(0, 3000));
  assert.equal(now.length, was.length);
  for (let i = 0; i < was.length; i++) assert.equal(now[i], was[i], 'row ' + i);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Grades tab: the table as drawn has main\'s term grades; Whole year; Copy scores; Home counts missing work as main\'s To do does', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await page(ctx, errors);
  await old.goto(srv.url + 'blank'); await plant(old, bookSeed());
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(async () => {
    const g = window.__gs, cols = await g.bkLoad(), lib = g.state().lib, conf = g.bkConf(), c = lib.classes[0], all = g.bkClassCols(c, cols).filter(x => x.termId === 't1');
    return c.names.map(n => { const r = g.bkGrade(n, all, conf); return r.grade == null ? '' : String(Math.round(r.grade * 100) / 100); });
  });
  await old.waitForFunction(() => !window.__gs.bgBusy() && window.__gs.todoRows().some(r => r.kind === 'miss'), { timeout: 30000 }).catch(() => {});
  const mainMiss = await old.evaluate(() => window.__gs.todoRows().filter(r => r.kind === 'miss').map(r => r.sig));
  await old.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForSelector('table.book[data-term="t1"] tbody tr', { timeout: 60000 });
  const drawn = await p.$$eval('table.book tbody tr td.term', tds => tds.map(td => td.dataset.grade));
  assert.deepEqual(drawn, main);
  assert.ok(main.some(Boolean), 'some grades');
  // the Speech column (due on the term's last day) is in Term 1; the moved quiz is not
  assert.ok(await p.$('th[data-col="i7"]') && !(await p.$('th[data-col="i10"]')));
  // Copy scores: the table as text, one row per student
  await p.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = s => { window.__copied = s; return Promise.resolve(); }; });
  await p.click('[data-book-more]');
  await p.waitForSelector('.pop [role^="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => /Copy scores/.test(b.textContent)).click());
  await p.waitForFunction(() => window.__copied);
  const copied = await p.evaluate(() => window.__copied);
  assert.ok(copied.split('\n').length >= 8 && /Aria Testwell/.test(copied) && /\t/.test(copied));
  // Charts: the term average is the average of main's term grades; every student has a row of shaded cells
  await p.click('[data-open-charts]');
  await p.waitForSelector('dialog[open] [data-charts] [data-heat]');
  const tile = await p.$eval('[data-tile="avg"] b', e => parseFloat(e.textContent));
  const ms = main.filter(Boolean).map(Number);
  assert.ok(Math.abs(tile - ms.reduce((a, v) => a + v, 0) / ms.length) < 0.01, 'term average ' + tile);
  assert.equal(await p.$$eval('[data-heat] tbody tr', r => r.length), main.length);
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('dialog[open] [data-charts]'));
  // Whole year
  await p.evaluate(() => [...document.querySelectorAll('.bookbar [role="radio"]')].find(b => /Whole year/.test(b.textContent)).click());
  await p.waitForSelector('table.book[data-term="*"]');
  // Home: the missing-work lines
  await p.goto(srv.url + 'next/#/home');
  await p.waitForSelector('[data-home="say"]', { timeout: 60000 });
  const lines = await p.$$eval('[data-kind="miss"]', l => l.length);
  assert.equal(lines, mainMiss.length, 'one line for each class main reminds about');
  assert.ok(mainMiss.length >= 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

const libOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
test('People tab: the roster edited (order as pasted, an ID kept as a detail), a note, a student moved and one taken off with Undo; the current app reads the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/c1/people');
  await p.waitForSelector('[data-student="0"]', { timeout: 60000 });
  // edit the roster: a new student pasted with an ID, put second
  await p.click('[data-roster-edit]');
  await p.waitForSelector('dialog[open] [data-roster-names]');
  const names = (await libOf(p)).classes[0].names;
  await p.$eval('dialog[open] [data-roster-names]', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [names[0], 'Gus Invented\t20261234', ...names.slice(1)].join('\n'));
  await p.click('dialog[open] [data-roster-save]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].names[1] === 'Gus Invented');
  let l = await libOf(p);
  assert.equal(l.classes[0].names.length, names.length + 1);
  assert.equal(l.classes[0].info['Gus Invented'].id, '20261234');
  // a note on the second student
  await p.goto(srv.url + 'next/#/class/c1/people/2');
  await p.waitForSelector('[data-student="1"] [data-stu-note]');
  await p.type('[data-stu-note]', 'Joined in week 9.');
  await p.waitForFunction(() => ((JSON.parse(localStorage.getItem('gs.lib')).classes[0].info || {})['Gus Invented'] || {}).note === 'Joined in week 9.', { timeout: 10000 });
  // move them to the other class
  await p.click('[data-stu-menu]');
  await p.waitForSelector('.pop [role="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /Move/.test(e.textContent)).click());
  await p.waitForSelector('dialog[open] [data-move-to="c2"]');
  await p.click('dialog[open] [data-move-to="c2"]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[1].names.includes('Gus Invented'));
  l = await libOf(p);
  assert.ok(!l.classes[0].names.includes('Gus Invented'));
  assert.equal(l.classes[1].info['Gus Invented'].note, 'Joined in week 9.');
  // take the first student off, then Undo
  await p.goto(srv.url + 'next/#/class/c1/people/1');
  await p.waitForSelector('[data-student="0"]');
  await p.click('[data-stu-menu]');
  await p.waitForSelector('.pop [role="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /Remove/.test(e.textContent)).click());
  await p.waitForFunction(n => !JSON.parse(localStorage.getItem('gs.lib')).classes[0].names.includes(n), {}, names[0]);
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => /Undo/.test(b.textContent)).click());
  await p.waitForFunction(n => JSON.parse(localStorage.getItem('gs.lib')).classes[0].names[0] === n, {}, names[0]);
  // the current app reads the rosters and the note
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const seen = await old.evaluate(() => { const l = window.__gs.state().lib; return { a: l.classes[0].names, b: l.classes[1].names, note: ((l.classes[1].info || {})['Gus Invented'] || {}).note }; });
  assert.deepEqual(seen.a, names);
  assert.ok(seen.b.includes('Gus Invented'));
  assert.equal(seen.note, 'Joined in week 9.');
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Add a class: a name and a pasted roster make a class the current app opens', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/new');
  await p.waitForSelector('dialog[open] [data-roster-name]', { timeout: 60000 });
  await p.type('dialog[open] [data-roster-name]', 'Grade 11 Drama');
  await p.$eval('dialog[open] [data-roster-names]', e => { e.value = 'Hal Pretend\nIvy Notreal, ivy@example.com'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('dialog[open] [data-roster-save]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes.some(c => c.name === 'Grade 11 Drama'));
  const c = (await libOf(p)).classes.find(k => k.name === 'Grade 11 Drama');
  assert.deepEqual(c.names, ['Hal Pretend', 'Ivy Notreal']);
  assert.equal(c.info['Ivy Notreal'].email, 'ivy@example.com');
  await p.waitForFunction(id => location.hash === '#/class/' + id + '/people', {}, c.id);
  await p.waitForSelector('[data-roster-edit], .stus, table.roster, [data-stu]', { timeout: 30000 });
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  assert.ok(await old.evaluate(() => window.__gs.state().lib.classes.some(k => k.name === 'Grade 11 Drama' && k.names.length === 2)));
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the class link: added from the class header named for her system, opened, changed and taken away, kept where the current app reads it', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); l.me = { ...(l.me || {}), sys: 'Canvas' }; localStorage.setItem('gs.lib', JSON.stringify(l)); });
  const c0 = (await libOf(p)).classes[0];
  await p.goto(srv.url + 'next/#/class/' + c0.id);
  // in the Class setup menu while there is no link, so the header keeps under 25 presses
  await p.waitForSelector('[data-class-setup]', { timeout: 60000 });
  await p.click('[data-class-setup]'); await p.waitForSelector('.pop [role^="menuitem"]');
  const add = await p.evaluateHandle(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => /Add the .* link/.test(b.textContent)));
  assert.ok((await add.evaluate(e => e.textContent)).includes('Canvas'), 'named for her system');
  await add.click(); await p.waitForSelector('dialog[open] [data-clink-url]');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-clink-url]'));
  await p.keyboard.type('not a link'); await p.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 300)); assert.ok(await p.$('dialog[open] [data-clink-url]'), 'a bad link is not kept');
  await p.$eval('[data-clink-url]', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.type('[data-clink-url]', 'school.example.com/courses/9'); await p.click('[data-clink-save]');
  await p.waitForSelector('[data-clink-go]', { timeout: 10000 });
  assert.equal(await p.$eval('[data-clink-go]', e => e.getAttribute('href')), 'https://school.example.com/courses/9');
  const c1 = (await libOf(p)).classes[0], m = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.mblinks')));
  assert.equal(c1.mb, 'https://school.example.com/courses/9'); assert.equal(Object.values(m)[0], 'https://school.example.com/courses/9');
  const old = await page(ctx, errors);
  await old.goto(srv.url + '#/c/' + c0.id); await appReady(old);
  assert.equal(await old.evaluate(() => window.__gs.state().lib.classes[0].mb), 'https://school.example.com/courses/9');
  await old.close();
  // taken away
  await p.click('[data-clink-edit]'); await p.waitForSelector('dialog[open] [data-clink-url]');
  await p.$eval('[data-clink-url]', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('[data-clink-save]');
  await p.waitForFunction(() => !document.querySelector('[data-clink-go]'), { timeout: 10000 });
  assert.equal((await libOf(p)).classes[0].mb, undefined);
  assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.mblinks'))), {});
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The keyboard run (brief: "a keyboard run through the gradebook"): scores typed, moved through, marked missing, cleared, taken back
// with Escape and pasted from a spreadsheet, all from the keys; the column box, Term setup, Add scores and extra credit; then the
// current app opens the same scores and works out the same term grades the new app draws.
const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 't' ? undefined : v)));
const itemOf = (l, id) => l.classes.flatMap(c => c.units).flatMap(u => u.items).find(i => i.id === id) || null;
const sOf = (id, n) => { const it = JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.flatMap(u => u.items).find(i => i.id === id); return ((it && it.typed && it.typed.s) || {})[n]; };
const focusCell = (p, key, n) => p.evaluate((k, nm) => document.querySelector('td[data-bked="' + k + '"][data-bkn="' + nm + '"]').focus(), key, n);
const active = p => p.evaluate(() => { const a = document.activeElement; return a && a.dataset ? [a.dataset.bked || '', a.dataset.bkn || '', a.tagName] : null; });
const menuItem = async (p, re) => { await p.click('[data-book-more]'); await p.waitForSelector('.pop [role^="menuitem"]'); await p.evaluate(s => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => new RegExp(s).test(b.textContent)).click(), re); };
const waitS = (p, id, n, test) => p.waitForFunction(new Function('id', 'n', 'const sOf = ' + sOf.toString() + '; const s = sOf(id, n); return (' + test + ')(s);'), {}, id, n);
test('Grades tab keyboard run: typing, moving, missing, clearing, Escape and pasting; the column box, Term setup and Add scores; the current app reads the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForSelector('table.book[data-term="t1"] td[data-bked]', { timeout: 60000 });
  const N = (await libOf(p)).classes[0].names;
  // a digit opens the cell with it; Enter keeps it and goes down
  await focusCell(p, 'i4', N[0]);
  await p.keyboard.type('19'); await p.keyboard.press('Enter');
  await waitS(p, 'i4', N[0], 's => s && s.v === 19');
  assert.deepEqual(await active(p), ['i4', N[1], 'TD']);
  // m for missing, then Enter
  await p.keyboard.type('m'); await p.keyboard.press('Enter');
  await waitS(p, 'i4', N[1], "s => s && s.st === 'missing'");
  assert.deepEqual(await active(p), ['i4', N[2], 'TD']);
  // Escape leaves the cell as it was
  await p.keyboard.type('3'); await p.keyboard.press('Escape');
  assert.equal(itemOf(await libOf(p), 'i4').typed.s[N[2]].v, 14);
  assert.deepEqual(await active(p), ['i4', N[2], 'TD']);
  // arrows move: down, up, across to the next cell that takes keys, and back
  await p.keyboard.press('ArrowDown'); assert.deepEqual(await active(p), ['i4', N[3], 'TD']);
  await p.keyboard.press('ArrowUp'); assert.deepEqual(await active(p), ['i4', N[2], 'TD']);
  await p.keyboard.press('ArrowRight'); const right = await active(p); assert.ok(right[0] && right[0] !== 'i4' && right[1] === N[2], 'moved across: ' + right);
  await p.keyboard.press('ArrowLeft'); assert.deepEqual(await active(p), ['i4', N[2], 'TD']);
  // Enter opens with the score in it; a retake typed as "14 > 16"; Tab keeps it and goes across
  await p.keyboard.press('Enter'); await p.waitForSelector('td[data-bked="i4"] input[data-cin]');
  await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control');
  await p.keyboard.type('14 > 16'); await p.keyboard.press('Tab');
  await waitS(p, 'i4', N[2], 's => s && s.v === 16 && s.tries && s.tries[0] === 14');
  assert.equal((await active(p))[1], N[2]);
  // Delete empties a cell
  await focusCell(p, 'i4', N[5]); await p.keyboard.press('Delete');
  await waitS(p, 'i4', N[5], 's => !s');
  // cells pasted from a spreadsheet: down the column from the fourth student
  await focusCell(p, 'i4', N[3]);
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', '10\n11\n12\n13\n'); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await waitS(p, 'i4', N[5], 's => s && s.v === 12');
  const i4 = strip(itemOf(await libOf(p), 'i4').typed);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => i4.s[N[i]]), [{ v: 19, st: '' }, { v: null, st: 'missing' }, { v: 16, st: '', tries: [14] }, { v: 10, st: '' }, { v: 11, st: '' }, { v: 12, st: '' }]);
  assert.equal(i4.max, 20);
  // the column box: its type
  await p.click('th[data-col="i6"] .colbtn');
  await p.waitForSelector('dialog[open] [data-col-box="i6"]');
  await p.evaluate(() => [...document.querySelectorAll('dialog[open] [role="radio"]')].find(b => /Summative/.test(b.textContent)).click());
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.flatMap(u => u.items).find(i => i.id === 'i6').type === 'sum');
  await p.click('dialog[open] [data-col-done]');
  // Term setup: the in-class weight and the retake rule
  await menuItem(p, 'Term setup');
  await p.waitForSelector('dialog[open] [data-setup]');
  await p.$eval('dialog[open] [data-wt="ic"]', e => { e.value = '30'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => [...document.querySelectorAll('dialog[open] [role="radio"]')].find(b => /Latest counts/.test(b.textContent)).click());
  await p.click('dialog[open] [data-setup-save]');
  await p.waitForFunction(() => { const b = JSON.parse(localStorage.getItem('gs.lib')).book; return b.w.ic === 30 && b.retake === 'last'; });
  // Add scores: a new column, points out of 10
  await p.click('[data-book-add]');
  await p.waitForSelector('dialog[open] [data-add]');
  await p.type('dialog[open] [data-add-name] input, dialog[open] input[data-add-name]', 'Spelling test');
  await p.$eval('dialog[open] [data-add-max]', e => { e.value = '10'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const vs = await p.$$('dialog[open] [data-add-v]');
  await vs[0].type('8'); await vs[1].type('9.5');
  await p.click('dialog[open] [data-add-save]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.flatMap(u => u.items).some(i => i.name === 'Spelling test'));
  const sp = strip((await libOf(p)).classes[0].units.flatMap(u => u.items).find(i => i.name === 'Spelling test'));
  assert.equal(sp.typed.max, 10); assert.deepEqual(sp.typed.s[N[0]], { v: 8, st: '' }); assert.deepEqual(sp.typed.s[N[1]], { v: 9.5, st: '' }); assert.equal(sp.type, 'ic');
  // extra credit for everyone
  await menuItem(p, 'Add extra credit');
  await p.waitForSelector('dialog[open] [data-add]');
  await p.type('dialog[open] input[data-add-name]', 'Book fair');
  await p.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find(b => b.textContent.trim() === 'Everyone').click());
  await p.click('dialog[open] [data-add-save]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.flatMap(u => u.items).some(i => i.name === 'Book fair'));
  const bf = strip((await libOf(p)).classes[0].units.flatMap(u => u.items).find(i => i.name === 'Book fair'));
  assert.equal(bf.type, 'xc'); assert.equal(Object.keys(bf.typed.s).length, N.length); assert.deepEqual(bf.typed.s[N[0]], { v: 1 });
  // the drawn term grades, once the table has caught up with the saves
  await p.waitForFunction(() => [...document.querySelectorAll('th[data-col]')].some(th => /Book fair/.test(th.textContent)) && [...document.querySelectorAll('th[data-col]')].some(th => /Spelling test/.test(th.textContent)), { timeout: 30000 });
  const drawn = await p.$$eval('table.book tbody tr td.term', tds => tds.map(td => td.dataset.grade));
  // Leave out and Averages only: the foot says who is left out; Averages only is kept the current app's way
  await menuItem(p, 'Leave students out');
  await p.waitForSelector('[data-pick="0"]'); await p.click('[data-pick="0"]');
  await p.waitForSelector('[data-count-all]');
  await menuItem(p, 'Averages only');
  await p.waitForFunction(() => localStorage.getItem('gs.bkOnly') === '1' && !document.querySelector('td[data-bked]'));
  const lib = await libOf(p);
  await p.close();
  // the current app: same scores, same grades
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(async () => {
    const g = window.__gs, cols = await g.bkLoad(), lib = g.state().lib, conf = g.bkConf(), c = lib.classes[0], all = g.bkClassCols(c, cols).filter(x => x.termId === 't1');
    return { grades: c.names.map(n => { const r = g.bkGrade(n, all, conf); return r.grade == null ? '' : String(Math.round(r.grade * 100) / 100); }), i4: c.units.flatMap(u => u.items).find(i => i.id === 'i4').typed, book: lib.book };
  });
  assert.deepEqual(strip(main.i4), i4);
  assert.deepEqual(main.book.w, lib.book.w); assert.equal(main.book.retake, 'last');
  assert.deepEqual(drawn, main.grades);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

// IB classes (brief: MYP/DP and the class Grading dialog): the class turned to MYP in How this class is graded, a task's levels
// typed in, the best-fit levels set from the keys of the fit box, and the current app works out the same total and grade; then the
// class turned to DP with its own component weight, a predicted grade set, and the current app reads the same 1 to 7 and prediction.
const libNow = () => JSON.parse(localStorage.getItem('gs.lib'));
const waitLib = (p, fn) => p.waitForFunction('(' + fn + ')(JSON.parse(localStorage.getItem("gs.lib")).classes[0])');
test('IB classes: MYP levels and grades, DP boundaries, weights and a predicted grade, read the same by the current app', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  let p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForSelector('table.book[data-term="t1"]', { timeout: 60000 });
  const N = (await libOf(p)).classes[0].names;
  // MYP, with the sciences' criteria
  await menuItem(p, 'How this class is graded');
  await p.waitForSelector('dialog[open] [data-way="myp"]'); await p.click('dialog[open] [data-way="myp"]');
  await p.waitForSelector('dialog[open] [data-bound]');
  await p.click('dialog[open] [data-grading-save]');
  await waitLib(p, c => c.way === 'myp' && c.ib && c.ib.crit.length === 4);
  await p.waitForSelector('table.book[data-myp]');
  // a task's levels typed in: A and B for the first two students
  await p.click('[data-ib-add]');
  await p.waitForSelector('dialog[open] [data-ib-addbox]');
  await p.type('dialog[open] [data-ib-name] input, dialog[open] input[data-ib-name]', 'Cells lab');
  const lv = await p.$$('dialog[open] input[data-ib-lv]');
  await lv[0].type('5'); await lv[1].type('6'); await lv[2].type('3'); await lv[3].type('4');
  await p.click('dialog[open] [data-ib-save]');
  await waitLib(p, c => c.units.flatMap(u => u.items).some(i => i.name === 'Cells lab' && i.typed && i.typed.lv));
  const cells = (await libOf(p)).classes[0].units.flatMap(u => u.items).find(i => i.name === 'Cells lab');
  assert.deepEqual(cells.crit, ['A', 'B']); assert.deepEqual(strip(cells.typed.s[N[0]]), { l: { A: 5, B: 6 } }); assert.deepEqual(strip(cells.typed.s[N[1]]), { l: { A: 3, B: 4 } });
  // the best-fit levels for the first student, from the fit box; the outlined hint is the most recent level
  await p.click('[data-fit="0:A"]');
  await p.waitForSelector('dialog[open] [data-fit-box="0"]');
  assert.equal(await p.$eval('dialog[open] [data-lv="A:5"]', b => b.className), 'hint');
  for (const k of ['A:5', 'B:6', 'C:7', 'D:4']) await p.click('dialog[open] [data-lv="' + k + '"]');
  await waitLib(p, c => { const r = ((c.lv || {}).t1 || {})[c.names[0]]; return r && r.A === 5 && r.B === 6 && r.C === 7 && r.D === 4; });
  await p.waitForFunction(() => document.querySelector('dialog[open] [data-fit-grade]').textContent !== '–');
  const fitGrade = await p.$eval('dialog[open] [data-fit-grade]', b => b.textContent);
  await p.click('dialog[open] [data-fit-next]'); await p.waitForSelector('dialog[open] [data-fit-box="1"]');
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  const drawn = await p.$eval('table.book[data-myp] tbody tr[data-stu="0"] td.term', td => td.dataset.grade);
  assert.equal(drawn, fitGrade);
  // the current app: same levels, same total and grade
  let old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const myp = await old.evaluate(() => { const g = window.__gs, c = g.state().lib.classes[0], r = g.ibTerm(c.lv.t1[c.names[0]], g.ibCrit(c), g.ibBounds(c)); return { way: g.classWay(c), grade: r.grade, total: r.total }; });
  assert.equal(myp.way, 'myp'); assert.equal(String(myp.grade), drawn); assert.equal(myp.total, 22);
  await old.close();
  // DP: the in-class component counts 40 in this class only; a predicted grade for the first student
  await menuItem(p, 'How this class is graded');
  await p.waitForSelector('dialog[open] [data-way="dp"]'); await p.click('dialog[open] [data-way="dp"]');
  await p.waitForSelector('dialog[open] [data-dpw="ic"]');
  await p.$eval('dialog[open] [data-dpw="ic"]', e => { e.value = '40'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('dialog[open] [data-grading-save]');
  await waitLib(p, c => c.way === 'dp' && c.ib.w && c.ib.w.ic === 40);
  await p.waitForSelector('table.book:not([data-myp]) tbody tr td.term .ibg7');
  await menuItem(p, 'Predicted grades');
  await p.waitForSelector('dialog[open] [data-pred]');
  await p.click('dialog[open] tbody tr:first-child [data-pred="6"]');
  await waitLib(p, c => ((c.pred || {}).t1 || {})[c.names[0]] && c.pred.t1[c.names[0]].g === 6);
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  await p.waitForFunction(() => /predicted 6/.test(document.querySelector('table.book tbody tr[data-stu="0"] td.term').textContent));
  const dpDrawn = await p.$$eval('table.book tbody tr td.term', tds => tds.map(td => [td.dataset.grade, (td.querySelector('.ibg7') || {}).textContent || '']));
  const book = (await libOf(p)).book;
  await p.close();
  old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const dp = await old.evaluate(async () => {
    const g = window.__gs, cols = await g.bkLoad(), c = g.state().lib.classes[0], conf = g.ibConf(c, g.bkConf()), all = g.bkClassCols(c, cols).filter(x => x.termId === 't1');
    return { pred: g.ibPredOf(c, c.names[0], 't1'), w: conf.w, rows: c.names.map(n => { const r = g.bkGrade(n, all, conf); return [r.grade == null ? '' : String(Math.round(r.grade * 100) / 100), r.grade == null ? '' : String(g.ibGradeOf(g.roundPct(r.grade), g.ibBounds(c)))]; }) };
  });
  assert.equal(dp.pred, 6); assert.equal(dp.w.ic, 40); assert.notEqual(book.w && book.w.ic, 40);
  assert.deepEqual(dpDrawn.map(r => [r[0], r[1].trim()]), dp.rows);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Import a gradebook (src/bookimport.js): cells pasted from a spreadsheet, a column matched to an assignment already there by its
// name, a new one out of 10 from its heading, a total left out, a row that matches nobody left out, a score already there kept;
// one undo step, and the current app reads the new card and the kept score.
test('Import a gradebook: pasted cells matched to the roster and the assignments, read the same by the current app', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForSelector('table.book[data-term="t1"]', { timeout: 60000 });
  const before = await libOf(p), N = before.classes[0].names, was = itemOf(before, 'i4').typed.s;
  await menuItem(p, 'Import a gradebook');
  await p.waitForSelector('dialog[open] [data-bki-paste]');
  const tsv = ['Student\tVocabulary quiz\tMap test (10)\tTotal', 'Testwell, Aria\t16\t9\t90', N[1] + '\t' + (was[N[1]] && was[N[1]].v != null ? was[N[1]].v : 11) + '\t7\t80', 'Zed Nobody\t5\t5\t50'].join('\n');
  await p.evaluate(text => { const dt = new DataTransfer(); dt.setData('text/plain', text); document.querySelector('dialog[open] [data-bki-paste]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, tsv);
  await p.waitForSelector('dialog[open] [data-bki-cols]');
  assert.ok(await p.$('dialog[open] [data-bki-clash]'), 'a score already there that differs is shown');
  assert.equal(await p.$eval('dialog[open] [data-bki-go="1"]', s => s.value), 'i4');
  // "Map test" is close to "Story map": the teacher says it is a new one before Import can be pressed
  assert.equal(await p.$eval('dialog[open] [data-bki-go="2"]', s => s.value), '');
  assert.ok(await p.$eval('dialog[open] [data-bki-save]', b => b.disabled));
  await p.select('dialog[open] [data-bki-go="2"]', 'new');
  await p.waitForFunction(() => document.querySelector('dialog[open] [data-bki-go="2"]').value === 'new' && !document.querySelector('dialog[open] [data-bki-save]').disabled);
  assert.equal(await p.$eval('dialog[open] [data-bki-go="3"]', s => s.value), 'skip');
  assert.equal(await p.$eval('dialog[open] [data-bki-max="2"]', e => e.value), '10');
  assert.equal(await p.$eval('dialog[open] [data-bki-pick="2"]', s => s.value), '');
  await p.click('dialog[open] [data-bki-save]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.flatMap(u => u.items).some(i => i.name === 'Map test'));
  const after = await libOf(p), map = after.classes[0].units.flatMap(u => u.items).find(i => i.name === 'Map test');
  assert.equal(map.typed.max, 10); assert.deepEqual(strip(map.typed.s), { [N[0]]: { v: 9, st: '' }, [N[1]]: { v: 7, st: '' } });
  assert.equal(map.type, 'sum', 'a test-like heading is a summative');
  const i4 = itemOf(after, 'i4').typed.s;
  const vs = r => r && [r.v, r.st || ''];
  assert.deepEqual(vs(i4[N[0]]), was[N[0]] && (was[N[0]].v != null || was[N[0]].st) ? vs(was[N[0]]) : [16, ''], 'a score already there is kept');
  assert.deepEqual(after.classes[0].names, N, 'nobody added');
  await p.close();
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(() => { const c = window.__gs.state().lib.classes[0], it = c.units.flatMap(u => u.items).find(i => i.name === 'Map test'); return { typed: it.typed, type: it.type, i4: c.units.flatMap(u => u.items).find(i => i.id === 'i4').typed.s }; });
  assert.deepEqual(strip(main.typed), strip(map.typed)); assert.equal(main.type, 'sum'); assert.deepEqual(strip(main.i4), strip(i4));
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The entry list (src/mbentry.js): a task's scores in the school's order, a press on a student greys the row and moves on, the order
// kept as the teacher's own setting (lib.me.mbOrder), which the current app reads.
test('Entry list: one task in last-name order, ticked through, the order kept for the current app', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForSelector('table.book[data-term="t1"]', { timeout: 60000 });
  const N = (await libOf(p)).classes[0].names;
  const popup = new Promise(r => ctx.once('targetcreated', async tg => r(await tg.page())));
  await menuItem(p, 'Entry list');
  const w = await popup;
  await w.waitForSelector('[data-mb] [data-mb-task]');
  await w.select('[data-mb-task]', 'i4');
  await w.click('[data-mb-order="last"]');
  await p.waitForFunction(() => (JSON.parse(localStorage.getItem('gs.lib')).me || {}).mbOrder === 'last');
  const names = await w.$$eval('[data-mb] li .mbn', l => l.map(e => e.textContent));
  const last = n => n.split(' ').pop();
  assert.deepEqual(names, N.slice().sort((a, b) => last(a).localeCompare(last(b))));
  const vals = await w.$$eval('[data-mb] li .mbv', l => l.map(e => e.textContent));
  const i4 = itemOf(await libOf(p), 'i4').typed.s;
  assert.deepEqual(vals, names.map(n => String(i4[n].v)));
  await w.click('[data-mb-row="0"]'); await w.click('[data-mb-row="1"]');
  assert.equal(await w.$eval('[data-mb] li.cur', e => e.dataset.mbRow), '2');
  assert.equal(await w.$$eval('[data-mb] li.done', l => l.length), 2);
  await w.click('[data-mb-close]');
  await p.close();
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  assert.equal(await old.evaluate(() => (window.__gs.state().lib.me || {}).mbOrder), 'last');
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Google Classroom (src/classroom.js): the grades file makes the class (its name from the file's, the emails kept as details), then
// its Grades tab opens Import a gradebook with the scores, and the current app reads the class and its scores.
test('Google Classroom: a grades file makes a class and its scores come in through the import', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gs-gc-')), f = path.join(dir, 'Biology 9 - grades.csv');
  fs.writeFileSync(f, ['Last Name,First Name,Email Address,Map quiz,Lab write-up', 'Points,,,10,20', 'Sample,Nova,nova@example.org,8,15', 'Madeup,Ivo,ivo@example.org,9.5,Missing'].join('\n'));
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/new');
  await p.waitForSelector('[data-roster-gc]', { timeout: 60000 });
  await p.click('[data-roster-gc]');
  await p.waitForSelector('[data-gc] [data-gc-file]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('[data-gc] [data-gc-file]')]);
  await chooser.accept([f]);
  await p.waitForSelector('[data-gc-found]');
  assert.equal(await p.$eval('[data-gc-name] input, input[data-gc-name]', e => e.value), 'Biology 9');
  await p.click('[data-gc-go]');
  await p.waitForSelector('dialog[open] [data-bki-cols]', { timeout: 60000 });
  await p.click('dialog[open] [data-bki-save]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes.some(c => c.name === 'Biology 9' && c.units.flatMap(u => u.items).length === 2));
  const c = (await libOf(p)).classes.find(k => k.name === 'Biology 9'), items = c.units.flatMap(u => u.items);
  assert.deepEqual(c.names, ['Nova Sample', 'Ivo Madeup']);
  assert.equal(c.info['Nova Sample'].email, 'nova@example.org');
  const mq = items.find(i => i.name === 'Map quiz'), lab = items.find(i => i.name === 'Lab write-up');
  assert.equal(mq.typed.max, 10); assert.deepEqual(strip(mq.typed.s['Ivo Madeup']), { v: 9.5, st: '' });
  assert.equal(lab.typed.max, 20); assert.deepEqual(strip(lab.typed.s['Ivo Madeup']), { v: null, st: 'missing' });
  await p.close();
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(() => { const c = window.__gs.state().lib.classes.find(k => k.name === 'Biology 9'); return { names: c.names, n: c.units.flatMap(u => u.items).length }; });
  assert.deepEqual(main, { names: ['Nova Sample', 'Ivo Madeup'], n: 2 });
  await old.close();
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Scores on a phone (src/phone.js): at phone width the Grades tab lists the assignments; one opened has a box per student, a score
// typed and Missing from its menu save the gradebook's way, and the current app reads them.
test('Phone Scores: an assignment opened at phone width, a score typed and one marked missing, read the same by the current app', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForSelector('[data-phone-scores] [data-ph-col="i9"]', { timeout: 60000 });
  const N = (await libOf(p)).classes[0].names;
  await p.click('[data-ph-col="i9"]');
  await p.waitForSelector('[data-ph-one="i9"]');
  const box = await p.$('[data-ph-stu="' + N[2] + '"] [data-ph-in]');
  await box.click({ clickCount: 3 }); await box.type('8.5'); await p.keyboard.press('Enter');
  await p.waitForFunction(n => { const it = JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.flatMap(u => u.items).find(i => i.id === 'i9'); return it.typed.s[n] && it.typed.s[n].v === 8.5; }, {}, N[2]);
  await p.click('[data-ph-stu="' + N[3] + '"] [data-ph-more]');
  await p.waitForSelector('.pop [role^="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => /Missing/.test(b.textContent)).click());
  await p.waitForFunction(n => { const it = JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.flatMap(u => u.items).find(i => i.id === 'i9'); return it.typed.s[n] && it.typed.s[n].st === 'missing'; }, {}, N[3]);
  const s = strip(itemOf(await libOf(p), 'i9').typed.s);
  await p.close();
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(() => window.__gs.state().lib.classes[0].units.flatMap(u => u.items).find(i => i.id === 'i9').typed.s);
  assert.deepEqual(strip(main), s);
  assert.deepEqual([s[N[2]].v, s[N[3]].st], [8.5, 'missing']);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Attendance (src/attend.js): a day made in main's way is read here; a day taken here (a press, the keys, a note, Everyone is here)
// is read the same by the current app's attOf and attNote.
test('Attendance: a day taken with presses, the keys and a note, Everyone is here, Look back; read both ways with the current app', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  const N = await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('gs.lib')), c = l.classes[0]; c.att = { '2026-09-14': { t: 1, m: { [c.names[3]]: 'e' }, n: { [c.names[3]]: 'Dentist' } } }; localStorage.setItem('gs.lib', JSON.stringify(l)); return c.names; });
  await p.goto(srv.url + 'next/#/class/c1/people');
  await p.waitForSelector('[data-att-open]', { timeout: 60000 });
  await p.click('[data-att-open]');
  await p.waitForSelector('dialog[open] [data-att-row="0"]');
  const day = await p.$eval('[data-att-day]', e => e.dataset.attDay);
  assert.match(await p.$eval('[data-att-sum]', e => e.textContent), /Not taken/);
  // a press: the third student absent
  await p.click('[data-att-row="2"] [data-att-s="a"]');
  await p.waitForFunction((d, n) => ((JSON.parse(localStorage.getItem('gs.lib')).classes[0].att || {})[d] || { m: {} }).m[n] === 'a', {}, day, N[2]);
  // the keys: L on the first student moves to the second
  await p.waitForSelector('[data-att-row="0"] [data-att-s="p"][aria-checked="true"]');
  await p.focus('[data-att-row="0"] [data-att-s="p"]');
  await p.keyboard.press('l');
  await p.waitForFunction((d, n) => JSON.parse(localStorage.getItem('gs.lib')).classes[0].att[d].m[n] === 'l', {}, day, N[0]);
  await p.waitForFunction(() => document.activeElement && document.activeElement.closest('[data-att-row="1"]'));
  // a note on the absence
  await p.waitForSelector('[data-att-row="2"] [data-att-note]');
  await p.type('[data-att-row="2"] [data-att-note]', 'Called home'); await p.keyboard.press('Tab');
  await p.waitForFunction((d, n) => (JSON.parse(localStorage.getItem('gs.lib')).classes[0].att[d].n || {})[n] === 'Called home', {}, day, N[2]);
  // the day before: Everyone is here
  await p.click('[data-att-prev]');
  await p.waitForFunction(d => document.querySelector('[data-att-day]').dataset.attDay !== d, {}, day);
  const before = await p.$eval('[data-att-day]', e => e.dataset.attDay);
  await p.click('[data-att-all]');
  await p.waitForFunction(d => { const r = JSON.parse(localStorage.getItem('gs.lib')).classes[0].att[d]; return r && !r.off && !Object.keys(r.m).length; }, {}, before);
  // Look back, every date: main's day reads E with its note, the unknown absence is listed
  await p.click('dialog[open] .attbar [data-v="all"]');
  await p.waitForSelector('[data-att-tab], [data-att-none]');
  await p.evaluate(() => { const b = document.querySelector('dialog[open] .attnav [data-v="*"]'); if (b) b.click(); });
  await p.waitForSelector('[data-att-tab] [data-att-open="2026-09-14"]');
  const back = await p.evaluate(n => { const row = [...document.querySelectorAll('[data-att-tab] tbody tr')].find(r => r.querySelector('th').textContent === n); return [...row.querySelectorAll('.attc')].map(c => c.textContent + (c.querySelector('i') ? '*' : '')); }, N[3]);
  assert.deepEqual(back, ['E*', '', '']);
  assert.match(await p.$eval('[data-att-unk]', e => e.textContent), /1 absence still has no reason/);
  // the current app reads the days the same
  const mine = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].att);
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const seen = await old.evaluate((days, N) => { const G = window.__gs, c = G.state().lib.classes[0]; return days.map(d => N.map(n => G.attOf(c, d, n) + (G.attNote ? '' : ''))); }, [day, before, '2026-09-14'], N);
  assert.deepEqual(seen[0].slice(0, 4), ['l', 'p', 'a', 'p']);
  assert.ok(seen[1].every(s => s === 'p'));
  assert.equal(seen[2][3], 'e');
  assert.deepEqual(await old.evaluate(() => window.__gs.state().lib.classes[0].att), mine);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Seating: a room laid out, seated in roster order, a student kept in a seat through a shuffle, a desk added; read the same by the current app', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/c1/people');
  await p.waitForSelector('[data-seat-open]', { timeout: 60000 });
  const N = (await libOf(p)).classes[0].names;
  await p.click('[data-seat-open]');
  await p.waitForSelector('dialog[open] [data-seat-room="pairs"]');
  await p.click('[data-seat-room="pairs"]');
  await p.waitForFunction(() => (JSON.parse(localStorage.getItem('gs.lib')).classes[0].seats || {}).desks);
  await p.waitForSelector('dialog[open] [data-seat-menu]');
  const menu = async re => { await p.click('[data-seat-menu]'); await p.waitForSelector('.pop [role^="menuitem"]'); await p.evaluate(r => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => new RegExp(r).test(b.textContent)).click(), re); };
  await menu('roster order');
  await p.waitForFunction(n => Object.values(JSON.parse(localStorage.getItem('gs.lib')).classes[0].seats.desks).includes(n), {}, N[N.length - 1]);
  const first = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('gs.lib')).classes[0].seats; return s.desks['0,0']; });
  assert.equal(first, N[0]);
  // keep the first student in their seat, then shuffle
  // the desk is drawn again after the save; press it once it shows the student, and again if the redraw took the press
  await p.waitForSelector('[data-desk="0,0"][data-n]');
  for (let k = 0; k < 4 && !(await p.$('[data-seat-pin]')); k++) { await p.click('[data-desk="0,0"]'); await p.waitForSelector('[data-seat-pin]', { timeout: 3000 }).catch(() => {}); }
  await p.waitForSelector('[data-seat-pin]');
  await p.click('[data-seat-pin]');
  await p.waitForFunction(n => (JSON.parse(localStorage.getItem('gs.lib')).classes[0].seats.pins || []).includes(n), {}, N[0]);
  await p.click('[data-seat-shuffle]');
  await p.waitForSelector('.toast');
  const s1 = (await libOf(p)).classes[0].seats;
  assert.equal(s1.desks['0,0'], N[0]);
  assert.equal(Object.values(s1.desks).filter(Boolean).length, N.length);
  // a desk added where there was none
  await menu('Arrange');
  await p.waitForSelector('[data-cell].gap');
  const gap = await p.$eval('[data-cell].gap', e => e.dataset.cell);
  await p.click('[data-cell="' + gap + '"]');
  await p.waitForFunction(k => k in JSON.parse(localStorage.getItem('gs.lib')).classes[0].seats.desks, {}, gap);
  await p.click('[data-seat-done]');
  const mine = (await libOf(p)).classes[0].seats;
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(() => { const G = window.__gs, c = G.state().lib.classes[0]; return { raw: c.seats, list: G.seatList(c).map(x => x.name) }; });
  assert.deepEqual(main.raw, mine);
  assert.equal(main.list.length, N.length);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Pick a name from the class header: nobody twice, groups of 3, groups by hand with Undo, who is here; nothing saved', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.goto(srv.url + 'next/#/class/c1');
  await p.waitForSelector('[data-pick-name]', { timeout: 60000 });
  const lib0 = JSON.stringify(await libOf(p)), N = JSON.parse(lib0).classes[0].names;
  await p.evaluate(() => { window.__pkFast = true; });
  await p.click('[data-pick-name]');
  await p.waitForSelector('[data-picker] [data-pk-name]');
  const picked = [await p.$eval('[data-pk-name]', e => e.textContent)];
  // each Space shows the next name (pressed again if it came before the picker listened for keys)
  for (let i = 1; i < N.length; i++) {
    const was = picked[picked.length - 1];
    for (let k = 0; k < 20; k++) {
      await p.keyboard.press('Space');
      const now = await p.waitForFunction(w => { const t = document.querySelector('[data-pk-name]').textContent; return t !== w && t; }, { timeout: 1000 }, was).then(h => h.jsonValue(), () => null);
      if (now) { picked.push(now); break; }
    }
  }
  assert.equal(new Set(picked).size, N.length);
  // groups of 3
  await p.keyboard.press('g'); await p.keyboard.press('3');
  await p.waitForSelector('[data-pk-groups] [data-pk-g]');
  const sizes = await p.$$eval('[data-pk-groups] [data-pk-g]', g => g.map(x => x.querySelectorAll('[data-pk-s]').length));
  assert.equal(sizes.reduce((a, b) => a + b, 0), N.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  // by hand: everyone waits, one name put in group 1, Ctrl Z puts it back
  await p.click('[data-pk="hand"]');
  await p.waitForSelector('.pk-pool [data-pk-s]');
  await p.click('.pk-pool [data-pk-s="' + N[0] + '"]');
  await p.click('[data-pk-groups] [data-pk-g="0"] h3');
  await p.waitForSelector('[data-pk-g="0"] [data-pk-s="' + N[0] + '"]');
  await p.focus('[data-picker]');
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForSelector('.pk-pool [data-pk-s="' + N[0] + '"]');
  // who is here: one away leaves the pool
  await p.keyboard.press('w');
  await p.waitForSelector('[data-pk-w="1"]');
  await p.click('[data-pk-w="1"]');
  assert.equal(await p.$('.pk-pool [data-pk-s="' + N[1] + '"]'), null);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('[data-picker]'));
  assert.equal(JSON.stringify(await libOf(p)), lib0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('To do tab: a reminder drafted as the current app drafts it, opened in Gmail and marked reminded; a to-do for the class added and ticked', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); for (const c of l.classes) for (const n of c.names) { c.info ||= {}; c.info[n] = { ...(c.info[n] || {}), email: n.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.org' }; } localStorage.setItem('gs.lib', JSON.stringify(l)); });
  await p.goto(srv.url + 'next/#/class/c1/todo');
  await p.waitForSelector('[data-mis] [data-mis-sum], [data-mis] [data-mis-none]', { timeout: 60000 });
  // every term, so all the missing work shows
  await p.evaluate(() => { const b = document.querySelector('[data-mis] .misopts [data-v="*"]'); if (b) b.click(); });
  await p.waitForSelector('[data-mis-stu]');
  const i = await p.$eval('[data-mis-stu]', e => +e.dataset.misStu);
  await p.evaluate(() => { window.__mails = []; window.__gsMailTest = (h, u) => window.__mails.push([h, u]); });
  await p.click('[data-mis-stu="' + i + '"] [data-mis-mail]');
  await p.waitForFunction(() => window.__mails.length === 1);
  const [mailto, url] = await p.evaluate(() => window.__mails[0]);
  assert.match(url, /^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=/);
  const N = (await libOf(p)).classes[0].names, n = N[i];
  await p.waitForFunction(n => Object.keys(((JSON.parse(localStorage.getItem('gs.lib')).classes[0].info || {})[n] || {}).nudge || {}).length > 0, {}, n);
  // a to-do for this class, then ticked
  await p.type('[data-ctd-new]', 'Book the library for the essay'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => ((JSON.parse(localStorage.getItem('gs.lib')).todo || {}).items || []).some(x => x.x === 'Book the library for the essay' && x.c === 'c1'));
  await p.waitForSelector('[data-ctd-item] input'); await p.click('[data-ctd-item] input');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).todo.items.find(x => x.c === 'c1').done > 0);
  // the current app drafts the same email, reads the reminder and the to-do
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(n => { const l = window.__gs.state().lib, c = l.classes[0]; return { nudge: (c.info[n] || {}).nudge, todo: l.todo.items.find(x => x.c === 'c1') }; }, n);
  assert.ok(Object.keys(main.nudge || {}).length > 0);
  assert.equal(main.todo.x, 'Book the library for the essay');
  assert.ok(main.todo.done > 0);
  // the email's words are main's misDraft for the work the page lists
  const owed = await p.$$eval('[data-mis-stu="' + i + '"] .mislist .misw', e => e.map(x => x.textContent));
  const mine = await p.evaluate(h => { const m = /^mailto:([^?]*)\?(.*)$/.exec(h), q = Object.fromEntries(m[2].split('&').map(kv => kv.split('=').map(decodeURIComponent))); return { to: decodeURIComponent(m[1]), subject: q.subject, body: q.body.replace(/\r\n/g, '\n') }; }, mailto);
  const theirs = await old.evaluate((n, owed) => { const G = window.__gs, c = G.state().lib.classes[0]; const m = G.misDraft(c, n, owed.map(name => ({ name, due: '' }))); return { to: m.to, subject: m.subject }; }, n, owed);
  assert.equal(mine.to, theirs.to); assert.equal(mine.subject, theirs.subject);
  for (const w of owed) assert.ok(mine.body.includes('- ' + w));
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Learning goals on the made-up class: two goals, the rubric rows of both essays tagged with them.
const goalSeed = () => { const seed = bookSeed(), l = JSON.parse(seed.ls['gs.lib']); l.goals = [{ id: 'ga', name: 'Argument', at: 1 }, { id: 'gb', name: 'Style', at: 1 }]; seed.ls['gs.lib'] = JSON.stringify(l);
  for (const k of ['gs.b.n1', 'gs.b.n2']) { const b = JSON.parse(seed.ls[k]); b.setup = { ...b.setup, goals: ['ga', 'gb', 'gb'] }; seed.ls[k] = JSON.stringify(b); } return seed; };
const goalRows = `(G, c, cols) => G.goalData(c, cols).map(d => [d.g.id, d.g.name, Math.round(d.avg * 10) / 10, d.n, d.low.slice(), d.from.map(f => [f.col.key, f.parts, f.n]), [...d.stu.entries()].map(([n, v]) => [n, Math.round(v * 10) / 10])])`;
test('Learning goals: the class average on each goal and every student on every goal as the current app works them out; the list edited and read back', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await page(ctx, errors);
  await old.goto(srv.url + 'blank'); await plant(old, goalSeed());
  await old.goto(srv.url); await appReady(old);
  const was = await old.evaluate(async fn => { const G = window.__gs, c = G.state().lib.classes[0], cols = G.bkClassCols(c, await G.bkLoad()); return eval(fn)(G, c, cols); }, goalRows);
  await old.close();
  assert.equal(was.length, 2, 'both goals have scores');
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForFunction(() => window.__class && document.querySelector('table.book'), { timeout: 60000 });
  const now = await p.evaluate(async fn => { const k = window.__class, b = await k.readBook(), B = k.B, c = b.lib.classes[0]; B.bookUse({ lib: b.lib }); B.bkUse({ cls: c.id }); return eval(fn)(B, c, B.bkClassCols(c, b.cols)); }, goalRows);
  assert.deepEqual(now, was);
  // the sheet, on the whole year
  await p.evaluate(() => [...document.querySelectorAll('.bookbar [role="radio"]')].find(b => /Whole year/.test(b.textContent)).click());
  await p.click('[data-open-goals]');
  await p.waitForSelector('[data-goal-bars] .cp-band');
  const bars = await p.$$eval('[data-goal-bars] .cp-band [data-raw]', e => e.map(x => x.textContent));
  assert.deepEqual([...bars].sort(), ['Argument', 'Style']);
  const heads = await p.$$eval('[data-goal-heat] thead th', e => e.length);
  assert.equal(heads, 3);
  // rename one, take one off, add one
  await p.click('[data-goals-edit]');
  await p.waitForSelector('[data-goal-row]');
  await p.evaluate(() => { const i = document.querySelector('[data-goal-row="0"]'); i.value = 'Argument and claims'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('.goalrow:nth-child(2) button');
  await p.click('[data-goal-add]'); await p.waitForSelector('[data-goal-row="1"]');
  await p.focus('[data-goal-row="1"]'); await p.keyboard.type('Evidence');
  await p.click('[data-goals-done]');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); return l.goals && l.goals.length === 2 && l.goals[1].name === 'Evidence' && (l.goalsGone || {}).gb; });
  const old2 = await page(ctx, errors);
  await old2.goto(srv.url); await appReady(old2);
  const list = await old2.evaluate(() => window.__gs.goalList().map(g => [g.id, g.name]));
  assert.deepEqual(list.map(x => x[1]), ['Argument and claims', 'Evidence']); assert.equal(list[0][0], 'ga');
  await old2.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Report comments: each draft is the current app\'s draft, edited and marked done, the length and wording saved where the current app reads them', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await page(ctx, errors);
  await old.goto(srv.url + 'blank'); await plant(old, bookSeed());
  await old.goto(srv.url); await appReady(old);
  const draft = `async (G, len) => { const c = G.state().lib.classes[0], cols = G.bkClassCols(c, await G.bkLoad()), rc = G.rptConf(); if (len) rc.len = len; return c.names.map(n => G.rptDraft(c, n, G.rptFacts(c, cols, G.bkConf(), n), rc, 0)); }`;
  const was = await old.evaluate((fn) => eval(fn)(window.__gs), draft);
  await old.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForFunction(() => window.__class && document.querySelector('table.book'), { timeout: 60000 });
  await p.evaluate(() => [...document.querySelectorAll('.bookbar [role="radio"]')].find(b => /Whole year/.test(b.textContent)).click());
  await p.click('[data-open-reports]');
  await p.waitForSelector('[data-rp-text]');
  const N = (await libOf(p)).classes[0].names;
  for (let i = 0; i < N.length; i++) {
    await p.click('[data-rp-stu="' + i + '"]');
    await p.waitForFunction(n => document.querySelector('[data-rp-name]').textContent === n, {}, N[i]);
    assert.equal(await p.$eval('[data-rp-text]', e => e.value), was[i], 'draft for student ' + (i + 1));
  }
  // the first student's comment edited, then Done, next student
  await p.click('[data-rp-stu="0"]');
  await p.waitForFunction(n => document.querySelector('[data-rp-name]').textContent === n, {}, N[0]);
  await p.focus('[data-rp-text]'); await p.keyboard.press('End'); await p.keyboard.type(' A pleasure to teach.');
  await p.click('[data-rp-done]');
  await p.waitForFunction(n => document.querySelector('[data-rp-name]').textContent === n, {}, N[1]);
  await p.waitForFunction(n => { const r = ((JSON.parse(localStorage.getItem('gs.lib')).classes[0].info || {})[n] || {}).rep; return r && r.year && r.year.done && /A pleasure to teach\.$/.test(r.year.text); }, {}, N[0]);
  await p.waitForFunction(() => /^1 of /.test((document.querySelector('[data-rp-donecount]') || {}).textContent || ''));
  // short comments
  await p.evaluate(() => [...document.querySelectorAll('.rptopts [role="radio"]')].find(b => b.dataset.v === 'short').click());
  await p.waitForFunction(() => ((JSON.parse(localStorage.getItem('gs.lib')).book || {}).rep || {}).len === 'short');
  await p.waitForFunction(v => document.querySelector('[data-rp-text]').value !== v, {}, was[1]);   // the shown draft follows the length
  const short = await p.$eval('[data-rp-text]', e => e.value);
  // the current app reads all of it back
  const old2 = await page(ctx, errors);
  await old2.goto(srv.url); await appReady(old2);
  const back = await old2.evaluate(async (fn, n) => { const G = window.__gs, c = G.state().lib.classes[0]; return { rep: c.info[n].rep, len: G.rptConf().len, drafts: await eval(fn)(G) }; }, draft, N[0]);
  assert.equal(back.len, 'short'); assert.equal(back.rep.year.done, true); assert.match(back.rep.year.text, /A pleasure to teach\.$/);
  assert.equal(short, back.drafts[1]);
  await old2.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

const sheetNums = sel => `[...document.querySelectorAll('${sel} .pss')].map(a => ({ n: a.dataset.pss, tiles: [...a.querySelectorAll('.psst b')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()), cells: [...a.querySelectorAll('.psstab td.pssv')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()) }))`;
test('Progress sheets: every student\'s page has the current app\'s numbers, the choices kept where the current app reads them, and Print shows only the sheets', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await page(ctx, errors);
  await old.goto(srv.url + 'blank'); await plant(old, bookSeed());
  await old.goto(srv.url); await appReady(old);
  await old.evaluate(() => { location.hash = '#/class/c1/students'; });
  await old.waitForSelector('[data-pssall]'); await old.click('[data-pssall]');
  await old.waitForSelector('#pssPages .pss'); await old.click('[data-pssterm="*"]');
  await old.waitForFunction(() => document.querySelector('[data-pssterm="*"]').getAttribute('aria-selected') === 'true');
  const was = await old.evaluate(sheetNums('#pssPages'));
  await old.close();
  assert.ok(was.length > 3 && was[0].tiles.length > 2 && was[0].cells.length > 5);
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForFunction(() => window.__class && document.querySelector('table.book'), { timeout: 60000 });
  await p.click('[data-open-sheets]');
  await p.waitForSelector('[data-pss-sheet] .pss');
  await p.evaluate(() => document.querySelector('[data-pss-sheet] .pssbar [data-v="*"]').click());
  await p.waitForFunction(() => document.querySelector('[data-pss-sheet] .pssbar [data-v="*"]').getAttribute('aria-checked') === 'true');
  const now = await p.evaluate(sheetNums('[data-pss-sheet]'));
  assert.deepEqual(now, was);
  // the three choices
  await p.click('[data-pss-opt="notes"] input');
  await p.waitForFunction(() => ((JSON.parse(localStorage.getItem('gs.lib')).book || {}).sheet || {}).notes === false);
  await p.waitForFunction(() => !document.querySelector('[data-pss-sheet] .pssnotes'));
  // Print: only the sheets are left for the printer
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.click('[data-pss-print]');
  assert.equal(await p.evaluate(() => window.__printed), 1);
  assert.equal(await p.$$eval('#pssPrint .pss', a => a.length), was.length);
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await p.$('#pssPrint'), null);
  const old2 = await page(ctx, errors);
  await old2.goto(srv.url); await appReady(old2);
  assert.deepEqual(await old2.evaluate(() => window.__gs.state().lib.book.sheet), { notes: false });
  await old2.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('A student\'s details and Settings > Classes: ID and email edited and opened in the mail app chosen in Settings, attendance turned off; the current app reads the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  // Settings: Outlook on the web, and attendance off
  await p.goto(srv.url + 'next/#/settings/classes');
  await p.waitForSelector('[data-sgmail] [data-v="outlook"]', { timeout: 60000 });
  await p.click('[data-sgmail] [data-v="outlook"]');
  await p.waitForFunction(() => localStorage.getItem('gs.mailApp') === '"outlook"');
  await p.click('[data-sgatt] [role="switch"]');
  await p.waitForFunction(() => (JSON.parse(localStorage.getItem('gs.lib')).me || {}).att === false);
  // a student's details
  await p.goto(srv.url + 'next/#/class/c1/people/2');
  await p.waitForSelector('[data-details]', { timeout: 60000 });
  assert.equal(await p.$('[data-att-open]'), null, 'attendance is off');
  await p.click('[data-det-edit]'); await p.waitForSelector('[data-det="email"]');
  // typed once the box is open and has the focus: a key pressed before that goes to the page behind
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('dialog[open] [data-det="id"]'), { timeout: 10000 });
  await p.type('[data-det="id"]', 'S-1042'); await p.type('[data-det="email"]', 'pat.madeup@example.org');
  await p.click('[data-det-save]');
  await p.waitForSelector('[data-det-mail]');
  await p.evaluate(() => { window.__mails = []; window.__gsMailTest = (h, u) => window.__mails.push([h, u]); });
  await p.click('[data-det-mail]');
  await p.waitForFunction(() => window.__mails.length > 0);
  const [href, url] = await p.evaluate(() => window.__mails[0]);
  assert.equal(href, 'mailto:pat.madeup@example.org');
  assert.match(url, /^https:\/\/outlook\.office\.com\/mail\/deeplink\/compose\?to=pat\.madeup%40example\.org$/);
  const n = (await libOf(p)).classes[0].names[1];
  // polled by the clock: a window behind another doesn't draw frames, so a wait tied to them can stall (test/helpers/app.js appReady)
  await p.waitForFunction(n => { const i = (JSON.parse(localStorage.getItem('gs.lib')).classes[0].info || {})[n] || {}; return i.id === 'S-1042' && i.email === 'pat.madeup@example.org'; }, { polling: 100, timeout: 30000 }, n);
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(n => { const l = window.__gs.state().lib, i = l.classes[0].info[n]; return { id: i.id, email: i.email, att: l.me.att, mail: JSON.parse(localStorage.getItem('gs.mailApp')) }; }, n);
  assert.deepEqual(main, { id: 'S-1042', email: 'pat.madeup@example.org', att: false, mail: 'outlook' });
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Strong examples and the watch list, kept in the current app's own database (grading-studio-examples: ex, pix) as the current app
// saves them: two strong examples and one concern on a made-up student, with plain pictures drawn here.
const exSeed = `async names => {
  const pic = async (shade) => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = shade; x.fillRect(0, 0, 400, 300); x.fillStyle = '#333'; x.fillRect(40, 40, 320, 20); return new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)); };
  const now = Date.now(), base = { work: null, asg: 'i1', cls: 'c1', title: 'Fractions quiz', q: null, row: null, marks: true, score: false, from: null, pages: [{ w: 400, h: 300 }] };
  const recs = [
    { ...base, id: 'exa', t: now - 3000, kind: 'paper', letter: 'A', why: 'Shows every step', tags: ['steps', 'Unit 1'], who: { c: 'c1', n: names[0] } },
    { ...base, id: 'exb', t: now - 2000, kind: 'shot', letter: '1', why: '', tags: ['diagrams'], who: { c: 'c1', n: names[1] } },
    { ...base, id: 'wla', t: now - 1000, kind: 'shot', letter: '1', why: 'Mixes up mean and median', tags: [], who: { c: 'c1', n: names[1] }, watch: 1 },
  ];
  const blobs = await Promise.all(recs.map((r, i) => pic(['#dde', '#ede', '#eed'][i])));
  const db = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples', 1); r.onupgradeneeded = () => { r.result.createObjectStore('ex'); r.result.createObjectStore('pix'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction(['ex', 'pix'], 'readwrite'); recs.forEach((r, i) => { tx.objectStore('ex').put(r, r.id); tx.objectStore('pix').put(blobs[i], r.id + '|0'); }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
}`;

test('Library > Examples and the watch list: the current app\'s examples shown, filtered, edited and deleted; a student\'s strengths and concerns on their page; the current app reads the changes', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  const names = (await libOf(p)).classes[0].names;
  await p.evaluate(`(${exSeed})(${JSON.stringify(names)})`);
  // the current app reads them as they are
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  await old.waitForFunction(() => window.__gs.exList().length === 2);
  const mainBefore = await old.evaluate(() => ({ ex: window.__gs.exList().map(r => r.id).sort(), watch: window.__gs.exWatch().map(r => r.id) }));
  assert.deepEqual(mainBefore, { ex: ['exa', 'exb'], watch: ['wla'] });
  await old.close();
  // Library > Examples: the two strong ones, with no names on them
  await p.goto(srv.url + 'next/#/library/examples');
  await p.waitForSelector('[data-exid="exa"]', { timeout: 60000 });
  const cards = () => p.$$eval('[data-exid]', l => l.map(e => e.getAttribute('data-exid')).sort());
  assert.deepEqual(await cards(), ['exa', 'exb']);
  // a tag narrows the list
  await p.click('[data-exid="exb"] [data-extag="diagrams"]');
  await p.waitForFunction(() => document.querySelectorAll('[data-exid]').length === 1);
  assert.deepEqual(await cards(), ['exb']);
  await p.click('[data-exclear]');
  await p.waitForFunction(() => document.querySelectorAll('[data-exid]').length === 2);
  // why it's strong, added to the second
  await p.click('[data-exid="exb"] [data-exmenu]');
  await p.waitForSelector('.pop [role^="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => /why it/.test(b.textContent)).click());
  await p.waitForSelector('[data-exedit]'); await p.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-exedit]')); await p.type('[data-exedit]', 'Labels every part');
  await p.click('[data-exedit-save]');
  await p.waitForFunction(() => /Labels every part/.test((document.querySelector('[data-exid="exb"] .exwhy') || {}).textContent || ''));
  // Show to the class: no names, arrows move, Esc closes
  await p.click('[data-exshow]'); await p.waitForSelector('[data-exshow-on]');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-exshow-on]'));   // the keys are listened for once it has focus
  assert.equal(await p.$eval('[data-exshow-on]', (e, N) => N.some(n => e.textContent.includes(n)), names), false);
  await p.keyboard.press('ArrowRight');
  await p.waitForFunction(() => /^2/.test(document.querySelector('[data-exshow-at]').textContent));
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('[data-exshow-on]'));
  // the watch list
  await p.click('[data-v="watch"]');
  await p.waitForSelector('[data-exid="wla"]');
  assert.deepEqual(await cards(), ['wla']);
  // delete the first strong example
  await p.click('[data-v="ex"]'); await p.waitForSelector('[data-exid="exa"] [data-exmenu]');
  await p.click('[data-exid="exa"] [data-exmenu]');
  await p.waitForSelector('.pop [role^="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => /Delete/.test(b.textContent)).click());
  await p.waitForFunction(() => !document.querySelector('[data-exid="exa"]'));
  // the second student's page: one strength and one concern
  await p.goto(srv.url + 'next/#/class/c1/people/2');
  await p.waitForSelector('[data-wl-stu]', { timeout: 60000 });
  assert.equal(await p.$$eval('[data-wl-stu] .wltime li', l => l.map(e => e.className).sort().join(',')), 'g,w');
  // the current app reads the same
  const old2 = await page(ctx, errors);
  await old2.goto(srv.url); await appReady(old2);
  await old2.waitForFunction(() => window.__gs.exList().length === 1);
  const mainAfter = await old2.evaluate(n => ({ ex: window.__gs.exList().map(r => [r.id, r.why]), watch: window.__gs.exWatch().length, wl: window.__gs.wlOf ? (window.__gs.wlOf('c1', n) || []).length : 2 }), names[1]);
  assert.deepEqual(mainAfter.ex, [['exb', 'Labels every part']]);
  assert.equal(mainAfter.watch, 1);
  await old2.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Linked classes: two classes linked, a card made in each joined, an assignment added to the other class and unlinked; the current app reads the same links', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  const seed = bookSeed(), L = JSON.parse(seed.ls['gs.lib']);
  L.classes[1].units = [{ id: 'u20', name: 'Unit 1: Stories', items: [{ id: 'k2', name: 'Story map', classId: 'c2', type: 'fm', due: '2026-09-06' }] }];
  seed.ls['gs.lib'] = JSON.stringify(L);
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-lkhead] [data-lkedit]', { timeout: 60000 });
  await p.click('[data-lkedit]'); await p.waitForSelector('[data-lkpick="c2"] input');
  await p.click('[data-lkpick="c2"] input');
  await p.type('[data-lkcourse] input, input[data-lkcourse]', 'English');
  await p.click('[data-lksave]');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); return l.classes[0].course === 'English' && l.classes[1].course === 'English'; });
  // the cards made in each class that look alike: Story map ticked
  await p.waitForSelector('[data-lkrow="0"] input');
  assert.equal(await p.$eval('[data-lkrow="0"] input', e => e.checked), true);
  await p.click('[data-lkmatch-save]');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')), a = l.classes[0].units[0].items.find(x => x.id === 'i2'), b = l.classes[1].units[0].items[0]; return a.group && a.group === b.group; });
  await p.waitForSelector('[data-item="i2"] [data-lktw]');
  // Narrative essay added to the other class, in the unit of the same name
  await p.click('[data-more-for="i3"]'); await p.waitForSelector('.pop [role^="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => /Add to Grade 10/.test(b.textContent)).click());
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); return l.classes[1].units[0].items.some(x => x.name === 'Narrative essay'); });
  const lib1 = await libOf(p), i3 = lib1.classes[0].units[0].items.find(x => x.id === 'i3'), copy = lib1.classes[1].units[0].items.find(x => x.name === 'Narrative essay');
  assert.equal(copy.group, i3.group); assert.equal(copy.due, i3.due); assert.equal(copy.type, i3.type); assert.equal(lib1.classes[1].units.length, 1);
  // the current app reads the links
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  const main = await old.evaluate(cid => ({ sibs: window.__gs.lkSibs('c1'), i2: window.__gs.lkTwins('i2'), i3: window.__gs.lkTwins('i3'), copy: window.__gs.lkTwins(cid) }), copy.id);
  assert.deepEqual(main, { sibs: ['c2'], i2: ['k2'], i3: [copy.id], copy: ['i3'] });
  await old.close();
  // Unlink Narrative essay: neither copy keeps the group
  await p.reload(); await p.waitForSelector('[data-item="i3"] [data-lktw]', { timeout: 60000 });
  await p.click('[data-more-for="i3"]'); await p.waitForSelector('.pop [role^="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => /Unlink/.test(b.textContent)).click());
  await p.waitForFunction(id => { const l = JSON.parse(localStorage.getItem('gs.lib')); return !l.classes[0].units[0].items.find(x => x.id === 'i3').group && !l.classes[1].units[0].items.find(x => x.id === id).group; }, {}, copy.id);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Linked classes: the Planner puts two classes on one course, the class offers to link them, No thanks is kept, and Link them links both', async () => {
  const { plantPlan } = require('./planseed.js');
  const ctx = await browser.createBrowserContext(), errors = [];
  const p = await page(ctx, errors);
  const seed = bookSeed(), L = JSON.parse(seed.ls['gs.lib']);
  const setup = { classes: L.classes.slice(0, 2).map((c, i) => ({ id: 'P' + i, name: c.name, course: 'English', color: '#1F6FB2', meets: [] })) };
  await p.goto(srv.url + 'blank'); await plant(p, seed); await plantPlan(p, { setup, lessons: [], units: [] });
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-lkoffer]', { timeout: 60000 });
  const text = await p.$eval('[data-lkoffer]', e => e.textContent);
  assert.ok(text.includes(L.classes[0].name) && text.includes(L.classes[1].name), text);
  // No thanks: this class says no, and the offer goes
  await p.click('[data-lkno]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].course === '');
  await p.waitForFunction(() => !document.querySelector('[data-lkoffer]'));
  // with that class's no, the other class has no one to link with, as in the current app
  await p.goto(srv.url + 'next/#/class/c2/work');
  await p.waitForSelector('[data-lkhead]', { timeout: 60000 });
  assert.equal(await p.$('[data-lkoffer]'), null);
  // with the no taken back, Link them gives both the Planner's course
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); delete l.classes[0].course; localStorage.setItem('gs.lib', JSON.stringify(l)); });
  await p.reload(); await p.waitForSelector('[data-lkoffer] [data-lkyes]', { timeout: 60000 });
  await p.click('[data-lkyes]');
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); return l.classes[0].course === 'English' && l.classes[1].course === 'English'; });
  await p.waitForSelector('[data-lkhead] .lkchip');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// D-003 D-024 D-025 D-026 D-027 (src/examples.js exCard, exCardAct; src/watch.js wlWhoHtml): a card's whose-work name and Whose work's
// names go to the student's card, Add why it's strong is on the card, Copy picture on answers, parts and screenshots, and Delete takes
// it away with Undo bringing it back. D-060 D-061 D-062 (wlCardFill): a student with nothing yet is told how, All / Strong / Watch, and
// the concerns' tags seen most. D-012 (wlStrip): Black out more on a picture in the send box, and back to the box.
test('D-003 D-012 D-024 D-025 D-026 D-027 D-060 D-061 D-062: example cards, whose work, the student\'s strengths and concerns, Black out more; the current app reads the changes', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  await ctx.overridePermissions(srv.url.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, bookSeed());
  const names = (await libOf(p)).classes[0].names;
  await p.evaluate(`(${exSeed})(${JSON.stringify(names)})`);
  // two more concerns for the second student, tagged
  await p.evaluate(n => new Promise((res, rej) => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(0, 0, 300, 200); c.toBlob(b => { const r = indexedDB.open('grading-studio-examples'); r.onsuccess = () => { const tx = r.result.transaction(['ex', 'pix'], 'readwrite'), now = Date.now();
    [['wlb', ['fractions']], ['wlc', ['fractions', 'units']]].forEach(([id, tags], i) => { tx.objectStore('ex').put({ id, t: now - 500 + i, kind: 'shot', work: null, asg: 'i1', cls: 'c1', title: 'Fractions quiz', q: null, row: null, why: '', letter: String(i + 2), pages: [{ w: 300, h: 200 }], marks: true, score: false, from: null, who: { c: 'c1', n }, tags, watch: 1 }, id); tx.objectStore('pix').put(b, id + '|0'); });
    tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }, 'image/jpeg'); }), names[1]);
  await p.goto(srv.url + 'next/#/library/examples');
  await p.waitForSelector('[data-exid="exb"]', { timeout: 60000 });
  // D-024: whose work goes to the student's card
  assert.equal(await p.$eval('[data-exid="exb"] [data-exwhoc]', a => [a.textContent, a.getAttribute('href')].join()), names[1] + ',#/class/c1/people/2');
  // D-025: Add why it's strong, on the card
  await p.click('[data-exid="exb"] [data-exwhyadd]');
  await p.waitForSelector('[data-exedit]'); await p.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-exedit]'));
  await p.type('[data-exedit]', 'Clear diagram'); await p.click('[data-exedit-save]');
  await p.waitForFunction(() => /Clear diagram/.test((document.querySelector('[data-exid="exb"] .exwhy') || {}).textContent || ''));
  // D-026: Copy picture on a screenshot, not on a whole paper
  assert.equal(await p.$('[data-exid="exa"] [data-excopy]'), null);
  await p.click('[data-exid="exb"] [data-excopy]');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => /Copied\. A picture you paste into a lesson is kept with that lesson\./.test(e.textContent)), { timeout: 15000 });
  // D-027: Delete, then Undo brings it back with its picture
  await p.click('[data-exid="exa"] [data-exmenu]'); await p.waitForSelector('.pop [role^="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => /Delete/.test(b.textContent)).click());
  await p.waitForFunction(() => !document.querySelector('[data-exid="exa"]'));
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => /Undo/.test(b.textContent)).click());
  await p.waitForSelector('[data-exid="exa"] .exthumb img', { timeout: 15000 });
  // D-003: Whose work's names go to the student's card
  await p.click('[data-v="who"]'); await p.waitForSelector('[data-exwho] a');
  assert.equal(await p.$$eval('[data-exwho] a', a => a.find(x => x.getAttribute('href') === '#/class/c1/people/1').textContent), names[0]);
  // D-061 D-062: the second student's page
  await p.goto(srv.url + 'next/#/class/c1/people/2');
  await p.waitForSelector('[data-wl-stu] .wltime li', { timeout: 60000 });
  assert.equal(await p.$eval('[data-wl-seen]', e => e.textContent), 'Seen most: fractions ×2units');
  const kinds = () => p.$$eval('[data-wl-stu] .wltime li', l => l.map(e => e.className).sort().join(','));
  assert.equal(await kinds(), 'g,w,w,w');
  assert.deepEqual(await p.$$eval('[data-wl-stu] .seg [role="radio"], [data-wl-stu] .seg button', b => b.map(x => x.textContent)), ['All', 'Strong · 1', 'Watch · 3']);
  await p.click('[data-wl-stu] [data-v="watch"]'); await p.waitForFunction(() => document.querySelectorAll('[data-wl-stu] .wltime li').length === 3);
  assert.equal(await kinds(), 'w,w,w');
  // D-012: Black out more on a picture in the send box, then back to the box
  await p.click('[data-wl-send1]'); await p.waitForSelector('[data-wlmore="wlb"]');
  await p.type('[data-wl-ask]', ' Keep it short.');
  await p.click('[data-wlmore="wlb"]');
  await p.waitForSelector('[data-excv="0"]', { timeout: 15000 });
  await p.waitForFunction(() => document.querySelector('[data-excv="0"]').width > 0);
  const r = await p.$eval('[data-excv="0"]', e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await p.mouse.move(r.x + r.w * 0.2, r.y + r.h * 0.2); await p.mouse.down(); await p.mouse.move(r.x + r.w * 0.5, r.y + r.h * 0.5, { steps: 4 }); await p.mouse.up();
  await p.click('[data-excover-save]');
  await p.waitForSelector('[data-wl-pdf]', { timeout: 15000 });
  assert.match(await p.$eval('[data-wl-ask]', e => e.value), / Keep it short\.$/, 'the ask is as it was');
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('[data-wl-pdf]'));
  // D-060: a student with nothing saved is told how
  await p.goto(srv.url + 'next/#/class/c1/people/3');
  await p.waitForSelector('[data-wl-none]', { timeout: 60000 });
  assert.match(await p.$eval('[data-wl-none]', e => e.textContent), /^Nothing saved from their work yet\./);
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  await old.waitForFunction(() => window.__gs.exList().length === 2 && window.__gs.exWatch().length === 3);
  assert.deepEqual(await old.evaluate(() => window.__gs.exList().map(r => [r.id, r.why]).sort()), [['exa', 'Shows every step'], ['exb', 'Clear diagram']]);
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});
