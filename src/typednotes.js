/* ---------------- typed notes (11/16): a tab of the side pane, a page to type on like any document ----------------
   One editing surface (contenteditable) on a white page: paragraphs, a heading, a small heading, bulleted and numbered lists two
   levels deep, bold, italic, underline and highlight. A paragraph can carry a mark (a strength, a next step or a question, shown
   beside it, never typed) and the moment it was started on the video or the Timer (a chip in the margin, a click plays from there).
   Kept on the student's grade as blocks, never as HTML: st.grade.tn = { l: [{ s: text, k: 'h' heading | 'p' | 'n' | 'q' mark,
   t: seconds, y: 'h2' small heading | 'ul' | 'ol', d: 2 (second list level), f: [[from, to, bits]] (1 bold, 2 italic, 4 underline,
   8 highlight) }] }, and gone when empty. The first version saved { s, k, t } only, and that still reads the same.
   On the grade, it is saved, merged, carried in a take-home file and the folder, and shared by a group, the way the comment is.
   setup.tnHead = [text]: every student with no notes starts with these headings, an empty paragraph under each.
   setup.tnBack: whether the notes go back to the student as a page of the returned paper (absent: they do).
   The page is drawn from the blocks with DOM nodes, and read back by walking it; a paste is read the same way from an inert copy,
   so nothing pasted or saved is ever set as HTML. Every change is one of the app's own undo steps (typing joined within 1.5 s). */
const TN_K = { h: ['Heading', 'H'], p: ['Strength', '✓'], n: ['Next step', '→'], q: ['Question', '?'] };
const TN_TAG = [[1, 'B'], [2, 'I'], [4, 'U'], [8, 'MARK']];
let tnL = [], tnSt = null, tnLast = null, tnIv = 0, tnRng = null, tnRO = null, tnQuiet = false;
// Started: words in a paragraph that isn't a heading (headings alone are only the shape of the notes).
function tnHasG(g) { return !!(g && g.tn && Array.isArray(g.tn.l) && g.tn.l.some(x => x && x.k !== 'h' && x.y !== 'h2' && String(x.s || '').trim())); }
function tnHas(st) { return !!st && tnHasG(st.grade); }
const tnStored = st => (st.grade.tn && Array.isArray(st.grade.tn.l) && st.grade.tn.l.length ? st.grade.tn.l : null);
const tnTimesOn = () => store.get('gs.tnTime', true) !== false;
// Whether the notes go back to the student as a page of the returned paper: the assignment's choice (setup.tnBack), on unless she turns it off.
const tnBackOn = () => setup.tnBack !== false;
function tnOut(st) { return tnBackOn() && tnHas(st); }
const tnHead = () => (Array.isArray(setup.tnHead) ? setup.tnHead.filter(s => typeof s === 'string' && s.trim()) : []);
const tnHeadOf = x => x.k === 'h' || x.y === 'h2';
const tnListOf = x => x.y === 'ul' || x.y === 'ol';
// A block's formatting as one number a character, and back to runs.
function tnBits(x) { const a = new Array(x.s.length).fill(0); for (const r of Array.isArray(x.f) ? x.f : []) if (Array.isArray(r)) for (let i = Math.max(0, r[0] | 0); i < Math.min(a.length, r[1] | 0); i++) a[i] |= r[2] & 15; return a; }
function tnRuns(a) { const f = []; for (let i = 0; i < a.length;) { let j = i + 1; while (j < a.length && a[j] === a[i]) j++; if (a[i]) f.push([i, j, a[i]]); i = j; } return f; }
// A block as it is kept: only what is known, nothing empty.
function tnClean(x) {
  const o = { s: String(x.s || '').replace(/[\r\n\t ]/g, ' ') };
  if (TN_K[x.k]) o.k = x.k;
  if (/^(h2|ul|ol)$/.test(x.y) && o.k !== 'h') o.y = x.y;
  if (o.y === 'h2' && o.k) delete o.k;
  if (tnListOf(o) && +x.d === 2) o.d = 2;
  if (typeof x.t === 'number' && isFinite(x.t) && x.t >= 0) o.t = Math.floor(x.t);
  const f = tnRuns(tnBits({ s: o.s, f: x.f })); if (f.length) o.f = f;
  return o;
}
// What she sees for a student: their notes, or the headings for everyone with a paragraph under each, or one empty paragraph.
function tnView(st) {
  const s = tnStored(st); if (s) return s.map(tnClean);
  const h = tnHead(); return h.length ? h.flatMap(s => [{ s, k: 'h' }, { s: '' }]) : [{ s: '' }];
}
const tnHasVid = st => st.files.some(f => f.kind === 'media' || f.kind === 'link');
// The Timer's clock is offered for a talk given live: any student with no video.
const tnTimer = st => !tnHasVid(st);
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
  const was = tnHas(st), L = tnL.map(tnClean);
  if (L.some(x => x.s.trim())) st.grade.tn = { l: L }; else delete st.grade.tn;
  touchGrade(st); saveSoon();
  if (was !== tnHas(st)) renderList();
}
// After Ctrl Z: the notes as they are now, on the student they belong to, the caret where it was.
function tnBack(st) {
  const i = batch.students.indexOf(st); if (i < 0) return;
  if (i !== cur) return openStudent(i);
  const h = tnHost(); if (!h) return;
  const ed = tnEd(), p = ed && document.activeElement === ed ? tnPos() : null;
  tnLoad(h, st); if (p) tnSetPos(p);
}

