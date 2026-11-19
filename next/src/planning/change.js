// Planner edits that must preserve a concurrent change use an IndexedDB read and put in
// one transaction. An absent key has value undefined. An open/read failure rejects.
import { openExistingStrict, ensure, NotThere } from '../shared/idb.js';
import { check } from './write.js';

const dbName = 'gs-lessons';
async function record(store, key, edit, companion) {
  if (edit) check(dbName + '/' + store);
  let db = await openExistingStrict(dbName);
  if (!db) {
    if (!edit) return undefined;
    if (await ensure(dbName)) db = await openExistingStrict(dbName);
    if (!db) throw new NotThere(dbName);
  }
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(companion ? [store, companion] : store, edit ? 'readwrite' : 'readonly');
      const objects = tx.objectStore(store), read = objects.get(key);
      let result, failure;
      read.onsuccess = () => {
        try {
          if (!edit) { result = read.result; return; }
          check(dbName + '/' + store);
          if (companion) check(dbName + '/' + companion);
          result = edit(read.result, objects, companion && tx.objectStore(companion));
          if (result !== undefined) {
            if (objects.keyPath == null) objects.put(result, key);
            else objects.put(result);
          }
        } catch (e) { failure = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('Planner transaction aborted'));
    });
  } finally { db.close(); }
}
export const readPlannerRecord = (store, key) => record(store, key);
// The edit may queue dependent records in this store or the named companion store.
// Return the new value, or undefined to leave the main record alone.
export const changePlannerRecord = (store, key, edit, companion) => record(store, key, edit, companion);

export async function readPlannerValues(store) {
  const db = await openExistingStrict(dbName);
  if (!db) return [];
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const objects = tx.objectStore(store);
      const request = objects.getAll();
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error('Planner collection read aborted'));
    });
  } finally { db.close(); }
}
