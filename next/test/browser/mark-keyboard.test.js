// The keyboard run on the new marking screen (stage 4 proof): opening the papers, the tools as one Tab stop with the arrow keys inside,
// a comment, the number keys for the scores and Enter to the next student, with no mouse; the current app opens the same. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
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
async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
// What has the keyboard: its name, and the set it belongs to
const focused = p => p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return { name: '' }; const g = e.closest('[data-rove]'); return { name: (e.getAttribute('aria-label') || e.title || e.textContent || '').trim(), set: g ? g.getAttribute('aria-label') : null, tag: e.tagName, cls: e.className || '' }; });
const tabTo = async (p, ok, most) => { for (let n = 1; n <= most; n++) { await p.keyboard.press('Tab'); const f = await focused(p); if (ok(f)) return n; } return 0; };

test('a keyboard run: from opening the papers to the next student with the keyboard alone, through the tools (one stop, arrows inside), a comment, the scores and Enter; the current app opens the same scores and comment', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, await zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'My summer essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'A day at the lake' }) }));
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.read && window.__mark.state().cur === 0, { timeout: 60000 });
  const key0 = await p.evaluate(() => window.__mark.state().batch.students[0].key);

  // Tab reaches the tools as one stop; the arrow keys move inside them without leaving for the next student, and Enter picks
  const toTools = await tabTo(p, f => f.set === 'Marking tools', 25);
  assert.ok(toTools > 0, 'the tools are reached with Tab');
  const t0 = await focused(p);
  await p.keyboard.press('ArrowDown');
  const t1 = await focused(p);
  assert.notEqual(t1.name, t0.name, 'the arrow moved to the next tool');
  assert.equal(await p.evaluate(() => window.__mark.state().cur), 0, 'and stayed on this student');
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(n => document.activeElement.getAttribute('aria-pressed'), t1.name), 'true', 'Enter picked it');
  // one more Tab leaves the tools for the colours, a set of its own
  await p.keyboard.press('Tab');
  const after = await focused(p);
  assert.notEqual(after.set, 'Marking tools', 'one Tab leaves the tools');

  // the comment, typed in, and Escape gives the keyboard back to the page
  assert.ok(await tabTo(p, f => f.tag === 'TEXTAREA', 30), 'the comment box is reached with Tab');
  await p.keyboard.type('A clear opening paragraph.');
  await p.keyboard.press('Escape');
  assert.equal((await focused(p)).name, '');
  // the number keys score the rows in turn, and Enter goes to the next student to score
  for (const k of ['3', '4', '2']) await p.keyboard.press(k);
  await p.waitForFunction(() => { const g = window.__mark.state().batch.students[0].grade; return (g.rubric || []).filter(v => v != null).length === 3; });
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__mark.state().cur === 1 && window.__mark.ready, { timeout: 30000 });
  const g = await p.evaluate(() => { const x = window.__mark.state().batch.students[0].grade; return { rubric: x.rubric, comment: x.comment }; });
  assert.deepEqual(g, { rubric: [3, 4, 2], comment: 'A clear opening paragraph.' });
  await p.evaluate(() => window.__mark.saved());
  await p.close();

  const c = await page(ctx, errors);
  await c.goto(srv.url); await appReady(c);
  await c.evaluate(id => window.__gs.reopenKept(id), id);
  await c.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const was = await c.evaluate(k => { const x = window.__gs.state().batch.students.find(s => s.key === k).grade; return { rubric: x.rubric, comment: x.comment }; }, key0);
  assert.deepEqual(was, g, 'the current app opens the same scores and comment');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The papers of two made-up students, opened on the new marking screen at a width; the page, once the paper and the tools are drawn.