/* ---------- the page, its blocks and the caret ---------- */
const tnHost = () => $('#spBody > .sptool[data-tool="typed"]');
const tnEd = () => document.querySelector('#spBody .tned');
function tnEl(x) {
  const el = document.createElement('div'); el.className = 'tnp'; el.tnWas = x.s;
  for (const k of ['k', 'y', 'd', 't']) if (x[k] != null) el.dataset[k] = x[k];
  if (tnHeadOf(x)) { el.setAttribute('role', 'heading'); el.setAttribute('aria-level', x.k === 'h' ? '3' : '4'); }
  const a = tnBits(x);
  for (let i = 0; i < x.s.length;) {
    let j = i + 1; while (j < x.s.length && a[j] === a[i]) j++;
    let n = document.createTextNode(x.s.slice(i, j));
    for (const [b, t] of TN_TAG) if (a[i] & b) { const w = document.createElement(t); w.appendChild(n); n = w; }
    el.appendChild(n); i = j;
  }
  if (!x.s) el.appendChild(document.createElement('br'));
  return el;
}
// What an element does to the formatting inside it: its tag, and its own bold, italic or underline style.
function tnFx(el, b) {
  const t = el.tagName.toUpperCase(), s = el.style;
  if (t === 'B' || t === 'STRONG') b |= 1;
  if (t === 'I' || t === 'EM') b |= 2;
  if (t === 'U' || t === 'INS') b |= 4;
  if (t === 'MARK') b |= 8;
  if (s) {
    if (/bold|[6-9]00/.test(s.fontWeight)) b |= 1; else if (/normal|lighter|[1-5]00/.test(s.fontWeight)) b &= ~1;
    if (/italic|oblique/.test(s.fontStyle)) b |= 2; else if (s.fontStyle === 'normal') b &= ~2;
    if (/underline/.test(s.textDecorationLine || s.textDecoration || '')) b |= 4;
  }
  return b;
}
function tnRead(el) {
  const s = [], a = [];
  (function walk(n, b) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { const v = c.nodeValue; for (let i = 0; i < v.length; i++) { s.push(v[i]); a.push(b); } }
      else if (c.nodeType === 1) walk(c, tnFx(c, b));
    }
  })(el, 0);
  const d = el.dataset || {};
  return tnClean({ s: s.join(''), k: d.k, y: d.y, d: d.d, t: d.t != null && d.t !== '' ? +d.t : null, f: tnRuns(a) });
}
// Anything the browser left outside a paragraph (after everything was deleted, say) goes into one.
function tnFix(ed) {
  let box = null, moved = null;
  for (const c of [...ed.childNodes]) {
    if (c.nodeType === 1 && c.classList.contains('tnp')) { box = null; continue; }
    if (!box) { box = document.createElement('div'); box.className = 'tnp'; ed.insertBefore(box, c); moved = box; }
    box.appendChild(c);
  }
  if (!ed.firstChild) { moved = tnEl({ s: '' }); ed.appendChild(moved); }
  if (moved) { const r = document.createRange(); r.selectNodeContents(moved); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  return !!moved;
}
const tnReadAll = () => { const ed = tnEd(); tnFix(ed); return [...ed.children].map(tnRead); };
// The caret as [paragraph, characters into it], for the start and end of the selection.
function tnPos(r) {
  const ed = tnEd(), s = getSelection();
  if (!r) r = s.rangeCount ? s.getRangeAt(0) : null;
  if (!ed || !r || !ed.contains(r.startContainer) || !ed.contains(r.endContainer)) return null;
  const kids = [...ed.children];
  const at = (node, off) => {
    if (node === ed) { const i = Math.min(off, kids.length - 1); return off >= kids.length ? [i, kids[i].textContent.length] : [Math.max(0, i), 0]; }
    let b = node; while (b && b.parentNode !== ed) b = b.parentNode;
    const q = document.createRange(); q.setStart(b, 0); q.setEnd(node, off);
    return [kids.indexOf(b), q.toString().length];
  };
  const a = at(r.startContainer, r.startOffset);
  return { a, z: r.collapsed ? a.slice() : at(r.endContainer, r.endOffset) };
}
function tnPoint(b, off) {
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n, last = null;
  while ((n = w.nextNode())) { if (off <= n.length) return [n, off]; off -= n.length; last = n; }
  return last ? [last, last.length] : [b, 0];
}
function tnSetPos(p) {
  const ed = tnEd(); if (!ed || !p || !ed.children.length) return;
  const B = i => ed.children[Math.max(0, Math.min(i, ed.children.length - 1))], r = document.createRange();
  r.setStart(...tnPoint(B(p.a[0]), p.a[1])); r.setEnd(...tnPoint(B(p.z[0]), p.z[1]));
  if (document.activeElement !== ed) ed.focus({ preventScroll: true });
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); tnRng = r.cloneRange(); tnBar(tnHost(), tnSt);
}
// Before a button's change: the caret back in the page, where it was.
function tnRestore() {
  const ed = tnEd(); if (!ed) return;
  const sel = getSelection();
  if (document.activeElement === ed && sel.rangeCount && ed.contains(sel.anchorNode)) return;   // the caret is already there
  ed.focus({ preventScroll: true });
  if (tnRng && ed.contains(tnRng.startContainer)) { sel.removeAllRanges(); sel.addRange(tnRng); }
}

