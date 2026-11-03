// The calculator from the keyboard: the =/+ key adds, Shift with it (or Enter) answers, and numbers typed anywhere go in.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

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
