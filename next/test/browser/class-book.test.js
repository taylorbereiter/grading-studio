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
  await p.click('[data-book-copy]');
  await p.waitForFunction(() => window.__copied);
  const copied = await p.evaluate(() => window.__copied);
  assert.ok(copied.split('\n').length >= 8 && /Aria Testwell/.test(copied) && /\t/.test(copied));
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
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  assert.ok(await old.evaluate(() => window.__gs.state().lib.classes.some(k => k.name === 'Grade 11 Drama' && k.names.length === 2)));
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});
