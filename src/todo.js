/* ---------------- To do: the teacher's own list, beside what the app noticed from their work ----------------
   A page of its own (#/todo), a short card on Today, and a count in the sidebar. Two kinds of line:
   - the teacher's own, typed in. Each can have a day, a class, a student or an assignment it goes with, a repeat and a note.
   - lines the app works out from what is already saved: papers to mark, papers to hand back, a class with no lesson planned,
     missing work nobody has been reminded about. These are never stored. They are worked out each time, they go when the work
     is done, and each kind can be switched off.
   What is saved, in lib.todo (so it goes wherever the classes go: the folder, the take-home file, safety copies), and never in the
   Planner's folder, because a to-do can name a student:
     items: [{ id, x: the words, d: 'YYYY-MM-DD' or '', c: class id, who: roster name, a: assignment id, rep: '' | 'day' | 'week' | 'meet',
               note, done: time, made: time, t: time it last changed }]   (a deleted one stays as { id, t, gone: 1 } so it stays deleted after a merge)
     off:   { mark | back | plan | miss: 1 } the kinds the app no longer adds, offT when that was last changed
     auto:  { <line's key>: { d: day it was moved to, h: hidden while its number is this, t } } */
const TD_KINDS = [['mark', 'Papers to mark'], ['back', 'Papers to hand back'], ['plan', 'Lessons not planned yet'], ['miss', 'Missing work to chase']];
let tdS = { filter: 'all', sel: '', done: false, drop: {}, week: 0, drag: '' };   // for this visit only
const TD_DAY = 864e5;
const tdData = () => { const t = lib.todo || {}; return { items: Array.isArray(t.items) ? t.items : [], off: t.off || {}, offT: t.offT || 0, auto: t.auto || {} }; };
function tdSave(part) {
  const d = { ...tdData(), ...part }, now = Date.now();
  // What nobody will look for again goes: a deletion after half a year, a finished line after four months, a moved or hidden app line after two.
  d.items = d.items.filter(it => it && it.id && !(it.gone && now - (it.t || 0) > 180 * TD_DAY) && !(it.done && now - it.done > 120 * TD_DAY));
  d.auto = Object.fromEntries(Object.entries(d.auto).filter(([, a]) => a && now - (a.t || 0) < 60 * TD_DAY));
  lib.todo = d; saveLib(); todoRender();
}
const tdItems = () => tdData().items.filter(it => it && it.id && !it.gone);
const tdItem = id => tdItems().find(it => it.id === id) || null;
function tdPut(id, part) { const now = Date.now(); tdSave({ items: tdData().items.map(it => it.id === id ? { ...it, ...part, t: now } : it) }); }
function tdAutoPut(key, part) { const d = tdData(); tdSave({ auto: { ...d.auto, [key]: { ...(d.auto[key] || {}), ...part, t: Date.now() } } }); }

/* ---------- days ---------- */
const tdToday = () => isoDay(Date.now());
const tdAt = day => new Date(day + 'T12:00:00');
const tdAdd = (day, n) => { const d = tdAt(day); d.setDate(d.getDate() + n); return isoDay(d); };
const tdGap = (day, from) => Math.round((tdAt(day) - tdAt(from)) / TD_DAY);
const tdNextMon = day => tdAdd(day, (8 - tdAt(day).getDay()) % 7 || 7);
// A day in the fewest words: Today, Tomorrow, the weekday within a week either way, else the date.
function tdDaySay(d, today) {
  if (!d) return '';
  const n = tdGap(d, today);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > -7 && n < 7 ? tdAt(d).toLocaleDateString(LANG_LOCALE, { weekday: 'short' }) : bkDay(d);
}
const tdDayLong = d => tdAt(d).toLocaleDateString(LANG_LOCALE, { weekday: 'short', month: 'short', day: 'numeric' });

