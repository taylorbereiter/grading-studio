// IndexedDB the way the new app may touch the current app's databases.
//
// The rules, each of which protects saved work:
// - Open with no version, and abort any upgrade. A database that isn't there yet stays not there: making it here (at version 1,
//   with no stores) would stop the current app's own upgrade code from ever making its stores, and opening at a higher version
//   would make the current app's open(name, n) fail. So a database that is missing reads as empty, and a write to it refuses.
// - Never hold a connection: the current app deletes and upgrades databases (src/school.js, src/examples.js, src/takehome.js), and
//   an open connection would block it. Each call opens, does one transaction, and closes; and a request to upgrade closes at once.
// - Values pass through untouched: what is read is what the current app wrote, and what is written is stored as given.
// No DOM is used here.
import { mayWrite } from './lock.js';

export class NotThere extends Error { constructor(what) { super(what + ' is not in this browser yet. The current app makes it the first time it needs it.'); this.name = 'NotThere'; } }

export function openExisting(name) {
  return new Promise(res => {
    let r; try { r = indexedDB.open(name); } catch { return res(null); }
    let made = false;
    r.onupgradeneeded = () => { made = true; r.transaction.abort(); };   // it was not there: leave it not there
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => db.close(); res(db); };
    r.onerror = e => { if (made) e.preventDefault(); res(null); };
    r.onblocked = () => res(null);
  });
}
const done = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')); });

async function withStore(dbName, store, mode, fn) {
  const db = await openExisting(dbName);
  if (!db) { if (mode === 'readwrite') throw new NotThere(dbName); return undefined; }
  try {
    if (!db.objectStoreNames.contains(store)) { if (mode === 'readwrite') throw new NotThere(dbName + '/' + store); return undefined; }
    const tx = db.transaction(store, mode), out = fn(tx.objectStore(store));
    await done(tx);
    return out && 'result' in out ? out.result : out;
  } finally { db.close(); }
}

// The version and stores of a database as it is in this browser, or null if it isn't.
export async function describe(dbName) {
  const db = await openExisting(dbName); if (!db) return null;
  try { return { version: db.version, stores: [...db.objectStoreNames].sort() }; } finally { db.close(); }
}
export const get = (dbName, store, key) => withStore(dbName, store, 'readonly', o => o.get(key));
export const keys = async (dbName, store, range) => (await withStore(dbName, store, 'readonly', o => o.getAllKeys(range))) || [];
// Every record, as [key, value] pairs in key order.
export async function entries(dbName, store, range) {
  let k, v;
  await withStore(dbName, store, 'readonly', o => { k = o.getAllKeys(range); v = o.getAll(range); });
  return k ? k.result.map((x, i) => [x, v.result[i]]) : [];
}
// key is left out for a store that keys records by one of their fields (gs-lessons/lessons).
export async function put(dbName, store, value, key) {
  mayWrite(dbName + '/' + store);
  await withStore(dbName, store, 'readwrite', o => (o.keyPath == null ? o.put(value, key) : o.put(value)));
}
export async function del(dbName, store, key) {
  mayWrite(dbName + '/' + store);
  await withStore(dbName, store, 'readwrite', o => o.delete(key));
}
// One read-only transaction on a store, for engines lifted from the current app that read a store their own way (kept.js kdo):
// fn gets the object store and returns a request (its result is returned) or a value.
export const readStore = (dbName, store, fn) => withStore(dbName, store, 'readonly', fn);
