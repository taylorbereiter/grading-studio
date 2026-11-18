// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// The library she is changing (inside students/write.js saveLibrary), the timetable for "each time this class meets", and the
// people on the School page, handed in by the page. Saving is the page's: tdSave changes lib.todo of the library handed in.
let lib = { classes: [], loose: { id: '', units: [] } }, plan = null, people = [];
export const todoUse = o => { if ('lib' in o) lib = o.lib; if ('plan' in o) plan = o.plan; if ('people' in o) people = o.people || []; };
const saveLib = () => {}, todoRender = () => {}, schPeople = () => people;


// src/app/library.js
const uid = () => Math.random().toString(36).slice(2, 10);
// src/app/library.js
const classById = id => lib.classes.find(c => c.id === id);
// src/book.js
const isoDay = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// src/todo.js
const TD_DAY = 864e5;
// src/todo.js
const tdData = () => { const t = lib.todo || {}; return { items: Array.isArray(t.items) ? t.items : [], off: t.off || {}, offT: t.offT || 0, auto: t.auto || {}, cats: Array.isArray(t.cats) ? t.cats : [], corder: t.corder && Array.isArray(t.corder.ids) ? t.corder : null }; };
// src/todo.js
function tdSave(part) {
  const d = { ...tdData(), ...part }, now = Date.now();
  // What nobody will look for again goes: a deletion after half a year, a finished line after four months, a moved or hidden app line after two.
  d.items = d.items.filter(it => it && it.id && !(it.gone && now - (it.t || 0) > 180 * TD_DAY) && !(it.done && now - it.done > 120 * TD_DAY));
  d.auto = Object.fromEntries(Object.entries(d.auto).filter(([, a]) => a && now - (a.t || 0) < 60 * TD_DAY));
  // a category of her own that she deleted is forgotten after half a year; one the app starts with stays deleted for good
  d.cats = d.cats.filter(c => c && c.id && !(c.gone && !TD_CAT0.some(b => b[0] === c.id) && now - (c.t || 0) > 180 * TD_DAY));
  if (!d.cats.length) delete d.cats;
  if (!d.corder) delete d.corder;
  lib.todo = d; saveLib(); todoRender();
}
// src/todo.js
const tdItems = () => tdData().items.filter(it => it && it.id && !it.gone);
// src/todo.js
const tdItem = id => tdItems().find(it => it.id === id) || null;
// src/todo.js
function tdPut(id, part) { const now = Date.now(); tdSave({ items: tdData().items.map(it => it.id === id ? { ...it, ...part, t: now } : it) }); }
// src/todo.js
function tdAutoPut(key, part) { const d = tdData(); tdSave({ auto: { ...d.auto, [key]: { ...(d.auto[key] || {}), ...part, t: Date.now() } } }); }
// src/todo.js
const TD_CAT0 = [['grade', 'Grading and feedback'], ['plan', 'Lesson planning'], ['admin', 'Administrative'], ['role', 'Leadership role']];
// src/todo.js
const TD_CATW = {
  grade: ['mark|marks|marked|marking|grade|grades|graded|grading|regrade|feedback|score|scores|scoring|assess|assessing|assessment|assessments|moderate|moderation|moderating|hand back|report comments|report card|report cards|conference|conferences|retake|retakes|gradebook|proofread', 'return|rubric|rubrics|quiz|quizzes|test|tests|exam|exams|essay|essays|papers|drafts|lab reports|comments'],
  plan: ['plan|plans|planning|lesson|lessons|slides|slide deck|handout|handouts|worksheet|worksheets|print|photocopy|copies|prep|curriculum|activity|activities|materials|resources|reading list|answer key|seating chart|lab setup', 'make|create|write|prepare|design|build|set up|assignment|assignments|project|projects'],
  admin: ['email|emails|meeting|meetings|form|forms|attendance|duty|duties|sign|submit|deadline|budget|order|permission|parent|parents|call|phone|admin|paperwork|register|trip|field trip|calendar|schedule|supplies|reimbursement|office|newsletter|report to', ''],
  role: ['coach|coaching|workshop|workshops|training|mentor|mentoring|committee|professional development|pd|demo|lead|leading', ''],
};
// src/todo.js
const TD_STOP = new Set(['role', 'work', 'other', 'things', 'stuff', 'tasks', 'with', 'from', 'misc', 'more', 'about', 'general']);
// src/todo.js
const tdRx = alts => new RegExp('(?<![\\p{L}\\p{N}])(?:' + alts + ')(?![\\p{L}\\p{N}])', 'iu');
// src/todo.js
const tdEsc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// src/todo.js
function tdCats() {
  const d = tdData(), by = new Map(d.cats.map(c => [c.id, c])), ids = d.corder ? d.corder.ids.filter(x => typeof x === 'string') : [];
  for (const [id] of TD_CAT0) if (!ids.includes(id)) ids.push(id);
  for (const c of d.cats) if (c && c.id && !ids.includes(c.id)) ids.push(c.id);
  return [...new Set(ids)].map(id => {
    const c = by.get(id), b = TD_CAT0.find(x => x[0] === id);
    if ((c && c.gone) || (!c && !b)) return null;
    return { id, name: (c && c.name) || (b ? b[1] : ''), own: !!(c && c.name), w: (c && c.w) || '', base: !!b };
  }).filter(Boolean);
}
// src/todo.js
const tdCat = id => tdCats().find(c => c.id === id) || null;
// src/todo.js
const tdOwnWords = c => [...String(c.w || '').split(/[,;\n]+/).map(x => x.trim()).filter(x => x.length >= 2), ...(c.own ? c.name.split(/[^\p{L}\p{N}]+/u).filter(x => x.length >= 4 && !TD_STOP.has(x.toLowerCase())) : [])];
// src/todo.js
function tdGuess(text, it) {
  const cats = tdCats(), t = String(text || '');
  const first = list => { let best = null; for (const [id, alts] of list) { if (!alts) continue; const m = tdRx(alts).exec(t); if (m && (!best || m.index < best.i || (m.index === best.i && m[0].length > best.n))) best = { id, i: m.index, n: m[0].length }; } return best ? best.id : ''; };
  const own = cats.map(c => [c.id, tdOwnWords(c).map(w => tdEsc(w) + '(?:s|es)?').join('|')]);
  let k = first(own); if (k) return k;
  const base = cats.filter(c => c.base && TD_CATW[c.id]);
  k = first(base.map(c => [c.id, TD_CATW[c.id][0]])); if (k) return k;
  if (it && it.a && cats.some(c => c.id === 'grade')) return 'grade';
  return first(base.map(c => [c.id, TD_CATW[c.id][1]]));
}
// src/todo.js
const TD_KIND_CAT = { mark: 'grade', back: 'grade', miss: 'grade', plan: 'plan' };
// src/todo.js
function tdCatOf(r) {
  const k = r.auto ? (tdData().auto[r.key] || {}).k : r.it && r.it.k;
  if (k === '-') return { id: '', chose: true };
  if (k && tdCat(k)) return { id: k, chose: true };
  if (r.auto) { const id = TD_KIND_CAT[r.kind]; return { id: id && tdCat(id) ? id : '', chose: false }; }
  return { id: tdGuess(r.it.x + ' ' + (r.it.note || ''), r.it), chose: false };
}
// src/todo.js
function tdCatSave(list, order) {
  const d = tdData(), now = Date.now(), by = new Map(d.cats.map(c => [c.id, c]));
  for (const c of list) by.set(c.id, { ...c, t: now });
  tdSave({ cats: [...by.values()], ...(order ? { corder: { ids: order, t: now } } : {}) });
}
// src/todo.js
function tdCatPut(id, part) {
  const had = tdData().cats.find(c => c.id === id) || { id }, next = { ...had, ...part };
  const b = TD_CAT0.find(x => x[0] === id);
  if (next.name != null && (!next.name || (b && next.name === b[1]))) delete next.name;   // the app's own name again: nothing to keep
  if (!next.w) delete next.w;
  tdCatSave([next]);
}
// src/todo.js
function todoCatAdd(name, w) {
  name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40); if (!name) return null;
  const same = tdCats().find(c => c.name.toLowerCase() === name.toLowerCase()); if (same) return same.id;
  const id = 'tc' + uid();
  tdCatSave([{ id, name, ...(w ? { w: String(w).slice(0, 300) } : {}) }], [...tdCats().map(c => c.id), id]);
  return id;
}
// src/todo.js
function todoCatMove(id, by) {
  const ids = tdCats().map(c => c.id), i = ids.indexOf(id), j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const now = Date.now(); tdSave({ corder: { ids, t: now } });
}
// src/todo.js
const tdToday = () => isoDay(Date.now());
// src/todo.js
const tdAt = day => new Date(day + 'T12:00:00');
// src/todo.js
const tdAdd = (day, n) => { const d = tdAt(day); d.setDate(d.getDate() + n); return isoDay(d); };
// src/todo.js
const tdGap = (day, from) => Math.round((tdAt(day) - tdAt(from)) / TD_DAY);
// src/todo.js
const tdNextMon = day => tdAdd(day, (8 - tdAt(day).getDay()) % 7 || 7);
// src/todo.js
const TD_DOW = { sunday: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2, wednesday: 3, wed: 3, thursday: 4, thurs: 4, thur: 4, thu: 4, friday: 5, fri: 5, saturday: 6 };
// src/todo.js
const TD_MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// src/todo.js
const TD_DAYS_RX = 'sunday|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday', TD_MON_RX = '(?:' + TD_MON.join('|') + ')[a-z]*\\.?';
// src/todo.js
const TD_TAIL = new RegExp('^(.*?)[\\s,]+(today|tonight|tomorrow|next week|(?:next\\s+)?(?:' + TD_DAYS_RX + ')|' + TD_MON_RX + '\\s+\\d{1,2}|\\d{1,2}\\s+' + TD_MON_RX + ')[.!]?$', 'i');
// src/todo.js
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
// src/todo.js
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
// src/todo.js
const tdKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// src/todo.js
function tdReadWho(text) {
  const low = text.toLowerCase();
  for (const c of lib.classes) for (const n of c.names) if (n.length > 3 && low.includes(n.toLowerCase())) return { c: c.id, who: n };
  const firsts = new Map();
  for (const c of lib.classes) for (const n of c.names) { const f = n.trim().split(/\s+/)[0]; if (f && f.length > 2) firsts.set(f, firsts.has(f) ? null : { c: c.id, who: n }); }
  for (const w of text.split(/[^\p{L}\p{M}'’-]+/u).slice(1)) { const hit = firsts.get(w.replace(/['’]s$/, '')); if (hit) return hit; }
  for (const c of [...lib.classes].sort((a, b) => b.name.length - a.name.length)) if (c.name.trim().length > 2 && low.includes(c.name.trim().toLowerCase())) return { c: c.id, who: '' };
  return { c: '', who: '' };
}
// src/todo.js
const tdPpl = () => typeof schPeople === 'function' ? schPeople() : [];
// src/todo.js
function tdReadPpl(text) {
  const ppl = tdPpl(); if (!ppl.length) return [];
  const low = ' ' + text.toLowerCase().replace(/[^\p{L}\p{N}'’.-]+/gu, ' ') + ' ', has = w => low.includes(' ' + w.toLowerCase() + ' ');
  const full = ppl.filter(p => p.name.length > 3 && has(p.name.replace(/[^\p{L}\p{N}'’.-]+/gu, ' ').trim()));
  if (full.length) return full.map(p => p.id);
  const words = new Set(text.split(/[^\p{L}\p{M}'’-]+/u).map(w => w.replace(/['’]s$/, '')));
  const last = new Map();
  for (const p of ppl) { const l = p.name.trim().split(/\s+/).pop().replace(/[.,]$/, ''); if (l.length > 2 && /^\p{Lu}/u.test(l)) last.set(l, last.has(l) ? null : p.id); }
  for (const [l, id] of last) if (id && words.has(l)) return [id];
  let rest = low;
  const roles = [...new Set(ppl.map(p => p.role).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const r of roles) {
    const k = ' ' + r.toLowerCase().replace(/[^\p{L}\p{N}'’.-]+/gu, ' ').trim() + ' '; if (k.length < 4 || !rest.includes(k)) continue;
    const who = ppl.filter(p => p.role === r); rest = rest.split(k).join(' ');
    if (who.length === 1) return [who[0].id];
  }
  return [];
}
// src/todo.js
function todoRead(text, today) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300), day = tdReadDay(raw, today || tdToday()), who = tdReadWho(raw);
  return { raw, x: day ? day.x : raw, d: day ? day.d : '', rep: day ? day.rep : '', c: who.c, who: who.who, ppl: tdReadPpl(raw) };
}
// src/todo.js
function todoAdd(text, drop, base) {
  drop = drop || {};
  const r = todoRead(text); if (!r.raw) return null;
  const now = Date.now(), it = { id: 'td' + uid(), x: drop.d ? r.raw : r.x, d: drop.d ? '' : r.d, c: drop.c ? '' : r.c, who: drop.c || drop.who ? '' : r.who, a: '', rep: drop.d ? '' : r.rep, note: '', done: 0, made: now, t: now };
  if (!drop.p && r.ppl.length) it.ppl = r.ppl;
  if (drop.k) it.k = '-';   // she said it is not the category the words suggest
  for (const [k, v] of Object.entries(base || {})) if (!it[k]) it[k] = v;
  tdSave({ items: [...tdData().items, it] });
  return it;
}
// src/todo.js
const tdPlanClass = c => (c && plan && plan.classes.find(p => tdKey(p.name) === tdKey(c.name))) || null;
// src/todo.js
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
// src/todo.js
function todoTick(id) {
  const it = tdItem(id); if (!it) return;
  const now = Date.now();
  if (it.done) return tdPut(id, { done: 0 });
  if (!it.rep) return tdPut(id, { done: now });
  // A repeating line moves on to its next day, and leaves a finished copy behind for today.
  const copy = { ...it, id: 'td' + uid(), rep: '', done: now, t: now };
  tdSave({ items: tdData().items.flatMap(x => x.id === id ? [{ ...x, d: tdNext(it), t: now }, copy] : [x]) });
}
// src/todo.js
const tdDoneToday = (r, today) => !!r.done && isoDay(r.done) === today;
// src/todo.js
const tdSort = (a, b) => (a.d || '9').localeCompare(b.d || '9') || (a.auto ? 1 : 0) - (b.auto ? 1 : 0) || ((a.it && a.it.made) || 0) - ((b.it && b.it.made) || 0);
// src/todo.js
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
export { TD_CAT0, TD_DAY, tdData, tdSave, tdItems, tdItem, tdPut, tdAutoPut, tdCats, tdCat, tdGuess, tdCatOf, tdCatSave, tdCatPut, todoCatAdd, todoCatMove, tdToday, tdAt, tdAdd, tdGap, tdNextMon, tdWordDay, tdReadDay, tdKey, tdReadWho, tdReadPpl, todoRead, todoAdd, tdNext, todoTick, tdGroups, tdSort, tdDoneToday };
