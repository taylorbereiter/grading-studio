// The notes windows leave each other (the current app's src/saving.js), as the new app keeps them. With the one-writer lock
// (lock.js) no current-app window writes while the new app does, so these only keep the notes the same as a current-app window
// would leave them; stage 6 replaces the lock with the full protocol here and in lock.js, and nowhere else.
//   gsc.saved.<id>  which window saved this download last: "<window>:<time>", then "<window>:<time>:full" once the full copy is in
//   gsc.over        changes when a window replaces everything; a window that sees it change stops writing
//   gsc.dev         this browser's own id, for the merge stamps
import { text, setText } from './ls.js';

export const TAB = (() => { try { return crypto.getRandomValues(new Uint32Array(1))[0].toString(36); } catch { return Math.random().toString(36).slice(2, 8); } })();
const overAtStart = text('gsc.over');
// false once another window has started replacing everything: from then on this window writes nothing.
export const live = () => text('gsc.over') === overAtStart;
export function stamp(id, t) { const v = TAB + ':' + t; try { setText('gsc.saved.' + id, v); return v; } catch { return text('gsc.saved.' + id); } }
// This browser's id (src/folder.js devId): made the first time it is needed, kept outside gs.* so no copy of the work carries it.
export function devId() {
  let d = text('gsc.dev');
  if (!d) { d = 'd' + crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 12); try { setText('gsc.dev', d); } catch {} }
  return d;
}
