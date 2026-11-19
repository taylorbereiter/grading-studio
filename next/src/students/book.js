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
import { setupRecord, mailApp, googleEmail, manageBacLinks } from '../planning/index.js';
import { savePref } from '../planning/write.js';

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
// The Planner's timetable as attendance reads it (src/today.js plan, src/attend.js attMeets): each class's name and meeting days,
// and the days off. The grading side may read the planning side; nothing about students goes the other way.
export async function attPlan() {
  const p = await setupRecord.get().catch(() => null); if (!p) return null;
  return { classes: (p.classes || []).filter(Boolean).map(k => ({ name: String(k.name || ''), meets: (k.meets || []).filter(Boolean) })), daysOff: (p.daysOff || []).filter(Boolean) };
}
// The teacher's mail app (src/mail.js mailApp, Settings): Gmail unless she chose Outlook on the web or the computer's own app, and the
// Google account to open Gmail in.
export function mailWay() {
  let app = 'gmail', who = '';
  try { const v = mailApp.json('gmail'); if (['gmail', 'outlook', 'app'].includes(v)) app = v; } catch {}
  try { who = String(googleEmail.text('') || ''); } catch {}
  return { app, who };
}
export const classIn = (l, id) => l.classes.find(c => String(c.id) === String(id)) || null;
export { B as engine };
// A class's link to its page in the school's system (src/app/screens.js mbOf, askMb): kept on the class (c.mb) and, by the class's
// name, in gs.mblinks, which the Planner reads too. Read: the class's own, else the one remembered for its name.
const MB_NORM = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const linkUrl = v => { v = String(v || '').trim(); if (/^[\w.-]+\.[a-z]{2,}\//i.test(v)) v = 'https://' + v; return /^https?:\/\/[^\s"<>]+$/i.test(v) ? v : ''; };
export function classLink(c) { if (!c) return ''; const m = manageBacLinks.json(null) || {}; return linkUrl(c.mb) || linkUrl(m[MB_NORM(c.name)]) || ''; }
export async function setClassLink(label, id, url) {
  let name = '';
  await change(label, l => { const k = classIn(l, id); if (!k) return; name = k.name; if (url) k.mb = url; else delete k.mb; }, true);
  const m = { ...(manageBacLinks.json(null) || {}) }, k = MB_NORM(name); if (!k) return;
  if (url) m[k] = url; else delete m[k];
  savePref('gs.mblinks', m);
}
