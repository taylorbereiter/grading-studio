/* ================= The bank: rubrics and grading scales, sorted by course and unit =================
   The bank is the Planner's own: kv 'bank' in the Planner database = { rubrics, scales, gone: { id: time } }.
   It holds only a rubric's wording and a scale's percents: never a score, a name or anything about a
   student. Grading's Rubric setup opens this one record (and the unit list) to use and save rubrics,
   and the Planner never opens anything of grading's. A rubric or scale names its unit as
   { id, course, title }, so it still sorts if that unit isn't here. They also go to the Planner folder,
   under Rubrics/, for Claude. Tabs tell each other about changes on the 'gs-bank' channel. */
// A row's scale, as in grading (src/app/start.js): 0 to its top. x.top is every row's top, x.tops[i] one row's own, x.half === false
// means whole numbers only. A rubric with none of them is 0 to 4 with half points, as every rubric was before this was a choice.
const B_TOP = 4, B_TOP_MAX = 10;
const bTopOk = v => { v = Math.round(+v); return v >= 1 && v <= B_TOP_MAX ? v : 0; };
const bTop = (x, i) => (i != null && Array.isArray(x.tops) && bTopOk(x.tops[i])) || bTopOk(x.top) || B_TOP;
const bMax = x => x.criteria.reduce((a, _, i) => a + bTop(x, i), 0);
const bLevels = (x, i) => { const out = []; for (let v = bTop(x, i); v >= 0; v--) out.push(v); return out; };
const bOneTop = x => x.criteria.every((_, i) => bTop(x, i) === bTop(x, 0)) ? bTop(x, 0) : 0;
function bRowScale(x) { const o = {}; if (bTopOk(x.top) && bTopOk(x.top) !== B_TOP) o.top = bTopOk(x.top); if (Array.isArray(x.tops) && x.tops.some(bTopOk)) o.tops = x.tops.map(v => bTopOk(v) || null); if (x.half === false) o.half = false; return o; }
const B_SCALE12 = { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 };
let bankChan = null; try { bankChan = new BroadcastChannel('gs-bank'); } catch { }
const tidyBank = b => ({ rubrics: Array.isArray(b && b.rubrics) ? b.rubrics : [], scales: Array.isArray(b && b.scales) ? b.scales : [], gone: (b && b.gone && typeof b.gone === 'object') ? b.gone : {} });
async function bankLoad() { L.bank = tidyBank(await kvGet('bank')); }
// Read, change and write in one go, so a save in grading's tab at the same moment isn't lost.
async function bankUpdate(fn) {
  let out;
  await lTx('kv', 'readwrite', s => reqP(s.get('bank')).then(b => { b = tidyBank(b); fn(b); s.put(b, 'bank'); out = b; }));
  L.bank = out;
  try { bankChan && bankChan.postMessage('changed'); } catch { }
  return out;
}

