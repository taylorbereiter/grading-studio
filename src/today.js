/* ---------------- Today: what she teaches, what is waiting to be marked, what is ready to hand back (stage 4) ---------------- */
// The first screen answers three questions in that order. Teaching comes from a one-way read of the Planner's timetable; marking and
// handing back come from the work kept in this browser. Nothing new is stored: every line is worked out from what is already there.

/* teaching today: a one-way read of the Planner's timetable */
// The Planner keeps its timetable and its lessons in its own database. This opens that database only to read, never writes to it, and never
// makes it: with no Planner work in this browser, nothing shows. Class names, colours, times and lesson names are all it takes. Nothing of
// grading's goes the other way, and the Planner never opens grading's work.
let plan = null;   // { classes, daysOff, lessons } or null when there is no timetable
async function planRead() {
  const db = await planDb(false); let setup = null, lessons = [];
  if (db) {
    try { const t = db.transaction(['kv', 'lessons']); [setup, lessons] = await Promise.all([idbP(t.objectStore('kv').get('setup')), idbP(t.objectStore('lessons').getAll())]); } catch {}
    db.close();
  }
  const hex = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#1F6FB2';
  const classes = (setup && Array.isArray(setup.classes) ? setup.classes : []).filter(c => c && c.id != null).map(c => ({ id: String(c.id), name: String(c.name || c.id), color: hex(c.color),
    meets: (Array.isArray(c.meets) ? c.meets : []).map(m => ({ dow: +m.dow, start: String(m.start || ''), end: String(m.end || '') })) }));
  plan = !classes.length ? null : {
    classes, semStart: String(setup.semStart || ''), semEnd: String(setup.semEnd || ''),
    daysOff: (Array.isArray(setup.daysOff) ? setup.daysOff : []).filter(d => d && d.date).map(d => ({ date: String(d.date), label: String(d.label || '') })),
    lessons: (Array.isArray(lessons) ? lessons : []).filter(l => l && l.id && Array.isArray(l.slots) && l.slots.length).map(l => ({ id: String(l.id), title: String(l.title || 'Untitled lesson'), status: String(l.status || ''), done: !!l.final, n: Array.isArray(l.slides) ? l.slides.length : 0, slots: l.slots.map(s => ({ classId: String(s.classId), date: String(s.date) })) })),
  };
  return plan;
}
const planUrl = h => $('#lessonsBtn').getAttribute('href') + (h || '');
const planTime = t => { const m = /^(\d{1,2}):(\d\d)$/.exec(t || ''); return m ? (+m[1] % 12 || 12) + ':' + m[2] : ''; };
// Today's meetings in the order they happen, each with the lesson planned for it, if there is one.
function todayRows(p, now) {
  const d = isoDay(now || Date.now()), dow = new Date(now || Date.now()).getDay(), off = p.daysOff.find(x => x.date === d);
  if (off) return { off: off.label || 'No school', rows: [] };
  const rows = [];
  for (const c of p.classes) for (const m of c.meets) if (m.dow === dow) rows.push({ c, m, lessons: p.lessons.filter(l => l.slots.some(s => s.classId === c.id && s.date === d)) });
  return { off: '', rows: rows.sort((a, b) => a.m.start.localeCompare(b.m.start)) };
}
// The class that is on now, or else the next one: the first that has not ended yet.
function nowRow(rows, now) {
  const d = new Date(now || Date.now()), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), pad = t => (/^\d:/.test(t) ? '0' : '') + t;
  return rows.find(r => pad(r.m.end || r.m.start) > hm) || null;
}
const T_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const numWord = n => ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'][n] || String(n);
function todayHtml(prim) {
  if (!plan) return '<h2 class="tcap">Teaching today</h2><div class="tcard"><div class="trow none"><span class="nt"><b>Your timetable isn’t here yet</b><span class="ns">Add your class times in the Planner, and each day’s classes and lessons show here.</span></span><a class="btn sm" href="' + esc(planUrl('#timetable')) + '">Open the Planner</a></div></div>';
  const t = todayRows(plan), cur = nowRow(t.rows);
  const say = l => l.done ? 'finished' : l.status === 'review' ? 'ready for you' : l.status === 'claude' ? 'with Claude' : 'draft';
  const row = r => {
    const { c, m, lessons } = r, l = lessons[0], more = lessons.length > 1 ? ' · and ' + (lessons.length - 1) + ' more' : '';
    return '<a class="trow' + (r === cur ? ' now' : '') + '" href="' + esc(planUrl(l ? '#lesson/' + encodeURIComponent(l.id) : '#week')) + '" title="' + (l ? 'Open this lesson in the Planner' : 'Plan this class in the Planner') + '"><span class="tt">' + planTime(m.start) + '</span>' +
      '<span class="nt"><b><span class="rdot" style="background:' + c.color + '"></span>' + esc(c.name) + '</b><span class="ns">' + (l ? esc(l.title) + (l.n ? ' · ' + l.n + (l.n === 1 ? ' slide' : ' slides') : '') + ' · ' + say(l) + more : 'No lesson planned yet') + '</span></span>' +
      '<span class="btn sm' + (prim === 'lesson' && r === cur ? ' primary' : '') + '">' + (l ? 'Open' : 'Plan it') + '</span></a>';
  };
  return '<div class="thd"><h2 class="tcap">Teaching today</h2><a class="link tweek" href="' + esc(planUrl('#week')) + '">Open the week</a></div><div class="tcard">' +
    (t.off ? '<div class="trow none"><span class="nt"><b>No classes today</b><span class="ns">' + esc(t.off) + '</span></span></div>' : t.rows.length ? t.rows.map(row).join('') : '<div class="trow none"><span class="nt"><span class="ns">No classes on your timetable today.</span></span></div>') + '</div>';
}

