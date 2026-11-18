// The marking screen in a real browser (stage 4). Work made in the current app (main's own pages in this repository) opens in the
// new app as the same students, files and marks, and every page draws to the same pixels: one mark of each kind, on papers opened
// from a ZIP of made-up students. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, markPage, settle, goToStudent, waitPaper } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { loadLegacy } = require('../../../test/helpers/legacy.js');

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

let browser, srv, L;
before(async () => { srv = await serveSite(); browser = await launch(); L = await loadLegacy(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors, width = 1440) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: 900 });
  return p;
}
// What a download is, as either app holds it: each student's key, their files and the marks on each page. A page looked at gets
// an empty list of marks and its page count; those come from looking, not from the work, and are left out.
const shape = `b => b.students.map(st => ({ key: st.key, files: st.files.map(f => ({ path: f.path, kind: f.kind, marks: Object.fromEntries(Object.entries(f.marks).filter(([, l]) => l.length)), rot: f.rot || null })), grade: st.grade }))`;
// A page's pixels, as a SHA-256 of what is on its canvas.
// Each page is taken as a PNG, and both apps' PNGs are read back in one page into a plain canvas and hashed there: the PNG files
// themselves can differ in how they are packed, and reading a canvas's memory straight back can differ by where it was drawn.
const png = `c => c.toDataURL('image/png')`;
const pixels = `async u => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const h = await crypto.subtle.digest('SHA-256', x.getImageData(0, 0, c.width, c.height).data); return c.width + 'x' + c.height + ':' + [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }`;

// Main's page: a ZIP of made-up papers, every kind of mark on the first student's first page, and the other kinds on the second page.
async function makeWork(ctx, errors) {
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url); await appReady(p);
  await openZip(p, zipOf(await standardFiles()));
  await markPage(p, 0);
  await p.evaluate(() => {
    const G = window.__gs, s = G.state(), st = s.batch.students[0], f = st.files[0];
    const add = (pg, m) => (f.marks[pg] ||= []).push(m);
    add(0, { t: 'stamp', k: 'sp', x: 420, y: 300, size: 16, color: '#D7263D' });
    add(0, { t: 'stamp', k: 'score', x: 470, y: 120, size: 52, text: '9/12 = 89%', color: '#D7263D' });
    add(0, { t: 'stamp', k: 'crit', x: 470, y: 200, size: 40, of: 'Criterion 1', name: 'Criterion 1', text: '3/4', color: '#D7263D' });
    add(0, { t: 'stamp', k: 'star', x: 480, y: 640, size: 40 });
    add(1, { t: 'pen', color: '#1F5FD1', w: 2, pts: [[100, 100], [140, 130], [180, 100]] });
    G.setPageLit(st, f, 1, true); G.setPageOwnL(st, f, 1, { b: 18, c: 12 });
  });
  await p.evaluate(() => window.__gs.saveNow());
  await goToStudent(p, 1); await goToStudent(p, 0);
  await settle(p);
  const out = await p.evaluate(async (shape, png) => {
    const s = window.__gs.state();
    const pages = [];
    for (const pg of s.pages) pages.push({ key: pg.file.path + '|' + pg.idx, s: pg.s, dpr: window.devicePixelRatio || 1, png: eval(png)(pg.canvas) });
    return { id: s.batch.id, shape: eval(shape)(s.batch), pages, cur: s.cur };
  }, shape, png);
  await p.close();
  return out;
}

