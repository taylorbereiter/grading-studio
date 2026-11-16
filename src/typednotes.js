/* ---------------- typed notes (11/16): a tab of the side pane for notes typed line by line ----------------
   Any notes on any assignment: plain typing comes first, and a line can also be a heading, a strength, a next step or a question
   (from the bar, or Ctrl Alt 1 to 4). Beside a video or the Timer, each new line can carry the moment it was started.
   setup.tnBack is kept free for a later switch: whether the notes go back to the student with the paper (absent: they do).
   Kept on the student's grade, st.grade.tn = { l: [{ s: text, k: 'h' | 'p' | 'n' | 'q' (none for a plain note), t: seconds }] }, and gone
   when empty. On the grade, it is saved, merged, carried in a take-home file and the folder, and shared by a group, the way the comment is.
   The assignment can give every student the same headings to start with: setup.tnHead = [text]. A student with no notes shows them,
   with an empty line under each, and nothing is stored until she types.
   One line is a textarea of its own; the editing between lines (Enter, Backspace, the arrows, pasting several lines) is done here. */
// Each kind: its word, its sign in the bar and beside the line, and its number for the keys (Ctrl Alt, or ⌘ ⌥, and the number).
// Ctrl and a number alone is the browser's own: it goes to that tab.
const TN_K = { h: ['Heading', 'H', 1], p: ['Strength', '✓', 2], n: ['Next step', '→', 3], q: ['Question', '?', 4] };
const TN_FS = !!(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));
let tnL = [], tnSt = null, tnAt = 0, tnLast = null, tnMz = null, tnIv = 0;
// Started: a line with words in it that isn't a heading (headings alone are only the shape of the notes).
function tnHasG(g) { return !!(g && g.tn && Array.isArray(g.tn.l) && g.tn.l.some(x => x && x.k !== 'h' && String(x.s || '').trim())); }
function tnHas(st) { return !!st && tnHasG(st.grade); }
const tnStored = st => (st.grade.tn && Array.isArray(st.grade.tn.l) && st.grade.tn.l.length ? st.grade.tn.l : null);
const tnTimesOn = () => store.get('gs.tnTime', true) !== false;
// Whether the notes go back to the student as a page of the returned paper: the assignment's choice (setup.tnBack), on unless she turns it off.
const tnBackOn = () => setup.tnBack !== false;
function tnOut(st) { return tnBackOn() && tnHas(st); }
const tnHead = () => (Array.isArray(setup.tnHead) ? setup.tnHead.filter(s => typeof s === 'string' && s.trim()) : []);
// What she sees for a student: their notes, or the headings for everyone with a line under each, or one empty line.
function tnView(st) {
  const s = tnStored(st); if (s) return s.map(x => ({ ...x, s: String(x.s || '') }));
  const h = tnHead(); return h.length ? h.flatMap(s => [{ s, k: 'h' }, { s: '' }]) : [{ s: '' }];
}
const tnHasVid = st => st.files.some(f => f.kind === 'media' || f.kind === 'link');
// The Timer's clock goes in the bar for a talk given live: a notes page and no video, or a clock already started.
const tnTimer = st => !tnHasVid(st) && (st.files.some(f => !f.virtual && f.data && isNotes(f.data)) || spClockMs(spClockOf(st)) > 0);
function tnNow(st) {
  const v = vidClock($('#paper')); if (v != null) return v;
  const c = spClockOf(st); return c.at ? spClockMs(c) / 1000 : null;
}

