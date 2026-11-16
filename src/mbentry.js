/* ---------------- The entry list (11/16): one task's scores, short and in order, beside the school's own gradebook ----------------
   Built into the grading page. Many schools' systems (ManageBac among them) take no file of scores from a teacher, so every score is
   typed or picked by hand. This puts one task's scores in a narrow window the teacher keeps beside that page: each student's score,
   or the level for each criterion (A 7  B 4  C 6  D 5) in an MYP class, in the order the school's page lists them. A click on a student
   greys the row and moves on, so the place is never lost. Nothing is connected and nothing is sent; the school's page knows nothing
   of this one. Opened from a column's box or More in the gradebook, and from the MYP gradebook's bar.
   The order (roster, last name or first name) is a setting of the teacher's own: lib.me.mbOrder ('' is the roster), in setup import as
   school.entryOrder. What is ticked is kept only while the window is open. */
const mbe = { cls: '', key: '', cur: 0, done: new Set(), win: null };
const MB_ORDERS = [['', 'Roster order'], ['last', 'Last name'], ['first', 'First name']];
const mbOrder = () => ['last', 'first'].includes(me().mbOrder) ? me().mbOrder : '';
// "Okoro, Chidi" is last name first; otherwise the last word is the last name.
function mbParts(n) {
  const s = String(n).trim(), c = s.indexOf(',');
  if (c > 0) return { first: s.slice(c + 1).trim(), last: s.slice(0, c).trim() };
  const w = s.split(/\s+/); return { first: w[0], last: w.length > 1 ? w[w.length - 1] : '' };
}
function mbSorted(names, how) {
  const idx = names.map((n, i) => i);
  if (!how || anonOn()) return idx;
  const key = i => { const p = mbParts(names[i]); return how === 'last' ? [p.last, p.first] : [p.first, p.last]; };
  return idx.sort((a, b) => { const x = key(a), y = key(b); return x[0].localeCompare(y[0], undefined, { sensitivity: 'base' }) || x[1].localeCompare(y[1], undefined, { sensitivity: 'base' }) || a - b; });
}
// What can be listed: every task of the class (newest first) and, in an MYP class, the term's levels after them.
function mbTasks(c) {
  if (classWay(c) === 'myp') return ibCols(c, bk.cols.filter(x => x.cls === c.id)).sort((a, b) => b.t - a.t).map(x => ({ key: x.key, name: x.name })).concat({ key: '*lv', name: tr('Term levels') });
  return bkClassCols(c, bk.cols).filter(x => x.type !== 'xc').reverse().map(x => ({ key: x.key, name: x.name }));
}
// One row per student: { i, name, vals: [[criterion or '', value or null]], st }, and the task's "out of" where it has one.
function mbRows(c, key) {
  const names = c.names, rows = [];
  let max = null, get;
  if (classWay(c) === 'myp') {
    const crit = ibCrit(c).map(x => x.k);
    if (key === '*lv') get = n => { const lv = ibLvOf(c, n); return { vals: crit.map(k => [k, ibLevel(lv[k])]) }; };
    else { const col = ibCols(c, bk.cols.filter(x => x.cls === c.id && x.key === key))[0]; if (!col) return { rows, max };
      get = n => { const cell = col.cells.get(n); return { st: cell && cell.st, vals: col.crit.map(k => [k, cell && cell.lv[k] != null ? cell.lv[k] : null]) }; }; }
  } else {
    const col = bkClassCols(c, bk.cols.filter(x => x.key === key))[0]; if (!col) return { rows, max };
    for (const x of col.cells.values()) if (x.max) { max = x.max; break; }
    get = n => { const x = col.cells.get(n); if (!x) return { vals: [['', null]] }; if (x.st === 'missing' || x.st === 'excused') return { st: x.st, vals: [['', null]] };
      return { vals: [['', x.total != null ? fmtNum(x.total) : x.pct != null ? x.pct + '%' : null]] }; };
  }
  for (const i of mbSorted(names, mbOrder())) { const r = get(names[i]); rows.push({ i, name: bkWho(names[i], i), vals: r.vals, st: r.st || '' }); }
  return { rows, max };
}
const MB_CSS = '.mbx{font:14px/1.35 Inter,system-ui,sans-serif;color:#1d2330;display:flex;flex-direction:column;gap:10px;height:100%;box-sizing:border-box;padding:14px}' +
  '.mbx *{box-sizing:border-box}.mbx header{display:flex;align-items:center;gap:8px}.mbx header b{font-size:16px}.mbx header span{color:#5c6475;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.mbx select,.mbx button{font:inherit;border:1px solid #d5d9e0;background:#fff;border-radius:8px;padding:6px 10px;color:inherit;cursor:pointer}.mbx select{width:100%}' +
  '.mbx .mbseg{display:flex;border:1px solid #d5d9e0;border-radius:8px;overflow:hidden}.mbx .mbseg button{flex:1;border:0;border-radius:0;padding:5px 4px;font-size:13px}.mbx .mbseg button+button{border-left:1px solid #d5d9e0}' +
  '.mbx .mbseg [aria-pressed=true]{background:#1F6FB2;color:#fff}.mbx .mbcount{display:flex;align-items:center;gap:8px;color:#5c6475;font-size:13px}.mbx .mbcount span{flex:1}.mbx .mbcount button{padding:3px 8px;font-size:12px}' +
  '.mbx ol{list-style:none;margin:0;padding:0;overflow:auto;flex:1;border:1px solid #e4e6ea;border-radius:10px}' +
  '.mbx li{display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid #eef0f3;cursor:pointer}.mbx li:last-child{border-bottom:0}.mbx li:hover{background:#f4f5f7}' +
  '.mbx li .mbn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mbx li .mbv{display:flex;gap:6px;font-variant-numeric:tabular-nums;font-weight:600}' +
  '.mbx li .mbv{gap:14px}.mbx li .mbv i{font-style:normal;font-weight:500;color:#5c6475;margin-right:4px;font-size:.85em}.mbx li .mbc{min-width:2.4em;text-align:right;white-space:nowrap}.mbx li .mbv .mbst,.mbx li .mbv .mbno{color:#8a91a0;font-weight:500}' +
  '.mbx li.cur{background:#e8f1fa;box-shadow:inset 3px 0 0 #1F6FB2;font-size:17px;padding:11px 12px}.mbx li.done{color:#9aa1ae}.mbx li.done .mbv{color:#9aa1ae}.mbx li .mbok{width:16px;color:#1f9d55;font-weight:700}' +
  '.mbx .mbhint{margin:0;color:#5c6475;font-size:12px}';
