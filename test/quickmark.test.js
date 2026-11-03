// Quick mark: box each question of a scanned paper quiz once, then mark one question for the whole class, or one student's whole quiz.
// Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, appReady, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({
    'Ann Example/Quiz scan.pdf': await makePaper({ title: 'Ann Example quiz', pages: 2 }),
    'Ben Specimen/Quiz scan.pdf': await makePaper({ title: 'Ben Specimen quiz', pages: 2 }),
    'Cal Mockname/Quiz scan.pdf': await makePaper({ title: 'Cal Mockname quiz', pages: 2 }),
  });
});
after(async () => { await browser.close(); });

// Drags a box on page n of the Quiz boxes dialog, from and to shares of the page.
async function boxOn(page, n, a, b) {
  await page.waitForSelector('.qbpg[data-n="' + n + '"] canvas');
  const r = await page.$eval('.qbpg[data-n="' + n + '"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(r.x + a[0] * r.w, r.y + a[1] * r.h); await page.mouse.down();
  await page.mouse.move(r.x + b[0] * r.w, r.y + b[1] * r.h, { steps: 5 }); await page.mouse.up();
}
const quizMarksOf = (page, i) => page.evaluate(i => {
  const st = window.__gs.state().batch.students[i];
  return { q: st.grade.q || {}, points: st.grade.points, marks: st.files.flatMap(f => Object.values(f.marks).flat()).filter(m => m.qz).map(m => m.t + (m.k ? ':' + m.k : '') + (m.text ? ':' + m.text : '')) };
}, i);

async function setUp(page) {
  await openZip(page, zip, 'Quiz.zip');
  assert.equal(await page.$eval('#quizTop', b => b.hidden), true, 'no top button before there are boxes');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await boxOn(page, 0, [0.08, 0.1], [0.6, 0.18]);    // question 1, 1 point
  await boxOn(page, 0, [0.08, 0.2], [0.6, 0.3]);     // question 2, 1 point
  await boxOn(page, 1, [0.08, 0.1], [0.9, 0.25]);    // question 3 on the back, 2 points
  assert.equal(await page.$$eval('.qbt tbody tr', r => r.length), 3);
  await page.$eval('.qbt tbody tr:nth-child(1) .qkey', e => { e.value = 'C'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('.qbt tbody tr:nth-child(3) .qpts', e => { e.value = '2'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.match(await page.$eval('#qbSum', e => e.textContent), /3 questions, out of 4 points/);
  await page.click('#qbTotal');
  const r = await page.$eval('.qbpg[data-n="0"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(r.x + 0.85 * r.w, r.y + 0.4 * r.h);
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 3);
}

test('boxes, then marking one question for everyone: wrong ones by click, the rest right', async () => {
  const { page, close } = await openApp(browser);
  await setUp(page);
  const s = await page.evaluate(() => window.__gs.state().setup);
  assert.equal(s.mode, 'points'); assert.equal(+s.outOf, 4, 'the score is out of the quiz’s points');
  assert.equal(await page.$eval('#quizTop', b => b.hidden), false);
  assert.equal(await page.$$eval('#qmBody .qmc', c => c.length), 3, 'one card per student');
  assert.match(await page.$eval('#qmNav', e => e.textContent), /C/, 'the key shows');
  // Ben got question 1 wrong: a click on his answer.
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 3);
  await page.click('#qmBody .qmc[data-st="1"] .qmimg');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"]').classList.contains('wrong'));
  await page.click('[data-rest]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc.right').length === 2);
  assert.match(await page.$eval('#qmProg', e => e.textContent), /3 of 3 marked/);
  const ben = await quizMarksOf(page, 1), ann = await quizMarksOf(page, 0);
  assert.deepEqual(Object.values(ben.q), [0]); assert.deepEqual(ben.marks, ['pen', 'pen'], 'a cross on Ben’s paper');
  assert.deepEqual(ann.marks, ['check'], 'a check on Ann’s');
  assert.equal(ann.points, '1');
  assert.equal(await page.evaluate(() => window.__gs.ownGrade(window.__gs.state().batch.students[0]).partial), true, 'partial until every question is marked');
  // Question 2 from the keyboard: 1, 0, 1, moving along.
  await page.keyboard.press(']');
  await page.waitForFunction(() => /Question 2/.test(document.querySelector('#qmPick').selectedOptions[0].textContent));
  await page.keyboard.press('1'); await page.keyboard.press('0'); await page.keyboard.press('1');
  await page.waitForFunction(() => /3 of 3 marked/.test(document.querySelector('#qmProg').textContent));
  assert.equal((await quizMarksOf(page, 1)).points, '0');
  // Question 3 is out of 2: half points are buttons, and "1/2" goes on the paper.
  await page.keyboard.press(']');
  await page.waitForSelector('#qmBody .qmc button[data-v="1.5"]');
  await page.click('#qmBody .qmc[data-st="0"] button[data-v="1"]');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="0"]').classList.contains('some'));
  await page.click('[data-rest]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc.right').length === 2);
  const a = await quizMarksOf(page, 0), c = await quizMarksOf(page, 2);
  assert.equal(a.points, '3'); assert.ok(a.marks.includes('text:1/2'));
  assert.ok(a.marks.some(m => /^stamp:score:3\/4 = 75%$/.test(m)), 'the total goes on the paper once all are marked: ' + a.marks.join());
  assert.equal(c.points, '4');
  assert.equal(await page.evaluate(() => window.__gs.ownGrade(window.__gs.state().batch.students[2]).done), true);
  assert.deepEqual(page.errors, []);
  await close();
});

test('by student: every answer on one screen, a change moves the score, and it all comes back after a reload', async () => {
  const { page, close } = await openApp(browser);
  await setUp(page);
  await page.click('[data-view="s"]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc').length === 3);
  await page.click('[data-rest]');
  await page.waitForFunction(() => /3 of 3 marked/.test(document.querySelector('#qmProg').textContent));
  assert.match(await page.$eval('.qmtot', e => e.textContent), /4 \/ 4 = 100%/);
  await page.click('#qmBody .qmc:nth-child(2) button[data-v="0"]');
  await page.waitForFunction(() => /3 \/ 4/.test(document.querySelector('.qmtot').textContent));
  assert.ok((await quizMarksOf(page, 0)).marks.includes('stamp:score:3/4 = 75%'), 'the total on the paper follows');
  await page.keyboard.press(']');
  await page.waitForFunction(() => /0 of 3 marked/.test(document.querySelector('#qmProg').textContent));
  // Clearing takes the mark off the paper too.
  await page.evaluate(() => { const q = window.__gs.state().batch.quiz.qs[0]; return window.__gs.quizSet(window.__gs.state().batch.students[0], q, null); });
  const left = (await quizMarksOf(page, 0)).marks;
  assert.deepEqual(left.sort(), ['pen', 'pen', 'text:2/2'], 'the check and the total come off: ' + left.join());
  await page.click('[data-close]');
  await settle(page);
  const before = await quizMarksOf(page, 0);
  await page.reload(); await appReady(page);
  await openZip(page, zip, 'Quiz.zip');
  assert.deepEqual(await quizMarksOf(page, 0), before);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.quiz.qs.length), 3);
  assert.equal(await page.$eval('#quizTop', b => b.hidden), false);
  assert.deepEqual(page.errors, []);
  await close();
});

test('dragging a crop lines that student’s page up, and taking a box out takes its marks off', async () => {
  const { page, close } = await openApp(browser);
  await setUp(page);
  await page.click('[data-rest]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc.right').length === 3);
  const r = await page.$eval('#qmBody .qmc[data-st="2"] .qmimg img', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.mouse.move(r.x + 40, r.y + 10, { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(() => { const q = window.__gs.state().batch.quiz; return q.shift && q.shift['Cal Mockname'] && q.shift['Cal Mockname'][0][0] < 0; });
  assert.ok(await page.$eval('#qmBody .qmc[data-st="2"]', e => e.classList.contains('right')), 'a drag isn’t a click');
  await page.click('[data-boxes]');
  await page.waitForSelector('.qbt [data-del]');
  await page.click('.qbt tbody tr:nth-child(1) [data-del]');
  await page.click('[data-save]');
  await page.waitForSelector('#qmBody .qmc');
  assert.equal(+(await page.evaluate(() => window.__gs.state().setup.outOf)), 3);
  const c = await quizMarksOf(page, 2);
  assert.deepEqual(Object.keys(c.q).length, 0); assert.deepEqual(c.marks, []); assert.equal(c.points, '');
  assert.deepEqual(page.errors, []);
  await close();
});
