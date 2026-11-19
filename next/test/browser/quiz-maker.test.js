// Make a quiz on the new class page (stage 4, rows 351-354): questions typed in, the printed pages beside them, saved on the
// assignment with the Quick mark boxes measured from the pages; the current app measures the same. npm run next:browser.
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
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}

const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20' }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
const itemOf = p => p.evaluate(() => { for (const c of JSON.parse(localStorage.getItem('gs.lib')).classes) for (const u of c.units) { const it = u.items.find(i => i.id === 'i9'); if (it) return it; } return null; });
const pickItem = async (p, trigger, re) => {
  await p.click(trigger);
  await p.waitForFunction(re => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => new RegExp(re).test(e.textContent)), {}, re);
  await p.evaluate(re => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => new RegExp(re).test(e.textContent)).click(), re);
};
const typeIn = async (p, sel, text) => { await p.$eval(sel, e => { e.scrollIntoView({ block: 'center' }); e.select(); }); await p.type(sel, text); };
const tap = (p, sel) => p.$eval(sel, e => { e.scrollIntoView({ block: 'center' }); e.click(); });
const sum = p => p.$eval('[data-qfsum]', e => e.textContent);

test('Make a quiz from the class page: questions typed in with their right answers and points, the printed pages beside them, saved on the assignment with its Quick mark boxes; Edit the quiz opens it again, and the current app measures the same boxes', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-more-for="i9"]', { timeout: 60000 });
  await pickItem(p, '[data-more-for="i9"]', '^Make a quiz');
  await p.waitForSelector('dialog[open][data-qf] [data-qfc="3"]');
  assert.match(await sum(p), /^4 questions, 5 points · 1 pages each · 3 scored by the scan, 1 marked by you/);
  assert.equal(await p.$$eval('[data-qfpages] .qfpage', l => l.length), 1, 'the printed page is shown beside the questions');

  // question 1: words, choices and B as the right answer
  await typeIn(p, '[data-qfc="0"] [data-qx]', 'Which planet is closest to the sun?');
  for (const [k, w] of ['Venus', 'Mercury', 'Mars', 'Earth'].entries()) await typeIn(p, `[data-qfc="0"] [data-qo="${k}"]`, w);
  await tap(p, '[data-qfc="0"] [data-qk="B"]');
  // question 2: a choice taken out moves the right answer with it
  await typeIn(p, '[data-qfc="1"] [data-qx]', 'Pick the gas giant.');
  await tap(p, '[data-qfc="1"] [data-qk="D"]');
  await tap(p, '[data-qfc="1"] [data-qod="0"]');
  assert.equal(await p.$eval('[data-qfc="1"] [data-qk].on', e => e.textContent), 'C');
  // question 3: true or false; question 4: short answer worth 2
  await typeIn(p, '[data-qfc="2"] [data-qx]', 'The moon makes its own light.');
  await tap(p, '[data-qfc="2"] [data-qk="F"]');
  await typeIn(p, '[data-qfc="3"] [data-qx]', 'Why do we have seasons?');
  // points that start with 0 are kept as typed until she leaves the box (a save per key made "0" a 1, so 0.5 became 15)
  await typeIn(p, '[data-qfc="3"] [data-qp]', '0.5'); await p.keyboard.press('Tab');
  assert.equal(await p.$eval('[data-qfc="3"] [data-qp]', e => e.value), '0.5');
  await typeIn(p, '[data-qfc="3"] [data-qp]', '2'); await p.keyboard.press('Tab');
  // a new question, pick all that apply: A and C
  await tap(p, '[data-qnew="ms"]');
  await p.waitForSelector('[data-qfc="4"]');
  await typeIn(p, '[data-qfc="4"] [data-qx]', 'Which are planets?');
  await tap(p, '[data-qfc="4"] [data-qk="C"]'); await tap(p, '[data-qfc="4"] [data-qk="A"]');
  assert.match(await p.$eval('[data-qfc="4"] .qfopts > p', e => e.textContent), /Right answers: A, C/);
  // moved up above the short answer
  await tap(p, '[data-qfc="4"] [data-qup]');
  assert.match(await p.$eval('[data-qfc="3"] [data-qx]', e => e.value), /Which are planets/);
  assert.match(await sum(p), /^5 questions, 6 points · \d pages each · 4 scored by the scan, 1 marked by you/);
  await p.click('[data-qfsave]');
  await p.waitForFunction(() => !document.querySelector('dialog[open][data-qf]'));
  await p.waitForFunction(() => /Quiz saved/.test(document.body.textContent));

  const it = await itemOf(p), m = it.quiz.made;
  assert.deepEqual(m.items.map(q => [q.t, q.key || '', q.pts]), [['mc', 'B', 1], ['mc', 'C', 1], ['tf', 'F', 1], ['ms', 'AC', 1], ['sa', '', 2]]);
  assert.deepEqual(m.items[0].opts, ['Venus', 'Mercury', 'Mars', 'Earth']);
  assert.deepEqual(it.quiz.qs.map(q => [q.lab, q.kind, q.pts, q.auto.t, q.key]), [['1', 'rw', 1, 'mc', 'B: Mercury'], ['2', 'rw', 1, 'mc', 'C'], ['3', 'rw', 1, 'tf', 'False'], ['4', 'rw', 1, 'ms', 'A, C'], ['5', 'scale', 2, 'sa', '']]);
  assert.ok(it.quiz.qs.every(q => q.w > 0 && q.h > 0 && q.auto.b.length), 'every question has a box and bubbles');

  // Edit the quiz: the same questions come back
  await pickItem(p, '[data-more-for="i9"]', '^Edit the quiz');
  await p.waitForSelector('dialog[open][data-qf] [data-qfc="4"]');
  assert.match(await p.$eval('dialog[open][data-qf] h2', e => e.textContent), /Edit the quiz/);
  assert.match(await p.$eval('[data-qfc="0"] [data-qx]', e => e.value), /closest to the sun/);
  await p.click('[data-qfcancel]');
  await p.waitForFunction(() => !document.querySelector('dialog[open][data-qf]'));
  await p.close();

  // the current app reads the same quiz, and its own measuring gives the same boxes
  const c = await page(ctx, errors);
  await c.goto(srv.url); await appReady(c);
  const same = await c.evaluate(() => { let it; for (const cl of window.__gs.state().lib.classes) for (const u of cl.units) it = it || u.items.find(i => i.id === 'i9'); const m = JSON.parse(JSON.stringify(it.quiz.made)); const { made, ...had } = it.quiz; const mine = window.__gs.qmkBoxes(m, it.name); return { had: JSON.parse(JSON.stringify(had)), mine: JSON.parse(JSON.stringify(mine)) }; });
  assert.deepEqual(same.had, same.mine);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Reading the scan back: the current app's own quiz test, on the new app. Six questions on two pages, three made-up students'
