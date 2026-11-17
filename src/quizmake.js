/* ---------------- Make a quiz: questions typed in, printed with bubbles, read back from the scan ---------------- */
// it.quiz.made = { id, items: [{ t: 'mc' | 'tf' | 'ms' | 'sa', text, opts: [..], key: 'B' | 'AC' | 'T', pts }], sheet: 0 | 1, blank }
// t: mc one answer, tf true or false, ms every answer that applies, sa a short answer she marks by filling a score bubble.
// sheet 1: answer sheet only (the questions are on the board or her own paper), the same bubbles without the words.
const QMK_T = { mc: 'Multiple choice', tf: 'True or false', ms: 'Pick all that apply', sa: 'Short answer' };
const QMK_L = 'ABCDEFGH';
const qmkNew = t => ({ id: 'mq' + uid(), ...qmkNew0(t) });
const qmkNew0 = t => t === 'tf' ? { t, text: '', opts: ['True', 'False'], key: '', pts: 1 } : t === 'sa' ? { t, text: '', opts: [], key: '', pts: 2, lines: 3 } : { t, text: '', opts: ['', '', '', ''], key: '', pts: 1 };
const qmkPts = m => m.items.reduce((a, q) => a + (+q.pts || 0), 0);
const qmkLetters = q => q.t === 'tf' ? ['T', 'F'] : q.t === 'sa' ? qzSteps(+q.pts || 1).map(fmtNum) : q.opts.map((_, k) => QMK_L[k]);
// The printed page's look. It is paper, so it stays black on white whatever the app's theme, and it is laid out by these rules
// only (no app rule reaches inside it), so the bubbles measured in the app are where the print window puts them.
const QMK_CSS = '.qfpage,.qfpage *{box-sizing:border-box}.qfpage :where(ol,ul,li,p,div,span,b,i){margin:0;padding:0;letter-spacing:normal;text-transform:none}.qfpage{position:relative;width:816px;height:1056px;background:#fff;color:#111;font:14px/1.4 Inter,Arial,sans-serif;box-sizing:border-box;padding:96px 76px 64px;box-shadow:0 1px 3px rgba(0,0,0,.18);overflow:hidden}.qfreg{position:absolute;width:19px;height:19px;background:#000}.qfreg.tl{left:53px;top:53px}.qfreg.tr{right:53px;top:53px}.qfreg.bl{left:53px;bottom:53px}.qfreg.br{right:53px;bottom:53px}.qfcode{position:absolute;top:56px;left:50%;transform:translateX(-50%);display:flex;gap:4px}.qfcode i{width:12px;height:12px;border:1px solid #000;box-sizing:border-box}.qfcode i.on{background:#000}.qfhead{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;border-bottom:2px solid #111;padding-bottom:8px}.qfhead.sm{font-size:12px;color:#444;border-bottom-width:1px;padding-bottom:4px}.qftitle{font-size:22px;font-weight:700}.qfsub{font-size:12px;color:#555}.qfname{display:flex;gap:8px;align-items:baseline;min-width:260px}.qfname span{font-size:12px;color:#555}.qfname b{flex:1;border-bottom:1px solid #111;font-size:16px;padding:0 4px 2px;min-height:22px}.qfhow{font-size:11.5px;color:#444;margin:8px 0 4px}.qfbody{display:flex;flex-direction:column;gap:10px;margin-top:10px}.qfq{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:start;padding:6px 6px;border-radius:6px}.qfq.sheet{grid-template-columns:26px auto;padding:2px 6px}.qfq.on{background:#EAF2FA}.qfn{font-weight:700;font-size:15px;padding-top:4px}.qftx{padding-top:4px}.qfops{list-style:none;margin:4px 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:13px}.qfops b{font-weight:600;margin-right:4px}.qfhint{font-size:11.5px;color:#555;font-style:italic;margin-top:2px}.qflines{display:flex;flex-direction:column;gap:0;margin-top:4px}.qflines span{height:26px;border-bottom:1px solid #999}.qfbs{display:flex;gap:8px;align-items:center;padding:2px 0}.qfbs.sa{border:1px dashed #888;border-radius:6px;padding:4px 8px}.qffor{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.06em;margin-right:2px}.qfb{width:26px;height:26px;border:1.5px solid #222;border-radius:50%;display:grid;place-items:center;font:600 11px Inter,Arial,sans-serif;font-style:normal;color:#444;box-sizing:border-box}.qfb.key{background:#1E8A4C;border-color:#1E8A4C;color:#fff}.qfb.f{background:radial-gradient(circle at 45% 40%,#333 0 55%,#4a4a4a 75%,transparent 82%);color:transparent}.qfb.faint{background:radial-gradient(circle at 50% 50%,#c9c9c9 0 60%,transparent 80%);color:#888}.qfb.x{background:linear-gradient(45deg,transparent 44%,#333 45% 55%,transparent 56%),linear-gradient(-45deg,transparent 44%,#333 45% 55%,transparent 56%)}.qffoot{position:absolute;bottom:58px;left:0;right:0;text-align:center;font-size:11px;color:#666}.qfq.sheet .qfbs{justify-self:start}.qfname b{white-space:nowrap;overflow:hidden;text-overflow:clip}';
{ const st = document.createElement('style'); st.id = 'qfPageCss'; st.textContent = QMK_CSS; document.head.appendChild(st); }
// The code across the top of each page: quiz, student and page, and a check, as black and white squares.
function qmkBits(id, who, pg, ver = 0) {
  const b = [], put = (v, n) => { for (let k = n - 1; k >= 0; k--) b.push((v >> k) & 1); };
  put(id, 8); put(who, 8); put(pg, 3); put(ver % 4, 2); put((id + who + pg + ver % 4) % 31, 5);
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
function qmkPageHtml(m, title, name, pg, of, qs, from, who = 0) {
  const bits = qmkBits(m.id || 1, who, pg, m.ver || 0).map(b => '<i' + (b ? ' class="on"' : '') + '></i>').join('');
  return '<div class="qfpage"><i class="qfreg tl"></i><i class="qfreg tr"></i><i class="qfreg bl"></i><i class="qfreg br"></i><div class="qfcode">' + bits + '</div>' +
    (pg === 0 ? '<div class="qfhead"><div><div class="qftitle" data-raw>' + esc(title) + '</div><div class="qfsub">' + m.items.length + ' questions · ' + fmtNum(qmkPts(m)) + ' points</div></div>' +
      '<div class="qfname"><span>Name</span><b data-raw>' + esc(name || '') + '</b></div></div>' +
      '<p class="qfhow">Fill each bubble completely with a dark pencil or pen. To change an answer, erase it fully or cross it out and fill the new one.</p>'
      : '<div class="qfhead sm"><span data-raw>' + esc(title) + '</span><span data-raw>' + esc(name || '') + '</span></div>') +
    '<div class="qfbody">' + qs.map((q, k) => qmkQ(q, from + k, m)).join('') + '</div><div class="qffoot">Page ' + (pg + 1) + ' of ' + of + '</div></div>';
}
// The questions spread over pages: measured in a hidden page, so long questions push onto the next one.
function qmkPages(m, title, name, who = 0) {
  const probe = document.createElement('div'); probe.className = 'qfprobe'; document.body.appendChild(probe);
  probe.innerHTML = qmkPageHtml(m, title, name, 0, 1, m.items, 0);
  const body = probe.querySelector('.qfbody'), room0 = 1056 - 64 - body.offsetTop, room = room0 + (body.offsetTop - 120);
  const hs = [...body.children].map(e => e.offsetHeight + 10);
  probe.remove();
  const pages = []; let cur = [], used = 0, at = 0;
  hs.forEach((h, i) => { const lim = pages.length ? room : room0; if (cur.length && used + h > lim) { pages.push([at, cur]); at = i; cur = []; used = 0; } cur.push(m.items[i]); used += h; });
  pages.push([at, cur]);
  return pages.map(([from, qs], pg) => qmkPageHtml(m, title, name, pg, pages.length, qs, from, who));
}
// Where everything sits on the printed pages, as shares of the page, measured from the pages themselves: each question's box,
// the centre of each of its bubbles and their size. These become the quiz's Quick mark boxes, so marking, answer notes and
// the gradebook work as for a quiz she drew boxes on.
function qmkLayout(m, title) {
  const probe = document.createElement('div'); probe.className = 'qfprobe'; document.body.appendChild(probe);
  probe.innerHTML = qmkPages(m, title, 'Name').join('');
  const out = [], R = v => Math.round(v * 10000) / 10000;
  [...probe.querySelectorAll('.qfpage')].forEach((pg, n) => {
    const P = pg.getBoundingClientRect(), sx = v => R((v - P.left) / P.width), sy = v => R((v - P.top) / P.height);
    for (const el of pg.querySelectorAll('.qfq')) {
      const r = el.getBoundingClientRect(), bs = [...el.querySelectorAll('.qfb')].map(b => b.getBoundingClientRect());
      out[+el.dataset.i] = { n, x: sx(r.left), y: sy(r.top), w: R(r.width / P.width), h: R(r.height / P.height), b: bs.map(b => [sx(b.left + b.width / 2), sy(b.top + b.height / 2)]), r: R(bs[0].width / 2 / P.width) };
    }
  });
  probe.remove();
  return out;
}
// The quiz's Quick mark boxes from the questions and where they print. A multiple choice key carries its words, for the answer notes.
function qmkBoxes(m, title, was) {
  const L = qmkLayout(m, title), Q = JSON.parse(JSON.stringify(was || {}));
  // Copies already printed keep their bubbles where they were: a change that moves any gives the next printing a new number,
  // and pages from the old one are left for her to mark.
  const lay = JSON.stringify(L.map(a => [a.n, a.b]));
  m.ver = m.lay == null || m.lay === lay ? m.pv || 0 : (m.pv || 0) + 1;
  const old = new Map((Q.qs || []).map(q => [q.id, q]));
  Q.qs = m.items.map((it, i) => {
    const o = old.get(it.id) || {}, at = L[i], letters = qmkLetters(it);
    const key = it.t === 'sa' ? (o.key || '') : it.t === 'ms' ? it.key.split('').join(', ') : it.t === 'tf' ? (it.key === 'T' ? 'True' : it.key === 'F' ? 'False' : '') : it.key ? it.key + ': ' + (it.opts[letters.indexOf(it.key)] || '') : '';
    const q = { ...o, id: it.id, lab: String(i + 1), n: at.n, x: at.x, y: at.y, w: at.w, h: at.h, pts: +it.pts || 1, key: key.replace(/: $/, ''), kind: it.t === 'sa' ? 'scale' : 'rw', how: o.how || 'cx', auto: { t: it.t, b: at.b, r: at.r, key: it.t === 'sa' ? '' : it.key || '' } };
    if (o.n !== at.n || Math.abs((o.x || 0) - at.x) > .002 || Math.abs((o.y || 0) - at.y) > .002) { delete q.mx; delete q.my; delete q.nx; delete q.ny; }
    return q;
  });
  Q.how ||= 'cx'; Q.side ||= 'right'; Q.ans ||= 'miss'; Q.at ||= 'right'; Q.shift ||= {};
  return Q;
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
      for (const q of m.items) q.id ||= 'mq' + uid();
      if (b.dataset.qfprint != null) m.names = names.slice();   // who each printed copy is for, by its number in the code, whatever the roster becomes
      const Q = qmkBoxes(m, it.name, it.quiz), moved = m.lay != null && m.ver !== (m.pv || 0);
      if (b.dataset.qfprint != null) { m.pv = m.ver; m.lay = JSON.stringify(Q.qs.map(q => [q.n, q.auto.b])); }
      it.quiz = { ...Q, made: m }; saveLib(); renderLib();
      if (batch && batch.id === it.batchId) { batch.quiz = qmkFor(batch.quiz, it.quiz); quizBtn(); saveSoon(); }
      if (b.dataset.qfprint != null) return qmkPrint(it, m, names);
      closeDlg(); toast(moved ? 'Quiz saved. This change moves bubbles, so print it again: copies printed before can’t be read by the scan.' : 'Quiz saved');
    }
  };
  $('#qfShow').onchange = () => draw(true);
}
// A download's quiz from its card's: the boxes as the quiz now prints, with what was set on this download's papers kept.
const qmkFor = (had, q) => ({ ...JSON.parse(JSON.stringify(q)), shift: (had && had.shift) || {}, spot: (had && had.spot) || {} });
// Every student's copy with their name on it, in roster order, then the blank copies. The browser's print box saves it as a PDF too.
function qmkPrint(it, m, names) {
  const all = [...names, ...Array(m.blank || 0).fill('')].flatMap((n, k) => qmkPages(m, it.name, n, n ? k + 1 : 0));
  const w = window.open('', '_blank'); if (!w) return toast('Your browser blocked the print window');
  // the same font as the page it was measured on, so every line breaks where the bubbles were measured
  w.document.write('<!doctype html><title>' + esc(it.name) + '</title><style>' + [...document.styleSheets].map(s => { try { return [...s.cssRules].filter(r => r instanceof CSSFontFaceRule).map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n') + QMK_CSS +
    '@page{size:letter;margin:0}body{margin:0;font-family:Inter,Arial,sans-serif}.qfpage{break-after:page;box-shadow:none}</style>' + all.join(''));
  w.document.close(); w.document.fonts.ready.then(() => setTimeout(() => w.print(), 200));
}
