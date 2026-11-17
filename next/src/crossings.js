// The only module that may import both sides. Each crossing is a named, read-only function that hands the planning side what it
// needs from the grading side, and no more. Today's crossings, in the current app (next/docs/saved-work.md lists every one):
// - the Planner's classes (gs-lessons kv "setup") are written by the grading page too (setup import, sync, take-home, new year)
// - the Planner reads the strong examples database (src/planner/plexamples.js)
// - Present shows roster names without storing them
// - attendance lives on the student side
import * as students from './students/index.js';
import * as planning from './planning/index.js';

// Classes with their names and periods, without the students in them.
export async function classListsForPlanning() {
  const s = await planning.setupRecord.get();
  return ((s && s.classes) || []).map(c => { const { names: _n, students: _s, ...rest } = c; return rest; });
}
// The strong examples, as the Planner shows them: what they are and their pictures. Read only.
export async function examplesForPlanning() {
  const ex = (await students.examples.entries()).filter(([k]) => !String(k).startsWith('watch:')).map(([, v]) => v);
  return ex;
}
// The names on each class's roster, to show while presenting (pick a name, groups), as the Planner reads them today from gs.rolls
// (src/pickshare.js pkRolls, written by the grading page's src/seating.js rollsShare). Shown, never stored by the caller.
export function rosterNamesForPresent() {
  const r = students.pickerRolls.json([]);
  return Array.isArray(r) ? r.filter(x => Array.isArray(x) && typeof x[0] === 'string' && Array.isArray(x[1])).map(([name, names]) => ({ name, names: names.filter(n => typeof n === 'string') })) : [];
}
