// Phase 4 marking: the pen, the highlighter and text boxes, through the same mouse moves she uses, and through save, reopen, turn and export.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { unzipSync, zipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, appReady, goToStudent, at, drag, clickAt, setTool, settle, catchDownloads, probePdf, probeScreen, closeBox } = require('./helpers/app');
const { zipOf } = require('./helpers/fixtures');

const LINE = 'The quick brown fox jumps over the lazy dog and keeps on running far away';
const LEFT = 'left column words go here', RIGHT = 'right column words go here';
const X = 72, Y0 = 100, PITCH = 15, SIZE = 12;   // the typed lines, in page points from the top left
const lineY = i => Y0 + i * PITCH, colY = i => 400 + i * PITCH;
let browser, zip, font;

async function typedPaper() {
  const doc = await PDFDocument.create(), f = await doc.embedFont(StandardFonts.Helvetica);
  font = f;
  for (let n = 0; n < 2; n++) {
    const pg = doc.addPage([612, 792]), H = pg.getHeight();
    for (let i = 0; i < 8; i++) pg.drawText(LINE, { x: X, y: H - lineY(i), size: SIZE, font: f, color: rgb(0, 0, 0) });
    for (let i = 0; i < 4; i++) { pg.drawText(LEFT, { x: X, y: H - colY(i), size: SIZE, font: f }); pg.drawText(RIGHT, { x: 340, y: H - colY(i), size: SIZE, font: f }); }
  }
  doc.setCreationDate(new Date('2026-09-01T12:00:00Z')); doc.setModificationDate(new Date('2026-09-01T12:00:00Z'));
  return doc.save();
}
async function scanPaper() {   // handwriting on a scan: ink, and no text at all
  const doc = await PDFDocument.create(), pg = doc.addPage([612, 792]);
  for (let i = 0; i < 6; i++) pg.drawLine({ start: { x: 80, y: 650 - i * 30 }, end: { x: 500, y: 650 - i * 30 + (i % 2) * 6 }, thickness: 1.5, color: rgb(0.2, 0.2, 0.3) });
  doc.setCreationDate(new Date('2026-09-01T12:00:00Z')); doc.setModificationDate(new Date('2026-09-01T12:00:00Z'));
  return doc.save();
}
const wx = (i, word = 0) => X + font.widthOfTextAtSize(LINE.split(' ').slice(0, word).join(' ') + (word ? ' ' : ''), SIZE);   // where word number `word` starts
const wEnd = word => X + font.widthOfTextAtSize(LINE.split(' ').slice(0, word + 1).join(' '), SIZE);

before(async () => {
  browser = await launch();
  zip = zipOf({ 'Aria Testwell/Essay.pdf': await typedPaper(), 'Bram Sample/Scan.pdf': await scanPaper(), 'Cleo Fixture/Essay.pdf': await typedPaper() });
});
after(async () => { await browser.close(); });

const marks = (page, k = 0) => page.evaluate(k => JSON.parse(JSON.stringify(window.__gs.state().pages[k].marks())), k);
const linesReady = (page, k = 0) => page.waitForFunction(k => { const p = window.__gs.state().pages[k]; return p && p.bmp && p.tl; }, {}, k);
async function open(page) { await openZip(page, zip, 'Marking.zip'); await linesReady(page, 0); await linesReady(page, 1); }
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, (what || 'value') + ': ' + a + ' is not within ' + tol + ' of ' + b);
const key = async (page, combo) => { for (const k of combo.slice(0, -1)) await page.keyboard.down(k); await page.keyboard.press(combo[combo.length - 1]); for (const k of combo.slice(0, -1)) await page.keyboard.up(k); };

/* ---------------- pen ---------------- */
test('a fast stroke keeps every point the browser saw, not just one per frame', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'pen');
  const a = await at(page, 0, 100, 600);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  // One pointer move standing for 40 points of a wave, the way a fast stroke arrives in a busy frame.
  await page.evaluate(() => {
    const pg = window.__gs.state().pages[0], r = pg.canvas.getBoundingClientRect(), list = [];
    for (let i = 1; i <= 40; i++) list.push(new PointerEvent('pointermove', { clientX: r.left + (100 + i * 5) * pg.s, clientY: r.top + (600 + Math.sin(i / 3) * 30) * pg.s, pointerId: 1 }));
    pg.canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: list[39].clientX, clientY: list[39].clientY, pointerId: 1, buttons: 1, coalescedEvents: list }));
  });
  await page.mouse.up();
  const [m] = await marks(page);
  assert.equal(m.t, 'pen');
  const ys = m.pts.map(p => p[1]);
  assert.ok(m.pts.length >= 10, 'the wave has its points: ' + m.pts.length);
  assert.ok(Math.max(...ys) > 610 && Math.min(...ys) < 590, 'and goes up and down: ' + Math.min(...ys) + ' to ' + Math.max(...ys));
  assert.deepEqual(page.errors, []);
  await close();
});

