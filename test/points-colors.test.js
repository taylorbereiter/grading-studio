// Points colors: points written on a paper by Quick mark ("1/2") can be in the ✗ color (as before), one color of the
// teacher's own, or by credit: full in the ✓ color, part in amber, none in the ✗ color. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goTo } = require('./helpers/app');
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
// One question worth 2, marked in points.
async function quickMark(page) {
  await openZip(page, quizZip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await boxOn(page, 0, [0.08, 0.1], [0.6, 0.18]);
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  await page.evaluate(() => Object.assign(window.__gs.state().batch.quiz.qs[0], { pts: 2, how: 'pts', kind: 'scale' }));
  await page.click('[data-view="s"]'); await page.click('[data-view="q"]');
  await page.waitForSelector('#qmBody .qmc[data-st="0"] button[data-v="2"]');
}
const ptsMark = (page, i) => page.evaluate(i => { const m = window.__gs.state().batch.students[i].files.flatMap(f => Object.values(f.marks).flat()).find(m => m.qz && m.t === 'text'); return m ? m.text + ' ' + m.color : null; }, i);

test('points are in the ✗ color until she picks otherwise; one color of her own, or green, amber and red by credit', async () => {
  const { page, close } = await openApp(browser);
  await quickMark(page);
  await page.click('#qmBody .qmc[data-st="0"] button[data-v="1"]');
  await page.click('#qmBody .qmc[data-st="1"] button[data-v="2"]');
  await page.waitForFunction(() => /2 of 2 marked/.test(document.querySelector('#qmProg').textContent));
  assert.equal(await ptsMark(page, 0), '1/2 #D7263D', 'red, as before');
  assert.equal(await ptsMark(page, 1), '2/2 #D7263D');
  await page.click('#qmInkBtn');
  await page.waitForSelector('#qmInkPop:not([hidden]) [data-qpts="credit"]');
  assert.equal(await page.$eval('[data-qpts=""]', e => e.getAttribute('aria-pressed')), 'true', 'Same as ✗ is the default');
  await page.click('[data-qpts="credit"]');
  assert.equal(await ptsMark(page, 0), '1/2 #A86400', 'part credit in amber');
  assert.equal(await ptsMark(page, 1), '2/2 #1E8A4C', 'full credit in the ✓ color');
  assert.equal(await page.$eval('#qmBody .qmc[data-st="0"] .qmmk', e => getComputedStyle(e).color), 'rgb(168, 100, 0)', 'the card shows it too');
  await page.click('#qmBody .qmc[data-st="1"] button[data-v="0"]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.q[window.__gs.state().batch.quiz.qs[0].id] === 0);
  assert.equal(await ptsMark(page, 1), '0/2 #D7263D', 'none in the ✗ color');
  await page.click('#qmBody .qmc[data-st="1"] button[data-v="1"]'); await page.click('#qmBody .qmc[data-st="1"] [data-half]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.q[window.__gs.state().batch.quiz.qs[0].id] === 1.5);
  assert.equal(await ptsMark(page, 1), '1.5/2 #A86400', 'a half point short is still part credit');
  // The ✗ color moves "none" with it; the ✓ color moves "full".
  await page.click('#qmInkBtn'); await page.waitForSelector('#qmInkPop:not([hidden]) [data-qchk="blue"]');
  await page.click('[data-qchk="blue"]');
  await page.click('#qmBody .qmc[data-st="1"] button[data-v="2"]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.q[window.__gs.state().batch.quiz.qs[0].id] === 2);
  assert.equal(await ptsMark(page, 1), '2/2 #1F5FD1');
  // One color of her own: every points mark in it, the ✗ stays as it was.
  await page.click('#qmInkBtn'); await page.waitForSelector('#qmInkPop:not([hidden]) [data-qpts="purple"]');
  await page.click('[data-qpts="purple"]');
  assert.equal(await ptsMark(page, 0), '1/2 #7B3FC4');
  assert.equal(await ptsMark(page, 1), '2/2 #7B3FC4');
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('gs.ptsInk'), localStorage.getItem('gs.ink')]), ['"purple"', null]);
  await page.click('[data-qpts=""]');
  assert.equal(await ptsMark(page, 0), '1/2 #D7263D', 'back to the ✗ color');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.ptsInk')), null, 'nothing kept for the default');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Settings, Marking, Mark colors sets the same three colors, and Quick mark opens with them', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings/marking');
  await page.waitForSelector('#setInks:not([hidden]) [data-spts="credit"]');
  await page.click('[data-spts="credit"]');
  await page.waitForSelector('[data-spts="credit"][aria-pressed="true"]');
  assert.match(await page.$eval('#setInks', e => e.textContent), /Totals and score stamps stay in the ✗ color/);
  await page.click('[data-schk="purple"]');
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('gs.ptsInk'), localStorage.getItem('gs.checkInk')]), ['"credit"', '"purple"']);
  await quickMark(page);
  await page.click('#qmBody .qmc[data-st="1"] button[data-v="2"]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.q[window.__gs.state().batch.quiz.qs[0].id] === 2);
  assert.equal(await ptsMark(page, 1), '2/2 #7B3FC4', 'full credit in the ✓ color she picked');
  assert.deepEqual(page.errors, []);
  await close();
});
