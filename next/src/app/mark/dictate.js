// Dictation for the long boxes the marking screen builds itself (the margin comment, a Word comment): the same mic as every other
// long text box (ui Mic), drawn into the box, and the words go in where the cursor is, as typed words would (an input event follows,
// so the box saves them the way it saves typing).
import { h, render } from 'preact';
import { Mic } from '../../ui/index.js';

export function putWords(el, words) {
  if (!el || !words) return;
  const v = el.value, a = el.selectionStart ?? v.length, b = el.selectionEnd ?? v.length, before = v.slice(0, a), sp = before && !/\s$/.test(before) ? ' ' : '';
  el.value = before + sp + words.trim() + v.slice(b);
  const c = (before + sp + words.trim()).length; el.setSelectionRange(c, c);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
// A mic for a textarea that isn't drawn by preact: a span holding it, to put beside the box.
export function micFor(ta) {
  const s = document.createElement('span'); s.className = 'micat';
  render(h(Mic, { onText: w => { putWords(ta, w); ta.focus(); } }), s);
  s.stop = () => render(null, s);   // the box closing stops listening
  return s;
}
