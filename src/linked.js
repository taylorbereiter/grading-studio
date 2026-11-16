/* ---------------- linked classes: sections of one course on the same schedule (11/16) ---------------- */
// A class can name its course (c.course). Classes with the same course are linked: a new assignment is offered to all of them,
// an assignment can be added to the others later or joined to one made twice, a change to one copy can go to the others, and the
// strong examples kept in one copy show in the others, labelled with the class they came from. Rosters, papers, scores and
// comments are never shared: each copy is its own card with its own download.
// c.course: no key means never asked; '' means the teacher said no (or unlinked it). Copies of one assignment share it.group,
// the id the New assignment box has given copies in several classes since 11/6.
// The Planner's timetable can name a course for each class (one deck for both sections). When two classes here are on the same
// course there and neither has said yes or no, the class page offers to link them. Nothing is linked without the teacher.
// Function declarations and var, since a class page drawn at load (renderLib) runs before this file does.
function lkKey(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
function lkSibs(c) { return c && c !== lib.loose && lkKey(c.course) ? lib.classes.filter(x => x !== c && lkKey(x.course) === lkKey(c.course)) : []; }
function lkTwins(it) {
  const out = []; if (!it || !it.group) return out;
  for (const c of holders()) for (const u of c.units) for (const x of u.items) if (x !== it && x.group === it.group) out.push({ c, u, it: x });
  return out;
}
function lkNames(cs) { return cs.map(c => '<b data-raw>' + esc(c === lib.loose ? 'No class' : c.name) + '</b>').join(', '); }
function lkSvg() { return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'; }
// The Planner's timetable, read one way: [{ k: class name as compared, course }].
var lkPlan = null, lkPlanAt = 0;
async function lkPlanLoad() {
  if (Date.now() - lkPlanAt < 4000) return; const at = lkPlanAt = Date.now();
  let s = null;
  try { const db = await planDb(false); if (db) { try { s = await idbP(db.transaction('kv').objectStore('kv').get('setup')); } catch {} db.close(); } } catch {}
  if (at !== lkPlanAt) return;   // a newer read (or a test's timetable) came first
  const next = (s && Array.isArray(s.classes) ? s.classes : []).filter(c => c && c.name && c.course).map(c => ({ k: lkKey(c.name), course: String(c.course).trim() }));
  const was = JSON.stringify(lkPlan || []); lkPlan = next;
  if (JSON.stringify(next) !== was && !batch && routeNow().v === 'class' && !routeNow().tab) renderLib();   // only the Assignments tab shows the offer
}
function lkPlanCourse(c) { const p = c && (lkPlan || []).find(x => x.k === lkKey(c.name)); return p ? p.course : ''; }
function lkOfferOf(c) {
  const course = c && c !== lib.loose && c.course == null ? lkPlanCourse(c) : ''; if (!course) return null;
  const others = lib.classes.filter(x => x !== c && (x.course == null ? lkKey(lkPlanCourse(x)) === lkKey(course) : lkKey(x.course) === lkKey(course)));
  return others.length ? { course, others } : null;
}
// Under the class's name: the classes it is linked with, or the Planner's offer.
function lkHead(c) {
  if (!c || c === lib.loose) return '';
  lkPlanLoad();
  const s = lkSibs(c), ci = lib.classes.indexOf(c);
  if (s.length) return '<div class="lkhead"><span class="lkchip">' + lkSvg() + '<span>Linked with</span> ' + s.map(x => '<a href="' + classHash(x) + '" data-raw>' + esc(x.name) + '</a>').join(', ') + '</span><button class="link" data-lkedit="' + ci + '">Change</button></div>';
  const o = lkOfferOf(c); if (!o) return '';
  return '<div class="lkoffer">' + lkSvg() + '<p><span>Your Planner has these classes on the same course:</span> ' + lkNames([c, ...o.others]) + '. <span>Link them, so an assignment and its strong examples can be shared between them?</span></p>' +
    '<button class="btn sm primary" data-lkyes="' + ci + '">Link them</button><button class="btn sm ghost" data-lkno="' + ci + '">No thanks</button></div>';
}
// One copy's card: the classes its copies are in, and what can be done about the linked classes.
function lkCard(it) {
  const t = lkTwins(it);
  return t.length ? '<div class="lktw">' + lkSvg() + '<span>Also in</span> ' + lkNames(t.map(x => x.c)) + '</div>' : '';
}
function lkMenu(it, c) {
  const t = lkTwins(it), have = new Set(t.map(x => x.c)), out = [];
  for (const x of lkSibs(c)) {
    if (have.has(x)) continue;
    const same = x.units.flatMap(u => u.items).find(y => lkKey(y.name) === lkKey(it.name));
    out.push(same ? '<button class="mitem" data-lkjoin="' + it.id + ':' + same.id + '"><span>Link with the copy in</span> <span data-raw>' + esc(x.name) + '</span><small>Each keeps its papers and scores</small></button>'
      : '<button class="mitem" data-lkadd="' + it.id + ':' + x.id + '"><span>Add to</span> <span data-raw>' + esc(x.name) + '</span><small>A copy with the same name, type, due date and rubric</small></button>');
  }
  if (t.length) out.push('<button class="mitem" data-lkoff="' + it.id + '">Unlink from the other classes<small>This copy keeps everything and stops sharing</small></button>');
  return out.length ? '<hr>' + out.join('') : '';
}
function lkCopy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
// A copy of an assignment in another class: same name, type, due date, rubric and Quick mark boxes, in the unit of the same name (made if missing).
function lkAdd(id, cid) {
  const f = findItem(id), x = classById(cid); if (!f || !x) return;
  const it = f.it; it.group ||= uid();
  let to = x.units.find(u => lkKey(u.name) === lkKey(f.u.name)); if (!to) x.units.push(to = { id: uid(), name: f.u.name, items: [] });
  const a = { id: uid(), name: it.name, classId: x.id, group: it.group };
  for (const k of ['type', 'due', 'setup', 'quiz', 'goal', 'crit']) if (it[k] != null) a[k] = lkCopy(it[k]);
  if (a.setup) delete a.setup.spot;
  to.items.push(a); saveLib(); renderLib();
  toast('Added “' + it.name + '” to ' + x.name);
}
// Two cards made separately (before the classes were linked) become copies of one assignment.
function lkJoin(id, other) {
  const a = findItem(id), b = findItem(other); if (!a || !b) return;
  const g = a.it.group || b.it.group || uid(), old = b.it.group;
  for (const c of holders()) for (const u of c.units) for (const x of u.items) if (old && x.group === old) x.group = g;
  a.it.group = b.it.group = g; saveLib(); renderLib();
  toast('Linked with the copy in ' + b.c.name);
}
function lkOff(id) {
  const f = findItem(id); if (!f || !f.it.group) return;
  const t = lkTwins(f.it), g = f.it.group;
  delete f.it.group; if (t.length === 1) delete t[0].it.group;
  saveLib(); renderLib();
  toastDo('Unlinked “' + f.it.name + '”', 'Undo', () => { f.it.group = g; for (const x of t) x.it.group = g; saveLib(); renderLib(); });
}
// Class setup, Linked classes: tick the classes on the same schedule. They share one course name (the Planner's when it has one).
function lkEdit(ci) {
  const c = lib.classes[ci]; if (!c) return;
  const was = lkSibs(c), others = lib.classes.filter(x => x !== c);
  openDlg('<div class="bh"><h2>Linked classes</h2></div><div class="bb"><p class="muted" style="margin-top:0">For classes on the same schedule. A new assignment is offered to all of them, and strong examples show in each, with the class they came from. Rosters, papers, scores and comments stay separate.</p>' +
    '<div class="field"><label>Linked with</label><div class="ctags" id="lkPick">' + (others.map(x => '<label class="ctag"><input type="checkbox" value="' + esc(x.id) + '"' + (was.includes(x) ? ' checked' : '') + '><span data-raw>' + esc(x.name) + '</span></label>').join('') || '<span class="muted">No other classes yet</span>') + '</div></div>' +
    '<div class="field"><label for="lkCourse">Course <span class="muted" style="font-weight:400">(optional)</span></label><input type="text" id="lkCourse" value="' + esc(c.course || lkPlanCourse(c)) + '" placeholder="e.g. English 12"></div></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true, 'lg');
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    const ids = [...document.querySelectorAll('#lkPick input:checked')].map(x => x.value), on = others.filter(x => ids.includes(x.id));
    const course = $('#lkCourse').value.trim().slice(0, 60) || c.course || lkPlanCourse(c) || c.name;
    for (const x of was) if (!on.includes(x)) x.course = '';
    if (on.length) for (const x of [c, ...on]) x.course = course; else c.course = '';
    saveLib(); closeDlg(); renderLib();
  };
}
function lkYes(ci) {
  const c = lib.classes[ci], o = lkOfferOf(c); if (!o) return;
  for (const x of [c, ...o.others]) x.course = o.course;
  saveLib(); renderLib();
  toastDo('Linked ' + [c, ...o.others].map(x => x.name).join(', '), 'Undo', () => { for (const x of [c, ...o.others]) delete x.course; saveLib(); renderLib(); });
}
function lkNo(ci) { const c = lib.classes[ci]; if (!c) return; c.course = ''; saveLib(); renderLib(); }
$('#classes').addEventListener('click', e => {
  const b = e.target.closest('[data-lkedit],[data-lkyes],[data-lkno],[data-lkadd],[data-lkjoin],[data-lkoff]'); if (!b) return;
  e.preventDefault(); e.stopPropagation(); if (typeof kmClose === 'function') kmClose();
  const d = b.dataset, [p, q] = String(d.lkadd || d.lkjoin || '').split(':');
  if (d.lkedit != null) lkEdit(+d.lkedit); else if (d.lkyes != null) lkYes(+d.lkyes); else if (d.lkno != null) lkNo(+d.lkno);
  else if (d.lkadd) lkAdd(p, q); else if (d.lkjoin) lkJoin(p, q); else if (d.lkoff) lkOff(d.lkoff);
}, true);
// The edit box of a card with copies: what changed here can go to the copies too (only what changed, so a copy's own due date stays).
function lkAlsoHtml(it) { const t = lkTwins(it); return t.length ? '<label class="lkalso"><input type="checkbox" id="aAlso" checked> <span>Make these changes in the copies too:</span> ' + lkNames(t.map(x => x.c)) + '</label>' : ''; };
function lkAlsoDo(it, was, rubric) {
  const box = $('#aAlso'); if (!box || !box.checked) return;
  for (const { it: x } of lkTwins(it)) {
    for (const k of ['name', 'type', 'due']) if (it[k] !== was[k]) { if (it[k] == null) delete x[k]; else x[k] = it[k]; }
    if (rubric && it.setup) x.setup = lkCopy(it.setup);
  }
}
// Strong examples kept in the copies of the assignment open now, for the Examples tab (examples.js).
function lkExamples() {
  const a = batch && batch.assignment && findItem(batch.assignment.id); if (!a) return [];
  const ids = new Set(lkTwins(a.it).map(x => x.it.id));
  return ids.size ? exList.filter(r => ids.has(r.asg) && r.work !== batch.id) : [];
}
Object.assign(window.__gs, { lkSibs: id => lkSibs(classById(id)).map(c => c.id), lkTwins: id => lkTwins((findItem(id) || {}).it).map(x => x.it.id), lkPlanSet: p => { lkPlan = p.map(c => ({ k: lkKey(c.name), course: c.course })); lkPlanAt = Date.now() + 1e9; renderLib(); } });
