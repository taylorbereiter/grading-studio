/* ---------------- rubric library: what each score means on each row, and saved rubrics to reuse ---------------- */
// setup.levels[row][score] is her words for a whole score, 0 to the row's top (rowLevels, start.js). Old setups don't have it and look as they always did.
// gs.rubrics: [{ id, name, criteria, levels, scale, at }]. It's under gs.*, so the take-home file, the folder and safety copies carry it. A rubric file she brought in isn't part of a saved rubric.
const levelsOpen = new Set(), levelEditOpen = new Set();
const levelIn = (d, i, v) => { const r = d.levels && d.levels[i]; return (r && r[v]) || ''; };
const levelOf = (i, v) => levelIn(setup, i, v);
const rowHasLevels = i => rowLevels(setup, i).some(v => levelOf(i, v));
// A half point sits between two levels, so it shows both.
function levelPick(i, v) {
  if (v == null) return '';
  const say = (v % 1 ? [Math.ceil(v), Math.floor(v)] : [v]).filter(w => levelOf(i, w)).map(w => '<b>' + w + '</b> ' + esc(levelOf(i, w)));
  return say.length > 1 ? say.map(t => '<span class="lvh">' + t + '</span>').join(' ') : say.join('');   // two levels get a line each, so a long one can't hide the other
}
const levelHint = (i, v) => levelPick(i, v) || '<span class="muted">' + (v == null ? 'Point at a score to see what it means.' : 'Nothing written for ' + fmtNum(v) + '.') + '</span>';
// Under a row's score buttons: two quiet lines for the score she picked or is pointing at. All opens the whole row, and it stays open from student to student.
function levelsHtml(i, v) {
  if (!rowHasLevels(i)) return '';
  if (levelsOpen.has(i)) {
    const on = v == null ? [] : [Math.ceil(v), Math.floor(v)];
    return '<div class="lvrow"><ul class="lvall">' + rowLevels(setup, i).filter(w => levelOf(i, w)).map(w => '<li' + (on.includes(w) ? ' class="on"' : '') + '><b>' + w + '</b><span>' + esc(levelOf(i, w)) + '</span></li>').join('') + '</ul><button class="link lvbtn" data-lvopen="' + i + '" aria-expanded="true">Less</button></div>';
  }
  return '<div class="lvrow" data-lvline="' + i + '"><div class="lvtxt" aria-live="polite">' + levelHint(i, v) + '</div><button class="link lvbtn" data-lvopen="' + i + '" aria-expanded="false" aria-label="See what every score means on this row">All</button></div>';
}
function levelPreview(e, leaving) {
  const b = e.target.closest('.scores button'); if (!b) return;
  const i = +b.closest('.scores').dataset.c;
  if (!batch || !rowHasLevels(i) || levelsOpen.has(i)) return;
  if (leaving) lvDraw(); else { const box = $('#lvBox'); if (box) box.innerHTML = lvInner(i, +b.dataset.v); }
}
// Under the rows, in one place so the rows never move: what the score means on the row in hand, or on the one under the pointer.
let lvAt = 0;
function lvInner(i, v) {
  if (!(i >= 0) || i >= setup.criteria.length) i = setup.criteria.findIndex((_, k) => rowHasLevels(k));
  return '<div class="lvname">' + esc(setup.criteria[i]) + '</div>' + (rowHasLevels(i) ? levelsHtml(i, v === undefined ? batch.students[cur].grade.rubric[i] : v) : '<div class="lvrow"><div class="lvtxt"><span class="muted">Nothing written for this row yet. Edit rubric adds it.</span></div></div>');
}
const lvBox = () => setup.criteria.some((_, i) => rowHasLevels(i)) ? '<div id="lvBox">' + lvInner(rowOn >= 0 ? rowOn : lvAt) + '</div>' : '';
function lvDraw(i, v) { const box = $('#lvBox'); if (!box || !batch) return; if (i == null) i = rowOn >= 0 ? rowOn : lvAt; else if (v === undefined) lvAt = i; box.innerHTML = lvInner(i, v); }
$('#grade').addEventListener('mouseover', e => levelPreview(e));
$('#grade').addEventListener('focusin', e => levelPreview(e));
$('#grade').addEventListener('mouseout', e => levelPreview(e, true));
$('#grade').addEventListener('focusout', e => levelPreview(e, true));
$('#grade').addEventListener('click', e => {
  const b = e.target.closest('[data-lvopen]'); if (!b) return;
  const i = +b.dataset.lvopen;
  if (!levelsOpen.delete(i)) levelsOpen.add(i);
  renderGrade();
  const again = $('#grade [data-lvopen="' + i + '"]'); if (again) again.focus({ preventScroll: true });
});

/* In Rubric setup. */
let rubDlg = null;   // the setup being edited: { draft, re, was, pageNew, from, n0, told }
// The setup as Save would keep it, to tell if anything changed. The name of a rubric she saved for later isn't a change to this setup.
const setupSnap = d => JSON.stringify({ ...d, levels: tidyLevels(d), goals: goalsTidy(d), rubricName: undefined });
// from: where each row in the draft came from, by its place when the dialog opened (null for a new row). told: the scoring mode she's already been asked about.
function rubricsSetup(draft, re, pageNew) {
  rubDlg = { draft, re, was: setupSnap(draft), pageNew, from: draft.criteria.map((_, i) => i), n0: draft.criteria.length, told: null, bankKey: null, goalAll: (batch && batch.goal) || '' };
  const me = rubDlg; bankJob(() => bankRead(true).catch(() => { gBank = { rubrics: savedRubrics(), scales: [], gone: {}, units: [] }; }).then(() => { if (rubDlg === me) bankRedraw(); }));
}
// Esc or a click outside. All that writing only lives in the dialog until Save, so Rubric setup asks first. Its Cancel button is already a clear choice.
async function leaveDlg() {
  if ($('#setupBody') && (rubDlg.pageNew() || setupSnap(rubDlg.draft) !== rubDlg.was || rubDlg.goalAll !== ((batch && batch.goal) || '')) && !await askDlg('Leave Rubric setup without saving? The changes you made here won’t be kept.', { ok: 'Leave', cancel: 'Keep editing', danger: true })) return;
  closeDlg();
}
function levelsEditHtml(d, i) {
  const lv = rowLevels(d, i), n = lv.filter(v => levelIn(d, i, v).trim()).length;
  return '<details class="lved" data-lvrow="' + i + '"' + (levelEditOpen.has(i) ? ' open' : '') + '><summary>What each score means' + (n ? ' (' + n + ' of ' + lv.length + ' written)' : '') + '</summary>' +
    lv.map(v => '<label class="lvin"><b>' + v + '</b><textarea rows="2" data-lvi="' + i + '" data-lvv="' + v + '" aria-label="What ' + v + ' means on this row">' + esc(levelIn(d, i, v)) + '</textarea></label>').join('') +
    '<span class="muted lvnote">Leave any of these blank.' + (rowHalf(d) ? ' A half point shows the two scores around it.' : '') + '</span></details>';
}
function levelsRowGone(d, i) { if (d.levels) d.levels.splice(i, 1); if (Array.isArray(d.tops)) d.tops.splice(i, 1); goalsRowGone(d, i); rubDlg.from.splice(i, 1); levelEditOpen.clear(); }
// Only what she wrote is kept, and nothing at all if she wrote nothing, so an old setup stays as it was.
function tidyLevels(d) {
  const out = d.criteria.map((_, i) => { const r = {}; for (const v of rowLevels(d, i)) { const t = levelIn(d, i, v).trim(); if (t) r[v] = t; } return r; });
  return out.some(r => Object.keys(r).length) ? out : undefined;
}
const savedRubrics = () => { const a = store.get('gs.rubrics', []); return Array.isArray(a) ? a.filter(r => r && r.id && r.name && Array.isArray(r.criteria) && r.criteria.length) : []; };

/* The bank: saved rubrics and grading scales, sorted by unit. It's the Planner's (kv 'bank' in the 'gs-lessons'
   database: { rubrics, scales, gone }), so the Planner and Claude's Planner folder can see it, and it holds only a
   rubric's wording and a scale's percents: never a score, a name or anything about a student. Grading opens that one
   record and the Planner's unit list, and nothing of grading's ever goes the other way. gs.rubrics stays as it was,
   so older copies and the take-home file still carry saved rubrics; any it has that the bank doesn't come in. */
