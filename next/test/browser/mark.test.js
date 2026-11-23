// The marking screen in a real browser (stage 4). Work made in the current app (main's own pages in this repository) opens in the
// new app as the same students, files and marks, and every page draws to the same pixels: one mark of each kind, on papers opened
// from a ZIP of made-up students. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, markPage, settle, goToStudent, waitPaper } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
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
  // GS_THROTTLE=6 runs the page that many times slower (CDP), to find what depends on timing before CI does
  if (+process.env.GS_THROTTLE > 1) await (await p.target().createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: +process.env.GS_THROTTLE });
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
// an item of a menu by its words (ui Menu): the opener pressed, then the item (gaps C-057: More for this paper holds what used to be on the panel)
const menuPick = async (p, opener, label) => { await p.waitForSelector(opener, { timeout: 60000 }); await p.click(opener); await p.waitForSelector('.pop [role^="menuitem"]');
  const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role^="menuitem"]')].find(e => (e.querySelector('b') || e).textContent.trim() === l); if (it) it.click(); return !!it; }, label);
  if (!ok) throw new Error('no menu item ' + label); };


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

test('the marking screen around the paper: a picked mark moved, resized, copied and pasted by key, the highlighter snap, the score and a row stamped on the paper, the list filtered, in points and folded, the score panel folded, a saved comment, and Only this student; the current app opens the same', async () => {
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
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  const cur = () => p.evaluate(() => window.__mark.state().cur);
  const blur = () => p.evaluate(() => document.activeElement && document.activeElement.blur());

  // a check placed, picked with Select: the arrows move it (and not to the next student), Shift for ten, + makes it bigger
  await p.keyboard.press('k'); { const q = await nextAt(p, 0, 200, 300); await p.mouse.click(q.x, q.y); }
  await p.keyboard.press('v'); { const q = await nextAt(p, 0, 200, 300); await p.mouse.click(q.x, q.y); }
  await p.waitForFunction(() => !!window.__mark.state().selected);
  const c0 = (await marksOf(p, 0))[0], at = await cur();
  await p.keyboard.press('ArrowRight'); await p.keyboard.down('Shift'); await p.keyboard.press('ArrowDown'); await p.keyboard.up('Shift');
  const c1 = (await marksOf(p, 0))[0];
  assert.equal(await cur(), at, 'the arrows move the mark, not to the next student');
  assert.deepEqual([c1.x - c0.x, c1.y - c0.y], [1, 10]);
  await p.keyboard.press('='); assert.ok((await marksOf(p, 0))[0].size > c1.size, '+ makes it bigger');
  // Ctrl C and Ctrl V: a copy beside it; Ctrl D: another
  await p.keyboard.down('Control'); await p.keyboard.press('c'); await p.keyboard.press('v'); await p.keyboard.press('d'); await p.keyboard.up('Control');
  assert.equal((await marksOf(p, 0)).length, 3, 'pasted and duplicated');
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  assert.equal((await marksOf(p, 0)).length, 2, 'Ctrl Z takes the copy back');
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => window.__mark.state().selected), null, 'Esc lets go');
  // the highlighter: H again switches between snapping and freehand, and the bar says which
  await p.keyboard.press('h'); await p.keyboard.press('h');
  assert.equal(await p.$eval('[data-hlm="free"]', b => b.getAttribute('aria-pressed')), 'true');
  await p.click('[data-hlm="auto"]');
  assert.equal(await p.$eval('[data-hlm="auto"]', b => b.getAttribute('aria-pressed')), 'true');
  await p.keyboard.press('v');

  // a score, then the score and the first row put on the paper where she clicks
  await p.click('.mk-crit[data-row="0"] .sticks button[data-v="3"]');
  await p.click('.mk-crit[data-row="1"] .sticks button[data-v="4"]');
  await p.click('.mk-crit[data-row="2"] .sticks button[data-v="2"]');
  await menuPick(p, '[data-pmore]', 'Put the score on the paper'); { const q = await nextAt(p, 0, 450, 120); await p.mouse.click(q.x, q.y); }
  await press(p, '[data-critstamp="0"]'); { const q = await nextAt(p, 0, 450, 220); await p.mouse.click(q.x, q.y); }
  const stamps = (await marksOf(p, 0)).filter(m => m.t === 'stamp');
  assert.deepEqual(stamps.map(m => m.k), ['score', 'crit']);
  assert.match(stamps[0].text, /^9\/12 = \d+%$/); assert.equal(stamps[1].text, '3/4');
  // the score changes: the stamps keep up
  await p.click('.mk-crit[data-row="0"] .sticks button[data-v="4"]');
  await p.waitForFunction(() => window.__mark.state().pages[0].marks().find(m => m.k === 'crit').text === '4/4');

  // the list: To score shows who has no score yet (and the one open), points in place of percent, folded with [ and back
  const shown = () => p.$$eval('.mk-rows [data-st]', l => l.map(b => +b.dataset.st));
  const all = (await shown()).length;
  await p.click('[data-lf-open]'); await press(p, '[data-lf="todo"]');
  assert.equal((await shown()).length, all, 'nobody else is scored yet, so everyone is still to score');
  await p.click('[data-lf-open]'); await press(p, '[data-way="pts"]');
  assert.match(await p.$eval('.mk-row.on .sc', e => e.textContent), /^10\s\/\s12$/);
  await blur(); await p.keyboard.press('Escape'); await p.keyboard.press('ArrowRight');   // the stamp just placed is let go of first
  assert.equal(await cur(), 1);
  assert.ok(!(await shown()).includes(0), 'scored, the first student leaves To score once she moves on');
  await p.click('[data-lf-open]'); await press(p, '[data-lf="all"]');
  await blur(); await p.keyboard.press('[');
  assert.ok(await p.$('.mk-list.fold'), '[ folds the list to a strip');
  await p.keyboard.press('['); assert.equal(await p.$('.mk-list.fold'), null);
  await p.keyboard.press(']'); assert.equal(await p.$('.mk-side'), null, '] folds the score panel away');
  await p.click('[data-panelshow]'); await p.waitForSelector('.mk-side');

  // a comment saved to the bank: a chip under every comment box from then on, and Ctrl Z takes the saving back
  await p.click('.mk-cmt'); await p.keyboard.type('Clear and careful.');
  await p.click('[data-cbmore]'); await press(p, '[data-cbsave]');
  await p.waitForSelector('[data-cbank]');
  assert.equal(await p.$eval('[data-cbank]', b => b.textContent), 'Clear and careful.');
  assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.bank'))), ['Clear and careful.']);
  await p.click('[data-st="2"]'); await p.waitForFunction(() => window.__mark.state().cur === 2);
  await p.click('[data-cbank]');
  assert.equal(await p.evaluate(() => window.__mark.state().batch.students[2].grade.comment), 'Clear and careful.');

  // the calculator: = opens it, numbers and signs type into it from anywhere, Enter answers and keeps it in History, Score sticker
  // puts the answer on the paper, Esc closes it
  await blur(); await p.keyboard.press('=');
  await p.waitForSelector('[data-calc]');
  await p.click('.mk-paper'); for (const k of ['3', '.', '5', '+', '4']) await p.keyboard.press(k);
  await p.keyboard.press('Enter');
  assert.equal(await p.$eval('[data-calcout] b', e => e.textContent), '7.5');
  assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.calchist'))), [{ e: '3.5+4', v: '7.5' }]);
  await p.click('[data-calcstick]'); { const q = await nextAt(p, 0, 450, 320); await p.mouse.click(q.x, q.y); }
  assert.match((await marksOf(p, 0)).filter(m => m.t === 'stamp').pop().text, /^7\.5\/12 = \d+%$/);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('[data-calc]'));

  // Only this student: I, then no list, tabs or other students; it stays through a reload and ends only by holding the button
  await blur(); await p.keyboard.press('i');
  await p.waitForSelector('.mk-solo');
  assert.equal(await p.$('.mk-list'), null); assert.equal(await p.$('.mk-top [role="tablist"]'), null);
  await p.keyboard.press('ArrowRight'); assert.equal(await cur(), 2, 'the arrows do not leave them');
  await p.reload(); await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.waitForSelector('.mk-solo');
  assert.equal(await p.evaluate(() => window.__mark.state().batch.students[2].grade.comment), 'Clear and careful.', 'a change made just before the reload was saved on the way out');
  await p.click('[data-soloend]'); assert.ok(await p.$('.mk-solo'), 'a click does not end it');
  const b = await p.$('[data-soloend]'), r = await b.boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down();
  await p.waitForFunction(() => !document.querySelector('.mk-solo'), { timeout: 4000 }); await p.mouse.up();
  await p.waitForSelector('.mk-list');

  await p.evaluate(() => window.__mark.saved());
  const nowShape = await p.evaluate(shape => eval(shape)(window.__mark.state().batch), shape);
  await p.close();
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  await old.evaluate(id => window.__gs.reopenKept(id), id);
  await old.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id && s.pages.length; }, { timeout: 60000 }, id);
  assert.deepEqual(await old.evaluate(shape => eval(shape)(window.__gs.state().batch), shape), nowShape, 'main has the same marks, stamps, scores and comments');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the screenshot: S opens it and Esc closes it, a page clicked for all of it with or without the marks, Alt S and an area dragged; the picture goes on the clipboard', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const made = await page(ctx, errors);
  await made.goto(srv.url + 'blank'); await plant(made, gradingSeed());
  await made.goto(srv.url); await appReady(made);
  await openZip(made, zipOf(await standardFiles()));
  await made.evaluate(() => window.__gs.saveNow()); await settle(made);
  const id = await made.evaluate(() => window.__gs.state().batch.id);
  await made.close();
  const p = await page(ctx, errors);
  // what goes on the clipboard, kept to look at
  await p.evaluateOnNewDocument(() => { const cb = navigator.clipboard; Object.defineProperty(cb, 'write', { value: async items => { const b = await items[0].getType('image/png'); const im = await createImageBitmap(b); window.__shots = (window.__shots || []).concat([{ w: im.width, h: im.height, type: b.type }]); } }); });
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  const blur = () => p.evaluate(() => document.activeElement && document.activeElement.blur());
  const shots = () => p.evaluate(() => window.__shots || []);
  const ls = k => p.evaluate(k => JSON.parse(localStorage.getItem(k)), k);

  await blur(); await p.keyboard.press('s');
  await p.waitForSelector('[data-sniplayer] .snipbar');
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('[data-sniplayer]'));
  // the button, then "With my marks" off (kept), and a page clicked: all of it, about 1700 pixels across
  await p.click('[data-snip]'); await p.waitForSelector('[data-snipmk]');
  await p.click('[data-snipmk]'); assert.equal(await ls('gs.snipMarks'), 0);
  { const q = await nextAt(p, 0, 200, 300); await p.mouse.click(q.x, q.y); }
  await p.waitForFunction(() => (window.__shots || []).length === 1, { timeout: 30000 });
  const one = (await shots())[0];
  assert.equal(one.type, 'image/png'); assert.ok(one.w >= 1650 && one.w <= 1750, 'the whole page about 1700 across, ' + one.w);
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => /Picture copied/.test(e.textContent)));
  // Alt S, the marks back on, and an area dragged over the paper: that area, at two or three pixels a point
  await blur(); await p.keyboard.down('Alt'); await p.keyboard.press('KeyS'); await p.keyboard.up('Alt');
  await p.waitForSelector('[data-snipmk]');
  assert.equal(await p.$eval('[data-snipmk]', e => e.checked), false, 'it remembers the marks were off');
  await p.click('[data-snipmk]'); assert.equal(await ls('gs.snipMarks'), null);
  const a = await nextAt(p, 0, 100, 120), b = await nextAt(p, 0, 400, 320);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2); await p.mouse.move(b.x, b.y); await p.mouse.up();
  await p.waitForFunction(() => (window.__shots || []).length === 2, { timeout: 30000 });
  const two = (await shots())[1], k = two.w / Math.round(b.x - a.x);
  assert.ok(k >= 1.9 && k <= 3.1, 'the area at two or three pixels a point, ' + k);
  assert.equal(await p.$('[data-sniplayer]'), null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// A-109: Show beside in a file's ⋯ (src/sidepane.js data-spshow): that file goes in the side pane, the other stays in the main column
test('A-109 A-111: Show beside in a file\'s menu keeps that file in the side pane; the pane\'s rubric with no words links to Rubric setup', async () => {
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
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  // A-111: the rubric in the pane with nothing written for its scores links to Rubric setup (src/sidepane.js data-spedit)
  const blur = () => p.evaluate(() => document.activeElement && document.activeElement.blur());
  await blur(); await p.keyboard.press('b');
  await p.waitForSelector('.mk-sprub [data-spedit]', { timeout: 15000 });
  await p.click('.mk-sprub [data-spedit]');
  await p.waitForSelector('dialog[open] [data-susave]', { timeout: 30000 });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open] [data-susave]'));
  await blur(); await p.keyboard.press('b'); await p.waitForFunction(() => !document.querySelector('.mk-sph'));
  const two = await p.evaluate(() => window.__mark.state().batch.students.findIndex(st => st.files.filter(f => /\.pdf$/.test(f.name)).length === 2));
  await p.click('[data-st="' + two + '"]'); await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready, { timeout: 60000 }, two);
  assert.equal(await p.$('.mk-sph'), null, 'the pane is closed');
  const second = await p.$$eval('.mk-paper > section.doc [data-fmenu]', l => l[1].dataset.fmenu);
  await p.waitForFunction(f => { if (document.querySelector('.pop [role^="menuitem"]')) return true; const b = window.__mark.ready && document.querySelector('[data-fmenu="' + f + '"]'); if (b) b.click(); return false; }, { timeout: 30000, polling: 500 }, second);
  await p.waitForFunction(() => { const it = [...document.querySelectorAll('.pop [role^="menuitem"]')].find(e => e.textContent.includes('Show beside')); if (it) it.click(); return !!it; }, { timeout: 15000 });
  await p.waitForSelector('.mk-sph', { timeout: 15000 });
  await p.waitForFunction(f => { const s = document.querySelector('.mk-paper > section.doc.in-sp [data-fmenu]'); return s && s.dataset.fmenu === f && document.querySelector('.mk-paper > section.doc:not(.in-sp)'); }, { timeout: 15000 }, second);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// A-113 A-114: Only this student has Other work (src/solo.js): every download of the class with this student's own score, and one
// opened from it is still only them
test('A-113 A-114: Only this student lists their Other work in the class, with their own score, and opens another, still only them', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const made = await page(ctx, errors);
  await made.goto(srv.url + 'blank'); await plant(made, gradingSeed());
  await made.goto(srv.url); await appReady(made);
  const files = await standardFiles();
  await openZip(made, zipOf(files), 'Essay one.zip');
  const first = await made.evaluate(() => { const G = window.__gs, s = G.state(), st = s.batch.students[0];
    if (s.setup.mode === 'rubric') st.grade.rubric = s.setup.criteria.map(() => 3); else st.grade.points = '9';
    G.saveNow(); return { id: s.batch.id, key: st.key, names: s.batch.students.map(x => x.key) }; });
  await settle(made);
  // a second assignment for the same class: other papers
  const two = {}; for (const n of first.names) two[n + '/Reflection.pdf'] = await makePaper({ title: 'Reflection by ' + n });
  await made.goto(srv.url); await appReady(made);
  await openZip(made, zipOf(two), 'Reflection.zip');
  await made.evaluate(() => window.__gs.saveNow()); await settle(made);
  const id = await made.evaluate(() => window.__gs.state().batch.id);
  await made.close();
  assert.notEqual(id, first.id);
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), first.key);
  await p.click('[data-st="' + i + '"]'); await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready, { timeout: 60000 }, i);
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('i');
  await p.waitForSelector('.mk-solo [data-solother]', { timeout: 30000 });
  await p.click('[data-solother]');
  await p.waitForSelector('[data-solowork] [data-solog="' + first.id + '"]', { timeout: 30000 });
  // the seed's two marked downloads, then the two opened here, oldest first, the one open now marked
  const rows = await p.$$eval('[data-solowork] .mk-swrow', l => l.map(e => e.dataset.solog));
  assert.deepEqual(rows.filter(r => /^gs\.b\.n/.test(r)), ['gs.b.n1', 'gs.b.n2']);
  assert.ok(rows.includes(first.id) && rows.includes(id), rows.join(', '));
  assert.match(await p.$eval('[data-solowork] h3', e => e.textContent), /^In Grade 9 English · \d of 4 turned in/);
  assert.match(await p.$eval('[data-solog="' + first.id + '"]', e => e.textContent), /^Essay one\d+ \/ \d+/);
  assert.ok(await p.$('[data-solog="' + id + '"][aria-current="true"]'), 'the one open now');
  await p.click('[data-solog="' + first.id + '"]');
  await p.waitForFunction((id, k) => { const s = window.__mark && window.__mark.ready && window.__mark.state(); return s && s.batch && s.batch.id === id && s.batch.students[s.cur].key === k && document.querySelector('.mk-solo'); }, { timeout: 60000 }, first.id, first.key);
  assert.equal(await p.$('.mk-list'), null, 'still only them');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the side pane: B opens it with the rubric in full, a file beside the other, its edge by the arrows, across the top, kept for the next student; B closes it', async () => {
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
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  const blur = () => p.evaluate(() => document.activeElement && document.activeElement.blur());
  const ls = () => p.evaluate(() => JSON.parse(localStorage.getItem('gs.sp')));
  const two = await p.evaluate(() => window.__mark.state().batch.students.findIndex(st => st.files.filter(f => /\.pdf$/.test(f.name)).length === 2));
  assert.ok(two >= 0);

  // B: the rubric in full, and a click on a score in it gives that score
  await blur(); await p.keyboard.press('b');
  await p.waitForSelector('.mk-paper.sp-right .mk-sph [data-sptab="rubric"][aria-selected="true"]');
  assert.deepEqual(await ls(), { on: true });
  await p.click('.mk-sprub [data-sprow="0"][data-spv="3"]');
  await p.waitForFunction(() => window.__mark.state().batch.students[window.__mark.state().cur].grade.rubric[0] === 3);
  // a student with two files: the second beside the first, narrower than the main column
  await p.click('[data-st="' + two + '"]'); await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready, {}, two);
  await p.waitForSelector('.mk-sph [data-sptab^="doc:"]');
  const tab = await p.$$eval('.mk-sph [data-sptab^="doc:"]', l => l[1].dataset.sptab);
  await p.click('.mk-sph [data-sptab="' + tab + '"]');
  await p.waitForFunction(() => { const s = window.__mark.state(); return document.querySelector('.mk-paper > section.doc.in-sp') && s.pages.every(pg => pg.canvas && pg.canvas.isConnected); });
  await p.waitForFunction(() => { const side = document.querySelector('.in-sp canvas'), main = document.querySelector('.mk-paper > section.doc:not(.in-sp) canvas'); return side && main && side.getBoundingClientRect().width < main.getBoundingClientRect().width && side.getBoundingClientRect().left > main.getBoundingClientRect().right; });
  assert.equal((await ls()).tab, 'f:' + (await p.$eval('.mk-sph [aria-selected="true"]', e => e.textContent)) + '.pdf');
  // its edge: the left arrow makes it bigger, kept as a share of the width
  await p.focus('[data-spgrip]'); await p.keyboard.press('ArrowLeft');
  assert.ok(Math.abs((await ls()).w - 0.5) < 0.001);
  // across the top, then back on the right
  await p.click('[data-spwhere]'); await p.waitForSelector('.pop [role="menuitemradio"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitemradio"]')][2].click());
  await p.waitForSelector('.mk-paper.sp-top .in-sp'); assert.equal((await ls()).at, 'top');
  await p.click('[data-spwhere]'); await p.waitForSelector('.pop [role="menuitemradio"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitemradio"]')][0].click());
  await p.waitForSelector('.mk-paper.sp-right'); assert.equal((await ls()).at, undefined);
  // the next student: still open; B closes it and the next student opens without it
  await blur(); await p.keyboard.press('ArrowDown');
  await p.waitForFunction(i => window.__mark.state().cur !== i, {}, two);
  await p.waitForSelector('.mk-paper.sp-right');
  await blur(); await p.keyboard.press('b');
  await p.waitForFunction(() => !document.querySelector('.mk-sph'));
  assert.equal((await ls()).on, undefined);
  await p.click('[data-spbtn]'); await p.waitForSelector('.mk-sph'); await p.click('[data-spclose]'); await p.waitForFunction(() => !document.querySelector('.mk-sph'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a tablet reaches the marks: the Stamp tool opens the menu where she taps, and a finger held still opens it too; a quick touch does not', async () => {
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
  await p.waitForSelector('[data-tool="stamp"]');
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  // the Stamp tool: a tap opens the menu there and starts no mark; a sticker from it goes where she tapped
  await p.click('[data-tool="stamp"]'); assert.equal(await p.$eval('[data-tool="stamp"]', e => e.getAttribute('aria-pressed')), 'true');
  { const q = await nextAt(p, 0, 220, 260); await p.mouse.click(q.x, q.y); }
  await p.waitForSelector('.mk-menu'); assert.equal((await marksOf(p, 0)).length, 0);
  await press(p, '.mk-menu [data-sub="stick"]'); await press(p, '.mk-fly [data-mark="star"]');
  const st = (await marksOf(p, 0)).find(m => m.k === 'star'); assert.ok(st && Math.abs(st.x - 220) < 2 && Math.abs(st.y - 260) < 2, 'the sticker is where she tapped');
  assert.equal(await p.$eval('[data-tool="stamp"]', e => e.getAttribute('aria-pressed')), 'true', 'the Stamp tool stays in hand');
  // the pen: a quick touch makes a dot and no menu; a finger held still opens the menu and leaves no mark
  await p.keyboard.press('Escape'); await p.click('[data-tool="pen"]');
  const n0 = (await marksOf(p, 0)).length;
  { const q = await nextAt(p, 0, 300, 400); await p.touchscreen.touchStart(q.x, q.y); await p.touchscreen.touchEnd(); }
  await new Promise(r => setTimeout(r, 800)); assert.equal(await p.$('.mk-menu'), null, 'a quick touch opens nothing');
  const n1 = (await marksOf(p, 0)).length;
  { const q = await nextAt(p, 0, 320, 420); await p.touchscreen.touchStart(q.x, q.y); await p.waitForSelector('.mk-menu', { timeout: 3000 }); await p.touchscreen.touchEnd(); }
  assert.equal((await marksOf(p, 0)).length, n1, 'held still: the menu, and no mark');
  assert.ok(n1 >= n0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a tablet (src/touch.js): a finger draws until a pencil is used, then moves the page; two fingers pinch to zoom; a palm does nothing; Settings > Marking keeps the choices where the current app reads them', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const made = await page(ctx, errors);
  await made.goto(srv.url + 'blank'); await plant(made, gradingSeed());
  await made.goto(srv.url); await appReady(made);
  await openZip(made, zipOf(await standardFiles()));
  await made.evaluate(() => window.__gs.saveNow()); await settle(made);
  const id = await made.evaluate(() => window.__gs.state().batch.id);
  await made.close();
  const p = await page(ctx, errors);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  await p.click('[data-tool="pen"]');
  const cdp = await p.createCDPSession(), pause = ms => new Promise(r => setTimeout(r, ms));
  const fingers = (type, list) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: list.map(f => ({ x: f.x, y: f.y, id: f.id || 0, radiusX: f.r || 8, radiusY: f.r || 8, force: 0.5 })) });
  const swipe = async (a, b, o = {}) => { await fingers('touchStart', [{ ...a, r: o.r }]); for (let i = 1; i <= 8; i++) { await fingers('touchMove', [{ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8, r: o.r }]); await pause(12); } await pause(120); await fingers('touchEnd', []); };
  const scrollY = () => p.$eval('.mk-paper', e => e.scrollTop);
  const all = () => p.evaluate(() => window.__mark.state().pages.reduce((n, pg) => n + pg.marks().length, 0));
  const a = await nextAt(p, 0, 150, 500), b = { x: a.x, y: a.y - 200 };
  const top = await scrollY();
  await swipe(a, b);
  assert.equal(await all(), 1, 'a finger alone draws'); assert.equal(await scrollY(), top);
  // a pencil stroke: from now on a finger moves the page
  const pen = (type, q, down) => cdp.send('Input.dispatchMouseEvent', { type, x: q.x, y: q.y, button: down ? 'left' : 'none', buttons: down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'pen', force: 0.5 });
  const s0 = await nextAt(p, 0, 300, 200);
  await pen('mouseMoved', s0, false); await pen('mousePressed', s0, true); for (let i = 1; i <= 6; i++) await pen('mouseMoved', { x: s0.x + i * 15, y: s0.y }, true); await pen('mouseReleased', { x: s0.x + 90, y: s0.y }, true);
  await pause(600);
  assert.equal(await all(), 2);
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.penSeen')), 'true', 'the pencil is remembered as the current app remembers it');
  const c = await nextAt(p, 0, 150, 600), t2 = await scrollY();
  await swipe(c, { x: c.x, y: c.y - 250 });
  assert.equal(await all(), 2, 'the finger drew nothing'); assert.ok(await scrollY() > t2 + 100, 'and the page moved with it');
  // a palm right after the pencil, and a touch as wide as a hand, move nothing
  await pen('mouseMoved', s0, false); await pen('mousePressed', s0, true); await pen('mouseMoved', { x: s0.x + 40, y: s0.y + 4 }, true); await pen('mouseReleased', { x: s0.x + 40, y: s0.y + 4 }, true);
  const m = await p.evaluate(() => { const r = document.querySelector('.mk-paper').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const y4 = await scrollY();
  await swipe(m, { x: m.x, y: m.y - 150 });
  assert.equal(await scrollY(), y4, 'a touch straight after the pencil moves nothing');
  await pause(600);
  await swipe(m, { x: m.x, y: m.y - 150 }, { r: 45 });
  assert.equal(await scrollY(), y4, 'a wide touch moves nothing');
  // two fingers spread apart: larger
  const zoomed = () => p.evaluate(() => JSON.parse(sessionStorage.getItem('gsn.mark.zoom')) || 1), z0 = await zoomed();
  await fingers('touchStart', [{ x: m.x - 40, y: m.y, id: 1 }, { x: m.x + 40, y: m.y, id: 2 }]);
  for (let i = 1; i <= 8; i++) { await fingers('touchMove', [{ x: m.x - 40 - i * 10, y: m.y, id: 1 }, { x: m.x + 40 + i * 10, y: m.y, id: 2 }]); await pause(12); }
  await fingers('touchEnd', []);
  await p.waitForFunction(z => (JSON.parse(sessionStorage.getItem('gsn.mark.zoom')) || 1) > z * 1.5, { timeout: 5000 }, z0);
  assert.equal(await all(), 3, 'only the pencil drew (three lines: the finger before the pencil and two pencil strokes)');
  // Settings > Marking: the choices, kept under the current app's names
  await p.evaluate(() => window.__mark.saved()); await p.close();
  const q = await page(ctx, errors);
  await q.goto(srv.url + 'next/#/settings/marking');
  await q.waitForSelector('[data-sttouch] select', { timeout: 30000 });
  assert.equal(await q.$eval('[data-sttouch] select', e => e.value), 'auto');
  await q.select('[data-sttouch] select', 'draw');
  assert.equal(await q.evaluate(() => JSON.parse(localStorage.getItem('gs.touch'))), 'draw');
  await q.click('[data-stpress] [role="switch"]');
  assert.equal(await q.evaluate(() => JSON.parse(localStorage.getItem('gs.press'))), false);
  await q.select('[data-sttouch] select', 'auto');
  assert.equal(await q.evaluate(() => localStorage.getItem('gs.touch')), null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('saved comments (audit hooks row H): with three already saved, a comment starred in the new app joins them, one removed leaves the rest, and the current app shows the same list', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const made = await page(ctx, errors);
  await made.goto(srv.url + 'blank'); await plant(made, gradingSeed());
  await made.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['Speak a little slower.', 'Good eye contact.', 'Cite the page.'])));
  await made.goto(srv.url); await appReady(made);
  await openZip(made, zipOf(await standardFiles()));
  await made.evaluate(() => window.__gs.saveNow()); await settle(made);
  const id = await made.evaluate(() => window.__gs.state().batch.id);
  await made.close();

  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await nextReady(p, await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 }).then(() => p.evaluate(() => window.__mark.state().cur)));
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  const chips = () => p.$$eval('.mk-paper .pop .chips .chip [data-raw]', l => l.map(e => e.textContent));
  const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('gs.bank')));
  // a margin comment: her three saved comments are under it before anything is saved
  await p.keyboard.press('c'); { const q = await nextAt(p, 0, 300, 620); await p.mouse.click(q.x, q.y); }
  await p.waitForSelector('.mk-paper .pop textarea');
  assert.deepEqual(await chips(), ['Speak a little slower.', 'Good eye contact.', 'Cite the page.'], 'the saved comments load into the comment box');
  await p.keyboard.type('Strong opening.');
  await p.click('.mk-paper .pop [data-a="star"]');
  await p.waitForFunction(() => document.querySelectorAll('.mk-paper .pop .chips .chip').length === 4);
  assert.deepEqual(await stored(), ['Strong opening.', 'Speak a little slower.', 'Good eye contact.', 'Cite the page.'], 'starring adds to her list and keeps every other comment');
  // one removed by its ×: the others stay
  await p.click('.mk-paper .pop .chips .chip:nth-child(3) [data-x]');
  await p.waitForFunction(() => document.querySelectorAll('.mk-paper .pop .chips .chip').length === 3);
  assert.deepEqual(await stored(), ['Strong opening.', 'Speak a little slower.', 'Cite the page.']);
  // a change made elsewhere (another tab, Settings) shows the next time a comment box opens, and starring keeps it
  await p.click('.mk-paper .pop [data-a="ok"]');
  await p.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['Strong opening.', 'Speak a little slower.', 'Cite the page.', 'From the other tab.'])));
  await p.keyboard.press('c'); { const q = await nextAt(p, 0, 300, 700); await p.mouse.click(q.x, q.y); }
  await p.waitForSelector('.mk-paper .pop textarea');
  await p.keyboard.type('Check your units.'); await p.click('.mk-paper .pop [data-a="star"]');
  await p.waitForFunction(() => document.querySelectorAll('.mk-paper .pop .chips .chip').length === 5);
  const want = ['Check your units.', 'Strong opening.', 'Speak a little slower.', 'Cite the page.', 'From the other tab.'];
  assert.deepEqual(await stored(), want);
  await p.click('.mk-paper .pop [data-a="ok"]');
  await p.evaluate(() => window.__mark.saved());
  await p.close();

  // the current app opens the same list under its own comment box
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  await old.evaluate(id => window.__gs.reopenKept(id), id);
  await old.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id && s.pages.length; }, { timeout: 60000 }, id);
  await goToStudent(old, 0); await waitPaper(old);
  await old.evaluate(() => window.__gs.setTool('note'));
  const r = await old.evaluate(() => { const pg = window.__gs.state().pages[0], b = pg.canvas.getBoundingClientRect(); return { x: b.left + 200 * pg.s, y: b.top + 200 * pg.s }; });
  await old.mouse.click(r.x, r.y);
  await old.waitForSelector('.pop .chips .chip');
  assert.deepEqual(await old.$$eval('.pop .chips .chip > span', l => l.map(e => e.textContent)), want, 'the current app has every comment');
  await old.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a failed read of saved work (audit H-025): tried once more and opened with her marks; still failing, the paper does not open unmarked and nothing is saved over her work', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await makeWork(ctx, errors);
  const breakWork = (id, n) => `(() => { let n = ${n}; const g = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function (k) { if (this.name === 'work' && k === ${JSON.stringify(id)} && n > 0) { n--; throw new DOMException('test: work read blocked', 'InvalidStateError'); } return g.call(this, k); }; })()`;
  const kept = async () => { const c = await page(ctx, errors); await c.goto(srv.url + 'blank'); const w = await c.evaluate(id => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => { const q = r.result.transaction('work').objectStore('work').get(id); q.onsuccess = () => { r.result.close(); res(JSON.stringify(q.result)); }; }; }), old.id); await c.close(); return w; };
  // an older download: no quick copy left in this browser (only 12 are kept), so the database is the only copy
  { const c = await page(ctx, errors); await c.goto(srv.url + 'blank'); await c.evaluate(id => localStorage.removeItem(id), old.id); await c.close(); }
  const was = await kept(); assert.ok(was && was.length > 10, 'her work is in the database');
  // one failed read: tried again, and the paper opens with her marks and scores
  const p = await page(ctx, errors); await p.evaluateOnNewDocument(breakWork(old.id, 1));
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id));
  await p.waitForFunction(() => window.__mark && window.__mark.state().batch && window.__mark.state().pages.length && window.__mark.state().pages.every(pg => pg.bmp), { timeout: 60000 });
  assert.deepEqual(await p.evaluate(shape => eval(shape)(window.__mark.state().batch), shape), old.shape, 'opened with her marks after one failed read');
  await p.close();
  // every read fails: the screen says the page could not be read, and the saved work is untouched
  const q = await page(ctx, errors); await q.evaluateOnNewDocument(breakWork(old.id, 99));
  await q.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id));
  await q.waitForFunction(() => [...document.querySelectorAll('.empty b')].some(b => b.textContent === 'This page could not be read.'), { timeout: 60000 });
  assert.ok(!(await q.evaluate(() => window.__mark && window.__mark.state().batch && window.__mark.state().pages.length)), 'no paper opened unmarked');
  await q.close();
  assert.equal(await kept(), was, 'nothing was saved over her work');
  assert.deepEqual(errors.filter(e => !/work read blocked/.test(e)), []);
  await ctx.close();
});

