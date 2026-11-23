// One stop in the Tab order for a set of buttons that belong together (the tools, the colours, a page's turn buttons): Tab reaches
// the one that is on (or the one marked data-rovehome, or the first), and the arrow keys, Home and End move among them. A set inside a set keeps its own stop.
import { useLayoutEffect, useRef } from 'preact/hooks';

const itemsOf = el => [...el.querySelectorAll('button, input, [role="tab"]')].filter(x => !x.disabled && x.closest('[data-rove]') === el && !x.closest('[role="menu"]'));
export function useRove(vertical = false) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const items = itemsOf(el); if (!items.length) return;
    const cur = items.find(x => x === document.activeElement) || items.find(x => x.getAttribute('aria-pressed') === 'true' || x.getAttribute('aria-checked') === 'true') || items.find(x => x.hasAttribute('data-rovehome')) || items[0];
    for (const x of items) x.tabIndex = x === cur ? 0 : -1;
  });
  const onKeyDown = e => {
    const el = ref.current; if (!el || e.altKey || e.ctrlKey || e.metaKey) return;
    const back = vertical ? 'ArrowUp' : 'ArrowLeft', fwd = vertical ? 'ArrowDown' : 'ArrowRight';
    if (![back, fwd, 'Home', 'End'].includes(e.key)) return;
    const items = itemsOf(el), i = items.indexOf(document.activeElement);
    if (i < 0 || !items.length) return;
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === fwd ? 1 : -1) + items.length) % items.length;
    e.preventDefault(); e.stopPropagation();
    for (const x of items) x.tabIndex = x === items[n] ? 0 : -1;
    items[n].focus();
  };
  return { ref, onKeyDown, 'data-rove': '' };
}