// How many bank reads and saves are still going, with their redraws. Tests wait for 0 before clicking in the bank.
let bankBusyN = 0;
const bankJob = async f => { bankBusyN++; try { return await f(); } finally { bankBusyN--; } };
let gBank = null;   // { rubrics, scales, gone, units } while Rubric setup is open
let bankChan = null; try { bankChan = new BroadcastChannel('gs-bank'); } catch {}
const tidyBank = b => ({ rubrics: Array.isArray(b && b.rubrics) ? b.rubrics : [], scales: Array.isArray(b && b.scales) ? b.scales : [], gone: (b && b.gone && typeof b.gone === 'object') ? b.gone : {} });
// make: create the Planner's database if this browser hasn't got one yet (same shape the Planner makes). Otherwise a missing one stays missing.
function planDb(make) {
  return new Promise(res => {
    let r; try { r = indexedDB.open('gs-lessons'); } catch { return res(null); }
    r.onupgradeneeded = () => {
      if (!make) { try { r.transaction.abort(); } catch {} return; }
      r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv');
    };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => db.close(); res(db.objectStoreNames.contains('kv') ? db : (db.close(), null)); };
    r.onerror = r.onblocked = () => res(null);
  });
}
const idbP = q => new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
async function bankRead(takeIn) {
  const db = await planDb(false); let b = null, units = [];
  if (db) {
    try { const t = db.transaction('kv'), kv = t.objectStore('kv'); [b, units] = await Promise.all([idbP(kv.get('bank')), idbP(kv.get('units'))]); } catch {}
    db.close();
  }
  b = tidyBank(b);
  gBank = { ...b, units: (Array.isArray(units) ? units : []).filter(u => u && u.id).map(u => ({ id: String(u.id), course: String(u.course || ''), title: String(u.title || 'Unit'), start: String(u.start || ''), weeks: Array.isArray(u.weeks) ? u.weeks.length : 1 })) };
  const fresh = savedRubrics().filter(r => !b.rubrics.some(x => x.id === r.id) && !(b.gone[r.id] >= (r.at || 0)));
  if (takeIn && fresh.length) try { await bankWrite(x => { for (const r of fresh) x.rubrics.push(r); }); } catch {}
  return gBank;
}
async function bankWrite(fn) {
  const db = await planDb(true); if (!db) throw new Error('no bank');
  let out;
  try {
    await new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite'), kv = t.objectStore('kv');
      idbP(kv.get('bank')).then(b => { out = tidyBank(b); fn(out); out.rubrics.sort((x, y) => natural(x.name, y.name)); out.scales.sort((x, y) => natural(x.name, y.name)); kv.put(out, 'bank'); });
      t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error);
    });
  } finally { db.close(); }
  gBank = { ...out, units: gBank ? gBank.units : [] };
  try { bankChan && bankChan.postMessage('changed'); } catch {}
  return gBank;
}
setTimeout(() => bankRead().catch(() => {}), 0);   // ready before Rubric setup first opens
// Each bank part carries a fingerprint of what it drew, so a redraw happens only when something in it changed.
const bankStamp = (h, id) => h.replace('id="' + id + '"', 'id="' + id + '" data-h="' + hash(h) + '"');
// Only the bank's own parts are redrawn when it changes, so a box she's typing in keeps her place.
function bankRedraw() {
  if (!rubDlg || !$('#setupBody')) return;
  const d = rubDlg.draft, a = $('#rbBank'), b = $('#rbScales');
  const nb = rubricLibHtml(d), ns = scaleBankHtml(d, draftMax(d));
  if (a && a.dataset.h !== /data-h="([^"]*)"/.exec(nb)[1]) a.outerHTML = nb;
  if (b && b.dataset.h !== /data-h="([^"]*)"/.exec(ns)[1]) b.outerHTML = ns;
}
if (bankChan) bankChan.onmessage = () => { if (rubDlg && $('#setupBody')) bankRead().then(bankRedraw); };
// What the bank shows: the bank's own, plus any saved rubric here it hasn't taken in yet (another tab, the take-home file).
function bankRubrics() {
  const ok = r => r && r.id && r.name && Array.isArray(r.criteria) && r.criteria.length;
  const own = ((gBank && gBank.rubrics) || []).filter(ok), gone = { ...store.get('gs.rubricsGone', {}), ...((gBank && gBank.gone) || {}) };
  const more = savedRubrics().filter(r => !own.some(x => x.id === r.id) && !(gone[r.id] >= (r.at || 0)));
  return more.length ? own.concat(more).sort((a, b) => natural(a.name, b.name)) : own;
}
const bankScales = () => ((gBank && gBank.scales) || []).filter(s => s && s.id && s.name && s.scale && typeof s.scale === 'object');
const scaleTop = s => s ? Math.max(...Object.keys(s).map(Number)) : 0;

/* Units: the Planner's, or grading's own class units when the Planner has none. A rubric names its unit as { id, course, title }. */
function bankUnits() {
  if (gBank && gBank.units.length) return gBank.units;
  const out = [];
  for (const c of (lib && lib.classes) || []) for (const u of c.units) out.push({ id: 'g:' + u.id, course: c.name, title: u.name });
  return out;
}
const slug = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const refUnit = ref => { if (!ref) return null; const us = bankUnits(); return us.find(u => u.id === ref.id) || us.find(u => u.course === ref.course && slug(u.title) === slug(ref.title)) || null; };
const unitKeyOf = ref => { if (!ref || !(ref.id || ref.title)) return ''; const u = refUnit(ref); return u ? u.id : 'ref:' + (ref.course || '') + '|' + (ref.title || ''); };
const unitKeyLabel = k => { if (!k) return 'Not in a unit'; const u = bankUnits().find(x => x.id === k); if (u) return (u.course ? u.course + ' · ' : '') + u.title; const [c, ...t] = k.slice(4).split('|'); return (c ? c + ' · ' : '') + t.join('|'); };
function keyRef(k, was) {
  if (!k) return null;
  const u = bankUnits().find(x => x.id === k); if (u) return { id: u.id, course: u.course, title: u.title };
  return was && unitKeyOf(was) === k ? { id: was.id || '', course: was.course || '', title: was.title || '' } : null;
}
// The unit this assignment is most likely in: its class's Planner unit running today, or one named like its grading unit, or the last one used.
function defaultUnitKey() {
  const us = bankUnits(), f = batch && batch.assignment ? findItem(batch.assignment.id) : null;
  if (f) {
    const cls = slug(f.c && f.c.name).replace(/\d+$/, ''), inCourse = u => cls && slug(u.course) && (cls.startsWith(slug(u.course)) || slug(u.course).startsWith(cls));
    const named = us.filter(u => slug(u.title) === slug(f.u.name) || slug(u.title).startsWith(slug(f.u.name)));
    const pick = named.find(inCourse) || (named.length === 1 ? named[0] : null);
    if (pick) return pick.id;
    const today = new Date(), now = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const running = us.filter(u => u.start && inCourse(u) && u.start <= now && new Date(u.start + 'T00:00').getTime() + (u.weeks || 1) * 7 * 864e5 > today.getTime());
    if (running.length === 1) return running[0].id;
  }
  const last = lsRaw('gsc.bankUnit');
  return last && us.some(u => u.id === last) ? last : '';
}
function unitOptionsHtml(sel, withAll) {
  const us = bankUnits(), by = new Map();
  for (const u of us) { if (!by.has(u.course)) by.set(u.course, []); by.get(u.course).push(u); }
  let h = withAll ? '<option value="*"' + (sel === '*' ? ' selected' : '') + '>Every unit</option>' : '';
  h += '<option value=""' + (sel === '' ? ' selected' : '') + '>Not in a unit</option>';
  for (const [c, list] of by) h += '<optgroup label="' + esc(c || 'Units') + '">' + list.slice().sort((a, b) => (a.start || '').localeCompare(b.start || '') || natural(a.title, b.title)).map(u => '<option value="' + esc(u.id) + '"' + (u.id === sel ? ' selected' : '') + '>' + esc(u.title) + '</option>').join('') + '</optgroup>';
  const extra = new Set([...bankRubrics(), ...bankScales()].map(r => unitKeyOf(r.unit)).filter(k => k.startsWith('ref:')));
  if (sel && sel.startsWith('ref:')) extra.add(sel);
  for (const k of extra) h += '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(unitKeyLabel(k)) + '</option>';
  return h;
}

