// The right-click menu as a way to use any tool once: circle or highlight a typed word, draw one circle or highlight,
// write with the pen, add a text box, delete a mark. Whatever tool she was on (usually Comment) stays picked.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, menuPick, openZip, at, drag, setTool } = require('./helpers/app');
const { zipOf } = require('./helpers/fixtures');

const LINE = 'The quick brown fox jumps over the lazy dog and keeps on running far away';
let browser, zip;
async function typedPaper() {
  const doc = await PDFDocument.create(), f = await doc.embedFont(StandardFonts.Helvetica);
  const pg = doc.addPage([612, 792]); for (let i = 0; i < 12; i++) pg.drawText(LINE, { x: 72, y: 792 - (100 + i * 18), size: 12, font: f, color: rgb(0, 0, 0) });
  doc.setCreationDate(new Date('2026-09-01T12:00:00Z')); doc.setModificationDate(new Date('2026-09-01T12:00:00Z'));
  return doc.save();
}
before(async () => { browser = await launch(); zip = zipOf({ 'Aria Testwell/Essay.pdf': await typedPaper() }); });
after(async () => { await browser.close(); });

const marks = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().pages[0].marks())));
const ui = page => page.evaluate(() => window.__gs.ui());
const once = page => page.evaluate(() => window.__gs.once());
async function open(page) {
  await openZip(page, zip, 'Tools.zip');
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p && p.bmp && p.tl; });
  await page.evaluate(() => window.__gs.stickersReady);
}
async function rightClick(page, x, y) {
  for (let i = 0; i < 3; i++) {
    const p = await at(page, 0, x, y);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    if (await page.waitForSelector('.stampmenu', { timeout: 1500 }).catch(() => null)) return;
  }
  throw new Error('the menu did not open');
}
// "quick" on the first line: the line's baseline is 100 points down, and the word starts after "The ".
const QUICK = [105, 96];

