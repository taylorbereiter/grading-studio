// Phase 5 paper scans: made-up scans that are sideways, upside down, crooked, faint and blank, through the rules and through the real app.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, appReady, waitPaper, goToStudent, pickFile, setTool, drag, settle, catchDownloads, answerDlg, press, closeBox } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
const { PAGE_SRC, tally } = require('./helpers/scans');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const scanPdf = async (page, specs) => { await page.evaluate(PAGE_SRC); return Buffer.from(await page.evaluate(sp => window.gsScan.pdf(sp), specs), 'base64'); };
const student = (page, i = 0) => page.evaluate(i => { const f = window.__gs.state().batch.students[i].files[0]; return { rot: f.rot || {}, skew: f.skew || {}, sc: f.sc || {} }; }, i);
const note = (page, k = 0) => page.evaluate(k => { const n = window.__gs.state().pages[k].snote; return n ? n.textContent : ''; }, k);
const noteBtn = (page, k, a) => page.evaluate((k, a) => window.__gs.state().pages[k].snote.querySelector('[data-sc="' + a + '"]').click(), k, a);
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, what + ': ' + a + ' is not within ' + tol + ' of ' + b);
// The middle of the black square, in points, as a page is drawn on screen now.
const squareOnScreen = (page, k = 0) => page.evaluate(k => {
  const pg = window.__gs.state().pages[k], c = pg.canvas, q = c.width / (pg.W + pg.side), w = Math.floor(pg.W * q), h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, r = Math.round(7 * q);
  const dark = (x, y) => { const i = (y * w + x) * 4; return d[i] < 70 && d[i + 1] < 70 && d[i + 2] < 70; };
  let sx = 0, sy = 0, n = 0;
  for (let y = r; y < h - r; y += 2) for (let x = r; x < w - r; x += 2) if (dark(x, y) && dark(x - r, y - r) && dark(x + r, y - r) && dark(x - r, y + r) && dark(x + r, y + r)) { sx += x; sy += y; n++; }
  return { x: n ? sx / n / q : -1, y: n ? sy / n / q : -1, W: pg.W, H: pg.H };
}, k);
// The first page of the student now open is drawn (not a page still up from the download open before it).
const shown = page => page.waitForFunction(() => { const s = window.__gs.state(), st = s.batch && s.batch.students[s.cur]; return s.pages[0] && s.pages[0].bmp && st && st.files.includes(s.pages[0].file); });
const redrawn = page => page.waitForFunction(() => new Promise(r => setTimeout(() => r(true), 400)));

test('on made-up scans the rules never turn a page the wrong way, and fix most pages they could', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const rows = await page.evaluate(() => window.gsScan.run({ seed: 11, perKind: 1 })), t = tally(rows);
  const say = JSON.stringify({ pages: t.pages, right: t.autoRight, wrong: t.autoWrong, ask: t.askRight, askWrong: t.askWrong, skew: t.skewAuto, skewWrong: t.skewAutoWrong });
  assert.equal(t.autoWrong, 0, 'wrong automatic turns: ' + t.wrong.map(r => r.kind + ' o' + r.o).join(', '));
  assert.equal(t.skewAutoWrong, 0, 'wrong automatic straightening: ' + t.skewWrong.map(r => r.kind + ' ' + r.skew).join(', '));
  assert.equal(t.skewFalse, 0, 'nothing crooked was made crooked');
  // How many get turned depends on the letter shapes, so on the fonts this computer draws the typed pages with: 33 with Windows' own
  // (one missed turn is accepted so that matrix pages are never turned the wrong way), 25 with the ones Linux puts in their place.
  // The handwritten pages are drawn stroke by stroke, the same everywhere, so their count is held exactly.
  const hand = Object.entries(t.byKind).filter(([k]) => /^handwriting/.test(k)).reduce((n, [, v]) => n + v.autoRight, 0);
  assert.ok(hand >= 13, 'handwritten pages get turned: ' + hand);
  assert.ok(t.autoRight >= 24, 'and so do most typed pages, whatever the font: ' + say);
  assert.ok(t.skewAuto >= t.needSkew * .6, 'and straightened: ' + say);
  assert.ok(t.askWrong <= t.pages * .03, 'it rarely asks about a page that was fine: ' + say);
  assert.equal(rows.filter(r => r.blank).length, 0, 'a page with writing is never called blank');
  assert.deepEqual(page.errors, []);
  await close();
});

test('blank paper is flagged, however it looks, and faint pages are told apart from clean ones', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const blanks = await page.evaluate(() => window.gsScan.runBlank({ seed: 12, perKind: 2 }));
  const strong = blanks.filter(b => b.how === 'show-through strong');
  assert.deepEqual(blanks.filter(b => !b.blank && b.how !== 'show-through strong').map(b => b.how), [], 'clean, speckled, ruled, pale ruled, a shadow, or the back just showing through');
  assert.deepEqual(strong.filter(b => b.blank || !b.faint).map(b => b.how), [], 'the back showing through as strongly as faded print stays in, as faint');
  const v = await page.evaluate(() => {
    const Z = window.gsScan, read = (w, seed) => { const r = Z.mulberry(seed), { g, w: a, h } = Z.toGray(Z.wear(Z.place(Z.KINDS['handwriting'](r), 0, 0), w, r), 1000); return window.__gs.scanRead(g, a, h).faint; };
    return { clean: read('clean', 3), faint: read('faint', 4), dim: read('dim', 5) };
  });
  assert.deepEqual(v, { clean: false, faint: true, dim: true });
  await close();
});

test('math and code pages are never turned by themselves, and a question about one never guesses a direction', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const rows = await page.evaluate(() => window.gsScan.run({ seed: 13, perKind: 6, kinds: Object.keys(window.gsScan.MATHS) }));
  const small = r => r.kind + ' o' + r.o;
  assert.equal(rows.length, 96);
  assert.deepEqual(rows.filter(r => r.turnSure === 2).map(small), [], 'turned without asking');
  // The white between short lines usually says no more than "on its side", and then it asks without a direction. How a computer draws the letters
  // decides whether a page of code reads as lines of writing instead; then it may say which way, and that has to be the right way.
  const guessed = rows.filter(r => r.turnSure && r.turn);
  assert.deepEqual(guessed.filter(r => r.turn !== r.want).map(r => small(r) + ' turned ' + r.turn + ' (right would be ' + r.want + ') ' + JSON.stringify(r.why)), [], 'asked with a wrong direction');
  assert.ok(guessed.length <= 2, 'asked with a direction for ' + guessed.length + ' of 96 math and code pages: ' + guessed.map(small).join(', '));
  assert.deepEqual(rows.filter(r => r.turnSure && !(r.want % 180 && r.sideways)).map(small), [], 'asked about a page that is not on its side');
  assert.ok(rows.filter(r => r.turnSure).length >= 24, 'and most pages on their side do ask');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a page of matrices with bars beside them is never turned by itself, and a question about one never guesses a direction', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const rows = await page.evaluate(() => window.gsScan.run({ seed: 14, perKind: 16, kinds: ['matrices'] }));
  const small = r => r.kind + ' o' + r.o + ' turned ' + r.turn + ' grain ' + r.why.grain;
  assert.equal(rows.length, 64);
  assert.deepEqual(rows.filter(r => r.turnSure === 2).map(small), [], 'turned without asking');
  assert.deepEqual(rows.filter(r => r.turnSure && r.turn).map(r => small(r) + ' turned ' + r.turn + ' (right would be ' + r.want + ') ' + JSON.stringify(r.why)), [], 'asked with a direction it can not know');
  assert.deepEqual(page.errors, []);
  await close();
});

