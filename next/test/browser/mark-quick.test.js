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


test('D-011 Quick mark: boxes drawn and saved as one step (the score goes out of the quiz\'s points), answers marked by question and by student with clicks and keys, half points, a comment, Give the rest and Undo; the marks are on the papers and the current app opens the same', async () => {
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
  // D-011: no goals yet, so Tag questions with learning goals… opens her list; the first question then takes one
  assert.ok(!(await p.$('[data-qb] [data-qgoal]')), 'no Goal before there are goals');
  assert.match(await p.$eval('[data-qb] [data-qgoals]', e => e.textContent), /Tag questions with learning goals/);
  await p.click('[data-qb] [data-qgoals]');
  await p.waitForSelector('dialog[open] [data-goal-row="0"]');
  await p.type('dialog[open] [data-goal-row="0"]', 'Reads a map');
  await p.click('dialog[open] [data-goals-done]');
  await p.waitForSelector('[data-qb] [data-qgoal]', { timeout: 15000 });
  assert.match(await p.$eval('[data-qb] [data-qgoals]', e => e.textContent), /Edit goals/);
  const gid = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).goals[0].id);
  await p.select('[data-qb] [data-qbrow="' + q1 + '"] + tr [data-qgoal]', gid);
  await p.click('[data-qbsave]');
  await p.waitForSelector('dialog[open][data-qm] .qmc img', { timeout: 60000 });
  const su1 = await su(p);
  assert.equal(await p.evaluate(q1 => window.__mark.state().batch.quiz.qs.find(q => q.id === q1).goal, q1), gid, 'D-011: the question keeps its goal, where the current app keeps it');
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
  await p.waitForSelector('[data-esshot] canvas', { timeout: 60000 });
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

