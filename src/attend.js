/* ---------------- attendance: who was here, late, excused or absent, saved by day for each class (11/11) ---------------- */
// A class page's Attendance tab. Everyone starts as present, so taking a day is one press for each student who isn't, or one press
// on "Everyone is here". Looking back is one table, students down and days across, with each student's totals.
// What is saved: on the class, beside its roster, c.att = { 'YYYY-MM-DD': { t, m: { roster name: 'l' | 'e' | 'a' }, n: { roster name: note } } }.
// Only who wasn't simply present is written down; a day with a record and nobody in it is a day everyone was here. A day that was
// cleared stays as { t, off: 1 }, so clearing it on one computer isn't undone by an older copy on another (merge.js).
// It lives in lib, so it stays in this browser, goes in the teacher's own folder and take-home file, and never anywhere else.
// Whether a teacher takes attendance here at all is theirs to say: Settings, Classes and rosters (attOn, library.js).
const ATT_WAYS = [['p', 'Present'], ['l', 'Late'], ['e', 'Excused'], ['a', 'Absent']], ATT_WORD = Object.fromEntries(ATT_WAYS);
const attToday = () => isoDay(Date.now());
const attRec = (c, d) => { const r = c && c.att && c.att[d]; return r && !r.off ? r : null; };
// How one student stood on a day: 'p', 'l', 'e' or 'a', or '' when the day wasn't taken.
const attOf = (c, d, n) => { const r = attRec(c, d); return r ? (r.m && r.m[n]) || 'p' : ''; };
const attNote = (c, d, n) => { const r = attRec(c, d); return (r && r.n && r.n[n]) || ''; };
// The days that were taken, oldest first, within from and to when they're given.
const attDays = (c, from, to) => Object.keys((c && c.att) || {}).filter(d => attRec(c, d) && (!from || d >= from) && (!to || d <= to)).sort();
function attCount(c, n, days) { const o = { p: 0, l: 0, e: 0, a: 0 }; for (const d of days) o[attOf(c, d, n)]++; return o; }
function attDayCount(c, d) { const o = { p: 0, l: 0, e: 0, a: 0 }; for (const n of c.names) o[attOf(c, d, n) || 'p']++; return o; }
// Sets one student's day. The day's record is made if it wasn't taken yet, with everyone else present. note: undefined leaves it as it was.
// (A seating chart, or anything else that shows the class, can take attendance through this.)
function attSet(c, d, n, way, note) {
  if (!c || !attDayOk(d) || !c.names.includes(n)) return false;
  const was = attRec(c, d), r = { t: Date.now(), m: { ...((was && was.m) || {}) }, n: { ...((was && was.n) || {}) } };
  if (way) { if (way === 'p' || !ATT_WORD[way]) delete r.m[n]; else r.m[n] = way; }
  if (note !== undefined) { const s = String(note || '').trim().slice(0, 120); if (s) r.n[n] = s; else delete r.n[n]; }
  if (!Object.keys(r.n).length) delete r.n;
  (c.att ||= {})[d] = r; saveLib(); return true;
}
// Everyone is here: the day is taken with nobody marked.
function attTake(c, d) { if (!c || !attDayOk(d) || attRec(c, d)) return; (c.att ||= {})[d] = { t: Date.now(), m: {} }; saveLib(); }
function attClear(c, d) { if (!c || !c.att || !c.att[d]) return; c.att[d] = { t: Date.now(), off: 1 }; saveLib(); }
// After the roster is edited: a renamed student (found by the same student ID, as their details are) keeps their days under the new name.
// A student taken off the roster keeps theirs in case they come back; they aren't shown meanwhile.
function keepAtt(c, was, oldInfo) {
  if (!c.att) return;
  for (const n of (was || []).filter(n => !c.names.includes(n))) {
    const d = idDigits(((oldInfo || {})[n] || {}).id), to = d && c.names.find(m => idDigits(infoOf(c, m).id) === d);
    if (!to) continue;
    for (const r of Object.values(c.att)) for (const k of ['m', 'n']) if (r[k] && r[k][n] != null) { if (r[k][to] == null) r[k][to] = r[k][n]; delete r[k][n]; }
  }
}
// The class's meeting days, when the Planner's timetable knows a class of the same name (today.js reads it, one way). Otherwise null.
function attMeets(c) {
  if (!plan) return null;
  const nk = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), k = nk(c.name), pc = k && plan.classes.find(x => nk(x.name) === k);
  return pc && pc.meets.length ? { dows: new Set(pc.meets.map(m => m.dow)), off: new Set(plan.daysOff.map(x => x.date)) } : null;
}
// The day before or after: the class's last or next meeting when the timetable knows it, the calendar's otherwise.
function attStep(c, d, dir) {
  const m = attMeets(c), t = new Date(d + 'T12:00:00');
  for (let i = 0; i < 90; i++) { t.setDate(t.getDate() + dir); const x = isoDay(t); if (!m || (m.dows.has(t.getDay()) && !m.off.has(x)) || attRec(c, x)) return x; }
  return isoDay(new Date(new Date(d + 'T12:00:00').getTime() + dir * 864e5));
}
const attHash = (c, sub) => classHash(c, 'attendance') + (sub ? '/' + sub : '');
const attLong = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
// "22 present · 1 late · 1 absent": only what there is.
const attSay = o => [[o.p, 'present'], [o.l, 'late'], [o.e, 'excused'], [o.a, 'absent']].filter(x => x[0]).map(x => x[0] + ' ' + x[1]).join(' · ');

