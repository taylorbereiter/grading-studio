/* ---------------- gradebook: every assignment for a class, by term, with a term grade from the teacher's own weights ---------------- */
// Scores come from saved downloads in this browser and from scores typed in for work that has no download. Nothing leaves the browser.
// Each assignment card can carry: type ('sum' | 'ic' | 'fm'), due ('YYYY-MM-DD'), term (a term id, when it's moved by hand),
// typed: { max (points, or null for percents), s: { roster name: { v, st } } }. A download with no card keeps the same in lib.book.dl[its id].
// lib.book: { terms: [{ id, name, start, end }], w: { sum, ic, fm }, empty: 'other' | 'zero', dl: {}, xcTo: 'term' | 'ic', xcCap: false when a grade may go over 100, retake: 'high' | 'last' | 'avg' (which try of a retake counts; start.js withTries) }.
// A typed-in score with a retake keeps the earlier tries beside it: typed.s[name] = { v, st, tries: [earlier scores] }, typed in the table as "7 > 10".
// Extra credit with no paper behind it (a Kahoot, say) is a typed-in card of type 'xc': typed.s[name].v is that student's extra points,
// and it.xcTo says what they add to ('term' or 'ic'; none: the teacher's own default from Term setup). One point is one percentage point
// on what it adds to. It never sits inside a type's average, so a summative's own scale and every assignment's percent stay as they were.
// The types are the teacher's own. lib.book.cats is their list, in their order (left to right in the gradebook): [{ id, name, k }].
// With no list it is the usual three, as BK_TYPES has them. 'sum', 'ic' and 'fm' keep their ids when they are renamed, and 'fm' is
// always feedback only (a ✓, no score). A type the teacher adds has an id of its own and one of five colours (k). Each type's weight
// is in lib.book.w under its id. A type that is no longer in the list reads as "No type yet"; nothing on the assignment is changed.
const BK_XC = ['xc', 'Extra credit', 'Extra credit'];
// (These are functions, not constants, where a screen drawn before this file has run uses them: the assignment cards on Home.)
// BK_TYPES is what every picker, table and chart reads, so it is kept as this teacher's list. Called wherever the types are about to be used.
function bkCats() {
  let cats; try { cats = (lib.book || {}).cats; } catch (e) { return BK_TYPES; }
  if (cats === bkCatsSeen) return BK_TYPES;
  bkCatsSeen = cats;
  const seen = new Set(), out = [];
  for (const c of Array.isArray(cats) ? cats : BK_DEF.map(([id]) => ({ id }))) {
    if (!c || !c.id || c.id === 'xc' || seen.has(c.id)) continue;
    const d = BK_DEF.find(x => x[0] === c.id), nm = String(c.name || '').trim();
    if (!d && !nm) continue;
    seen.add(c.id); out.push(nm ? [c.id, nm, nm, d ? 0 : +c.k || 1] : d.slice());
  }
  BK_TYPES.splice(0, BK_TYPES.length, ...(out.length ? out : BK_DEF.map(x => x.slice())));
  return BK_TYPES;
}
function bkIsType(t) { return bkCats().some(x => x[0] === t); }
function bkType(t) { return t === 'xc' || bkIsType(t) ? t : ''; }   // a type as the gradebook reads it: one of the teacher's own, extra credit, or none
// Still one of the usual three, under its usual name: the sentences written for them still fit.
const bkIsDef = t => { const x = bkCats().find(y => y[0] === t), d = BK_DEF.find(y => y[0] === t); return !!x && !!d && x[2] === d[2]; };
// The colour a type is drawn in: the usual three have their own, a teacher's own type has one of five.
function bkCls(t) { const x = bkCats().find(y => y[0] === t); return x ? (x[3] ? 'kc k' + x[3] : t) : t === 'xc' ? 'xc' : ''; }
const bkScoredTypes = () => bkCats().filter(([t]) => t !== 'fm');
// A legend entry for each type that has scores, in the teacher's order.
const bkLeg = dot => bkScoredTypes().map(([t, , s]) => '<span><i class="' + (dot ? dot + ' ' : '') + bkCls(t) + '"></i>' + esc(s) + '</span>').join('');
// "In-class assessments": the usual three in the plural, a teacher's own name as they wrote it.
const bkPlural = ([t, l]) => bkIsDef(t) ? l.replace(/y$/, 'ie') + 's' : l;
// Which types count toward the grade, in a sentence, for wherever a type is chosen.
function bkCountSay() {
  const w = bkConf().w, on = bkCats().filter(([t]) => t !== 'fm' && +w[t] > 0), fm = bkIsType('fm') && !(+w.fm > 0);
  if (BK_TYPES.length === 3 && BK_DEF.every(([t]) => bkIsDef(t)) && on.length === 2 && fm) return 'Summatives and in-class assessments count toward the term grade in the Gradebook. Formative activities are feedback only.';
  const names = on.map(x => x[2]);
  return (names.length ? (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ' count' : names[0] + ' counts') + ' toward the term grade in the Gradebook, by the weights in Term setup.' : '') + (fm ? ' ' + bkLabel('fm', true) + ' is feedback only.' : '');
}
function bkLabel(t, short) { const x = bkCats().find(y => y[0] === t); return x ? x[short ? 2 : 1] : t === 'xc' ? 'Extra credit' : 'No type yet'; }
function bkPill(t) { return bkType(t) ? '<span class="bkpill ' + bkCls(t) + '">' + esc(bkLabel(t, true)) + '</span>' : ''; }
const BK_W0 = { sum: 50, ic: 50, fm: 0 };
function bkConf() {
  const b = lib.book || {};
  return { terms: (b.terms || []).filter(t => t && t.id), w: { ...BK_W0, ...(b.w || {}) }, empty: b.empty === 'zero' ? 'zero' : 'other', dl: b.dl || {}, xcTo: b.xcTo === 'ic' && bkIsType('ic') ? 'ic' : 'term', xcCap: b.xcCap !== false };
}
// What one extra credit entry adds to, and that in words.
const bkXcTo = (col, conf) => col.xcTo === 'ic' ? (bkIsType('ic') ? 'ic' : 'term') : col.xcTo === 'term' ? 'term' : conf.xcTo;
const bkIcAvg = () => (bkIsDef('ic') || !bkIsType('ic') ? 'in-class' : bkLabel('ic', true)) + ' average';
const bkCap = s => s.charAt(0).toUpperCase() + s.slice(1);
const bkXcWhere = to => to === 'ic' ? 'the ' + bkIcAvg() : 'the term grade';
// The two things extra credit can add to, for a pair of buttons; with no in-class type, only the grade.
const bkXcChoices = (term, the) => [['term', term]].concat(bkIsType('ic') ? [['ic', the ? the + bkIcAvg() : bkCap(bkIcAvg())]] : []);
// The gradebook's own saves: what it has on screen already has the change, so its copy is still good.
function bkSaveLib() { saveLib(); bk.ver = libVer; }
function bkSave(part) { lib.book = { ...(lib.book || {}), ...part }; bkSaveLib(); }
const isoDay = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function bkDay(s) { return s ? new Date(s + 'T12:00:00').toLocaleDateString(LANG_LOCALE, { month: 'short', day: 'numeric' }) : ''; }
// The term an assignment counts toward: the one it was moved to, else the one its due date falls in. '' is "no term": with no terms set up, that's the whole year.
function bkTermOf(col, terms) {
  if (col.term && terms.some(t => t.id === col.term)) return col.term;
  const t = terms.find(x => x.start && x.end && col.due >= x.start && col.due <= x.end);
  return t ? t.id : '';
}
const bkMean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

// One cell: what the gradebook knows about one student on one assignment.
function bkCellOf(p, g, d, k) {
  const marks = !!(d && d.s && d.s[k] && d.s[k].f && Object.values(d.s[k].f).some(pg => Object.values(pg || {}).some(a => a && a.length)));
  const fb = !!(g && g.fb), started = marks || !!((g && g.comment) || '').trim();   // fb: she switched on Feedback complete
  if (p.status === 'missing' || p.status === 'excused') return { st: p.status, fb };
  if (p.total == null && p.pct == null) return fb || started ? { fb, started } : null;
  const cell = { pct: p.pct, total: p.total, max: p.max, st: p.status, partial: p.partial, out: !!(g && g.outAvg), fb, started };
  if (p.rows && p.rows.length) cell.rows = p.rows;   // each rubric row's score, for the charts
  const goals = d ? goalCell(d, g, p) : null; if (goals) cell.goals = goals;   // what this paper says about each learning goal (goals.js)
  if (p.tries) cell.tries = triesSay(p);   // a retake: every try and which counts, in words
  return cell;
}
function bkTypedCell(ty, r) {
  if (!r) return null;
  if (r.st === 'missing' || r.st === 'excused') return { st: r.st, typed: true };
  if (r.v == null || r.v === '' || isNaN(+r.v)) return r.fb ? { fb: true, typed: true } : null;
  const v = +r.v, max = ty.max ? +ty.max : null, one = x => ({ pct: max ? roundPct(x / max * 100) : roundPct(x), total: max ? x : null, max });
  const was = (r.tries || []).filter(x => x != null && !isNaN(+x)).map(x => one(+x)), p = was.length ? withTries(one(v), was, max, true) : one(v);
  return { pct: p.pct, total: p.total, max, st: r.st || '', typed: true, fb: true, ...(was.length ? { tries: triesSay(p) } : {}) };
}
// Every column for every class, from saved work. Read once each time the gradebook opens.
async function bkLoad() {
  const all = await earlierWork('', d => hasWork(d) || !!(d && d.read)).catch(e => { console.error(e); return []; });
  const conf = bkConf(), byKey = new Map();
  for (const [id, d] of all) {
    const m = keptMeta.get(id) || {};
    if (m.newer && keptMeta.has(m.newer)) continue;   // an older copy of a download that was opened again
    const it = cardOfKept(id), cls = it ? it.classId || '' : pastClass(d, m), key = it ? it.id : 'dl:' + id;
    if (!cls || byKey.has(key)) continue;   // newest first, so the first one is the one that counts
    const o = it || conf.dl[id] || {};
    byKey.set(key, { key, it, dl: id, d, cls, name: (it && it.name) || o.name || m.name || 'A download', type: bkType(o.type), due: o.due || isoDay(workTime(d) || d.t || m.t), term: o.term || '' });
  }
  for (const c of lib.classes) for (const u of c.units) for (const it of u.items) {
    if (!it.typed || byKey.has(it.id)) { if (it.typed && byKey.has(it.id)) byKey.get(it.id).typed = it.typed; continue; }
    byKey.set(it.id, { key: it.id, it, cls: c.id, name: it.name, type: bkType(it.type), due: it.due || isoDay(it.opened), term: it.term || '', typed: it.typed, xcTo: it.xcTo || '' });
  }
  for (const col of byKey.values()) if (!col.typed && col.it && col.it.typed) col.typed = col.it.typed;
  return [...byKey.values()];
}
// The columns for one class, with each roster student's cell.
function bkClassCols(c, cols) {
  const names = c.names, terms = bkConf().terms;
  return cols.filter(x => x.cls === c.id).map(col => {
    const cells = new Map();
    if (col.d) {
      const d = col.d, pairs = rosterPairs(names, Object.keys({ ...d.s, ...d.read }));
      for (const n of names) {
        const k = pairs.get(n); if (!k) continue;
        const g = (d.s[k] && d.s[k].g) || {}, r = d.read && d.read[k];
        const cell = bkCellOf(pastScore(d.setup, r ? { ...g, read: r } : g), g, d, k);
        if (cell) cells.set(n, cell);
      }
    }
    if (col.type === 'xc') { cells.clear(); if (col.typed) for (const n of names) { const r = col.typed.s && col.typed.s[n], v = r ? +r.v : 0; if (v > 0) cells.set(n, { xc: v, typed: true }); } }
    else if (col.typed) for (const n of names) if (!cells.has(n) || (cells.get(n).pct == null && !cells.get(n).st)) { const cell = bkTypedCell(col.typed, col.typed.s && col.typed.s[n]); if (cell) cells.set(n, cell); }
    return { ...col, cells, termId: bkTermOf(col, terms) };
  }).sort((a, b) => (a.due || '').localeCompare(b.due || '') || natural(a.name, b.name));
}
const bkCounts = cell => !!cell && cell.pct != null && !cell.partial && !cell.out && cell.st !== 'missing' && cell.st !== 'excused';
// A student's grade for a set of columns: the average within each type, weighted by the teacher's own weights. soFar: a type with weight had nothing yet.
// Extra credit entries add on top: to the in-class average (before the weights) or to the grade itself. With nothing to add to yet, it waits.
// xcCap keeps the grade at 100% at most; the in-class average itself isn't capped, the grade it goes into is.
function bkGrade(name, cols, conf) {
  const by = {}, w = conf.w, xc = { term: 0, ic: 0 };
  let sum = 0, wt = 0, soFar = false;
  for (const col of cols) if (col.type === 'xc') { const cell = col.cells.get(name); if (cell && cell.xc) xc[bkXcTo(col, conf)] += cell.xc; }
  for (const [t] of BK_TYPES) {
    const ps = cols.filter(x => x.type === t).map(x => x.cells.get(name)).filter(bkCounts).map(x => x.pct);
    by[t] = ps.length ? bkMean(ps) : null;
    if (t === 'ic' && by.ic != null && xc.ic) by.ic += xc.ic;
    if (t === 'fm' || !(+w[t] > 0)) continue;
    if (by[t] == null) { if (cols.some(x => x.type === t)) soFar = true; if (conf.empty !== 'zero') continue; }
    sum += (by[t] || 0) * +w[t]; wt += +w[t];
  }
  const fmw = +w.fm > 0 ? by.fm : null;
  if (fmw != null) { sum += fmw * +w.fm; wt += +w.fm; }
  let grade = wt ? sum / wt : null;
  if (grade != null && xc.term) grade += xc.term;
  const capped = grade != null && conf.xcCap && grade > 100;
  if (capped) grade = 100;
  return { by, grade, soFar, xc: (by.ic != null ? xc.ic : 0) + (grade != null ? xc.term : 0), xcIc: by.ic != null ? xc.ic : 0, xcTerm: grade != null ? xc.term : 0, capped };
}

