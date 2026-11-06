// Quick mark, more control: overlapping boxes, moving a box, where each mark goes (for a question, and on one paper only),
// three ways to mark, answer sizes, the Not marked filter, the whole page and undo. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({
    'Ann Example/Quiz scan.pdf': await makePaper({ title: 'Ann Example quiz', pages: 1 }),
    'Ben Specimen/Quiz scan.pdf': await makePaper({ title: 'Ben Specimen quiz', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

const pageBox = (page, n) => page.$eval('.qbpg[data-n="' + n + '"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
async function dragOn(page, n, a, b) {
  await page.waitForSelector('.qbpg[data-n="' + n + '"] canvas');
  const r = await pageBox(page, n);
  await page.mouse.move(r.x + a[0] * r.w, r.y + a[1] * r.h); await page.mouse.down();
  await page.mouse.move(r.x + b[0] * r.w, r.y + b[1] * r.h, { steps: 6 }); await page.mouse.up();
}
const quiz = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.quiz)));
const marksOf = (page, i) => page.evaluate(i => {
  const st = window.__gs.state().batch.students[i];
  return st.files.flatMap(f => Object.values(f.marks).flat()).filter(m => m.qz && m.qz !== 'total').map(m => ({ t: m.t, text: m.text, x: m.x != null ? m.x : m.pts[0][0], y: m.y != null ? m.y : m.pts[0][1] }));
}, i);
const setVal = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); e.dispatchEvent(new Event('input', { bubbles: true })); }, v);

