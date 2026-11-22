// What the sidebar and the keys get once the focus timer's runner is in (run.js loads this), so the shell and the first
// load carry none of it: Focus in the sidebar with today against the goal or the time left (src/focus.js #railFocus); a plain click
// on her assistant opens the menu of the others she switches to (screens/beside.jsx, src/beside.js); and Alt S takes a screenshot on
// any screen but the marking screen, which has its own (src/snip.js, router.js PARTS.snip).
import { h, render } from 'preact';
import { toast } from '../../ui/index.js';
import { register } from '../../services/shortcuts.js';
import * as router from '../router.js';
import './lines.js';

let on = false;
export function sideStart(Nav) {
  if (on) return; on = true;
  // Focus in the sidebar, at the top of its free space: a box of its own there, which the shell's drawing leaves alone
  const put = () => {
    const g = document.querySelector('[data-shell-nav] .grow'); if (!g || g.querySelector('[data-fc-navbox]')) return;
    const box = document.createElement('div'); box.setAttribute('data-fc-navbox', ''); g.appendChild(box); render(h(Nav), box);
  };
  put(); new MutationObserver(put).observe(document.querySelector('.shell') || document.body, { childList: true });   // the sidebar drawn anew
  // the assistant's link in the sidebar: a plain click asks the menu; a click with a key held is the browser's
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-shell-nav] a.nav[target="_blank"]');
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); a.setAttribute('aria-haspopup', 'menu');
    import('../screens/beside.jsx').then(m => m.besidePress(a), er => console.error(er));
  }, true);
  register({ id: 'snip', keys: ['alt+s', 'alt+ß'], label: 'focus.k_snip', when: () => router.current().chunk !== 'mark' && !document.querySelector('[data-sniplayer]'),
    run: () => router.PARTS.snip().then(m => m.startSnip({ toast })) });
}