test('smoothing takes out pixel steps and shake, keeps a quick loop round, and ends the stroke where she let go', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(() => {
    const { inkFilter, thinStroke } = window.__gs;
    // How much the direction wobbles along the line, per pixel: 0 is perfectly straight.
    const rough = p => {
      const r = [p[0]]; let left = 1;
      for (let i = 1; i < p.length; i++) { let a = p[i - 1], d = Math.hypot(p[i][0] - a[0], p[i][1] - a[1]); while (d >= left && d > 0) { const t = left / d; a = [a[0] + (p[i][0] - a[0]) * t, a[1] + (p[i][1] - a[1]) * t]; r.push(a); d -= left; left = 1; } left -= d; }
      let s = 0; for (let i = 2; i < r.length; i++) s += Math.hypot(r[i][0] - 2 * r[i - 1][0] + r[i - 2][0], r[i][1] - 2 * r[i - 1][1] + r[i - 2][1]);
      return s / (r.length - 2);
    };
    const run = (src, hz) => { const f = inkFilter(); return src.map((q, i) => f(q[0], q[1], i * 1000 / hz)); };
    // A slow, gently sloped line on whole pixels: the staircase a mouse draws. 40 px a second, 125 reports a second.
    const stairs = []; for (let i = 0; i < 400; i++) stairs.push([Math.round(i * 0.32), Math.round(i * 0.1)]);
    const smooth = run(stairs, 125);
    let off = 0; smooth.forEach((q, i) => { off = Math.max(off, Math.hypot(q[0] - i * 0.32, q[1] - i * 0.1)); });
    // A quick loop: radius 10 px, 4 turns a second, like the bowl of a letter.
    const loop = []; for (let i = 0; i < 125; i++) { const a = i / 125 * 8 * Math.PI; loop.push([100 + 10 * Math.cos(a), 100 + 10 * Math.sin(a)]); }
    const looped = run(loop, 125).slice(30);
    const radius = Math.min(...looped.map(q => Math.hypot(q[0] - 100, q[1] - 100)));
    // Thinning: a curve with a sharp corner keeps its shape with far fewer points.
    const curve = [];
    for (let i = 0; i <= 200; i++) curve.push([i * 0.5, 50 + 20 * Math.sin(i / 25)]);
    for (let i = 1; i <= 100; i++) curve.push([100 - i * 0.5, 50 + 20 * Math.sin(8) + i * 0.5]);
    const thin = thinStroke(curve.map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]), 0.12, 6);
    const flat = pts => { const o = []; for (let i = 1; i < pts.length - 1; i++) { const a = i === 1 ? pts[0] : [(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2], c = pts[i], b = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; for (let t = 0; t < 1; t += 0.1) o.push([(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]]); } return o; };
    const fa = flat(curve), fb = flat(thin);
    let drift = 0; for (const q of fb) { let d = 1e9; for (const u of fa) d = Math.min(d, Math.hypot(u[0] - q[0], u[1] - q[1])); drift = Math.max(drift, d); }
    return { before: rough(stairs), after: rough(smooth), off, radius, nCurve: curve.length, nThin: thin.length, drift };
  });
  assert.ok(r.after < r.before * 0.5, 'the staircase is gone: wobble ' + r.before.toFixed(2) + ' went to ' + r.after.toFixed(2));
  assert.ok(r.off < 2.5, 'and the line stays where she drew it: off by ' + r.off.toFixed(2) + ' px');
  assert.ok(r.radius > 7.5, 'a quick loop stays round: radius ' + r.radius.toFixed(1) + ' of 10');
  assert.ok(r.nThin < r.nCurve / 3, 'fewer points to store: ' + r.nThin + ' of ' + r.nCurve);
  assert.ok(r.drift < 0.5, 'the same line: moved by ' + r.drift.toFixed(2) + ' pt');
  await close();

  const app = await openApp(browser);
  await open(app.page);
  await setTool(app.page, 'pen'); await drag(app.page, 0, [[100, 600], [180, 640], [260, 600]]);
  const [m] = await marks(app.page);
  const last = m.pts[m.pts.length - 1];
  near(last[0], 260, 0.6, 'end x'); near(last[1], 600, 0.6, 'end y');
  await app.close();
});

test('an old pen mark draws exactly as it always has, on screen and in an export', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  const same = await page.evaluate(() => {
    const m = { t: 'pen', color: '#D7263D', w: 2, pts: [[10, 10], [20.5, 30], [40, 12.3], [60, 44], [80, 20], [95, 60]] }, dot = { t: 'pen', color: '#1F5FD1', w: 3.5, pts: [[120, 40]] };
    const canvas = () => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 300, 200); x.setTransform(2, 0, 0, 2, 0, 0); return [c, x]; };
    const [c1, a] = canvas(), [c2, b] = canvas();
    window.__gs.drawMarks(a, [m, dot], 150, 100, 0, null);
    for (const k of [m, dot]) {   // the drawing code from before this phase, word for word
      b.save(); b.strokeStyle = k.color; b.lineWidth = k.w; b.lineCap = 'round'; b.lineJoin = 'round';
      b.beginPath();
      const p = k.pts;
      b.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) b.lineTo(p[0][0] + 0.01, p[0][1]);
      for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; b.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
      if (p.length > 1) b.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      b.stroke(); b.restore();
    }
    const d1 = c1.getContext('2d').getImageData(0, 0, 300, 200).data, d2 = c2.getContext('2d').getImageData(0, 0, 300, 200).data;
    let diff = 0, ink = 0; for (let i = 0; i < d1.length; i += 4) { if (d1[i] !== d2[i] || d1[i + 1] !== d2[i + 1] || d1[i + 2] !== d2[i + 2]) diff++; if (d1[i + 1] < 200) ink++; }
    return { diff, ink };
  });
  assert.equal(same.diff, 0);
  assert.ok(same.ink > 100, 'and it did draw something');
  await close();
});

test('drawing just the end of a stroke leaves the page exactly as drawing it all would', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  const same = await page.evaluate(() => {
    const { state, draw } = window.__gs, pg = state().pages[0], c = pg.canvas, x = c.getContext('2d', { willReadFrequently: true });
    const pts = [[100, 620], [130, 640], [160, 612], [190, 644], [220, 616]];
    const m = { t: 'pen', color: '#D7263D', w: 2, pts }, hl = { t: 'hl', color: '#FFE45C', sw: 14, pts: pts.map(q => [q[0], q[1] + 40]), x: 90, y: 650, w: 140, h: 50 };
    const snap = () => x.getImageData(0, 0, c.width, c.height).data;
    draw(pg, [m, hl]);
    const whole = snap();
    draw(pg, [{ ...m, pts: pts.slice(0, 4) }, { ...hl, pts: hl.pts.slice(0, 4) }]);
    draw(pg, [m, hl], { x: 150, y: 600, w: 90.3, h: 110.7 });   // the changed end, on fractions of a pixel
    const part = snap();
    let diff = 0; for (let i = 0; i < whole.length; i++) if (whole[i] !== part[i]) diff++;
    draw(pg);
    return diff;
  });
  assert.equal(same, 0);
  await close();
});