function rubricLibHtml(d) { return bankStamp(rubricLibRaw(d), 'rbBank'); }
function rubricLibRaw(d) {
  const list = bankRubrics();
  if (!list.length && d.mode !== 'rubric') return '<div id="rbBank" hidden></div>';
  const mine = rubDlg && rubDlg.draft === d;   // the first drawing comes before Rubric setup has said what it's editing
  if (mine && rubDlg.bankKey == null && gBank) { const k = defaultUnitKey(); rubDlg.bankKey = k && list.some(r => unitKeyOf(r.unit) === k) ? k : '*'; }
  const key = !mine || rubDlg.bankKey == null ? '*' : rubDlg.bankKey, shown = key === '*' ? list : list.filter(r => unitKeyOf(r.unit) === key);
  const about = r => r.criteria.length + (r.criteria.length === 1 ? ' row' : ' rows') + (r.levels ? ', with what each score means' : '');
  const row = r => '<div class="rl"><span class="rln"><b>' + esc(r.name) + '</b><span class="muted">' + about(r) + '</span></span><button class="btn sm" data-rbuse="' + esc(r.id) + '">Use</button><button class="btn sm" data-rbdel="' + esc(r.id) + '" aria-label="Delete ' + esc(r.name) + '">×</button></div>';
  let rows = '';
  if (key === '*') {
    const groups = new Map(); for (const r of list) { const k = unitKeyOf(r.unit); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    rows = [...groups.keys()].sort((a, b) => !a ? 1 : !b ? -1 : natural(unitKeyLabel(a), unitKeyLabel(b))).map(k => '<div class="rlg">' + esc(unitKeyLabel(k)) + '</div>' + groups.get(k).map(row).join('')).join('');
  } else rows = shown.map(row).join('');
  return '<div class="field" id="rbBank"><label for="rbUnit">Rubric bank</label>' +
    (list.length ? '<select id="rbUnit" class="rbunit" aria-label="Show rubrics from">' + unitOptionsHtml(key, true) + '</select>' : '') +
    (shown.length ? '<div class="rlib">' + rows + '</div>' : list.length ? '<span class="muted" style="font-size:13px">Nothing saved for this unit yet.</span>'
      : '<span class="muted" style="font-size:13px">Save this rubric to the bank to use it again. It keeps the rows, what each score means and the grading scale, sorted by unit. Rubrics in the Planner’s sidebar shows the same bank.</span>') +
    (d.mode === 'rubric' ? '<div style="margin-top:4px"><button class="btn sm" data-rbsave>Save to the bank…</button></div>' : '') + '</div>';
}
// Under the grading-scale buttons: saved scales with the same top score, and a way to save this one.
function scaleBankHtml(d, max) { return bankStamp(scaleBankRaw(d, max), 'rbScales'); }
function scaleBankRaw(d, max) {
  if (!gBank) return '<span class="rbscales" id="rbScales"></span>';
  const fit = bankScales().filter(s => scaleTop(s.scale) === max), other = bankScales().length - fit.length;
  return '<span class="rbscales" id="rbScales">' + (fit.length ? '<select class="btn sm" data-scuse aria-label="Use a saved grading scale"><option value="">My saved scales…</option>' + fit.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + (s.unit ? ' (' + esc(unitKeyLabel(unitKeyOf(s.unit))) + ')' : '') + '</option>').join('') + '</select>' : '') +
    (d.scale && max <= 40 ? '<button class="btn sm" data-scsave>Save this scale…</button>' : '') +
    (!fit.length && other ? '<span class="muted" style="font-size:12.5px">' + (other === 1 ? '1 saved scale is' : other + ' saved scales are') + ' for a different total</span>' : '') + '</span>';
}
// A name and a unit, on the layer over Rubric setup. Resolves { name, key } or null.
function askSaveDlg(title, name, key) {
  const run = () => new Promise(done => {
    const back = document.activeElement, el = document.createElement('div');
    el.className = 'dlg askdlg'; el.id = 'askDlg';
    el.innerHTML = '<div class="box narrow" role="dialog" aria-modal="true" aria-labelledby="askText" tabindex="-1"><div class="bb"><p id="askText"></p>' +
      '<label class="rbask">Name<input type="text" id="askIn" autocomplete="off"></label><label class="rbask">Unit<select id="askUnit">' + unitOptionsHtml(key, false) + '</select></label>' +
      '<span class="muted" style="font-size:12.5px">Units come from the Planner. Only the wording and the scale are saved: never scores or anything about a student.</span></div>' +
      '<div class="bf"><button class="btn" data-no>Cancel</button><button class="btn primary" data-ok>Save to the bank</button></div></div>';
    const box = el.firstChild, inp = el.querySelector('#askIn');
    el.querySelector('#askText').textContent = title; inp.value = name;
    const finish = yes => { document.removeEventListener('keydown', keys, true); const out = yes ? { name: inp.value.trim(), key: el.querySelector('#askUnit').value } : null; el.remove(); if (back && back.isConnected) back.focus({ preventScroll: true }); done(out); };
    const keys = e => { e.stopPropagation(); if (e.key === 'Tab') trapTab(e, box); else if (e.key === 'Escape') { e.preventDefault(); finish(false); } else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); finish(true); } };
    el.querySelector('[data-ok]').onclick = () => finish(true); el.querySelector('[data-no]').onclick = () => finish(false);
    el.addEventListener('pointerdown', e => { if (e.target === el) finish(false); });
    document.addEventListener('keydown', keys, true); document.body.appendChild(el); inp.focus(); inp.select();
  });
  const p = askQ.then(run); askQ = p; return p;
}
// What using a saved rubric would do to scores already given. Scores belong to a row by its place, and nothing is ever deleted.
function rubricUseNote(r, d) {
  if (!batch) return '';
  const S = batch.students, rows = st => st.grade.rubric || [], out = [];
  if (d.mode !== 'rubric') {
    const n = S.filter(st => st.grade.points !== '' && st.grade.points != null).length;
    if (n) out.push((n === 1 ? '1 student has a total' : n + ' students have totals') + ' typed in. Those stay saved, but won’t count while this assignment uses rubric rows.');
  } else {
    const gone = S.filter(st => rows(st).slice(r.criteria.length).some(v => v != null)).length, any = S.some(st => rows(st).some(v => v != null));
    if (gone) out.push((gone === 1 ? '1 student has a score' : gone + ' students have scores') + ' on rows this rubric doesn’t have. Those stay saved, but won’t count.');
    else if (any && r.criteria.some((c, i) => c !== d.criteria[i])) out.push('Scores you already gave stay in the same place: a first-row score stays in the first row, under its new name.');
    if (any && r.criteria.length > d.criteria.length) out.push('Students with every row scored will show as partial until the new rows are scored.');
  }
  if (S.some(st => rows(st).some(v => v != null) || st.grade.points) && JSON.stringify(r.scale || null) !== JSON.stringify(d.scale || null)) out.push('Percents will follow the grading scale saved with this rubric.');
  return out.join('\n\n');
}
// The rows she's taking out of this setup, by their place when it opened.
const rowsGone = () => [...Array(rubDlg.n0).keys()].filter(i => !rubDlg.from.includes(i));
// What a new rubric file, or taking it off, does to copies she's already worked on. A Word copy stays hers under a new Word rubric, and a marked page stays under a new page. page: { name } of the new file, or null.
function rubricCopiesNote(S, page) {
  const word = !!page && WORD_RX.test(page.name), kept = [], lost = [];
  for (const st of S) for (const f of st.files) {
    if (!f.virtual) continue;
    if (f.kind === 'docx' ? f.edited : page === null || word ? fileMarked(f) : false) (word && f.kind === 'docx' ? kept : lost).push(st);
  }
  const out = [], n = kept.length, m = lost.length;
  if (n) out.push((n === 1 ? '1 student already has' : n + ' students already have') + ' highlights or typing on their copy of your rubric. ' + (n === 1 ? 'That copy stays as it is, so it won’t show the new version' : 'Those copies stay as they are, so they won’t show the new version') + '. Everyone else gets the new one. To start a student over on the new one, press Edit on their copy, then Back to the original.');
  if (m) out.push((m === 1 ? '1 student has' : m + ' students have') + ' marks on their copy of your rubric. ' + (m === 1 ? 'That copy goes' : 'Those copies go') + ', along with what’s on ' + (m === 1 ? 'it' : 'them') + '. Scores stay as they are.');
  return out.join('\n\n');
}
// What Save would do to scores already given, for her to say yes to. Empty when nothing is at stake. page: the new rubric file, null if it's coming off, undefined if neither.
function setupSaveNote(d, page) {
  if (!batch) return '';
  const S = batch.students, gone = rowsGone(), out = [], has = v => v !== '' && v != null;
  const nGone = S.filter(st => gone.some(i => st.grade.rubric[i] != null)).length;
  if (nGone) out.push((nGone === 1 ? '1 student has a score' : nGone + ' students have scores') + ' on ' + (gone.length === 1 ? 'the row' : 'the rows') + ' you took out. ' + (nGone === 1 ? 'That score goes' : 'Those scores go') + ' with ' + (gone.length === 1 ? 'the row' : 'the rows') + ', and ' + (nGone === 1 ? 'that total changes' : 'those totals change') + '. Every other score stays on its own row.');
  if (d.mode === 'rubric') {   // the rows' scale changed under scores already given
    const off = S.filter(st => d.criteria.some((_, i) => { const from = rubDlg.from[i], v = from == null ? null : st.grade.rubric[from]; return v != null && !rowSteps(d, i).includes(v); })).length;
    if (off) out.push((off === 1 ? '1 student has a score' : off + ' students have scores') + ' that this scale doesn’t have: above a row’s top, or a half point. ' + (off === 1 ? 'It stays' : 'They stay') + ' as given, and still count, until you change ' + (off === 1 ? 'it' : 'them') + '.');
  }
  if (d.mode !== setup.mode && d.mode !== rubDlg.told) {
    if (d.mode === 'points') {
      const n = S.filter(st => st.grade.rubric.some(v => v != null)).length;
      if (n) out.push((n === 1 ? '1 student has rubric row scores' : n + ' students have rubric row scores') + '. Those stay saved, but won’t count while this assignment uses just a total. Switch back to rows and they count again.');
    } else {
      const n = S.filter(st => has(st.grade.points)).length;
      if (n) out.push((n === 1 ? '1 student has a total' : n + ' students have totals') + ' typed in. Those stay saved, but won’t count while this assignment uses rubric rows. Switch back to just the total and they count again.');
    }
  }
  if (page !== undefined) { const c = rubricCopiesNote(S, page); if (c) out.push(c); }
  return out.join('\n\n');
}
// A score belongs to a row by its place, so when a row goes, the scores after it move up with their rows. Each row keeps its own time.
function rowsTakenOut() {
  const gone = rowsGone(); if (!gone.length || !batch) return;
  const low = gone[0], left = k => k - gone.filter(i => i < k).length;
  for (const st of batch.students) {
    const g = st.grade, keys = Object.keys(g.atR || {}).filter(k => k !== 'points').map(Number);
    if (g.rubric.length <= low && !keys.some(k => k >= low)) continue;
    g.rubric = Array.from(g.rubric, v => v == null ? null : v).filter((_, k) => !gone.includes(k));   // a row never clicked this session is a gap in the list, and filter would skip it and close it up
    if (g.atR) g.atR = Object.fromEntries(keys.filter(k => !gone.includes(k)).map(k => [left(k), g.atR[k]]).concat(g.atR.points ? [['points', g.atR.points]] : []));   // a points score's time isn't a row's
    touchGrade(st);
  }
  levelsOpen.clear();
}
async function rubricUse(r) {
  const { draft: d, re } = rubDlg, note = rubricUseNote(r, d);
  if (note && !await askDlg('Use “' + r.name + '”?\n\n' + note, { ok: 'Use it', cancel: 'Keep what I have' })) return;
  for (const k of ['top', 'tops', 'half']) delete d[k];   // the saved rubric's own row scale, or 0 to 4 with halves when it says none
  Object.assign(d, rowScaleOf(r), { mode: 'rubric', criteria: r.criteria.slice(), levels: r.levels ? JSON.parse(JSON.stringify(r.levels)) : undefined, goals: Array.isArray(r.goals) ? r.goals.slice() : undefined, scale: r.scale ? { ...r.scale } : null, rubricName: r.name });
  Object.assign(rubDlg, { from: r.criteria.map((_, i) => i), n0: r.criteria.length, told: 'rubric' });   // a saved rubric's rows go by place, and this has just said so
  levelEditOpen.clear(); re();
  toast('“' + r.name + '” is filled in. Press Save to keep it.');
}
function rubricSave() { return bankJob(() => rubricSaveNow()); }
async function rubricSaveNow() {
  const { draft: d, re } = rubDlg;
  const got = await askSaveDlg('Save this rubric to the bank', d.rubricName || (batch && batch.assignment && batch.assignment.name) || '', rubDlg.bankKey && rubDlg.bankKey !== '*' ? rubDlg.bankKey : defaultUnitKey());
  if (!got || !got.name) return;
  const name = got.name, list = bankRubrics(), old = list.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (old && !await askDlg('You already have a rubric called “' + old.name + '”. Replace it with this one?', { ok: 'Replace it', cancel: 'Keep the old one', danger: true })) return;
  const r = { id: old ? old.id : uid(), name, criteria: d.criteria.map((c, i) => c.trim() || 'Criterion ' + (i + 1)), levels: tidyLevels(d), scale: d.scale ? { ...d.scale } : null, ...rowScaleOf(d), at: Date.now() };
  const tags = goalsTidy(d); if (tags) r.goals = tags;   // a saved rubric keeps its rows' learning goals
  const unit = keyRef(got.key, old && old.unit); if (unit) r.unit = unit;
  const legacy = savedRubrics().filter(x => x.id !== r.id && x.name.toLowerCase() !== name.toLowerCase()); legacy.push(r); legacy.sort((a, b) => natural(a.name, b.name));
  store.set('gs.rubrics', legacy);   // so the take-home file still carries it, and so it's listed right away
  d.rubricName = name; rubDlg.bankKey = got.key || '*'; re();
  try { await bankWrite(b => { b.rubrics = b.rubrics.filter(x => x.id !== r.id && x.name.toLowerCase() !== name.toLowerCase()); b.rubrics.push(r); delete b.gone[r.id]; }); }
  catch { return sayDlg('That rubric couldn’t be saved to the bank. The browser may be out of room.'); }
  try { localStorage.setItem('gsc.bankUnit', got.key); } catch {}
  bankRedraw();
  toast('Saved “' + name + '” to ' + unitKeyLabel(got.key));
}
function rubricDelete(r) { return bankJob(() => rubricDeleteNow(r)); }
async function rubricDeleteNow(r) {
  if (!await askDlg('Delete “' + r.name + '” from your bank?\n\nAssignments already using it keep their rows and what each score means.', { ok: 'Delete', cancel: 'Keep it', danger: true })) return;
  try { await bankWrite(b => { b.rubrics = b.rubrics.filter(x => x.id !== r.id); b.gone[r.id] = Date.now(); }); } catch {}
  store.set('gs.rubricsGone', { ...store.get('gs.rubricsGone', {}), [r.id]: Date.now() });   // so an older copy of her work doesn't bring it back
  store.set('gs.rubrics', savedRubrics().filter(x => x.id !== r.id));
  rubDlg.re();
}
function scaleSave() { return bankJob(() => scaleSaveNow()); }
async function scaleSaveNow() {
  const { draft: d, re } = rubDlg, max = draftMax(d);
  const got = await askSaveDlg('Save this grading scale to the bank (top score ' + max + ')', 'Out of ' + max, rubDlg.bankKey && rubDlg.bankKey !== '*' ? rubDlg.bankKey : defaultUnitKey());
  if (!got || !got.name) return;
  const old = bankScales().find(s => s.name.toLowerCase() === got.name.toLowerCase());
  if (old && !await askDlg('You already have a scale called “' + old.name + '”. Replace it with this one?', { ok: 'Replace it', cancel: 'Keep the old one', danger: true })) return;
  const scale = {}; for (let k = max; k >= 0; k--) if (d.scale[k] != null && d.scale[k] !== '' && isFinite(+d.scale[k])) scale[k] = +d.scale[k];
  if (scale[max] == null) scale[max] = 100;   // so its top score is always known
  const s = { id: old ? old.id : uid(), name: got.name, scale, at: Date.now() }, unit = keyRef(got.key, old && old.unit); if (unit) s.unit = unit;
  try { await bankWrite(b => { b.scales = b.scales.filter(x => x.id !== s.id); b.scales.push(s); delete b.gone[s.id]; }); }
  catch { return sayDlg('That scale couldn’t be saved to the bank. The browser may be out of room.'); }
  re(); toast('Saved “' + s.name + '”');
}
$('#dlgBox').addEventListener('input', e => {
  const t = e.target; if (t.dataset.lvi == null || !rubDlg) return;
  const d = rubDlg.draft, i = +t.dataset.lvi;
  d.levels ||= [];
  (d.levels[i] ||= {})[t.dataset.lvv] = t.value;
});
$('#dlgBox').addEventListener('toggle', e => {   // re-drawing the setup keeps a row's descriptions open
  if (!e.target.matches || !e.target.matches('.lved')) return;
  const i = +e.target.dataset.lvrow;
  if (e.target.open) levelEditOpen.add(i); else levelEditOpen.delete(i);
}, true);
$('#dlgBox').addEventListener('change', e => {
  if (!rubDlg || !$('#setupBody')) return;
  if (e.target.id === 'rbUnit') { rubDlg.bankKey = e.target.value; rubDlg.re(); const b = $('#rbUnit'); if (b) b.focus(); return; }
  if (e.target.matches('[data-scuse]') && e.target.value) { const sc = bankScales().find(x => x.id === e.target.value); if (sc) { rubDlg.draft.scale = { ...sc.scale }; rubDlg.re(); toast('Using “' + sc.name + '”. Press Save to keep it.'); } }
});
$('#dlgBox').addEventListener('click', e => {
  if (e.target.closest('[data-scsave]') && rubDlg) { scaleSave(); return; }
  const find = id => bankRubrics().find(r => r.id === id);
  const u = e.target.closest('[data-rbuse]'); if (u) { const r = find(u.dataset.rbuse); if (r) rubricUse(r); return; }
  const x = e.target.closest('[data-rbdel]'); if (x) { const r = find(x.dataset.rbdel); if (r) rubricDelete(r); return; }
  if (e.target.closest('[data-rbsave]')) rubricSave();
});

