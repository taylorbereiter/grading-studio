// Full screen marking (11/13): the student list steps aside. It comes back at the left edge of the screen (after a moment, never
// with a button held), with [ (until full screen ends, nothing stored), with /, or with the tab on a tablet. Settings, Marking can
// keep it shown or hide the tools as well (gs.fullSide). Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goTo, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (page, fn, arg) => { for (let i = 0; i < 160; i++) { if (await page.evaluate(fn, arg)) return; await wait(50); } throw new Error('Waited too long for ' + fn); };
const isFull = () => document.fullscreenElement === document.documentElement && document.documentElement.classList.contains('gsfull');
const notFull = () => !document.fullscreenElement && !document.documentElement.classList.contains('gsfull');
const look = page => page.evaluate(() => {
  const s = document.querySelector('#side'), r = s.getBoundingClientRect(), c = document.querySelector('#cols');
  return { shown: getComputedStyle(s).visibility !== 'hidden' && r.right > 1, peek: c.classList.contains('peek'), open: c.classList.contains('open'), paper: Math.round(document.querySelector('#paper').getBoundingClientRect().left), tools: getComputedStyle(document.querySelector('#tools')).opacity };
});
const goFull = async page => { await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('f'); await until(page, isFull); await wait(350); };

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({
    'Ann Example/Essay.pdf': await makePaper({ title: 'Ann Example essay', pages: 1 }),
    'Ben Specimen/Essay.pdf': await makePaper({ title: 'Ben Specimen essay', pages: 1 }),
    'Cara Sample/Essay.pdf': await makePaper({ title: 'Cara Sample essay', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

test('in full screen the list hides, comes back at the left edge after a moment, and goes again when the pointer leaves', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.listOpen': 'true' } } });
  await openZip(page, zip);
  assert.equal((await look(page)).open, true, 'kept open outside full screen');
  await goFull(page);
  let l = await look(page);
  assert.equal(l.shown, false, 'the list is out of the way, even one kept open');
  assert.ok(l.paper < 40, 'the paper takes the room: ' + l.paper);
  // a quick pass over the edge does nothing
  await page.mouse.move(700, 400); await page.mouse.move(2, 400); await wait(60); await page.mouse.move(700, 400); await wait(400);
  assert.equal((await look(page)).peek, false, 'a pointer passing by does not open it');
  // a stroke that runs off the paper to the edge does nothing
  await page.mouse.move(300, 400); await page.mouse.down(); await page.mouse.move(2, 400, { steps: 6 }); await wait(500);
  assert.equal((await look(page)).peek, false, 'not while a button is held');
  await page.mouse.up(); await page.mouse.move(700, 400); await wait(300);
  // resting at the edge opens it
  await page.mouse.move(2, 400); await wait(500);
  l = await look(page); assert.equal(l.peek, true); assert.equal(l.shown, true);
  // a student can be picked from it
  await page.mouse.move(120, 400); await wait(100);
  await page.click('#stuList .stu:nth-child(2)'); await until(page, () => window.__gs.state().cur === 1);
  await page.mouse.move(800, 400); await page.mouse.move(820, 410); await wait(800);
  assert.equal((await look(page)).shown, false, 'it goes once the pointer moves off it');
  // leaving full screen: the list is kept open as before, and that choice was never touched
  await page.evaluate(() => document.exitFullscreen()); await until(page, notFull); await wait(100);
  assert.equal((await look(page)).open, true);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.listOpen')), 'true');
  assert.deepEqual(page.errors, []);
  await close();
});

test('[ keeps it open until full screen ends, / finds a student, and nothing is stored', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await goFull(page);
  await page.keyboard.press('[');
  await wait(300);
  let l = await look(page); assert.equal(l.open, true); assert.equal(l.shown, true);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.listOpen')), null, 'only for now');
  await page.keyboard.press('['); await wait(400);
  assert.equal((await look(page)).shown, false);
  await page.keyboard.press('/'); await wait(300);
  l = await look(page); assert.equal(l.peek, true); assert.equal(await page.evaluate(() => document.activeElement.id), 'stuFind');
  await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement.blur()); await wait(400);
  // kept open for now, then full screen ends and starts again: hidden again
  await page.keyboard.press('['); await wait(200);
  await page.evaluate(() => document.exitFullscreen()); await until(page, notFull);
  assert.equal((await look(page)).open, false, 'outside full screen the strip is as it was');
  await goFull(page);
  assert.equal((await look(page)).shown, false);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Settings, Marking: show both, or hide the tools too; the tools come back near the pointer', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings/marking');
  await page.waitForSelector('#setFullSide button[data-v="hide"][aria-pressed="true"]', { visible: true });
  await page.click('#setFullSide button[data-v="show"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.fullSide')), '"show"');
  await openZip(page, zip);
  await goFull(page);
  assert.equal((await look(page)).shown, true, 'the strip stays');
  await page.evaluate(() => window.__gs.fullSideSet('all')); await wait(300);
  await page.mouse.move(800, 400); await wait(300);
  let l = await look(page); assert.equal(l.shown, false); assert.equal(l.tools, '0', 'the tools are hidden');
  const before = l.paper;
  await page.mouse.move(40, 300); await page.mouse.move(42, 310); await wait(450);
  l = await look(page); assert.equal(l.tools, '1', 'near the pointer they show'); assert.equal(l.paper, before, 'the paper stays put');
  await page.click('#tools [data-tool="hl"], #tools button:nth-child(2)'); 
  await page.mouse.move(800, 400); await page.mouse.move(810, 400); await wait(900);
  assert.equal((await look(page)).tools, '0', 'and go again');
  await page.evaluate(() => window.__gs.fullSideSet('hide'));
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.fullSide')), null, 'the usual way is not stored');
  await settle(page);
  assert.deepEqual(page.errors, []);
  await close();
});
