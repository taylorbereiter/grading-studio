// Stage 8, slice E2: searching inside lessons, slides, notes, documents and units (rows E2-011, E2-083, E2-084, E2-102, E2-110 of
// rebuild/audit/gaps.md). Made-up lessons, a made-up document and the made-up units of planseed.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const { LESSONS, lesson } = require('./planseed.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 10000 }, ...a);
// one more lesson: a slide's notes, a notebook and a document of its own, on no class
const X1 = { ...lesson('X1', 'Odes', [], { notebook: '<p>Bring the zebra pictures</p>', files: [{ id: 'fd1', name: 'Plan notes', kind: 'doc', type: 'text/html', added: 1792000000000 }] }) };
X1.slides[2] = { ...X1.slides[2], notes: 'Point to the albatross image first.' };
const putDoc = p => p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(new Blob(['<p>A quokka question to start.</p>'], { type: 'text/html' }), 'file:fd1'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }));
const hits = p => p.$$eval('main .lsearch [data-hit]', b => b.map(x => x.dataset.hit + ':' + x.querySelector('b').textContent));

test('E2-102 E2-011 E2-083 E2-084: the command bar searches inside lessons; a hit opens the lesson at its slide', async () => {
  const p = await h.fresh(1366, { lessons: [...LESSONS, X1] });
  await h.open(p, 'home');
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open] input');
  await p.keyboard.type('albatross');
  await until(p, () => [...document.querySelectorAll('dialog.cmd [role="option"]')].some(o => o.textContent === 'Search inside lessons for “albatross”'));
  await p.evaluate(() => [...document.querySelectorAll('dialog.cmd [role="option"]')].find(o => o.textContent.startsWith('Search inside')).click());
  await until(p, () => location.hash === '#/library/search/albatross' && document.querySelector('main .lsearch [data-hit]'));
  assert.deepEqual(await hits(p), ['slide:Odes, slide 3']);
  assert.match(await p.$eval('main .lsearch .sn', e => e.textContent), /albatross image/);
  await p.click('main .lsearch [data-hit]');
  await until(p, () => location.hash === '#/lesson/X1/slides' && document.querySelector('.strip [aria-current="true"]'));
  assert.equal(await p.$eval('.strip [aria-current="true"]', b => b.dataset.slideI), '2');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-110 E2-083 E2-084: Enter in the search box finds a document’s words, a notebook and a unit’s week, and each opens', async () => {
  const p = await h.fresh(1366, { lessons: [...LESSONS, X1] });
  await putDoc(p);
  await h.open(p, 'library/search/x');
  await p.waitForSelector('main .lsearch input[data-search]');
  assert.match(await p.$eval('main .lsearch [role=status]', e => e.textContent), /at least two letters/);
  // a document's words, with Enter
  await p.$eval('main .lsearch input[data-search]', i => { i.focus(); i.select(); });
  await p.keyboard.type('quokka'); await p.keyboard.press('Enter');
  await until(p, () => document.querySelectorAll('main .lsearch [data-hit]').length === 1);
  assert.deepEqual(await hits(p), ['file:Plan notes']);
  assert.equal(await p.evaluate(() => location.hash), '#/library/search/quokka');
  await p.click('main .lsearch [data-hit]');
  await until(p, () => location.hash === '#/lesson/X1' && document.querySelector('dialog.sheet [data-focus="doc-name"]'));
  // a notebook
  await h.open(p, 'library/search/zebra');
  await until(p, () => document.querySelectorAll('main .lsearch [data-hit]').length === 1);
  assert.deepEqual(await hits(p), ['lesson:Odes, notebook']);
  // a unit's week: it opens on its Course line
  await h.open(p, 'library/search/images');
  await until(p, () => document.querySelectorAll('main .lsearch [data-hit]').length > 0);
  const hs = await hits(p); assert.ok(hs.includes('unit:Unit 2: Poetry'), hs.join(' | '));
  await p.evaluate(() => [...document.querySelectorAll('main .lsearch [data-hit="unit"]')].find(b => b.textContent.includes('Unit 2')).click());
  await until(p, () => /^#\/class\//.test(location.hash) && document.querySelector('#h-unit') && document.querySelector('#h-unit').textContent === 'Unit 2: Poetry');
  // nothing found says so
  await h.open(p, 'library/search/nothinglikethis');
  await until(p, () => /Nothing found for “nothinglikethis”/.test(document.querySelector('main .lsearch [role=status]').textContent));
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
