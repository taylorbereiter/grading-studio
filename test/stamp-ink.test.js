// Grade stamps (the score stamp and criterion stamps) are red, never the pen's color. The pen is also the color of new comments,
// so a teacher who writes comments in purple must not get purple grades, on stamps placed now or before. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip } = require('./helpers/app');
const { zipOf, makePaper } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence'], outOf: 8 };
const placeAt = async (page, fx, fy) => {
  const c = await page.evaluate((fx, fy) => { const pg = window.__gs.state().pages[0], r = pg.canvas.getBoundingClientRect(); return { x: r.left + pg.W * pg.s * fx, y: r.top + pg.H * pg.s * fy }; }, fx, fy);
  await page.mouse.move(c.x, c.y); await page.mouse.click(c.x, c.y);
};
// Counts reddish and purplish pixels inside the score stamp's box on the first page.
const inks = page => page.evaluate(() => {
  const pg = window.__gs.state().pages[0], cv = pg.canvas, k = cv.width / (pg.W + (pg.side || 0));
  const m = Object.values(window.__gs.state().batch.students[0].files[0].marks).flat().find(m => m.k === 'score');
  const w = 80 * k, h = 50 * k;
  const d = cv.getContext('2d').getImageData(Math.round(m.x * k - w / 2), Math.round(m.y * k - h / 2), Math.round(w), Math.round(h)).data;
  let red = 0, purple = 0;
  for (let i = 0; i < d.length; i += 4) { const [r, g, b] = [d[i], d[i + 1], d[i + 2]]; if (r > 150 && g < 90 && b < 100) red++; if (b > 130 && r > 80 && r < 160 && g < 100) purple++; }
  return { red, purple };
});

test('with a purple pen, score and criterion stamps are red, and an old purple stamp draws red too', async () => {
  const { page, close } = await openApp(browser, { beforeLoad: p => p.evaluateOnNewDocument(s => { if (!localStorage.getItem('gs.setup')) localStorage.setItem('gs.setup', s); localStorage.setItem('gs.ink', JSON.stringify('purple')); }, JSON.stringify(SETUP)) });
  await openZip(page, zipOf({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) }), 'Ink.zip');
  await page.waitForSelector('#grade .crit');
  await page.click('#grade .scores[data-c="0"] button[data-v="3"]');
  await page.click('#grade .scores[data-c="1"] button[data-v="4"]');
  await page.waitForSelector('[data-critstamp="0"]');
  await page.click('[data-critstamp="0"]'); await placeAt(page, 0.5, 0.5);
  await page.waitForSelector('#stampScore'); await page.click('#stampScore'); await placeAt(page, 0.8, 0.1);
  const marks = () => page.evaluate(() => Object.values(window.__gs.state().batch.students[0].files[0].marks).flat().filter(m => m.t === 'stamp').map(m => ({ k: m.k, color: m.color })));
  assert.deepEqual((await marks()).sort((a, b) => a.k < b.k ? -1 : 1), [{ k: 'crit', color: '#D7263D' }, { k: 'score', color: '#D7263D' }]);
  // a score stamp saved purple before this fix still draws red
  await page.evaluate(() => { const st = window.__gs.state().batch.students[0]; for (const m of Object.values(st.files[0].marks).flat()) if (m.t === 'stamp') m.color = '#7B3FC4'; window.__gs.redrawAll(); });
  await new Promise(r => setTimeout(r, 300));
  const at = await inks(page);
  assert.ok(at.red > 20, 'the stamp is drawn red: ' + JSON.stringify(at));
  assert.equal(at.purple, 0, 'no purple in it: ' + JSON.stringify(at));
  assert.deepEqual(page.errors, []);
  await close();
});
