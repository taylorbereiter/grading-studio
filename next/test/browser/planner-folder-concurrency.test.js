// The foreground writer is paused inside a real OPFS file write. A separate IndexedDB connection represents
// another Planner saving while the first one is busy. It can commit even if the two app tabs serialize exports.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan, lesson, UNITS } = require('./planseed.js');

const h = harness(beforeEach, afterEach); // OPFS handles persist in Chrome's normal, throwaway test profile.
const earlier = 'First contour reading', later = 'Revised contour reading';
const unit = { ...UNITS[1], title: 'Ridge atlas' };
const kept = lesson('A1-ridge', 'Ridge lesson', [{ classId: 'A1', date: '2026-10-29' }], {});
const removed = lesson('B2-valley', 'Valley lesson', [{ classId: 'A1', date: '2026-10-30' }], {});
const extra = { ...unit, id: 'U-new', title: 'Valley atlas' };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function open() {
  const app = await h.browser.newPage();
  await app.evaluateOnNewDocument(STEADY);
  await app.evaluateOnNewDocument(() => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Lessons', { create: true });
    const proto = FileSystemDirectoryHandle.prototype;
    const query = proto.queryPermission, request = proto.requestPermission;
    const prompt = dir => dir.name === 'Lessons' && sessionStorage.getItem('folder-permission') === 'prompt';
    proto.queryPermission = function (options) { return prompt(this) ? Promise.resolve('prompt') : query.call(this, options); };
    proto.requestPermission = function (options) {
      if (!prompt(this)) return request.call(this, options);
      sessionStorage.removeItem('folder-permission');
      return Promise.resolve('granted');
    };
  });
  await app.goto(h.srv.url + 'blank');
  await plant(app, gradingSeed());
  await plantPlan(app, { units: [unit], lessons: [kept, removed] });
  const other = await h.browser.newPage();
  await other.goto(h.srv.url + 'blank');
  await app.bringToFront();
  await h.open(app, 'settings/ai');
  await app.waitForSelector('[data-pflink]');
  return { app, other };
}

async function link(app) {
  await app.click('[data-pflink]');
  await app.waitForSelector('[data-pfstate="ok"]');
}

async function commit(page, { lessons = [], deletes = [], units }) {
  await page.evaluate(async ({ lessons, deletes, units }) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('gs-lessons');
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction(['lessons', 'kv'], 'readwrite');
      for (const l of lessons) tx.objectStore('lessons').put(l);
      for (const id of deletes) tx.objectStore('lessons').delete(id);
      if (units) tx.objectStore('kv').put(units, 'units');
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
    } finally { db.close(); }
  }, { lessons, deletes, units });
}

async function pauseWrites(app, suffixes) {
  await app.evaluate(suffixes => {
    const create = FileSystemFileHandle.prototype.createWritable;
    window.folderPauses = {};
    FileSystemFileHandle.prototype.createWritable = async function (...args) {
      const suffix = suffixes.find(s => this.name.endsWith(s) && !window.folderPauses[s]);
      if (suffix) await new Promise(resume => { window.folderPauses[suffix] = resume; });
      return create.apply(this, args);
    };
  }, suffixes);
}
const paused = (app, suffix) => app.waitForFunction(s => !!window.folderPauses[s], { timeout: 8000 }, suffix);
const resume = (app, suffix) => app.evaluate(s => window.folderPauses[s](), suffix);

async function finishPausedExport(app, other, name) {
  await other.evaluate(() => {
    window.exportDone = false;
    const channel = new BroadcastChannel('gs-plan-out');
    channel.onmessage = () => { window.exportDone = true; channel.close(); };
  });
  await resume(app, name);
  await other.waitForFunction(() => window.exportDone, { polling: 30, timeout: 8000 });
}

async function files(page) {
  return page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Lessons');
    const result = [];
    for (const [folder, suffix] of [[dir, '.lesson.json'], [await dir.getDirectoryHandle('Units'), '.unit.json']]) {
      for await (const [name, handle] of folder.entries()) {
        if (!name.endsWith(suffix)) continue;
        const file = await handle.getFile();
        result.push({ name, mod: file.lastModified, data: JSON.parse(await file.text()) });
      }
    }
    return result;
  });
}

async function writeFile(page, copy) {
  return page.evaluate(async ({ name, data }) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Lessons');
    if (name.endsWith('.unit.json')) dir = await dir.getDirectoryHandle('Units');
    const file = await dir.getFileHandle(name), writer = await file.createWritable();
    await writer.write(JSON.stringify(data, null, 2)); await writer.close();
    return (await file.getFile()).lastModified;
  }, copy);
}

async function scan(app) {
  await h.open(app, 'settings/ai');
  await app.waitForSelector('[data-pflook]');
  await app.click('[data-pflook]');
  await app.waitForFunction(() => !document.querySelector('[data-pflook]').disabled);
}

async function setText(app, input, value) {
  await input.click();
  await app.keyboard.down('Control'); await app.keyboard.press('a'); await app.keyboard.up('Control');
  await app.keyboard.type(value);
}

