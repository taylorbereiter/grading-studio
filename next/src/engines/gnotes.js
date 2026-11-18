// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// The page the notes are drawn in, and what gives a new paragraph its time (a playing video, or the Timer): the screen hands them in.
let tnHostEl = null, tnNowFn = () => null;
export const tnUse = o => { if ('host' in o) tnHostEl = o.host; if ('now' in o) tnNowFn = o.now; };
const tnHost = () => tnHostEl;
const tnEd = () => (tnHostEl ? tnHostEl.querySelector('.tned') : null);
const tnNow = st => tnNowFn(st);
// The blocks on the page, read and set by the screen's listeners (src/typednotes.js sets them from its own).
export const tnGetL = () => tnL;
export const tnSetL = v => { tnL = v; };
export const tnGetSt = () => tnSt;
export const tnQuietSet = v => { tnQuiet = v; };
export const tnIsQuiet = () => tnQuiet;
export const tnRngSet = r => { tnRng = r; };
import { batch, cur, setup, undoStack, redoStack, saveSoon, toast, renderList, openStudent, groupJust, store } from './gcore.js';
import { shownName, one, tnHas, tnHidden, tnMine, tnBackOn } from './gdraw.js';
import { pushUndo, actStep, touchGrade, groupOf } from './gmark.js';
import { fmtTime } from './gmedia.js';

