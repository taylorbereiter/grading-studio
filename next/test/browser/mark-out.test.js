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
const { standardFiles, zipOf } = require('../../../test/helpers/fixtures.js');
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

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors, width = 1440) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
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

test('anchor papers: High, Mid or Low under the score, one paper each with one undo step, the tag in the list, and Return exports them named and covered; the current app reads the same tags', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const old = await mainSide(ctx, []);
  const p = await page(ctx, errors), dl = await catchDownloads(p);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(old.id));
  await p.waitForSelector('[data-anchrow] [data-anchor="high"]', { timeout: 60000 });
  const tags = () => p.evaluate(() => window.__mark.state().batch.students.map(s => s.grade.anchor || ''));
  await p.click('[data-anchor="high"]');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.anchor === 'high');
  assert.equal(await p.$eval('[data-st="0"] [data-anchtag]', e => e.textContent), 'high', 'the tag in the list');
  // High on another paper moves it; one Ctrl Z puts both back
  await p.click('[data-st="2"]');
  await p.waitForFunction(() => document.querySelector('.mk-side h2') && /Cleo/.test(document.querySelector('.mk-side h2').textContent));
  await p.waitForSelector('[data-anchrow] [data-anchor="high"]');
  await p.click('[data-anchor="high"]');
  await p.waitForFunction(() => window.__mark.state().batch.students[2].grade.anchor === 'high');
  assert.deepEqual((await tags()).slice(0, 3), ['', '', 'high'], 'one paper each');
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.anchor === 'high');
  assert.deepEqual((await tags()).slice(0, 3), ['high', '', ''], 'one undo step puts both papers back');
  await p.waitForSelector('[data-anchrow] [data-anchor="low"]');
  await p.click('[data-anchor="low"]');
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
  await p.waitForSelector('[data-anonsw]', { timeout: 60000 });
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
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

test('share with your assistant (src/app/claude.js): from Insights, a ZIP of papers by code with no names, a marks file, and the reply brought back into each comment box; the current app reads the same codes and comment', async () => {
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
  await p.waitForFunction(s => { const o = document.querySelector('dialog.cmd[open] [role="option"][aria-selected="true"]'); return o && o.textContent.includes(s); }, { timeout: 10000 }, who);
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

test('B-066: an assignment\'s views each have an address: grades/sheet opens the Grade sheet, insights/consistency opens Consistency, and examples opens Library > Examples for that assignment', async () => {
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
  await p.goto(srv.url + 'blank'); await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + '/examples');
  await p.waitForFunction(id => location.hash === '#/library/examples/a/' + encodeURIComponent(id), { timeout: 60000 }, id);
  await p.waitForSelector('[data-examples]', { timeout: 60000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});