/* ---------- reading and tidying ---------- */
function normScale(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(s)) { const n = +k, p = +v; if (Number.isInteger(n) && n >= 0 && n <= 40 && v !== '' && v != null && isFinite(p) && p >= 0 && p <= 200) out[n] = p; }
  return Object.keys(out).length ? out : null;
}
const scaleTop = s => s ? Math.max(...Object.keys(s).map(Number)) : 0;
function normRef(u) {
  if (!u || typeof u !== 'object' || !(u.title || u.id)) return null;
  return { id: String(u.id || ''), course: String(u.course || ''), title: String(u.title || '') };
}
function normRubric(x) {
  x = x && typeof x === 'object' ? x : {};
  const criteria = (Array.isArray(x.criteria) ? x.criteria : []).map(c => String(c == null ? '' : c).trim()).slice(0, 12).map((c, i) => c || 'Criterion ' + (i + 1));
  let levels;
  if (Array.isArray(x.levels)) {
    levels = criteria.map((_, i) => { const r = x.levels[i] || {}, o = {}; for (const v of bLevels({ ...x, criteria }, i)) { const t = String(r[v] == null ? '' : r[v]).trim(); if (t) o[v] = t; } return o; });
    if (!levels.some(r => Object.keys(r).length)) levels = undefined;
  }
  const r = { id: typeof x.id === 'string' && x.id ? x.id : lid(), name: String(x.name || '').trim() || 'Rubric', criteria: criteria.length ? criteria : ['Criterion 1'], levels, scale: normScale(x.scale), ...bRowScale(x), at: +x.at || Date.now() };
  if (r.tops) r.tops = r.criteria.map((_, i) => r.tops[i] || null);
  const u = normRef(x.unit); if (u) r.unit = u;
  return r;
}
function normBankScale(x) {
  x = x && typeof x === 'object' ? x : {};
  const s = { id: typeof x.id === 'string' && x.id ? x.id : lid(), name: String(x.name || '').trim() || 'Grading scale', scale: normScale(x.scale) || { 0: 0 }, at: +x.at || Date.now() };
  const u = normRef(x.unit); if (u) s.unit = u;
  return s;
}
// Anything that can't be used is left out.
const bankRubrics = () => ((L.bank && L.bank.rubrics) || []).filter(r => r && r.id && r.name && Array.isArray(r.criteria) && r.criteria.length);
const bankScales = () => ((L.bank && L.bank.scales) || []).filter(s => s && s.id && s.name && s.scale && typeof s.scale === 'object');
const bankList = kind => kind === 'scales' ? bankScales() : bankRubrics();
const bankNatural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
async function bankPut(kind, item) {
  item.at = Date.now();
  try {
    await bankUpdate(b => { const list = b[kind], i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item); list.sort((x, y) => bankNatural(x.name, y.name)); delete b.gone[item.id]; });
  } catch (e) { console.warn(e); toast('That wasn’t saved. The browser may be out of room.'); return false; }
  bankWriteSoon(kind, item);
  return true;
}
async function bankRemove(kind, id) {
  await bankUpdate(b => { b[kind] = b[kind].filter(x => x.id !== id); b.gone[id] = Date.now(); });
  await bankFileRemove(id);
}

/* ---------- units: which unit a rubric belongs to ---------- */
const unitRef = u => u ? { id: u.id, course: u.course, title: u.title } : null;
// A rubric's unit: the Planner's own unit by id, else one with the same course and name, else just the name it was saved with.
function refUnit(ref) {
  if (!ref) return null;
  return L.units.find(u => u.id === ref.id) || L.units.find(u => u.course === ref.course && u.title.trim().toLowerCase() === ref.title.trim().toLowerCase()) || null;
}
const refKey = ref => { if (!ref) return ''; const u = refUnit(ref); return u ? u.id : 'ref:' + ref.course + '|' + ref.title; };
const refLabel = ref => { if (!ref) return 'Not in a unit'; const u = refUnit(ref) || ref; return (u.course ? u.course + ' · ' : '') + (u.title || 'Unit'); };
function unitOptions(selKey) {
  const cs = courses(), seen = new Set();
  let h = '<option value="">Not in a unit</option>';
  for (const c of cs) {
    const us = L.units.filter(u => u.course === c.course).sort((a, b) => a.start.localeCompare(b.start)); if (!us.length) continue;
    h += '<optgroup label="' + esc(c.course) + '">' + us.map(u => { seen.add(u.id); return '<option value="' + esc(u.id) + '"' + (u.id === selKey ? ' selected' : '') + '>' + esc(u.title) + '</option>'; }).join('') + '</optgroup>';
  }
  if (selKey && !seen.has(selKey) && selKey.startsWith('ref:')) { const [course, title] = selKey.slice(4).split('|'); h += '<option value="' + esc(selKey) + '" selected>' + esc((course ? course + ' · ' : '') + title) + ' (not in this Planner)</option>'; }
  return h;
}
function refFromKey(key, was) {
  if (!key) return null;
  const u = L.units.find(x => x.id === key); if (u) return unitRef(u);
  return was && refKey(was) === key ? was : null;
}

