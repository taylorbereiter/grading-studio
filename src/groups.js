/* ---------------- group work: one paper for several students, marked and graded once ---------------- */
// batch.groups: [{ k: [student keys], p: { key: path of that student's copy of the paper } }]
// Everyone in a group has the same score, comment and status, and the marks on their copies are one set: a mark made on any copy is on all of them.
// A student with no entry in p (their pages from a scan split don't line up with the others') shares the grade only.
// Each student still keeps their own copy of the file, so the export gives each of them the marked paper.
// g.own: "Shared notes, own scores". The paper's marks, the typed notes and the comment stay one for the group, and each partner
// keeps their own score. A score stamp on the shared paper then belongs to one partner (m.o: their key), and only they see it.
// g.ns: the notes as last shared, so the partner whose notes differ from it is the one who changed them.
// Kept on save as data.groupsOwn, apart from data.groups, so an older copy of the app never makes their scores one.
function groupOf(st) { return (st && batch && (batch.groups || []).find(g => g.k.includes(st.key))) || null; }
function groupMates(st) { const g = groupOf(st); return g ? g.k.filter(k => k !== st.key).map(k => batch.students.find(s => s.key === k)).filter(Boolean) : []; }
function groupNames(list) { return wordsJoin(list.map(s => shownName(s, batch.students.indexOf(s)))); }
function groupFileOf(g, st) { const p = g.p && g.p[st.key]; return p ? st.files.find(f => f.path === p) || null : null; }