async function openMark(ctx, errors, width = 1440) {
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, await zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'My summer essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'A day at the lake' }) }));
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  if (width !== 1440) await p.setViewport({ width, height: width < 700 ? 844 : 900 });
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.read && window.__mark.state().cur === 0, { timeout: 60000 });
  await p.waitForSelector('[data-light]', { timeout: 30000 });
  // the one-time note on what opened sits over the zoom: closed first, as she would
  if (await p.$('[data-repx]')) { await p.click('[data-repx]'); await p.waitForFunction(() => !document.querySelector('[data-repx]')); }
  return p;
}
// Things to press on the screen at rest, counted the stage 4 way: each Tab stop shown in the window (a set of choices that the arrow
// keys move inside is one stop), with the student list as one, and the one-time note on what opened closed first.
const presses = async p => { if (await p.$('[data-repx]')) { await p.click('[data-repx]'); await p.waitForFunction(() => !document.querySelector('[data-repx]')); }
  return p.evaluate(() => { const seen = new Set(), list = [];
    for (const el of document.querySelectorAll('main a[href], main button:not([disabled]), main input, main select, main textarea, main [tabindex="0"]')) {
      const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0) || el.getAttribute('tabindex') === '-1') continue;
      const one = el.closest('.mk-list') || el; if (seen.has(one)) continue; seen.add(one); list.push((el.getAttribute('aria-label') || el.textContent || el.type || '').trim().slice(0, 30)); }
    return list; }); };
test('the marking screen at rest: under 25 things to press at 1440 and at 390 px', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), n = {};
  for (const w of [1440, 390]) { const p = await openMark(ctx, errors, w), l = await presses(p); n[w] = l.length; console.log('# at ' + w + ' px: ' + l.join(' | ')); await p.close(); }
  console.log('# marking screen presses at rest: ' + JSON.stringify(n));
  for (const [w, k] of Object.entries(n)) assert.ok(k < 25, 'the marking screen has ' + k + ' presses at rest at ' + w + ' px; the brief asks for under 25');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Slice C, PR 1: the zoom, the keys and the score panel, each row of rebuild/audit/gaps.md by its ID. Made-up students only.
const zoomSay = p => p.$eval('[data-zoom0]', e => e.textContent.trim());
const curOf = p => p.evaluate(() => window.__mark.state().cur);
const gradeAt = (p, i = 0) => p.evaluate(i => window.__mark.state().batch.students[i].grade.rubric.slice(), i);
const withCtx = async run => { const errors = [], ctx = await browser.createBrowserContext(); const p = await openMark(ctx, errors); await run(p, ctx, errors); assert.deepEqual(errors, []); await ctx.close(); };
const toBody = p => p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
const menuOpen = async p => { const c = await p.$('.mk-paper canvas'), b = await c.boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height * 0.85, { button: 'right' }); await p.waitForSelector('.mk-menu'); await p.mouse.move(2, 2); };

test('C-034 Ctrl (Cmd) and the scroll wheel or a trackpad pinch zoom the paper at the pointer', () => withCtx(async p => {
  assert.equal(await zoomSay(p), '100%');
  const b = await (await p.$('.mk-paper')).boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 3);
  await p.keyboard.down('Control'); await p.mouse.wheel({ deltaY: -300 }); await p.keyboard.up('Control');
  await p.waitForFunction(() => document.querySelector('[data-zoom0]').textContent.trim() !== '100%');
  assert.ok(parseInt(await zoomSay(p), 10) > 100, 'zoomed in');
  // a plain scroll still scrolls and doesn't zoom
  const z = await zoomSay(p); await p.mouse.wheel({ deltaY: 200 }); await new Promise(r => setTimeout(r, 300));
  assert.equal(await zoomSay(p), z);
  await p.keyboard.down('Control'); await p.mouse.wheel({ deltaY: 600 }); await p.mouse.wheel({ deltaY: 600 }); await p.keyboard.up('Control');
  await p.waitForFunction(was => parseInt(document.querySelector('[data-zoom0]').textContent, 10) < parseInt(was, 10), {}, z);
}));

test('C-064 the zoom percent is a button back to 100%', () => withCtx(async p => {
  await p.click('.mk-zoom [aria-label="Zoom in"]'); await p.click('.mk-zoom [aria-label="Zoom in"]');
  await p.waitForFunction(() => document.querySelector('[data-zoom0]').textContent.trim() === '120%');
  assert.match(await p.$eval('[data-zoom0]', e => e.title), /Back to 100% \(Ctrl 0\)/);
  await p.click('[data-zoom0]');
  await p.waitForFunction(() => document.querySelector('[data-zoom0]').textContent.trim() === '100%');
}));