/* ---------- reading what was typed: a day at the end, a class or a student named in it ---------- */
const TD_DOW = { sunday: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2, wednesday: 3, wed: 3, thursday: 4, thurs: 4, thur: 4, thu: 4, friday: 5, fri: 5, saturday: 6 };
const TD_MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const TD_DAYS_RX = 'sunday|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday', TD_MON_RX = '(?:' + TD_MON.join('|') + ')[a-z]*\\.?';
const TD_TAIL = new RegExp('^(.*?)[\\s,]+(today|tonight|tomorrow|next week|(?:next\\s+)?(?:' + TD_DAYS_RX + ')|' + TD_MON_RX + '\\s+\\d{1,2}|\\d{1,2}\\s+' + TD_MON_RX + ')[.!]?$', 'i');
// The day a word means, counted from today. "friday" is the coming Friday (today, on a Friday); "next friday" is the one in the week after this.
function tdWordDay(w, today) {
  w = w.toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
  if (w === 'today' || w === 'tonight') return today;
  if (w === 'tomorrow') return tdAdd(today, 1);
  if (w === 'next week') return tdNextMon(today);
  const next = /^next /.test(w), k = w.replace(/^next /, '');
  if (k in TD_DOW) return next ? tdAdd(tdNextMon(today), (TD_DOW[k] + 6) % 7) : tdAdd(today, (TD_DOW[k] - tdAt(today).getDay() + 7) % 7);
  const m = /^([a-z]+)\.? (\d{1,2})$/.exec(k) || (x => x && [0, x[2], x[1]])(/^(\d{1,2}) ([a-z]+)$/.exec(k));
  if (!m) return '';
  const mon = TD_MON.indexOf(m[1].slice(0, 3)), day = +m[2]; if (mon < 0 || day < 1 || day > 31) return '';
  const at = y => { const d = new Date(y, mon, day, 12); return d.getMonth() === mon ? isoDay(d) : ''; };
  const y = tdAt(today).getFullYear(), d = at(y);
  return d && tdGap(d, today) < -30 ? at(y + 1) : d;   // a date well behind us means next year's
}
function tdReadDay(text, today) {
  const lead = /^(today|tomorrow)[:,]?\s+(.+)$/i.exec(text);
  if (lead) return { d: tdWordDay(lead[1], today), rep: '', x: lead[2] };
  const m = TD_TAIL.exec(text); if (!m) return null;
  let head = m[1].trim(), rep = '';
  // "for Friday" and "about Monday" are part of what there is to do, not when to do it.
  if (/(^|\s)(for|about|this|last|before|after|until|since|of|the)$/i.test(head)) return null;
  const d = tdWordDay(m[2], today); if (!d) return null;
  if (/(^|\s)every$/i.test(head) && m[2].toLowerCase() in TD_DOW) { rep = 'week'; head = head.replace(/\s*every$/i, ''); }
  else head = head.replace(/[\s,]+(by|on|due)$/i, '');
  head = head.replace(/[\s,;:]+$/, '');
  return head ? { d, rep, x: head } : null;
}
const tdKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// A student by their whole name anywhere, or by a first name nobody else on any roster has (as a word of its own, capital and all,
// and not the first word: "Mark the essays" is not about Mark). Else a class by its name.
function tdReadWho(text) {
  const low = text.toLowerCase();
  for (const c of lib.classes) for (const n of c.names) if (n.length > 3 && low.includes(n.toLowerCase())) return { c: c.id, who: n };
  const firsts = new Map();
  for (const c of lib.classes) for (const n of c.names) { const f = n.trim().split(/\s+/)[0]; if (f && f.length > 2) firsts.set(f, firsts.has(f) ? null : { c: c.id, who: n }); }
  for (const w of text.split(/[^\p{L}\p{M}'’-]+/u).slice(1)) { const hit = firsts.get(w.replace(/['’]s$/, '')); if (hit) return hit; }
  for (const c of [...lib.classes].sort((a, b) => b.name.length - a.name.length)) if (c.name.trim().length > 2 && low.includes(c.name.trim().toLowerCase())) return { c: c.id, who: '' };
  return { c: '', who: '' };
}
function todoRead(text, today) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300), day = tdReadDay(raw, today || tdToday()), who = tdReadWho(raw);
  return { raw, x: day ? day.x : raw, d: day ? day.d : '', rep: day ? day.rep : '', c: who.c, who: who.who };
}
// drop: what the teacher said not to read out of the words ({ d, c, who }). base: what the line starts with when the words don't say.
function todoAdd(text, drop, base) {
  drop = drop || {};
  const r = todoRead(text); if (!r.raw) return null;
  const now = Date.now(), it = { id: 'td' + uid(), x: drop.d ? r.raw : r.x, d: drop.d ? '' : r.d, c: drop.c ? '' : r.c, who: drop.c || drop.who ? '' : r.who, a: '', rep: drop.d ? '' : r.rep, note: '', done: 0, made: now, t: now };
  for (const [k, v] of Object.entries(base || {})) if (!it[k]) it[k] = v;
  tdSave({ items: [...tdData().items, it] });
  return it;
}

/* ---------- repeating, finishing, deleting ---------- */
// The Planner's class with the same name as a grading class (spaces, dashes and capitals don't count), for when it meets.
const tdPlanClass = c => (c && plan && plan.classes.find(p => tdKey(p.name) === tdKey(c.name))) || null;
const tdGradeClass = p => lib.classes.find(c => tdKey(c.name) === tdKey(p.name)) || null;
function tdNext(it) {
  const today = tdToday(), from = it.d && it.d > today ? it.d : today;
  if (it.rep === 'day') { let d = tdAdd(from, 1); while ([0, 6].includes(tdAt(d).getDay())) d = tdAdd(d, 1); return d; }
  if (it.rep === 'meet') {
    const p = tdPlanClass(classById(it.c)), dows = p ? new Set(p.meets.map(m => m.dow)) : null;
    if (dows && dows.size) for (let i = 1; i <= 60; i++) { const d = tdAdd(from, i); if (dows.has(tdAt(d).getDay()) && !plan.daysOff.some(o => o.date === d)) return d; }
  }
  let d = it.d || today; do d = tdAdd(d, 7); while (d <= today);
  return d;
}
function todoTick(id) {
  const it = tdItem(id); if (!it) return;
  const now = Date.now();
  if (it.done) return tdPut(id, { done: 0 });
  if (!it.rep) return tdPut(id, { done: now });
  // A repeating line moves on to its next day, and leaves a finished copy behind for today.
  const copy = { ...it, id: 'td' + uid(), rep: '', done: now, t: now };
  tdSave({ items: tdData().items.flatMap(x => x.id === id ? [{ ...x, d: tdNext(it), t: now }, copy] : [x]) });
}
function todoDelete(id) {
  const it = tdItem(id); if (!it) return;
  if (tdS.sel === id) tdS.sel = '';
  tdSave({ items: tdData().items.map(x => x.id === id ? { id, t: Date.now(), gone: 1 } : x) });
  toastDo('To-do deleted', 'Undo', () => tdSave({ items: tdData().items.map(x => x.id === id ? { ...it, t: Date.now() } : x) }));
}

