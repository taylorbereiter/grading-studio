// The simple controls. Every one: hover, press, a focus ring from :focus-visible, a disabled look, and the keyboard behaviour its
// ARIA role promises. No part takes words of its own: labels arrive already translated (t()), or as a teacher's own text.
import { h, Fragment } from 'preact';
import { useRef, useId } from 'preact/hooks';
import { Icon } from './icons.js';
import { Tooltip } from './popups.jsx';

const cx = (...a) => a.filter(Boolean).join(' ');

// variant: 'primary' | 'plain' (default) | 'quiet'. There is no danger button: anything that removes work can be undone.
// state: 'hover' | 'press' | 'focus', only for the gallery, to show a state without a pointer.
export function Button({ variant = 'plain', size, icon, iconEnd, kbd, state, class: c, children, type = 'button', ...rest }) {
  return <button type={type} class={cx('btn', variant === 'primary' && 'pri', variant === 'quiet' && 'quiet', size, state === 'hover' && 'hov', state === 'press' && 'press', state === 'focus' && 'focus', c)} {...rest}>
    {icon && <Icon name={icon} />}{children}{iconEnd && <Icon name={iconEnd} />}{kbd && [].concat(kbd).map(k => <kbd>{k}</kbd>)}
  </button>;
}
// An icon button always has a label: read out, and shown as a tooltip.
export function IconButton({ icon, label, variant = 'quiet', size, kbd, tip = true, ...rest }) {
  const b = <Button variant={variant} size={size} class="icon" aria-label={label} {...rest}><Icon name={icon} size={size === 'lg' ? 'lg' : undefined} /></Button>;
  return tip ? <Tooltip text={label} kbd={kbd}>{b}</Tooltip> : b;
}

// Moves focus among a group's items with the arrow keys, Home and End (roving tabindex).
function roving(e, horizontal = true) {
  const keys = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
  if (![...keys, 'Home', 'End'].includes(e.key)) return null;
  const items = [...e.currentTarget.querySelectorAll('[data-rv]:not(:disabled)')], i = items.indexOf(document.activeElement);
  if (!items.length) return null;
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === keys[1] ? 1 : -1) + items.length) % items.length;
  e.preventDefault(); items[n].focus(); return items[n];
}

// options: [{ value, label, icon }]. Arrow keys move the choice, as radio buttons do.
export function Segmented({ options, value, onChange, label, size, disabled }) {
  return <div class={cx('seg', size)} role="radiogroup" aria-label={label} onKeyDown={e => { const el = roving(e); if (el) onChange && onChange(el.dataset.v); }}>
    {options.map(o => <button type="button" role="radio" data-rv data-v={o.value} aria-checked={String(o.value === value)} tabIndex={o.value === value ? 0 : -1} disabled={disabled || o.disabled} onClick={() => onChange && onChange(o.value)}>
      {o.icon && <Icon name={o.icon} size="xs" />}{o.label}</button>)}
  </div>;
}
// tabs: [{ id, label, count }]. Arrow keys move and choose.
export function Tabs({ tabs, value, onChange, label }) {
  return <div class="tabs" role="tablist" aria-label={label} onKeyDown={e => { const el = roving(e); if (el) onChange(el.dataset.v); }}>
    {tabs.map(tb => <button type="button" class="tab" role="tab" data-rv data-v={tb.id} id={'tab-' + tb.id} aria-selected={String(tb.id === value)} aria-controls={'panel-' + tb.id} tabIndex={tb.id === value ? 0 : -1} disabled={tb.disabled} onClick={() => onChange(tb.id)}>
      {tb.icon && <Icon name={tb.icon} />}{tb.label}{tb.count != null && <span class="ct num">{tb.count}</span>}</button>)}
  </div>;
}

