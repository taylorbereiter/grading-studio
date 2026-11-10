// Everyday use: dialogs at big app text, the More menu over the paper, and a text box just finished.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, at, clickAt, drag, setTool, goToStudent, press, closeBox } = require('./helpers/app');
const { makePaper, standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const marks = (page, k = 0) => page.evaluate(k => JSON.parse(JSON.stringify(window.__gs.state().pages[k].marks())), k);
const bigText = ui => ({ seed: { ls: { 'gs.disp': JSON.stringify({ ui }) } } });
async function typeBox(page, x, y, words) {
  await setTool(page, 'text'); await clickAt(page, 0, x, y);
  await page.waitForSelector('textarea.ed'); await page.keyboard.type(words); await page.keyboard.press('Escape');
}
const undoOff = page => page.$eval('#undoBtn', b => b.disabled);

/* ---------------- tall dialogs at Large and Extra large app text ---------------- */
// Every button in the dialog's foot, its close X and its title are all on screen, without scrolling anything.
const onScreen = page => page.evaluate(() => {
  const box = document.querySelector('#dlgBox'), r = box.getBoundingClientRect(), out = { top: r.top, bottom: r.bottom, h: innerHeight, off: [] };
  for (const el of box.querySelectorAll('.bh h2, .bh [data-close], .bf button')) {
    if (!el.checkVisibility()) continue;
    const q = el.getBoundingClientRect();
    if (q.top < 0 || q.bottom > innerHeight || q.left < 0 || q.right > innerWidth) out.off.push((el.textContent || el.tagName).trim() + ' at ' + Math.round(q.top) + '-' + Math.round(q.bottom));
  }
  return out;
});
const OPENERS = { 'Return': '#exportBtn', 'Insights': '#insightsTab', 'Rubric setup': '#setupBtn', 'Keys': '#keysBtn', 'Display': '#dispBtn', 'Grades': '#gradesBtn', 'Grade sheet': '#sheetBtn', 'Arrange pages': '#arrangeBtn' };
for (const [ui, W, H] of [[1.15, 1440, 900], [1.15, 1440, 760], [1.3, 1440, 760], [1.3, 1280, 680]]) test('at app text ' + ui + ' in a ' + W + 'x' + H + ' window, every tall dialog keeps its title and buttons on screen', async () => {
  const { page, close } = await openApp(browser, bigText(ui));
  await page.setViewport({ width: W, height: H });
  await openZip(page, zip);
  for (const [name, sel] of Object.entries(OPENERS)) {
    await page.evaluate(sel => document.querySelector(sel).click(), sel);
    await page.waitForFunction(() => !document.querySelector('#dlg').hidden && !/Reading the files first/.test(document.querySelector('#dlgBox').textContent), { timeout: 30000 });
    const s = await onScreen(page);
    assert.deepEqual(s.off, [], name + ' at ' + ui + ': the buttons on screen');
    assert.ok(s.top >= 0 && s.bottom <= s.h, name + ': the box fits, ' + s.top + ' to ' + s.bottom + ' in ' + s.h);
    await page.evaluate(() => { const x = document.querySelector('#dlgBox [data-close], #dlgBox [data-cancel]'); if (x) x.click(); });
    await page.waitForFunction(() => document.querySelector('#dlg').hidden || !!document.querySelector('#askDlg'), { timeout: 10000 });
    if (await page.$('#askDlg')) { await page.click('#askDlg [data-ok]'); await page.waitForFunction(() => document.querySelector('#dlg').hidden); }
  }
  assert.deepEqual(page.errors, []);
  await close();
});

for (const [ui, H] of [[1, 420], [1.3, 680]]) test('at app text ' + ui + ' in a window ' + H + ' tall, the bottom of the More menu can be reached', async () => {
  const { page, close } = await openApp(browser, bigText(ui));
  await page.setViewport({ width: 1280, height: H });
  await openZip(page, zip);
  await page.click('#moreBtn');
  const m = await page.$eval('#moreMenu', e => { const r = e.getBoundingClientRect(); return { bottom: r.bottom, scrolls: e.scrollHeight > e.clientHeight + 1, over: getComputedStyle(e).overflowY }; });
  assert.ok(m.bottom <= H, 'the menu ends on screen: ' + m.bottom);
  await page.$eval('#moreMenu .mfoot', e => e.scrollIntoView({ block: 'nearest' }));
  const k = await page.$eval('#moreMenu .mfoot', e => e.getBoundingClientRect().bottom);
  assert.ok(k <= H, 'scrolled to, its last rows show: ' + k);
  await close();
});

/* ---------------- the More menu over the paper ---------------- */
test('clicking the paper to close More closes it and makes no mark, with any tool', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  for (const t of ['pen', 'check', 'hl', 'oval']) {
    await setTool(page, t);
    await page.click('#moreBtn');
    await clickAt(page, 0, 300, 400);
    assert.equal(await page.$eval('#moreMenu', m => m.hidden), true, t + ': the menu closes');
    assert.deepEqual(await marks(page), [], t + ': no mark');
    assert.equal(await undoOff(page), true, t + ': nothing to undo');
  }
  for (const [t, sel] of [['text', 'textarea.ed'], ['note', '.pop textarea']]) {
    await setTool(page, t);
    await page.click('#moreBtn');
    await clickAt(page, 0, 300, 400);
    assert.equal(await page.$(sel), null, t + ': no editor opens');
  }
  // The next click marks as usual.
  await setTool(page, 'check'); await clickAt(page, 0, 300, 400);
  assert.equal((await marks(page)).length, 1, 'once it’s closed the paper works');
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- a text box just finished ---------------- */
test('Backspace or Delete right after finishing a box leaves the box alone; a box she clicks on can be deleted', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await typeBox(page, 100, 300, 'Typo here');
  for (const k of ['Backspace', 'Delete']) { await page.keyboard.press(k); assert.equal((await marks(page)).length, 1, k + ' leaves it'); }
  await setTool(page, 'select');
  await clickAt(page, 0, 110, 300);
  assert.equal(await page.$('textarea.ed'), null, 'the first click picks it');
  await page.keyboard.press('Delete');
  assert.equal((await marks(page)).length, 0, 'now Delete means it');
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, 1, 'and Undo brings it back');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a just-finished box: a swatch only sets the next color, until she clicks the box', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await typeBox(page, 100, 300, 'Red words');
  const was = (await marks(page))[0].color;
  const other = await page.$eval('.sw[data-ink][aria-pressed="false"]', b => b.dataset.ink);
  await page.click('.sw[data-ink="' + other + '"]');
  assert.equal((await marks(page))[0].color, was, 'the finished box keeps its color');
  assert.equal(await undoOff(page), false);
  const steps = await page.evaluate(() => document.querySelector('.sw[aria-pressed="true"]').dataset.ink);
  assert.equal(steps, other, 'the next box will use it');
  await setTool(page, 'select');
  await clickAt(page, 0, 110, 300);
  const third = await page.$eval('.sw[data-ink][aria-pressed="false"]', b => b.dataset.ink).catch(() => null);
  assert.equal(third, null, 'the Select tool has no swatches');
  assert.deepEqual(page.errors, []);
  await close();
});