test('work made in the current app opens in the new app as the same students, files and marks, drawn to the same pixels', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await makeWork(ctx, errors);
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id));
  await p.waitForFunction(() => window.__mark && window.__mark.state().batch && window.__mark.state().pages.length && window.__mark.state().pages.every(pg => pg.bmp), { timeout: 60000 });
  const now = await p.evaluate(async (shape, png, pixels, pages) => {
    const M = window.__mark, s = M.state(), out = [], was = [];
    for (const want of pages) {
      was.push({ key: want.key, hash: await eval(pixels)(want.png) });
      const pg = s.pages.find(q => q.file.path + '|' + q.idx === want.key);
      if (!pg) { out.push({ key: want.key, hash: 'missing' }); continue; }
      await M.renderPage(pg, want.s, want.dpr);
      out.push({ key: want.key, hash: await eval(pixels)(eval(png)(pg.canvas)) });
    }
    return { shape: eval(shape)(s.batch), pages: out, was, cur: s.cur };
  }, shape, png, pixels, old.pages);
  old.pages = now.was;
  assert.deepEqual(now.shape, old.shape, 'the same students, files, marks and scores');
  assert.equal(now.cur, old.cur, 'opens on the student she was on');
  assert.ok(old.pages.length >= 2, 'the marked pages are on screen in the current app');
  assert.deepEqual(now.pages, old.pages, 'every page draws to the same pixels');
  // nothing was written by opening it
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Every page main has on screen for the open student, as PNGs with the scale each was drawn at.
const mainPages = (p, png) => p.evaluate(png => { const s = window.__gs.state(); return s.pages.map(pg => ({ key: pg.file.path + '|' + pg.idx, s: pg.s, dpr: window.devicePixelRatio || 1, png: eval(png)(pg.canvas) })); }, png);
// Main draws a page's picture when it comes into view, so each is brought into view in turn.
const mainDrawn = p => p.evaluate(async () => {
  const s = window.__gs.state(), t = Date.now();
  for (const pg of s.pages) { pg.canvas.scrollIntoView({ block: 'center' }); while (!(pg.s > 0 && pg.bmp)) { if (Date.now() - t > 60000) throw new Error('main never drew ' + pg.file.path + ' page ' + pg.idx); await new Promise(r => setTimeout(r, 50)); } }
});
// The same pages drawn by the new app at main's scale, and main's own, both read back here.
const compare = (p, pages) => p.evaluate(async (png, pixels, pages) => {
  const M = window.__mark, s = M.state(), now = [], was = [];
  for (const want of pages) {
    was.push({ key: want.key, hash: await eval(pixels)(want.png) });
    const pg = s.pages.find(q => q.file.path + '|' + q.idx === want.key);
    if (!pg) { now.push({ key: want.key, hash: 'missing' }); continue; }
    await M.renderPage(pg, want.s, want.dpr);
    now.push({ key: want.key, hash: await eval(pixels)(eval(png)(pg.canvas)) });
  }
  return { now, was, extra: s.pages.map(q => q.file.path + '|' + q.idx).filter(k => !pages.some(w => w.key === k)) };
}, png, pixels, pages);
const nextReady = (p, i) => p.waitForFunction(i => { const M = window.__mark, s = M && M.state(); if (!(s && s.batch && s.cur === i && M.ready)) return false; const st = s.batch.students[i]; return s.pages.every(pg => st.files.includes(pg.file) && pg.canvas && pg.bmp); }, { timeout: 60000 }, i);