/* ---------- the Bank tab ---------- */
function bankCard(kind, x) {
  const about = kind === 'scales' ? 'Grading scale · top score ' + scaleTop(x.scale)
    : x.criteria.length + (x.criteria.length === 1 ? ' row' : ' rows') + ' · out of ' + bMax(x) + (x.levels ? ' · what each score means' : '') + (x.scale ? ' · with a scale' : '');
  return '<button class="ls-card pl-bcard' + (kind === 'scales' ? ' scale' : '') + '" draggable="true" data-a="bopen" data-bk="' + kind + '" data-bid="' + esc(x.id) + '"><b>' + esc(x.name) + '</b><span>' + esc(about) + '</span></button>';
}
function bankGroups() {
  const items = [...bankRubrics().map(x => ['rubrics', x]), ...bankScales().map(x => ['scales', x])], by = new Map();
  for (const it of items) { const k = refKey(it[1].unit); if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
  const groups = [];
  const courseOf = new Map();
  for (const c of courses()) courseOf.set(c.course, []);
  for (const u of L.units) { if (!courseOf.has(u.course)) courseOf.set(u.course, []); }
  for (const [k, list] of by) if (k.startsWith('ref:')) { const [course] = k.slice(4).split('|'); if (!courseOf.has(course)) courseOf.set(course, []); }
  for (const course of courseOf.keys()) {
    const us = L.units.filter(u => u.course === course).sort((a, b) => a.start.localeCompare(b.start)).map(u => ({ key: u.id, title: u.title, color: unitColor(u), items: by.get(u.id) || [] }));
    for (const [k, list] of by) if (k.startsWith('ref:') && k.slice(4).split('|')[0] === course) us.push({ key: k, title: k.slice(4).split('|').slice(1).join('|') + ' (not in this Planner)', color: '#5C616A', items: list });
    if (us.length) groups.push({ course, units: us });
  }
  return { groups, loose: by.get('') || [] };
}
function renderBank() {
  let h = topBar('bank', '<button class="btn sm" data-a="bnew" data-bk="rubrics">+ New rubric</button><button class="btn sm" data-a="bnew" data-bk="scales">+ New scale</button>');
  const { groups, loose } = bankGroups(), sortIt = l => l.slice().sort((a, b) => (a[0] === b[0] ? bankNatural(a[1].name, b[1].name) : a[0] === 'rubrics' ? -1 : 1));
  const cards = l => sortIt(l).map(([k, x]) => bankCard(k, x)).join('');
  h += '<div class="pl-units pl-bank"><p class="muted pl-bnote">Rubrics and grading scales you can use again, sorted by unit. Drag one onto another unit to move it. Grading’s Rubric setup uses the same bank. Only the wording and the scale are kept here: never scores or anything about a student.</p>';
  if (!groups.length && !loose.length) h += '<div class="ls-empty"><h2>Nothing in the bank yet</h2><p>Make a rubric or a grading scale here, or press “Save to the bank” in grading’s Rubric setup.</p><div class="row"><button class="btn primary" data-a="bnew" data-bk="rubrics">+ New rubric</button><button class="btn" data-a="bnew" data-bk="scales">+ New scale</button></div></div>';
  for (const g of groups) {
    h += '<section><h2>' + esc(g.course) + '</h2>' + g.units.map(u => '<div class="pl-bunit" data-bdrop="' + esc(u.key) + '" style="--uc:' + esc(u.color) + '"><div class="pl-bh"><b>' + esc(u.title) + '</b>' +
      '<span class="sp"></span><button class="btn sm ghost" data-a="bnew" data-bk="rubrics" data-bu="' + esc(u.key) + '">+ Rubric</button><button class="btn sm ghost" data-a="bnew" data-bk="scales" data-bu="' + esc(u.key) + '">+ Scale</button></div>' +
      (u.items.length ? '<div class="ls-cards">' + cards(u.items) + '</div>' : '<span class="muted pl-bempty">Nothing saved for this unit yet</span>') + '</div>').join('') + '</section>';
  }
  if (loose.length || groups.length) h += '<section><h2>Not in a unit yet</h2><div class="pl-bunit loose" data-bdrop="">' + (loose.length ? '<div class="ls-cards">' + cards(loose) + '</div>' : '<span class="muted pl-bempty">Drag one here to take it out of its unit</span>') + '</div></section>';
  h += '</div>';
  $('#lessons').innerHTML = h;
}
// On a unit's own page: what's saved for it.
function bankUnitSection(u) {
  const mine = [...bankRubrics().map(x => ['rubrics', x]), ...bankScales().map(x => ['scales', x])].filter(([, x]) => refKey(x.unit) === u.id);
  return '<section class="pl-card"><div class="lhead"><h2>Rubrics and grading scales</h2><span class="sp"></span><button class="btn sm" data-a="bnew" data-bk="rubrics" data-bu="' + esc(u.id) + '">+ New rubric</button><button class="btn sm" data-a="bnew" data-bk="scales" data-bu="' + esc(u.id) + '">+ New scale</button><button class="btn sm ghost" data-a="tab" data-v="bank">Open the bank</button></div>' +
    (mine.length ? '<div class="ls-cards">' + mine.map(([k, x]) => bankCard(k, x)).join('') + '</div>' : '<p class="muted" style="margin:0">Nothing saved for this unit yet. Rubrics you save from grading’s Rubric setup can go here too.</p>') + '</section>';
}

/* ---------- editing one ---------- */
let bEd = null;   // { kind, item (a copy), isNew, unitKey }
function bankEditor(kind, item, isNew) {
  bEd = { kind, item: JSON.parse(JSON.stringify(item)), isNew, unitKey: refKey(item.unit) };
  if (kind === 'rubrics' && !bEd.item.levels) bEd.item.levels = bEd.item.criteria.map(() => ({}));
  bankEdRender();
}
function scaleRowsHtml(scale, top) {
  if (!scale) return '<p class="muted" style="font-size:13px;margin:4px 0 0">No scale: the percent is the plain share of points.</p>';
  if (top > 40) return '<p class="muted" style="font-size:13px">A scale needs a top score of 40 or less.</p>';
  let h = '<div class="pl-scale">';
  for (let k = top; k >= 0; k--) h += '<label><span>' + k + '</span>=<input type="number" step="0.5" min="0" max="200" data-bsk="' + k + '" value="' + esc(scale[k] == null ? '' : scale[k]) + '">%</label>';
  return h + '</div><p class="muted" style="font-size:12.5px;margin:6px 0 0">Leave a score blank to go by the plain share of points there. Half points fall halfway between two rows.</p>';
}
function presetsHtml(top, cur) {
  const others = bankScales().filter(s => scaleTop(s.scale) === top && (!bEd || s.id !== bEd.item.id));
  return '<span class="pl-pre">' + (top === 12 && plWords().scale12 ? '<button class="btn sm" data-bpre="usual">12 = 100, 11 = 95, 10 = 91…</button>' : '') +
    '<button class="btn sm" data-bpre="fives">Steps of 5 (' + Math.max(0, top - 3) + ' = 85%)</button><button class="btn sm" data-bpre="plain">Plain percent</button>' +
    (cur !== undefined ? '<button class="btn sm" data-bpre="none">No scale</button>' : '') +
    (others.length ? '<select class="btn sm" data-bsaved aria-label="Use a saved scale"><option value="">Use a saved scale…</option>' + others.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('') + '</select>' : '') + '</span>';
}
function presetScale(p, top, saved) {
  if (p === 'none') return null;
  if (saved) { const s = bankScales().find(x => x.id === saved); return s ? { ...s.scale } : null; }
  if (p === 'usual' && top === 12) return { ...B_SCALE12 };
  const o = {}; for (let k = top; k >= 0; k--) o[k] = Math.round((p === 'fives' ? 100 - (top - k) * 5 : k / top * 100) * 10) / 10;
  return o;
}
function bankEdRender() {
  const { kind, item: x, isNew } = bEd, rub = kind === 'rubrics';
  let h = '<div class="bh"><h2>' + (isNew ? (rub ? 'New rubric' : 'New grading scale') : esc(x.name)) + '</h2></div><div class="bb pl-bed">' +
    '<label class="pl-fl">Name<input class="btn sm" data-bf="name" value="' + esc(x.name) + '" placeholder="' + (rub ? 'Like Book cover formative' : 'Like Out of 12, steps of 5') + '"></label>' +
    '<label class="pl-fl">Unit<select class="btn sm" data-bf="unit">' + unitOptions(bEd.unitKey) + '</select></label>';
  if (rub) {
    h += '<div class="pl-fl"><b>Rows</b> <span class="muted">Each row is scored 0 to <select class="btn sm" data-bf="rowtop" aria-label="The highest score on a row">' + (bOneTop(x) ? '' : '<option value="" selected>each its own</option>') + Array.from({ length: B_TOP_MAX }, (_, k) => '<option' + (k + 1 === bOneTop(x) ? ' selected' : '') + '>' + (k + 1) + '</option>').join('') + '</select> <label style="display:inline-flex;gap:5px;align-items:center"><input type="checkbox" data-bf="rowhalf"' + (x.half === false ? '' : ' checked') + '> Half points</label> Out of ' + bMax(x) + '.</span></div>';
    x.criteria.forEach((c, i) => {
      const lv = x.levels[i] || {}, n = bLevels(x, i).filter(v => String(lv[v] || '').trim()).length;
      h += '<div class="pl-brow"><div class="pl-brh"><b>' + (i + 1) + '</b><input class="btn sm" data-bc="' + i + '" value="' + esc(c) + '" aria-label="Row ' + (i + 1) + ' name"><button class="btn sm ghost" data-a="browdel" data-i="' + i + '"' + (x.criteria.length < 2 ? ' disabled' : '') + ' aria-label="Take out row ' + (i + 1) + '">×</button></div>' +
        '<details' + (n ? '' : '') + '><summary>What each score means' + (n ? ' (' + n + ' written)' : '') + '</summary>' +
        bLevels(x, i).map(v => '<label class="pl-blv"><b>' + v + '</b><textarea rows="2" data-bl="' + i + '" data-bv="' + v + '" placeholder="' + (v === 0 ? 'Optional' : '') + '" aria-label="What ' + v + ' means on row ' + (i + 1) + '">' + esc(lv[v] || '') + '</textarea></label>').join('') + '</details></div>';
    });
    h += '<button class="btn sm" data-a="browadd"' + (x.criteria.length >= 12 ? ' disabled' : '') + '>+ Add a row</button>';
    const top = bMax(x);
    h += '<div class="pl-fl" style="margin-top:14px"><b>Grading scale</b> ' + presetsHtml(top, x.scale) + '</div>' + scaleRowsHtml(x.scale, top);
  } else {
    const top = scaleTop(x.scale);
    h += '<label class="pl-fl">Top score<input class="btn sm" type="number" min="1" max="40" step="1" data-bf="top" value="' + top + '" style="width:90px"></label>' +
      '<div class="pl-fl"><b>Percents</b> ' + presetsHtml(top) + '</div>' + scaleRowsHtml(x.scale, top);
  }
  h += '</div><div class="bf">' + (isNew ? '' : '<button class="btn ghost" data-a="bdel" style="margin-right:auto">Delete</button><button class="btn" data-a="bdup">Duplicate</button>') +
    '<button class="btn" data-a="bcancel">Cancel</button><button class="btn primary" data-a="bsave">Save</button></div>';
  const keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('#dlgBox') ? document.activeElement.getAttribute('data-bsk') : null;
  const open = [...document.querySelectorAll('#dlgBox .pl-brow details')].map(d => d.open);
  if ($('#dlg').hidden) openDlg(h); else $('#dlgBox').innerHTML = h;
  $('#dlgBox').className = 'box narrow pl-bbox';
  document.querySelectorAll('#dlgBox .pl-brow details').forEach((d, i) => { if (open[i]) d.open = true; });
  if (keep) { const k = document.querySelector('#dlgBox [data-bsk="' + keep + '"]'); if (k) k.focus(); }
  const box = $('#dlgBox');
  box.onclick = bankEdClick;
  box.oninput = bankEdInput;
  box.onchange = bankEdChange;
}
function bankEdInput(e) {
  const t = e.target, x = bEd.item;
  if (t.dataset.bf === 'name') x.name = t.value;
  else if (t.dataset.bc != null) x.criteria[+t.dataset.bc] = t.value;
  else if (t.dataset.bl != null) { (x.levels[+t.dataset.bl] ||= {})[t.dataset.bv] = t.value; }
  else if (t.dataset.bsk != null) { x.scale ||= {}; if (t.value === '') delete x.scale[t.dataset.bsk]; else x.scale[t.dataset.bsk] = +t.value; }
}
function bankEdChange(e) {
  const t = e.target, x = bEd.item;
  if (t.dataset.bf === 'unit') bEd.unitKey = t.value;
  else if (t.dataset.bf === 'rowtop') { const to = bTopOk(t.value), was = bMax(x); if (to) { delete x.tops; if (to === B_TOP) delete x.top; else x.top = to; x.scale = rescale(x.scale, was, bMax(x)); } bankEdRender(); }
  else if (t.dataset.bf === 'rowhalf') { if (t.checked) delete x.half; else x.half = false; bankEdRender(); }
  else if (t.dataset.bf === 'top') {
    const top = Math.max(1, Math.min(40, Math.round(+t.value) || 1)), was = scaleTop(x.scale);
    if (top !== was) x.scale = rescale(x.scale, was, top) || presetScale('plain', top);
    bankEdRender();
  } else if (t.dataset.bsaved != null && t.value) {
    const top = bEd.kind === 'rubrics' ? bMax(x) : scaleTop(x.scale);
    x.scale = presetScale(null, top, t.value); bankEdRender();
  }
}
async function bankEdClick(e) {
  const t = e.target.closest('[data-a],[data-bpre]'); if (!t) return;
  const { kind, item: x } = bEd;
  if (t.dataset.bpre) { const top = kind === 'rubrics' ? bMax(x) : scaleTop(x.scale); x.scale = presetScale(t.dataset.bpre, top) || (kind === 'scales' ? x.scale : null); return bankEdRender(); }
  const a = t.dataset.a;
  if (a === 'browadd') { const was = bMax(x); x.criteria.push('Criterion ' + (x.criteria.length + 1)); x.levels.push({}); if (Array.isArray(x.tops)) x.tops.push(null); x.scale = rescale(x.scale, was, bMax(x)); return bankEdRender(); }
  if (a === 'browdel') { const i = +t.dataset.i, was = bMax(x); x.criteria.splice(i, 1); x.levels.splice(i, 1); if (Array.isArray(x.tops)) x.tops.splice(i, 1); x.scale = rescale(x.scale, was, bMax(x)); return bankEdRender(); }
  if (a === 'bcancel') { bEd = null; return closeDlg(); }
  if (a === 'bsave') return bankEdSave();
  if (a === 'bdup') { const c = JSON.parse(JSON.stringify(x)); c.id = lid(); c.name = x.name + ' (copy)'; bEd = { kind, item: c, isNew: true, unitKey: bEd.unitKey }; return bankEdRender(); }
  if (a === 'bdel') {
    if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Click again to delete'; return; }
    await bankRemove(kind, x.id); bEd = null; closeDlg(); bankRefresh(); toast('Deleted. Assignments already using it keep their rows and scale.');
  }
}
// A scale made for one top score doesn't fit another, so a rubric that grows or shrinks keeps a scale only if it's the plain kind.
function rescale(s, was, top) {
  if (!s) return null;
  const plain = Object.entries(s).every(([k, v]) => Math.abs(v - k / was * 100) < 0.11), fives = Object.entries(s).every(([k, v]) => Math.abs(v - (100 - (was - k) * 5)) < 0.01);
  return plain ? presetScale('plain', top) : fives ? presetScale('fives', top) : null;
}
async function bankEdSave() {
  const { kind, item: x } = bEd;
  x.name = String(x.name || '').trim();
  if (!x.name) { toast('Give it a name first'); const n = document.querySelector('#dlgBox [data-bf="name"]'); if (n) n.focus(); return; }
  const same = bankList(kind).find(o => o.id !== x.id && o.name.toLowerCase() === x.name.toLowerCase());
  if (same) { toast('You already have one called “' + same.name + '”. Pick another name.', 5000); return; }
  const ref = refFromKey(bEd.unitKey, x.unit);
  const clean = kind === 'rubrics' ? normRubric({ ...x, unit: ref }) : normBankScale({ ...x, unit: ref });
  if (!await bankPut(kind, clean)) return;
  bEd = null; closeDlg(); bankRefresh(); toast('Saved “' + clean.name + '”');
}
function bankNewItem(kind, unitKey) {
  const ref = refFromKey(unitKey || '', null);
  if (kind === 'scales') return { ...normBankScale({ scale: presetScale('fives', 12), unit: ref, id: lid() }), name: '' };
  return { id: lid(), name: '', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], levels: [{}, {}, {}], scale: null, unit: ref };
}
function bankRefresh() { if (L.view === 'bank') renderBank(); else if (L.view === 'unit' && L.unit) renderUnit(); }

