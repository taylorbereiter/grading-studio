// Grades, Insights and Return in a real browser (stage 4, part e). The export proof: the same marked paper, returned from either
// app, gives a PDF whose pages render to the same pixels; the grade spreadsheet is the same file byte for byte; the ZIP holds the
// same files under the same names; and "Returned" said in the new app is what the current app reads. npm run next:browser.
// Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { unzipSync } = require('fflate');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, markPage, settle, goToStudent, catchDownloads } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf, makeDocx } = require('../../../test/helpers/fixtures.js');
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

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
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
const b64 = `u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }`;
// Each page of a PDF (base64), drawn with the new app's pdf.js at one pixel a point, as a SHA-256 of its pixels.
const pdfPixels = `async (data, lib) => { const bin = atob(data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const doc = await lib.getDocument({ data: u8, isEvalSupported: false }).promise, out = [];
  for (let k = 1; k <= doc.numPages; k++) { const pg = await doc.getPage(k), vp = pg.getViewport({ scale: 1 }), c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const x = c.getContext('2d', { willReadFrequently: true }); await pg.render({ canvasContext: x, viewport: vp }).promise;
    const h = await crypto.subtle.digest('SHA-256', x.getImageData(0, 0, c.width, c.height).data); out.push(c.width + 'x' + c.height + ':' + [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')); }
  doc.destroy(); return out; }`;

// Main's page: made-up papers with marks of every kind and a score and comment on the first student, so the feedback page has
// something to say; then main's own returned PDF of that paper, its list of returned files and its spreadsheet.
// an item of a menu by its words (ui Menu): the opener pressed, then the item (gaps C-057: More for this paper holds what used to be on the panel)
const menuPick = async (p, opener, label) => { await p.waitForSelector(opener, { timeout: 60000 }); await p.click(opener); await p.waitForSelector('.pop [role^="menuitem"]');
  const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role^="menuitem"]')].find(e => (e.querySelector('b') || e).textContent.trim() === l); if (it) it.click(); return !!it; }, label);
  if (!ok) throw new Error('no menu item ' + label); };
async function mainSide(ctx, errors) {
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url); await appReady(p);
  await openZip(p, zipOf(await standardFiles()));
  await markPage(p, 0);
  await p.evaluate(() => {
    const G = window.__gs, s = G.state(), st = s.batch.students[0], f = st.files[0];
    (f.marks[0] ||= []).push({ t: 'stamp', k: 'sp', x: 420, y: 300, size: 16, color: '#D7263D' }, { t: 'note', color: '#D7263D', ax: 300, ay: 200, text: 'Say more here' });
    st.grade.comment = 'Clear ideas; check your commas.';
    if (s.setup.mode === 'rubric') st.grade.rubric = s.setup.criteria.map((_, i) => (i % 2 ? 2.5 : 3)); else st.grade.points = '9';
    s.batch.students[1].grade.status = 'missing';
    G.saveNow();
  });
  await goToStudent(p, 1); await goToStudent(p, 0); await settle(p);
  const out = await p.evaluate(async b64 => {
    const G = window.__gs, s = G.state(), st = s.batch.students[0], d = G.layoutOf(st).find(x => G.docIn(st, x));
    await G.scanAll();
    const bytes = await G.flattenDoc(st, d, 150, true, true, true, true);
    return { id: s.batch.id, pdf: eval(b64)(bytes), paths: G.nameOut(G.exportPlan(true)).map(o => o.path) };
  }, b64);
  // the spreadsheet, from the Grades tab's own button
  const dl = await catchDownloads(p);
  await p.evaluate(id => { location.hash = '#/a/' + encodeURIComponent(id.replace(/^gs\.b\./, '')) + '/grades'; }, out.id);
  await p.waitForSelector('#dlgBox [data-csv]', { timeout: 60000 });
  out.csv = await dl.next(() => p.click('#dlgBox [data-csv]'));
  await dl.close();
  await p.close();
  return out;
}

