// The marking screen beside other windows (src/saving.js tabsLook, tabsCatchUp, tabLetGo, tabFinishUp), for windows of the new app
// and of the current app alike:
// - another window saved this download: when she comes back to this window, what is waiting here is saved first (merged in, never
//   over the other's work, students/write.js saveWork), then the download opens again from storage on the student she was on;
//   if she goes straight on typing in a box as she comes back, the box comes back with the focus and caret, and what she typed
//   meanwhile goes in (holdTyping, giveBack below);
// - another window forgot it: it closes here too;
// - another window is about to replace everything: what is half typed or waiting is saved now, so it is counted in.
import * as tabs from '../../shared/tabs.js';
import { newestWork } from '../../students/index.js';

let M = null;
const merge = () => (M ? Promise.resolve(M) : import('../../engines/merge.js').then(m => (M = m)));

// hooks: { batch() the open download, save() resolves when everything waiting is saved, reopen(key) open it again on that student,
// forgotten() close it }. Returns the function that stops listening.
export function watchWindows(hooks) {
  let busy = false, held = null;
  const behind = async b => {
    if (b.behind) return true;
    const st = tabs.savedStamp(b.id); if (!st || st === b.seen) return false;
    const other = await newestWork(b.id); if (!other) return false;
    if ((await merge()).tabDiffers(b.revs, other)) { b.behind = true; return true; }
    b.seen = st; return false;
  };
  const catchUp = async () => {
    const b = hooks.batch(); if (!b || !b.revs || b.reopening || busy || document.hidden || !tabs.live()) return;
    if (tabs.forgotSince(b.id, b.opened)) return hooks.forgotten();
    busy = true;
    try {
      if (!(await behind(b))) return;
      held = holdTyping();
      await hooks.save();
      if (hooks.batch() !== b) { giveBack(held, () => true); held = null; return; }
      b.reopening = true;   // once: this copy is done with, the download opens anew from storage
      hooks.reopen(b.students[hooks.cur()] && b.students[hooks.cur()].key);
      const h = held; held = null;
      giveBack(h, () => !h.box.isConnected);   // the screen draws the download anew: its box then is a new one
    } catch (e) { console.error(e); if (held) { giveBack(held, () => true); held = null; } } finally { busy = false; }
  };
  const offs = [
    tabs.on('saved', id => { const b = hooks.batch(); if (b && b.id === id && b.revs) behind(b).catch(e => console.error(e)); }),   // noted; its next save merges, and coming back reopens
    tabs.on('forgot', id => { const b = hooks.batch(); if (b && b.id === id && tabs.forgotSince(id, b.opened)) hooks.forgotten(); }),
    tabs.on('finish', () => hooks.save()),
  ];
  const vis = () => { if (!document.hidden) catchUp(); };
  window.addEventListener('focus', catchUp); document.addEventListener('visibilitychange', vis);
  return () => { offs.forEach(f => f()); window.removeEventListener('focus', catchUp); document.removeEventListener('visibilitychange', vis); };
}

// She came back to this window and went straight on typing in a box (a comment, points) while the download opens again: the box is
// drawn anew, so what she types meanwhile is held here, and once the box is back it gets the focus and the caret where they were,
// with what she typed put in as typing is (an input event, so it is saved as usual). Nothing typed is dropped.
const TYPED = 'textarea, input:not([type]), input[type=text], input[type=number], input[type=search]';
function holdTyping() {
  const box = document.activeElement;
  if (!box || !box.matches || !box.matches(TYPED)) return null;
  const sel = box.id ? '#' + CSS.escape(box.id) : box.tagName.toLowerCase() + [...box.classList].map(c => '.' + CSS.escape(c)).join('');
  const h = { box, sel, i: [...document.querySelectorAll(sel)].indexOf(box), a: box.selectionStart, z: box.selectionEnd, text: '' };
  h.key = e => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1) h.text += e.key;
    else if (e.key === 'Enter' && box.tagName === 'TEXTAREA') h.text += '\n';
    else if (e.key === 'Backspace' && h.text) h.text = h.text.slice(0, -1);
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', h.key, true);
  return h;
}
function giveBack(h, ready, until = Date.now() + 15000) {
  if (!h) return;
  const el = document.querySelectorAll(h.sel)[h.i];
  if ((!ready() || !el || el.disabled) && Date.now() < until) return void setTimeout(() => giveBack(h, ready, until), 30);
  window.removeEventListener('keydown', h.key, true);
  if (!el || el.disabled) return;
  el.focus({ preventScroll: true });
  const n = el.value.length, a = Math.min(h.a ?? n, n), z = Math.min(h.z ?? n, n);
  let caret = true; try { el.setSelectionRange(a, z); } catch { caret = false; }   // a number box has no caret to put back
  if (!h.text) return;
  if (caret) el.setRangeText(h.text, a, z, 'end'); else el.value += h.text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
