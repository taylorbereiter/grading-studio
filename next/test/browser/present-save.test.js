const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const { LESSONS, plantPlan } = require('./planseed.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

const h = harness(before, after);
const save = '[data-gt="save"]';
const nextTime = 'Return to the last question';
const slotDate = '2026-10-27';

const lesson = LESSONS.find(l => l.id === 'L2');
const plan = { lessons: [{ ...lesson, slots: [...lesson.slots, { classId: 'B1', date: slotDate }] }] };

async function openSheet(t, page) {
  const p = page || await h.fresh(1366, plan);
  if (!page) t.after(() => p.ctx.close());
  await h.open(p, 'lesson/L2/slides');
  await p.keyboard.press('F5');
  await p.waitForSelector('.present:focus');
  await p.evaluate(() => { const end = Date.now() + 180000; Date.now = () => end; });
  await p.keyboard.press('Escape');
  await p.waitForSelector('dialog[open] [data-gt="class"]', { timeout: 8000 });
  await p.select('[data-gt="class"]', '1');
  await p.select('[data-gt="slide"]', '4');
  await p.type('[data-gt="note"]', nextTime);
  return p;
}

const successToast = () => [...document.querySelectorAll('.toast')].some(x => x.textContent.includes('Noted on the lesson'));

test('Present waits for a committed save before confirming, and the saved record survives a reload', async t => {
  const p = await openSheet(t);
  // A real read/write transaction on another connection blocks this lesson store until released.
  await p.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('gs-lessons');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('lessons', 'readwrite'), store = tx.objectStore('lessons');
      let held = true;
      window.releaseLessonStore = () => { held = false; };
      const keep = () => { if (held) store.get('L2').onsuccess = keep; };
      store.get('L2').onsuccess = () => { keep(); resolve(); };
      tx.oncomplete = () => open.result.close();
      tx.onabort = () => reject(tx.error);
    };
  }));
  // Observe when the app actually reaches storage so a slow runner cannot pass the pending check early.
  await p.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (stores, ...args) {
      if (this.name === 'gs-lessons' && [stores].flat().includes('lessons')) {
        window.lessonSaveStarted = true;
        IDBDatabase.prototype.transaction = original;
      }
      return original.call(this, stores, ...args);
    };
  });
  await p.click(save);
  await p.waitForFunction(() => window.lessonSaveStarted);
  assert.equal(await p.evaluate(successToast), false, 'pending storage cannot announce success');
  assert.ok(await p.$('dialog[open] [data-gt="note"]'), 'the form stays open while waiting');
  await p.evaluate(() => window.releaseLessonStore());
  await p.waitForFunction(successToast);
  await p.reload();
  const expected = { classId: 'B1', date: slotDate, slide: 4, of: 5, note: nextTime };
  const stored = (await h.lessonInDb(p, 'L2')).taught;
  assert.deepEqual(stored.map(({ at, ...record }) => record), [expected]);
  assert.deepEqual(p.errors, []);
});

test('A failed progress save keeps the entered values and a retry preserves concurrent lesson and class edits', async t => {
  const p = await openSheet(t);
  await p.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...args) {
      if (this.name === 'lessons' && value.id === 'L2' && value.taught?.some(row => row.classId === 'B1')) {
        IDBObjectStore.prototype.put = put;
        throw new DOMException('Synthetic refused save', 'QuotaExceededError');
      }
      return put.call(this, value, ...args);
    };
  });
  await p.click(save);
  await p.waitForSelector('dialog[open] [role="alert"]', { visible: true, timeout: 8000 });
  assert.match(await p.$eval('dialog [role="alert"]', x => x.textContent), /couldn.t be saved/i);
  assert.equal(await p.evaluate(successToast), false);
  const entered = await p.$$eval('[data-gt="class"],[data-gt="slide"],[data-gt="note"]', fields => fields.map(x => x.value));
  assert.deepEqual(entered, ['1', '4', nextTime]);
  assert.deepEqual((await h.lessonInDb(p, 'L2')).taught || [], []);

  const other = { classId: 'A1', date: slotDate, slide: 2, of: 5, note: 'Another class', agenda: [1, 3], at: 42 };
  const lessonNote = 'An edit from another window';
  await p.evaluate((other, note) => new Promise((resolve, reject) => {
    const open = indexedDB.open('gs-lessons');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('lessons', 'readwrite'), store = tx.objectStore('lessons');
      const read = store.get('L2');
      read.onsuccess = () => store.put({ ...read.result, note, taught: [other], updated: Date.now() });
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
  }), other, lessonNote);
  await p.click(save);
  await p.waitForFunction(successToast);
  assert.equal(await p.$('dialog[open] [data-gt="note"]'), null);
  const stored = await h.lessonInDb(p, 'L2');
  assert.equal(stored.note, lessonNote);
  assert.equal(stored.taught.length, 2);
  assert.deepEqual(stored.taught.find(row => row.classId === 'A1'), other);
  const { at, ...chosen } = stored.taught.find(row => row.classId === 'B1');
  assert.deepEqual(chosen, { classId: 'B1', date: slotDate, slide: 4, of: 5, note: nextTime });
  assert.deepEqual(p.errors.filter(e => !e.includes('Synthetic refused save')), []);
});

