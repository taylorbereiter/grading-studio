// A setting that travels with the work (whole/folder.js carryLs), as it comes in from the Drive sync file or a linked folder: put
// in as the text it came as (src/saving.js lsPut), and said, so screens reading it draw again and it isn't sent back as news.
import { entryFor, LOCAL } from '../shared/keys.js';
import { setText, remove } from '../shared/ls.js';
import { saved } from '../shared/saved.js';

export function takeLs(k, v, from = 'sync') {
  try { if (v == null) remove(k); else setText(k, v); } catch (e) { if (e && e.name === 'ReadOnly') throw e; console.error(e); return false; }   // a full store: the next sync tries again
  const e = entryFor(k, LOCAL);
  saved({ kind: e && e[2] === 'work' ? 'setting' : 'pref', id: k, side: e ? e[1] : 'shared', from });
  return true;
}
