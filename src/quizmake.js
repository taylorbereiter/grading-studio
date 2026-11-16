/* ---------------- Make a quiz: questions typed in, printed with bubbles, read back from the scan ---------------- */
// MOCKUP (thread "Build a quiz creator with scannable printouts"): the editor and the printed page are real; reading a scan is shown with made-up answers.
// it.quiz.made = { id, items: [{ t: 'mc' | 'tf' | 'ms' | 'sa', text, opts: [..], key: 'B' | 'AC' | 'T', pts }], sheet: 0 | 1, blank }
// t: mc one answer, tf true or false, ms every answer that applies, sa a short answer she marks by filling a score bubble.
// sheet 1: answer sheet only (the questions are on the board or her own paper), the same bubbles without the words.
const QMK_T = { mc: 'Multiple choice', tf: 'True or false', ms: 'Pick all that apply', sa: 'Short answer' };
const QMK_L = 'ABCDEFGH';
const qmkNew = t => t === 'tf' ? { t, text: '', opts: ['True', 'False'], key: '', pts: 1 } : t === 'sa' ? { t, text: '', opts: [], key: '', pts: 2, lines: 3 } : { t, text: '', opts: ['', '', '', ''], key: '', pts: 1 };
const qmkPts = m => m.items.reduce((a, q) => a + (+q.pts || 0), 0);
const qmkLetters = q => q.t === 'tf' ? ['T', 'F'] : q.t === 'sa' ? qzSteps(+q.pts || 1).map(fmtNum) : q.opts.map((_, k) => QMK_L[k]);
// The code across the top of each page: quiz, student and page, and a check, as black and white squares.
function qmkBits(id, who, pg) {
  const b = [], put = (v, n) => { for (let k = n - 1; k >= 0; k--) b.push((v >> k) & 1); };
  put(id, 8); put(who, 8); put(pg, 3); put(0, 2); put((id + who + pg) % 31, 5);
  return [1, 0, ...b];
}
function qmkQ(q, i, m) {
  const L = qmkLetters(q), on = k => q.t === 'sa' ? false : (q.key || '').includes(L[k]);
  const bub = L.map((l, k) => '<i class="qfb' + (m.show && on(k) ? ' key' : '') + (m.fill && m.fill[i] && m.fill[i][k] ? ' ' + m.fill[i][k] : '') + '">' + l + '</i>').join('');
  const words = m.sheet ? '' : '<div class="qftx">' + esc(q.text || (q.t === 'sa' ? 'Your question' : 'Your question')) +
    (q.t === 'mc' || q.t === 'ms' ? '<ol class="qfops">' + q.opts.map((o, k) => '<li><b>' + QMK_L[k] + '</b> ' + esc(o || '…') + '</li>').join('') + '</ol>' : '') +
    (q.t === 'ms' ? '<div class="qfhint">Fill every answer that applies.</div>' : '') +
    (q.t === 'sa' ? '<div class="qflines">' + '<span></span>'.repeat(q.lines || 3) + '</div>' : '') + '</div>';
  return '<div class="qfq' + (m.sheet ? ' sheet' : '') + '" data-i="' + i + '"><span class="qfn">' + (i + 1) + '</span>' + words +
    '<div class="qfbs' + (q.t === 'sa' ? ' sa' : '') + '">' + (q.t === 'sa' ? '<span class="qffor">Teacher</span>' : '') + bub + '</div></div>';
}
// One printed page, 8.5 by 11 inches at 96 to the inch. Registration squares sit well in from the edges, where scanners keep them.
function qmkPageHtml(m, title, name, pg, of, qs, from) {
  const bits = qmkBits(m.id || 1, name ? 3 : 0, pg).map(b => '<i' + (b ? ' class="on"' : '') + '></i>').join('');
  return '<div class="qfpage"><i class="qfreg tl"></i><i class="qfreg tr"></i><i class="qfreg bl"></i><i class="qfreg br"></i><div class="qfcode">' + bits + '</div>' +
    (pg === 0 ? '<div class="qfhead"><div><div class="qftitle" data-raw>' + esc(title) + '</div><div class="qfsub">' + m.items.length + ' questions · ' + fmtNum(qmkPts(m)) + ' points</div></div>' +
      '<div class="qfname"><span>Name</span><b data-raw>' + esc(name || '') + '</b></div></div>' +
      '<p class="qfhow">Fill each bubble completely with a dark pencil or pen. To change an answer, erase it fully or cross it out and fill the new one.</p>'
      : '<div class="qfhead sm"><span data-raw>' + esc(title) + '</span><span data-raw>' + esc(name || '') + '</span></div>') +
    '<div class="qfbody">' + qs.map((q, k) => qmkQ(q, from + k, m)).join('') + '</div><div class="qffoot">Page ' + (pg + 1) + ' of ' + of + '</div></div>';
}
// The questions spread over pages: measured in a hidden page, so long questions push onto the next one.
function qmkPages(m, title, name) {
  const probe = document.createElement('div'); probe.className = 'qfprobe'; document.body.appendChild(probe);
  probe.innerHTML = qmkPageHtml(m, title, name, 0, 1, m.items, 0);
  const body = probe.querySelector('.qfbody'), room0 = 1056 - 64 - body.offsetTop, room = room0 + (body.offsetTop - 120);
  const hs = [...body.children].map(e => e.offsetHeight + 10);
  probe.remove();
  const pages = []; let cur = [], used = 0, at = 0;
  hs.forEach((h, i) => { const lim = pages.length ? room : room0; if (cur.length && used + h > lim) { pages.push([at, cur]); at = i; cur = []; used = 0; } cur.push(m.items[i]); used += h; });
  pages.push([at, cur]);
  return pages.map(([from, qs], pg) => qmkPageHtml(m, title, name, pg, pages.length, qs, from));
}
function openQuizMaker(itId) {
  const f = findItem(itId); if (!f) return;
  const it = f.it, c = holderById(it.classId), names = c && c.names ? c.names : [];
  const m = JSON.parse(JSON.stringify((it.quiz && it.quiz.made) || { id: 1 + Math.floor(Math.random() * 250), items: [qmkNew('mc'), qmkNew('mc'), qmkNew('tf'), qmkNew('sa')], sheet: 0, blank: 2 }));
  let sel = 0;
  openDlg('<div class="bh"><h2>Make a quiz <span class="muted" data-raw>' + esc(it.name) + '</span></h2><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb qfwrap"><div class="qfed" id="qfEd"></div><div class="qfprev"><div class="qfpbar"><span class="seg" id="qfSheet"><button data-sheet="0">Questions and bubbles</button><button data-sheet="1">Answer sheet only</button></span>' +
    '<label class="chk"><input type="checkbox" id="qfShow"> Show the answers</label></div><div class="qfpages" id="qfPages"></div></div></div>' +
    '<div class="bf"><span class="muted hsm" id="qfSum" style="margin-right:auto"></span><label class="hsm mrow" style="gap:6px">Blank copies <input type="number" id="qfBlank" min="0" max="40" value="' + (m.blank || 0) + '" style="width:56px" class="btn sm"></label>' +
    '<button class="btn" data-close>Cancel</button><button class="btn" data-qfsave>Save</button><button class="btn primary" data-qfprint>Print for ' + names.length + ' students…</button></div>');
  $('#dlgBox').classList.add('spbox', 'qfdlg');
  const ed = $('#qfEd'), pv = $('#qfPages');
  const card = (q, i) => '<div class="qfc' + (i === sel ? ' on' : '') + '" data-i="' + i + '"><div class="qfch"><b>' + (i + 1) + '</b><select class="btn sm" data-qt>' + Object.entries(QMK_T).map(([k, t]) => '<option value="' + k + '"' + (q.t === k ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' +
    '<label class="hsm mrow" style="gap:4px;margin-left:auto">Points <input type="number" min="0.5" step="0.5" value="' + q.pts + '" data-qp class="btn sm" style="width:58px"></label>' +
    '<button class="icon" data-qup aria-label="Move up" title="Move up">↑</button><button class="icon" data-qdel aria-label="Take out" title="Take out">✕</button></div>' +
    '<textarea data-qx rows="2" placeholder="Type the question' + (m.sheet ? ' (optional on an answer sheet)' : '') + '">' + esc(q.text) + '</textarea>' +
    (q.t === 'sa' ? '<p class="muted hsm">Students write on the lines. You mark it by filling a score bubble, 0 to ' + fmtNum(+q.pts || 1) + ', in the Teacher box, and the scan reads your score too. Or leave it blank and mark it in Quick mark.</p>'
      : '<div class="qfopts">' + q.opts.map((o, k) => { const l = qmkLetters(q)[k], on = (q.key || '').includes(l); return '<div class="qfo"><button class="qfkey' + (on ? ' on' : '') + '" data-qk="' + l + '" title="' + (on ? 'The right answer' : 'Make this the right answer') + '" aria-pressed="' + on + '">' + l + '</button>' +
        (q.t === 'tf' ? '<span>' + esc(o) + '</span>' : '<input data-qo="' + k + '" value="' + esc(o) + '" placeholder="Choice ' + l + '">' + (q.opts.length > 2 ? '<button class="icon" data-qod="' + k + '" aria-label="Take out choice ' + l + '">✕</button>' : '')) + '</div>'; }).join('') +
        (q.t !== 'tf' && q.opts.length < 8 ? '<button class="link hsm" data-qadd>+ Choice</button>' : '') +
        '<p class="hsm ' + (q.key ? 'muted' : 'qfwarn') + '">' + (q.key ? (q.t === 'ms' ? 'Right answers: ' + q.key.split('').join(', ') + '. All of them, and no others, for the points.' : 'Right answer: ' + q.key) : 'Click a letter to set the right answer.') + '</p></div>') + '</div>';
  const draw = (keepEd) => {
    if (!keepEd) ed.innerHTML = m.items.map(card).join('') + '<div class="qfadd"><span class="hsm muted">Add</span>' + Object.entries(QMK_T).map(([k, t]) => '<button class="btn sm" data-qnew="' + k + '">+ ' + t + '</button>').join('') + '</div>';
    for (const b of $('#qfSheet').children) b.setAttribute('aria-pressed', String(+b.dataset.sheet === (m.sheet || 0)));
    const pages = qmkPages({ ...m, show: $('#qfShow').checked }, it.name, names[0] || 'Student name');
    pv.innerHTML = pages.map(h => '<div class="qfscale">' + h + '</div>').join('');
    const auto = m.items.filter(q => q.t !== 'sa').length, sa = m.items.length - auto;
    $('#qfSum').textContent = m.items.length + ' questions, ' + fmtNum(qmkPts(m)) + ' points · ' + pages.length + (pages.length === 1 ? ' page' : ' pages') + ' each · ' + auto + ' scored by the scan' + (sa ? ', ' + sa + ' marked by you' : '');
    const s = pv.querySelector('.qfq[data-i="' + sel + '"]'); if (s) s.classList.add('on');
  };
  draw();
  const at = e => { const el = e.target.closest('.qfc'); return el ? +el.dataset.i : -1; };
  ed.addEventListener('input', e => {
    const i = at(e); if (i < 0) return; const q = m.items[i];
    if (e.target.matches('[data-qx]')) q.text = e.target.value;
    else if (e.target.matches('[data-qo]')) q.opts[+e.target.dataset.qo] = e.target.value;
    else if (e.target.matches('[data-qp]')) { q.pts = Math.max(.5, +e.target.value || 1); if (q.t === 'sa') return draw(); }
    draw(true);
  });
  ed.addEventListener('focusin', e => { const i = at(e); if (i >= 0 && i !== sel) { sel = i; for (const c of ed.querySelectorAll('.qfc')) c.classList.toggle('on', +c.dataset.i === sel); draw(true); } });
  ed.addEventListener('change', e => { const i = at(e); if (i >= 0 && e.target.matches('[data-qt]')) { const n = qmkNew(e.target.value); n.text = m.items[i].text; n.pts = m.items[i].pts; if (n.opts.length && m.items[i].opts.length > 2 && e.target.value !== 'tf') n.opts = m.items[i].opts; m.items[i] = n; draw(); } });
  $('#dlgBox').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = at(e), q = m.items[i];
    if (b.dataset.qk) { const l = b.dataset.qk; q.key = q.t === 'ms' ? (q.key.includes(l) ? q.key.replace(l, '') : (q.key + l).split('').sort().join('')) : l; return draw(); }
    if (b.dataset.qadd != null) { q.opts.push(''); return draw(); }
    if (b.dataset.qod != null) { const k = +b.dataset.qod, l = QMK_L[k]; q.opts.splice(k, 1); q.key = q.key.split('').filter(x => x !== l).map(x => QMK_L.indexOf(x) > k ? QMK_L[QMK_L.indexOf(x) - 1] : x).join(''); return draw(); }
    if (b.dataset.qdel != null) { m.items.splice(i, 1); sel = Math.min(sel, m.items.length - 1); return draw(); }
    if (b.dataset.qup != null && i > 0) { [m.items[i - 1], m.items[i]] = [m.items[i], m.items[i - 1]]; sel = i - 1; return draw(); }
    if (b.dataset.qnew) { m.items.push(qmkNew(b.dataset.qnew)); sel = m.items.length - 1; draw(); ed.lastElementChild.previousElementSibling.scrollIntoView({ block: 'nearest' }); ed.querySelector('.qfc.on textarea').focus(); return; }
    if (b.dataset.sheet != null) { m.sheet = +b.dataset.sheet; return draw(); }
    if (b.dataset.qfsave != null || b.dataset.qfprint != null) {
      m.blank = Math.max(0, +$('#qfBlank').value || 0);
      it.quiz = { ...(it.quiz || {}), made: m }; saveLib(); renderLib();
      if (b.dataset.qfprint != null) return qmkPrint(it, m, names);
      closeDlg(); toast('Quiz saved');
    }
  };
  $('#qfShow').onchange = () => draw(true);
}
// Every student's copy with their name on it, in roster order, then the blank copies. The browser's print box saves it as a PDF too.
function qmkPrint(it, m, names) {
  const all = [...names, ...Array(m.blank || 0).fill('')].flatMap(n => qmkPages(m, it.name, n));
  const w = window.open('', '_blank'); if (!w) return toast('Your browser blocked the print window');
  w.document.write('<!doctype html><title>' + esc(it.name) + '</title><style>' + [...document.styleSheets].map(s => { try { return [...s.cssRules].filter(r => /\.qf/.test(r.cssText)).map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n') +
    '@page{size:letter;margin:0}body{margin:0;font-family:Inter,Arial,sans-serif}.qfpage{break-after:page;box-shadow:none}</style>' + all.join(''));
  w.document.close(); setTimeout(() => w.print(), 300);
}
// MOCKUP: what she sees after bringing in the scan of the whole stack. The answers here are made up.
function openQuizRead(itId) {
  const f = findItem(itId); if (!f || !f.it.quiz || !f.it.quiz.made) return toast('Make the quiz first');
  const it = f.it, m = it.quiz.made, c = holderById(it.classId), names = (c && c.names) || [];
  const auto = m.items.map((q, i) => [q, i]).filter(([q]) => q.t !== 'sa');
  const look = [
    { who: 1, i: auto[0][1], fill: { 0: 'f', 2: 'f' }, why: 'Two bubbles filled' },
    { who: 4, i: auto[1 % auto.length][1], fill: { 1: 'faint' }, why: 'Very light' },
    { who: 6, i: auto[2 % auto.length][1], fill: { 0: 'x', 1: 'f' }, why: 'One crossed out' },
  ];
  const pages = names.length * qmkPages(m, it.name, 'x').length;
  const n = names.length * auto.length;
  const row = (r, k) => { const q = m.items[r.i], L = qmkLetters(q);
    return '<div class="qfrr" data-k="' + k + '"><div class="qfrw"><b data-raw>' + esc(names[r.who] || 'Student') + '</b><span class="muted hsm">Question ' + (r.i + 1) + ' · ' + r.why + '</span></div>' +
      '<div class="qfcrop">' + qmkQ(q, r.i, { ...m, sheet: 1, fill: { [r.i]: r.fill } }) + '</div>' +
      '<div class="qfpick"><span class="hsm muted">Their answer</span>' + L.map(l => '<button class="btn sm" data-ans="' + l + '">' + l + '</button>').join('') + '<button class="btn sm" data-ans="-">None</button></div></div>'; };
  openDlg('<div class="bh"><h2>Quiz scan read <span class="muted" data-raw>' + esc(it.name) + '</span></h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<div class="qftiles"><div><b>' + pages + '</b><span>pages scanned</span></div><div><b>' + names.length + ' of ' + names.length + '</b><span>students found by the code on each page</span></div><div><b>' + (n - look.length) + ' of ' + n + '</b><span>answers read and scored</span></div><div class="need"><b>' + look.length + '</b><span>need you</span></div></div>' +
    '<p class="hsm">These answers weren’t clear enough to score on their own. Pick what each student meant. Short answers wait for you in Quick mark, unless you filled their score bubbles before scanning.</p>' +
    look.map(row).join('') + '</div><div class="bf"><span class="muted hsm" style="margin-right:auto">Every score can be changed later in Quick mark. One Undo takes the whole scan back.</span><button class="btn" data-close>Later</button><button class="btn primary" data-close>Save scores</button></div>', false);
  $('#dlgBox').classList.add('qfread');
  $('#dlgBox').addEventListener('click', e => { const b = e.target.closest('[data-ans]'); if (!b) return; const r = b.closest('.qfrr'); for (const x of r.querySelectorAll('[data-ans]')) x.classList.toggle('primary', x === b); r.classList.add('done'); });
}