test('gaps item 9 (C-064): Ctrl + and Ctrl − zoom the paper and Ctrl 0 goes back to 100%', () => withCtx(async p => {
  await toBody(p);
  await p.keyboard.down('Control'); await p.keyboard.press('Equal'); await p.keyboard.up('Control');
  await p.waitForFunction(() => document.querySelector('[data-zoom0]').textContent.trim() === '110%');
  await p.keyboard.down('Control'); await p.keyboard.down('Shift'); await p.keyboard.press('Equal'); await p.keyboard.up('Shift'); await p.keyboard.up('Control');
  await p.waitForFunction(() => document.querySelector('[data-zoom0]').textContent.trim() === '120%');
  await p.keyboard.down('Control'); await p.keyboard.press('Minus'); await p.keyboard.press('Minus'); await p.keyboard.press('Minus'); await p.keyboard.up('Control');
  await p.waitForFunction(() => document.querySelector('[data-zoom0]').textContent.trim() === '90%');
  await p.keyboard.down('Control'); await p.keyboard.press('Digit0'); await p.keyboard.up('Control');
  await p.waitForFunction(() => document.querySelector('[data-zoom0]').textContent.trim() === '100%');
}));

test('C-043 in the right-click menu, Arrow Right opens the panel of the focused row and Arrow Left comes back', () => withCtx(async p => {
  await menuOpen(p);
  await p.focus('.mk-menu [data-sub="punct"]');
  await p.keyboard.press('ArrowRight');
  await p.waitForFunction(() => document.activeElement && document.activeElement.closest('.mk-fly'));
  assert.ok(await p.$('.mk-fly .st-punc'), 'the punctuation panel is open');
  await p.keyboard.press('ArrowDown');
  assert.ok(await p.evaluate(() => !!document.activeElement.closest('.mk-fly')), 'the arrows walk the panel');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.mk-fly') && document.activeElement && document.activeElement.dataset.sub === 'punct');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowRight');
  await p.waitForFunction(() => document.activeElement && document.activeElement.closest('.mk-fly .st-proofs'));
  await p.keyboard.press('ArrowLeft');
  await p.waitForFunction(() => !document.querySelector('.mk-fly') && document.activeElement.dataset.sub === 'proof');
}));

test('C-042 the right-click menu has the highlight colours', () => withCtx(async p => {
  await menuOpen(p);
  assert.equal((await p.$$('.mk-menu [data-hl-pick]')).length, 4);
  await p.click('.mk-menu [data-hl-pick="green"]');
  await p.waitForFunction(() => window.__mark.state().hlColor === 'green');
  assert.equal(await p.$eval('.mk-menu [data-hl-pick="green"]', e => e.getAttribute('aria-pressed')), 'true');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.hl'))), 'green');
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.mk-menu'));
  await p.click('[data-tool="hl"]');
  await p.waitForSelector('.mk-tools [data-sw="green"][aria-pressed="true"]');
}));

test('C-063 the highlighter has its freehand width (narrow, medium, wide), kept for next time and in the saved mark; the current app opens the same', () => withCtx(async (p, ctx, errors) => {
  await p.click('[data-tool="hl"]'); await p.waitForSelector('[data-hlw]');
  assert.equal(await p.$eval('[data-hlw="14"]', e => e.getAttribute('aria-pressed')), 'true', 'medium to start, as in the current app');
  await p.click('[data-hlm="free"]'); await p.click('[data-hlw="22"]');
  await p.waitForSelector('[data-hlw="22"][aria-pressed="true"]');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.hlW'))), 22);
  const b = await (await p.$('.mk-paper canvas')).boundingBox(), y = b.y + b.height * 0.9;
  await p.mouse.move(b.x + b.width * 0.3, y); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(b.x + b.width * (0.3 + k * 0.04), y + (k % 2)); await p.mouse.up();
  await p.waitForFunction(() => { const m = window.__mark.state().batch.students[0].files[0].marks[0] || []; return m.some(x => x.t === 'hl' && x.sw === 22); });
  await p.click('[data-hlw="8"]'); await p.waitForSelector('[data-hlw="8"][aria-pressed="true"]');
  const key = await p.evaluate(() => window.__mark.state().batch.students[0].key), id = await p.evaluate(() => window.__mark.state().batch.id);
  await p.evaluate(() => window.__mark.saved()); await p.close();
  const c = await page(ctx, errors);
  await c.goto(srv.url); await appReady(c);
  await c.evaluate(id => window.__gs.reopenKept(id), id);
  await c.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.ok(await c.evaluate(k => (window.__gs.state().batch.students.find(s => s.key === k).files[0].marks[0] || []).some(x => x.t === 'hl' && x.sw === 22), key), 'the current app has the wide highlight');
  assert.equal(await c.evaluate(() => JSON.parse(localStorage.getItem('gs.hlW'))), 8, 'and the width chosen last');
}));

