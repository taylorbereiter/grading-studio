/* ---------------- an open assignment's tabs: Mark, Grades, Insights, Return (11/10) ---------------- */
// app.js keeps the addresses and draws each tab's screen on the page (tabNext, tabShow). Here: the tab bar itself, and what each tab gained
// when it stopped being a box: the grade on the paper beside her score, the cards on Return, "Returned", and three more charts.
function tabsRender() {
  if (!batch) return;
  const r = routeNow(), on = r.v === 'a' ? r.tab : '';
  for (const a of document.querySelectorAll('#aTabs .atab')) {
    const h = batchHash(batch.id, a.dataset.atab), cur = a.dataset.atab === on;
    if (a.getAttribute('href') !== h) a.setAttribute('href', h);
    a.classList.toggle('on', cur);
    if (cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

/* ---------- Grades: what the paper itself says, beside her score ---------- */
// One student's cell. chk: it needs her (the paper and her score disagree, or the paper has more than one grade, or a doubtful one).
function glPaperOf(st) {
  if (!st.files.length || noScore(st)) return { html: '', chk: false };
  const sheet = batchHash(batch.id, 'grades/sheet'), g = gradeOf(st), open = g.total == null && g.pct == null;
  const ask = (t, tip) => '<a class="opchip warn" href="' + sheet + '" title="' + esc(tip) + '">' + esc(t) + '</a>';
  if (manyReads(st)) return { html: ask(readsCount(st) + ' grades · pick one', 'More than one grade is written on this paper. Say which one counts on the grade sheet.'), chk: true };
  if (open && st.doubts && st.doubts.length) return { html: ask('“' + foundLabel(st.doubts[0]) + '”? confirm', 'This may be the grade, or may not. Confirm it on the grade sheet.'), chk: true };
  const note = disagreeNote(st), ws = st.files.map(wordScore).filter(w => w && w.total != null);
  const ty = st.grade.sheet, said = st.found && st.found.found ? foundLabel(st.found) : ty !== '' && ty != null && !isNaN(+ty) ? fmtNum(+ty) : ws.length === 1 ? fmtNum(ws[0].total) + (ws[0].max ? '/' + fmtNum(ws[0].max) : '') : '';
  if (!said && st.doubts && st.doubts.length) return { html: '<span class="muted" title="This may be a grade written on the paper. Your own score is the one that counts.">' + esc(foundLabel(st.doubts[0])) + ' ?</span>', chk: false };
  if (!said) return { html: '<span class="muted">–</span>', chk: false };
  return { html: '<span class="opv">' + esc(said) + '</span>' + (note ? ' ' + ask('differs', note + '.') : ''), chk: !!note };
}
const glSig = () => batch.students.map(st => cellCopy(gradeOf(st), 'total') + '/' + cellCopy(gradeOf(st), 'pct')).join('|');
// Fills the column. The files are read first if they haven't been; a grade read off a paper can change a total, and then the whole list is drawn again.
function glPaper() {
  const t = $('#glTable'); if (!t || !batch) return;
  const fill = () => {
    let n = 0;
    for (const td of t.querySelectorAll('td.op[data-op]')) {
      const r = glPaperOf(batch.students[+td.dataset.op]);
      td.innerHTML = r.html; td.parentElement.classList.toggle('chk', r.chk); if (r.chk) n++;
    }
    const el = $('#glChk');
    el.hidden = !n;
    el.innerHTML = n ? '<b>' + n + ' to check</b><span>The grade on the paper differs from your score, or needs you to pick or confirm it.</span><button class="link" data-glonly>Show only these</button><a class="link" href="' + batchHash(batch.id, 'grades/sheet') + '">Open the grade sheet</a>' : '';
    if (!n) t.classList.remove('only');
  };
  if (scanned && !scanP) return fill();
  for (const td of t.querySelectorAll('td.op[data-op]')) td.innerHTML = '<span class="muted">…</span>';
  const b0 = batch, was = glSig();
  scanAll().then(() => {
    if (batch !== b0 || !t.isConnected) return;
    if (glSig() !== was) openGrades(); else fill();
  });
}

/* ---------- Return: "Returned", one student at a time, and the Claude steps ---------- */
function returnedHtml() {
  const r = batch && batch.returned; if (!r) return '';
  const d = new Date(r.t), hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), today = d.toDateString() === new Date().toDateString();
  return '<p class="rtdone"><span>✓ Returned ' + (today ? 'today at ' + esc(hm) : 'on ' + esc(d.toLocaleDateString([], { day: 'numeric', month: 'short' }))) + ' · ' + r.n + (r.n === 1 ? ' file' : ' files') + '.</span> <button class="link" data-unreturn>Mark as not returned</button></p>';
}
function returnedDraw() { const el = $('#rtState'); if (el) el.innerHTML = returnedHtml(); }
// The marked files went out (ZIP, folder or Drive): the assignment says Returned on Home and on its class page. One click takes it back.
function setReturned(n, said) {
  if (!batch) return;
  const b0 = batch, was = batch.returned;
  batch.returned = { t: Date.now(), n }; saveSoon();
  if ($('#rtState')) returnedDraw();
  else toastDo((said || 'Done.') + ' This assignment is marked as returned.', 'Undo', () => { if (batch !== b0) return; batch.returned = was; saveSoon(); });
}
function returnSideHtml() {
  const st = batch.students[cur], who = st && st.files.length ? (anonOn() ? 'this paper' : esc(st.key) + '’s paper') : '';
  const sent = batch.students.map((s, i) => ({ s, i })).filter(x => x.s.grade.sent).sort((a, b) => b.s.grade.sent - a.s.grade.sent);
  const re = scanRescans(), nRe = new Set(re.map(x => x.i)).size;
  const row = (t, s, act, label) => '<div class="rtrow"><span><b>' + t + '</b><small>' + s + '</small></span><button class="btn sm" data-rtask="' + act + '">' + label + '</button></div>';
  return '<aside class="rtside" id="rtSide" aria-label="Other ways to give work back">' +
    anchorCardHtml() + '<section class="rtcard" id="rtOne"><h3>One student at a time</h3><p class="muted">Give one student their marked paper now, without waiting for the rest.</p>' +
      (sent.length ? '<ul class="rtsent">' + sent.slice(0, 6).map(x => '<li><button class="link" data-chk="' + x.i + '">' + esc(shownName(x.s, x.i)) + '</button> <span class="muted">exported ' + esc(sentWhen(x.s.grade.sent)) + '</span></li>').join('') + (sent.length > 6 ? '<li class="muted">and ' + (sent.length - 6) + ' more</li>' : '') + '</ul>' : '') +
      (who ? '<button class="btn" data-rtone>Export ' + who + '</button>' : '<p class="muted">Open a student’s paper on the Mark tab first.</p>') + '</section>' +
    '<section class="rtcard" id="rtClaude"><h3>Ask Claude <span class="muted">(optional)</span></h3>' +
      row('Papers with names covered', 'A ZIP of every page as a picture', 'papers', 'Check the covers') +
      row('Marks only', 'One file: scores, rubric and your marks', 'marks', 'Make the file') +
      row('Bring back Claude’s feedback', 'Paste a reply, and it goes to each student', 'back', 'Paste a reply') + '</section>' +
    (re.length ? '<section class="rtcard" id="rtRescan"><h3>Rescans</h3>' + row(re.length + (re.length === 1 ? ' page is' : ' pages are') + ' flagged for a rescan', 'From ' + nRe + (nRe === 1 ? ' student' : ' students'), 'rescan', 'Show') + '</section>' : '') +
    '</aside>';
}
// true when the click was one of these cards'.
function returnSideClick(e) {
  if (anchorCardClick(e)) return true;
  if (e.target.closest('[data-unreturn]')) { delete batch.returned; saveSoon(); returnedDraw(); toast('Marked as not returned'); return true; }
  if (e.target.closest('[data-rtone]')) {
    const st = batch.students[cur], b0 = batch;
    toast('Making ' + (anonOn() ? 'this paper' : st.key + '’s paper') + '…');
    exportOne(st).then(() => { const el = $('#rtSide'); if (el && batch === b0) el.outerHTML = returnSideHtml(); });
    return true;
  }
  const a = e.target.closest('[data-rtask]'); if (!a) return false;
  const k = a.dataset.rtask;
  if (k === 'back') openBringBack();
  else if (k === 'rescan') openRescans();
  else { openShare(); if ($('#shMarks') && $('#dlgBox [data-kind="' + k + '"]')) shareKind(k); }
  return true;
}

/* ---------- Insights: how each row was scored, change since the last summative, and the same assignment in her other classes ---------- */
// Every scored row counted by level, in the rubric's own order. A half point counts with the whole number below it.
function insRowsHtml() {
  if (setup.mode !== 'rubric') return '';
  const lv = [0, 1, 2, 3, 4], rows = setup.criteria.map((name, r) => {
    const by = lv.map(() => []);
    batch.students.forEach((st, i) => { const v = st.grade.outAvg ? null : rowShown(st, r); if (v != null) by[Math.max(0, Math.min(4, Math.floor(v)))].push(shownName(st, i)); });
    return { name, by, n: by.reduce((a, b) => a + b.length, 0) };
  });
  if (!rows.some(x => x.n)) return '';
  const zero = rows.some(x => x.by[0].length), shown = zero ? lv : lv.slice(1);
  return '<section id="insRows"><h3 class="ovh3">How each row was scored</h3><div class="insrows" role="group" aria-label="Papers at each score, row by row">' + rows.map(x =>
    '<div class="insr"><div class="insn" title="' + esc(x.name) + '">' + esc(x.name) + '</div><div class="inst">' + (x.n ? shown.map(v => { const who = x.by[v], k = who.length; if (!k) return '';
      return '<i class="chseg b' + (v + 1) + '" style="flex:' + k + '" tabindex="0" aria-label="' + esc(x.name + ': ' + people(k, 'paper') + ' at ' + v) + '"' + chTip(people(k, 'paper') + ' · ' + Math.round(k / x.n * 100) + '%', 'Scored ' + v + ' on ' + x.name, who.slice(0, 12).join(', ') + (k > 12 ? ' and ' + (k - 12) + ' more' : '')) + '>' + (k / x.n > .07 ? k : '') + '</i>'; }).join('') : '<span class="muted">No scores yet</span>') + '</div></div>').join('') +
    '</div><div class="bkleg">' + shown.map(v => '<span><i class="chsw b' + (v + 1) + '"></i>' + v + '</span>').join('') + '</div>' +
    '<p class="muted ovcap2">How many papers got each score on each row, in the rubric’s order. A half point counts with the whole number below it. The stronger the blue, the higher the score.</p></section>';
}
// This assignment's finished percents by roster name, as they stand on screen now.
function insNow(c) {
  const m = rosterMatch(c.names), max = maxPoints(), out = new Map();
  c.names.forEach((n, k) => {
    const st = m.get(n); if (!st) return;
    const g = gradeOf(st), i = batch.students.indexOf(st);
    if (g.status === 'missing' || g.status === 'excused' || g.partial || g.out || !g.done || g.pct == null || !onThisScale(st, g, max)) return;
    out.set(n, { pct: g.pct, i, name: shownName(st, i) });
  });
  return out;
}
const insW = () => { const b = $('#ovBody'), room = b ? b.clientWidth - 48 : 0, n = room > 780 ? 2 : 1; return room > 0 ? Math.max(340, Math.min(760, Math.round((room - (n - 1) * 28) / n))) : 640; };
// One row per student: where they were on the last summative, and where they are on this one.
function insMoveHtml(c, cols, me) {
  const mine = me ? cols.find(x => x.key === me.id) : null, due = (mine && mine.due) || (me && me.due) || isoDay(Date.now());
  const prev = cols.filter(x => x.type === 'sum' && (!me || x.key !== me.id) && x.dl !== batch.id && (!x.due || x.due <= due) && c.names.some(n => bkCounts(x.cells.get(n)))).sort((a, b) => (a.due || '').localeCompare(b.due || '')).pop();
  const head = '<section id="insMove"><h3 class="ovh3">Change since the last summative</h3>';
  if (!prev) return head + '<p class="muted">This shows once ' + esc(c.name) + ' has an earlier summative scored in this browser.</p></section>';
  const now = insNow(c), list = [];
  for (const n of c.names) { const a = prev.cells.get(n), b = now.get(n); if (bkCounts(a) && b) list.push({ name: b.name, i: b.i, a: a.pct, b: b.pct, d: b.pct - a.pct }); }
  if (!list.length) return head + '<p class="muted">No student has a finished score on both this and ' + esc(prev.name) + ' yet.</p></section>';
  list.sort((x, y) => y.d - x.d || natural(x.name, y.name));
  const all = list.flatMap(x => [x.a, x.b]), lo = Math.max(0, Math.floor((Math.min(...all) - 4) / 10) * 10), W = insW(), L = Math.min(150, Math.round(W * .28)), R = 46, rh = 24, T = 6, H = T + list.length * rh + 26, X = v => L + (Math.min(100, v) - lo) / (100 - lo) * (W - L - R);
  let s = '';
  for (let t = lo; t <= 100; t += 10) s += '<line x1="' + X(t) + '" x2="' + X(t) + '" y1="' + T + '" y2="' + (H - 22) + '" class="tgl"/><text x="' + X(t) + '" y="' + (H - 6) + '" text-anchor="middle" class="ttk">' + t + '%</text>';
  list.forEach((x, k) => {
    const y = T + k * rh + rh / 2, dir = x.d > 0 ? 'up' : x.d < 0 ? 'down' : 'same', txt = (x.d > 0 ? '+' : x.d < 0 ? '−' : '') + Math.abs(Math.round(x.d));
    s += '<g class="insdb ' + dir + '" tabindex="0" role="button" data-ovgo="' + x.i + '" aria-label="' + esc(x.name + ': ' + x.a + '% then ' + x.b + '%') + '"' + chTip(txt + ' points', x.name, prev.name + ' ' + x.a + '%, this one ' + x.b + '%') + '>' +
      '<rect x="0" y="' + (y - rh / 2) + '" width="' + W + '" height="' + rh + '" class="inshit"/><text x="0" y="' + (y + 4) + '" class="tlb">' + esc(chCut(x.name, Math.floor(L / 6.8))) + '</text>' +
      '<line x1="' + X(x.a) + '" x2="' + X(x.b) + '" y1="' + y + '" y2="' + y + '" class="insln"/><circle cx="' + X(x.a) + '" cy="' + y + '" r="4.5" class="inswas"/><circle cx="' + X(x.b) + '" cy="' + y + '" r="5.5" class="insnow"/>' +
      '<text x="' + (W - 2) + '" y="' + (y + 4) + '" text-anchor="end" class="tlb me">' + txt + '</text></g>';
  });
  const up = list.filter(x => x.d > 0).length, down = list.filter(x => x.d < 0).length;
  return head + '<svg class="tsvg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc('Each student’s percent on ' + prev.name + ' and on this assignment') + '">' + s + '</svg>' +
    '<div class="bkleg"><span><i class="insk was"></i>' + esc(chCut(prev.name, 28)) + (prev.due ? ' · ' + esc(bkDay(prev.due)) : '') + '</span><span><i class="insk now"></i>This one</span><span><i class="chsw up"></i>Up (' + up + ')</span><span><i class="chsw down"></i>Down (' + down + ')</span></div>' +
    '<p class="muted ovcap2">Each student’s percent on the last summative and on this one, biggest rise first. Finished scores only. Click a row to open that paper.</p></section>';
}
// The other classes that were given this same assignment: lowest to highest, the middle half, the middle score and the average of each.
function insAcrossHtml(c, all, me, s) {
  if (!me || !me.group) return '';
  const rows = [];
  for (const k of lib.classes) {
    const it = k.units.flatMap(u => u.items).find(x => x.group === me.group); if (!it) continue;
    let ps;
    if (k === c) ps = s.counted.map(x => x.pct).filter(v => v != null);
    else { const col = bkClassCols(k, all).find(x => x.key === it.id); ps = col ? k.names.map(n => col.cells.get(n)).filter(bkCounts).map(x => x.pct) : []; }
    rows.push({ k, ps: ps.sort((a, b) => a - b) });
  }
  if (rows.length < 2) return '';
  const lo = Math.max(0, Math.floor((Math.min(100, ...rows.flatMap(r => r.ps)) - 4) / 10) * 10), X = v => (Math.min(100, v) - lo) / (100 - lo) * 100, ticks = [];
  for (let t = lo; t <= 100; t += 10) ticks.push(t);
  return '<section id="insAcross"><h3 class="ovh3">The same assignment in your other classes</h3><div class="insx" role="group">' + rows.map(r => {
    if (!r.ps.length) return '<div class="insxr' + (r.k === c ? ' me' : '') + '"><span class="insxn">' + esc(r.k.name) + '</span><div class="insxt"></div><span class="muted insxv">no scores yet</span></div>';
    const q1 = chQ(r.ps, .25), q2 = chQ(r.ps, .5), q3 = chQ(r.ps, .75), avg = bkMean(r.ps);
    return '<div class="insxr' + (r.k === c ? ' me' : '') + '" tabindex="0"' + chTip(pctAvgText(avg) + ' average', r.k.name, people(r.ps.length, 'finished score') + ', from ' + r.ps[0] + '% to ' + r.ps[r.ps.length - 1] + '%, middle ' + Math.round(q2) + '%') + '><span class="insxn">' + esc(r.k.name) + '</span>' +
      '<div class="insxt"><i class="insxa" style="left:' + X(r.ps[0]) + '%;width:' + Math.max(.8, X(r.ps[r.ps.length - 1]) - X(r.ps[0])) + '%"></i><i class="insxq" style="left:' + X(q1) + '%;width:' + Math.max(.8, X(q3) - X(q1)) + '%"></i><i class="insxm" style="left:' + X(q2) + '%"></i></div>' +
      '<span class="insxv"><b>' + pctAvgText(avg) + '</b> <small>' + r.ps.length + '</small></span></div>';
  }).join('') + '<div class="insxr insxax" aria-hidden="true"><span></span><div class="insxt">' + ticks.map(t => '<span style="left:' + X(t) + '%">' + t + '%</span>').join('') + '</div><span></span></div></div>' +
    '<p class="muted ovcap2">For each class: the bar runs from the lowest to the highest percent, the darker part is the middle half, and the line is the middle score. The number is the class average, then how many finished scores it’s from.</p></section>';
}
// Drawn after the Summary, once saved work from other assignments has been read.
let insTok = 0;
async function insMore() {
  const host = $('#insMore'), c = batchClass(); if (!host || !batch) return;
  if (!c || !c.names.length) { host.innerHTML = ''; return; }
  const tok = ++insTok, b0 = batch;
  const all = await bkLoad();
  if (tok !== insTok || batch !== b0 || !host.isConnected) return;
  const f = batch.assignment && findItem(batch.assignment.id), me = f ? f.it : null, s = classStats();
  host.innerHTML = '<div class="ovcharts">' + insMoveHtml(c, bkClassCols(c, all), me) + insAcrossHtml(c, all, me, s) + '</div>';
}
let insResize = 0;
window.addEventListener('resize', () => { if (!$('#insMore')) return; clearTimeout(insResize); insResize = setTimeout(() => { if ($('#insMore')) insMore(); }, 200); });

Object.assign(window.__gs, { tabsRender, tabShow, glPaperOf, setReturned, insNow });