/* ---------------- highlighter ---------------- */
test('a drag along a typed line snaps to the line and to whole words', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'hl');
  await drag(page, 0, [[wx(0, 1) + 8, lineY(2) - 9], [wEnd(3) - 5, lineY(2) + 2]]);   // sloppy: from inside "quick" to inside "fox", sliding down
  const [m] = await marks(page);
  assert.equal(m.t, 'hl'); assert.equal(m.rects, undefined, 'one line is the plain rectangle shape'); assert.equal(m.pts, undefined);
  near(m.x, wx(0, 1) - 1, 2.5, 'starts at the first word');
  near(m.x + m.w, wEnd(3) + 1, 2.5, 'ends after the last word');
  assert.ok(m.y <= lineY(2) - SIZE * 0.7 && m.y + m.h >= lineY(2) + 1, 'covers the letters: ' + m.y + ' to ' + (m.y + m.h));
  assert.ok(m.y > lineY(1) + 2 && m.y + m.h < lineY(3) - 7, 'and stays off the lines around it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a drag across several lines is one mark and one undo, and works backwards too', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'hl');
  const from = [wx(0, 2) + 3, lineY(1) - 4], to = [wEnd(4) - 3, lineY(4) - 4];
  await drag(page, 0, [from, [300, lineY(2)], [400, lineY(3)], to]);
  let ms = await marks(page);
  assert.equal(ms.length, 1);
  const m = ms[0];
  assert.equal(m.rects.length, 4, 'four lines');
  near(m.rects[0].x, wx(0, 2) - 1, 2.5, 'first line starts at the word she started on');
  near(m.rects[1].x, X - 1, 1, 'middle lines are whole');
  near(m.rects[1].x + m.rects[1].w, X + font.widthOfTextAtSize(LINE, SIZE) + 1, 4, 'to the end of the line');   // pdf-lib's width allows for kerning that the drawn text hasn't got
  near(m.rects[3].x + m.rects[3].w, wEnd(4) + 1, 2.5, 'last line ends at the word she stopped on');
  near(m.x, X - 1, 1, 'the box around it: x'); near(m.y, m.rects[0].y, 0.11, 'y');
  near(m.y + m.h, m.rects[3].y + m.rects[3].h, 0.11, 'bottom');
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, 0, 'one undo takes it all away');
  await page.evaluate(() => window.__gs.redo());
  assert.deepEqual(await marks(page), ms, 'and redo brings it all back');
  await page.evaluate(() => window.__gs.undo());
  await setTool(page, 'hl');
  await drag(page, 0, [to, [300, lineY(2)], from]);
  const [back] = await marks(page);
  assert.deepEqual(back.rects, m.rects, 'dragging from the end to the start makes the same highlight');
  await close();
});

test('a wobble stays on the line, and a column stays a column', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'hl');
  await drag(page, 0, [[X + 2, lineY(5) - 4], [200, lineY(5) + 4], [300, lineY(5) - 7], [400, lineY(5) + 3]]);
  let [m] = await marks(page);
  assert.equal(m.rects, undefined, 'still one line');
  near(m.y, lineY(5) - SIZE * 0.82, 0.6, 'the same line');
  await page.evaluate(() => window.__gs.undo());
  await setTool(page, 'hl');
  await drag(page, 0, [[X + 2, colY(0) - 4], [X + 40, colY(1)], [X + 60, colY(3) - 4]]);
  [m] = await marks(page);
  assert.equal(m.rects.length, 4);
  assert.ok(Math.max(...m.rects.map(r => r.x + r.w)) < 300, 'the right column is left alone: ' + JSON.stringify(m.rects));
  await close();
});

test('lines overlapping in tight spacing do not darken where they meet', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  const px = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 100; c.height = 100; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, 100, 100);
    window.__gs.drawMarks(x, [{ t: 'hl', color: '#FFE45C', x: 10, y: 10, w: 80, h: 40, rects: [{ x: 10, y: 10, w: 80, h: 25 }, { x: 10, y: 25, w: 80, h: 25 }] }], 100, 100, 0, null);
    return [[...x.getImageData(50, 15, 1, 1).data], [...x.getImageData(50, 30, 1, 1).data]];
  });
  assert.deepEqual(px[0], px[1]);
  await close();
});

test('highlighting over a highlight: the same color stays the same, a new color replaces the old one', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  const px = await page.evaluate(() => {
    const at = (marks, ...pts) => {   // drawn at 2x and shifted, the way the screen and the export draw
      const c = document.createElement('canvas'); c.width = 240; c.height = 120; const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#fff'; x.fillRect(0, 0, 240, 120); x.setTransform(2, 0, 0, 2, 10, 0);
      window.__gs.drawMarks(x, marks, 110, 60, 0, null);
      return pts.map(([X, Y]) => [...x.getImageData(X * 2 + 10, Y * 2, 1, 1).data].slice(0, 3));
    };
    const Y = '#FFE45C', P = '#FFB8D6', B = '#B0E0FF';
    return {
      once: at([{ t: 'hl', color: Y, x: 10, y: 10, w: 80, h: 20 }], [50, 20])[0],
      thrice: at([1, 2, 3].map(() => ({ t: 'hl', color: Y, x: 10, y: 10, w: 80, h: 20 })), [50, 20])[0],
      pinkAlone: at([{ t: 'hl', color: P, x: 10, y: 10, w: 80, h: 20 }], [50, 20])[0],
      overYellow: at([{ t: 'hl', color: Y, x: 10, y: 10, w: 80, h: 20 }, { t: 'hl', color: P, x: 40, y: 10, w: 60, h: 20 }], [20, 20], [50, 20], [95, 20]),
      freeOverRect: at([{ t: 'hl', color: Y, x: 10, y: 10, w: 80, h: 20 }, { t: 'hl', color: B, sw: 14, pts: [[30, 20], [70, 20]], x: 23, y: 13, w: 54, h: 14 }], [50, 20]),
      noteOverHl: at([{ t: 'hl', color: Y, x: 10, y: 10, w: 80, h: 20 }, { t: 'note', color: '#D92D20', ax: 90, ay: 20, hl: { x: 10, y: 10, w: 80, h: 20 }, hc: P, text: 'x' }], [50, 20]),
      noteAlone: at([{ t: 'note', color: '#D92D20', ax: 90, ay: 20, hl: { x: 10, y: 10, w: 80, h: 20 }, hc: P, text: 'x' }], [50, 20]),
    };
  });
  assert.deepEqual(px.thrice, px.once, 'the same color three times looks like once');
  assert.deepEqual(px.overYellow[1], px.pinkAlone, 'pink over yellow is pink, not a mix');
  assert.deepEqual(px.overYellow[0], px.once, 'the yellow it does not cover stays yellow');
  assert.deepEqual(px.overYellow[2], px.pinkAlone, 'and past the yellow it is the same pink');
  assert.notDeepEqual(px.freeOverRect[0], px.once, 'a freehand highlight over a typed-line one shows its own color');
  assert.deepEqual(px.noteOverHl[0], px.noteAlone[0], "a comment's highlight replaces the color under it too");
  // Through her own mouse moves: the same words three times in yellow, then again in pink.
  await setTool(page, 'hl');
  const spot = [wx(0, 2) + 4, lineY(0) - 6, 10, 4];
  const drag3 = () => drag(page, 0, [[wx(0, 1) + 2, lineY(0) - 4], [wEnd(4) - 2, lineY(0) - 4]]);
  await drag3();
  const one = (await probeScreen(page, 0, [spot]))[0];
  await drag3(); await drag3();
  assert.equal((await marks(page)).length, 3);
  const three = (await probeScreen(page, 0, [spot]))[0];
  near(three.yellow, one.yellow, 1, 'no darker after three passes');
  assert.equal(three.dark, one.dark, 'and the words are not darker either');
  await page.click('[data-hl="pink"]');
  await drag3();
  const pink = (await probeScreen(page, 0, [spot]))[0];
  assert.equal(pink.yellow, 0, 'pink over yellow leaves no yellow showing');
  assert.deepEqual(page.errors, []);
  await close();
});