// How much of the picked-mark blue is drawn in a box of the page, in points.
const blueIn = (page, k, x, y, w, h) => page.evaluate((k, x, y, w, h) => {
  const pg = window.__gs.state().pages[k], q = pg.canvas.width / (pg.W + pg.side), d = pg.canvas.getContext('2d').getImageData(Math.round(x * q), Math.round(y * q), Math.round(w * q), Math.round(h * q)).data;
  let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0x1F) < 40 && Math.abs(d[i + 1] - 0x6F) < 40 && Math.abs(d[i + 2] - 0xB2) < 40) n++;
  return n;
}, k, x, y, w, h);

test('clearing a box takes its outline and handles with it', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await typeBox(page, 100, 500, 'Soon gone');
  const [m] = await marks(page);
  assert.ok(await blueIn(page, 0, m.x - 8, m.y - 8, m.bw + 16, 30) > 0, 'it has its outline first');
  await clickAt(page, 0, m.x + 8, m.y + 6);
  await page.waitForSelector('textarea.ed');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.keyboard.press('Escape');
  assert.deepEqual(await marks(page), []);
  assert.equal(await blueIn(page, 0, m.x - 8, m.y - 8, m.bw + 16, 30), 0, 'nothing is left where it was');
  assert.deepEqual(page.errors, []);
  await close();
});