const mbClass = () => lib.classes.find(c => c.id === mbe.cls);
function mbHtml() {
  const c = mbClass(); if (!c) return '';
  const tasks = mbTasks(c); if (!tasks.some(t => t.key === mbe.key)) mbe.key = tasks.length ? tasks[0].key : '';
  const { rows, max } = mbRows(c, mbe.key), myp = classWay(c) === 'myp';
  mbe.cur = Math.max(0, Math.min(rows.length - 1, mbe.cur));
  const val = ([k, v]) => '<span class="mbc">' + (k ? '<i>' + esc(k) + '</i>' : '') + (v == null ? '<span class="mbno">–</span>' : esc(String(v))) + '</span>';
  return '<div class="mbx"><header><b>' + esc(tr('Entry list')) + '</b><span>' + esc(c.name) + '</span><button data-mbclose>' + esc(tr('Close')) + '</button></header>' +
    '<select data-mbtask aria-label="' + esc(tr('Task')) + '">' + tasks.map(t => '<option value="' + esc(t.key) + '"' + (t.key === mbe.key ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>' +
    (anonOn() ? '' : '<div class="mbseg" role="group" aria-label="' + esc(tr('Order')) + '">' + MB_ORDERS.map(([v, l]) => '<button data-mborder="' + v + '" aria-pressed="' + (mbOrder() === v) + '">' + esc(tr(l)) + '</button>').join('') + '</div>') +
    '<div class="mbcount"><span>' + esc(tr(mbe.done.size + ' of ' + rows.length + ' done')) + (max ? ' · ' + esc(tr('out of ' + fmtNum(max))) : '') + '</span>' +
    (mbe.done.size ? '<button data-mbreset>' + esc(tr('Start over')) + '</button>' : '') + (myp ? '' : '<button data-mbcopy>' + esc(tr('Copy scores')) + '</button>') + '</div>' +
    '<ol>' + rows.map((r, j) => '<li data-mbrow="' + j + '" class="' + (j === mbe.cur ? 'cur' : '') + (mbe.done.has(r.i) ? ' done' : '') + '"><span class="mbok">' + (mbe.done.has(r.i) ? '✓' : '') + '</span><span class="mbn">' + esc(r.name) + '</span><span class="mbv">' +
      (r.st ? '<span class="mbst">' + esc(tr(r.st)) + '</span>' : r.vals.map(val).join('')) + '</span></li>').join('') + '</ol>' +
    '<p class="mbhint">' + esc(tr('Click a student once their score is in. Arrow keys work too.')) + '</p></div>';
}
// Where the list is drawn: its own small window, or (where the browser blocked that) a panel on this page.
const mbRoot = () => mbe.win && !mbe.win.closed ? mbe.win.document.getElementById('mbRoot') : document.getElementById('mbPanel');
function mbDraw() {
  const r = mbRoot(); if (!r) return;
  r.innerHTML = mbHtml();
  const cur = r.querySelector('li.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
}
function mbStep(by) {
  const c = mbClass(); if (!c) return;
  const rows = mbRows(c, mbe.key).rows, r = rows[mbe.cur]; if (!r) return;
  if (by > 0) { mbe.done.add(r.i); mbe.cur = Math.min(rows.length - 1, mbe.cur + 1); }
  else { mbe.cur = Math.max(0, mbe.cur - 1); mbe.done.delete(rows[mbe.cur].i); }
  mbDraw();
}
function mbCopy() {
  const c = mbClass(); if (!c) return;
  const text = mbRows(c, mbe.key).rows.map(r => r.st ? '' : r.vals.map(v => v[1] == null ? '' : String(v[1]).replace('%', '')).join('\t')).join('\n');
  const w = mbe.win && !mbe.win.closed ? mbe.win : window;
  const b = mbRoot() && mbRoot().querySelector('[data-mbcopy]');
  w.navigator.clipboard.writeText(text).then(() => { toast('Copied: one line per student, in this order.'); if (b) b.textContent = '✓ ' + b.textContent; }, () => toast('Copying didn’t work in this browser.'));
}
function mbClick(e) {
  const b = e.target.closest('[data-mbclose], [data-mbreset], [data-mbcopy], [data-mborder], [data-mbrow]'); if (!b) return;
  const d = b.dataset, c = mbClass(); if (!c) return;
  if (d.mbclose != null) return mbClose();
  if (d.mbreset != null) { mbe.done.clear(); mbe.cur = 0; return mbDraw(); }
  if (d.mbcopy != null) return mbCopy();
  if (d.mborder != null) { meSet({ mbOrder: d.mborder }); if (!d.mborder) delete lib.me.mbOrder; mbe.cur = 0; return mbDraw(); }
  if (d.mbrow != null) {
    const rows = mbRows(c, mbe.key).rows, j = +d.mbrow, r = rows[j]; if (!r) return;
    if (mbe.done.has(r.i)) { mbe.done.delete(r.i); mbe.cur = j; }
    else { mbe.done.add(r.i); const next = rows.findIndex((x, k) => k > j && !mbe.done.has(x.i)); mbe.cur = next >= 0 ? next : j; }
    return mbDraw();
  }
}
function mbChange(e) { if (e.target.matches('[data-mbtask]')) { mbe.key = e.target.value; mbe.done.clear(); mbe.cur = 0; mbDraw(); } }
function mbKey(e) {
  if (e.target.closest && e.target.closest('select, button')) return;
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mbStep(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); mbStep(-1); }
  else if (e.key === 'Escape' && !mbe.win) mbClose();
}
function mbClose() {
  if (mbe.win && !mbe.win.closed) mbe.win.close();
  mbe.win = null; const p = document.getElementById('mbPanel'); if (p) p.remove();
}
// Opens the list for class c, at the task with key (or the newest). A list already open shows this one instead.
function mbOpen(c, key) {
  if (!c) return;
  if (mbe.cls !== c.id || mbe.key !== key) { mbe.done.clear(); mbe.cur = 0; }
  mbe.cls = c.id; mbe.key = key || '';
  if (!(mbe.win && !mbe.win.closed) && !document.getElementById('mbPanel')) {
    const W = 400, H = Math.min(900, (screen.availHeight || 800) - 60), L = Math.max(0, (screen.availLeft || 0) + (screen.availWidth || 1200) - W - 16);
    let w = null; try { w = window.open('about:blank', 'gsEntryList', 'popup,width=' + W + ',height=' + H + ',left=' + L + ',top=' + ((screen.availTop || 0) + 30)); } catch { }
    if (w && w.document) {
      mbe.win = w;
      w.document.open(); w.document.write('<!doctype html><html lang="' + esc(LANG) + '"><head><meta charset="utf-8"><title>' + esc(tr('Entry list') + ' · ' + c.name) + '</title><style>html,body{margin:0;height:100%;background:#fff}' + MB_CSS + '</style></head><body><div id="mbRoot" style="height:100%"></div><\/body></html>'); w.document.close();
      w.document.addEventListener('click', mbClick); w.document.addEventListener('change', mbChange); w.document.addEventListener('keydown', mbKey);
      w.addEventListener('pagehide', () => { if (mbe.win === w) mbe.win = null; });
    } else {
      if (!document.getElementById('mbCss')) { const s = document.createElement('style'); s.id = 'mbCss'; s.textContent = MB_CSS + '#mbPanel{position:fixed;right:16px;top:16px;bottom:16px;width:380px;z-index:60;background:#fff;border:1px solid #e4e6ea;border-radius:14px;box-shadow:0 12px 32px rgba(20,30,50,.18);outline:none}'; document.head.appendChild(s); }
      const p = document.createElement('div'); p.id = 'mbPanel'; p.tabIndex = -1; document.body.appendChild(p);
      p.addEventListener('click', mbClick); p.addEventListener('change', mbChange); p.addEventListener('keydown', mbKey);
    }
  }
  mbDraw();
  if (mbe.win) mbe.win.focus(); else { const p = document.getElementById('mbPanel'); if (p) p.focus(); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('#bkBody [data-mbopen], #bkPop [data-mbopen]'); if (!b) return;
  const c = bkClass(); if (!c) return;
  if (typeof bkPopClose === 'function') bkPopClose();
  mbOpen(c, b.dataset.mbopen);
});