test('a paper returned from the new app is the paper the current app returns, and the grade file is the same file', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await mainSide(ctx, errors);
  const p = await page(ctx, errors), dl = await catchDownloads(p);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id) + '/grades');
  await p.waitForFunction(() => window.__mark && window.__mark.out && document.querySelector('#glTable'), { timeout: 60000 });
  // the Grades tab lists every student, and its spreadsheet is main's file byte for byte
  const nRows = await p.$$eval('#glTable tbody tr', r => r.length);
  assert.ok(nRows >= 2, 'a row for each student');
  const csv = await dl.next(() => p.evaluate(() => [...document.querySelectorAll('.mk-grades .of button')].find(b => /CSV/.test(b.textContent)).click()));
  assert.equal(csv.name, old.csv.name, 'the same file name');
  assert.equal(Buffer.from(csv.bytes).toString('utf8'), Buffer.from(old.csv.bytes).toString('utf8'), 'the same spreadsheet, byte for byte');
  // the same paper, flattened with the same options, renders to the same pixels on every page (the files' own dates differ)
  const pix = await p.evaluate(async (b64, pdfPixels, mainPdf) => {
    const E = window.__mark.out, s = window.__mark.state();
    await E.readPapers();
    const bytes = await E.flattenFirst(0);
    const lib = s.pdfjsLib;
    return { now: await eval(pdfPixels)(eval(b64)(bytes), lib), was: await eval(pdfPixels)(mainPdf, lib) };
  }, b64, pdfPixels, old.pdf);
  assert.ok(pix.was.length >= 2, 'the feedback page and the paper');
  assert.deepEqual(pix.now, pix.was, 'every page of the returned PDF draws to the same pixels');
  // Return: the ZIP holds main's files under main's names, with the grade sheet beside them
  await p.evaluate(() => { location.hash = location.hash.replace(/\/grades$/, '/return'); });
  await p.waitForSelector('[data-go="zip"]', { timeout: 60000 });
  const zip = await dl.next(() => p.click('[data-go="zip"]'));
  const names = Object.keys(unzipSync(zip.bytes)).filter(n => !/^Grade sheet - /.test(n)).sort();
  assert.deepEqual(names, old.paths.slice().sort(), 'the same files under the same names');
  // exported is not returned; Mark as returned says so, and main reads it
  await p.waitForSelector('[data-doreturn]');
  await p.click('[data-doreturn]');
  await p.waitForSelector('[data-unreturn]');
  // a setting taken back says what came back (H-040, src/app/paper.js swapStep), and Redo puts it again
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForSelector('[data-doreturn]');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => /Undone: Marked as returned/.test(e.textContent)), { timeout: 10000 });
  await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control');
  await p.waitForSelector('[data-unreturn]');
  await p.evaluate(() => window.__mark.saved());
  const back = await p.evaluate(() => window.__mark.state().batch.returned);
  assert.ok(back && back.ok && back.t && back.n >= 1, 'exported and marked as returned');
  await dl.close(); await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), old.id);
  await m.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  const r = await m.evaluate(() => window.__gs.state().batch.returned);
  assert.deepEqual(r, back, 'the current app reads the same Returned');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Insights counts the class the way the current app does', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await mainSide(ctx, []);
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), old.id);
  await m.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  await m.evaluate(id => { location.hash = '#/a/' + encodeURIComponent(id.replace(/^gs\.b\./, '')) + '/insights'; }, old.id);
  await m.waitForSelector('#ovLeft', { timeout: 60000 });
  const was = await m.$eval('#ovLeft', e => e.textContent);
  const wasTiles = await m.$$eval('#ovTiles .ovv', l => l.map(e => e.textContent));
  await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id) + '/insights');
  await p.waitForSelector('#ovLeft', { timeout: 60000 });
  assert.equal(await p.$eval('#ovLeft', e => e.textContent), was, 'the same counted and left-out line');
  assert.deepEqual(await p.$$eval('#ovTiles .tv', l => l.map(e => e.textContent)), wasTiles, 'the same average, middle, lowest and highest');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the Grade sheet: a grade typed on a paper read as the score, also the grades found kept, a grade boxed by hand with the arrows, and the same spot on every paper; the current app reads the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zipOf(await standardFiles()));
  await m.evaluate(() => window.__gs.saveNow()); await settle(m);
  const id = await m.evaluate(() => window.__gs.state().batch.id);
  await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + '/grades');
  await p.waitForSelector('#glTable', { timeout: 60000 });
  await p.evaluate(() => [...document.querySelectorAll('.mk-grades [role="radio"], .mk-grades .seg button, .mk-grades [aria-pressed]')].find(b => /Grade sheet/.test(b.textContent)).click());
  await p.waitForSelector('[data-sheet] .gs-tbl', { timeout: 60000 });
  // Cleo's paper says 9.5/12 = 88% and she has no score: the sheet reads it
  const cleo = await p.evaluate(() => window.__mark.state().batch.students.findIndex(st => /Cleo/.test(st.key)));
  const rowOf = i => p.evaluate(i => { const tr = [...document.querySelectorAll('.gs-tbl tbody tr')].find(r => r.querySelector('td.n') && r.querySelector('td.n').textContent === String(i + 1)); return tr ? tr.querySelector('.gs-r').textContent : null; }, i);
  assert.match(await rowOf(cleo), /9\.5/);
  // back on the table: the papers to check, and only those at a click
  // her own score (a 1 on every rubric row) and the 9.5 typed from her paper differ
  await p.evaluate(i => { const s = window.__mark.state(); const g = s.batch.students[i].grade; g.rubric = s.setup.criteria.map(() => 1); g.sheet = '9.5'; }, cleo);
  await p.evaluate(() => [...document.querySelectorAll('.mk-grades [role="radio"], .mk-grades .seg button, .mk-grades [aria-pressed]')].find(b => /Table/.test(b.textContent)).click());
  await p.waitForSelector('[data-gcheck]', { timeout: 60000 });
  const all = await p.evaluate(() => document.querySelectorAll('#glTable tbody tr').length);
  await p.click('[data-gonly]');
  await p.waitForFunction(n => document.querySelectorAll('#glTable tbody tr').length < n, {}, all);
  await p.click('[data-gonly]');
  await p.waitForFunction(n => document.querySelectorAll('#glTable tbody tr').length === n, {}, all);
  await p.evaluate(i => { const g = window.__mark.state().batch.students[i].grade; g.rubric = []; delete g.sheet; }, cleo);
  await p.evaluate(() => [...document.querySelectorAll('.mk-grades [role="radio"], .mk-grades .seg button, .mk-grades [aria-pressed]')].find(b => /Grade sheet/.test(b.textContent)).click());
  await p.waitForSelector('[data-sheet] .gs-tbl', { timeout: 60000 });
  // also the grades found: kept for the next time, as the current app keeps it
  await p.evaluate(() => [...document.querySelectorAll('[data-sheet] .gs-opts label')][0].click());
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.sheetfound')), 'true');
  // a grade boxed by hand on the first paper: the box saves and goes on; the arrows go back and on; Esc finishes
  await p.click('[data-each]'); await p.waitForSelector('.mk-bx canvas[data-boxpage]', { timeout: 30000 });
  const first = await p.evaluate(() => document.querySelector('dialog[open] h2').textContent);
  const c = await (await p.$('.mk-bx canvas[data-boxpage="0"]')).boundingBox();
  await p.mouse.move(c.x + c.width * 0.6, c.y + c.height * 0.05); await p.mouse.down(); await p.mouse.move(c.x + c.width * 0.8, c.y + c.height * 0.1); await p.mouse.move(c.x + c.width * 0.9, c.y + c.height * 0.12); await p.mouse.up();
  await p.waitForFunction(f => document.querySelector('dialog[open] h2').textContent !== f, {}, first);
  const boxed = await p.evaluate(() => window.__mark.state().batch.students.flatMap(st => st.files).filter(f => f.hand).map(f => f.hand));
  assert.equal(boxed.length, 1); assert.ok(boxed[0].w > 0.25 && boxed[0].w < 0.35, 'the box is where she dragged');
  await p.keyboard.press('ArrowLeft'); await p.waitForFunction(f => document.querySelector('dialog[open] h2').textContent === f, {}, first);
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.mk-bx'));
  await p.waitForSelector('[data-sheet] [data-rebox]', { timeout: 60000 });
  assert.ok(await p.evaluate(() => [...document.querySelectorAll('[data-rebox]')].some(b => /redo/.test(b.textContent))), 'the row says it was boxed by hand');
  // the same spot on every paper
  await p.click('[data-spot]'); await p.waitForSelector('[data-spotpage]', { timeout: 30000 });
  const s = await (await p.$('[data-spotpage]')).boundingBox();
  await p.mouse.move(s.x + s.width * 0.7, s.y + s.height * 0.02); await p.mouse.down(); await p.mouse.move(s.x + s.width * 0.85, s.y + s.height * 0.06); await p.mouse.move(s.x + s.width * 0.95, s.y + s.height * 0.08); await p.mouse.up();
  await p.click('[data-spotuse]');
  await p.waitForSelector('[data-spotoff]', { timeout: 60000 });
  const spot = await p.evaluate(() => window.__mark.state().setup.spot);
  assert.equal(spot.page, 'first'); assert.ok(spot.w > 0.2 && spot.w < 0.3);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const old = await page(ctx, errors);
  await old.goto(srv.url); await appReady(old);
  await old.evaluate(id => window.__gs.reopenKept(id), id);
  await old.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await old.evaluate(() => window.__gs.state().batch.students.flatMap(st => st.files).filter(f => f.hand).map(f => f.hand)), boxed, 'the current app has the same box');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Insights > Consistency says what the current app says about the same work, and the papers with the same score go side by side', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await mainSide(ctx, []);
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), old.id);
  await m.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  // scores given a minute apart, the first three the same (one of them is marked missing): rubric rows, or points
  await m.evaluate(() => {
    const g = window.__gs, s = g.state(), su = s.setup, t0 = Date.now() - 3600e3;
    s.batch.students.filter(st => st.files.length).forEach((st, k) => {
      const at = t0 + k * 60e3, v = k < 3 ? 2 : 1;
      if (su.mode === 'rubric') { st.grade.rubric = su.criteria.map(() => v); st.grade.atR = Object.fromEntries(su.criteria.map((_, r) => [r, at + r])); }
      else { st.grade.points = String(v * 2); st.grade.atR = { points: at }; }
    });
    g.saveNow();
  });
  await settle(m);
  await m.evaluate(id => { location.hash = '#/a/' + encodeURIComponent(id.replace(/^gs\.b\./, '')) + '/insights/consistency'; }, old.id);
  await m.waitForSelector('#consSay', { timeout: 60000 });
  const was = await m.$eval('#consSay', e => e.textContent);
  const wasSame = await m.$$eval('[data-same]', l => l.map(e => e.dataset.same + ':' + e.textContent.replace(/\s+/g, ' ').trim()));
  await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id) + '/insights');
  await p.waitForSelector('#ovLeft', { timeout: 60000 });
  await p.evaluate(() => [...document.querySelectorAll('.mk-ins [role="radio"], .mk-ins .seg button, .mk-ins [aria-pressed]')].find(b => /Consistency/.test(b.textContent)).click());
  await p.waitForSelector('[data-cons] [data-csay]', { timeout: 60000 });
  assert.equal(await p.$eval('[data-csay]', e => e.textContent), was, 'the same reading, word for word');
  assert.deepEqual(await p.$$eval('[data-cssame]', l => l.map(e => e.dataset.cssame + ':' + e.textContent.replace(/\s+/g, ' ').trim())), wasSame, 'the same scores shared by more than one paper');
  assert.equal(wasSame.length, 1, 'one score shared by two papers');
  {
    await p.click('[data-cssame]');
    await p.waitForSelector('[data-cssameview] [data-cscol]', { timeout: 30000 });
    const n = await p.$$eval('[data-cscol]', l => l.length);
    assert.ok(n >= 2, 'a column for each paper with that score');
    await p.waitForFunction(() => document.querySelector('[data-cspage] canvas'), { timeout: 60000 });
    assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-csback')), true, 'Back has the focus');
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-cons] [data-csay]', { timeout: 30000 });
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('C-066: anchor papers: High, Mid or Low in More for this paper (gaps C-057), shown under the score once given, one paper each with one undo step, the tag in the list, and Return exports them named and covered, with Check the covers in its line; the current app reads the same tags', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await mainSide(ctx, []);
  const p = await page(ctx, errors), dl = await catchDownloads(p);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const tags = () => p.evaluate(() => window.__mark.state().batch.students.map(s => s.grade.anchor || ''));
  assert.equal(await p.$('[data-anchrow]'), null, 'no anchor row on a paper that is not one');
  await menuPick(p, '[data-pmore]', 'High');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.anchor === 'high');
  assert.equal(await p.$eval('[data-st="0"] [data-anchtag]', e => e.textContent), 'high', 'the tag in the list');
  await p.waitForSelector('[data-anchrow] [data-anchor="high"][aria-pressed="true"]');
  // High on another paper moves it; one Ctrl Z puts both back
  await p.click('[data-st="2"]');
  await p.waitForFunction(() => document.querySelector('.mk-side h2') && /Cleo/.test(document.querySelector('.mk-side h2').textContent));
  await menuPick(p, '[data-pmore]', 'High');
  await p.waitForFunction(() => window.__mark.state().batch.students[2].grade.anchor === 'high');
  assert.deepEqual((await tags()).slice(0, 3), ['', '', 'high'], 'one paper each');
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.anchor === 'high');
  assert.deepEqual((await tags()).slice(0, 3), ['high', '', ''], 'one undo step puts both papers back');
  await menuPick(p, '[data-pmore]', 'Low');
  await p.waitForFunction(() => window.__mark.state().batch.students[2].grade.anchor === 'low');
  await p.evaluate(() => window.__mark.saved());
  // Return: the card lists them, and one button makes both files in a ZIP, named for the assignment and the level
  await p.evaluate(() => { location.hash = location.hash.replace(/(\/mark\/[^/]+).*$/, '$1/return'); });
  await p.waitForSelector('#rtAnchors [data-anchout]', { timeout: 60000 });
  assert.equal(await p.$$eval('#rtAnchors li:not(.none)', l => l.length), 2);
  const zip = await dl.next(() => p.click('#rtAnchors [data-anchout]'));
  assert.match(zip.name, /^Anchor papers - .+\.zip$/);
  const files = unzipSync(zip.bytes), names = Object.keys(files).sort();
  assert.equal(names.length, 2);
  assert.match(names[0], / - \S+ High\.pdf$/); assert.match(names[1], / - \S+ Low\.pdf$/);
  for (const n of names) assert.equal(Buffer.from(files[n].slice(0, 5)).toString(), '%PDF-');
  // C-066: Check the covers in the card's line, opened at the first anchor paper, over Return
  await p.click('#rtAnchors [data-anchcheck]');
  await p.waitForSelector('dialog[open] [data-cc]', { timeout: 60000 });
  const hi = await p.$eval('#rtAnchors [data-anchli="high"] button', e => e.textContent.trim());
  assert.ok((await p.$eval('dialog[open] h2', e => e.textContent)).includes(hi), 'at the high anchor paper, ' + hi);
  assert.match(await p.evaluate(() => location.hash), /\/return$/);
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 10000 });
  await dl.close(); await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), old.id);
  await m.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  assert.deepEqual((await m.evaluate(() => window.__gs.state().batch.students.map(s => s.grade.anchor || ''))).slice(0, 3), ['high', '', 'low'], 'the current app has the same anchor papers');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('hide names: the switch, Check the covers (a box drawn, used on every paper, taken back, a paper said to look right, the keys), then Paper 1, 2… shuffled with the covers on the page; the current app reads the same; Name covers in Settings', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await mainSide(ctx, []);
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  // the switch is always in the list's footer, off, with no Shuffle until names are hidden; it opens Hide names
  assert.equal(await p.$eval('[data-anonsw]', e => e.getAttribute('aria-checked')), 'false');
  assert.equal(await p.$('[data-anonshuf]'), null, 'no Shuffle while names show');
  await p.click('[data-anonsw]');
  await p.waitForSelector('dialog[open] [data-hnstart]', { timeout: 30000 });
  await p.waitForFunction(() => /checked/.test((document.querySelector('[data-hncount]') || {}).textContent || ''), { timeout: 30000 });
  await p.click('[data-hncheck]');
  await p.waitForSelector('dialog[open] [data-cc] canvas[data-ccpage]', { timeout: 60000 });
  const share = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().batch.share || {})));
  const nBoxes = s => Object.values(s.boxes || {}).reduce((n, l) => n + l.length, 0);
  // a box over the name at the top of the first page
  const c = await (await p.$('canvas[data-ccpage]')).boundingBox();
  await p.mouse.move(c.x + c.width * 0.08, c.y + c.height * 0.03); await p.mouse.down(); await p.mouse.move(c.x + c.width * 0.2, c.y + c.height * 0.05); await p.mouse.move(c.x + c.width * 0.3, c.y + c.height * 0.06); await p.mouse.up();
  await p.waitForSelector('[data-ccevery]');
  assert.equal(nBoxes(await share()), 1, 'one box');
  await p.click('[data-ccevery]');
  await p.waitForFunction(() => Object.values((window.__mark.state().batch.share || {}).boxes || {}).reduce((n, l) => n + l.length, 0) > 1);
  const every = nBoxes(await share());
  assert.ok(every >= 3, 'the same box on the other papers');
  // Ctrl Z takes back the last box drawn here
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForFunction(n => Object.values((window.__mark.state().batch.share || {}).boxes || {}).reduce((m, l) => m + l.length, 0) === n - 1, {}, every);
  // Enter: this one looks right, on to the next not checked; up goes back to it
  await p.waitForFunction(() => document.querySelector('[data-cc] canvas[data-ccpage]'));
  const first = await p.$eval('dialog[open] h2', e => e.textContent);
  await p.waitForFunction(() => document.querySelector('[data-ccstate]'));
  await new Promise(r => setTimeout(r, 300));
  await p.keyboard.press('Enter');
  await p.waitForFunction(f => document.querySelector('dialog[open] h2').textContent !== f, {}, first);
  assert.equal(Object.keys((await share()).checked || {}).length >= 1, true, 'the first paper is checked');
  await p.keyboard.press('ArrowUp');
  await p.waitForFunction(f => document.querySelector('dialog[open] h2').textContent === f, {}, first);
  assert.match(await p.$eval('[data-ccstate]', e => e.textContent), /Checked/);
  await p.keyboard.press('Escape');
  await p.waitForSelector('dialog[open] [data-hnstart]', { timeout: 30000 });
  await p.click('[data-hnstart]');
  await p.waitForFunction(() => window.__mark.state().batch.anon && window.__mark.state().batch.anon.on);
  await p.waitForFunction(() => [...document.querySelectorAll('.mk-rows .nm')].every(e => /^Paper \d+$/.test(e.textContent)), { timeout: 30000 });
  assert.equal(await p.$eval('[data-anonsw]', e => e.getAttribute('aria-checked')), 'true');
  // the open paper's page has her box as a cover
  await p.waitForFunction(() => { const pg = window.__mark.state().pages[0]; return pg && pg.covers && pg.covers.some(c => c.own); }, { timeout: 60000 });
  const order = await p.evaluate(() => window.__mark.state().batch.anon.order.slice());
  assert.equal(order.length, await p.evaluate(() => window.__mark.state().batch.students.length));
  await p.click('[data-anonshuf]');
  await p.evaluate(() => window.__mark.saved());
  const now = await p.evaluate(() => JSON.parse(JSON.stringify({ anon: window.__mark.state().batch.anon, share: window.__mark.state().batch.share })));
  // Name covers in Settings: Also find typed names
  await p.goto(srv.url + 'next/#/settings/marking');
  await p.waitForSelector('[data-sgnames]', { timeout: 30000 });
  await p.evaluate(() => [...document.querySelectorAll('[data-sgnames] [role="radio"], [data-sgnames] button')].find(b => /Also find/.test(b.textContent)).click());
  await p.waitForFunction(() => localStorage.getItem('gs.nameFind') === 'true');
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), old.id);
  await m.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  const was = await m.evaluate(() => JSON.parse(JSON.stringify({ anon: window.__gs.state().batch.anon, share: window.__gs.state().batch.share })));
  assert.deepEqual(was.anon, now.anon, 'the same shuffled order, names hidden');
  assert.deepEqual(was.share.boxes, now.share.boxes, 'the same boxes'); assert.deepEqual(was.share.checked, now.share.checked, 'the same papers checked');
  assert.equal(await m.evaluate(() => window.__gs.nameFindOn()), true, 'the current app finds typed names too');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('C-090: share with your assistant (src/app/claude.js): from Insights, a ZIP of papers by code with no names, a marks file saying who is left out, and the reply brought back into each comment box; the current app reads the same codes and comment', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await mainSide(ctx, []);
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id) + '/insights');
  await p.waitForSelector('[data-insshare]', { timeout: 60000 });
  // Find while an assignment is open: a student by name opens that paper (src/shell.js findRows "Students")
  const who = await p.evaluate(() => window.__mark.state().batch.students[1].key);
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open]');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('dialog.cmd input'));
  await p.keyboard.type(who);
  await p.waitForFunction(s => { const o = document.querySelector('dialog.cmd[open] [role="option"][aria-selected="true"]'); return o && o.textContent.includes(s) && !o.textContent.startsWith('Search inside'); }, { timeout: 10000 }, who);
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__mark.state().cur === 1 && !/insights/.test(location.hash), { timeout: 30000 });
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id) + '/insights');
  await p.waitForSelector('[data-insshare]', { timeout: 60000 });
  await p.click('[data-insshare]');
  await p.waitForSelector('dialog[open] [data-share] [data-shcount]', { timeout: 60000 });
  await p.waitForFunction(() => /checked/.test(document.querySelector('[data-shcount]').textContent), { timeout: 60000 });
  const dl = await catchDownloads(p);
  const zip = await dl.next(() => p.click('dialog[open] [data-make]'));
  assert.match(zip.name, /\.zip$/);
  const z = unzipSync(zip.bytes), files = Object.keys(z);
  const st = await p.evaluate(() => { const b = window.__mark.state().batch; return { codes: JSON.parse(JSON.stringify(b.share.codes)), keys: b.students.map(s => s.key), first: b.students[0].key }; });
  for (const f of ['README.txt', 'scores.csv', 'comments.json', 'rubric.json']) assert.ok(files.includes(f), f);
  const papers = files.filter(f => f.startsWith('papers/'));
  assert.ok(papers.length >= 1 && papers.every(f => /^papers\/S-[A-Z0-9]{4}(-\d+)?\.pdf$/.test(f)), papers.join(', '));
  const text = new TextDecoder().decode(z['scores.csv']) + new TextDecoder().decode(z['comments.json']) + new TextDecoder().decode(z['README.txt']);
  for (const k of st.keys) assert.ok(!text.includes(k), 'no folder name in what goes: ' + k);
  assert.ok(text.includes(st.codes[st.first]), 'the first student by code');
  await p.waitForFunction(() => window.__mark.state().batch.share.made > 0);
  // Marks only: one file, the same codes
  await p.click('dialog[open] [data-share] .seg [data-v="marks"]');
  await p.waitForSelector('dialog[open] [data-marksdl]');
  // C-090: the students with nothing marked yet are left out, and it says so
  const left = await p.$eval('dialog[open] [data-mkleft]', e => [+e.dataset.mkleft, e.textContent]), all = await p.evaluate(() => window.__mark.state().batch.students.length);
  assert.ok(left[0] > 0 && left[0] < all, 'some students, not all');
  assert.equal(left[1], 'Left out: ' + left[0] + ' students with no marks, score or comment yet. The file says how many.');
  const md = await dl.next(() => p.click('dialog[open] [data-marksdl]'));
  const mdText = new TextDecoder().decode(md.bytes);
  assert.match(md.name, /\.md$/); assert.ok(mdText.includes(st.codes[st.first])); for (const k of st.keys) assert.ok(!mdText.includes(k), k);
  await dl.close();
  // Bring back: the reply by code goes below what's in the comment box
  await p.click('dialog[open] [data-shback]');
  await p.waitForSelector('dialog[open] [data-bbtext]');
  await p.focus('[data-bbtext]');
  await p.keyboard.type(st.codes[st.first] + '\nA strong opening; add one more example.\n\nS-ZZZZ\nNobody here.');
  await p.waitForFunction(() => /1 of/.test((document.querySelector('[data-bbcount]') || {}).textContent || ''), { timeout: 10000 });
  assert.match(await p.$eval('[data-bbcount]', e => e.textContent), /1 code doesn't belong/);
  await p.click('dialog[open] [data-bbapply]');
  await p.waitForFunction(() => !document.querySelector('dialog[open] [data-bring]'));
  const comment = await p.evaluate(() => window.__mark.state().batch.students[0].grade.comment);
  assert.equal(comment, 'Clear ideas; check your commas.\n\nA strong opening; add one more example.');
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), old.id);
  await m.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  const was = await m.evaluate(() => { const b = window.__gs.state().batch; return { codes: b.share.codes, comment: b.students[0].grade.comment, made: b.share.made }; });
  assert.deepEqual(was.codes, st.codes, 'the same codes, so a reply comes back to either app');
  assert.equal(was.comment, comment); assert.ok(was.made > 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Stage 8, slice D: the Return tab's second-level controls (rebuild/gaps/D.md). D-030 D-031 the check before returning, D-029 who got
// theirs early, D-032 the options' summary and their open state, D-033 D-034 the mark key's hint and its link, D-035 the files an
// export left out, A-020 A-021 A-022 Ask your assistant, A-023 Rescans, A-081 Mark as returned after leaving the tab. Made-up students.
test('Return (D-029 D-030 D-031 D-032 D-033 D-034 D-035 A-020 A-021 A-022 A-023 A-081): the check before returning, early names, options summary, mark key, failed files, assistant and rescan cards; the current app reads the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await mainSide(ctx, errors);
  // main's page: one paper sent early, one page flagged for a rescan, and main's own check for comparison
  const m0 = await page(ctx, errors);
  await m0.goto(srv.url); await appReady(m0);
  await m0.evaluate(id => window.__gs.reopenKept(id), old.id);
  await m0.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  const mainCheck = await m0.evaluate(async () => {
    const G = window.__gs, b = G.state().batch;
    b.students[2].grade.sent = Date.now() - 60000;
    const f2 = b.students[2].files[0]; (f2.marks[0] ||= []).push({ t: 'stamp', k: 'check', x: 300, y: 300, size: 16, color: '#1F8A4C' });
    const f = b.students[0].files[0]; f.sc = { ...(f.sc || {}), 0: { ...((f.sc || {})[0] || {}), re: 1 } };
    G.saveNow(); await G.scanAll();
    const c = G.exportCheck(); return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.map(o => o.i)]));
  });
  await m0.close();
  const p = await page(ctx, errors), url = srv.url + 'next/#/mark/' + encodeURIComponent(old.id) + '/return';
  await p.goto(url);
  await p.waitForSelector('[data-xcheck]', { timeout: 60000 });
  // D-030: the same groups as the current app's check, the same students in each
  const now = await p.evaluate(() => Object.fromEntries(Object.entries(window.__mark.out.check()).map(([k, v]) => [k, v.map(o => o.i)])));
  assert.deepEqual(now, mainCheck, 'the same things to look at as the current app');
  const n = Object.values(now).reduce((a, v) => a + v.length, 0);
  assert.ok(n > 0, 'something to look at (unscored papers)');
  assert.equal(await p.$eval('[data-xcheck]', e => e.dataset.xcheck), String(n));
  assert.match(await p.$eval('#xCheck summary', e => e.textContent), new RegExp(n + ' things? to look at before you return these'));
  await p.click('#xCheck summary');
  const first = now.unfinished[0];
  await p.click('[data-group="unfinished"] [data-chk="' + first + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && !/\/return/.test(location.hash), { timeout: 30000 }, first);
  // D-029: who got theirs early, by name, and what the box does
  await p.goto(url); await p.waitForSelector('[data-xearly]', { timeout: 60000 });
  const early = await p.evaluate(() => ({ say: document.querySelector('[data-xearly]').textContent, who: window.__mark.state().batch.students[2].key }));
  assert.ok(early.say.includes(early.who), 'the early student is named');
  // D-032: the options say what's on before they're opened, and stay open once opened, in either app (gs.xopts)
  await p.waitForFunction(() => /^Options: /.test(document.querySelector('[data-xoptssay]').textContent), { timeout: 30000 });
  const sum = await p.$eval('[data-xoptssay]', e => e.textContent);
  assert.match(sum, /^Options: /); assert.match(sum, /student folders/); assert.match(sum, /grade sheet/);
  assert.equal(await p.$eval('details.xopts', e => e.open), false);
  await p.click('[data-xoptssay]');
  await p.waitForFunction(() => localStorage.getItem('gs.xopts') === 'true');
  await p.reload(); await p.waitForSelector('[data-xoptssay]', { timeout: 60000 });
  assert.equal(await p.$eval('details.xopts', e => e.open), true, 'remembered open');
  // D-033: how many files get a mark key (one file has a proofreading mark); D-034 Change what they mean opens Settings, Marking at the key
  await p.waitForSelector('[data-xkeysay]', { timeout: 30000 });
  assert.match(await p.$eval('[data-xkeysay]', e => e.textContent), /files? gets? one|The file gets one/);
  await p.click('[data-mkey]');
  await p.waitForFunction(() => /#\/settings\/marking/.test(location.hash) && document.querySelector('[data-sgmk]'), { timeout: 30000 });
  // A-020 A-021 A-022: Ask your assistant opens Share at papers, marks only, and Bring back
  await p.goto(url); await p.waitForSelector('[data-rtask="marks"]', { timeout: 60000 });
  await p.click('[data-rtask="marks"]');
  await p.waitForSelector('dialog[open] [data-share] .seg [data-v="marks"][aria-checked="true"]', { timeout: 30000 });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open] [data-share]'));
  await p.click('[data-rtask="papers"]');
  await p.waitForSelector('dialog[open] [data-share] .seg [data-v="papers"][aria-checked="true"]', { timeout: 30000 });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open] [data-share]'));
  await p.click('[data-rtask="back"]');
  await p.waitForSelector('dialog[open] [data-bbtext]', { timeout: 30000 });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open] [data-bbtext]'));
  // A-023: the flagged page, and Show lists it; picking it opens that paper on the Mark tab
  await p.waitForSelector('#rtRescan', { timeout: 30000 });
  assert.match(await p.$eval('#rtRescan', e => e.textContent), /1 page is flagged for a rescan/);
  await p.click('[data-rtask="rescan"]');
  await p.waitForSelector('[data-rsgo="0"]', { timeout: 30000 });
  await p.click('[data-rsgo="0"]');
  await p.waitForFunction(() => window.__mark.state().cur === 0 && !/\/return/.test(location.hash), { timeout: 30000 });
  // D-035: a file that can't be drawn is named in a list that stays until closed
  await p.goto(url); await p.waitForSelector('[data-go="zip"]', { timeout: 60000 });
  await p.evaluate(() => { const st = window.__mark.state().batch.students[0]; st.files[0].numPages = 0; st.files[0].data = new Uint8Array([37, 80, 68, 70, 45, 120]); });
  const dl = await catchDownloads(p);
  await dl.next(() => p.click('[data-go="zip"]'));
  await p.waitForSelector('#xFails li', { timeout: 60000 });
  assert.match(await p.$eval('#xFails', e => e.textContent), /files? (isn’t|aren’t) in this export/);
  await new Promise(r => setTimeout(r, 4500));
  assert.ok(await p.$('#xFails'), 'still there after a toast would have gone');
  await p.click('[data-xfailsclose]'); await p.waitForFunction(() => !document.querySelector('#xFails'));
  // A-081: start an export, leave for the Mark tab, and the toast offers Mark as returned
  await p.goto(url); await p.waitForSelector('[data-go="zip"]', { timeout: 60000 });
  await p.evaluate(() => { const b = window.__mark.state().batch; delete b.returned; });
  await p.click('[data-go="zip"]');
  await p.evaluate(() => { location.hash = location.hash.replace(/\/return$/, ''); });
  await p.waitForFunction(() => [...document.querySelectorAll('.toast button')].some(b => b.textContent === 'Mark as returned'), { timeout: 90000 });
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Mark as returned').click());
  await p.waitForFunction(() => (window.__mark.state().batch.returned || {}).ok > 0);
  await p.evaluate(() => window.__mark.saved());
  const back = await p.evaluate(() => window.__mark.state().batch.returned);
  await dl.close(); await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), old.id);
  await m.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  assert.deepEqual(await m.evaluate(() => window.__gs.state().batch.returned), back, 'the current app reads the same Returned');
  assert.equal(await m.evaluate(() => localStorage.getItem('gs.xopts')), 'true');
  assert.deepEqual(errors.filter(e => !/couldn.t|PDF|page/i.test(e)), []);
  await ctx.close();
});