test('dragging Move while typing leaves no outline behind', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await typeBox(page, 100, 500, 'Going places');
  const [m] = await marks(page);
  await clickAt(page, 0, m.x + 8, m.y + 6);
  await page.waitForSelector('textarea.ed');
  const g = await page.$eval('.edbar [data-grip]', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const s = await page.evaluate(() => window.__gs.state().pages[0].s);
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + 40 * s, g.y + 100 * s, { steps: 4 });
  assert.equal(await blueIn(page, 0, m.x - 8, m.y - 8, m.bw + 16, 30), 0, 'nothing at the old spot');
  await page.mouse.up(); await page.keyboard.press('Escape');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a click on blank paper beside a short finished box starts a new box', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await typeBox(page, 100, 500, 'Hi');
  await clickAt(page, 0, 250, 500);
  await page.waitForSelector('textarea.ed');
  assert.equal(await page.$eval('textarea.ed', t => t.value), '', 'a new one, empty');
  await page.keyboard.type('Second'); await page.keyboard.press('Escape');
  assert.deepEqual((await marks(page)).map(m => m.text), ['Hi', 'Second']);
  // Its handles still work straight after typing.
  const m = (await marks(page))[1];
  await drag(page, 0, [[m.x + m.bw + 3, m.y + 8], [m.x + m.bw - 60, m.y + 8]]);
  assert.ok(Math.abs((await marks(page))[1].bw - (m.bw - 63)) < 2, 'the handle set its width');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a clicked box gets its width back after turns, and one word can be dragged right up to the edge', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await typeBox(page, 100, 150, 'Good');
  const was = (await marks(page))[0];
  const turn = async dir => {
    const w = await page.evaluate(() => window.__gs.state().pages[0].W);
    await page.evaluate(d => document.querySelector('[data-rot="' + d + '"]').click(), dir);
    await page.waitForFunction(w => Math.abs(window.__gs.state().pages[0].W - w) > 100 && window.__gs.state().pages[0].s > 0, {}, w);
  };
  await turn(1); await turn(-1);
  let [m] = await marks(page);
  assert.equal(m.bw, was.bw, 'back to the width it had');
  assert.equal(m.bwFull, undefined);
  assert.ok(Math.abs(m.x - was.x) < 0.5 && Math.abs(m.y - was.y) < 0.5, 'and the same spot');
  // Drag it far right: the words get there, and the empty part of the box gives way.
  await setTool(page, 'select');
  await drag(page, 0, [[m.x + 8, m.y + 8], [m.x + 8 + 400, m.y + 8]]);
  [m] = await marks(page);
  assert.ok(Math.abs(m.x - (was.x + 400)) < 1, 'it went where she dragged it: ' + m.x);
  assert.ok(m.x + m.bw <= 612 - 5.9, 'still all on the page');
  await drag(page, 0, [[m.x + 8, m.y + 8], [m.x + 8 - 400, m.y + 8]]);
  [m] = await marks(page);
  assert.equal(m.bw, was.bw, 'dragged back, it is as wide as before');
  assert.deepEqual(page.errors, []);
  await close();
});

test('dragging a highlight past the end of a short line stays on that line', async () => {
  const { PDFDocument, StandardFonts } = require('pdf-lib');
  for (const pitch of [15, 28]) {
    const doc = await PDFDocument.create(), f = await doc.embedFont(StandardFonts.Helvetica), pg = doc.addPage([612, 792]), LONG = 'The quick brown fox jumps over the lazy dog and keeps on running far away';
    pg.drawText(LONG, { x: 72, y: 792 - 100, size: 12, font: f });
    pg.drawText('Short end of a paragraph.', { x: 72, y: 792 - 100 - pitch, size: 12, font: f });
    pg.drawText(LONG, { x: 72, y: 792 - 100 - 2 * pitch, size: 12, font: f });
    const { page, close } = await openApp(browser);
    await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': await doc.save() }));
    await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p && p.bmp && p.tl; });
    await setTool(page, 'hl');
    const y = 100 + pitch - 4, end = 72 + f.widthOfTextAtSize('Short end of a paragraph.', 12);
    for (const past of [40, 80, 140, 250]) {
      await drag(page, 0, [[75, y], [end + past, y]]);
      const m = (await marks(page)).pop();
      assert.equal(m.rects, undefined, 'one line, at ' + past + ' past the end, pitch ' + pitch);
      assert.ok(Math.abs(m.y - (100 + pitch - 9.84)) < 1.5, 'the short line: ' + m.y);
      assert.ok(Math.abs(m.x + m.w - end) < 4, 'up to its last word: ' + (m.x + m.w));
    }
    // Going on down to the next line still works.
    await drag(page, 0, [[75, y], [200, y + pitch]]);
    assert.equal((await marks(page)).pop().rects.length, 2, 'two lines');
    assert.deepEqual(page.errors, []);
    await close();
  }
});