/* ---------- keeping them, and taking a change back ---------- */
// One Ctrl Z for each pause in typing (join), and one for each other change.
function tnSnap(st, join) {
  const top = undoStack[undoStack.length - 1];
  if (join && top && top === tnLast && top.st === st && !redoStack.length && Date.now() - top.t < 1500) { top.t = Date.now(); return; }
  const before = JSON.stringify(st.grade.tn || null); let after = before;
  const put = v => { const x = JSON.parse(v); if (x) st.grade.tn = x; else delete st.grade.tn; touchGrade(st); saveSoon(); renderList(); tnBack(st); };
  const u = actStep(() => { after = JSON.stringify(st.grade.tn || null); put(before); }, () => put(after), 'typed notes');
  u.st = st; u.t = Date.now(); pushUndo(u); tnLast = u;
}
function tnPut(st, join) {
  tnSnap(st, join);
  const was = tnHas(st);
  if (tnL.some(x => x.s.trim())) st.grade.tn = { l: tnL.map(x => { const o = { s: x.s }; if (x.k) o.k = x.k; if (x.t != null) o.t = x.t; return o; }) };
  else delete st.grade.tn;
  touchGrade(st); saveSoon();
  if (was !== tnHas(st)) renderList();
}
// After Ctrl Z: the notes as they are now, on the student they belong to.
function tnBack(st) {
  const i = batch.students.indexOf(st); if (i < 0) return;
  if (i !== cur) return openStudent(i);
  const h = tnHost(); if (!h) return;
  const a = document.activeElement, at = a && a.classList.contains('tnin') ? [tnAt, a.selectionStart] : null;
  tnRows(h, st); if (at) tnFocus(Math.min(at[0], tnL.length - 1), at[1]);
}

/* ---------- drawing ---------- */
const tnHost = () => $('#spBody > .sptool[data-tool="typed"]');
const tnGut = (x, i) => (x.t != null ? '<button class="tnchip" data-tnt="' + i + '" title="' + (tnSt && tnHasVid(tnSt) ? 'Play the video from here' : 'The time on the Timer') + '">' + fmtTime(x.t) + '</button><button class="tnx" data-tnx="' + i + '" aria-label="Take the time off" title="Take the time off">×</button>' : '') + (x.k && x.k !== 'h' ? '<i aria-hidden="true">' + TN_K[x.k][1] + '</i>' : '');
const tnRowHtml = (x, i) => '<div class="tnrow"' + (x.k ? ' data-k="' + x.k + '"' : '') + '><span class="tngut">' + tnGut(x, i) + '</span><textarea class="tnin" rows="1" data-tni="' + i + '" aria-label="' + (x.k ? TN_K[x.k][0] : 'Note') + '"' +
  (tnL.length === 1 ? ' placeholder="Type your notes. Enter starts a new line."' : '') + '>' + esc(x.s) + '</textarea></div>';