test('no shape of matrix page is turned by itself or asked about with a direction, and a few lines of writing can still be turned', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const kinds = ['matrices 4x4', 'matrices tight', 'matrices no bars', 'matrices wide', 'matrices 5x5'];
  const rows = await page.evaluate(k => window.gsScan.run({ seed: 15, perKind: 8, kinds: k }), kinds);
  const small = r => r.kind + ' o' + r.o + ' turned ' + r.turn + ' grain ' + r.why.grain + ' cover ' + r.why.cover;
  assert.equal(rows.length, 160);
  assert.deepEqual(rows.filter(r => r.turnSure === 2).map(small), [], 'turned without asking');
  assert.deepEqual(rows.filter(r => r.turnSure && r.turn).map(r => small(r) + ' turned ' + r.turn + ' (right would be ' + r.want + ') ' + JSON.stringify(r.why)), [], 'asked with a direction it can not know');
  const few = await page.evaluate(() => window.gsScan.run({ seed: 16, perKind: 4, kinds: ['handwriting big short', 'typed half page', 'slide'] }));
  assert.deepEqual(few.filter(r => r.turnSure === 2 && r.turn !== r.want).map(small), [], 'and writing is never turned the wrong way');
  assert.ok(few.filter(r => r.turnSure === 2).length >= 18, 'a short page of writing still turns: ' + few.filter(r => r.turnSure === 2).length + ' of ' + few.filter(r => r.want).length);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a page of stacked sums on its side still asks, without a direction, and an upright one says nothing', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const rows = await page.evaluate(() => window.gsScan.run({ seed: 17, perKind: 4, kinds: ['stacked sums'] }));
  const small = r => 'o' + r.o + ' sure ' + r.turnSure + ' turn ' + r.turn + ' grain ' + r.why.grain;
  assert.deepEqual(rows.filter(r => r.want % 180 === 0 && r.turnSure).map(small), [], 'said something about a page that is not on its side');
  assert.deepEqual(rows.filter(r => r.want % 180 && !(r.turnSure === 1 && !r.turn && r.sideways)).map(small), [], 'on its side, and it did not ask');
  await close();
});

test('through the app, matrix pages scanned to JPEG in a PDF are never turned by themselves, upright or not, in the split or opened in a ZIP', async () => {
  const { page, close } = await openApp(browser);
  const specs = []; let seed = 15000;
  for (const kind of ['matrices 4x4', 'matrices tight']) for (let i = 0; i < 4; i++) for (const o of [0, 90, 180, 270]) specs.push({ kind, o, seed: ++seed, skew: [0, 3.5, -2.7, 1.2][i] });
  const bytes = await scanPdf(page, specs);
  const clean = await pickFile(page, '#scanIn', bytes, 'Matrices.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(n => { const S = window.__gs.sp(); return S && S.n === n && Object.keys(S.sc).length === n; }, { timeout: 200000, polling: 300 }, specs.length);
  const seen = await page.evaluate(() => { const S = window.__gs.sp(); return Object.keys(S.sc).filter(i => S.sc[i].didTurn || S.rot[i] || (S.sc[i].sure && S.sc[i].turn)).map(i => +i); });
  assert.deepEqual(seen.map(i => specs[i].kind + ' o' + specs[i].o + ' seed ' + specs[i].seed), [], 'turned or given a direction in the split');
  clean();
  assert.deepEqual(page.errors, []);
  await close();
  const { page: p2, close: close2 } = await openApp(browser);
  const one = await scanPdf(p2, [{ kind: 'matrices 4x4', o: 90, seed: 15002 }]);
  await openZip(p2, zipOf({ 'Aria Testwell/Scan.pdf': one }), 'Matrices.zip');
  await shown(p2);
  await p2.waitForFunction(() => { const f = window.__gs.state().batch.students[0].files[0]; return f.sc && f.sc[0]; }, { timeout: 60000 });
  await redrawn(p2);
  assert.deepEqual((await student(p2)).rot, {}, 'nothing was turned');
  assert.doesNotMatch(await note(p2), /Turned|upside down/);
  assert.deepEqual(p2.errors, []);
  await close2();
});

test('through the app, sideways code only asks, with Turn left and Turn right, and upright math is left in peace', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ kind: 'code', o: 90, seed: 9085 }, { kind: 'math problems', seed: 9008 }]);
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes }), 'Code.zip');
  await shown(page);
  await page.waitForFunction(() => { const f = window.__gs.state().batch.students[0].files[0]; return f.sc && f.sc[0]; });
  await redrawn(page);
  const s = await student(page);
  assert.deepEqual(s.rot, {}, 'nothing was turned');
  assert.match(await note(page), /may be on its side/);
  assert.equal(await page.evaluate(() => window.__gs.state().pages[0].snote.querySelectorAll('[data-sc="left"], [data-sc="right"], [data-sc="noturn"]').length), 3);
  await page.evaluate(() => window.__gs.state().pages[1].wrap.scrollIntoView());
  await page.waitForFunction(() => { const f = window.__gs.state().batch.students[0].files[0]; return f.sc && f.sc[1]; }, { timeout: 60000 });
  await redrawn(page);
  assert.equal((await student(page)).sc[1].turn || 0, 0);
  assert.doesNotMatch(await note(page, 1), /on its side|upside down|Turned/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a faint page of writing is called faint, never blank, however faded, and so is a lone word; punch holes and a staple are still blank', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const v = await page.evaluate(() => {
    const Z = window.gsScan, read = c => { const { g, w, h } = Z.toGray(c, 1000), o = window.__gs.scanRead(g, w, h); return { blank: o.blank, faint: o.faint }; };
    const out = { faded: [] };
    let s = 400;
    for (const kind of ['handwriting', 'handwriting pencil', 'handwriting messy', 'handwriting small', 'handwriting few lines', 'typed serif', 'typed sans', 'typed double', 'worksheet', 'poem centered', 'math problems', 'code'])
      for (const keep of [.1, .12, .15, .2]) for (const o of [0, 90, 180, 270]) { const r = Z.mulberry(++s), got = read(Z.wear(Z.place(Z.fade((Z.KINDS[kind] || Z.MATHS[kind])(r), keep), o, s % 5 - 2), 'clean', r)); if (got.blank || !got.faint) out.faded.push(kind + ' keep ' + keep + ' o' + o); }
    const sheet = draw => { const c = document.createElement('canvas'); c.width = 1020; c.height = 1320; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, 1020, 1320); x.fillStyle = x.strokeStyle = '#111'; draw(x); return c; };
    const word = (t, X = 300, Y = 500) => read(sheet(x => { x.font = '26px Arial'; x.fillText(t, X, Y); }));
    out.yes = word('Yes'); out.seven = word('7');
    out.sentence = read(Z.fade(sheet(x => { x.font = '26px Georgia'; x.fillText('The river stands for time in this story.', 120, 500); }), .2));
    out.holes = [50, 65, 80, 95].map(X => read(sheet(x => { x.fillStyle = '#222'; for (const y of [200, 660, 1120]) { x.beginPath(); x.arc(X, y, 16, 0, 6.3); x.fill(); } })).blank);
    out.holesWritten = read(sheet(x => { x.fillStyle = '#222'; for (const y of [200, 660, 1120]) { x.beginPath(); x.arc(65, y, 16, 0, 6.3); x.fill(); } x.font = '26px Georgia'; x.fillText('The river stands for time in this story.', 120, 500); })).blank;
    out.staple = read(sheet(x => { x.lineWidth = 3; x.beginPath(); x.moveTo(90, 90); x.lineTo(130, 70); x.stroke(); })).blank;
    return out;
  });
  assert.deepEqual(v.faded, [], 'writing called blank, or not called faint');
  assert.deepEqual(v.yes, { blank: false, faint: false });
  assert.deepEqual(v.seven, { blank: false, faint: false });
  assert.deepEqual(v.sentence, { blank: false, faint: true });
  assert.deepEqual(v.holes, [true, true, true, true]);
  assert.equal(v.holesWritten, false);
  assert.equal(v.staple, true);
  assert.deepEqual(page.errors, []);
  await close();
});

