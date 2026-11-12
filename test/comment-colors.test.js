// A comment's color can be changed after it is made: the ink (words and line) and, for a comment on highlighted
// words, the highlight behind them. Typed text boxes get the same choice in their bar. One Ctrl Z takes it back.
// A new comment's line can be dragged before anything is typed, and Enter finishes a comment (Shift Enter is a new line).
// Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, at, clickAt, setTool } = require('./helpers/app');
const { zipOf } = require('./helpers/fixtures');

let browser, zip;
async function typedPaper() {
  const doc = await PDFDocument.create(), f = await doc.embedFont(StandardFonts.Helvetica);
  const pg = doc.addPage([612, 792]); for (let i = 0; i < 12; i++) pg.drawText('The quick brown fox jumps over the lazy dog again', { x: 72, y: 792 - (100 + i * 18), size: 12, font: f, color: rgb(0, 0, 0) });
  doc.setCreationDate(new Date('2026-09-01T12:00:00Z')); doc.setModificationDate(new Date('2026-09-01T12:00:00Z'));
  return doc.save();
}
before(async () => { browser = await launch(); zip = zipOf({ 'Aria Testwell/Essay.pdf': await typedPaper() }); });
after(async () => { await browser.close(); });

const marks = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().pages[0].marks())));
async function open(page) {
  await openZip(page, zip, 'Colors.zip');
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p && p.bmp && p.tl; });
}
async function openBox(page) {   // a click on the comment's box in the margin opens it again
  const b = await page.evaluate(() => { const b = window.__gs.state().pages[0].boxes[0]; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
  await clickAt(page, 0, b.x, b.y);
  await page.waitForSelector('.pop [data-nc]');
}

test('a comment already made can be put in another color; Escape keeps the old one, Ctrl Z takes a change back', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await page.evaluate(() => window.__gs.setTool('note'));
  await clickAt(page, 0, 300, 120);
  await page.waitForSelector('.pop textarea');
  await page.keyboard.type('Say more here.');
  await page.click('.pop [data-a="ok"]');
  const red = (await marks(page))[0].color;
  assert.equal((await marks(page)).length, 1);
  // Opened again: the color it has is the one pressed.
  await openBox(page);
  assert.equal(await page.$eval('.pop [data-nc][aria-pressed="true"]', b => b.dataset.nc), 'red');
  assert.equal(await page.$('.pop [data-nh]'), null, 'no highlight row on a comment without a highlight');
  // A color picked shows on the paper at once, but Escape puts it back.
  await page.click('.pop [data-nc="blue"]');
  assert.equal((await marks(page))[0].color, '#1F5FD1', 'shown straight away');
  await page.keyboard.press('Escape');
  assert.equal((await marks(page))[0].color, red, 'Escape keeps the old color');
  // Done keeps it, and one undo goes back.
  await openBox(page);
  await page.click('.pop [data-nc="purple"]');
  await page.click('.pop [data-a="ok"]');
  let m = (await marks(page))[0];
  assert.equal(m.color, '#7B3FC4'); assert.equal(m.text, 'Say more here.');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.ink')), null, 'the pen keeps its own color');
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page))[0].color, red, 'one undo puts the old color back');
  await page.evaluate(() => window.__gs.redo());
  assert.equal((await marks(page))[0].color, '#7B3FC4');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a new comment can change color while it is being typed', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await clickAt(page, 0, 300, 140);
  await page.waitForSelector('.pop [data-nc]');
  await page.keyboard.type('Good start');
  await page.click('.pop [data-nc="blue"]');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'TEXTAREA', 'she can keep typing');
  await page.keyboard.type(', now add a quote.');
  await page.click('.pop [data-a="ok"]');
  const m = (await marks(page))[0];
  assert.equal(m.color, '#1F5FD1'); assert.equal(m.text, 'Good start, now add a quote.');
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, 0, 'one undo takes the new comment away');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a comment on highlighted words can change its highlight too', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await page.evaluate(() => {
    const pg = window.__gs.state().pages[0];
    pg.marks().push({ t: 'note', color: '#D7263D', ax: 300, ay: 110, hl: { x: 72, y: 96, w: 228, h: 16 }, hc: '#FFE45C', text: 'Nice verb.' });
    window.__gs.draw(pg);
  });
  await openBox(page);
  assert.equal(await page.$eval('.pop [data-nh][aria-pressed="true"]', b => b.dataset.nh), 'yellow');
  await page.click('.pop [data-nh="pink"]');
  await page.click('.pop [data-nc="green"]');
  await page.click('.pop [data-a="ok"]');
  const m = (await marks(page))[0];
  assert.equal(m.hc, '#FFB8D6'); assert.equal(m.color, '#1E8A4C');
  await page.evaluate(() => window.__gs.undo());
  const back = (await marks(page))[0];
  assert.equal(back.hc, '#FFE45C'); assert.equal(back.color, '#D7263D');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a typed text box can change color from its bar', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'text');
  await clickAt(page, 0, 100, 400);
  await page.waitForSelector('.pg .ed');
  await page.keyboard.type('Good hook');
  await page.click('.pg .edbar [data-tc="blue"]');
  assert.equal(await page.$eval('.pg .ed', t => getComputedStyle(t).color), 'rgb(31, 95, 209)', 'the words turn blue as she types');
  await page.keyboard.press('Escape');
  assert.equal((await marks(page))[0].color, '#1F5FD1');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.ink')), null, 'the pen keeps its own color');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a new comment\'s line can be dragged before typing; the box stays open, and Enter finishes it', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await clickAt(page, 0, 300, 140);
  await page.waitForSelector('.pop textarea');
  // The line runs across the page from the spot to the margin; drag it down from a point along it.
  const ry = await page.evaluate(() => window.__gs.state().pages[0].boxes[0].ry);
  const p = await at(page, 0, 420, ry);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  const q = await at(page, 0, 420, ry + 9);
  await page.mouse.move(q.x, q.y, { steps: 6 }); await page.mouse.up();
  assert.ok(await page.$('.pop textarea'), 'the comment box is still open');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'TEXTAREA', 'and ready for typing');
  await page.keyboard.type('First line');
  await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
  await page.keyboard.type('second line');
  assert.ok(await page.$('.pop textarea'), 'Shift Enter keeps it open');
  await page.keyboard.press('Enter');
  assert.equal(await page.$('.pop'), null, 'Enter finishes it');
  const m = (await marks(page))[0];
  assert.equal(m.text, 'First line\nsecond line');
  assert.ok(m.ly != null && Math.abs(m.ly - (ry + 9)) < 3, 'the line stays where it was dragged: ' + [m.ly, ry]);
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, 0, 'one undo takes the whole new comment away');
  assert.deepEqual(page.errors, []);
  await close();
});

test('an open comment\'s line moved and then Escape puts the line back', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await page.evaluate(() => { const pg = window.__gs.state().pages[0]; pg.marks().push({ t: 'note', color: '#D7263D', ax: 300, ay: 140, text: 'Why?' }); window.__gs.draw(pg); });
  await setTool(page, 'note');
  await openBox(page);
  const p = await at(page, 0, 420, 140), q = await at(page, 0, 420, 152);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y, { steps: 6 }); await page.mouse.up();
  assert.ok((await marks(page))[0].ly > 145, 'moved while open');
  await page.keyboard.press('Escape');
  assert.equal((await marks(page))[0].ly, undefined, 'Escape puts the line back');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Enter finishes a text box too; Shift Enter is a new line', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'text');
  await clickAt(page, 0, 100, 400);
  await page.waitForSelector('.pg .ed');
  await page.keyboard.type('One');
  await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
  await page.keyboard.type('Two');
  await page.keyboard.press('Enter');
  assert.equal(await page.$('.pg .ed'), null);
  assert.equal((await marks(page))[0].text, 'One\nTwo');
  assert.deepEqual(page.errors, []);
  await close();
});
