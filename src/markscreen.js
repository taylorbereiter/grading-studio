/* ---------------- the marking screen: small menus, the student list's filters, the score panel's extras ---------------- */
// A button with data-km opens the menu right after it. One menu at a time. Escape, a click anywhere else, or picking something closes it.
// (A function, not a const: a class page drawn while the app is still loading uses it before this file has run.)
function kmWrap(label, attrs, items, cls) { return '<span class="kmw"><button ' + attrs + ' data-km aria-haspopup="true" aria-expanded="false">' + label + '</button><div class="km' + (cls ? ' ' + cls : '') + '" hidden>' + items + '</div></span>'; }
// The ⋯ on a file's bar. Nothing to offer: no button.
const fileMenu = items => items ? kmWrap('⋯', 'class="icon kdots" aria-label="More for this file" title="More for this file"', items, 'right') : '';
let kmOn = null;
const kmItems = m => [...m.querySelectorAll('button, a[href]')].filter(x => !x.disabled && x.checkVisibility());
function kmClose(focus) {
  const b = kmOn; if (!b) return;
  kmOn = null;
  if (!b.isConnected) return;
  b.setAttribute('aria-expanded', 'false');
  const m = b.nextElementSibling; if (m) m.hidden = true;
  if (focus) b.focus({ preventScroll: true });
}
function kmOpen(b) {
  kmClose();
  const m = b.nextElementSibling; if (!m || !m.classList.contains('km')) return;
  m.hidden = false; m.classList.remove('flip'); b.setAttribute('aria-expanded', 'true'); kmOn = b;
  // near the bottom of its panel it opens upward, so it is never cut off
  const host = b.closest('#paper, #grade, .side'), r = m.getBoundingClientRect(), hr = host && host.getBoundingClientRect();
  if (hr && r.bottom > hr.bottom - 6 && b.getBoundingClientRect().top - hr.top > r.height + 8) m.classList.add('flip');
  const first = kmItems(m)[0]; if (first) first.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-km]');
  if (b) return b === kmOn ? kmClose() : kmOpen(b);
  if (!kmOn) return;
  if (e.target.closest('.km [data-armed]')) return;   // Remove asks for a second click: the menu waits for it
  kmClose();
});
// A press on the page only closes the menu. It mustn't also mark the paper underneath.
document.addEventListener('pointerdown', e => {
  if (kmOn && !kmOn.isConnected) kmOn = null;   // its paper was drawn again
  if (!kmOn || !e.target.closest('.pg')) return;
  e.preventDefault(); e.stopPropagation(); kmClose();
}, true);
document.addEventListener('focusout', e => { if (kmOn && e.relatedTarget && !e.relatedTarget.closest('.kmw')) kmClose(); });
document.addEventListener('keydown', e => {
  if (!kmOn) return;
  if (!kmOn.isConnected) { kmOn = null; return; }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return kmClose(true); }
  if (e.key === 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
  e.stopPropagation();   // nothing behind the menu gets a key; its own buttons still press
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const list = kmItems(kmOn.nextElementSibling), i = list.indexOf(document.activeElement), n = list.length;
  if (n) list[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n].focus();
}, true);

