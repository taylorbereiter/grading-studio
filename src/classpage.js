/* ---------------- a class page's tabs: Gradebook, Students and Charts, and one student's own page (11/10) ---------------- */
// app.js draws the class's name and its row of tabs (renderLib) and leaves an empty panel for every tab but Assignments. This file fills it:
// the gradebook's own table and charts (book.js) drawn on the page instead of in a box, the student list (people.js), and the charts below.
// Nothing here is saved, and nothing leaves the browser: every chart is worked out from the same columns the gradebook table shows.
let panelKey = '', panelTok = 0;
// Leaving the class pages: the scores can change before she's back (a paper graded), so the gradebook's copy is read again next time.
function classPanelGone() { rptKeep(true); panelKey = ''; panelTok++; if (bk.host === 'page') { bk.cols = null; bkPopClose(); } }
// Part-way through something in the panel: a form open, or typing in a box. Another tab's changes wait until she's done (folder.js), as they do for an open box.
function classPanelBusy() { const a = document.activeElement; return !!$('#bkAdd, #bkSetup, .bkcin, #bkPop, .bktypes') || (!!a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && !!a.closest('#classPanel')); }
// fresh: app.js has just put a new, empty panel on the page. Otherwise the panel is left alone unless the address moved to another student,
// or the units and rosters were swapped for another tab's newer copy: what's drawn holds parts of the old one, so it's drawn again from the new.
function classPanelDraw(fresh) {
  const r = routeNow(), el = $('#classPanel');
  if (r.v !== 'class' || !r.tab || !el) { panelKey = ''; return; }
  const c = r.c, key = c.id + '/' + r.tab + '/' + (r.stu == null ? '' : r.stu);
  if (r.tab === 'attendance') {   // attendance needs none of the gradebook's columns: it is drawn from the class itself (attend.js)
    const k = key + r.att; if (!fresh && k === panelKey && el.firstChild && attLib === lib) return;
    panelKey = k; panelTok++; bkPopClose(); ovTipHide(); return attPanel(el, c, r.att);
  }
  if (!fresh && key === panelKey && el.firstChild && bk.lib === lib) return;
  panelKey = key;
  const tok = ++panelTok, list = r.tab === 'students' && r.stu == null, kept = bk.host === 'page' && !!bk.cols && bk.ver === libVer && bk.lib === lib;
  bkPopClose(); ovTipHide();
  bk = { ...bk, host: 'page', lib, tab: r.tab === 'gradebook' ? 'table' : r.tab === 'charts' ? 'class' : r.tab === 'reports' ? 'rep' : r.tab === 'missing' ? 'miss' : 'one', cls: c.id, stu: r.stu || 0, hi: '', cols: kept ? bk.cols : null };
  if (list) peoplePanel(el, c);
  else el.innerHTML = '<div class="bkbody bkpage" id="bkBody"><p class="muted bkpad">Looking through your saved work…</p></div>';
  const show = () => list ? peopleGrades(c) : bkDraw();
  if (kept) return show();
  bkLoad().then(cols => { if (tok !== panelTok) return; bk.cols = cols; bk.ver = libVer; show(); });
}