/* ---------- drawing ---------- */
const TN_SVG = d => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
function tnFrame() {
  const b = (a, t, i) => '<button class="tnb" ' + a + ' aria-pressed="false" title="' + t + '" aria-label="' + t + '">' + i + '</button>';
  const marks = Object.entries(TN_K).filter(([k]) => k !== 'h').map(([k, [w, g]]) => '<button class="mitem" role="menuitemradio" data-tnmk="' + k + '"><i data-k="' + k + '" aria-hidden="true">' + g + '</i> ' + w + '</button>').join('') + '<button class="mitem" role="menuitemradio" data-tnmk="">None</button>';
  const times = '<button class="mitem tnr2" data-tntm>Time</button>';
  return '<div class="tn"><span id="tnLab" hidden>Notes</span><div class="tnbar" role="toolbar" aria-label="Notes">' +
    kmWrap('<span>Normal text</span>' + TN_SVG('<path d="m7 10 5 5 5-5"/>'), 'class="tnb tnsty" title="Text style"',
      '<button class="mitem" role="menuitemradio" data-tns="">Normal text</button><button class="mitem tnh1" role="menuitemradio" data-tns="h">Heading</button><button class="mitem tnh2" role="menuitemradio" data-tns="h2">Small heading</button>') +
    b('data-tnf="bold"', 'Bold', '<b>B</b>') + b('data-tnf="italic"', 'Italic', '<i class="tnit">I</i>') + b('data-tnf="underline"', 'Underline', '<u>U</u>') +
    b('data-tnf="hl"', 'Highlight', TN_SVG('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>')) +
    b('data-tnl="ul"', 'Bulleted list', TN_SVG('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>')) +
    b('data-tnl="ol"', 'Numbered list', TN_SVG('<path d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>')) +
    '<span class="tnsep tnr" aria-hidden="true"></span>' +
    '<span class="tnr">' + kmWrap(TN_SVG('<path d="M5 21V4h11l-2 4 2 4H5"/>'), 'class="tnb tnmk" aria-pressed="false" title="Mark" aria-label="Mark"', marks) + '</span>' +
    '<span class="tnr">' + b('data-tntm', 'Put the time on this paragraph, or take it off', TN_SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')) + '</span>' +
    kmWrap('⋯', 'class="icon kdots" aria-label="More for these notes" title="More for these notes"',
      '<span class="tnr2">' + marks + times + '</span>' +
      '<button class="mitem" role="menuitemcheckbox" data-tnm="times" aria-checked="true">Times</button>' +
      '<button class="mitem" data-tnm="head">Use these headings for every student</button><button class="mitem" data-tnm="unhead">Clear the headings for every student</button>' +
      '<button class="mitem" role="menuitemcheckbox" data-tnm="back" aria-checked="true">Give these notes back with the paper</button><button class="mitem" data-tnm="copy">Copy notes</button><button class="mitem" data-tnm="clear">Clear this student’s notes</button>', 'right') +
    '</div><p class="tnhint" hidden><button class="link" data-tnrub>Start with a heading for each rubric row</button></p>' +
    '<div class="tnpage"><div class="tngut"></div><div class="tnph" aria-hidden="true">Type your notes. Enter starts a new line.</div>' +
    '<div class="tned" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="tnLab" spellcheck="true"></div></div>' +
    '<div class="tnfoot"><button class="tnb tnclock" data-tnclk hidden></button><button class="tnback" data-tnback aria-pressed="true" title="Whether these notes go back to the student as a page of the returned paper, for every student in this assignment. Click to change."><i aria-hidden="true"></i><span></span></button></div></div>';
}
function tnPaint() { const ed = tnEd(); if (!ed) return; ed.replaceChildren(...tnL.map(tnEl)); tnMore(); }
function tnLoad(h, st) { tnSt = st; tnL = tnView(st); tnPaint(); }
// After any change: the grey words in an empty page, the rubric offer, the margin and the bar.
function tnMore() {
  const h = tnHost(), st = tnSt; if (!h || !st) return;
  h.querySelector('.tnph').hidden = !(tnL.length === 1 && !tnL[0].s && !tnL[0].y && !tnL[0].k);
  h.querySelector('.tnhint').hidden = !(!tnStored(st) && !tnHead().length && setup.mode === 'rubric' && setup.criteria.length);
  tnGutter(); tnBar(h, st);
}
// The margin: a paragraph's time (with Times on) and its mark, level with it. Outside the page's text, so never selected or typed over.
function tnGutter() {
  const h = tnHost(), g = h && h.querySelector('.tngut'), ed = tnEd(); if (!g || !ed || !tnSt) return;
  const vid = tnHasVid(tnSt), on = tnTimesOn(), rows = [];
  [...ed.children].forEach((el, i) => {
    const x = tnL[i]; if (!x) return;
    const mk = x.k && x.k !== 'h', tm = on && x.t != null; if (!mk && !tm) return;
    const row = document.createElement('div'); row.className = 'tng'; row.style.top = el.offsetTop + 'px';
    if (tm) { const b = document.createElement('button'); b.className = 'tnchip'; b.dataset.tnt = i; b.title = vid ? 'Play the video from here' : 'The time on the Timer'; b.textContent = fmtTime(x.t); row.appendChild(b); }
    if (mk) { const m = document.createElement('i'); m.dataset.k = x.k; m.title = TN_K[x.k][0]; m.textContent = TN_K[x.k][1]; row.appendChild(m); }
    rows.push(row);
  });
  g.replaceChildren(...rows);
}
// The bar: the formatting where the caret is, the clock, and what the ⋯ offers.
function tnBar(h, st) {
  const bar = h && h.querySelector('.tnbar'); if (!bar || !st) return;
  const ed = tnEd(), s = getSelection(), inEd = !!(ed && s.rangeCount && ed.contains(s.anchorNode));
  const p = inEd ? tnPos() : tnRng && ed && ed.contains(tnRng.startContainer) ? tnPos(tnRng) : null, x = (p && tnL[p.a[0]]) || {};
  const set = (el, on) => { if (el) el.setAttribute('aria-pressed', String(!!on)); };
  for (const c of ['bold', 'italic', 'underline']) set(bar.querySelector('[data-tnf="' + c + '"]'), inEd && document.queryCommandState(c));
  set(bar.querySelector('[data-tnf="hl"]'), p && x.s && (tnBits(x)[Math.max(0, Math.min(p.a[1], x.s.length) - 1)] & 8));
  set(bar.querySelector('[data-tnl="ul"]'), x.y === 'ul'); set(bar.querySelector('[data-tnl="ol"]'), x.y === 'ol');
  set(bar.querySelector('[data-tntm]'), x.t != null);
  const mk = x.k && x.k !== 'h' ? x.k : ''; set(bar.querySelector('.tnmk'), mk);
  for (const b of h.querySelectorAll('[data-tnmk]')) b.setAttribute('aria-checked', String(b.dataset.tnmk === mk));
  const sty = x.k === 'h' ? 'h' : x.y === 'h2' ? 'h2' : '', w = { '': 'Normal text', h: 'Heading', h2: 'Small heading' }[sty], sl = bar.querySelector('.tnsty span');
  if (sl.dataset.say !== w) { sl.dataset.say = w; sl.textContent = w; }
  for (const b of h.querySelectorAll('[data-tns]')) b.setAttribute('aria-checked', String(b.dataset.tns === sty));
  const any = tnL.some(y => y.s.trim()), heads = tnL.some(y => y.k === 'h' && y.s.trim());
  const show = { times: true, head: heads, unhead: tnHead().length > 0, copy: any, clear: !!tnStored(st), back: true };
  for (const b of bar.querySelectorAll('[data-tnm]')) b.hidden = !show[b.dataset.tnm];
  bar.querySelector('[data-tnm="times"]').setAttribute('aria-checked', String(tnTimesOn()));
  const back = tnBackOn(); bar.querySelector('[data-tnm="back"]').setAttribute('aria-checked', String(back));
  const ck = h.querySelector('.tnclock'), live = tnTimer(st); ck.hidden = !live;
  if (live) { const c = spClockOf(st), say = (c.at ? '❚❚ ' : '▶ ') + fmtTime(spClockMs(c) / 1000); if (ck.dataset.say !== say) { ck.dataset.say = say; ck.textContent = say; ck.setAttribute('aria-pressed', String(!!c.at)); ck.title = c.at ? 'Pause the Timer' : 'Start the Timer'; } }
  const ft = h.querySelector('.tnback'), fs = back ? 'Goes back to the student with the paper' : 'Only for you. Not given back.';
  if (ft.dataset.say !== fs) { ft.dataset.say = fs; ft.dataset.on = String(back); ft.querySelector('span').textContent = fs; ft.setAttribute('aria-pressed', String(back)); }
}
function tnDraw(host, st) {
  if (host.dataset.st !== st.key || !host.querySelector('.tn')) {
    host.dataset.st = st.key; tnSt = null; tnRng = null;
    host.innerHTML = tnFrame();
    if (window.ResizeObserver) { if (tnRO) tnRO.disconnect(); tnRO = new ResizeObserver(() => tnGutter()); tnRO.observe(tnEd()); }
  }
  const ed = tnEd(), typing = !!ed && document.activeElement === ed;
  if (tnSt !== st || (!typing && JSON.stringify(tnView(st)) !== JSON.stringify(tnL))) tnLoad(host, st); else tnBar(host, st);
  if (!tnIv) tnIv = setInterval(() => { const h = tnHost(); if (!h || !batch || !batch.students[cur]) { clearInterval(tnIv); tnIv = 0; return; } tnBar(h, batch.students[cur]); }, 500);
}
SP_TOOLS.push({ key: 'typed', label: 'Type notes', ok: () => true, draw: tnDraw });

/* ---------- changes from the bar and the keys ---------- */
// f(block) for each paragraph the selection touches; then drawn again with the selection where it was.
function tnApply(f) {
  const st = tnSt; tnRestore(); tnL = tnReadAll();
  const p = tnPos() || { a: [0, 0], z: [0, 0] }, xs = tnL.slice(p.a[0], p.z[0] + 1);
  f(xs, p);
  tnL = tnL.map(tnClean); tnPaint(); tnSetPos(p); tnPut(st, false);
}
const tnStyle = v => tnApply(xs => xs.forEach(x => { if (v === 'h') { x.k = 'h'; delete x.y; delete x.d; } else if (v === 'h2') { delete x.k; x.y = 'h2'; delete x.d; } else { if (x.k === 'h') delete x.k; if (x.y === 'h2') delete x.y; } }));
const tnList = v => tnApply(xs => { const off = xs.every(x => x.y === v); xs.forEach(x => { if (off) { delete x.y; delete x.d; } else { x.y = v; if (x.k === 'h') delete x.k; } }); });
const tnMark = v => tnApply(xs => xs.forEach(x => { if (tnHeadOf(x)) return; if (v) x.k = v; else delete x.k; }));
const tnIndent = up => tnApply(xs => xs.forEach(x => { if (tnListOf(x)) { if (up) x.d = 2; else delete x.d; } }));
// Highlight: on for the selected words, or off when they all have it.
const tnHl = () => tnApply((xs, p) => {
  const parts = xs.map((x, k) => { const i = p.a[0] + k; return [x, i === p.a[0] ? p.a[1] : 0, i === p.z[0] ? p.z[1] : x.s.length]; });
  const all = parts.every(([x, a, z]) => tnBits(x).slice(a, z).every(b => b & 8));
  for (const [x, a, z] of parts) { const bits = tnBits(x); for (let i = a; i < z; i++) bits[i] = all ? bits[i] & ~8 : bits[i] | 8; x.f = tnRuns(bits); }
});
function tnTime() {
  const st = tnSt, t = tnNow(st);
  tnApply((xs, p) => { const x = tnL[p.a[0]]; if (x.t != null) delete x.t; else if (t != null) x.t = Math.floor(t); });
  if (t == null && tnL.every(x => x.t == null)) toast('A video, or the Timer for a talk given live, gives the times');
}
function tnEnter() {
  const st = tnSt, s = getSelection();
  if (s.rangeCount && !s.isCollapsed) { tnQuiet = true; document.execCommand('delete'); tnQuiet = false; }
  tnL = tnReadAll();
  const p = tnPos(); if (!p) return;
  const i = p.a[0], o = p.a[1], x = tnL[i], list = tnListOf(x) ? { y: x.y, ...(x.d ? { d: x.d } : {}) } : {};
  let at = i + 1;
  if (tnListOf(x) && !x.s) { if (x.d) delete x.d; else delete x.y; at = i; }   // Enter on an empty item: up a level, then out of the list
  else if (!o && x.s) tnL.splice(i, 0, { s: '', ...list });
  else { const a = tnBits(x); tnL.splice(i + 1, 0, { s: x.s.slice(o), f: tnRuns(a.slice(o)), ...list }); x.s = x.s.slice(0, o); x.f = tnRuns(a.slice(0, o)); }
  tnL = tnL.map(tnClean); tnPaint(); tnSetPos({ a: [at, 0], z: [at, 0] }); tnPut(st, false);
}
// Pasted or dropped blocks, at the caret: the first joins the paragraph there, the last takes what was after the caret.
function tnInsert(P) {
  const st = tnSt, s = getSelection();
  if (s.rangeCount && !s.isCollapsed) { tnQuiet = true; document.execCommand('delete'); tnQuiet = false; }
  tnL = tnReadAll();
  const p = tnPos() || { a: [tnL.length - 1, tnL[tnL.length - 1].s.length] }, i = p.a[0], o = p.a[1], x = tnL[i], a = tnBits(x);
  const head = { s: x.s.slice(0, o), f: tnRuns(a.slice(0, o)) }, tail = { s: x.s.slice(o), f: tnRuns(a.slice(o)) };
  const join = (u, v) => ({ s: u.s + v.s, f: tnRuns([...tnBits(u), ...tnBits(v)]) }), kind = b => ({ k: b.k, y: b.y, d: b.d, t: b.t });
  const last = P[P.length - 1], out = P.length === 1 ? [{ ...kind(x.s ? x : P[0]), ...join(join(head, P[0]), tail) }]
    : [{ ...kind(head.s ? x : P[0]), ...join(head, P[0]) }, ...P.slice(1, -1), { ...kind(last), ...join(last, tail) }];
  tnL.splice(i, 1, ...out.map(tnClean));
  const c = P.length === 1 ? [i, o + P[0].s.length] : [i + P.length - 1, last.s.length];
  tnPaint(); tnSetPos({ a: c, z: c.slice() }); tnPut(st, false);
}
// What was pasted, read from an inert copy of it: paragraphs, headings, lists, bold, italic and underline. Nothing else comes in.
function tnFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), out = []; let cur = null;
  const SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|HEAD|TITLE|META|LINK|IMG|SVG|PICTURE|VIDEO|AUDIO|IFRAME|OBJECT|EMBED|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA)$/;
  const BLOCK = /^(P|DIV|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE|TABLE|TR|SECTION|ARTICLE|HEADER|FOOTER|ASIDE|NAV|MAIN|FIGURE|DL|DT|DD)$/;
  const walk = (n, b, ctx) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        let v = c.nodeValue.replace(/\s+/g, ' ');
        if (!cur || cur.done) { cur = { s: '', a: [], k: ctx.k, y: ctx.y, d: ctx.d }; out.push(cur); }
        if (!cur.s) v = v.replace(/^ /, '');
        cur.s += v; for (let i = 0; i < v.length; i++) cur.a.push(b & 7);
        continue;
      }
      if (c.nodeType !== 1) continue;
      const t = c.tagName.toUpperCase(), sa = c.getAttribute('style') || '';
      if (SKIP.test(t) || /mso-list:\s*ignore|display:\s*none/i.test(sa)) continue;
      if (t === 'BR') { if (cur) cur.done = true; continue; }
      if (!BLOCK.test(t)) { walk(c, tnFx(c, b), ctx); continue; }
      if (t === 'UL' || t === 'OL') { const lv = (ctx.lv || 0) + 1; walk(c, b, { y: t === 'OL' ? 'ol' : 'ul', d: lv > 1 ? 2 : 0, lv }); if (cur) cur.done = true; continue; }
      let x = { lv: ctx.lv };
      if (/^H[12]$/.test(t)) x.k = 'h'; else if (/^H[3-6]$/.test(t)) x.y = 'h2';
      else if (t === 'LI') { x.y = ctx.y || 'ul'; x.d = ctx.d; }
      else if (tnListOf(ctx)) { x.y = ctx.y; x.d = ctx.d; }
      // a list paragraph from Word: its level, and a number or a bullet in the part Word marks to be skipped
      const ms = /mso-list:\s*l\d+\s+level(\d)/i.exec(sa);
      if (ms) { const ig = [...c.querySelectorAll('[style]')].find(e => /mso-list:\s*ignore/i.test(e.getAttribute('style'))); x.y = ig && /^\s*\w{1,3}[.)]/.test(ig.textContent) ? 'ol' : 'ul'; x.d = +ms[1] > 1 ? 2 : 0; }
      // a new paragraph, unless the one open is still empty (a <p> inside an <li>)
      if (!cur || cur.done || cur.s) { cur = { s: '', a: [] }; out.push(cur); }
      for (const k of ['k', 'y', 'd']) if (x[k]) cur[k] = x[k];
      walk(c, tnFx(c, b), x);
      if (cur) cur.done = true;
    }
  };
  walk(doc.body, 0, {});
  return out.map(x => { while (x.s.endsWith(' ')) { x.s = x.s.slice(0, -1); x.a.pop(); } return tnClean({ ...x, f: tnRuns(x.a) }); }).filter(x => x.s);
}
// A line of plain text, as Copy notes writes it: a bullet or a number, [2:15] for its time, a mark's word.
function tnParse(s) {
  const o = {}; let m = /^(\s*)(?:([•◦*-])|\d+[.)]) /.exec(s);
  if (m) { o.y = m[2] ? 'ul' : 'ol'; if (m[1].length >= 2) o.d = 2; s = s.slice(m[0].length); }
  m = /^\s*\[(\d+):([0-5]\d)\]\s*/.exec(s); if (m) { o.t = +m[1] * 60 + +m[2]; s = s.slice(m[0].length); }
  m = /^(Strength|Next step|Question): /i.exec(s); if (m) { o.k = 'pnq'['strength|next step|question'.split('|').indexOf(m[1].toLowerCase())]; s = s.slice(m[0].length); }
  o.s = s.replace(/\s+$/, ''); return tnClean(o);
}
// The notes as plain text: headings with a gap before them, • and 1. for lists, marks as words, times as [2:15].
function tnText(L) {
  const out = []; let n1 = 0, n2 = 0;
  for (const x of L) {
    const d2 = tnListOf(x) && x.d === 2;
    if (x.y === 'ol') { if (d2) n2++; else { n1++; n2 = 0; } } else if (!d2) { n1 = 0; n2 = 0; }
    if (!x.s.trim()) continue;
    if (tnHeadOf(x)) { out.push((out.length ? '\n' : '') + x.s); continue; }
    out.push((d2 ? '    ' : '') + (tnListOf(x) ? (x.y === 'ol' ? (d2 ? n2 : n1) + '. ' : '• ') : '') + (x.t != null ? '[' + fmtTime(x.t) + '] ' : '') + (x.k ? TN_K[x.k][0] + ': ' : '') + x.s);
  }
  return out.join('\n');
}