for (const kind of ['lesson', 'unit']) {
  test('linked ' + kind + ' save keeps the newer database record and file through a folder scan', async () => {
    const { app, other } = await open();
    await link(app);
    const isUnit = kind === 'unit', id = isUnit ? unit.id : kept.id;
    const file = (await files(other)).find(f => f.data.id === id);
    const read = async () => isUnit ? (await h.kvInDb(other, 'units')).find(u => u.id === id) : h.lessonInDb(other, id);
    const value = doc => isUnit ? doc.weeks[0].focus : doc.slides[2].title;
    const revise = doc => { if (isUnit) doc.weeks[0].focus = later; else doc.slides[2].title = later; };
    await h.open(app, isUnit ? 'class/c1' : 'lesson/' + id + '/edit');
    await pauseWrites(app, [file.name]);
    if (isUnit) {
      await app.click('[data-focus="edit-unit"]');
      await setText(app, await app.waitForSelector('.uweeks > li:first-child textarea'), earlier);
      await app.click('[data-focus="save-unit"]');
    } else {
      await app.click('[data-slide-i="2"]');
      const title = await app.evaluateHandle(() => Array.from(document.querySelectorAll('input')).find(i => i.value === 'Warm-up'));
      await setText(app, title.asElement(), earlier);
    }
    await paused(app, file.name);
    const current = await read();
    assert.equal(value(current), earlier);
    revise(current);
    current.updated += 30000;
    revise(file.data);
    file.data.updated = current.updated;
    current._mod = await writeFile(other, file);
    await commit(other, isUnit ? { units: [current, extra] } : { lessons: [current] });
    // Let an overwritten file qualify for import (folder-read's 1.5s mtime tolerance), with the browser clock still frozen.
    await wait(1700);
    await finishPausedExport(app, other, file.name);
    const beforeScan = await read(), diskBefore = (await files(other)).find(f => f.data.id === id);
    await scan(app);
    const afterScan = await read(), diskAfter = (await files(other)).find(f => f.data.id === id);
    assert.deepEqual(
      [value(beforeScan), value(diskBefore.data), value(afterScan), value(diskAfter.data)],
      [later, later, later, later], 'the later value is in IndexedDB and the folder both before and after Look in folder'
    );
    assert.equal(afterScan._file, diskAfter.name);
    assert.equal(afterScan._mod, diskAfter.mod);
    if (isUnit) assert.ok((await h.kvInDb(other, 'units')).some(u => u.id === extra.id));
  });
}

test('a delayed save and a retried folder import keep the external slides, local version and teacher notebook', async () => {
  const { app, other } = await open();
  await h.open(app, 'lesson/' + kept.id);
  await app.click('main [data-focus="beside"]');
  await app.waitForSelector('aside.beside [role=tab]');
  await app.evaluate(() => [...document.querySelectorAll('aside.beside [role=tab]')].find(t => t.textContent === 'Notebook').click());
  await (await app.waitForSelector('[data-nbpage][contenteditable="true"]')).click();
  await app.keyboard.type('Check the ridge map with the afternoon class.');
  await h.open(app, 'settings/ai');
  const notebook = (await h.lessonInDb(other, kept.id)).notebook;
  assert.match(notebook, /Check the ridge map with the afternoon class\./);
  await link(app);
  const file = (await files(other)).find(f => f.data.id === kept.id);
  file.data.slides[2].title = 'Contour revision from the folder';
  file.data.notebook = '<p>Different notebook in the external file.</p>';
  const externalText = JSON.stringify(file.data, null, 2);
  const externalMod = file.mod + 1;
  // Only the external editor's exact bytes get this mtime, inside the scanner's 1.5s grace period.
  // The file, exclusive writer, and independent editor all still use native OPFS.
  const fixExternalTime = (name, text, mod) => {
    const getFile = FileSystemFileHandle.prototype.getFile;
    FileSystemFileHandle.prototype.getFile = async function () {
      const f = await getFile.call(this);
      if (this.name !== name || await f.text() !== text) return f;
      return new File([f], name, { type: f.type, lastModified: mod });
    };
  };
  await h.open(app, 'lesson/' + kept.id + '/edit');
  await app.evaluateOnNewDocument(fixExternalTime, file.name, externalText, externalMod);
  await app.evaluate(fixExternalTime, file.name, externalText, externalMod);
  await pauseWrites(app, [file.name]);
  await app.click('[data-slide-i="2"]');
  const title = await app.evaluateHandle(() => Array.from(document.querySelectorAll('input')).find(i => i.value === 'Warm-up'));
  await setText(app, title.asElement(), earlier);
  await paused(app, file.name);
  const local = await h.lessonInDb(other, kept.id);
  assert.equal(local.slides[2].title, earlier);
  await writeFile(other, file);
  assert.deepEqual(await h.lessonInDb(other, kept.id), local, 'the external editor touched only the file');
  await finishPausedExport(app, other, file.name);
  const diskBytes = () => other.evaluate(async name => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Lessons');
    const f = await (await dir.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await f.arrayBuffer()));
  }, file.name);
  const expected = Buffer.from(externalText);
  assert.ok(Buffer.from(await diskBytes()).equals(expected), 'the delayed writer left the external bytes intact');
  const beforeScan = await h.lessonInDb(other, kept.id), versionKey = 'ver:' + kept.id;
  const history = (await h.kvInDb(other, versionKey)) || [];
  const failImportWrites = (id, slideTitle) => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.apply(this, arguments);
      const target = sessionStorage.getItem('fail-folder-write');
      if (this.transaction.db.name === 'gs-lessons' && target === this.name &&
          (key === 'ver:' + id || (value.id === id && value.slides?.[2]?.title === slideTitle))) {
        sessionStorage.setItem('aborted-folder-write', target);
        this.transaction.abort();
      }
      return request;
    };
  };
  await app.evaluateOnNewDocument(failImportWrites, kept.id, file.data.slides[2].title);
  await app.evaluate(failImportWrites, kept.id, file.data.slides[2].title);
  // Abort the real transaction at each write. Either ordering of lesson and version must roll back together.
  for (const store of ['kv', 'lessons']) {
    await app.evaluate(name => {
      sessionStorage.setItem('fail-folder-write', name);
      sessionStorage.removeItem('aborted-folder-write');
    }, store);
    await scan(app);
    assert.equal(await app.evaluate(() => sessionStorage.getItem('aborted-folder-write')), store);
    assert.deepEqual(await h.lessonInDb(other, kept.id), beforeScan);
    assert.deepEqual((await h.kvInDb(other, versionKey)) || [], history);
    assert.ok(Buffer.from(await diskBytes()).equals(expected));
  }
  await app.evaluate(() => sessionStorage.removeItem('fail-folder-write'));
  await scan(app);
  const saved = await h.lessonInDb(other, kept.id), versions = await h.kvInDb(other, versionKey);
  assert.equal(saved.slides[2].title, file.data.slides[2].title);
  assert.equal(saved.notebook, notebook);
  assert.deepEqual(saved.pending.before, local.slides);
  assert.deepEqual(versions.slice(1), history, 'one new version precedes the original history');
  assert.deepEqual(versions[0].lesson.slides, local.slides);
  assert.equal(versions[0].lesson.notebook, notebook);
  assert.equal(saved._mod, externalMod);
  assert.ok(Buffer.from(await diskBytes()).equals(expected), 'the reviewed external bytes survived the scan');
});

