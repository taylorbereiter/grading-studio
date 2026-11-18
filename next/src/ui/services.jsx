// The parts that come with a service: the command bar, the long text box with dictation, add-a-file, comments, the theme picker
// and the shortcut list. Each is built once and used everywhere.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useId, useMemo } from 'preact/hooks';
import { Icon, ICONS } from './icons.js';
import { Button, IconButton, Field, Avatar } from './controls.jsx';
import { Menu } from './popups.jsx';
import { useModal, toast } from './overlay.jsx';
import { t, num, date, getLocale } from '../i18n/t.js';
import { findCommands, onCommandsChange, setCommandOpener } from '../services/commands.js';
import { register, list as shortcutList, onShortcutsChange, pieces } from '../services/shortcuts.js';
import { hasSpeech, listen } from '../services/speech.js';
import { copyText } from '../services/clipboard.js';
import { fileValue, filesFrom, accepts, isImage, isValue } from '../services/files.js';
import * as undo from '../services/undo.js';
import { LOOKS, THEMES } from './tokens.js';

/* ---------- command bar ---------- */
// Mount once. Ctrl/Cmd+K opens it from anywhere (the shortcut is in the shortcut list like any other).
export function CommandBar() {
  const [open, setOpen] = useState(false), [q, setQ] = useState(''), [at, setAt] = useState(0), [, bump] = useState(0), id = useId();
  const p = useModal(open, () => setOpen(false), { initial: 'input' });
  useEffect(() => {
    setCommandOpener(() => { setQ(''); setAt(0); setOpen(true); });
    const off1 = register({ id: 'command-bar', keys: 'mod+k', label: 'cmd.open', inInputs: true, run: () => setOpen(o => { if (!o) { setQ(''); setAt(0); } return !o; }) });
    const off2 = onCommandsChange(() => bump(n => n + 1));
    return () => { off1(); off2(); setCommandOpener(null); };
  }, []);
  const found = open ? findCommands(q) : [];
  const run = c => { setOpen(false); setTimeout(() => c.run(), 0); };
  const key = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => (i + 1) % Math.max(1, found.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => (i - 1 + found.length) % Math.max(1, found.length)); }
    else if (e.key === 'Enter' && found[at]) { e.preventDefault(); run(found[at]); }
  };
  useEffect(() => { const el = document.getElementById(id + '-' + at); if (el) el.scrollIntoView({ block: 'nearest' }); }, [at, open]);
  let last = null;
  return <dialog class="cmd" aria-label={t('cmd.title')} {...p}>
    {open && <>
      <div class="q"><Icon name="search" size="lg" />
        <input data-autofocus value={q} onInput={e => { setQ(e.currentTarget.value); setAt(0); }} onKeyDown={key} placeholder={t('cmd.placeholder')} role="combobox" aria-expanded="true" aria-controls={id + '-l'} aria-activedescendant={found[at] ? id + '-' + at : undefined} aria-autocomplete="list" aria-label={t('cmd.title')} /></div>
      {found.length ? <ul class="res" role="listbox" id={id + '-l'}>
        {found.map((c, i) => { const head = c.group !== last ? (last = c.group) : null; return <>
          {head && <li class="gh" role="presentation">{head}</li>}
          <li id={id + '-' + i} class="row" role="option" aria-selected={String(i === at)} onClick={() => run(c)} onMouseMove={() => at !== i && setAt(i)}>
            <span class="ri">{c.icon && <Icon name={c.icon} />}</span><span>{c.label}</span>{c.keys && pieces(c.keys).map(k => <kbd>{k}</kbd>)}</li></>; })}
      </ul> : <div class="none" role="status">{t('cmd.none', { q })}</div>}
      <div class="ft"><span><kbd>↑</kbd><kbd>↓</kbd>{t('cmd.move')}</span><span><kbd>↵</kbd>{t('cmd.run')}</span><span><kbd>{pieces('escape')[0]}</kbd>{t('common.close')}</span></div>
    </>}
  </dialog>;
}

