// What the grading engines call "store" (engines/gstore.js), on the students side: the current app's get/set over localStorage, but
// only for keys in the registry (shared/keys.js) that are this side's or shared, and writing only a screen setting ("pref") with the
// lock held. Saved work (gs.lib, gs.b.*, gs.setup…) is read here as the engines read it, and written only through write.js.
import { entryFor, toEntry } from '../shared/keys.js';
import * as ls from '../shared/ls.js';
import { readStore } from '../shared/idb.js';
import { mayWrite } from '../shared/lock.js';

const known = k => { const e = toEntry(entryFor(k)); return e && e.side !== 'planning' ? e : null; };
// The current app's kept.js kdo/kget/idbDo, read-only: the lifted openers read papers, edits and added files with them. A write refuses.
const KEEP = 'grading-studio-keep';
export function kdo(name, mode, fn) { if (mode !== 'readonly') { mayWrite(KEEP + '/' + name); throw new Error('Engines write through students/write.js'); } return readStore(KEEP, name, fn); }
export const kget = (name, k) => kdo(name, 'readonly', o => o.get(k)).catch(() => null);
export const idbDo = (mode, fn) => { if (mode !== 'readonly') throw new Error('Engines write through students/write.js'); return readStore('grading-studio-added', 'files', fn); };
export const prefs = {
  kdo, idbDo,
  get(k, d) { if (!known(k)) return d; const none = {}, v = ls.json(k, none); return v === none || v === undefined ? d : v; },
  set(k, v) { const e = known(k); if (!e || e.kind !== 'pref') return false; try { ls.setJson(k, v); return true; } catch { return false; } },
  del(k) { const e = known(k); if (e && e.kind === 'pref') try { ls.remove(k); } catch {} },
};