// Presses Leave out blank pages, waits for the pictures, and returns the pages shown. Nothing has gone yet.
async function blankView(page) {
  await page.click('#spBlank');
  await page.waitForSelector('#spBlankView');
  await page.waitForFunction(() => /^Leave out \d+ page/.test(document.querySelector('#spBlankGo').textContent), { timeout: 120000, polling: 200 });
  return page.$$eval('#spBlankPages [data-bk]', es => es.map(e => +e.dataset.bk));
}
// The whole way through: the pages are shown, and she presses the button in that view.
async function leaveOutBlank(page) {
  const shown = await blankView(page);
  await page.click('#spBlankGo');
  await page.waitForFunction(() => !document.querySelector('#spBlankView'));
  return shown;
}
const skipped = page => page.evaluate(() => [...window.__gs.sp().skip].sort((a, b) => a - b));

test('Leave out blank pages shows the pages as pictures first, and nothing goes until she presses the button in that view', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ seed: 71 }, { blank: 'clean', seed: 72 }, { kind: 'handwriting pencil', fade: .06, seed: 73 }, { blank: 'speckled', seed: 74 }, { blank: 'pale ruled', seed: 75 }, { seed: 76 }]);
  const clean = await pickFile(page, '#scanIn', bytes, 'Backs.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(() => { const S = window.__gs.sp(); return S && S.ink.filter(v => v != null).length === 6 && Object.keys(S.sc).length === 6; }, { timeout: 120000, polling: 300 });
  // Page 3 is very faint writing that gets called blank anyway: the mistake this view is here to catch.
  await page.evaluate(() => { const r = window.__gs.sp().sc[2]; r.blank = 1; delete r.faint; delete r.soft; });
  const others = [1, 3, 4], all = [1, 2, 3, 4];

  // Pressing it only shows them, as real pictures, with the button held back until each one is ready.
  await page.evaluate(() => { const S = window.__gs.sp(), get = S.doc.getPage; S.doc.getPage = n => new Promise(r => setTimeout(r, 500)).then(() => { S.doc.getPage = get; return S.doc.getPage(n); }); });   // the first picture takes a moment
  await page.click('#spBlank');
  await page.waitForSelector('#spBlankView');
  assert.equal(await page.$eval('#spBlankGo', b => b.disabled), true, 'no button until the pictures are ready');
  await page.waitForFunction(() => /^Leave out 4 pages$/.test(document.querySelector('#spBlankGo').textContent), { timeout: 120000, polling: 200 });
  assert.deepEqual(await skipped(page), [], 'nothing has gone yet');
  assert.deepEqual(await page.$$eval('#spBlankPages [data-bk]', es => es.map(e => +e.dataset.bk)), all);
  const pics = await page.$$eval('#spBlankPages [data-bk] img', es => Promise.all(es.map(async im => { await im.decode(); return { w: im.naturalWidth, h: im.naturalHeight, seen: im.getBoundingClientRect().width > 150, alt: im.alt }; })));
  assert.deepEqual(pics.map(p => p.alt), ['Page 2', 'Page 3', 'Page 4', 'Page 5']);
  assert.ok(pics.every(p => p.w >= 500 && p.h >= 500 && p.seen), JSON.stringify(pics));

  // The picture shows the faint writing plainly, where the page itself barely shows it.
  const darkShare = (src, x) => new Promise(ok => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0); const d = ctx.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 160) n++; ok(n / (d.length / 4)); }; im.src = src; });
  const shares = await page.evaluate(async fn => { const share = eval(fn), S = window.__gs.sp(); return { thumb: await share(S.thumbs[2]), shown: await share(document.querySelector('[data-bk="2"] img').src), clean: await share(document.querySelector('[data-bk="1"] img').src) }; }, darkShare.toString());
  assert.ok(shares.shown > .005, 'the faint writing shows: ' + JSON.stringify(shares));
  assert.ok(shares.shown > shares.thumb * 5, 'much plainer than the page itself: ' + JSON.stringify(shares));
  assert.ok(shares.clean < .001, 'clean paper still looks clean: ' + JSON.stringify(shares));

  // Clicking a page shows it big, and Esc only closes the big page.
  await page.click('[data-bk="2"] img');
  await page.waitForSelector('#spBig');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#spBig'));
  assert.ok(await page.$('#spBlankView'), 'the view is still open');

  // Backing out, by either way, takes nothing.
  await page.click('#spBlankNo');
  assert.equal(await page.$('#spBlankView'), null);
  assert.deepEqual(await skipped(page), []);
  await blankView(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#spBlankView'));
  assert.ok(await page.$('#spPages'), 'Esc closes the view, not the split');
  assert.deepEqual(await skipped(page), []);

  // Keep every one and there is nothing for the button to do.
  await blankView(page);
  for (const i of all) await page.click('[data-bk="' + i + '"] [data-bkkeep]');
  assert.equal(await page.$eval('#spBlankGo', b => b.disabled), true);
  for (const i of others) await page.click('[data-bk="' + i + '"] [data-bkkeep]');   // changed her mind on these
  assert.equal(await page.$eval('#spBlankGo', b => b.textContent), 'Leave out 3 pages');
  assert.deepEqual(await skipped(page), [], 'still nothing until she presses it');

  // She kept the faint page: the rest go, and that one stays free to give to a student.
  await page.click('#spBlankGo');
  await page.waitForFunction(() => !document.querySelector('#spBlankView'));
  assert.deepEqual(await skipped(page), others);
  assert.equal(await page.$eval('#spPages [data-spg="2"]', e => e.classList.contains('skip')), false);
  assert.equal(await page.$eval('#spPages [data-spg="1"]', e => e.classList.contains('skip')), true);

  // Pressing it again shows only what's still in: the page she kept, for another look.
  assert.deepEqual(await blankView(page), [2]);
  await page.click('#spBlankNo');
  assert.deepEqual(await skipped(page), others);

  // A page that can't be drawn can't be checked, so it stays.
  await page.evaluate(() => { const S = window.__gs.sp(), get = S.doc.getPage.bind(S.doc); S.doc.getPage = n => n === 3 ? Promise.reject(new Error('no page')) : get(n); });
  await page.click('#spBlank');
  await page.waitForSelector('#spBlankView .bad');
  await page.waitForFunction(() => document.querySelector('#spBlankGo').textContent !== 'Getting the pages ready…');
  assert.equal(await page.$eval('#spBlankGo', b => b.disabled), true, 'nothing left to take out');
  assert.match(await page.$eval('[data-bk="2"]', e => e.textContent), /stays in/);
  await page.click('#spBlankNo');
  assert.deepEqual(await skipped(page), others);
  assert.deepEqual(page.errors, []);
  clean();
  await close();
});