/* ---------- what the app adds: worked out from saved work, never stored ---------- */
// Students who owe work and have not been reminded, by class, for the term it is now. Reading the gradebook means reading the kept
// work, so it is done when Today or To do comes on screen, not on every draw.
let tdMiss = { by: {}, busy: false, at: 0 };
function tdMissLoad() {
  if (tdMiss.busy || tdData().off.miss || !lib.classes.some(c => c.names.length)) return;
  tdMiss.busy = true;
  bkLoad().then(cols => {
    const by = {}, terms = bkConf().terms, term = terms.length ? bkTermNow(terms) : null;
    for (const c of lib.classes) {
      if (!c.names.length) continue;
      const all = bkClassCols(c, cols), n = misByStu(c, term == null ? all : all.filter(x => x.termId === term)).filter(s => s.cols.some(col => !misNudge(c, s.n, col))).length;
      if (n) by[c.id] = n;
    }
    const changed = JSON.stringify(by) !== JSON.stringify(tdMiss.by);
    tdMiss = { by, busy: false, at: Date.now() };
    if (changed) todoRender();
  }).catch(e => { console.error(e); tdMiss.busy = false; });
}
function todoAuto() {
  const d = tdData(), today = tdToday(), out = [];
  const add = (kind, key, x, sub, c, day, btn, sig, color) => {
    const a = d.auto[key] || {}; if (a.h != null && a.h === sig) return null;
    const row = { auto: true, id: 'auto:' + key, key, kind, x, sub, c, d: a.d && a.d > day && a.d > today ? a.d : day < today ? today : day, btn, sig, color };
    out.push(row); return row;
  };
  const g = homeGroups();
  if (!d.off.mark) for (const m of g.mark) {
    if (!m.papers) continue;
    const st = keptState(m), w = keptWhere(m), fm = w.it && w.it.type === 'fm', began = st.done || m.partial, name = m.name || 'Student work';
    add('mark', 'mark:' + m.id, (fm ? 'Give feedback on ' : began ? 'Finish marking ' : 'Mark ') + name, [w.cls ? w.cls.name : '', fm ? 'feedback only' : began ? st.left + ' of ' + st.of + ' left' : people(st.of, 'paper') + ', not started'].filter(Boolean).join(' · '), w.cls, today, { label: began || fm ? 'Continue' : 'Start', open: m.id }, 'x');
  }
  if (!d.off.back) for (const m of g.back) {
    if (!m.papers) continue;
    const st = keptState(m), w = keptWhere(m);
    add('back', 'back:' + m.id, 'Hand back ' + (m.name || 'Student work'), [w.cls ? w.cls.name : '', (st.of === 1 ? 'the one paper' : 'all ' + st.of) + ' scored'].filter(Boolean).join(' · '), w.cls, today, { label: 'Return papers', href: batchHash(m.id, 'return') }, 'x');
  }
  // A class in the next few days with nothing planned for it, on the day it meets.
  if (!d.off.plan && plan) for (let i = 0; i < 4; i++) {
    const day = tdAdd(today, i); if ((plan.semStart && day < plan.semStart) || (plan.semEnd && day > plan.semEnd)) continue;
    const t = todayRows(plan, tdAt(day).getTime()), live = i ? null : nowRow(t.rows);
    for (const r of t.rows) {
      if (r.lessons.length || (!i && (!live || t.rows.indexOf(r) < t.rows.indexOf(live)))) continue;   // planned, or over already today
      const when = i === 0 ? 'today’s' : i === 1 ? 'tomorrow’s' : tdAt(day).toLocaleDateString(LANG_LOCALE, { weekday: 'long' }) + '’s';
      const row = add('plan', 'plan:' + r.c.id + ':' + day + ':' + r.m.start, 'Plan ' + when + ' ' + r.c.name + ' lesson', [planTime(r.m.start), 'nothing planned yet'].filter(Boolean).join(' · '), tdGradeClass(r.c), day, { label: 'Plan it', href: planUrl('#week') }, 'x', r.c.color);
      if (row) row.pid = r.c.id;
    }
  }
  if (!d.off.miss) for (const c of lib.classes) {
    const n = tdMiss.by[c.id]; if (!n) continue;
    add('miss', 'miss:' + c.id, 'Remind ' + people(n, 'student') + ' about missing work', c.name, c, today, { label: 'See who', href: classHash(c, 'missing') }, n);
  }
  return out;
}
// Every line: the teacher's own, then the app's.
function todoRows() {
  const own = tdItems().map(it => ({ own: true, id: it.id, it, x: it.x, d: it.d || '', c: it.c ? classById(it.c) || null : null, done: it.done || 0 }));
  return [...own, ...todoAuto()];
}
const tdDoneToday = (r, today) => !!r.done && isoDay(r.done) === today;
// What the sidebar counts: everything not done that is overdue or for today.
const todoCount = () => { const today = tdToday(); return todoRows().filter(r => !r.done && r.d && r.d <= today).length; };