test('work saved before saved-data versions (the legacy fixture) opens in the new app and every student draws as in the current app', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await page(ctx, errors);
  await old.goto(srv.url + 'blank'); await plant(old, L.seed());
  await old.goto(srv.url); await appReady(old);
  // Main stands aside while the new app is open in another tab, so the new app's tab is closed before main opens the next one.
  for (const name of ['River essay', 'Quiz']) {
    const now = await page(ctx, errors);
    const want = Object.values(L.expected).find(b => b && b.name === name);
    await old.bringToFront();
    await old.waitForFunction(n => [...document.querySelectorAll('#vHome .krow')].some(r => r.textContent.includes(n)), {}, name);
    await old.evaluate(n => [...document.querySelectorAll('#vHome .krow')].find(r => r.textContent.includes(n)).querySelector('[data-kopen]').click(), name);
    await old.waitForFunction(n => { const s = window.__gs.state(); return s.batch && s.batch.name === n; }, {}, name);
    await old.waitForFunction(() => window.__gs.state().pages.length > 0, { timeout: 20000 });
    const oldShape = await old.evaluate(shape => eval(shape)(window.__gs.state().batch), shape);
    await now.bringToFront(); await now.goto(srv.url + 'next/#/mark/' + encodeURIComponent(want.id));
    await now.waitForFunction(n => window.__mark && window.__mark.ready && window.__mark.state().batch && window.__mark.state().batch.name === n, { timeout: 60000 }, name);
    assert.deepEqual(await now.evaluate(shape => eval(shape)(window.__mark.state().batch), shape), oldShape, name + ': the same students, files, marks and scores');
    for (let i = 0; i < oldShape.length; i++) {
      await old.bringToFront(); await goToStudent(old, i); await mainDrawn(old);
      const pages = await mainPages(old, png);
      await now.bringToFront(); await now.evaluate(i => document.querySelector('[data-st="' + i + '"]').click(), i);
      await nextReady(now, i);
      const r = await compare(now, pages);
      assert.deepEqual(r.now, r.was, name + ', ' + oldShape[i].key + ': every page draws to the same pixels');
      assert.deepEqual(r.extra, [], name + ', ' + oldShape[i].key + ': no page the current app leaves out');
    }
    await now.close();
    await old.bringToFront(); await old.evaluate(() => { history.replaceState(null, '', location.pathname); }); await old.goto(srv.url); await appReady(old);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The new app's page k of the open student: PDF points to screen pixels, scrolled into view first.
const nextAt = async (p, k, x, y) => {
  await p.evaluate(k => window.__mark.state().pages[k].canvas.scrollIntoView({ block: 'center' }), k);
  return p.evaluate((k, x, y) => { const pg = window.__mark.state().pages[k], r = pg.canvas.getBoundingClientRect(); return { x: r.left + x * pg.s, y: r.top + y * pg.s }; }, k, x, y);
};
async function nextDrag(p, k, pts) {
  const a = await nextAt(p, k, ...pts[0]); await p.mouse.move(a.x, a.y); await p.mouse.down();
  for (const q of pts.slice(1)) { const b = await p.evaluate((k, x, y) => { const pg = window.__mark.state().pages[k], r = pg.canvas.getBoundingClientRect(); return { x: r.left + x * pg.s, y: r.top + y * pg.s }; }, k, ...q); await p.mouse.move(b.x, b.y, { steps: 4 }); }
  await p.mouse.up();
}
const marksOf = (p, k) => p.evaluate(k => { const pg = window.__mark.state().pages[k]; return JSON.parse(JSON.stringify(pg.marks())); }, k);
const press = async (p, sel) => { await p.waitForSelector(sel); await p.click(sel); };

test('marks made in the new app (pen, highlight, circle, check, text, comment, eraser, undo and redo) open in the current app as the same marks, drawn to the same pixels', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  // A download kept by main, with nothing on it yet.
  const made = await page(ctx, errors);
  await made.goto(srv.url + 'blank'); await plant(made, gradingSeed());
  await made.goto(srv.url); await appReady(made);
  await openZip(made, zipOf(await standardFiles()));
  await made.evaluate(() => window.__gs.saveNow()); await settle(made);
  const id = await made.evaluate(() => window.__gs.state().batch.id);
  await made.close();

  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await nextReady(p, await p.evaluate(() => 0).then(() => p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 }).then(() => p.evaluate(() => window.__mark.state().cur))));
  // What opened sits over the foot of the paper, as the current app's does; it is closed first, as a teacher would
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  // the keys choose the tools, as in the current app
  await p.keyboard.press('p');
  assert.equal(await p.evaluate(() => window.__mark.state().tool), 'pen');
  await press(p, '.mk-sw [data-sw="blue"]');
  await nextDrag(p, 0, [[100, 120], [140, 150], [180, 120], [220, 150]]);
  await nextDrag(p, 0, [[100, 220], [200, 260]]);
  assert.equal((await marksOf(p, 0)).length, 2, 'two pen strokes');
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  assert.equal((await marksOf(p, 0)).length, 1, 'Ctrl+Z takes the last stroke back');
  await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control');
  assert.equal((await marksOf(p, 0)).length, 2, 'Ctrl+Y puts it back');
  await press(p, '[data-undo]');
  assert.equal((await marksOf(p, 0)).length, 1, 'the undo button too');
  await p.keyboard.press('h'); await nextDrag(p, 0, [[80, 330], [300, 336]]);
  await p.keyboard.press('o'); await nextDrag(p, 0, [[320, 400], [420, 460]]);
  await p.keyboard.press('k'); { const q = await nextAt(p, 0, 200, 500); await p.mouse.click(q.x, q.y); }
  // a text box: click, type, Enter
  await p.keyboard.press('t'); { const q = await nextAt(p, 0, 100, 560); await p.mouse.click(q.x, q.y); }
  await p.waitForSelector('.mk-paper textarea.ed'); await p.keyboard.type('Nice start'); await p.keyboard.press('Enter');
  // a comment: click a spot, type, Enter
  await p.keyboard.press('c'); { const q = await nextAt(p, 0, 300, 620); await p.mouse.click(q.x, q.y); }
  await p.waitForSelector('.mk-paper .pop textarea'); await p.keyboard.type('See rubric row 2'); await p.keyboard.press('Enter');
  // the right-click menu: a sticker and a proofreading mark
  { const q = await nextAt(p, 0, 450, 700); await p.mouse.click(q.x, q.y, { button: 'right' }); }
  await press(p, '.mk-menu [data-sub="stick"]'); await press(p, '.mk-fly [data-mark="star"]');
  { const q = await nextAt(p, 0, 120, 700); await p.mouse.click(q.x, q.y, { button: 'right' }); }
  await press(p, '.mk-menu [data-sub="proof"]'); await press(p, '.mk-fly [data-mark="sp"]');
  assert.equal(await p.$('.mk-menu'), null, 'the menu closes once a mark is placed');
  // the eraser takes one mark off
  await p.keyboard.press('k'); { const q = await nextAt(p, 0, 400, 520); await p.mouse.click(q.x, q.y); }
  await p.keyboard.press('e'); { const q = await nextAt(p, 0, 400, 520); await p.mouse.click(q.x, q.y); }
  const mine = await marksOf(p, 0);
  assert.deepEqual(mine.map(m => m.t + (m.k ? ':' + m.k : '')), ['pen', 'hl', 'oval', 'check', 'text', 'note', 'stamp:star', 'stamp:sp'], 'one of each, the second check erased');
  assert.equal(mine[0].color, '#1F5FD1', 'the pen in the blue she chose');
  assert.equal(mine[4].text, 'Nice start'); assert.equal(mine[5].text, 'See rubric row 2');
  await p.evaluate(() => window.__mark.saved());
  assert.equal(await p.$eval('.mk-save', e => e.dataset.save), 'saved');
  const nowShape = await p.evaluate(shape => eval(shape)(window.__mark.state().batch), shape);
  await p.close();

  // Main opens the work and has the same marks, and draws the page to the same pixels as the new app does.
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  await old.evaluate(id => window.__gs.reopenKept(id), id);
  await old.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id && s.pages.length; }, { timeout: 60000 }, id);
  assert.deepEqual(await old.evaluate(shape => eval(shape)(window.__gs.state().batch), shape), nowShape, 'main has the same students, files and marks');
  await goToStudent(old, 0); await mainDrawn(old);
  const pages = (await mainPages(old, png)).slice(0, 1);
  await old.close();
  const again = await page(ctx, errors);
  await again.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await again.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await nextReady(again, 0);
  const r = await compare(again, pages);
  assert.deepEqual(r.now, r.was, 'the marked page draws to the same pixels in both');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The grade maths, one table run through both apps: the current app's gradeOf (window.__gs) and the lifted one (window.__mark),
