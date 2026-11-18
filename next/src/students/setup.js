// My setup (src/setupin.js), on the grading side because what it brings in is mostly hers there: her own words, how she grades,
// classes and units, terms and weights, saved rubrics and comments, goals, marking choices, the focus timer and to-do categories.
// It also lays the classes' times and the calendar over the Planner's timetable and adds people to the School page, which the
// grading side may do (students/ may use planning/). The reading, the bringing in and the putting back are the current app's own
// (engines/gstp.js, lifted); this hands them the library inside saveLibrary, a store that writes through write.js, the School page
// and the Planner's timetable. Never a student: stpRead drops anything about one and says so.
import { library, commentBank, setupUndo } from './index.js';
import { prefs } from './prefs.js';
import * as ls from '../shared/ls.js';
import { check, saveLibrary, saveSetting } from './write.js';
import { schoolNow, people } from '../planning/school.js';
import { savePref, saveKv } from '../planning/write.js';

const E = () => import('../engines/gstp.js');
const WORK = new Set(['gs.setup', 'gs.bank', 'gs.rubrics', 'gs.rubricsGone', 'gs.setupUndo', 'gs.focus']);
// The engines' store: reads as the current app reads, and keeps each write until the job is done, then writes it the new app's way.
function jobStore() {
  const wait = new Map(), none = {};
  return {
    get(k, d) { if (wait.has(k)) { const v = wait.get(k); return v === undefined ? d : v; } const v = ls.json(k, none); return v === none || v == null ? d : v; },
    set(k, v) { wait.set(k, JSON.parse(JSON.stringify(v))); },
    del(k) { wait.set(k, undefined); },
    flush() { for (const [k, v] of wait) { if (WORK.has(k)) saveSetting(k, v === undefined ? null : v); else if (v === undefined) prefs.del(k); else prefs.set(k, v); } },
  };
}
// Hands the engine what it reads: her comments, the School page's people and spots, the colour of points and how the list shows scores.
function hand(M, store, lib) {
  const sc = schoolNow();
  M.stpUse({ lib: lib || library.json(null) || { classes: [], loose: { id: '', units: [] } }, store, bank: commentBank.json([]) || [], people: people(sc), roles: sc.roles || null,
    ptsInk: prefs.get('gs.ptsInk', ''), listPts: !!prefs.get('gs.listPts', false) });
}
// The School page's people, changed as the engine says, and the Planner's timetable, written as the Planner writes it.
function hooks(M, said) {
  M.stpHooks({
    school(fn) { const s = schoolNow(); fn(s); savePref('gs.school', s); },
    async planPut(v) { await saveKv('setup', v); },
    said,
  });
}

// What a pasted text says: { err: 'empty' | 'long' | 'notours' | 'none' } or { S } (the tidy setup) and the Planner's timetable now.
export async function readSetup(text) {
  const M = await E(); hand(M, jobStore());
  const s = String(text || '');
  if (!s.trim()) return { err: 'empty' };
  if (s.length > 400000) return { err: 'long' };
  const r = M.stpParse(s);
  if (r.err) return { err: /gradingStudioSetup/.test(r.err) ? 'notours' : 'none' };
  return { S: M.stpRead(r.j), plan: await M.stpPlanGet(), M };
}
// Brings in the parts she ticked (pick: { school: true, … }). Answers the record of what changed (kept as gs.setupUndo).
export async function applySetup(S, pick) {
  check('gs.lib');
  const M = await E(), store = jobStore(); let job;
  hooks(M, () => {});
  // Everything the library takes happens before the engine's first wait, so it is all in this one save of the library.
  await saveLibrary(l => { hand(M, store, l); job = M.stpApply(S, pick); });
  const U = await job;
  store.flush();
  if (U) saveSetting('gs.setupUndo', U);
  return U;
}
export const lastSetup = () => { const u = setupUndo.json(null); return u && typeof u === 'object' && u.t ? u : null; };
// Puts back what the last setup did, except what has been used since. Answers true when something had to stay.
export async function undoSetup() {
  check('gs.lib');
  const M = await E(), store = jobStore(); let job, kept = false;
  hooks(M, s => { kept = /except/.test(String(s)); });
  await saveLibrary(l => { hand(M, store, l); job = M.stpUndo(); });
  await job;
  store.flush();
  return kept;
}
// Her setup in the same format, for another computer or a colleague. Never a roster, a score or a paper.
export async function exportSetup() {
  const M = await E(); hand(M, jobStore());
  return M.stpExport();
}
// The prompt for her assistant: it describes the format in full. The example names no assistant (only her own, when she has one).
export async function setupPrompt(ai) {
  const M = await E();
  return M.stpPrompt().replace(/"assistant":\s*"[^"]*"/g, ai ? '"assistant": ' + JSON.stringify(ai) : '"assistant": "…"');
}
export const engine = E;