test('C-046 pointing at a score shows what it means before it is given', () => withCtx(async p => {
  await p.evaluate(() => { window.__mark.state().setup.levels = [['Not yet', 'Beginning', 'Developing', 'Secure', 'Beyond']]; });
  const tick = '.mk-crit[data-row="0"] .sticks button[data-v="3"]';
  await p.hover(tick);
  await p.waitForSelector('[data-lvl="0"].peek');
  assert.equal(await p.$eval('[data-lvl="0"]', e => e.textContent), 'Secure');
  await p.hover('.mk-crit[data-row="0"] .sticks button[data-v="1"]');
  await p.waitForFunction(() => document.querySelector('[data-lvl="0"]').textContent === 'Beginning');
  await p.mouse.move(5, 5);
  await p.waitForFunction(() => !document.querySelector('[data-lvl="0"]'));
  assert.ok((await gradeAt(p)).every(v => v == null), 'pointing gives no score');
  await p.click(tick); await p.mouse.move(5, 5);
  await p.waitForFunction(() => { const e = document.querySelector('[data-lvl="0"]'); return e && e.textContent === 'Secure' && !e.classList.contains('peek'); });
}));

test('C-049 a plain Next student beside Next to score', () => withCtx(async p => {
  assert.ok(await p.$('.mk-side .foot [data-next]'), 'Next to score is there');
  await p.click('.mk-side .foot [data-next-plain]');
  await p.waitForFunction(() => window.__mark.state().cur === 1);
  assert.ok((await gradeAt(p, 0)).every(v => v == null), 'nothing was scored on the way');
}));

test('C-030 a formative panel has Next without feedback (N)', () => withCtx(async p => {
  await p.evaluate(() => { window.__mark.state().batch.assignment = { type: 'fm' }; });
  await p.click('.mk-side .foot [data-next-plain]');
  await p.waitForSelector('.mk-side .foot [data-nextfb]');
  assert.match(await p.$eval('[data-nextfb]', e => e.textContent), /Next without feedback/);
  const was = await curOf(p);
  await p.click('[data-nextfb]');
  await p.waitForFunction(was => window.__mark.state().cur !== was, {}, was);
}));

test('C-045 Delete or Backspace on a score slider clears that row', () => withCtx(async p => {
  await toBody(p);
  await p.keyboard.press('3'); await p.keyboard.press('2');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.rubric[1] != null);
  await p.focus('.mk-crit[data-row="0"] .srange'); await p.keyboard.press('Delete');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.rubric[0] == null);
  await p.focus('.mk-crit[data-row="1"] .srange'); await p.keyboard.press('Backspace');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.rubric[1] == null);
  assert.ok((await gradeAt(p)).every(v => v == null));
  assert.equal(await curOf(p), 0, 'and stays on this student');
}));

test('C-024 (kept different) from nowhere the number keys score the row in hand without Tab, and Tab walks from the top of the screen', () => withCtx(async p => {
  await toBody(p);
  await p.keyboard.press('3');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.rubric[0] === 3);
  await p.keyboard.press('2');
  await p.waitForFunction(() => window.__mark.state().batch.students[0].grade.rubric[1] === 2);
  await toBody(p);
  await p.keyboard.press('Tab');
  assert.ok(await p.evaluate(() => !document.activeElement.classList.contains('srange') && !document.activeElement.closest('.mk-side')), 'the first Tab is at the top, not in the score panel');
}));

test('C-036 Esc stops placing the score sticker', () => withCtx(async p => {
  await toBody(p);
  for (const k of ['3', '4', '2']) await p.keyboard.press(k);
  await p.waitForSelector('[data-stampscore]');
  await p.click('[data-stampscore]');
  await p.waitForFunction(() => !!window.__mark.state().scorePlacing);
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !window.__mark.state().scorePlacing);
  assert.equal(await p.evaluate(() => (window.__mark.state().batch.students[0].files[0].marks[0] || []).filter(m => m.k === 'score').length), 0, 'no sticker was placed');
}));
