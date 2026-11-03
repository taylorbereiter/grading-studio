// The calculator from the keyboard: the =/+ key adds, Shift with it (or Enter) answers, and numbers typed anywhere go in.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip } = require('./helpers/app');
const { standardFiles, zipOf, makePaper } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const val = page => page.$eval('#calcIn', i => i.value);
const out = page => page.$eval('#calcOut', o => o.textContent);

test('= on its own adds, Shift = or Enter answers, and + after an answer carries on', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.keyboard.press('Equal');   // opens it
  await page.waitForSelector('#calcPanel');
  await page.keyboard.type('5'); await page.keyboard.press('Equal'); await page.keyboard.type('3.5'); await page.keyboard.press('Equal'); await page.keyboard.type('4');
  assert.equal(await val(page), '5+3.5+4');
  await page.keyboard.down('Shift'); await page.keyboard.press('Equal'); await page.keyboard.up('Shift');
  assert.equal(await val(page), '12.5');
  await page.keyboard.press('Equal'); await page.keyboard.type('2');   // carries on from 12.5
  assert.equal(await val(page), '12.5+2');
  await page.keyboard.press('Enter');
  assert.equal(await val(page), '14.5');
  await page.keyboard.type('7');   // a number after an answer starts over
  assert.equal(await val(page), '7');
  await page.click('[data-ck="="]');   // the = button still works
  assert.match(await out(page), /7/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('with the calculator open, numbers typed after a click on the paper still go in', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.evaluate(() => window.__gs.openCalc());
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.type('2'); await page.keyboard.press('Equal'); await page.keyboard.type('2');
  assert.equal(await val(page), '2+2');
  await page.keyboard.down('Shift'); await page.keyboard.press('Equal'); await page.keyboard.up('Shift');
  assert.equal(await val(page), '4');
  assert.ok(await page.$('#calcPanel'), 'still open');
  assert.deepEqual(page.errors, []);
  await close();
});

// The score sticker: Score sticker fills in the score, she clicks where it goes, and the grade sheet reads it off the paper.

test('Score sticker sets the score, lands where she clicks, and the grade sheet reads it', async () => {
  const { page, close } = await openApp(browser, { beforeLoad: p => p.evaluateOnNewDocument(() => { if (!localStorage.getItem('gs.setup')) localStorage.setItem('gs.setup', JSON.stringify({ mode: 'points', outOf: 15 })); }) });
  await openZip(page, zipOf({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) }), 'Sticker.zip');
  await page.waitForSelector('#ptsIn');
  await page.evaluate(() => window.__gs.openCalc());
  await page.keyboard.type('8'); await page.keyboard.press('Equal'); await page.keyboard.type('4.5'); await page.keyboard.press('Enter');
  assert.match(await page.$eval('#calcStick', e => e.textContent), /12\.5 \/ 15 · \d+%/);
  await page.click('[data-cstick]');
  assert.equal(await page.$eval('#ptsIn', e => e.value), '12.5', 'it is the score too');
  assert.ok(await page.$('#scoreBar'));
  const c = await page.evaluate(() => { const pg = window.__gs.state().pages[0], r = pg.canvas.getBoundingClientRect(); return { x: r.left + pg.W * pg.s * 0.75, y: r.top + 60 * pg.s }; });
  await page.mouse.move(c.x, c.y);
  assert.ok(await page.$eval('#scoreGhost', g => !g.hidden), 'it follows the pointer');
  await page.mouse.click(c.x, c.y);
  assert.equal(await page.$('#scoreBar'), null, 'placing ends after one click');
  const marks = await page.evaluate(() => Object.values(window.__gs.state().batch.students[0].files[0].marks).flat().filter(m => m.t === 'stamp'));
  assert.equal(marks.length, 1); assert.equal(marks[0].k, 'score'); assert.match(marks[0].text, /^12\.5\/15 = \d+%$/);
  const found = await page.evaluate(async () => { const f = window.__gs.state().batch.students[0].files[0], sc = await window.__gs.scanFile(f, null); return sc.found.map(g => [g.score, g.outOf]); });
  assert.deepEqual(found, [[12.5, 15]]);
  // Esc lets go without placing anything.
  await page.click('[data-cstick]'); await page.keyboard.press('Escape');
  assert.equal(await page.$('#scoreBar'), null);
  assert.equal(await page.evaluate(() => Object.values(window.__gs.state().batch.students[0].files[0].marks).flat().filter(m => m.t === 'stamp').length), 1);
  assert.deepEqual(page.errors, []);
  await close();
});