/* ---------------- class overview: the spread of scores, the rows the class found hardest, and who isn't finished ---------------- */
// The spread counts finished scores on this assignment's scale. Missing and excused have no number and a partial total isn't final, so they stay out. A real 0 stays in.
function onThisScale(st, g, max) {
  if (g.total == null || !(g.total >= 0 && g.total <= max)) return false;
  const typed = hasSheet(st.grade) && !isNaN(+st.grade.sheet);
  return !(g.paper && !typed && st.found && st.found.outOf != null && st.found.outOf !== max);   // a confirmed 10/15 on a 12-point assignment
}
function spreadBins(counted, max) {
  if (!max) return [];
  const w = max <= 20 ? 1 : Math.ceil(max / 10), bins = [];
  for (let lo = 0; lo < max || (w === 1 && lo === max); lo += w) bins.push({ lo, top: w === 1 && lo === max, label: w === 1 && lo === max ? fmtNum(lo) : fmtNum(lo) + ' to under ' + fmtNum(Math.min(lo + w, max)), who: [] });
  if (w > 1 || max % 1) bins[bins.length - 1].label = fmtNum(bins[bins.length - 1].lo) + ' to ' + fmtNum(max);
  for (const x of counted) bins[Math.min(Math.floor(x.total / w), bins.length - 1)].who.push(x.name);
  return bins;
}
function classStats() {
  const max = maxPoints(), s = { counted: [], partial: [], notScored: [], missing: [], excused: [], offScale: [], ownOff: [], leftOut: [], rosterOnly: [], rows: [] };
  batch.students.forEach((st, i) => {
    const g = gradeOf(st), who = { i, name: shownName(st, i) };
    if (g.status === 'missing' || g.status === 'excused') s[g.status].push(who);
    else if (g.partial) s.partial.push({ ...who, note: partNote(st) });
    else if (!g.done || (g.total == null && g.pct == null)) s.notScored.push({ ...who, note: !st.files.length ? 'No paper' : st.foundCount > 1 || (st.doubts && st.doubts.length) ? 'A grade on the paper to confirm' : '' });
    else if (g.out) s.leftOut.push(who);   // left out of the average by the teacher; one with no score yet is still "not scored"
    else if (!onThisScale(st, g, max) && !g.paper) s.ownOff.push({ ...who, note: 'You gave ' + fmtNum(g.total) + ', out of ' + fmtNum(max) });
    else if (!onThisScale(st, g, max)) s.offScale.push({ ...who, note: g.total != null ? 'The paper says ' + (g.paper && st.found && st.found.outOf != null ? fmtNum(g.total) + ' out of ' + fmtNum(st.found.outOf) : fmtNum(g.total)) : 'The paper says ' + fmtPct(g.pct) });
    else s.counted.push({ ...who, total: g.total, pct: g.pct, late: g.status === 'late', paper: !!g.paper });
  });
  const c = batchClass();
  if (c && c.names.length) { const m = rosterMatch(c.names); s.rosterOnly = c.names.filter(n => !m.has(n)); }
  if (anonOn()) for (const k of ['counted', 'partial', 'notScored', 'missing', 'excused', 'offScale', 'ownOff', 'leftOut']) s[k].sort((a, b) => natural(a.name, b.name));   // never in folder order while names are hidden
  const tot = s.counted.map(x => x.total).sort((a, b) => a - b), n = tot.length, pcts = s.counted.map(x => x.pct).filter(v => v != null);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  s.n = n; s.everyone = batch.students.length + s.rosterOnly.length; s.max = max;
  s.nLate = s.counted.filter(x => x.late).length;
  if (n) Object.assign(s, { mean: mean(tot), median: n % 2 ? tot[(n - 1) / 2] : (tot[n / 2 - 1] + tot[n / 2]) / 2, low: tot[0], high: tot[n - 1], meanPct: pcts.length ? pct2(mean(pcts)) : null });
  const ps = pcts.slice().sort((a, b) => a - b);
  if (ps.length) Object.assign(s, { medPct: roundPct(ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2), lowPct: ps[0], highPct: ps[ps.length - 1] });
  s.bins = spreadBins(s.counted, max);
  // Rows use every row with a score, partial papers included, since those rows are real scores. Scores of a missing or excused student stay out.
  if (setup.mode === 'rubric') {
    s.rows = setup.criteria.map((name, r) => {
      const v = batch.students.map(st => st.grade.outAvg ? null : rowShown(st, r)).filter(x => x != null);
      const top = rowTop(setup, r); return { r, name, top, n: v.length, avg: v.length ? mean(v) : null, low: v.filter(x => x <= top / 2).length };
    }).sort((a, b) => (a.avg == null ? 9 : a.avg) - (b.avg == null ? 9 : b.avg) || a.r - b.r);
    const av = s.rows.filter(x => x.n).map(x => x.avg), least = Math.min(...av);
    for (const x of s.rows) x.lowest = x.n > 0 && x.avg === least && av.some(a => a !== least);
    s.nRowless = s.counted.filter(x => x.paper).length;
  }
  return s;
}
const oneDp = v => fmtNum(Math.round(v * 10) / 10);
const people = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
function leftOutText(s) {
  const parts = [[s.missing.length, 'marked missing'], [s.excused.length, 'excused'], [s.partial.length, 'partial'], [s.notScored.length, 'not scored yet'], [s.offScale.length, 'from the paper, not on this scale'], [s.ownOff.length, 'above the total or below 0'], [s.leftOut.length, 'left out of the average by you'], [s.rosterOnly.length, 'on the roster with nothing here']].filter(p => p[0]).map(p => p[0] + ' ' + p[1]);
  let t = 'Counted: ' + s.n + ' of ' + people(s.everyone, 'student') + '.';
  if (parts.length) t += ' Left out: ' + parts.join(', ') + '.';
  if (s.missing.length || s.excused.length) t += ' Missing and excused don’t count as 0.';
  if (s.counted.some(x => x.total === 0)) t += ' A score of 0 is counted.';
  if (s.nLate) t += ' ' + (s.nLate === 1 ? '1 late score is' : s.nLate + ' late scores are') + ' counted.';
  return t;
}
const ovTile = (l, v, sub, main) => '<div class="ovt' + (main ? ' main' : '') + '"><div class="ovl">' + l + '</div><div class="ovv">' + v + '</div>' + (sub ? '<div class="ovs">' + sub + '</div>' : '') + '</div>';
function spreadHtml(s) {
  if (!s.n || !s.bins.length) return '<p class="muted">No finished scores yet, so there’s nothing to chart.</p>';
  const most = Math.max(...s.bins.map(b => b.who.length)), tens = 10 ** Math.floor(Math.log10(Math.max(most / 5, 1))), step = [1, 2, 5, 10].map(x => x * tens).find(x => x * 5 >= most), ticks = [];
  for (let t = step; t <= most; t += step) ticks.push(t);
  const whole = s.bins[s.bins.length - 1].top, halves = whole && s.counted.some(x => x.total % 1);
  return '<div class="ovh" role="group" aria-label="Score spread"><div class="ovplot">' +
    ticks.map(t => '<div class="ovgrid" style="bottom:' + t / most * 100 + '%"><span>' + t + '</span></div>').join('') +
    '<div class="ovcols">' + s.bins.map(b => {
      const n = b.who.length;
      return '<div class="ovc"' + (n ? ' tabindex="0" aria-label="' + esc('Score ' + b.label + ': ' + people(n, 'student')) + '"' : '') + ' data-tv="' + esc(people(n, 'student')) + '" data-tl="' + esc('Score ' + b.label) + '" data-tn="' + esc(b.who.slice(0, 12).join(', ') + (n > 12 ? ' and ' + (n - 12) + ' more' : '')) + '">' +
        (n ? '<div class="ovb" style="height:' + n / most * 100 + '%"></div>' + (n === most ? '<span class="ovcap">' + n + '</span>' : '') : '') + '</div>';
    }).join('') + '</div></div>' +
    '<div class="ovx" aria-hidden="true">' + s.bins.map(b => '<span>' + fmtNum(b.lo) + '</span>').join('') + '</div></div>' +
    '<p class="muted ovcap2">Points, out of ' + fmtNum(s.max) + '.' + (halves ? ' A half point counts with the whole number below it.' : '') + '</p>' +
    '<details class="ovtbl"><summary>See this as a table</summary><table class="ovtab"><thead><tr><th>Score</th><th>Students</th><th>Who</th></tr></thead><tbody>' +
    s.bins.filter(b => b.who.length).reverse().map(b => '<tr><td>' + esc(b.label) + '</td><td>' + b.who.length + '</td><td>' + esc(b.who.join(', ')) + '</td></tr>').join('') + '</tbody></table></details>';
}
function rowsHtml(s) {
  if (setup.mode !== 'rubric') return '<p class="muted">This assignment is scored with just a total, so there are no rows to compare.</p>';
  if (!s.rows.some(x => x.n)) return '<p class="muted">No rubric rows scored yet.</p>';
  const nPart = s.partial.length, oneTop = rowsTop(setup), notes = ['Average out of ' + (oneTop || 'each row’s top') + ', lowest first. It uses every row with a score' + (nPart ? ', including the scored rows on ' + (nPart === 1 ? '1 partial paper' : nPart + ' partial papers') : '') + '.'];
  if (s.missing.length || s.excused.length) notes.push('Missing and excused students aren’t in it.');
  if (s.nRowless) notes.push((s.nRowless === 1 ? '1 score' : s.nRowless + ' scores') + ' read from the paper ' + (s.nRowless === 1 ? 'has' : 'have') + ' no rows, so ' + (s.nRowless === 1 ? 'it isn’t' : 'they aren’t') + ' here.');
  return '<div class="ovrows" role="group" aria-label="Rubric rows, lowest average first">' + s.rows.map(x => {
    const sum = x.n ? people(x.n, 'score') + ', ' + x.low + ' at ' + fmtNum(x.top / 2) + ' or less' : 'No scores yet', tip = x.n ? oneDp(x.avg) + ' average' + (oneTop ? '' : ' out of ' + x.top) : 'No scores yet', w = 100 / x.top;
    return '<div class="ovr"' + (x.n ? ' tabindex="0"' : '') + ' aria-label="' + esc(x.name + ': ' + tip + '. ' + sum) + '" data-tv="' + esc(tip) + '" data-tl="' + esc(x.name) + '" data-tn="' + esc(sum) + '">' +
      '<div class="ovrn"><span>' + esc(x.name) + '</span>' + (x.lowest ? ' <span class="stag">lowest</span>' : '') + '</div>' +
      '<div class="ovrt">' + Array.from({ length: x.top - 1 }, (_, t) => '<i style="left:' + (t + 1) * w + '%"></i>').join('') + (x.n ? '<div class="ovrb' + (x.lowest ? ' on' : '') + '" style="width:' + Math.min(100, x.avg * w) + '%"></div>' : '') + '<span class="ovrv" style="left:' + (x.n ? Math.min(100, x.avg * w) : 0) + '%">' + (x.n ? oneDp(x.avg) : '–') + '</span></div>' +
      '<div class="muted ovrs">' + sum + '</div></div>';
  }).join('') + '</div><div class="ovrx" aria-hidden="true"><span></span><div>' + [0, 1, 2, 3, 4].map(t => '<span style="left:' + t * 25 + '%">' + t + '</span>').join('') + '</div><span></span></div><p class="muted ovcap2">' + notes.join(' ') + '</p>';
}
function whoHtml(s) {
  const item = o => '<li><button class="link" data-ovgo="' + o.i + '">' + esc(o.name) + '</button>' + (o.note ? ' <span class="muted">' + esc(o.note) + '</span>' : '') + '</li>';
  const late = s.counted.filter(x => x.late);
  const groups = [['Not scored yet', s.notScored], ['Partial: some rows scored', s.partial], ['Marked missing', s.missing], ['Excused', s.excused], ['Read from the paper, not on this scale', s.offScale], ['Your score is above the total or below 0', s.ownOff], ['Left out of the average by you', s.leftOut], ['Late, and counted', late]].filter(g => g[1].length);
  let h = groups.map(([t, list]) => '<details class="ovg" data-group="' + esc(t) + '" open><summary>' + esc(t) + ' (' + list.length + ')</summary><ul>' + list.map(item).join('') + '</ul></details>').join('');
  if (s.rosterOnly.length) h += '<details class="ovg" data-group="On the roster" open><summary>On the roster, nothing here (' + s.rosterOnly.length + ')</summary>' + (anonOn() ? '<p class="muted" style="margin:4px 0 0">Names stay hidden during anonymous grading.</p>' : '<ul>' + s.rosterOnly.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>') + '</details>';
  const open = s.notScored.length + s.partial.length + s.rosterOnly.length;
  return (open ? '' : '<p class="ovok">Everyone has a finished score or a mark saying why not.</p>') + h;
}
async function openOverview(tab) {
  if (!scanned || scanP) {   // a grade read off a paper counts, so finish reading first, as the Grade sheet and export do
    tabNext('insights');
    const wait = waitDlg('Insights', 'Reading the files first…');
    await scanAll();
    if (!wait.isConnected) return;   // she's moved on to something else
  }
  ovTab = tab === 'pct' ? 'pct' : 'sum'; ovDraw();
}
// Insights has three views: Summary and Percents here, and the Consistency check (insight.js), which has its own address.
const insTabs = on => '<div class="ovtabs" role="tablist">' + [['sum', 'Summary'], ['pct', 'Percents'], ['cons', 'Consistency']].map(([k, l]) => '<button role="tab" data-ovtab="' + k + '" aria-selected="' + (on === k) + '">' + l + '</button>').join('') + '</div>';
let ovTab = 'sum';
// The whole box, on the tab she's on. Summary is what the class looks like; Percents is hers to slice.
function ovDraw() {
  const s = classStats(), on = ovTab === 'pct';
  tabNext('insights');
  openDlg('<div class="bh"><h2>Insights</h2>' + insTabs(ovTab) + '<button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div>' +
    (on ? '<div class="bb pbody" id="ovBody">' + pctShell() + '</div>' :
    '<div class="bb" id="ovBody">' +
    '<p class="ovleft" id="ovLeft">' + esc(leftOutText(s)) + '</p>' +
    (s.n ? '<div class="ovtiles" id="ovTiles">' + (s.meanPct != null
      ? ovTile('Average', pctAvgText(s.meanPct), oneDp(s.mean) + ' / ' + fmtNum(s.max), true) + ovTile('Middle score', s.medPct + '%', fmtNum(s.median) + ' / ' + fmtNum(s.max)) + ovTile('Lowest', s.lowPct + '%', fmtNum(s.low) + ' / ' + fmtNum(s.max)) + ovTile('Highest', s.highPct + '%', fmtNum(s.high) + ' / ' + fmtNum(s.max))
      : ovTile('Average', oneDp(s.mean), '/ ' + fmtNum(s.max), true) + ovTile('Middle score', fmtNum(s.median)) + ovTile('Lowest', fmtNum(s.low)) + ovTile('Highest', fmtNum(s.high))) + '</div>' : '') +
    (s.meanPct != null ? '<div class="ovcharts"><section id="ovBands"><h3 class="ovh3">Grade bands</h3>' + bandsHtml(s.counted, PCT_TENS) + '<p class="muted ovcap2">How many papers landed in each range of percents.</p></section>' +
      '<section id="ovStrip"><h3 class="ovh3">Every paper’s percent</h3>' + stripHtml(s.counted, s.meanPct, 'Average') + '<p class="muted ovcap2">One dot for each paper. Point at one to see whose it is, and click it to open them.</p></section></div>' : '') +
    '<div class="ovcharts"><section id="ovSpread"><h3 class="ovh3">Score spread</h3>' + spreadHtml(s) + '</section><section id="ovRows"><h3 class="ovh3">Rows the class found hardest</h3>' + rowsHtml(s) + '</section>' + insRowsHtml() + '</div>' +
    '<div id="insMore"></div>' + trendHtml(s) + levelHtml(s) +
    '<section id="ovWho"><h3 class="ovh3">Who’s missing or unfinished</h3>' + whoHtml(s) + '</section></div>') +
    '<div class="bf"><button class="btn primary" data-close>Close</button></div>');
  if (on) pctDraw(); else insMore();
  ovWire();
}
function ovWire() {
  ovTipHide();
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const g = e.target.closest('[data-ovgo]'); if (g) { toPaper(+g.dataset.ovgo); return; }
    const tb = e.target.closest('[data-ovtab]'); if (tb && tb.dataset.ovtab === 'cons') { openCons(); return $('#dlgBox [data-ovtab="cons"]').focus(); }
    if (tb && tb.dataset.ovtab !== ovTab) { ovTab = tb.dataset.ovtab; ovDraw(); return $('#dlgBox [data-ovtab="' + ovTab + '"]').focus(); }
    const sg = e.target.closest('[data-pseg]'); if (sg) { pvSet(sg.dataset.pseg, sg.dataset.v); return; }
    const dp = e.target.closest('[data-avgdp]'); if (dp) return setAvgDp(+dp.dataset.avgdp);
    const th = e.target.closest('[data-psort]'); if (th) { const k = th.dataset.psort; if (pv.sort === k) pv.dir *= -1; else { pv.sort = k; pv.dir = k === 'name' ? 1 : -1; } return pctDraw(); }
    if (e.target.closest('[data-pcopy]')) return copy(pctRows().map(r => r.name + '\t' + r.pct + '%').join('\n'), 'Copied ' + pctRows().length + ' percents in the order shown');
  };
  $('#dlgBox').oninput = e => {
    const t = e.target;
    if (t.matches('[data-pck]')) return pvSet(t.dataset.pck, t.checked);
    if (t.id === 'pTarget') { const v = +t.value; if (t.value !== '' && v >= 0 && v <= 100) pvSet('target', v); return; }
    if (t.id === 'pAdd') { const v = +t.value; if (!isNaN(v)) { pv.add = Math.max(-100, Math.min(100, v)); pctDraw(); } return; }
    if (t.matches('[data-pcut]')) { const c = [...$('#dlgBox').querySelectorAll('[data-pcut]')].map(x => +x.value).filter(v => v > 0 && v <= 100); pvSet('cuts', [...new Set(c)].sort((x, y) => y - x)); }
  };
}