// src/app/dialogs.js
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch {} t.remove();
  }
  toast(msg);
}
// src/groups.js
const groupOwn = g => !!(g && g.own);
// src/sidepane.js
const spClocks = new Map();
// src/sidepane.js
const spClockOf = st => { let c = spClocks.get(st.key); if (!c) spClocks.set(st.key, c = { ms: 0, at: 0 }); return c; };
// src/sidepane.js
const spClockMs = c => c.ms + (c.at ? Date.now() - c.at : 0);
// src/sidepane.js
const spTalk = () => { const t = Array.isArray(setup.talk) ? setup.talk : []; return [0, 1].map(i => (typeof t[i] === 'number' && t[i] > 0 ? t[i] : null)); };
// src/sidepane.js
function spClockGo(c) { if (c.at) { c.ms += Date.now() - c.at; c.at = 0; } else { for (const o of spClocks.values()) if (o.at) { o.ms += Date.now() - o.at; o.at = 0; } c.at = Date.now(); } }
// src/typednotes.js
const TN_K = { h: ['Heading', 'H'], p: ['Strength', '✓'], n: ['Next step', '→'], q: ['Question', '?'] };
// src/typednotes.js
const TN_TAG = [[1, 'B'], [2, 'I'], [4, 'U'], [8, 'MARK']];
// src/typednotes.js
let tnL = [], tnSt = null, tnLast = null, tnIv = 0, tnRng = null, tnRO = null, tnQuiet = false;
// src/typednotes.js
const tnWho = k => { const i = batch ? batch.students.findIndex(s => s.key === k) : -1; return i < 0 ? '' : shownName(batch.students[i], i); };
// src/typednotes.js
const tnOwnNew = st => (st && typeof groupJust !== 'undefined' && groupJust === st.key && groupOwn(groupOf(st)) ? st.key : null);
// src/typednotes.js
function tnWithHidden(st, L) {
  const old = tnStored(st) || [], keep = []; let vis = 0;
  for (const x of old) { if (tnHidden(x, st)) keep.push([vis, x]); else vis++; }
  const out = L.slice();
  for (let j = keep.length - 1; j >= 0; j--) out.splice(Math.min(keep[j][0], out.length), 0, tnClean(keep[j][1]));
  return out;
}
// src/typednotes.js
const tnStored = st => (st.grade.tn && Array.isArray(st.grade.tn.l) && st.grade.tn.l.length ? st.grade.tn.l : null);
// src/typednotes.js
const tnTimesOn = () => store.get('gs.tnTime', true) !== false;
// src/typednotes.js
const TN_SIZE = { s: [10, 'Compact'], '': [12, 'Standard'], l: [15, 'Large'] };
// src/typednotes.js
const tnSizeOf = () => (TN_SIZE[setup.tnSize] && setup.tnSize) || '';
// src/typednotes.js
const tnHead = () => (Array.isArray(setup.tnHead) ? setup.tnHead.filter(s => typeof s === 'string' && s.trim()) : []);
// src/typednotes.js
const tnHeadOf = x => x.k === 'h' || x.y === 'h2';
// src/typednotes.js
const tnListOf = x => x.y === 'ul' || x.y === 'ol';
// src/typednotes.js
function tnBits(x) { const a = new Array(x.s.length).fill(0); for (const r of Array.isArray(x.f) ? x.f : []) if (Array.isArray(r)) for (let i = Math.max(0, r[0] | 0); i < Math.min(a.length, r[1] | 0); i++) a[i] |= r[2] & 15; return a; }
// src/typednotes.js
function tnRuns(a) { const f = []; for (let i = 0; i < a.length;) { let j = i + 1; while (j < a.length && a[j] === a[i]) j++; if (a[i]) f.push([i, j, a[i]]); i = j; } return f; }
// src/typednotes.js
function tnClean(x) {
  const o = { s: String(x.s || '').replace(/[\r\n\t ]/g, ' ') };
  if (TN_K[x.k]) o.k = x.k;
  if (/^(h2|ul|ol)$/.test(x.y) && o.k !== 'h') o.y = x.y;
  if (typeof x.o === 'string' && x.o) o.o = x.o;
  if (o.y === 'h2' && o.k) delete o.k;
  if (tnListOf(o) && +x.d === 2) o.d = 2;
  if (typeof x.t === 'number' && isFinite(x.t) && x.t >= 0) { o.t = Math.floor(x.t); if (x.h && +x.h) o.h = 1; }
  const f = tnRuns(tnBits({ s: o.s, f: x.f })); if (f.length) o.f = f;
  return o;
}
// src/typednotes.js
function tnView(st) {
  const s = tnStored(st) && tnMine(st, tnStored(st)); if (s && s.length) return s.map(tnClean);
  const h = tnHead(); return h.length ? h.flatMap(s => [{ s, k: 'h' }, { s: '' }]) : [{ s: '' }];
}
// src/typednotes.js
const tnHasVid = st => st.files.some(f => f.kind === 'media' || f.kind === 'link');
// src/typednotes.js
const tnTimer = st => !tnHasVid(st);
// src/typednotes.js
function tnSnap(st, join) {
  const top = undoStack[undoStack.length - 1];
  if (join && top && top === tnLast && top.st === st && !redoStack.length && Date.now() - top.t < 1500) { top.t = Date.now(); return; }
  const before = JSON.stringify(st.grade.tn || null); let after = before;
  const put = v => { const x = JSON.parse(v); if (x) st.grade.tn = x; else delete st.grade.tn; touchGrade(st); saveSoon(); renderList(); tnBack(st); };
  const u = actStep(() => { after = JSON.stringify(st.grade.tn || null); put(before); }, () => put(after), 'typed notes');
  u.st = st; u.t = Date.now(); pushUndo(u); tnLast = u;
}
// src/typednotes.js
function tnPut(st, join) {
  tnSnap(st, join);
  const was = tnHas(st), L = tnWithHidden(st, tnL.map(tnClean));
  if (L.some(x => x.s.trim())) st.grade.tn = { l: L }; else delete st.grade.tn;
  touchGrade(st); saveSoon();
  if (was !== tnHas(st)) renderList();
}
// src/typednotes.js
function tnBack(st) {
  const i = batch.students.indexOf(st); if (i < 0) return;
  if (i !== cur) return openStudent(i);
  const h = tnHost(); if (!h) return;
  const ed = tnEd(), p = ed && document.activeElement === ed ? tnPos() : null;
  tnLoad(h, st); if (p) tnSetPos(p);
}
// src/typednotes.js
function tnEl(x) {
  const el = document.createElement('div'); el.className = 'tnp'; el.tnWas = x.s;
  for (const k of ['k', 'y', 'd', 't', 'h', 'o']) if (x[k] != null) el.dataset[k] = x[k];
  if (x.o) el.title = 'Just for ' + tnWho(x.o);
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
// src/typednotes.js
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
// src/typednotes.js
function tnRead(el) {
  const s = [], a = [];
  (function walk(n, b) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { const v = c.nodeValue; for (let i = 0; i < v.length; i++) { s.push(v[i]); a.push(b); } }
      else if (c.nodeType === 1) walk(c, tnFx(c, b));
    }
  })(el, 0);
  const d = el.dataset || {};
  return tnClean({ s: s.join(''), k: d.k, y: d.y, d: d.d, t: d.t != null && d.t !== '' ? +d.t : null, h: d.h, o: d.o, f: tnRuns(a) });
}
// src/typednotes.js
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
// src/typednotes.js
const tnReadAll = () => { const ed = tnEd(); tnFix(ed); return [...ed.children].map(tnRead); };
// src/typednotes.js
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
// src/typednotes.js
function tnPoint(b, off) {
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n, last = null;
  while ((n = w.nextNode())) { if (off <= n.length) return [n, off]; off -= n.length; last = n; }
  return last ? [last, last.length] : [b, 0];
}
// src/typednotes.js
function tnSetPos(p) {
  const ed = tnEd(); if (!ed || !p || !ed.children.length) return;
  const B = i => ed.children[Math.max(0, Math.min(i, ed.children.length - 1))], r = document.createRange();
  r.setStart(...tnPoint(B(p.a[0]), p.a[1])); r.setEnd(...tnPoint(B(p.z[0]), p.z[1]));
  if (document.activeElement !== ed) ed.focus({ preventScroll: true });
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); tnRng = r.cloneRange(); tnBar(tnHost(), tnSt);
}
// src/typednotes.js
function tnRestore() {
  const ed = tnEd(); if (!ed) return;
  const sel = getSelection();
  if (document.activeElement === ed && sel.rangeCount && ed.contains(sel.anchorNode)) return;   // the caret is already there
  ed.focus({ preventScroll: true });
  if (tnRng && ed.contains(tnRng.startContainer)) { sel.removeAllRanges(); sel.addRange(tnRng); }
}
// src/typednotes.js
const TN_SVG = d => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
// src/typednotes.js
function tnFrame() {
  const b = (a, t, i) => '<button class="tnb" ' + a + ' aria-pressed="false" title="' + t + '" aria-label="' + t + '">' + i + '</button>';
  const marks = Object.entries(TN_K).filter(([k]) => k !== 'h').map(([k, [w, g]]) => '<button class="mitem" role="menuitemradio" data-tnmk="' + k + '"><i data-k="' + k + '" aria-hidden="true">' + g + '</i> ' + w + '</button>').join('') + '<button class="mitem" role="menuitemradio" data-tnmk="">None</button>';
  const times = '<button class="mitem tnr2" data-tntm>Time</button>';
  return '<div class="tn" data-lc="tn"><span id="tnLab" hidden>Notes</span><div class="tnbar" role="toolbar" aria-label="Notes">' +
    kmWrap('<span>Normal text</span>' + TN_SVG('<path d="m7 10 5 5 5-5"/>'), 'class="tnb tnsty" title="Text style"',
      '<button class="mitem" role="menuitemradio" data-tns="">Normal text</button><button class="mitem tnh1" role="menuitemradio" data-tns="h">Heading</button><button class="mitem tnh2" role="menuitemradio" data-tns="h2">Small heading</button>') +
    b('data-tnf="bold"', 'Bold', '<b>B</b>') + b('data-tnf="italic"', 'Italic', '<i class="tnit">I</i>') + b('data-tnf="underline"', 'Underline', '<u>U</u>') +
    b('data-tnf="hl"', 'Highlight', TN_SVG('<path d="M9 15l-3 3h5l1-1"/><path d="M9 15l7-10 4 3-7 10z"/><path d="M4 21h16"/>')) +
    b('data-tnl="ul"', 'Bulleted list', TN_SVG('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>')) +
    b('data-tnl="ol"', 'Numbered list', TN_SVG('<path d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>')) +
    '<span class="tnsep tnr" aria-hidden="true"></span>' +
    '<span class="tnr">' + kmWrap(TN_SVG('<path d="M5 21V4h11l-2 4 2 4H5"/>'), 'class="tnb tnmk" aria-pressed="false" title="Mark" aria-label="Mark"', marks, 'right') + '</span>' +
    '<span class="tnr">' + b('data-tntm', 'Put the time on this paragraph, or take it off', TN_SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')) + '</span>' +
    kmWrap('⋯', 'class="icon kdots" aria-label="More for these notes" title="More for these notes"',
      '<span class="tnr2">' + marks + times + '</span>' +
      '<button class="mitem" role="menuitemcheckbox" data-tnm="times" aria-checked="true">Times</button><button class="mitem" data-tnm="alltimes">Hide all times</button>' +
      '<button class="mitem" data-tnm="head">Use these headings for every student</button><button class="mitem" data-tnm="unhead">Clear the headings for every student</button>' +
      '<button class="mitem" role="menuitemcheckbox" data-tnm="back" aria-checked="true">Give these notes back with the paper</button>' +
      '<button class="mitem" data-tnm="size" data-kmstay aria-expanded="false">Text size for the student</button><span class="tnszs" hidden>' +
      Object.entries(TN_SIZE).map(([k, [, w]]) => '<button class="mitem tnszi" role="menuitemradio" data-tnsz="' + k + '">' + w + '</button>').join('') + '</span>' +
      '<button class="mitem" data-tnm="copy">Copy notes</button><button class="mitem" data-tnm="clear">Clear this student’s notes</button>', 'right') +
    '</div><p class="tnhint" hidden><button class="link" data-tnrub>Start with a heading for each rubric row</button></p>' +
    '<div class="tnpage"><div class="tngut"></div><div class="tnph" aria-hidden="true">Type your notes. Enter starts a new line.</div>' +
    '<div class="tned" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="tnLab" spellcheck="true"></div></div>' +
    '<div class="tnfoot"><button class="tnb tnclock" data-tnclk hidden></button><button class="tnback" data-tnback aria-pressed="true" title="Whether these notes go back to the student as a page of the returned paper, for every student in this assignment. Click to change."><i aria-hidden="true"></i><span></span><span class="tnszw" hidden></span></button></div></div>';
}
// src/typednotes.js
function tnPaint() { const ed = tnEd(); if (!ed) return; ed.replaceChildren(...tnL.map(tnEl)); tnMore(); }
// src/typednotes.js
function tnLoad(h, st) { tnSt = st; tnL = tnView(st); tnPaint(); }
// src/typednotes.js
function tnMore() {
  const h = tnHost(), st = tnSt; if (!h || !st) return;
  h.querySelector('.tnph').hidden = !(tnL.length === 1 && !tnL[0].s && !tnL[0].y && !tnL[0].k);
  h.querySelector('.tnhint').hidden = !(!tnStored(st) && !tnHead().length && setup.mode === 'rubric' && setup.criteria.length);
  tnGutter(); tnBar(h, st);
}
// src/typednotes.js
function tnGutter() {
  const h = tnHost(), g = h && h.querySelector('.tngut'), ed = tnEd(); if (!g || !ed || !tnSt) return;
  const vid = tnHasVid(tnSt), on = tnTimesOn(), rows = [];
  [...ed.children].forEach((el, i) => {
    const x = tnL[i]; if (!x) return;
    const mk = x.k && x.k !== 'h', tm = on && x.t != null; if (!mk && !tm) return;
    const row = document.createElement('div'); row.className = 'tng'; row.style.top = el.offsetTop + 'px';
    // a time shown: the time (a click plays from there) and a small button that hides it; a time hidden: a faint clock that brings it back
    const btn = (c, k, t, txt) => { const b = document.createElement('button'); b.className = c; b.dataset[k] = i; b.title = t; if (txt) b.textContent = txt; else b.innerHTML = TN_SVG(c === 'tnhid' ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' : '<path d="M6 6l12 12M18 6 6 18"/>'); if (!txt) b.setAttribute('aria-label', t); row.appendChild(b); };
    if (tm && x.h) btn('tnhid', 'tnts', 'Show this time');
    else if (tm) { btn('tnhide', 'tnts', 'Hide this time'); btn('tnchip', 'tnt', vid ? 'Play the video from here' : 'The time on the Timer', fmtTime(x.t)); }
    if (mk) { const m = document.createElement('i'); m.dataset.k = x.k; m.title = TN_K[x.k][0]; m.textContent = TN_K[x.k][1]; row.appendChild(m); }
    rows.push(row);
  });
  g.replaceChildren(...rows);
  // the margin only as wide as what is in it: times, marks, or nothing
  g.parentNode.dataset.g = rows.some(r => r.querySelector('.tnchip')) ? 't' : rows.length ? 'm' : '';
}
// src/typednotes.js
function tnShowTime(i) {
  const st = tnSt, ed = tnEd(); if (!st || !ed) return;
  const p = document.activeElement === ed ? tnPos() : null;
  tnL = tnReadAll();
  if (i == null) { const T = tnL.filter(x => x.t != null), hide = T.some(x => !x.h); T.forEach(x => { if (hide) x.h = 1; else delete x.h; }); }
  else { const x = tnL[i]; if (!x || x.t == null) return; if (x.h) delete x.h; else x.h = 1; }
  tnL = tnL.map(tnClean); tnPaint(); if (p) tnSetPos(p); tnPut(st, false);
}
// src/typednotes.js
function tnAllHid() { const T = tnL.filter(x => x.t != null); return T.length > 0 && T.every(x => x.h); }
// src/typednotes.js
function tnBar(h, st) {
  const bar = h && h.querySelector('.tnbar'); if (!bar || !st) return;
  const ed = tnEd(), s = getSelection(), inEd = !!(ed && s.rangeCount && ed.contains(s.anchorNode));
  const p = inEd ? tnPos() : tnRng && ed && ed.contains(tnRng.startContainer) ? tnPos(tnRng) : null, x = (p && tnL[p.a[0]]) || {};
  const set = (el, on) => { if (el) el.setAttribute('aria-pressed', String(!!on)); };
  for (const c of ['bold', 'italic', 'underline']) set(bar.querySelector('[data-tnf="' + c + '"]'), inEd && document.queryCommandState(c));
  set(bar.querySelector('[data-tnf="hl"]'), p && x.s && (tnBits(x)[Math.max(0, Math.min(p.a[1], x.s.length) - 1)] & 8));
  set(bar.querySelector('[data-tnl="ul"]'), x.y === 'ul'); set(bar.querySelector('[data-tnl="ol"]'), x.y === 'ol');
  set(bar.querySelector('[data-tntm]'), x.t != null && !x.h);
  const mk = x.k && x.k !== 'h' ? x.k : ''; set(bar.querySelector('.tnmk'), mk);
  for (const b of h.querySelectorAll('[data-tnmk]')) b.setAttribute('aria-checked', String(b.dataset.tnmk === mk));
  const sty = x.k === 'h' ? 'h' : x.y === 'h2' ? 'h2' : '', w = { '': 'Normal text', h: 'Heading', h2: 'Small heading' }[sty], sl = bar.querySelector('.tnsty span');
  if (sl.dataset.say !== w) { sl.dataset.say = w; sl.textContent = w; }
  for (const b of h.querySelectorAll('[data-tns]')) b.setAttribute('aria-checked', String(b.dataset.tns === sty));
  const any = tnL.some(y => y.s.trim()), heads = tnL.some(y => y.k === 'h' && y.s.trim());
  const timed = tnTimesOn() && tnL.some(y => y.t != null), allw = tnAllHid() ? 'Show all times' : 'Hide all times', ab = bar.querySelector('[data-tnm="alltimes"]');
  if (ab.dataset.say !== allw) { ab.dataset.say = allw; ab.textContent = allw; }
  const show = { times: true, alltimes: timed, head: heads, unhead: tnHead().length > 0, copy: any, clear: !!tnStored(st), back: true, size: true };
  for (const b of bar.querySelectorAll('[data-tnm]')) b.hidden = !show[b.dataset.tnm];
  bar.querySelector('[data-tnm="times"]').setAttribute('aria-checked', String(tnTimesOn()));
  const back = tnBackOn(); bar.querySelector('[data-tnm="back"]').setAttribute('aria-checked', String(back));
  const sz = tnSizeOf(), szb = bar.querySelector('[data-tnm="size"]'); szb.disabled = !back;
  if (!back) { szb.setAttribute('aria-expanded', 'false'); szb.nextElementSibling.hidden = true; }
  for (const b of bar.querySelectorAll('[data-tnsz]')) { b.setAttribute('aria-checked', String(b.dataset.tnsz === sz)); b.disabled = !back; }
  const ck = h.querySelector('.tnclock'), live = tnTimer(st); ck.hidden = !live;
  if (live) { const c = spClockOf(st), say = (c.at ? '❚❚ ' : '▶ ') + fmtTime(spClockMs(c) / 1000); if (ck.dataset.say !== say) { ck.dataset.say = say; ck.textContent = say; ck.setAttribute('aria-pressed', String(!!c.at)); ck.title = c.at ? 'Pause the Timer' : 'Start the Timer'; } }
  const ft = h.querySelector('.tnback'), fs = back ? 'Goes back to the student with the paper' : 'Only for you. Not given back.';
  if (ft.dataset.say !== fs) { ft.dataset.say = fs; ft.dataset.on = String(back); ft.querySelector('span').textContent = fs; ft.setAttribute('aria-pressed', String(back)); }
  // the size shows at the foot only when it isn't the usual one
  const sw = ft.querySelector('.tnszw'), sws = back && sz ? TN_SIZE[sz][1] : '';
  if (sw.dataset.say !== sws) { sw.dataset.say = sws; sw.textContent = sws; sw.hidden = !sws; }
}
// src/typednotes.js
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
// src/typednotes.js
function tnApply(f) {
  const st = tnSt; tnRestore(); tnL = tnReadAll();
  const p = tnPos() || { a: [0, 0], z: [0, 0] }, xs = tnL.slice(p.a[0], p.z[0] + 1);
  f(xs, p);
  tnL = tnL.map(tnClean); tnPaint(); tnSetPos(p); tnPut(st, false);
}
// src/typednotes.js
const tnStyle = v => tnApply(xs => xs.forEach(x => { if (v === 'h') { x.k = 'h'; delete x.y; delete x.d; } else if (v === 'h2') { delete x.k; x.y = 'h2'; delete x.d; } else { if (x.k === 'h') delete x.k; if (x.y === 'h2') delete x.y; } }));
// src/typednotes.js
const tnList = v => tnApply(xs => { const off = xs.every(x => x.y === v); xs.forEach(x => { if (off) { delete x.y; delete x.d; } else { x.y = v; if (x.k === 'h') delete x.k; } }); });
// src/typednotes.js
const tnMark = v => tnApply(xs => xs.forEach(x => { if (tnHeadOf(x)) return; if (v) x.k = v; else delete x.k; }));
// src/typednotes.js
const tnIndent = up => tnApply(xs => xs.forEach(x => { if (tnListOf(x)) { if (up) x.d = 2; else delete x.d; } }));
// src/typednotes.js
const tnHl = () => tnApply((xs, p) => {
  const parts = xs.map((x, k) => { const i = p.a[0] + k; return [x, i === p.a[0] ? p.a[1] : 0, i === p.z[0] ? p.z[1] : x.s.length]; });
  const all = parts.every(([x, a, z]) => tnBits(x).slice(a, z).every(b => b & 8));
  for (const [x, a, z] of parts) { const bits = tnBits(x); for (let i = a; i < z; i++) bits[i] = all ? bits[i] & ~8 : bits[i] | 8; x.f = tnRuns(bits); }
});
// src/typednotes.js
function tnTime() {
  const st = tnSt, t = tnNow(st);
  tnApply((xs, p) => { const x = tnL[p.a[0]]; if (x.t != null && x.h) delete x.h; else if (x.t != null) delete x.t; else if (t != null) x.t = Math.floor(t); });
  if (t == null && tnL.every(x => x.t == null)) toast('A video, or the Timer for a talk given live, gives the times');
}
// src/typednotes.js
function tnEnter() {
  const st = tnSt, s = getSelection();
  if (s.rangeCount && !s.isCollapsed) { tnQuiet = true; document.execCommand('delete'); tnQuiet = false; }
  tnL = tnReadAll();
  const p = tnPos(); if (!p) return;
  const i = p.a[0], o = p.a[1], x = tnL[i], list = tnListOf(x) ? { y: x.y, ...(x.d ? { d: x.d } : {}) } : {};
  let at = i + 1;
  if (tnListOf(x) && !x.s) { if (x.d) delete x.d; else delete x.y; at = i; }   // Enter on an empty item: up a level, then out of the list
  else if (!o && x.s) tnL.splice(i, 0, { s: '', ...list, ...(x.o ? { o: x.o } : {}) });
  else { const a = tnBits(x), who = (o < x.s.length && x.o) || tnOwnNew(st); tnL.splice(i + 1, 0, { s: x.s.slice(o), f: tnRuns(a.slice(o)), ...list, ...(who ? { o: who } : {}) }); x.s = x.s.slice(0, o); x.f = tnRuns(a.slice(0, o)); }
  tnL = tnL.map(tnClean); tnPaint(); tnSetPos({ a: [at, 0], z: [at, 0] }); tnPut(st, false);
}
// src/typednotes.js
function tnInsert(P) {
  const st = tnSt, s = getSelection();
  if (s.rangeCount && !s.isCollapsed) { tnQuiet = true; document.execCommand('delete'); tnQuiet = false; }
  tnL = tnReadAll();
  const p = tnPos() || { a: [tnL.length - 1, tnL[tnL.length - 1].s.length] }, i = p.a[0], o = p.a[1], x = tnL[i], a = tnBits(x);
  const head = { s: x.s.slice(0, o), f: tnRuns(a.slice(0, o)) }, tail = { s: x.s.slice(o), f: tnRuns(a.slice(o)) };
  const join = (u, v) => ({ s: u.s + v.s, f: tnRuns([...tnBits(u), ...tnBits(v)]) }), kind = b => ({ k: b.k, y: b.y, d: b.d, t: b.t, h: b.h });
  const last = P[P.length - 1], out = P.length === 1 ? [{ ...kind(x.s ? x : P[0]), ...join(join(head, P[0]), tail) }]
    : [{ ...kind(head.s ? x : P[0]), ...join(head, P[0]) }, ...P.slice(1, -1), { ...kind(last), ...join(last, tail) }];
  const who = x.o || tnOwnNew(st); for (const b of out) if (who) b.o = who;   // pasted into one partner's paragraph, or on Just them: theirs
  tnL.splice(i, 1, ...out.map(tnClean));
  const c = P.length === 1 ? [i, o + P[0].s.length] : [i + P.length - 1, last.s.length];
  tnPaint(); tnSetPos({ a: c, z: c.slice() }); tnPut(st, false);
}
// src/typednotes.js
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
// src/typednotes.js
function tnParse(s) {
  const o = {}; let m = /^(\s*)(?:([•◦*-])|\d+[.)]) /.exec(s);
  if (m) { o.y = m[2] ? 'ul' : 'ol'; if (m[1].length >= 2) o.d = 2; s = s.slice(m[0].length); }
  m = /^\s*\[(\d+):([0-5]\d)\]\s*/.exec(s); if (m) { o.t = +m[1] * 60 + +m[2]; s = s.slice(m[0].length); }
  m = /^(Strength|Next step|Question): /i.exec(s); if (m) { o.k = 'pnq'['strength|next step|question'.split('|').indexOf(m[1].toLowerCase())]; s = s.slice(m[0].length); }
  o.s = s.replace(/\s+$/, ''); return tnClean(o);
}
// src/typednotes.js
function tnText(L) {
  const out = []; let n1 = 0, n2 = 0;
  for (const x of L) {
    const d2 = tnListOf(x) && x.d === 2;
    if (x.y === 'ol') { if (d2) n2++; else { n1++; n2 = 0; } } else if (!d2) { n1 = 0; n2 = 0; }
    if (!x.s.trim()) continue;
    if (tnHeadOf(x)) { out.push((out.length ? '\n' : '') + x.s); continue; }
    out.push((d2 ? '    ' : '') + (tnListOf(x) ? (x.y === 'ol' ? (d2 ? n2 : n1) + '. ' : '• ') : '') + (x.t != null && !x.h ? '[' + fmtTime(x.t) + '] ' : '') + (x.k ? TN_K[x.k][0] + ': ' : '') + x.s);
  }
  return out.join('\n');
}
// src/typednotes.js
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
    // a paragraph started now is for whoever Write for points at: Just the partner on screen, or everyone
    if (/^insert/.test(type) && el && !el.tnWas && x.s && !tnHeadOf(x)) { const o = tnOwnNew(st); if (o) { x.o = o; el.dataset.o = o; el.title = 'Just for ' + tnWho(o); } else if (x.o) { delete x.o; delete el.dataset.o; el.removeAttribute('title'); } }
    if (/^insert/.test(type) && el && !el.tnWas && x.s && x.t == null && !tnHeadOf(x) && tnTimesOn()) { const t = tnNow(st); if (t != null) { const hid = tnAllHid(); x.t = Math.floor(t); el.dataset.t = x.t; if (hid) { x.h = 1; el.dataset.h = 1; } } }
  }
  [...ed.children].forEach((el, j) => { el.tnWas = L[j].s; });
  tnL = L; tnPut(st, /^(insertText|insertCompositionText|deleteContent)/.test(type)); tnMore();
}
// src/markscreen.js
function kmWrap(label, attrs, items, cls) { return '<span class="kmw"><button ' + attrs + ' data-km aria-haspopup="true" aria-expanded="false">' + label + '</button><div class="km' + (cls ? ' ' + cls : '') + '" hidden>' + items + '</div></span>'; }
export { tnDraw, tnLoad, tnPaint, tnMore, tnBar, tnGutter, tnShowTime, tnAllHid, tnApply, tnStyle, tnList, tnMark, tnIndent, tnHl, tnTime, tnEnter, tnInsert, tnFromHtml, tnParse, tnText, tnSync, tnPos, tnSetPos, tnRestore, tnReadAll, tnBack, tnPut, tnSnap, tnStored, tnHidden, tnTimesOn, tnBackOn, tnSizeOf, tnHead, TN_SIZE, tnView, spClockOf, spClockMs, spClockGo, spTalk };
