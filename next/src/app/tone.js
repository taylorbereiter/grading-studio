// A timetable colour as the theme's class colour nearest to it (app/colors.js tells why). Kept apart from colors.js, which reads
// the timetable, so a screen on the students' side can colour a class without reaching the planning side.
import { OCEAN_CLS } from '../ui/looks.js';

const BASE = OCEAN_CLS.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
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
