// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, setup, rowTop, maxPoints, gradeOf, fmtNum, noScore } from './gcore.js';
import { anonOn, anonOrder } from './gdraw.js';

// src/insight.js
const DRIFT_MIN = 9, DRIFT_SURE = 20;
// src/insight.js
const average = a => a.reduce((x, y) => x + y, 0) / a.length;
// src/insight.js
function driftChance(vals, third, gap) {
  let s = 0x9E3779B9, hits = 0;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = vals.slice(), n = a.length, N = 4000;
  for (let r = 0; r < N; r++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    if (Math.abs(average(a.slice(-third)) - average(a.slice(0, third))) >= Math.abs(gap) - 1e-9) hits++;
  }
  return (hits + 1) / (N + 1);
}
// src/insight.js
function driftRead(vals, max, cut = 0.05) {
  const n = vals.length;
  if (n < DRIFT_MIN) return { n, level: 'few' };
  const third = Math.floor(n / 3), early = average(vals.slice(0, third)), late = average(vals.slice(-third)), gap = late - early;
  const chance = driftChance(vals, third, gap), small = Math.abs(gap) < max * 0.05;
  return { n, third, early, late, gap, chance, dir: gap < 0 ? 'harder' : 'softer', level: chance >= cut || small || !gap ? 'none' : n < DRIFT_SURE ? 'hint' : 'likely' };
}
// src/insight.js
const roughStep = max => max > 200 ? 10 : max > 40 ? 2 : max > 20 ? 1 : 0.5;   // fine enough that rounding can't make a gap look much bigger than it is
// src/insight.js
const roughly = (v, max) => { const step = roughStep(max); return fmtNum(Math.round(v / step) * step); };
// src/insight.js
const roughGap = (r, max) => { const g = Math.abs(roughly(r.early, max) - roughly(r.late, max)) || roughStep(max); return fmtNum(g) + (g === 1 ? ' point' : ' points'); };
// src/insight.js
function scoreTime(g) {
  const rows = setup.mode === 'rubric' ? Object.entries(g.atR || {}).filter(([i]) => +i < setup.criteria.length).map(x => x[1]) : g.atR && g.atR.points ? [g.atR.points] : [];
  return rows.length ? Math.max(...rows) : g.at || null;
}
// src/insight.js
function dropBatched(sorted) {
  const out = [], off = [];
  let run = [];
  const flush = () => { (run.length >= 3 ? off : out).push(...run); run = []; };
  for (const x of sorted) { if (run.length && x.t - run[run.length - 1].t > 1000) flush(); run.push(x); }
  flush();
  return { out, off };
}
// src/insight.js
function consData() {
  const timed = [], noTime = [], groups = new Map(), order = anonOn() ? anonOrder() : batch.students.map((_, i) => i);
  for (const i of order) {
    const st = batch.students[i], g = gradeOf(st);
    if (noScore(st) || !g.done || g.total == null || g.out) continue;
    const out = g.paper && st.found && st.found.outOf != null && st.found.outOf !== maxPoints() ? st.found.outOf : null, key = out == null ? g.total : g.total + '/' + out;   // 10 out of 15 isn't the same score as 10 out of 12
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
    const t = g.paper ? null : scoreTime(st.grade);
    if (t) timed.push({ i, v: g.total, t }); else noTime.push(i);
  }
  const { out, off } = dropBatched(timed.sort((a, b) => a.t - b.t));
  return { pts: out, noTime, off, groups };
}
// src/insight.js
function rowDrifts() {
  const cut = 0.05 / setup.criteria.length;
  return setup.criteria.map((name, r) => {
    const pts = [];
    for (const st of batch.students) { const v = st.grade.rubric[r], t = st.grade.atR && st.grade.atR[r]; if (!noScore(st) && !st.grade.outAvg && v != null && t) pts.push({ v, t }); }
    const { out } = dropBatched(pts.sort((a, b) => a.t - b.t));
    return { name, top: rowTop(setup, r), read: driftRead(out.map(p => p.v), rowTop(setup, r), cut) };
  });
}
// src/insight.js
const sameLabel = v => typeof v === 'number' ? fmtNum(v) : v.split('/').map(x => fmtNum(+x)).join(' / ');
export { consData, driftRead, rowDrifts, roughly, roughGap, roughStep, DRIFT_MIN, DRIFT_SURE, sameLabel };
