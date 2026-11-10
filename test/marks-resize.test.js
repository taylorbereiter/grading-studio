// Quick punctuation and a Grammar mark in the right-click menu; resizing stickers, marks, checks, circles and text;
// a click off an open comment only closes it; and a click on a mark with any tool picks it up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, menuPick, openZip, at, clickAt, drag, setTool } = require('./helpers/app');
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
async function open(page) {
  await openZip(page, zip, 'Marks.zip');
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
const inkIn = (page, [x, y, w, h]) => page.evaluate((x, y, w, h) => {
  const pg = window.__gs.state().pages[0], s = pg.canvas.width / (pg.W + pg.side), q = pg.canvas.getContext('2d').getImageData(Math.round(x * s), Math.round(y * s), Math.round(w * s), Math.round(h * s)).data;
  let n = 0; for (let i = 0; i < q.length; i += 4) { const mx = Math.max(q[i], q[i + 1], q[i + 2]), mn = Math.min(q[i], q[i + 1], q[i + 2]); if (mx - mn > 40 || mx < 90) n++; }
  return n;
}, x, y, w, h);

test('the menu has quick punctuation and a Grammar mark, and each one draws', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await rightClick(page, 150, 400);
  const punct = await page.$$eval('.stampmenu .st-puncs [data-mark]', bs => bs.map(b => b.title));
  assert.deepEqual(punct, ['Add a period', 'Add a comma', 'Add an apostrophe', 'Add quotation marks', 'Add a semicolon', 'Add a colon', 'Add a question mark', 'Add an exclamation mark', 'Add a hyphen', 'Add a dash']);
  assert.equal(await page.$eval('.stampmenu .st-proofs [data-mark]', b => b.title), 'Grammar', 'Grammar comes first');
  await menuPick(page, '[data-mark="gr"]');
  let ms = await marks(page);
  assert.equal(ms[0].k, 'gr'); assert.ok(Math.abs(ms[0].x - 150) < 1.5 && Math.abs(ms[0].y - 400) < 1.5, 'where she clicked');
  await rightClick(page, 300, 400);
  await menuPick(page, '[data-mark="comma"]');
  assert.equal((await marks(page))[1].k, 'comma');
  const kinds = await page.evaluate(() => window.__gs.STAMP_KINDS.punct);
  await page.evaluate(kinds => { const pg = window.__gs.state().pages[0]; kinds.forEach((k, i) => window.__gs.placeStamp(pg, k, 60 + i * 50, 600)); }, kinds);
  for (let i = 0; i < kinds.length; i++) assert.ok(await inkIn(page, [60 + i * 50 - 10, 588, 20, 24]) > 3, kinds[i] + ' shows');
  assert.ok(await inkIn(page, [140, 392, 20, 16]) > 3, 'the circled gr shows');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a sticker grows by its corner, the next one comes out that size, and + / − step it', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await rightClick(page, 300, 500);
  await menuPick(page, '[data-mark="star"]');
  let st = (await marks(page))[0];
  assert.equal(st.size, 44);
  const corner = await page.evaluate(() => { const s = window.__gs.state().pages[0].marks()[0], bb = window.__gs.stampBox(s); return [bb.x + bb.w + 3, bb.y + bb.h + 3]; });
  assert.equal((await ui(page)).picked.k, 'star', 'a new sticker is picked, so its corner shows');
  await drag(page, 0, [corner, [corner[0] + 22, corner[1] + 22], [corner[0] + 44, corner[1] + 44]]);
  st = (await marks(page))[0];
  assert.ok(st.size > 70, 'bigger: ' + st.size);
  assert.ok(Math.abs(st.x - 300) < 1 && Math.abs(st.y - 500) < 1, 'it stays where it was');
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page))[0].size, 44, 'one undo puts it back');
  await page.evaluate(() => window.__gs.redo());
  const big = (await marks(page))[0].size;
  await rightClick(page, 150, 200);
  await menuPick(page, '[data-mark="star"]');
  assert.equal((await marks(page))[1].size, big, 'the next star comes out the same size');
  await rightClick(page, 500, 200);
  await menuPick(page, '[data-mark="thumbsup"]');
  assert.equal((await marks(page))[2].size, 44, 'another sticker keeps its own size');
  await page.evaluate(() => window.__gs.undo());
  await clickAt(page, 0, 150, 200);   // pick the second star again (undo let go of it)
  // + and − on the picked one.
  await page.keyboard.press('-');
  assert.ok((await marks(page))[1].size < big, 'minus makes it smaller');
  await page.keyboard.press('=');
  assert.ok(Math.abs((await marks(page))[1].size - big) < 0.5, 'and = puts it back');
  // A proofreading mark keeps its own size.
  await rightClick(page, 450, 300);
  await menuPick(page, '[data-mark="sp"]');
  assert.equal((await marks(page))[2].size, 16);
  // A different download starts back at the usual sizes.
  const fresh = await page.evaluate(() => { const b = window.__gs.state().batch, id = b.id; b.id = 'gs.b.other'; const m = window.__gs.placeStamp(window.__gs.state().pages[0], 'star', 300, 300); b.id = id; return m.size; });
  assert.equal(fresh, 44);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the right-click menu has the check mark, always green, at the size she last gave a check', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await rightClick(page, 200, 300);
  assert.deepEqual(await page.$$eval('.stampmenu > button', bs => bs.slice(0, 2).map(b => b.textContent)), ['Add a comment here', 'Check mark'], 'it comes right after Add a comment');
  await page.click('.stampmenu [data-tick]');
  let ms = await marks(page);
  assert.equal(ms[0].t, 'check'); assert.equal(ms[0].size, 22); assert.match(ms[0].color, /^#[0-9A-F]{6}$/i);
  assert.ok(await inkIn(page, [188, 290, 24, 20]) > 5, 'the check shows');
  await page.keyboard.press('=');
  const bigger = (await marks(page))[0].size;
  assert.ok(bigger > 22);
  await rightClick(page, 400, 300);
  await page.click('.stampmenu [data-tick]');
  assert.equal((await marks(page))[1].size, bigger, 'the next check is that size');
  await setTool(page, 'check'); await clickAt(page, 0, 300, 500);
  assert.equal((await marks(page))[2].size, bigger, 'and so is one from the Check tool');
  assert.deepEqual(page.errors, []);
  await close();
});

