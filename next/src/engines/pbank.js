// MADE BY next/build.js FROM src/planner/bank.js (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { L, lid } from './planner.js';

// src/planner/bank.js
const B_TOP = 4, B_TOP_MAX = 10;
// src/planner/bank.js
const bTopOk = v => { v = Math.round(+v); return v >= 1 && v <= B_TOP_MAX ? v : 0; };
// src/planner/bank.js
const bTop = (x, i) => (i != null && Array.isArray(x.tops) && bTopOk(x.tops[i])) || bTopOk(x.top) || B_TOP;
// src/planner/bank.js
const bMax = x => x.criteria.reduce((a, _, i) => a + bTop(x, i), 0);
// src/planner/bank.js
const bLevels = (x, i) => { const out = []; for (let v = bTop(x, i); v >= 0; v--) out.push(v); return out; };
// src/planner/bank.js
const bOneTop = x => x.criteria.every((_, i) => bTop(x, i) === bTop(x, 0)) ? bTop(x, 0) : 0;
// src/planner/bank.js
function bRowScale(x) { const o = {}; if (bTopOk(x.top) && bTopOk(x.top) !== B_TOP) o.top = bTopOk(x.top); if (Array.isArray(x.tops) && x.tops.some(bTopOk)) o.tops = x.tops.map(v => bTopOk(v) || null); if (x.half === false) o.half = false; return o; }
// src/planner/bank.js
const B_SCALE12 = { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 };
// src/planner/bank.js
const tidyBank = b => ({ rubrics: Array.isArray(b && b.rubrics) ? b.rubrics : [], scales: Array.isArray(b && b.scales) ? b.scales : [], gone: (b && b.gone && typeof b.gone === 'object') ? b.gone : {} });
// src/planner/bank.js
function normScale(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(s)) { const n = +k, p = +v; if (Number.isInteger(n) && n >= 0 && n <= 40 && v !== '' && v != null && isFinite(p) && p >= 0 && p <= 200) out[n] = p; }
  return Object.keys(out).length ? out : null;
}
// src/planner/bank.js
const scaleTop = s => s ? Math.max(...Object.keys(s).map(Number)) : 0;
// src/planner/bank.js
function normRef(u) {
  if (!u || typeof u !== 'object' || !(u.title || u.id)) return null;
  return { id: String(u.id || ''), course: String(u.course || ''), title: String(u.title || '') };
}
// src/planner/bank.js
function normRubric(x) {
  x = x && typeof x === 'object' ? x : {};
  const criteria = (Array.isArray(x.criteria) ? x.criteria : []).map(c => String(c == null ? '' : c).trim()).slice(0, 12).map((c, i) => c || 'Criterion ' + (i + 1));
  let levels;
  if (Array.isArray(x.levels)) {
    levels = criteria.map((_, i) => { const r = x.levels[i] || {}, o = {}; for (const v of bLevels({ ...x, criteria }, i)) { const t = String(r[v] == null ? '' : r[v]).trim(); if (t) o[v] = t; } return o; });
    if (!levels.some(r => Object.keys(r).length)) levels = undefined;
  }
  const r = { id: typeof x.id === 'string' && x.id ? x.id : lid(), name: String(x.name || '').trim() || 'Rubric', criteria: criteria.length ? criteria : ['Criterion 1'], levels, scale: normScale(x.scale), ...bRowScale(x), at: +x.at || Date.now() };
  if (r.tops) r.tops = r.criteria.map((_, i) => r.tops[i] || null);
  const u = normRef(x.unit); if (u) r.unit = u;
  return r;
}
// src/planner/bank.js
function normBankScale(x) {
  x = x && typeof x === 'object' ? x : {};
  const s = { id: typeof x.id === 'string' && x.id ? x.id : lid(), name: String(x.name || '').trim() || 'Grading scale', scale: normScale(x.scale) || { 0: 0 }, at: +x.at || Date.now() };
  const u = normRef(x.unit); if (u) s.unit = u;
  return s;
}
// src/planner/bank.js
const bankRubrics = () => ((L.bank && L.bank.rubrics) || []).filter(r => r && r.id && r.name && Array.isArray(r.criteria) && r.criteria.length);
// src/planner/bank.js
const bankScales = () => ((L.bank && L.bank.scales) || []).filter(s => s && s.id && s.name && s.scale && typeof s.scale === 'object');
// src/planner/bank.js
const bankNatural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
// src/planner/bank.js
function presetScale(p, top, saved) {
  if (p === 'none') return null;
  if (saved) { const s = bankScales().find(x => x.id === saved); return s ? { ...s.scale } : null; }
  if (p === 'usual' && top === 12) return { ...B_SCALE12 };
  const o = {}; for (let k = top; k >= 0; k--) o[k] = Math.round((p === 'fives' ? 100 - (top - k) * 5 : k / top * 100) * 10) / 10;
  return o;
}
// src/planner/bank.js
function rescale(s, was, top) {
  if (!s) return null;
  const plain = Object.entries(s).every(([k, v]) => Math.abs(v - k / was * 100) < 0.11), fives = Object.entries(s).every(([k, v]) => Math.abs(v - (100 - (was - k) * 5)) < 0.01);
  return plain ? presetScale('plain', top) : fives ? presetScale('fives', top) : null;
}
export { tidyBank, normScale, scaleTop, normRef, normRubric, normBankScale, presetScale, rescale, bTop, bMax, bLevels, bOneTop, bRowScale, B_TOP, B_TOP_MAX, bankNatural, bankRubrics, bankScales };
