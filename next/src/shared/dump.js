// Everything this address keeps, read through the layer: every localStorage key, and every record of every database in the
// registry. Used by the saved-work proof (test/tools/saved-work.js) to show the layer reads back exactly what the current app
// wrote, and that a name the registry doesn't know is never kept. Reads only.
import { DATABASES, LOCAL, entryFor } from './keys.js';
import * as idb from './idb.js';
import * as ls from './ls.js';

export async function dumpRaw() {
  const out = { ls: {}, unknown: [], dbs: {}, idb: {} };
  for (const k of ls.allKeys()) { out.ls[k] = ls.text(k); if (!entryFor(k, LOCAL)) out.unknown.push('localStorage:' + k); }
  for (const name of Object.keys(DATABASES).sort()) {
    const d = await idb.describe(name); if (!d) continue;
    out.dbs[name] = d;
    for (const s of d.stores) {
      if (!DATABASES[name].stores[s]) { out.unknown.push(name + '/' + s); continue; }
      for (const [k, v] of await idb.entries(name, s)) out.idb[name + '/' + s + '/' + (typeof k === 'string' ? k : JSON.stringify(k))] = v;
    }
  }
  if (indexedDB.databases) for (const d of await indexedDB.databases()) if (!DATABASES[d.name] && !/^sample-/.test(d.name)) out.unknown.push('(database) ' + d.name);
  return out;
}