test('text boxes, checks and circles resize by the corner too', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await page.evaluate(() => {
    const pg = window.__gs.state().pages[0];
    pg.marks().push({ t: 'text', color: '#D92D20', x: 100, y: 400, size: 14, text: 'Nice point' }, { t: 'check', color: '#D92D20', x: 400, y: 500, size: 22 }, { t: 'oval', color: '#D92D20', sw: 1.6, x: 300, y: 600, w: 80, h: 40 });
    window.__gs.draw(pg);
  });
  await setTool(page, 'select');
  const grow = async (i, by) => {
    await clickAt(page, 0, ...(await page.evaluate(i => { const m = window.__gs.state().pages[0].marks()[i], bb = window.__gs.bboxOf(m, 612); return [bb.x + bb.w / 2, bb.y + bb.h / 2]; }, i)));
    if (i === 2) await clickAt(page, 0, 300.5, 620);   // a circle is picked by its line
    const c = await page.evaluate(i => { const m = window.__gs.state().pages[0].marks()[i], bb = window.__gs.bboxOf(m, 612), o = m.t === 'text' ? 4 : 3; return [bb.x + bb.w + o, bb.y + bb.h + o]; }, i);
    await drag(page, 0, [c, [c[0] + by / 2, c[1] + by / 2], [c[0] + by, c[1] + by]]);
    return (await marks(page))[i];
  };
  assert.ok((await grow(0, 30)).size > 14, 'the text is bigger');
  assert.ok((await grow(1, 20)).size > 22, 'the check is bigger');
  const ov = await grow(2, 20);
  assert.ok(ov.w > 90 && ov.h > 50, 'the circle is bigger: ' + [ov.w, ov.h]);
  // A new check comes out at the size she set.
  await setTool(page, 'check'); await clickAt(page, 0, 100, 150);
  assert.equal((await marks(page))[3].size, (await marks(page))[1].size);
  assert.deepEqual(page.errors, []);
  await close();
});

test('clicking off an open comment only closes it; it does not start a new one', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await clickAt(page, 0, 400, 300);
  await page.waitForSelector('.pop textarea');
  await page.keyboard.type('Explain this.');
  await clickAt(page, 0, 300, 650);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(await page.$('.pop'), null, 'no new comment box');
  const ms = await marks(page);
  assert.equal(ms.length, 1); assert.equal(ms[0].text, 'Explain this.');
  // The next click, with nothing open, starts a comment as before.
  await clickAt(page, 0, 300, 650);
  await page.waitForSelector('.pop textarea');
  await page.keyboard.press('Escape');
  assert.deepEqual(page.errors, []);
  await close();
});

test('with any tool, a click on a sticker picks it up and a click on her text goes to typing in it', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await page.evaluate(() => {
    const pg = window.__gs.state().pages[0];
    window.__gs.placeStamp(pg, 'star', 400, 500);
    pg.marks().push({ t: 'text', color: '#D92D20', x: 100, y: 650, size: 14, text: 'Good hook' });
    window.__gs.draw(pg);
  });
  await setTool(page, 'note');
  await clickAt(page, 0, 400, 500);
  let u = await ui(page);
  assert.equal(u.tool, 'select'); assert.equal(u.picked.k, 'star');
  assert.equal(await page.$('.pop'), null, 'no comment started');
  // Dragging it right away moves it.
  await drag(page, 0, [[400, 500], [420, 510], [440, 520]]);
  const st = (await marks(page)).find(m => m.k === 'star');
  assert.ok(Math.abs(st.x - 440) < 1.5 && Math.abs(st.y - 520) < 1.5, 'moved: ' + [st.x, st.y]);
  // Text from the pen tool: straight to typing.
  await setTool(page, 'pen');
  await clickAt(page, 0, 120, 657);
  await page.waitForSelector('textarea.ed');
  u = await ui(page);
  assert.equal(u.tool, 'text'); assert.ok(u.editing);
  await page.keyboard.press('Escape');
  // The pen still draws over the typed paper and over highlights.
  await setTool(page, 'pen');
  const n = (await marks(page)).length;
  await drag(page, 0, [[80, 300], [150, 310], [220, 300]]);
  assert.equal((await marks(page)).length, n + 1);
  assert.equal((await ui(page)).tool, 'pen');
  assert.deepEqual(page.errors, []);
  await close();
});