test('the blank-page pictures show faint writing on an unevenly lit scan, with the shadow staying white', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  // paper: its tone from the left of the page to the right. x: left edge of a few faint lines, or none.
  const plan = [{ paper: [232, 170], x: 560 }, { paper: [232, 170], x: 70 }, { paper: [255, 165], x: 560 }, { paper: [232, 170], x: -1 }, { paper: [240, 240], x: 560 }, { paper: [240, 240], x: -1 }];
  const bytes = Buffer.from(await page.evaluate(async plan => {
    const G = window.gsScan, doc = await PDFLib.PDFDocument.create();
    for (const [i, p] of plan.entries()) {
      const r = G.mulberry(70 + i), W = 1020, H = 1320, c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      if (p.x >= 0) x.drawImage(G.pageOf('handwriting few lines')(r), 100, 100, 700, 180, p.x, 620, 420, 108);
      const im = x.getImageData(0, 0, W, H), d = im.data, gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2832 * r());
      for (let y = 0, k = 0; y < H; y++) for (let q = 0; q < W; q++, k += 4) d[k] = d[k + 1] = d[k + 2] = Math.max(0, Math.min(255, (p.paper[0] + (p.paper[1] - p.paper[0]) * Math.pow(q / W, 1.3)) * (1 - (255 - d[k]) / 255 * .08) + gauss() * 1.2));
      x.putImageData(im, 0, 0);
      const jpg = await new Promise(res => c.toBlob(b => b.arrayBuffer().then(u => res(new Uint8Array(u))), 'image/jpeg', .9));
      doc.addPage([612, 792]).drawImage(await doc.embedJpg(jpg), { x: 0, y: 0, width: 612, height: 792 });
    }
    const u = await doc.save(); let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(bin);
  }, plan), 'base64');
  const clean = await pickFile(page, '#scanIn', bytes, 'Light.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(n => { const S = window.__gs.sp(); return S && S.ink.filter(v => v != null).length === n && Object.keys(S.sc).length === n; }, { timeout: 120000, polling: 300 }, plan.length);
  // The view shows whichever pages are called blank. Show them all here, so each picture can be checked.
  await page.evaluate(() => { for (const r of Object.values(window.__gs.sp().sc)) { r.blank = 1; delete r.faint; delete r.soft; } });
  assert.deepEqual(await blankView(page), plan.map((_, i) => i));
  const seen = await page.evaluate(async plan => {
    const out = [];
    for (const [i, p] of plan.entries()) {
      const im = document.querySelector('[data-bk="' + i + '"] img'); await im.decode();
      const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, W, H).data; let note = 0, noteDark = 0, rest = 0, restDark = 0;
      for (let y = 0, k = 0; y < H; y++) for (let q = 0; q < W; q++, k += 4) {
        const inNote = p.x >= 0 && q >= p.x / 1020 * W && q < (p.x + 420) / 1020 * W && y >= .46 * H && y < .56 * H;
        if (inNote) { note++; if (d[k] < 160) noteDark++; } else { rest++; if (d[k] < 160) restDark++; }
      }
      out.push({ note: note ? noteDark / note : null, rest: restDark / rest });
    }
    return out;
  }, plan);
  seen.forEach((s, i) => {
    assert.ok(s.rest < .01, 'the paper stays white on page ' + (i + 1) + ': ' + JSON.stringify(seen));
    if (plan[i].x >= 0) assert.ok(s.note > .03, 'the writing shows on page ' + (i + 1) + ': ' + JSON.stringify(seen));
  });
  await page.click('#spBlankNo');
  assert.deepEqual(page.errors, []);
  clean();
  await close();
});

