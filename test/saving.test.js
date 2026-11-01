// "Saved" means saved: it shows only once the writes have worked, and a save that failed can't be missed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, appReady, score, settle } = require('./helpers/app');
const { standardFiles, quizFiles, zipOf } = require('./helpers/fixtures');

let browser, zip, quiz;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); quiz = zipOf(await quizFiles()); });
after(async () => { await browser.close(); });

const status = page => page.$eval('#saveState', e => e.textContent);
const waitStatus = (page, rx) => page.waitForFunction(s => new RegExp(s).test(document.querySelector('#saveState').textContent), { timeout: 30000 }, rx.source);
const barText = page => page.$eval('#saveWarn', e => e.textContent).catch(() => null);
const breakKeep = page => page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('no room', 'QuotaExceededError'); }; });
const fixKeep = page => page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
const breakQuick = page => page.evaluate(() => { window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
const fixQuick = page => page.evaluate(() => { Storage.prototype.setItem = window.__set; });
const rowsOf = page => page.evaluate(() => window.__gs.state().batch.students[0].grade.rubric);
const idOf = page => page.evaluate(() => window.__gs.state().batch.id);
const openKept = async (page, id) => { await page.waitForSelector('#kept [data-kopen="' + id + '"]'); await page.click('#kept [data-kopen="' + id + '"]'); await waitPaper(page); };

test('“Saved” waits for the slower of the two writes', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); await settle(page);
  await page.evaluate(() => {   // every finished IndexedDB write reports back 2 seconds late
    const d = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true, set(fn) { d.set.call(this, e => setTimeout(() => fn(e), 2000)); }, get() { return d.get.call(this); } });
  });
  await score(page, [3]);
  await new Promise(r => setTimeout(r, 1200));
  assert.equal(await status(page), 'Saving…', 'localStorage has it by now, but the full copy doesn’t');
  await waitStatus(page, /✓ Saved/);
  await close();
});

test('when nothing can be stored: a red bar, no “Saved”, and Try again brings it back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); await settle(page);
  const id = await idOf(page);
  await breakKeep(page); await breakQuick(page);
  await score(page, [3.5]);
  await waitStatus(page, /Not saved/);
  assert.doesNotMatch(await status(page), /✓/);
  assert.match(await barText(page), /NOT saved/);
  assert.match(await barText(page), /Try again/);
  assert.deepEqual(await page.evaluate(() => window.__gs.saveTrouble()), [id]);
  const seen = await page.$eval('#saveWarn', e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.height > 20 && r.bottom <= innerHeight + 1 && s.position === 'fixed'; });
  assert.ok(seen, 'on screen');

  await page.click('#closeBtn');   // the bar stays on the start screen, with the work she left
  assert.match(await barText(page), /NOT saved/);
  await fixKeep(page); await fixQuick(page);
  await page.click('#saveWarn [data-saveretry]');
  await page.waitForFunction(() => !document.querySelector('#saveWarn'), { timeout: 15000 });
  await page.reload(); await appReady(page);
  await openKept(page, id);
  assert.deepEqual(await rowsOf(page), [3.5], 'the work she closed came through');
  assert.deepEqual(page.errors, []);
  await close();
});

test('with the red bar up, nothing she needs sits under it', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width: 1280, height: 720 });
  await openZip(page, zip); await settle(page);
  await breakKeep(page); await breakQuick(page);
  await score(page, [3.5]);
  await waitStatus(page, /Not saved/);
  await page.waitForFunction(() => document.body.style.getPropertyValue('--savebar'));
  const clear = sel => page.$eval(sel, e => { e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(), bar = document.querySelector('#saveWarn').getBoundingClientRect(); return r.bottom <= bar.top && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).closest(e.id ? '#' + e.id : '[data-go]') === e; });
  assert.ok(await clear('#nextBtn'), 'the Next button');
  await page.click('#saveWarn [data-savehelp]');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  assert.ok(await clear('#dlgBox [data-go="zip"]'), 'the export dialog’s Download ZIP');
  const toastClear = await page.evaluate(() => { const t = document.querySelector('.toast'), bar = document.querySelector('#saveWarn').getBoundingClientRect(); return innerHeight - parseFloat(getComputedStyle(t).bottom) <= bar.top; });
  assert.ok(toastClear, 'a toast');
  await fixKeep(page); await fixQuick(page);
  await page.click('#saveWarn [data-saveretry]');
  await page.waitForFunction(() => !document.querySelector('#saveWarn'), { timeout: 15000 });
  assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--savebar')), '', 'the strip goes with the bar');
  await close();
});

