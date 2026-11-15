/* ---------------- undo outside the marking screen ---------------- */
// Ctrl Z (Cmd Z on a Mac) on Home, a class page, the gradebook, To do or Settings takes back the last change to the classes, units,
// rosters, gradebook, To do and settings, whatever made it: each save keeps the library as it was just before. Shift Ctrl Z or Ctrl Y
// does it again. Saves a moment apart are one step, so a burst of scores typed into the gradebook is one Ctrl Z. Typing in a box
// keeps the box's own undo. The marking screen has its own steps (paper.js), so a change made there isn't one here: the steps from
// before are let go, because putting back an older library would also take back what the download wrote into it.
const LIBU = { undo: [], redo: [], last: null, t: 0, quiet: false };
const LIBU_MAX = 60, LIBU_ROOM = 40e6;   // steps, and characters kept in all, so a big library can't eat the computer's memory
// Stamps and "last opened" times change without her doing anything, so they don't make a step.
const LIBU_SKIP = new Set(['v', 'at', 'fv', 'gone', 'opened']);
function libSnap() { try { return { s: JSON.stringify(lib), sig: JSON.stringify(lib, (k, v) => LIBU_SKIP.has(k) ? undefined : v) }; } catch { return null; } }
// After every save of the library (saveLib).
function libTrack() {
  const was = LIBU.last, now = libSnap(); if (!now) return;
  LIBU.last = now;
  if (!was || was.sig === now.sig || LIBU.quiet) return;
  if (batch) { LIBU.undo = []; LIBU.redo = []; return; }
  const t = Date.now();
  if (!(LIBU.undo.length && !LIBU.redo.length && t - LIBU.t < 1000)) {
    LIBU.undo.push(was);
    let room = LIBU.undo.reduce((n, u) => n + u.s.length, 0);
    while (LIBU.undo.length > LIBU_MAX || (room > LIBU_ROOM && LIBU.undo.length > 1)) room -= LIBU.undo.shift().s.length;
  }
  LIBU.t = t; LIBU.redo = [];
}
// The library came from somewhere else (another tab, her folder, a new year): steps from before it would take that back too.
function libUndoForget() { LIBU.undo = []; LIBU.redo = []; LIBU.last = libSnap(); }
// What a step changed, in a few words for the toast: the class, unit or assignment by name, or Settings, or To do.
function libWhat(a, b) {
  try {
    const wa = libWalk(a), wb = libWalk(b), hit = new Map();
    for (const [id, e] of wb) { const x = wa.get(id); if (!x || nodeHash(x) !== nodeHash(e)) hit.set(id, e); }
    for (const [id, e] of wa) if (!wb.has(id)) hit.set(id, e);
    // A unit that came back with its assignments is named once, by the unit.
    const named = [...new Set([...hit.values()].filter(e => !hit.has(e.parent)).map(e => e.fields.name).filter(Boolean))];
    if (named.length === 1) return '“' + named[0] + '”';
    if (named.length > 1) return named.length + ' classes, units or assignments';
    if (JSON.stringify(a.todo) !== JSON.stringify(b.todo)) return 'To do';
    if (JSON.stringify(a.me) !== JSON.stringify(b.me)) return 'Settings';
  } catch {}
  return '';
}
function libStep(from, to, said) {
  const u = from.pop();
  if (!u) { toast(said === 'Undone' ? 'Nothing to undo' : 'Nothing to redo'); return; }
  const cur = LIBU.last || libSnap(); if (!cur) return;
  to.push(cur);
  const next = JSON.parse(u.s), was = JSON.parse(cur.s), what = libWhat(was, next);
  // What comes back is a change made now, and what it takes away is deleted now: the save stamps both (stampLib).
  if (was.gone) next.gone = was.gone; else delete next.gone;
  LIBU.quiet = true;
  try {
    lib = migrateLib(next);
    if (batch && batch.assignment) { const f = findItem(batch.assignment.id); if (f) batch.assignment = f.it; }
    saveLib();
  } finally { LIBU.quiet = false; }
  LIBU.last = libSnap(); LIBU.t = 0;
  libRedraw();
  toast(said + (what ? ': ' + what : ''));
}
// Every screen that shows the library, drawn again from the one now kept.
function libRedraw() {
  const r = routeNow();
  renderLib();
  try { if (typeof homeRender === 'function' && r.v === 'home') homeRender(); } catch {}
  try { if (typeof todoRender === 'function' && r.v === 'todo') todoRender(); } catch {}
  try { if (typeof setRender === 'function' && r.v === 'settings') setRender(); } catch {}
  try { if (window.railRender) railRender(); } catch {}
}
const libUndo = () => libStep(LIBU.undo, LIBU.redo, 'Undone');
const libRedo = () => libStep(LIBU.redo, LIBU.undo, 'Redone');
// Ctrl Z, Shift Ctrl Z and Ctrl Y away from the marking screen. In a text box the box's own undo goes first; a tick box,
// slider or list box has none, so there it's the library's.
document.addEventListener('keydown', e => {
  if (batch || !(e.metaKey || e.ctrlKey) || e.altKey || e.defaultPrevented) return;
  const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
  if (!$('#dlg').hidden || $('#askDlg') || $('#findDlg') || $('#pcard') || $('#welcome:not([hidden])')) return;
  const a = document.activeElement;
  if (a && (a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|color|file)$/.test(a.type)))) return;
  e.preventDefault();
  if (k === 'y' || e.shiftKey) libRedo(); else libUndo();
});