function tnFit(ta) { if (!TN_FS) { ta.style.height = '0'; ta.style.height = ta.scrollHeight + 'px'; } }
function tnPaint() {
  const h = tnHost(), list = h && h.querySelector('.tnlist'); if (!list) return;
  list.innerHTML = tnL.map(tnRowHtml).join('');
  if (!TN_FS) list.querySelectorAll('.tnin').forEach(tnFit);
  const st = tnSt, hint = h.querySelector('.tnhint');
  hint.hidden = !(st && !tnStored(st) && !tnHead().length && setup.mode === 'rubric' && setup.criteria.length);
  tnBar(h, st);
}
function tnRows(h, st) { tnSt = st; tnL = tnView(st); tnAt = Math.min(tnAt, tnL.length - 1); tnPaint(); }
// The bar: which kind the line in hand is, Times, the clock, and what the ⋯ offers.
function tnBar(h, st) {
  const bar = h && h.querySelector('.tnbar'); if (!bar || !st) return;
  const x = tnL[tnAt] || {}, vid = tnHasVid(st), live = tnTimer(st), can = vid || live;
  for (const b of bar.querySelectorAll('[data-tnk]')) b.setAttribute('aria-pressed', String(x.k === b.dataset.tnk));
  const tb = bar.querySelector('[data-tntime]');
  tb.disabled = !can; tb.setAttribute('aria-pressed', String(can && tnTimesOn()));
  tb.title = !can ? 'A video, or the Timer for a talk given live, gives the times' : vid ? 'Each new line starts with the time on the video. A click on a time plays the video from there.' : 'Each new line starts with the time on the Timer. Start it as the talk starts.';
  const ck = bar.querySelector('.tnclock'); ck.hidden = !live;
  if (live) { const c = spClockOf(st), say = (c.at ? '❚❚ ' : '▶ ') + fmtTime(spClockMs(c) / 1000); if (ck.dataset.say !== say) { ck.dataset.say = say; ck.textContent = say; ck.setAttribute('aria-pressed', String(!!c.at)); ck.title = c.at ? 'Pause the Timer' : 'Start the Timer'; } }
  const any = tnL.some(y => y.s.trim()), heads = tnL.some(y => y.k === 'h' && y.s.trim());
  const show = { head: heads, unhead: tnHead().length > 0, copy: any, clear: !!tnStored(st), back: true };
  for (const b of bar.querySelectorAll('[data-tnm]')) b.hidden = !show[b.dataset.tnm];
  const back = tnBackOn(), bm = bar.querySelector('[data-tnm="back"]'); bm.setAttribute('aria-checked', String(back));
  const ft = h.querySelector('.tnfoot'), say = back ? 'Goes back to the student with the paper' : 'Only for you. Not given back.';
  if (ft && ft.dataset.say !== say) { ft.dataset.say = say; ft.dataset.on = String(back); ft.querySelector('span').textContent = say; ft.setAttribute('aria-pressed', String(back)); }
}
function tnDraw(host, st) {
  if (host.dataset.st !== st.key || !host.querySelector('.tn')) {
    host.dataset.st = st.key; tnSt = null;
    host.innerHTML = '<div class="tn"><div class="tnbar" role="toolbar" aria-label="Notes">' +
      Object.entries(TN_K).map(([k, [w, g]]) => '<button class="tnb" data-tnk="' + k + '" aria-pressed="false" title="' + w + '"><i data-k="' + k + '">' + g + '</i><span>' + w + '</span></button>').join('') +
      '<span class="tnsep" aria-hidden="true"></span><button class="tnb" data-tntime aria-pressed="true">Times</button><button class="tnb tnclock" data-tnclk hidden></button>' +
      kmWrap('⋯', 'class="icon kdots" aria-label="More for these notes" title="More for these notes"',
        '<button class="mitem" data-tnm="head">Use these headings for every student</button><button class="mitem" data-tnm="unhead">Clear the headings for every student</button>' +
        '<button class="mitem" role="menuitemcheckbox" data-tnm="back" aria-checked="true">Give these notes back with the paper</button><button class="mitem" data-tnm="copy">Copy notes</button><button class="mitem" data-tnm="clear">Clear this student’s notes</button>', 'right') +
      '</div><div class="tnlist"></div><p class="tnhint" hidden><button class="link" data-tnrub>Start with a heading for each rubric row</button></p>' +
      '<button class="tnfoot" data-tnback aria-pressed="true" title="Whether these notes go back to the student as a page of the returned paper, for every student in this assignment. Click to change."><i aria-hidden="true"></i><span></span></button></div>';
  }
  const a = document.activeElement, typing = !!(a && a.classList.contains('tnin') && host.contains(a));
  if (tnSt !== st || (!typing && JSON.stringify(tnView(st)) !== JSON.stringify(tnL))) tnRows(host, st); else tnBar(host, st);
  if (!tnIv) tnIv = setInterval(() => { const h = tnHost(); if (!h || !batch || !batch.students[cur]) { clearInterval(tnIv); tnIv = 0; return; } tnBar(h, batch.students[cur]); }, 500);
}
SP_TOOLS.push({ key: 'typed', label: 'Type notes', ok: () => true, draw: tnDraw });
function tnFocus(i, c) {
  const ta = document.querySelector('#spBody .tnin[data-tni="' + i + '"]'); if (!ta) return;
  tnAt = i; ta.focus(); c = Math.min(c, ta.value.length); ta.setSelectionRange(c, c);
}
// A change to the lines themselves: kept, drawn again, and the caret where it belongs.
function tnRe(st, i, c) { tnPut(st, false); tnPaint(); tnFocus(i, c); }
// Whether the caret is on the first (d < 0) or last visual line of a line that wraps, measured with a hidden copy of it.
function tnH(ta, s) {
  if (!tnMz) { tnMz = document.createElement('textarea'); tnMz.className = 'tnin tnmz'; tnMz.rows = 1; tnMz.tabIndex = -1; tnMz.setAttribute('aria-hidden', 'true'); }
  if (tnMz.parentNode !== ta.parentNode) ta.parentNode.appendChild(tnMz);
  tnMz.style.width = ta.clientWidth + 'px'; tnMz.value = s; return tnMz.scrollHeight;
}
const tnEdge = (ta, d) => ta.selectionStart === ta.selectionEnd && (d < 0 ? tnH(ta, ta.value.slice(0, ta.selectionStart)) <= tnH(ta, '') : tnH(ta, ta.value.slice(0, ta.selectionStart)) >= tnH(ta, ta.value));
// A line as copied or pasted: [2:15] for its time, then # + > ? for its kind.
function tnParse(s) {
  const o = {}; let m = /^\s*\[(\d+):([0-5]\d)\]\s*/.exec(s);
  if (m) { o.t = +m[1] * 60 + +m[2]; s = s.slice(m[0].length); }
  m = /^(Strength|Next step|Question): /i.exec(s); if (m) { o.k = 'pnq'['strength|next step|question'.split('|').indexOf(m[1].toLowerCase())]; s = s.slice(m[0].length); } else s = s.replace(/^\s*[-•*] /, '');
  o.s = s.replace(/\s+$/, '').replace(/\t/g, ' '); return o;
}
const tnText = L => L.filter(x => x.s.trim()).map((x, i) => x.k === 'h' ? (i ? '\n' : '') + x.s : (x.t != null ? '[' + fmtTime(x.t) + '] ' : '') + (x.k ? TN_K[x.k][0] + ': ' : '') + x.s).join('\n');

