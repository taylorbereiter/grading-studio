/* ---------------- student history: past scores and earlier comments beside the new paper, matched through rosters ---------------- */
// All of this only reads saved work in this browser and shows it on screen. None of it goes in the Claude package, and none of it shows during anonymous grading.
const wordsMemo = new Map();
const wordSet = s => { let w = wordsMemo.get(s); if (!w) wordsMemo.set(s, w = new Set(nameWords(s))); return w; };
// 2: the same words in any order. 1: one is the other with more words ("Sam Doe", "Sam Q Doe"). 0: neither.
function nameFit(a, b) {
  const A = wordSet(a), B = wordSet(b);
  if (!A.size || !B.size) return 0;
  const aInB = [...A].every(w => B.has(w)), bInA = [...B].every(w => A.has(w));
  if (aInB && bInA) return 2;
  return (aInB && A.size > 1) || (bInA && B.size > 1) ? 1 : 0;
}
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
const wordClose = (a, b) => a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a) || oneEdit(a, b));
// Close but not the same: "Jon Smith" and "John Smith", "Sam Doe" and "Samuel Doe", "Sam" and "Sam Doe". One word has to be exactly the same, and every other word close.
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
// Who's who in one list of names, by a roster: roster name to saved name. Only when each fits just the other, so it's never a guess.
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
// Scores read off the paper, kept beside the work (saved read: { student: { score, outOf, pct } }) so Past work can show them. Only Past work reads this: the paper is read again on every open.
// A student the scan hasn't reached yet keeps what was saved.
function paperReads() {
  const r = {}, was = batch.read || {};
  for (const st of batch.students) {
    const f = st.found;
    if (f === undefined) { if (was[st.key]) r[st.key] = was[st.key]; }
    else if (f && f.found && (f.score != null || f.pct != null)) r[st.key] = { score: f.score, outOf: f.outOf, pct: f.pct };
  }
  return Object.keys(r).length ? r : undefined;
}
// A saved score, worked out by the rubric and scale that download had, in the order the app uses: her own score, then one typed on the Grade sheet, then one read off the paper. Nothing in it depends on what's open now.
function pastScore(su, g) {
  const s = setupOver(su), rub = s.mode === 'rubric';
  if (g.status === 'missing' || g.status === 'excused') return { total: null, pct: null, status: g.status, rows: [] };
  const r = g.rubric || [];
  let max = setupMax(s), total = null, partial = false, paper = false;
  if (rub) { const v = s.criteria.map((_, i) => r[i]); if (v.some(x => x != null)) { total = v.reduce((a, x) => a + (x || 0), 0); partial = v.some(x => x == null); } }
  else if (g.points !== '' && g.points != null && !isNaN(+g.points)) total = +g.points;
  if (total == null && hasSheet(g) && !isNaN(+g.sheet)) { total = +g.sheet; paper = true; }
  let pct = percentWith(total, max, s.scale);
  if (total == null && g.read && !(g.tries && g.tries.length)) { const d = g.read; paper = true; total = d.score; if (d.outOf != null) max = d.outOf; pct = d.pct != null ? d.pct : percentWith(total, max, s.scale); }
  const one = addXc({ total, max, pct, partial, paper, status: g.status || '', rows: rub ? s.criteria.map((c, i) => rowTop(s, i) === ROW_TOP ? [c, r[i]] : [c, r[i], rowTop(s, i)]).filter(x => x[1] != null) : [] }, g.xc, max, g.xcU);
  if (!g.tries || !g.tries.length) return one;
  const out = withTries(one, g.tries, max, one.total != null && !partial);   // a retake: the try that counts by the teacher's rule (start.js)
  if (out.outOf != null) { out.max = out.outOf; delete out.outOf; }
  return out;
}
// The class a saved download belongs to: its assignment card's, else what it saved, else the roster naming at least half its students (the rule the app itself opens with).
function pastClass(d, m) {
  const f = m.asg && findItem(m.asg);
  if (f) return f.it.classId || '';
  if (d.cls != null) return classById(d.cls) ? d.cls : '';
  const keys = Object.keys({ ...d.s, ...d.read });
  let best = '', bn = 0;
  for (const k of lib.classes) if (k.names.length) { const n = rosterPairs(k.names, keys).size; if (n > bn) { bn = n; best = k.id; } }
  return bn >= Math.max(2, keys.length / 2) ? best : '';
}
// When the work in a saved download was last done. d.t is just its last save, and opening a download to look at it saves it.
function workTime(d) {
  const all = Object.values(d.s || {}).flatMap(r => { const g = r.g || {}; return [r.at, g.at, ...Object.values(g.atR || {})]; }).filter(Boolean);
  return all.length ? Math.max(...all) : 0;
}
// Other downloads' scores and comments, read once per open download. Older copies and other copies of this same assignment aren't past work.
let histAll = null;
function histLoad() {
  if (histAll && histAll.id === batch.id) return histAll;
  const me = histAll = { id: batch.id, list: null }, asg = batch.assignment && batch.assignment.id;
  earlierWork(batch.id, d => hasWork(d) || !!(d && d.read)).catch(e => { console.error(e); return []; }).then(all => {
    const gone = (m, d) => (m.newer && keptMeta.has(m.newer)) || (asg && m.asg === asg) || (d.carry && d.carry.from === me.id) || (!hasWork(d) && !!m.name && m.name === batch.name);   // a copy with only the paper's own grades, of this same assignment: there was nothing in it to carry over
    me.list = all.filter(([k, d]) => !gone(keptMeta.get(k) || {}, d)).map(([id, d]) => {
      const m = keptMeta.get(id) || {}, f = m.asg && findItem(m.asg), s = {};
      for (const [k, o] of Object.entries(d.s || {})) if (o && o.g) s[k] = o.g;
      for (const [k, r] of Object.entries(d.read || {})) s[k] = { ...s[k], read: r };
      return { id, s, t: workTime(d) || d.t || m.t || 0, setup: d.setup, name: (f && f.it.name) || m.name || 'An earlier download', cls: pastClass(d, m) };
    });
    if (histAll === me && batch && batch.id === me.id) histFill();
  });
  return me;
}
const histHas = (d, k) => { const p = pastScore(d.setup, d.s[k]); return p.total != null || p.pct != null || !!p.status || !!(d.s[k].comment || '').trim(); };
function pairsIn(d, names) {
  const sig = names.join('\n');
  if (d.pairSig !== sig) { d.pairSig = sig; d.pairs = rosterPairs(names, Object.keys(d.s)); }
  return d.pairs;
}
// sure: past work that's this student. ask: names that might be, whose scores stay hidden until she says. no: ones she said aren't.
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
function histRow({ d, k, you }) {
  const g = d.s[k], p = pastScore(d.setup, g), other = batchClass() && d.cls !== batchClass().id && classById(d.cls);
  const sc = p.total != null ? '<b>' + fmtNum(p.total) + '</b> / ' + p.max + (p.pct != null ? ' · ' + fmtPct(p.pct) : '') : p.pct != null ? '<b>' + fmtPct(p.pct) + '</b>' : p.status ? '' : '<span class="muted">No score in the app. The paper may have one.</span>';
  return '<div class="hrow"><div class="hhd"><b class="hnm" title="' + esc(d.name) + '">' + esc(d.name) + '</b><span class="muted">' + (d.t ? new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '') + '</span></div>' +
    '<div>' + sc + (p.paper ? ' <span class="stag">on the paper</span>' : '') + (p.partial ? ' <span class="stag">partial</span>' : '') + (p.status ? ' <span class="stag">' + STATUS_LABEL[p.status].toLowerCase() + '</span>' : '') + '</div>' +
    (p.rows.length ? '<div class="muted hsm">' + p.rows.map(([c, v]) => esc(c) + ' ' + fmtNum(v)).join(' · ') + '</div>' : '') +
    ((g.comment || '').trim() ? '<div class="hcm">' + esc(g.comment.trim()) + '</div>' : '') +
    (other ? '<div class="muted hsm">In ' + esc(other.name) + '</div>' : '') +
    (you ? '<div class="muted hsm">You said “' + esc(k) + '” is this student. <button class="link" data-hist="" data-hk="' + esc(you) + '">Undo</button></div>' : '') + '</div>';
}
function histAskRow(a) {
  const where = a.n > 1 ? a.n + ' downloads' : esc(a.d.name), other = classById(a.d.cls);
  const why = a.same ? 'The name is close, but it isn’t a sure match.' : other ? 'The same name, but in ' + esc(other.name) + '. It may be someone else.' : 'The same name, but no roster to confirm it.';
  return '<div class="hask"><div><b>“' + esc(a.x) + '”</b> in ' + where + '. ' + why + ' Its scores stay hidden until you say.</div>' +
    '<button class="btn sm" data-hist="1" data-hk="' + esc(a.hk) + '">Same student</button> <button class="btn sm" data-hist="0" data-hk="' + esc(a.hk) + '">Not them</button></div>';
}
function histPanel(st) {
  if (anonOn()) return '';
  const all = histLoad();
  if (!all.list || !all.list.length) return '';
  const r = histFind(st, all.list), c = r.me.c, nAsk = r.ask.size, last = r.sure[0] && pastScore(r.sure[0].d.setup, r.sure[0].d.s[r.sure[0].k]);
  const note = r.me.onRoster ? '' : c ? 'This name isn’t a clear match on the ' + esc(c.name) + ' roster, so past work can’t be matched for sure.' : 'No roster is picked for this download, so past work can’t be matched for sure.';
  if (!r.sure.length && !nAsk && !r.no.size && !note) return '';
  const lastT = last && last.pct != null ? ' · last ' + fmtPct(last.pct) : '';
  return '<details class="hist" id="histBox"' + (store.get('gs.histOpen', false) ? ' open' : '') + '><summary>Past work <span class="muted">' + (r.sure.length ? r.sure.length + ' earlier' + lastT : 'none matched') + '</span>' + (nAsk ? ' <span class="stag">' + nAsk + ' to check</span>' : '') + '</summary>' +
    (note ? '<p class="muted hsm">' + note + '</p>' : '') + r.sure.map(histRow).join('') + [...r.ask.values()].map(histAskRow).join('') +
    [...r.no.values()].map(a => '<div class="muted hsm">You said “' + esc(a.x) + '” isn’t this student. <button class="link" data-hist="" data-hk="' + esc(a.hk) + '">Ask again</button></div>').join('') + '</details>';
}
const histSlot = st => '<div id="histSlot">' + histPanel(st) + '</div>';
function histFill() { const el = $('#histSlot'); if (el && batch) el.innerHTML = histPanel(batch.students[cur]); }
document.addEventListener('toggle', e => { if (e.target.id === 'histBox') store.set('gs.histOpen', e.target.open); }, true);
$('#grade').addEventListener('click', e => {
  const b = e.target.closest('[data-hist]'); if (!b) return;
  const said = store.get('gs.histSame', {});
  if (b.dataset.hist === '') delete said[b.dataset.hk]; else said[b.dataset.hk] = +b.dataset.hist;
  store.set('gs.histSame', said);
  histFill();
});

