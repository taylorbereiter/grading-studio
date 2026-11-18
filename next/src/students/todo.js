// To do (src/todo.js): the teacher's own lines (lib.todo.items) and the lines the app works out from saved work. Her lines are saved
// in the library, as the current app saves them, so they go wherever the classes go; a line can name a student, so it never goes
// to the planning side. The working out is the lifted engine's (engines/gtodo.js, from src/todo.js), handed the library, the
// timetable and the School page's people. The app's own lines are worked out in students/todo-auto.js.
import * as E from '../engines/gtodo.js';
import { libraryChange } from './undo.js';
import * as C from './counts.js';
import { readPlan } from '../planning/today.js';
import { school } from '../planning/index.js';

export const engine = E;
// The people on the School page (gs.school, src/school.js): colleagues, never students. One deleted there is left out.
export function people() {
  const s = school.json(null);
  return (s && Array.isArray(s.people) ? s.people : []).filter(p => p && p.id && !p.gone && p.name).map(p => ({ id: String(p.id), name: String(p.name), role: String(p.role || ''), email: String(p.email || '') }));
}

// Her own lines, as rows beside the app's (src/todo.js todoRows).
export const ownRows = () => E.tdItems().map(it => ({ own: true, id: it.id, it, x: it.x, d: it.d || '', classId: it.c ? String(it.c) : '', done: it.done || 0 }));

// Everything the To do screen draws, read once: the library, the timetable, the people, and every row.
// The app's lines (students/todo-auto.js) come in through crossings.js appLinesForTodo, as Home's do.
export async function readTodo(auto) {
  const lib = C.readLibrary(), plan = await readPlan(), ppl = people();
  E.todoUse({ lib, plan, people: ppl });
  return { lib, plan, people: ppl, rows: [...ownRows(), ...auto] };
}
// A change to To do, as one step that Undo takes back: fn(E) runs the lifted engine on the library being saved. alone: a step of its own.
export async function todoChange(label, fn, plan = null, alone = true) {
  let out;
  const l = await libraryChange(label, lib => { E.todoUse({ lib, plan, people: people() }); out = fn(E); }, alone);
  E.todoUse({ lib: C.readLibrary(), plan, people: people() });
  return { lib: l, out };
}