/* ---------- charts: shared pieces ---------- */
// The five ranges, lowest first. Their colours are one blue from light to dark (classpage.css), so a darker cell is a higher score.
const CH_BANDS = ['Below 60', '60 to 69', '70 to 79', '80 to 89', '90 to 100'];
const chBand = p => { const v = roundPct(p); return v >= 90 ? 5 : v >= 80 ? 4 : v >= 70 ? 3 : v >= 60 ? 2 : 1; };
const chQ = (v, f) => { const k = (v.length - 1) * f, i = Math.floor(k); return v[i] + (v[Math.ceil(k)] - v[i]) * (k - i); };
const chCut = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
// A name on up to `lines` short lines, for under a chart.
function chLines(name, max, lines) {
  if (!lines) return [];
  const out = []; let cur = '';
  for (const w of String(name).split(/\s+/).filter(Boolean)) { if (!cur) cur = w; else if ((cur + ' ' + w).length <= max) cur += ' ' + w; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur);
  if (out.length > lines) { out[lines - 1] += '…'; out.length = lines; }
  return out.map(l => chCut(l, max + 1));
}
// What fits under one point of a chart that has `step` across for each of its n points: how many letters on a line, and how many lines (none when it's too tight; pointing at the mark still names it).
const chFit = (step, n) => { const chars = Math.floor(step / 6.6); return { chars, lines: chars < 7 ? 0 : n <= 8 ? 2 : 1, dates: step >= 40 ? 1 : 2 }; };
// A bar from x0 to x1 with its far end rounded.
function chBarPath(x0, x1, y, h, r) {
  const d = x1 >= x0 ? 1 : -1, rr = Math.min(r, Math.abs(x1 - x0), h / 2);
  return 'M' + x0 + ' ' + y + 'H' + (x1 - d * rr) + 'Q' + x1 + ' ' + y + ' ' + x1 + ' ' + (y + rr) + 'V' + (y + h - rr) + 'Q' + x1 + ' ' + (y + h) + ' ' + (x1 - d * rr) + ' ' + (y + h) + 'H' + x0 + 'Z';
}
const chTip = (v, l, n) => ' data-tv="' + esc(v) + '" data-tl="' + esc(l) + '" data-tn="' + esc(n || '') + '"';
const chBandLegend = () => CH_BANDS.map((l, i) => '<span><i class="chsw b' + (i + 1) + '"></i>' + l + '</span>');
const chNone = '<p class="muted">Nothing to show yet.</p>';
const chSec = (title, body, cap, id) => '<section' + (id ? ' id="' + id + '"' : '') + '><h3 class="ovh3">' + title + '</h3>' + body + (cap ? '<p class="muted ovcap2">' + cap + '</p>' : '') + '</section>';

