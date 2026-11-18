// The gradebook, read the way the current app reads it (src/book.js bkLoad, bkClassCols, bkGrade; src/missing.js), through the lifted
// engine (engines/gbook.js): every column from saved work and typed scores, each class's columns with each roster student's cell,
// the terms, and who owes work. Read only here; a change goes through write.js saveLibrary (libraryChange for one undo step), with
// the lifted mutator run on the library that save hands in (change() below), so the current app's own lines make the change.
import * as B from '../engines/gbook.js';
import { setupOver } from '../engines/gcore.js';
import { useStore } from '../engines/gstore.js';
import { prefs } from './prefs.js';
import { library, meta, gradingSetup } from './index.js';
import { libraryChange } from './undo.js';

// The library as the current app holds it once loaded (src/app/library.js migrateLib): every class with units and a roster.
export function fullLibrary() {
  const l = library.json(null) || {};
  l.classes = (Array.isArray(l.classes) ? l.classes : []).filter(c => c && c.id != null);
  for (const c of l.classes) { c.units = Array.isArray(c.units) ? c.units : []; c.names = Array.isArray(c.names) ? c.names : []; for (const u of c.units) u.items = Array.isArray(u.items) ? u.items : []; }
  l.loose = l.loose && typeof l.loose === 'object' ? l.loose : { id: '', units: [] }; l.loose.id ||= ''; l.loose.units = Array.isArray(l.loose.units) ? l.loose.units : [];
  for (const u of l.loose.units) u.items = Array.isArray(u.items) ? u.items : [];
  return l;
}
async function keptRows() { const m = new Map(); for (const [k, v] of await meta.entries()) m.set(k, v); return m; }
// Hands the book's engine this library (and the kept rows and setup it reads beside it). The engine keeps its own copies
// (bookUse), so the marking screen's library and setup are never touched.
export function hand(lib, keptMeta) { useStore(prefs); const o = { lib, setup: setupOver(gradingSetup.json(null)) }; if (keptMeta) o.keptMeta = keptMeta; B.bookUse(o); return lib; }

// Every column of every class: { lib, cols }. Reading the saved work takes a moment, so a screen reads it once and keeps it until a save.
export async function readBook() {
  const lib = hand(fullLibrary(), await keptRows());
  return { lib, cols: await B.bkLoad() };
}
// One class's columns, each with its cells (a Map from roster name to cell) and its term, oldest first.
export function classCols(lib, c, cols) { hand(lib); B.bkUse({ cls: c.id }); return B.bkClassCols(c, cols); }
export const conf = lib => { hand(lib); return B.bkConf(); };
// The term an assignment counts in now: the one today falls in, or the last one; '' with no terms (the whole year).
export function termNow(lib) { const c = conf(lib); return c.terms.length ? B.bkTermNow(c.terms) : ''; }
export function grade(lib, name, cols, cf) { hand(lib); return B.bkGrade(name, cols, cf || B.bkConf()); }

// Missing work by class, the way the current app's To do finds it (src/todo.js tdMissLoad): in this term, students who owe
// something they haven't been reminded about. { classId: count }; nothing while the teacher has switched those lines off.
export async function missingByClass() {
  const lib = fullLibrary();
  if ((lib.todo && lib.todo.off && lib.todo.off.miss) || !lib.classes.some(c => c.names.length)) return {};
  const { cols } = await readBook(); hand(lib);
  const terms = B.bkConf().terms, term = terms.length ? B.bkTermNow(terms) : null, by = {};
  for (const c of lib.classes) {
    if (!c.names.length) continue;
    B.bkUse({ cls: c.id });
    const all = B.bkClassCols(c, cols), n = B.misByStu(c, term == null ? all : all.filter(x => x.termId === term)).filter(s => s.cols.some(col => !B.misNudge(c, s.n, col))).length;
    if (n) by[c.id] = n;
  }
  return by;
}

// A change to the library made by the current app's own lines (a lifted mutator such as bkPut, keepInfo, attSet): run on the copy
// the save hands in, found again there by id, as one undo step.
export function change(label, fn, alone) {
  return libraryChange(label, l => { hand(l); fn(l); }, alone);
}
export const classIn = (l, id) => l.classes.find(c => String(c.id) === String(id)) || null;
export { B as engine };
