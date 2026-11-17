// Things that float over the page next to what opened them: the menu and the tooltip.
import { h, Fragment, cloneElement, toChildArray } from 'preact';
import { useState, useRef, useEffect, useLayoutEffect, useId } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Icon } from './icons.js';

// Puts a floating box under (or over, when there is no room) the element it belongs to, inside the window.
function place(box, anchor, gap = 6) {
  if (!box || !anchor) return;
  const a = anchor.getBoundingClientRect(), b = box.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  let top = a.bottom + gap; if (top + b.height > H - 8 && a.top - gap - b.height > 8) top = a.top - gap - b.height;
  let left = Math.min(Math.max(8, a.left), W - b.width - 8);
  box.style.top = Math.max(8, top) + 'px'; box.style.left = left + 'px';
}

// A tooltip for one control: shown on hover after a moment and at once on keyboard focus; Escape hides it.
export function Tooltip({ text, kbd, children }) {
  const [on, setOn] = useState(false), id = useId(), wrap = useRef(), box = useRef(), timer = useRef();
  useLayoutEffect(() => { if (on) place(box.current, wrap.current.firstElementChild || wrap.current); }, [on]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = later => { clearTimeout(timer.current); timer.current = setTimeout(() => setOn(true), later ? 450 : 0); };
  const hide = () => { clearTimeout(timer.current); setOn(false); };
  const child = toChildArray(children)[0];
  return <span ref={wrap} style={{ display: 'contents' }} onMouseEnter={() => show(true)} onMouseLeave={hide} onFocusIn={e => { if (e.target.matches(':focus-visible')) show(false); }} onFocusOut={hide} onKeyDown={e => { if (e.key === 'Escape' && on) { hide(); e.stopPropagation(); } }} onPointerDown={hide}>
    {cloneElement(child, { 'aria-describedby': on ? id : undefined })}
    {on && createPortal(<div ref={box} class="tip" role="tooltip" id={id}>{text}{kbd && <kbd>{kbd}</kbd>}</div>, document.body)}
  </span>;
}

// A menu from a button. items: [{ id, label, sub, icon, kbd, onSelect, disabled, checked }, { sep: true }, { heading }].
// Keyboard: Enter, Space or Down opens on the first item, Up on the last; arrows move and wrap; Home and End; a letter jumps;
// Escape closes and gives focus back to the button; Tab closes. trigger(props) draws the button.
export function Menu({ trigger, items, label }) {
  const [open, setOpen] = useState(false), btn = useRef(), box = useRef(), first = useRef(0), id = useId();
  const real = () => [...(box.current ? box.current.querySelectorAll('[role^="menuitem"]:not([aria-disabled="true"])') : [])];
  const close = (refocus = true) => { setOpen(false); if (refocus && btn.current) btn.current.focus(); };
  useLayoutEffect(() => {
    if (!open) return;
    place(box.current, btn.current);
    const it = real(); if (it.length) it[first.current === -1 ? it.length - 1 : 0].focus();
    const away = e => { if (!box.current.contains(e.target) && !btn.current.contains(e.target)) close(false); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);
  const openAt = where => { first.current = where; setOpen(true); };
  const onBtnKey = e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAt(0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); openAt(-1); }
  };
  const onKey = e => {
    const it = real(), i = it.indexOf(document.activeElement);
    const go = n => { e.preventDefault(); it[(n + it.length) % it.length].focus(); };
    if (e.key === 'ArrowDown') go(i + 1); else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(it.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close(false);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase(), from = it.slice(i + 1).concat(it.slice(0, i + 1)), hit = from.find(el => (el.textContent || '').trim().toLowerCase().startsWith(k));
      if (hit) { e.preventDefault(); hit.focus(); }
    }
  };
  const pick = x => { if (x.disabled) return; close(); x.onSelect && x.onSelect(x); };
  return <>
    {trigger({ ref: btn, 'aria-haspopup': 'menu', 'aria-expanded': String(open), 'aria-controls': open ? id : undefined, onClick: () => (open ? close() : openAt(0)), onKeyDown: onBtnKey })}
    {open && createPortal(<div ref={box} class="pop" role="menu" id={id} aria-label={label} onKeyDown={onKey}>
      {items.map(x => x.sep ? <div class="sep" role="separator" /> : x.heading ? <div class="mh" role="presentation">{x.heading}</div> :
        <button type="button" class="mi" role={x.checked != null ? 'menuitemradio' : 'menuitem'} aria-checked={x.checked != null ? String(!!x.checked) : undefined} aria-disabled={x.disabled ? 'true' : undefined} tabIndex={-1} onClick={() => pick(x)}>
          {x.checked != null ? <span class="chk" style={{ width: 16 }}>{x.checked && <Icon name="check" />}</span> : x.icon && <Icon name={x.icon} />}
          <span class="mt"><b>{x.label}</b>{x.sub && <small>{x.sub}</small>}</span>{x.kbd && <kbd>{x.kbd}</kbd>}</button>)}
    </div>, document.body)}
  </>;
}
