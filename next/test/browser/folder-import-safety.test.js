// H-020. A failed folder read or write must allow the same external files to be
// imported on retry without replacing any saved planning data with defaults.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const { plant } = require('../../../test/helpers/app.js');
const { STEADY, gradingSeed } = require('../../../test/helpers/steady.js');
const { plantPlan, SETUP, UNITS, ACTS } = require('./planseed.js');
const h = harness(before, after);

const bytes = [0, 255, 1, 2, 3, 128, 7];
const words = { sys: 'Prism desk', unit: 'Learning map' };
const classLink = 'https://prism.example.com/course';

async function scan(p, fail) {
  await p.evaluate(stage => { window.failStage = stage; window.didFail = false; }, fail);
  await p.click('[data-pflook]');
  await p.waitForFunction(fail => (!fail || window.didFail) && !document.querySelector('[data-pflook]').disabled, { timeout: 15000 }, fail);
  await p.evaluate(() => { window.failStage = ''; });
}

async function snapshot(p) {
  return p.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Prism');
    const disk = {};
    async function walk(dir, prefix) {
      for await (const [name, entry] of dir.entries()) {
        const path = prefix + name;
        if (entry.kind === 'directory') await walk(entry, path + '/');
        else disk[path] = [...new Uint8Array(await (await entry.getFile()).arrayBuffer())];
      }
    }
    await walk(root, '');
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('gs-lessons');
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    const kv = {};
    const keys = ['setup', 'units', 'bank', 'bankFiles', 'activities', 'words', 'deflook', 'profMod', 'file:prism'];
    try {
      await Promise.all(keys.map(key => new Promise((resolve, reject) => {
        const r = db.transaction('kv').objectStore('kv').get(key);
        r.onsuccess = () => { kv[key] = r.result; resolve(); }; r.onerror = () => reject(r.error);
      })));
    } finally { db.close(); }
    kv['file:prism'] = [...new Uint8Array(await kv['file:prism'].arrayBuffer())];
    return { disk, kv };
  });
}

