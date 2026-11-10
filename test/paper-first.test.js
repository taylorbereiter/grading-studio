// The marking screen with the paper first: the page takes at least half a laptop screen, the student list is a narrow strip
// that opens when she points at it or presses a key, each rubric row is one line, and a whole class can be scored from the
// keyboard. Driven through the real built app. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, score, settle } = require('./helpers/app');
const { makePaper, standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
const shown = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }); }, sel);
// A row of the list, once it is laid out (under a busy machine a measurement can land before the first layout).
const rowBox = async (page, i) => (await page.waitForFunction(i => { const r = document.querySelector('#stuList .stu[data-i="' + i + '"]').getBoundingClientRect(); return r.height > 0 && { t: r.top, h: r.height }; }, {}, i)).jsonValue();
const cur = page => page.evaluate(() => window.__gs.state().cur);
const rubric = (page, i) => page.evaluate(i => { const s = window.__gs.state(); const r = s.batch.students[i == null ? s.cur : i].grade.rubric; return [0, 1, 2].map(k => r[k] == null ? null : r[k]); }, i);
const rowOn = page => page.evaluate(() => window.__gs.scoreRow());
const cols = page => page.$eval('#cols', c => c.className.split(/\s+/).filter(x => x === 'open' || x === 'peek').join(' '));
const blur = page => page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
const toastText = page => page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));

async function laptop(o) {
  const app = await openApp(browser, o), { page } = app;
  await page.setViewport({ width: 1366, height: 768 });
  await openZip(page, zip);
  await page.mouse.move(700, 400);   // the pointer rests on the paper
  return app;
}

/* ---------------- the paper ---------------- */
test('on a 1366 px laptop the page is at least half the screen wide, and the strip and score panel stay narrow', async () => {
  const { page, close } = await laptop();
  const pg = await page.evaluate(() => { const p = window.__gs.state().pages[0], r = p.canvas.getBoundingClientRect(); return { page: p.W * p.s, l: r.left, r: r.right }; });
  assert.ok(pg.page >= 1366 / 2, 'the page itself is ' + Math.round(pg.page) + ' px wide');
  const side = await box(page, '#side'), grade = await box(page, '#grade'), dock = await box(page, '#tools');
  assert.ok(side.w <= 70, 'the list is a strip: ' + side.w);
  assert.ok(grade.w <= 290, 'the score panel: ' + grade.w);
  assert.ok(dock.r <= pg.l && pg.r <= grade.l, 'nothing sits on the page');
  for (const s of ['#zoomPill [data-z="1"]', '#zoomPill [data-z="-1"]']) assert.ok(await shown(page, s), s);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a paper that is one file shows the file in the bar beside the name, with the file’s choices under the same ⋯', async () => {
  const { page, close } = await laptop();
  assert.equal(await page.$$eval('#paper .fhead', a => a.length), 1);
  assert.ok(await page.$eval('#paper .who .fhead.inl', h => /Essay\.pdf/.test(h.textContent)), 'the file name is in the bar');
  await page.click('#whoMore');
  const items = await page.$$eval('#whoMore + .km button', a => a.filter(b => b.checkVisibility()).map(b => b.firstChild.textContent.trim()));
  for (const t of ['Arrange pages', 'Lighting', 'Calculator', 'Replace…', 'Remove']) assert.ok(items.includes(t), t + ' is in the menu: ' + items.join(', '));
  await page.keyboard.press('Escape');
  // two files: each keeps its own bar and its own menu
  await goToStudent(page, 1);
  assert.equal(await page.$$eval('#paper .fhead', a => a.length), 2);
  assert.equal(await page.$$eval('#paper .who .fhead', a => a.length), 0);
  await close();
});

