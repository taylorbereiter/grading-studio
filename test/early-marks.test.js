// Marking while a page is still drawing, the race behind three intermittent export test failures.
// Every page here is held back on purpose, the way a slow scan or a busy computer would.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, setTool, drag, pickFile } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

// Each page render takes this much longer. window.__delays can set the next ones, one by one.
const slowRenders = (page, ms) => page.evaluate(async ms => {
  const d = await PDFLib.PDFDocument.create(); d.addPage();
  const js = await pdfjsLib.getDocument({ data: await d.save() }).promise, pg = await js.getPage(1), P = Object.getPrototypeOf(pg), r = P.render;
  window.__delays = [];
  P.render = function (o) { const t = r.call(this, o), wait = window.__delays.length ? window.__delays.shift() : ms; return { promise: t.promise.then(v => new Promise(res => setTimeout(() => res(v), wait))), cancel: t.cancel.bind(t) }; };
  js.destroy();
}, ms);
// Open, without waiting for the page's picture: only until the page exists.
async function openEarly(page) {
  const clean = await pickFile(page, '#fileIn', zip, 'River essay.zip');
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.pages && s.pages.length > 0 && s.pages[0].s > 0; }, { timeout: 60000 });
  clean();
}
const pensOn = (page, k) => page.evaluate(k => (window.__gs.state().batch.students[0].files[0].marks[k] || []).map(m => m.pts), k);

test('a stroke started before the page has finished drawing lands where she drew it', async () => {
  const { page, close } = await openApp(browser);
  await slowRenders(page, 1000);
  await openEarly(page);
  assert.equal(await page.evaluate(() => !window.__gs.state().pages[0].bmp), true, 'the picture isn’t ready yet');
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  const [pts] = await pensOn(page, 0);
  assert.ok(pts, 'the stroke was kept');
  assert.deepEqual(pts[0], [100, 300]); assert.deepEqual(pts.at(-1), [200, 330]);
  await close();
});

test('a stroke on a page that’s still turning lands in the turned page’s place', async () => {
  const { page, close } = await openApp(browser);
  await slowRenders(page, 300);
  await openEarly(page);
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.pages.length > 1 && s.pages[1].bmp; }, { timeout: 60000 });
  await page.evaluate(() => [...document.querySelectorAll('[data-rot="1"]')][1].click());
  await page.waitForFunction(() => window.__gs.state().pages[1].W > 700);
  const box = await page.evaluate(() => { const p = window.__gs.state().pages[1], r = p.canvas.getBoundingClientRect(); return { h: r.height, want: p.H * p.s }; });
  assert.ok(Math.abs(box.h - box.want) < 1, 'the page is its new shape at once, not after the picture is ready');
  await setTool(page, 'pen'); await drag(page, 1, [[500, 120], [560, 150], [620, 120]]);
  const [pts] = await pensOn(page, 1);
  assert.deepEqual(pts[0], [500, 120]); assert.deepEqual(pts.at(-1), [620, 120]);
  await close();
});

test('turning a page twice quickly: a slow first picture doesn’t land on top of the second', async () => {
  const { page, close } = await openApp(browser);
  await slowRenders(page, 0);
  await openEarly(page);
  await page.waitForFunction(() => window.__gs.state().pages[0].bmp, { timeout: 60000 });
  await page.evaluate(() => { window.__delays.push(1200, 0); const b = [...document.querySelectorAll('[data-rot="1"]')][0]; b.click(); b.click(); });
  await new Promise(r => setTimeout(r, 1800));
  const bmp = await page.evaluate(() => { const b = window.__gs.state().pages[0].bmp; return { w: b.width, h: b.height }; });
  assert.ok(bmp.h > bmp.w, 'upside down is still tall, and the first turn alone would be wide');
  await close();
});

test('moving on while a student’s pages are still loading is quiet', async () => {
  const { page, close } = await openApp(browser);
  await slowRenders(page, 200);
  // Asking a closed file for a page fails, as a real one does when the answer comes back after she has left. Held back so she gets to leave first.
  await page.evaluate(async () => {
    const d = await PDFLib.PDFDocument.create(); d.addPage();
    const js = await pdfjsLib.getDocument({ data: await d.save() }).promise, P = Object.getPrototypeOf(js), g = P.getPage, end = P.destroy;
    P.destroy = function () { this.gone = true; return end.call(this); };
    P.getPage = function (n) { window.__asking = true; return new Promise(r => setTimeout(r, 150)).then(() => { if (this.gone) throw new Error('Transport destroyed'); return g.call(this, n); }); };
    js.destroy();
  });
  await openEarly(page);
  await page.evaluate(async () => {
    await window.__gs.scanAll();   // reading the grades asks its own files for pages
    window.__asking = false;
    window.__gs.openStudent(1);
    while (!window.__asking) await new Promise(r => setTimeout(r, 5));
    await window.__gs.openStudent(2);
  });
  await new Promise(r => setTimeout(r, 800));
  assert.deepEqual(page.errors, []);
  assert.equal(await page.evaluate(() => window.__gs.state().cur), 2);
  await close();
});
