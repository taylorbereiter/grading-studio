// The marking screen beside other windows (src/saving.js tabsLook, tabsCatchUp, tabLetGo, tabFinishUp), for windows of the new app
// and of the current app alike:
// - another window saved this download: when she comes back to this window, what is waiting here is saved first (merged in, never
//   over the other's work, students/write.js saveWork), then the download opens again from storage on the student she was on;
// - another window forgot it: it closes here too;
// - another window is about to replace everything: what is half typed or waiting is saved now, so it is counted in.
import * as tabs from '../../shared/tabs.js';
import { newestWork } from '../../students/index.js';

let M = null;
const merge = () => (M ? Promise.resolve(M) : import('../../engines/merge.js').then(m => (M = m)));

// hooks: { batch() the open download, save() resolves when everything waiting is saved, reopen(key) open it again on that student,
// forgotten() close it }. Returns the function that stops listening.
export function watchWindows(hooks) {
  let busy = false;
  const behind = async b => {
    if (b.behind) return true;
    const st = tabs.savedStamp(b.id); if (!st || st === b.seen) return false;
    const other = await newestWork(b.id); if (!other) return false;
    if ((await merge()).tabDiffers(b.revs, other)) { b.behind = true; return true; }
    b.seen = st; return false;
  };
  const catchUp = async () => {
    const b = hooks.batch(); if (!b || !b.revs || b.reopening || busy || document.hidden || !tabs.live()) return;
    if (tabs.forgotSince(b.id, b.opened)) return hooks.forgotten();
    busy = true;
    try {
      if (!(await behind(b))) return;
      await hooks.save();
      if (hooks.batch() !== b) return;
      b.reopening = true;   // once: this copy is done with, the download opens anew from storage
      hooks.reopen(b.students[hooks.cur()] && b.students[hooks.cur()].key);
    } catch (e) { console.error(e); } finally { busy = false; }
  };
  const offs = [
    tabs.on('saved', id => { const b = hooks.batch(); if (b && b.id === id && b.revs) behind(b).catch(e => console.error(e)); }),   // noted; its next save merges, and coming back reopens
    tabs.on('forgot', id => { const b = hooks.batch(); if (b && b.id === id && tabs.forgotSince(id, b.opened)) hooks.forgotten(); }),
    tabs.on('finish', () => hooks.save()),
  ];
  const vis = () => { if (!document.hidden) catchUp(); };
  window.addEventListener('focus', catchUp); document.addEventListener('visibilitychange', vis);
  return () => { offs.forEach(f => f()); window.removeEventListener('focus', catchUp); document.removeEventListener('visibilitychange', vis); };
}