/* ---------- every student, every assignment ---------- */
// One small block: a score in its range's blue, or what there is instead of a score.
function chCell(col, cell, who) {
  const tip = (v, note) => chTip(v, who, col.name + (note ? ' · ' + note : ''));
  if (cell && cell.st === 'missing') return '<span class="chc miss"' + tip('Missing') + '>M</span>';
  if (cell && cell.st === 'excused') return '<span class="chc exc"' + tip('Excused') + '>E</span>';
  if (col.type === 'fm') return '<span class="chc fm"' + tip(cell && cell.fb ? 'Feedback given' : 'No feedback yet', 'Formative') + '>' + (cell && cell.fb ? '✓' : '') + '</span>';
  if (!cell || cell.pct == null) return '<span class="chc none"' + tip('Not scored yet') + '></span>';
  const tag = cell.partial ? ['P', 'partly scored'] : cell.out ? ['O', 'left out of the average'] : cell.st === 'late' ? ['L', 'late'] : null;
  return '<span class="chc ' + (bkCounts(cell) ? 'b' + chBand(cell.pct) : 'nc') + '"' + tip(cell.pct + '%', [cell.total != null ? fmtNum(cell.total) + ' / ' + fmtNum(cell.max) : '', tag ? tag[1] : ''].filter(Boolean).join(' · ')) + '>' + cell.pct + (tag ? '<sup>' + tag[0] + '</sup>' : '') + '</span>';
}
function bkHeat(c, all, conf) {
  const cols = all.filter(x => x.type !== 'xc');   // extra credit has no score of its own: it shows in the grade, which is worked out from everything
  if (!cols.length || !c.names.length) return '';
  const sort = bk.sort && (bk.sort.k === 'name' || bk.sort.k === 'grade' || cols.some(x => x.key === bk.sort.k)) ? bk.sort : { k: 'grade', dir: -1 }, scol = cols.find(x => x.key === sort.k);
  const rows = c.names.map((n, i) => ({ n, i, shown: bkWho(n, i), r: bkGrade(n, all, conf) }));
  const val = row => {
    if (sort.k === 'name') return row.i;
    if (sort.k === 'grade') return row.r.grade;
    const cell = scol.cells.get(row.n);
    return scol.type === 'fm' ? (cell && cell.fb ? 1 : 0) : cell && cell.pct != null && cell.st !== 'missing' && cell.st !== 'excused' ? cell.pct : null;
  };
  rows.sort((a, b) => { const x = val(a), y = val(b); return x == null || y == null ? (x == null ? 1 : 0) - (y == null ? 1 : 0) || a.i - b.i : (x - y) * sort.dir || a.i - b.i; });
  const head = (k, inner, cls, label) => '<th class="' + cls + '"' + (sort.k === k ? ' aria-sort="' + (sort.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '><button data-chsort="' + esc(k) + '" title="Sort by ' + esc(label) + '">' + inner + (sort.k === k ? '<span class="charr" aria-hidden="true">' + (sort.dir < 0 ? '▾' : '▴') + '</span>' : '') + '</button></th>';
  const page = bkPage(), name = row => page ? '<a class="bklink" href="' + classHash(c, 'students', row.i) + '">' + esc(row.shown) + '</a>' : '<button class="link" data-bkgo="' + row.i + '">' + esc(row.shown) + '</button>';
  const avg = col => { if (col.type === 'fm') return c.names.filter(n => (col.cells.get(n) || {}).fb).length + '/' + c.names.length; const ps = c.names.map(n => col.cells.get(n)).filter(bkCounts).map(x => x.pct); return ps.length ? roundPct(bkMean(ps)) + '%' : '–'; };
  const gs = rows.map(x => x.r.grade).filter(v => v != null), gname = bk.term === '*' ? 'Grade' : (bkTabs(cols).find(t => t[0] === bk.term) || [, 'Grade'])[1];
  return '<section class="chheat" id="bkHeat"><h3 class="ovh3">Every student, every assignment</h3><div class="chwrap"><table class="chtab"><thead><tr>' + head('name', 'Student', 'chn', 'roster order') +
    cols.map(col => head(col.key, '<i class="chdot ' + (col.type || 'no') + '"></i><span>' + esc(col.name) + '</span><small>' + esc(bkDay(col.due)) + '</small>', 'chh', col.name)).join('') + head('grade', esc(gname), 'chg', 'grade') + '</tr></thead><tbody>' +
    rows.map(row => '<tr><th class="chn" scope="row">' + name(row) + '</th>' + cols.map(col => '<td>' + chCell(col, col.cells.get(row.n), row.shown) + '</td>').join('') + '<td class="chg">' + (row.r.grade != null ? pctAvgText(row.r.grade) : '–') + '</td></tr>').join('') +
    '<tr class="chfoot"><th class="chn" scope="row">Class average</th>' + cols.map(col => '<td>' + avg(col) + '</td>').join('') + '<td class="chg">' + (gs.length ? pctAvgText(bkMean(gs)) : '–') + '</td></tr></tbody></table></div>' +
    '<div class="bkleg chleg">' + chBandLegend().join('') + '<span><i class="chsw miss"></i>Missing</span><span><i class="chsw fm">✓</i>Feedback given (formative)</span><span><i class="chdot sum"></i>Summative</span><span><i class="chdot ic"></i>In-class</span></div>' +
    '<p class="muted ovcap2">The stronger the blue, the higher the score, so a faint row is a student having a hard time and a faint column is an assignment the class found hard. Click a heading to sort by it. L is late; a score with no fill (P partly scored, O left out) isn’t in the average.</p></section>';
}

/* ---------- who is moving: each student's last three scores against their earlier ones ---------- */
function bkMoving(c, cols) {
  const sc = bkScored(cols), list = [];
  c.names.forEach((n, i) => {
    const v = sc.map(col => col.cells.get(n)).filter(bkCounts).map(x => x.pct); if (v.length < 4) return;
    const a = bkMean(v.slice(-3)), b = bkMean(v.slice(0, -3));
    list.push({ name: bkWho(n, i), d: Math.round((a - b) * 10) / 10, a, b });
  });
  if (!list.length) return '<p class="muted" id="bkMove">This shows once a student has four scored assignments ' + (bk.term === '*' || !bkConf().terms.length ? 'this year' : 'in this term') + '.</p>';
  list.sort((x, y) => y.d - x.d);
  const up = list.filter(x => x.d > 0).slice(0, 5), down = list.filter(x => x.d < 0).slice(-5), both = up.concat(down);
  if (!both.length) return '<p class="muted" id="bkMove">No one’s last three scores differ from their earlier ones.</p>';
  const m = Math.max(5, Math.ceil(Math.max(...both.map(x => Math.abs(x.d))) / 5) * 5), step = m > 30 || (m > 15 && bkW() < 520) ? 10 : 5;
  const W = bkW(), L = Math.min(150, Math.round(W * .27)), P = 48, rh = 28, gap = up.length && down.length ? 10 : 0, H = both.length * rh + gap + 30, X = v => L + P + (v + m) / (2 * m) * (W - L - 2 * P);
  let s = '';
  for (let t = -m; t <= m; t += step) if (t) s += '<line x1="' + X(t) + '" x2="' + X(t) + '" y1="0" y2="' + (H - 24) + '" class="tgl"/>';
  for (let t = -m; t <= m; t += step) s += '<text x="' + X(t) + '" y="' + (H - 8) + '" text-anchor="middle" class="ttk">' + (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t) + '</text>';
  both.forEach((x, k) => {
    const y = k * rh + (k >= up.length ? gap : 0) + 4, x0 = X(0), far = Math.abs(X(x.d) - x0) < 5 ? x0 + (x.d > 0 ? 5 : -5) : X(x.d), txt = (x.d > 0 ? '+' : '−') + Math.abs(x.d).toFixed(1);
    s += '<text x="0" y="' + (y + 13) + '" class="tlb">' + esc(chCut(x.name, Math.floor(L / 6.6))) + '</text><path d="' + chBarPath(x0, far, y, 18, 4) + '" class="chmv ' + (x.d > 0 ? 'up' : 'down') + '" tabindex="0"' + chTip(txt + ' points', x.name, 'Last three ' + pctAvgText(x.a) + ', earlier ' + pctAvgText(x.b)) + '/>' +
      '<text x="' + (far + (x.d > 0 ? 6 : -6)) + '" y="' + (y + 13) + '" text-anchor="' + (x.d > 0 ? 'start' : 'end') + '" class="tlb me">' + txt + '</text>';
  });
  s += '<line x1="' + X(0) + '" x2="' + X(0) + '" y1="0" y2="' + (H - 24) + '" class="chzero"/>';
  return '<svg class="tsvg" id="bkMove" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(both.map(x => x.name + ' ' + (x.d > 0 ? 'up ' : 'down ') + Math.abs(x.d).toFixed(1)).join(', ')) + '">' + s + '</svg>' +
    '<div class="bkleg"><span><i class="chsw up"></i>Rising</span><span><i class="chsw down"></i>Dropping</span></div>';
}

/* ---------- where the class stands: how many students landed in each range, assignment by assignment ---------- */
function bkStacks(c, cols) {
  const sc = bkScored(cols).map(col => { const by = [[], [], [], [], []]; c.names.forEach((n, i) => { const cell = col.cells.get(n); if (bkCounts(cell)) by[chBand(cell.pct) - 1].push(bkWho(n, i)); }); return { col, by, n: by.reduce((a, b) => a + b.length, 0) }; }).filter(x => x.n);
  if (!sc.length) return chNone;
  const most = Math.max(...sc.map(x => x.n)), tick = most <= 6 ? 1 : most <= 12 ? 2 : most <= 20 ? 5 : most <= 40 ? 10 : 20, top = Math.ceil(most / tick) * tick;
  const n = sc.length, W = bkW(), L = 34, R = 6, T = 8, PH = 190, step = (W - L - R) / n, fit = chFit(step, n), lines = fit.lines, H = T + PH + 24 + lines * 14, bw = Math.max(8, Math.min(52, step * .62)), Y = v => T + PH - v / top * PH;
  let s = '';
  for (let v = 0; v <= top; v += tick) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="tgl"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ttk">' + v + '</text>';
  sc.forEach((x, i) => {
    const cx = L + step * (i + .5); let acc = 0;
    x.by.forEach((names, b) => {
      if (!names.length) return;
      const y0 = Y(acc), y1 = Y(acc + names.length), h = Math.max(2, y0 - y1 - 2); acc += names.length;
      s += '<rect x="' + (cx - bw / 2) + '" y="' + (y0 - 1 - h) + '" width="' + bw + '" height="' + h + '" rx="2" class="chseg b' + (b + 1) + '" tabindex="0"' + chTip(people(names.length, 'student'), CH_BANDS[b] + ' · ' + x.col.name, names.join(', ')) + '/>';
    });
    chLines(x.col.name, fit.chars, lines).forEach((l, k) => { s += '<text x="' + cx + '" y="' + (T + PH + 16 + k * 14) + '" text-anchor="middle" class="tlb">' + esc(l) + '</text>'; });
    if (i % fit.dates === 0) s += '<text x="' + cx + '" y="' + (H - 4) + '" text-anchor="middle" class="ttk">' + esc(bkDay(x.col.due)) + '</text>';
  });
  return '<svg class="tsvg" id="bkStacks" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(sc.map(x => x.col.name + ': ' + x.by.map((b, i) => b.length ? b.length + ' ' + CH_BANDS[i].toLowerCase() : '').filter(Boolean).join(', ')).join('. ')) + '">' + s + '</svg>' +
    '<div class="bkleg">' + chBandLegend().reverse().join('') + '</div>';
}

/* ---------- rubric rows across the summatives ---------- */
const chRowName = x => typeof x === 'string' ? x.trim() : String((x && x.name) || '').trim();
// For each summative scored with a rubric: every row's scores, under the row's name in small letters so the same row matches from one assignment to the next.
// only: one student's rows. A paper she left out of the average is left out here too.
function chRowAvgs(c, cols, only) {
  return cols.filter(x => x.type === 'sum').map(col => {
    const by = new Map();
    for (const n of only ? [only] : c.names) {
      const cell = col.cells.get(n); if (!cell || !cell.rows || cell.out || cell.st === 'missing' || cell.st === 'excused') continue;
      for (const [nm, v] of cell.rows) { const name = chRowName(nm), k = name.toLowerCase(); if (!k || v == null || isNaN(+v)) continue; if (!by.has(k)) by.set(k, { name, v: [] }); by.get(k).v.push(+v); }
    }
    return { col, by };
  }).filter(x => x.by.size);
}
function bkRubricRows(c, cols) {
  const per = chRowAvgs(c, cols);
  if (!per.length) return '<p class="muted" id="bkRows">This shows once a summative has been scored with a rubric.</p>';
  const keys = []; for (const p of per) for (const k of p.by.keys()) if (!keys.includes(k)) keys.push(k);
  const series = keys.map(k => { const pts = per.map(p => p.by.has(k) ? bkMean(p.by.get(k).v) : null), have = pts.filter(v => v != null); return { k, name: per.find(p => p.by.has(k)).by.get(k).name, pts, mean: bkMean(have), last: have[have.length - 1], at: pts.reduce((a, v, i) => v != null ? i : a, 0) }; });
  const low = series.reduce((a, b) => b.mean < a.mean ? b : a), vals = series.flatMap(x => x.pts).filter(v => v != null);
  const hi = 4, lo = Math.max(0, Math.min(hi - 1, Math.floor(Math.min(...vals) - .25))), tick = hi - lo > 2 ? 1 : .5;
  const n = per.length, W = bkW(), L = 34, R = Math.min(176, Math.round(W * .3)), T = 12, B = 58, H = 250, X = i => n === 1 ? L + (W - L - R) / 2 : L + 20 + i * (W - L - R - 40) / (n - 1), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let s = '';
  for (let v = lo; v <= hi + 1e-9; v += tick) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="tgl"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ttk">' + v + '</text>';
  const room = Math.max(8, Math.floor((W - L - R) / n / 6.6));
  per.forEach((p, i) => { chLines(p.col.name, room, 2).forEach((l, j) => { s += '<text x="' + X(i) + '" y="' + (H - B + 18 + j * 14) + '" text-anchor="middle" class="tlb">' + esc(l) + '</text>'; }); s += '<text x="' + X(i) + '" y="' + (H - 4) + '" text-anchor="middle" class="ttk">' + esc(bkDay(p.col.due)) + '</text>'; });
  for (const x of series.filter(y => y !== low).concat([low])) {
    const cls = x === low ? ' lo' : '', seg = []; let run = [];
    x.pts.forEach((v, i) => { if (v == null) { if (run.length) seg.push(run); run = []; } else run.push(X(i) + ',' + Y(v)); }); if (run.length) seg.push(run);
    s += seg.map(r => '<polyline class="chrl' + cls + '" points="' + r.join(' ') + '"/>').join('');
    x.pts.forEach((v, i) => { if (v != null) s += '<circle class="chrd' + cls + '" cx="' + X(i) + '" cy="' + Y(v) + '" r="5" tabindex="0"' + chTip(fmtNum(Math.round(v * 10) / 10) + ' out of 4', x.name + ' · ' + per[i].col.name, people(per[i].by.get(x.k).v.length, 'paper')) + '/>'; });
  }
  // each row's name at the right, beside where its line ends; pushed apart so no two sit on each other
  const labs = series.map(x => ({ x, y: Y(x.last) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 15) labs[i].y = labs[i - 1].y + 15;
  const over = labs.length ? labs[labs.length - 1].y - (H - B + 6) : 0; if (over > 0) for (const l of labs) l.y -= over;
  for (const l of labs) s += '<text x="' + (W - R + 14) + '" y="' + (l.y + 4) + '" class="tlb' + (l.x === low ? ' me' : '') + '">' + esc(chCut(l.x.name, Math.max(6, Math.floor((R - 44) / 6.6)))) + ' ' + fmtNum(Math.round(l.x.last * 10) / 10) + '</text>';
  return '<svg class="tsvg" id="bkRows" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(series.map(x => x.name + ': ' + x.pts.map((v, i) => v != null ? per[i].col.name + ' ' + fmtNum(Math.round(v * 10) / 10) : '').filter(Boolean).join(', ')).join('. ')) + '">' + s + '</svg>';
}

/* ---------- summatives against in-class work: one dot per student ---------- */
function bkScatter(c, cols, conf) {
  const pts = c.names.map((n, i) => { const r = bkGrade(n, cols, conf); return r.by.sum != null && r.by.ic != null ? { name: bkWho(n, i), x: r.by.ic, y: r.by.sum } : null; }).filter(Boolean);
  if (pts.length < 2) return '<p class="muted" id="bkScatter">This shows once students have both a summative and an in-class score.</p>';
  const all = pts.flatMap(p => [p.x, p.y]), lo = Math.max(0, Math.floor((Math.min(...all) - 3) / 10) * 10), hi = Math.max(100, Math.ceil(Math.max(...all) / 10) * 10);
  const W = Math.min(480, bkW()), H = Math.round(W * .72), L = 58, R = 16, T = 12, B = 46, X = v => L + (v - lo) / (hi - lo) * (W - L - R), Y = v => T + (hi - v) / (hi - lo) * (H - T - B), tick = hi - lo > 60 ? 20 : 10;
  let s = '';
  for (let v = lo; v <= hi; v += tick) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="tgl"/><line x1="' + X(v) + '" x2="' + X(v) + '" y1="' + T + '" y2="' + (H - B) + '" class="tgl"/>' +
    '<text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ttk">' + v + '%</text><text x="' + X(v) + '" y="' + (H - B + 16) + '" text-anchor="middle" class="ttk">' + v + '%</text>';
  s += '<line x1="' + X(lo) + '" y1="' + Y(lo) + '" x2="' + X(hi) + '" y2="' + Y(hi) + '" class="chdiag"/>' +
    '<text x="' + (L + 8) + '" y="' + (T + 16) + '" class="ttk">Stronger on summatives</text><text x="' + (W - R - 8) + '" y="' + (H - B - 8) + '" text-anchor="end" class="ttk">Stronger in class</text>' +
    '<text x="' + (L + (W - L - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="ttk">In-class average</text><text transform="translate(12 ' + (T + (H - T - B) / 2) + ') rotate(-90)" text-anchor="middle" class="ttk">Summative average</text>';
  for (const p of pts) s += '<circle class="chpt" cx="' + X(Math.min(hi, p.x)) + '" cy="' + Y(Math.min(hi, p.y)) + '" r="5.5" tabindex="0"' + chTip(p.name, 'Summatives ' + pctAvgText(p.y), 'In-class ' + pctAvgText(p.x)) + '/>';
  // the two students furthest from the line get their names
  for (const p of [...pts].sort((a, b) => Math.abs(b.y - b.x) - Math.abs(a.y - a.x)).slice(0, 2)) if (Math.abs(p.y - p.x) >= 8) {
    const up = p.y > p.x, nm = chCut(p.name, 20), w = nm.length * 6.8, left = up ? X(p.x) - 10 - w >= L + 4 : X(p.x) + 10 + w > W - R;   // above the line there's room to the upper left, below it to the lower right
    s += '<text x="' + (X(p.x) + (left ? -10 : 10)) + '" y="' + (Y(p.y) + (up ? -4 : 13)) + '" text-anchor="' + (left ? 'end' : 'start') + '" class="tlb me">' + esc(nm) + '</text>';
  }
  return '<svg class="tsvg chsq" style="max-width:' + W + 'px" id="bkScatter" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(pts.map(p => p.name + ': summatives ' + pctAvgText(p.y) + ', in-class ' + pctAvgText(p.x)).join('. ')) + '">' + s + '</svg>';
}

/* ---------- one student ---------- */
// Every assignment in date order, each as one block: scored, missing, late, or feedback given.
function bkStrip(c, all, n) {
  const cols = all.filter(x => x.type !== 'xc' || x.cells.get(n));
  if (!cols.length) return '';
  return '<section class="chstripsec" id="bkStrip"><h3 class="ovh3">' + (bk.term === '*' || !bkConf().terms.length ? 'The year so far' : 'The term so far') + '</h3><div class="chstrip">' + cols.map(col => {
    const cell = col.cells.get(n); let cls = 'none', txt = 'Not scored yet';
    if (col.type === 'xc') { cls = 'xc'; txt = '+' + fmtNum(cell.xc) + ' extra'; }
    else if (cell && cell.st === 'missing') { cls = 'miss'; txt = 'Missing'; }
    else if (cell && cell.st === 'excused') { cls = 'exc'; txt = 'Excused'; }
    else if (col.type === 'fm') { cls = 'fm'; txt = cell && cell.fb ? '✓ Feedback given' : cell && cell.started ? 'Started' : 'No feedback yet'; }
    else if (cell && cell.pct != null) { cls = bkCounts(cell) ? 'b' + chBand(cell.pct) : 'nc'; txt = cell.pct + '%' + (cell.partial ? ' · partial' : cell.out ? ' · left out' : cell.st === 'late' ? ' · late' : ''); }
    return '<div class="chsi"><span class="chc ' + cls + '"' + (cell && cell.total != null ? ' title="' + esc(fmtNum(cell.total) + ' / ' + fmtNum(cell.max)) + '"' : '') + '>' + txt + '</span><b>' + esc(col.name) + '</b><small>' + esc(bkLabel(col.type, true)) + (col.due ? ' · ' + esc(bkDay(col.due)) : '') + '</small></div>';
  }).join('') + '</div><div class="bkleg chleg">' + chBandLegend().join('') + '<span><i class="chsw miss"></i>Missing</span><span><i class="chsw fm"></i>Formative</span></div></section>';
}
// The student's scores as a line over the class's middle half, so it's clear when a score is unusual and when the assignment was just hard.
function bkBandLine(c, sc, n, shown) {
  const cols = sc.map(col => { const v = c.names.map(x => col.cells.get(x)).filter(bkCounts).map(x => x.pct).sort((a, b) => a - b), cell = col.cells.get(n); return { col, v, me: bkCounts(cell) ? cell.pct : null, miss: !!cell && cell.st === 'missing' }; }).filter(x => x.v.length || x.miss);
  if (!cols.length) return chNone;
  const q = cols.map(x => x.v.length ? [chQ(x.v, .25), chQ(x.v, .5), chQ(x.v, .75)] : null), vals = q.filter(Boolean).flat().concat(cols.map(x => x.me).filter(v => v != null));
  if (!vals.length) return chNone;
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 8) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...vals) + 2) / 10) * 10) || 100;
  const k = cols.length, W = bkW(), L = 44, R = 30, fit = chFit((W - L - R) / Math.max(1, k), k), lines = fit.lines, T = 16, B = 26 + lines * 14, H = 190 + B, X = i => L + (k === 1 ? (W - L - R) / 2 : i * (W - L - R) / (k - 1)), Y = v => T + (hi - Math.min(hi, v)) / Math.max(10, hi - lo) * (H - T - B);
  let s = '';
  for (let v = lo; v <= hi; v += 10) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="tgl"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ttk">' + v + '%</text>';
  // the band and the class's middle score, in runs: an assignment nobody has a counted score on breaks them
  const runs = []; let run = [];
  q.forEach((x, i) => { if (!x) { if (run.length) runs.push(run); run = []; } else run.push(i); }); if (run.length) runs.push(run);
  for (const r of runs) {
    if (r.length === 1) { const i = r[0]; s += '<rect class="chband" x="' + (X(i) - 14) + '" y="' + Y(q[i][2]) + '" width="28" height="' + Math.max(2, Y(q[i][0]) - Y(q[i][2])) + '"/><line class="chmed" x1="' + (X(i) - 14) + '" x2="' + (X(i) + 14) + '" y1="' + Y(q[i][1]) + '" y2="' + Y(q[i][1]) + '"/>'; continue; }
    s += '<polygon class="chband" points="' + r.map(i => X(i) + ',' + Y(q[i][2])).concat([...r].reverse().map(i => X(i) + ',' + Y(q[i][0]))).join(' ') + '"/><polyline class="chmed" points="' + r.map(i => X(i) + ',' + Y(q[i][1])).join(' ') + '"/>';
  }
  const seg = []; run = [];
  cols.forEach((x, i) => { if (x.me == null) { if (run.length) seg.push(run); run = []; } else run.push(X(i) + ',' + Y(x.me)); }); if (run.length) seg.push(run);
  s += seg.map(r => '<polyline class="bkln" points="' + r.join(' ') + '"/>').join('');
  cols.forEach((x, i) => {
    if (x.me != null) s += '<circle class="bkdot ' + (x.col.type || '') + '" cx="' + X(i) + '" cy="' + Y(x.me) + '" r="5.5" tabindex="0"' + chTip(x.me + '%', x.col.name, bkLabel(x.col.type) + (q[i] ? ' · class middle half ' + roundPct(q[i][0]) + '–' + roundPct(q[i][2]) + '%' : '')) + '/>';
    else if (x.miss) s += '<circle class="chmiss" cx="' + X(i) + '" cy="' + (H - B - 10) + '" r="6" tabindex="0"' + chTip('Missing', x.col.name) + '/><text x="' + X(i) + '" y="' + (H - B - 22) + '" text-anchor="middle" class="ttk">missing</text>';
    chLines(x.col.name, fit.chars, lines).forEach((l, j) => { s += '<text x="' + X(i) + '" y="' + (H - B + 18 + j * 14) + '" text-anchor="middle" class="tlb">' + esc(l) + '</text>'; });
    if (i % fit.dates === 0) s += '<text x="' + X(i) + '" y="' + (H - 4) + '" text-anchor="middle" class="ttk">' + esc(bkDay(x.col.due)) + '</text>';
  });
  return '<svg class="tsvg" id="bkStuLine" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cols.map((x, i) => x.col.name + ' ' + (x.me != null ? x.me + '%' : x.miss ? 'missing' : '–') + (q[i] ? ', class middle ' + roundPct(q[i][1]) + '%' : '')).join('. ')) + '">' + s + '</svg>' +
    '<div class="bkleg"><span><i class="me"></i>' + esc(shown) + '</span><span><i class="sum"></i>Summative</span><span><i class="ic"></i>In-class</span><span><i class="chsw band"></i>Middle half of the class</span><span><i class="mute"></i>Class middle score</span></div>';
}
// This student's average on each rubric row across the summatives, with the class average as a tick.
function bkStuRows(c, cols, n) {
  const fold = per => { const m = new Map(); for (const p of per) for (const [k, e] of p.by) { if (!m.has(k)) m.set(k, { name: e.name, v: [] }); m.get(k).v.push(...e.v); } return m; };
  const mine = fold(chRowAvgs(c, cols, n)), cls = fold(chRowAvgs(c, cols));
  if (!mine.size) return '<p class="muted" id="bkStuRows">This shows once a summative of theirs has been scored with a rubric.</p>';
  const one = v => fmtNum(Math.round(v * 10) / 10);
  return '<div id="bkStuRows">' + [...mine].map(([k, e]) => { const v = bkMean(e.v), cv = cls.has(k) ? bkMean(cls.get(k).v) : null;
    return '<div class="bkcmp chrow"' + chTip(one(v) + ' out of 4', e.name, people(e.v.length, 'summative') + (cv != null ? ' · class average ' + one(cv) : '')) + ' tabindex="0"><span title="' + esc(e.name) + '">' + esc(e.name) + '</span><div class="bkcmpt"><i style="width:' + Math.min(100, v / 4 * 100) + '%"></i>' + (cv != null ? '<em style="left:' + Math.min(100, cv / 4 * 100) + '%"></em>' : '') + '</div><b>' + one(v) + '</b><small>' + (cv != null ? 'class ' + one(cv) : '') + '</small></div>'; }).join('') + '</div>';
}
// A window that changes size: the charts are drawn again at their new width, unless she's part-way through something in the gradebook.
let chResize = 0;
window.addEventListener('resize', () => { clearTimeout(chResize); chResize = setTimeout(() => { if (bkPage() && $('#bkBody') && bk.tab !== 'table' && bk.cols && !$('#bkAdd') && !$('#bkSetup') && !$('.bktypes')) bkDraw(); }, 200); });
Object.assign(window.__gs, { classPanelDraw, chBand, chRowAvgs });