test('a very faint page of writing stays in when Leave out blank pages is pressed, however it was scanned, and blank paper still goes', async () => {
  const { page, close } = await openApp(browser);
  const faint = [
    { kind: 'tiny code', fade: .1, o: 90, q: .5, seed: 140130 }, { kind: 'tiny code', fade: .1, wear: 'noisy', q: .5, seed: 140133 },
    { kind: 'math problems', fade: .08, q: .5, seed: 140201 }, { kind: 'code', fade: .08, o: 90, seed: 140084 },
    { kind: 'handwriting pencil', fade: .08, seed: 140163 }, { kind: 'typed serif', fade: .06, o: 90, q: .5, seed: 130061 },
  ];
  const empty = ['clean', 'speckled', 'ruled', 'pale ruled', 'shadow'].flatMap((how, k) => [{ blank: how, seed: 150 + k }, { blank: how, q: .5, seed: 160 + k }]);
  const specs = [...faint, ...empty], bytes = await scanPdf(page, specs);
  const clean = await pickFile(page, '#scanIn', bytes, 'Faint.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(n => { const S = window.__gs.sp(); return S && S.n === n && S.ink.filter(v => v != null).length === n && Object.keys(S.sc).length === n; }, { timeout: 200000, polling: 300 }, specs.length);
  const tags = await page.evaluate(() => [...document.querySelectorAll('#spPages [data-fl]')].map(e => e.textContent));
  assert.deepEqual(await leaveOutBlank(page), empty.map((_, k) => faint.length + k), 'she’s shown only the blank paper');
  const left = await page.evaluate(() => [...window.__gs.sp().skip].sort((a, b) => a - b));
  assert.deepEqual(left, empty.map((_, k) => faint.length + k), 'only the blank paper was left out');
  faint.forEach((sp, i) => assert.match(tags[i], /Faint/, sp.kind + ' is called faint'));
  assert.deepEqual(page.errors, []);
  clean();
  await close();
});

test('faded pages come through blur and gray paper without being called blank', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const got = await page.evaluate(async () => {
    const Z = window.gsScan, out = [];
    const blur = (c, px) => { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d', { willReadFrequently: true }); x.filter = 'blur(' + px + 'px)'; x.drawImage(c, 0, 0); return o; };
    const gray = c => { const x = c.getContext('2d'); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over'; return c; };
    const FIN = { blur1: c => blur(c, 1), blur2: c => blur(c, 2), gray };
    let s = 900;
    for (const kind of ['typed serif', 'typed two columns', 'code', 'math problems', 'tiny code', 'handwriting pencil']) for (const [keep, fin] of [[.1, 'blur1'], [.1, 'blur2'], [.12, 'blur2'], [.12, 'gray']]) for (const o of [0, 90]) {
      const r = Z.mulberry(++s), c = FIN[fin](Z.place(Z.fade(Z.pageOf(kind)(r), keep), o, s % 5 - 2)), { g, w, h } = Z.toGray(c, 1000), v = window.__gs.scanRead(g, w, h);
      if (v.blank) out.push(kind + ' keep ' + keep + ' ' + fin + ' o' + o);
    }
    return out;
  });
  assert.deepEqual(got, [], 'called blank');
  assert.deepEqual(page.errors, []);
  await close();
});

test('an upside-down crooked scan is fixed when opened, says so, and Put back undoes it for good', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ kind: 'handwriting ruled', o: 180, skew: 2.5, box: true }]), typed = await makePaper({ title: 'Typed essay' });
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes, 'Bram Sample/Essay.pdf': typed }), 'Scans.zip');
  await shown(page);
  let s = await student(page);
  assert.equal(s.rot[0], 180, 'turned');
  near(s.skew[0], -2.5, .4, 'straightened');
  assert.match(await note(page), /Turned and straightened/);
  await redrawn(page);
  const sq = await squareOnScreen(page);
  near(sq.x, 420 + 12, 3, 'the square is where it is on the level page, across');
  near(sq.y, 600 + 12, 3, 'and down');
  // Nothing about a typed paper changes.
  await page.evaluate(() => window.__gs.openStudent(1)); await page.waitForFunction(() => window.__gs.state().cur === 1 && window.__gs.state().pages[0] && window.__gs.state().pages[0].bmp);
  assert.deepEqual({ rot: (await student(page, 1)).rot, skew: (await student(page, 1)).skew }, { rot: {}, skew: {} });
  assert.equal(await note(page), '');
  await page.evaluate(() => window.__gs.openStudent(0)); await page.waitForFunction(() => window.__gs.state().cur === 0 && window.__gs.state().pages[0] && window.__gs.state().pages[0].bmp);
  // Kept over a reload, and it doesn't count as her starting this student.
  await settle(page);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__gs.state().batch.id)));
  assert.ok(kept.scan['Aria Testwell/Scan.pdf'], 'what was decided is kept');
  assert.equal(kept.s['Aria Testwell'], undefined, 'and she has not started this student');
  await page.reload(); await appReady(page);
  await page.waitForSelector('#kept [data-kopen]'); await page.click('#kept [data-kopen]'); await waitPaper(page);
  s = await student(page);
  assert.equal(s.rot[0], 180); near(s.skew[0], -2.5, .4, 'still straight');
  // Put back
  await noteBtn(page, 0, 'back');
  s = await student(page);
  assert.deepEqual({ rot: s.rot, skew: s.skew }, { rot: {}, skew: {} }, 'as scanned');
  await settle(page);
  await page.reload(); await appReady(page);
  await page.waitForSelector('#kept [data-kopen]'); await page.click('#kept [data-kopen]'); await waitPaper(page);
  s = await student(page);
  assert.deepEqual({ rot: s.rot, skew: s.skew }, { rot: {}, skew: {} }, 'and it stays put back');
  assert.equal(await note(page), '');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a page with her marks on it is only ever asked about, and the marks stay on the same words when it changes', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ skew: 3, box: true }]);
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes }), 'Marked.zip');
  await shown(page);
  await noteBtn(page, 0, 'back');
  await redrawn(page);
  // She marks the square on the page as scanned, so the mark sits on it.
  const at = await squareOnScreen(page);
  await setTool(page, 'pen');
  await drag(page, 0, [[at.x - 10, at.y], [at.x + 10, at.y]]);
  await setTool(page, 'select');
  const before_ = await page.evaluate(() => JSON.stringify(window.__gs.state().pages[0].marks()));
  // Straighten: the mark goes with the square.
  await page.evaluate(() => { const pg = window.__gs.state().pages[0]; window.__gs.scanStraighten(pg, pg.file.sc[0].skew); });
  await redrawn(page);
  const after_ = await page.evaluate(() => window.__gs.state().pages[0].marks()[0].pts), sq = await squareOnScreen(page);
  near(sq.x, 432, 3, 'the square is level'); near(sq.y, 612, 3, 'the square is level');
  const mx = after_.reduce((a, q) => a + q[0], 0) / after_.length, my = after_.reduce((a, q) => a + q[1], 0) / after_.length;
  near(mx, sq.x, 3, 'the mark is still on it, across'); near(my, sq.y, 3, 'the mark is still on it, down');
  // Undo brings both back.
  await page.evaluate(() => window.__gs.undo());
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gs.state().pages[0].marks())), before_);
  assert.equal(await page.evaluate(() => window.__gs.skewOf(window.__gs.state().pages[0].file, 0)), 0);
  // Old work: marks, and nothing saved about the scan. The page isn't changed behind her back.
  await settle(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.reload(); await appReady(page);
  await page.waitForSelector('#kept [data-kopen]');
  await page.evaluate(async id => {
    const d = JSON.parse(localStorage.getItem(id)); delete d.scan; localStorage.setItem(id, JSON.stringify(d));
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('work', 'readwrite'), o = tx.objectStore('work'), q = o.get(id); q.onsuccess = () => { const w = q.result; delete w.scan; o.put(w, id); }; tx.oncomplete = res; });
    db.close();
  }, id);
  await page.click('#kept [data-kopen]'); await waitPaper(page);
  const s = await student(page);
  assert.deepEqual({ rot: s.rot, skew: s.skew }, { rot: {}, skew: {} }, 'still as scanned');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gs.state().pages[0].marks())), before_, 'with her mark');
  assert.match(await note(page), /looks crooked/, 'and it asks');
  await noteBtn(page, 0, 'skew');
  near((await student(page)).skew[0], -3, .4, 'Straighten does it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a straightened page looks the same on screen and in the export, marks included, and comes back when the export is reopened', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ o: 90, skew: -3, box: true, kind: 'handwriting' }]);
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes }), 'Same.zip');
  await shown(page);
  const s = await student(page);
  assert.equal(s.rot[0], 270); near(s.skew[0], 3, .4, 'straightened');
  await redrawn(page);
  const sq = await squareOnScreen(page);
  await setTool(page, 'pen');
  await drag(page, 0, [[sq.x - 12, sq.y], [sq.x + 12, sq.y]]);
  await setTool(page, 'select');
  await redrawn(page);
  const screen = await page.evaluate(() => {
    const pg = window.__gs.state().pages[0], c = pg.canvas, q = c.width / (pg.W + pg.side), o = document.createElement('canvas'); o.width = 61; o.height = 79;
    const x = o.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, pg.W * q, pg.H * q, 0, 0, 61, 79);
    return Array.from(x.getImageData(0, 0, 61, 79).data);
  });
  const dl = await catchDownloads(page);
  await page.evaluate(() => window.__gs.openExport());
  await page.waitForSelector('[data-go="zip"]');
  const got = await dl.next(() => page.click('[data-go="zip"]'));
  const zip = unzipSync(got.bytes), name = Object.keys(zip).find(k => k.startsWith('Aria')), out = zip[name];
  const [diff, red, plain] = await page.evaluate(async (b64, b64Scan, screen, x0, y0) => {
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise, p = await d.getPage(1), vp = p.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await p.render({ canvasContext: x, viewport: vp }).promise;
    const q = x.getImageData(Math.round((x0 - 14) * 2), Math.round((y0 - 6) * 2), 56, 24).data; let reds = 0; for (let i = 0; i < q.length; i += 4) if (q[i] > 170 && q[i + 1] < 110 && q[i + 2] < 110) reds++;
    const W = 612 * 2, H = 792 * 2, o = document.createElement('canvas'); o.width = 61; o.height = 79;
    const y = o.getContext('2d', { willReadFrequently: true }); y.imageSmoothingQuality = 'high'; y.drawImage(c, 0, 0, W, H, 0, 0, 61, 79);
    const e = y.getImageData(0, 0, 61, 79).data; let all = 0; for (let i = 0; i < e.length; i += 4) all += Math.abs(e[i] - screen[i]);
    // The same comparison with the page left crooked, to show how far apart a real difference is.
    const sb = atob(b64Scan), su = new Uint8Array(sb.length); for (let i = 0; i < sb.length; i++) su[i] = sb.charCodeAt(i);
    const d2 = await pdfjsLib.getDocument({ data: su, isEvalSupported: false }).promise, p2 = await d2.getPage(1), v2 = p2.getViewport({ scale: 2, rotation: 270 });
    const c2 = document.createElement('canvas'); c2.width = Math.ceil(v2.width); c2.height = Math.ceil(v2.height);
    const x2 = c2.getContext('2d', { willReadFrequently: true }); x2.fillStyle = '#fff'; x2.fillRect(0, 0, c2.width, c2.height); await p2.render({ canvasContext: x2, viewport: v2 }).promise;
    y.drawImage(c2, 0, 0, W, H, 0, 0, 61, 79);
    const e2 = y.getImageData(0, 0, 61, 79).data; let all2 = 0; for (let i = 0; i < e2.length; i += 4) all2 += Math.abs(e2[i] - screen[i]);
    d2.destroy(); d.destroy(); return [all / (e.length / 4), reds, all2 / (e2.length / 4)];
  }, Buffer.from(out).toString('base64'), bytes.toString('base64'), screen, sq.x, sq.y);
  assert.ok(diff < 8 && plain > diff * 1.5, 'screen and export match, on average within ' + diff.toFixed(1) + ' of 255, against ' + plain.toFixed(1) + ' if it were left crooked');
  assert.ok(red > 20, 'her mark is on the square in the export: ' + red);
  // The export opened again: the same turn, the same straightening, the same mark.
  await page.evaluate(() => { const b = document.querySelector('#dlgBox [data-close]'); if (b) b.click(); });
  const again = await openApp(browser);
  await openZip(again.page, zipOf({ 'Aria Testwell/Scan.pdf': out }), 'Back.zip');
  await shown(again.page);
  const b = await student(again.page);
  assert.equal(b.rot[0], 270); near(b.skew[0], s.skew[0], .01, 'the straightening came back');
  assert.equal(await again.page.evaluate(() => window.__gs.state().pages[0].marks().length), 1);
  assert.deepEqual(again.page.errors, []);
  await again.close(); await dl.close();
  assert.deepEqual(page.errors, []);
  await close();
});