/* ---------------- consistency check: whether scores drifted as she went, and same-score papers side by side ---------------- */
// With fewer papers than this, nothing is said about a drift. Below DRIFT_SURE, even a clear gap is only called a maybe.
const DRIFT_MIN = 9, DRIFT_SURE = 20;
const average = a => a.reduce((x, y) => x + y, 0) / a.length;
// How often shuffling the same scores gives a gap this big between the first and last third. The seed is fixed, so the same scores always read the same.
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
// vals: scores in the order she gave them. level: few, none, hint (could be chance) or likely. The chance number stays in here and is never shown.
function driftRead(vals, max, cut = 0.05) {
  const n = vals.length;
  if (n < DRIFT_MIN) return { n, level: 'few' };
  const third = Math.floor(n / 3), early = average(vals.slice(0, third)), late = average(vals.slice(-third)), gap = late - early;
  const chance = driftChance(vals, third, gap), small = Math.abs(gap) < max * 0.05;
  return { n, third, early, late, gap, chance, dir: gap < 0 ? 'harder' : 'softer', level: chance >= cut || small || !gap ? 'none' : n < DRIFT_SURE ? 'hint' : 'likely' };
}
// Rounded on purpose: "about 9.5", never 9.47.
const roughStep = max => max > 200 ? 10 : max > 40 ? 2 : max > 20 ? 1 : 0.5;   // fine enough that rounding can't make a gap look much bigger than it is
const roughly = (v, max) => { const step = roughStep(max); return fmtNum(Math.round(v / step) * step); };
// The gap in words is the gap between the two rounded numbers said beside it, so they always add up.
const roughGap = (r, max) => { const g = Math.abs(roughly(r.early, max) - roughly(r.late, max)) || roughStep(max); return fmtNum(g) + (g === 1 ? ' point' : ' points'); };
function driftSay(r, max) {
  if (r.level === 'few') return '<b>Too few papers to say.</b> ' + (r.n ? 'Only ' + r.n + (r.n === 1 ? ' paper has' : ' papers have') + ' a time to go by so far.' : 'No papers have a time to go by so far.') + ' It takes at least ' + DRIFT_MIN + ' before this will say anything about getting harder or softer. Any pattern in fewer is mostly chance.';
  const nums = 'Your first ' + r.third + ' papers average about ' + roughly(r.early, max) + ' and your last ' + r.third + ' about ' + roughly(r.late, max) + ', out of ' + max + '.';
  if (r.level === 'none') return '<b>No clear change.</b> ' + nums + ' ' + (r.n < DRIFT_SURE ? 'With ' + r.n + ' papers only a big change would show, so this doesn’t prove you stayed even.' : 'A gap that size often happens by chance.');
  const way = 'Later papers scored ' + (r.gap < 0 ? 'lower' : 'higher') + ', by about ' + roughGap(r, max) + '.';
  const why = 'It could mean you got ' + r.dir + ' as you went, or just that those papers were ' + (r.gap < 0 ? 'weaker' : 'stronger') + '. Look at a few early and late papers with the same score.';
  if (r.level === 'hint') return '<b>Maybe, but it’s too soon to be sure.</b> ' + way + ' ' + nums + ' With ' + r.n + ' papers this could easily be chance. ' + why;
  return '<b>Worth a look.</b> ' + way + ' ' + nums + ' That’s bigger than chance usually makes with ' + r.n + ' papers. ' + why;
}
// When a paper got its score: the last rubric row she set, or the last change on a points score. A comment changed afterwards doesn't count.
function scoreTime(g) {
  const rows = setup.mode === 'rubric' ? Object.entries(g.atR || {}).filter(([i]) => +i < setup.criteria.length).map(x => x[1]) : g.atR && g.atR.points ? [g.atR.points] : [];
  return rows.length ? Math.max(...rows) : g.at || null;
}
// Three or more changes inside a second aren't grading: Bring back from Claude touches every student at once. Their order says nothing.
function dropBatched(sorted) {
  const out = [], off = [];
  let run = [];
  const flush = () => { (run.length >= 3 ? off : out).push(...run); run = []; };
  for (const x of sorted) { if (run.length && x.t - run[run.length - 1].t > 1000) flush(); run.push(x); }
  flush();
  return { out, off };
}
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
// Each rubric row on its own, in the order that row was scored. Several rows mean several chances to see something by chance, so the bar is higher per row.
function rowDrifts() {
  const cut = 0.05 / setup.criteria.length;
  return setup.criteria.map((name, r) => {
    const pts = [];
    for (const st of batch.students) { const v = st.grade.rubric[r], t = st.grade.atR && st.grade.atR[r]; if (!noScore(st) && !st.grade.outAvg && v != null && t) pts.push({ v, t }); }
    const { out } = dropBatched(pts.sort((a, b) => a.t - b.t));
    return { name, top: rowTop(setup, r), read: driftRead(out.map(p => p.v), rowTop(setup, r), cut) };
  });
}
function rowSay(rows) {
  if (setup.mode !== 'rubric' || rows.length < 2) return '';
  if (!rows.some(x => x.read.n >= DRIFT_SURE)) return '<p class="muted hsm">Rubric rows aren’t read one by one with fewer than ' + DRIFT_SURE + ' papers: each row is too noisy on its own.</p>';
  return '<ul class="crows">' + rows.map(({ name, top, read: r }) => '<li><b>' + esc(name) + ':</b> ' + (r.n < DRIFT_SURE ? 'too few papers with a time' : r.level === 'none' ? 'no clear change' : 'later papers ' + (r.gap < 0 ? 'lower' : 'higher') + ', by about ' + roughGap(r, top || ROW_TOP)) + '</li>').join('') + '</ul>';
}
const ordinal = n => { const t = n % 100, u = n % 10; return n + (t > 10 && t < 14 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); };
const whenLabel = t => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
// One dot per paper, in the order she scored them. Up the side is the score; the two short lines are the first and last third's averages.
function driftChart(pts, read, max) {
  const W = 640, H = 210, L = 34, R = 14, T = 18, B = 26, n = pts.length, vs = pts.map(p => p.v);
  const hi = Math.max(max, ...vs), lo = Math.max(0, Math.floor(Math.min(...vs)) - 1), span = Math.max(1, hi - lo), step = span <= 6 ? 1 : span <= 14 ? 2 : span <= 40 ? 5 : 10;
  const x = i => n < 2 ? (L + W - R) / 2 : L + 12 + i * (W - L - R - 24) / (n - 1), y = v => T + (hi - v) * (H - T - B) / span;
  let h = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dchart" role="group" aria-label="Scores in the order you gave them. The same scores are in the list under the chart.">';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) h += '<line class="dgrid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="dax" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + fmtNum(v) + '</text>';
  h += '<text class="dax" x="' + L + '" y="' + (H - 6) + '">First scored</text><text class="dax" x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">Last scored</text>';
  if (read.level !== 'few') {
    const seg = (a, b, v, end) => '<line class="dmean" x1="' + (x(a) - 8) + '" x2="' + (x(b) + 8) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="dlab" x="' + (end ? x(b) + 8 : x(a) - 8) + '" y="' + (y(v) - 10) + '"' + (end ? ' text-anchor="end"' : '') + '>about ' + roughly(v, max) + '</text>';
    h += seg(0, read.third - 1, read.early) + seg(n - read.third, n - 1, read.late, true);
  }
  pts.forEach((p, k) => {
    const name = shownName(batch.students[p.i], p.i);
    h += '<g class="dpt"><circle class="dhit" cx="' + x(k) + '" cy="' + y(p.v) + '" r="12" tabindex="0" role="button" aria-label="' + esc(name + ', ' + fmtNum(p.v) + ' out of ' + max + ', scored ' + ordinal(k + 1)) + '" data-open="' + p.i + '" data-v="' + esc(fmtNum(p.v) + ' / ' + max) + '" data-who="' + esc(name) + '" data-pos="' + esc('Scored ' + ordinal(k + 1)) + '"/><circle class="ddot" cx="' + x(k) + '" cy="' + y(p.v) + '" r="4.5"/></g>';
  });
  return '<div class="dwrap">' + h + '</svg><div class="dtip" id="consTip" hidden><b></b><span></span></div></div>';
}
function openCons() {
  const { pts, noTime, off, groups } = consData(), max = maxPoints(), read = driftRead(pts.map(p => p.v), max);
  const left = [noTime.length ? noTime.length + (noTime.length === 1 ? ' has' : ' have') + ' no time (scored before the app kept them, or read off the paper)' : '', off.length ? off.length + ' changed all at once, like bringing Claude’s feedback back, so their order isn’t known' : ''].filter(Boolean);
  const same = [...groups].filter(([, l]) => l.length > 1).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])), single = groups.size - same.length;
  tabNext('insights/consistency');
  openDlg('<div class="bh"><h2>Insights</h2>' + insTabs('cons') + '<button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div><div class="bb" id="consBox">' +
    '<h3 class="chd">Did you get harder or softer as you went?</h3><p class="csay" id="consSay">' + driftSay(read, max) + '</p>' +
    (pts.length ? driftChart(pts, read, max) + rowSay(rowDrifts()) : '') +
    '<p class="muted hsm">This goes by when each score last changed, so a paper you came back to counts as late. Finished scores only.' + (left.length ? ' Left out: ' + left.join('; ') + '.' : '') + '</p>' +
    (pts.length ? '<details class="clist"><summary>See these as a list</summary><table class="gl"><thead><tr><th>Order</th><th>' + (anonOn() ? 'Paper' : 'Student') + '</th><th>Score</th><th>Scored</th></tr></thead><tbody>' +
      pts.map((p, k) => '<tr><td class="n">' + (k + 1) + '</td><td><button class="link" data-open="' + p.i + '">' + esc(shownName(batch.students[p.i], p.i)) + '</button></td><td>' + fmtNum(p.v) + ' / ' + max + '</td><td>' + esc(whenLabel(p.t)) + '</td></tr>').join('') + '</tbody></table></details>' : '') +
    '<h3 class="chd">The same score, side by side</h3>' +
    (same.length ? '<p class="muted hsm" style="margin-top:0">Pick a score to see those papers next to each other.' + (single ? ' Scores with just one paper aren’t listed.' : '') + '</p><div class="cchips">' + same.map(([v, l]) => '<button class="btn sm" data-same="' + v + '"><b>' + sameLabel(v) + '</b>&nbsp;' + l.length + ' papers</button>').join('') + '</div>'
      : '<p class="muted hsm" style="margin-top:0">No two papers share a finished score yet.</p>') +
    '</div>', false);
  const box = $('#dlgBox'), tip = $('#consTip');
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const o = e.target.closest('[data-open]'); if (o) { return toPaper(+o.dataset.open); }
    const s = e.target.closest('[data-same]'); if (s) return openSame(isNaN(+s.dataset.same) ? s.dataset.same : +s.dataset.same);
    const tb = e.target.closest('[data-ovtab]'); if (tb && tb.dataset.ovtab !== 'cons') { openOverview(tb.dataset.ovtab).then(() => { const b = $('#dlgBox [data-ovtab="' + ovTab + '"]'); if (b) b.focus(); }); }
  };
  if (!tip) return;
  const wrap = tip.parentNode, show = el => {
    tip.firstChild.textContent = el.dataset.v; tip.lastChild.textContent = el.dataset.who + ' · ' + el.dataset.pos; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    tip.style.left = Math.min(w.width - tip.offsetWidth, Math.max(0, r.left - w.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = Math.max(0, r.top - w.top - tip.offsetHeight - 2) + 'px';
  };
  const hit = e => e.target.closest && e.target.closest('.dhit');
  wrap.addEventListener('pointerover', e => { if (hit(e)) show(hit(e)); });
  wrap.addEventListener('pointerout', e => { if (hit(e)) tip.hidden = true; });
  wrap.addEventListener('focusin', e => { if (hit(e)) show(hit(e)); });
  wrap.addEventListener('focusout', e => { if (hit(e)) tip.hidden = true; });
  wrap.addEventListener('keydown', e => { if (hit(e) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toPaper(+hit(e).dataset.open); } });
}
const sameLabel = v => typeof v === 'number' ? fmtNum(v) : v.split('/').map(x => fmtNum(+x)).join(' / ');
// One column per paper, drawn one after another, each turning its own pages. During anonymous grading sharePage's name covers are on.
async function openSame(v) {
  await ensureCounts();
  const list = consData().groups.get(v) || [];
  openDlg('<div class="bh"><h2>Papers scored ' + esc(typeof v === 'number' ? fmtNum(v) + ' / ' + maxPoints() : sameLabel(v)) + '</h2><span class="muted">' + list.length + ' papers</span><button class="btn sm" data-back style="margin-left:auto">◀ Back</button><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb sbs" id="sbsBody">' + list.map(i => {
      const st = batch.students[i], rx = anonOn() ? anonRx(st) : null, g = st.grade, pages = shareDocs(st).flatMap(d => d.pages);
      const rows = setup.mode === 'rubric' ? setup.criteria.map((c, r) => g.rubric[r] == null ? '' : esc(c) + ' ' + fmtNum(g.rubric[r])).filter(Boolean).join(' · ') : '';
      return '<div class="sbsc" data-i="' + i + '"><div class="sbsh"><button class="link" data-open="' + i + '"><b>' + esc(shownName(st, i)) + '</b></button>' + statusPills(gradeOf(st)) +
        (rows ? '<div class="muted hsm">' + rows + '</div>' : '') + ((g.comment || '').trim() ? '<div class="hcm">' + esc(scrub(g.comment.trim(), rx)) + '</div>' : '') + '</div>' +
        (pages.length ? '<div class="sbsnav"><button class="btn sm" data-pg="-1" aria-label="Earlier page">‹</button><span class="muted"></span><button class="btn sm" data-pg="1" aria-label="Later page">›</button></div><div class="sbsp"></div>'
          : '<p class="muted hsm">' + (st.files.length ? 'No PDF or picture to show here. Open the paper to read it.' : 'No paper.') + '</p>') + '</div>';
    }).join('') + '</div>');
  const box = $('#dlgBox'), body = $('#sbsBody'), cols = new Map();
  for (const el of body.querySelectorAll('.sbsc')) { const st = batch.students[+el.dataset.i]; cols.set(el, { el, st, pages: shareDocs(st).flatMap(d => d.pages), at: 0, tok: 0 }); }
  (async () => { for (const c of cols.values()) { if (!body.isConnected) return; if (c.pages.length) await sbsDraw(c); } })();
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-back]')) return openCons();
    const o = e.target.closest('[data-open]'); if (o) { return toPaper(+o.dataset.open); }
    const b = e.target.closest('[data-pg]'); if (!b) return;
    const c = cols.get(b.closest('.sbsc')), at = c.at + +b.dataset.pg;
    if (at >= 0 && at < c.pages.length) { c.at = at; sbsDraw(c); }
  };
}
async function sbsDraw(c) {
  const my = ++c.tok, spot = c.el.querySelector('.sbsp'), [path, p] = c.pages[c.at], f = fileByPath(c.st, path), nav = c.el.querySelectorAll('.sbsnav button');
  c.el.querySelector('.sbsnav span').textContent = 'Page ' + (c.at + 1) + ' of ' + c.pages.length;
  nav[0].disabled = c.at === 0; nav[1].disabled = c.at === c.pages.length - 1;
  await workerReady;
  let js;
  try {
    js = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
    const pg = await js.getPage(p + 1), v1 = vpRot(f, p, pg, 1), dpr = window.devicePixelRatio || 1, marks = f.marks[p] || [];
    const wide = v1.width + (marks.some(m => m.t === 'note') ? sideFor(v1.width) : 0), k = Math.min(1.6, (spot.clientWidth || 380) / wide);
    const r = await sharePage(c.st, f, js, p, k * dpr, anonOn() ? anonRx(c.st) : null);
    if (my !== c.tok || !spot.isConnected) return;
    Object.assign(r.c.style, { width: (r.W + r.side) * k + 'px', height: r.H * k + 'px', display: 'block', background: '#fff' });
    spot.replaceChildren(r.c);
  } catch (er) { console.error(er); if (my === c.tok) spot.innerHTML = '<p class="muted hsm">This page couldn’t be drawn.</p>'; }
  finally { if (js) js.destroy(); }
}
$('#consBtn').onclick = openCons;