/* ---------- typing ---------- */
const tnIn = e => { const ed = e.target.closest && e.target.closest('#spBody .tned'); return ed && batch && tnSt === batch.students[cur] ? ed : null; };
// What she typed, read back from the page. A paragraph (not a heading) started on a playing video or a running Timer takes that moment.
// "- " or "1. " at the start of a paragraph makes it a list item, as in any document.
function tnSync(type) {
  const ed = tnEd(), st = tnSt; if (!ed || !st) return;
  const L = tnReadAll(), p = tnPos();
  if (p && p.a[0] === p.z[0] && p.a[1] === p.z[1]) {
    const i = p.a[0], x = L[i], el = ed.children[i];
    const m = type === 'insertText' && !tnListOf(x) && !tnHeadOf(x) && /^(?:[-*•]|1[.)]) /.exec(x.s);
    if (m && p.a[1] === m[0].length) {
      x.y = /^1/.test(m[0]) ? 'ol' : 'ul'; x.f = tnRuns(tnBits(x).slice(m[0].length)); x.s = x.s.slice(m[0].length);
      tnL = L.map(tnClean); tnPaint(); tnSetPos({ a: [i, 0], z: [i, 0] }); return tnPut(st, false);
    }
    if (/^insert/.test(type) && el && !el.tnWas && x.s && x.t == null && !tnHeadOf(x) && tnTimesOn()) { const t = tnNow(st); if (t != null) { x.t = Math.floor(t); el.dataset.t = x.t; } }
  }
  [...ed.children].forEach((el, j) => { el.tnWas = L[j].s; });
  tnL = L; tnPut(st, /^(insertText|insertCompositionText|deleteContent)/.test(type)); tnMore();
}
$('#paper').addEventListener('input', e => { if (tnIn(e) && !tnQuiet) tnSync(e.inputType || ''); });
$('#paper').addEventListener('beforeinput', e => {
  if (!tnIn(e)) return;
  const t = e.inputType;
  if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); return tnEnter(); }
  if (t === 'historyUndo' || t === 'historyRedo') { e.preventDefault(); return t === 'historyUndo' ? undo() : redo(); }
  if (t === 'insertFromDrop') e.preventDefault();   // dragged in from elsewhere: only a paste comes in, cleaned
});
$('#paper').addEventListener('keydown', e => {
  const ed = tnIn(e); if (!ed || e.isComposing) return;
  const cmd = (e.ctrlKey || e.metaKey), k = e.key.toLowerCase(), c = e.code, stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (cmd && !e.altKey && (k === 'z' || k === 'y')) { stop(); return k === 'z' && !e.shiftKey ? undo() : redo(); }
  if (cmd && !e.altKey && !e.shiftKey && /^[biu]$/.test(k)) { stop(); return document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[k]); }
  if (cmd && e.altKey && !e.shiftKey && /^Digit[012]$/.test(c)) { stop(); return tnStyle(['', 'h', 'h2'][+c.slice(5)]); }
  if (cmd && e.shiftKey && !e.altKey && (c === 'Digit8' || c === 'Digit7')) { stop(); return tnList(c === 'Digit8' ? 'ul' : 'ol'); }
  if (cmd || e.altKey) return;
  if (k === 'escape') { e.preventDefault(); ed.blur(); return; }
  const p = tnPos(), x = p && tnL[p.a[0]];
  if (e.key === 'Tab' && p && tnL.slice(p.a[0], p.z[0] + 1).every(tnListOf)) { stop(); return tnIndent(!e.shiftKey); }
  // Backspace at the start of a list item takes it out of the list first, one level at a time
  if (e.key === 'Backspace' && p && x && tnListOf(x) && !p.a[1] && p.a[0] === p.z[0] && !p.z[1]) { stop(); return tnApply(xs => { const y = xs[0]; if (y.d) delete y.d; else delete y.y; }); }
});
$('#paper').addEventListener('paste', e => {
  if (!tnIn(e)) return;
  e.preventDefault();
  const cd = e.clipboardData; if (!cd) return;
  const html = cd.getData('text/html'), txt = cd.getData('text/plain') || '';
  let P = html ? tnFromHtml(html) : [];
  if (!P.length) P = txt.replace(/\r\n?/g, '\n').split('\n').map(tnParse).filter((x, i, a) => x.s || (i && i < a.length - 1));
  if (P.length) tnInsert(P);
});
$('#paper').addEventListener('drop', e => { if (tnIn(e)) e.preventDefault(); });
document.addEventListener('selectionchange', () => {
  const ed = tnEd(), s = getSelection(); if (!ed || !s.rangeCount || !ed.contains(s.anchorNode)) return;
  tnRng = s.getRangeAt(0).cloneRange(); tnBar(tnHost(), tnSt);
});
// The bar's buttons, the margin's times and the clock leave the selection where it is, so she types on.
$('#paper').addEventListener('mousedown', e => { if (e.target.closest('.tnbar button, .tngut button, .tnclock')) e.preventDefault(); });
$('#paper').addEventListener('click', async e => {
  const box = e.target.closest('.tn'); if (!box || !batch || tnSt !== batch.students[cur]) return;
  const st = tnSt, el = e.target.closest('[data-tnf],[data-tnl],[data-tns],[data-tnmk],[data-tntm],[data-tnclk],[data-tnt],[data-tnrub],[data-tnm],[data-tnback]'); if (!el) return;
  const d = el.dataset;
  if (d.tnf) { if (d.tnf === 'hl') return tnHl(); tnRestore(); return document.execCommand(d.tnf); }
  if (d.tnl) return tnList(d.tnl);
  if (d.tns != null) return tnStyle(d.tns);
  if (d.tnmk != null) return tnMark(d.tnmk);
  if (d.tntm != null) return tnTime();
  if (d.tnclk != null) { spClockGo(spClockOf(st)); return tnBar(tnHost(), st); }
  if (d.tnt) { const x = tnL[+d.tnt]; if (x && x.t != null && !vidSeek($('#paper'), x.t)) toast('This time is from the Timer. There is no video to go to.'); return; }
  if (d.tnrub != null) { tnL = setup.criteria.flatMap(s => [{ s: String(s), k: 'h' }, { s: '' }]); tnPaint(); tnSetPos({ a: [1, 0], z: [1, 0] }); return tnPut(st, false); }
  if (d.tnback != null || d.tnm === 'back') { if (tnBackOn()) setup.tnBack = false; else delete setup.tnBack; spSetupKeep(); tnBar(tnHost(), st); return toast(tnBackOn() ? 'Typed notes go back with each paper in this assignment' : 'Typed notes stay with you in this assignment'); }
  const m = d.tnm;
  if (m === 'times') { if (tnTimesOn()) store.set('gs.tnTime', false); else store.del('gs.tnTime'); return tnMore(); }
  if (m === 'head') { setup.tnHead = tnL.filter(x => x.k === 'h' && x.s.trim()).map(x => x.s.trim()); spSetupKeep(); tnBar(tnHost(), st); return toast('Every student with no notes yet starts with ' + setup.tnHead.length + (setup.tnHead.length === 1 ? ' heading' : ' headings')); }
  if (m === 'unhead') { delete setup.tnHead; spSetupKeep(); tnLoad(tnHost(), st); return toast('Students with no notes start with an empty page again'); }
  if (m === 'copy') return navigator.clipboard.writeText(tnText(tnL)).then(() => toast('Notes copied'), () => toast('Copying didn’t work in this browser.'));
  if (m === 'clear') {
    if (!await askDlg('Clear the typed notes for this student?\n\nUndo brings them back.', { ok: 'Clear', danger: true, lg: 1 })) return;
    if (batch.students[cur] !== st) return;
    tnSnap(st); delete st.grade.tn; touchGrade(st); saveSoon(); renderList(); tnLoad(tnHost(), st);
  }
});
// A notes page on a student's paper: one quiet link on its bar opens the pane on Type notes. Nothing else changes; the page stays.
$('#paper').addEventListener('click', e => { if (e.target.closest('[data-tntry]')) spOpen('typed'); });
Object.assign(window.__gs, { tnText: () => tnText(tnL), tnLines: () => tnL.map(x => ({ ...x })), tnCaret: () => { const p = tnPos(); return p ? p.a : null; } });


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