/* ---------------- the student list ---------------- */
test('the strip shows each student’s number and how far their score is; pointing at it opens the names over the paper', async () => {
  const { page, close } = await laptop();
  await score(page, [4, 3, 3]);
  await goToStudent(page, 1); await score(page, [3, null, null]);
  await goToStudent(page, 0);
  await page.mouse.move(700, 400);
  await page.waitForFunction(() => !document.querySelector('#cols').classList.contains('peek'));
  const strip = await page.$$eval('#stuList .stu', a => a.map(b => ({ n: b.querySelector('.num').textContent.trim(), sv: b.dataset.sv, name: b.querySelector('.nm').checkVisibility(), label: b.getAttribute('aria-label') || b.title || b.textContent })));
  assert.deepEqual(strip.map(r => r.n), ['1', '2', '3', '4']);
  assert.equal(strip[0].sv, '10', 'a finished score shows as its total');
  assert.ok(strip.every(r => !r.name), 'no names in the strip');
  assert.ok(await page.$eval('#stuList .stu.sv-part', b => b.dataset.i === '1'), 'a part-scored paper is marked as such');
  assert.equal(await page.$eval('#stuList .stu[aria-current="true"]', b => b.dataset.i), '0');
  const paperBefore = await box(page, '#paper .pg canvas'), rowBefore = await rowBox(page, 2);
  // pointing at the strip opens the list, on top of the paper
  await page.mouse.move(90, 300);
  await page.waitForFunction(() => document.querySelector('#cols').classList.contains('peek'));
  assert.ok((await box(page, '#side')).w >= 200);
  assert.ok(await shown(page, '#stuList .stu[data-i="2"] .nm'), 'names show');
  assert.deepEqual(await box(page, '#paper .pg canvas'), paperBefore, 'the paper does not move');
  const rowAfter = await rowBox(page, 2);
  assert.equal(rowAfter.t, rowBefore.t, 'a student’s row stays at the same height');
  // a click on a name opens that paper
  await page.click('#stuList .stu[data-i="2"]');
  await page.waitForFunction(() => window.__gs.state().cur === 2);
  // moving away folds it again
  await page.mouse.move(700, 400);
  await page.waitForFunction(() => !document.querySelector('#cols').classList.contains('peek'));
  assert.ok((await box(page, '#side')).w <= 70);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.listOpen')), null, 'pointing at the list saves nothing');
  await close();
});

test('[ keeps the list open beside the paper and folds it again; only that choice is remembered', async () => {
  const { page, close } = await laptop();
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
  const panels = await page.evaluate(() => localStorage.getItem('gs.panels'));
  await blur(page);
  await page.keyboard.press('[');
  assert.equal(await cols(page), 'open');
  assert.equal(await page.$eval('#colL', b => b.getAttribute('aria-pressed')), 'true');
  const side = await box(page, '#side'), pg = await box(page, '#paper');
  assert.ok(side.w >= 200 && pg.l >= side.r - 1, 'the paper sits beside the list, not under it');
  assert.ok(await shown(page, '#stuList .stu .nm'));
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.listOpen')), 'true');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), keysBefore.concat('gs.listOpen').sort(), 'one new record and no other');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.panels')), panels, 'the older panel record is as it was');
  // it is still open after a refresh
  await page.reloadHere(); await page.waitForSelector('#stuList .stu');
  assert.equal(await cols(page), 'open');
  // the button at the edge of the list folds it
  await page.click('#colL');
  assert.equal(await cols(page), '');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.listOpen')), 'false');
  assert.ok((await box(page, '#side')).w <= 70);
  assert.deepEqual(page.errors, []);
  await close();
});

test('/ opens the list with the keyboard in Find, and Escape hands the screen back', async () => {
  const { page, close } = await laptop();
  await blur(page);
  await page.keyboard.press('/');
  await page.waitForFunction(() => document.querySelector('#cols').classList.contains('peek'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'stuFind');
  await page.keyboard.type('cleo');
  assert.deepEqual(await page.$$eval('#stuList .stu', a => a.map(b => +b.dataset.i)), [2]);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__gs.state().cur === 2);
  await close();
});

test('a browser that stored nothing about the list opens with the strip, and the stored work is read the same', async () => {
  // what an earlier version left behind: both panels shown
  const { page, close } = await laptop({ seed: { ls: { 'gs.panels': JSON.stringify({ L: true, R: true }) } } });
  assert.equal(await cols(page), '');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.panels')), JSON.stringify({ L: true, R: true }), 'left as it was');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.listOpen')), null);
  await close();
});