// copies filled in, drawn as scans (one upside down, one shrunk and tilted) in a muddled order.
const ITEMS = [
  { id: 'q1', t: 'mc', text: 'Which word means having more than one meaning?', opts: ['ambiguous', 'concise', 'vivid', 'formal'], key: 'A', pts: 1 },
  { id: 'q2', t: 'mc', text: 'A writer who appeals to feelings uses…', opts: ['logos', 'ethos', 'pathos', 'kairos'], key: 'C', pts: 1 },
  { id: 'q3', t: 'tf', text: 'Concise writing uses more words than it needs.', opts: ['True', 'False'], key: 'F', pts: 1 },
  { id: 'q4', t: 'ms', text: 'Which of these are words of persuasion?', opts: ['rhetoric', 'thesis', 'appeal', 'margin'], key: 'AC', pts: 2 },
  { id: 'q5', t: 'sa', text: 'Use vivid in a sentence.', opts: [], key: '', pts: 2, lines: 24 },
  { id: 'q6', t: 'mc', text: 'Which is a claim?', opts: ['a fact', 'an opinion to argue', 'a quote', 'a source'], key: 'B', pts: 1 },
];
const { PDFDocument } = require('pdf-lib');
test('Bring in the scanned quiz: the code on each page gives it to its student, the bubbles are read when the papers open and the clear ones scored, and Quiz scan asks about the rest, one step, with Ctrl Z', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  // the quiz is made and printed in the current app (the same engine), for the class's roster
  const c = await page(ctx, errors);
  await c.goto(srv.url + 'blank'); await plant(c, withCard());
  await c.goto(srv.url); await appReady(c);
  const names = await c.evaluate(ITEMS => {
    const G = window.__gs, it = G.findItem('i9').it, names = G.state().lib.classes[0].names.slice();
    const m = { id: 77, items: JSON.parse(JSON.stringify(ITEMS)), sheet: 0, blank: 1, names };
    const Q = G.qmkBoxes(m, it.name); m.pv = m.ver; m.lay = JSON.stringify(Q.qs.map(q => [q.n, q.auto.b]));
    it.quiz = { ...Q, made: m }; G.saveLib(); return names.slice(0, 3);
  }, ITEMS);
  const fills = [
    { 0: { 0: 'f' }, 1: { 2: 'f' }, 2: { 1: 'f' }, 3: { 0: 'f', 2: 'f' }, 4: { 2: 'f' }, 5: { 1: 'f' } },
    { 0: { 1: 'f' }, 1: { 0: 'x', 2: 'f' }, 2: { 0: 'f' }, 3: { 0: 'f' }, 5: { 1: 'faint' } },
    { 0: { 0: 'f', 3: 'f' }, 1: { 2: 'f' }, 3: { 0: 'f', 2: 'f' }, 4: { 1: 'f' }, 5: { 1: 'f' } },
  ];
  const html = await c.evaluate((names, fills) => { const G = window.__gs, it = G.findItem('i9').it, m = it.quiz.made; return names.map((n, k) => G.qmkPages({ ...m, fill: fills[k] }, it.name, n, k + 1)); }, names, fills);
  const css = await c.evaluate(() => [...document.styleSheets].map(s => { try { return [...s.cssRules].filter(r => r instanceof CSSFontFaceRule || /\.qf/.test(r.cssText)).map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n'));
  await c.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units.some(u => u.items.some(i => i.id === 'i9' && i.quiz)));
  const looks = { '1:0': 'rotate(180deg)', '2:0': 'scale(.94) rotate(1.2deg)' }, shots = [];
  const d = await ctx.newPage(); await d.setViewport({ width: 900, height: 1150, deviceScaleFactor: 1.4 });
  for (const [k, pages] of html.entries()) for (const [n, h] of pages.entries()) {
    await d.setContent('<!doctype html><style>' + css + 'body{margin:0;background:#fff}.qfpage{box-shadow:none;transform:' + (looks[k + ':' + n] || 'none') + ';transform-origin:50% 50%}#w{width:816px;height:1056px;overflow:hidden;background:#fff}</style><div id="w">' + h + '</div>');
    await d.evaluate(() => document.fonts.ready);
    shots.push(await (await d.$('#w')).screenshot({ type: 'png' }));
  }
  await d.close(); await c.close();
  assert.equal(shots.length, 6, 'two pages each');
  const doc = await PDFDocument.create();
  for (const i of [1, 5, 3, 0, 4, 2]) { const im = await doc.embedPng(shots[i]), pg = doc.addPage([612, 792]); pg.drawImage(im, { x: 0, y: 0, width: 612, height: 792 }); }
  const file = path.join(dir, 'Stack.pdf'); fs.writeFileSync(file, Buffer.from(await doc.save()));

  // the new class page: More > Bring in the scanned quiz…
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-more-for="i9"]', { timeout: 60000 });
  await p.click('[data-more-for="i9"]');
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => /Bring in the scanned quiz/.test(e.textContent)));
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /Bring in the scanned quiz/.test(e.textContent)).click())]);
  await chooser.accept([file]);
  await p.waitForSelector('.mk-split');
  await p.waitForFunction(() => window.__split && window.__split().thumbs.filter(Boolean).length === 6 && Object.keys(window.__split().qpg || {}).length === 6, { timeout: 90000 });
  const sp = await p.evaluate(() => ({ owner: window.__split().owner, rot: window.__split().rot, qpg: window.__split().qpg }));
  assert.deepEqual(sp.owner, [names[0], names[2], names[1], names[0], names[2], names[1]]);
  assert.deepEqual(sp.qpg, { 0: 1, 1: 1, 2: 1, 3: 0, 4: 0, 5: 0 });
  assert.equal(sp.rot[5], 180, 'the upside-down page is turned');
  assert.match(await p.$eval('.mk-split', e => e.textContent), /6 pages of this quiz: 3 found by the code\./);

  // the papers open and the bubbles are read
  await p.click('[data-spgo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 90000 });
  await p.waitForFunction(() => { const b = window.__mark.state().batch; return b && b.quiz && b.quiz.lastRead; }, { timeout: 90000 });
  const got = await p.evaluate(() => { const b = window.__mark.state().batch; return { q: Object.fromEntries(b.students.map(s => [s.key, s.grade.q || {}])), qa: Object.fromEntries(b.students.map(s => [s.key, s.grade.qa || {}])), pts: Object.fromEntries(b.students.map(s => [s.key, s.grade.points])), look: b.quiz.look, read: b.quiz.lastRead }; });
  assert.deepEqual(got.q[names[0]], { q1: 1, q2: 1, q3: 1, q4: 2, q5: 2, q6: 1 }, JSON.stringify(got));
  assert.equal(String(got.pts[names[0]]), '8');
  assert.deepEqual(got.qa[names[1]], { q1: 'B', q3: 'T', q4: 'A' });
  assert.deepEqual(got.q[names[1]], { q1: 0, q3: 0, q4: 0 });
  assert.deepEqual(got.q[names[2]], { q2: 1, q3: 0, q4: 2, q5: 1, q6: 1 }, 'a question left blank scores 0');
  const look = Object.fromEntries((got.look || []).map(l => [l.s + ' ' + l.q, l.why + ' ' + l.guess]));
  assert.deepEqual(look, { [names[1] + ' q2']: 'Another bubble marked C', [names[1] + ' q6']: 'Very light B', [names[2] + ' q1']: 'Two bubbles filled ' }, JSON.stringify(got.look));
  assert.equal(got.read.seen, 3);

  // Quiz scan opens with what needs her: one pick, Save scores, Ctrl Z
  await p.waitForSelector('dialog[open][data-qr] [data-qrrow]', { timeout: 30000 });
  assert.equal(await p.$$eval('[data-qr] [data-qrrow]', r => r.length), 3);
  const row = await p.evaluate(n => [...document.querySelectorAll('[data-qr] [data-qrrow]')].findIndex(r => r.textContent.includes(n) && /Question 6/.test(r.textContent)), names[1]);
  assert.ok(row >= 0);
  await p.click(`[data-qr] [data-qrrow="${row}"] [data-ans="B"]`);
  await p.click('[data-qr] [data-qrdone]');
  await p.waitForFunction(n => window.__mark.state().batch.students.find(s => s.key === n).grade.q.q6 === 1, { polling: 200, timeout: 20000 }, names[1]);
  const after = await p.evaluate(n => { const b = window.__mark.state().batch, s = b.students.find(x => x.key === n); return { q2: s.grade.q.q2, look: (b.quiz.look || []).map(l => l.q) }; }, names[1]);
  assert.equal(after.q2, 1, 'the guess was already picked for the crossed-out one');
  assert.deepEqual(after.look, ['q1'], 'the double fill is still waiting');
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForFunction(n => window.__mark.state().batch.students.find(s => s.key === n).grade.q.q6 == null, { polling: 200, timeout: 10000 }, names[1]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// A quiz's words are on its pages, so another language moves its bubbles. Copies printed in English (here by the current app, whose
// printed quiz is always English) keep their bubbles when the quiz is saved again from the new app in Chinese, whose shorter
// instructions take one line where the English takes two; a quiz not printed yet is laid out in the language on screen.
test('a printed quiz keeps the language it was printed in: saved again in another language, its bubbles stay where the copies have them', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const seed = withCard(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes[0].units[0].items.push({ id: 'i8', name: 'Speech draft', classId: 'c1', type: 'sum', due: '2026-11-21' });
  seed.ls['gs.lib'] = JSON.stringify(lib);
  const c = await page(ctx, errors);
  await c.goto(srv.url + 'blank'); await plant(c, seed);
  await c.goto(srv.url); await appReady(c);
  // the same three questions on both cards, measured and printed by the current app on i9, only measured on i8
  await c.evaluate(() => {
    const items = [{ id: 'mq1', t: 'mc', text: 'Which planet is closest to the sun?', opts: ['Venus', 'Mercury', 'Mars', 'Earth'], key: 'B', pts: 1 }, { id: 'mq2', t: 'tf', text: 'The moon makes its own light.', opts: ['True', 'False'], key: 'F', pts: 1 }, { id: 'mq3', t: 'sa', text: 'Why do we have seasons?', opts: [], key: '', pts: 2, lines: 3 }];
    const l = JSON.parse(localStorage.getItem('gs.lib')), all = l.classes[0].units[0].items;
    for (const [id, printed] of [['i9', true], ['i8', false]]) {
      const it = all.find(x => x.id === id), m = { id: 7, items: JSON.parse(JSON.stringify(items)), sheet: 0, blank: 0 };
      const Q = window.__gs.qmkBoxes(m, it.name);
      if (printed) { m.names = []; m.pv = m.ver; m.lay = JSON.stringify(Q.qs.map(q => [q.n, q.auto.b])); }
      it.quiz = { ...Q, made: m };
    }
    localStorage.setItem('gs.lib', JSON.stringify(l));
    localStorage.setItem('gs.lang', JSON.stringify('zh-Hans'));
  });
  const was = Object.fromEntries(await c.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units[0].items.filter(x => x.quiz).map(x => [x.id, x.quiz.qs.map(q => [q.n, q.y, q.auto.b])])));
  await c.close();
  const ZH = require('../../tools/lang-areas.js').readLang('zh-Hans'), howZh = ZH['engine.qf_how'].slice(0, 8);
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/class/c1/work');
  for (const id of ['i9', 'i8']) {
    await p.waitForSelector(`[data-more-for="${id}"]`, { timeout: 60000 });
    await pickItem(p, `[data-more-for="${id}"]`, '^' + ZH['setup.qf_edit'].replace('…', ''));
    await p.waitForSelector('dialog[open][data-qf] [data-qfc="2"]');
    if (id === 'i9') await p.waitForFunction(() => /Fill each bubble/.test(document.querySelector('[data-qfpages]').textContent), { timeout: 10000 });
    else assert.ok((await p.$eval('[data-qfpages]', e => e.textContent)).includes(howZh), 'a quiz not printed yet shows its pages in the language on screen');
    await p.click('[data-qfsave]');
    await p.waitForFunction(() => !document.querySelector('dialog[open][data-qf]'));
  }
  const now = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).classes[0].units[0].items.filter(x => x.quiz).map(x => [x.id, x.quiz.qs.map(q => [q.n, q.y, q.auto.b]), x.quiz.made]));
  const nine = now.find(x => x[0] === 'i9'), eight = now.find(x => x[0] === 'i8');
  assert.deepEqual(nine[1], was.i9, 'the printed quiz’s bubbles stay where the copies have them');
  assert.equal(nine[2].ver, 0, 'and its copies are still read by the scan (the same number)');
  assert.equal(nine[2].lang || 'en', 'en');
  assert.notDeepEqual(eight[1], was.i8, 'in Chinese the same questions sit elsewhere on the page');
  assert.deepEqual(errors, []);
  await ctx.close();
});
