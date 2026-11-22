// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, setup, lib, tr, keptMeta, store, kdo, histFill, ROW_TOP, rowTop, setupMax, setupOver, maxPoints, pointsWith, percentWith, gradeOf, withTries, addXc, fmtNum, noScore } from './gcore.js';
import { classById, nameWords, batchClass, anonOn, anonOrder, classOfNames, infoHits, one } from './gdraw.js';
import { findItem, hasSheet, newestWork } from './gopen.js';

// src/carryover.js
const hasWork = d => !!d && !!d.s && Object.keys(d.s).length > 0;
// src/carryover.js
async function earlierWork(id, keep = hasWork) {
  const all = new Map();
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.b.') && k !== id) all.set(k, store.get(k, null)); }
  try {
    const keys = await kdo('work', 'readonly', o => o.getAllKeys()) || [], vals = await kdo('work', 'readonly', o => o.getAll()) || [];
    keys.forEach((k, i) => { if (k !== id) all.set(k, newestWork(all.get(k), vals[i])); });
  } catch (e) { console.error(e); }
  return [...all].filter(([, d]) => keep(d)).sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
}
// src/insight.js
const wordsMemo = new Map();
// src/insight.js
const wordSet = s => { let w = wordsMemo.get(s); if (!w) wordsMemo.set(s, w = new Set(nameWords(s))); return w; };
// src/insight.js
function nameFit(a, b) {
  const A = wordSet(a), B = wordSet(b);
  if (!A.size || !B.size) return 0;
  const aInB = [...A].every(w => B.has(w)), bInA = [...B].every(w => A.has(w));
  if (aInB && bInA) return 2;
  return (aInB && A.size > 1) || (bInA && B.size > 1) ? 1 : 0;
}
// src/insight.js
function oneEdit(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, n = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++n > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) { i += 2; j += 2; continue; }   // two letters swapped
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return true;
}
// src/insight.js
const wordClose = (a, b) => a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a) || oneEdit(a, b));
// src/insight.js
function nameNear(a, b) {
  let A = [...wordSet(a)], B = [...wordSet(b)];
  if (A.length > B.length) [A, B] = [B, A];
  if (!A.length) return false;
  let same = 0;
  for (const w of A) {
    const at = B.indexOf(w), j = at >= 0 ? at : B.findIndex(x => wordClose(w, x));
    if (j < 0) return false;
    if (at >= 0) same++;
    B.splice(j, 1);
  }
  return same > 0;
}
// src/insight.js
function rosterPairs(names, keys) {
  const sure = new Map(), c = classOfNames(names);
  if (c && c.info) {   // a spelling she linked, or the student's ID in the name, first
    for (const k of keys) { const h = infoHits(c, k); if (h.length === 1 && !sure.has(h[0])) sure.set(h[0], k); }
    const took = new Set(sure.values()); names = names.filter(n => !sure.has(n)); keys = keys.filter(k => !took.has(k));
  }
  const fits = names.map(n => keys.map(k => nameFit(n, k)));
  names.forEach((n, i) => {
    const top = Math.max(0, ...fits[i]); if (!top) return;
    const hits = keys.filter((_, j) => fits[i][j] === top); if (hits.length !== 1) return;
    const j = keys.indexOf(hits[0]), col = fits.map(r => r[j]);
    if (Math.max(...col) === top && col.filter(v => v === top).length === 1) sure.set(n, hits[0]);
  });
  return sure;
}
// src/insight.js
function pastScore(su, g) {
  const s = setupOver(su), rub = s.mode === 'rubric';
  if (g.status === 'missing' || g.status === 'excused') return { total: null, pct: null, status: g.status, rows: [] };
  const r = g.rubric || [];
  let max = setupMax(s), total = null, partial = false, paper = false;
  if (rub) { const v = s.criteria.map((_, i) => r[i]); if (v.some(x => x != null)) { total = v.reduce((a, x) => a + (x || 0), 0); partial = v.some(x => x == null); } }
  else if (g.points !== '' && g.points != null && !isNaN(+g.points)) total = +g.points;
  if (total == null && hasSheet(g) && !isNaN(+g.sheet)) { total = +g.sheet; paper = true; }
  let pct = percentWith(total, max, s.scale);
  if (g.pk != null && g.pk !== '' && !Array.isArray(s.ib)) { pct = +g.pk; total = pointsWith(pct, max, s.scale); partial = paper = false; }   // a percent she typed stays the score
  if (total == null && g.read && !(g.tries && g.tries.length)) { const d = g.read; paper = true; total = d.score; if (d.outOf != null) max = d.outOf; pct = d.pct != null ? d.pct : percentWith(total, max, s.scale); }
  const one = addXc({ total, max, pct, partial, paper, status: g.status || '', rows: rub ? s.criteria.map((c, i) => rowTop(s, i) === ROW_TOP ? [c, r[i]] : [c, r[i], rowTop(s, i)]).filter(x => x[1] != null) : [] }, g.xc, max, g.xcU);
  if (!g.tries || !g.tries.length) return one;
  const out = withTries(one, g.tries, max, one.total != null && !partial);   // a retake: the try that counts by the teacher's rule (start.js)
  if (out.outOf != null) { out.max = out.outOf; delete out.outOf; }
  return out;
}
// src/insight.js
function pastClass(d, m) {
  const f = m.asg && findItem(m.asg);
  if (f) return f.it.classId || '';
  if (d.cls != null) return classById(d.cls) ? d.cls : '';
  const keys = Object.keys({ ...d.s, ...d.read });
  let best = '', bn = 0;
  for (const k of lib.classes) if (k.names.length) { const n = rosterPairs(k.names, keys).size; if (n > bn) { bn = n; best = k.id; } }
  return bn >= Math.max(2, keys.length / 2) ? best : '';
}
// src/insight.js
function workTime(d) {
  const all = Object.values(d.s || {}).flatMap(r => { const g = r.g || {}; return [r.at, g.at, ...Object.values(g.atR || {})]; }).filter(Boolean);
  return all.length ? Math.max(...all) : 0;
}
// src/insight.js
let histAll = null;
// src/insight.js
function histLoad() {
  if (histAll && histAll.id === batch.id) return histAll;
  const me = histAll = { id: batch.id, list: null }, asg = batch.assignment && batch.assignment.id;
  earlierWork(batch.id, d => hasWork(d) || !!(d && d.read)).catch(e => { console.error(e); return []; }).then(all => {
    const gone = (m, d) => (m.newer && keptMeta.has(m.newer)) || (asg && m.asg === asg) || (d.carry && d.carry.from === me.id) || (!hasWork(d) && !!m.name && m.name === batch.name);   // a copy with only the paper's own grades, of this same assignment: there was nothing in it to carry over
    me.list = all.filter(([k, d]) => !gone(keptMeta.get(k) || {}, d)).map(([id, d]) => {
      const m = keptMeta.get(id) || {}, f = m.asg && findItem(m.asg), s = {};
      for (const [k, o] of Object.entries(d.s || {})) if (o && o.g) s[k] = o.g;
      for (const [k, r] of Object.entries(d.read || {})) s[k] = { ...s[k], read: r };
      return { id, s, t: workTime(d) || d.t || m.t || 0, setup: d.setup, name: (f && f.it.name) || m.name || tr('An earlier download'), cls: pastClass(d, m) };
    });
    if (histAll === me && batch && batch.id === me.id) histFill();
  });
  return me;
}
// src/insight.js
const histHas = (d, k) => { const p = pastScore(d.setup, d.s[k]); return p.total != null || p.pct != null || !!p.status || !!(d.s[k].comment || '').trim(); };
// src/insight.js
function pairsIn(d, names) {
  const sig = names.join('\n');
  if (d.pairSig !== sig) { d.pairSig = sig; d.pairs = rosterPairs(names, Object.keys(d.s)); }
  return d.pairs;
}
// src/insight.js
function histFind(st, past) {
  const c = batchClass(), names = c ? c.names : [], here = rosterPairs(names, batch.students.map(x => x.key)), who = names.find(n => here.get(n) === st.key);
  const me = { c, name: who || st.key, onRoster: !!who }, said = store.get('gs.histSame', {}), key = (d, x) => [c ? c.id : '', me.name, d.cls || d.id, x].join('|');
  const out = { me, sure: [], ask: new Map(), no: new Map() };
  for (const d of past) {
    const same = !!c && d.cls === c.id;
    let k = null, maybe;
    if (same && who) {
      const p = pairsIn(d, names), taken = new Set(p.values());
      k = p.get(who);
      maybe = k ? [] : Object.keys(d.s).filter(x => !taken.has(x) && (nameFit(x, who) || nameNear(x, who)));
    } else maybe = Object.keys(d.s).filter(x => same ? nameFit(x, me.name) || nameNear(x, me.name) : nameFit(x, me.name) === 2);
    if (k && histHas(d, k)) out.sure.push({ d, k });
    for (const x of maybe) {
      if (!histHas(d, x)) continue;
      const hk = key(d, x), a = said[hk];
      if (a === 1) out.sure.push({ d, k: x, you: hk });
      else {
        const box = a === 0 ? out.no : out.ask;
        if (!box.has(hk)) box.set(hk, { hk, x, d, same, n: 0 });
        box.get(hk).n++;
      }
    }
  }
  out.sure.sort((a, b) => b.d.t - a.d.t);
  return out;
}
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
export { consData, driftRead, rowDrifts, roughly, roughGap, roughStep, DRIFT_MIN, DRIFT_SURE, sameLabel, histLoad, histFind, histHas, pastScore, workTime, earlierWork, hasWork, pastClass, rosterPairs };