for (const reconnect of [false, true]) {
  test((reconnect ? 'reconnecting' : 'linking') + ' the Planner folder keeps intervening lesson and unit changes', async () => {
    const { app, other } = await open();
    if (reconnect) {
      await link(app);
      const l = await h.lessonInDb(other, kept.id), units = await h.kvInDb(other, 'units');
      l.note = 'Edited between connections'; l.updated += 1; l._sync = 1;
      units[0].weeks[0].focus = 'Edited between connections'; units[0].updated += 1;
      await commit(other, { lessons: [l], units });
      await app.evaluate(() => sessionStorage.setItem('folder-permission', 'prompt'));
      await app.reload();
      await app.waitForSelector('[data-pfpermit]');
    }
    const lessonSuffix = 'Ridge lesson.lesson.json', unitSuffix = 'Ridge atlas.unit.json';
    await pauseWrites(app, [lessonSuffix, unitSuffix]);
    await app.click(reconnect ? '[data-pfpermit]' : '[data-pflink]');
    await paused(app, lessonSuffix);
    const revised = await h.lessonInDb(other, kept.id);
    revised.note = later; revised.updated += 30000;
    await commit(other, { lessons: [revised], deletes: [removed.id] });
    await resume(app, lessonSuffix);
    await paused(app, unitSuffix);
    const units = await h.kvInDb(other, 'units');
    units[0].weeks[0].focus = later; units[0].updated += 30000;
    await commit(other, { units: [...units, extra] });
    await resume(app, unitSuffix);
    await app.waitForSelector('[data-pfstate="ok"]');
    await scan(app);
    const saved = await h.lessonInDb(other, kept.id), savedUnits = await h.kvInDb(other, 'units');
    const disk = await files(other);
    assert.equal(saved.note, later);
    assert.equal(await h.lessonInDb(other, removed.id), null);
    assert.deepEqual(savedUnits.map(u => u.id).sort(), [unit.id, extra.id].sort());
    assert.equal(savedUnits.find(u => u.id === unit.id).weeks[0].focus, later);
    assert.deepEqual(disk.map(f => f.data.id).sort(), [kept.id, unit.id, extra.id].sort());
    assert.equal(disk.find(f => f.data.id === kept.id).data.note, later);
    assert.equal(disk.find(f => f.data.id === unit.id).data.weeks[0].focus, later);
    assert.equal(disk.find(f => f.data.id === extra.id).data.title, extra.title);
    for (const record of [saved, ...savedUnits]) {
      const file = disk.find(f => f.data.id === record.id);
      assert.deepEqual([record._file, record._mod], [file.name, file.mod]);
    }
  });
}
