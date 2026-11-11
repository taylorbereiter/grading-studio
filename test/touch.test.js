// Tablets: a pencil that draws (wider where it is pressed), a finger that moves the page once a pencil has been used, two fingers
// that pinch to zoom, and a palm that does nothing. Driven with the browser's own pen and touch input, through the real built app.
// What a real tablet adds (how the pencil feels, how a real palm lands) can't be tested here. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, rgb } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, at, drag, setTool, goTo } = require('./helpers/app');
const { zipOf } = require('./helpers/fixtures');

let browser, zip;
async function paper() {
  const doc = await PDFDocument.create();
  for (let n = 0; n < 3; n++) { const pg = doc.addPage([612, 792]); for (let i = 0; i < 6; i++) pg.drawLine({ start: { x: 80, y: 650 - i * 30 }, end: { x: 500, y: 650 - i * 30 }, thickness: 1.5, color: rgb(0.2, 0.2, 0.3) }); }
  doc.setCreationDate(new Date('2026-09-01T12:00:00Z')); doc.setModificationDate(new Date('2026-09-01T12:00:00Z'));
  return doc.save();
}
before(async () => { browser = await launch(); zip = zipOf({ 'Aria Testwell/Essay.pdf': await paper(), 'Bram Sample/Essay.pdf': await paper() }); });
after(async () => { await browser.close(); });

const marks = (page, k = 0) => page.evaluate(k => JSON.parse(JSON.stringify(window.__gs.state().pages[k].marks())), k);
const scroll = page => page.$eval('#paper', p => ({ x: p.scrollLeft, y: p.scrollTop }));
const zoomNow = page => page.evaluate(() => window.__gs.state().zoom);
const pause = ms => new Promise(r => setTimeout(r, ms));

// A tablet: a screen that takes fingers. The pen and the fingers go in through the browser's own input, so the app sees real pointers.
async function tablet(o) {
  const app = await openApp(browser, o), { page } = app;
  await page.setViewport({ width: 1180, height: 820, hasTouch: true });
  await openZip(page, zip, 'Touch.zip');
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p && p.bmp; });
  app.cdp = await page.createCDPSession();
  return app;
}
// One pencil stroke through the given page points, pressed as hard as press(i) says at each.
async function pencil(app, k, pts, press) {
  const send = (type, p, i, down) => app.cdp.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: down ? 'left' : 'none', buttons: down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'pen', force: press(i) });
  const scr = []; for (const [x, y] of pts) scr.push(await at(app.page, k, x, y));
  await send('mouseMoved', scr[0], 0, false);
  await send('mousePressed', scr[0], 0, true);
  for (let i = 1; i < scr.length; i++) await send('mouseMoved', scr[i], i, true);
  await send('mouseReleased', scr[scr.length - 1], scr.length - 1, true);
}
const line = (x0, y0, x1, y1, n = 12) => Array.from({ length: n }, (_, i) => [x0 + (x1 - x0) * i / (n - 1), y0 + (y1 - y0) * i / (n - 1)]);
const fingers = (app, type, list) => app.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: list.map(f => ({ x: f.x, y: f.y, id: f.id || 0, radiusX: f.r || 8, radiusY: f.r || 8, force: 0.5 })) });
// One finger dragged from a to b (screen points).
async function swipe(app, a, b, o = {}) {
  await fingers(app, 'touchStart', [{ ...a, r: o.r }]);
  for (let i = 1; i <= 8; i++) { await fingers(app, 'touchMove', [{ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8, r: o.r }]); await pause(12); }
  await pause(120);   // held still before lifting, so the page doesn't glide on
  await fingers(app, 'touchEnd', []);
}

test('a pencil pressed harder draws a wider line, and the press is kept with the stroke', async () => {
  const app = await tablet(), { page } = app;
  await setTool(page, 'pen');
  await pencil(app, 0, line(100, 340, 400, 340, 16), i => 0.1 + 0.055 * i);   // light at the start, hard at the end
  const [m] = await marks(page);
  assert.equal(m.t, 'pen');
  assert.ok(m.pts.every(p => p.length === 3 && p[2] > 0 && p[2] <= 1), 'every point keeps its press: ' + JSON.stringify(m.pts.slice(0, 3)));
  assert.ok(m.pts[m.pts.length - 1][2] - m.pts[0][2] > 0.4, 'light, then hard: ' + m.pts[0][2] + ' to ' + m.pts[m.pts.length - 1][2]);
  // On the page the line is thin where it was light and thick where it was hard.
  const tall = await page.evaluate(() => {
    const pg = window.__gs.state().pages[0], c = pg.canvas, k = pg.s * c.width / c.getBoundingClientRect().width, ctx = c.getContext('2d');
    const ink = x => { const d = ctx.getImageData(Math.round(x * k), Math.round(320 * k), 1, Math.round(40 * k)).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) n++; return n / k; };
    return [ink(125), ink(375)];
  });
  assert.ok(tall[1] > tall[0] * 1.8, 'the hard end is the wider: ' + tall.map(v => v.toFixed(2)).join(' and '));
  assert.equal((await page.evaluate(() => window.__gs.touch())).penSeen, true);
  // The pencil is remembered for the next visit, so a finger moves the page from the start.
  await page.reload();
  assert.equal((await page.evaluate(() => window.__gs.touch())).moves, true);
  assert.deepEqual(page.errors, []);
  await app.close();
});

