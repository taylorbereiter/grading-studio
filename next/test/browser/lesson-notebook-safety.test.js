// Regression cases for pending notebook edits and phone notes. All state lives in the
// test browser's synthetic profile; independent store writes stand in for another window.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { kit, until } = require('./e1kit.js');
const K = kit();
before(K.start);
after(K.stop);

async function notebook(p) {
  await K.open(p, 'lesson/L2');
  await p.click('main [data-focus="beside"]');
  const tab = await p.waitForSelector('aside.beside [role=tab]');
  await tab.evaluate(() => [...document.querySelectorAll('aside.beside [role=tab]')].find(x => x.textContent === 'Notebook').click());
  await p.waitForSelector('[data-nbpage][contenteditable="true"]');
}

async function setRecord(p, store, key, value) {
  await p.evaluate((store, key, value) => new Promise((resolve, reject) => {
    const open = indexedDB.open('gs-lessons');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction(store, 'readwrite'), objects = tx.objectStore(store);
      if (value === null) objects.delete(key);
      else if (objects.keyPath) objects.put(value);
      else objects.put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), store, key, value);
}

test('H-005: leaving the notebook immediately saves the last words and preserves a concurrent lesson edit', async () => {
  const p = await K.fresh();
  await notebook(p);
  const l = await K.lessonInDb(p, 'L2');
  await setRecord(p, 'lessons', 'L2', { ...l, title: 'A title saved elsewhere', slides: [...l.slides, { ...l.slides[0], id: 'other-slide' }] });
  await p.click('[data-nbpage]'); await p.keyboard.type('Only in the first notebook');
  await p.evaluate(() => { location.hash = '#/home'; });
  const stored = await until(async () => {
    const x = await K.lessonInDb(p, 'L2');
    return x && x.notebook?.includes('Only in the first notebook') && x;
  });
  assert.ok(stored, 'navigating away flushed the text before the debounce');
  assert.equal(stored.title, 'A title saved elsewhere'); assert.equal(stored.slides.at(-1).id, 'other-slide');
  for (const [old, next] of Object.values(await K.sameInPlanner(p, 'L2', stored, ['title', 'slides', 'notebook']))) assert.deepEqual(old, next);
  await p.ctx.close();
});

test('H-005: leaving a deleted lesson cannot recreate it from cached notebook state', async () => {
  const p = await K.fresh();
  await notebook(p);
  await setRecord(p, 'lessons', 'L2', null);
  await p.click('[data-nbpage]'); await p.keyboard.type('Draft for the removed lesson');
  await p.evaluate(() => { location.hash = '#/lesson/L3'; });
  // Wait for the attempted save to finish. A refusal is visible to the teacher.
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /sav/i.test(t.textContent)), { timeout: 8000 });
  assert.equal(await K.lessonInDb(p, 'L2'), null);
  assert.doesNotMatch((await K.lessonInDb(p, 'L3')).notebook || '', /Draft for the removed lesson/);
  await p.ctx.close();
});

test('H-016: an inaccessible general notebook never opens as an empty editable page', async () => {
  const p = await K.fresh(), old = '<p>General notes already stored</p>';
  await notebook(p);
  await setRecord(p, 'kv', 'nb:general', old);
  await p.evaluate(() => {
    const original = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      if (args[0] === 'gs-lessons') throw new DOMException('Simulated read failure', 'InvalidStateError');
      return original(...args);
    };
    window.restoreNotebookDb = () => { indexedDB.open = original; };
  });
  await p.click('[data-focus="nb-swap"]');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => t.textContent.includes("notes couldn't be read")), { timeout: 8000 });
  const page = '[data-nbpage][contenteditable="false"]';
  await p.waitForSelector(page);
  // A queued input arriving after the failed read still cannot schedule a write.
  await p.$eval(page, e => { e.textContent = 'Must not replace the general notes'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => window.restoreNotebookDb());
  await p.click('[data-focus="nb-swap"]'); await p.waitForSelector('[data-nbpage][contenteditable="true"]');
  await p.click('[data-focus="nb-swap"]'); await p.waitForFunction(() => document.querySelector('[data-nbpage]')?.innerHTML.includes('General notes already stored'));
  assert.equal(await p.$eval('[data-nbpage]', e => e.innerHTML), old);
  await p.ctx.close();
});

test('H-053: folding a phone note preserves current slides and a failed acknowledgement leaves the inbox intact', async () => {
  const p = await K.fresh(), key = 'L2|A1|2026-10-27';
  await K.open(p, 'home');
  const l = await K.lessonInDb(p, 'L2');
  await setRecord(p, 'lessons', 'L2', { ...l, title: 'Current stored title', slides: [...l.slides, { ...l.slides[0], id: 'current-slide' }] });
  const inbox = { items: { [key]: { t: 1793000000100, x: 'Phone note on the lesson', slide: 1, of: 5 }, 'missing|A1|2026-10-27': { t: 1793000000101, x: 'Waiting for its lesson', slide: 1, of: 2 } } };
  await p.evaluate(inbox => {
    const k = 'gsp.taughtIn', original = Storage.prototype.getItem;
    localStorage.setItem(k, JSON.stringify(inbox));
    let reads = 0;
    Storage.prototype.getItem = function (name) {
      if (name === k && ++reads > 1) { window.inboxReadBlocked = true; throw new Error('Temporary inbox read failure'); }
      return original.call(this, name);
    };
    window.finishInboxCheck = () => { Storage.prototype.getItem = original; return JSON.parse(localStorage.getItem(k)); };
    window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: JSON.stringify(inbox) }));
  }, inbox);
  await p.waitForFunction(() => window.inboxReadBlocked, { timeout: 8000 });
  const stored = await K.lessonInDb(p, 'L2');
  assert.equal(stored.title, 'Current stored title'); assert.equal(stored.slides.at(-1).id, 'current-slide');
  assert.equal(stored.taught.find(x => x.classId === 'A1').note, inbox.items[key].x);
  assert.deepEqual(await p.evaluate(() => window.finishInboxCheck()), inbox);
  await p.evaluate(() => { const k = 'gsp.taughtIn'; window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: localStorage.getItem(k) })); });
  await p.waitForFunction(key => JSON.parse(localStorage.getItem('gsp.taughtIn')).items[key].f === 1, { timeout: 8000 }, key);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('gsp.taughtIn')).items['missing|A1|2026-10-27'].f), undefined);
  await p.ctx.close();
});