// D-053 to D-059 (src/examples.js exuBind, exuToggle, exuNames, exSaveShot): Use as an example counts the names covered, a drag on a
// page covers anything else and a click takes it off (kept with the paper's covers, so Check the covers has it too), Enter in Why it's
// strong saves; a screenshot has its own black boxes (drag, click to take off), Tags you have used as chips, and Enter saves.
test('D-053 D-054 D-055 D-056 D-057 D-058 D-059: covers drawn and taken off on Use as an example and on a screenshot, names counted, tags you have used, Enter saves; the current app reads the covers and the examples', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard()); await p.evaluate(exDbMake);
  const z = path.join(dir, 'Quiz3.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  await p.click('[data-fmenu]'); await p.waitForSelector('.pop [role^="menuitem"]');
  await menuPick(p, 'Use as an example');
  await p.waitForSelector('[data-esuse] [data-espg="0"] canvas', { timeout: 60000 });
  const named = () => p.$eval('[data-esnames]', e => (/(\d+) names? covered/.exec(e.textContent) || [])[1]).then(Number);
  await p.waitForFunction(() => /names? covered\. Drag on a page to cover anything else/.test(document.querySelector('[data-esnames]').textContent));
  const n0 = await named();
  const at = async (sel, x, y) => { const r = await p.$eval(sel, e => { e.scrollIntoView({ block: 'start' }); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }); return [r.x + x * r.w, r.y + y * r.h]; };
  const drag = async (sel, a, b) => { const [x0, y0] = await at(sel, ...a), [x1, y1] = await at(sel, ...b); await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await p.mouse.move(x1, y1, { steps: 4 }); await p.mouse.up(); };
  const click = async (sel, x, y) => { const [cx, cy] = await at(sel, x, y); await p.mouse.click(cx, cy); };
  const own = () => p.evaluate(() => Object.values((window.__mark.state().batch.share || {}).boxes || {}).reduce((n, l) => n + l.length, 0));
  // D-053: a drag covers it; D-054: the count goes up
  await drag('[data-espg="0"] canvas', [0.55, 0.25], [0.8, 0.33]);
  await p.waitForFunction(() => Object.values((window.__mark.state().batch.share || {}).boxes || {}).some(l => l.length));
  await p.waitForFunction(n => +(/(\d+) names? covered/.exec(document.querySelector('[data-esnames]').textContent) || [])[1] === n, {}, n0 + 1);
  // D-056: a click on it takes it off
  await click('[data-espg="0"] canvas', 0.67, 0.29);
  await p.waitForFunction(n => +(/(\d+) names? covered/.exec(document.querySelector('[data-esnames]').textContent) || [])[1] === n, {}, n0);
  assert.equal(await own(), 0);
  await drag('[data-espg="0"] canvas', [0.55, 0.25], [0.8, 0.33]);
  await p.waitForFunction(n => +(/(\d+) names? covered/.exec(document.querySelector('[data-esnames]').textContent) || [])[1] === n, {}, n0 + 1);
  // D-055: Enter in Why it's strong saves
  await p.type('input[data-eswhy]', 'Clear steps'); await p.keyboard.press('Enter');
  for (let i = 0; i < 150 && (await exRecs(p)).length < 1; i++) await new Promise(r => setTimeout(r, 100));
  assert.deepEqual((await exRecs(p)).map(r => [r.kind, r.why]), [['paper', 'Clear steps']]);
  await p.waitForFunction(() => !document.querySelector('[data-esuse]'));
  // a screenshot kept as a strong example: D-057 black boxes, D-059 Enter in Tags saves
  const shot = async () => { await p.click('[data-snip]'); await p.waitForSelector('[data-snipthen="ex"]'); await p.click('[data-snipthen="ex"]'); await p.click('[data-snipall]'); await p.waitForSelector('[data-esshot] canvas', { timeout: 60000 }); };
  // the picture is drawn (a white ground under it; an empty canvas is clear), so a drag lands where the picture will stay
  const drawn = () => p.waitForFunction(() => document.querySelector('[data-esshot] canvas').getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255);
  await shot();
  await drawn();
  assert.match(await p.$eval('[data-esshotn]', e => e.textContent), /^Name covers on the paper are already painted in\. Drag over anything that shows a name to black it out/);
  await drag('[data-esshotpv] canvas', [0.1, 0.1], [0.3, 0.2]);
  await p.waitForFunction(() => /^1 area blacked out\./.test(document.querySelector('[data-esshotn]').textContent));
  await drag('[data-esshotpv] canvas', [0.5, 0.5], [0.7, 0.6]);
  await p.waitForFunction(() => /^2 areas blacked out\./.test(document.querySelector('[data-esshotn]').textContent));
  await click('[data-esshotpv] canvas', 0.6, 0.55);
  await p.waitForFunction(() => /^1 area blacked out\./.test(document.querySelector('[data-esshotn]').textContent));
  assert.equal(await p.$('[data-esaddtag]'), null, 'no tags used yet');
  await p.type('input[data-estags]', 'steps'); await p.keyboard.press('Enter');
  for (let i = 0; i < 300 && (await exRecs(p)).length < 2; i++) await new Promise(r => setTimeout(r, 100));
  const first = (await exRecs(p)).find(r => r.kind === 'shot');
  assert.deepEqual([first.tags, first.watch], [['steps'], undefined]);
  await p.waitForFunction(() => !document.querySelector('[data-esshot]'));
  // D-058: the tag used is a chip that adds it; Enter in Why saves, even pressed before the picture has been read
  await shot();
  await p.waitForSelector('[data-esaddtag="steps"]');
  await p.click('[data-esaddtag="steps"]');
  assert.equal(await p.$eval('input[data-estags]', e => e.value), 'steps');
  await p.type('input[data-eswhy]', 'Labels each step'); await p.keyboard.press('Enter');
  // the covered picture is drawn and kept before the box closes, which takes longer on a busy machine
  await p.waitForFunction(() => !document.querySelector('[data-esshot]'), { timeout: 30000 });
  for (let i = 0; i < 300 && (await exRecs(p)).length < 3; i++) await new Promise(r => setTimeout(r, 100));
  const second = (await exRecs(p)).find(r => r.kind === 'shot' && r.id !== first.id);
  assert.deepEqual([second.tags, second.why, second.letter], [['steps'], 'Labels each step', '2']);
  const share = await p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().batch.share.boxes)));
  await p.evaluate(() => window.__mark.saved());
  await p.goto(srv.url + 'blank'); await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.waitForFunction(() => window.__gs.exList().length === 3, { timeout: 30000 });
  assert.deepEqual(await m.evaluate(() => window.__gs.exList().map(r => r.kind + ':' + (r.tags || []).join()).sort()), ['paper:', 'shot:steps', 'shot:steps']);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.share.boxes))), share);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// D-008 D-009 D-010 (src/quiz.js, src/examples.js exStar, exGo): Example on a Quick mark answer keeps it and shows it kept, and the