test('in the split: pages are fixed and flagged as they are read, Put back is kept, and what was decided goes along to the student', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ seed: 21 }, { o: 180, seed: 22, box: true }, { blank: 'speckled', seed: 23 }, { wear: 'faint', seed: 24 }, { skew: 3, seed: 25 }, { o: 180, seed: 26 }]);
  const clean = await pickFile(page, '#scanIn', bytes, 'Everyone.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(() => Object.keys(window.__gs.sp().sc).length === 6 && window.__gs.sp().thumbs.filter(Boolean).length === 6, { timeout: 60000 });
  const tag = i => page.$eval('#spPages [data-fl="' + i + '"]', e => e.textContent);
  assert.match(await tag(1), /Turned/); assert.match(await tag(2), /Looks blank/); assert.match(await tag(3), /Faint/); assert.match(await tag(4), /Straightened/);
  assert.equal(await tag(0), '');
  assert.match(await page.$eval('#spStat', e => e.textContent), /2 pages turned, 1 straightened, 1 looks blank, 1 looks faint/);
  // She puts the last page back, and names her students.
  await page.click('#spPages [data-fl="5"] [data-spfix="back"]');
  assert.deepEqual(await leaveOutBlank(page), [2]);
  const add = async nm => { await page.click('#spAdd'); await answerDlg(page, { typed: nm }); await page.waitForFunction(nm => [...document.querySelectorAll('#spNames b')].some(b => b.textContent === nm), {}, nm); };
  await add('Aria Testwell'); await add('Bram Sample');
  const give = async (list, k) => {
    await page.click('#spPages [data-spg="' + list[0] + '"] .spf');
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(mod);
    for (const i of list.slice(1)) await page.click('#spPages [data-spg="' + i + '"] .spf');
    await page.keyboard.up(mod);
    await page.click('#spNames [data-spn="' + k + '"]');
  };
  await give([0, 1], 0); await give([3, 4, 5], 1);
  await page.click('#spGo');
  await waitPaper(page);
  const a = await student(page, 0), b = await student(page, 1);
  assert.deepEqual(a.rot, { 1: 180 }, 'the second page of Aria’s file is turned');
  assert.equal(Object.keys(b.rot).length, 0, 'Bram’s put-back page stays as scanned');
  near(b.skew[1], -3, .4, 'and his crooked page is straight');
  assert.ok(await page.evaluate(() => window.__gs.state().pages.length >= 2));
  assert.match(await note(page, 1), /Turned/, 'the page says what was done, with Put back');
  clean();
  assert.deepEqual(page.errors, []);
  await close();
});