/* ---------- the tab ---------- */
let attSt = { term: null }, attLib = null;
// The dates Look back covers: a term of the teacher's, or every day ('*').
function attRange() {
  const terms = bkConf().terms.filter(t => t.start && t.end);
  if (attSt.term == null || (attSt.term !== '*' && !terms.some(t => t.id === attSt.term))) attSt.term = terms.length ? bkTermNow(terms) : '*';
  const t = terms.find(t => t.id === attSt.term);
  return { terms, from: t ? t.start : '', to: t ? t.end : '', name: t ? t.name || 'Term' : 'All dates' };
}
function attPanel(el, c, sub) {
  attLib = lib;
  const all = sub === 'all', d = all ? '' : sub || attToday();
  el.innerHTML = '<div class="att" id="attBody" data-attcls="' + esc(c.id) + '" data-attday="' + esc(d) + '">' +
    '<div class="attbar"><div class="pseg" role="group" aria-label="Attendance"><a class="attv" href="' + attHash(c) + '"' + (all ? '' : ' aria-current="page"') + '>Take attendance</a><a class="attv" href="' + attHash(c, 'all') + '"' + (all ? ' aria-current="page"' : '') + '>Look back</a></div>' +
    (all ? attBackBar(c) : attDayBar(c, d)) + '</div>' + (all ? attBack(c) : attList(c, d)) + '</div>';
}
function attDayBar(c, d) {
  const today = attToday(), r = attRec(c, d);
  return '<div class="attnav"><a class="icon" href="' + attHash(c, attStep(c, d, -1)) + '" data-attgo title="Earlier" aria-label="Earlier day">‹</a><b id="attDate">' + esc(attLong(d)) + '</b>' + (d === today ? '<span class="schip on">Today</span>' : '') +
    '<a class="icon" href="' + attHash(c, attStep(c, d, 1)) + '" data-attgo title="Later" aria-label="Later day">›</a>' +
    '<input type="date" id="attPick" value="' + d + '" aria-label="Go to a date">' + (d === today ? '' : '<a class="btn sm" href="' + attHash(c) + '">Today</a>') + '</div><span class="sp"></span>' +
    (r ? '<button class="btn sm" data-attcopy title="Names and how each student stood, to paste into your school’s attendance system">Copy this day</button>' +
        kmWrap('⋯', 'class="icon kdots" aria-label="More for this day" title="More"', '<button class="mitem" data-attclear>Clear this day<small>As if it was never taken</small></button>', 'right')
      : '<button class="btn sm primary" data-attall>Everyone is here</button>');
}
function attList(c, d) {
  const r = attRec(c, d);
  return '<p class="attsum' + (r ? '' : ' no') + '" id="attSum">' + (r ? attSay(attDayCount(c, d)) : 'Not taken yet') + '</p><div class="attlist' + (r ? '' : ' untaken') + '" id="attList">' + c.names.map((n, i) => {
    const s = attOf(c, d, n) || 'p', note = attNote(c, d, n), shown = bkWho(n, i);
    return '<div class="attrow s' + s + '" data-attrow="' + i + '"><span class="attn"><span class="attname">' + esc(shown) + '</span>' + (anonOn() ? '' : whoBtn('data-wc="' + esc(c.id) + '" data-wn="' + esc(n) + '"', n)) + '</span>' +
      '<div class="pseg attseg" role="group" aria-label="' + esc(shown) + '">' + ATT_WAYS.map(([k, l]) => '<button data-atts="' + k + '" aria-pressed="' + (s === k) + '">' + l + '</button>').join('') + '</div>' +
      (s !== 'p' || note ? '<input type="text" class="attnote" data-attnote maxlength="120" value="' + esc(note) + '" placeholder="Note, if you want one" aria-label="Note for ' + esc(shown) + '">' : '') + '</div>';
  }).join('') + '</div><p class="muted attcap">' + (r ? 'Each press is saved as you make it.' : 'Everyone starts as present. Press Late, Excused or Absent for anyone who isn’t, or “Everyone is here” if they all are.') +
    ' With a name in focus, P, L, E and A set it and move to the next student.</p>';
}
function attBackBar(c) {
  const g = attRange();
  return (g.terms.length ? '<div class="ovtabs bkterms" role="group" aria-label="Dates">' + g.terms.map(t => '<button data-attterm="' + esc(t.id) + '" aria-selected="' + (attSt.term === t.id) + '">' + esc(t.name || 'Term') + '</button>').join('') + '<button data-attterm="*" aria-selected="' + (attSt.term === '*') + '">All dates</button></div>' : '') +
    '<span class="sp"></span><button class="btn sm" data-attcopyall title="The table below, to paste into a spreadsheet">Copy table</button><button class="btn sm" data-attcsv>Download as a spreadsheet</button>';
}
const attShort = d => { const t = new Date(d + 'T12:00:00'); return [t.toLocaleDateString(undefined, { weekday: 'short' }), t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })]; };
function attBack(c) {
  const g = attRange(), days = attDays(c, g.from, g.to);
  if (!days.length) return '<p class="muted bkpad" id="attNone">No attendance saved ' + (attSt.term === '*' ? 'for this class yet' : 'in ' + esc(g.name)) + '. <a class="link" href="' + attHash(c) + '">Take today’s</a></p>';
  const cell = (n, d, shown) => { const s = attOf(c, d, n), note = attNote(c, d, n); return '<td><span class="attc s' + s + '" title="' + esc(shown + ' · ' + ATT_WORD[s] + (note ? ' · ' + note : '')) + '">' + (s === 'p' ? '' : s.toUpperCase()) + (note ? '<i></i>' : '') + '</span></td>'; };
  const num = v => '<td class="attt' + (v ? '' : ' z') + '">' + v + '</td>';
  return '<div class="attwrap"><table class="atttab" id="attTab"><thead><tr><th class="attn2">Student</th><th class="attt">Absent</th><th class="attt">Late</th><th class="attt">Excused</th>' +
    days.map(d => { const [w, s] = attShort(d); return '<th class="attd"><a href="' + attHash(c, d) + '" title="Open ' + esc(attLong(d)) + '"><small>' + esc(w) + '</small>' + esc(s) + '</a></th>'; }).join('') + '</tr></thead><tbody>' +
    c.names.map((n, i) => { const shown = bkWho(n, i), o = attCount(c, n, days);
      return '<tr><th class="attn2" scope="row"><a class="bklink" href="' + classHash(c, 'students', i) + '">' + esc(shown) + '</a></th>' + num(o.a) + num(o.l) + num(o.e) + days.map(d => cell(n, d, shown)).join('') + '</tr>'; }).join('') +
    '<tr class="attfoot"><th class="attn2" scope="row">Here</th><td></td><td></td><td></td>' + days.map(d => { const o = attDayCount(c, d); return '<td>' + (o.p + o.l) + '</td>'; }).join('') + '</tr></tbody></table></div>' +
    '<div class="attleg"><span><b class="attc sp"></b>Present</span><span><b class="attc sl">L</b>Late</span><span><b class="attc se">E</b>Excused</span><span><b class="attc sa">A</b>Absent</span><span><b class="attc sp"><i></i></b>Has a note</span></div>' +
    '<p class="muted attcap">' + people(days.length, 'day') + ' taken' + (attSt.term === '*' ? '' : ' in ' + esc(g.name)) + '. Click a date to open or change that day, or a name for that student’s page. “Here” counts everyone present or late.</p>';
}
function attRedraw(focus) {
  const el = $('#classPanel'), r = routeNow(); if (!el || r.v !== 'class' || r.tab !== 'attendance') return;
  attPanel(el, r.c, r.att);
  if (focus) { const b = $(focus); if (b) b.focus(); }
  if (shellReady) homeRender();
}
const attCtx = () => { const b = $('#attBody'), c = b && classById(b.dataset.attcls); return c ? { c, d: b.dataset.attday } : null; };

