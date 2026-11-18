// One class colour everywhere (stage 3 brief, item 1). A class has one colour, the one the teacher picked in the timetable setup
// (gs-lessons kv "setup", classes[].color); every screen asks classTone() and gets that colour as one of the theme's eight class
// colours (--c1 .. --c8), the nearest one, so it reads well in every theme. A grading class is matched to its timetable class by
// name, as the current app matches them (src/todo.js tdGradeClass). A class with no timetable class keeps its place's colour.
import { toneOf } from './tone.js';
import { timetableClass } from '../planning/plan.js';
export { toneOf };

// A class by its name (and its place in the list, for one with no timetable class; -1 for "No class").
export function classTone(plan, name, i = 0) {
  const c = timetableClass(plan, name);
  if (c) return toneOf(c.color);
  return i < 0 ? 'var(--g500)' : 'var(--c' + ((i % 8) + 1) + ')';
}
// A timetable class by its id.
export function classToneById(plan, id) {
  const c = ((plan && plan.setup && plan.setup.classes) || []).find(x => x && String(x.id) === String(id));
  return c ? toneOf(c.color) : 'var(--g500)';
}