test('a pencil that can\'t tell how hard it is pressed, a mouse, and the setting turned off all draw the even line as before', async () => {
  const app = await tablet(), { page } = app;
  await setTool(page, 'pen');
  await pencil(app, 0, line(100, 300, 400, 300), () => 0.5);
  await drag(page, 0, [[100, 400], [400, 400]]);
  await page.evaluate(() => { const b = document.querySelector('#setPress'); b.checked = false; b.onchange(); });
  await pencil(app, 0, line(100, 500, 400, 500, 16), i => 0.1 + 0.055 * i);
  const ms = await marks(page);
  assert.equal(ms.length, 3);
  for (const m of ms) assert.ok(m.pts.every(p => p.length === 2), 'points of two numbers: ' + JSON.stringify(m.pts[0]));
  assert.deepEqual(page.errors, []);
  await app.close();
});

test('a pressed stroke keeps its press when moved, and comes back after undo and redo', async () => {
  const app = await tablet(), { page } = app;
  await setTool(page, 'pen');
  await pencil(app, 0, line(100, 300, 400, 320, 16), i => 0.1 + 0.055 * i);
  const before = (await marks(page))[0].pts.map(p => p[2]);
  await setTool(page, 'select');
  await drag(page, 0, [[250, 310], [250, 420]]);
  const moved = (await marks(page))[0];
  assert.ok(moved.pts[0][1] > 380, 'the stroke moved down: ' + moved.pts[0][1]);
  assert.deepEqual(moved.pts.map(p => p[2]), before);
  await page.evaluate(() => window.__gs.undo()); await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, 0);
  await page.evaluate(() => window.__gs.redo());
  assert.deepEqual((await marks(page))[0].pts.map(p => p[2]), before);
  assert.deepEqual(page.errors, []);
  await app.close();
});

test('before a pencil is used one finger draws; after it, one finger moves the page and draws nothing', async () => {
  const app = await tablet(), { page } = app;
  await setTool(page, 'pen');
  const a = await at(page, 0, 150, 500), b = await at(page, 0, 150, 300);
  const top = (await scroll(page)).y;
  await swipe(app, a, b);
  assert.equal((await marks(page)).length, 1, 'a finger alone draws');
  assert.equal((await scroll(page)).y, top);
  await pencil(app, 0, line(300, 200, 400, 200), () => 0.5);
  await pause(600);   // her hand is off the page by now
  assert.equal((await marks(page)).length, 2);
  await swipe(app, a, b);
  const s = await scroll(page);
  assert.equal((await marks(page)).length, 2, 'the finger drew nothing');
  assert.ok(s.y > top + 100, 'and the page moved up with it: ' + s.y);
  // Settings, Marking can make a finger draw again whatever came before.
  await page.evaluate(() => { const el = document.querySelector('#setTouchMode'); el.value = 'draw'; el.onchange(); });
  const c = await at(page, 0, 150, 500), d = await at(page, 0, 150, 420);
  await swipe(app, c, d);
  assert.equal((await marks(page)).length, 3, 'set to draw, the finger draws');
  await page.evaluate(() => { const el = document.querySelector('#setTouchMode'); el.value = 'move'; el.onchange(); window.__gs.touchReset(); });
  const y0 = (await scroll(page)).y;
  await swipe(app, d, c);
  assert.equal((await marks(page)).length, 3);
  assert.ok((await scroll(page)).y < y0 - 30, 'set to move, the finger moves the page with no pencil yet');
  assert.deepEqual(page.errors, []);
  await app.close();
});

