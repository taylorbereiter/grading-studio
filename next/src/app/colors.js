// One class colour everywhere (stage 3 brief, item 1). A class has one colour, the one the teacher picked in the timetable setup
// (gs-lessons kv "setup", classes[].color); every screen asks classTone() and gets that colour as one of the theme's eight class
// colours (--c1 .. --c8), the nearest one, so it reads well in every theme. A grading class is matched to its timetable class by
// name, as the current app matches them (src/todo.js tdGradeClass). A class with no timetable class keeps its place's colour.
import { THEMES } from '../ui/tokens.js';
import { timetableClass } from '../planning/plan.js';

const BASE = THEMES.ocean.cls.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const cache = new Map();
// A timetable colour (#rrggbb) as the theme's class colour nearest to it.
export function toneOf(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return 'var(--c2)';
  if (cache.has(hex)) return cache.get(hex);
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  let best = 0, bd = Infinity;
  BASE.forEach((b, i) => { const d = (b[0] - c[0]) ** 2 * 0.3 + (b[1] - c[1]) ** 2 * 0.59 + (b[2] - c[2]) ** 2 * 0.11; if (d < bd) { bd = d; best = i; } });
  const v = 'var(--c' + (best + 1) + ')'; cache.set(hex, v); return v;
}
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
