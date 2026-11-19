// Storage regressions through Beside's PDF upload, drop, remove and undo controls. All files are generated here.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');

const h = harness(before, after);
const first = { id: 'one', name: 'Existing reference', size: 3, added: 10 };
const last = { id: 'two', name: 'Another reference', size: 4, added: 20 };

async function booksPage() {
  const p = await h.fresh();
  await p.evaluate(async ([a, b]) => {
    const r = indexedDB.open('gs-lessons');
    const db = await new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
    const tx = db.transaction('kv', 'readwrite'), kv = tx.objectStore('kv');
    kv.put([a, b], 'pdfs'); kv.put(new Blob(['one']), 'pdf:one'); kv.put(new Blob(['two!']), 'pdf:two');
    await new Promise((ok, fail) => { tx.oncomplete = ok; tx.onabort = () => fail(tx.error); }); db.close();
  }, [first, last]);
  await h.open(p, 'lesson/L2');
  await p.click('main [data-focus="beside"]');
  await p.waitForSelector('[data-book="two"]');
  return p;
}

const choose = (p, name, method) => p.evaluate((name, method) => {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File([name], name + '.pdf', { type: 'application/pdf' }));
  if (method === 'drop') {
    document.querySelector('aside.beside').dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
  } else {
    const input = document.querySelector('[data-addpdf]'); input.files = dataTransfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, name, method);

async function contents(p) {
  return p.evaluate(async () => {
    const r = indexedDB.open('gs-lessons');
    const db = await new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
    const tx = db.transaction('kv'), kv = tx.objectStore('kv'), list = kv.get('pdfs');
    const blobs = kv.openCursor(IDBKeyRange.bound('pdf:', 'pdf:\uffff')), entries = [];
    blobs.onsuccess = () => { const c = blobs.result; if (c) { entries.push([c.key.slice(4), c.value]); c.continue(); } };
    await new Promise((ok, fail) => { tx.oncomplete = ok; tx.onabort = () => fail(tx.error); }); db.close();
    const bytes = Object.fromEntries(await Promise.all(entries.map(async ([id, blob]) => [id, await blob.text()])));
    return { list: list.result, bytes };
  });
}

test('E1-065: a failed book-list read or a failed index write keeps every existing book and its bytes', async () => {
  const p = await booksPage();
  const baseline = await contents(p);
  for (const fault of ['open', 'put']) {
    await p.evaluate(fault => {
      window.bookFault = false;
      const proto = fault === 'open' ? IDBFactory.prototype : IDBObjectStore.prototype;
      const real = proto[fault];
      proto[fault] = function(...args) {
        if (fault === 'open' ? args[0] === 'gs-lessons' : this.name === 'kv' && args[1] === 'pdfs') {
          proto[fault] = real; window.bookFault = true;
          throw new DOMException('Synthetic book storage fault', 'InvalidStateError');
        }
        return real.apply(this, args);
      };
    }, fault);
    await choose(p, 'Uncommitted '+fault, fault === 'open' ? 'drop' : 'upload');
    await p.waitForFunction(() => window.bookFault && [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('couldn’t be saved')));
    assert.deepEqual(await contents(p), baseline);
  }
  await p.ctx.close();
});

test('E1-065: overlapping book uploads both survive; undo restores the original bytes and position beside a later addition', async () => {
  const p = await booksPage();
  // The shared screenshot harness hides toasts. Restore their normal display for the Undo click.
  await p.addStyleTag({ content: '.toasts .toast{display:flex!important}' });
  await Promise.all([choose(p, 'Atlas', 'upload'), choose(p, 'Almanac', 'upload')]);
  await p.waitForFunction(() => document.querySelectorAll('[data-book]').length === 4);
  const uploaded = await contents(p);
  assert.deepEqual(uploaded.list.slice(0, 2), [first, last]);
  assert.deepEqual(uploaded.list.slice(2).map(x => x.name).sort(), ['Almanac', 'Atlas']);
  for (const added of uploaded.list.slice(2)) assert.equal(uploaded.bytes[added.id], added.name);
  await p.$eval('[data-book="two"]', b => b.closest('li').querySelector('button[aria-label="Remove"]').click());
  await p.waitForFunction(() => !document.querySelector('[data-book="two"]'));
  const removed = await contents(p);
  assert.equal(removed.bytes.two, undefined);
  await choose(p, 'Newer reference', 'drop');
  await p.waitForFunction(() => [...document.querySelectorAll('[data-book]')].some(b => b.textContent === 'Newer reference'));
  const undo = await p.waitForFunction(() => [...document.querySelectorAll('.toasts .toast')]
    .find(t => t.textContent.includes('Another reference'))?.querySelector('button'));
  await undo.asElement().click();
  await p.waitForSelector('[data-book="two"]');
  const restored = await contents(p);
  assert.deepEqual(restored.list.slice(0, 4), uploaded.list);
  assert.equal(restored.list[4].name, 'Newer reference');
  assert.equal(restored.bytes.two, 'two!');
  await p.ctx.close();
});