/* ---------- typing ---------- */
const tnIn = e => { const ta = e.target.closest && e.target.closest('#spBody .tnin'); return ta && batch && tnSt === batch.students[cur] && tnL[+ta.dataset.tni] ? ta : null; };
$('#paper').addEventListener('input', e => {
  const ta = tnIn(e); if (!ta) return;
  const st = tnSt, i = +ta.dataset.tni, x = tnL[i]; let v = ta.value.replace(/[\r\n]+/g, ' '), kind = false;
  if (v !== ta.value) ta.value = v;
  if (!x.s && v && x.t == null && tnTimesOn() && (tnHasVid(st) || tnTimer(st))) { const t = tnNow(st); if (t != null) { x.t = Math.floor(t); kind = true; } }
  x.s = v; tnFit(ta);
  if (kind) { const row = ta.parentNode; if (x.k) row.dataset.k = x.k; row.firstChild.innerHTML = tnGut(x, i); ta.setAttribute('aria-label', x.k ? TN_K[x.k][0] : 'Note'); }
  tnPut(st, !kind);
  tnBar(tnHost(), st);
});
$('#paper').addEventListener('keydown', e => {
  const ta = tnIn(e); if (!ta || e.isComposing) return;
  const st = tnSt, i = +ta.dataset.tni, x = tnL[i], a = ta.selectionStart, b = ta.selectionEnd, k = e.key;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[zy]$/i.test(k)) { e.preventDefault(); e.stopPropagation(); return k.toLowerCase() === 'z' && !e.shiftKey ? undo() : redo(); }
  const kk = /^Digit[1-4]$/.test(e.code) && e.altKey && (e.ctrlKey || e.metaKey) && !e.shiftKey && Object.keys(TN_K)[+e.code.slice(5) - 1];
  if (kk) { e.preventDefault(); e.stopPropagation(); if (x.k === kk) delete x.k; else x.k = kk; return tnRe(st, i, a); }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === 'Escape') { e.preventDefault(); ta.blur(); return; }
  if (k === 'Enter') {
    e.preventDefault();
    const rest = x.s.slice(b), n = { s: rest }; x.s = x.s.slice(0, a); if (rest && x.k) n.k = x.k;
    tnL.splice(i + 1, 0, n); return tnRe(st, i + 1, 0);
  }
  if (k === 'Backspace' && !a && !b) {
    if (x.k) { e.preventDefault(); delete x.k; return tnRe(st, i, 0); }
    if (!i) return;
    e.preventDefault();
    const p = tnL[i - 1], at = p.s.length; if (!at && p.t == null && x.t != null) p.t = x.t;
    p.s += x.s; if (!at && !p.k && x.k) p.k = x.k;
    tnL.splice(i, 1); return tnRe(st, i - 1, at);
  }
  if (k === 'Delete' && a === b && a === x.s.length && i < tnL.length - 1) {
    e.preventDefault(); const n = tnL[i + 1]; if (!a && x.t == null && n.t != null) x.t = n.t;
    x.s += n.s; tnL.splice(i + 1, 1); return tnRe(st, i, a);
  }
  if (e.shiftKey) return;
  if ((k === 'ArrowUp' && i > 0 && tnEdge(ta, -1)) || (k === 'ArrowDown' && i < tnL.length - 1 && tnEdge(ta, 1))) { e.preventDefault(); tnFocus(i + (k === 'ArrowUp' ? -1 : 1), a); }
});
$('#paper').addEventListener('paste', e => {
  const ta = tnIn(e); if (!ta) return;
  const txt = (e.clipboardData && e.clipboardData.getData('text/plain')) || ''; if (!/[\r\n]/.test(txt)) return;   // one line pastes as usual
  e.preventDefault();
  const st = tnSt, i = +ta.dataset.tni, x = tnL[i], a = ta.selectionStart, tail = x.s.slice(ta.selectionEnd), ls = txt.replace(/\r\n?/g, '\n').split('\n').map(tnParse);
  if (!a) { if (ls[0].k) x.k = ls[0].k; if (ls[0].t != null) x.t = ls[0].t; }
  x.s = x.s.slice(0, a) + ls[0].s;
  const more = ls.slice(1), last = more.length ? more[more.length - 1] : x, at = last.s.length;
  tnL.splice(i + 1, 0, ...more); last.s += tail;
  tnRe(st, i + more.length, at);
});
$('#paper').addEventListener('focusin', e => { const ta = tnIn(e); if (ta) { tnAt = +ta.dataset.tni; tnBar(tnHost(), tnSt); } });
// The bar's buttons leave the caret where it is.
$('#paper').addEventListener('mousedown', e => { if (e.target.closest('.tnbar .tnb, .tnchip, .tnx')) e.preventDefault(); });
$('#paper').addEventListener('click', async e => {
  const box = e.target.closest('.tn'); if (!box || !batch || tnSt !== batch.students[cur]) return;
  const st = tnSt, el = e.target.closest('[data-tnk],[data-tntime],[data-tnclk],[data-tnt],[data-tnx],[data-tnrub],[data-tnm],[data-tnback]'); if (!el) return;
  const d = el.dataset, ta = box.querySelector('.tnin[data-tni="' + tnAt + '"]'), c = ta ? ta.selectionStart : 0;
  if (d.tnk) { const x = tnL[tnAt]; if (!x) return; if (x.k === d.tnk) delete x.k; else x.k = d.tnk; return tnRe(st, tnAt, c); }
  if (d.tntime != null) { if (tnTimesOn()) store.set('gs.tnTime', false); else store.del('gs.tnTime'); return tnBar(tnHost(), st); }
  if (d.tnclk != null) { spClockGo(spClockOf(st)); return tnBar(tnHost(), st); }
  if (d.tnt) { const x = tnL[+d.tnt]; if (x && x.t != null && !vidSeek($('#paper'), x.t)) toast('This time is from the Timer. There is no video to go to.'); return; }
  if (d.tnx) { const x = tnL[+d.tnx]; if (x) delete x.t; return tnRe(st, +d.tnx, (tnL[+d.tnx] || { s: '' }).s.length); }
  if (d.tnrub != null) { tnL = setup.criteria.flatMap(s => [{ s: String(s), k: 'h' }, { s: '' }]); return tnRe(st, 1, 0); }
  if (d.tnback != null || d.tnm === 'back') { if (tnBackOn()) setup.tnBack = false; else delete setup.tnBack; spSetupKeep(); tnBar(tnHost(), st); return toast(tnBackOn() ? 'Typed notes go back with each paper in this assignment' : 'Typed notes stay with you in this assignment'); }
  const m = d.tnm;
  if (m === 'head') { setup.tnHead = tnL.filter(x => x.k === 'h' && x.s.trim()).map(x => x.s.trim()); spSetupKeep(); tnBar(tnHost(), st); return toast('Every student with no notes yet starts with ' + setup.tnHead.length + (setup.tnHead.length === 1 ? ' heading' : ' headings')); }
  if (m === 'unhead') { delete setup.tnHead; spSetupKeep(); tnRows(tnHost(), st); return toast('Students with no notes start with an empty page again'); }
  if (m === 'copy') return navigator.clipboard.writeText(tnText(tnL)).then(() => toast('Notes copied'), () => toast('Copying didn’t work in this browser.'));
  if (m === 'clear') {
    if (!await askDlg('Clear the typed notes for this student?\n\nUndo brings them back.', { ok: 'Clear', danger: true, lg: 1 })) return;
    if (batch.students[cur] !== st) return;
    tnSnap(st); delete st.grade.tn; touchGrade(st); saveSoon(); renderList(); tnRows(tnHost(), st);
  }
});
Object.assign(window.__gs, { tnText: () => tnText(tnL), tnLines: () => tnL.map(x => ({ ...x })) });