/* ---------- drawing ---------- */
const TD_TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const TD_REP = { day: 'Every school day', week: 'Every week', meet: 'Each time this class meets' };
const tdDot = (c, color) => '<span class="rdot" style="background:' + (color || classColor(c)) + '"></span>';
function tdRow(r, today, card) {
  const done = !!r.done, late = !done && r.d && r.d < today, due = done ? 'Done' : tdDaySay(r.d, today);
  const word = !due || due === 'Done' || due === 'Today' || due === 'Tomorrow';   // a weekday or a date is written by the browser in the app's language already
  let meta = '';
  if (r.auto) meta = '<span class="tdtag">From your work</span>' + (r.sub ? '<span data-raw>' + esc(r.sub) + '</span>' : '');
  else {
    const it = r.it, a = it.a && findItem(it.a);
    meta = [r.c ? '<span class="tdc" data-raw>' + tdDot(r.c) + esc(r.c.name) + '</span>' : '', it.who ? '<span data-raw>' + esc(it.who) + '</span>' : '', a ? '<span data-raw>' + esc(a.it.name) + '</span>' : '',
      it.rep ? '<span>' + TD_REP[it.rep] + '</span>' : '', it.note ? '<span>Note</span>' : ''].filter(Boolean).join('');
  }
  const btn = r.auto && !card ? (r.btn.open ? '<button class="btn sm" data-tdopen="' + esc(r.btn.open) + '">' + r.btn.label + '</button>' : '<a class="btn sm" href="' + esc(r.btn.href) + '">' + r.btn.label + '</a>') : '';
  return '<div class="tdrow' + (done ? ' done' : '') + (r.auto ? ' auto' : '') + (!card && tdS.sel === r.id ? ' sel' : '') + '" data-td="' + esc(r.id) + '">' +
    '<button class="tdck" data-raw data-tdtick="' + esc(r.id) + '" ' + (r.auto ? 'title="Hide this line. It goes by itself when the work is done." aria-label="Hide: ' + esc(r.x) + '"' : 'role="checkbox" aria-checked="' + done + '" aria-label="' + esc(r.x) + '" title="' + (done ? 'Not done after all' : 'Done') + '"') + '>' + (done ? TD_TICK : '') + '</button>' +
    '<button class="tdmain" data-tdsel="' + esc(r.id) + '"' + (card ? ' title="Open it in To do"' : '') + '><span class="tdx" data-raw>' + esc(r.x) + '</span>' + (meta ? '<span class="tdm">' + meta + '</span>' : '') + '</button>' + btn +
    '<span class="tddue' + (late ? ' late' : !done && r.d === today ? ' now' : '') + '"' + (word ? '' : ' data-raw title="' + esc(tdDayLong(r.d)) + '"') + '>' + esc(due) + '</span></div>';
}
const tdPutHtml = (el, h) => { if (el && el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } };
const tdSort = (a, b) => (a.d || '9').localeCompare(b.d || '9') || (a.auto ? 1 : 0) - (b.auto ? 1 : 0) || ((a.it && a.it.made) || 0) - ((b.it && b.it.made) || 0);

// The card on Today: only the teacher's own lines that are overdue or for today. Marking and handing back have their own sections there.
function tdCardRender() {
  const box = $('#tdCardList'); if (!box) return;
  const today = tdToday(), own = todoRows().filter(r => r.own);
  const now = own.filter(r => (!r.done && r.d && r.d <= today) || tdDoneToday(r, today)).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || tdSort(a, b));
  const shown = now.slice(0, 8), rest = own.filter(r => !r.done).length - shown.filter(r => !r.done).length;
  const h = (shown.length ? shown.map(r => tdRow(r, today, true)).join('') : '<p class="tdnone">Nothing on your list for today.</p>') +
    (rest > 0 ? '<div class="tdfoot"><span>' + rest + ' more on your list</span><a class="link" href="#/todo">See everything</a></div>' : '');
  tdPutHtml(box, h);
}
// "1 to do" on a class's row on Today, when a line of the teacher's is for that class today.
function todoClassNote(planClass) {
  const c = tdGradeClass(planClass); if (!c) return '';
  const today = tdToday(), n = tdItems().filter(it => !it.done && it.c === c.id && it.d && it.d <= today).length;
  return n ? ' · <span class="tdpre">' + n + ' to do</span>' : '';
}