/* to mark, ready to hand back, earlier work: the work kept in this browser, sorted by where it stands */
function homeGroups() {
  const mark = [], back = [], old = [];
  for (const m of [...keptMeta.values()].sort((a, b) => b.t - a.t)) {
    const st = keptState(m), it = cardOfKept(m.id);
    if ((m.newer && keptMeta.has(m.newer)) || m.ret || !st.of) old.push(m);   // an older copy, handed back already, or nothing in it to score
    else if (it && it.type === 'fm') mark.push(m);   // feedback only: it waits here until it is handed back
    else if (st.left) mark.push(m);
    else back.push(m);
  }
  return { mark, back, old };
}
const keptWhere = m => { const it = cardOfKept(m.id), f = it && findItem(it.id); return { it, cls: f && f.c !== lib.loose ? f.c : null }; };
const keptDots = m => kmWrap('⋯', 'class="icon kdots" aria-label="More for ' + esc(m.name || 'this assignment') + '" title="More"',
  '<button class="mitem" data-kforget="' + esc(m.id) + '" title="Removes the papers, your marks and scores for this assignment from this browser and any linked folder">Forget</button>', 'right');
const keptName = m => m.papers ? '<button class="kname" data-kopen="' + esc(m.id) + '" title="Open the papers">' + esc(m.name || 'Student work') + '</button>' : '<b class="kname">' + esc(m.name || 'Student work') + '</b>';
function markRow(m, prim) {
  const st = keptState(m), w = keptWhere(m), fm = w.it && w.it.type === 'fm', began = st.done || m.partial;
  const sub = [w.cls ? w.cls.name : '', w.it && w.it.due ? 'due ' + bkDay(w.it.due) : 'last worked on ' + fmtDay(m.t), m.papers ? '' : 'papers not kept, drop the download again'].filter(Boolean).join(' · ');
  const say = fm ? 'Formative · feedback only' : began ? st.done + ' of ' + st.of + ' scored' + keptMore(m) : st.of + (st.of === 1 ? ' paper' : ' papers') + ', not started' + (m.off ? ' · ' + m.off + ' missing or excused' : '');
  return '<div class="krow"><div class="kn">' + keptName(m) + '<span class="ks">' + esc(sub) + '</span></div>' +
    '<div class="kp">' + (fm ? '' : stateBar(st)) + '<span class="kl">' + esc(say) + '</span></div>' +
    (m.papers ? '<button class="btn sm' + (prim ? ' primary' : '') + '" data-kopen="' + esc(m.id) + '">' + (began || fm ? 'Continue' : 'Start') + '</button>' : '<span></span>') + keptDots(m) + '</div>';
}
function oldRow(m) {
  const st = keptState(m), w = keptWhere(m), stale = m.newer && keptMeta.has(m.newer);
  const sub = [w.cls ? w.cls.name : '', stale ? 'an older copy: your work went on in a newer one' : m.ret ? 'returned ' + fmtDay(m.ret) : 'last worked on ' + fmtDay(m.t),
    st.of ? st.done + ' of ' + st.of + ' scored' + keptMore(m) : '', m.papers ? '' : 'papers not kept, drop the download again'].filter(Boolean).join(' · ');
  return '<div class="krow old"><div class="kn">' + keptName(m) + '<span class="ks">' + esc(sub) + '</span></div>' + keptDots(m) + '</div>';
}
// What a finished set of papers says about the class: the average of each paper's percent, and each rubric row's average. Read from the
// saved work, once per save. Numbers about the class only: no name is read into it.
const homeStat = new Map();
function statOf(m) {
  const had = homeStat.get(m.id);
  if (had && had.t === m.t) return had.v;
  if (!had || !had.busy) {
    const rec = { t: had ? had.t : -1, v: had ? had.v : null, busy: true }; homeStat.set(m.id, rec);
    kget('work', m.id).then(k => {
      const d = newestWork(store.get(m.id, null), k), v = d ? workStat(d) : null;
      homeStat.set(m.id, { t: m.t, v }); homeRender();
    }).catch(e => { console.error(e); homeStat.set(m.id, { t: m.t, v: null }); });
  }
  return had ? had.v : null;
}
function workStat(d) {
  const su = { ...DEFAULT_SETUP, ...d.setup }, pcts = [], crit = su.mode === 'rubric' ? su.criteria : [], rows = crit.map(c => ({ name: String(c), sum: 0, n: 0, low: 0 }));
  for (const k of new Set([...Object.keys(d.s || {}), ...Object.keys(d.read || {})])) {
    const g = { ...(((d.s || {})[k] || {}).g || {}), read: (d.read || {})[k] }, p = pastScore(d.setup, g);
    if (p.status === 'missing' || p.status === 'excused' || p.partial || g.outAvg) continue;
    if (p.pct != null) pcts.push(p.pct);
    if (!p.paper) for (const [i, row] of rows.entries()) { const v = (g.rubric || [])[i]; if (v != null) { row.sum += v; row.n++; if (v <= 2) row.low++; } }
  }
  const full = rows.filter(r => r.n >= 3).map(r => ({ name: r.name, avg: r.sum / r.n, low: r.low, n: r.n }));
  return { avg: pcts.length ? roundPct(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null, n: pcts.length, rows: full.length === rows.length && rows.length >= 2 ? full : [] };
}
function backHtml(list, prim) {
  if (!list.length) return '';
  return '<h2 class="tcap">Ready to hand back</h2><div class="tcard">' + list.map(m => {
    const st = keptState(m), w = keptWhere(m), s = statOf(m);
    const sub = [w.cls ? w.cls.name : '', (st.of === 1 ? 'the one paper' : 'all ' + st.of) + ' scored', s && s.avg != null ? 'average ' + s.avg + '%' : '', m.papers ? '' : 'papers not kept, drop the download again'].filter(Boolean).join(' · ');
    return '<div class="krow back"><div class="kn">' + keptName(m) + '<span class="ks">' + esc(sub) + '</span></div><div class="kact">' + (m.papers ? '<a class="btn sm' + (prim && m === list.find(x => x.papers) ? ' primary' : '') + '" href="' + batchHash(m.id, 'return') + '" data-kret="' + esc(m.id) + '">Return papers</a>' : '<span></span>') + keptDots(m) + '</div></div>';
  }).join('') + '</div>';
}
// One card: the newest finished rubric assignment, its weakest row, and how many students to sit down with. Who they are is one click away, on Insights.
const NEXT_DAYS = 30;
function nextHtml(groups) {
  const m = [...groups.back, ...groups.old].filter(m => keptState(m).of && !keptState(m).left && !(m.newer && keptMeta.has(m.newer)) && Date.now() - m.t < NEXT_DAYS * 864e5).sort((a, b) => b.t - a.t)[0];
  const s = m && statOf(m); if (!s || !s.rows.length) return '';
  const w = keptWhere(m), low = s.rows.reduce((a, b) => b.avg < a.avg ? b : a), flat = s.rows.every(r => Math.abs(r.avg - low.avg) < 0.05);
  const head = (w.cls ? esc(w.cls.name) + ': ' : '') + (flat ? 'every row came out the same on ' : esc(low.name) + ' was the weakest row on ') + esc(m.name || 'the last set of papers') + '.';
  const who = low.low ? numWord(low.low) + (low.low === 1 ? ' student' : ' students') + ' scored 2 or below on ' + esc(low.name) + '.' : 'Nobody scored 2 or below on ' + esc(low.name) + '.';
  return '<h2 class="tcap">What the class needs next</h2><div class="tcard tneed"><p class="tbig">' + head.charAt(0).toUpperCase() + head.slice(1) + '</p>' +
    '<div class="tbars" role="img" aria-label="' + esc(s.rows.map(r => r.name + ' ' + fmtNum(Math.round(r.avg * 10) / 10) + ' of 4').join(', ')) + '">' + s.rows.map(r => '<span class="tbn">' + esc(r.name) + '</span><span class="tbt"><i class="' + (r === low && !flat ? 'low' : '') + '" style="width:' + Math.round(r.avg / 4 * 100) + '%"></i></span><span class="tbv">' + (Math.round(r.avg * 10) / 10).toFixed(1) + '</span>').join('') + '</div>' +
    (flat ? '' : '<p class="tsay">' + who + '</p>') + (m.papers ? '<a class="tlink" href="' + batchHash(m.id, 'insights') + '">' + (low.low && !flat ? 'See who' : 'Open Insights') + T_ARROW + '</a>' : '') + '</div>';
}
function hsideShow() { $('#hside').hidden = $('#handBack').hidden && $('#needNext').hidden && $('#needs').hidden; }
const OLD_SHOWN = 3;
let oldAll = false;
function homeRender() {
  if (!shellReady) return;
  const put = (el, h) => { el.hidden = !h; if (el.dataset.h !== h) { el.dataset.h = h; (el.querySelector(':scope > .kept') || el).innerHTML = h; } };
  renderNeedsOnly();
  const g = homeGroups(), t = plan ? todayRows(plan) : null, cur = t ? nowRow(t.rows) : null;
  // One blue button on the screen: a card that is asking her something, else the class that is on, else the papers to go on with, else the papers to hand back, else opening new work.
  const asking = !!$('#safeAsk .btn.primary, #sampleNote .btn.primary');
  const prim = asking ? '' : cur && cur.lessons.length ? 'lesson' : g.mark.some(m => m.papers) ? 'mark' : g.back.some(m => m.papers) ? 'back' : 'drop';
  const firstMark = g.mark.find(m => m.papers);
  put($('#today'), todayHtml(prim));
  put($('#toMark'), g.mark.map(m => markRow(m, prim === 'mark' && m === firstMark)).join(''));
  put($('#handBack'), backHtml(g.back, prim === 'back'));
  put($('#needNext'), nextHtml(g));
  const old = oldAll ? g.old : g.old.slice(0, OLD_SHOWN);
  put($('#earlier'), old.map(oldRow).join(''));
  const more = $('#keptAll'); more.hidden = g.old.length <= OLD_SHOWN; more.textContent = oldAll ? 'Show only the newest' : 'Show all ' + g.old.length;
  $('#pickFiles').classList.toggle('primary', prim === 'drop');
  const sets = n => numWord(n).toLowerCase() + (n === 1 ? ' set' : ' sets') + ' of papers';
  const teach = !t ? '' : t.off ? 'No classes today. ' : t.rows.length ? numWord(t.rows.length) + (t.rows.length === 1 ? ' class' : ' classes') + ' today. ' : 'No classes today. ';
  const work = g.mark.length && g.back.length ? sets(g.mark.length) + ' to mark, ' + numWord(g.back.length).toLowerCase() + ' ready to hand back.' : g.mark.length ? sets(g.mark.length) + ' to mark.' : g.back.length ? sets(g.back.length) + ' ready to hand back.' : keptMeta.size ? 'nothing waiting to be marked.' : '';
  const say = teach + work.charAt(0).toUpperCase() + work.slice(1), el = $('#homeSay'); if (el.textContent !== say) el.textContent = say; el.hidden = !say;
  hsideShow();
}
$('#keptAll').onclick = () => { oldAll = !oldAll; homeRender(); };
// Handing back opens the papers at their Return tab.
$('#handBack').addEventListener('click', e => { const a = e.target.closest('a[data-kret]'); if (a) a.classList.add('busy'); });
// Read again whenever Today shows or she comes back to this tab: she may have planned a lesson in the Planner's tab meanwhile.
let planBusy = null;
function planRefresh() {
  if (planBusy) return planBusy;
  return planBusy = planRead().catch(() => { plan = null; }).then(() => { planBusy = null; homeRender(); if (shellReady) setRender(); });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !batch) planRefresh(); });
window.addEventListener('pageshow', e => { if (e.persisted) planRefresh(); });
