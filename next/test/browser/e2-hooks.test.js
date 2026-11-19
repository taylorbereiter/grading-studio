// Stage 8, slice E2: the audit's hook rows for the Planner side (rebuild/audit/hooks.md H-013, H-015, H-035, H-067, H-073). Saved
// work is not lost when a read fails or another window changed it; the class screen window closes with the page; the screen stays
// awake while presenting. Made-up lessons at the stopped clock (planseed.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a);
const putKv = (p, k, v) => p.evaluate((k, v) => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }), k, v);

test('H-013: when the units could not be read, saving a unit is refused and the units already saved stay', async () => {
  const p = await h.fresh();
  // the units read fails, once, as when the database is blocked
  await p.evaluateOnNewDocument(() => { const g = IDBObjectStore.prototype.get; let n = 0; IDBObjectStore.prototype.get = function (k) { if (k === 'units' && this.name === 'kv' && !n++) throw new DOMException('blocked', 'UnknownError'); return g.call(this, k); }; });
  await h.open(p, 'calendar/semester');
  await p.waitForSelector('[data-sem-new]');
  p.errors.length = 0;   // the failed read is reported to the console on purpose
  await p.click('[data-sem-new]');
  await p.waitForSelector('dialog.sheet [data-focus="save-unit"]');
  await p.click('[data-focus="save-unit"]');
  await until(p, () => [...document.querySelectorAll('.toast')].some(x => /couldn’t be saved/.test(x.textContent)));
  const units = await h.kvInDb(p, 'units');
  assert.deepEqual(units.map(u => u.id), ['U1', 'U2', 'U3'], 'the three units are still there');
  await p.ctx.close();
});

test('H-015: a timetable saved from Settings keeps a change made meanwhile by another window', async () => {
  const p = await h.fresh();
  await h.open(p, 'settings/timetable');
  await p.waitForSelector('main .ttset input');
  await p.$eval('main .ttset .card input', el => { el.focus(); el.select(); });
  await p.keyboard.type('Grade 9 English A');
  // meanwhile, another window adds a day off and a class
  const s = await h.kvInDb(p, 'setup');
  await putKv(p, 'setup', { ...s, daysOff: [...(s.daysOff || []), { date: '2026-12-24', label: 'Made-up holiday' }], classes: [...s.classes, { id: 'Z9', name: 'Grade 11 Drama', course: 'Grade 11', color: '#0E7C66', meets: [] }] });
  await p.click('main [data-focus="save-timetable"]');
  let got = null;
  for (let k = 0; k < 40 && !got; k++) { const x = await h.kvInDb(p, 'setup'); if (x.classes[0].name === 'Grade 9 English A') got = x; else await new Promise(r => setTimeout(r, 150)); }
  assert.ok(got, 'saved');
  assert.ok(got.daysOff.some(d => d.date === '2026-12-24'), 'the other window’s day off stays');
  assert.ok(got.classes.some(c => c.id === 'Z9'), 'the other window’s class stays');
  assert.equal(got.classes.length, s.classes.length + 1);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('H-067 H-073: the class screen window closes when the page goes, and the screen is kept awake while presenting', async () => {
  const p = await h.fresh();
  await p.evaluateOnNewDocument(() => { window.__wake = 0; window.__rel = 0; Object.defineProperty(navigator, 'wakeLock', { value: { request: () => { window.__wake++; return Promise.resolve({ released: false, release() { window.__rel++; this.released = true; return Promise.resolve(); } }); } } }); });
  await h.open(p, 'lesson/L3/slides');
  await p.keyboard.press('F5');
  await p.waitForSelector('.present');
  await until(p, () => window.__wake === 1);
  const got = p.ctx.waitForTarget(x => x.type() === 'page' && x !== p.target(), { timeout: 10000 });
  await p.keyboard.press('w');
  const w = await (await got).page();
  await w.waitForSelector('#fit .ls-slide');
  const closed = new Promise(r => w.once('close', r));
  await p.reload();
  await Promise.race([closed, new Promise((_, rej) => setTimeout(() => rej(new Error('the class screen window stayed open')), 8000))]);
  // leaving Present lets the screen sleep again
  await h.open(p, 'lesson/L3/slides');
  await p.keyboard.press('F5'); await p.waitForSelector('.present');
  await until(p, () => window.__wake === 1);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await until(p, () => !document.querySelector('.present') && window.__rel === 1);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
