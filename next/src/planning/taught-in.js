import { taughtIn } from './index.js';
import { check } from './write.js';
import { saved } from '../shared/saved.js';

// key "<lesson id>|<class id>|<date>", note { slide, of, x (the note), t }. MAY HOLD NAMES.
export function saveTaughtNote(key, note) {
  check('gsp.taughtIn');
  const o = readTaughtNotes();
  o.items = { ...o.items, [key]: note };
  taughtIn.setJson(o);
  saved({ kind: 'pref', id: 'gsp.taughtIn', side: 'planning' });
}
// A missing key is an empty inbox. Errors reading or decoding an existing inbox
// must propagate before any write, including the acknowledgement after a fold.
export function readTaughtNotes() {
  const raw = localStorage.getItem(taughtIn.key);
  if (raw === null) return { items: {} };
  const inbox = JSON.parse(raw);
  if (!inbox || !inbox.items || typeof inbox.items !== 'object' || Array.isArray(inbox.items)) throw new Error('Unreadable after-class notes');
  return inbox;
}
// Phone notes put on their lessons (planning/taught-fold.js): each marked f: 1, read again first, so one that came meanwhile stays.
export function foldedTaught(done) {
  check('gsp.taughtIn');
  const o = readTaughtNotes();
  let changed = false;
  for (const [k, t] of done) if (o.items[k] && !o.items[k].f && o.items[k].t === t) {
    o.items[k] = { ...o.items[k], f: 1 };
    changed = true;
  }
  if (!changed) return;
  taughtIn.setJson(o);
  saved({ kind: 'pref', id: 'gsp.taughtIn', side: 'planning' });
}