test('a newer copy of the download brings a marked page over with its turn, its straightening and its marks', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ kind: 'handwriting ruled', o: 180, skew: 2.5, box: true }]), other = await makePaper({ title: 'Another essay' });
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes, 'Bram Sample/Essay.pdf': other }), 'First.zip');
  await shown(page);
  const was = await student(page);
  await redrawn(page);
  const sq = await squareOnScreen(page);
  await setTool(page, 'pen');
  await drag(page, 0, [[sq.x - 10, sq.y], [sq.x + 10, sq.y]]);
  await setTool(page, 'select');
  await settle(page);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__gs.state().batch.id)).s['Aria Testwell']);
  assert.ok(kept.sk['Aria Testwell/Scan.pdf'], 'a marked page keeps its straightening with her work');
  await page.reload(); await appReady(page);
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes, 'Bram Sample/Essay.pdf': other, 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'A late essay' }) }), 'Second.zip');
  await page.waitForSelector('#carryBox'); await closeBox(page);
  await shown(page);
  const now = await student(page);
  assert.equal(now.rot[0], 180); assert.equal(now.skew[0], was.skew[0]);
  await redrawn(page);
  const back = await squareOnScreen(page), m = await page.evaluate(() => window.__gs.state().pages[0].marks()[0].pts);
  near(back.x, sq.x, 2, 'the square is in the same place'); near(m[0][1], back.y, 3, 'with the mark still on it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('leaving out blank pages keeps a faint page of writing', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ kind: 'handwriting pencil', wear: 'faint', seed: 31 }, { blank: 'clean', seed: 32 }, { kind: 'handwriting pencil', fade: .12, seed: 33 }, { kind: 'typed serif', fade: .1, seed: 34 }, { blank: 'show-through', seed: 35 }]);
  const clean = await pickFile(page, '#scanIn', bytes, 'Pencil.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(() => window.__gs.sp().thumbs.filter(Boolean).length === 5, { timeout: 60000 });
  assert.deepEqual(await leaveOutBlank(page), [1, 4]);
  const left = await page.evaluate(() => [...window.__gs.sp().skip].sort());
  assert.deepEqual(left, [1, 4]);
  clean();
  await close();
});

test('Fix the lighting on a faint page makes the writing darker, for this student only, and Put back undoes it', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ kind: 'handwriting', wear: 'faint', seed: 41 }]);
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes, 'Bram Sample/Essay.pdf': await makePaper({ title: 'Typed' }) }), 'Faint.zip');
  await shown(page);
  assert.match(await note(page), /looks faint/);
  const dark = () => page.evaluate(() => { const pg = window.__gs.state().pages[0], c = pg.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 110) n++; return n; });
  const was = await dark();
  await noteBtn(page, 0, 'light');
  await page.waitForFunction(() => window.__gs.lightFor(window.__gs.state().batch.students[0]).c > 0);
  await redrawn(page);
  assert.ok(await dark() > was + 500, 'darker writing');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.light['*']), undefined, 'just this student');
  assert.match(await note(page), /Lighting is on/);
  await noteBtn(page, 0, 'unlit');
  await redrawn(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.light['Aria Testwell']), undefined);
  assert.equal(await note(page), '', 'and it doesn’t keep asking');
  assert.deepEqual(page.errors, []);
  await close();
});

test('A scan with its words read by OCR is still a scan: it is turned and flagged, and it stays crooked so the words stay under the page', async () => {
  const { page, close } = await openApp(browser);
  const words = 'the river in this story stands for time and the narrator returns to it';
  const bytes = await scanPdf(page, [{ o: 180, skew: 3, seed: 51, ocr: words }, { blank: 'clean', seed: 52, ocr: words }]);
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes }), 'Ocr.zip');
  await shown(page);
  await page.waitForFunction(() => { const f = window.__gs.state().batch.students[0].files[0]; return f.sc && f.sc[0]; });
  await redrawn(page);
  const s = await student(page);
  assert.deepEqual(s.rot, { 0: 180 });
  assert.deepEqual(s.skew, {});
  assert.match(await note(page), /Turned this page/);
  assert.equal(s.sc[0].typed, undefined);
  assert.deepEqual(page.errors, []);
  await close();
});

test('In the split, a page turned by answering the question has the same tag and way back as one turned by itself', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ kind: 'code', o: 90, seed: 9085 }]);
  const clean = await pickFile(page, '#scanIn', bytes, 'Code.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(() => Object.keys(window.__gs.sp().sc).length === 1 && window.__gs.sp().thumbs.filter(Boolean).length === 1, { timeout: 60000 });
  const tag = () => page.$eval('#spPages [data-fl="0"]', e => e.textContent);
  assert.match(await tag(), /On its side\? Turn it/);
  await page.click('#spPages [data-fl="0"] [data-spfix="right"]');
  assert.match(await tag(), /Turned · put back/);
  assert.equal(await page.evaluate(() => window.__gs.sp().rot[0]), 90);
  await page.click('#spPages [data-fl="0"] [data-spfix="back"]');
  assert.equal(await page.evaluate(() => window.__gs.sp().rot[0]), undefined);
  assert.equal(await tag(), '', 'and she was not asked again');
  clean();
  assert.deepEqual(page.errors, []);
  await close();
});

test('Put back on one student leaves another student lit, the last one turns Lighting off again, and the strip follows the panel', async () => {
  const { page, close } = await openApp(browser);
  const bytes = await scanPdf(page, [{ kind: 'handwriting', wear: 'faint', seed: 41 }]);
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': bytes, 'Bram Sample/Scan.pdf': bytes, 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'Typed' }) }), 'Lit.zip');
  await shown(page);
  const isOn = () => page.evaluate(() => { const o = window.__gs.state().batch.lightOpt; return !o || o.on !== false; });
  await page.evaluate(() => { const b = window.__gs.state().batch; b.lightOpt = { on: false, rub: false, exp: true }; });
  const litNote = async () => { await shown(page); await page.waitForFunction(() => { const pg = window.__gs.state().pages[0]; return pg.snote && /faint|Lighting/.test(pg.snote.textContent); }, { timeout: 15000 }); };
  await litNote();
  await noteBtn(page, 0, 'light');
  await page.waitForFunction(() => /Lighting is on/.test(window.__gs.state().pages[0].snote.textContent));
  assert.equal(await isOn(), true);
  await goToStudent(page, 1); await litNote();
  await noteBtn(page, 0, 'light');
  await page.waitForFunction(() => /Lighting is on/.test(window.__gs.state().pages[0].snote.textContent));
  await goToStudent(page, 0); await litNote();
  await noteBtn(page, 0, 'unlit');
  await redrawn(page);
  assert.equal(await isOn(), true, 'the other student still has it');
  await goToStudent(page, 1); await litNote();
  assert.match(await note(page), /Lighting is on/);
  await noteBtn(page, 0, 'unlit');
  await redrawn(page);
  assert.equal(await isOn(), false, 'and it goes back off with the last one');
  // The strip doesn't stay behind when she switches Lighting off herself.
  await page.evaluate(() => { window.__gs.state().batch.students[1].files[0].sc[0].off = {}; });
  await page.evaluate(() => window.__gs.scanNote(window.__gs.state().pages[0]));
  await noteBtn(page, 0, 'light');
  await page.waitForFunction(() => /Lighting is on/.test(window.__gs.state().pages[0].snote.textContent));
  await press(page, '#lightBtn');
  await page.waitForSelector('#lightPanel [data-lon]');
  await page.click('#lightPanel [data-lon]');
  await page.waitForFunction(() => !/Lighting is on/.test((window.__gs.state().pages[0].snote || {}).textContent || ''), { timeout: 10000 });
  assert.deepEqual(page.errors, []);
  await close();
});