// The grade fields a group shares. Answers about what's written on each paper (reads) stay each student's own.
const GROUP_SKIP = new Set(['reads', 'sent', 'anchor']);   // a partner's paper exported on its own isn't the others'
function groupGradeCopy(to, from) {
  const a = to.grade, b = from.grade;
  for (const k of Object.keys(a)) if (!GROUP_SKIP.has(k) && !(k in b)) delete a[k];
  for (const [k, v] of Object.entries(b)) if (!GROUP_SKIP.has(k)) a[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
  if (!a.rubric) a.rubric = [];
}
const GROUP_NOTES = ['tn'];   // typed notes; the comment branches off, one for each partner
const groupOwn = g => !!(g && g.own);
// g.own 2: "Group score, adjust a partner". The score is the group's, kept on each partner; a field one partner was given on
// their own (Write for: Just <name>) is in their grade.adj and stays theirs. Fields: each rubric row by number, points, pk, xc, status.
const groupAdj = g => !!(g && g.own === 2);
const ADJ_KEYS = ['points', 'pk', 'xc', 'xcU', 'status'];
const adjFields = sts => [...Array(Math.max(0, ...sts.map(s => (s.grade.rubric || []).length), setup && setup.criteria ? setup.criteria.length : 0)).keys(), ...ADJ_KEYS];
const adjGet = (gr, f) => JSON.stringify(typeof f === 'number' ? (gr.rubric || [])[f] ?? null : gr[f] ?? null);
function adjPut(gr, f, from) {
  if (typeof f === 'number') { (gr.rubric ||= [])[f] = (from.rubric || [])[f] ?? null; }
  else if (from[f] == null) delete gr[f]; else gr[f] = JSON.parse(JSON.stringify(from[f]));
  const t = from.atR && from.atR[f]; if (t) (gr.atR ||= {})[f] = t;
}
const adjTime = (gr, f) => (gr.atR && gr.atR[f]) || gr.at || 0;
// One pass for a group with a group score: Just edits become the partner's own, the rest goes to every partner not adjusted.
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
// Back to the group's value on one field: taken from a partner who has it, with its time, so it doesn't push st's old value round.
function adjReset(st, f) {
  const g = groupOf(st); if (!g) return;
  const mate = groupMates(st).find(s => !(s.grade.adj && s.grade.adj[f]));
  gradeSnap(st);
  if (mate) adjPut(st.grade, f, mate.grade);
  if (st.grade.adj) { delete st.grade.adj[f]; if (!Object.keys(st.grade.adj).length) delete st.grade.adj; }
  stampSoon(st); saveSoon(); renderList(); renderGrade(); groupBandRefresh();
}
const adjName = f => typeof f === 'number' ? (setup.criteria && setup.criteria[f]) || 'Row ' + (f + 1) : { points: 'Points', pk: 'Percent', xc: 'Extra credit', xcU: 'Extra credit', status: 'Status' }[f];
const adjSay = (gr, f) => { const v = JSON.parse(adjGet(gr, f)); return v == null || v === '' ? '–' : f === 'status' ? (STATUS_LABEL[v] || v) : String(v); };
// Above the score panel, for a group with a group score: who the scores you change go to, and what is adjusted for this partner.
function groupScoreNote(st) {
  const g = groupOf(st); if (!groupAdj(g)) return '';
  const name = shownName(st, batch.students.indexOf(st)), mate = groupMates(st).find(Boolean);
  const adj = Object.keys(st.grade.adj || {}).map(k => (/^\d+$/.test(k) ? +k : k)).filter(f => f !== 'xcU');
  const rows = adj.map(f => { const m = groupMates(st).find(s => !(s.grade.adj && s.grade.adj[f])); return '<li><span>' + esc(adjName(f)) + '</span> <span class="muted">group ' + esc(m ? adjSay(m.grade, f) : '–') + ' → ' + esc(adjSay(st.grade, f)) + '</span> <button class="link" data-grpreset="' + f + '">Use group score</button></li>'; }).join('');
  return '<div class="grpnote' + (groupJust === st.key ? ' just' : '') + '" id="grpNote">' + (groupJust === st.key ? '<b>Scores you change now are just for ' + esc(name) + '.</b>' : 'Scores you change go to the whole group. To change one for ' + esc(name) + ' only, pick <b>Just ' + esc(name.split(/[\s,]+/)[0] || name) + '</b> above the paper.') + (rows ? '<ul>' + rows + '</ul>' : '') + '</div>';
}
function groupNoteRefresh() { const old = $('#grpNote'), st = batch && batch.students[cur]; if (old && st) { const h = groupScoreNote(st); if (h) old.outerHTML = h; else old.remove(); } }
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-grpreset]'); if (b && batch) { const k = b.dataset.grpreset; adjReset(batch.students[cur], /^\d+$/.test(k) ? +k : k); } });
const notesSig = gr => JSON.stringify(GROUP_NOTES.map(k => gr[k] ?? null));
function groupNotesCopy(to, from) { for (const k of GROUP_NOTES) { if (from.grade[k] != null) to.grade[k] = JSON.parse(JSON.stringify(from.grade[k])); else delete to.grade[k]; } }
// A new score stamp on a paper a group shares with its own scores is that student's alone.
function stampOwner(m, st) { const g = groupOf(st); if (groupOwn(g) && groupFileOf(g, st)) m.o = st.key; return m; }
// The marks of one page that st sees: the others' score stamps left out. Keys of students no longer here hide nothing.
const stampHidden = (m, key) => !!(m && m.o && m.o !== key && batch.students.some(s => s.key === m.o));
// "Just for" one partner: marks made now on the shared paper are theirs alone (m.o), like their score stamp. groupJust: their key.
let groupJust = null;
const groupJustOn = st => !!(st && groupJust === st.key && groupOwn(groupOf(st)) && groupFileOf(groupOf(st), st));
// Called with snap(pg) before a mark is made, and with changed(pg) after: what's new on the page then is theirs.
function justSeen(pg) { pg.seen = groupJustOn(batch.students[cur]) ? new Set(pg.marks()) : null; }
function justTag(pg) { if (!pg.seen || !groupJustOn(batch.students[cur])) return; for (const m of pg.marks()) if (!pg.seen.has(m) && !m.o) m.o = groupJust; pg.seen = null; }
function marksMine(list, f, st) {
  if (!list || !list.some(m => m && m.o)) return list;
  st = st || (batch && batch.students.find(s => s.files.includes(f)));
  return st ? list.filter(m => !stampHidden(m, st.key)) : list;
}
// Score stamps on shared marks: one for each partner (to own scores), or back to one with no owner (keep: whose stays).
function stampsSplit(marks, keys) {
  for (const l of Object.values(marks || {})) for (let i = l.length - 1; i >= 0; i--) {
    const m = l[i]; if (m.t !== 'stamp' || m.k !== 'score' || m.o) continue;
    l.splice(i, 1, ...keys.map(k => ({ ...m, o: k })));
  }
}
function stampsJoin(marks, keep) {
  for (const l of Object.values(marks || {})) for (let i = l.length - 1; i >= 0; i--) {
    const m = l[i]; if (!m.o) continue;
    if (m.o === keep) delete m.o; else l.splice(i, 1);
  }
}
const gradeSig = g => JSON.stringify(Object.fromEntries(Object.entries(g).filter(([k]) => !GROUP_SKIP.has(k)).sort()));