// each with the same setup, for scores of every kind. Every row must come out the same: total, percent, done, and the rest.
function gradeTable() {
  const setups = [
    null,   // the app's default rubric
    { mode: 'rubric', criteria: ['Ideas', 'Organization', 'Language'], outOf: 10, scale: 'SCALE12' },
    { mode: 'rubric', criteria: ['Ideas', 'Organization', 'Language', 'Evidence'], outOf: 10, scale: 'SCALE_FIVES' },
    { mode: 'rubric', criteria: ['Only row'], outOf: 10, scale: null },
    { mode: 'points', criteria: [], outOf: 20, scale: null },
    { mode: 'points', criteria: [], outOf: 37.5, scale: null },
  ];
  const rubrics = [[], [null, null, null], [4, 4, 4], [3.5, 3.5, 3.5], [1, 1.5, 2.5], [0, 0, 0], [4, null, 2], [3, 3, 3, 3], [2.5, 4, 1, 3.5], [4]];
  const grades = [];
  for (const rubric of rubrics) for (const points of ['', '17', '17.5', '0', '20', '41']) grades.push({ rubric, points, comment: '' });
  grades.push({ rubric: [3, 3, 3], points: '', comment: '', status: 'missing' }, { rubric: [], points: '', comment: '', status: 'excused' }, { rubric: [3, 3, 3], points: '15', comment: '', status: 'late' });
  grades.push({ rubric: [3, 3, 3], points: '15', comment: '', xc: 2 }, { rubric: [3, 3, 3], points: '15', comment: '', xc: 5, xcU: 'pct' }, { rubric: [3.5, 3, 3], points: '', comment: '', pk: 73, outAvg: true });
  return { setups, grades };
}
const runTable = `(api, table) => {
  const s = api.state(), base = JSON.parse(JSON.stringify(s.setup)), out = [];
  for (const su of table.setups) {
    const want = su ? { ...su, scale: typeof su.scale === 'string' ? api[su.scale] : su.scale } : api.DEFAULT_SETUP;
    const full = api.setupOver(JSON.parse(JSON.stringify(want)));
    for (const k of Object.keys(s.setup)) delete s.setup[k]; Object.assign(s.setup, full);
    for (const g of table.grades) out.push(JSON.stringify(api.gradeOf({ key: 'x', files: [], grade: JSON.parse(JSON.stringify(g)) })));
  }
  for (const k of Object.keys(s.setup)) delete s.setup[k]; Object.assign(s.setup, base);
  return out;
}`;

