// Mark colors (the ✗ / points ink and the ✓ color, remembered, in Quick mark and the tool dock), dragging a comment's line
// up or down off the words, and comments or text written from Quick mark. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, drag, setTool } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, quizZip, essayZip;
async function typedPaper() {
  const doc = await PDFDocument.create(), f = await doc.embedFont(StandardFonts.Helvetica);
  const pg = doc.addPage([612, 792]); for (let i = 0; i < 12; i++) pg.drawText('The quick brown fox jumps over the lazy dog again and again', { x: 72, y: 792 - (100 + i * 18), size: 12, font: f, color: rgb(0, 0, 0) });
  doc.setCreationDate(new Date('2026-09-01T12:00:00Z')); doc.setModificationDate(new Date('2026-09-01T12:00:00Z'));
  return doc.save();
}
before(async () => {
  browser = await launch();
  quizZip = zipOf({
    'Ann Example/Quiz scan.pdf': await makePaper({ title: 'Ann Example quiz', pages: 1 }),
    'Ben Specimen/Quiz scan.pdf': await makePaper({ title: 'Ben Specimen quiz', pages: 1 }),
  });
  essayZip = zipOf({ 'Aria Testwell/Essay.pdf': await typedPaper() });
});
after(async () => { await browser.close(); });

async function boxOn(page, n, a, b) {
  await page.waitForSelector('.qbpg[data-n="' + n + '"] canvas');
  const r = await page.$eval('.qbpg[data-n="' + n + '"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(r.x + a[0] * r.w, r.y + a[1] * r.h); await page.mouse.down();
  await page.mouse.move(r.x + b[0] * r.w, r.y + b[1] * r.h, { steps: 5 }); await page.mouse.up();
}
async function quickMark(page) {
  await openZip(page, quizZip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await boxOn(page, 0, [0.08, 0.1], [0.6, 0.18]);
  await boxOn(page, 0, [0.08, 0.22], [0.6, 0.3]);
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
}
const paperMarks = (page, i) => page.evaluate(i => JSON.parse(JSON.stringify(window.__gs.state().batch.students[i].files.flatMap(f => Object.values(f.marks).flat()))), i);

test('Quick mark: pick the ✗ and ✓ colors; marks already given change, and the choice is remembered', async () => {
  const { page, close } = await openApp(browser);
  await quickMark(page);
  await page.evaluate(() => { window.__gs.state().batch.quiz.qs[0].how = 'cx'; });   // ✓ and ✗ on this question
  await page.click('#qmBody .qmc[data-st="1"] .qmimg');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"]').classList.contains('wrong'));
  await page.click('[data-rest]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc.right').length === 1);
  assert.deepEqual((await paperMarks(page, 1)).filter(m => m.qz).map(m => m.color), ['#D7263D', '#D7263D'], 'red by default');
  assert.deepEqual((await paperMarks(page, 0)).filter(m => m.qz).map(m => m.t + m.color), ['check#1E8A4C'], 'green by default');
  await page.click('#qmInkBtn');
  await page.waitForSelector('#qmInkPop:not([hidden]) [data-qink="blue"]');
  await page.click('[data-qink="blue"]');
  await page.click('[data-qchk="purple"]');
  assert.deepEqual((await paperMarks(page, 1)).filter(m => m.qz).map(m => m.color), ['#1F5FD1', '#1F5FD1'], 'the ✗ turned blue');
  assert.deepEqual((await paperMarks(page, 0)).filter(m => m.qz).map(m => m.color), ['#7B3FC4'], 'the ✓ turned purple');
  assert.equal(await page.$eval('#qmBody .qmc[data-st="1"] .qmmk', e => getComputedStyle(e).color), 'rgb(31, 95, 209)', 'the card shows it too');
  const ls = await page.evaluate(() => [localStorage.getItem('gs.ink'), localStorage.getItem('gs.checkInk')]);
  assert.deepEqual(ls, ['"blue"', '"purple"']);
  // A click anywhere else closes the colors.
  await page.click('#qmProg');
  assert.equal(await page.$eval('#qmInkPop', e => e.hidden), true);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Quick mark: C writes a margin comment or text on that paper; marking again leaves it alone', async () => {
  const { page, close } = await openApp(browser);
  await quickMark(page);
  await page.focus('#qmBody .qmc[data-st="0"]');
  await page.keyboard.press('c');
  await page.waitForSelector('.qmned textarea');
  await page.keyboard.type('Check the units');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#qmBody .qmc[data-st="0"] .qmnote');
  let ms = (await paperMarks(page, 0)).filter(m => m.qzn);
  assert.equal(ms.length, 1); assert.equal(ms[0].t, 'note'); assert.equal(ms[0].text, 'Check the units');
  assert.ok(ms[0].ax > 300 && ms[0].ay > 70 && ms[0].ay < 150, 'at the right end of the answer box: ' + [ms[0].ax, ms[0].ay]);
  // Text on the page for Ben, from the button.
  await page.click('#qmBody .qmc[data-st="1"] [data-qnote]');
  await page.waitForSelector('#qmBody .qmc[data-st="1"] .qmned');
  await page.click('#qmBody .qmc[data-st="1"] [data-as="text"]');
  await page.keyboard.type('Nice');
  await page.click('#qmBody .qmc[data-st="1"] [data-nsave]');
  await page.waitForSelector('#qmBody .qmc[data-st="1"] .qmnote');
  ms = (await paperMarks(page, 1)).filter(m => m.qzn);
  assert.equal(ms[0].t, 'text'); assert.equal(ms[0].text, 'Nice');
  // Its color can be changed while typing it, and opening it again shows that color.
  await page.click('#qmBody .qmc[data-st="1"] .qmnote');
  await page.waitForSelector('#qmBody .qmc[data-st="1"] .qmned [data-qnc="red"][aria-pressed="true"]');
  await page.keyboard.type('!');
  await page.click('#qmBody .qmc[data-st="1"] [data-qnc="green"]');
  assert.equal(await page.$eval('#qmBody .qmc[data-st="1"] .qmned textarea', t => getComputedStyle(t).color), 'rgb(30, 138, 76)', 'the words turn green as she types');
  await page.click('#qmBody .qmc[data-st="1"] [data-nsave]');
  await page.waitForSelector('#qmBody .qmc[data-st="1"] .qmnote');
  ms = (await paperMarks(page, 1)).filter(m => m.qzn);
  assert.equal(ms[0].color, '#1E8A4C'); assert.equal(ms[0].text, 'Nice!');
  await page.click('#qmBody .qmc[data-st="1"] .qmnote');
  await page.waitForSelector('#qmBody .qmc[data-st="1"] .qmned [data-qnc="green"][aria-pressed="true"]');
  await page.click('#qmBody .qmc[data-st="1"] [data-nsave]');
  await page.waitForSelector('#qmBody .qmc[data-st="1"] .qmnote');
  assert.equal((await paperMarks(page, 1)).filter(m => m.qzn)[0].color, '#1E8A4C', 'saving again keeps the color she picked');
  // Marking the question wrong and clearing it again keeps the words.
  await page.click('#qmBody .qmc[data-st="0"] .qmimg');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="0"]').classList.contains('wrong'));
  await page.click('#qmBody .qmc[data-st="0"] .qmb.clr');
  await page.waitForFunction(() => !document.querySelector('#qmBody .qmc[data-st="0"]').classList.contains('wrong'));
  assert.equal((await paperMarks(page, 0)).filter(m => m.qzn).length, 1);
  assert.match(await page.$eval('#qmBody .qmc[data-st="0"] .qmnote', e => e.textContent), /Check the units/);
  // Changing it to nothing takes it off.
  await page.click('#qmBody .qmc[data-st="1"] .qmnote');
  await page.waitForSelector('#qmBody .qmc[data-st="1"] .qmned');
  await page.$eval('#qmBody .qmc[data-st="1"] .qmned textarea', t => { t.value = ''; });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#qmBody .qmc[data-st="1"] .qmnote') && !document.querySelector('.qmned'));
  assert.equal((await paperMarks(page, 1)).filter(m => m.qzn).length, 0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a comment’s line drags up or down off the words; the pen still writes across it on the page', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, essayZip, 'Essay.zip');
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p && p.bmp; });
  await page.evaluate(() => { const pg = window.__gs.state().pages[0]; pg.marks().push({ t: 'note', color: '#D7263D', ax: 300, ay: 205, text: 'Say more here' }); window.__gs.draw(pg); });
  const note = async () => (await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().pages[0].marks().find(m => m.t === 'note')))));
  await setTool(page, 'select');
  await drag(page, 0, [[480, 205], [480, 210], [480, 215]]);
  let n = await note();
  assert.ok(Math.abs(n.ly - 215) < 1.5, 'the line runs lower: ' + n.ly);
  assert.equal(n.ax, 300); assert.equal(n.ay, 205, 'the spot stays');
  const reddish = (y) => page.evaluate(y => {
    const pg = window.__gs.state().pages[0], k = pg.canvas.width / (pg.W + pg.side), q = pg.canvas.getContext('2d').getImageData(Math.round(420 * k), Math.round(y * k), Math.round(60 * k), Math.round(4 * k)).data;
    let n = 0; for (let i = 0; i < q.length; i += 4) if (q[i] - q[i + 1] > 25) n++; return n;
  }, y);
  await page.mouse.move(5, 5);   // off the page, so the line is drawn plain
  assert.ok(await reddish(213) > 0, 'the line is drawn at its new height');
  assert.equal(await reddish(203), 0, 'and not at the old one');
  // In the margin any tool can move it.
  await setTool(page, 'pen');
  const W = await page.evaluate(() => window.__gs.state().pages[0].W);
  await drag(page, 0, [[W + 7, 215], [W + 7, 222], [W + 7, 230]]);
  n = await note();
  assert.ok(Math.abs(n.ly - 230) < 1.5, 'moved from the margin: ' + n.ly);
  // Across the page, the pen writes over it.
  const before = (await page.evaluate(() => window.__gs.state().pages[0].marks().length));
  await drag(page, 0, [[450, 220], [470, 230], [490, 240]]);
  assert.equal(await page.evaluate(() => window.__gs.state().pages[0].marks().length), before + 1, 'a pen stroke');
  assert.ok(Math.abs((await note()).ly - 230) < 1.5);
  // Undo puts the line back.
  await page.evaluate(() => { window.__gs.undo(); window.__gs.undo(); });
  assert.ok(Math.abs((await note()).ly - 215) < 1.5, 'undo: ' + (await note()).ly);
  // Moving the comment carries its line with it.
  await setTool(page, 'select');
  await drag(page, 0, [[300, 205], [305, 215], [310, 225]]);
  n = await note();
  assert.ok(Math.abs(n.ay - 225) < 2 && Math.abs(n.ly - 235) < 2, 'moved together: ' + [n.ay, n.ly]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the check tool’s colors set the color every check shows in', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, essayZip, 'Essay.zip');
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p && p.bmp; });
  await setTool(page, 'check');
  await page.waitForSelector('#tools [data-chk="blue"]');
  assert.equal(await page.$eval('#tools [data-chk="green"]', b => b.getAttribute('aria-pressed')), 'true');
  await page.$eval('#tools [data-chk="blue"]', b => b.click());
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.checkInk')), '"blue"');
  await setTool(page, 'pen');
  assert.equal(await page.$('#tools [data-chk]'), null, 'the pen shows the ink colors');
  assert.equal(await page.$eval('#tools [data-ink="red"]', b => b.getAttribute('aria-pressed')), 'true', 'ink stays red');
  assert.deepEqual(page.errors, []);
  await close();
});