/* ---------------- the student list's filters ---------------- */
// What needs a look on a paper: a page to rescan, a grade on it to confirm or pick, a score that differs from the paper, a new or changed file.
function flagsOf(st) {
  const out = [];
  if (st.files.some(f => Object.values(f.sc || {}).some(r => r.re))) out.push('A page needs a rescan');
  if (manyReads(st)) out.push('More than one grade on the paper'); else if (st.doubts && st.doubts.length) out.push('A grade on the paper to confirm');
  if (!noScore(st) && disagreeNote(st)) out.push('Your score differs from the paper');
  if (batch.carry && st.files.some(f => batch.carry.flags[f.path])) out.push('A new or changed file');
  return out;
}
const LIST_FILTERS = [
  ['all', 'All', () => true, 'Every student'],
  ['todo', 'To score', st => !noScore(st) && (fmNow() ? !st.grade.fb : !gradeOf(st).done), 'Papers with no score yet, or only part of one'],
  ['flag', 'Flagged', st => flagsOf(st).length > 0, 'Papers with something to look at: a page to rescan, a grade on the paper to confirm, a score that differs from the paper, or a new or changed file'],
  ['nopaper', 'No paper', st => !st.files.length && !noScore(st), 'Students with nothing turned in'],
  ['late', 'Late', st => st.grade.status === 'late', 'Students you marked late'],
  ['out', 'Left out', st => !!st.grade.outAvg && !noScore(st), 'Papers you left out of the average'],
];
// Only for this visit, and only for this assignment: opening another one shows everyone again.
let listFilter = 'all', listFilterOf = null;
function lfCheck() { if (batch && listFilterOf !== batch) { listFilterOf = batch; listFilter = 'all'; } }
const lfMatch = st => LIST_FILTERS.find(f => f[0] === listFilter)[2](st);
// The paper she is on stays in the list even when it no longer fits, so scoring it doesn't pull it out from under her.
const lfShows = i => listFilter === 'all' || i === cur || lfMatch(batch.students[i]);
// The order Previous, Next and the arrow keys walk: the list as it shows.
function navOrder() { lfCheck(); return (anonOn() ? anonOrder() : batch.students.map((_, i) => i)).filter(lfShows); }
// One button beside the find box says which papers the list shows; its menu has the others, each with its count.
const LF_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
function lfChips() {
  lfCheck();
  const todoName = fmNow() ? 'To finish' : 'To score', name = k => k === 'todo' ? todoName : LIST_FILTERS.find(f => f[0] === k)[1];
  const items = LIST_FILTERS.map(([k, label, fn, tip]) => {
    const n = batch.students.filter(fn).length, id = k === 'todo' ? ' id="pLeft"' : k === 'out' ? ' id="pOut"' : '';
    const quiet = n === 0 && listFilter !== k && k !== 'all' && k !== 'todo' && k !== 'flag';   // No paper, Late and Left out show only when there are some
    return '<button class="mitem lf" data-lf="' + k + '"' + id + ' aria-pressed="' + (listFilter === k) + '" title="' + tip + '"' + (quiet ? ' hidden' : '') + '>' + name(k) + ' <span class="v">' + n + '</span></button>';
  }).join('');
  return '<div class="lfilt" role="group" aria-label="Show in the list">' + kmWrap(LF_ICON + '<span class="t">' + name(listFilter) + '</span>', 'class="lfnow' + (listFilter === 'all' ? '' : ' on') + '" id="lfBtn" aria-label="Show in the list: ' + name(listFilter) + '" title="Which papers the list shows: ' + name(listFilter) + '. Previous and Next follow it."', items, 'right') + '</div>';
}
function lfDraw() { const el = $('#lfSlot'); if (el && batch) el.innerHTML = lfChips(); }
function lfSet(k) {
  lfCheck();
  listFilter = LIST_FILTERS.some(f => f[0] === k) ? k : 'all';
  renderList(); renderGrade();   // Previous and Next follow the list
}
document.addEventListener('click', e => { const b = e.target.closest('[data-lf]'); if (b && batch) lfSet(listFilter === b.dataset.lf ? 'all' : b.dataset.lf); });

/* ---------------- saved comments, one click from the comment box ---------------- */
// Her saved comments are the same ones the Comment tool offers. The first few show as chips; the rest, and saving this one, are under Saved comments.
const cmtShort = t => { t = String(t).replace(/\s+/g, ' ').trim(); return t.length > 26 ? t.slice(0, 25).trimEnd() + '…' : t; };
function cmtChips() {
  const chip = (t, i) => '<button class="cchip" data-cbank="' + i + '" title="' + esc(t) + '">' + esc(cmtShort(t)) + '</button>';
  return '<div class="cbank">' + bank.slice(0, 3).map(chip).join('') +
    kmWrap('Saved comments', 'class="cchip cmore" id="cmtMore" title="Your saved comments, and saving this one"',
      '<button class="mitem" data-cbsave>Save this comment<small>It shows here and under every comment on a paper</small></button>' +
      (bank.length ? '<div class="kmhd">Click one to add it</div>' + bank.map((t, i) => '<button class="mitem" data-cbank="' + i + '" title="' + esc(t) + '">' + esc(t.length > 90 ? t.slice(0, 89) + '…' : t) + '</button>').join('') : '<p class="kmnote">Nothing saved yet.</p>'), 'up') + '</div>';
}
function cmtClick(e) {
  const ta = $('#cmtIn'); if (!ta) return false;
  const c = e.target.closest('[data-cbank]');
  if (c) {
    const t = bank[+c.dataset.cbank]; if (t == null) return true;
    ta.value = ta.value.trim() ? ta.value.replace(/\s+$/, '') + ' ' + t : t;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length;
    return true;
  }
  if (e.target.closest('[data-cbsave]')) {
    const t = ta.value.trim();
    if (!t) { toast('Type the comment first, then save it.'); return true; }
    if (bank.includes(t)) { toast('That one is already saved.'); return true; }
    bank.unshift(t); store.set('gs.bank', bank); toast('Saved. It’s one click away on every paper now.');
    const box = $('#grade .cbank'); if (box) box.outerHTML = cmtChips();
    return true;
  }
  return false;
}
Object.assign(window.__gs, { flagsOf, lfSet, navOrder, kmClose, setList, listPeek, fsSide, fullSideSet, listKept, scoreRow: () => rowOn });