// Marks on two copies become one set, with nothing lost: each page keeps every mark either copy had.
function groupMergeMarks(into, from) {
  for (const [p, list] of Object.entries(from || {})) {
    const have = new Set((into[p] ||= []).map(m => JSON.stringify(m)));
    for (const m of list) if (!have.has(JSON.stringify(m))) into[p].push(m);
  }
}

// Keeps every group in step: called on each save. The newest grade in a group goes to the others, and the copies share one set of marks (and turns, so the marks sit right).
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

// st's copy of the paper and the student joining: they share st's grade from now on, unless st has none yet and they do.
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
// One student goes back to their own grade and their own copy of the marks so far.
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

// A group's way of grading: 0 (marks, score and comment shared), 2 (a group score, adjusted for one partner where needed:
// true means this) or 1 (separate scores). Notes are shared in 1 and 2. To 0, st's score goes to everyone. False when nothing changed.
function groupSetOwn(st, own) {
  const mode = own === true ? 1 : +own || 0, g = groupOf(st); if (!g || (g.own || 0) === mode) return false;
  const sts = g.k.map(k => batch.students.find(s => s.key === k)).filter(Boolean), files = [...new Set(sts.map(s => groupFileOf(g, s)).filter(Boolean).map(f => f.marks))];
  const clearAdj = () => { for (const s of sts) delete s.grade.adj; };
  if (mode && groupOwn(g)) {   // between the two ways with shared notes
    g.own = mode;
    if (mode === 2) for (const s of sts) if (s !== st) for (const f of adjFields(sts)) if (adjGet(s.grade, f) !== adjGet(st.grade, f)) (s.grade.adj ||= {})[f] = 1;   // st's score is the group's; what differs stays each one's own
    else clearAdj();
  } else if (mode) {
    g.own = mode; g.ns = notesSig(st.grade);
    for (const m of files) stampsSplit(m, sts.filter(s => groupFileOf(g, s)).map(s => s.key));
    for (const s of sts) if (s !== st && notesSig(s.grade) !== g.ns) groupNotesCopy(s, st);
    for (const s of sts) syncScoreStamps(s);
  } else {
    delete g.own; delete g.ns; clearAdj();
    for (const m of files) stampsJoin(m, st.key);
    touchGrade(st);
  }
  groupSync();
  return true;
}
// The students counted as one each: a group's partners together, everyone else alone, in list order.
function groupUnits() {
  const seen = new Set(), out = [];
  for (const st of batch.students) {
    if (seen.has(st)) continue;
    const u = [st, ...groupMates(st)]; u.forEach(s => seen.add(s)); out.push(u);
  }
  return out;
}
// The list's order with each group's partners right after the first of them.
function groupOrder(order) {
  if (!(batch.groups || []).length) return order;
  const out = [], put = new Set();
  for (const i of order) {
    if (put.has(i)) continue;
    const mates = groupMates(batch.students[i]).map(s => batch.students.indexOf(s)).filter(j => j >= 0 && !put.has(j)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    for (const j of [i, ...mates]) { put.add(j); out.push(j); }
  }
  return out;
}
// The list's rows, each group's partners in one box so the link shows. rows: the html for each index in order ('' when hidden).
function groupRuns(order, rows) {
  let html = '';
  for (let p = 0; p < order.length;) {
    const g = groupOf(batch.students[order[p]]);
    let q = p + 1;
    if (g) while (q < order.length && groupOf(batch.students[order[q]]) === g) q++;
    const shown = rows.slice(p, q).filter(Boolean);
    html += g && shown.length > 1 ? '<div class="stugrp' + (groupOwn(g) ? ' own' : '') + '" title="' + esc('Group work: ' + groupNames(g.k.map(k => batch.students.find(s => s.key === k)).filter(Boolean)) + (groupOwn(g) ? ', shared notes and own scores' : ', marked and graded once')) + '">' + shown.join('') + '</div>' : shown.join('');
    p = q;
  }
  return html;
}
// Saved apart, so an older copy of the app (another tab, a phone not updated yet) never sees a group with its own scores.
const groupsSave = own => { const l = (batch.groups || []).filter(g => groupOwn(g) === own); return l.length ? l : undefined; };

// Pages a scan split gave to several students: the others who got them, with their file, for Mark and grade once.
function splitMates(st) {
  const out = [];
  for (const f of st.files) for (const r of Object.values(f.sc || {})) for (const k of r.w || []) {
    const s = batch.students.find(x => x.key === k); if (!s || s === st || out.some(o => o.s === s)) continue;
    const sf = s.files.find(x => Object.values(x.sc || {}).some(q => (q.w || []).includes(st.key)));
    out.push({ s, f: sf, mine: f });
  }
  return out;
}
// Marks are shared only when the two files are the same pages: every page went to both.
const pagesIn = f => f.numPages || Object.keys(f.sc || {}).length;
const allShared = (f, k) => !!f && pagesIn(f) > 0 && [...Array(pagesIn(f)).keys()].every(p => f.sc && f.sc[p] && (f.sc[p].w || []).includes(k));
function groupFromSplit(st) {
  const mates = splitMates(st); if (!mates.length) return;
  for (const { s, f, mine } of mates) groupAdd(st, mine, s, allShared(mine, s.key) && allShared(f, st.key) && pagesIn(f) === pagesIn(mine) ? f : null);
  const g = groupOf(st); if (g && !Object.keys(g.p).some(k => k !== st.key)) g.p = {};
  saveSoon(); renderList(); openStudent(cur);
  toast('Marked and graded once with ' + groupNames(groupMates(st)));
}

// The band above the paper.
function groupBand(st) {
  const mates = groupMates(st);
  if (mates.length) {
    const g = groupOf(st), marks = !!groupFileOf(g, st), own = groupOwn(g), adj = groupAdj(g), mode = adj ? 'adj' : own ? 'own' : 'all';
    if (groupJust !== st.key) groupJust = null;   // a new student starts on Both
    const name = shownName(st, batch.students.indexOf(st)), first = name.split(/[\s,]+/)[0] || name;
    const both = adj ? (marks ? 'Marks and scores you give now go to every partner' : 'Scores you give now go to every partner') : 'Marks you make now show on every partner’s paper';
    const one = adj ? (marks ? 'Marks and scores you give now are just for ' : 'Scores you give now are just for ') + esc(name) + '. Their comment is always their own.' : 'Marks you make now show only on ' + esc(name) + '’s paper. Their comment is always their own.';
    const just = own && (marks || adj) ? '<span class="seg grpjust" role="group" aria-label="What you do now goes to"><button type="button" data-grpjust="0" aria-pressed="' + !groupJust + '" title="' + both + '">Both</button><button type="button" data-grpjust="1" aria-pressed="' + !!groupJust + '" title="' + one + '">Just ' + esc(first) + '</button></span>' : '';
    const opt = (v, t) => '<option value="' + v + '"' + (v === mode ? ' selected' : '') + '>' + t + '</option>';
    return '<div class="grpband" id="grpBand"><b>Group work</b><span>with ' + esc(groupNames(mates)) + ' ·</span>' +
      '<select class="grpmode" data-grpmode aria-label="What the group shares" title="Share everything, give the group one score you can change for one partner, or give each partner their own score">' + opt('all', marks ? 'Marks and grade shared' : 'Grade shared') + opt('adj', 'Group score, adjust a partner') + opt('own', marks ? 'Shared notes, own scores' : 'Own scores and comments') + '</select>' + (just ? '<span class="muted">Write for</span>' + just : '') + '<span style="flex:1"></span>' +
      '<button class="link" data-grpout title="Give this student their own grade and their own copy of the marks so far. The rest stay together.">Grade on their own…</button></div>';
  }
  const sm = splitMates(st);
  if (!sm.length) return '';
  return '<div class="grpband" id="grpBand"><b>Group work</b><span>pages shared with ' + esc(groupNames(sm.map(o => o.s))) + ', each graded on their own</span><span style="flex:1"></span>' +
    '<button class="link" data-grpjoin title="One set of marks and one grade for all of them">Mark and grade once for the group</button></div>';
}
// The band again, once a scan split's notes on who else got the pages have come in.
function groupBandRefresh() {
  if (!batch || !$('#paper .who')) return;
  const html = groupBand(batch.students[cur]), old = $('#grpBand');
  if (old) { if (html) old.outerHTML = html; else old.remove(); }
  else if (html) $('#paper .who').insertAdjacentHTML('afterend', html);
}
function groupClick(e) {
  const st = batch.students[cur];
  if (e.target.closest('[data-grpjoin]')) { groupFromSplit(st); return true; }
  const j = e.target.closest('[data-grpjust]');
  if (j) { groupJust = j.dataset.grpjust === '1' ? st.key : null; groupBandRefresh(); groupNoteRefresh(); return true; }
  if (e.target.closest('[data-grpout]')) {
    askDlg(shownName(st, cur) + ' gets their own grade and their own copy of the marks so far. ' + groupNames(groupMates(st)) + (groupMates(st).length > 1 ? ' stay together.' : ' keeps theirs.'), { ok: 'Grade on their own', cancel: 'Keep the group' }).then(ok => { if (ok) groupLeave(st); });
    return true;
  }
  return false;
}

// The band's choice. Back to one grade, the student on screen's score goes to everyone, so it asks first. Undo puts it all back.
async function groupModePick(mode) {
  const st = batch.students[cur], g = groupOf(st); if (!g || (g.own || 0) === mode) return;
  if (!mode) {
    const t = gradeOf(st).total, ok = await askDlg('Everyone in the group gets ' + shownName(st, cur) + '’s score' + (t != null ? ' (' + fmtNum(t) + ')' : '') + ' and comment. The other partners’ own scores, comments and notes just for them are replaced.', { ok: 'Share this score', cancel: 'Keep own scores' });
    if (!ok) { groupBandRefresh(); return; }
  }
  const back = groupSnapOf(g);
  groupSetOwn(st, mode);
  pushUndo(actStep(back, () => { groupSetOwn(st, mode); groupRedraw(); }, mode === 2 ? 'group score' : mode ? 'own scores' : 'one grade'));
  groupRedraw();
  toast(mode === 2 ? 'One group score now. To change a score for one partner, pick Just them above the paper.' : mode ? 'Each partner has their own score and comment now. The notes page stays shared.' : 'One grade for the group now');
}
const groupRedraw = () => { saveSoon(); renderList(); openStudent(cur); };
// Everything a change of a group's way of grading touches, to put back: the group, each partner's grade, the shared marks.
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
document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('[data-grpmode]'); if (s && batch) groupModePick({ all: 0, adj: 2, own: 1 }[s.value] || 0); });

