// What the class needs next (src/today.js nextHtml, workStat): the newest finished rubric assignment of the last 30 days, each
// rubric row's class average and how many scored at half the row's top or below. Numbers about the class and row names only: no
// student is named or counted by name. Read once per save of that download (the current app's homeStat keeps one per download).
import { newestWork } from './index.js';
import * as C from './counts.js';
import { setupOver, rowTop, roundPct } from '../engines/gcore.js';
import { pastScore } from '../engines/ginsight.js';

const NEXT_DAYS = 30, seen = new Map();
function workStat(d) {
  const su = setupOver(d.setup), pcts = [], crit = su.mode === 'rubric' ? su.criteria : [], rows = crit.map((c, i) => ({ name: String(c), top: rowTop(su, i), sum: 0, n: 0, low: 0 }));
  for (const k of new Set([...Object.keys(d.s || {}), ...Object.keys(d.read || {})])) {
    const g = { ...(((d.s || {})[k] || {}).g || {}), read: (d.read || {})[k] }, p = pastScore(d.setup, g);
    if (p.status === 'missing' || p.status === 'excused' || p.partial || g.outAvg) continue;
    if (p.pct != null) pcts.push(p.pct);
    if (!p.paper) for (const [i, row] of rows.entries()) { const v = (g.rubric || [])[i]; if (v != null) { row.sum += v; row.n++; if (v <= row.top / 2) row.low++; } }
  }
  const full = rows.filter(r => r.n >= 3).map(r => ({ name: r.name, top: r.top, avg: r.sum / r.n, low: r.low, n: r.n }));
  return { avg: pcts.length ? roundPct(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null, n: pcts.length, rows: full.length === rows.length && rows.length >= 2 ? full : [] };
}
export async function nextCard(lib, kept, g, now = Date.now()) {
  const done = m => { const st = C.stateOf(lib, kept, m); return st.of && !st.left; };
  const m = [...g.back, ...g.old].filter(m => done(m) && !(m.newer && kept.has(m.newer)) && now - m.t < NEXT_DAYS * 864e5).sort((a, b) => b.t - a.t)[0];
  if (!m) return null;
  let s = seen.get(m.id);
  if (!s || s.t !== m.t) { const d = await newestWork(m.id); s = { t: m.t, v: d ? workStat(d) : null }; seen.set(m.id, s); }
  if (!s.v || !s.v.rows.length) return null;
  const rows = s.v.rows, low = rows.reduce((a, b) => (b.avg / b.top < a.avg / a.top ? b : a));
  // rows can be on different scales, so they are compared by their share of the top (0.05 of a point on 0 to 4)
  const flat = rows.every(r => Math.abs(r.avg / r.top - low.avg / low.top) < 0.0125), w = C.whereOf(lib, kept, m.id);
  return { id: m.id, name: String(m.name || ''), cls: w.cls ? String(w.cls.name || '') : '', open: C.canOpen(m), flat, low: rows.indexOf(low),
    rows: rows.map(r => ({ name: r.name, top: r.top, avg: Math.round(r.avg * 10) / 10, low: r.low })) };
}
