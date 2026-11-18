// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, setup, pages, once, saveSoon, toast, renderList, renderGrade, openStudent, groupJust, groupNoteRefresh, groupBandRefresh, rowTop, maxPoints, gradeOf, xcSay, fmtNum, noScore, ibSetup } from './gcore.js';
import { viewable, draw, shownName, one, stampHidden, tnHasG, tnMine } from './gdraw.js';
import { gradeSnap, changed, touchGrade, groupOf } from './gmark.js';

// src/app/panels.js
function critStampOf(st, i) {
  const v = st.grade.rubric[i]; if (v == null || i < 0 || i >= setup.criteria.length) return null;
  const ib = ibSetup() && setup.ib[i];
  return ib ? { of: ib, name: ib, text: fmtNum(v) } : { of: setup.criteria[i], name: setup.criteria[i], text: fmtNum(v) + '/' + rowTop(setup, i) };
}
// src/app/panels.js
const critRowOf = m => setup.mode !== 'rubric' ? -1 : ibSetup() ? setup.ib.indexOf(m.of) : setup.criteria.indexOf(m.of);
// src/app/panels.js
function scoreStampText(gr, st) {
  if (ibSetup()) return ibStampText(st || batch.students[cur]);
  const max = gr.outOf != null ? gr.outOf : maxPoints();
  // Extra credit goes on a line of its own under the score it was added to: "17/20 = 85% + 5% extra credit" (src/stamps.js draws the three lines).
  if (gr.xc && gr.base != null) return fmtNum(gr.base) + (max ? '/' + fmtNum(max) : '') + (gr.bpct != null ? ' = ' + gr.bpct + '%' : '') + ' + ' + xcSay(gr) + ' extra credit';
  return fmtNum(gr.total) + (max ? '/' + fmtNum(max) : '') + (gr.pct != null ? ' = ' + gr.pct + '%' : '');
}
// src/app/panels.js
function syncScoreStamps(st) {
  if (!st || noScore(st)) return false;
  const gr = gradeOf(st);
  const text = gr.total == null || gr.paper ? null : scoreStampText(gr, st);   // a score read off the paper itself isn't the app's own
  let changed = false;
  for (const f of st.files) {
    if (!f.marks || tryOfFile(st, f)) continue;
    for (const l of Object.values(f.marks)) for (const m of l || []) {
      if (m.t !== 'stamp' || stampHidden(m, st.key)) continue;
      if (m.k === 'score' && text != null && m.text !== text) { m.text = text; changed = true; }
      if (m.k === 'crit') { const c = critStampOf(st, critRowOf(m)); if (c && (m.text !== c.text || m.name !== c.name)) { m.text = c.text; m.name = c.name; changed = true; } }
    }
  }
  return changed;
}
// src/grades.js
const STATUS_LABEL = { missing: 'Missing', excused: 'Excused', late: 'Late' };
// src/grades.js
const hasSheet = g => g.sheet != null && g.sheet !== '';
// src/grades.js
const gradeHasWork = g => !!g && ((g.rubric || []).some(v => v != null) || (g.points != null && g.points !== '') || (g.pk != null && g.pk !== '') || hasSheet(g) || !!g.comment || !!g.status || !!g.fb || !!+g.xc || tnHasG(g));
// src/grades.js
const wordsJoin = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('');
// src/grades.js
const stampWait = new Set();
// src/grades.js
function stampSoon(st) {
  if (stampWait.has(st)) return;
  stampWait.add(st);
  setTimeout(() => {
    stampWait.delete(st);
    if (!batch || !batch.students.includes(st) || !syncScoreStamps(st)) return;
    if (st === batch.students[cur]) for (const pg of pages) draw(pg);
    saveSoon();
  }, 0);
}
// src/grades.js
function tryOfFile(st, f) {
  const ts = st && st.grade && st.grade.tries; if (!ts || !ts.length || !f) return 0;
  const i = ts.findIndex(t => (t.files || []).includes(f.path));
  return i < 0 ? 0 : i + 1;
}
// src/groups.js
function groupMates(st) { const g = groupOf(st); return g ? g.k.filter(k => k !== st.key).map(k => batch.students.find(s => s.key === k)).filter(Boolean) : []; }
// src/groups.js
function groupNames(list) { return wordsJoin(list.map(s => shownName(s, batch.students.indexOf(s)))); }
// src/groups.js
function groupFileOf(g, st) { const p = g.p && g.p[st.key]; return p ? st.files.find(f => f.path === p) || null : null; }
// src/groups.js
const GROUP_SKIP = new Set(['reads', 'sent', 'anchor']);   // a partner's paper exported on its own isn't the others'
// src/groups.js
function groupGradeCopy(to, from) {
  const a = to.grade, b = from.grade;
  for (const k of Object.keys(a)) if (!GROUP_SKIP.has(k) && !(k in b)) delete a[k];
  for (const [k, v] of Object.entries(b)) if (!GROUP_SKIP.has(k)) a[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
  if (!a.rubric) a.rubric = [];
}
// src/groups.js
const GROUP_NOTES = ['tn'];   // typed notes; the comment branches off, one for each partner
// src/groups.js
const groupOwn = g => !!(g && g.own);
// src/groups.js
const groupAdj = g => !!(g && g.own === 2);
// src/groups.js
const ADJ_KEYS = ['points', 'pk', 'xc', 'xcU', 'status'];
// src/groups.js
const adjFields = sts => [...Array(Math.max(0, ...sts.map(s => (s.grade.rubric || []).length), setup && setup.criteria ? setup.criteria.length : 0)).keys(), ...ADJ_KEYS];
// src/groups.js
const adjGet = (gr, f) => JSON.stringify(typeof f === 'number' ? (gr.rubric || [])[f] ?? null : gr[f] ?? null);
// src/groups.js
function adjPut(gr, f, from) {
  if (typeof f === 'number') { (gr.rubric ||= [])[f] = (from.rubric || [])[f] ?? null; }
  else if (from[f] == null) delete gr[f]; else gr[f] = JSON.parse(JSON.stringify(from[f]));
  const t = from.atR && from.atR[f]; if (t) (gr.atR ||= {})[f] = t;
}
// src/groups.js
const adjTime = (gr, f) => (gr.atR && gr.atR[f]) || gr.at || 0;
// src/groups.js
function adjSync(sts) {
  let changed = false;
  for (const f of adjFields(sts)) {
    const free = sts.filter(s => !(s.grade.adj && s.grade.adj[f])); if (!free.length) continue;
    // a partner scored with Write for: Just them, whose value differs from the rest: it's theirs now
    for (const s of free) if (groupJust === s.key && free.length > 1) { const rest = free.filter(x => x !== s), v = adjGet(rest[0].grade, f); if (rest.every(x => adjGet(x.grade, f) === v) && adjGet(s.grade, f) !== v) { (s.grade.adj ||= {})[f] = 1; changed = true; } }
    const live = free.filter(s => !(s.grade.adj && s.grade.adj[f])); if (live.length < 2) continue;
    const src = live.reduce((a, s) => (adjTime(s.grade, f) > adjTime(a.grade, f) ? s : a), live[0]), v = adjGet(src.grade, f);
    for (const s of live) if (s !== src && adjGet(s.grade, f) !== v) { adjPut(s.grade, f, src.grade); changed = true; stampSoon(s); }
  }
  return changed;
}
// src/groups.js
function adjReset(st, f) {
  const g = groupOf(st); if (!g) return;
  const mate = groupMates(st).find(s => !(s.grade.adj && s.grade.adj[f]));
  gradeSnap(st);
  if (mate) adjPut(st.grade, f, mate.grade);
  if (st.grade.adj) { delete st.grade.adj[f]; if (!Object.keys(st.grade.adj).length) delete st.grade.adj; }
  stampSoon(st); saveSoon(); renderList(); renderGrade(); groupBandRefresh();
}
// src/groups.js
const adjName = f => typeof f === 'number' ? (setup.criteria && setup.criteria[f]) || 'Row ' + (f + 1) : { points: 'Points', pk: 'Percent', xc: 'Extra credit', xcU: 'Extra credit', status: 'Status' }[f];
// src/groups.js
const adjSay = (gr, f) => { const v = JSON.parse(adjGet(gr, f)); return v == null || v === '' ? '–' : f === 'status' ? (STATUS_LABEL[v] || v) : String(v); };
// src/groups.js
const notesSig = gr => JSON.stringify(GROUP_NOTES.map(k => gr[k] ?? null));
// src/groups.js
function groupNotesCopy(to, from) { for (const k of GROUP_NOTES) { if (from.grade[k] != null) to.grade[k] = JSON.parse(JSON.stringify(from.grade[k])); else delete to.grade[k]; } }
// src/groups.js
function stampsSplit(marks, keys) {
  for (const l of Object.values(marks || {})) for (let i = l.length - 1; i >= 0; i--) {
    const m = l[i]; if (m.t !== 'stamp' || m.k !== 'score' || m.o) continue;
    l.splice(i, 1, ...keys.map(k => ({ ...m, o: k })));
  }
}
// src/groups.js
function stampsJoin(marks, keep) {
  for (const l of Object.values(marks || {})) for (let i = l.length - 1; i >= 0; i--) {
    const m = l[i]; if (!m.o) continue;
    if (m.o === keep) delete m.o; else l.splice(i, 1);
  }
}
// src/groups.js
const gradeSig = g => JSON.stringify(Object.fromEntries(Object.entries(g).filter(([k]) => !GROUP_SKIP.has(k)).sort()));
// src/groups.js
function groupMergeMarks(into, from) {
  for (const [p, list] of Object.entries(from || {})) {
    const have = new Set((into[p] ||= []).map(m => JSON.stringify(m)));
    for (const m of list) if (!have.has(JSON.stringify(m))) into[p].push(m);
  }
}
// src/groups.js
function groupSync() {
  if (!batch || !batch.groups || !batch.groups.length) return false;
  let changed = false;
  const seen = new Set();   // a student in two groups (two copies made one) stays in the first
  batch.groups = batch.groups.filter(g => g.k.filter(k => batch.students.some(s => s.key === k)).length > 1 && !g.k.some(k => seen.has(k)) && (g.k.forEach(k => seen.add(k)), true));
  for (const g of batch.groups) {
    const sts = g.k.map(k => batch.students.find(s => s.key === k)).filter(Boolean);
    const newest = l => l.reduce((a, s) => ((s.grade.at || 0) > (a.grade.at || 0) ? s : a), l[0]);
    if (groupOwn(g)) {
      // only the notes go round: from whoever changed them since they were last shared (the newest of those, after a merge)
      const moved = sts.filter(s => notesSig(s.grade) !== g.ns), src = moved.length ? newest(moved) : sts[0], sig = notesSig(src.grade);
      for (const s of sts) if (s !== src && notesSig(s.grade) !== sig) { groupNotesCopy(s, src); changed = true; }
      if (g.ns !== sig) { g.ns = sig; changed = true; }
      if (groupAdj(g) && adjSync(sts)) { changed = true; setTimeout(groupNoteRefresh); }
    } else {
      const src = newest(sts), sig = gradeSig(src.grade);
      for (const s of sts) if (s !== src && gradeSig(s.grade) !== sig) { groupGradeCopy(s, src); changed = true; }
    }
    const files = sts.map(s => groupFileOf(g, s)).filter(Boolean);
    if (files.length < 2) continue;
    const base = files[0];
    for (const f of files.slice(1)) {
      if (f.marks !== base.marks) { groupMergeMarks(base.marks, f.marks); f.marks = base.marks; changed = true; }
      for (const k of ['rot', 'skew']) if (base[k] || f[k]) { if (!base[k]) base[k] = f[k] || {}; if (f[k] !== base[k]) { f[k] = base[k]; changed = true; } }
    }
  }
  return changed;
}
// src/groups.js
function groupAdd(st, f, to, toFile) {
  batch.groups ||= [];
  let g = groupOf(st);
  if (!g) { g = { k: [st.key], p: { [st.key]: f.path } }; batch.groups.push(g); }
  if (!g.p[st.key]) g.p[st.key] = f.path;
  const old = groupOf(to); if (old && old !== g) groupLeave(to, true);
  if (!g.k.includes(to.key)) g.k.push(to.key);
  if (toFile) g.p[to.key] = toFile.path; else delete g.p[to.key];
  if (groupOwn(g)) {   // the newcomer keeps their own score and gets the group's notes, unless only they have notes
    const has = gr => GROUP_NOTES.some(k => k === 'tn' ? !!(gr.tn && gr.tn.l && gr.tn.l.length) : String(gr[k] || '').trim());
    if (has(st.grade) || !has(to.grade)) groupNotesCopy(to, st); else { groupNotesCopy(st, to); touchGrade(st); }
    g.ns = notesSig(st.grade);
    if (toFile && toFile.marks) stampsSplit(toFile.marks, [to.key]);
    if (groupAdj(g) && (gradeHasWork(st.grade) || !gradeHasWork(to.grade))) { const c = to.grade.comment; groupGradeCopy(to, st); to.grade.comment = c; delete to.grade.adj; delete to.grade.tn; groupNotesCopy(to, st); }
  } else if (gradeHasWork(st.grade) || !gradeHasWork(to.grade)) { groupGradeCopy(to, st); if (!st.grade.at) touchGrade(st); to.grade.at = st.grade.at; }
  else { groupGradeCopy(st, to); }
  groupSync();
}
// src/groups.js
function groupLeave(st, quiet) {
  const g = groupOf(st); if (!g) return;
  const f = groupFileOf(g, st);
  const shared = f && f.marks;
  if (f) { f.marks = JSON.parse(JSON.stringify(f.marks || {})); stampsJoin(f.marks, st.key); for (const k of ['rot', 'skew']) if (f[k]) f[k] = { ...f[k] }; }
  if (shared) for (const l of Object.values(shared)) for (let i = l.length - 1; i >= 0; i--) if (l[i].o === st.key) l.splice(i, 1);   // their score stamp goes with them
  g.k = g.k.filter(k => k !== st.key); delete g.p[st.key];
  if (g.k.length < 2) { batch.groups = batch.groups.filter(x => x !== g); const last = g.k[0] && batch.students.find(s => s.key === g.k[0]), lf = last && groupFileOf(g, last); if (lf) { lf.marks = JSON.parse(JSON.stringify(lf.marks || {})); stampsJoin(lf.marks, last.key); } }
  touchGrade(st);
  if (!quiet) { saveSoon(); renderList(); openStudent(cur); toast(shownName(st, batch.students.indexOf(st)) + ' is graded on their own now'); }
}
// src/groups.js
function groupSetOwn(st, own) {
  const mode = own === true ? 1 : +own || 0, g = groupOf(st); if (!g || (g.own || 0) === mode) return false;
  const sts = g.k.map(k => batch.students.find(s => s.key === k)).filter(Boolean), files = [...new Set(sts.map(s => groupFileOf(g, s)).filter(Boolean).map(f => f.marks))];
  const clearAdj = () => { for (const s of sts) delete s.grade.adj; };
  if (mode && groupOwn(g)) {   // between the two ways with shared notes
    g.own = mode;
    if (mode === 2) { for (const s of sts) if (s !== st) for (const f of adjFields(sts)) if (adjGet(s.grade, f) !== adjGet(st.grade, f)) (s.grade.adj ||= {})[f] = 1; }   // st's score is the group's; what differs stays each one's own
    else clearAdj();
  } else if (mode) {
    g.own = mode; g.ns = notesSig(st.grade);
    for (const m of files) stampsSplit(m, sts.filter(s => groupFileOf(g, s)).map(s => s.key));
    for (const s of sts) if (s !== st && notesSig(s.grade) !== g.ns) groupNotesCopy(s, st);
    for (const s of sts) syncScoreStamps(s);
  } else {
    delete g.own; delete g.ns; clearAdj();
    for (const m of files) stampsJoin(m, st.key);
    // typed notes: the others' paragraphs just for them go, st's own become everyone's
    if (st.grade.tn && Array.isArray(st.grade.tn.l)) { const l = tnMine(st, st.grade.tn.l).map(x => { const y = { ...x }; delete y.o; return y; }); if (l.length) st.grade.tn = { l }; else delete st.grade.tn; }
    touchGrade(st);
  }
  groupSync();
  return true;
}
// src/groups.js
function splitMates(st) {
  const out = [];
  for (const f of st.files) for (const r of Object.values(f.sc || {})) for (const k of r.w || []) {
    const s = batch.students.find(x => x.key === k); if (!s || s === st || out.some(o => o.s === s)) continue;
    const sf = s.files.find(x => Object.values(x.sc || {}).some(q => (q.w || []).includes(st.key)));
    out.push({ s, f: sf, mine: f });
  }
  return out;
}
// src/groups.js
const pagesIn = f => f.numPages || Object.keys(f.sc || {}).length;
// src/groups.js
const allShared = (f, k) => !!f && pagesIn(f) > 0 && [...Array(pagesIn(f)).keys()].every(p => f.sc && f.sc[p] && (f.sc[p].w || []).includes(k));
// src/groups.js
function groupFromSplit(st) {
  const mates = splitMates(st); if (!mates.length) return;
  for (const { s, f, mine } of mates) groupAdd(st, mine, s, allShared(mine, s.key) && allShared(f, st.key) && pagesIn(f) === pagesIn(mine) ? f : null);
  const g = groupOf(st); if (g && !Object.keys(g.p).some(k => k !== st.key)) g.p = {};
  saveSoon(); renderList(); openStudent(cur);
  toast('Marked and graded once with ' + groupNames(groupMates(st)));
}
// src/groups.js
const groupRedraw = () => { saveSoon(); renderList(); openStudent(cur); };
// src/groups.js
function groupSnapOf(g) {
  const was = JSON.parse(JSON.stringify(g)), sts = g.k.map(k => batch.students.find(s => s.key === k)).filter(Boolean);
  const grades = sts.map(s => [s, JSON.stringify(s.grade)]), files = sts.map(s => groupFileOf(g, s)).filter(Boolean), marks = files.length ? JSON.stringify(files[0].marks || {}) : null;
  return () => {
    const live = (batch.groups || []).find(x => x === g || x.k.some(k => was.k.includes(k))); if (!live) return;
    for (const k of Object.keys(live)) delete live[k]; Object.assign(live, JSON.parse(JSON.stringify(was)));
    const t = Date.now();
    for (const [s, gr] of grades) { s.grade = JSON.parse(gr); s.grade.at = t; }
    if (marks) { const m = JSON.parse(marks); for (const f of files) f.marks = m; }
    groupRedraw();
  };
}
// src/groups.js
const shareCopies = (st, f) => batch.students.filter(s => s !== st && s.files.some(x => x.from === st.key && x.name === f.name));
// src/video.js
const groupPaper = st => st.files.find(f => !f.virtual && (viewable(f) || f.kind === 'docx')) || null;
// src/ib.js
const ibTaskLevels = st => setup.ib.map((k, i) => [k, noScore(st) ? null : st.grade.rubric[i]]).filter(x => x[0]);
// src/ib.js
function ibStampText(st) { return ibTaskLevels(st).filter(x => x[1] != null).map(([k, v]) => k + ' ' + fmtNum(v)).join('   '); }
export { groupAdd, groupSync, groupLeave, groupSetOwn, groupSnapOf, groupMates, groupNames, groupFromSplit, splitMates, shareCopies, groupPaper, adjReset, adjName, adjSay };