test('the menu is short: a comment first, then the tools, with the long lists in panels', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await rightClick(page, ...QUICK);
  const rows = await page.$$eval('.stampmenu > button', bs => bs.map(b => b.querySelector('.st-lb').firstChild.textContent));
  assert.deepEqual(rows, ['Add a comment here', 'Check mark', 'Circle', 'Highlight', 'Text box here', 'Write with the pen', 'Punctuation', 'Proofreading marks', 'Stickers']);
  assert.equal(await page.$$eval('.stampmenu .st-fly:not([hidden])', f => f.length), 0, 'no panel is open to start with');
  // Pointing at a row opens its panel beside the menu, inside the window.
  await page.hover('.stampmenu [data-sub="proof"]');
  await page.waitForSelector('.stampmenu [data-fly="proof"]:not([hidden])');
  const [m, f] = await page.evaluate(() => [document.querySelector('.stampmenu'), document.querySelector('[data-fly="proof"]')].map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }));
  assert.ok(f[0] >= m[1] || f[1] <= m[0], 'the panel sits beside the menu: ' + m + ' / ' + f);
  assert.ok(f[3] <= await page.evaluate(() => innerHeight), 'and fits the window');
  await page.hover('.stampmenu [data-sub="stick"]');
  await page.waitForSelector('.stampmenu [data-fly="stick"]:not([hidden])');
  assert.ok(await page.$eval('[data-fly="proof"]', f => f.hidden), 'pointing at another row swaps the panel');
  await page.keyboard.press('Escape');
  assert.equal(await page.$('.stampmenu'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('circle or highlight a typed word in one click, and stay on Comment', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await rightClick(page, ...QUICK);
  await menuPick(page, '[data-act="circleWord"]');
  let ms = await marks(page);
  assert.equal(ms.length, 1); assert.equal(ms[0].t, 'oval');
  assert.ok(ms[0].x < 94 && ms[0].x > 80 && ms[0].x + ms[0].w > 119 && ms[0].x + ms[0].w < 132, 'around "quick": ' + [ms[0].x, ms[0].w]);
  assert.ok(ms[0].y < 88 && ms[0].y + ms[0].h > 102, 'and the height of the line: ' + [ms[0].y, ms[0].h]);
  assert.equal((await ui(page)).tool, 'note', 'still on Comment');
  await rightClick(page, 140, 114);   // "brown" on the second line
  await menuPick(page, '[data-act="hlWord"]');
  ms = await marks(page);
  assert.equal(ms[1].t, 'hl');
  assert.ok(ms[1].x > 120 && ms[1].x < 130 && ms[1].x + ms[1].w > 150 && ms[1].x + ms[1].w < 162, 'just "brown": ' + [ms[1].x, ms[1].w]);
  assert.equal((await ui(page)).tool, 'note', 'still on Comment');
  // Away from typed text, Circle draws one instead.
  await rightClick(page, 300, 600);
  assert.equal(await page.$('.stampmenu [data-sub="circle"]'), null);
  assert.ok(await page.$('.stampmenu > [data-act="oval"]'), 'Draw a circle, straight from the menu');
  assert.equal(await page.$('.stampmenu [data-act="hlWord"]'), null, 'and no word to highlight');
  await page.keyboard.press('Escape');
  assert.deepEqual(page.errors, []);
  await close();
});

test('draw one circle or highlight, then back to Comment; Esc cancels', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await rightClick(page, 300, 600);
  await page.click('.stampmenu > [data-act="oval"]');
  assert.deepEqual(await once(page), { k: 'oval', prev: 'note' });
  assert.equal((await ui(page)).tool, 'oval');
  assert.ok(await page.$('.oncepill'), 'a note says it is for one circle');
  assert.equal(await page.$eval('#tools [data-tool="note"]', b => b.getAttribute('aria-pressed')), 'true', 'Comment still shows as her tool');
  assert.ok(await page.$eval('#tools [data-tool="oval"]', b => b.classList.contains('once')), 'Circle is outlined');
  await drag(page, 0, [[200, 500], [260, 530], [300, 540]]);
  let ms = await marks(page);
  assert.equal(ms.length, 1); assert.equal(ms[0].t, 'oval');
  assert.equal((await ui(page)).tool, 'note', 'back on Comment');
  assert.equal(await once(page), null); assert.equal(await page.$('.oncepill'), null);
  // A drag over a mark draws over it, and doesn't pick it up.
  await rightClick(page, 300, 650);
  await menuPick(page, '[data-act="hl"]');
  assert.equal((await ui(page)).tool, 'hl');
  await drag(page, 0, [[150, 96], [250, 96]]);
  ms = await marks(page);
  assert.equal(ms.length, 2); assert.equal(ms[1].t, 'hl');
  assert.equal((await ui(page)).tool, 'note');
  // Esc cancels one, with nothing drawn.
  await rightClick(page, 300, 650);
  await page.click('.stampmenu > [data-act="oval"]');
  await page.keyboard.press('Escape');
  assert.equal((await ui(page)).tool, 'note'); assert.equal(await once(page), null);
  // Picking a tool herself ends it too, and keeps that tool.
  await rightClick(page, 300, 650);
  await page.click('.stampmenu > [data-act="oval"]');
  await page.keyboard.press('p');
  assert.equal((await ui(page)).tool, 'pen'); assert.equal(await once(page), null); assert.equal(await page.$('.oncepill'), null);
  assert.equal((await marks(page)).length, 2);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the pen stays for several strokes until Done; a text box opens for typing; both leave Comment picked', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await rightClick(page, 300, 600);
  await page.click('.stampmenu [data-act="pen"]');
  assert.equal((await ui(page)).tool, 'pen');
  await drag(page, 0, [[100, 600], [130, 620], [160, 600]]);
  await drag(page, 0, [[180, 600], [200, 630]]);
  assert.equal((await marks(page)).filter(m => m.t === 'pen').length, 2);
  assert.equal((await ui(page)).tool, 'pen', 'still writing');
  await page.click('.oncepill [data-done]');
  assert.equal((await ui(page)).tool, 'note', 'Done goes back to Comment');
  await rightClick(page, 100, 680);
  await page.click('.stampmenu [data-act="text"]');
  await page.waitForSelector('textarea.ed');
  await page.keyboard.type('See me');
  await page.evaluate(() => document.activeElement.blur());
  await page.evaluate(() => window.__gs.setTool('note'));   // commits the box, as any click elsewhere would
  const t = (await marks(page)).find(m => m.t === 'text');
  assert.equal(t.text, 'See me');
  assert.ok(Math.abs(t.x - 100) < 1.5, 'where she clicked: ' + t.x);
  assert.deepEqual(page.errors, []);
  await close();
});

test('right-click on a mark deletes it; the ink color can be changed from the menu; the keyboard reaches the panels', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await page.evaluate(() => { const pg = window.__gs.state().pages[0]; pg.marks().push({ t: 'check', color: '#D7263D', x: 300, y: 600, size: 22 }); window.__gs.draw(pg); });
  await rightClick(page, 300, 600);
  assert.ok(await page.$('.stampmenu > [data-act="del"]'), 'Delete this mark is offered');
  await page.click('.stampmenu [data-act="del"]');
  assert.equal((await marks(page)).length, 0);
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, 1, 'undo brings it back');
  await rightClick(page, 400, 650);
  assert.equal(await page.$('.stampmenu [data-act="del"]'), null, 'not on an empty spot');
  // Ink: the menu is drawn again in the new color, and the toolbar follows.
  await page.click('.stampmenu [data-ink-pick="blue"]');
  assert.equal(await page.$eval('.stampmenu [data-ink-pick="blue"]', b => b.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.$eval('#tools [data-ink="blue"]', b => b.getAttribute('aria-pressed')), 'true');
  // Keyboard: down to Proofreading marks, right into its panel, Enter on the first one (Grammar).
  await page.focus('.stampmenu [data-sub="proof"]');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.mark), 'gr');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.sub), 'proof', 'Left goes back to the menu');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  const gr = (await marks(page)).find(m => m.k === 'gr');
  assert.ok(gr, 'the mark went on'); assert.equal(gr.color, '#1F5FD1', 'in the blue ink');
  assert.equal((await ui(page)).tool, 'note');
  assert.deepEqual(page.errors, []);
  await close();
});
