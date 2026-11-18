// One undo for the whole app. A screen records each change it makes as { label, undo, redo }; Ctrl/Cmd+Z and the toast's Undo
// take back the newest. Later stages plug today's rules into it:
//   fieldSnap (src/app: batch, student or file state on the marking screen) -> snapshot() before the change
//   gradeSnap (a score)                                                    -> snapshot() with the score's own get/set
//   libTrack (any change to the library, gs.lib)                           -> track(): one entry per saved change, grouped
// Nothing here saves: undo and redo call back into the screen, which saves through the saved-work layer as it always does.
const past = [], future = [], told = new Set();
const LIMIT = 100;
const tell = () => told.forEach(f => f(state()));
export const state = () => ({ canUndo: past.length > 0, canRedo: future.length > 0, next: past.length ? past[past.length - 1].label : '', again: future.length ? future[future.length - 1].label : '' });
export function onUndoChange(f) { told.add(f); return () => told.delete(f); }
// label: a line already translated ("Score changed"), shown in the toast and the command bar.
export function record({ label, undo, redo, group }) {
  const top = past[past.length - 1];
  if (group && top && top.group === group && Date.now() - top.at < 800) { top.redo = redo || top.redo; top.at = Date.now(); tell(); return top; }   // typing in one box is one step
  const e = { label, undo, redo, group, at: Date.now() };
  past.push(e); if (past.length > LIMIT) past.shift();
  future.length = 0; tell(); return e;
}
const copy = v => (v === undefined ? undefined : typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
// Take a copy before a change; call the returned function after it to record the step. get/set read and write the thing changed.
export function snapshot(label, get, set, group) {
  const before = copy(get());
  return () => { const after = copy(get()); if (JSON.stringify(after) === JSON.stringify(before)) return null; return record({ label, group, undo: () => set(copy(before)), redo: () => set(copy(after)) }); };
}
// The same for a change made in one go: track(label, get, set, () => change()).
export function track(label, get, set, change, group) { const done = snapshot(label, get, set, group); change(); return done(); }
export function undo() { const e = past.pop(); if (!e) return null; e.undo(); if (e.redo) future.push(e); tell(); return e; }
export function redo() { const e = future.pop(); if (!e) return null; e.redo(); past.push(e); tell(); return e; }
// Where the steps no longer apply (the thing was replaced from outside, as libUndoForget does today).
// One step taken out again because what it recorded came to nothing (a text box closed empty, as the current app pops it).
export function drop(e) { const i = past.lastIndexOf(e); if (i >= 0) { past.splice(i, 1); tell(); } }
export function forget() { past.length = 0; future.length = 0; tell(); }
