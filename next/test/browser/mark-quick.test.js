// Quick mark on the new marking screen (stage 4, b2): boxes drawn on a made-up paper quiz and saved as one undo step, then answers
// marked by question and by student, with clicks and keys, half points, a comment on the page, Give the rest and Undo; the marks go
// on the papers and the score is out of the quiz's points. The current app opens the same quiz, marks and scores. npm run next:browser.
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
const RUB = { mode: 'points', outOf: 10 };
const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20', setup: RUB }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
const twoZip = async () => zipOf({ 'Aria Testwell/Quiz.pdf': await makePaper({ title: 'A quiz' }), 'Bram Sample/Quiz.pdf': await makePaper({ title: 'Another quiz' }) });
const su = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().setup)));
const tap = (p, sel) => p.$eval(sel, e => { e.scrollIntoView({ block: 'center' }); e.click(); });
const setupDo = async (p, label) => { await p.click('[data-setupopen]'); await p.waitForFunction(l => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => e.textContent.includes(l)), {}, label); await p.evaluate(l => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => e.textContent.includes(l)).click(), label); };
const typeIn = async (p, sel, text) => { await p.$eval(sel, e => e.select()); await p.type(sel, text); };
const g = (p, i) => p.evaluate(i => { const x = window.__mark.state().batch.students[i].grade; return { q: { ...(x.q || {}) }, points: x.points }; }, i);
const qzMarks = (p, i) => p.evaluate(i => window.__mark.state().batch.students[i].files.flatMap(f => Object.values(f.marks || {}).flat()).filter(m => m.qz || m.qzn).map(m => m.qz ? m.t + ':' + m.qz : 'n:' + m.text), i);
// a drag on the page, as shares of the page's picture
async function box(p, n, x0, y0, x1, y1) {
  const r = await p.$eval('[data-qbpg="' + n + '"] canvas', e => { e.scrollIntoView({ block: 'start' }); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await p.mouse.move(r.x + x0 * r.w, r.y + y0 * r.h); await p.mouse.down();
  await p.mouse.move(r.x + (x0 + x1) / 2 * r.w, r.y + (y0 + y1) / 2 * r.h, { steps: 4 }); await p.mouse.move(r.x + x1 * r.w, r.y + y1 * r.h, { steps: 4 }); await p.mouse.up();
}
const card = (st, q) => '[data-qm] .qmc[data-st="' + st + '"][data-q="' + q + '"]';


test('Quick mark: boxes drawn and saved as one step (the score goes out of the quiz\'s points), answers marked by question and by student with clicks and keys, half points, a comment, Give the rest and Undo; the marks are on the papers and the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  const z = path.join(dir, 'Quiz.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  assert.equal(await p.$('[data-quicktop]'), null, 'no Quick mark button before the quiz has boxes');
  // Setup > Quick mark: no boxes yet, so the boxes open
  await setupDo(p, 'Quick mark');
  await p.waitForSelector('dialog[open][data-qb] [data-qbpg="0"] canvas', { timeout: 60000 });
  await box(p, 0, 0.1, 0.12, 0.6, 0.2);
  await box(p, 0, 0.1, 0.25, 0.6, 0.35);
  await p.waitForFunction(() => document.querySelectorAll('[data-qb] [data-qbrow]').length === 2);
  const [q1, q2] = await p.$$eval('[data-qb] [data-qbrow]', es => es.map(e => e.dataset.qbrow));
  assert.match(await p.$eval('[data-qbsum]', e => e.textContent), /2 questions, out of 2 points/);
  // the second is a short answer on a scale of 0 to 2, with words for each step; the first has an answer
  await typeIn(p, '[data-qbrow="' + q2 + '"] [data-qpts]', '2');
  await p.select('[data-qbrow="' + q2 + '"] [data-qkind]', 'scale');
  await p.type('[data-qbrow="' + q1 + '"] [data-qkey]', 'Paris');
  await p.waitForSelector('[data-qbwords]');
  assert.match(await p.$eval('[data-qbsum]', e => e.textContent), /out of 3 points/);
  // keys on the picked box: Ctrl D copies it below, Delete takes the copy out
  await p.click('[data-qb] [data-qbbox="' + q2 + '"] [data-qbtab]');
  await p.focus('[data-qbpages]');
  await p.keyboard.down('Control'); await p.keyboard.press('KeyD'); await p.keyboard.up('Control');
  await p.waitForFunction(() => document.querySelectorAll('[data-qb] [data-qbrow]').length === 3);
  await p.keyboard.press('Delete');
  await p.waitForFunction(() => document.querySelectorAll('[data-qb] [data-qbrow]').length === 2);
  await p.click('[data-qbsave]');
  await p.waitForSelector('dialog[open][data-qm] .qmc img', { timeout: 60000 });
  const su1 = await su(p);
  assert.equal(su1.mode, 'points'); assert.equal(+su1.outOf, 3);
  // by question: a click on the ✗ button, and a click on the other answer's picture marks it wrong too
  await p.click(card(0, q1) + ' [data-v="0"]');
  await p.waitForFunction(q => window.__mark.state().batch.students[0].grade.q[q] === 0, {}, q1);
  await p.click(card(1, q1) + ' [data-qmimg]');
  await p.waitForFunction(q => (window.__mark.state().batch.students[1].grade.q || {})[q] === 0, {}, q1);
  assert.deepEqual(await qzMarks(p, 0), ['pen:' + q1, 'pen:' + q1], 'an ✗ on the paper');
  // keys: 1 marks it right (the answer note goes away with the lost point), Ctrl Z takes it back
  await p.focus(card(1, q1));
  await p.keyboard.press('Digit1');
  await p.waitForFunction(q => window.__mark.state().batch.students[1].grade.q[q] === 1, {}, q1);
  await p.keyboard.down('Control'); await p.keyboard.press('KeyZ'); await p.keyboard.up('Control');
  await p.waitForFunction(q => window.__mark.state().batch.students[1].grade.q[q] === 0, {}, q1);
  assert.match(await p.$eval('[data-qmprog]', e => e.textContent), /2 of 2 marked/);
  // ] goes to question 2; a number gives its points, H takes half off
  await p.focus(card(0, q1));
  await p.keyboard.press(']');
  await p.waitForSelector(card(0, q2) + ' img');
  await p.focus(card(0, q2));
  await p.keyboard.press('Digit2');
  await p.waitForFunction(q => window.__mark.state().batch.students[0].grade.q[q] === 2, {}, q2);
  await p.focus(card(0, q2));
  await p.keyboard.press('KeyH');
  await p.waitForFunction(q => window.__mark.state().batch.students[0].grade.q[q] === 1.5, {}, q2);
  assert.match(await p.$eval(card(0, q2) + ' .qmchip', e => e.textContent), /1\.5 of 2/);
  // a comment on the page: C, typed, Enter
  await p.focus(card(0, q2));
  await p.keyboard.press('KeyC');
  await p.waitForSelector(card(0, q2) + ' [data-qmned] textarea');
  await p.type(card(0, q2) + ' [data-qmned] textarea', 'Say why');
  await p.keyboard.press('Enter');
  await p.waitForSelector(card(0, q2) + ' [data-qnoteline]');
  // Give the rest 2: student 2 gets full points on question 2, as one step
  await p.click('[data-qm] [data-rest]');
  await p.waitForFunction(q => window.__mark.state().batch.students[1].grade.q[q] === 2, {}, q2);
  assert.deepEqual(await g(p, 0), { q: { [q1]: 0, [q2]: 1.5 }, points: '1.5' });
  assert.deepEqual(await g(p, 1), { q: { [q1]: 0, [q2]: 2 }, points: '2' });
  // by student: the total, and the student's own cards
  await p.click('[data-qm] [role="radio"][data-v="s"]');
  await p.waitForSelector('[data-qmtot]');
  assert.match(await p.$eval('[data-qmtot]', e => e.textContent), /1\.5 \/ 3 = 50%/);
  assert.ok((await qzMarks(p, 0)).includes('n:Say why'), 'the comment is on the paper');
  // Boxes from Quick mark, and Cancel leaves them as they were
  await p.click('[data-qm] [data-boxes]');
  await p.waitForSelector('dialog[open][data-qb] [data-qbpg="0"] canvas', { timeout: 60000 });
  assert.equal(await p.$$eval('[data-qb] [data-qbrow]', es => es.length), 2);
  await p.click('[data-qbcancel]');
  await p.waitForFunction(() => !document.querySelector('[data-qb]'));
  await p.click('[data-quicktop]');
  await p.waitForSelector('dialog[open][data-qm] .qmc img', { timeout: 60000 });
  await p.click('[data-qmclose]');
  await p.waitForSelector('[data-quicktop]');
  // the boxes are one step: Undo takes the quiz and the points back
  await p.evaluate(() => window.__mark.saved());
  const work = await p.evaluate(() => { const b = window.__mark.state().batch; return { quiz: JSON.parse(JSON.stringify(b.quiz)), marks: b.students.map(s => s.files.map(f => JSON.parse(JSON.stringify(f.marks || {})))), g: b.students.map(s => ({ q: s.grade.q, points: s.grade.points })) }; });
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const theirs = await m.evaluate(() => { const b = window.__gs.state().batch; return { quiz: JSON.parse(JSON.stringify(b.quiz)), marks: b.students.map(s => s.files.map(f => JSON.parse(JSON.stringify(f.marks || {})))), g: b.students.map(s => ({ q: s.grade.q, points: s.grade.points })) }; });
  assert.deepEqual(theirs, work);
  assert.equal(await m.evaluate(() => window.__gs.quizSum(window.__gs.state().batch.students[0])), 1.5);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Quick mark in an MYP class: each question\'s criterion, the points that earn each level (Spread evenly), the criteria added to the task as they are used, and the levels given as the answers are marked; the current app opens the same', async () => {
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
  await setupDo(p, 'Quick mark');
  await p.waitForSelector('dialog[open][data-qb] [data-qbpg="0"] canvas', { timeout: 60000 });
  await box(p, 0, 0.1, 0.12, 0.6, 0.2);
  await p.waitForSelector('[data-qb] [data-qbrow]');
  const q1 = await p.$eval('[data-qb] [data-qbrow]', e => e.dataset.qbrow);
  await typeIn(p, '[data-qbrow="' + q1 + '"] [data-qpts]', '8');
  await p.waitForSelector('[data-qb] [data-qib]');
  await p.select('[data-qb] [data-qib]', 'B');
  await p.waitForSelector('[data-qblv] [data-ibqk="B"]');
  await p.click('[data-qblv] [data-ibqeven="B"]');
  await p.waitForFunction(() => document.querySelector('[data-ibqk="B"] [data-ibql="7"]').value === '8');
  await p.click('[data-qbsave]');
  await p.waitForSelector('dialog[open][data-qm] .qmc img', { timeout: 60000 });
  assert.deepEqual((await su(p)).ib, ['B'], 'criterion B is added to the task');
  await p.focus(card(0, q1));
  await p.keyboard.press('Digit6');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.rubric[0] === 6);
  await p.click('[data-qm] [role="radio"][data-v="s"]');
  await p.waitForFunction(() => /B 6 \/ 8, level 6/.test(document.querySelector('[data-qmtot]').textContent));
  await p.click('[data-qmclose]');
  await p.evaluate(() => window.__mark.saved());
  const lvb = await p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().batch.quiz.lvb)));
  assert.deepEqual(lvb, { B: [1, 2, 3, 4, 5, 6, 7, 8] });
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.quiz.lvb))), lvb);
  assert.deepEqual(await m.evaluate(() => window.__gs.state().batch.students[0].grade.rubric.slice()), [6]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The examples database as the current app makes it on its first save (the new app reads and writes it, never makes it).
const exDbMake = () => new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples', 1); r.onupgradeneeded = () => { r.result.createObjectStore('ex'); r.result.createObjectStore('pix'); }; r.onsuccess = () => { r.result.close(); res(); }; r.onerror = () => rej(r.error); });
const exRecs = p => p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples'); r.onsuccess = () => { const tx = r.result.transaction('ex'), q = tx.objectStore('ex').getAll(); q.onsuccess = () => { r.result.close(); res(q.result.filter(x => !x.gone)); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }));
const menuPick = (p, text) => p.evaluate(t => { const b = [...document.querySelectorAll('.pop [role^="menuitem"]')].find(x => x.textContent.includes(t)); if (!b) throw new Error('no menu item ' + t); b.click(); }, text);

test('Strong examples from the marking screen: E keeps a Quick mark answer and takes it back, a whole paper and part of a page kept with Use as an example, Make again from Library > Examples, and a screenshot kept on the watch list; the current app reads them all', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard()); await p.evaluate(exDbMake);
  const z = path.join(dir, 'Quiz2.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  // one question box, then E on the first student's answer
  await setupDo(p, 'Quick mark');
  await p.waitForSelector('dialog[open][data-qb] [data-qbpg="0"] canvas', { timeout: 60000 });
  await box(p, 0, 0.1, 0.12, 0.6, 0.2);
  await p.waitForFunction(() => document.querySelectorAll('[data-qb] [data-qbrow]').length === 1);
  const q1 = await p.$eval('[data-qb] [data-qbrow]', e => e.dataset.qbrow);
  await p.click('[data-qbsave]');
  await p.waitForSelector('dialog[open][data-qm] .qmc img', { timeout: 60000 });
  await p.focus(card(0, q1)); await p.keyboard.press('KeyE');
  await p.waitForFunction(async () => true);
  for (let i = 0; i < 100 && (await exRecs(p)).length < 1; i++) await new Promise(r => setTimeout(r, 100));
  let recs = await exRecs(p);
  assert.equal(recs.length, 1);
  assert.deepEqual([recs[0].kind, recs[0].work, recs[0].asg, recs[0].cls, recs[0].q.id, recs[0].q.lab, recs[0].who && recs[0].who.c], ['answer', id, 'i9', 'c1', q1, '1', 'c1']);
  // E again takes it back
  await p.focus(card(0, q1)); await p.keyboard.press('KeyE');
  for (let i = 0; i < 100 && (await exRecs(p)).length; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal((await exRecs(p)).length, 0);
  await p.click('[data-qmclose]'); await p.waitForSelector('[data-quicktop]');
  // Use as an example from the paper's ⋯: the whole paper, with the marks
  await p.click('[data-fmenu]'); await p.waitForSelector('.pop [role^="menuitem"]');
  await menuPick(p, 'Use as an example');
  await p.waitForSelector('[data-esuse] [data-espg="0"] canvas', { timeout: 60000 });
  await p.click('[data-essw="marks"] [role="switch"]');
  await p.type('[data-eswhy] input, input[data-eswhy]', 'Neat working');
  await p.click('[data-essave]');
  for (let i = 0; i < 150 && (await exRecs(p)).length < 1; i++) await new Promise(r => setTimeout(r, 100));
  recs = await exRecs(p);
  assert.deepEqual(recs.map(r => [r.kind, r.letter, r.why, r.marks, r.pages.length]), [['paper', 'A', 'Neat working', true, 1]]);
  // part of a page
  await p.click('[data-fmenu]'); await p.waitForSelector('.pop [role^="menuitem"]');
  await menuPick(p, 'Use as an example');
  await p.waitForSelector('[data-esuse] [data-espg="0"] canvas', { timeout: 60000 });
  await p.click('[data-esuse] [role="radio"][data-v="part"]');
  const r = await p.$eval('[data-espg="0"]', e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await p.mouse.move(r.x + r.w * 0.1, r.y + r.h * 0.1); await p.mouse.down(); await p.mouse.move(r.x + r.w * 0.5, r.y + r.h * 0.3, { steps: 4 }); await p.mouse.up();
  await p.waitForSelector('[data-espg="0"] .escrop');
  await p.click('[data-essave]');
  for (let i = 0; i < 150 && (await exRecs(p)).length < 2; i++) await new Promise(r => setTimeout(r, 100));
  recs = await exRecs(p);
  const part = recs.find(x => x.kind === 'part');
  assert.ok(part && part.pages[0].w > 100 && part.pages[0].h > 50, 'part of a page kept');
  // a screenshot on the watch list
  await p.click('[data-snip]'); await p.waitForSelector('[data-snipthen="wl"]');
  await p.click('[data-snipthen="wl"]');
  await p.click('[data-snipall]');
  await p.waitForSelector('[data-esshot] img', { timeout: 60000 });
  await p.type('input[data-eswhy]', 'Mixes up the steps');
  await p.click('[data-esshot-save]');
  for (let i = 0; i < 150 && (await exRecs(p)).length < 3; i++) await new Promise(r => setTimeout(r, 100));
  recs = await exRecs(p);
  const wl = recs.find(x => x.watch);
  assert.deepEqual(wl && [wl.kind, wl.letter, wl.why, wl.work, wl.who && wl.who.c], ['shot', '1', 'Mixes up the steps', id, 'c1']);
  // Make again from Library > Examples, while the download is open: Example A without the marks now
  await p.evaluate(() => { location.hash = '#/library/examples'; });
  const paper = recs.find(x => x.kind === 'paper');
  await p.waitForSelector('[data-exid="' + paper.id + '"] [data-exmenu]', { timeout: 60000 });
  await p.click('[data-exid="' + paper.id + '"] [data-exmenu]'); await p.waitForSelector('.pop [role^="menuitem"]');
  await menuPick(p, 'Make again from the paper');
  await p.waitForSelector('[data-esuse] [data-espg="0"] canvas', { timeout: 60000 });
  await p.click('[data-essw="marks"] [role="switch"]');
  await p.click('[data-essave]');
  for (let i = 0; i < 150 && ((await exRecs(p)).find(x => x.id === paper.id) || {}).marks !== false; i++) await new Promise(r => setTimeout(r, 100));
  const again = (await exRecs(p)).find(x => x.id === paper.id);
  assert.deepEqual([again.letter, again.why, again.marks], ['A', 'Neat working', false]);
  // the current app reads them
  await p.goto(srv.url + 'blank'); await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.waitForFunction(() => window.__gs.exList().length === 2 && window.__gs.exWatch().length === 1, { timeout: 30000 });
  assert.deepEqual(await m.evaluate(() => window.__gs.exList().map(r => r.kind).sort()), ['paper', 'part']);
  assert.deepEqual(errors, []);
  await ctx.close();
});