test('H-020: folder scan preserves stored records and disk bytes on failed reads and retries partial imports', async () => {
  // Real directory handles live in the throwaway browser's private filesystem.
  const p = await h.browser.newPage();
  try {
    await p.evaluateOnNewDocument(STEADY);
    await p.evaluateOnNewDocument(() => {
      window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Prism', { create: true });
      const get = IDBObjectStore.prototype.get, put = IDBObjectStore.prototype.put, open = FileSystemFileHandle.prototype.createWritable;
      const local = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === 'gs.planCopy' && window.failStage?.startsWith('mirror-')) {
          window.didFail = true;
          if (window.failStage === 'mirror-denied') throw new Error('Phone timetable unavailable');
          return '{unfinished';
        }
        return local.call(this, key);
      };
      IDBObjectStore.prototype.get = function (key) {
        if (this.transaction.db.name === 'gs-lessons' && this.name === 'kv' && window.failStage === 'read-' + key) {
          window.didFail = true; throw new Error('Simulated record read failure');
        }
        return get.call(this, key);
      };
      IDBObjectStore.prototype.put = function (...args) {
        if (this.transaction.db.name === 'gs-lessons' && this.name === 'kv' && args[1] === 'bank' && window.failStage === 'bank') {
          window.didFail = true; throw new Error('Simulated bank save failure');
        }
        return put.apply(this, args);
      };
      FileSystemFileHandle.prototype.createWritable = function (...args) {
        if ((this.name === 'timetable.json' && window.failStage === 'profile') ||
            (this.name.endsWith('Poetry.unit.json') && window.failStage === 'profile-unit')) {
          window.didFail = true; return Promise.reject(new Error('Simulated profile file write failure'));
        }
        return open.apply(this, args);
      };
    });
    await p.goto(h.srv.url + 'blank');
    const setup = structuredClone(SETUP), units = structuredClone(UNITS);
    setup.classes[0].mb = classLink;
    units[0].files = [{ id: 'prism', name: 'Prism sample.pdf', type: 'application/pdf', kind: 'other', added: 1, size: bytes.length }];
    await plant(p, gradingSeed()); await plantPlan(p, { setup, units });
    await p.evaluate(async (words, bytes) => {
      const db = await new Promise(r => { const a = indexedDB.open('gs-lessons'); a.onsuccess = () => r(a.result); });
      const tx = db.transaction('kv', 'readwrite'), kv = tx.objectStore('kv');
      kv.put(words, 'words'); kv.put('sage', 'deflook'); kv.put(new Blob([Uint8Array.from(bytes)]), 'file:prism');
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close();
    }, words, bytes);
    await h.open(p, 'settings/ai'); await p.click('[data-pflink]');
    await p.waitForSelector('[data-pflook]:not(:disabled)', { timeout: 15000 });
    const profile = { ...setup, classes: setup.classes.map(({ mb, ...c }) => c), profile: 'Prism plan', plain: true, look: 'navy',
      units: [{ ...units[1], atlas: 'https://prism.example.com/poetry' }] };
    await p.evaluate(async (profile, activities) => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Prism');
      async function write(dir, name, json) {
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(JSON.stringify(json)); await w.close();
      }
      await write(root, 'profile.json', profile);
      await write(root, 'activities.json', [...activities, { ...activities[0], id: 'prism-activity', name: 'Prism relay' }]);
      await write(await root.getDirectoryHandle('Units'), 'Prism unit.unit.json', { course: 'Grade 9', title: 'Prism unit', start: '2026-10-26', weeks: [{ focus: 'Light' }] });
      await write(await root.getDirectoryHandle('Rubrics'), 'Prism rubric.rubric.json', { name: 'Prism rubric', criteria: ['Reflection'] });
    }, profile, ACTS);
    const before = await snapshot(p);
    for (const key of ['setup', 'units', 'activities', 'bank', 'words', 'deflook', 'profMod', 'bankFiles', 'syncGoneFiles']) {
      await scan(p, 'read-' + key);
      assert.deepEqual(await snapshot(p), before, 'failed read of ' + key + ' preserves records and folder bytes');
    }
    await scan(p, 'profile');
    const partial = await snapshot(p);
    assert.equal(partial.kv.profMod, before.kv.profMod, 'profile still pending after failed disk write');
    assert.deepEqual(partial.disk['timetable.json'], before.disk['timetable.json']);
    await scan(p, 'profile-unit');
    const pendingUnit = await snapshot(p);
    assert.equal(pendingUnit.kv.profMod, before.kv.profMod, 'profile remains pending until its unit reaches the folder');
    await scan(p, 'bank');
    const bankFailure = await snapshot(p);
    assert.deepEqual(bankFailure.kv.bankFiles, before.kv.bankFiles);
    assert.deepEqual(bankFailure.kv.bank, before.kv.bank);
    await scan(p, '');
    const end = await snapshot(p), json = path => JSON.parse(Buffer.from(end.disk[path]).toString());
    assert.equal(end.kv.setup.classes[0].mb, classLink); assert.equal(json('timetable.json').classes[0].mb, classLink);
    assert.equal(end.kv.setup.profile, 'Prism plan'); assert.equal(json('timetable.json').profile, 'Prism plan'); assert.ok(end.kv.profMod);
    const poetry = end.kv.units.find(u => u.id === 'U2');
    assert.equal(poetry.atlas, profile.units[0].atlas);
    assert.equal(json('Units/' + poetry._file).atlas, profile.units[0].atlas);
    assert.deepEqual(end.kv.words, words); assert.equal(end.kv.deflook, 'sage');
    assert.deepEqual(end.kv['file:prism'], bytes);
    const attachment = Object.keys(before.disk).find(name => name.endsWith('/Prism sample.pdf'));
    assert.ok(attachment); assert.deepEqual(end.disk[attachment], bytes);
    const addedUnits = end.kv.units.filter(x => x.title === 'Prism unit');
    assert.equal(addedUnits.length, 1); assert.equal(json('Units/' + addedUnits[0]._file).id, addedUnits[0].id);
    assert.ok(end.kv.activities.some(x => x.id === 'prism-activity')); assert.ok(end.kv.activities.some(x => x.id === ACTS[0].id));
    const rubrics = end.kv.bank.rubrics.filter(x => x.name === 'Prism rubric');
    assert.equal(rubrics.length, 1); assert.equal(json('Rubrics/' + end.kv.bankFiles[rubrics[0].id].file).id, rubrics[0].id);
    assert.ok(end.kv.bank.rubrics.some(x => x.id === 'R1'));
    await p.reload(); await p.waitForSelector('[data-pflook]:not(:disabled)'); await scan(p, '');
    assert.deepEqual(await snapshot(p), end, 'reopening a fully imported folder is idempotent');

    // A phone can have only the timetable mirror. A failed read or malformed
    // mirror is different from having no timetable on this computer.
    await p.evaluate(async (saved, profile) => {
      localStorage.setItem('gs.planCopy', JSON.stringify(saved));
      const db = await new Promise(r => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => r(q.result); });
      const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete('setup');
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close();
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Prism');
      const writer = await (await dir.getFileHandle('profile.json')).createWritable();
      await writer.write(JSON.stringify({ ...profile, profile: 'Second prism plan', sys: 'Second desk' })); await writer.close();
    }, end.kv.setup, profile);
    const phone = await snapshot(p);
    for (const stage of ['mirror-denied', 'mirror-malformed']) {
      await scan(p, stage);
      assert.deepEqual(await snapshot(p), phone, stage + ' preserves the database and folder');
    }
    await scan(p, '');
    const restored = await snapshot(p);
    assert.equal(restored.kv.setup.classes[0].mb, classLink);
    assert.equal(restored.kv.setup.profile, 'Second prism plan');
    assert.deepEqual(restored.kv.words, { sys: 'Second desk', unit: words.unit });
    assert.equal(JSON.parse(Buffer.from(restored.disk['timetable.json']).toString()).classes[0].mb, classLink);
  } finally { await p.close(); }
});