/* ---------- the box ---------- */
// host: 'dlg' is the box that opens while grading; 'page' is a class page's Gradebook, Charts or one-student screen (classpage.js), where the address picks the tab and the student.
let bk = { tab: 'table', cls: '', term: null, show: 'pct', stu: 0, cols: null, hi: '', host: 'dlg', sort: null, ver: -1, lib: null };
async function openBook(clsId, opts = {}) {
  if (batch) saveNow();
  const c = classById(clsId) || batchClass() || lib.classes.find(k => k.names.length) || lib.classes[0];
  if (!c) return toast('Add a class with its roster first, from the sidebar.');
  bk = { ...bk, host: 'dlg', tab: 'table', cls: c.id, term: null, stu: 0, cols: null, hi: opts.hi || '' };
  openDlg('<div class="bh"><h2>Gradebook</h2><div class="ovtabs" role="tablist">' + [['table', 'Table'], ['class', 'Class charts'], ['one', 'One student']].map(([k, l]) => '<button role="tab" data-bktab="' + k + '" aria-selected="' + (k === 'table') + '">' + l + '</button>').join('') +
    '</div><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div><div class="bb bkbody" id="bkBody"><p class="muted">Looking through your saved work…</p></div>');
  $('#dlgBox').classList.add('bkbox');
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-close]')) closeDlg(); };
  const cols = await bkLoad();
  if (!$('#bkBody')) return;
  bk.cols = cols;
  if (opts.hi) { const x = bkClassCols(c, cols).find(k => k.key === opts.hi); if (x) bk.term = x.termId; }
  bkDraw();
}
const bkClass = () => classById(bk.cls);
// How wide one chart is on screen (bkDraw measures it): a chart drawn at that width has text the size of the text around it.
const bkW = () => bk.w || 640;
// During anonymous grading, names stay hidden here too.
const bkWho = (n, i) => anonOn() ? 'Student ' + (i + 1) : n;
// The ⓘ beside a name opens that student's details card (people.js). Not while names are hidden.
const bkInfo = n => anonOn() ? '' : whoBtn('data-wc="' + esc(bk.cls) + '" data-wn="' + esc(n) + '"', n);
const bkPage = () => bk.host === 'page';
// A student's name: on a class page it's a link to their own page (by place on the roster, so no name is in the address).
const bkName = (n, i) => bkPage() ? '<a class="bklink" href="' + classHash(bkClass(), 'students', i) + '">' + esc(bkWho(n, i)) + '</a>' : esc(bkWho(n, i));
// One student: the next one, or any one. On a class page that's another address, in place of this one so Back returns to the list.
function bkGoStu(i) {
  const c = bkClass(); if (!c || i < 0 || i >= c.names.length) return;
  if (bkPage()) return go(classHash(c, 'students', i), true);
  bk.tab = 'one'; bk.stu = i; bkDraw();
}
// What the gradebook is drawn inside: the box, or the class page.
const bkHost = () => { const b = $('#bkBody'); return b ? b.closest('#dlgBox') || $('#vClass') : null; };
function bkTabsOff() { for (const b of document.querySelectorAll('[data-bktab]')) b.setAttribute('aria-selected', 'false'); }
// The terms shown as tabs: the teacher's own, then "No term" if anything falls outside them, then Whole year.
function bkTabs(cols) {
  const terms = bkConf().terms, out = terms.map(t => [t.id, t.name || 'Term']);
  if (!terms.length) return [['', 'This year']];
  if (cols.some(x => !x.termId)) out.push(['', 'Outside the terms']);
  out.push(['*', 'Whole year']);
  return out;
}
function bkTermNow(terms) { const t = isoDay(Date.now()), x = terms.find(y => y.start <= t && t <= y.end); return x ? x.id : terms.length ? terms[terms.length - 1].id : ''; }
function bkDraw() {
  const body = $('#bkBody'), c = bkClass(); if (!body || !c || !bk.cols) return;
  for (const b of document.querySelectorAll('[data-bktab]')) b.setAttribute('aria-selected', String(b.dataset.bktab === bk.tab));
  const conf = ibConf(c, bkConf()), all = bkClassCols(c, bk.cols), tabs = bkTabs(all);   // a DP class can weigh its components its own way (ib.js)
  if (bk.term == null || !tabs.some(t => t[0] === bk.term)) bk.term = conf.terms.length ? bkTermNow(conf.terms) : '';
  const cols = bk.term === '*' ? all : all.filter(x => x.termId === bk.term);
  const myp = classWay(c) === 'myp', page = bkPage(), tools = (!page || bk.tab === 'table') && !myp;
  if (myp && bk.tab === 'table' && c.names.length) { body.innerHTML = ibBookView(c, cols, all, tabs); return; }   // an MYP class: levels by criterion, not percents (ib.js)
  const dp = classWay(c) === 'dp'; if (bk.tab !== 'table' && ibk.view === 'pred') ibk.view = 'table';
  if (dp && bk.tab === 'table' && ibk.view === 'pred' && c.names.length) { body.innerHTML = ibPredView(c, cols, all, conf, tabs); return; }   // a DP class's predicted grades (ib.js)
  { const room = body.clientWidth - 36, gap = page ? 36 : 28, min = page ? 440 : 520, n = Math.max(1, Math.floor((room + gap) / (min + gap))); bk.w = room > 0 ? Math.max(320, Math.min(760, Math.round((room - (n - 1) * gap) / n))) : 640; }   // on a class page the class is the page's, and the table's tools stay with the table
  const bar = '<div class="bkbar">' + (page ? (bk.tab === 'one' ? '<a class="btn sm" id="bkBackStu" href="' + classHash(c, 'students') + '">← Students</a>' : '') : '<label class="muted">Class <select class="btn sm" id="bkCls">' + lib.classes.map(k => '<option value="' + k.id + '"' + (k === c ? ' selected' : '') + '>' + esc(k.name) + '</option>').join('') + '</select></label>') +
    '<div class="ovtabs bkterms" role="group" aria-label="Term">' + tabs.map(([id, l]) => '<button data-bkterm="' + esc(id) + '" aria-selected="' + (bk.term === id) + '">' + esc(l) + '</button>').join('') + '</div><span class="sp"></span>' +
    (bk.tab === 'table' && bk.term !== '*' ? '<div class="pseg" role="group" aria-label="Columns">' + [['', 'Every assignment'], ['1', 'Averages only']].map(([v, l]) => '<button data-bkonly="' + v + '" aria-pressed="' + (bkOnly() === !!v) + '">' + l + '</button>').join('') + '</div>' +
      '' : '') +
    (bk.tab === 'rep' && c.names.length ? rptBar() : '') + (bk.tab === 'miss' && c.names.length ? misBar() : '') +
    // One blue button, and one menu for what is used now and then. While students are being left out, Done stays in sight.
    (tools ? (bk.pick ? '<button class="btn sm" data-bkpickon aria-pressed="true">Done</button>' : '') + '<button class="btn sm primary" data-bkadd>+ Add scores</button>' +
      kmWrap('More <span aria-hidden="true">▾</span>', 'class="btn sm" id="bkMore"',
        (dp && bk.tab === 'table' && c.names.length ? '<button class="mitem" data-ibpredopen>Predicted grades<small>The 1 to 7 you predict for each student</small></button>' : '') +
        (bk.tab === 'table' && bk.term !== '*' && !bkOnly() ? '<button class="mitem" data-bkshow="' + (bk.show === 'pts' ? 'pct' : 'pts') + '">' + (bk.show === 'pts' ? 'Show percent' : 'Show points') + '<small>Now ' + (bk.show === 'pts' ? 'points' : 'percent') + '</small></button>' : '') +
        '<button class="mitem" data-bksetup>Term setup<small>Terms, types and weights</small></button><hr>' +
        '<button class="mitem" data-bkaddxc>Add extra credit…</button>' +
        '<button class="mitem" data-bkimport>Import scores…<small>From your old gradebook: a CSV or Excel file, or cells pasted</small></button>' +
        (bk.tab === 'table' ? '<button class="mitem" data-bkcopy>Copy the table</button>' + (bk.pick ? '' : '<hr><button class="mitem" data-bkpickon aria-pressed="false">Leave students out…<small>See the class averages without them</small></button>') : ''), 'right') : '') + '</div>';
  let main;
  if (!c.names.length) main = '<p class="muted bkpad">The gradebook lists the students on a class’s roster. Add a roster to ' + esc(c.name) + ' on its class page first.</p>';
  else if (bk.tab === 'class') main = myp ? ibClassView(c, cols, all) : bkClassView(c, cols, all, conf);   // an MYP class has levels, not percents (ib.js)
  else if (bk.tab === 'one') main = myp ? ibOneView(c, cols, all) : bkOneView(c, cols, conf);
  else if (bk.tab === 'rep') main = rptView(c, cols, conf);
  else if (bk.tab === 'miss') main = misView(c, cols);   // missing.js
  else if (bk.tab === 'goals') main = goalsView(c, cols, all);
  else main = bk.term === '*' ? bkYear(c, all, conf) : bkTable(c, cols, conf);
  const untyped = all.filter(x => !x.type);
  body.innerHTML = bar + (untyped.length && !myp ? '<div class="bknote">' + (untyped.length === 1 ? '“' + esc(untyped[0].name) + '” has' : untyped.length + ' assignments have') + ' no type yet, so ' + (untyped.length === 1 ? 'it doesn’t' : 'they don’t') + ' count toward a term grade. <button class="btn sm" data-bktypes>Set types</button></div>' : '') + main;
}
const bkCellText = (cell, show, col) => {
  if (col.type === 'xc') return cell && cell.xc ? '<span class="bkxc">+' + fmtNum(cell.xc) + '</span>' : '<span class="bknone">–</span>';
  if (!cell) return '<span class="bknone">–</span>';
  if (col.type === 'fm') return cell.st === 'missing' ? '<span class="bkst">missing</span>' : cell.st === 'excused' ? '<span class="bkst">excused</span>' : cell.fb ? '<span class="bkfb" aria-label="Feedback complete">✓</span>' : cell.started ? '<span class="bkstart">started</span>' : '<span class="bknone">–</span>';
  if (cell.st === 'missing' || cell.st === 'excused') return '<span class="bkst">' + cell.st + '</span>';
  if (cell.pct == null) return cell.fb ? '<span class="bkfb" aria-label="Feedback given, no score">✓</span>' : '<span class="bknone">–</span>';
  const v = show === 'pts' && cell.total != null ? fmtNum(cell.total) + '<small>/' + fmtNum(cell.max) + '</small>' : cell.pct + '%';
  return v + (cell.tries ? ' <span class="stag retk" title="' + esc(cell.tries) + '">retake</span>' : '') + (cell.partial ? ' <span class="stag">partial</span>' : cell.out ? ' <span class="stag">left out</span>' : cell.st === 'late' ? ' <span class="stag">late</span>' : '');
};
const bkColHead = col => '<th class="bkch' + (col.key === bk.hi ? ' hi' : '') + '"><button data-bkcol="' + esc(col.key) + '" title="Type, date and term"><span data-raw>' + esc(col.name) + '</span><small>' + esc(bkDay(col.due)) + (col.typed ? ' · typed in' : '') + '</small></button></th>';
function bkGroups(cols) {
  const g = bkCats().map(([t, , s]) => ({ t, s, cols: cols.filter(x => x.type === t) })).filter(x => x.cols.length);
  const xc = cols.filter(x => x.type === 'xc'); if (xc.length) g.push({ t: 'xc', s: 'Extra credit', cols: xc });
  const none = cols.filter(x => !x.type); if (none.length) g.push({ t: '', s: 'No type yet', cols: none });
  return g;
}
// What if: students left out of the class averages, to see how the class does without them. Their own grades don't change.
// Kept for this visit only, per class, and never saved.
const bkLeftAll = {};
const bkLeft = () => bkLeftAll[bk.cls] || (bkLeftAll[bk.cls] = new Set());
const bkIn = n => !bkLeft().has(n);
// The name cell: in Leave out mode, a box to tick for each student who counts.
const bkNameCell = (n, i) => '<td class="bknm">' + (bk.pick ? '<input type="checkbox" class="bkpick" data-bkpick="' + esc(n) + '"' + (bkIn(n) ? ' checked' : '') + ' aria-label="' + esc('Count ' + bkWho(n, i) + ' in the class average') + '"> ' : '') + bkName(n, i) + bkInfo(n) + (bkIn(n) ? '' : ' <span class="stag">left out</span>') + '</td>';
const bkFootName = c => { const k = bkLeft().size; return '<td class="bknm">Class average' + (k ? '<small class="bkleftn"> without ' + people(k, 'student') + ' · <button class="linkbtn" data-bkleftclear>count everyone</button></small>' : '') + '</td>'; };
const bkRowCls = n => bkIn(n) ? '' : ' class="bkleft"';
// The types that count toward this teacher's grade (weight above 0), each with its own average column beside the grade.
const bkCountTypes = conf => bkCats().filter(([t]) => +conf.w[t] > 0);
// Averages only: just each type's average and the grade, one row per student (kept for next time).
const bkOnly = () => { try { return localStorage.getItem('gs.bkOnly') === '1'; } catch (e) { return false; } };
// One type's average in a cell; the in-class average says when extra credit is in it.
const bkAvgCell = (r, t) => r.by[t] != null ? pctAvgText(r.by[t]) + (t === 'ic' && r.xcIc ? ' <small class="bkxc" title="Includes extra credit">+xc</small>' : '') : '<span class="bknone">–</span>';
const bkGradeCell = (r, nm) => r.grade != null ? pctAvgText(r.grade) + ibDpSay(r.grade, bkClass(), nm) + (r.soFar ? ' <small>so far</small>' : '') + (r.xcTerm ? ' <small class="bkxc" title="Includes extra credit">+xc</small>' : '') : '<span class="bknone">–</span>';
// The class average of one type's averages, or of the grades ('' for the grade).
// The type averages and the grade stay in view at the right while the assignments scroll under them.
// With more than three averages they scroll with the table, so the assignments still have room; the grade always stays.
const bkStick = (j, n) => j < n && n > 3 ? ' style="position:static"' : ' style="right:' + (j >= n ? 0 : 120 + (n - 1 - j) * 100) + 'px"';
const bkClassAvg = (grades, t) => { const ps = grades.map(r => t ? r.by[t] : r.grade).filter(v => v != null); return ps.length ? pctAvgText(bkMean(ps)) : '–'; };
function bkTable(c, cols, conf) {
  if (!cols.length) return '<p class="muted bkpad">Nothing graded for ' + esc(c.name) + ' in this term yet. Grade a download for it, or use + Add scores for work you did before.</p>';
  const only = bkOnly(), groups = only ? [] : bkGroups(cols), w = conf.w, termName = (bkTabs(cols).find(t => t[0] === bk.term) || [, 'Term'])[1], ct = bkCountTypes(conf), gradeName = bk.term ? 'Term grade' : 'Grade';
  const n = ct.length, sums = ct.map(([t, , s], j) => '<th class="bkavg bksum"' + bkStick(j, n) + ' data-copy="' + esc(s + ' average') + '">' + esc(s) + '<small>average · ' + (+w[t]) + '%</small></th>').join('') + '<th class="bkterm bksum"' + bkStick(n, n) + '>' + gradeName + '</th>';
  let h = '<div class="bkwrap"><table class="bktab' + (only ? ' bkonly' : '') + '" id="bkTab"><thead><tr class="bkg"><th></th>' + groups.map(g => '<th colspan="' + g.cols.length + '" class="' + bkCls(g.t) + '">' + esc(g.s) + (g.t === 'fm' ? (+w.fm > 0 ? ' · ' + w.fm + '%' : ' · feedback only') : g.t === 'xc' ? ' · points on top' : g.t ? ' · ' + (+w[g.t] || 0) + '%' : '') + '</th>').join('') + '<th colspan="' + (ct.length + 1) + '" class="bkgsum">' + esc(termName) + '</th></tr>' +
    '<tr><th class="bknm">Student</th>' + groups.map(g => g.cols.map(bkColHead).join('')).join('') + sums + '</tr></thead><tbody>';
  const grades = [];
  c.names.forEach((nm, i) => {
    const r = bkGrade(nm, cols, conf); if (bkIn(nm)) grades.push(r);
    h += '<tr' + bkRowCls(nm) + '>' + bkNameCell(nm, i) + groups.map(g => g.cols.map(col => { const cell = col.cells.get(nm), ed = !!col.typed && !(cell && !cell.typed);
      return '<td' + (ed ? ' class="bked" tabindex="0" data-bked="' + esc(col.key) + '" data-bkn="' + esc(nm) + '" title="Click to change"' : col.d ? ' title="Change this score in its download"' : '') + '>' + bkCellText(cell, bk.show, col) + '</td>'; }).join('')).join('') +
      ct.map(([t], j) => '<td class="bkavg bksum"' + bkStick(j, n) + '>' + bkAvgCell(r, t) + '</td>').join('') +
      '<td class="bkterm bksum"' + bkStick(n, n) + ' tabindex="0" ' + bkWhy(nm, r, conf) + '>' + bkGradeCell(r, nm) + '</td></tr>';
  });
  const inn = c.names.filter(bkIn), colAvg = col => { if (col.type === 'xc') { const k = inn.filter(x => col.cells.get(x)).length; return k + ' given'; } if (col.type === 'fm') { const k = inn.filter(x => (col.cells.get(x) || {}).fb).length; return k + '/' + inn.length; } const ps = inn.map(x => col.cells.get(x)).filter(bkCounts).map(x => x.pct); return ps.length ? pctAvgText(bkMean(ps)) : '–'; };
  h += '<tr class="bkfoot">' + bkFootName(c) + groups.map(g => g.cols.map(col => '<td>' + colAvg(col) + '</td>').join('')).join('') + ct.map(([t], j) => '<td class="bkavg bksum"' + bkStick(j, n) + '>' + bkClassAvg(grades, t) + '</td>').join('') + '<td class="bkterm bksum"' + bkStick(n, n) + '>' + bkClassAvg(grades, '') + '</td></tr></tbody></table></div>' +
    '<details class="bkhow"><summary>How this is worked out</summary><p class="muted bkcap">Students are in your roster order. ' + (ct.length ? 'Each type’s average counts every assignment of that type the same; the ' + gradeName.toLowerCase() + ' weights them by your Term setup. ' : '') + 'Missing and Excused never count against a student. Point at a ' + gradeName.toLowerCase() + ' to see how it’s worked out' + (cols.some(x => x.type === 'xc') ? ', extra credit included' : '') + '.' + (only ? '' : ' Scores you typed in can be changed here; a graded download’s scores change in that download.') + '</p></details>';
  return h;
}
function bkWhy(n, r, conf) {
  const w = conf.w, parts = bkCountTypes(conf).map(([t, , s]) => s + ' ' + w[t] + '%: ' + (r.by[t] != null ? pctAvgText(r.by[t]) : conf.empty === 'zero' ? 'none, counts as 0' : 'none yet, left out'));
  if (r.xcIc) parts.push('Extra credit +' + fmtNum(r.xcIc) + ' on ' + bkXcWhere('ic'));
  if (r.xcTerm) parts.push('Extra credit +' + fmtNum(r.xcTerm) + ' on the grade');
  if (r.capped) parts.push('kept at 100%');
  return 'data-tv="' + esc(r.grade != null ? pctAvgText(r.grade) : '–') + '" data-tl="' + esc(bkWho(n, bkClass().names.indexOf(n))) + '" data-tn="' + esc(parts.join(' · ')) + '"';
}
// The whole year: each term's type averages and grade side by side, then the year. With Averages only off it's the same; the year has no assignments to show.
// The year's figures are the average of the terms a student has one in, for each type and for the grade alike.
function bkYear(c, all, conf) {
  const terms = conf.terms;
  if (!terms.length) return '<p class="muted bkpad">Set up your terms with Term setup to see them side by side.</p>';
  const per = terms.map(t => all.filter(x => x.termId === t.id)), ct = bkCountTypes(conf), keys = ct.map(([t]) => t).concat(['']);
  const head = l => ct.map(([t, , s]) => '<th class="bkavg" data-copy="' + esc(l + ' ' + s + ' average') + '">' + esc(s) + '<small>average</small></th>').join('');
  let h = '<div class="bkwrap"><table class="bktab bkyear" id="bkTab"><thead><tr class="bkg"><th></th>' + terms.map(t => '<th colspan="' + keys.length + '" class="bkgsum">' + esc(t.name) + '</th>').join('') + '<th colspan="' + keys.length + '" class="bkgsum">Year</th></tr>' +
    '<tr><th class="bknm">Student</th>' + terms.map(t => head(t.name) + '<th class="bkterm" data-copy="' + esc(t.name + ' grade') + '">Grade</th>').join('') + head('Year') + '<th class="bkterm" data-copy="Year grade">Year</th></tr></thead><tbody>';
  const colv = [...terms, 0].map(() => keys.map(() => []));
  for (const [i, n] of c.names.entries()) {
    const rs = per.map(cols => bkGrade(n, cols, conf)), vals = rs.map(r => keys.map(k => k ? r.by[k] : r.grade));
    const yr = keys.map((k, j) => { const have = vals.map(v => v[j]).filter(v => v != null); return have.length ? bkMean(have) : null; });
    if (bkIn(n)) [...vals, yr].forEach((vs, a) => vs.forEach((v, j) => { if (v != null) colv[a][j].push(v); }));
    const cell = (v, k) => '<td class="' + (k ? 'bkavg' : 'bkterm') + '">' + (v != null ? pctAvgText(v) : '<span class="bknone">–</span>') + '</td>';
    h += '<tr' + bkRowCls(n) + '>' + bkNameCell(n, i) + vals.map(vs => vs.map((v, j) => cell(v, keys[j])).join('')).join('') + yr.map((v, j) => keys[j] ? cell(v, keys[j]) : '<td class="bkterm"><b>' + (v != null ? pctAvgText(v) : '–') + '</b></td>').join('') + '</tr>';
  }
  h += '<tr class="bkfoot">' + bkFootName(c) + colv.map(a => a.map((vs, j) => '<td class="' + (keys[j] ? 'bkavg' : 'bkterm') + '">' + (vs.length ? pctAvgText(bkMean(vs)) : '–') + '</td>').join('')).join('') + '</tr></tbody></table></div>' +
    '<details class="bkhow"><summary>How this is worked out</summary><p class="muted bkcap">The year is the average of the terms each student has a grade in, and each type’s year average is the average of their term averages for it.</p></details>';
  return h;
}