/* ---------- clicks, dragging between units ---------- */
async function bankClick(e) {
  const t = e.target.closest('[data-a]'); if (!t || !/^b(new|open)$/.test(t.dataset.a)) return false;
  const kind = t.dataset.bk === 'scales' ? 'scales' : 'rubrics';
  if (t.dataset.a === 'bnew') { const it = bankNewItem(kind, t.dataset.bu || (L.view === 'unit' && L.unit ? L.unit.id : '')); bankEditor(kind, it, true); if (it.name === '') { const n = document.querySelector('#dlgBox [data-bf="name"]'); if (n) n.focus(); } return true; }
  const it = bankList(kind).find(x => x.id === t.dataset.bid); if (!it) { toast('That one isn’t in the bank any more'); bankRefresh(); return true; }
  bankEditor(kind, kind === 'rubrics' ? normRubric(it) : normBankScale(it), false);
  return true;
}
document.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('.pl-bcard'); if (!c || L.view !== 'bank') return;
  e.dataTransfer.setData('text/x-bank', c.dataset.bk + '|' + c.dataset.bid); e.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragover', e => {
  if (L.view !== 'bank' || !e.dataTransfer || ![...e.dataTransfer.types].includes('text/x-bank')) return;
  for (const d of document.querySelectorAll('.pl-bunit.over')) d.classList.remove('over');
  const to = e.target.closest && e.target.closest('[data-bdrop]'); if (to) to.classList.add('over');
});
async function bankDrop(e) {
  if (L.view !== 'bank') return false;
  for (const d of document.querySelectorAll('.pl-bunit.over')) d.classList.remove('over');
  const v = e.dataTransfer && e.dataTransfer.getData('text/x-bank'); if (!v) return true;
  const to = e.target.closest && e.target.closest('[data-bdrop]'); if (!to) return true;
  const [kind, id] = v.split('|'), it = bankList(kind).find(x => x.id === id); if (!it) return true;
  const key = to.dataset.bdrop;
  if (refKey(it.unit) === key) return true;
  const ref = refFromKey(key, it.unit);
  const moved = { ...it }; if (ref) moved.unit = ref; else delete moved.unit;
  await bankPut(kind, moved); renderBank();
  toast('Moved “' + it.name + '” to ' + refLabel(ref));
  return true;
}
// Grading's Rubric setup may save to the bank in another tab.
if (bankChan) bankChan.onmessage = async () => {
  await bankLoad();
  bankWriteAllSoon();
  if (!$('#dlg').hidden) return;
  if (L.view === 'bank' || (L.view === 'unit' && L.unit && !(document.activeElement && document.activeElement.closest('#lessons input,#lessons textarea')))) bankRefresh();
};