const localOnly = 'Progress saved in this browser. The Planner folder may be out of date.';

async function checkLocalSave(p) {
  await p.click(save);
  await p.waitForFunction(() => !!document.querySelector('.toast, dialog [role="alert"]'), { timeout: 8000 });
  assert.deepEqual(await p.$$eval('.toast', list => list.map(node => node.textContent.trim())), [localOnly]);
  assert.equal(await p.$('dialog[open] [data-gt="save"]'), null, 'a committed record needs no retry');
  const stored = await h.lessonInDb(p, 'L2');
  assert.deepEqual(stored.taught.map(({ at, ...row }) => row),
    [{ classId: 'B1', date: slotDate, slide: 4, of: 5, note: nextTime }]);
  return stored;
}

test('Present distinguishes a committed lesson from a failed lookup of the linked folder', async t => {
  const p = await openSheet(t);
  await p.evaluate(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      if (this.name === 'kv' && key === 'dir') {
        IDBObjectStore.prototype.get = get;
        throw new DOMException('Synthetic folder lookup failed', 'UnknownError');
      }
      return get.call(this, key);
    };
  });
  await checkLocalSave(p);
  assert.deepEqual(p.errors.filter(e => !e.includes('Synthetic folder lookup failed')), []);
});

// Chrome needs a normal throwaway profile to read a directory handle back from IndexedDB.
for (const mode of ['file conflict', 'permission prompt']) {
  test('Present reports a local save when the Planner folder has a ' + mode, async t => {
    const p = await h.browser.newPage();
    t.after(() => p.close());
    await p.evaluateOnNewDocument(STEADY);
    await p.goto(h.srv.url + 'blank');
    await p.evaluate(() => new Promise((resolve, reject) => {
      const reset = indexedDB.deleteDatabase('gs-lessons');
      reset.onsuccess = resolve; reset.onerror = () => reject(reset.error);
    }));
    await plant(p, gradingSeed()); await plantPlan(p, plan);
    await openSheet(t, p);

    const fileName = '10-27 Tue - Reading a poem aloud.lesson.json';
    const external = JSON.stringify({ ...lesson, note: 'Independent folder edit' });
    await p.evaluate(async (mode, name, text) => {
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(mode, { create: true });
      const file = await dir.getFileHandle(name, { create: true });
      const writer = await file.createWritable();
      await writer.write(text); await writer.close();
      if (mode === 'permission prompt') {
        const query = FileSystemDirectoryHandle.prototype.queryPermission;
        FileSystemDirectoryHandle.prototype.queryPermission = function (opts) {
          return this.name === mode ? Promise.resolve('prompt') : query.call(this, opts);
        };
      }
      const db = await new Promise((resolve, reject) => {
        const open = indexedDB.open('gs-lessons');
        open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
      });
      try {
        const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(dir, 'dir');
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
      } finally { db.close(); }
    }, mode, fileName, external);
    const stored = await checkLocalSave(p);
    assert.equal(stored._sync, 1, 'both failure paths keep the local lesson pending for sync');
    const onDisk = await p.evaluate(async (mode, name) => {
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(mode);
      return (await (await dir.getFileHandle(name)).getFile()).text();
    }, mode, fileName);
    assert.equal(onDisk, external);
  });
}