/* ---------- percents: bands, a dot for each paper, the class over time, and the Percents tab ---------- */
// The class average percent shows to the hundredth by default (83.33%), or to one place or whole, as she picks. One paper's percent stays whole.
const pct2 = v => Math.round(v * 100 + 1e-9) / 100;
const avgDp = () => { const d = +store.get('gs.avgDp', 2); return d === 0 || d === 1 ? d : 2; };
const pctAvgText = v => { if (v == null) return ''; const d = avgDp(), k = 10 ** d; return (Math.round(v * k + 1e-9) / k).toFixed(d) + '%'; };
const pctText = v => v == null ? '' : fmtNum(v) + '%';
const PCT_TENS = [90, 80, 70, 60], PCT_FIVES = [95, 90, 85, 80, 75, 70, 65, 60];
// cuts: the lowest percent of each band, highest first. The last band is everything below the last cut.
function bandsOf(list, cuts) {
  const b = cuts.map((c, i) => ({ lo: c, hi: i ? cuts[i - 1] - 1 : 100 })).concat(cuts.length ? [{ lo: 0, hi: cuts[cuts.length - 1] - 1, below: true }] : [{ lo: 0, hi: 100 }]);
  for (const x of b) { x.label = x.below ? 'Below ' + (x.hi + 1) : x.lo === x.hi ? x.lo + '' : x.lo + ' to ' + x.hi; x.who = list.filter(p => p.pct >= x.lo && (p.pct <= x.hi || (!x.below && x === b[0] && p.pct > 100))); }
  return b;
}
function bandsHtml(list, cuts) {
  const b = bandsOf(list, cuts), most = Math.max(1, ...b.map(x => x.who.length)), n = list.length;
  return '<div class="pbands">' + b.map(x => { const k = x.who.length, tip = people(k, 'paper') + (n ? ', ' + Math.round(k / n * 100) + '% of the class' : '');
    return '<div class="pband"' + (k ? ' tabindex="0"' : '') + ' data-tv="' + esc(tip) + '" data-tl="' + esc(x.label + '%') + '" data-tn="' + esc(x.who.slice(0, 12).map(p => p.name).join(', ') + (k > 12 ? ' and ' + (k - 12) + ' more' : '')) + '">' +
      '<span>' + esc(x.label) + '</span><div class="pbt"><i style="width:' + k / most * 100 + '%"></i></div><span class="pbn"><b>' + k + '</b>' + (n ? ' · ' + Math.round(k / n * 100) + '%' : '') + '</span></div>'; }).join('') + '</div>';
}
// Dots on a line of percents, stacked where they meet, with lines for the middle of the class and her target.
function stripHtml(list, mid, midName, target) {
  if (!list.length) return '<p class="muted">No papers to show.</p>';
  const lo = Math.min(50, Math.floor(Math.min(...list.map(p => p.pct), target != null ? target : 100) / 10) * 10), x = p => (Math.min(100, Math.max(lo, p)) - lo) / (100 - lo) * 100, seen = {};
  let ticks = []; for (let t = lo; t <= 100; t += 10) ticks.push(t);
  const near = mid != null && target != null && Math.abs(x(mid) - x(target)) < 22;   // the two labels side by side would run into each other
  const top = Math.max(1, ...Object.values(list.reduce((o, p) => (o[p.pct] = (o[p.pct] || 0) + 1, o), {})));
  return '<div class="pstrip" style="height:' + (54 + Math.min(top, 8) * 13) + 'px"><div class="pax"></div>' + ticks.map(t => '<span class="ptk" style="left:' + x(t) + '%">' + t + '%</span>').join('') +
    (mid != null ? '<div class="pln' + (near && target > mid ? ' l' : '') + '" style="left:' + x(mid) + '%"><span>' + midName + ' ' + (midName === 'Average' ? pctAvgText(mid) : pctText(mid)) + '</span></div>' : '') +
    (target != null ? '<div class="pln tg' + (near && target <= mid ? ' l' : '') + '" style="left:' + x(target) + '%"><span>Target ' + target + '%</span></div>' : '') +
    list.map(p => { const k = seen[p.pct] = (seen[p.pct] || 0) + 1; return '<button class="pdot' + (target != null && p.pct < target ? ' lo' : '') + '" data-ovgo="' + p.i + '" aria-label="' + esc(p.name + ', ' + p.pct + '%') + '" data-tv="' + p.pct + '%" data-tl="' + esc(p.name) + '" data-tn="' + esc(fmtNum(p.total) + ' / ' + fmtNum(p.max || maxPoints())) + '" style="left:' + x(p.pct) + '%;bottom:' + (22 + Math.min(k - 1, 7) * 13) + 'px"></button>'; }).join('') + '</div>';
}
// The class average on each assignment graded for this class, oldest first, then this one. From saved work in this browser, worked out the way the Average tile does.
function pastAvg(d) {
  const ps = [];
  for (const g of Object.values(d.s || {})) {
    if (!g || g.outAvg) continue;
    const p = pastScore(d.setup, g);
    if (p.status === 'missing' || p.status === 'excused' || p.partial || p.pct == null || p.total == null || !(p.total >= 0 && p.total <= p.max)) continue;
    ps.push(p.pct);
  }
  return ps.length ? { pct: pct2(ps.reduce((a, b) => a + b, 0) / ps.length), n: ps.length } : null;
}
function trendHtml(s) {
  const c = batchClass(); if (!c || s.meanPct == null) return '';
  const h = histLoad();
  const pts = (h.list || []).filter(d => d.cls === c.id).map(d => ({ name: d.name, t: d.t, a: pastAvg(d) })).filter(d => d.a).sort((a, b) => a.t - b.t).slice(-11)
    .concat([{ name: 'This one', a: { pct: s.meanPct, n: s.n }, me: true }]);
  const head = '<section id="ovTrend" class="ovtrend"><h3 class="ovh3">' + esc(c.name) + ' across assignments</h3>';
  if (!h.list) { trendWait(h); return head + '<p class="muted">Looking through your saved work…</p></section>'; }
  if (pts.length < 2) return head + '<p class="muted">Once you’ve graded another assignment for ' + esc(c.name) + ' in this browser, each one’s class average shows here.</p></section>';
  const vals = pts.map(p => p.a.pct), lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...vals) + 5) / 10) * 10);
  const W = 900, H = 150, L = 44, R = 20, T = 14, B = 34, X = i => L + (pts.length === 1 ? 0 : i * (W - L - R) / (pts.length - 1)), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let g = ''; for (let v = lo; v <= hi; v += 10) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="tgl"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ttk">' + v + '%</text>';
  const cut = t => t.length > 18 ? t.slice(0, 17) + '…' : t;
  return head + '<svg class="tsvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Class average by assignment: ' + pts.map(p => p.name + ' ' + pctAvgText(p.a.pct)).join(', ')) + '">' + g +
    '<polyline class="tln" points="' + pts.map((p, i) => X(i) + ',' + Y(p.a.pct)).join(' ') + '"/>' +
    pts.map((p, i) => '<circle class="tdot' + (p.me ? ' me' : '') + '" cx="' + X(i) + '" cy="' + Y(p.a.pct) + '" r="' + (p.me ? 6 : 5) + '" tabindex="0" data-tv="' + pctAvgText(p.a.pct) + '" data-tl="' + esc(p.name) + '" data-tn="' + esc('Average of ' + people(p.a.n, 'finished score')) + '"/>' +
      '<text x="' + X(i) + '" y="' + (H - 10) + '" text-anchor="' + (i === pts.length - 1 && pts.length > 1 ? 'end' : i === 0 ? 'start' : 'middle') + '" class="tlb' + (p.me ? ' me' : '') + '">' + esc(cut(p.name)) + (p.me ? ' · ' + pctAvgText(p.a.pct) : '') + '</text>').join('') +
    '</svg><p class="muted ovcap2">Each assignment’s own percents, averaged the same way, so a 12-point rubric and a 30-point test compare fairly.</p></section>';
}