/* ---------------- the Claude steps, and which papers have had their name covers checked ---------------- */
// share.checked: { 'path|page': the file's size when she looked }, so a page is only checked for the file she saw. A paper is checked when all of its pages are.
// all: every paper she'll see while grading anonymously. Without it, the papers that go in the ZIP, which leaves out a bare paper once other papers have marks.
const coverList = all => { const list = []; for (const st of batch.students) shareDocs(st, all).forEach((d, k) => list.push({ st, d, k })); return list; };
const coverSig = f => (f.data && f.data.length) || 0;
function coverOk(st, d) {
  const c = shareState().checked || {};
  return d.pages.every(([path, p]) => { const f = fileByPath(st, path); return !!f && c[boxKey(path, p)] === coverSig(f); });
}
function coverMark(st, d, on) {
  const c = (shareState().checked ||= {});
  for (const [path, p] of d.pages) { if (on) c[boxKey(path, p)] = coverSig(fileByPath(st, path)); else delete c[boxKey(path, p)]; }
  saveSoon();
}
// A page turned: her own boxes are fractions of the page, so they turn with it, and the page needs another look. Called for every turn and undo, by how far it went.
function coverTurn(f, p, by) {
  const sh = batch && batch.share, k = boxKey(f.path, p), fx = v => Math.round(v * 10000) / 10000;
  if (!sh || !by) return;
  if (sh.checked) delete sh.checked[k];
  const list = (sh.boxes && sh.boxes[k]) || [];
  const off = (sh.off && sh.off[k]) || [];
  for (let n = (by + 360) % 360; n > 0; n -= 90) for (const b of list.concat(off)) [b[0], b[1], b[2], b[3]] = [fx(1 - b[1] - b[3]), b[0], b[3], b[2]];
}
// She needs another look at this page.
function coverAgain(path, p) { const sh = batch && batch.share; if (sh && sh.checked) delete sh.checked[boxKey(path, p)]; }
// A page's boxes as they are, so Undo can put back a straightening's move exactly.
function coverCopy(f, p) { const sh = batch && batch.share, b = sh && sh.boxes && sh.boxes[boxKey(f.path, p)]; return b ? JSON.stringify(b) : null; }
function coverPut(f, p, was) {
  const sh = batch && batch.share; if (!sh || !sh.boxes) return;
  const k = boxKey(f.path, p);
  if ((sh.boxes[k] ? JSON.stringify(sh.boxes[k]) : null) === was) return;
  coverAgain(f.path, p);
  if (was) sh.boxes[k] = JSON.parse(was); else delete sh.boxes[k];
}
const coverName = (st, k) => (anonOn() ? shownName(st, batch.students.indexOf(st)) : st.key) + (k ? ' (paper ' + (k + 1) + ')' : '');
const coverFirst = all => Math.max(0, coverList(all).findIndex(x => !coverOk(x.st, x.d)));
// Pages are counted as a download opens. Until then the list of papers is short, so any number would be wrong.
const stillCounting = () => batch.students.some(s => s.files.some(f => viewable(f) && !f.numPages && !f.bad));
function coverLine(all) {
  if (stillCounting()) return 'Counting the papers…';
  const list = coverList(all), n = list.filter(x => coverOk(x.st, x.d)).length;
  if (!list.length) return 'No PDFs or pictures to check.';
  return n + ' of ' + list.length + (list.length === 1 ? ' paper' : ' papers') + ' checked.';
}
const SHARE_ASK = 'The attached ZIP has my students’ papers with the names removed. Please read README.txt first.\n\nFor each student, write short feedback I can check and then paste into my gradebook: what’s working, and one or two things to work on, tied to the rubric in rubric.json and to my marks on the paper. Start each student’s feedback with their code on its own line. Don’t try to work out who anyone is.';
const nameFreeText = t => scrub(t, classRx());
// Who goes in the ZIP and, said plainly, who doesn't.
function shareWho() {
  const who = batch.students.filter(st => shareDocs(st).length), counting = stillCounting();
  if (counting) return '';
  return !who.length ? 'No one can go in it yet.' : who.length + (who.length === 1 ? ' student gets' : ' students get') + ' a random code, like <b>' + esc(codeOf(who[0])) + '</b>.';
}
function shareOut() {
  if (stillCounting()) return '';
  const name = st => esc(shownName(st, batch.students.indexOf(st))), word = [], left = [], none = []; let more = 0;
  for (const st of batch.students) {
    const files = st.files.filter(f => !f.virtual), other = files.filter(f => !viewable(f) || f.bad).length;
    if (shareDocs(st).length) more += other;
    else if (!files.length) none.push(st);
    else if (other === files.length) word.push(st);
    else left.push(st);
  }
  const line = (list, say) => list.length ? '<li>' + list.length + (list.length === 1 ? ' student: ' : ' students: ') + list.map(name).join(', ') + '. ' + say + '</li>' : '';
  const lines = line(word, 'Only Word or other files that can’t go in. Save them as PDFs to include them.') + line(left, 'Their papers are left out, because they have no marks while other papers do, or you left them out in Arrange pages.') + line(none, 'No paper.') +
    (word.length + left.length + none.length ? '<li>The scores and comments of the students above stay out too.</li>' : '') +
    (more ? '<li>' + more + (more === 1 ? ' Word or other file' : ' Word or other files') + ' from students who are going in. Only their PDFs and pictures go.</li>' : '');
  return lines ? '<div class="bbmiss" id="shOut" style="margin-bottom:12px"><b>Not in the ZIP:</b><ul style="list-style:disc;margin:4px 0 0;padding-left:20px">' + lines + '</ul></div>' : '';
}
// What's said about the ZIP before she makes it: it only says it has no names when nothing is still in doubt.
function shareMadeLine() {
  const sh = shareState();
  return sh.made ? 'Made ' + esc(whenLabel(sh.made)) + (sh.madeOpen ? ', with ' + sh.madeOpen + (sh.madeOpen === 1 ? ' paper' : ' papers') + ' not checked.' : '.') : (namesInDoubt() ? 'Box the names the cover can’t read first. It' : namesLooking() || nameFlagged().length ? 'Check the papers listed above first. It' : nameFindOn() || coverList().every(x => coverOk(x.st, x.d)) ? 'It has no names in it, and it' : 'It') + ' stays on your computer until you give it to Claude.';
}
function shareSteps() {
  const sh = shareState(), list = coverList().map((x, i) => ({ ...x, i, ok: coverOk(x.st, x.d) })), todo = list.filter(x => !x.ok), done = list.filter(x => x.ok);
  const item = x => '<li><button class="link" data-cc="' + x.i + '">' + (x.ok ? '<span aria-hidden="true">✓ </span>' : '') + esc(coverName(x.st, x.k)) + '</button> <span class="muted">' + esc(codeOf(x.st)) + (x.k ? '-' + (x.k + 1) : '') + '</span></li>';
  const group = (id, title, g, open) => g.length ? '<details class="cclist" id="' + id + '"' + (open ? ' open' : '') + '><summary>' + title + ' (' + g.length + ')</summary><ul>' + g.map(item).join('') + '</ul></details>' : '';
  const counting = stillCounting(), nothing = !counting && !list.length;
  if ($('#shWho')) $('#shWho').innerHTML = shareWho();
  if ($('#shPromise')) $('#shPromise').textContent = namePromise();
  $('#shSteps').innerHTML = shareOut() + nameWarnings() + '<div id="nameFlags" data-before="before you make the ZIP">' + nameFlagsHtml('before you make the ZIP') + '</div><ol class="shsteps">' +
    '<li><b>Check the covers.</b> <span id="shCount"' + (todo.length ? ' class="stag"' : '') + '>' + (todo.length || !list.length ? '' : '<span aria-hidden="true">✓ </span>') + esc(coverLine()) + '</span> ' + (nameFindOn() ? 'Typed names are found on their own. Drag a box over anything missed, like handwriting.' : 'Drag a box over each name.') + ' If names are in the same spot, box it once and use it on every paper.' + group('ccTodo', 'Not checked yet', todo, true) + group('ccDone', 'Checked', done, !todo.length) + '</li>' +
    '<li><b>Download the ZIP.</b> <span id="shMade">' + shareMadeLine() + '</span></li>' +
    '<li><b>Give it to Claude,</b> with this message. Change it however you like.<textarea id="shAsk" rows="4" aria-label="What to say to Claude"></textarea><div class="shrow"><button class="btn sm" data-shcopy>Copy the message</button><button class="btn sm" data-shopen>Open Claude ↗</button></div></li>' +
    '<li><b>Bring the reply back.</b> <button class="btn sm" data-shback>Bring back from Claude</button></li></ol>';
  $('#shAsk').value = sh.ask != null ? sh.ask : SHARE_ASK;
  $('#shAsk').oninput = e => { sh.ask = e.target.value; saveSoon(); };
  // Nothing stops her making the ZIP, but until every paper is checked the check is the main button and the ZIP says what it's skipping.
  const box = $('#dlgBox'), chk = box.querySelector('[data-check]'), mk = box.querySelector('[data-make]'), left = todo.length && list.length;
  chk.className = 'btn' + (left ? ' primary' : ''); mk.className = 'btn' + (left ? '' : ' primary');
  chk.textContent = !list.length ? 'Check the covers' : !left ? 'Check the covers again' : todo.length === list.length ? 'Check the covers' : 'Check the other ' + todo.length;
  chk.disabled = mk.disabled = nothing;
  mk.textContent = left ? 'Download ZIP anyway' : 'Download ZIP for Claude';
}
// A click on one of the steps; true if it was.
function shareStepClick(e) {
  const c = e.target.closest('[data-cc]');
  if (c) { checkCovers(+c.dataset.cc); return true; }
  if (e.target.closest('[data-shcopy]')) { const t = nameFreeText($('#shAsk').value); copy(t, 'Copied. Paste it into Claude along with the ZIP.'); return true; }
  if (e.target.closest('[data-shopen]')) { window.open('https://claude.ai/new', '_blank', 'noopener'); return true; }
  if (e.target.closest('[data-shback]')) { closeDlg(); openBringBack(); return true; }
  return false;
}
function shareMade() {
  const sh = shareState(), list = coverList();
  sh.made = Date.now(); sh.madeOpen = list.filter(x => !coverOk(x.st, x.d)).length;
  sh.sent = [...new Set(list.map(x => codeOf(x.st)))];
  saveSoon(); shareSteps();
}
// What's worth saying about a reply before it goes in: who it left out, and any [name] it still has.
function bringBackNotes(fb, byCode) {
  // A student can have two codes after working on two computers: feedback under either counts.
  const sent = shareState().sent || [], got = new Set([...fb.keys()].map(c => byCode.get(c))), miss = sent.filter(c => byCode.has(c) && !got.has(byCode.get(c))), who = [...new Set(miss.map(c => byCode.get(c)))], nm = [...fb].filter(([c, v]) => byCode.has(c) && /\[name\]/i.test(v)).length;
  if (!fb.size) return '';
  return (miss.length ? '<div class="bbmiss" id="bbMiss"><b>No feedback yet for ' + who.length + (who.length === 1 ? ' paper' : ' papers') + ':</b> ' + who.map(st => esc(shownName(st, batch.students.indexOf(st)))).join(', ') + '. <button class="link" data-bbmore="' + esc(miss.join(', ')) + '">Copy a note asking Claude for these</button></div>' : '') +
    (nm ? '<p class="muted hsm" id="bbNm">' + nm + (nm === 1 ? ' reply still says' : ' replies still say') + ' [name]. Change it to the student’s name in the comment box, or leave it out.</p>' : '');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-bbmore]'); if (b) copy('Please continue with feedback for these codes, in the same format: ' + b.dataset.bbmore, 'Copied. Paste it into Claude.'); });

Object.assign(window.__gs, { nameFit, nameNear, rosterPairs, pastScore, tryGrade, retakeStart, retakeOff, tryOfFile, retakeRule, histFind, histFill, driftRead, driftSay, dropBatched, consData, openCons, openSame, coverList, coverOk, coverLine, coverFirst, checkCovers, SHARE_ASK, nameFreeText, paperReads });