/* ---------------- scoring from the keyboard ---------------- */
test('a number scores the row in hand and moves to the next, a full stop makes it a half, Enter opens the next paper', async () => {
  const { page, close } = await laptop();
  await blur(page);
  assert.equal(await rowOn(page), 0, 'the first row with no score is in hand');
  assert.equal(await page.$eval('#grade .crit.on', c => c.dataset.row), '0');
  await page.keyboard.press('3');
  assert.deepEqual(await rubric(page), [3, null, null]);
  assert.equal(await rowOn(page), 1);
  await page.keyboard.press('.');
  assert.deepEqual(await rubric(page), [3.5, null, null], 'the half goes on the row just scored');
  await page.keyboard.press('.');
  assert.deepEqual(await rubric(page), [3, null, null], 'and comes off again');
  await page.keyboard.press('4'); await page.keyboard.press('2'); await page.keyboard.press('.');
  assert.deepEqual(await rubric(page), [3, 4, 2.5]);
  assert.match(await page.$eval('#grade .total', e => e.textContent.replace(/\s+/g, ' ')), /9\.5/);
  assert.equal(await page.$eval('#grade .crit[data-row="2"] .cn em', e => e.textContent.replace(/\s+/g, ' ').trim()), '2.5 / 4');
  assert.equal(await page.$eval('#stuList .stu[data-i="0"]', b => b.dataset.sv), '9.5', 'the strip shows the total');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__gs.state().cur === 1);
  assert.equal(await rowOn(page), 0, 'the next paper starts at its first row');
  await page.keyboard.press('2'); await page.keyboard.press('2'); await page.keyboard.press('2');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__gs.state().cur === 2);
  await settle(page);
  assert.deepEqual(await rubric(page, 0), [3, 4, 2.5]);
  assert.deepEqual(await rubric(page, 1), [2, 2, 2]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a paper with every row scored is not changed by a stray number; Tab or a click on a row takes it in hand first', async () => {
  const { page, close } = await laptop();
  await score(page, [4, 3, 3]);
  await goToStudent(page, 1); await goToStudent(page, 0);
  await blur(page);
  assert.equal(await rowOn(page), -1);
  await page.keyboard.press('1');
  assert.deepEqual(await rubric(page), [4, 3, 3], 'nothing changed');
  assert.match(await toastText(page), /Every row has a score/);
  // a click on the row's name takes it in hand
  await page.click('#grade .crit[data-row="1"] .cn');
  assert.equal(await rowOn(page), 1);
  await blur(page);
  await page.keyboard.press('2');
  assert.deepEqual(await rubric(page), [4, 2, 3]);
  // Tab reaches the rows as sliders; a number there scores the row the keyboard is on
  await goToStudent(page, 1); await goToStudent(page, 0); await blur(page);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => { const a = document.activeElement; return a.classList.contains('srange') ? a.closest('.scores').dataset.c : null; }), '0');
  await page.keyboard.press('1');
  assert.deepEqual(await rubric(page), [1, 2, 3]);
  assert.equal(await page.evaluate(() => { const a = document.activeElement; return a.classList.contains('srange') ? a.closest('.scores').dataset.c : null; }), '1', 'the keyboard moves on with the score');
  await close();
});

test('numbers typed in a comment, in Find or with the calculator open are not scores', async () => {
  const { page, close } = await laptop();
  await page.click('#cmtIn'); await page.keyboard.type('3 good points. 4 to fix.');
  await page.keyboard.press('Enter');
  assert.deepEqual(await rubric(page), [null, null, null]);
  assert.equal(await cur(page), 0, 'Enter in the comment is a new line, not the next paper');
  assert.match(await page.$eval('#cmtIn', t => t.value), /^3 good points\. 4 to fix\.\n$/);
  await blur(page);
  await page.keyboard.press('/'); await page.keyboard.type('4');
  assert.deepEqual(await rubric(page), [null, null, null]);
  await page.keyboard.press('Escape'); await blur(page);
  await page.click('#whoMore'); await page.click('#whoMore + .km [data-whodo="calc"]');
  await page.waitForSelector('#calcPanel');
  await blur(page);
  await page.keyboard.press('3');
  assert.deepEqual(await rubric(page), [null, null, null], 'the calculator has the numbers while it is open');
  await close();
});

test('with plain points a number starts typing in the score box, and Enter there does not skip a paper', async () => {
  const app = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify({ mode: 'points', outOf: 20 }) } } }), { page } = app;
  await page.setViewport({ width: 1366, height: 768 });
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'Aria Testwell essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Bram Sample essay' }), 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'Cleo Fixture essay' }) }), 'Quiz.zip');
  await page.waitForSelector('#ptsIn');
  await blur(page);
  await page.keyboard.type('17');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'ptsIn');
  await page.keyboard.press('Enter');
  await settle(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.points), '17');
  assert.equal(await cur(page), 0, 'the first Enter sets the score');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__gs.state().cur === 1);
  assert.deepEqual(page.errors, []);
  await app.close();
});