/* ---------- copying it out ---------- */
// One day, a line for each student: name, how they stood, the note. With student IDs first when the roster has them, since that is what a school's system matches on.
function attDayRows(c, d) {
  const ids = c.names.some(n => infoOf(c, n).id);
  return [[...(ids ? ['ID'] : []), 'Student', attLong(d), 'Note'], ...c.names.map(n => [...(ids ? [infoOf(c, n).id || ''] : []), n, ATT_WORD[attOf(c, d, n) || 'p'], attNote(c, d, n)])];
}
function attTableRows(c, days) {
  const ids = c.names.some(n => infoOf(c, n).id);
  return [[...(ids ? ['ID'] : []), 'Student', 'Absent', 'Late', 'Excused', ...days], ...c.names.map(n => { const o = attCount(c, n, days); return [...(ids ? [infoOf(c, n).id || ''] : []), n, o.a, o.l, o.e, ...days.map(d => ATT_WORD[attOf(c, d, n)])]; })];
}
const attCsv = rows => rows.map(r => r.map(v => { const s = csvSafe(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
const attCopy = (rows, say) => navigator.clipboard.writeText(rows.map(r => tsvLine(r.map(String))).join('\n')).then(() => toast(say), () => toast('Copying didn’t work in this browser.'));

/* ---------- presses and keys ---------- */
function attPress(row, way) {
  const x = attCtx(); if (!x) return;
  const i = +row.dataset.attrow;
  attSet(x.c, x.d, x.c.names[i], way);
  attRedraw('[data-attrow="' + i + '"] [data-atts="' + way + '"]');
}
document.addEventListener('click', e => {
  const t = e.target.closest ? e.target : null; if (!t || !t.closest('#attBody')) return;
  const x = attCtx(); if (!x) return;
  const s = t.closest('[data-atts]');
  if (s) return attPress(s.closest('[data-attrow]'), s.dataset.atts);
  if (t.closest('[data-attall]')) { attTake(x.c, x.d); attRedraw('[data-attcopy]'); return toast('Saved: everyone is here.'); }
  if (t.closest('[data-attclear]')) { attClear(x.c, x.d); return attRedraw('[data-attall]'); }
  if (t.closest('[data-attcopy]')) return attCopy(attDayRows(x.c, x.d), 'Copied ' + attLong(x.d) + '. Paste it into a spreadsheet or your school’s system.');
  const term = t.closest('[data-attterm]');
  if (term) { attSt.term = term.dataset.attterm; return attRedraw('[data-attterm="' + term.dataset.attterm + '"]'); }
  if (t.closest('[data-attcopyall]') || t.closest('[data-attcsv]')) {
    const g = attRange(), days = attDays(x.c, g.from, g.to); if (!days.length) return toast('There is no attendance to copy yet.');
    const rows = attTableRows(x.c, days);
    if (t.closest('[data-attcopyall]')) return attCopy(rows, 'Copied ' + people(days.length, 'day') + '. Paste it into a spreadsheet.');
    return saveBlob(x.c.name + ' attendance ' + days[0] + (days.length > 1 ? ' to ' + days[days.length - 1] : '') + '.csv', new Blob(['﻿' + attCsv(rows)], { type: 'text/csv' }));
  }
});
document.addEventListener('change', e => {
  const t = e.target, x = t.closest && t.closest('#attBody') ? attCtx() : null; if (!x) return;
  if (t.id === 'attPick') { if (attDayOk(t.value)) go(attHash(x.c, t.value === attToday() ? '' : t.value)); return; }
  if (t.dataset.attnote != null) { const row = t.closest('[data-attrow]'), n = x.c.names[+row.dataset.attrow]; if (attNote(x.c, x.d, n) !== t.value.trim()) { attSet(x.c, x.d, n, null, t.value); const sum = $('#attSum'); if (sum && !attRec(x.c, x.d)) attRedraw(); } }
});
// P, L, E and A set the student whose row has the focus and move to the next; the up and down arrows move between students.
document.addEventListener('keydown', e => {
  const row = e.target.closest && e.target.closest('#attList [data-attrow]'); if (!row || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
  const i = +row.dataset.attrow, k = e.key.toLowerCase(), to = j => { const b = $('[data-attrow="' + j + '"] [aria-pressed="true"]'); if (b) b.focus(); };
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return to(i + (e.key === 'ArrowDown' ? 1 : -1)); }
  if (ATT_WORD[k]) { e.preventDefault(); attPress(row, k); if ($('[data-attrow="' + (i + 1) + '"]')) to(i + 1); }
});

/* ---------- one student's page: their attendance beside their grades ---------- */
function attStuHtml(c, n) {
  if (!attOn()) return '';
  const t = bk.term && bk.term !== '*' ? bkConf().terms.find(t => t.id === bk.term) : null, days = attDays(c, t && t.start, t && t.end);
  if (!days.length) return '';
  const o = attCount(c, n, days), day = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const line = (k, l) => { const ds = days.filter(d => attOf(c, d, n) === k); return ds.length ? '<p class="attstu"><b>' + l + '</b> ' + ds.map(d => '<a class="link" href="' + attHash(c, d) + '">' + esc(day(d)) + '</a>' + (attNote(c, d, n) ? ' (' + esc(attNote(c, d, n)) + ')' : '')).join(', ') + '</p>' : ''; };
  return '<section id="attStu"><h3 class="ovh3">Attendance</h3><p class="bkfbline">Here ' + (o.p + o.l) + ' of ' + people(days.length, 'day') + (o.a || o.l || o.e ? ': ' + attSay({ ...o, p: 0 }) + '.' : ', never late.') + '</p>' + line('a', 'Absent') + line('l', 'Late') + line('e', 'Excused') + '</section>';
}

/* ---------- Today: a line under each of the day's classes ---------- */
function attTodayLine(planClass) {
  if (!attOn()) return '';
  const nk = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), k = nk(planClass.name), c = k && lib.classes.find(x => nk(x.name) === k && x.names.length);
  if (!c) return '';
  const d = attToday(), r = attRec(c, d), o = r && attDayCount(c, d);
  return '<a class="tatt' + (r ? ' done' : '') + '" href="' + attHash(c) + '" data-tatt>' + (r ? 'Attendance taken · ' + (o.l || o.e || o.a ? attSay({ ...o, p: 0 }) : 'everyone here') : 'Take attendance') + '</a>';
}

/* ---------- Settings, Classes and rosters: whether attendance is taken here ---------- */
function attSetRender(sec) {
  if (sec !== 'classes') return;
  const el = $('#setAtt'), n = lib.classes.reduce((a, c) => a + attDays(c).length, 0);
  const h = '<div class="lhead"><h2>Attendance</h2><span class="muted">Each class has an Attendance tab, and Today has a line for it under each class.</span></div>' +
    '<p class="setp"><label class="attopt"><input type="checkbox" id="attOnBox"' + (attOn() ? ' checked' : '') + '> Take attendance in Grading Studio</label></p>' +
    (!attOn() && n ? '<p class="muted setp">The ' + people(n, 'day') + ' you saved ' + (n === 1 ? 'is' : 'are') + ' kept, and show again when this is turned back on.</p>' : '');
  if (el && el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
$('#setPane').addEventListener('change', e => { if (e.target.id !== 'attOnBox') return; meSet({ att: e.target.checked }); setRender(); renderLib(); homeRender(); });
Object.assign(window.__gs, { attSet, attOf, attTake, attClear, attDays, attCount, attStep, attTodayLine });
