// Answer notes, placed and plain: each quiz answer note carries its question's name (Q1) at both ends of its line, the quiz
// picks where the lines start (right of each box, under it, or by the mark), a gold pin in Boxes moves one question's line on
// every paper, and a note moved on one paper stays put until she puts it back. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, quizZip;
before(async () => {
  browser = await launch();
  quizZip = zipOf({
    'Ann Example/Quiz scan.pdf': await makePaper({ title: 'Ann Example quiz', pages: 1 }),
    'Ben Specimen/Quiz scan.pdf': await makePaper({ title: 'Ben Specimen quiz', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

async function pageRect(page, n) {
  await page.waitForSelector('.qbpg[data-n="' + n + '"] canvas');
  return page.$eval('.qbpg[data-n="' + n + '"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
}
async function boxOn(page, n, a, b) {
  const r = await pageRect(page, n);
  await page.mouse.move(r.x + a[0] * r.w, r.y + a[1] * r.h); await page.mouse.down();
  await page.mouse.move(r.x + b[0] * r.w, r.y + b[1] * r.h, { steps: 5 }); await page.mouse.up();
}
const answers = (page, i) => page.evaluate(i => JSON.parse(JSON.stringify(window.__gs.state().batch.students[i].files.flatMap(f => Object.values(f.marks).flat()).filter(m => m.qza))), i);
const reopen = async page => { await page.click('[data-boxes]'); await page.waitForSelector('#qbAt'); };
const save = async page => { await page.click('[data-save]'); await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2); };

test('answer notes: named for their question, lines start where the quiz says, a gold pin moves one question on every paper', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, quizZip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await boxOn(page, 0, [0.08, 0.1], [0.6, 0.18]);
  await page.waitForSelector('#qbList tr[data-q] .qkey');
  await page.type('#qbList tr[data-q] .qkey', 'photosynthesis');
  assert.equal(await page.$eval('#qbAt [aria-pressed="true"]', b => b.dataset.at), 'right', 'right of each box, to start');
  assert.equal(await page.$eval('.qbapin', e => e.textContent), 'Q1', 'a gold pin shows where its line starts');
  await save(page);
  await page.click('[data-rest]');   // both marked right…
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc.right').length === 2);
  for (const i of [0, 1]) { await page.click('#qmBody .qmc[data-st="' + i + '"] .qmimg'); await page.waitForFunction(i => document.querySelector('#qmBody .qmc[data-st="' + i + '"]').classList.contains('wrong'), {}, i); }
  let [a] = await answers(page, 0), [b] = await answers(page, 1);
  assert.equal(a.qzl, 'Q1'); assert.equal(a.qzr.length, 4, 'its question box, outlined while the pointer is on it');
  const right = [a.ax, a.ay];
  assert.ok(Math.abs(a.ax - (a.qzr[0] + a.qzr[2])) < 1, 'right of the box: ' + right);
  // Ben's note is moved on his paper only.
  await page.evaluate(() => { const n = window.__gs.state().batch.students[1].files.flatMap(f => Object.values(f.marks).flat()).find(m => m.qza); n.ax -= 120; n.ay += 40; });
  b = (await answers(page, 1))[0];
  // Under each box, for the whole quiz.
  await reopen(page);
  await page.click('#qbAt [data-at="under"]');
  assert.match(await page.$eval('#qbAtSay', e => e.textContent), /\(1\)/, 'offers to put back the one moved on a single paper');
  await save(page);
  a = (await answers(page, 0))[0];
  assert.ok(a.ay > right[1] + 10 && Math.abs(a.ay - (a.qzr[1] + a.qzr[3] + 6)) < 1, 'Ann’s follows, under the box: ' + [a.ax, a.ay]);
  const b2 = (await answers(page, 1))[0];
  assert.deepEqual([b2.ax, b2.ay], [b.ax, b.ay], 'Ben’s stays where it was moved'); assert.equal(b2.qzm, 1);
  // A gold pin dragged for question 1: every paper not moved by hand follows it.
  await reopen(page);
  await page.click('#qbList tr[data-q] .qlab');
  const r = await pageRect(page, 0), pin = await page.$eval('.qbapin', e => { const k = e.getBoundingClientRect(); return [k.left + k.width / 2, k.top + k.height / 2]; });
  await page.mouse.move(pin[0], pin[1]); await page.mouse.down();
  await page.mouse.move(r.x + 0.7 * r.w, r.y + 0.12 * r.h, { steps: 6 }); await page.mouse.up();
  assert.match(await page.$eval('#qbSpot', e => e.textContent), /gold pin you dragged/);
  // and put back the one moved on Ben's paper
  await page.click('[data-ansback]');
  await save(page);
  const q = await page.evaluate(() => window.__gs.state().batch.quiz.qs[0]);
  assert.ok(Math.abs(q.nx - 0.7) < 0.01 && Math.abs(q.ny - 0.12) < 0.01, 'kept with the question: ' + [q.nx, q.ny]);
  a = (await answers(page, 0))[0]; const b3 = (await answers(page, 1))[0];
  assert.ok(Math.abs(a.ax - 0.7 * 612) < 8, 'Ann’s at the pin: ' + a.ax);
  assert.ok(Math.abs(b3.ax - a.ax) < 8 && Math.abs(b3.ay - a.ay) < 8 && !b3.qzm, 'Ben’s put back to the pin too: ' + [b3.ax, b3.ay]);
  // Back to under each box.
  await reopen(page);
  await page.click('#qbList tr[data-q] .qlab');
  await page.click('[data-ansdef]');
  await save(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.quiz.qs[0].nx), undefined);
  a = (await answers(page, 0))[0];
  assert.ok(Math.abs(a.ay - (a.qzr[1] + a.qzr[3] + 6)) < 1, 'under the box again');
  assert.deepEqual(page.errors, []);
  await close();
});