// toast's See examples closes Quick mark for the assignment's own Examples. D-018 D-019 D-020 (openExamples): the Examples tab,
// between Insights and Return once there is one: answers by question with the questions that have none yet, and the same
// assignment's examples in a linked class shown only when asked, each saying where it came from.
test('D-008 D-009 D-010 D-018 D-019 D-020: Example on a Quick mark answer, See examples to the assignment\'s Examples tab, questions with none yet, linked classes shown and hidden; the current app reads the example', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  const seed = withCard(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes[0].units[0].items.find(i => i.id === 'i9').group = 'g9';
  lib.classes[1].units.push({ id: 'u9', name: 'Unit 1: Stories', items: [{ id: 'i10', name: 'Speech', classId: 'c2', group: 'g9' }] });
  seed.ls['gs.lib'] = JSON.stringify(lib);
  await p.goto(srv.url + 'blank'); await plant(p, seed); await p.evaluate(exDbMake);
  // an example from the same assignment in the linked class
  await p.evaluate(() => new Promise((res, rej) => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 40, 30); c.toBlob(b => { const r = indexedDB.open('grading-studio-examples'); r.onsuccess = () => { const tx = r.result.transaction(['ex', 'pix'], 'readwrite'); tx.objectStore('ex').put({ id: 'tw1', t: Date.now(), kind: 'paper', work: 'w-elsewhere', asg: 'i10', cls: 'c2', title: 'Speech', q: null, row: null, why: 'Clear voice', letter: 'A', pages: [{ w: 40, h: 30 }], marks: false, score: false, from: null, who: null }, 'tw1'); tx.objectStore('pix').put(b, 'tw1|0'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }, 'image/jpeg'); }));
  const z = path.join(dir, 'Quiz4.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  const tabs = () => p.$$eval('.mk-top [role="tab"]', a => a.map(x => x.textContent));
  assert.ok((await tabs()).some(x => /^Examples/.test(x)), 'a linked class has an example: the tab shows');
  // two question boxes
  await setupDo(p, 'Quick mark');
  await p.waitForSelector('dialog[open][data-qb] [data-qbpg="0"] canvas', { timeout: 60000 });
  await box(p, 0, 0.1, 0.12, 0.6, 0.2);
  await p.waitForFunction(() => document.querySelectorAll('[data-qb] [data-qbrow]').length === 1);
  await box(p, 0, 0.1, 0.3, 0.6, 0.4);
  await p.waitForFunction(() => document.querySelectorAll('[data-qb] [data-qbrow]').length === 2);
  const q1 = await p.$eval('[data-qb] [data-qbrow]', e => e.dataset.qbrow);
  await p.click('[data-qbsave]');
  await p.waitForSelector('dialog[open][data-qm] .qmc img', { timeout: 60000 });
  // D-009 D-010: the Example button on the answer, and it shows kept
  assert.equal(await p.$eval(card(0, q1) + ' [data-ex]', b => [b.textContent, b.getAttribute('aria-pressed')].join()), 'Example,false');
  await p.click(card(0, q1) + ' [data-ex]');
  await p.waitForFunction(sel => document.querySelector(sel).getAttribute('aria-pressed') === 'true', { timeout: 30000 }, card(0, q1) + ' [data-ex]');
  assert.equal((await exRecs(p)).filter(r => r.kind === 'answer').length, 1);
  // D-008: See examples closes Quick mark and opens this assignment's Examples
  await p.waitForFunction(() => [...document.querySelectorAll('.toast button')].some(b => b.textContent === 'See examples'));
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'See examples').click());
  await p.waitForFunction(id => location.hash === '#/mark/' + id + '/examples' && !document.querySelector('[data-qm]'), { timeout: 30000 }, id);
  await p.waitForSelector('[data-asgex] .excard.answer', { timeout: 30000 });
  // D-020 D-018: answers by question, and Question 2 has none yet
  const txt = await p.$eval('[data-asgex]', e => e.textContent);
  assert.match(txt, /Answers, by question/);
  assert.match(await p.$eval('[data-exnone]', e => e.textContent), /^Question 2 has no example yet\. Press Example on an answer in Quick mark\.$/);
  assert.equal(await p.$$eval('[data-asgex] .excard[data-exid]', a => a.length), 1, 'the linked class\'s one waits to be asked for');
  // D-019: shown, with where it came from, and hidden again
  assert.equal(await p.$eval('[data-exlinked] button[data-exlk]', b => b.textContent), 'Show 1 example from Grade 10 Literature');
  await p.click('[data-exlinked] button[data-exlk]');
  await p.waitForSelector('[data-exid="tw1"] [data-exfrom]');
  assert.equal(await p.$eval('[data-exid="tw1"] [data-exfrom]', e => e.textContent), 'From Grade 10 Literature');
  await p.click('[data-exlinked] h3 [data-exlk]');
  await p.waitForFunction(() => !document.querySelector('[data-exid="tw1"]'));
  await p.evaluate(() => window.__mark.saved());
  await p.goto(srv.url + 'blank'); await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.waitForFunction(() => window.__gs.exList().length === 2, { timeout: 30000 });
  assert.deepEqual(await m.evaluate(() => window.__gs.exList().map(r => r.kind + ':' + r.asg).sort()), ['answer:i9', 'paper:i10']);
  assert.deepEqual(errors, []);
  await ctx.close();
});
