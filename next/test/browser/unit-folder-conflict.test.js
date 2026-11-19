// The file editor changes only disk while the rebuilt Planner is saving a unit.
// Both apps reopen the same committed unit and the separately recoverable edits.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { harness } = require('./e2harness.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan, UNITS } = require('./planseed.js');
const h = harness(before, after);

async function disk(page) {
  return page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Contours');
    const units = await root.getDirectoryHandle('Units');
    const files = {}, recovered = {};
    for await (const [name, h] of units.entries()) {
      if (h.kind === 'file') files[name] = await (await h.getFile()).text();
      if (name === 'Recovered') for await (const [file, ref] of h.entries()) {
        recovered[file] = Array.from(new Uint8Array(await (await ref.getFile()).arrayBuffer()));
      }
    }
    return { files, recovered };
  });
}

test('a concurrent disk-only unit edit retains both versions and dated teacher notes across both Planners', async () => {
  const app = await h.browser.newPage(), editor = await h.browser.newPage();
  try {
    await app.evaluateOnNewDocument(STEADY);
    await app.evaluateOnNewDocument(() => {
      window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Contours', { create: true });
    });
    await app.goto(h.srv.url + 'blank'); await editor.goto(h.srv.url + 'blank'); await app.bringToFront();
    const unit = structuredClone(UNITS[1]);
    unit.title = 'Contour lines'; unit.notebook = '<p>Keep Δ in the notebook</p>';
    unit.weeks[0].notes = 'Field trip, first week'; unit.weeks[1].notes = 'Second week, contour café';
    const ref = { id: 'contour-ref', name: 'Map.pdf', kind: 'other', type: 'application/pdf', size: 4, added: 1 };
    unit.files = [ref];
    const other = { ...UNITS[2], title: 'Timestamp only' };
    await plant(app, gradingSeed()); await plantPlan(app, { units: [unit, other] });
    await editor.evaluate(async other => {
      const db = await new Promise(resolve => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => resolve(r.result); });
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(new Blob([Uint8Array.of(0, 128, 1, 255)]), 'file:contour-ref');
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onabort = () => rej(tx.error); }); db.close();
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Contours', { create: true });
      const units = await root.getDirectoryHandle('Units', { create: true });
      const f = await units.getFileHandle('Grade 10 - Timestamp only.unit.json', { create: true });
      const w = await f.createWritable(); await w.write(JSON.stringify({ ...other, updated: other.updated + 1 })); await w.close();
    }, other);
    await h.open(app, 'settings/ai'); await app.click('[data-pflink]');
    await app.waitForSelector('[data-pflook]:not(:disabled)');
    assert.deepEqual((await disk(editor)).recovered, {}, 'no archive for an updated timestamp, even with no baseline');

    const file = 'Grade 9 - Contour lines.unit.json';
    const incoming = JSON.parse((await disk(editor)).files[file]);
    incoming.start = '2026-10-19'; incoming.weeks.shift();
    incoming.weeks[0].focus = 'Independent disk focus'; incoming.weeks[0].notes = 'Distinct note from the file';
    incoming.notebook = ''; incoming.files = [];
    const externalText = JSON.stringify(incoming, null, 2);
    await h.open(app, 'class/c1');
    await app.evaluate(name => {
      const open = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = async function (...args) {
        if (this.name === name && !window.releaseUnitWrite) {
          await new Promise(resolve => { window.releaseUnitWrite = resolve; });
        }
        return open.apply(this, args);
      };
    }, file);
    await app.click('[data-focus="edit-unit"]');
    const focus = await app.waitForSelector('.uweeks > li:nth-child(2) textarea');
    await focus.click(); await app.keyboard.down('Control'); await app.keyboard.press('a'); await app.keyboard.up('Control');
    await app.keyboard.type('Committed app focus'); await app.click('[data-focus="save-unit"]');
    await app.waitForFunction(() => !!window.releaseUnitWrite);
    const local = (await h.kvInDb(editor, 'units')).find(x => x.id === unit.id);
    assert.equal(local.weeks[1].focus, 'Committed app focus');
    await editor.evaluate(async (name, text) => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Contours');
      const f = await (await root.getDirectoryHandle('Units')).getFileHandle(name), w = await f.createWritable();
      await w.write(text); await w.close();
    }, file, externalText);
    await app.evaluate(() => window.releaseUnitWrite());
    await editor.waitForFunction(async () => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Contours');
      try { const dir = await (await root.getDirectoryHandle('Units')).getDirectoryHandle('Recovered');
        for await (const h of dir.values()) if ((await h.getFile()).size) return true;
      } catch (e) { if (e.name !== 'NotFoundError') throw e; }
      return false;
    }, { polling: 50, timeout: 12000 });
    assert.equal((await disk(editor)).files[file], externalText, 'the writer preserved the external file');
    const fault = () => {
      const read = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = async function (...args) {
        const data = await read.apply(this, args);
        if (sessionStorage.getItem('bad-recovery-read') && /[0-9a-f]{64}\.unit\.json$/.test(this.name)) {
          new Uint8Array(data)[0] ^= 255;
          window.recoveryReadFailed = true;
        }
        return data;
      };
    };
    await app.evaluate(fault); await app.evaluateOnNewDocument(fault);
    await app.evaluate(() => sessionStorage.setItem('bad-recovery-read', 'yes'));
    await h.open(app, 'settings/ai'); await app.click('[data-pflook]');
    await app.waitForFunction(() => window.recoveryReadFailed && !document.querySelector('[data-pflook]').disabled);
    assert.deepEqual((await h.kvInDb(editor, 'units')).find(x => x.id === unit.id), local, 'unverified recovery keeps the local unit active');
    assert.equal((await disk(editor)).files[file], externalText);
    await app.evaluate(() => sessionStorage.removeItem('bad-recovery-read'));
    await app.click('[data-pflook]'); await app.waitForSelector('[data-pflook]:not(:disabled)');
    await app.reload(); await app.waitForSelector('[data-pflook]:not(:disabled)');
    await app.click('[data-pflook]'); await app.waitForSelector('[data-pflook]:not(:disabled)');
    const saved = await h.kvInDb(editor, 'units');
    assert.equal(saved.length, 2);
    const active = saved.find(x => x.id === unit.id);
    assert.deepEqual([active.start, active.weeks[0].focus, active.weeks[0].notes, active.notebook],
      [incoming.start, 'Independent disk focus', unit.weeks[1].notes, unit.notebook]);
    assert.deepEqual(active.files, [ref]);
    const end = await disk(editor);
    assert.equal(end.files[file], externalText);
    assert.equal(Object.keys(end.recovered).length, 2, 'retry and reload deduplicate both original versions');
    const snapshots = Object.entries(end.recovered).map(([name, data]) => {
      const bytes = Buffer.from(data);
      assert.ok(name.endsWith(createHash('sha256').update(bytes).digest('hex') + '.unit.json'));
      return JSON.parse(bytes.toString());
    });
    const archived = snapshots.find(u => u.weeks[1]?.focus === 'Committed app focus');
    assert.ok(archived);
    assert.deepEqual(archived.weeks, local.weeks);
    assert.equal(archived.notebook, local.notebook);
    assert.deepEqual(archived.files, [{ name: ref.name, kind: ref.kind, type: ref.type, size: ref.size }]);
    assert.ok(snapshots.some(u => u.weeks[0].notes === 'Distinct note from the file'));
    await app.goto(h.srv.url + 'planner.html');
    await app.waitForFunction(() => window.__planner?.L.units?.length === 2);
    const classic = await app.evaluate(id => window.__planner.L.units.find(u => u.id === id), unit.id);
    assert.deepEqual(classic.weeks, active.weeks); assert.equal(classic.notebook, unit.notebook);
    assert.deepEqual(classic.files, active.files);
    await app.evaluate(id => {
      window.__planner.openUnit(window.__planner.L.units.find(u => u.id === id));
      window.open = url => { window.openedMap = url; };
    }, unit.id);
    assert.equal(await app.$eval('[data-uw="notes"][data-i="0"]', t => t.value), unit.weeks[1].notes);
    await app.click('[data-a="viewfile"][data-fid="contour-ref"]');
    await app.waitForFunction(() => !!window.openedMap);
    const fileBytes = await app.evaluate(async () => Array.from(new Uint8Array(await (await fetch(window.openedMap)).arrayBuffer())));
    assert.deepEqual(fileBytes, [0, 128, 1, 255]);
    assert.deepEqual((await disk(editor)).recovered, end.recovered);
  } finally { await app.close(); await editor.close(); }
});