/* ---------- the page that goes back with the paper ---------- */
// Drawn like the feedback page (feedback.js): the same ink, fonts, margins and wrapping, drawn on a canvas so any language's letters come out.
// Headings bold; a strength, a next step or a question named in a column of its own; a line's time muted in the first column.
// No name: the paper it goes with says whose it is. last: these are the file's last pages (no feedback page in front).
function tnBlocks(ctx, st, W, M) {
  const UI = 'Inter, ' + FONT, cw = W - 2 * M, L = (st.grade.tn.l || []).filter(x => String(x.s || '').trim()), out = [];
  const anyT = L.some(x => x.t != null), timeW = anyT ? 40 : 0, words = { p: tr('Strength'), n: tr('Next step'), q: tr('Question') };
  ctx.font = '600 11px ' + UI;
  const kinds = L.filter(x => words[x.k]), labW = kinds.length ? Math.min(Math.round(cw * 0.3), Math.max(...kinds.map(x => ctx.measureText(words[x.k]).width)) + 14) : 0;
  const text = (lines, font, color, x, y, lh) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh)); };
  const title = fbWrap(ctx, (batch.assignment && batch.assignment.name) || batch.name, '11.5px ' + UI, cw);
  out.push({ h: 30 + title.length * 16 + 14, draw: y => { text([tr('Notes from your teacher')], '700 19px ' + UI, FB_INK, M, y + 20, 24); text(title, '11.5px ' + UI, FB_MUTED, M, y + 40, 16); ctx.fillStyle = FB_INK; ctx.fillRect(M, y + 30 + title.length * 16 + 12, cw, 1.2); } });
  L.forEach((x, i) => {
    const head = x.k === 'h', font = head ? '700 13.5px ' + UI : '12.5px ' + UI, tx = M + timeW + (head ? 0 : labW), lh = head ? 19 : 18;
    const lines = fbWrap(ctx, String(x.s).trim(), font, M + cw - tx), gap = head ? (i ? 16 : 8) : 5;
    // one block a line of text, so a long note runs on to the next page where the page ends
    lines.forEach((ln, k) => out.push({ h: (k ? 0 : gap) + lh, draw: y => {
      const b = y + (k ? 0 : gap) + lh - 5;
      if (!k && x.t != null) text([fmtTime(x.t)], '10.5px ' + UI, FB_MUTED, M, b, lh);
      if (!k && words[x.k]) text([words[x.k]], '600 11px ' + UI, FB_INK2, M + timeW, b, lh);
      text([ln], font, FB_INK, tx, b, lh);
    } }));
  });
  return out;
}
async function tnAddPages(out, st, W, H, dpi, before) {
  if (!(W >= 400 && H >= 500 && W <= 1300 && H <= 1300) || W > H) { W = 612; H = 792; }
  const M = Math.max(44, Math.round(W * 0.095)), scale = dpi / 72, UI = 'Inter, ' + FONT;
  const pages = fbPages(tnBlocks(document.createElement('canvas').getContext('2d'), st, W, M), M, H - M - 22);
  for (let i = 0; i < pages.length; i++) {
    const c = document.createElement('canvas'); c.width = Math.ceil(W * scale); c.height = Math.ceil(H * scale);
    const ctx = c.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const mine = fbPages(tnBlocks(ctx, st, W, M), M, H - M - 22)[i] || [];
    let y = M; for (const b of mine) { b.draw(y); y += b.h; }
    const foot = i < pages.length - 1 ? 'The notes continue on the next page.' : before ? 'Your marked paper starts on the next page.' : '';
    if (foot) { ctx.font = '10px ' + UI; ctx.fillStyle = FB_MUTED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(tr(foot), M, H - M + 6); }
    out.addPage([W, H]).drawImage(await out.embedJpg(await canvasJpg(c, 0.92)), { x: 0, y: 0, width: W, height: H });
    c.width = c.height = 0;
  }
  tnPagesMade = pages.length;
  return pages.length;
}
let tnPagesMade = 0;
Object.assign(window.__gs, { tnPagesMade: () => tnPagesMade, tnOut: i => tnOut(batch.students[i]) });

