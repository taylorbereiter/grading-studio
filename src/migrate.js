/* ---------------- saved-data versions: a safety copy, then any format changes, before the app starts ---------------- */
// Saved work has a format version, kept in localStorage as gs.dataV. No key means 1, the format from before versions.
// To change how work is stored, add a step to MIGRATIONS with the next number:
//   { to: 2, name: 'What changes', run: async m => { await m.eachWork(d => { d.newThing ||= {}; }); } }
// Rules for a step:
// - Additive only. Old keys stay readable, and the app must still cope with a record that hasn't got the new thing.
// - Safe to run twice on the same record. Restoring an old backup can leave old and new records side by side, and the step runs again.
// - Change data only through m (below), so a failure can be undone. Papers (the files as opened) never change.
// A safety copy of everything but the papers is made first, all or nothing. If it can't be made, nothing changes.
// An update cut short (a closed tab, a crash) starts again with the copy it already has: another would only copy half-changed work.
// TRY_KEY names that copy while a try is under way. The app starting normally clears it: she may have worked since, so that copy is too old to go back to.
// If a step fails, everything goes back as it was and the version stays put. The next load tries again, and its fresh copy takes the failed try's place.
// A step that's still going after STUCK_MS offers a way out. Stopping it puts everything back, and it waits for the next app version or a new step.
// The whole app waits for this in gsData.boot. With nothing to do it starts right away, in the same tick.
const gsData = (() => {
  'use strict';
  const APP_VERSION = '/*@@VERSION@@*/';   // from package.json, the one place it's set
  const MIGRATIONS = [
  ];
  const DATA_V = Math.max(1, ...MIGRATIONS.map(s => s.to));
  const SAFETY_DB = 'grading-studio-safety', SNAP_KEEP = 3, STUCK_MS = 30000, KEEP_DB = 'grading-studio-keep', SLICE_MAX = 32e6, TRY_KEY = 'gsm.try';   // TRY_KEY is outside gs.*, so copies and backups never carry it
  // What a safety copy holds, besides every gs.* key in localStorage. Papers stay out: they're large and never change.
  const STORES = [[KEEP_DB, 'work'], [KEEP_DB, 'meta'], [KEEP_DB, 'edits'], ['grading-studio-added', 'files'], ['grading-studio-examples', 'ex'], ['grading-studio-examples', 'pix']];   // examples' pictures are small, and a copy put back needs them
  const info = { note: '' };   // shown once the app is up
  const endTry = () => { try { localStorage.removeItem(TRY_KEY); } catch {} };
  let stopped = false;   // she stopped a stuck update: a step still running can't change anything from here on
  const live = () => { if (stopped) throw new Error('This update was stopped'); };

  const version = () => { let v = 0; try { v = +JSON.parse(localStorage.getItem('gs.dataV')); } catch {} return v >= 1 ? v : 1; };
  const lsKeys = pre => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) o.push(k); } return o; };
  // Opens a database only if it's already there; the app makes its own, at its own version.
  const openOld = name => new Promise(res => {
    const r = indexedDB.open(name);
    r.onupgradeneeded = () => r.transaction.abort();
    r.onsuccess = () => res(r.result); r.onerror = () => res(null);
  });
  const readAll = (db, name) => new Promise((res, rej) => {
    const tx = db.transaction(name), o = tx.objectStore(name), a = o.getAll(), b = o.getAllKeys();
    tx.oncomplete = () => res({ k: b.result, v: a.result }); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
  const keysOf = (db, name) => new Promise((res, rej) => { const q = db.transaction(name).objectStore(name).getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const writeAll = (db, name, fn) => new Promise((res, rej) => {
    const tx = db.transaction(name, 'readwrite'); fn(tx.objectStore(name));
    tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
  async function withDb(name, fn) { const db = await openOld(name); if (!db) return null; try { return await fn(db); } finally { db.close(); } }
  const safetyDb = () => new Promise((res, rej) => {
    const r = indexedDB.open(SAFETY_DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('meta'); r.result.createObjectStore('data'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });

  /* safety copies */
  // A browser refuses one record over about 130 MB, so a copy is kept as records in the data store: "id" holds localStorage, and "id|0", "id|1"... hold slices
  // of the stores, { where, k, v }, of at most SLICE_MAX. A larger file gets a slice to itself, which fits since the app saved it as one record.
  const sizeOf = v => !v || typeof v !== 'object' ? (typeof v === 'string' ? v.length * 2 : 8) : ArrayBuffer.isView(v) ? v.buffer.byteLength : v instanceof ArrayBuffer ? v.byteLength : Object.values(v).reduce((n, x) => n + sizeOf(x), 16);   // a view is stored with its whole buffer
  function sliced(stores) {
    const out = [];
    for (const [where, s] of Object.entries(stores)) {
      let p = null, n = 0;
      s.k.forEach((k, i) => {
        const z = sizeOf(s.v[i]);
        if (!p || n + z > SLICE_MAX) { out.push(p = { where, k: [], v: [] }); n = 0; }
        p.k.push(k); p.v.push(s.v[i]); n += z;
      });
    }
    return out;
  }
  const slicesOf = id => IDBKeyRange.bound(id + '|', id + '|\uffff');
  // Everything in one transaction, so a closed tab or a full disk leaves no part of a copy behind.
  const inCopies = (db, fn) => new Promise((res, rej) => {
    const tx = db.transaction(['meta', 'data'], 'readwrite');
    tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    try { fn(tx.objectStore('meta'), tx.objectStore('data')); } catch (e) { rej(e); try { tx.abort(); } catch {} }
  });
  const dropCopy = (meta, data, id) => { meta.delete(id); data.delete(id); data.delete(slicesOf(id)); };
  // o.state: this copy is for an update, and how that went: running, done, failed or stopped. o.replace: the id of the copy this one takes the place of.
  async function snapshot(why, toV, o = {}) {
    const ls = {}; for (const k of lsKeys('gs.')) ls[k] = localStorage.getItem(k);
    const stores = {};
    for (const [dbName, name] of STORES) await withDb(dbName, async db => { if (db.objectStoreNames.contains(name)) stores[dbName + '/' + name] = await readAll(db, name); });
    if (!Object.keys(ls).length && !Object.values(stores).some(s => s.k.length)) return null;   // a brand-new browser has nothing to keep
    const t = Date.now(), id = t + '-' + Math.random().toString(36).slice(2, 6), m = { id, t, why, app: APP_VERSION, fromV: version(), toV, ...(o.state ? { state: o.state } : {}) };
    const db = await safetyDb();
    try {
      if (o.state) live();
      await inCopies(db, (meta, data) => {
        data.put({ ls }, id); sliced(stores).forEach((p, i) => data.put(p, id + '|' + i)); meta.put(m, id);
        if (o.replace) dropCopy(meta, data, o.replace);
      });
      const old = (await readAll(db, 'meta')).v.sort((a, b) => b.t - a.t).slice(SNAP_KEEP);
      if (old.length) await inCopies(db, (meta, data) => { for (const c of old) dropCopy(meta, data, c.id); });
    } finally { db.close(); }
    return m;
  }
  const snapshots = () => withDb(SAFETY_DB, async db => db.objectStoreNames.contains('meta') ? (await readAll(db, 'meta')).v.sort((a, b) => b.t - a.t) : []).then(l => l || []);
  const readCopy = id => withDb(SAFETY_DB, db => new Promise((res, rej) => {
    const tx = db.transaction('data'), o = tx.objectStore('data'), a = o.get(id), b = o.getAll(slicesOf(id));
    tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    tx.oncomplete = () => {
      if (!a.result) return res(null);
      const stores = {};
      for (const p of b.result) { const s = stores[p.where] ||= { k: [], v: [] }; s.k = s.k.concat(p.k); s.v = s.v.concat(p.v); }
      res({ ls: a.result.ls, stores });
    };
  }));
  const markCopy = (id, state) => withDb(SAFETY_DB, async db => { const all = await readAll(db, 'meta'), c = all.v.find(x => x.id === id); if (c) await writeAll(db, 'meta', o => o.put({ ...c, state }, id)); }).catch(e => console.error(e));
  // Everything a safety copy holds goes back exactly as it was, and anything added since goes, even from a store that didn't exist yet.
  // Papers aren't in a copy and stay, so a download opened since keeps its row, with no marks. That way Forget can still reach it and an undo finds its papers.
  async function putBackData(rec) {
    const was = await withDb(KEEP_DB, db => db.objectStoreNames.contains('meta') ? readAll(db, 'meta') : null);
    for (const k of lsKeys('gs.')) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(rec.ls)) localStorage.setItem(k, v);
    for (const [dbName, name] of STORES) {
      const s = rec.stores[dbName + '/' + name] || { k: [], v: [] };
      await withDb(dbName, db => db.objectStoreNames.contains(name) ? writeAll(db, name, o => { o.clear(); s.k.forEach((k, i) => o.put(s.v[i], k)); }) : null);
    }
    await withDb(KEEP_DB, async db => {
      if (!db.objectStoreNames.contains('papers') || !db.objectStoreNames.contains('meta')) return;
      const papers = (await keysOf(db, 'papers')).filter(k => !String(k).includes('|')), now = await readAll(db, 'meta');   // a big download's pieces are "id|..."; the id alone is the download
      await writeAll(db, 'meta', o => {
        now.k.forEach((k, i) => { if (now.v[i].papers && !papers.includes(k)) o.put({ ...now.v[i], papers: false }, k); });
        for (const k of papers) if (!now.k.includes(k)) {
          const row = was && was.v[was.k.indexOf(k)];
          o.put({ ...(row || { id: k, name: 'A download', n: 0, t: Date.now() }), scored: 0, papers: true }, k);
        }
      });
    });
  }
  // The button on the start screen. How things are now is kept first, so a wrong click can be undone too.
  async function putBack(id) {
    const rec = await readCopy(id);
    if (!rec) throw new Error('That safety copy is gone');
    await snapshot('Before putting back an earlier safety copy', version());
    await putBackData(rec);
  }
  // Forget means gone, so a forgotten download comes out of every safety copy too, and Put back can't bring it back.
  const forget = id => withDb(SAFETY_DB, db => !db.objectStoreNames.contains('data') ? null : new Promise((res, rej) => {
    const tx = db.transaction('data', 'readwrite'), c = tx.objectStore('data').openCursor(), mine = k => k === id || String(k).startsWith(id + '|');   // late files and Word edits are keyed "id|..."
    tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    c.onsuccess = () => {
      const x = c.result; if (!x) return;
      const r = x.value;
      if (r.ls) {
        for (const k of Object.keys(r.ls)) if (k.includes(id)) delete r.ls[k];
        if (r.ls['gs.batches']) { try { const b = JSON.parse(r.ls['gs.batches']); delete b[id]; r.ls['gs.batches'] = JSON.stringify(b); } catch {} }
        x.update(r);
      } else if (r.k.some(mine)) {   // the rest of a slice stays; a slice that's left empty does no harm
        const on = r.k.map(k => !mine(k));
        x.update({ where: r.where, k: r.k.filter((_, i) => on[i]), v: r.v.filter((_, i) => on[i]) });
      }
      x.continue();
    };
  }));

  /* format changes */
  const m = {
    lsKeys,
    lsGet: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    lsSet: (k, v) => { live(); localStorage.setItem(k, JSON.stringify(v)); },   // throws when full, which stops the update and undoes it
    // fn changes a record in place. Records aren't deleted here on purpose.
    async eachRecord(dbName, name, fn) {
      if (name === 'papers') throw new Error('Papers never change');
      if (!STORES.some(([d, n]) => d === dbName && n === name)) throw new Error('A step can only change what a safety copy holds');
      live();
      await withDb(dbName, async db => {
        if (!db.objectStoreNames.contains(name)) return;
        const all = await readAll(db, name);
        for (let i = 0; i < all.k.length; i++) await fn(all.v[i], all.k[i]);
        live();
        await writeAll(db, name, o => all.k.forEach((k, i) => o.put(all.v[i], k)));
      });
    },
    // Each download's marks and scores live in two places, and both need the same change.
    async eachWork(fn) {
      for (const k of lsKeys('gs.b.')) { const d = m.lsGet(k); if (d) { await fn(d, k); m.lsSet(k, d); } }
      await m.eachRecord('grading-studio-keep', 'work', fn);
    },
  };
  // Which safety copy this try goes back to if it has to.
  async function prepare() {
    const last = (await snapshots()).find(s => s.state);   // the newest copy made for an update
    if (last && last.state === 'stopped' && last.app === APP_VERSION && last.toV === DATA_V) return { hold: true };
    if (last && last.state === 'running' && version() < last.toV && localStorage.getItem(TRY_KEY) === last.id) return { id: last.id };
    const snap = await snapshot('Before updating how your work is saved', DATA_V, { state: 'running', replace: last && (last.state === 'failed' || last.state === 'stopped') ? last.id : null });
    if (snap) try { localStorage.setItem(TRY_KEY, snap.id); } catch {}
    return snap ? { id: snap.id } : {};   // no copy means a brand-new browser: going back means going back to nothing
  }
  async function migrate(stop) {
    const from = version(), todo = MIGRATIONS.filter(s => s.to > from).sort((a, b) => a.to - b.to);
    if (!todo.length) return;   // another tab got here first
    let p;
    try { p = await Promise.race([prepare(), stop]); }
    catch (e) {
      console.error(e);
      info.note = stopped ? 'You stopped an update to how your work is saved before it changed anything. Your work is safe. It will try again next time you open this page.'
        : e && e.name === 'QuotaExceededError' ? 'There’s an update to how your work is saved, but this computer doesn’t have room for a safety copy first, so nothing was changed. Your work is safe. Free up some disk space and reload this page.'
        : 'There’s an update to how your work is saved, but the safety copy that comes first couldn’t be made, so nothing was changed. Your work is safe. Reload this page to try again.';
      return;
    }
    if (p.hold) { info.note = 'An update to how your work is saved got stuck, so it’s on hold and your work is just as it was. Nothing is lost. It will try again when Grading Studio gets a new version.'; return; }
    for (const s of todo) {
      try { await Promise.race([s.run(m), stop]); localStorage.setItem('gs.dataV', JSON.stringify(s.to)); }
      catch (e) {
        console.error('Saved-data update failed: ' + s.name, e);
        endTry();
        try {
          await putBackData(p.id ? await readCopy(p.id) : { ls: {}, stores: {} });
          if (p.id) await markCopy(p.id, stopped ? 'stopped' : 'failed');
          info.note = stopped ? 'You stopped an update to how your work is saved, so everything was put back exactly as it was. Nothing is lost. It will try again when Grading Studio gets a new version.'
            : 'An update to how your work is saved didn’t finish, so everything was put back exactly as it was. Nothing is lost.';
        } catch (e2) { console.error(e2); info.note = 'An update to how your work is saved didn’t finish, and neither did putting it back. A safety copy is kept: use Put back under Saving and carrying on this page.'; }
        return;
      }
    }
    endTry();
    if (p.id) await markCopy(p.id, 'done');
  }
  function boot(start) {
    let pending = false;
    try { pending = MIGRATIONS.some(s => s.to > version()); if (version() > DATA_V) info.note = 'A newer copy of Grading Studio last saved your work in this browser. Your work is safe, but please open the newest copy to keep working on it.'; } catch {}
    if (!pending) { endTry(); return start(); }
    const el = document.getElementById('bootNote'), say = t => { if (el) { el.textContent = t; el.hidden = false; } };
    let stop; const stopP = new Promise((_, rej) => { stop = rej; }); stopP.catch(() => {});
    say('Updating how your work is saved. One moment…');
    let t = setTimeout(() => say('Another Grading Studio tab is updating your work. Look in that tab, or close it, and this one will carry on.'), STUCK_MS);   // only one tab at a time gets past the lock
    const run = () => {
      clearTimeout(t); say('Updating how your work is saved. One moment…');
      t = setTimeout(() => {
        say('This is taking longer than it should. You can keep waiting, or stop the update: your work goes back exactly as it was, and you can carry on.');
        const b = document.createElement('button'); b.className = 'btn sm'; b.id = 'bootStop'; b.textContent = 'Stop and put my work back';
        b.onclick = () => { b.disabled = true; b.textContent = 'Putting your work back…'; stopped = true; stop(new Error('Stopped')); };
        if (el) el.append(' ', b);
      }, STUCK_MS);
      return migrate(stopP);
    };
    const done = () => { clearTimeout(t); if (el) { el.textContent = ''; el.hidden = true; } start(); };
    (navigator.locks ? navigator.locks.request('gs-migrate', run) : run()).then(done, e => { console.error(e); done(); });
  }
  return { APP_VERSION, DATA_V, info, version, boot, snapshot, snapshots, readCopy, putBack, putBackData, forget };
})();