/* ---------- charts ---------- */
const BK_BANDS = [[90, 100, '90 to 100'], [80, 89, '80 to 89'], [70, 79, '70 to 79'], [60, 69, '60 to 69'], [0, 59, 'Below 60']];
function bkBands(list) {
  const n = list.length, cnt = BK_BANDS.map(([lo, hi]) => list.filter(p => roundPct(p.v) >= lo && (roundPct(p.v) <= hi || (lo === 90 && p.v > 100)))), most = Math.max(1, ...cnt.map(x => x.length));
  return '<div class="pbands" id="bkBands">' + BK_BANDS.map(([, , l], i) => { const k = cnt[i].length; return '<div class="pband"' + (k ? ' tabindex="0"' : '') + ' data-tv="' + esc(people(k, 'student')) + '" data-tl="' + esc(l + '%') + '" data-tn="' + esc(cnt[i].map(p => p.name).join(', ')) + '" data-tnraw><span>' + l + '</span><div class="pbt"><i style="width:' + k / most * 100 + '%"></i></div><span class="pbn"><b>' + k + '</b>' + (n ? ' · ' + Math.round(k / n * 100) + '%' : '') + '</span></div>'; }).join('') + '</div>';
}
// A line of points over assignments in date order. series: [{ cls, pts: [value or null] }], dots coloured by type.
function bkLine(cols, series, id, refLine) {
  const vals = series.flatMap(s => s.pts).concat(refLine != null ? [refLine] : []).filter(v => v != null);
  if (cols.length < 1 || !vals.length) return '<p class="muted">Nothing to show yet.</p>';
  const top = Math.max(...vals), lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10), hi = (top > 100 ? Math.ceil(top / 10) * 10 : Math.min(100, Math.ceil((top + 2) / 10) * 10)) || 100;   // a score above 100% (extra credit) stretches the scale instead of leaving the chart
  const W = bkW(), L = 44, R = 30, fit = chFit((W - L - R) / Math.max(1, cols.length), cols.length), lines = fit.lines, T = 16, B = 26 + lines * 14, H = 160 + B, X = i => L + (cols.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (cols.length - 1)), Y = v => T + (hi - v) / Math.max(10, hi - lo) * (H - T - B);
  let g = ''; for (let v = lo; v <= hi; v += 10) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="tgl"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ttk">' + v + '%</text>';
  if (refLine != null) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(refLine) + '" y2="' + Y(refLine) + '" class="bkref"/>';
  for (const s of series) {
    const seg = []; let run = [];
    s.pts.forEach((v, i) => { if (v == null) { if (run.length) seg.push(run); run = []; } else run.push(X(i) + ',' + Y(v)); }); if (run.length) seg.push(run);
    g += seg.map(r => '<polyline class="' + s.cls + '" points="' + r.join(' ') + '"/>').join('');
    if (s.dots) s.pts.forEach((v, i) => { if (v != null) g += '<circle class="bkdot ' + bkCls(cols[i].type) + '" cx="' + X(i) + '" cy="' + Y(v) + '" r="5.5" tabindex="0" data-tv="' + esc(pctAvgText(v)) + '" data-tl="' + esc(cols[i].name) + '" data-tn="' + esc(bkLabel(cols[i].type) + (s.tn ? ' · ' + s.tn(i) : '')) + '"/>'; });
  }
  cols.forEach((c, i) => { chLines(c.name, fit.chars, lines).forEach((l, j) => { g += '<text x="' + X(i) + '" y="' + (H - B + 18 + j * 14) + '" text-anchor="middle" class="tlb">' + esc(l) + '</text>'; }); if (i % fit.dates === 0) g += '<text x="' + X(i) + '" y="' + (H - 4) + '" text-anchor="middle" class="ttk">' + esc(bkDay(c.due)) + '</text>'; });
  return '<svg class="tsvg" id="' + id + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" data-rawa aria-label="' + esc(cols.map((c, i) => c.name + ' ' + series.map(s => s.pts[i] != null ? pctAvgText(s.pts[i]) : '–').join(' / ')).join(', ')) + '">' + g + '</svg>';
}
// Lowest to highest, the middle half darker, a line at the middle score.
function bkSpread(c, cols) {
  const rows = cols.map(col => ({ col, v: c.names.map(n => col.cells.get(n)).filter(bkCounts).map(x => x.pct).sort((a, b) => a - b) })).filter(r => r.v.length);
  if (!rows.length) return '<p class="muted">Nothing to show yet.</p>';
  const lo = Math.max(0, Math.floor(Math.min(...rows.map(r => r.v[0])) / 10) * 10), W = bkW(), L = 150, R = 16, rh = 28, H = rows.length * rh + 26, x = v => L + (Math.min(100, v) - lo) / Math.max(10, 100 - lo) * (W - L - R);
  const q = (v, f) => { const k = (v.length - 1) * f, i = Math.floor(k); return v[i] + (v[Math.ceil(k)] - v[i]) * (k - i); };
  let s = '';
  for (let t = lo; t <= 100; t += 10) s += '<line x1="' + x(t) + '" x2="' + x(t) + '" y1="0" y2="' + (H - 22) + '" class="tgl"/><text x="' + x(t) + '" y="' + (H - 6) + '" text-anchor="middle" class="ttk">' + t + '%</text>';
  rows.forEach(({ col, v }, i) => {
    const y = i * rh + 6, a = q(v, .25), b = q(v, .75), m = q(v, .5), nm = col.name.length > 20 ? col.name.slice(0, 19) + '…' : col.name;
    s += '<text x="0" y="' + (y + 13) + '" class="tlb">' + esc(nm) + '</text><rect x="' + x(v[0]) + '" y="' + (y + 5) + '" width="' + Math.max(2, x(v[v.length - 1]) - x(v[0])) + '" height="8" rx="4" class="bkrng"/>' +
      '<rect x="' + x(a) + '" y="' + (y + 1) + '" width="' + Math.max(3, x(b) - x(a)) + '" height="16" rx="4" class="bkiqr ' + bkCls(col.type) + '" tabindex="0" data-tv="' + esc('Middle ' + roundPct(m) + '%') + '" data-tl="' + esc(col.name) + '" data-tn="' + esc('Lowest ' + v[0] + '%, highest ' + v[v.length - 1] + '%, middle half ' + roundPct(a) + '–' + roundPct(b) + '%') + '"/>' +
      '<line x1="' + x(m) + '" x2="' + x(m) + '" y1="' + y + '" y2="' + (y + 18) + '" class="bkmid"/>';
  });
  return '<svg class="tsvg" id="bkSpread" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Spread of percents on each assignment">' + s + '</svg>';
}
const bkTile = (l, v, s, main) => '<div class="ovt' + (main ? ' main' : '') + '"><div class="ovl">' + l + '</div><div class="ovv">' + v + '</div><div class="ovs muted">' + s + '</div></div>';
function bkScored(cols) { return cols.filter(x => x.type !== 'fm' && bkIsType(x.type)); }
function bkClassView(c, cols, all, conf) {
  if (bk.term === '*') cols = all;
  const grades = c.names.map((n, i) => ({ n, name: bkWho(n, i), r: bkGrade(n, cols, conf) })).filter(g => bkIn(g.n)), gl = grades.filter(g => g.r.grade != null).map(g => ({ name: g.name, v: g.r.grade }));
  const typeAvg = t => { const ps = grades.map(g => g.r.by[t]).filter(v => v != null); return ps.length ? pctAvgText(bkMean(ps)) : '–'; };
  const sorted = gl.map(g => g.v).sort((a, b) => a - b), mid = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  const sc = bkScored(cols), avgOf = col => bkMean(c.names.map(n => col.cells.get(n)).filter(bkCounts).map(x => x.pct));
  const others = lib.classes.filter(k => k.names.length).map(k => { const kc = bkClassCols(k, bk.cols).filter(x => bk.term === '*' || x.termId === bk.term), gs = k.names.map(n => bkGrade(n, kc, conf).grade).filter(v => v != null); return { k, v: gs.length ? bkMean(gs) : null }; }).filter(x => x.v != null);
  const termAvg = gl.length ? bkMean(gl.map(g => g.v)) : null, miss = cols.flatMap(col => c.names.filter(n => (col.cells.get(n) || {}).st === 'missing'));
  return '<div class="bkpad"><div class="ovtiles" id="bkTiles">' + bkTile(bk.term === '*' ? 'Average grade' : 'Term average', termAvg != null ? pctAvgText(termAvg) : '–', people(gl.length, 'student') + (bkLeft().size ? ' · ' + bkLeft().size + ' left out' : ''), true) +
    bkTile('Middle grade', mid != null ? pctAvgText(mid) : '–', 'half above, half below') + bkCountTypes(conf).map(([t, , l]) => bkTile(l + ' average', typeAvg(t), people(cols.filter(x => x.type === t).length, 'assignment'))).join('') +
    bkTile('Missing work', miss.length, miss.length ? 'across ' + people(new Set(miss).size, 'student') : 'nothing outstanding') + '</div>' + bkHeat(c, cols, conf) +
    '<div class="ovcharts">' + chSec('Who is moving', bkMoving(c, cols), 'Each student’s last three scores against their earlier ones, in points: the biggest rises and drops.') +
    chSec('Where the class stands, assignment by assignment', bkStacks(c, cols), 'How many students landed in each range each time, so a shift in the whole class shows.') +
    chSec('Rubric rows across the summatives', bkRubricRows(c, cols), 'The class average on each rubric row, out of ' + chRowTop(chSums(cols)) + ', wherever the same row name comes back. The lowest row is in blue.') +
    '<section><h3 class="ovh3">Each assignment’s class average</h3>' + bkLine(sc, [{ cls: 'bkln', pts: sc.map(avgOf), dots: true, tn: i => people(c.names.map(n => sc[i].cells.get(n)).filter(bkCounts).length, 'score') }], 'bkTrend', termAvg) +
    '<div class="bkleg">' + bkLeg() + (termAvg != null ? '<span><i class="ref"></i>Average grade</span>' : '') + '</div></section>' +
    (bkIsType('sum') && bkIsType('ic') ? chSec(bkIsDef('sum') && bkIsDef('ic') ? 'Summatives against in-class work' : bkLabel('sum', true) + ' against ' + bkLabel('ic', true), bkScatter(c, cols, conf), 'One dot per student. On the line, the two match. Below it, a student does better ' + (bkIsDef('sum') && bkIsDef('ic') ? 'in class than on summatives' : 'on ' + bkLabel('ic', true) + ' than on ' + bkLabel('sum', true)) + '.') : '') +
    '<section><h3 class="ovh3">Spread on each assignment</h3>' + bkSpread(c, sc) + '<p class="muted ovcap2">The bar runs from lowest to highest, the darker part is the middle half of the class, and the line is the middle score.</p></section>' +
    '<section><h3 class="ovh3">' + (bk.term === '*' ? 'Grades' : 'Term grades') + '</h3>' + bkBands(gl) + '<p class="muted ovcap2">How many students landed in each range.</p></section>' +
    '<section><h3 class="ovh3">Compare your classes</h3><div class="ovrows" id="bkCmp">' + (others.length ? others.map(o => '<div class="bkcmp' + (o.k === c ? ' me' : '') + '"><span data-raw>' + esc(o.k.name) + '</span><div class="bkcmpt"><i style="width:' + Math.min(100, o.v) + '%"></i></div><b>' + pctAvgText(o.v) + '</b></div>').join('') : '<p class="muted">No class has a grade here yet.</p>') + '</div><p class="muted ovcap2">The average grade for each class over the same term, by the same weights.</p></section></div></div>';
}
function bkOneView(c, cols, conf) {
  if (bk.term === '*') cols = bk.cols ? bkClassCols(c, bk.cols) : cols;
  bk.stu = Math.max(0, Math.min(c.names.length - 1, bk.stu));
  const n = c.names[bk.stu], shown = bkWho(n, bk.stu), r = bkGrade(n, cols, conf), all = c.names.filter(bkIn).map(x => bkGrade(x, cols, conf));
  const cavg = t => { const ps = all.map(g => t ? g.by[t] : g.grade).filter(v => v != null); return ps.length ? bkMean(ps) : null; };
  const sc = bkScored(cols), fm = cols.filter(x => x.type === 'fm'), miss = cols.filter(x => (x.cells.get(n) || {}).st === 'missing');
  const bar = (l, v, ref, t) => '<div class="bkcmp"><span>' + l + '</span><div class="bkcmpt"><i class="' + t + '" style="width:' + Math.min(100, v || 0) + '%"></i>' + (ref != null ? '<em style="left:' + Math.min(100, ref) + '%" title="Class average ' + esc(pctAvgText(ref)) + '"></em>' : '') + '</div><b>' + (v != null ? pctAvgText(v) : '–') + '</b></div>';
  return '<div class="bkpad"><div class="bkstu"><button class="icon" data-bkstu="-1" aria-label="Previous student"' + (bk.stu ? '' : ' disabled') + '>‹</button><b id="bkStuName" data-raw>' + esc(shown) + '</b>' + bkInfo(n) + '<button class="icon" data-bkstu="1" aria-label="Next student"' + (bk.stu < c.names.length - 1 ? '' : ' disabled') + '>›</button><span class="muted">' + (bk.stu + 1) + ' of ' + c.names.length + ' · ← → to move</span>' + (bkPage() ? '<span class="sp"></span><button class="btn sm" data-pssone title="A one-page summary to print for a parent meeting">Progress sheet</button>' : '') + '</div>' +
    '<div class="ovtiles" id="bkStuTiles">' + bkTile(bk.term === '*' ? 'Grade' : 'Term grade', r.grade != null ? pctAvgText(r.grade) + (r.soFar ? ' <small>so far</small>' : '') : '–', [r.xc ? 'includes +' + fmtNum(r.xc) + ' extra credit' : '', cavg('') != null ? 'class average ' + pctAvgText(cavg('')) : ''].filter(Boolean).join(' · '), true) +
    bkCountTypes(conf).map(([t, , l]) => bkTile(l + ' average', r.by[t] != null ? pctAvgText(r.by[t]) : '–', [cols.filter(x => x.type === t && bkCounts(x.cells.get(n))).length + ' of ' + cols.filter(x => x.type === t).length + ' counted', t === 'ic' && r.xcIc ? '+' + fmtNum(r.xcIc) + ' extra credit' : '', cavg(t) != null ? 'class ' + pctAvgText(cavg(t)) : ''].filter(Boolean).join(' · '))).join('') +
    bkTile('Missing', miss.length, miss.length ? '<span data-raw>' + esc(miss.map(x => x.name).join(', ')) + '</span>' : 'nothing outstanding') + '</div>' + bkStrip(c, cols, n) +
    '<div class="ovcharts">' + chSec('Against the class', bkBandLine(c, sc, n, shown), 'The shaded band is the middle half of the class, so it’s clear when a score is unusual and when the assignment was just hard.') +
    chSec('Rubric rows', bkStuRows(c, cols, n), 'Their average on each rubric row across the summatives, out of ' + chRowTop(chSums(cols)) + '. The dashed line is the class average.') + goalsStu(c, cols, n) +
    '<section><h3 class="ovh3">By type</h3>' + bkScoredTypes().map(([t, , s]) => bar(t === 'sum' && bkIsDef(t) ? 'Summatives' : esc(s), r.by[t], cavg(t), bkCls(t))).join('') + bar('Grade', r.grade, cavg(''), '') + '<p class="muted ovcap2">The dashed line is the class average.</p>' +
    (fm.length ? '<h3 class="ovh3" style="margin-top:16px">Feedback</h3><p class="bkfbline">' + fm.filter(x => (x.cells.get(n) || {}).fb).length + ' of ' + fm.length + ' formative activities have feedback.</p>' : '') + '</section>' + attStuHtml(c, n) + '</div></div>';
}

