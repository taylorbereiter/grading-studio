// IndexedDB the way the new app may touch the current app's databases.
//
// The rules, each of which protects saved work:
// - Open with no version, and abort any upgrade. A database that isn't there yet reads as empty, and is never made by a read.
// - The first write to a database this browser doesn't have makes it exactly as the current app would (ensure below): the same
//   version and the same stores, so the current app opens it later with no upgrade. A database that is there at an older version is
//   never upgraded here: that is the current app's to do, and a write to a store it hasn't got yet refuses.
// - Never hold a connection: the current app deletes and upgrades databases (src/school.js, src/examples.js, src/takehome.js), and
//   an open connection would block it. Each call opens, does one transaction, and closes; and a request to upgrade closes at once.
// - Values pass through untouched: what is read is what the current app wrote, and what is written is stored as given.
// No DOM is used here.
import { mayWrite } from './lock.js';

export class NotThere extends Error { constructor(what) { super(what + ' could not be made in this browser.'); this.name = 'NotThere'; } }

export function openExistingStrict(name) {
  return new Promise((res, rej) => {
    const r = indexedDB.open(name);
    let made = false;
    let blocked = false;
    r.onupgradeneeded = () => { made = true; r.transaction.abort(); };   // it was not there: leave it not there
    r.onsuccess = () => { const db = r.result; if (blocked) return db.close(); db.onversionchange = () => db.close(); res(db); };
    r.onerror = e => { if (made) { e.preventDefault(); res(null); } else rej(r.error); };
    r.onblocked = () => { blocked = true; rej(new Error('Database blocked: ' + name)); };
  });
}
export const openExisting = name => openExistingStrict(name).catch(() => null);
// The current app's databases as it makes them (src/app/kept.js keepDb and addDb, src/examples.js, src/video.js vkDb, src/migrate.js,
// src/school.js schDb, src/planner/lessons.js, src/folder.js folderKv, src/app/readings.js): version, and each store with its keyPath
// (null: keys given with each record). next/test/keys.test.js checks this against shared/keys.js DATABASES and the current app's source.
export const SHAPES = {
  'grading-studio-keep': [2, { papers: null, work: null, meta: null, edits: null }],
  'grading-studio-added': [1, { files: null }],
  'grading-studio-examples': [1, { ex: null, pix: null }],
  'grading-studio-videos': [1, { v: null }],
  'grading-studio-safety': [1, { meta: null, data: null }],
  'grading-studio-school': [1, { files: null }],
  'gs-lessons': [1, { lessons: 'id', kv: null }],
  'grading-studio-folder': [1, { kv: null }],
  'grading-studio-models': [1, { files: null }],
};
// Makes a database this browser doesn't have yet, as the current app would. Resolves true when it is there now (made here, or
// already there), false when it can't be (an older version is there: the current app moves it on).
export function ensure(name) {
  const shape = SHAPES[name]; if (!shape) return Promise.resolve(false);
  return new Promise(res => {
    let r; try { r = indexedDB.open(name, shape[0]); } catch { return res(false); }
    let aborted = false;
    r.onupgradeneeded = e => {
      if (e.oldVersion !== 0) { aborted = true; r.transaction.abort(); return; }   // there at an older version: never upgraded here
      for (const [st, keyPath] of Object.entries(shape[1])) r.result.createObjectStore(st, keyPath ? { keyPath } : undefined);
    };
    r.onsuccess = () => { r.result.close(); res(true); };
    r.onerror = e => { if (aborted) e.preventDefault(); res(false); };
    r.onblocked = () => res(false);
  });
}
const done = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')); });

async function withStore(dbName, store, mode, fn) {
  let db = await openExisting(dbName);
  if (!db && mode === 'readwrite' && await ensure(dbName)) db = await openExisting(dbName);
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
// One write over several stores of one database, as one transaction (src/examples.js exPut writes a record and its pictures
// together): fn gets { store name: object store }.
export async function writeMany(dbName, stores, fn) {
  for (const st of stores) mayWrite(dbName + '/' + st);
  let db = await openExisting(dbName);
  if (!db && await ensure(dbName)) db = await openExisting(dbName);
  if (!db) throw new NotThere(dbName);
  try {
    for (const st of stores) if (!db.objectStoreNames.contains(st)) throw new NotThere(dbName + '/' + st);
    const tx = db.transaction(stores, 'readwrite'), o = Object.fromEntries(stores.map(st => [st, tx.objectStore(st)]));
    fn(o); await done(tx);
  } finally { db.close(); }
}
// One read-only transaction on a store, for engines lifted from the current app that read a store their own way (kept.js kdo):
// fn gets the object store and returns a request (its result is returned) or a value.
export const readStore = (dbName, store, fn) => withStore(dbName, store, 'readonly', fn);