test('the grade maths: one table of scores comes out the same in both apps', async () => {
  const ctx = await browser.createBrowserContext(), errors = [], table = gradeTable();
  const old = await page(ctx, errors);
  await old.goto(srv.url + 'blank'); await plant(old, gradingSeed());
  await old.goto(srv.url); await appReady(old);
  await openZip(old, zipOf(await standardFiles()));
  await old.evaluate(() => window.__gs.saveNow()); await settle(old);
  const id = await old.evaluate(() => window.__gs.state().batch.id);
  const was = await old.evaluate((fn, table) => eval(fn)(window.__gs, table), runTable, table);
  await old.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const now = await p.evaluate((fn, table) => eval(fn)(window.__mark.maths, table), runTable, table);
  assert.equal(now.length, table.setups.length * table.grades.length);
  assert.ok(now.some(r => /"pct":\d/.test(r)) && now.some(r => /"done":true/.test(r)), 'the table has scored rows');
  for (let i = 0; i < was.length; i++) assert.equal(now[i], was[i], 'row ' + i);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('scoring in the new app: rows by click and by key, the half, a status, the comment and undo, opened in the current app as the same score', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const made = await page(ctx, errors);
  await made.goto(srv.url + 'blank'); await plant(made, gradingSeed());
  await made.goto(srv.url); await appReady(made);
  await openZip(made, zipOf(await standardFiles()));
  await made.evaluate(() => window.__gs.saveNow()); await settle(made);
  const id = await made.evaluate(() => window.__gs.state().batch.id);
  await made.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.waitForSelector('.mk-crit .sticks button:not([disabled])');
  const grade = () => p.evaluate(() => { const s = window.__mark.state(); return JSON.parse(JSON.stringify(s.batch.students[s.cur].grade)); });
  // a click on a step, then the number keys for the next rows and a full stop for the half
  await p.click('.mk-crit[data-row="0"] .sticks button[data-v="3"]');
  await p.click('.mk-crit[data-row="1"] .nm');   // as in the current app, a click keeps that row in hand; picking the next row moves on
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('4'); await p.keyboard.press('2'); await p.keyboard.press('.');
  assert.deepEqual((await grade()).rubric, [3, 4, 2.5]);
  // Ctrl+Z takes back the half, Ctrl+Y puts it back
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  assert.deepEqual((await grade()).rubric, [3, 4, 2]);
  await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control');
  assert.deepEqual((await grade()).rubric, [3, 4, 2.5]);
  await p.click('.mk-stat [data-status="late"]');
  await p.click('.mk-cmt'); await p.keyboard.type('Strong ideas.');
  const g = await grade();
  assert.equal(g.status, 'late'); assert.equal(g.comment, 'Strong ideas.');
  assert.equal(await p.$eval('.mk-side .total b', e => e.textContent), await p.evaluate(() => { const s = window.__mark.state(); return window.__mark.maths.fmtNum(window.__mark.gradeOf(s.batch.students[s.cur]).total); }));
  await p.evaluate(() => window.__mark.saved());
  const nowShape = await p.evaluate(shape => eval(shape)(window.__mark.state().batch), shape);
  await p.close();
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  await old.evaluate(id => window.__gs.reopenKept(id), id);
  await old.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id && s.pages.length; }, { timeout: 60000 }, id);
  assert.deepEqual(await old.evaluate(shape => eval(shape)(window.__gs.state().batch), shape), nowShape, 'main has the same scores, status and comment');
  assert.deepEqual(errors, []);
  await ctx.close();
});
