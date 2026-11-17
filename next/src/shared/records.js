// Small builders for the typed accessors in students/ and planning/: one IndexedDB store, one localStorage key, or a family of
// keys under one prefix. Each checks its name against the registry (keys.js) so an accessor can't be made for a name the
// registry doesn't know, or on the wrong side of the wall.
import * as idb from './idb.js';
import * as ls from './ls.js';
import { DATABASES, LOCAL, entryFor } from './keys.js';

function sideOf(side, name, have) { if (have !== side) throw new Error(name + ' is on the ' + have + ' side, not ' + side); }

export function idbStore(side, db, store) {
  const d = DATABASES[db]; if (!d || !d.stores[store]) throw new Error('Not in the registry: ' + db + '/' + store);
  sideOf(side, db, d.side);
  return {
    db, store,
    get: k => idb.get(db, store, k),
    keys: range => idb.keys(db, store, range),
    entries: range => idb.entries(db, store, range),
    put: (v, k) => idb.put(db, store, v, k),
    del: k => idb.del(db, store, k),
  };
}
export function localKey(side, key) {
  const e = entryFor(key, LOCAL); if (!e || e[0] !== key) throw new Error('Not in the registry: ' + key);
  sideOf(side, key, e[1]);
  return {
    key,
    text: () => ls.text(key), json: (fb = null) => ls.json(key, fb),
    setText: v => ls.setText(key, v), setJson: v => ls.setJson(key, v), remove: () => ls.remove(key),
  };
}
export function localFamily(side, pre) {
  const e = entryFor(pre, LOCAL); if (!e || e[0] !== pre || !pre.endsWith('.')) throw new Error('Not a prefix in the registry: ' + pre);
  sideOf(side, pre, e[1]);
  return {
    prefix: pre,
    ids: () => ls.keysStarting(pre).map(k => k.slice(pre.length)),
    text: id => ls.text(pre + id), json: (id, fb = null) => ls.json(pre + id, fb),
    setText: (id, v) => ls.setText(pre + id, v), setJson: (id, v) => ls.setJson(pre + id, v), remove: id => ls.remove(pre + id),
  };
}