function tdGroups(rows, today) {
  const week = tdAdd(today, 7), g = { late: [], now: [], week: [], later: [], done: [] };
  for (const r of rows) {
    if (r.done) { if (tdDoneToday(r, today)) g.now.push(r); else if (Date.now() - r.done < 7 * TD_DAY) g.done.push(r); continue; }
    if (!r.d) g.later.push(r); else if (r.d < today) g.late.push(r); else if (r.d === today) g.now.push(r); else if (r.d <= week) g.week.push(r); else g.later.push(r);
  }
  for (const k of ['late', 'now', 'week', 'later']) g[k].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || tdSort(a, b));
  g.done.sort((a, b) => b.done - a.done);
  return g;
}
/* ---------- the week: the same lines on the days they are for, under the classes that meet ---------- */
// Monday to Friday (and the weekend when something is on it), then Later. A line not done by its day shows under today, with the day
// it was for. What was done stays on the day it was done. Nothing more is saved: a line's day is the only thing a drag changes.
const tdPid = r => r.pid || ((p => p ? p.id : '')(tdPlanClass(r.c)));
function tdWRow(r) {
  const done = !!r.done, sub = r.from ? '<span class="late" data-raw>from ' + esc(tdAt(r.from).toLocaleDateString(LANG_LOCALE, { weekday: 'long' })) + '</span>' : r.auto ? (r.sub ? '<span data-raw>' + esc(r.sub.split(' · ').pop()) + '</span>' : '') :
    [r.it.who ? '<span data-raw>' + esc(r.it.who) + '</span>' : '', r.it.rep ? '<span>' + TD_REP[r.it.rep] + '</span>' : ''].filter(Boolean).join('');
  return '<div class="tdw' + (done ? ' done' : '') + (r.auto ? ' auto' : '') + (tdS.sel === r.id ? ' sel' : '') + '" data-td="' + esc(r.id) + '"' + (done ? '' : ' draggable="true"') + '>' +
    '<button class="tdck" data-raw data-tdtick="' + esc(r.id) + '" ' + (r.auto ? 'title="Hide this line. It goes by itself when the work is done." aria-label="Hide: ' + esc(r.x) + '"' : 'role="checkbox" aria-checked="' + done + '" aria-label="' + esc(r.x) + '" title="' + (done ? 'Not done after all' : 'Done') + '"') + '>' + (done ? TD_TICK : '') + '</button>' +
    '<button class="tdmain" data-tdsel="' + esc(r.id) + '"><span class="tdx" data-raw>' + esc(r.x) + '</span>' + (sub ? '<span class="tdm">' + sub + '</span>' : '') + '</button></div>';
}
function tdWeekHtml(rows, today) {
  const mon = tdAdd(today, -((tdAt(today).getDay() + 6) % 7) + 7 * tdS.week), days = [0, 1, 2, 3, 4, 5, 6].map(i => tdAdd(mon, i)), end = days[6], cur = today >= mon && today <= end;
  const by = new Map(days.map(d => [d, []])), later = [];
  for (const r of rows) {
    if (r.done) { const dd = isoDay(r.done); if (by.has(dd)) by.get(dd).push(r); continue; }
    if (!r.d || r.d > end) later.push(r);
    else if (r.d < today) { if (cur) by.get(today).push({ ...r, from: r.d }); }   // not done by its day: it is today's now
    else if (r.d >= mon) by.get(r.d).push(r);
  }
  const add = (day, label) => '<form class="tdwadd" data-tdwadd="' + day + '" autocomplete="off"><input type="text" maxlength="300" placeholder="Add…" aria-label="Add a to-do for ' + esc(label) + '"></form>';
  const col = day => {
    const list = by.get(day).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.from ? 0 : 1) - (b.from ? 0 : 1) || tdSort(a, b)), dow = tdAt(day).getDay();
    const inTerm = plan && !(plan.semStart && day < plan.semStart) && !(plan.semEnd && day > plan.semEnd), t = inTerm ? todayRows(plan, tdAt(day).getTime()) : { off: '', rows: [] };
    const meets = []; for (const m of t.rows) if (!meets.some(x => x.c.id === m.c.id)) meets.push(m);
    if ((dow === 0 || dow === 6) && !list.length && !meets.length && day !== today) return '';
    const under = new Map(meets.map(m => [m.c.id, []])), any = [];
    for (const r of list) { const p = tdPid(r); (under.has(p) ? under.get(p) : any).push(r); }
    const name = day === today ? 'Today' : tdAt(day).toLocaleDateString(LANG_LOCALE, { weekday: 'short' });
    return '<section class="tdday' + (day === today ? ' now' : day < today ? ' past' : '') + '" data-tdday="' + day + '"><h3><b' + (day === today ? '' : ' data-raw') + '>' + esc(name) + '</b><span data-raw>' + esc(day === today ? tdDayLong(day) : bkDay(day)) + '</span></h3>' +
      (t.off ? '<p class="tdoff" data-raw>' + esc(t.off) + '</p>' : '') + (any.length && meets.length ? '<div class="tdany">Any time</div>' : '') + any.map(tdWRow).join('') +
      meets.map(m => '<div class="tdcl" data-raw>' + tdDot(null, m.c.color) + '<b>' + esc(m.c.name) + '</b><span>' + esc(planTime(m.m.start)) + '</span></div>' + under.get(m.c.id).map(tdWRow).join('')).join('') + add(day, name) + '</section>';
  };
  const say = tdAt(mon).toLocaleDateString(LANG_LOCALE, { month: 'long', day: 'numeric' });
  return '<div class="tdwbar"><button class="btn sm" data-tdwk="-1" aria-label="The week before" title="The week before">‹</button><b>Week of <span data-raw>' + esc(say) + '</span></b><button class="btn sm" data-tdwk="1" aria-label="The week after" title="The week after">›</button>' +
    (tdS.week ? '<button class="btn sm" data-tdwk="0">This week</button>' : '') + '<span class="muted">Anything not done moves to today on its own. Drag a line to another day.</span></div>' +
    '<div class="tdwk">' + days.map(col).join('') + '<section class="tdday tdlater" data-tdday=""><h3><b>Later</b><span>no day, or after this week</span></h3>' + later.sort(tdSort).map(r => tdWRow(r)).join('') + add('', 'later') + '</section></div>';
}
function tdSideHtml(rows, today) {
  const r = tdS.sel ? rows.find(x => x.id === tdS.sel) : null;
  if (!r && routeNow().week) return '';   // the week has no room for the switches: they are on the list
  if (!r) {
    const off = tdData().off;
    return '<h2 class="tcap">The app adds these for you</h2><div class="tcard tdkinds">' + TD_KINDS.map(([k, l]) => '<button class="tdsw" role="switch" aria-checked="' + !off[k] + '" data-tdkind="' + k + '"><span>' + l + '</span><i aria-hidden="true"></i></button>').join('') +
      '<p class="muted">These come from your saved work and go by themselves when the work is done. You can move one to another day or hide it, and you never have to type it.</p></div>';
  }
  const chip = (attr, on, label) => '<button class="tdchip' + (on ? ' on' : '') + '" ' + attr + ' aria-pressed="' + !!on + '">' + label + '</button>';
  const when = '<div class="tdf"><span class="tdl">When</span><div class="tdv">' + chip('data-tdwhen="today"', r.d === today, 'Today') + chip('data-tdwhen="tomorrow"', r.d === tdAdd(today, 1), 'Tomorrow') + chip('data-tdwhen="week"', r.d === tdNextMon(today), 'Next week') + (r.own ? chip('data-tdwhen="none"', !r.d, 'No day') : '') +
    '<input type="date" id="tdDate" value="' + esc(r.d) + '" aria-label="Pick a day" title="Pick a day"></div></div>';
  const x = '<button class="icon tdclose" data-tdclose aria-label="Close" title="Close">✕</button>';
  if (r.auto) return '<div class="tcard tdpane" data-tdpane="' + esc(r.id) + '">' + x + '<h2 class="tdtitle" data-raw>' + esc(r.x) + '</h2><p class="tdm"><span class="tdtag">From your work</span>' + (r.sub ? '<span data-raw>' + esc(r.sub) + '</span>' : '') + '</p>' + when +
    '<p class="muted tdsay">The app noticed this from your saved work. It goes by itself when the work is done.</p><div class="tdacts">' + (r.btn.open ? '<button class="btn primary" data-tdopen="' + esc(r.btn.open) + '">' + r.btn.label + '</button>' : '<a class="btn primary" href="' + esc(r.btn.href) + '">' + r.btn.label + '</a>') +
    '<span class="sp"></span><button class="btn" data-tdhide>Hide this</button></div></div>';
  const it = r.it, c = r.c, pc = tdPlanClass(c);
  const cls = '<div class="tdf"><label class="tdl" for="tdCls">Class</label><div class="tdv"><select id="tdCls" class="btn sm"><option value="">No class</option>' + lib.classes.map(k => '<option value="' + esc(k.id) + '"' + (k === c ? ' selected' : '') + '>' + esc(k.name) + '</option>').join('') + '</select></div></div>';
  let goes = '';
  if (c) {
    const items = c.units.flatMap(u => u.items), si = it.who ? c.names.indexOf(it.who) : -1, a = it.a && items.find(i => i.id === it.a);
    goes = '<div class="tdf"><label class="tdl" for="tdWith">Goes with</label><div class="tdv"><select id="tdWith" class="btn sm"><option value="">Nothing</option>' +
      (items.length ? '<optgroup label="Assignments">' + items.map(i => '<option value="a:' + esc(i.id) + '"' + (i === a ? ' selected' : '') + '>' + esc(i.name) + '</option>').join('') + '</optgroup>' : '') +
      (c.names.length ? '<optgroup label="Students">' + c.names.map((n, i) => '<option value="s:' + i + '"' + (i === si ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</optgroup>' : '') + '</select>' +
      (si >= 0 ? '<a class="link" href="' + classHash(c, 'students', si) + '">Open their page</a>' : a ? '<a class="link" href="' + classHash(c) + '">Open the class</a>' : '') + '</div></div>';
  }
  const rep = '<div class="tdf"><span class="tdl">Repeats</span><div class="tdv">' + chip('data-tdrep=""', !it.rep, 'No') + chip('data-tdrep="day"', it.rep === 'day', 'Every school day') + chip('data-tdrep="week"', it.rep === 'week', 'Every week') + (pc || it.rep === 'meet' ? chip('data-tdrep="meet"', it.rep === 'meet', 'Each time this class meets') : '') + '</div></div>';
  return '<div class="tcard tdpane" data-tdpane="' + esc(r.id) + '">' + x + '<textarea class="tdtitle" id="tdX" rows="2" maxlength="300" aria-label="What to do">' + esc(it.x) + '</textarea>' + when + cls + goes + rep +
    '<div class="tdf top"><label class="tdl" for="tdNote">Note</label><div class="tdv"><textarea id="tdNote" rows="3" maxlength="2000" placeholder="Anything to remember about it">' + esc(it.note || '') + '</textarea></div></div>' +
    '<div class="tdacts"><button class="btn primary" data-tdfin>' + (it.done ? 'Not done after all' : 'Done') + '</button>' + (it.done ? '' : '<button class="btn" data-tdwhen="tomorrow">Move to tomorrow</button>') + '<span class="sp"></span><button class="btn ghost" data-tddel>Delete</button></div></div>';
}
function tdPageRender() {
  const r = routeNow(); if (r.v !== 'todo' || batch) return;
  const today = tdToday(), all = todoRows();
  if (tdS.sel && !all.some(x => x.id === tdS.sel)) tdS.sel = '';
  if (tdS.filter !== 'all' && tdS.filter !== 'mine' && !classById(tdS.filter)) tdS.filter = 'all';
  const rows = all.filter(x => tdS.filter === 'all' || (tdS.filter === 'mine' ? x.own : x.c && x.c.id === tdS.filter)), g = tdGroups(rows, today);
  const late = all.filter(x => !x.done && x.d && x.d < today).length, now = all.filter(x => !x.done && x.d === today).length;
  const say = late || now ? [late ? numWord(late) + ' overdue' : '', now ? (late ? numWord(now).toLowerCase() : numWord(now)) + ' for today' : ''].filter(Boolean).join(', ') + '.' : all.some(x => !x.done) ? 'Nothing due today.' : 'Nothing on your list.';
  if ($('#tdSay').textContent !== say) $('#tdSay').textContent = say;
  const fchip = (k, label, c) => '<button class="tdchip' + (tdS.filter === k ? ' on' : '') + '" data-tdf="' + esc(k) + '" aria-pressed="' + (tdS.filter === k) + '">' + (c ? tdDot(c) : '') + '<span' + (c ? ' data-raw' : '') + '>' + esc(label) + '</span></button>';
  tdPutHtml($('#tdChips'), fchip('all', 'Everything') + fchip('mine', 'Only mine') + lib.classes.map(c => fchip(c.id, c.name, c)).join(''));
  const nDone = tdGroups(all, today).done.length, db = $('#tdDoneBtn');
  db.hidden = !nDone; db.textContent = (tdS.done ? 'Hide' : 'Show') + ' done in the last 7 days · ' + nDone; db.setAttribute('aria-pressed', String(tdS.done));
  const sec = (k, name, list) => list.length ? '<div class="tdgrp' + (k === 'late' ? ' late' : '') + '" data-tdgrp="' + k + '">' + name + ' <span>' + (k === 'done' ? list.length : list.filter(x => !x.done).length) + '</span></div>' + list.map(x => tdRow(x, today)).join('') : '';
  const h = sec('late', 'Overdue', g.late) + sec('now', 'Today', g.now) + sec('week', 'Next 7 days', g.week) + sec('later', 'Later', g.later) + (tdS.done ? sec('done', 'Done in the last 7 days', g.done) : '');
  tdPutHtml($('#tdList'), h || '<p class="tdnone">' + (tdS.filter === 'all' ? 'Nothing here yet. Type something above and press Enter, like “Print handouts tomorrow”.' : 'Nothing here for this view.') + '</p>');
  const wk = !!r.week, box = $('#tdWeek');
  for (const b of document.querySelectorAll('#tdView [data-tdview]')) b.setAttribute('aria-pressed', String((b.dataset.tdview === 'week') === wk));
  $('#vTodo .tdgrid').classList.toggle('wk', wk); box.hidden = !wk;
  // a line being typed into a day is not drawn over
  const typing = wk && box.contains(document.activeElement) && document.activeElement.matches('input') && document.activeElement.value;
  if (wk && !typing) tdPutHtml(box, tdWeekHtml(rows, today));
  tdPutHtml($('#tdSide'), tdSideHtml(all, today));
}
function tdUndRender() {
  const box = $('#tdUnd'), r = todoRead($('#tdIn').value), c = r.c && classById(r.c), parts = [];
  if (r.d && !tdS.drop.d) parts.push('<button class="tdchip on" data-tddrop="d" title="Not a day: leave these words in">' + esc(tdDayLong(r.d)) + (r.rep ? ' · every week' : '') + '</button>');
  if (c && !tdS.drop.c) parts.push('<button class="tdchip" data-tddrop="c" title="Not about this class">' + tdDot(c) + '<span data-raw>' + esc(c.name) + '</span></button>');
  if (c && r.who && !tdS.drop.c && !tdS.drop.who) parts.push('<button class="tdchip" data-tddrop="who" title="Not about this student"><span data-raw>' + esc(r.who) + '</span></button>');
  box.hidden = !parts.length;
  tdPutHtml(box, parts.length ? '<span>Understood as</span>' + parts.join('') + '<span class="tdhint">Click one to take it off</span>' : '');
}
let tdWas = '';
function todoRender() {
  if (!shellReady) return;
  const r = routeNow(), scr = batch ? 'a' : r.v;
  if (scr !== tdWas && (scr === 'todo' || scr === 'home')) tdMissLoad();   // coming to either screen: look again at who owes work
  tdWas = scr;
  const n = todoCount(), el = $('#railTodo'), s = n ? String(n) : '';
  if (el.textContent !== s) el.textContent = s;
  tdCardRender(); tdPageRender();
}

/* ---------- doing ---------- */
function tdFocusAdd() { go('#/todo'); const i = $('#tdIn'); i.focus(); i.select(); }
$('#tdAdd').addEventListener('submit', e => {
  e.preventDefault();
  const i = $('#tdIn'); if (!todoAdd(i.value, tdS.drop)) return;
  i.value = ''; tdS.drop = {}; tdUndRender(); i.focus();
});
$('#tdIn').addEventListener('input', () => { if (!$('#tdIn').value.trim()) tdS.drop = {}; tdUndRender(); });
$('#tdUnd').addEventListener('click', e => { const b = e.target.closest('[data-tddrop]'); if (!b) return; tdS.drop[b.dataset.tddrop] = 1; tdUndRender(); $('#tdIn').focus(); });
// Typed on Today, a line with no day in it is for today: that is where it was written.
$('#tdCardAdd').addEventListener('submit', e => {
  e.preventDefault();
  const i = $('#tdCardIn'); if (!todoAdd(i.value, null, { d: tdToday() })) return;
  i.value = ''; i.focus();
});
function tdClick(e) {
  const hit = a => e.target.closest('[' + a + ']');
  let b;
  if ((b = hit('data-tdtick'))) {
    const id = b.dataset.tdtick;
    if (id.startsWith('auto:')) {
      const r = todoAuto().find(x => x.id === id); if (!r) return;
      const was = tdData().auto[r.key];
      tdAutoPut(r.key, { h: r.sig });
      toastDo('Hidden. It comes back if the work changes.', 'Undo', () => { const a = { ...tdData().auto }; if (was) a[r.key] = was; else delete a[r.key]; tdSave({ auto: a }); });
    } else todoTick(id);
    return;
  }
  if ((b = hit('data-tdopen'))) { if (!b.disabled) { b.disabled = true; reopenKept(b.dataset.tdopen).finally(() => { b.disabled = false; }); } return; }
  if ((b = hit('data-tdsel'))) {
    const id = b.dataset.tdsel, onCard = !!b.closest('#todoCard');
    tdS.sel = !onCard && tdS.sel === id ? '' : id;
    if (onCard) { tdS.filter = 'all'; go('#/todo'); } else tdPageRender();
    return;
  }
  if ((b = hit('data-tdview'))) { go('#/todo' + (b.dataset.tdview ? '/' + b.dataset.tdview : '')); return; }
  if ((b = hit('data-tdwk'))) { tdS.week = +b.dataset.tdwk ? tdS.week + +b.dataset.tdwk : 0; tdPageRender(); return; }
  if ((b = hit('data-tdf'))) { tdS.filter = b.dataset.tdf; tdPageRender(); return; }
  if ((b = hit('data-tdkind'))) { const d = tdData(), off = { ...d.off }, k = b.dataset.tdkind; if (off[k]) delete off[k]; else off[k] = 1; tdSave({ off, offT: Date.now() }); if (k === 'miss' && !off.miss) tdMissLoad(); return; }
  if (hit('data-tdclose')) { tdS.sel = ''; tdPageRender(); return; }
  const id = tdS.sel, auto = id.startsWith('auto:'), r = auto ? todoAuto().find(x => x.id === id) : null;
  if (!id || (auto && !r)) return;
  const setDay = d => auto ? tdAutoPut(r.key, { d }) : tdPut(id, { d, ...(d ? {} : { rep: '' }) });
  if ((b = hit('data-tdwhen'))) { const today = tdToday(), k = b.dataset.tdwhen; setDay(k === 'today' ? today : k === 'tomorrow' ? tdAdd(today, 1) : k === 'week' ? tdNextMon(today) : ''); return; }
  if (hit('data-tdhide')) { tdAutoPut(r.key, { h: r.sig }); return; }
  if (auto) return;
  if ((b = hit('data-tdrep'))) { const rep = b.dataset.tdrep, it = tdItem(id); tdPut(id, { rep, ...(rep && !it.d ? { d: tdToday() } : {}) }); return; }
  if (hit('data-tdfin')) { todoTick(id); return; }
  if (hit('data-tddel')) todoDelete(id);
}
$('#vTodo').addEventListener('click', tdClick);
$('#todoCard').addEventListener('click', tdClick);
// The week: a line typed into a day is for that day, and a line dragged to a day moves there.
$('#tdWeek').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target.closest('[data-tdwadd]'), i = f && f.querySelector('input'); if (!i || !i.value.trim()) return;
  const day = f.dataset.tdwadd, v = i.value; i.value = '';
  const it = todoAdd(v, null, day ? { d: day } : null);
  if (it && tdS.filter !== 'all' && tdS.filter !== 'mine' && !it.c) tdPut(it.id, { c: tdS.filter });   // typed while looking at one class: it is that class's
  const again = document.querySelector('#tdWeek [data-tdwadd="' + day + '"] input'); if (again) again.focus();
});
$('#tdWeek').addEventListener('dragstart', e => { const w = e.target.closest && e.target.closest('.tdw[draggable]'); if (!w) return; tdS.drag = w.dataset.td; try { e.dataTransfer.setData('text/plain', tdS.drag); e.dataTransfer.effectAllowed = 'move'; } catch {} });
$('#tdWeek').addEventListener('dragend', () => { tdS.drag = ''; for (const x of document.querySelectorAll('#tdWeek .tdday.over')) x.classList.remove('over'); });
$('#tdWeek').addEventListener('dragover', e => { const c = tdS.drag && e.target.closest('.tdday'); if (!c) return; e.preventDefault(); for (const x of document.querySelectorAll('#tdWeek .tdday.over')) if (x !== c) x.classList.remove('over'); c.classList.add('over'); });
$('#tdWeek').addEventListener('drop', e => {
  const c = tdS.drag && e.target.closest('.tdday'); if (!c) return;
  e.preventDefault();
  const id = tdS.drag, day = c.dataset.tdday; tdS.drag = '';
  todoMove(id, day);
});
function todoMove(id, day) {
  if (!id.startsWith('auto:')) { if (tdItem(id)) tdPut(id, { d: day, ...(day ? {} : { rep: '' }) }); return; }
  const r = todoAuto().find(x => x.id === id); if (!r) return;
  if (!day || day < tdToday()) { toast('A line the app added needs a day, today or later. Hide it if you don’t want it.', 6000); tdPageRender(); return; }
  tdAutoPut(r.key, { d: day });
}
$('#tdDoneBtn').onclick = () => { tdS.done = !tdS.done; tdPageRender(); };
$('#tdSide').addEventListener('change', e => {
  const id = tdS.sel, t = e.target; if (!id) return;
  if (t.id === 'tdDate') {
    if (id.startsWith('auto:')) { const r = todoAuto().find(x => x.id === id); if (r && t.value) tdAutoPut(r.key, { d: t.value }); }
    else tdPut(id, { d: t.value || '', ...(t.value ? {} : { rep: '' }) });
    return;
  }
  if (id.startsWith('auto:')) return;
  if (t.id === 'tdX') { const x = t.value.replace(/\s+/g, ' ').trim(); if (x) tdPut(id, { x }); else t.value = (tdItem(id) || {}).x || ''; }
  else if (t.id === 'tdNote') tdPut(id, { note: t.value.trim() });
  else if (t.id === 'tdCls') { const it = tdItem(id); tdPut(id, { c: t.value, who: '', a: '', ...(it.rep === 'meet' ? { rep: 'week' } : {}) }); }
  else if (t.id === 'tdWith') { const it = tdItem(id), c = classById(it.c), v = t.value; tdPut(id, { who: v.startsWith('s:') && c ? c.names[+v.slice(2)] || '' : '', a: v.startsWith('a:') ? v.slice(2) : '' }); }
});
$('#tdSide').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'tdX') { e.preventDefault(); e.target.blur(); } });
// N, anywhere outside a paper and outside a box being typed in, starts a new line.
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || batch || !shellReady) return;
  const t = e.target;
  if ((t.closest && t.closest('input, textarea, select, [contenteditable]')) || $('#findDlg') || $('#askDlg') || !$('#dlg').hidden || !$('#welcome').hidden) return;
  e.preventDefault(); tdFocusAdd();
});
Object.assign(window.__gs, { todoRead, todoAdd, todoRows, todoCount, todoTick, todoMove });
