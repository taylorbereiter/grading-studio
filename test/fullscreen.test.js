// Full screen (src/fullscreen.js): F or the Full screen button puts the whole page in the browser's full screen, on the grading page
// and in the Planner. The sidebar folds to icons, and goes while a paper is open. Leaving it loses nothing, and Present still
// works on top of it. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const { openApp, openZip, score, settle, goTo } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

const wait = ms => new Promise(r => setTimeout(r, ms));
// Asked from here, not waited for inside the page: a page going in or out of full screen can leave an in-page wait hanging.
const until = async (page, fn, arg) => { for (let i = 0; i < 160; i++) { if (await page.evaluate(fn, arg)) return; await wait(50); } throw new Error('Waited too long for ' + fn); };
const full = page => page.evaluate(() => ({ doc: document.fullscreenElement === document.documentElement, any: !!document.fullscreenElement, cls: document.documentElement.classList.contains('gsfull') }));
const isFull = () => document.fullscreenElement === document.documentElement && document.documentElement.classList.contains('gsfull');
const notFull = () => !document.fullscreenElement && !document.documentElement.classList.contains('gsfull');

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({
    'Ann Example/Essay.pdf': await makePaper({ title: 'Ann Example essay', pages: 1 }),
    'Ben Specimen/Essay.pdf': await makePaper({ title: 'Ben Specimen essay', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

test('on the marking screen F fills the screen, the sidebar goes, and leaving keeps every score', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  const before = await page.evaluate(() => ({ rail: document.querySelector('#rail').getBoundingClientRect().width, paper: document.querySelector('#paper').getBoundingClientRect().width }));
  assert.ok(before.rail > 0, 'the folded sidebar shows before');
  // the top bar has the button; the sidebar's own is not shown twice
  assert.equal(await page.$eval('#fullBtn', b => b.checkVisibility()), true);
  assert.equal(await page.$eval('#railFull', b => b.checkVisibility()), false);
  await score(page, [3, 2]);
  const kept = await page.evaluate(() => JSON.stringify(window.__gs.state().batch.students[0].grade));
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('f');
  await until(page, isFull);
  const inFull = await page.evaluate(() => ({ rail: document.querySelector('#rail').checkVisibility(), paper: document.querySelector('#paper').getBoundingClientRect().width, pressed: document.querySelector('#fullBtn').getAttribute('aria-pressed'), title: document.querySelector('#fullBtn').title }));
  assert.equal(inFull.rail, false, 'the sidebar goes while a paper is open');
  assert.ok(inFull.paper > before.paper, 'the paper gets the room');
  assert.equal(inFull.pressed, 'true');
  assert.match(inFull.title, /Leave full screen/);
  // the next student opens as usual in full screen
  await page.keyboard.press('ArrowRight');
  await until(page, () => window.__gs.state().cur === 1);
  assert.deepEqual(await full(page), { doc: true, any: true, cls: true });
  // the browser leaving full screen (Esc does this) changes only the look
  await page.evaluate(() => document.exitFullscreen());
  await until(page, notFull);
  await page.keyboard.press('ArrowLeft');
  await until(page, () => window.__gs.state().cur === 0);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gs.state().batch.students[0].grade)), kept);
  assert.match(await page.$eval('#grade', e => e.textContent), /\d/);
  assert.equal(await page.$eval('#rail', e => e.checkVisibility()), true);
  // the button goes in and out too
  await page.click('#fullBtn'); await until(page, isFull);
  await page.click('#fullBtn'); await until(page, notFull);
  await settle(page);
  assert.deepEqual(page.errors, []);
  await close();
});

test('on other screens the sidebar button and Find anything do it, the sidebar folds, and F in a text box is just a letter', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/help');
  assert.equal(await page.$eval('#railFull', b => b.checkVisibility()), true);
  assert.equal(await page.$eval('#railFull .rl', e => e.textContent), 'Full screen');
  await page.focus('#hlpIn'); await page.keyboard.press('f');
  await wait(300);
  assert.deepEqual(await full(page), { doc: false, any: false, cls: false });
  assert.equal(await page.$eval('#hlpIn', e => e.value), 'f');
  await page.click('#railFull');
  await until(page, isFull);
  assert.equal(await page.$eval('#rail', e => Math.round(e.getBoundingClientRect().width)), 60, 'the sidebar folds to icons');
  assert.equal(await page.$eval('#railFull', b => b.getAttribute('aria-label')), 'Leave full screen');
  // Find anything has it, by its other words too
  await page.click('#findBtn'); await page.waitForSelector('#findDlg .frow');
  await page.type('#findIn', 'maximize');
  await until(page, () => [...document.querySelectorAll('#findDlg .frow b')].some(b => b.textContent === 'Leave full screen'));
  await page.keyboard.press('Enter');
  await until(page, notFull);
  assert.equal(await page.$eval('#rail', e => Math.round(e.getBoundingClientRect().width)) > 60, true, 'the sidebar opens again');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Planner goes full screen too, and Present on top of it comes back to it', async () => {
  const server = await serve(() => fs.readFileSync(path.join(__dirname, '..', 'planner.html'), 'utf8'));
  const page = await (await browser.createBrowserContext()).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    await page.evaluate(async () => {
      const P = window.__planner, l = P.normLesson({ title: 'Reading a poem', fmt: 2, look: 'white', slots: [], slides: [{ layout: 'title', title: 'Reading a poem' }, { layout: 'content', title: 'Read aloud', body: '• Listen for the turn', size: 36 }] });
      P.L.lessons.push(l); P.openLessonForTest(l, 0);
    });
    await page.waitForSelector('[data-pr="present"]');
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.keyboard.press('f');
    await until(page, isFull);
    assert.equal(await page.$eval('#lessons', e => getComputedStyle(e).marginLeft), '60px');
    await page.$eval('[data-pr="present"]', b => b.click());
    await until(page, () => !!document.querySelector('#present') && document.fullscreenElement === document.querySelector('#present'));
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => window.__present.PR.i), 1);
    await page.evaluate(() => window.__present.end());
    await until(page, () => !document.querySelector('#present'));
    await wait(300);
    assert.deepEqual(await full(page), { doc: true, any: true, cls: true }, 'the Planner is still in full screen after presenting');
    await page.keyboard.press('f');
    await until(page, notFull);
    assert.deepEqual(errors, []);
  } finally { await page.browserContext().close(); await server.close(); }
});