test('with no typed text the highlighter is freehand by itself, and the choice is easy to change', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await goToStudent(page, 1);
  await linesReady(page);
  assert.equal(await page.evaluate(() => window.__gs.state().pages[0].tl.length), 0);
  await setTool(page, 'hl');
  await drag(page, 0, [[100, 200], [200, 206], [300, 198], [400, 203]]);
  let ms = await marks(page);
  assert.equal(ms[0].t, 'hl'); assert.ok(ms[0].pts.length >= 3); assert.ok(ms[0].sw > 0);
  const box = ms[0];
  assert.ok(box.x <= 100 - box.sw / 2 + 0.2 && box.x + box.w >= 400 + box.sw / 2 - 0.2 && box.h < 40, 'its box is kept right: ' + JSON.stringify([box.x, box.y, box.w, box.h]));
  assert.ok((await probeScreen(page, 0, [[150, 196, 100, 6]]))[0].yellow > 0, 'and it shows');
  // A click on a scan is still the strip it always was.
  await clickAt(page, 0, 300, 500);
  ms = await marks(page);
  assert.deepEqual([ms[1].x, ms[1].y, ms[1].w, ms[1].h, ms[1].pts], [270, 493, 60, 14, undefined]);

  // On a typed page: the Freehand button, then H, change it.
  await goToStudent(page, 0); await linesReady(page);
  await setTool(page, 'hl');
  await page.click('[data-hlm="free"]');
  await drag(page, 0, [[100, lineY(1)], [200, lineY(1)], [300, lineY(1) + 8]]);
  ms = await marks(page);
  assert.ok(ms[0].pts, 'Freehand draws on typed text too');
  assert.equal(await page.evaluate(() => window.__gs.hlMode()), 'free');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('h');
  assert.equal(await page.evaluate(() => window.__gs.hlMode()), 'auto', 'H again goes back');
  assert.equal(await page.$eval('[data-hlm="auto"]', e => e.getAttribute('aria-pressed')), 'true');
  await drag(page, 0, [[100, lineY(3)], [200, lineY(3)]]);
  ms = await marks(page);
  assert.equal(ms[1].pts, undefined, 'and it snaps again');
  // On a typed page, a drag that starts well away from any text is freehand too: handwriting in the margin.
  await drag(page, 0, [[150, 650], [250, 655], [350, 650]]);
  ms = await marks(page);
  assert.ok(ms[2].pts, 'freehand away from the text');
  // Shift makes a straight freehand line.
  await page.keyboard.press('h');
  await page.keyboard.down('Shift');
  await drag(page, 0, [[100, 700], [200, 703], [400, 701]]);
  await page.keyboard.up('Shift');
  ms = await marks(page);
  assert.equal(ms[3].pts.length, 2);
  assert.equal(ms[3].pts[0][1], ms[3].pts[1][1], 'level when it is close');
  await page.keyboard.press('h');
  assert.deepEqual(page.errors, []);
  await close();
});

// A highlight of each kind, for the checks that follow.
async function threeHighlights(page, withNote) {
  await setTool(page, 'hl');
  await drag(page, 0, [[wx(0, 2) + 3, lineY(1) - 4], [300, lineY(2)], [wEnd(4) - 3, lineY(3) - 4]]);   // several lines
  await page.evaluate(() => window.__gs.setHlMode('free'));
  await drag(page, 0, [[100, 620], [200, 640], [300, 620], [400, 640]]);   // freehand
  await page.evaluate(() => window.__gs.setHlMode('auto'));
  await page.evaluate(() => { const pg = window.__gs.state().pages[0]; pg.marks().push({ t: 'hl', color: '#FFE45C', x: 80, y: 690, w: 200, h: 16 }); });   // a rectangle from an older copy
  if (withNote) {
    await setTool(page, 'note');
    await drag(page, 0, [[wx(0, 1) + 2, lineY(5) - 4], [300, lineY(6)], [wEnd(2), lineY(6) - 4]]);
    await page.waitForSelector('.pop textarea'); await page.keyboard.type('Look here'); await page.click('.pop [data-a="ok"]');
  }
  await setTool(page, 'select');
}

test('hit test, picking and the box around each kind of highlight', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await threeHighlights(page);
  const r = await page.evaluate((a, b, c, d) => {
    const { state, hitMark, bboxOf } = window.__gs, pg = state().pages[0], ms = pg.marks();
    const hit = (x, y) => { const m = hitMark(pg, x, y, 3); return m ? ms.indexOf(m) : -1; };
    return { inFirst: hit(a, b), beforeFirst: hit(c, b), lastLine: hit(c, d), onFree: hit(200, 640), offFree: hit(110, 645), rect: hit(150, 700), box: bboxOf(ms[0], pg.W), want: ms[0].rects };
  }, wEnd(5), lineY(1) - 3, X + 3, lineY(3) - 3);
  assert.equal(r.inFirst, 0);
  assert.equal(r.beforeFirst, -1, 'the empty space before the first word is not part of it');
  assert.equal(r.lastLine, 0);
  assert.equal(r.onFree, 1);
  assert.equal(r.offFree, -1, 'a freehand stroke is hit along its line, not across its box');
  assert.equal(r.rect, 2);
  assert.ok(r.box.y === r.want[0].y && r.box.w > 300);
  await close();
});

