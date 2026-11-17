// One writer. The new app holds the browser lock "gs-writer" alone (exclusive); every page of the current app holds a share of it
// (src/lock.js). So the new app writes only when no other window of either version is open, and a window that can't get the lock
// opens read-only: the layer refuses every write, and the shell says why in plain words.
//
// - The answer is asked for at once (ifAvailable) and never waited out: granted means this window writes, not granted means it
//   doesn't. Only a browser with no Locks API, or one where asking throws, is let through, and then a BroadcastChannel stands in.
// - A window that didn't get the lock stays in line. When the holder closes, it is told (onWriter) and must read everything again
//   from storage before it writes, so it never saves an old copy over newer work.
// - takeOver() takes the lock from the windows that have it. The current app's pages then cover themselves and wait.
// This is an interim: before the switch the new app speaks the current app's multi-window protocol instead (next/docs/engines.md).
// No DOM is used here.
export const LOCK = 'gs-writer';
let state = 'not-asked', why = '', release = null;
const told = new Set();
const tell = () => { for (const f of told) try { f(state); } catch (e) { console.error(e); } };
const set = (s, w = '') => { state = s; why = w; tell(); };

export class ReadOnly extends Error {
  constructor(what) { super('This window only shows saved work, so ' + what + ' was not changed. ' + (why || 'Another window is working with it.')); this.name = 'ReadOnly'; }
}
export const lockState = () => ({ state, why });
export const isWriter = () => state === 'writer' || state === 'writer-no-locks';
export function mayWrite(what) { if (!isWriter()) throw new ReadOnly(what); }
// f(state) on every change: 'writer', 'writer-no-locks', 'read-only', 'taken' (another window took over).
export function onLockChange(f) { told.add(f); return () => told.delete(f); }

const hold = () => new Promise(r => { release = r; });
// Asks once. Resolves to the state.
export async function start() {
  if (state !== 'not-asked') return state;
  const L = typeof navigator !== 'undefined' && navigator.locks;
  if (!L || typeof L.request !== 'function') return channelStart();
  set('asking');
  try {
    const got = await new Promise((res, rej) => {
      L.request(LOCK, { mode: 'exclusive', ifAvailable: true }, lock => { res(!!lock); return lock ? hold() : null; })
        .catch(e => { if (e && e.name === 'AbortError') set('taken', 'Another window took over.'); else rej(e); });
    });
    if (got) { set('writer'); return state; }
    set('read-only', 'Grading Studio is open in another window.');
    wait(L);
  } catch { return channelStart(); }
  return state;
}
// In line: the lock comes when every other window has closed. The holder is told it is now the writer.
function wait(L) {
  L.request(LOCK, { mode: 'exclusive' }, () => { set('writer'); return hold(); })
    .catch(e => { if (e && e.name === 'AbortError') set('taken', 'Another window took over.'); });
}
// Takes the lock from every window that has it.
export async function takeOver() {
  const L = navigator.locks; if (!L) return state;
  await new Promise(res => {
    L.request(LOCK, { mode: 'exclusive', steal: true }, () => { set('writer'); res(); return hold(); }).catch(() => res());
  });
  return state;
}
// For tests and for closing cleanly: lets the lock go.
export function stop() { if (release) { release(); release = null; } set('not-asked'); }

// No Locks API: windows ask each other on a BroadcastChannel, and the current app's pages answer too (src/lock.js). Racy where
// two open in the same moment, which the merge between windows covers for the current app; it is only for old browsers.
function channelStart() {
  if (typeof BroadcastChannel === 'undefined') { set('writer-no-locks', 'This browser can’t tell windows apart.'); return state; }
  const ch = new BroadcastChannel(LOCK), me = Math.random().toString(36).slice(2);
  let heard = false;
  ch.onmessage = e => {
    const d = e.data || {};
    if (d.ask && d.from !== me && isWriter()) ch.postMessage({ here: true, from: me });
    if (d.here && d.from !== me) heard = true;
  };
  ch.postMessage({ ask: true, from: me });
  return new Promise(r => setTimeout(() => { set(heard ? 'read-only' : 'writer-no-locks', heard ? 'Grading Studio is open in another window.' : ''); r(state); }, 300));
}
