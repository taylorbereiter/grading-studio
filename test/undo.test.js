// Ctrl Z for everything: lighting and other settings on the marking screen, the classes, units, gradebook and settings
// everywhere else, and the lesson in the Planner's slide editor. Every student and class here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { launch } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const { openApp, openZip, goTo, answerDlg } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const ctrl = async (page, key, shift) => {
  await page.keyboard.down('Control'); if (shift) await page.keyboard.down('Shift');
  await page.keyboard.press(key);
  if (shift) await page.keyboard.up('Shift'); await page.keyboard.up('Control');
};
const toast = page => page.$eval('.toast', t => t.hidden ? '' : t.textContent);

test('lighting is one Ctrl Z a change, a slider drag is one step, and Shift Ctrl Z puts it back', async () => {
  const { page, close } = await openApp(browser);
  try {
    await openZip(page, zip);
    const light = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.light || {})));
    await page.$eval('#lightBtn', b => b.click());
    await page.waitForSelector('#lightPanel input[data-l="c"]');
    // A drag: many values in a row, then let go.
    for (const v of [20, 60, 120, 180]) await page.$eval('#lightPanel input[data-l="c"]', (i, v) => { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    assert.equal((await light())['*'].c, 180);
    await page.$eval('#lightPanel input[data-lg]', i => i.click());   // Black and white, a second change
    assert.equal((await light())['*'].g, 1);
    await page.$eval('#lightPanel', p => p.focus());
    await ctrl(page, 'z');
    assert.equal((await light())['*'].g, 0, 'the last change first');
    assert.equal((await light())['*'].c, 180, 'the drag is still there');
    assert.match(await toast(page), /Undone: lighting/);
    await ctrl(page, 'z');
    assert.deepEqual(await light(), {}, 'the whole drag in one step: lighting as it was before');
    assert.equal(await page.$eval('#lightPanel input[data-l="c"]', i => i.value), '0', 'the panel shows it');
    await ctrl(page, 'z', true);
    assert.equal((await light())['*'].c, 180, 'Shift Ctrl Z does it again');
    await ctrl(page, 'y');
    assert.equal((await light())['*'].g, 1, 'and so does Ctrl Y');
    assert.deepEqual(page.errors, []);
  } finally { await close(); }
});

test('a page taken out and a page’s lighting switched off come back with Ctrl Z', async () => {
  const { page, close } = await openApp(browser);
  try {
    await openZip(page, zip);
    await page.evaluate(() => { const b = window.__gs.state().batch; b.light = { '*': { b: 0, c: 100, d: 0, s: 0, g: 0 } }; window.__gs.lightChips(); });
    await page.waitForFunction(() => { const p = window.__gs.state().pages; return p.length >= 2 && p.every(q => q.chip && !q.chip.hidden); }, { timeout: 30000 });
    await page.evaluate(() => window.__gs.state().pages[0].chip.querySelector('[data-lpg]').click());
    const lit = () => page.evaluate(() => { const G = window.__gs, s = G.state(), a = s.pages[0]; return !!G.lightForPage(s.batch.students[s.cur], a.file, a.idx); });
    assert.equal(await lit(), false);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await ctrl(page, 'z');
    assert.equal(await lit(), true, 'the page’s lighting is on again');
    const n = await page.evaluate(() => window.__gs.state().pages.length);
    await page.evaluate(() => window.__gs.state().pages[0].rchip.querySelector('[data-pgout]').click());
    await page.waitForFunction(n => window.__gs.state().pages.length === n - 1, {}, n);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await ctrl(page, 'z');
    await page.waitForFunction(n => window.__gs.state().pages.length === n, {}, n);
    assert.deepEqual(page.errors, []);
  } finally { await close(); }
});

test('away from the marking screen, Ctrl Z takes back a deleted unit, Ctrl Y deletes it again, and a text box keeps its own undo', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  try {
    await goTo(page, '#/class/c1');
    const units = () => page.evaluate(() => window.__gs.state().lib.classes[0].units.map(u => u.name));
    const was = await units();
    await page.waitForSelector('[data-udel]');
    await page.$eval('[data-udel]', b => b.click());
    await answerDlg(page);
    await page.waitForFunction(n => window.__gs.state().lib.classes[0].units.length === n - 1, {}, was.length);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await ctrl(page, 'z');
    assert.deepEqual(await units(), was, 'the unit is back, in its place');
    assert.match(await toast(page), /^Undone: “/);
    await page.waitForFunction(() => document.querySelector('[data-udel]'));
    await ctrl(page, 'y');
    assert.equal((await units()).length, was.length - 1, 'Ctrl Y deletes it again');
    await ctrl(page, 'z');
    // In a text box Ctrl Z is the box's: the library stays as it is.
    await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tbox'; document.body.appendChild(i); i.focus(); });
    await page.keyboard.type('abc');
    await ctrl(page, 'z');
    assert.deepEqual(await units(), was, 'nothing taken back from a text box');
    assert.deepEqual(page.errors, []);
  } finally { await close(); }
});

test('in the Planner’s slide editor Ctrl Z takes back a slide added, and Shift Ctrl Z adds it again', async () => {
  const server = await serve(() => require('fs').readFileSync(path.join(__dirname, '..', 'planner.html'), 'utf8'));
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    await page.evaluate(() => { const P = window.__planner, l = P.deckStart(P.normLesson({ title: 'Made up', slots: [], slides: [{ layout: 'content', title: 'One' }, { layout: 'content', title: 'Two' }] })); P.L.lessons.push(l); P.openLessonForTest(l, 0); });
    const n = () => page.evaluate(() => window.__planner.L.open.slides.length);
    const n0 = await n();
    await page.$eval('[data-a="dup"]', b => b.click());
    assert.equal(await n(), n0 + 1);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await ctrl(page, 'z');
    assert.equal(await n(), n0, 'the copy is gone');
    await ctrl(page, 'z', true);
    assert.equal(await n(), n0 + 1, 'and back');
    assert.deepEqual(errors, []);
  } finally { await page.close(); await server.close(); }
});