/* ---------------- Group work… on a file ---------------- */
// Each student picked gets their own copy of the file as it was turned in. With the switch on (the default), they're one group: marked and graded once.
const shareCopies = (st, f) => batch.students.filter(s => s !== st && s.files.some(x => x.from === st.key && x.name === f.name));
const shareLink = f => { const st = batch.students[cur], n = st ? Math.max(shareCopies(st, f).length, groupMates(st).length) : 0; return '<button class="link" style="font-size:13px;margin-right:10px" data-shfile="' + esc(f.path) + '" title="Group work: give this paper to the students who worked on it, and mark and grade it once for all of them">Group work…' + (n ? ' (' + n + ')' : '') + '</button>'; };
function openShareFile(st, path) {
  const f = fileByPath(st, path); if (!f || !f.data) return;
  const anon = anonOn(), others = batch.students.map((s, i) => ({ s, i, label: shownName(s, i) })).filter(x => x.s !== st);
  if (anon) others.sort((a, b) => anonPos(a.i) - anonPos(b.i));
  const copyOf = s => s.files.find(x => x.from === st.key && x.name === f.name);
  let once = !(shareCopies(st, f).length && !groupOf(st)), own = groupOwn(groupOf(st));
  openDlg('<div class="bh"><h2>Group work: ' + esc(fileShown(st, f.name)) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><button class="outsw" id="grpOnce" role="switch" aria-checked="' + once + '" style="margin:0 0 12px"><i></i><span><b>Mark and grade once for the group</b><small>Your marks, score and comment show on every partner’s paper. Turn off to mark each copy on its own.</small></span></button>' +
    '<button class="outsw" id="grpOwn" role="switch" aria-checked="' + groupOwn(groupOf(st)) + '" style="margin:0 0 12px"' + (once ? '' : ' hidden') + '><i></i><span><b>Own score for each partner</b><small>The notes page, its marks and typed notes stay shared. Each partner gets their own score and comment, and you can write on the paper just for one of them.</small></span></button>' +
    '<p class="muted" style="margin:0 0 10px;font-size:14px">Click each student who worked on it with ' + esc(shownName(st, batch.students.indexOf(st))) + '. They get their own copy of the file, so the export gives each of them the marked paper. Remove on a copy takes it back.</p>' +
    '<input class="btn" id="mvFind" placeholder="' + (anon ? 'Type a paper number' : 'Type a name') + '" autocomplete="off" style="width:100%;margin-bottom:8px"><div id="mvList" class="mvlist"></div></div>' +
    '<div class="bf"><button class="btn primary" data-cancel>Done</button></div>', true);
  const inGrp = s => groupMates(st).includes(s);
  const draw = () => {
    const q = $('#mvFind').value.toLowerCase().split(/\s+/).filter(Boolean);
    const list = others.filter(x => q.every(w => x.label.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))));
    $('#mvList').innerHTML = list.length ? list.map((x, k) => { const has = !!copyOf(x.s), g = inGrp(x.s), done = once ? g : has;
      return '<button class="mvrow' + (k === 0 && q.length ? ' top' : '') + '" data-shto="' + x.i + '"' + (done ? ' disabled' : '') + '>' + esc(x.label) + '<span class="muted">' + (g ? '✓ In the group' : has ? '✓ Has a copy' : x.s.files.length ? x.s.files.length + (x.s.files.length === 1 ? ' file' : ' files') : 'No files') + '</span></button>'; }).join('') : '<p class="muted">No name matches.</p>';
  };
  draw();
  $('#mvFind').oninput = draw;
  $('#mvFind').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const b = $('#mvList [data-shto]:not([disabled])'); if (b) b.click(); } };
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) { closeDlg(); return openStudent(cur); }
    if (e.target.closest('#grpOnce')) {
      once = !once; $('#grpOnce').setAttribute('aria-checked', once); $('#grpOwn').hidden = !once;
      if (once) { for (const s of shareCopies(st, f)) groupAdd(st, f, s, copyOf(s)); if (own && groupOf(st)) groupSetOwn(st, true); }
      else if (groupOf(st)) { for (const s of groupMates(st)) groupLeave(s, true); }
      saveSoon(); renderList(); draw(); return;
    }
    if (e.target.closest('#grpOwn')) {
      if (own && groupOf(st) && groupMates(st).length && !(await askDlg('Everyone in the group gets ' + shownName(st, batch.students.indexOf(st)) + '’s score and comment. The other partners’ own scores, comments and notes just for them are replaced.', { ok: 'Share this score', cancel: 'Keep own scores' }))) return;
      own = !own; $('#grpOwn').setAttribute('aria-checked', own);
      if (groupOf(st)) { const back = groupSnapOf(groupOf(st)); if (groupSetOwn(st, own)) pushUndo(actStep(back, () => groupSetOwn(st, own), own ? 'own scores' : 'one grade')); }
      saveSoon(); renderList(); return;
    }
    const b = e.target.closest('[data-shto]'); if (!b || b.disabled) return;
    const to = batch.students[+b.dataset.shto]; b.disabled = true;
    if (!copyOf(to)) await addFiles(to, [{ path: f.name, file: new File([f.data], f.name), from: st.key }], true);
    if (once) { groupAdd(st, f, to, copyOf(to)); if (own) groupSetOwn(st, true); for (const lf of st.files.filter(x => x.kind === 'link')) await partnerCopy(st, lf, to); }   // the group's video goes with it
    saveSoon(); renderList();
    toast((once ? 'In the group: ' : 'Shared with ') + shownName(to, +b.dataset.shto)); draw(); $('#mvFind').focus();
  };
  $('#mvFind').focus();
}
Object.assign(window.__gs, { groupSync, groupSetOwn, marksMine, saveSoon });