/* ---------- dictation ---------- */
// The mic. Drawn only where the browser can listen. onText(words) gets each finished piece.
export function Mic({ onText, onListening }) {
  const [on, setOn] = useState(false), h1 = useRef(null);
  useEffect(() => () => h1.current && h1.current.stop(), []);
  if (!hasSpeech()) return null;
  const stop = () => { if (h1.current) h1.current.stop(); h1.current = null; setOn(false); onListening && onListening(false); };
  const start = () => {
    h1.current = listen({ lang: getLocale(), onText: fin => { if (fin) onText(fin); }, onEnd: err => { if (h1.current || err) { h1.current = null; setOn(false); onListening && onListening(false); if (err && err !== 'aborted' && err !== 'no-speech') toast(t('dictate.failed')); } } });
    if (h1.current) { setOn(true); onListening && onListening(true); } else toast(t('dictate.failed'));
  };
  return <button type="button" class={'mic' + (on ? ' on' : '')} aria-pressed={String(on)} aria-label={on ? t('dictate.stop') : t('dictate.start')} onClick={on ? stop : start}>
    <span class="mi0"><Icon name={on ? 'stop' : 'mic'} size="xs" /></span>
    {on && <><span class="lv" aria-hidden="true"><i /><i /><i /><i /></span><span>{t('dictate.listening')}</span></>}
  </button>;
}
// The long text box. Every one has dictation (where the browser can listen); words go in where the cursor is.
export function TextBox({ label, hint, value, onInput, rows = 4, dictate = true, ...rest }) {
  const id = useId(), ta = useRef(), [listening, setListening] = useState(false);
  const put = words => {
    const el = ta.current, v = el.value, a = el.selectionStart ?? v.length, b = el.selectionEnd ?? v.length;
    const before = v.slice(0, a), sp = before && !/\s$/.test(before) ? ' ' : '';
    const next = before + sp + words.trim() + v.slice(b); onInput && onInput(next);
    requestAnimationFrame(() => { const c = (before + sp + words.trim()).length; el.setSelectionRange(c, c); });
  };
  return <Field label={label} hint={hint} id={id}>
    <span class={'dfield' + (listening ? ' listening' : '')}>
      <textarea id={id} ref={ta} class="input" rows={rows} value={value} onInput={e => onInput && onInput(e.currentTarget.value)} aria-describedby={hint ? id + '-h' : undefined} {...rest} />
      {dictate && <Mic onText={put} onListening={setListening} />}</span>
  </Field>;
}

/* ---------- add a file ---------- */
const sizeSay = n => n >= 1048576 ? t('file.mb', { n: num(n / 1048576, { maximumFractionDigits: 1 }) }) : t('file.kb', { n: num(Math.max(1, Math.round(n / 1024))) });
function describe(v) {
  if (v.kind === 'file') return { name: v.name || t('file.untitled'), sub: sizeSay(v.size), icon: isImage(v) ? 'image' : 'file' };
  if (v.kind === 'drive') return { name: v.name || t('file.untitled'), sub: t('file.from_drive'), icon: 'drive' };
  if (v.kind === 'link') return { name: v.name || v.url, sub: v.name ? v.url : t('file.link'), icon: 'link' };
  return { name: v.label || t('file.student_item'), sub: t('file.stays_student_side'), icon: 'image' };
}
// One file, with Replace and Remove. resolve(ref) may give back a picture URL for a student-side item; without it, a placeholder.
export function FileTile({ value, onReplace, onRemove, resolve, replaceMenu }) {
  const d = describe(value), [src, setSrc] = useState(null);
  useEffect(() => {
    let url = null, live = true;
    if (value.kind === 'file' && isImage(value) && value.blob) { url = URL.createObjectURL(value.blob); setSrc(url); }
    else if (value.kind === 'ref' && resolve) Promise.resolve(resolve(value)).then(u => live && setSrc(u || null), () => {});
    else setSrc(null);
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [value]);
  const ph = value.kind === 'ref' && !src;
  return <div class={'ftile' + (ph ? ' ph' : '')}>
    <span class="fi">{src ? <img src={src} alt="" /> : <Icon name={d.icon} />}</span>
    <span class="main"><b data-raw>{d.name}</b><small data-raw={value.kind === 'link' ? '' : undefined}>{d.sub}</small></span>
    <span class="acts">{replaceMenu || (onReplace && <IconButton icon="replace" label={t('file.replace')} onClick={onReplace} />)}{onRemove && <IconButton icon="trash" label={t('common.remove')} onClick={onRemove} />}</span>
  </div>;
}
// Add a file: from this computer, by dragging in, by pasting, or from Google Drive (drivePick, when the screen has one: no button
// without it). One file (value, onChange) or several (multiple: value is a list). Replace swaps a file and keeps its place.
// Removing can be undone from the toast.
export function AddFile({ label, value, onChange, multiple, accept, drivePick, resolve, compact }) {
  const input = useRef(), [over, setOver] = useState(false), swap = useRef(-1), id = useId();
  const list = multiple ? value || [] : value ? [value] : [];
  const take = vals => {
    vals = vals.filter(v => accepts(v, accept));
    if (!vals.length) { toast(t('file.wrong_kind')); return; }
    const before = list.slice();
    let next;
    if (swap.current >= 0) { next = list.slice(); next[swap.current] = vals[0]; swap.current = -1; }
    else next = multiple ? list.concat(vals) : [vals[0]];
    set(next);
    undo.record({ label: t('file.added'), undo: () => set(before), redo: () => set(next) });
  };
  const set = l => onChange && onChange(multiple ? l : l[0] || null);
  const pickComputer = i => { swap.current = i == null ? -1 : i; input.current.value = ''; input.current.click(); };
  const pickDrive = async i => { const got = await drivePick({ multiple: multiple && i == null, accept }); if (!got) return; swap.current = i == null ? -1 : i; take([].concat(got)); };
  const remove = i => { const before = list.slice(), next = list.filter((_, j) => j !== i); set(next); const back = () => set(before); undo.record({ label: t('file.removed'), undo: back, redo: () => set(next) }); toast(t('file.removed'), { undo: back }); };
  const from = i => [{ id: 'computer', label: t('file.from_computer'), icon: 'upload', onSelect: () => pickComputer(i) }, ...(drivePick ? [{ id: 'drive', label: t('file.from_drive_pick'), icon: 'drive', onSelect: () => pickDrive(i) }] : [])];
  const replaceMenu = i => <Menu label={t('file.replace')} items={from(i)} trigger={p => <IconButton icon="replace" label={t('file.replace')} {...p} />} />;
  const showDrop = multiple || !list.length;
  return <div class="field" role="group" aria-labelledby={label ? id : undefined}>
    {label && <span class="lbl" id={id}>{label}</span>}
    <input ref={input} type="file" hidden accept={accept} multiple={multiple && swap.current < 0} onChange={e => take([...e.currentTarget.files].map(fileValue))} />
    {list.map((v, i) => <FileTile value={v} resolve={resolve} replaceMenu={replaceMenu(i)} onRemove={() => remove(i)} />)}
    {showDrop && <div class={'drop' + (over ? ' over' : '')} tabIndex={0} aria-label={t('file.drop_label')}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); swap.current = -1; take(filesFrom(e.dataTransfer)); }}
      onPaste={e => { const v = filesFrom(e.clipboardData); if (v.length) { e.preventDefault(); swap.current = -1; take(v); } }}>
      {!compact && <Icon name="upload" size="lg" />}
      {!compact && <b>{t('file.drop_title')}</b>}
      <span>{t('file.drop_or_paste')}</span>
      <span class="acts"><Button size="sm" icon="upload" onClick={() => pickComputer()}>{t('file.from_computer')}</Button>
        {drivePick && <Button size="sm" icon="drive" onClick={() => pickDrive()}>{t('file.from_drive_pick')}</Button>}</span>
    </div>}
  </div>;
}