// src/app/paper.js gradeMarksChanged: a grade typed on the paper is read again a moment later and becomes the paper's grade; taken
// back, its reading goes at once. The current app reads the same grade from the same mark.
test('H-031: a grade typed on the paper is read off it a moment later, and undo takes the reading away; the current app reads the same', async () => {
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
  await p.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.state().pages.length, { timeout: 60000 });
  await p.waitForSelector('[data-repx]', { timeout: 15000 }).then(() => p.click('[data-repx]'), () => {});
  const cur = await p.evaluate(() => window.__mark.state().cur);
  const reads = `st => st.files.flatMap(f => ((f.scan && f.scan.found) || []).filter(g => g.mark).map(g => g.page + ' ' + g.full))`;
  const found = () => p.evaluate((i, reads) => eval(reads)(window.__mark.state().batch.students[i]), cur, reads);
  assert.deepEqual(await found(), [], 'nothing written on the paper yet');
  await p.keyboard.press('t'); { const q = await nextAt(p, 0, 360, 90); await p.mouse.click(q.x, q.y); }
  await p.waitForSelector('.mk-paper textarea.ed'); await p.keyboard.type('7/10'); await p.keyboard.press('Enter');
  await p.waitForFunction((i, reads) => eval(reads)(window.__mark.state().batch.students[i]).length, { timeout: 30000 }, cur, reads);
  const said = await found();
  await p.evaluate(() => window.__mark.saved());
  // the current app reads the same grade off the same mark
  const m = await page(ctx, []);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  await m.evaluate(() => window.__gs.scanAll());
  assert.deepEqual(said, ['0 7/10']);
  assert.deepEqual(await m.evaluate((i, reads) => eval(reads)(window.__gs.state().batch.students[i]), cur, reads), said);
  await m.close();
  // taken back: the reading goes
  await p.bringToFront();
  await p.keyboard.press('Escape');
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForFunction((i, reads) => !eval(reads)(window.__mark.state().batch.students[i]).length, { timeout: 30000 }, cur, reads);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// src/app/keep.js pickedUpNew: opening an assignment with work on it says so once in each visit to the window; the engines' note about
// highlights kept on an older rubric (gopen loadEdits) is said in the screen's words (audit H-033, H-036).
test('H-033 H-036 H-060: Picked up where you left off, once a visit; the right-click menu closes when the window loses focus; the note about an older rubric\'s highlights is said', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const made = await page(ctx, errors);
  await made.goto(srv.url + 'blank'); await plant(made, gradingSeed());
  await made.goto(srv.url); await appReady(made);
  await openZip(made, zipOf(await standardFiles()));
  await made.evaluate(() => { const G = window.__gs, s = G.state(); s.batch.students[0].grade.comment = 'Started on this one.'; G.saveNow(); }); await settle(made);
  const { id, n } = await made.evaluate(() => { const s = window.__gs.state(), w = JSON.parse(localStorage.getItem(s.batch.id)); return { id: s.batch.id, n: s.batch.students.filter(st => w.s[st.key]).length }; });
  await made.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  const said = 'Picked up where you left off (' + n + (n === 1 ? ' student' : ' students') + ' started)';
  await p.waitForFunction(w => [...document.querySelectorAll('.toast')].some(e => e.textContent.includes(w)), { timeout: 60000 }, said);
  // once in each visit: opened again in this window, nothing is said
  await p.reload(); await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.evaluate(() => new Promise(r => setTimeout(r, 800)));
  assert.ok(!(await p.evaluate(w => [...document.querySelectorAll('.toast')].some(e => e.textContent.includes(w)), said)), 'said once a visit');
  // the right-click menu closes when the window loses focus, and on a scroll (H-060, src/stamps.js)
  await p.waitForSelector('[data-repx]', { timeout: 5000 }).then(() => p.click('[data-repx]'), () => {});
  // the window loses focus the moment the menu is in the page, before anything else runs (CI's slower machine caught a menu that
  // only began listening after it was drawn)
  await p.evaluate(() => { const o = new MutationObserver(() => { if (document.querySelector('.mk-menu')) { o.disconnect(); window.dispatchEvent(new Event('blur')); } }); o.observe(document.body, { childList: true, subtree: true }); });
  { const q = await nextAt(p, 0, 450, 700); await p.mouse.click(q.x, q.y, { button: 'right' }); }
  await p.waitForFunction(() => !document.querySelector('.mk-menu'), { timeout: 5000 });
  { const q = await nextAt(p, 0, 450, 700); await p.mouse.click(q.x, q.y, { button: 'right' }); }
  await p.waitForSelector('.mk-menu');
  // a scroll closes it once it is drawn and listening, which is when it takes the focus (a scroll from the tap that opened it must not)
  await p.waitForFunction(() => document.activeElement && document.activeElement.closest('.mk-menu'), { timeout: 30000 });
  await p.evaluate(() => document.dispatchEvent(new Event('scroll')));
  await p.waitForFunction(() => !document.querySelector('.mk-menu'), { timeout: 5000 });
  // the engines' note, as loadEdits gives it, in the screen's words; other engine notes stay quiet
  await p.evaluate(() => { const s = window.__mark.state(); s.toast('A highlighted copy of an older rubric is kept for 2 students, but this rubric doesn’t show it. Their scores stay, so check them against this rubric.', 12000); s.toast('Some other note'); });
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => /kept for 2 students, but this rubric/.test(e.textContent)), { timeout: 10000 });
  assert.ok(!(await p.evaluate(() => [...document.querySelectorAll('.toast')].some(e => /Some other note/.test(e.textContent)))));
  assert.deepEqual(errors, []);
  await ctx.close();
});