/* ---------- column menu: type, date, term ---------- */
function bkColMenu(key, anchor) {
  const col = bkClassCols(bkClass(), bk.cols).find(x => x.key === key); if (!col) return;
  bkPopClose();
  const terms = bkConf().terms, p = document.createElement('div');
  p.className = 'bkpop'; p.id = 'bkPop';
  const xcTo = bkXcTo(col, bkConf());
  p.innerHTML = '<b>' + esc(col.name) + '</b>' + (col.type === 'xc' ? '<div class="bkpf">Extra credit adds to</div><div class="pseg bktypeseg" role="group">' + bkXcChoices('Term grade').map(([v, l]) => '<button data-bkcolxc="' + v + '" aria-pressed="' + (xcTo === v) + '">' + l + '</button>').join('') + '</div>'
    : '<div class="bkpf">Type</div><div class="pseg bktypeseg" role="group">' + bkCats().map(([t, , s]) => '<button data-bksettype="' + esc(t) + '" aria-pressed="' + (col.type === t) + '">' + esc(s) + '</button>').join('') + '</div>') +
    '<label class="bkpf">Due <input type="date" id="bkDue" value="' + esc(col.due || '') + '"></label>' +
    (terms.length ? '<label class="bkpf">Term <select id="bkTerm" class="btn sm"><option value="">By the date (' + esc((terms.find(t => t.id === bkTermOf({ ...col, term: '' }, terms)) || { name: 'none' }).name) + ')</option>' + terms.map(t => '<option value="' + t.id + '"' + (col.term === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select></label>' : '') +
    (col.typed && col.it ? '<button class="btn sm" data-bkedittyped="' + esc(col.it.id) + '">' + (col.type === 'xc' ? 'Edit the extra credit' : 'Edit the typed-in scores') + '</button>' : '') + '<button class="btn sm" data-bkpopclose>Done</button>';
  p.dataset.key = key;
  const host = bkHost();
  host.appendChild(p);
  const r = anchor.getBoundingClientRect(), b = host.getBoundingClientRect(), z = parseFloat(getComputedStyle(host).zoom) || 1;
  p.style.left = Math.max(8, Math.min(b.width / z - 280, (r.left - b.left) / z)) + 'px'; p.style.top = ((r.bottom - b.top) / z + 4) + 'px';
}
function bkPopClose() { const p = $('#bkPop'); if (p) p.remove(); }
// Where a column's type, date and term are kept: its card, or for a download with no card, the gradebook's own list.
function bkSetCol(key, part) {
  const col = bk.cols.find(x => x.key === key); if (!col) return;
  if (col.it) Object.assign(col.it, part);
  else { const dl = { ...bkConf().dl }; dl[col.dl] = { name: col.name, type: col.type, due: col.due, term: col.term, ...(dl[col.dl] || {}), ...part }; bkSave({ dl }); }
  Object.assign(col, part);
  if (col.it) bkSaveLib();
  if (!batch) renderLib();
}
// The one-time question: every assignment in this class with no type yet, each with the three choices.
function bkTypesDlg() {
  const left = bkClassCols(bkClass(), bk.cols).filter(x => !x.type);
  const body = $('#bkBody');
  bkTabsOff();
  body.innerHTML = '<div class="bkpad"><h3 class="ovh3">What type is each of these?</h3><p class="muted" style="margin-top:-6px">' + esc(bkCountSay()) + ' You can change any of them later from its column.</p>' +
    '<div class="bktypes">' + left.map(col => '<div class="bktyrow"><span><b>' + esc(col.name) + '</b> <span class="muted">' + esc(bkDay(col.due)) + '</span></span><div class="pseg" role="group">' + BK_TYPES.map(([t, , s]) => '<button data-bkqtype="' + esc(t) + '" data-key="' + esc(col.key) + '" aria-pressed="false">' + esc(s) + '</button>').join('') + '</div></div>').join('') + '</div>' +
    '<div class="bkfootbtns"><button class="btn primary" data-bkback>Done</button></div></div>';
}

/* ---------- term setup ---------- */
function bkSetupView() {
  const conf = bkConf(), body = $('#bkBody'), use = bkTypeUse();
  bkTabsOff();
  const row = t => '<div class="bktrow" data-tid="' + esc(t.id) + '"><input type="text" class="bkin" data-tf="name" value="' + esc(t.name || '') + '" aria-label="Term name"><input type="date" class="bkin" data-tf="start" value="' + esc(t.start || '') + '" aria-label="Starts"><input type="date" class="bkin" data-tf="end" value="' + esc(t.end || '') + '" aria-label="Ends"><button class="icon" data-tdel aria-label="Remove this term">✕</button></div>';
  body.innerHTML = '<div class="bkpad bksetup" id="bkSetup"><h3 class="bkh" style="grid-column:1/-1;margin:0">Term setup <span class="muted" style="font-size:13px;font-weight:400">· for all your classes</span></h3><section><h3 class="ovh3">Terms</h3><div class="bktrow muted bktrh"><span>Name</span><span>Starts</span><span>Ends</span><span></span></div><div id="bkTerms">' + conf.terms.map(row).join('') + '</div>' +
    '<button class="link" data-taddt>+ Add a term</button><p class="muted bkhint">An assignment counts toward the term its due date falls in. You can move one to another term from its column. With no terms, everything is one year.</p></section>' +
    '<section><h3 class="ovh3">Types, and what a grade is made of</h3><div id="bkCats">' + bkCats().map(([t, , s, k]) => bkCatRow(t, s, k, +conf.w[t] || 0, use.get(t) || 0)).join('') + '</div>' +
    '<div class="bkcadd"><button class="link" data-cadd>+ Add a type</button><span id="bkCback"></span></div><p class="muted bkhint" id="bkWsum"></p>' +
    '<p class="muted bkhint">These are the types you choose from for each assignment. Rename them or add your own, such as Homework or Projects. The arrows set their order, which is the order of the gradebook’s columns from left to right.</p>' +
    '<p class="muted bkhint">Inside each type, every assignment counts the same, whatever it’s out of: two assignments in a type worth 50% are 25% each.</p>' +
    '<h3 class="ovh3" style="margin-top:16px">When a type has nothing yet</h3><div class="pseg" role="group">' + [['other', 'Use the other types'], ['zero', 'Count it as 0']].map(([v, l]) => '<button data-bkempty="' + v + '" aria-pressed="' + (conf.empty === v) + '">' + l + '</button>').join('') + '</div>' +
    '<p class="muted bkhint">Early in a term, when one type has no scores yet, the grade comes from the others and is marked “so far”.</p>' +
    '<h3 class="ovh3" style="margin-top:16px">Extra credit</h3><div class="bkpf">New extra credit adds to</div><div class="pseg" role="group">' + bkXcChoices('The term grade', 'The ').map(([v, l]) => '<button data-bkxcto="' + v + '" aria-pressed="' + (conf.xcTo === v) + '">' + l + '</button>').join('') + '</div>' +
    '<p class="muted bkhint">One extra credit point adds one percentage point there. Added to ' + esc(bkXcWhere('ic')) + ', it counts by that type’s weight. No assignment’s own score is changed by it.</p>' +
    '<div class="bkpf" style="margin-top:10px">Above 100%</div><div class="pseg" role="group">' + [['cap', 'Keep grades at 100% at most'], ['over', 'Let a grade go over 100%']].map(([v, l]) => '<button data-bkxccap="' + v + '" aria-pressed="' + ((v === 'cap') === conf.xcCap) + '">' + l + '</button>').join('') + '</div>' +
    '<h3 class="ovh3" style="margin-top:16px">Retakes</h3><div class="bkpf">When a student has more than one try</div><div class="pseg" role="group">' + RETAKE_RULES.map(([v, l]) => '<button data-bkretake="' + v + '" aria-pressed="' + (retakeRule() === v) + '">' + l + ' counts</button>').join('') + '</div>' +
    '<p class="muted bkhint">Start a retake from the ⋯ beside Missing, Excused and Late on a paper, or type both scores into a typed-in cell as “7 &gt; 10”. Every try is kept; this says which one goes into averages and grades.</p></section>' +
    '<div class="bkfootbtns"><button class="btn" data-bkback>Cancel</button><button class="btn primary" data-bksavesetup>Save</button></div></div>';
  bkCatSync();
}
// One type in Term setup: its place, colour, name, weight, and a ✕ that works once no assignment is in it.
function bkCatRow(t, name, k, w, used) {
  const cls = BK_DEF.some(d => d[0] === t) ? t : 'kc k' + (k || 1);
  return '<div class="bkwrow bkcrow" data-cid="' + esc(t) + '"' + (k ? ' data-ck="' + k + '"' : '') + '><span class="bkmv"><button class="icon" data-cup aria-label="Move up" title="Move up (further left in the gradebook)">↑</button><button class="icon" data-cdn aria-label="Move down" title="Move down (further right in the gradebook)">↓</button></span>' +
    '<span class="bkdotk ' + cls + '"></span><span class="bkcnm"><input type="text" class="bkin" data-cname maxlength="40" value="' + esc(name) + '" placeholder="e.g. Homework" aria-label="Type name">' + (t === 'fm' ? '<small class="muted">feedback only: a ✓, no score</small>' : '') + '</span>' +
    '<label class="pnum"><input type="number" min="0" max="100" step="1" data-wt="' + esc(t) + '" value="' + w + '" aria-label="Percent of the grade">%</label>' +
    '<button class="icon" data-cdel aria-label="Remove this type"' + (used ? ' disabled title="' + esc(people(used, 'assignment') + (used === 1 ? ' is' : ' are') + ' in this type. Give ' + (used === 1 ? 'it' : 'them') + ' another type first, or rename this one.') + '"' : ' title="Remove this type"') + '>✕</button></div>';
}
// How many assignments are in each type: every class's cards, and downloads with no card.
function bkTypeUse() {
  const n = new Map(), add = t => { if (t) n.set(t, (n.get(t) || 0) + 1); };
  for (const c of lib.classes) for (const u of c.units) for (const it of u.items) add(it.type);
  for (const o of Object.values(bkConf().dl)) add(o && o.type);
  return n;
}
// After a type is added, moved or removed: the sum of the weights, and a way back for one of the usual three that was removed.
function bkCatSync() {
  const rows = [...document.querySelectorAll('#bkCats .bkcrow')], back = $('#bkCback');
  rows.forEach((r, i) => { r.querySelector('[data-cup]').disabled = !i; r.querySelector('[data-cdn]').disabled = i === rows.length - 1; });
  if (back) { const gone = BK_DEF.filter(d => !rows.some(r => r.dataset.cid === d[0])); back.innerHTML = gone.length ? ' · Add back: ' + gone.map(d => '<button class="link" data-cback="' + d[0] + '">' + d[2] + '</button>').join(', ') : ''; }
  bkWsum();
}
function bkWsum() { const el = $('#bkWsum'); if (!el) return; const s = [...document.querySelectorAll('[data-wt]')].reduce((a, i) => a + (+i.value || 0), 0); el.textContent = s === 100 ? 'These add up to 100%.' : 'These add up to ' + s + '%. Each type counts in proportion, so the grade still works out of 100.'; }
function bkSetupSave() {
  const terms = [...document.querySelectorAll('#bkTerms .bktrow')].map(r => { const v = f => r.querySelector('[data-tf="' + f + '"]').value.trim(); return { id: r.dataset.tid, name: v('name') || 'Term', start: v('start'), end: v('end') }; })
    .filter(t => t.start || t.end || t.name).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const bad = terms.find(t => !t.start || !t.end || t.end < t.start);
  if (bad) { toast('Give “' + bad.name + '” a start and an end date, with the end after the start.'); return false; }
  const w = {}, cats = [], names = new Set();
  for (const r of document.querySelectorAll('#bkCats .bkcrow')) {
    const id = r.dataset.cid, d = BK_DEF.find(x => x[0] === id), inp = r.querySelector('[data-cname]'), nm = inp.value.trim().replace(/\s+/g, ' ');
    if (!nm) { toast('Give every type a name, or remove the one with none.'); inp.focus(); return false; }
    if (names.has(nm.toLowerCase())) { toast('Two types are called “' + nm + '”. Give each its own name.'); inp.focus(); return false; }
    names.add(nm.toLowerCase());
    cats.push({ id, ...(d && d[2] === nm ? {} : { name: nm }), ...(d ? {} : { k: +r.dataset.ck || 1 }) });
    w[id] = Math.max(0, Math.min(100, +r.querySelector('[data-wt]').value || 0));
  }
  if (!cats.length) { toast('Keep at least one type.'); return false; }
  if (!Object.values(w).some(v => v > 0)) { toast('Give at least one type some weight.'); return false; }
  const usual = cats.length === BK_DEF.length && cats.every((c, i) => c.id === BK_DEF[i][0] && !c.name);   // the usual three in the usual order: no list is kept
  const e = document.querySelector('[data-bkempty][aria-pressed="true"]'), xt = document.querySelector('[data-bkxcto][aria-pressed="true"]'), xp = document.querySelector('[data-bkxccap][aria-pressed="true"]'), rk = document.querySelector('[data-bkretake][aria-pressed="true"]');
  bkSave({ terms, w, cats: usual ? undefined : cats, empty: e ? e.dataset.bkempty : 'other', xcTo: xt ? xt.dataset.bkxcto : 'term', xcCap: !xp || xp.dataset.bkxccap === 'cap', retake: rk ? rk.dataset.bkretake : 'high' });
  return true;
}

/* ---------- add scores without papers ---------- */
let bkAdd = null;
function bkAddView(itId, opts = {}) {
  const c = bkClass(), f = itId ? findItem(itId) : null, it = f && f.it;
  bkAdd = { it, max: it && it.typed && it.typed.max ? it.typed.max : 20, mode: it && it.typed && !it.typed.max && it.type !== 'xc' ? 'pct' : 'pts', type: bkType(it && it.type) || opts.type || (bkIsType('ic') ? 'ic' : (bkScoredTypes()[0] || BK_TYPES[0])[0]), xcTo: (it && it.xcTo) || bkConf().xcTo, s: JSON.parse(JSON.stringify((it && it.typed && it.typed.s) || {})) };
  const units = c.units;
  bkTabsOff();
  $('#bkBody').innerHTML = '<div class="bkpad bkaddv" id="bkAdd"><h3 class="bkh">' + (it ? 'Typed-in scores for ' + esc(it.name) : 'Add scores for ' + esc(c.name)) + '</h3><div class="bkaddgrid">' +
    '<label class="bkpf">Assignment<input type="text" class="bkin" id="bkaName" value="' + esc(it ? it.name : '') + '" placeholder="e.g. Vocab quiz 2"></label>' +
    '<div class="bkpf bktypef">Type<div class="pseg" role="group">' + bkCats().concat([BK_XC]).map(([t, , s]) => '<button data-bkatype="' + esc(t) + '" aria-pressed="' + (bkAdd.type === t) + '">' + esc(s) + '</button>').join('') + '</div></div>' +
    '<label class="bkpf">Due<input type="date" class="bkin" id="bkaDue" value="' + esc((it && it.due) || isoDay(Date.now())) + '"></label>' +
    (it ? '' : '<label class="bkpf">Unit<select class="btn sm" id="bkaUnit">' + units.map(u => '<option value="' + u.id + '">' + esc(u.name) + '</option>').join('') + '<option value="">' + (units.length ? 'A new unit: Typed in' : 'Unit 1 (new)') + '</option></select></label>') +
    '<div class="bkpf">Scored as<div class="bkso"><div class="pseg" role="group"><button data-bkamode="pts" aria-pressed="' + (bkAdd.mode === 'pts') + '">Points out of</button><button data-bkamode="pct" aria-pressed="' + (bkAdd.mode === 'pct') + '">Percent</button></div>' +
    '<input type="number" class="bkin bkmax" id="bkaMax" min="0.5" step="0.5" value="' + esc(bkAdd.max || 20) + '"' + (bkAdd.mode === 'pct' ? ' hidden' : '') + ' aria-label="Out of"></div></div>' +
    '<div class="bkpf" id="bkaXcTo">Adds to<div class="pseg" role="group">' + bkXcChoices('Term grade').map(([v, l]) => '<button data-bkaxcto="' + v + '" aria-pressed="' + (bkAdd.xcTo === v) + '">' + l + '</button>').join('') + '</div></div></div>' +
    '<div class="bkxcall" id="bkaXcAll"><span>Give</span><input type="number" class="bkin bksc" id="bkaXcV" step="0.5" min="0" value="1" aria-label="Points to give"><span>points to</span><button class="btn sm" data-bkaxcall="all">Everyone</button><button class="btn sm" data-bkaxcall="none">Everyone without any yet</button><span class="sp"></span><button class="link" data-bkaxcall="clear">Clear all</button></div>' +
    '<p class="muted bkhint" id="bkaXcSay"></p><textarea class="bkin bkpaste" id="bkaPaste" rows="2" placeholder="Paste a column of scores from a spreadsheet, in roster order. Or paste names with scores beside them. Or type them in below."></textarea><p class="muted bkhint" id="bkaPasteNote"></p>' +
    '<table class="ptab bkent"><thead><tr id="bkaHead"></tr></thead><tbody id="bkaRows"></tbody></table>' +
    '<div class="bkfootbtns"><span class="muted" id="bkaCount"></span><span class="sp"></span><button class="btn" data-bkback>Cancel</button><button class="btn primary" data-bkasave>' + (it ? 'Save scores' : 'Add to gradebook') + '</button></div></div>';
  bkAddRows();
  setTimeout(() => { const n = $('#bkaName'); if (n && !it) n.focus(); }, 0);
}
function bkXcSay(v) { return v === '' || v == null || !(+v > 0) ? '' : '+' + fmtNum(+v) + (bkAdd.xcTo === 'ic' ? ' on ' + bkXcWhere('ic') : '% on the term grade'); }
function bkAddMax() { return bkAdd.mode === 'pct' ? null : Math.max(0.5, +($('#bkaMax') || {}).value || 0) || null; }
function bkAddRows() {
  const c = bkClass(), max = bkAddMax(), fm = bkAdd.type === 'fm', xc = bkAdd.type === 'xc';
  $('#bkaXcTo').hidden = $('#bkaXcAll').hidden = $('#bkaXcSay').hidden = !xc;
  $('.bkso').closest('.bkpf').hidden = xc;
  if (xc) {
    $('#bkaXcSay').textContent = 'Each point adds one percentage point to ' + bkXcWhere(bkAdd.xcTo) + (bkAdd.xcTo === 'ic' ? ', which then counts by its weight' : '') + '. Leave a student blank for none. It doesn’t change any assignment’s score.';
    $('#bkaHead').innerHTML = '<th>Student</th><th>Extra credit</th><th>Adds</th><th></th>';
    $('#bkaRows').innerHTML = c.names.map((n, i) => { const r = bkAdd.s[n] || {}, v = r.v != null && r.v !== '' && +r.v ? r.v : '';
      return '<tr><td>' + esc(n) + '</td><td><input type="number" class="bkin bksc" step="0.5" min="0" data-bkai="' + i + '" value="' + esc(v) + '" aria-label="Extra credit for ' + esc(n) + '"> points</td><td class="muted">' + bkXcSay(v) + '</td><td></td></tr>'; }).join('');
    $('#bkaCount').textContent = c.names.filter(x => +((bkAdd.s[x] || {}).v) > 0).length + ' of ' + c.names.length + ' given extra credit';
    return;
  }
  $('#bkaHead').innerHTML = fm ? '<th>Student</th><th>Feedback complete</th><th></th><th>Mark as</th>' : '<th>Student</th><th>Score</th><th class="r">Percent</th><th>Mark as</th>';
  for (const el of document.querySelectorAll('.bkso,#bkaPaste,#bkaPasteNote')) el.closest('.bkpf, textarea, p').hidden = fm;
  if (fm) {
    $('#bkaRows').innerHTML = c.names.map((n, i) => { const r = bkAdd.s[n] || {}, off = r.st === 'missing' || r.st === 'excused';
      return '<tr><td>' + esc(n) + '</td><td><label class="pck"><input type="checkbox" data-bkafb="' + i + '"' + (r.fb ? ' checked' : '') + (off ? ' disabled' : '') + '><span>Complete</span></label></td><td></td>' +
        '<td><div class="pseg sm" role="group">' + ['missing', 'excused', 'late'].map(s => '<button data-bkast="' + s + '" data-bkai="' + i + '" aria-pressed="' + (r.st === s) + '">' + STATUS_LABEL[s] + '</button>').join('') + '</div></td></tr>'; }).join('');
    $('#bkaCount').textContent = c.names.filter(x => (bkAdd.s[x] || {}).fb).length + ' of ' + c.names.length + ' complete';
    return;
  }
  $('#bkaRows').innerHTML = c.names.map((n, i) => { const r = bkAdd.s[n] || {}, v = r.v != null ? r.v : '', p = v === '' || isNaN(+v) ? '' : (max ? roundPct(+v / max * 100) : roundPct(+v)) + '%';
    return '<tr><td>' + esc(n) + '</td><td><input type="number" class="bkin bksc" step="0.5" min="0" data-bkai="' + i + '" value="' + esc(v) + '"' + (r.st === 'missing' || r.st === 'excused' ? ' disabled' : '') + ' aria-label="Score for ' + esc(n) + '"> ' + (max ? '/ ' + fmtNum(max) : '%') + '</td><td class="r muted">' + p + '</td>' +
      '<td><div class="pseg sm" role="group">' + ['missing', 'excused', 'late'].map(s => '<button data-bkast="' + s + '" data-bkai="' + i + '" aria-pressed="' + (r.st === s) + '">' + STATUS_LABEL[s] + '</button>').join('') + '</div></td></tr>'; }).join('');
  const n = c.names.filter(x => { const r = bkAdd.s[x]; return r && ((r.v != null && r.v !== '') || r.st === 'missing' || r.st === 'excused'); }).length;
  $('#bkaCount').textContent = n + ' of ' + c.names.length + ' entered';
}
// One score per line in roster order, or "name, score" lines matched to the roster. Nothing it can't match is guessed.
function bkPaste(text) {
  const c = bkClass(), lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean), num = s => { const m = String(s).replace(',', '.').match(/^-?\d+(\.\d+)?/); return m ? +m[0] : null; };
  const named = lines.map(l => { const cells = l.split(/\t|,(?!\d)|;/).map(x => x.trim()).filter(Boolean); const last = cells[cells.length - 1]; return cells.length > 1 && num(last) != null && isNaN(+cells[0]) ? { name: cells.slice(0, -1).join(' '), v: num(last) } : null; });
  const left = [];
  if (named.every(Boolean)) {
    const pairs = rosterPairs(c.names, named.map(x => x.name)), back = new Map([...pairs].map(([r, k]) => [k, r]));
    for (const x of named) { const r = back.get(x.name); if (r) bkAdd.s[r] = { ...(bkAdd.s[r] || {}), v: x.v }; else left.push(x.name); }
  } else lines.slice(0, c.names.length).forEach((l, i) => { const v = /^(missing|m)$/i.test(l) ? null : num(l); bkAdd.s[c.names[i]] = /^(missing|m)$/i.test(l) ? { st: 'missing' } : { ...(bkAdd.s[c.names[i]] || {}), v }; });
  $('#bkaPasteNote').textContent = left.length ? 'Not on the roster, so left out: ' + left.join(', ') + '. Type their scores in by hand.' : lines.length > c.names.length && !named.every(Boolean) ? 'There were more lines than students; the extra ones were left out.' : 'Pasted. Check them below.';
  bkAddRows();
}
function bkAddSave() {
  const c = bkClass(), name = $('#bkaName').value.trim(), due = $('#bkaDue').value;
  if (!name) { $('#bkaName').focus(); return false; }
  const xc = bkAdd.type === 'xc', max = xc ? null : bkAddMax(), s = {};
  const fm = bkAdd.type === 'fm';
  if (xc) for (const [n, r] of Object.entries(bkAdd.s)) { const v = r.v === '' || r.v == null || isNaN(+r.v) ? 0 : Math.round(+r.v * 2) / 2; if (v > 0) s[n] = { v }; }
  else for (const [n, r] of Object.entries(bkAdd.s)) {
    const v = fm || r.v === '' || r.v == null || isNaN(+r.v) ? null : Math.round(+r.v * 2) / 2;
    if (fm ? r.fb || r.st : v != null || r.st) s[n] = fm && r.fb ? { v: null, st: r.st || '', fb: true } : { v, st: r.st || '' }
    if (s[n] && !fm && v != null && r.tries && r.tries.length) s[n].tries = r.tries;   // a retake typed in the table stays when the scores are edited here
  }
  const typed = { max, s };
  let it = bkAdd.it;
  if (it) { Object.assign(it, { name, type: bkAdd.type, due, typed }); if (xc) it.xcTo = bkAdd.xcTo; else delete it.xcTo; }
  else {
    const uid0 = $('#bkaUnit') && $('#bkaUnit').value;
    let u = c.units.find(x => x.id === uid0);
    if (!u) c.units.push(u = { id: uid(), name: c.units.length ? 'Typed in' : 'Unit 1', items: [] });
    u.items.push(it = { id: uid(), name, classId: c.id, type: bkAdd.type, due, typed, ...(xc ? { xcTo: bkAdd.xcTo } : {}) });
  }
  bkSaveLib(); if (!batch) renderLib();
  const col = bk.cols.find(x => x.key === it.id);
  if (col) Object.assign(col, { name, type: it.type, due, typed, xcTo: it.xcTo || '' }); else bk.cols.push({ key: it.id, it, cls: c.id, name, type: it.type, due, term: it.term || '', typed, xcTo: it.xcTo || '' });
  bk.term = bkTermOf({ due, term: it.term || '' }, bkConf().terms); bk.hi = it.id;
  return true;
}
// A typed-in cell changed right in the table.
function bkCellEdit(td) {
  const col = bk.cols.find(x => x.key === td.dataset.bked), n = td.dataset.bkn; if (!col || !col.typed) return;
  const r = (col.typed.s || {})[n] || {}, max = col.typed.max;
  if (col.type === 'fm') {   // feedback only: a click switches Feedback complete
    const s = { ...(col.typed.s || {}) }; s[n] = { ...r, v: null, fb: !r.fb };
    col.typed = { ...col.typed, s }; if (col.it) { col.it.typed = col.typed; bkSaveLib(); }
    bkDraw(); const back = document.querySelector('[data-bked="' + CSS.escape(col.key) + '"][data-bkn="' + CSS.escape(n) + '"]'); if (back) back.focus();
    return;
  }
  if (col.type === 'xc') {
    td.innerHTML = '<input type="text" class="bkcin" value="' + esc(+r.v > 0 ? fmtNum(+r.v) : '') + '" aria-label="Extra credit points">';
    const inp = td.querySelector('input'); inp.focus(); inp.select();
    let done = false;
    const finish = keep => {
      if (done) return; done = true;
      if (keep) { const v = Math.round(+inp.value.trim().replace(/^\+/, '') * 2) / 2, s = { ...(col.typed.s || {}) }; if (v > 0) s[n] = { v }; else delete s[n]; col.typed = { ...col.typed, s }; if (col.it) { col.it.typed = col.typed; bkSaveLib(); } }
      bkDraw(); const back = document.querySelector('[data-bked="' + CSS.escape(col.key) + '"][data-bkn="' + CSS.escape(n) + '"]'); if (back) back.focus();
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } });
    inp.addEventListener('blur', () => finish(true));
    return;
  }
  td.innerHTML = '<input type="text" class="bkcin" value="' + esc(r.st === 'missing' || r.st === 'excused' ? r.st : r.v != null ? (r.tries || []).concat(r.v).map(fmtNum).join(' > ') : '') + '" aria-label="Score' + (max ? ' out of ' + fmtNum(max) : ' as a percent') + '">';
  const inp = td.querySelector('input'); inp.focus(); inp.select();
  let done = false;
  const finish = keep => {
    if (done) return; done = true;
    if (keep) {
      const t = inp.value.trim().toLowerCase(), s = { ...(col.typed.s || {}) };
      if (!t) delete s[n];
      else if (/^m(issing)?$/.test(t)) s[n] = { v: null, st: 'missing' };
      else if (/^e(xcused)?$/.test(t)) s[n] = { v: null, st: 'excused' };
      else if (/>/.test(t) && t.split('>').every(x => x.trim() && !isNaN(+x.replace('%', '')))) { const vs = t.split('>').map(x => Math.round(+x.replace('%', '') * 2) / 2); s[n] = { v: vs.pop(), st: r.st === 'late' ? 'late' : '', tries: vs }; }   // "7 > 10": a first try and its retake
      else if (!isNaN(+t.replace('%', ''))) s[n] = { v: Math.round(+t.replace('%', '') * 2) / 2, st: r.st === 'late' ? 'late' : '' };
      col.typed = { ...col.typed, s };
      if (col.it) { col.it.typed = col.typed; bkSaveLib(); }
    }
    bkDraw();
    const back = document.querySelector('[data-bked="' + CSS.escape(col.key) + '"][data-bkn="' + CSS.escape(n) + '"]'); if (back) back.focus();
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
}
function bkCopy() {
  const t = $('#bkTab'); if (!t) return;
  const rows = [...t.querySelectorAll('tr')].filter(r => !r.classList.contains('bkg')).map(r => [...r.children].map(td => (td.dataset.copy || td.textContent).replace(/\s+/g, ' ').trim()).join('\t'));
  navigator.clipboard.writeText(rows.join('\n')).then(() => toast('Copied. Paste it into a spreadsheet.'), () => toast('Copying didn’t work in this browser.'));
}

/* ---------- clicks ---------- */
// The same clicks and keys wherever the gradebook is drawn: in the box, or on a class page.
const bkHere = e => { const b = $('#bkBody'); return !!b && e.currentTarget.contains(b); };
function bkClick(e) {
  if (!bkHere(e)) return;
  const b = e.target.closest('button, [data-bked]'); if (!b) { if (!e.target.closest('#bkPop')) bkPopClose(); return; }
  const d = b.dataset, c = bkClass();
  if (d.bktab) { bk.tab = d.bktab; bkPopClose(); return bkDraw(); }
  if (d.bkterm != null) { bk.term = d.bkterm; return bkDraw(); }
  if (d.bkshow) { bk.show = d.bkshow; return bkDraw(); }
  if (d.bkonly != null) { try { localStorage.setItem('gs.bkOnly', d.bkonly ? '1' : ''); } catch (e) { } return bkDraw(); }
  if (d.bkcopy != null) return bkCopy();
  if (d.bkpickon != null) { bk.pick = !bk.pick; return bkDraw(); }
  if (d.bkleftclear != null) { bkLeft().clear(); return bkDraw(); }
  if (d.bksetup != null) return bkSetupView();
  if (d.bkadd != null) return bkAddView();
  if (d.bkaddxc != null) return bkAddView('', { type: 'xc' });
  if (d.bktypes != null) return bkTypesDlg();
  if (d.bkback != null) { bkAdd = null; return bkDraw(); }
  if (d.bkcol) { if ($('#bkPop') && $('#bkPop').dataset.key === d.bkcol) return bkPopClose(); return bkColMenu(d.bkcol, b); }
  if (d.bkpopclose != null) { bkPopClose(); return bkDraw(); }
  if (d.bksettype) { const k = $('#bkPop').dataset.key; bkSetCol(k, { type: d.bksettype }); for (const x of document.querySelectorAll('[data-bksettype]')) x.setAttribute('aria-pressed', String(x === b)); return; }
  if (d.bkedittyped) { bkPopClose(); return bkAddView(d.bkedittyped); }
  if (d.bkqtype) { bkSetCol(d.key, { type: d.bkqtype }); for (const x of b.parentElement.children) x.setAttribute('aria-pressed', String(x === b)); return; }
  if (d.bked && !b.querySelector('input')) return bkCellEdit(b);
  if (d.bkstu) return bkGoStu(bk.stu + +d.bkstu);
  if (d.bkgo != null) return bkGoStu(+d.bkgo);
  if (d.chsort) { const s = bk.sort || { k: 'grade', dir: -1 }; bk.sort = s.k === d.chsort ? { k: s.k, dir: -s.dir } : { k: d.chsort, dir: d.chsort === 'name' ? 1 : -1 }; return bkDraw(); }
  if (d.taddt != null) { const t = document.createElement('div'); t.innerHTML = '<div class="bktrow" data-tid="' + uid() + '"><input type="text" class="bkin" data-tf="name" value="Term ' + (document.querySelectorAll('#bkTerms .bktrow').length + 1) + '" aria-label="Term name"><input type="date" class="bkin" data-tf="start" aria-label="Starts"><input type="date" class="bkin" data-tf="end" aria-label="Ends"><button class="icon" data-tdel aria-label="Remove this term">✕</button></div>'; $('#bkTerms').appendChild(t.firstChild); return; }
  if (d.tdel != null) { b.closest('.bktrow').remove(); return; }
  if (d.cup != null || d.cdn != null) { const r = b.closest('.bkcrow'), o = d.cup != null ? r.previousElementSibling : r.nextElementSibling; if (o) { if (d.cup != null) o.before(r); else o.after(r); bkCatSync(); (b.disabled ? r.querySelector(d.cup != null ? '[data-cdn]' : '[data-cup]') : b).focus(); } return; }
  if (d.cdel != null) { b.closest('.bkcrow').remove(); return bkCatSync(); }
  if (d.cadd != null || d.cback) {
    const rows = [...document.querySelectorAll('#bkCats .bkcrow')], ks = rows.map(r => +r.dataset.ck).filter(Boolean), k = [1, 2, 3, 4, 5].find(x => !ks.includes(x)) || ks.length % 5 + 1, def = d.cback && BK_DEF.find(x => x[0] === d.cback);
    $('#bkCats').insertAdjacentHTML('beforeend', def ? bkCatRow(def[0], def[2], 0, 0, bkTypeUse().get(def[0]) || 0) : bkCatRow('c' + uid(), '', k, 0, 0));
    bkCatSync(); if (!def) $('#bkCats').lastElementChild.querySelector('[data-cname]').focus();
    return;
  }
  if (d.bkxcto || d.bkxccap || d.bkretake) { const k = d.bkxcto ? 'bkxcto' : d.bkxccap ? 'bkxccap' : 'bkretake'; for (const x of document.querySelectorAll('[data-' + k + ']')) x.setAttribute('aria-pressed', String(x === b)); return; }
  if (d.bkcolxc) { const k = $('#bkPop').dataset.key; bkSetCol(k, { xcTo: d.bkcolxc }); for (const x of document.querySelectorAll('[data-bkcolxc]')) x.setAttribute('aria-pressed', String(x === b)); return; }
  if (d.bkaxcto) { bkAdd.xcTo = d.bkaxcto; for (const x of document.querySelectorAll('[data-bkaxcto]')) x.setAttribute('aria-pressed', String(x === b)); return bkAddRows(); }
  if (d.bkaxcall) { const v = Math.max(0, Math.round(+($('#bkaXcV') || {}).value * 2) / 2) || 0; for (const n of c.names) { if (d.bkaxcall === 'clear') delete bkAdd.s[n]; else if (d.bkaxcall === 'all' || !(+((bkAdd.s[n] || {}).v) > 0)) bkAdd.s[n] = { v }; } return bkAddRows(); }
  if (d.bkempty) { for (const x of document.querySelectorAll('[data-bkempty]')) x.setAttribute('aria-pressed', String(x === b)); return; }
  if (d.bksavesetup != null) { if (bkSetupSave()) bkDraw(); return; }
  if (d.bkatype) { bkAdd.type = d.bkatype; for (const x of document.querySelectorAll('[data-bkatype]')) x.setAttribute('aria-pressed', String(x === b)); return bkAddRows(); }
  if (d.bkamode) { bkAdd.mode = d.bkamode; for (const x of document.querySelectorAll('[data-bkamode]')) x.setAttribute('aria-pressed', String(x === b)); $('#bkaMax').hidden = d.bkamode === 'pct'; return bkAddRows(); }
  if (d.bkast) { const n = c.names[+d.bkai], r = bkAdd.s[n] || {}; bkAdd.s[n] = { ...r, st: r.st === d.bkast ? '' : d.bkast, v: d.bkast === 'late' || r.st === d.bkast ? r.v : null }; return bkAddRows(); }
  if (d.bkasave != null) { if (bkAddSave()) { bkAdd = null; bkDraw(); } return; }
}
function bkChange(e) {
  if (!bkHere(e)) return;
  const t = e.target;
  if (t.id === 'bkCls') { bk.cls = t.value; bk.term = null; bk.stu = 0; bk.hi = ''; return bkDraw(); }
  if (t.id === 'bkDue' || t.id === 'bkTerm') { const k = $('#bkPop').dataset.key; bkSetCol(k, t.id === 'bkDue' ? { due: t.value } : { term: t.value }); return; }
  if (t.id === 'bkaMax') return bkAddRows();
  if (t.dataset.bkpick != null) { const L = bkLeft(), n = t.dataset.bkpick; if (t.checked) L.delete(n); else L.add(n); return bkDraw(); }
  if (t.dataset.bkafb != null) { const n = bkClass().names[+t.dataset.bkafb]; bkAdd.s[n] = { ...(bkAdd.s[n] || {}), fb: t.checked }; return bkAddRows(); }
}
function bkInput(e) {
  if (!bkHere(e)) return;
  const t = e.target;
  if (t.dataset.wt) return bkWsum();
  if (t.dataset.bkai != null && t.classList.contains('bksc')) { const n = bkClass().names[+t.dataset.bkai]; bkAdd.s[n] = { ...(bkAdd.s[n] || {}), v: t.value === '' ? null : +t.value }; const p = t.closest('tr').children[2];
    if (bkAdd.type === 'xc') { p.textContent = bkXcSay(t.value); $('#bkaCount').textContent = bkClass().names.filter(x => +((bkAdd.s[x] || {}).v) > 0).length + ' of ' + bkClass().names.length + ' given extra credit'; return; }
    const max = bkAddMax(); p.textContent = t.value === '' || isNaN(+t.value) ? '' : (max ? roundPct(+t.value / max * 100) : roundPct(+t.value)) + '%'; return; }
}
function bkPasted(e) {
  if (!bkHere(e) || e.target.id !== 'bkaPaste') return;
  e.preventDefault(); bkPaste((e.clipboardData || window.clipboardData).getData('text')); e.target.value = '';
}
function bkKey(e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.bked && !e.target.querySelector('input')) { e.preventDefault(); return bkCellEdit(e.target); }
  if (bk.tab === 'one' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey && !e.ctrlKey && !e.metaKey && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { const c = bkClass(); if (!c) return; const n = bk.stu + (e.key === 'ArrowRight' ? 1 : -1); if (n >= 0 && n < c.names.length) { e.preventDefault(); bkGoStu(n); } }
  if (e.key === 'Escape' && $('#bkPop')) { e.preventDefault(); e.stopPropagation(); bkPopClose(); }
}
for (const host of [$('#dlgBox'), $('#vClass')]) {
  host.addEventListener('click', bkClick); host.addEventListener('change', bkChange); host.addEventListener('input', bkInput); host.addEventListener('paste', bkPasted);
}
$('#dlgBox').addEventListener('keydown', e => { if (bkHere(e)) bkKey(e); }, true);
// On a class page the keys work wherever the pointer last was, as long as nothing is open over the page.
document.addEventListener('keydown', e => { if (bkPage() && $('#bkBody') && $('#dlg').hidden && !$('#findDlg') && !$('#askDlg') && !$('#pcard')) bkKey(e); });
$('#bookBtn').onclick = () => { openBook(batchClass() ? batchClass().id : '', { hi: batch && batch.assignment ? batch.assignment.id : '' }); };

Object.assign(window.__gs, { openBook, bkLoad, bkClassCols, bkGrade, bkConf, bkTermOf, bk: () => bk });