/* ---------- comments ---------- */
// A thread of comments on one thing (a slide now, a paper later). comments: [{ id, who, at, text, files }]. Writing has dictation
// and files (screenshots, a student-side item by ref). Deleting can be undone. who: a name the teacher typed or the app knows.
export function Comments({ comments, onChange, me, label, drivePick, resolve, placeholder }) {
  const [text, setText] = useState(''), [files, setFiles] = useState([]), [editing, setEditing] = useState(null), [draft, setDraft] = useState('');
  const set = next => onChange && onChange(next);
  const add = () => {
    if (!text.trim() && !files.length) return;
    const before = comments, c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), who: me, at: Date.now(), text: text.trim(), files };
    const next = comments.concat(c); set(next); setText(''); setFiles([]);
    undo.record({ label: t('comments.added'), undo: () => set(before), redo: () => set(next) });
  };
  const del = c => { const before = comments, next = comments.filter(x => x.id !== c.id); set(next); const back = () => set(before); undo.record({ label: t('comments.deleted'), undo: back, redo: () => set(next) }); toast(t('comments.deleted'), { undo: back }); };
  const save = c => { const before = comments, next = comments.map(x => x.id === c.id ? { ...x, text: draft.trim(), edited: Date.now() } : x); set(next); setEditing(null); undo.record({ label: t('comments.edited'), undo: () => set(before), redo: () => set(next) }); };
  return <section class="cmts" aria-label={label}>
    {comments.map(c => <article class="cmt" key={c.id}>
      <Avatar name={c.who} />
      <div class="cb2">
        <div class="ch"><b data-raw>{c.who}</b><time data-raw datetime={new Date(c.at).toISOString()}>{date(new Date(c.at), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>{c.edited && <span>{t('comments.edited_mark')}</span>}
          <Menu label={t('comments.actions')} items={[{ id: 'edit', label: t('common.edit'), icon: 'edit', onSelect: () => { setEditing(c.id); setDraft(c.text); } }, { id: 'del', label: t('common.delete'), icon: 'trash', onSelect: () => del(c) }]}
            trigger={p => <IconButton icon="dots" size="sm" label={t('comments.actions')} {...p} />} /></div>
        {editing === c.id ? <div class="cmtadd"><TextBox label={t('common.edit')} value={draft} onInput={setDraft} rows={3} /><div class="row"><Button size="sm" variant="quiet" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button size="sm" variant="primary" onClick={() => save(c)}>{t('common.save')}</Button></div></div>
          : c.text && <p data-raw>{c.text}</p>}
        {c.files && c.files.length > 0 && <div class="att">{c.files.filter(isValue).map(f => <FileTile value={f} resolve={resolve} />)}</div>}
      </div></article>)}
    <div class="cmtadd">
      <TextBox label={t('comments.new')} value={text} onInput={setText} rows={3} placeholder={placeholder} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }} />
      <AddFile multiple compact value={files} onChange={setFiles} drivePick={drivePick} resolve={resolve} accept="image/*,.pdf" />
      <div class="row"><Button variant="primary" icon="comment" disabled={!text.trim() && !files.length} onClick={add}>{t('comments.add')}</Button></div>
    </div>
  </section>;
}

