// Planner edits that must preserve a concurrent change use an IndexedDB read and put in
// one transaction. An absent key has value undefined. An open/read failure rejects.
import { openExistingStrict, ensure, NotThere } from '../shared/idb.js';
import { check } from './write.js';

const dbName = 'gs-lessons';
async function record(store, key, edit) {
  if (edit) check(dbName + '/' + store);
  let db = await openExistingStrict(dbName);
  if (!db) {
    if (!edit) return undefined;
    if (await ensure(dbName)) db = await openExistingStrict(dbName);
    if (!db) throw new NotThere(dbName);
  }
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, edit ? 'readwrite' : 'readonly');
      const objects = tx.objectStore(store), read = objects.get(key);
      let result, failure;
      read.onsuccess = () => {
        try {
          if (!edit) { result = read.result; return; }
          check(dbName + '/' + store);
          result = edit(read.result, objects);
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
// edit(value, objectStore) may queue companion records in the same transaction. Return the new value, or undefined to leave it alone.
export const changePlannerRecord = (store, key, edit) => record(store, key, edit);