test('moving, nudging, copying and erasing take the whole highlight along', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await threeHighlights(page);
  const start = await marks(page);
  // Drag each kind by the same amount.
  for (const [i, x, y] of [[0, wEnd(5), lineY(1) - 3], [1, 200, 640], [2, 150, 700]]) {
    await drag(page, 0, [[x, y], [x + 7, y + 11]]);
    const m = (await marks(page))[i], o = start[i];
    near(m.x, o.x + 7, 0.3, 'box x'); near(m.y, o.y + 11, 0.3, 'box y');
    if (o.rects) { m.rects.forEach((q, k) => { near(q.x, o.rects[k].x + 7, 0.3); near(q.y, o.rects[k].y + 11, 0.3); assert.equal(q.w, o.rects[k].w); }); }
    if (o.pts) m.pts.forEach((q, k) => { near(q[0], o.pts[k][0] + 7, 0.3); near(q[1], o.pts[k][1] + 11, 0.3); });
    assert.deepEqual([m.w, m.h], [o.w, o.h]);
  }
  // Arrow keys on the picked one (the rectangle).
  await key(page, ['ArrowLeft']);
  near((await marks(page))[2].x, start[2].x + 7 - 1, 0.3, 'nudged');
  // Copy and paste the multi-line one.
  await drag(page, 0, [[wEnd(5), lineY(1) + 11 - 3], [wEnd(5), lineY(1) + 11 - 3]]);
  const before_ = await marks(page);
  await key(page, ['Control', 'c']); await key(page, ['Control', 'v']);
  let ms = await marks(page);
  assert.equal(ms.length, 4);
  const pasted = ms[3];
  near(pasted.x, before_[0].x + 12, 0.3, 'pasted x');
  pasted.rects.forEach((q, k) => { near(q.x, before_[0].rects[k].x + 12, 0.3); near(q.y, before_[0].rects[k].y + 12, 0.3); });
  // Paste onto another student's page.
  await goToStudent(page, 1);
  await key(page, ['Control', 'v']);
  ms = await marks(page);
  assert.equal(ms[0].rects.length, 3, 'on another student too');
  await goToStudent(page, 0);
  // The eraser takes a whole highlight at one touch, with one undo.
  await setTool(page, 'erase');
  const n = (await marks(page)).length, f = (await marks(page))[1].pts[2];
  await clickAt(page, 0, f[0], f[1]);
  ms = await marks(page);
  assert.equal(ms.length, n - 1);
  assert.ok(ms.every(m => !m.pts), 'the freehand one went');
  await page.evaluate(() => window.__gs.undo());
  assert.equal((await marks(page)).length, n);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a comment dragged over words highlights those words, over several lines too', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await drag(page, 0, [[wx(0, 1) + 2, lineY(5) - 4], [300, lineY(6)], [wEnd(2), lineY(6) - 4]]);
  await page.waitForSelector('.pop textarea'); await page.keyboard.type('Look here'); await page.click('.pop [data-a="ok"]');
  let [n] = await marks(page);
  assert.equal(n.t, 'note'); assert.equal(n.rects.length, 2);
  near(n.hl.y, n.rects[0].y, 0.11); near(n.ax, n.rects[1].x + n.rects[1].w, 0.11, 'the line to the margin leaves from the end of the words'); near(n.ay, n.rects[1].y + n.rects[1].h, 0.11, 'and just under them');
  assert.ok((await probeScreen(page, 0, [[n.rects[0].x + n.rects[0].w - 30, n.rects[0].y + 2, 20, 6]]))[0].yellow > 0, 'it shows');
  // One line stays the plain shape, and a drag off the text is the old drag box.
  await setTool(page, 'note');
  await drag(page, 0, [[wx(0, 1) + 2, lineY(0) - 4], [wEnd(2), lineY(0) - 4]]);
  await page.waitForSelector('.pop textarea'); await page.keyboard.type('One line'); await page.click('.pop [data-a="ok"]');
  await setTool(page, 'note');
  await drag(page, 0, [[100, 560], [260, 590]]);
  await page.waitForSelector('.pop textarea'); await page.keyboard.type('A box'); await page.click('.pop [data-a="ok"]');
  const ms = await marks(page);
  const one = ms.find(m => m.text === 'One line'), box = ms.find(m => m.text === 'A box');
  assert.equal(one.rects, undefined); near(one.hl.x, wx(0, 1) - 1, 2.5);
  assert.deepEqual([box.hl.x, box.hl.y, box.hl.w, box.hl.h, box.rects], [100, 560, 160, 30, undefined]);
  await close();
});

/* ---------------- surviving save, reopen, turning and export ---------------- */
const SPOTS = m => (m.rects || [m]).map(r => [r.x + 2, r.y + 2, r.w - 4, r.h - 4]);
const inkOf = async (page, bytes, n, rects) => (await probePdf(page, bytes, n, rects)).ink;

async function exportZip(page, dl) {
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  return unzipSync(got.bytes);
}

test('new highlights survive saving, closing and reopening, unchanged', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await threeHighlights(page, true);
  await setTool(page, 'pen'); await drag(page, 1, [[100, 300], [200, 330], [300, 300]]);
  await settle(page);
  const was = await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.students[0].files[0].marks)));
  await page.reload(); await appReady(page);
  await openZip(page, zip, 'Marking.zip');
  const now = await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.students[0].files[0].marks)));
  assert.deepEqual(now, was);
  const shots = await probeScreen(page, 0, SPOTS(now[0][0]));
  assert.ok(shots.every(s => s.yellow > s.n * 0.5 || s.dark > 0), 'and they draw: ' + JSON.stringify(shots));
  assert.deepEqual(page.errors, []);
  await close();
});

