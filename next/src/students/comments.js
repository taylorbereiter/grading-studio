// Her saved comments (the current app's comment bank, gs.bank): a list of strings, newest first, shared by the comment box, margin
// comments and Settings > Marking. Read here; changed only through write.js saveSetting, each change one undo step. No names or scores.
import { commentBank } from './index.js';
import { saveSetting } from './write.js';
import * as undo from '../services/undo.js';
import { rebaseList } from '../shared/rebase.js';

const tidy = a => (Array.isArray(a) ? a.filter(c => typeof c === 'string' && c.trim()) : []);
export const readBank = async () => tidy(commentBank.json([]));
// change(list) returns the new list; label is what the undo step says
export function changeBank(label, change) {
  const before = tidy(commentBank.json([])), after = tidy(change(before.slice()));
  if (JSON.stringify(after) === JSON.stringify(before)) return before;
  saveSetting('gs.bank', after);
  // undo and redo change the list as it is then, so comments that came in between (a sync, another tab) stay (audit H-012)
  const step = (from, to) => () => saveSetting('gs.bank', rebaseList(tidy(commentBank.json([])), from, to, { first: true }));
  undo.record({ label, undo: step(after, before), redo: step(before, after) });
  return after;
}
export const addToBank = async (c, label) => changeBank(label, l => (l.includes(c) ? l : [c, ...l]));