test('two fingers move the page and pinch to zoom, and take back the line the first finger began', async () => {
  const app = await tablet(), { page } = app;
  await setTool(page, 'pen');
  const z0 = await zoomNow(page);
  const m = await at(page, 0, 300, 400);
  await fingers(app, 'touchStart', [{ x: m.x - 40, y: m.y, id: 1 }]);
  await fingers(app, 'touchMove', [{ x: m.x - 44, y: m.y + 3, id: 1 }]);
  await fingers(app, 'touchStart', [{ x: m.x - 44, y: m.y + 3, id: 1 }, { x: m.x + 40, y: m.y, id: 2 }]);
  for (let i = 1; i <= 8; i++) { await fingers(app, 'touchMove', [{ x: m.x - 44 - i * 10, y: m.y + 3, id: 1 }, { x: m.x + 40 + i * 10, y: m.y, id: 2 }]); await pause(12); }
  await fingers(app, 'touchEnd', [{ x: m.x - 124, y: m.y + 3, id: 1 }]);
  await fingers(app, 'touchMove', [{ x: m.x - 200, y: m.y + 80, id: 1 }]);   // the finger left behind does nothing more
  await fingers(app, 'touchEnd', []);
  const z1 = await zoomNow(page);
  assert.ok(z1 > z0 * 1.5, 'spread apart, the page is larger: ' + z0 + ' to ' + z1);
  assert.equal((await marks(page)).length, 0, 'no line is left from the first finger');
  // Two fingers moved together move the page.
  const y0 = (await scroll(page)).y;
  await fingers(app, 'touchStart', [{ x: 500, y: 500, id: 1 }, { x: 580, y: 500, id: 2 }]);
  for (let i = 1; i <= 6; i++) { await fingers(app, 'touchMove', [{ x: 500, y: 500 - i * 30, id: 1 }, { x: 580, y: 500 - i * 30, id: 2 }]); await pause(12); }
  await fingers(app, 'touchEnd', []);
  assert.ok((await scroll(page)).y > y0 + 120, 'the page went up with the fingers');
  assert.equal((await marks(page)).length, 0);
  assert.deepEqual(page.errors, []);
  await app.close();
});

test('a palm does nothing: a touch while the pencil is down, just after it lifts, or far wider than a fingertip', async () => {
  const app = await tablet(), { page } = app;
  await setTool(page, 'pen');
  const send = (type, p, down, force) => app.cdp.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: down ? 'left' : 'none', buttons: down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'pen', force });
  const a = await at(page, 0, 100, 300), b = await at(page, 0, 300, 300), palm = await at(page, 0, 350, 500), palm2 = await at(page, 0, 350, 380);
  const top = (await scroll(page)).y;
  await send('mouseMoved', a, false, 0); await send('mousePressed', a, true, 0.5);
  await send('mouseMoved', { x: (a.x + b.x) / 2, y: a.y }, true, 0.5);
  // Her hand comes down and slides while she writes.
  await fingers(app, 'touchStart', [{ ...palm, id: 5 }]);
  for (let i = 1; i <= 5; i++) await fingers(app, 'touchMove', [{ x: palm.x, y: palm.y + (palm2.y - palm.y) * i / 5, id: 5 }]);
  await send('mouseMoved', b, true, 0.5); await send('mouseReleased', b, true, 0.5);
  await fingers(app, 'touchEnd', []);
  let ms = await marks(page);
  assert.equal(ms.length, 1, 'only the pencil\'s line');
  assert.ok(Math.abs(ms[0].pts[ms[0].pts.length - 1][0] - 300) < 3, 'which ran on to its end: ' + JSON.stringify(ms[0].pts[ms[0].pts.length - 1]));
  assert.equal((await scroll(page)).y, top, 'and the page stayed where it was');
  // Just after the pencil lifts, the hand lifting off is still not a finger.
  await swipe(app, palm, palm2);
  assert.equal((await scroll(page)).y, top, 'a touch straight after the pencil moves nothing');
  await pause(600);
  // A contact as wide as the side of a hand, at any time.
  await swipe(app, palm, palm2, { r: 45 });
  assert.equal((await scroll(page)).y, top, 'a wide touch moves nothing');
  await swipe(app, palm, palm2);
  assert.ok((await scroll(page)).y > top + 50, 'a fingertip does');
  assert.equal((await marks(page)).length, 1);
  assert.deepEqual(page.errors, []);
  await app.close();
});

test('Settings, Marking has the tablet choices, and they are remembered', async () => {
  const app = await tablet(), { page } = app;
  await goTo(page, '#/settings/marking');
  assert.ok(await page.$eval('#setTouch', e => e.checkVisibility()), 'the Tablet and pencil card shows');
  assert.equal(await page.$eval('#setTouchMode', e => e.value), 'auto');
  assert.equal(await page.$eval('#setPress', e => e.checked), true);
  await page.select('#setTouchMode', 'move');
  await page.click('#setPress');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.touch'))), 'move');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.press'))), false);
  await page.select('#setTouchMode', 'auto');
  await page.click('#setPress');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.touch')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.press')), null);
  assert.deepEqual(page.errors, []);
  await app.close();
});
