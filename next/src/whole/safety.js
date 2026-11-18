// Safety copies (src/migrate.js gsData.snapshot, snapshots, readCopy, putBack, putBackData, forget): a few whole copies of her
// work kept inside this browser, made before anything risky (bringing work in, going back in time, a new year), to put back. Each is
// every gs.* setting and the stores below, never the papers (large, and they never change). The same database and records as the
// current app (grading-studio-safety: meta, and data as "id" plus slices "id|0", "id|1"…), so either app puts back the other's.
// Putting one back replaces everything at once: the caller has every other window stop first (shared/tabs.js), as the current app does.
import { DATA_V } from '../students/write.js';
import { json as lsJson } from '../shared/ls.js';

const SAFETY_DB = 'grading-studio-safety', SNAP_KEEP = 3, KEEP_DB = 'grading-studio-keep', SLICE_MAX = 32e6;
const STORES = [[KEEP_DB, 'work'], [KEEP_DB, 'meta'], [KEEP_DB, 'edits'], ['grading-studio-added', 'files'], ['grading-studio-examples', 'ex'], ['grading-studio-examples', 'pix']];
const APP = 'new app';   // which app made the copy (the current app writes its version number here)
export const version = () => { const v = +lsJson('gs.dataV', 0); return v >= 1 ? v : 1; };
const lsKeys = pre => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) o.push(k); } return o; };
// Opens a database only if it's already there.
const openOld = name => new Promise(res => { const r = indexedDB.open(name); r.onupgradeneeded = () => r.transaction.abort(); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
const readAll = (db, name) => new Promise((res, rej) => { const tx = db.transaction(name), o = tx.objectStore(name), a = o.getAll(), b = o.getAllKeys(); tx.oncomplete = () => res({ k: b.result, v: a.result }); tx.onerror = tx.onabort = () => rej(tx.error); });
const keysOf = (db, name) => new Promise((res, rej) => { const q = db.transaction(name).objectStore(name).getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
const writeAll = (db, name, fn) => new Promise((res, rej) => { const tx = db.transaction(name, 'readwrite'); fn(tx.objectStore(name)); tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
async function withDb(name, fn) { const db = await openOld(name); if (!db) return null; try { return await fn(db); } finally { db.close(); } }
const safetyDb = () => new Promise((res, rej) => { const r = indexedDB.open(SAFETY_DB, 1); r.onupgradeneeded = () => { r.result.createObjectStore('meta'); r.result.createObjectStore('data'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
// A browser refuses one record over about 130 MB, so the stores go in slices of at most SLICE_MAX.
const sizeOf = v => !v || typeof v !== 'object' ? (typeof v === 'string' ? v.length * 2 : 8) : ArrayBuffer.isView(v) ? v.buffer.byteLength : v instanceof ArrayBuffer ? v.byteLength : Object.values(v).reduce((n, x) => n + sizeOf(x), 16);
function sliced(stores) {
  const out = [];
  for (const [where, s] of Object.entries(stores)) {
    let p = null, n = 0;
    s.k.forEach((k, i) => { const z = sizeOf(s.v[i]); if (!p || n + z > SLICE_MAX) { out.push(p = { where, k: [], v: [] }); n = 0; } p.k.push(k); p.v.push(s.v[i]); n += z; });
  }
  return out;
}
const slicesOf = id => IDBKeyRange.bound(id + '|', id + '|￿');
const inCopies = (db, fn) => new Promise((res, rej) => {
  const tx = db.transaction(['meta', 'data'], 'readwrite');
  tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error);
  try { fn(tx.objectStore('meta'), tx.objectStore('data')); } catch (e) { rej(e); try { tx.abort(); } catch {} }
});
const dropCopy = (meta, data, id) => { meta.delete(id); data.delete(id); data.delete(slicesOf(id)); };
// why: shown in the list ("Before bringing work in"). Only the newest three are kept. Null in a browser with nothing to keep.
export async function snapshot(why, toV = version()) {
  const ls = {}; for (const k of lsKeys('gs.')) ls[k] = localStorage.getItem(k);
  const stores = {};
  for (const [dbName, name] of STORES) await withDb(dbName, async db => { if (db.objectStoreNames.contains(name)) stores[dbName + '/' + name] = await readAll(db, name); });
  if (!Object.keys(ls).length && !Object.values(stores).some(s => s.k.length)) return null;
  const t = Date.now(), id = t + '-' + Math.random().toString(36).slice(2, 6), m = { id, t, why, app: APP, fromV: version(), toV };
  const db = await safetyDb();
  try {
    await inCopies(db, (meta, data) => { data.put({ ls }, id); sliced(stores).forEach((p, i) => data.put(p, id + '|' + i)); meta.put(m, id); });
    const old = (await readAll(db, 'meta')).v.sort((a, b) => b.t - a.t).slice(SNAP_KEEP);
    if (old.length) await inCopies(db, (meta, data) => { for (const c of old) dropCopy(meta, data, c.id); });
  } finally { db.close(); }
  return m;
}
export const snapshots = () => withDb(SAFETY_DB, async db => db.objectStoreNames.contains('meta') ? (await readAll(db, 'meta')).v.sort((a, b) => b.t - a.t) : []).then(l => l || []);
export const readCopy = id => withDb(SAFETY_DB, db => new Promise((res, rej) => {
  const tx = db.transaction('data'), o = tx.objectStore('data'), a = o.get(id), b = o.getAll(slicesOf(id));
  tx.onerror = tx.onabort = () => rej(tx.error);
  tx.oncomplete = () => {
    if (!a.result) return res(null);
    const stores = {};
    for (const p of b.result) { const s = stores[p.where] ||= { k: [], v: [] }; s.k = s.k.concat(p.k); s.v = s.v.concat(p.v); }
    res({ ls: a.result.ls, stores });
  };
}));
// Everything a copy holds goes back exactly as it was, and anything added since goes. Papers aren't in a copy and stay, so a
// download opened since keeps its row, with no marks.
export async function putBackData(rec) {
  const was = await withDb(KEEP_DB, db => db.objectStoreNames.contains('meta') ? readAll(db, 'meta') : null);
  for (const k of lsKeys('gs.')) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(rec.ls)) localStorage.setItem(k, v);
  for (const [dbName, name] of STORES) {
    const s = rec.stores[dbName + '/' + name] || { k: [], v: [] };
    await withDb(dbName, db => db.objectStoreNames.contains(name) ? writeAll(db, name, o => { o.clear(); s.k.forEach((k, i) => o.put(s.v[i], k)); }) : null);
  }
  await withDb(KEEP_DB, async db => {
    if (!db.objectStoreNames.contains('papers') || !db.objectStoreNames.contains('meta')) return;
    const papers = (await keysOf(db, 'papers')).filter(k => !String(k).includes('|')), now = await readAll(db, 'meta');
    await writeAll(db, 'meta', o => {
      now.k.forEach((k, i) => { if (now.v[i].papers && !papers.includes(k)) o.put({ ...now.v[i], papers: false }, k); });
      for (const k of papers) if (!now.k.includes(k)) { const row = was && was.v[was.k.indexOf(k)]; o.put({ ...(row || { id: k, name: 'A download', n: 0, t: Date.now() }), scored: 0, papers: true }, k); }
    });
  });
}
// Put back: how things are now is kept first, so a wrong click can be undone too.
export async function putBack(id) {
  const rec = await readCopy(id);
  if (!rec) throw new Error('That safety copy is gone');
  await snapshot('Before putting back an earlier safety copy');
  await putBackData(rec);
}
// Forget means gone: a forgotten download comes out of every safety copy too.
export const forget = id => withDb(SAFETY_DB, db => !db.objectStoreNames.contains('data') ? null : new Promise((res, rej) => {
  const tx = db.transaction('data', 'readwrite'), c = tx.objectStore('data').openCursor(), mine = k => k === id || String(k).startsWith(id + '|');
  tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error);
  c.onsuccess = () => {
    const x = c.result; if (!x) return;
    const r = x.value;
    if (r.ls) {
      for (const k of Object.keys(r.ls)) if (k.includes(id)) delete r.ls[k];
      if (r.ls['gs.batches']) { try { const b = JSON.parse(r.ls['gs.batches']); delete b[id]; r.ls['gs.batches'] = JSON.stringify(b); } catch {} }
      x.update(r);
    } else if (r.k.some(mine)) { const on = r.k.map(k => !mine(k)); x.update({ where: r.where, k: r.k.filter((_, i) => on[i]), v: r.v.filter((_, i) => on[i]) }); }
    x.continue();
  };
}));
export { DATA_V };