test('boxes can overlap and move; each question has its own way of marking and its own mark spot', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await dragOn(page, 0, [0.1, 0.1], [0.6, 0.2]);
  // A second box started inside the first one is a new box, not a click on the first.
  await dragOn(page, 0, [0.3, 0.15], [0.8, 0.3]);
  let Q = await page.$$eval('.qbt tbody tr', r => r.length);
  assert.equal(Q, 2, 'two overlapping boxes');
  assert.equal(await page.$eval('.qbt tbody tr:nth-child(1) .qhow', e => e.value), 'x', 'new boxes mark an ✗ on wrong ones by default');
  // Its number tab moves the second box down a little.
  const r = await pageBox(page, 0);
  const tab = await page.$eval('.qbbox.on>span', e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(tab.x, tab.y); await page.mouse.down();
  await page.mouse.move(tab.x, tab.y + 0.1 * r.h, { steps: 5 }); await page.mouse.up();
  const moved = await page.$eval('.qbbox.on', e => parseFloat(e.style.top));
  assert.ok(moved > 22 && moved < 28, 'the picked box moved down: ' + moved);
  // A corner resizes it.
  const h = await page.$eval('.qbbox.on .qbh.se', e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x + 0.05 * r.w, h.y, { steps: 4 }); await page.mouse.up();
  assert.equal(await page.$$eval('.qbt tbody tr', r => r.length), 2, 'resizing makes no new box');
  // Question 1: check and ✗, with its mark at a spot she picks. Question 2: points.
  await setVal(page, '.qbt tbody tr:nth-child(1) .qhow', 'cx');
  await setVal(page, '.qbt tbody tr:nth-child(2) .qhow', 'pts');
  await page.focus('.qbt tbody tr:nth-child(1) .qkey');
  await page.click('[data-spot]');
  await page.mouse.click(r.x + 0.9 * r.w, r.y + 0.15 * r.h);
  await page.waitForSelector('[data-margin]');
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  Q = await quiz(page);
  assert.equal(Q.qs[0].how, 'cx'); assert.equal(Q.qs[1].how, 'pts');
  assert.ok(Math.abs(Q.qs[0].mx - 0.9) < 0.01 && Math.abs(Q.qs[0].my - 0.15) < 0.01, 'her spot is kept: ' + Q.qs[0].mx + ',' + Q.qs[0].my);
  assert.ok(Q.qs[1].y > 0.22 && Q.qs[1].w > 0.52, 'the move and the resize are kept');
  // Question 1: Ann right (a check at her spot), Ben wrong (an ✗ at the same spot).
  await page.click('#qmBody .qmc[data-st="0"] button[data-v="1"]');
  await page.click('#qmBody .qmc[data-st="1"] button[data-v="0"]');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"]').classList.contains('wrong'));
  const W = await page.evaluate(() => { const st = window.__gs.state().batch.students[0], q = window.__gs.state().batch.quiz.qs[0]; return window.__gs.qzSpot(st, q).x; });
  const a = await marksOf(page, 0), b = await marksOf(page, 1);
  assert.equal(a.length, 1); assert.equal(a[0].t, 'check');
  assert.equal(b.length, 2); assert.equal(b[0].t, 'pen');
  assert.ok(Math.abs(W - 0.9) < 0.01);
  assert.ok(a[0].x > 500, 'the check sits at her spot, far right: ' + a[0].x);
  assert.equal(await page.$eval('#qmBody .qmc[data-st="0"] .qmmk', e => e.textContent), '✓', 'the card shows the mark as it goes on the paper');
  // Question 2 is in points: "1/1" and "0/1" go on the paper, and a click on the answer doesn't mark it.
  await page.keyboard.press(']');
  await page.waitForFunction(() => /Question 2/.test(document.querySelector('#qmPick').selectedOptions[0].textContent));
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  await page.click('#qmBody .qmc[data-st="0"] .qmimg img');
  assert.equal(await page.$eval('#qmBody .qmc[data-st="0"]', e => e.className), 'qmc', 'no mark from a click on a points question');
  assert.match(await page.$eval('[data-rest]', e => e.textContent), /Give the rest 1/);
  await page.click('#qmBody .qmc[data-st="1"] button[data-v="0"]');
  await page.click('[data-rest]');
  await page.waitForFunction(() => /2 of 2 marked/.test(document.querySelector('#qmProg').textContent));
  assert.ok((await marksOf(page, 0)).some(m => m.text === '1/1'));
  assert.ok((await marksOf(page, 1)).some(m => m.text === '0/1'));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a mark moved on one paper only, then put back; size, filter, whole page and undo', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await dragOn(page, 0, [0.1, 0.1], [0.6, 0.2]);
  await dragOn(page, 0, [0.1, 0.25], [0.6, 0.35]);
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  // Ben is wrong: an ✗ in the margin, left of the box.
  await page.click('#qmBody .qmc[data-st="1"] .qmimg img');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"]').classList.contains('wrong'));
  const before = (await marksOf(page, 1))[0];
  // Drag his ✗ to the right, on his paper only.
  const m = await page.$eval('#qmBody .qmc[data-st="1"] .qmmk', e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(m.x, m.y); await page.mouse.down(); await page.mouse.move(m.x + 120, m.y + 5, { steps: 6 }); await page.mouse.up();
  await page.waitForSelector('#qmBody .qmc[data-st="1"] [data-reset]');
  const after = (await marksOf(page, 1))[0], Q = await quiz(page);
  assert.ok(after.x > before.x + 30, 'his ✗ moved right: ' + before.x + ' → ' + after.x);
  assert.ok(Q.spot['Ben Specimen'][Q.qs[0].id], 'kept for his paper');
  assert.equal(Q.qs[0].mx, undefined, 'the question’s own spot is unchanged');
  assert.ok(await page.$eval('#qmBody .qmc[data-st="1"]', e => e.classList.contains('wrong')), 'a drag on the mark isn’t a click');
  assert.equal(await page.$('#qmBody .qmc[data-st="0"] [data-reset]'), null, 'Ann’s paper is unchanged');
  await page.click('#qmBody .qmc[data-st="1"] [data-reset]');
  await page.waitForFunction(() => !document.querySelector('#qmBody .qmc[data-st="1"] [data-reset]'));
  assert.equal(Math.round((await marksOf(page, 1))[0].x), Math.round(before.x), 'back in the margin');
  // Size: Full width is one per row, and it is remembered.
  await page.click('[data-size="F"]');
  assert.ok(await page.$eval('#qmBody', e => e.classList.contains('qmz-F')));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.qmSize'))), 'F');
  await page.click('[data-size="S"]');
  assert.ok(await page.$eval('#qmBody', e => e.classList.contains('qmz-S') && !e.classList.contains('qmz-F')));
  // Not marked: only Ann is left.
  await page.click('[data-only="1"]');
  assert.deepEqual(await page.$$eval('#qmBody .qmc', c => c.map(e => e.dataset.st)), ['0']);
  await page.click('[data-only="0"]');
  assert.equal(await page.$$eval('#qmBody .qmc', c => c.length), 2);
  // Undo: Ctrl Z takes back "Mark the rest right", then Ben's ✗.
  await page.click('[data-rest]');
  await page.waitForFunction(() => /2 of 2 marked/.test(document.querySelector('#qmProg').textContent));
  await page.focus('#qmBody .qmc[data-st="0"]');
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  await page.waitForFunction(() => /1 of 2 marked/.test(document.querySelector('#qmProg').textContent));
  await page.focus('#qmBody .qmc[data-st="0"]');
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  await page.waitForFunction(() => /0 of 2 marked/.test(document.querySelector('#qmProg').textContent));
  assert.deepEqual(await marksOf(page, 1), [], 'his ✗ is off the paper');
  // Whole page: Space opens it with the box shown, Esc goes back to marking.
  await page.focus('#qmBody .qmc[data-st="1"]');
  await page.keyboard.press(' ');
  await page.waitForSelector('#qmPeek canvas');
  assert.ok(await page.$('#qmPeek .qmpkbox'));
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#qmPeek'), null);
  assert.ok(await page.$('#qmBody'), 'still marking');
  assert.deepEqual(page.errors, []);
  await close();
});