/* ---------------- keys and the More menu ---------------- */
test('with Setup open, nothing behind it gets a key, and tabbing out of it closes it', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 500], [200, 530]]);
  await setTool(page, 'select'); await clickAt(page, 0, 150, 515);
  await page.click('#moreBtn');
  await page.keyboard.press('Delete'); assert.equal((await marks(page)).length, 1, 'Delete');
  await page.keyboard.press('KeyN'); assert.equal(await page.evaluate(() => window.__gs.state().cur), 0, 'N');
  await page.keyboard.press('KeyP');
  assert.equal(await page.$eval('.tool[data-tool="select"]', b => b.getAttribute('aria-pressed')), 'true', 'P');
  assert.equal(await page.$eval('#moreMenu', m => m.hidden), false, 'and the menu is still up');
  // Enter still presses what is in the menu.
  await page.focus('#setupBtn'); await page.keyboard.press('Enter');
  await page.waitForSelector('#setupBody');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  // Past the last item the menu closes, and the keys are hers again.
  await page.click('#moreBtn'); await page.evaluate(() => [...document.querySelectorAll('#moreMenu button, #moreMenu a')].filter(e => e.checkVisibility()).pop().focus());
  for (let i = 0; i < 12 && !await page.$eval('#moreMenu', m => m.hidden); i++) await page.keyboard.press('Tab');
  assert.equal(await page.$eval('#moreMenu', m => m.hidden), true, 'it closed');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Lighting takes the keyboard, so Escape closes it; with no mark picked, Escape closes it from anywhere', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await press(page, '#lightBtn');
  await page.waitForSelector('#lightPanel');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'lightPanel');
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#lightPanel'), null, 'closed');
  await press(page, '#lightBtn');
  await page.waitForSelector('#lightPanel');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#lightPanel'), null, 'closed with the keyboard nowhere in particular');
  assert.deepEqual(page.errors, []);
  await close();
});

test('slow checks show a box straight away: Export and What opened', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  const says = await page.evaluate(() => { document.querySelector('#openRepBtn').click(); return document.querySelector('#dlgBox').textContent; });
  assert.match(says, /What opened.*Checking the files/s);
  await page.waitForSelector('#openRepBox', { timeout: 60000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  const exp = await page.evaluate(() => { document.querySelector('#exportBtn').click(); return document.querySelector('#dlgBox').textContent; });
  assert.match(exp, /Reading the files first/);
  await page.keyboard.press('KeyN');
  assert.equal(await page.evaluate(() => window.__gs.state().cur), 0, 'keys wait for the box like any other');
  await page.waitForSelector('#dlgBox .bf', { timeout: 60000 });
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- wording, and things that were cut off ---------------- */
test('the Late button stays inside its panel at narrow widths, and the save status is not squeezed by a long name', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  for (const w of [1100, 1000]) {
    await page.setViewport({ width: w, height: 800 });
    const r = await page.$eval('#gstat button[data-status="late"]', b => { const q = b.getBoundingClientRect(), p = document.querySelector('#grade').getBoundingClientRect(); return { r: q.right, p: p.right }; });
    assert.ok(r.r <= r.p, 'at ' + w + ': ' + r.r + ' in ' + r.p);
  }
  assert.deepEqual(page.errors, []);
  await close();
  const b = await openApp(browser);
  await b.page.setViewport({ width: 1280, height: 800 });
  await openZip(b.page, zip, 'An assignment with a very long name that goes on and on past anything sensible for a top bar to show at all.zip');
  const sw = await b.page.$eval('#saveWhere', e => [e.scrollWidth, e.clientWidth]);
  assert.ok(sw[0] <= sw[1] + 1, 'the status is not cut short: ' + sw);
  await b.close();
});

test('the class box does not promise Google Drive', async () => {
  const { page, close } = await openApp(browser);
  await page.click('#addClass'); await page.waitForSelector('#cName');
  assert.doesNotMatch(await page.$eval('#dlgBox', e => e.textContent), /Google Drive/);
  await close();
});

test('Export says how many files, without two counts that disagree', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 500], [200, 530]]);
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const t = await page.$eval('#dlgBox', e => e.textContent);
  assert.match(t, /\d files? ready\s*From \d students?/);
  assert.doesNotMatch(t, /no marks, or you left it out/);
  assert.doesNotMatch(t, /\d marked files?\b/);
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- moving on while a paper opens ---------------- */
test('moving to another student while a page is being fetched raises no error (the old Transport destroyed)', async () => {
  const files = {}; for (const n of ['Aaa One', 'Bbb Two', 'Ccc Three']) files[n + '/Essay.pdf'] = await makePaper({ title: n, pages: 3 });
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files));
  // The worst moment, every time: she moves on straight after a page is asked for, which closes the file it is coming from.
  await page.evaluate(async () => {
    const d = await pdfjsLib.getDocument({ data: window.__gs.state().batch.students[0].files[0].data.slice(), isEvalSupported: false }).promise;
    const P = Object.getPrototypeOf(d), g = P.getPage; d.destroy();
    P.getPage = function (n) { const r = g.call(this, n); if (window.__arm) { const i = window.__arm - 1; window.__arm = 0; window.__gs.openStudent(i); } return r; };
  });
  for (const i of [1, 2, 0, 1]) {
    await page.evaluate(i => { window.__arm = (i + 1) % 3 + 1; window.__gs.openStudent(i); }, i);
    await goToStudent(page, (i + 1) % 3);
  }
  await new Promise(r => setTimeout(r, 500));
  assert.deepEqual(page.errors, []);
  await close();
});