// The saved work is read in the background. When it's there, the chart fills in, if the Summary is still showing.
function trendWait(h, k = 0) {
  setTimeout(() => {
    const el = $('#ovTrend'); if (!el || ovTab !== 'sum') return;
    if (!h.list) { if (k < 100) trendWait(h, k + 1); return; }
    el.outerHTML = trendHtml(classStats());
  }, 100);
}
// The Percents tab. What counts, the bands and the target are kept for each class; What if is only ever a preview.
let pv = { late: true, out: false, part: false, mid: 'mean', target: 70, band: '10', cuts: PCT_TENS.slice(), add: 0, sort: 'pct', dir: -1 };
function pvLoad() {
  const c = batchClass(), all = store.get('gs.pctView', {}), k = all[c ? c.id : ''] || {};
  pv = { ...pv, late: true, out: false, part: false, mid: 'mean', target: 70, band: '10', cuts: PCT_TENS.slice(), ...k, add: 0 };
}
function pvSet(k, v) {
  pv[k] = v;
  if (['late', 'out', 'part', 'mid', 'target', 'band', 'cuts'].includes(k)) {
    const c = batchClass(), all = store.get('gs.pctView', {}), id = c ? c.id : '';
    all[id] = { late: pv.late, out: pv.out, part: pv.part, mid: pv.mid, target: pv.target, band: pv.band, cuts: pv.cuts };
    store.set('gs.pctView', all);
  }
  pctDraw();
}
const dpSeg = () => '<div class="pseg" role="group" aria-label="Places for the average">' + [[0, '83%'], [1, '83.3%'], [2, '83.33%']].map(([v, l]) => '<button data-avgdp="' + v + '" aria-pressed="' + (avgDp() === v) + '">' + l + '</button>').join('') + '</div>';
function setAvgDp(d) {
  store.set('gs.avgDp', d);
  for (const b of document.querySelectorAll('[data-avgdp]')) b.setAttribute('aria-pressed', String(+b.dataset.avgdp === d));
  if (batch) renderProg();
  if ($('#pMain')) pctDraw(); else if ($('#ovTiles')) ovDraw();
}
const pvCuts = () => pv.band === '5' ? PCT_FIVES : pv.band === 'own' ? (pv.cuts.length ? pv.cuts : PCT_TENS) : PCT_TENS;
// Who counts in the Percents tab, each with the percent they'd have with What if added.
function pctList() {
  const max = maxPoints(), out = [], tags = { late: 0, out: 0, part: 0 };
  batch.students.forEach((st, i) => {
    const g = gradeOf(st);
    if (g.status === 'missing' || g.status === 'excused' || g.total == null || g.pct == null || !onThisScale(st, g, max)) return;
    if (!g.done && !g.partial) return;
    const tag = g.out ? 'out' : g.partial ? 'part' : g.status === 'late' ? 'late' : '';
    if (tag) tags[tag]++;
    if (tag && !pv[tag]) return;
    const total = pv.add ? Math.max(0, Math.min(max, g.total + pv.add)) : g.total;
    out.push({ i, name: shownName(st, i), total, max, pct: pv.add ? percentFor(total) : g.pct, base: g.pct, tag });
  });
  return { list: out, tags };
}
const pctMean = a => a.length ? pct2(a.reduce((x, y) => x + y, 0) / a.length) : null;
const pctMed = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length; return roundPct(m % 2 ? b[(m - 1) / 2] : (b[m / 2 - 1] + b[m / 2]) / 2); };
function pctRows() {
  const { list } = pctList(), ps = list.map(p => p.pct), mid = pv.mid === 'median' ? pctMed(ps) : pctMean(ps), cuts = pvCuts(), b = bandsOf(list, cuts);
  const rows = list.map(p => ({ ...p, vs: Math.round((p.pct - mid) * 100) / 100, band: (b.find(x => x.who.includes(p)) || {}).label || '' }));
  const k = pv.sort, by = k === 'name' ? (a, c) => natural(a.name, c.name) : k === 'band' ? (a, c) => a.pct - c.pct : (a, c) => (a[k] - c[k]) || (a.pct - c.pct);
  return rows.sort((a, c) => by(a, c) * pv.dir || natural(a.name, c.name));
}
function pctShell() {
  pvLoad();
  const seg = (k, opts) => '<div class="pseg" role="group">' + opts.map(([v, l]) => '<button data-pseg="' + k + '" data-v="' + v + '" aria-pressed="' + (pv[k] === v) + '">' + l + '</button>').join('') + '</div>';
  return '<aside class="pctl" aria-label="What the numbers use">' +
    '<section><h4>Who counts</h4><div id="pWho"></div></section>' +
    '<section><h4>Middle of the class</h4>' + seg('mid', [['mean', 'Average'], ['median', 'Middle score']]) + '<p class="muted phint">Average is the papers’ percents averaged, as on the tile.</p></section>' +
    '<section><h4>Show the average</h4>' + dpSeg() + '<p class="muted phint">For the average everywhere: here, on the tile and in Summary.</p></section>' +
    '<section><h4>Target</h4><label class="pnum">Flag papers below <input type="number" id="pTarget" min="0" max="100" step="1" value="' + pv.target + '">%</label></section>' +
    '<section><h4>Bands</h4>' + seg('band', [['10', 'Tens'], ['5', 'Fives'], ['own', 'My own']]) + '<div id="pCuts"></div></section>' +
    '<section><h4>What if</h4><label class="pnum">Add <input type="number" id="pAdd" step="0.5" value="0"> points to everyone</label><p class="muted phint">Only a preview. No score changes.</p></section>' +
    '</aside><div class="pmain" id="pMain"></div>';
}
function pctDraw() {
  const box = $('#dlgBox'); if (!box || !$('#pMain')) return;
  for (const b of box.querySelectorAll('[data-pseg]')) b.setAttribute('aria-pressed', String(pv[b.dataset.pseg] === b.dataset.v));
  const { list, tags } = pctList(), ps = list.map(p => p.pct), n = list.length;
  const ck = (k, l, note) => '<label class="pck"><input type="checkbox" data-pck="' + k + '"' + (pv[k] ? ' checked' : '') + '><span>' + l + (note ? '<small>' + note + '</small>' : '') + '</span></label>';
  $('#pWho').innerHTML = ck('late', 'Late papers', people(tags.late, 'paper')) + ck('out', 'Papers you left out', people(tags.out, 'paper')) + ck('part', 'Partial papers, as they stand', people(tags.part, 'paper') + ' with rows still to score');
  const cutsEl = $('#pCuts');
  if (pv.band !== 'own') cutsEl.innerHTML = '';
  else if (!cutsEl.querySelector('[data-pcut]')) cutsEl.innerHTML = '<div class="pcuts">' + pvCuts().concat(['', '']).slice(0, 8).map(v => '<input type="number" min="1" max="100" data-pcut value="' + v + '" aria-label="Lowest percent of a band">').join('') + '</div><p class="muted phint">The lowest percent of each band. Leave a box empty to drop it.</p>';
  if (!n) { $('#pMain').innerHTML = '<p class="muted">No finished scores count with these choices.</p>'; return; }
  const avg = pctMean(ps), med = pctMed(ps), mid = pv.mid === 'median' ? med : avg, m = ps.reduce((a, b) => a + b, 0) / n, sd = Math.round(Math.sqrt(ps.reduce((a, p) => a + (p - m) ** 2, 0) / n));
  const below = list.filter(p => p.pct < pv.target).length, was = pv.add ? (pv.mid === 'median' ? pctMed(list.map(p => p.base)) : pctMean(list.map(p => p.base))) : null;
  const tile = (l, v, sub, main) => '<div class="ovt' + (main ? ' main' : '') + '"><div class="ovl">' + l + '</div><div class="ovv">' + v + '</div><div class="ovs">' + sub + '</div></div>';
  const rows = pctRows(), arrow = k => pv.sort === k ? (pv.dir < 0 ? ' ▾' : ' ▴') : '';
  const th = (k, l, r) => '<th' + (r ? ' class="r"' : '') + ' aria-sort="' + (pv.sort === k ? (pv.dir < 0 ? 'descending' : 'ascending') : 'none') + '"><button data-psort="' + k + '">' + l + arrow(k) + '</button></th>';
  $('#pMain').innerHTML = '<div class="ovtiles ptiles5" id="pTiles">' +
    tile(pv.mid === 'median' ? 'Middle score' : 'Average', pv.mid === 'median' ? pctText(mid) : pctAvgText(mid), pv.add ? 'now ' + (pv.mid === 'median' ? pctText(was) : pctAvgText(was)) + ', with ' + (pv.add > 0 ? '+' : '') + fmtNum(pv.add) : people(n, 'paper') + ' counted', true) +
    tile(pv.mid === 'median' ? 'Average' : 'Middle score', pv.mid === 'median' ? pctAvgText(avg) : pctText(med), pv.mid === 'median' ? 'the percents averaged' : 'half above, half below') +
    tile('Range', ps.length > 1 ? Math.min(...ps) + '–' + Math.max(...ps) + '%' : ps[0] + '%', 'lowest to highest') +
    tile('Typical gap', '±' + sd, 'percent from the average') +
    tile('Below ' + pv.target + '%', below, below === 1 ? 'paper' : 'papers') + '</div>' +
    '<div class="ovcharts"><section><h3 class="ovh3">Bands</h3>' + bandsHtml(list, pvCuts()) + '</section><section><h3 class="ovh3">Every paper’s percent</h3>' + stripHtml(list, mid, pv.mid === 'median' ? 'Middle' : 'Average', pv.target) + '</section></div>' +
    '<div class="ptblh"><h3 class="ovh3">Papers by percent</h3><span class="muted">Click a heading to sort, and a name to open that paper.</span><button class="btn" data-pcopy>Copy this table</button></div>' +
    '<table class="ptab"><thead><tr>' + th('name', 'Student') + th('total', 'Points', 1) + th('pct', 'Percent', 1) + th('vs', 'Vs. ' + (pv.mid === 'median' ? 'middle' : 'average'), 1) + th('band', 'Band') + '</tr></thead><tbody>' +
    rows.map(r => '<tr' + (r.pct < pv.target ? ' class="lo"' : '') + '><td><button class="link" data-ovgo="' + r.i + '">' + esc(r.name) + '</button>' + (r.tag ? ' <span class="stag">' + { late: 'late', out: 'left out', part: 'partial' }[r.tag] + '</span>' : '') + '</td><td class="r">' + fmtNum(r.total) + ' / ' + fmtNum(r.max) + '</td><td class="r"><b>' + r.pct + '%</b></td><td class="r">' + (r.vs > 0 ? '+' : '') + fmtNum(r.vs) + '</td><td>' + esc(r.band) + '</td></tr>').join('') +
    '</tbody></table>';
}