/* ---------- theme picker ---------- */
export const LOOK_LINES = { graphite: ['look.graphite', 'look.graphite_about'], porcelain: ['look.porcelain', 'look.porcelain_about'], ocean: ['look.ocean', 'look.ocean_about'], ink: ['look.ink', 'look.ink_about'], plum: ['look.plum', 'look.plum_about'], midnight: ['look.midnight', 'look.midnight_about'] };
// The six themes as a choice. onPick(look) saves it (services/theme.js saveLook) or only shows it (applyLook, in the gallery).
export function ThemePicker({ value, onPick }) {
  return <div class="looks" role="radiogroup" aria-label={t('look.title')} onKeyDown={e => {
    const i = LOOKS.indexOf(value), d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); const box = e.currentTarget, n = LOOKS[(i + d + LOOKS.length) % LOOKS.length]; onPick(n); requestAnimationFrame(() => { const b = box.querySelector('[data-look="' + n + '"]'); b && b.focus(); }); }
  }}>
    {LOOKS.map(n => <button type="button" class="lk" role="radio" data-look={n} aria-checked={String(n === value)} tabIndex={n === value ? 0 : -1} onClick={() => onPick(n)}>
      <span class="sw2" style={{ '--sa': THEMES[n].acc, '--sb2': THEMES[n].bg }}>{n === value && <Icon name="check" />}</span>
      <span><b>{t(LOOK_LINES[n][0])}</b><small>{t(LOOK_LINES[n][1])}</small></span></button>)}
  </div>;
}

/* ---------- shortcut list ---------- */
export function ShortcutList() {
  const [, bump] = useState(0);
  useEffect(() => onShortcutsChange(() => bump(n => n + 1)), []);
  return <div class="keys">{shortcutList().map(g => <>
    <span class="kg">{t(g.group)}</span>
    {g.items.map(s => <><span>{t(s.label)}</span><span class="k">{s.keys.map((k, i) => <>{i > 0 && <span class="mute">{t('keys.or')}</span>}{k.map(p => <kbd>{p}</kbd>)}</>)}</span></>)}
  </>)}</div>;
}

// Copy text: one press puts a piece of text on the clipboard, ready to paste into an assistant, an email or a document, and says so.
// text: the text, or a function that gives it (read at the press, so it is always the latest). The same press for a card that is
// built without Preact (a Word paper, the typed notes' bar) comes from copyButton(), which makes the same button.
async function copyNow(text) {
  let s = ''; try { s = typeof text === 'function' ? await text() : text; } catch (e) { console.error(e); }
  if (!String(s || '').trim()) return toast(t('copy.empty'));
  toast(t(await copyText(s) ? 'copy.done' : 'copy.failed'));
}
export function CopyButton({ text, label, size = 'sm', variant = 'quiet', ...rest }) {
  return <Button variant={variant} size={size} icon="copy" title={t('copy.tip')} onClick={() => copyNow(text)} data-copytext {...rest}>{label || t('copy.text')}</Button>;
}
export function copyButton(text, { label, cls = 'btn sm quiet' } = {}) {
  const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.title = t('copy.tip'); b.dataset.copytext = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'i'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true'); svg.innerHTML = ICONS.copy;
  b.append(svg);
  b.append(label || t('copy.text'));
  b.addEventListener('click', e => { e.stopPropagation(); copyNow(text); });
  return b;
}
