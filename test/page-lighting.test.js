// Lighting for one page: the ▾ menu on a page's ☀ chip sets that page's own brightness, contrast and the rest.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

// Aria Testwell has a 2-page essay. Lighting on for everyone, then the ▾ menu on page 1.
async function ready(page) {
  await openZip(page, zip);
  await page.evaluate(() => { const b = window.__gs.state().batch; b.light = { '*': { b: 0, c: 100, d: 0, s: 0, g: 0 } }; window.__gs.lightChips(); });
  await page.waitForFunction(() => { const p = window.__gs.state().pages; return p.length >= 2 && p.every(q => q.chip && !q.chip.hidden && q.bmp); }, { timeout: 30000 });
  await page.evaluate(() => window.__gs.state().pages[0].chip.querySelector('[data-lmenu]').click());
  await page.waitForSelector('#lmenu .lmown input[data-lpl="c"]');
}
const own = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.lightPgL || {})));
const slide = (page, k, v) => page.evaluate((k, v) => { const i = document.querySelector('#lmenu input[data-lpl="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, k, v);

test('a slider in the ▾ menu changes only that page, and the chip shows it has its own lighting', async () => {
  const { page, close } = await openApp(browser);
  try {
    await ready(page);
    assert.equal(await page.$eval('#lmenu input[data-lpl="c"]', i => i.value), '100', 'starts from what the page has now');
    await slide(page, 'b', 30);
    const o = await own(page);
    assert.deepEqual(Object.keys(o), ['Aria Testwell|Aria Testwell/Essay.pdf|0']);
    assert.equal(o['Aria Testwell|Aria Testwell/Essay.pdf|0'].b, 30);
    assert.equal(o['Aria Testwell|Aria Testwell/Essay.pdf|0'].c, 100, 'the rest kept');
    assert.ok(await page.$('#lmenu'), 'the menu stays open while she slides');
    const r = await page.evaluate(() => { const G = window.__gs, s = G.state(), st = s.batch.students[s.cur], [a, b] = s.pages; return { a: G.lightForPage(st, a.file, a.idx).b, b: G.lightForPage(st, b.file, b.idx).b }; });
    assert.deepEqual(r, { a: 30, b: 0 });
    await page.waitForFunction(() => window.__gs.state().pages[0].chip.classList.contains('own') && !window.__gs.state().pages[1].chip.classList.contains('own'));
    // Off and back on keeps the page's own lighting.
    await page.evaluate(() => { document.querySelector('#lmenu') && document.querySelector('#lmenu').remove(); window.__gs.state().pages[0].chip.querySelector('[data-lpg]').click(); });
    assert.equal(await page.evaluate(() => { const G = window.__gs, s = G.state(), a = s.pages[0]; return G.lightForPage(s.batch.students[s.cur], a.file, a.idx); }), null, 'off');
    await page.evaluate(() => window.__gs.state().pages[0].chip.querySelector('[data-lpg]').click());
    assert.equal(await page.evaluate(() => { const G = window.__gs, s = G.state(), a = s.pages[0]; return G.lightForPage(s.batch.students[s.cur], a.file, a.idx).b; }), 30, 'back on, with its own lighting');
  } finally { await close(); }
});

test('Same as the rest drops the page’s own lighting; the rest of this file copies it on', async () => {
  const { page, close } = await openApp(browser);
  try {
    await ready(page);
    await slide(page, 'd', 50);
    await page.click('#lmenu [data-lpcopy="rest"]');
    assert.deepEqual(Object.keys(await own(page)).sort(), ['Aria Testwell|Aria Testwell/Essay.pdf|0', 'Aria Testwell|Aria Testwell/Essay.pdf|1']);
    await page.evaluate(() => window.__gs.state().pages[0].chip.querySelector('[data-lmenu]').click());
    await page.waitForSelector('#lmenu [data-lpsame]');
    await page.click('#lmenu [data-lpsame]');
    assert.deepEqual(Object.keys(await own(page)), ['Aria Testwell|Aria Testwell/Essay.pdf|1']);
    assert.equal(await page.$('#lmenu [data-lpsame]'), null, 'no Same as the rest once it is');
  } finally { await close(); }
});

test('Auto fix this page sets lighting from that page, and the Lighting panel can put every page back', async () => {
  const { page, close } = await openApp(browser);
  try {
    await ready(page);
    await page.click('#lmenu [data-lpauto]');
    assert.equal(Object.keys(await own(page)).length, 1);
    await page.evaluate(() => window.__gs.openLight());
    await page.waitForSelector('#lightPanel [data-lpgown]');
    await page.click('#lightPanel [data-lpgown]');
    assert.deepEqual(await own(page), {});
  } finally { await close(); }
});
