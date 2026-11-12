/* ---------------- Full screen (11/12): the whole page fills the screen, on both pages and every screen ----------------
   The Full screen button (in the sidebar, and in the top bar while a paper is open), F, or Find anything puts the page in the browser's
   full screen. F again, the button, or Esc leaves it. Only the look changes: no screen is closed and nothing is saved or lost on the way
   in or out. While it is on, the sidebar folds to icons, and while a paper is open it goes away so the paper gets the room.
   Nothing is stored: a browser lets a page go full screen only when she asks, so it can't come back by itself on the next visit.
   Present, the seating chart, the name picker and the Examples show put their own stage in full screen on top of this; when they end,
   the page is back in full screen as it was. */
const gsFull = {
  on: () => document.fullscreenElement === document.documentElement,
  can: () => !!(document.fullscreenEnabled && document.documentElement.requestFullscreen),
  async toggle() {
    try {
      if (gsFull.on()) await document.exitFullscreen();
      else if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch { }
  },
  // The look follows the browser: on while the page is full screen. A stage of its own on top (Present, seating) leaves it as it was.
  paint() {
    const root = document.documentElement, fe = document.fullscreenElement;
    if (!fe) root.classList.remove('gsfull'); else if (fe === root) root.classList.add('gsfull');
    const on = root.classList.contains('gsfull'), can = gsFull.can();
    for (const b of document.querySelectorAll('[data-gsfull]')) {
      b.hidden = !can;
      const say = on ? 'Leave full screen' : 'Full screen', tip = on ? 'Leave full screen ( F or Esc )' : 'Full screen ( F )';
      if (b.title !== tip) { b.title = tip; b.setAttribute('aria-label', say); }
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const l = b.querySelector('.rl'); if (l && l.dataset.en !== say) { l.dataset.en = say; l.textContent = say; }
    }
  },
  // A stage of its own taken off the page. Removed while it is full screen, the browser would leave full screen altogether, so with the
  // page in full screen under it, it steps down to that first and is removed after. Answers false when there was nothing to do.
  drop(el) {
    if (document.fullscreenElement !== el || !document.documentElement.classList.contains('gsfull')) return false;
    const go = () => el.remove(); document.exitFullscreen().then(go, go); return true;
  },
};
document.addEventListener('fullscreenchange', () => gsFull.paint());
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-gsfull]'); if (b) { e.preventDefault(); gsFull.toggle(); } });
// F, from anywhere on the page but a text box. A key a screen already uses for itself (F for feedback on formative work, F inside
// Present or the name picker) is left to it: those screens answer first and say so.
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || (e.key !== 'f' && e.key !== 'F')) return;
  const a = document.activeElement;
  if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
  if (document.fullscreenElement && !gsFull.on()) return;   // a stage of its own is showing
  if (!gsFull.can()) return;
  e.preventDefault(); gsFull.toggle();
});
gsFull.paint();
window.__gsFull = gsFull;
