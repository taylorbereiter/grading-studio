/* ---------------- My setup: bring a teacher's setup in as one block of text, or copy it out ----------------
   A setup is how one teacher works, and nothing about a student: their classes and when each meets, the semester and its days off,
   terms and what a grade is made of, how a new assignment is graded, saved rubrics, saved comments and learning goals. It is one
   block of JSON that starts { "gradingStudioSetup": 1 … }. The format is written out for a person, or for an AI assistant, in
   STP_PROMPT below: a teacher copies that prompt into whichever assistant they use, answers its questions, and pastes what it gives
   back here. Nothing is sent anywhere by the app; the teacher carries the text both ways.

   What comes in is somebody else's text, so it is treated as untrusted:
   - it is only ever parsed as JSON and read key by key (stpRead); nothing in it is run, and everything shown is escaped;
   - every value is cut to a length and a count, and a link must be http or https;
   - anything about students (a class list, names, scores, comments on a student) is never read. It is counted, said in the
     preview under "Left out", and dropped. Rosters come in only on a class's own page.
   Nothing changes until the teacher has seen the preview (stpDiff) and pressed the button. What it changed is remembered in this
   browser (gs.setupUndo, which does not travel) so it can be undone: only the things the import itself added or changed are put
   back, so work done since is never touched.
   The timetable and calendar are the Planner's (kv 'setup' in its database), written here the way the rubric bank is. */
const STP_V = 1, STP_MAX = 400000;
const stpStr = (v, max) => typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 80) : '';
const stpText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, max || 600) : '';
const stpObj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : null;
const stpArr = (v, max) => Array.isArray(v) ? v.slice(0, max || 60) : [];
const stpKey = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const stpDate = v => { const s = stpStr(v, 10); return attDayOk(s) ? s : ''; };
const stpNum = (v, lo, hi) => { const n = typeof v === 'string' && v.trim() !== '' ? +v : v; return typeof n === 'number' && isFinite(n) && n >= lo && n <= hi ? n : null; };
// Keys that say "this is about students", wherever they sit. Their values are never read.
const STP_STUDENT = /^(students?|student_?(names|list|data|info)|rosters?|class_?lists?|pupils?|learners?|names|scores?|marks|results|gradebook_?(scores|entries)|seating|seats|attendance_?(records?|days|log)|absences|report_?comments|emails?)$/i;
const stpCount = v => Array.isArray(v) ? v.length : stpObj(v) ? Object.keys(v).length : v == null || v === '' ? 0 : 1;

/* ---- text to JSON: the block may arrive inside an assistant's reply, in a code fence, with curly quotes ---- */
function stpParse(text) {
  text = String(text || '');
  if (!text.trim()) return { err: 'Nothing to read yet. Paste the setup text first.' };
  if (text.length > STP_MAX) return { err: 'That is too long to be a setup. A setup is a few pages of text at most.' };
  const tries = [];
  for (const m of text.matchAll(/```[a-zA-Z0-9]*\s*\n?([\s\S]*?)```/g)) tries.push(m[1]);
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) tries.push(text.slice(a, b + 1));
  const loose = s => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,(\s*[}\]])/g, '$1');
  let seen = false;
  for (const t of tries) for (const s of [t, loose(t)]) {
    let j; try { j = JSON.parse(s.slice(s.indexOf('{'))); } catch { continue; }
    if (!stpObj(j)) continue;
    seen = true;
    if (j.gradingStudioSetup != null) return { j };
  }
  return { err: seen ? 'That text isn’t a Grading Studio setup: it has no "gradingStudioSetup" line. Ask your assistant for the setup block again, using the prompt above.' : 'No setup found in that text. A setup starts with { and ends with }. If your assistant cut it short, ask it for the whole block again.' };
}

