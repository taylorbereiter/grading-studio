// Answer notes: the right answer typed once per Quick mark question goes on returned papers as a gold comment labelled Answer,
// by each question a student lost points on (or every question, or nowhere). Made-up students only.
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

async function boxOn(page, n, a, b) {
  await page.waitForSelector('.qbpg[data-n="' + n + '"] canvas');
  const r = await page.$eval('.qbpg[data-n="' + n + '"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(r.x + a[0] * r.w, r.y + a[1] * r.h); await page.mouse.down();
  await page.mouse.move(r.x + b[0] * r.w, r.y + b[1] * r.h, { steps: 5 }); await page.mouse.up();
}
const paperMarks = (page, i) => page.evaluate(i => JSON.parse(JSON.stringify(window.__gs.state().batch.students[i].files.flatMap(f => Object.values(f.marks).flat()))), i);
const answers = async (page, i) => (await paperMarks(page, i)).filter(m => m.qza);

async function setUp(page) {
  await openZip(page, quizZip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await boxOn(page, 0, [0.08, 0.1], [0.6, 0.18]);
  await boxOn(page, 0, [0.08, 0.22], [0.6, 0.3]);
  // The first question's answer; the second has none.
  await page.waitForSelector('#qbList tr[data-q] .qkey');
  await page.type('#qbList tr[data-q] .qkey', 'photosynthesis');
}

test('answer notes: on by default where points were lost, gold and labelled, off a right answer, and they never set a score', async () => {
  const { page, close } = await openApp(browser);
  await setUp(page);
  assert.equal(await page.$eval('#qbAns [aria-pressed="true"]', b => b.dataset.ans), 'miss', 'where points were lost, to start');
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  assert.equal(await page.$eval('.qmkey.big', e => e.textContent), 'photosynthesis');
  // Ben is wrong, Ann is right.
  await page.click('#qmBody .qmc[data-st="1"] .qmimg');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"]').classList.contains('wrong'));
  await page.click('[data-rest]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc.right').length === 1);
  const ben = await answers(page, 1);
  assert.equal(ben.length, 1);
  assert.equal(ben[0].t, 'note'); assert.equal(ben[0].text, 'Answer: photosynthesis'); assert.equal(ben[0].color, '#C08C00');
  assert.ok(ben[0].ax > 300 && ben[0].ay > 70 && ben[0].ay < 160, 'by the question: ' + [ben[0].ax, ben[0].ay]);
  assert.deepEqual(await answers(page, 0), [], 'nothing on a right answer');
  assert.match(await page.$eval('#qmBody .qmc[data-st="1"] .qmans', e => e.textContent), /photosynthesis/, 'the card shows the note it gets');
  assert.equal(await page.$('#qmBody .qmc[data-st="0"] .qmans'), null);
  // Marking Ben right takes it off; wrong again puts it back.
  await page.click('#qmBody .qmc[data-st="1"] .qmimg');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"]').classList.contains('right'));
  assert.deepEqual(await answers(page, 1), []);
  assert.equal(await page.$('#qmBody .qmc[data-st="1"] .qmans'), null);
  await page.click('#qmBody .qmc[data-st="1"] .qmimg');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"]').classList.contains('wrong'));
  assert.equal((await answers(page, 1)).length, 1);
  // An answer that looks like a score is never read as one.
  await page.evaluate(async () => { const b = window.__gs.state().batch, q = b.quiz.qs[0]; q.key = '3/4'; await window.__gs.quizSet(b.students[1], q, 0); });
  assert.equal((await answers(page, 1))[0].text, 'Answer: 3/4');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].grade.points), '0', 'the score is still what the marks give');
  assert.deepEqual(page.errors, []);
  await close();
});

test('answer notes: every question, or off; changing it in Boxes redoes the papers already marked', async () => {
  const { page, close } = await openApp(browser);
  await setUp(page);
  await page.click('#qbAns [data-ans="all"]');
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  await page.click('[data-rest]');   // both right on the first question
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc.right').length === 2);
  assert.equal((await answers(page, 0)).length, 1, 'every question with an answer, right or not');
  assert.equal((await answers(page, 1)).length, 1);
  await page.click('[data-qgo="1"]');   // the second question has no answer typed
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  await page.click('[data-rest]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc.right').length === 2);
  assert.equal((await answers(page, 0)).length, 1, 'a question with no answer gets no note');
  // Off, in Boxes: the notes already given come off.
  await page.click('[data-boxes]');
  await page.waitForSelector('#qbAns');
  assert.equal(await page.$eval('#qbAns [aria-pressed="true"]', b => b.dataset.ans), 'all');
  await page.click('#qbAns [data-ans="off"]');
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  assert.deepEqual(await answers(page, 0), []);
  assert.deepEqual(await answers(page, 1), []);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.quiz.ans), 'off', 'kept with the quiz, so a card carries it on');
  assert.deepEqual(page.errors, []);
  await close();
});