// One tooltip, for pointing and for the keyboard. The same numbers are in the table and the row labels. textContent, since names are in it.
function ovTip() {
  let t = $('#ovTip');
  if (!t) { t = document.createElement('div'); t.id = 'ovTip'; t.setAttribute('role', 'tooltip'); t.hidden = true; t.innerHTML = '<b></b><span></span><em></em>'; }
  const host = $('#dlg').hidden ? document.body : $('#dlg');   // over a box when one is open, else over the page (a class page's charts)
  if (t.parentNode !== host) host.appendChild(t);
  return t;
}
function ovTipHide() { const t = $('#ovTip'); if (t) t.hidden = true; }
function ovTipShow(el) {
  const t = ovTip(), [v, l, n] = t.children;
  v.textContent = el.dataset.tv; l.textContent = el.dataset.tl; n.textContent = el.dataset.tn; n.hidden = !el.dataset.tn;
  t.hidden = false;
  const r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight, x = r.left + r.width / 2 - w / 2, y = r.top - h - 6;
  t.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
  t.style.top = (y < 8 ? r.bottom + 6 : y) + 'px';
}
const ovMark = e => e.target.closest && e.target.closest('[data-tv]');
for (const host of [$('#dlgBox'), $('#vClass')]) {
  host.addEventListener('mouseover', e => { const m = ovMark(e); if (m) ovTipShow(m); });
  host.addEventListener('mouseout', e => { if (ovMark(e)) ovTipHide(); });
  host.addEventListener('focusin', e => { const m = ovMark(e); if (m) ovTipShow(m); });
  host.addEventListener('focusout', e => { if (ovMark(e)) ovTipHide(); });
  host.addEventListener('scroll', ovTipHide, true);
}
$('#shellMain').addEventListener('scroll', ovTipHide, { passive: true });
$('#overviewBtn').onclick = openOverview;

Object.assign(window.__gs, { bankBusy: () => bankBusyN, classStats, openOverview, pctList, pctRows, pv: () => pv, pastAvg, openSetup, savedRubrics, levelOf, tidyLevels, spreadBins });