/* ---- JSON to a tidy setup: only what is known is read, and everything is cut to size ---- */
const STP_DAYS = { mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 0, sunday: 0 };
const stpDow = v => { if (typeof v === 'number') return v >= 0 && v <= 7 && Number.isInteger(v) ? v % 7 : null; const k = stpKey(v); return k in STP_DAYS ? STP_DAYS[k] : /^[0-7]$/.test(k) ? +k % 7 : null; };
function stpTime(v) {
  const m = /^(\d{1,2})[:.h](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?$/i.exec(stpStr(v, 12)); if (!m) return '';
  let h = +m[1]; const mi = +m[2], ap = (m[3] || '').toLowerCase()[0];
  if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0;
  return h < 24 && mi < 60 ? String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') : '';
}
const stpScale = v => { const o = stpObj(v); if (!o) return null; const out = {}; for (const k of Object.keys(o).slice(0, 120)) { const s = stpNum(k, 0, 1000), p = stpNum(o[k], 0, 100); if (s != null && p != null) out[s] = Math.round(p * 10) / 10; } return Object.keys(out).length >= 2 ? out : null; };
// A row's highest score and whether half points are offered, as the keys worth keeping: top only when it isn't 4, half only when off.
const stpRowScale = (top, half) => { const o = { ...(top != null ? { top: Math.round(top) } : {}), ...(half === false ? { half: false } : {}) }; return typeof rowScaleOf === 'function' ? rowScaleOf(o) : { ...(o.top && o.top !== 4 ? { top: o.top } : {}), ...(o.half === false ? { half: false } : {}) }; };
// IB is a class's own: MYP (criteria, boundaries on the total of the levels) or DP (boundaries in percent). Kept as the IB part of the app keeps it.
const STP_GROUPS = ['langlit', 'langacq', 'indsoc', 'sci', 'math', 'arts', 'phe', 'design', 'idu', 'pp', 'own'];
function stpIb(o) {
  const way = { myp: 'myp', dp: 'dp' }[stpKey(o.programme != null ? o.programme : o.program)]; if (!way) return null;
  const out = { way }, group = stpKey(o.subjectGroup); if (way === 'myp' && STP_GROUPS.includes(group)) out.group = group;
  if (way === 'myp') {
    const crit = [];
    for (const c of stpArr(o.criteria, 6)) {
      const co = stpObj(c), m = co ? null : /^([A-Za-z])\s*[:.)-]\s*(.+)$/.exec(stpStr(c, 90));
      const k = stpStr(co ? co.letter != null ? co.letter : co.k : m ? m[1] : '', 1).toUpperCase(), name = stpStr(co ? co.name : m ? m[2] : '', 80);
      if (/^[A-Z]$/.test(k) && name && !crit.some(x => x.k === k)) crit.push({ k, name });
    }
    if (crit.length) out.crit = crit;
  }
  const b = stpObj(o.boundaries), of = b ? stpNum(b.outOf, 1, 1000) : null;
  let bounds = stpArr(b ? b.grades : null, 10).map(x => Array.isArray(x) ? [stpNum(x[1], 0, 1000), stpNum(x[0], 1, 7)] : stpObj(x) ? [stpNum(x.from, 0, 1000), stpNum(x.grade, 1, 7)] : [null, null]).filter(x => x[0] != null && x[1] != null && Number.isInteger(x[1]));
  if (way === 'dp' && of && of !== 100) bounds = bounds.map(x => [Math.round(x[0] / of * 100), x[1]]);
  bounds = [...new Map(bounds.map(x => [x[1], x])).values()].sort((x, y) => y[1] - x[1]);
  if (bounds.length >= 2 && bounds.every((x, i) => !i || x[0] < bounds[i - 1][0])) out.bounds = bounds;
  // a DP class's own component weights, by the names of the gradebook's types
  const wn = way === 'dp' ? stpArr(o.weights, 8).map(stpObj).filter(Boolean).map(t => ({ name: stpStr(t.name, 40), weight: stpNum(t.weight, 0, 100) })).filter(t => t.name && t.weight != null) : [];
  if (wn.length) out.wn = wn;
  return out;
}
const STP_WAYS = { rubric: 'rubric', rubricrows: 'rubric', rows: 'rubric', points: 'points', percent: 'percent', percentage: 'percent', letters: 'letters', lettergrades: 'letters', letter: 'letters', ib7: 'ib7', ib: 'ib7', ib1to7: 'ib7', myp: 'myp', mypcriteria: 'myp', ibmyp: 'myp', dp: 'ib7' };
function stpRead(j) {
  const S = { left: [], unknown: [], notes: [] }, known = new Set(['gradingStudioSetup', 'teacher', 'about', 'school', 'programme', 'program', 'grading', 'classes', 'calendar', 'terms', 'gradebook', 'rubrics', 'comments', 'goals', 'attendance', 'slides', 'marking']);
  for (const k of Object.keys(j)) {
    if (STP_STUDENT.test(k)) { if (stpCount(j[k])) S.left.push('Something about students (“' + stpStr(k, 30) + '”).'); }
    else if (!known.has(k)) S.unknown.push(stpStr(k, 30));
  }
  if (stpNum(j.gradingStudioSetup, 0, 1e6) > STP_V) S.notes.push('This setup was written for a newer version of Grading Studio. What this version understands is listed below.');
  S.about = stpStr(stpObj(j.teacher) ? j.teacher.label : j.about || j.teacher, 80);
  const prog = stpStr(j.programme != null ? j.programme : j.program, 24); if (prog) S.prog = prog;
  // the school's own words
  const sc = stpObj(j.school);
  if (sc) { const o = {}; for (const [k, to] of [['system', 'sys'], ['unitPlans', 'unit'], ['assistant', 'ai']]) if (typeof sc[k] === 'string') o[to] = stpStr(sc[k], 40); if (Object.keys(o).length) S.school = o; }
  // how a new assignment is graded
  const g = stpObj(j.grading);
  if (g) {
    let way = STP_WAYS[stpKey(g.way)] || (stpArr(g.criteria).length ? 'rubric' : '');
    // an MYP teacher's criteria rows: "ib7" with rows is how an older prompt asked for it
    if (way === 'ib7' && /^\s*(ib\s*)?myp\b/i.test(prog) && /^(rows?|rubric|criteria)$/i.test(stpStr(g.score, 12))) way = 'myp';
    if (way) {
      const base = gradeWay(way)[3], crit = stpArr(g.criteria, 12).map(c => stpStr(stpObj(c) ? c.name : c, 80)).filter(Boolean);
      const rows = /^(rows?|rubric|criteria)$/i.test(stpStr(g.score, 12)) ? true : /^(total|points?|percent)$/i.test(stpStr(g.score, 12)) ? false : way === 'rubric' || way === 'myp';
      const outOf = stpNum(g.outOf, 1, 1000), top = stpNum(g.rowTop, 1, 10), scale = stpScale(g.scale);
      let bands = stpArr(g.bands, 20).map(b => Array.isArray(b) ? [stpNum(b[0], 0, 1000), stpStr(b[1], 12)] : stpObj(b) ? [stpNum(b.from, 0, 1000), stpStr(b.grade != null ? b.grade : b.label, 12)] : [null, '']).filter(b => b[0] != null && b[1]);
      const of = stpNum(g.bandsOutOf, 1, 1000);
      if (of && of !== 100) bands = bands.map(b => [Math.round(b[0] / of * 1000) / 10, b[1]]);
      bands = bands.filter(b => b[0] <= 100).sort((x, y) => y[0] - x[0]);
      if (bands.length) bands[bands.length - 1][0] = 0;   // the lowest grade starts at nothing, as in Settings
      if (!bands.length && gradeWay(way)[4]) bands = gradeWay(way)[4].map(b => b.slice());
      // MYP boundaries are in points and belong to each class (ib.js), so none are kept here
      if (way === 'myp') bands = [];
      S.grading = { way, setup: { mode: rows ? 'rubric' : 'points', criteria: crit.length ? crit : base.criteria.slice(), outOf: outOf != null ? outOf : base.outOf, scale: scale || null, ...stpRowScale(top, g.halfPoints) }, ...(bands.length ? { bands } : {}) };
    } else if (Object.keys(g).length) S.notes.push('“grading” has no “way” this version knows (rubric, points, percent, letters, myp or ib7), so it is left as it is.');
  }
  // classes: a name, a link, when it meets, unit names. Never who is in it.
  const seen = new Set(); S.classes = [];
  for (const c of stpArr(j.classes, 40)) {
    const o = stpObj(c) || (typeof c === 'string' ? { name: c } : null); if (!o) continue;
    const name = stpStr(o.name, 60), k = stpKey(name); if (!k || seen.has(k)) continue; seen.add(k);
    for (const key of Object.keys(o)) if (STP_STUDENT.test(key) && stpCount(o[key])) { const n = stpCount(o[key]); S.left.push((Array.isArray(o[key]) && n > 1 ? 'A list of ' + n + ' under “' + stpStr(key, 30) + '”' : '“' + stpStr(key, 30) + '”') + ' for ' + name + '.'); }
    const meets = [];
    for (const m of stpArr(o.meets, 30)) {
      const mo = stpObj(m); if (!mo) continue;
      const dow = stpDow(mo.day != null ? mo.day : mo.dow), start = stpTime(mo.start), end = stpTime(mo.end);
      if (dow == null || !start || !end || end <= start) continue;
      if (!meets.some(x => x.dow === dow && x.start === start)) meets.push({ dow, start, end, label: stpStr(mo.label, 24) });
    }
    meets.sort((x, y) => x.dow - y.dow || x.start.localeCompare(y.start));
    const link = mbUrl(stpStr(o.link, 500)), color = /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : '';
    const ib = stpIb(o);
    S.classes.push({ name, course: stpStr(o.course, 60), ...(ib ? { ib } : {}), ...(link ? { link } : {}), ...(color ? { color } : {}), ...(Array.isArray(o.meets) ? { meets } : {}), units: [...new Map(stpArr(o.units, 40).map(u => stpStr(stpObj(u) ? u.name : u, 80)).filter(Boolean).map(u => [stpKey(u), u])).values()] });
  }
  // the semester, days off and dates worth seeing on the calendar
  const cal = stpObj(j.calendar);
  if (cal) {
    const start = stpDate(cal.start), end = stpDate(cal.end);
    const days = (a, label) => [...new Map(stpArr(a, 200).map(d => stpObj(d) || { date: d }).map(d => ({ date: stpDate(d.date), to: stpDate(d.to), label: stpStr(d.label, 60) || label })).filter(d => d.date).map(d => [d.date, d])).values()].sort((x, y) => x.date.localeCompare(y.date));
    // a break given as a first and last day is each of its days, as the timetable keeps them
    const off = []; for (const d of days(cal.daysOff, 'No school')) { let t = new Date(d.date + 'T12:00:00'); const last = d.to && d.to > d.date ? new Date(d.to + 'T12:00:00') : t; for (let n = 0; t <= last && n < 120; n++, t = new Date(t.getTime() + 864e5)) { const ds = isoDay(t); if (!off.some(x => x.date === ds)) off.push({ date: ds, label: d.label }); } }
    const c2 = { ...(start && end && end > start ? { start, end } : {}), daysOff: off.slice(0, 400), events: days(cal.events, '').filter(e => e.label).map(e => ({ date: e.date, to: e.to && e.to > e.date ? e.to : '', label: e.label })) };
    if (c2.start || c2.daysOff.length || c2.events.length) S.calendar = c2;
  }
  // terms, and what a term grade is made of
  S.terms = [...new Map(stpArr(j.terms, 12).map(stpObj).filter(Boolean).map(t => ({ name: stpStr(t.name, 40), start: stpDate(t.start), end: stpDate(t.end) })).filter(t => t.name && t.start && t.end && t.end > t.start).map(t => [stpKey(t.name), t])).values()];
  const gb = stpObj(j.gradebook);
  if (gb) {
    const o = {}, w = stpObj(gb.weights);
    if (w) { const ws = {}; for (const [k, id] of [['summative', 'sum'], ['inClass', 'ic'], ['formative', 'fm']]) { const n = stpNum(w[k], 0, 100); if (n != null && id !== 'fm') ws[id] = Math.round(n); } if (Object.keys(ws).length) o.w = ws; }
    if (/^(zero|0)$/i.test(stpStr(gb.emptyType, 10))) o.empty = 'zero'; else if (/^other/i.test(stpStr(gb.emptyType, 10))) o.empty = 'other';
    const xc = stpObj(gb.extraCredit);
    if (xc) { if (/^in-?class$/i.test(stpStr(xc.addsTo, 12))) o.xcTo = 'ic'; else if (/^term/i.test(stpStr(xc.addsTo, 12))) o.xcTo = 'term'; if (typeof xc.cap === 'boolean') o.xcCap = xc.cap; }
    const rt = { highest: 'high', high: 'high', latest: 'last', last: 'last', average: 'avg', avg: 'avg' }[stpKey(gb.retakes)]; if (rt) o.retake = rt;
    const types = stpArr(gb.types, 8).map(stpObj).filter(Boolean).map(t => ({ name: stpStr(t.name, 40), weight: stpNum(t.weight, 0, 100) })).filter(t => t.name);
    if (types.length) o.types = types;
    if (Object.keys(o).length) S.book = o;
  }
  // saved rubrics: names of rows and, when given, what each level looks like
  S.rubrics = [];
  for (const r of stpArr(j.rubrics, 40)) {
    const o = stpObj(r); if (!o) continue;
    const name = stpStr(o.name, 80), rows = stpArr(o.criteria, 12).map(c => stpObj(c) || { name: c }).map(c => ({ name: stpStr(c.name, 80), levels: stpObj(c.levels) })).filter(c => c.name);
    if (!name || !rows.length || S.rubrics.some(x => stpKey(x.name) === stpKey(name))) continue;
    const rs = stpRowScale(stpNum(o.rowTop, 1, 10), o.halfPoints), levels = rows.map(c => { const out = {}; if (c.levels) for (let v = rs.top || 4; v >= 0; v--) { const t = stpText(c.levels[v], 400); if (t) out[v] = t; } return out; });
    const scale = stpScale(o.scale);
    S.rubrics.push({ name, criteria: rows.map(c => c.name), ...(levels.some(l => Object.keys(l).length) ? { levels } : {}), ...(scale ? { scale } : {}), ...rs });
  }
  S.comments = [...new Set(stpArr(j.comments, 200).map(c => stpText(c, 600)).filter(Boolean))];
  S.goals = [...new Map(stpArr(j.goals, 100).map(x => stpStr(stpObj(x) ? x.name : x, 80)).filter(Boolean).map(x => [stpKey(x), x])).values()];
  // the Planner's rules for a deck: an agenda on slide 2, and text kept between 28 and 36 pt, each on unless turned off
  const sl = stpObj(j.slides);
  if (sl) { const d = {}; if (typeof sl.agenda === 'boolean') d.agenda = sl.agenda; if (/^any$/i.test(stpStr(sl.textSizes, 8))) d.sizes = 'any'; else if (/^(usual|28|28-36)/i.test(stpStr(sl.textSizes, 8))) d.sizes = ''; if (Object.keys(d).length) S.deck = d; }
  // choices about marking and handing back, each kept in this browser's own settings
  const mk = stpObj(j.marking);
  if (mk) {
    const m = {}; for (const [k, to] of [['studentFileNames', 'xnames'], ['coverNamesOnAnchors', 'anchorCover'], ['findTypedNames', 'nameFind'], ['gradeSheetFromPapers', 'sheetfound']]) if (typeof mk[k] === 'boolean') m[to] = mk[k];
    const pc = stpKey(mk.pointsColor); if (pc === 'pen') m.ptsInk = ''; else if (pc === 'credit' || COLORS[pc]) m.ptsInk = pc;
    if (Object.keys(m).length) S.mark = m;
  }
  if (typeof j.attendance === 'boolean') S.att = j.attendance; else if (j.attendance != null && stpCount(j.attendance)) S.left.push('Attendance records.');
  return S;
}

