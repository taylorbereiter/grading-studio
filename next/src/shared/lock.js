// Windows side by side. Every window of either version holds a share of the browser lock "gs-writer" (src/lock.js does the same
// for the current app's pages), so any number of windows of the new app and the current app are open and write together, and
// they keep each other's work by the current app's own protocol (shared/tabs.js, students/write.js saveWork): each window says
// what it saved, a window that finds another's save merges instead of writing over it, and a window replacing everything first
// asks the others to finish and then stops them.
//
// The lock is still asked for, in shared mode, so a page of an older new app that asks for it alone (stage 0's one-writer rule)
// waits instead of writing beside this one. The answer is asked for at once and never waited out; a browser with no Locks API, or
// one where asking throws, is let through, as the current app's pages are.
//
// The names stay what they were (start, isWriter, mayWrite, lockState, onLockChange), so nothing that calls them changes.
// No DOM is used here.
export const LOCK = 'gs-writer';
let state = 'not-asked', why = '';
const told = new Set();
const tell = () => { for (const f of told) try { f(state); } catch (e) { console.error(e); } };
const set = (s, w = '') => { state = s; why = w; tell(); };

export class ReadOnly extends Error {
  constructor(what) { super('This window only shows saved work, so ' + what + ' was not changed. ' + (why || 'Another window is working with it.')); this.name = 'ReadOnly'; }
}
export const lockState = () => ({ state, why });
// A window writes once its share is answered (main.js asks as the shell is drawn); the protocol, not the lock, keeps two windows'
// work apart.
export const isWriter = () => state === 'writer' || state === 'writer-no-locks';
export function mayWrite(what) { if (!isWriter()) throw new ReadOnly(what); }
// f(state) on every change: 'writer', 'writer-no-locks', 'read-only' (an older new-app window holds the lock alone), 'taken'.
export function onLockChange(f) { told.add(f); return () => told.delete(f); }

let release = null;
const hold = () => new Promise(r => { release = r; });
// Asks once. Resolves to the state.
export async function start() {
  if (state !== 'not-asked' && state !== 'stopped') return state;
  const L = typeof navigator !== 'undefined' && navigator.locks;
  if (!L || typeof L.request !== 'function') { set('writer-no-locks'); return state; }
  set('asking');
  try {
    const got = await new Promise((res, rej) => {
      L.request(LOCK, { mode: 'shared', ifAvailable: true }, lock => { res(!!lock); return lock ? hold() : null; })
        .catch(e => { if (e && e.name === 'AbortError') set('taken', 'Another window took over.'); else rej(e); });
    });
    if (got) { set('writer'); return state; }
    // only a window that holds it alone (an older version of the new app) can stop a share: wait for it to close
    set('read-only', 'Grading Studio is open in another window.');
    L.request(LOCK, { mode: 'shared' }, () => { set('writer'); return hold(); }).catch(() => {});
  } catch { set('writer-no-locks'); }
  return state;
}
// Kept for the proof page and older callers: with shares there is nothing to take over.
export async function takeOver() { if (state === 'not-asked') await start(); return state; }
// For tests and for closing cleanly: lets the lock go.
export function stop() { if (release) { release(); release = null; } set('not-asked'); }