// A one-page scan with the printed name in red at the top, and a hidden text layer with only that name, as OCR of a name line gives.
// slope: the hidden words lie along the crooked line, as most OCR writes them; without it they lie level at the same spot.
const nameScan = async (page, skew, slope) => {
  await page.evaluate(PAGE_SRC);
  return Buffer.from(await page.evaluate(async (skew, slope) => {
    const Z = window.gsScan, src = Z.KINDS['typed serif'](Z.mulberry(77)), x0 = src.getContext('2d');
    x0.fillStyle = '#fff'; x0.fillRect(100, 60, 700, 50);
    x0.font = 'bold 30px Arial'; x0.fillStyle = '#c00000'; x0.fillText('Aria Testwell', 120, 100);
    const c = Z.place(src, 0, skew), jpg = await new Promise(res => c.toBlob(b => b.arrayBuffer().then(u => res(new Uint8Array(u))), 'image/jpeg', .9));
    const doc = await PDFLib.PDFDocument.create(), p = doc.addPage([612, 792]);
    p.drawImage(await doc.embedJpg(jpg), { x: 0, y: 0, width: 612, height: 792 });
    const a = skew * Math.PI / 180, dx = 120 - 510, dy = 100 - 660, X = 510 + dx * Math.cos(a) - dy * Math.sin(a), Y = 660 + dx * Math.sin(a) + dy * Math.cos(a);
    p.drawText('Aria Testwell', { x: X * .6, y: 792 - Y * .6, size: 18, font: await doc.embedFont(PDFLib.StandardFonts.Helvetica), opacity: 0, rotate: PDFLib.degrees(slope ? -skew : 0) });
    const u = await doc.save(); let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return btoa(bin);
  }, skew, !!slope), 'base64');
};
const countRed = `(c, w) => { const d = c.getContext('2d').getImageData(0, 0, w, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 70 && d[i + 2] < 70) n++; return n; }`;
// Red name ink showing on screen in Anonymous, and in the page as it goes to Claude.
const redShowing = async page => {
  await page.waitForFunction(() => { const pg = window.__gs.state().pages[0]; return pg && pg.bmp && pg.covers; });
  await redrawn(page);
  return page.evaluate(async src => {
    const red = (0, eval)(src), s = window.__gs.state(), pg = s.pages[0], f = pg.file, st = s.batch.students[s.cur], js = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
    const r = await window.__gs.sharePage(st, f, js, 0, 2, new RegExp('Aria|Testwell', 'gi')), share = red(r.c, Math.floor(r.W * 2));
    js.destroy();
    return { screen: red(pg.canvas, Math.floor(pg.W * pg.canvas.width / (pg.W + pg.side))), share, covers: pg.covers, shareCovers: r.covers };
  }, countRed);
};

for (const slope of [false, true]) test('a name in a crooked scan stays covered once the page is straightened, on screen and for Claude' + (slope ? ', with the hidden words along the crooked line' : ''), async () => {
  const { page, close } = await openApp(browser);
  // The same paper, level, is what a covered name looks like.
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': await nameScan(page, 0), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Typed' }) }), 'Level.zip');
  await shown(page);
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.evaluate(() => window.__gs.openStudent(0));
  const level = await redShowing(page);
  assert.deepEqual([level.screen, level.share], [0, 0], 'level page');
  await page.evaluate(() => window.__gs.setAnon(false));
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': await nameScan(page, 4.5, slope), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Typed' }) }), 'Crooked.zip');
  await page.waitForFunction(() => /Crooked/.test(window.__gs.state().batch.name));   // the level papers are still on screen until these take their place
  await shown(page);
  const auto = (await student(page)).skew[0];
  near(auto, -4.5, .4, 'straightened on opening');
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.evaluate(() => window.__gs.openStudent(0));
  const fixed = await redShowing(page);
  assert.deepEqual([fixed.screen, fixed.share], [0, 0], 'straightened by the app');
  // The covers are on the name and still about the size of a line.
  for (const r of fixed.covers.concat(fixed.shareCovers)) { assert.ok(r.h < 45 && r.w < 110, 'cover stays small: ' + JSON.stringify(r)); assert.ok(r.y + r.h > 40 && r.y < 75, 'cover is on the name line: ' + JSON.stringify(r)); }
  // Put back: the covers go back with the page. Straighten, as she'd press it on an asked page: they follow again.
  await noteBtn(page, 0, 'back');
  const crooked = await redShowing(page);
  assert.equal((await student(page)).skew[0], undefined);
  assert.deepEqual([crooked.screen, crooked.share], [0, 0], 'as scanned');
  await page.evaluate(to => { window.__gs.scanStraighten(window.__gs.state().pages[0], to); }, auto);
  const again = await redShowing(page);
  assert.deepEqual([again.screen, again.share], [0, 0], 'straightened by her');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a typed page she has turned keeps its name covered, whichever way it faces', async () => {
  const { page, close } = await openApp(browser);
  const typed = await page.evaluate(async () => {
    const doc = await PDFLib.PDFDocument.create(), p = doc.addPage([612, 792]), font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    p.drawText('Aria Testwell', { x: 80, y: 700, size: 20, font, color: PDFLib.rgb(.8, 0, 0) });
    const u = await doc.save(); let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return btoa(bin);
  });
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': Buffer.from(typed, 'base64'), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Typed' }) }), 'Typed.zip');
  await shown(page);
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.evaluate(() => window.__gs.openStudent(0));
  const nameInk = async () => { await page.waitForFunction(() => { const pg = window.__gs.state().pages[0]; return pg && pg.bmp && pg.covers; }); await redrawn(page); return page.evaluate(src => { const pg = window.__gs.state().pages[0]; return (0, eval)(src)(pg.canvas, Math.floor(pg.W * pg.canvas.width / (pg.W + pg.side))); }, countRed); };
  assert.equal(await nameInk(), 0, 'as it came');
  for (const to of [90, 180, 270]) {
    await page.evaluate(() => window.__gs.scanTurn(window.__gs.state().pages[0], 90));
    assert.equal(await nameInk(), 0, 'turned to ' + to);
  }
  assert.deepEqual(page.errors, []);
  await close();
});