/* ---- the Planner's timetable, read and written as the rubric bank is ---- */
async function stpPlanGet() {
  const db = await planDb(false); let s = null;
  if (db) { try { s = await idbP(db.transaction('kv').objectStore('kv').get('setup')); } catch {} db.close(); }
  return stpObj(s);
}
async function stpPlanPut(s) {
  const db = await planDb(true); if (!db) throw new Error('no planner');
  try { await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); if (s) t.objectStore('kv').put(s, 'setup'); else t.objectStore('kv').delete('setup'); t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error); }); } finally { db.close(); }
}
const stpMonday = s => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoDay(d); };
const STP_COLORS = ['#1F6FB2', '#7B3FC4', '#0E7C86', '#A8327E', '#3D4CB8', '#9A5B13', '#0B6E99', '#5B6472'];
// The Planner's setup with this one's classes, meeting times and calendar laid over it. Its template, links and anything else stay.
function stpPlanNext(old, S, pick) {
  const cur = old || { classes: [], daysOff: [], events: [], template: '' }, next = JSON.parse(JSON.stringify(cur));
  next.classes = Array.isArray(next.classes) ? next.classes : []; next.daysOff = Array.isArray(next.daysOff) ? next.daysOff : []; next.events = Array.isArray(next.events) ? next.events : [];
  if (pick.classes) for (const c of S.classes) {
    if (!c.meets) continue;   // a class with no times given stays out of the timetable, as when it is typed in
    let p = next.classes.find(x => x && stpKey(x.name) === stpKey(c.name));
    if (!p) { let id = stpKey(c.name).slice(0, 24) || 'class'; while (next.classes.some(x => String(x.id) === id)) id += '2'; next.classes.push(p = { id, name: c.name, course: c.course || '', color: c.color || STP_COLORS[next.classes.length % STP_COLORS.length], meets: [] }); }
    if (c.course) p.course = c.course; if (c.color) p.color = c.color; if (c.link) p.mb = c.link;
    p.meets = c.meets.map(m => ({ ...m }));
  }
  if (pick.calendar && S.calendar) {
    const k = S.calendar;
    if (k.start) { next.semStart = stpMonday(k.start); next.semEnd = stpMonday(k.end); }
    for (const d of k.daysOff) { const had = next.daysOff.find(x => x && x.date === d.date); if (had) had.label = d.label; else next.daysOff.push({ ...d }); }
    for (const e of k.events) if (!next.events.some(x => x && x.date === e.date && x.label === e.label)) next.events.push({ ...e });
    next.daysOff.sort((a, b) => String(a.date).localeCompare(String(b.date))); next.events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  if (pick.deck && S.deck) {   // kept only where it differs from the usual, as the Planner keeps it
    const d = { ...(stpObj(next.deck) || {}) };
    if (S.deck.agenda === false) d.agenda = false; else if (S.deck.agenda === true) delete d.agenda;
    if (S.deck.sizes === 'any') d.sizes = 'any'; else if (S.deck.sizes === '') delete d.sizes;
    if (Object.keys(d).length) next.deck = d; else delete next.deck;
  }
  return JSON.stringify(next) === JSON.stringify(cur) ? null : next;
}

/* ---- what would change: one part per subject, each with the lines the preview shows ---- */
const stpDay = s => new Date(s + 'T12:00:00').toLocaleDateString(LANG_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
const stpList = (a, n) => a.slice(0, n || 6).join(', ') + (a.length > (n || 6) ? ' and ' + (a.length - (n || 6)) + ' more' : '');
const stpWayName = k => gradeWay(k)[1], stpWayLow = k => k === 'ib7' || k === 'myp' ? stpWayName(k) : stpWayName(k).toLowerCase();
const stpTypeName = id => { const t = BK_TYPES.find(x => x[0] === id); return t ? t[2] : id; };
function stpDiff(S, planNow) {
  const parts = [], add = (key, title, lines, sub) => { if (lines.length) parts.push({ key, title, lines, sub: sub || '' }); };
  // school
  if (S.school || S.prog) {
    const L = [], m = me(), s = S.school || {};
    if (s.sys != null && s.sys !== sysName()) L.push(s.sys ? 'Students hand work in on <b>' + esc(s.sys) + '</b>' + (sysName() ? ' (now ' + esc(sysName()) + ')' : '') : 'No school system named (now ' + esc(sysName()) + ')');
    if (s.unit != null && s.unit !== unitLinkName()) L.push(s.unit ? 'Unit plans are kept in <b>' + esc(s.unit) + '</b>' + (unitLinkName() ? ' (now ' + esc(unitLinkName()) + ')' : '') : 'No place named for unit plans (now ' + esc(unitLinkName()) + ')');
    if (s.ai != null && s.ai !== (m.ai || '')) L.push(s.ai ? 'Your AI assistant is <b>' + esc(s.ai) + '</b>' : 'No AI assistant named');
    if (S.prog && S.prog !== (m.prog || '')) L.push('Programme: <b>' + esc(S.prog) + '</b>');
    add('school', 'Your school', L, 'Only the words the app uses. Nothing is connected to these.');
  }
  // grading
  if (S.grading) {
    const g = S.grading, now = meGrade(), same = now && JSON.stringify({ way: now.way, setup: { ...now.setup, ...(me().grade.setup && me().grade.setup.top ? { top: me().grade.setup.top } : {}), ...(me().grade.setup && typeof me().grade.setup.half === 'boolean' ? { half: me().grade.setup.half } : {}) }, ...(now.bands ? { bands: now.bands } : {}) }) === JSON.stringify(g);
    if (!same) {
      // rows with a 1 to 7 is how an MYP teacher's setup comes in; plain ib7 is the DP's percent
      const L = ['A new assignment starts with <b>' + esc(g.way === 'ib7' && g.setup.mode === 'rubric' ? 'IB criteria rows and a 1 to 7' : stpWayLow(g.way)) + '</b>' + (now ? ' (now ' + esc(stpWayLow(now.way)) + ')' : '')];
      if (g.setup.mode === 'rubric') L.push('Rubric rows: ' + esc(stpList(g.setup.criteria, 8))); else L.push('Scored with a total out of ' + g.setup.outOf);
      if (g.setup.top) L.push('Each row is scored 0 to ' + g.setup.top + (g.setup.half === false ? ', whole points only' : ''));
      if (g.setup.scale) L.push('A grading scale from scores to percents (' + Object.keys(g.setup.scale).length + ' steps)');
      if (g.bands) L.push('Grades: ' + esc(g.bands.map(b => b[1] + ' from ' + b[0] + '%').join(' · ')));
      add('grading', 'How you grade', L, 'Assignments you already have keep their own rubric and scale, and no score changes.');
    }
  }
  // classes
  if (S.classes.length) {
    const L = [], fresh = [], linked = [], units = [], times = [], ibs = [];
    for (const c of S.classes) {
      const had = lib.classes.find(x => stpKey(x.name) === stpKey(c.name));
      if (!had) fresh.push(c.name); else if (c.link && c.link !== mbOf(had)) linked.push(c.name);
      if (c.ib && (!had || stpIbChanges(had, c.ib))) ibs.push(c.name + ' (' + c.ib.way.toUpperCase() + ')');
      const nu = c.units.filter(u => !had || !had.units.some(x => stpKey(x.name) === stpKey(u))); if (nu.length) units.push(c.name + ' (' + nu.length + ')');
      if (c.meets) { const p = planNow && Array.isArray(planNow.classes) ? planNow.classes.find(x => x && stpKey(x.name) === stpKey(c.name)) : null, was = p && Array.isArray(p.meets) ? p.meets.map(m => m.dow + m.start + m.end).join() : null; if (was !== c.meets.map(m => m.dow + m.start + m.end).join()) times.push(c.name + ' (' + c.meets.length + ' a week)'); }
    }
    if (fresh.length) L.push((fresh.length === 1 ? 'A new class: ' : fresh.length + ' new classes: ') + '<b>' + esc(stpList(fresh)) + '</b>');
    if (linked.length) L.push(esc(sysLink()) + ' link for ' + esc(stpList(linked)));
    if (ibs.length) L.push('IB programme, criteria and grade boundaries for ' + esc(stpList(ibs)) + (typeof classWay === 'function' ? '' : ' <span class="muted">Kept with the class. They are used once the IB update arrives.</span>'));
    if (units.length) L.push('New units in ' + esc(stpList(units)));
    if (times.length) L.push('Meeting times for ' + esc(stpList(times)) + ', in the Planner’s timetable');
    add('classes', 'Classes and timetable', L, 'Classes you already have stay, with their students and their work. No student is added by this.');
  }
  // calendar
  if (S.calendar) {
    const k = S.calendar, L = [], p = planNow || {}, off = Array.isArray(p.daysOff) ? p.daysOff : [], ev = Array.isArray(p.events) ? p.events : [];
    if (k.start && (stpMonday(k.start) !== p.semStart || stpMonday(k.end) !== p.semEnd)) L.push('Semester from ' + stpDay(k.start) + ' to ' + stpDay(k.end));
    const no = k.daysOff.filter(d => !off.some(x => x && x.date === d.date && x.label === d.label)); if (no.length) L.push(no.length + (no.length === 1 ? ' day off' : ' days off') + ': ' + esc(stpList([...new Set(no.map(d => d.label))], 5)));
    const ne = k.events.filter(e => !ev.some(x => x && x.date === e.date && x.label === e.label)); if (ne.length) L.push(ne.length + (ne.length === 1 ? ' date' : ' dates') + ' on the calendar: ' + esc(stpList(ne.map(e => e.label), 5)));
    add('calendar', 'Semester and days off', L, 'Added to the Planner’s calendar. Days off already there stay.');
  }
  // terms
  if (S.terms.length) {
    const cur = bkConf().terms, L = [];
    for (const t of S.terms) { const had = cur.find(x => stpKey(x.name) === stpKey(t.name)); if (!had) L.push('<b>' + esc(t.name) + '</b>: ' + stpDay(t.start) + ' to ' + stpDay(t.end)); else if (had.start !== t.start || had.end !== t.end) L.push('<b>' + esc(t.name) + '</b> moves to ' + stpDay(t.start) + ' to ' + stpDay(t.end)); }
    add('terms', 'Terms', L, 'An assignment counts toward the term its due date falls in.');
  }
  // gradebook rules
  if (S.book) {
    const b = S.book, conf = bkConf(), L = [];
    if (b.w && Object.keys(b.w).some(k => (+conf.w[k] || 0) !== b.w[k])) L.push('A term grade is ' + esc(Object.keys(b.w).map(k => stpTypeName(k).toLowerCase() + ' ' + b.w[k] + '%').join(', ')) + ' <span class="muted">(now ' + esc(Object.keys(b.w).map(k => (+conf.w[k] || 0) + '%').join(', ')) + ')</span>');
    if (b.empty && b.empty !== conf.empty) L.push(b.empty === 'zero' ? 'A type with nothing in it yet counts as 0' : 'When a type has nothing in it yet, the other types are used');
    if (b.xcTo && b.xcTo !== conf.xcTo) L.push('Extra credit adds to ' + bkXcWhere(b.xcTo));
    if (b.xcCap != null && b.xcCap !== conf.xcCap) L.push(b.xcCap ? 'Grades stay at 100% at most' : 'A grade can go over 100%');
    if (b.retake && b.retake !== retakeRule()) L.push('On a retake, ' + ({ high: 'the highest score counts', last: 'the latest score counts', avg: 'the average of the tries counts' })[b.retake]);
    if (b.types) { const names = b.types.filter(t => !BK_TYPES.some(x => stpKey(x[1]) === stpKey(t.name) || stpKey(x[2]) === stpKey(t.name))).map(t => t.name); if (names.length) L.push(stpOwnTypes() ? 'Your own types: ' + esc(stpList(names)) : '<span class="muted">Your own types (' + esc(stpList(names)) + ') can’t be added by this version; add them in Term setup once it offers them.</span>'); }
    if (L.some(l => !l.startsWith('<span class="muted">Your own'))) add('book', 'What a grade is made of', L, 'For all your classes. Scores are not changed; grades are worked out again from them.');
    else if (L.length) S.notes.push('Your own gradebook types (' + stpList(b.types.map(t => t.name)) + ') can’t be added by this version.');
  }
  // rubrics, comments, goals
  if (S.rubrics.length) {
    const cur = savedRubrics(), fresh = S.rubrics.filter(r => !cur.some(x => stpKey(x.name) === stpKey(r.name))), chg = S.rubrics.filter(r => { const x = cur.find(y => stpKey(y.name) === stpKey(r.name)); return x && JSON.stringify([x.criteria, x.levels || null, x.scale || null, x.top || 4, x.half !== false]) !== JSON.stringify([r.criteria, r.levels || null, r.scale || x.scale || null, r.top || 4, r.half !== false]); });
    const L = []; if (fresh.length) L.push((fresh.length === 1 ? 'A new rubric: ' : fresh.length + ' new rubrics: ') + '<b>' + esc(stpList(fresh.map(r => r.name + ' (' + r.criteria.length + (r.criteria.length === 1 ? ' row)' : ' rows)')), 5)) + '</b>');
    if (chg.length) L.push('New wording for ' + esc(stpList(chg.map(r => r.name), 5)) + ', which you already have');
    add('rubrics', 'Saved rubrics', L, 'Picked on any assignment, in Rubric setup.');
  }
  if (S.comments.length) { const n = S.comments.filter(c => !bank.includes(c)); add('comments', 'Saved comments', n.length ? [n.length + (n.length === 1 ? ' comment' : ' comments') + ' to pick while marking, such as “' + esc(n[0].length > 70 ? n[0].slice(0, 70) + '…' : n[0]) + '”'] : [], 'Added to the ones you have.'); }
  if (S.goals.length) { const cur = goalList(), n = S.goals.filter(x => !cur.some(y => stpKey(y.name) === stpKey(x))); add('goals', 'Learning goals', n.length ? [n.length + (n.length === 1 ? ' goal: ' : ' goals: ') + esc(stpList(n, 5))] : [], 'To tag rubric rows and quiz questions with.'); }
  if (S.deck) {
    const now = stpObj(planNow && planNow.deck) || {}, L = [];
    if (S.deck.agenda != null && S.deck.agenda !== (now.agenda !== false)) L.push(S.deck.agenda ? 'An agenda is added on slide 2' : 'No agenda is added on slide 2');
    if (S.deck.sizes != null && (S.deck.sizes === 'any') !== (now.sizes === 'any')) L.push(S.deck.sizes === 'any' ? 'Slide text can be any size from 18 to 44 pt' : 'Slide text stays between 28 and 36 pt');
    add('deck', 'Lesson slides', L, 'In the Planner, for every deck you make from now on.');
  }
  if (S.mark) {
    const m = S.mark, now = stpMarkNow(), L = [];
    if (m.xnames != null && m.xnames !== now.xnames) L.push(m.xnames ? 'Files you hand back are named for the student and the assignment' : 'Files you hand back keep the names they were turned in with');
    if (m.anchorCover != null && m.anchorCover !== now.anchorCover) L.push(m.anchorCover ? 'Names are covered on anchor papers you export' : 'Names are not covered on anchor papers you export');
    if (m.nameFind != null && m.nameFind !== now.nameFind) L.push(m.nameFind ? 'Typed names are found and covered for you' : 'You cover names yourself');
    if (m.ptsInk != null && m.ptsInk !== now.ptsInk) L.push(m.ptsInk === 'credit' ? 'Points are colored by credit: full, part or none' : m.ptsInk ? 'Points are written in ' + m.ptsInk : 'Points are written in the pen’s color');
    if (m.sheetfound != null && m.sheetfound !== now.sheetfound) L.push(m.sheetfound ? 'The grade sheet also shows grades found on the papers' : 'The grade sheet shows only the scores given in the app');
    add('mark', 'Marking and handing back', L, 'No paper, mark or score changes.');
  }
  if (S.att != null && S.att !== attOn()) add('att', 'Attendance', [S.att ? 'Take attendance in Grading Studio' : 'Don’t take attendance in Grading Studio'], S.att ? '' : 'Days already saved are kept.');
  return parts;
}
const stpMarkNow = () => ({ xnames: xNames(), anchorCover: anchorCoverOn(), nameFind: nameFindOn(), ptsInk, sheetfound: !!store.get('gs.sheetfound', false) });
function stpMarkSet(m) {
  if (m.xnames != null) store.set('gs.xnames', m.xnames);
  if (m.anchorCover != null) store.set('gs.anchorCover', m.anchorCover);
  if (m.nameFind != null) { if (m.nameFind) store.set('gs.nameFind', true); else store.del('gs.nameFind'); }
  if (m.ptsInk != null) setPtsInk(m.ptsInk);
  if (m.sheetfound != null) { sheetFound = m.sheetfound; store.set('gs.sheetfound', sheetFound); }
}
const stpIbNext = (c, ib) => ({ way: ib.way, ib: { ...(stpObj(c.ib) || {}), ...(ib.group ? { group: ib.group } : {}), ...(ib.crit ? { crit: ib.crit } : {}), ...(ib.bounds ? { bounds: ib.bounds } : {}) } });
// Component weights as the class keeps them, { type id: weight }, from the names of the types the gradebook has now; null when none is known.
function stpIbW(wn) {
  const T = typeof bkCats === 'function' ? bkCats() : BK_TYPES, w = {};
  for (const t of wn || []) { const x = T.find(x => stpKey(x[1]) === stpKey(t.name) || stpKey(x[2]) === stpKey(t.name)); if (x && x[0] !== 'fm') w[x[0]] = Math.round(t.weight); }
  return Object.keys(w).length ? w : null;
}
const stpIbChanges = (c, ib) => { const n = stpIbNext(c, ib); return c.way !== n.way || JSON.stringify(c.ib || {}) !== JSON.stringify(n.ib) || (!!ib.wn && JSON.stringify(stpIbW(ib.wn)) !== JSON.stringify((c.ib || {}).w || null)); };
// Whether this version lets a teacher add gradebook types of their own (the gradebook's own setup knows).
const stpOwnTypes = () => typeof bkCats === 'function';

/* ---- bringing it in, and what to put back ---- */
const stpClone = v => v == null ? v : JSON.parse(JSON.stringify(v));
async function stpApply(S, pick) {
  const U = { t: Date.now(), parts: Object.keys(pick).filter(k => pick[k]) }, now = Date.now();
  if (pick.school || pick.grading || pick.att) { U.hadMe = !!lib.me; U.me = stpClone(lib.me || null); }
  if (pick.school) meSet({ ...(S.school || {}), ...(S.prog ? { prog: S.prog } : {}) });
  if (pick.grading) {
    U.setupLs = localStorage.getItem('gs.setup');
    store.set('gs.setup', stpClone(S.grading.setup));   // the next new assignment starts from this, as when it is chosen in Settings
    meSet({ grade: stpClone(S.grading) });
    if (!batch) setup = { ...DEFAULT_SETUP };
  }
  if (pick.att) meSet({ att: S.att });
  if (pick.classes) {
    U.classes = []; U.links = []; U.units = []; U.ib = []; U.mbWas = localStorage.getItem(MB_KEY);
    for (const c of S.classes) {
      let had = lib.classes.find(x => stpKey(x.name) === stpKey(c.name));
      if (!had) { lib.classes.push(had = { id: uid(), name: c.name, names: [], units: [] }); U.classes.push(had.id); }
      if (c.link && c.link !== mbOf(had)) { U.links.push([had.id, had.mb || '']); had.mb = c.link; mbRemember(had.name, c.link); }
      if (c.ib && stpIbChanges(had, c.ib)) { U.ib.push([had.id, had.way || '', stpClone(had.ib || null)]); const n = stpIbNext(had, c.ib); had.way = n.way; had.ib = n.ib; }
      for (const u of c.units) if (!had.units.some(x => stpKey(x.name) === stpKey(u))) { const nu = { id: uid(), name: u, items: [] }; had.units.push(nu); U.units.push([had.id, nu.id]); }
    }
  }
  if (pick.terms || pick.book) U.book = stpClone(lib.book || null);
  if (pick.terms) {
    const terms = bkConf().terms.map(t => ({ ...t }));
    for (const t of S.terms) { const had = terms.find(x => stpKey(x.name) === stpKey(t.name)); if (had) { had.start = t.start; had.end = t.end; } else terms.push({ id: uid(), ...t }); }
    terms.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    lib.book = { ...(lib.book || {}), terms };
  }
  if (pick.book) {
    const b = S.book, nb = { ...(lib.book || {}) };
    if (b.w) nb.w = { ...bkConf().w, ...b.w };
    for (const k of ['empty', 'xcTo', 'xcCap', 'retake']) if (b[k] != null) nb[k] = b[k];
    if (b.types && stpOwnTypes()) {   // the teacher's own types, where the gradebook has them: added after the ones there, each with its weight
      const cats = (Array.isArray(nb.cats) && nb.cats.length ? nb.cats : BK_TYPES.map(t => ({ id: t[0] }))).map(x => ({ ...x }));
      for (const t of b.types) {
        const std = BK_TYPES.find(x => stpKey(x[1]) === stpKey(t.name) || stpKey(x[2]) === stpKey(t.name)), own = cats.find(x => x.name && stpKey(x.name) === stpKey(t.name));
        let id = std ? std[0] : own ? own.id : '';
        if (!id && cats.length < 8) { id = 'c' + uid(); cats.push({ id, name: t.name, k: (cats.filter(x => x.k).length % 5) + 1 }); nb.cats = cats; }
        if (id && id !== 'fm' && t.weight != null) nb.w = { ...(nb.w || bkConf().w), [id]: Math.round(t.weight) };
      }
    }
    lib.book = nb;
  }
  // a DP class's own component weights, once the gradebook has the types they name (it may just have been given them)
  if (pick.classes) for (const c of S.classes) if (c.ib && c.ib.wn) {
    const had = lib.classes.find(x => stpKey(x.name) === stpKey(c.name)), w = stpIbW(c.ib.wn);
    if (!had || !w || had.way !== 'dp' || JSON.stringify(w) === JSON.stringify((had.ib || {}).w || null)) continue;
    if (!U.ib.some(x => x[0] === had.id)) U.ib.push([had.id, had.way || '', stpClone(had.ib || null)]);
    had.ib = { ...(had.ib || {}), w };
  }
  if (pick.goals) {
    U.goals = []; lib.goals = Array.isArray(lib.goals) ? lib.goals : [];
    for (const name of S.goals) if (!goalList().some(g => stpKey(g.name) === stpKey(name))) { const g = { id: uid(), name, at: now }; lib.goals.push(g); U.goals.push(g.id); }
  }
  if (pick.rubrics) {
    U.rubAdded = []; U.rubWas = [];
    const all = savedRubrics();
    for (const r of S.rubrics) {
      const i = all.findIndex(x => stpKey(x.name) === stpKey(r.name)), rec = { id: i >= 0 ? all[i].id : uid(), name: i >= 0 ? all[i].name : r.name, criteria: r.criteria, ...(r.levels ? { levels: r.levels } : {}), ...(r.scale ? { scale: r.scale } : i >= 0 && all[i].scale ? { scale: all[i].scale } : {}), ...(r.top ? { top: r.top } : {}), ...(r.half === false ? { half: false } : {}), at: now };
      if (i >= 0) { if (JSON.stringify([all[i].criteria, all[i].levels || null, all[i].scale || null, all[i].top || 4, all[i].half !== false]) === JSON.stringify([rec.criteria, rec.levels || null, rec.scale || null, rec.top || 4, rec.half !== false])) continue; U.rubWas.push(all[i]); all[i] = rec; } else { all.push(rec); U.rubAdded.push(rec.id); }
    }
    all.sort((a, b) => natural(a.name, b.name)); store.set('gs.rubrics', all);
    bankJob(() => bankRead(true)).catch(() => {});   // the bank takes in what it hasn't got, as it does for a rubric saved in Rubric setup
  }
  if (pick.mark) { const now = stpMarkNow(); U.mark = {}; for (const k of Object.keys(S.mark)) U.mark[k] = now[k]; stpMarkSet(S.mark); }
  if (pick.comments) { U.comments = S.comments.filter(c => !bank.includes(c)); bank = bank.concat(U.comments); store.set('gs.bank', bank); }
  saveLib();
  if (pick.classes || pick.calendar || pick.deck) {
    try { const old = await stpPlanGet(), next = stpPlanNext(old, S, pick); if (next) { await stpPlanPut(next); U.plan = { was: old, wrote: next }; } }
    catch { U.planFail = true; }
  }
  try { localStorage.setItem('gs.setupUndo', JSON.stringify(U)); } catch {}
  stpAfter();
  return U;
}
function stpAfter() {
  sysWords(); gradeDefaultApply(); renderLib(); railRender(); homeRender(); planRefresh(); setRender();
  if (batch) renderGrade();
}
const stpUndoRec = () => { const u = store.get('gs.setupUndo', null); return stpObj(u) && u.t ? u : null; };
// Puts back only what the import itself did. A class it added goes only if it is still empty; anything used since stays.
async function stpUndo() {
  const U = stpUndoRec(); if (!U) return;
  const kept = [];
  if ('me' in U) { if (U.hadMe) lib.me = U.me; else delete lib.me; }
  if ('setupLs' in U) { if (U.setupLs == null) store.del('gs.setup'); else try { localStorage.setItem('gs.setup', U.setupLs); } catch {} }
  if ('book' in U) { if (U.book) lib.book = U.book; else delete lib.book; }
  for (const [cid, uidd] of U.units || []) { const c = classById(cid), i = c ? c.units.findIndex(u => u.id === uidd) : -1; if (i >= 0) { if (c.units[i].items.length) kept.push('the unit ' + c.units[i].name); else c.units.splice(i, 1); } }
  for (const [cid, way, ib] of U.ib || []) { const c = classById(cid); if (c && !(U.classes || []).includes(cid)) {   // a class the import made goes whole, or stays whole
    if (way) c.way = way; else delete c.way; if (ib) c.ib = ib; else delete c.ib; } }
  for (const [cid, was] of U.links || []) { const c = classById(cid); if (c) { if (was) c.mb = was; else delete c.mb; } }
  if ('mbWas' in U) try { if (U.mbWas == null) localStorage.removeItem(MB_KEY); else localStorage.setItem(MB_KEY, U.mbWas); } catch {}
  for (const id of U.classes || []) { const i = lib.classes.findIndex(c => c.id === id); if (i >= 0) { const c = lib.classes[i]; if (c.names.length || c.units.some(u => u.items.length)) kept.push('the class ' + c.name); else lib.classes.splice(i, 1); } }
  if (U.goals && Array.isArray(lib.goals)) lib.goals = lib.goals.filter(g => !U.goals.includes(g.id));
  if (U.rubAdded || U.rubWas) { let all = savedRubrics().filter(r => !(U.rubAdded || []).includes(r.id)); for (const w of U.rubWas || []) { const i = all.findIndex(r => r.id === w.id); if (i >= 0) all[i] = { ...w, at: Date.now() }; } store.set('gs.rubrics', all); if ((U.rubAdded || []).length) { store.set('gs.rubricsGone', { ...store.get('gs.rubricsGone', {}), ...Object.fromEntries(U.rubAdded.map(id => [id, Date.now()])) }); bankJob(() => bankWrite(b => { b.rubrics = b.rubrics.filter(r => !U.rubAdded.includes(r.id)); for (const id of U.rubAdded) b.gone[id] = Date.now(); for (const w of U.rubWas || []) { const i = b.rubrics.findIndex(r => r.id === w.id); if (i >= 0) b.rubrics[i] = { ...w, at: Date.now() }; } })).catch(() => {}); } }
  if (U.mark) stpMarkSet(U.mark);
  if (U.comments) { bank = bank.filter(c => !U.comments.includes(c)); store.set('gs.bank', bank); }
  saveLib();
  if (U.plan) {
    try { const cur = await stpPlanGet(); if (JSON.stringify(cur) === JSON.stringify(U.plan.wrote)) await stpPlanPut(U.plan.was); else kept.push('the timetable, which has changed since'); }
    catch { kept.push('the timetable'); }
  }
  store.del('gs.setupUndo');
  stpAfter();
  toast(kept.length ? 'Put back, except ' + stpList(kept, 4) + (kept.length === 1 && /timetable/.test(kept[0]) ? '.' : ', which you have used since.') : 'Put back as it was before the setup came in.', 6000);
}

/* ---- copying a setup out: the same format, from what is here. Never a roster, a score or a paper. ---- */
async function stpExport() {
  const p = await stpPlanGet(), g = meGrade(), conf = bkConf(), day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out = { gradingStudioSetup: STP_V };
  if (me().prog) out.programme = me().prog;
  if (sysName() || unitLinkName() || me().ai) out.school = { ...(sysName() ? { system: sysName() } : {}), ...(unitLinkName() ? { unitPlans: unitLinkName() } : {}), ...(me().ai ? { assistant: String(me().ai) } : {}) };
  if (g) { const raw = (me().grade && me().grade.setup) || {}; out.grading = { way: g.way, score: g.setup.mode === 'rubric' ? 'rows' : 'total', ...(g.setup.mode === 'rubric' ? { criteria: g.setup.criteria } : { outOf: g.setup.outOf }), ...(raw.top ? { rowTop: raw.top } : {}), ...(typeof raw.half === 'boolean' ? { halfPoints: raw.half } : {}), ...(g.setup.scale ? { scale: g.setup.scale } : {}), ...(g.bands ? { bands: g.bands.map(b => ({ grade: b[1], from: b[0] })) } : {}) }; }
  const pc = p && Array.isArray(p.classes) ? p.classes.filter(c => c && c.name) : [], names = lib.classes.filter(c => !c.sample).map(c => c.name);
  for (const c of pc) if (!names.some(n => stpKey(n) === stpKey(c.name))) names.push(String(c.name));
  if (names.length) out.classes = names.map(n => {
    const c = lib.classes.find(x => stpKey(x.name) === stpKey(n)), q = pc.find(x => stpKey(x.name) === stpKey(n)), link = (c && mbOf(c)) || (q && mbUrl(q.mb)) || '';
    const ib = c && (c.way === 'myp' || c.way === 'dp') ? { programme: c.way.toUpperCase(), ...(c.way === 'dp' && c.ib && c.ib.w && typeof c.ib.w === 'object' ? { weights: Object.entries(c.ib.w).filter(([id]) => BK_TYPES.some(t => t[0] === id)).map(([id, w]) => ({ name: BK_TYPES.find(t => t[0] === id)[1], weight: +w || 0 })) } : {}), ...(c.ib && c.ib.group ? { subjectGroup: c.ib.group } : {}), ...(c.ib && Array.isArray(c.ib.crit) && c.ib.crit.length ? { criteria: c.ib.crit.map(x => ({ letter: x.k, name: x.name })) } : {}), ...(c.ib && Array.isArray(c.ib.bounds) && c.ib.bounds.length ? { boundaries: { outOf: c.way === 'dp' ? 100 : ((c.ib.crit || []).length || 4) * 8, grades: c.ib.bounds.map(b => ({ grade: b[1], from: b[0] })) } } : {}) } : {};
    return { name: n, ...(q && q.course ? { course: String(q.course) } : {}), ...ib, ...(link ? { link } : {}), ...(q && Array.isArray(q.meets) && q.meets.length ? { meets: q.meets.filter(m => day[+m.dow]).map(m => ({ day: day[+m.dow], start: String(m.start), end: String(m.end), ...(m.label ? { label: String(m.label) } : {}) })) } : {}), ...(c && c.units.length ? { units: c.units.map(u => u.name) } : {}) };
  });
  if (p && (p.semStart || (p.daysOff || []).length || (p.events || []).length)) out.calendar = { ...(p.semStart && p.semEnd ? { start: p.semStart, end: p.semEnd } : {}), ...((p.daysOff || []).length ? { daysOff: p.daysOff.map(d => ({ date: d.date, label: d.label })) } : {}), ...((p.events || []).length ? { events: p.events.map(e => ({ date: e.date, ...(e.to ? { to: e.to } : {}), label: e.label })) } : {}) };
  if (p && stpObj(p.deck) && (p.deck.agenda === false || p.deck.sizes === 'any')) out.slides = { ...(p.deck.agenda === false ? { agenda: false } : {}), ...(p.deck.sizes === 'any' ? { textSizes: 'any' } : {}) };
  if (conf.terms.length) out.terms = conf.terms.map(t => ({ name: t.name || 'Term', start: t.start, end: t.end }));
  if (lib.book) out.gradebook = { weights: { summative: +conf.w.sum || 0, inClass: +conf.w.ic || 0 }, emptyType: conf.empty, extraCredit: { addsTo: conf.xcTo === 'ic' ? 'inClass' : 'term', cap: conf.xcCap }, retakes: { high: 'highest', last: 'latest', avg: 'average' }[retakeRule()],
    ...(Array.isArray(lib.book.cats) && lib.book.cats.some(x => x.name) ? { types: lib.book.cats.map(x => ({ name: x.name || stpTypeName(x.id), ...(x.id !== 'fm' ? { weight: +conf.w[x.id] || 0 } : {}) })) } : {}) };
  const rs = savedRubrics(); if (rs.length) out.rubrics = rs.map(r => ({ name: r.name, criteria: r.criteria.map((c, i) => { const l = r.levels && r.levels[i]; return l && Object.keys(l).length ? { name: c, levels: l } : c; }), ...(r.scale ? { scale: r.scale } : {}), ...(r.top ? { rowTop: r.top } : {}), ...(r.half === false ? { halfPoints: false } : {}) }));
  if (bank.length) out.comments = bank.slice(0, 200);
  if (goalList().length) out.goals = goalList().map(x => x.name);
  if (lib.me && typeof lib.me.att === 'boolean') out.attendance = lib.me.att;
  { const m = stpMarkNow(), o = { ...(m.xnames ? {} : { studentFileNames: false }), ...(m.anchorCover ? {} : { coverNamesOnAnchors: false }), ...(m.nameFind ? { findTypedNames: true } : {}), ...(m.ptsInk ? { pointsColor: m.ptsInk } : {}), ...(m.sheetfound ? { gradeSheetFromPapers: true } : {}) }; if (Object.keys(o).length) out.marking = o; }
  return JSON.stringify(out, null, 1);
}

/* ---- the prompt a teacher gives their assistant. It describes the format in full, so it is also the format's written description. ---- */
const stpPrompt = () => `I use Grading Studio, an app that runs in my browser for marking papers, keeping a gradebook and planning lessons. Help me set it up. Your job is to produce one block of setup text that I will paste into the app (Settings, My setup). The app shows me what the block would change before anything changes.

RULES
1. Nothing about students. Never put student names, class lists, ID numbers, emails, scores, grades, attendance records, seating, or comments about any student into the block, even if you know them or I give them to you. The app refuses them.
2. Start from what you already know about me: this conversation, your memory of earlier ones, and any files or notes I have shared. Do not ask me for something you already know.
3. Then ask me only for what is missing, two or three questions at a time, in plain words. If I say "skip" or don't know, leave that part out. Every part is optional.
4. Never invent or guess a date, a time, a weight or a boundary. Leave out what you don't know: the app keeps its own setting for anything missing.
5. When you have what you need, tell me in a few plain sentences what the setup says and ask if it is right. After I agree, reply with the setup as ONE code block of JSON, with nothing after it.

WHAT TO FIND OUT
- My classes: each one's name as I want to see it, the days and times it meets, and its page in my school's system if I have the link.
- My school: the system students hand work in on (ManageBac, Google Classroom, Canvas and so on), and where unit plans are kept, if anywhere.
- The calendar: the first and last day of this semester, days with no school, and dates I want to see (exams, reports due).
- Terms: each term's name with its first and last day.
- How I grade a new assignment: rubric rows, points, percent, letter grades, or IB 1 to 7. For rubric rows, the names of the rows I usually use.
- What a term grade is made of: how much summative work and in-class work each count (formative work never counts in this app), and my rules for extra credit and retakes if I have any.
- Rubrics I reuse, with the name of each row and, if I have it, what each level looks like.
- Comments I write again and again on papers, as general sentences with no student in them.
- Learning goals, skills or standards I assess, as short names.

IB TEACHERS
IB grading belongs to each class, so put it on the class:
- MYP class: "programme": "MYP", "subjectGroup" (one of langlit, langacq, indsoc, sci, math, arts, phe, design, idu, pp, or own for my own criteria), "criteria" with each letter and its name, and "boundaries" on the total of the levels. Unless I tell you my school uses others, the boundaries out of 32 are 7 from 28, 6 from 24, 5 from 19, 4 from 15, 3 from 10, 2 from 6, 1 from 1.
- DP class: "programme": "DP" and "boundaries" with "outOf": 100 and my subject's own grade boundaries in percent. These differ by subject, level and session, so ask me for them and do not guess. If the components of this class (such as Paper 1, Paper 2 and the internal assessment) count differently from my other classes, add "weights": [{ "name": "Paper 1", "weight": 20 }] to the class, with the same names as the "types" in "gradebook".
- Give the names of the criteria only. Never include the IB's level descriptors or any other text copied from IB documents.
- If most of my classes are MYP, also set the top-level "programme" and the "grading" part as in the example, so a new assignment starts with my four criteria scored 0 to 8.

THE FORMAT
Every part except the first line is optional. Leave a part out rather than leaving it empty.

{
  "gradingStudioSetup": 1,
  "programme": "MYP",
  "school": { "system": "ManageBac", "unitPlans": "Atlas", "assistant": "Claude" },
  "grading": {
    "way": "myp",
    "score": "rows",
    "criteria": ["A: Knowing and understanding", "B: Inquiring and designing", "C: Processing and evaluating", "D: Reflecting on the impacts of science"],
    "rowTop": 8,
    "halfPoints": false
  },
  "classes": [
    { "name": "MYP 4 Sciences A", "course": "MYP 4 Sciences", "link": "https://example.org/classes/123",
      "programme": "MYP", "subjectGroup": "sci",
      "criteria": [{ "letter": "A", "name": "Knowing and understanding" }, { "letter": "B", "name": "Inquiring and designing" }, { "letter": "C", "name": "Processing and evaluating" }, { "letter": "D", "name": "Reflecting on the impacts of science" }],
      "boundaries": { "outOf": 32, "grades": [{ "grade": 7, "from": 28 }, { "grade": 6, "from": 24 }, { "grade": 5, "from": 19 }, { "grade": 4, "from": 15 }, { "grade": 3, "from": 10 }, { "grade": 2, "from": 6 }, { "grade": 1, "from": 1 }] },
      "meets": [{ "day": "Mon", "start": "08:30", "end": "09:50", "label": "Periods 1-2" }, { "day": "Thu", "start": "13:00", "end": "13:40" }],
      "units": ["Unit 1: Cells", "Unit 2: Forces"] }
  ],
  "calendar": {
    "start": "2026-08-17", "end": "2027-01-15",
    "daysOff": [{ "date": "2026-10-12", "to": "2026-10-16", "label": "Autumn break" }],
    "events": [{ "date": "2026-12-07", "to": "2026-12-11", "label": "Exams" }]
  },
  "terms": [{ "name": "Term 1", "start": "2026-08-17", "end": "2026-10-30" }],
  "gradebook": {
    "weights": { "summative": 50, "inClass": 50 },
    "emptyType": "other",
    "extraCredit": { "addsTo": "term", "cap": true },
    "retakes": "highest"
  },
  "rubrics": [
    { "name": "Lab report", "criteria": [
      { "name": "Analysis", "levels": { "4": "Explains the pattern with evidence", "3": "Describes the pattern", "2": "States a result", "1": "Result is unclear" } },
      "Conclusion"
    ] }
  ],
  "comments": ["Explain how your evidence supports your claim."],
  "goals": ["Uses evidence", "Designs a fair test"],
  "attendance": true,
  "slides": { "agenda": true, "textSizes": "usual" },
  "marking": { "pointsColor": "credit", "studentFileNames": true, "coverNamesOnAnchors": true, "findTypedNames": false, "gradeSheetFromPapers": false }
}

FIELD NOTES
- "way" is one of "rubric", "points", "percent", "letters", "myp", "ib7". "myp" is IB MYP criteria, each marked 0 to 8, with the 1 to 7 boundaries given on each class. "ib7" is the IB Diploma's 1 to 7 from a percent. "score" is "rows" (a rubric, each row scored) or "total" (one number, out of "outOf").
- "bands" are the grades a percent earns, highest first, each with the lowest percent that earns it. If my boundaries are in points, give them in points and add "bandsOutOf" with the total.
- "scale" (optional, inside "grading" or a rubric) turns a score into a percent, like { "12": 100, "11": 95, "10": 91 }.
- Days are "Sun" to "Sat". Times are 24-hour, like "13:05". Dates are YYYY-MM-DD.
- "daysOff" and "events" take one day, or a first and last day with "to".
- "emptyType" is "other" (when a type has nothing in it yet, the others are used) or "zero". "extraCredit.addsTo" is "term" or "inClass"; "cap" true keeps grades at 100% at most. "retakes" is "highest", "latest" or "average".
- "slides" is for the lesson planner: "agenda" false stops an agenda being added as slide 2, and "textSizes" is "usual" (28 to 36 pt) or "any" (18 to 44 pt). Leave it out unless I ask.
- "marking" holds small choices; leave out any I have not asked for. "pointsColor" is "pen", "credit" (full points green, part amber, none red) or one of red, blue, green, purple, black. "studentFileNames" names each file I hand back for the student and assignment. "coverNamesOnAnchors" covers names on example papers I export. "findTypedNames" lets the app look for typed names to cover. "gradeSheetFromPapers" also shows grades the app finds written on papers.
- A rubric row is a name, or a name with "levels" keyed "4" down to "0". A rubric whose rows go higher takes "rowTop" (up to 10), and "halfPoints": false when only whole points are given.
- Use straight quotes and no comments inside the block.`;

/* ---- the page: Settings, My setup ---- */
let stpDraft = '';
function stpSetRender(sec) {
  if (sec !== 'setup') return;
  const put = (id, h) => { const el = $(id); if (el && el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; const ta = el.querySelector('#stpText'); if (ta) ta.value = stpDraft; } };
  const U = stpUndoRec();
  put('#setSetupIn', '<div class="lhead"><h2>Set up with an AI assistant</h2><span class="muted">Your classes, timetable, terms and the way you grade, in one go. Nothing about students, and nothing is sent by this app: you carry the text yourself.</span></div>' +
    '<ol class="stpsteps"><li><div><b>Copy the prompt and paste it into your assistant.</b><span>Claude, ChatGPT, Gemini or another. It uses what it already knows about your teaching, asks about the rest, and is told to leave students out.</span><p><button class="btn sm primary" data-stpprompt>Copy the prompt</button><button class="btn sm ghost" data-stpsee>Read it first</button></p></div></li>' +
    '<li><div><b>Paste what it gives you here.</b><span>The whole reply is fine. You see what would change before anything does.</span>' +
    '<textarea id="stpText" class="big stptext" spellcheck="false" aria-label="Setup text from your assistant" placeholder="{ &quot;gradingStudioSetup&quot;: 1, … }"></textarea>' +
    '<p><button class="btn sm primary" data-stpcheck>Check it</button><button class="btn sm" data-stpfile>Choose a file…</button><input type="file" id="stpFile" accept=".json,.txt,application/json,text/plain" hidden><span class="muted stperr" id="stpErr" role="status"></span></p></div></li></ol>' +
    (U ? '<p class="setp stpundo">A setup came in ' + esc(new Date(U.t).toLocaleString(LANG_LOCALE, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + '. <button class="link" data-stpundo>Undo it</button></p>' : ''));
  put('#setSetupOut', '<div class="lhead"><h2>Copy my setup out</h2><span class="muted">For a colleague to start from, or for your assistant to change and hand back.</span><span class="sp"></span><button class="btn sm" data-stpcopy>Copy my setup</button><button class="btn sm" data-stpsave>Save as a file</button></div>' +
    '<p class="muted setp">Classes by name, meeting times, the calendar, terms, what a grade is made of, how you grade, saved rubrics, saved comments and learning goals. Never a student’s name, a paper, a score or a comment on a paper.</p>');
}
function stpPreview(S, parts) {
  const some = parts.length > 0;
  const part = (p, i) => '<label class="stppart"><input type="checkbox" data-stppart="' + p.key + '" checked><span><b>' + esc(p.title) + '</b>' + p.lines.map(l => '<span class="stpline">' + l + '</span>').join('') + (p.sub ? '<span class="stpsub">' + esc(p.sub) + '</span>' : '') + '</span></label>';
  openDlg('<div class="bh"><h2>' + (some ? 'Check your setup before it comes in' : 'Nothing to bring in') + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div><div class="bb stpprev">' +
    (S.about ? '<p class="muted">Setup for ' + esc(S.about) + '</p>' : '') +
    (S.left.length ? '<div class="stpleft" id="stpLeft"><b>Left out, because it is about students</b><ul>' + S.left.slice(0, 12).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul><span>A setup never carries students. Paste a class list on the class’s own page instead.</span></div>' : '') +
    (some ? '<p class="stplead">Untick anything you don’t want. Nothing changes until you press the button, and you can undo it afterwards.</p><div class="stpparts">' + parts.map(part).join('') + '</div>'
      : '<p class="stplead">' + (S.left.length || S.unknown.length ? 'There is nothing in this setup that this version can use.' : 'Everything in this setup is already how the app is set here.') + '</p>') +
    (S.notes.length ? '<ul class="stpnotes">' + S.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') +
    (S.unknown.length ? '<p class="muted stpunk">Not used by this version: ' + esc(stpList(S.unknown, 8)) + '.</p>' : '') +
    '</div><div class="bf"><button class="btn" data-cancel>' + (some ? 'Cancel' : 'Close') + '</button>' + (some ? '<button class="btn primary" data-ok id="stpGo">Bring it in</button>' : '') + '</div>');
  const count = () => { const n = document.querySelectorAll('#dlgBox [data-stppart]:checked').length, b = $('#stpGo'); if (b) { b.disabled = !n; b.textContent = n === parts.length ? 'Bring it in' : 'Bring in ' + n + ' of ' + parts.length; } };
  $('#dlgBox').onchange = count;
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    const pick = {}; for (const el of document.querySelectorAll('#dlgBox [data-stppart]')) pick[el.dataset.stppart] = el.checked;
    $('#stpGo').disabled = true;
    const U = await stpApply(S, pick);
    stpDraft = ''; closeDlg(); setRender();
    toastDo(U.planFail ? 'Your setup is in, except the timetable, which couldn’t be saved in this browser.' : 'Your setup is in.', 'Undo', stpUndo);
  };
}
async function stpCheck(text) {
  const err = $('#stpErr'), r = stpParse(text);
  if (r.err) { if (err) err.textContent = r.err; return; }
  if (err) err.textContent = '';
  const S = stpRead(r.j);
  stpPreview(S, stpDiff(S, await stpPlanGet()));
}
$('#setPane').addEventListener('input', e => { if (e.target.id === 'stpText') { stpDraft = e.target.value; const el = $('#stpErr'); if (el) el.textContent = ''; } });
$('#setPane').addEventListener('change', async e => {
  if (e.target.id !== 'stpFile') return;
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > STP_MAX) { $('#stpErr').textContent = 'That file is too big to be a setup.'; return; }
  stpDraft = await f.text(); const ta = $('#stpText'); if (ta) ta.value = stpDraft;
  stpCheck(stpDraft);
});
$('#setPane').addEventListener('click', async e => {
  const d = e.target.closest('button'); if (!d) return;
  const copy = (t, say) => navigator.clipboard.writeText(t).then(() => toast(say), () => toast('Copying didn’t work in this browser.'));
  if (d.dataset.stpprompt != null) return copy(stpPrompt(), 'Copied. Paste it into your assistant.');
  if (d.dataset.stpsee != null) {
    openDlg('<div class="bh"><h2>The prompt for your assistant</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div><div class="bb"><pre class="stppre" tabindex="0">' + esc(stpPrompt()) + '</pre></div><div class="bf"><button class="btn" data-cancel>Close</button><button class="btn primary" data-ok>Copy the prompt</button></div>');
    $('#dlgBox').onclick = ev => { if (ev.target.closest('[data-cancel]')) return closeDlg(); if (ev.target.closest('[data-ok]')) { copy(stpPrompt(), 'Copied. Paste it into your assistant.'); closeDlg(); } };
    return;
  }
  if (d.dataset.stpcheck != null) return stpCheck($('#stpText').value);
  if (d.dataset.stpfile != null) return $('#stpFile').click();
  if (d.dataset.stpundo != null) return stpUndo();
  if (d.dataset.stpcopy != null) return copy(await stpExport(), 'Copied. It has no student in it.');
  if (d.dataset.stpsave != null) return saveBlob('grading-studio-setup.json', new Blob([await stpExport()], { type: 'application/json' }));
});
Object.assign(window.__gs, { stpParse, stpRead, stpDiff, stpApply, stpUndo, stpExport, stpPrompt, stpPlanGet });