// A labelled field around any input. hint and error are lines already translated.
export function Field({ label, hint, error, id, children }) {
  return <div class="field">{label && <label class="lbl" for={id}>{label}</label>}{children}{error ? <span class="err" id={id + '-e'}>{error}</span> : hint ? <span class="hint" id={id + '-h'}>{hint}</span> : null}</div>;
}
export function TextInput({ label, hint, error, icon, value, onInput, state, ...rest }) {
  const id = useId();
  return <Field label={label} hint={hint} error={error} id={id}>
    <div class="inwrap">{icon && <Icon name={icon} />}
      <input id={id} class={cx('input', icon && 'withi', state === 'focus' && 'focus')} value={value} onInput={e => onInput && onInput(e.currentTarget.value)} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? id + '-e' : hint ? id + '-h' : undefined} {...rest} /></div>
  </Field>;
}
// options: [{ value, label }]. The browser's own list: right on phones, and read out properly everywhere.
export function Select({ label, hint, options, value, onChange, ...rest }) {
  const id = useId();
  return <Field label={label} hint={hint} id={id}>
    <div class="selwrap"><select id={id} class="input" value={value} onChange={e => onChange && onChange(e.currentTarget.value)} {...rest}>
      {options.map(o => <option value={o.value} disabled={o.disabled}>{o.label}</option>)}</select><Icon name="chd" /></div>
  </Field>;
}
export function Checkbox({ label, checked, onChange, disabled, round }) {
  return <label class={cx('cb', round && 'round', disabled && 'off')}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange && onChange(e.currentTarget.checked)} />
    <span class="box" aria-hidden="true"><Icon name="check" /></span><span>{label}</span></label>;
}
export function Switch({ label, checked, onChange, disabled }) {
  return <button type="button" class="sw" role="switch" aria-checked={String(!!checked)} disabled={disabled} onClick={() => onChange && onChange(!checked)}>
    <span class="tr" aria-hidden="true" /><span>{label}</span></button>;
}
export function Slider({ label, value, min = 0, max = 100, step = 1, onInput, format = String, disabled }) {
  const id = useId(), p = ((value - min) / (max - min)) * 100;
  return <Field label={label} id={id}><div class="sl">
    <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} style={{ '--p': p + '%' }} onInput={e => onInput && onInput(+e.currentTarget.value)} aria-valuetext={format(value)} />
    <output for={id}>{format(value)}</output></div></Field>;
}
// A filter chip: on or off. color: a class colour for its dot.
export function Chip({ on, onClick, color, icon, children, disabled }) {
  return <button type="button" class="chip" aria-pressed={String(!!on)} onClick={onClick} disabled={disabled}>
    {color && <span class="dot" style={{ '--cc': color }} />}{icon && <Icon name={icon} />}{children}</button>;
}
export function Card({ title, pad = true, raised, children, ...rest }) {
  return <section class={cx('card', pad && 'pad', raised && 'raised')} {...rest}>{title && <h3>{title}</h3>}{children}</section>;
}
// A row in a list. With onClick or href it is a button or link; current marks the one open.
export function ListRow({ icon, lead, title, sub, end, onClick, href, current }) {
  const inner = <>{(icon || lead) && <span class="lead">{lead || <Icon name={icon} />}</span>}<span class="main"><b>{title}</b>{sub && <small>{sub}</small>}</span>{end && <span class="end">{end}</span>}</>;
  const p = { class: 'lrow', 'aria-current': current ? 'true' : undefined };
  return href ? <a href={href} {...p}>{inner}</a> : onClick ? <button type="button" onClick={onClick} {...p}>{inner}</button> : <div {...p}>{inner}</div>;
}
export const List = ({ label, children }) => <ul class="list" aria-label={label}>{[].concat(children).map(c => <li>{c}</li>)}</ul>;
// columns: [{ key, label, num, sort }]; rows: objects. sortBy/onSort make a header a button that sorts.
export function Table({ columns, rows, rowKey = 'id', caption, sortBy, sortDir, onSort }) {
  return <div class="tbl"><table>{caption && <caption class="sr">{caption}</caption>}
    <thead><tr>{columns.map(c => <th class={c.num ? 'n' : ''} scope="col" aria-sort={sortBy === c.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined}>
      {onSort && c.sort !== false ? <button type="button" onClick={() => onSort(c.key)}>{c.label}{sortBy === c.key && <Icon name={sortDir === 'desc' ? 'chd' : 'chu'} size="xs" />}</button> : c.label}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r[rowKey]}>{columns.map(c => <td class={c.num ? 'n' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody></table></div>;
}
// A side nav item: a link (href) or a button. current: the screen showing. color: a class colour dot instead of an icon.
export function NavItem({ icon, color, label, count, current, href, onClick }) {
  const inner = <>{color ? <span class="dot" style={{ '--cc': color }} /> : icon && <Icon name={icon} />}<span>{label}</span>{count != null && <span class="ct">{count}</span>}</>;
  const p = { class: 'nav', 'aria-current': current ? 'page' : undefined };
  return href ? <a href={href} {...p}>{inner}</a> : <button type="button" onClick={onClick} {...p}>{inner}</button>;
}
export const NavSection = ({ children }) => <div class="navsec" role="presentation">{children}</div>;
export const ClassDot = ({ color, size, label }) => <span class={cx('dot', size)} style={{ '--cc': color }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} />;
// Initials from a name the teacher typed; the full name is read out.
export function Avatar({ name, size }) {
  const ini = String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  return <span class={cx('av', size)} role="img" aria-label={name} data-raw>{ini}</span>;
}
export function EmptyState({ icon = 'inbox', title, text, action }) {
  return <div class="empty"><span class="ei"><Icon name={icon} size="lg" /></span><b>{title}</b>{text && <p>{text}</p>}{action}</div>;
}
// value null: under way, length unknown.
export function Progress({ value, max = 1, label, text }) {
  const known = value != null, done = known && value >= max;
  return <div class={cx('prog', done && 'done')}>{text && <span>{text}</span>}
    <div class={cx('bar', !known && 'ind')} role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={known ? max : undefined} aria-valuenow={known ? value : undefined}><i style={known ? { width: Math.min(100, value / max * 100) + '%' } : undefined} /></div></div>;
}
export const Spinner = ({ label }) => <span class="spin" role="status" aria-label={label} />;
export const Kbd = ({ keys }) => <>{keys.map(k => <kbd>{k}</kbd>)}</>;