test('every kind of highlight turns with the page, and four turns bring it back', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await threeHighlights(page, true);
  const was = await marks(page);
  const W = 612;
  await page.evaluate(() => [...document.querySelectorAll('[data-rot="1"]')][0].click());
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p.W > 700 && p.s > 0; });
  await page.waitForFunction(() => { const t = window.__gs.state().pages[0].tl; return t && t.length === 0; });   // the page is sideways now, its text no longer runs along, so the highlighter goes freehand there
  const t = await marks(page);
  const H = 792;
  // A quarter turn right: (x, y) goes to (H - y, x).
  t[0].rects.forEach((r, k) => { const o = was[0].rects[k]; near(r.x, H - o.y - o.h, 0.3); near(r.y, o.x, 0.3); near(r.w, o.h, 0.3); near(r.h, o.w, 0.3); });
  t[1].pts.forEach((p, k) => { near(p[0], H - was[1].pts[k][1], 0.2); near(p[1], was[1].pts[k][0], 0.2); });
  near(t[1].x, H - was[1].y - was[1].h, 0.3, 'freehand box'); near(t[2].y, was[2].x, 0.3, 'rectangle');
  t[3].rects.forEach((r, k) => { near(r.y, was[3].rects[k].x, 0.3, 'comment highlight'); });
  near(t[3].ax, H - was[3].ay, 0.2, 'comment spot');
  const s = await probeScreen(page, 0, SPOTS(t[0]));
  assert.ok(s.every(q => q.yellow > q.n * 0.35), 'the turned one shows where it should: ' + JSON.stringify(s));
  for (let i = 0; i < 3; i++) {
    const w = await page.evaluate(() => window.__gs.state().pages[0].W);
    await page.evaluate(() => [...document.querySelectorAll('[data-rot="1"]')][0].click());
    await page.waitForFunction(w => Math.abs(window.__gs.state().pages[0].W - w) > 100 && window.__gs.state().pages[0].s > 0, {}, w);
  }
  const back = await marks(page);
  back.forEach((m, i) => { if (m.rects) m.rects.forEach((r, k) => { near(r.x, was[i].rects[k].x, 0.31); near(r.y, was[i].rects[k].y, 0.31); near(r.w, was[i].rects[k].w, 0.31); }); if (m.pts) m.pts.forEach((p, k) => { near(p[0], was[i].pts[k][0], 0.21); near(p[1], was[i].pts[k][1], 0.21); }); });
  // Undo after a turn puts the marks back too.
  await page.evaluate(() => window.__gs.undo());
  await page.waitForFunction(w => window.__gs.state().pages[0].W > w, {}, W + 100);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the screen, the export and an editable export reopened all agree', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width: 1560, height: 950 });   // the paper as wide as it was before the sidebar took 60px: the spots below are small, and where they land depends on that width
  const dl = await catchDownloads(page);
  await open(page);
  await threeHighlights(page, true);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 520], [160, 545], [220, 520], [280, 545]]);
  await settle(page);
  const was = await marks(page);
  const [lines, free, rect, note, pen] = was;
  const gapBefore = [X, lineY(1) - 8, 20, 6];   // on the first line, before the highlight starts
  const freeOn = [195, 633, 10, 10], freeOff = [250, 680, 10, 8];
  const penBox = [90, 510, 200, 45];
  const probes = [...SPOTS(lines), ...SPOTS(rect), ...SPOTS(note), freeOn];
  const shown = await probeScreen(page, 0, probes.concat([gapBefore, freeOff, penBox]));
  const un = await exportZip(page, dl);
  const bytes = un['Aria Testwell/Essay.pdf'];
  const out = await inkOf(page, bytes, 1, probes.concat([gapBefore, freeOff, penBox]));
  out.slice(0, probes.length).forEach((o, i) => {
    assert.ok(o.yellow > 0, 'export has highlight at spot ' + i);
    near(o.yellow / o.n, shown[i].yellow / shown[i].n, 0.2, 'screen and export agree at spot ' + i);
  });
  assert.equal(out[probes.length].yellow, 0, 'nothing before the first word');
  assert.equal(out[probes.length + 1].yellow, 0, 'nothing beside the freehand stroke');
  assert.ok(out[probes.length + 2].red > 50, 'the pen is there');

  // Back in as an editable file.
  const { page: p2, close: c2 } = await openApp(browser);
  await openZip(p2, zipSync({ 'Aria Testwell/Essay.pdf': bytes }), 'Marked again.zip');
  const back = await marks(p2);
  assert.deepEqual(back, was, 'every point and box comes back as it was');
  await p2.waitForFunction(() => window.__gs.state().pages[0].tl);
  const again = await probeScreen(p2, 0, probes);
  again.forEach((o, i) => near(o.yellow / o.n, shown[i].yellow / shown[i].n, 0.2, 'reopened spot ' + i));
  // and they're still marks she can move
  await setTool(p2, 'select');
  await drag(p2, 0, [[wEnd(5), lineY(1) - 3], [wEnd(5) + 5, lineY(1) + 2]]);
  const moved = await marks(p2);
  assert.equal(moved.length, was.length);
  near(moved[0].rects[0].y, was[0].rects[0].y + 5, 0.3, 'moved');
  assert.deepEqual(p2.errors, []);
  await c2();
  await dl.close(); await close();
});

test('the Claude copy and the anonymous view draw highlights, with names still covered', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await threeHighlights(page, true);
  const was = await marks(page);
  const out = await page.evaluate(async (rects, cover) => {
    const s = window.__gs.state(), st = s.batch.students[0], f = st.files[0], js = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
    const { c, covers } = await window.__gs.sharePage(st, f, js, 0, 1, new RegExp('quick', 'g'));
    const x = c.getContext('2d');
    const ink = rects.map(([rx, ry, w, h]) => { const q = x.getImageData(rx, ry, w, h).data; let y = 0; for (let i = 0; i < q.length; i += 4) if (q[i] > 225 && q[i + 1] > 195 && q[i + 2] < 170) y++; return y; });
    js.destroy();
    return { ink, covers: covers.length };
  }, SPOTS(was[0]).concat(SPOTS(was[3])).map(r => r.map(Math.round)));
  assert.ok(out.ink.every(n => n > 0), 'each line shows: ' + out.ink);
  assert.equal(out.covers, 8, 'and the covers still go on');
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.waitForFunction(() => window.__gs.anonOn() && window.__gs.state().pages.length && window.__gs.state().pages[0].s > 0);
  await goToStudent(page, 0); await linesReady(page);
  const seen = await probeScreen(page, 0, SPOTS(was[0]));
  assert.ok(seen.every(q => q.yellow > 0), 'on screen too: ' + JSON.stringify(seen));
  assert.deepEqual(page.errors, []);
  await close();
});