test('B-066: an assignment\'s views each have an address: grades/sheet opens the Grade sheet, insights/consistency opens Consistency, and examples opens the assignment\'s Examples tab', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zipOf(await standardFiles()));
  await m.evaluate(() => window.__gs.saveNow()); await settle(m);
  const id = await m.evaluate(() => window.__gs.state().batch.id);
  await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + '/grades/sheet');
  await p.waitForSelector('[data-sheet] .gs-tbl', { timeout: 60000 });
  await p.goto(srv.url + 'blank'); await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + '/insights/consistency');
  await p.waitForSelector('[data-cons]', { timeout: 60000 });
  // the assignment's own Examples tab, as the current app's #/a/<id>/examples (D-020)
  await p.goto(srv.url + 'blank'); await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + '/examples');
  await p.waitForSelector('[data-asgex]', { timeout: 60000 });
  assert.equal(await p.evaluate(() => location.hash.split('/').pop()), 'examples', 'stays at its own address');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Insights > Percents (src/rubrics.js pctShell, pctDraw): who counts, the middle of the class, the places in an average, the target,
// the bands and What if; the tiles and the table read as the current app's, the kept choices are the same ones both ways, and What if
// changes no score. The summary's bars say whose they are and See this as a table lists them; How each row was scored counts each level.
test('C-013 C-014 C-015 C-016 C-017 C-018 C-019 C-020 C-021 C-022 C-023 C-901 A-017: Insights > Percents, the bars\' tips and See this as a table, and How each row was scored; the current app reads the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const m = await page(ctx, []);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zipOf(await standardFiles()));
  await markPage(m, 0);
  const id = await m.evaluate(() => {
    const G = window.__gs, s = G.state(), rub = s.setup.mode === 'rubric';
    s.batch.students.forEach((st, i) => {
      if (i === 1) { st.grade.status = 'missing'; return; }
      if (rub) st.grade.rubric = s.setup.criteria.map((_, r) => Math.max(1, 4 - ((i + r) % 4))); else st.grade.points = String(5 + i);
      if (i === 2) st.grade.status = 'late';
    });
    G.saveNow(); return { id: s.batch.id, n: rub ? s.setup.criteria.length : 0 };
  });
  await goToStudent(m, 1); await goToStudent(m, 0); await settle(m);
  await m.evaluate(id => { location.hash = '#/a/' + encodeURIComponent(id.replace(/^gs\.b\./, '')) + '/insights'; }, id.id);
  await m.waitForSelector('#dlgBox [data-ovtab="pct"]', { timeout: 60000 });
  await m.click('#dlgBox [data-ovtab="pct"]');
  await m.waitForSelector('#pTiles', { timeout: 30000 });
  const was = await m.evaluate(() => ({ tiles: [...document.querySelectorAll('#pTiles .ovv')].map(e => e.textContent), rows: window.__gs.pctRows().map(r => r.name + ' ' + r.pct) }));
  // the target, set in the current app, is kept for the class
  await m.$eval('#pTarget', e => { e.value = '80'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await m.waitForFunction(() => window.__gs.pv().target === 80, { timeout: 10000 });
  const was80 = await m.evaluate(() => [...document.querySelectorAll('#pTiles .ovv')].map(e => e.textContent));
  await m.close();
  assert.ok(was.rows.length >= 3, 'papers counted: ' + was.rows.join(', '));

  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id.id) + '/insights');
  await p.waitForSelector('#ovTiles', { timeout: 60000 });
  // the summary's bars: each says whose it is, and See this as a table lists them (C-023, C-901)
  await p.waitForSelector('#ovSpread [data-bin][tabindex="0"]', { timeout: 30000 });
  assert.match(await p.$eval('#ovSpread [data-bin][tabindex="0"]', e => e.getAttribute('aria-label')), /\d/);
  await p.click('#ovSpread [data-spreadtbl] summary');
  const tbl = await p.$$eval('#ovSpread [data-spreadtbl] tbody tr', l => l.map(r => +r.children[1].textContent));
  assert.equal(tbl.reduce((a, c) => a + c, 0), was.rows.length, 'every counted paper is in the table');
  if (id.n) {
    assert.ok(await p.$('#ovRows [data-rowbar][tabindex="0"]'), 'the rows\' bars can be reached by the keyboard');
    // How each row was scored: every row's levels add up to the papers scored (A-017)
    const lv = await p.$$eval('#insRows .pc-lvr', l => l.map(r => [...r.querySelectorAll('[data-lv]')].reduce((a, s) => a + +/\d+/.exec(s.getAttribute('aria-label').split(':').pop())[0], 0)));
    assert.equal(lv.length, id.n); for (const k of lv) assert.equal(k, was.rows.length);
  }
  // Percents: the same tiles as the current app, with its target of 80 read back
  await p.evaluate(() => [...document.querySelectorAll('.mk-ins [role="radio"]')].find(b => /Percents/.test(b.textContent)).click());
  await p.waitForSelector('[data-pct] #pTiles', { timeout: 30000 });
  assert.equal(await p.$eval('[data-pctarget]', e => e.value), '80');
  assert.deepEqual(await p.$$eval('#pTiles .tv', l => l.map(e => e.textContent)), was80, 'the same five tiles');
  // the table, in the current app's order
  assert.deepEqual(await p.$$eval('[data-pcrow]', l => l.map(r => r.querySelector('button').textContent + ' ' + r.children[2].textContent.replace('%', ''))), was.rows);
  // sorted by name
  await p.click('[data-psort="name"]');
  const byName = await p.$$eval('[data-pcrow] button', l => l.map(b => b.textContent));
  assert.deepEqual(byName, byName.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  // the target back at 70: the current app's first tiles
  // typed, and kept once she leaves the box (ui HeldInput)
  await p.click('[data-pctarget]', { count: 3 }); await p.keyboard.type('70'); await p.keyboard.press('Tab');
  await p.waitForFunction(w => [...document.querySelectorAll('#pTiles .tv')].map(e => e.textContent).join('|') === w, { timeout: 10000 }, was.tiles.join('|'));
  // the places in an average, one setting everywhere (C-017)
  await p.click('[data-pcdp] [data-v="0"]');
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.avgDp')), '0');
  assert.match(await p.$eval('#pTiles .tv', e => e.textContent), /^\d+%$/);
  await p.click('[data-pcdp] [data-v="2"]');
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.avgDp')), null);
  // Who counts: late papers left out, then back
  const n0 = (await p.$$('[data-pcrow]')).length, whoFirst = async () => { await p.click('[data-pcwho]'); await p.waitForSelector('.pop [role^="menuitem"]'); await p.evaluate(() => document.querySelector('.pop [role^="menuitem"]').click()); };
  await whoFirst();
  await p.waitForFunction(n => document.querySelectorAll('[data-pcrow]').length === n - 1, { timeout: 10000 }, n0);
  const kept = Object.values(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.pctView'))))[0];
  assert.equal(kept.late, false); assert.equal(kept.target, 70);
  await whoFirst();
  await p.waitForFunction(n => document.querySelectorAll('[data-pcrow]').length === n, { timeout: 10000 }, n0);
  // Fives, and my own bands with one taken away
  await p.click('[data-pct] [role="radio"][data-v="5"]');
  await p.waitForFunction(() => document.querySelectorAll('[data-band]').length === 9, { timeout: 10000 });
  await p.click('[data-pct] [role="radio"][data-v="own"]');
  await p.waitForSelector('[data-pccut="0"]');
  await p.click('[data-pccut="2"]', { count: 3 }); await p.keyboard.press('Backspace'); await p.keyboard.press('Tab');
  await p.waitForFunction(() => document.querySelectorAll('[data-band]').length === 4, { timeout: 10000 });
  assert.deepEqual(Object.values(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.pctView'))))[0].cuts, [90, 80, 60]);
  // What if: only a preview, no score changes
  const scores = await p.evaluate(() => JSON.stringify(window.__mark.state().batch.students.map(s => s.grade)));
  await p.$eval('[data-pcadd]', e => { e.value = '1'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForSelector('[data-pcpreview]', { timeout: 10000 });
  assert.match(await p.$eval('#pTiles .tile.main .ts', e => e.textContent), /\+1/);
  assert.equal(await p.evaluate(() => JSON.stringify(window.__mark.state().batch.students.map(s => s.grade))), scores);
  // Copy this table
  await p.click('[data-pccopy]');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast, [role="status"]')].some(e => /\d/.test(e.textContent)), { timeout: 10000 });
  // a dot opens that paper
  const dot = await p.$eval('[data-pcdot]', e => +e.dataset.pcdot);
  await p.click('[data-pcdot="' + dot + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && !document.querySelector('[data-pct]'), { timeout: 30000 }, dot);
  assert.deepEqual(errors, []);
  await p.close();

  // the current app reads who counts and the bands as they were left
  const c = await page(ctx, []);
  await c.goto(srv.url); await appReady(c);
  await c.evaluate(id => window.__gs.reopenKept(id), id.id);
  await c.waitForFunction(() => window.__gs.state().batch, { timeout: 60000 });
  await c.evaluate(id => { location.hash = '#/a/' + encodeURIComponent(id.replace(/^gs\.b\./, '')) + '/insights'; }, id.id);
  await c.waitForSelector('#dlgBox [data-ovtab="pct"]', { timeout: 60000 });
  await c.click('#dlgBox [data-ovtab="pct"]');
  await c.waitForSelector('#pTiles', { timeout: 30000 });
  const pv = await c.evaluate(() => window.__gs.pv());
  assert.deepEqual([pv.late, pv.band, pv.cuts, pv.target], [true, 'own', [90, 80, 60], 70]);
  await ctx.close();
});

// Insights, after the summary (src/tabs.js insMore): each student's percent on the class's last summative beside this one, a row
// opening that paper, and this assignment's linked copies in the other classes, read from saved work only.
test('A-018 A-019: Insights shows Change since the last summative (a row opens that paper) and The same assignment in your other classes; the current app reads the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes[0].units[1].items.push({ id: 'i14', name: 'Poetry essay', classId: 'c1', type: 'sum', due: '2026-11-10', group: 'g1' });
  lib.classes[1].units.push({ id: 'u9', name: 'Poetry', items: [{ id: 'i15', name: 'Poetry essay', classId: 'c2', type: 'sum', due: '2026-11-10', group: 'g1', typed: { max: null, s: { 'Nia Elsewhere': { v: 80 }, 'Omar Stand-in': { v: 60 } } } }] });
  seed.ls['gs.lib'] = JSON.stringify(lib);
  const m = await page(ctx, []);
  await m.goto(srv.url + 'blank'); await plant(m, seed);
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zipOf(await standardFiles()));
  await markPage(m, 0);
  const id = await m.evaluate(() => {
    const G = window.__gs, s = G.state(), f = G.findItem('i14');
    f.it.batchId = s.batch.id; s.batch.assignment = f.it; G.saveLib();
    s.batch.students.forEach((st, i) => { if (s.setup.mode === 'rubric') st.grade.rubric = s.setup.criteria.map((_, r) => Math.max(1, 4 - ((i + r) % 3))); else st.grade.points = String(6 + i); });
    G.saveNow(); return s.batch.id;
  });
  await goToStudent(m, 1); await goToStudent(m, 0); await settle(m);
  await m.evaluate(id => { location.hash = '#/a/' + encodeURIComponent(id.replace(/^gs\.b\./, '')) + '/insights'; }, id);
  await m.waitForSelector('#insMove .insdb', { timeout: 60000 });
  await m.waitForSelector('#insAcross .insxr', { timeout: 60000 });
  const was = await m.evaluate(() => ({
    move: [...document.querySelectorAll('#insMove .insdb')].map(g => g.getAttribute('aria-label').replace(' then ', ', ')),
    across: [...document.querySelectorAll('#insAcross .insxr:not(.insxax)')].map(r => r.querySelector('.insxn').textContent + ' ' + ((r.querySelector('.insxv b') || {}).textContent || '')),
  }));
  await m.close();
  assert.ok(was.move.length >= 3, 'rows: ' + was.move.join('; '));
  assert.equal(was.across.length, 2);

  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + '/insights');
  await p.waitForSelector('#insMove [data-mv]', { timeout: 60000 });
  assert.deepEqual(await p.$$eval('#insMove [data-mv]', l => l.map(b => b.getAttribute('aria-label'))), was.move, 'the same students, the same two percents, in the same order');
  assert.match(await p.$eval('#insMove .pc-leg', e => e.textContent), /Poetry analysis/);
  await p.waitForSelector('#insAcross [data-across]', { timeout: 30000 });
  assert.deepEqual(await p.$$eval('#insAcross [data-across]', l => l.map(r => r.querySelector('.pc-axn').textContent + ' ' + ((r.querySelector('.num b') || {}).textContent || ''))), was.across, 'each class and its average');
  // a row opens that paper
  const i = await p.$eval('#insMove [data-mv]:last-child', b => +b.dataset.mv);
  await p.click('#insMove [data-mv="' + i + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && !document.querySelector('#insMove'), { timeout: 30000 }, i);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The Grades tab's links (src/app/dialogs.js openGrades): Student details beside each roster name and each name with nothing turned
// in, the class's page in the school's system in the footer, and each chip on the paper column opening the grade sheet.
test('A-014 A-015 A-016: Grades has Student details beside the names, the school system link, and the paper chips open the grade sheet; the current app has the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes[0].mb = 'https://school.example/classes/9e'; lib.me = { ...(lib.me || {}), sys: 'Our School' };
  seed.ls['gs.lib'] = JSON.stringify(lib);
  const m = await page(ctx, []);
  await m.goto(srv.url + 'blank'); await plant(m, seed);
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zipOf(await standardFiles()));
  await m.evaluate(() => window.__gs.saveNow()); await settle(m);
  const id = await m.evaluate(() => window.__gs.state().batch.id);
  await m.evaluate(id => { location.hash = '#/a/' + encodeURIComponent(id.replace(/^gs\.b\./, '')) + '/grades'; }, id);
  await m.waitForSelector('#glTable', { timeout: 60000 });
  const was = await m.evaluate(() => ({ mb: document.querySelector('#dlgBox .mb-go').getAttribute('href'), mbText: document.querySelector('#dlgBox .mb-go').textContent,
    who: [...document.querySelectorAll('#glTable .whob')].map(b => b.getAttribute('aria-label').replace('Student details for ', '')) }));
  await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + '/grades');
  await p.waitForSelector('#glTable', { timeout: 60000 });
  // the school system link (A-015)
  assert.equal(await p.$eval('[data-mblink]', a => a.getAttribute('href')), was.mb);
  assert.equal((await p.$eval('[data-mblink]', a => a.textContent)).trim(), was.mbText.replace('↗', '').trim());
  assert.equal(await p.$eval('[data-mblink]', a => a.target), '_blank');
  // Student details beside the names: the same students as the current app's (A-014)
  const who = await p.$$eval('#glTable [data-who]', l => l.map(b => b.dataset.who));
  assert.ok(who.length >= 6, who.join(', '));
  assert.deepEqual(who, was.who.filter(n => who.includes(n)));
  assert.deepEqual(was.who.filter(n => !who.includes(n)), [], 'every name with details in the current app has them here');
  await p.click('#glTable [data-who="Esme Placeholder"]');
  await p.waitForSelector('[data-pmwho]', { timeout: 30000 });
  assert.match(await p.$eval('dialog[open]', d => d.textContent), /Esme Placeholder/);
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('[data-pmwho]'));
  // a chip on the paper column opens the grade sheet (A-016): Cleo's paper says 9.5 and her own score differs
  const cleo = await p.evaluate(() => window.__mark.state().batch.students.findIndex(st => /Cleo/.test(st.key)));
  await p.evaluate(i => { const s = window.__mark.state(); const g = s.batch.students[i].grade; g.rubric = s.setup.criteria.map(() => 1); g.sheet = '9.5'; }, cleo);
  await p.evaluate(() => [...document.querySelectorAll('.mk-grades [role="radio"]')].find(b => /Grade sheet/.test(b.textContent)).click());
  await p.waitForSelector('[data-sheet] .gs-tbl', { timeout: 60000 });
  await p.evaluate(() => [...document.querySelectorAll('.mk-grades [role="radio"]')].find(b => /Table/.test(b.textContent)).click());
  await p.waitForSelector('#glTable [data-opchip]', { timeout: 60000 });
  await p.click('#glTable [data-opchip]');
  await p.waitForSelector('[data-sheet] .gs-tbl', { timeout: 30000 });
  await p.evaluate(() => [...document.querySelectorAll('.mk-grades [role="radio"]')].find(b => /Table/.test(b.textContent)).click());
  await p.waitForSelector('[data-gsheet]', { timeout: 30000 });
  await p.click('[data-gsheet]');
  await p.waitForSelector('[data-sheet] .gs-tbl', { timeout: 30000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

// B-059: a Word paper can't be boxed in Check the covers, so Hide names lists the ones that may show a name (src/names.js wordFlagsHtml,
// src/app/anon.js data-wp), each student's name opening their paper; the current app lists the same papers.
test('B-059: Hide names lists the Word papers that may show a name, and a name opens that paper; the current app lists the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const m = await page(ctx, []);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  const files = await standardFiles(); files['Dov Madeup/Essay.docx'] = makeDocx('A short essay in Word with no name at the top.');
  await openZip(m, zipOf(files));
  await m.evaluate(() => window.__gs.saveNow()); await settle(m);
  const id = await m.evaluate(() => window.__gs.state().batch.id);
  await m.evaluate(() => window.__gs.openAnon());
  await m.waitForSelector('#wordFlags [data-wp]', { timeout: 60000 });
  const was = await m.evaluate(() => [...document.querySelectorAll('#wordFlags li')].map(li => li.textContent.trim()));
  await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await menuPick(p, '[data-setupopen]', 'Hide names');
  await p.waitForSelector('dialog[open] [data-hnword] li button', { timeout: 60000 });
  assert.deepEqual(await p.$$eval('dialog[open] [data-hnword] li', l => l.map(li => li.textContent.trim())), was);
  assert.ok(was.some(x => /Dov Madeup/.test(x) && /Essay\.docx/.test(x)), was.join(' | '));
  const dov = await p.evaluate(() => window.__mark.state().batch.students.findIndex(s => s.key === 'Dov Madeup'));
  await p.evaluate(() => [...document.querySelectorAll('dialog[open] [data-hnword] li button')].find(b => b.textContent === 'Dov Madeup').click());
  await p.waitForFunction(i => !document.querySelector('dialog[open]') && window.__mark.state().cur === i, { timeout: 30000 }, dov);
  assert.deepEqual(errors, []);
  await ctx.close();
});