/* ---------- the Planner folder: Rubrics/<name>.rubric.json and <name>.scale.json ---------- */
// Which file each one was last written to, and when: kv 'bankFiles' = { id: { file, mod } }. Not in the bank itself, so grading never sees it.
let bankFiles = null;
async function bankFilesGet() { if (!bankFiles) bankFiles = (await kvGet('bankFiles')) || {}; return bankFiles; }
const bankBase = (kind, x) => x.name.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 90) + (kind === 'scales' ? '.scale.json' : '.rubric.json');
function bankForFile(kind, x) {
  const o = { id: x.id, name: x.name };
  if (x.unit) o.unit = { course: x.unit.course, title: x.unit.title };
  if (kind === 'rubrics') { o.criteria = x.criteria; if (x.levels) o.levels = x.levels; o.scale = x.scale || null; } else o.scale = x.scale;
  return o;
}
const bTimers = new Map();
function bankWriteSoon(kind, x) { if (!L.dir || !L.dirOk) return; clearTimeout(bTimers.get(x.id)); bTimers.set(x.id, setTimeout(() => bankFileWrite(kind, x).catch(e => console.warn(e)), 600)); }
let bankAllT;
function bankWriteAllSoon() { if (!L.dir || !L.dirOk) return; clearTimeout(bankAllT); bankAllT = setTimeout(() => bankWriteAll().catch(e => console.warn(e)), 800); }
async function bankFileWrite(kind, x) {
  if (!L.dir || !L.dirOk) return;
  const dir = await L.dir.getDirectoryHandle('Rubrics', { create: true }), files = await bankFilesGet(), name = bankBase(kind, x), was = files[x.id];
  if (was && was.file !== name) { try { await dir.removeEntry(was.file); } catch { } }
  const text = JSON.stringify(bankForFile(kind, x), null, 2);
  if (was && was.file === name && was.text === text) return;
  files[x.id] = { file: name, mod: await writeFile(dir, name, text), text };
  await kvSet('bankFiles', files);
}
async function bankFileRemove(id) {
  const files = await bankFilesGet(), was = files[id]; if (!was) return;
  delete files[id]; await kvSet('bankFiles', files);
  if (L.dir && L.dirOk) { try { await (await L.dir.getDirectoryHandle('Rubrics')).removeEntry(was.file); } catch { } }
}
async function bankWriteAll() {
  if (!L.dir || !L.dirOk) return;
  for (const r of bankRubrics()) await bankFileWrite('rubrics', normRubric(r));
  for (const s of bankScales()) await bankFileWrite('scales', normBankScale(s));
}
// Picks up rubrics and scales Claude wrote or changed in Rubrics/. A file changed since the app last wrote it wins.
async function bankFolderRead() {
  const out = { added: 0, changed: 0 };
  if (!L.dir || !L.dirOk) return out;
  let dir; try { dir = await L.dir.getDirectoryHandle('Rubrics'); } catch { return out; }
  const files = await bankFilesGet(), byFile = new Map(Object.entries(files).map(([id, v]) => [v.file, { id, ...v }]));
  for await (const [name, h] of dir.entries()) {
    const kind = /\.rubric\.json$/i.test(name) ? 'rubrics' : /\.scale\.json$/i.test(name) ? 'scales' : null;
    if (h.kind !== 'file' || !kind) continue;
    const f = await h.getFile(), mine = byFile.get(name);
    if (mine && f.lastModified <= mine.mod + 1500) continue;
    let j; try { j = JSON.parse(await f.text()); } catch { continue; }
    const list = bankList(kind), old = list.find(x => x.id === (j.id || (mine && mine.id)));
    if (old && files[old.id] && files[old.id].file !== name) continue;   // a stale copy under an old name
    const ref = j.unit ? (unitRef(L.units.find(u => u.course === String(j.unit.course || '') && u.title.trim().toLowerCase() === String(j.unit.title || '').trim().toLowerCase())) || normRef(j.unit)) : null;
    const item = kind === 'rubrics' ? normRubric({ ...j, id: old ? old.id : j.id, unit: ref }) : normBankScale({ ...j, id: old ? old.id : j.id, unit: ref });
    const dupe = list.find(x => x.id !== item.id && x.name.toLowerCase() === item.name.toLowerCase());
    if (dupe) item.name += ' (from Claude)';
    item.at = Date.now();
    await bankUpdate(b => { const l = b[kind], i = l.findIndex(x => x.id === item.id); if (i >= 0) l[i] = item; else l.push(item); l.sort((x, y) => bankNatural(x.name, y.name)); delete b.gone[item.id]; });
    files[item.id] = { file: name, mod: f.lastModified, text: '' }; await kvSet('bankFiles', files);
    old ? out.changed++ : out.added++;
    if (!j.id || dupe) await bankFileWrite(kind, item);   // give a new file its id
  }
  return out;
}
const BANK_README = `
## Rubrics and grading scales
\`Rubrics/*.rubric.json\` and \`Rubrics/*.scale.json\` are the teacher's bank of rubrics and grading scales,
sorted by unit. Only the wording and percents are here: never scores or anything about a student.
Edit one in place (keep its "id"), or write a new file to add one (leave "id" out). Don't delete files;
the teacher deletes in the app.

Rubric: {
  "id": "…", "name": "Book cover formative",
  "unit": { "course": "<course from timetable.json>", "title": "<a unit's title from Units/>" },   // optional
  "criteria": ["Row 1 name", "Row 2 name", "Row 3 name"],        // each row is scored 4 to 1 (0 if needed), so 3 rows = out of 12
  "top": 8, "half": false,                                       // optional: a row's highest score when it isn't 4 (1 to 10), and false for whole numbers only
  "levels": [ { "4": "What a 4 looks like on row 1", "3": "…", "2": "…", "1": "…" }, { … }, { … } ],   // optional; "0" too if wanted
  "scale": { "12": 100, "11": 95, "10": 90, … }                  // optional: total points -> percent; null = plain share of points
}
Grading scale: { "id": "…", "name": "Out of 12, steps of 5", "unit": { … }, "scale": { "12": 100, "11": 95, … , "0": 40 } }
`;