test('saving tries again by itself, and the bar goes when it works', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip); await settle(page);
  await breakKeep(page);
  await score(page, [2]);
  await waitStatus(page, /Partly saved/);
  assert.match(await barText(page), /partly saved/);
  await fixKeep(page);
  await waitStatus(page, /✓ Saved/);   // within about 20 seconds, with nothing pressed
  assert.equal(await barText(page), null);
  await close();
});

test('the full copy works but localStorage is full: saved, and the old quick copy can’t come back as her work', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await score(page, [3]); await settle(page);
  const id = await idOf(page);
  await breakQuick(page);
  await score(page, [4]);
  await waitStatus(page, /✓ Saved \(1 copy\)/);
  assert.equal(await barText(page), null, 'her work is safe, so no alarm');
  assert.match(await page.$eval('.toast', e => e.textContent), /quick copy is full/, 'but she’s told once');
  assert.equal(await page.evaluate(id => localStorage.getItem(id), id), null, 'the out-of-date copy is gone');
  await page.reload(); await appReady(page);
  await openKept(page, id);
  assert.deepEqual((await rowsOf(page))[0], 4);
  await close();
});

test('two copies that differ: the one saved last is the one that opens', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await score(page, [3]); await settle(page);
  const id = await idOf(page);
  await page.click('#closeBtn');
  const setQuick = (rubric, dt) => page.evaluate((id, rubric, dt) => { const d = JSON.parse(localStorage.getItem(id)); d.t += dt; d.s['Aria Testwell'].g.rubric = rubric; localStorage.setItem(id, JSON.stringify(d)); }, id, rubric, dt);
  await new Promise(r => setTimeout(r, 300));
  await setQuick([1], -100000);   // an old quick copy, left behind by a save that couldn't reach it
  await page.reload(); await appReady(page);
  await openKept(page, id);
  assert.deepEqual(await rowsOf(page), [3], 'the fuller, newer copy');
  await page.click('#closeBtn');
  await new Promise(r => setTimeout(r, 300));
  await setQuick([2], 100000);   // and the other way round: the full copy missed the last save
  await page.reload(); await appReady(page);
  await openKept(page, id);
  assert.deepEqual(await rowsOf(page), [2], 'the quick copy was newer');
  await close();
});

test('making room only lets go of quick copies that have a full copy too', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, quiz, 'Quiz.zip');
  await score(page, [3]); await settle(page);
  const kept = await idOf(page);
  await page.click('#closeBtn');
  await new Promise(r => setTimeout(r, 300));
  const only = 'gs.b.onlyhere';
  await page.evaluate((only) => {   // saved by an old copy of the app, before there was a full copy
    localStorage.setItem(only, JSON.stringify({ t: 5, cur: 0, s: { Someone: { f: {}, g: { rubric: [2, 2, 2], points: '', comment: '' }, h: {} } } }));
    const idx = JSON.parse(localStorage.getItem('gs.batches')); idx[only] = 5; localStorage.setItem('gs.batches', JSON.stringify(idx));
  }, only);
  await openZip(page, zip);
  const id = await idOf(page);
  await page.evaluate((id, kept) => {   // localStorage is full until one older copy goes
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === id && this.getItem(kept)) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); };
  }, id, kept);
  await score(page, [4]);
  await waitStatus(page, /✓ Saved/);
  assert.equal(await page.evaluate(k => !!localStorage.getItem(k), only), true, 'the only copy of that work stays');
  assert.equal(await page.evaluate(k => localStorage.getItem(k), kept), null, 'the one with a full copy made room');
  assert.notEqual(await page.evaluate(k => localStorage.getItem(k), id), null);
  await close();
});