test('zoomed in, a highlight lands on the same words and the pen on the same spot', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'hl');
  await drag(page, 0, [[X + 5, colY(1) - 4], [X + 60, colY(1) - 4]]);
  const at100 = (await marks(page))[0];
  await page.evaluate(() => window.__gs.undo());
  for (let i = 0; i < 4; i++) await page.click('.zoom [data-z="1"]');   // 160%
  await page.waitForFunction(() => window.__gs.state().zoom === 1.6);
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p.bmp && Math.abs(p.bmp.width - p.W * p.s * (window.devicePixelRatio || 1)) < 2; });
  await page.evaluate(() => { document.querySelector('#paper').scrollLeft = 0; });   // the left of the page, where these lines start
  await setTool(page, 'hl');
  await drag(page, 0, [[X + 5, colY(1) - 4], [X + 60, colY(1) - 4]]);
  assert.deepEqual((await marks(page))[0], at100);
  await setTool(page, 'pen');
  await drag(page, 0, [[100, 420], [160, 450], [220, 420]]);
  const m = (await marks(page))[1], last = m.pts[m.pts.length - 1];
  near(last[0], 220, 0.6, 'x'); near(last[1], 420, 0.6, 'y'); near(m.pts[0][0], 100, 0.6, 'start');
  assert.ok((await probeScreen(page, 0, [[150, 430, 20, 25]]))[0].red > 0, 'drawn where she drew it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('old rectangle highlights still draw, pick, move, turn and export', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await open(page);
  const old = { t: 'hl', color: '#FFE45C', x: 80, y: 610, w: 200, h: 16 };
  await page.evaluate(m => { const pg = window.__gs.state().pages[0]; pg.marks().push(m); window.__gs.draw(pg); window.__gs.saveNow(); }, old);
  await setTool(page, 'select');
  assert.ok((await probeScreen(page, 0, [[90, 612, 100, 10]]))[0].yellow > 500);
  await drag(page, 0, [[100, 615], [110, 625]]);
  const [m] = await marks(page);
  assert.deepEqual(m, { ...old, x: 90, y: 620 }, 'moving it changes nothing else');
  const un = await exportZip(page, dl);
  const [ink] = await inkOf(page, un['Aria Testwell/Essay.pdf'], 1, [[100, 622, 100, 10]]);
  assert.ok(ink.yellow > ink.n * 0.8, 'exported: ' + JSON.stringify(ink));
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

/* ---------------- text boxes and margin comments ---------------- */
async function typeBox(page, x, y, text) {
  await setTool(page, 'text');
  await clickAt(page, 0, x, y);
  await page.waitForSelector('textarea.ed');
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
}
const editing = page => page.evaluate(() => !!document.querySelector('textarea.ed'));

test('a new text box has a sensible width, stays picked, and moves without changing tools', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await typeBox(page, 100, 560, 'Nice start');
  let [m] = await marks(page);
  assert.equal(m.bw, 244.8, 'about 40% of the page, not all the way across');
  assert.equal(await page.evaluate(() => window.__gs.state().pages[0].canvas.style.cursor), 'text', 'Text stays the tool');
  // Right edge of the page: it's what's left, and she can see all of it.
  await typeBox(page, 590, 300, 'By the edge');
  let ms = await marks(page);
  assert.ok(ms[1].x + ms[1].bw <= 612 - 5.9 && ms[1].x < 510, 'stays on the page: ' + ms[1].x + ', ' + ms[1].bw);
  // Drag the first one straight away, still on the Text tool.
  const undos = () => page.evaluate(() => document.querySelector('#undoBtn').disabled);
  await drag(page, 0, [[110, 560], [160, 600]]);
  ms = await marks(page);
  near(ms[0].x, 150, 0.6, 'moved x'); near(ms[0].y, m.y + 40, 0.6, 'moved y');
  assert.equal(await editing(page), false, 'a drag does not start typing');
  await page.evaluate(() => window.__gs.undo());
  ms = await marks(page);
  near(ms[0].x, 100, 0.2, 'one undo puts it back');
  assert.equal(await undos(), false);
  // A plain click on it types in it.
  await clickAt(page, 0, 110, 560);
  await page.waitForSelector('textarea.ed');
  await page.keyboard.type(' again');
  await page.keyboard.press('Escape');
  ms = await marks(page);
  assert.equal(ms[0].text, 'Nice start again');
  // A click on blank paper starts a new box.
  await clickAt(page, 0, 300, 700);
  await page.waitForSelector('textarea.ed');
  await page.keyboard.type('Third');
  await page.keyboard.press('Escape');
  assert.equal((await marks(page)).length, 3);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the handles on a picked box set its width from either side, on the Text tool or the Select tool', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await typeBox(page, 100, 500, 'Some words for the box to wrap around a bit');
  const m0 = (await marks(page))[0];
  const R = m0.x + m0.bw + 3, midY = m0.y + 10;
  await drag(page, 0, [[R, midY], [R - 90, midY]]);
  let [m] = await marks(page);
  near(m.bw, m0.bw - 90, 1, 'right handle');
  assert.equal(m.x, m0.x, 'and the box stays put');
  await page.evaluate(() => window.__gs.undo());
  await page.evaluate(() => window.__gs.setTool('select'));
  await drag(page, 0, [[m0.x + 5, m0.y + 8], [m0.x + 5, m0.y + 8]]);   // pick it
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForFunction(() => !document.querySelector('textarea.ed'));
  await drag(page, 0, [[m0.x - 3, midY], [m0.x + 37, midY]]);
  [m] = await marks(page);
  near(m.x, m0.x + 40, 1, 'left handle moves the left edge');
  near(m.x + m.bw, m0.x + m0.bw, 1, 'and the right edge stays');
  // Near the edge of the page a box of set width moves in instead of being squeezed.
  const w = m.bw;
  await drag(page, 0, [[m.x + 5, m.y + 8], [m.x + 505, m.y + 8]]);
  [m] = await marks(page);
  assert.equal(m.bw, w, 'keeps its width');
  near(m.x + m.bw, 612 - 6, 1, 'against the edge');
  assert.deepEqual(page.errors, []);
  await close();
});

const turnPage = async (page, dir) => {
  const w = await page.evaluate(() => window.__gs.state().pages[0].W);
  await page.evaluate(d => document.querySelector('[data-rot="' + d + '"]').click(), dir);
  await page.waitForFunction(w => Math.abs(window.__gs.state().pages[0].W - w) > 100 && window.__gs.state().pages[0].s > 0, {}, w);
};
// How wide the words of a box are, however wide the box is.
const wordsW = (page, m) => page.evaluate(m => { const c = document.createElement('canvas').getContext('2d'); c.font = m.size + 'px Helvetica, Arial, "PingFang TC", "Microsoft JhengHei", sans-serif'; return Math.max(...m.text.split('\n').map(l => c.measureText(l).width)); }, m);

