// Sheets (a panel from the right, from the bottom on a phone), dialogs (a short question in the middle) and toasts.
// Sheets and dialogs are the browser's own modal dialog: the page behind can't be reached, Escape closes, and focus goes back to
// what opened it. Tab and Shift+Tab are kept inside as well, so focus never leaves for the browser's own bar.
import { h, Fragment } from 'preact';
import { useEffect, useRef, useState, useId } from 'preact/hooks';
import { IconButton } from './controls.jsx';
import { Icon } from './icons.js';
import { t } from '../i18n/t.js';

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
export function trapTab(e, root) {
  if (e.key !== 'Tab') return;
  const f = [...root.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
  if (!f.length) { e.preventDefault(); return; }
  const a = f[0], z = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === a || !root.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
}
// Opens a <dialog> modal while open is true; Escape or a click on the dim area calls onClose. Gives focus back on closing.
export function useModal(open, onClose, { initial } = {}) {
  const ref = useRef(), back = useRef(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) {
      back.current = document.activeElement;
      d.showModal();
      const first = (initial && d.querySelector(initial)) || d.querySelector('[data-autofocus]') || d.querySelector(FOCUSABLE);
      if (first) first.focus();
    } else if (!open && d.open) {
      d.close();
      if (back.current && back.current.isConnected) back.current.focus();
    }
  }, [open]);
  useEffect(() => () => { const d = ref.current; if (d && d.open) { d.close(); if (back.current && back.current.isConnected) back.current.focus(); } }, []);
  const props = {
    ref,
    onCancel: e => { e.preventDefault(); onClose && onClose(); },
    onKeyDown: e => trapTab(e, ref.current),
    onClick: e => { if (e.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose && onClose(); } },
  };
  return props;
}
export function Sheet({ open, title, onClose, wide, children, footer, icon }) {
  const id = useId(), p = useModal(open, onClose);
  return <dialog class={'sheet' + (wide ? ' wide' : '')} aria-labelledby={id} {...p}>
    {open && <>
      <header>{icon}<h2 id={id}>{title}</h2><IconButton icon="x" label={t('common.close')} onClick={onClose} tip={false} /></header>
      <div class="body">{children}</div>{footer && <footer>{footer}</footer>}</>}
  </dialog>;
}
// A short question. actions: the buttons, the main one last.
export function Dialog({ open, title, onClose, children, actions }) {
  const id = useId(), p = useModal(open, onClose);
  return <dialog class="dlg" aria-labelledby={id} {...p} role={actions ? 'alertdialog' : 'dialog'}>
    {open && <><header><h2 id={id}>{title}</h2></header><div class="body">{children}</div>{actions && <footer>{actions}</footer>}</>}
  </dialog>;
}

// Toasts: a short line at the bottom, with Undo when the thing can be taken back. toast(text, { undo, action, ms }).
let push = null, seq = 0;
const waiting = [];
export function toast(text, o = {}) {
  const x = { id: ++seq, text, ...o };
  if (push) push(x); else waiting.push(x);
  return x.id;
}
export function ToastHost() {
  const [list, setList] = useState([]);
  useEffect(() => {
    push = x => {
      setList(l => [...l.slice(-2), x]);
      setTimeout(() => setList(l => l.filter(y => y.id !== x.id)), x.ms || (x.undo ? 8000 : 4000));
    };
    waiting.splice(0).forEach(push);
    return () => { push = null; };
  }, []);
  const drop = id => setList(l => l.filter(y => y.id !== id));
  return <div class="toasts" role="region" aria-label={t('toast.region')}>
    {list.map(x => <div class={'toast' + (x.undo || x.action ? '' : ' plain')} key={x.id} role="status" aria-live="polite">
      <span>{x.text}</span>
      {x.undo && <button type="button" onClick={() => { drop(x.id); x.undo(); }}>{t('common.undo')}</button>}
      {x.action && <button type="button" onClick={() => { drop(x.id); x.action.run(); }}>{x.action.label}</button>}
      {(x.undo || x.action) && <button type="button" class="x" aria-label={t('common.dismiss')} onClick={() => drop(x.id)}><Icon name="x" size="xs" /></button>}
    </div>)}
  </div>;
}