test('a clicked text box stays on its word when the page turns, either way, and four turns bring it back', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await typeBox(page, 100, 150, 'Good');
  // An older box with no set width, on the same spot: it has always turned to the right place.
  await page.evaluate(() => { const a = window.__gs.state().pages[0].marks(), { bw, ...old } = a[0]; a.push(old); });
  const was = await marks(page);
  const w = await wordsW(page, was[0]), h = was[0].size * 1.25;
  assert.ok(was[0].bw > 200 && was[1].bw === undefined, 'a wide box and a no-width one');
  await turnPage(page, 1);
  let [a, b] = await marks(page);
  near(a.x, b.x, 0.11, 'wide box x'); near(a.y, b.y, 0.11, 'wide box y');
  near(a.x + w / 2, 792 - (was[0].y + h / 2), 0.3, 'the word turned about its own middle, x'); near(a.y + h / 2, was[0].x + w / 2, 0.3, 'y');
  assert.ok(a.x + a.bw <= 792 - 5.9, 'the box fits on the turned page: ' + a.x + ', ' + a.bw);
  for (let i = 0; i < 3; i++) await turnPage(page, 1);
  [a, b] = await marks(page);
  near(a.x, was[0].x, 0.31, 'back after four turns, x'); near(a.y, was[0].y, 0.31, 'y');
  assert.equal(a.text, 'Good');
  // The other way, starting from the same spot.
  await page.evaluate(ms => { const arr = window.__gs.state().pages[0].marks(); arr.length = 0; arr.push(...ms); }, was);
  await turnPage(page, -1);
  [a, b] = await marks(page);
  near(a.x, b.x, 0.11, 'turned left, x'); near(a.y, b.y, 0.11, 'turned left, y');
  near(a.x + w / 2, was[0].y + h / 2, 0.3, 'turned left, the word x'); near(a.y + h / 2, 612 - (was[0].x + w / 2), 0.3, 'y');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a turned box keeps its lines, and words with no room left move in instead of running off', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await page.evaluate(() => {
    const a = window.__gs.state().pages[0].marks();
    a.push({ t: 'text', color: '#D7263D', x: 100, y: 150, size: 14, text: 'Some words here\nand a second line', bw: 300 });   // its empty part won't fit once turned, its words will
    a.push({ t: 'text', color: '#D7263D', x: 100, y: 20, size: 14, text: 'A long line of words that needs a good part of its box', bw: 400 });   // these won't fit where they turn to
  });
  const was = await marks(page);
  const tall = (m, W) => page.evaluate((m, W) => window.__gs.bboxOf(m, W).h, m, W);
  const h0 = await tall(was[0], 612), h1 = await tall(was[1], 612);
  await turnPage(page, 1);
  const [m, n] = await marks(page);
  const wm = await wordsW(page, m), wn = await wordsW(page, n);
  near(m.x + wm / 2, 792 - (was[0].y + h0 / 2), 0.3, 'the two lines sit where they turned to');
  assert.ok(m.bw >= wm && m.bw < 300 && m.x + m.bw <= 792 - 5.9, 'the box gave up its empty part: ' + m.x + ', ' + m.bw + ' for ' + wm);
  assert.equal(await tall(m, 792), h0, 'and still has two lines');
  assert.ok(n.bw >= wn && n.x + n.bw <= 792 - 5.9, 'the long one moved in, all on the page: ' + n.x + ', ' + n.bw + ' for ' + wn);
  assert.equal(await tall(n, 792), h1, 'still one line');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Select tool: clicking what is already picked types in it, and arrows still go between students on the Text tool', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await typeBox(page, 100, 500, 'Click me twice');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__gs.state().cur === 1);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.__gs.state().cur === 0 && window.__gs.state().pages.length > 1);
  await linesReady(page, 0); await linesReady(page, 1);   // both pages drawn, so nothing shifts under the next click
  await page.evaluate(() => window.__gs.setTool('select'));
  const [m] = await marks(page);
  await clickAt(page, 0, m.x + 8, m.y + 8);
  assert.equal(await editing(page), false, 'the first click picks it');
  await key(page, ['ArrowDown']);
  near((await marks(page))[0].y, m.y + 1, 0.2, 'Select tool arrows nudge, as always');
  await clickAt(page, 0, m.x + 8, m.y + 9);
  await page.waitForSelector('textarea.ed');
  await page.keyboard.press('Escape');
  // Double click still opens a box in one go, and leaves one undo step for it.
  await page.evaluate(() => window.__gs.setTool('pen')); await page.evaluate(() => window.__gs.setTool('select'));
  const q = await at(page, 0, m.x + 8, m.y + 9);
  await page.mouse.click(q.x, q.y, { count: 2 });
  await page.waitForSelector('textarea.ed');
  assert.equal(await page.evaluate(() => document.querySelectorAll('textarea.ed').length), 1);
  await page.keyboard.press('Escape');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Move grip moves a box while typing, and the words carry on', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'text');
  await clickAt(page, 0, 150, 500);
  await page.waitForSelector('textarea.ed');
  await page.keyboard.type('Moving');
  const g = await page.$eval('.edbar [data-grip]', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const s = await page.evaluate(() => window.__gs.state().pages[0].s);
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + 60 * s, g.y + 80 * s, { steps: 4 }); await page.mouse.up();
  await page.keyboard.type(' along');
  await page.keyboard.press('Escape');
  const [m] = await marks(page);
  assert.equal(m.text, 'Moving along', 'typing carries on in the box');
  near(m.x, 210, 1, 'moved across'); near(m.y, 500 - 7 + 80, 1, 'moved down');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Comment tool: click a comment spot to open it, drag it to move it', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await setTool(page, 'note');
  await clickAt(page, 0, 300, 620);
  await page.waitForSelector('.pop textarea'); await page.keyboard.type('Spot'); await page.click('.pop [data-a="ok"]');
  await setTool(page, 'note');
  await clickAt(page, 0, 300, 620);
  await page.waitForSelector('.pop textarea');
  assert.equal(await page.$eval('.pop textarea', e => e.value), 'Spot', 'opens that comment, instead of starting a second one on top');
  await page.keyboard.press('Escape');
  assert.equal((await marks(page)).length, 1);
  await drag(page, 0, [[300, 620], [340, 660]]);
  const [m] = await marks(page);
  near(m.ax, 340, 1); near(m.ay, 660, 1);
  assert.equal(await page.$('.pop textarea'), null, 'a drag does not open it');
  // Clicking the box in the margin still opens it, whatever the tool.
  await setTool(page, 'pen');
  const b = await page.evaluate(() => { const pg = window.__gs.state().pages[0], c = pg.boxes[0]; return [c.x + 10, c.y + 5]; });
  await clickAt(page, 0, b[0], b[1]);
  await page.waitForSelector('.pop textarea');
  await page.keyboard.press('Escape');
  assert.deepEqual(page.errors, []);
  await close();
});

test('text boxes survive reopening with their width, and the grade sheet crop still hugs a typed grade', async () => {
  const { page, close } = await openApp(browser);
  await open(page);
  await typeBox(page, 100, 500, '9.5/12 = 88%');
  await settle(page);
  const was = await marks(page);
  assert.ok(was[0].bw > 200);
  await page.reload(); await appReady(page);
  await openZip(page, zip, 'Marking.zip');
  assert.deepEqual(await marks(page), was);
  await page.evaluate(() => window.__gs.scanAll());
  const found = await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.students[0].files[0].scan.found)));
  assert.equal(found.length, 1, 'found the grade');
  assert.ok(found[0].rect[2] - found[0].rect[0] < 120, 'a tight crop, not the whole box: ' + found[0].rect);
  await close();
});
