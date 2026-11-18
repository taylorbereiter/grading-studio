// Seating (src/seating.js): who sits where, kept on the class beside its roster as c.seats and changed through the lifted seatSetRoom,
// seatFill and seatPut, each change one undo step. A room laid out from one of four kinds, desks moved by dragging or by clicking the
// student and then the desk, a student kept in their seat when the class is shuffled, the chart shown full screen to the class or
// printed. Pick a name and Make groups open the name picker (picker.jsx). Opened from the People tab.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Sheet, Button, Menu, IconButton, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import * as undoList from '../../services/undo.js';
import { engine as B, change, classIn } from '../../students/book.js';
import { Picker } from './picker.jsx';
import './lines.js';

const KINDS = ['rows', 'pairs', 'tables', 'horseshoe'];
const KIND = { rows: ['class.seat_rows_k', 'class.seat_rows_say'], pairs: ['class.seat_pairs', 'class.seat_pairs_say'], tables: ['class.seat_tables', 'class.seat_tables_say'], horseshoe: ['class.seat_horseshoe', 'class.seat_horseshoe_say'] };
const put = (c, label, fn, say) => change(label, l => { const k = classIn(l, c.id); if (k) fn(k); }, true).then(() => { if (say) toast(say, { undo: () => undoList.undo() }); });

function Mini({ kind }) {
  const r = B.seatRoom(kind, 24), on = new Set(r.cells), cells = [];
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) cells.push(<i class={on.has(x + ',' + y) ? 'd' : ''} />);
  return <span class="seatmini" style={{ '--w': r.w }} aria-hidden="true">{cells}</span>;
}
// The grid of a room. how: 'use' (students can be moved), 'arrange' (every square is a button) or 'show' (to look at only).
export function Grid({ c, s, how, flip, sel, onDesk, onCell }) {
  const short = B.pkShort(c.names), pins = new Set(s.pins), cells = [];
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const x = flip ? s.w - 1 - i : i, y = flip ? s.h - 1 - j : j, k = x + ',' + y, has = k in s.desks, name = has ? s.desks[k] : '', n = name ? c.names.indexOf(name) : -1;
    const inner = name ? <><span data-raw>{short[n]}</span>{pins.has(name) && <i class="seatpin" title={t('class.seat_kept')} />}</> : null;
    if (how === 'arrange') cells.push(<button type="button" class={'seat' + (has ? (name ? '' : ' empty') : ' gap')} aria-pressed={String(has)} aria-label={has ? t('class.seat_desk_off', { name: name ? B.pkNice(name) : '' }) : t('class.seat_desk_on')} onClick={() => onCell(k)} data-cell={k}>{inner}</button>);
    else if (!has) cells.push(<span class="seatgap" />);
    else if (how === 'show') cells.push(<span class={'seat' + (name ? '' : ' empty')}>{inner}</span>);
    else cells.push(<button type="button" class={'seat' + (name ? '' : ' empty') + (n >= 0 && n === sel ? ' sel' : '')} data-desk={k} data-n={n >= 0 ? n : undefined} title={name ? B.pkNice(name) : undefined} aria-label={name ? B.pkNice(name) : t('class.seat_empty_desk')} onClick={() => onDesk(k)}>{inner}</button>);
  }
  const front = <div class="seatfront">{t('class.seat_front')}</div>;
  return <>{!flip && front}<div class="seatgrid" style={{ '--w': s.w }}>{cells}</div>{flip && front}</>;
}

export function SeatingSheet({ x, onClose }) {
  const { c } = x, s = B.seatOf(c);
  const [sel, setSel] = useState(null), [arrange, setArrange] = useState(false), [show, setShow] = useState(false), [pick, setPick] = useState(null);
  const box = useRef(null), dragged = useRef(0);
  const selName = sel != null ? c.names[sel] : null;
  const room = kind => (s ? put(c, t('class.u_seat'), k => B.seatSetRoom(k, kind), t('class.seat_laid_out')) : put(c, t('class.u_seat'), k => B.seatSetRoom(k, kind)));
  const moveTo = (name, key) => { setSel(null); put(c, t('class.u_seat'), k => B.seatPut(k, name, key)); };
  const focusLater = q => setTimeout(() => { const el = box.current && box.current.querySelector(q); if (el) el.focus(); });
  const onDesk = k => {
    if (Date.now() - dragged.current < 400) return;
    const there = s.desks[k];
    if (selName && there !== selName) { moveTo(selName, k); focusLater('[data-desk="' + k + '"]'); return; }
    setSel(there && there !== selName ? c.names.indexOf(there) : null);
  };
  const onCell = k => put(c, t('class.u_seat'), m => { const r = B.seatOf(m); if (k in r.desks) delete r.desks[k]; else r.desks[k] = ''; B.seatSave(m, r); });
  const size = (k, d) => put(c, t('class.u_seat'), m => { const r = B.seatOf(m), v = r[k] + d; if (v < 1 || v > (k === 'w' ? B.SEAT_MAX_W : B.SEAT_MAX_H)) return; r[k] = v; for (const key of Object.keys(r.desks)) { const [a, b] = B.seatXY(key); if (a >= r.w || b >= r.h) delete r.desks[key]; } B.seatSave(m, r); });
  const shuffle = () => { let left = 0; put(c, t('class.u_seat'), k => { left = B.seatFill(k, true); }).then(() => toast(t('class.seat_shuffled') + (left ? ' ' + t('class.seat_no_desk', { n: left }) : ''), { undo: () => undoList.undo() })); setSel(null); };
  const pin = () => put(c, t('class.u_seat'), m => { const r = B.seatOf(m); r.pins = r.pins.includes(selName) ? r.pins.filter(n => n !== selName) : [...r.pins, selName]; B.seatSave(m, r); });
  useEffect(() => { if (sel != null && !c.names[sel]) setSel(null); });
  // Dragging a student by mouse, finger or pencil; a press that doesn't move is left to be a click
  const down = e => {
    const from = e.target.closest && e.target.closest('[data-n]'); if (!from || arrange || (e.button != null && e.button > 0)) return;
    const n = +from.dataset.n, name = c.names[n], x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null;
    const at = ev => { ghost.hidden = true; const el = document.elementFromPoint(ev.clientX, ev.clientY); ghost.hidden = false; return el ? el.closest('[data-desk]') || el.closest('[data-seat-tray]') : null; };
    const move = ev => {
      if (!ghost) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; ghost = document.createElement('div'); ghost.className = 'seatghost'; ghost.textContent = B.pkShort(c.names)[n]; document.body.appendChild(ghost); from.classList.add('lift'); }
      ev.preventDefault(); ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      const o = at(ev); if (o !== over) { if (over) over.classList.remove('over'); over = o; if (over) over.classList.add('over'); }
    };
    const up = ev => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      if (!ghost) return;
      const o = ev.type === 'pointerup' ? at(ev) : null; ghost.remove(); from.classList.remove('lift'); if (over) over.classList.remove('over');
      dragged.current = Date.now();
      if (o && o.dataset.desk) moveTo(name, o.dataset.desk); else if (o && o.hasAttribute('data-seat-tray')) moveTo(name, null); else setSel(null);
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  };
  const print = () => {
    const el = document.createElement('div'); el.id = 'seatPrint'; document.body.appendChild(el);
    import('preact').then(({ render }) => { render(<><h2 data-raw>{t('class.seat_print_title', { name: c.name })}</h2><div class="seatroom"><Grid c={c} s={s} how="show" flip={s.flip} /></div></>, el);
      document.body.classList.add('seatprinting');
      const done = () => { window.removeEventListener('afterprint', done); document.body.classList.remove('seatprinting'); render(null, el); el.remove(); };
      window.addEventListener('afterprint', done); window.print(); });
  };
  const title = t('class.seat_title', { name: c.name });
  if (!c.names.length) return <Sheet open wide title={title} onClose={onClose}><p class="mute">{t('class.no_roster')}</p></Sheet>;
  if (!s) return <Sheet open wide title={title} onClose={onClose}>
    <div class="seatstart" data-seat-start><h3>{t('class.seat_how')}</h3><p class="mute">{t('class.seat_how_say', { n: c.names.length })}</p>
      <div class="seatkinds">{KINDS.map(k => <button type="button" class="seatkind" onClick={() => room(k)} data-seat-room={k}><Mini kind={k} /><b>{t(KIND[k][0])}</b><small>{t(KIND[k][1])}</small></button>)}</div></div>
  </Sheet>;
  const seated = new Set(Object.values(s.desks).filter(Boolean)), out = c.names.map((n, i) => ({ n, i })).filter(o => !seated.has(o.n)), desks = Object.keys(s.desks).length, short = B.pkShort(c.names);
  const sum = t('class.seat_sum', { n: seated.size, of: c.names.length }) + (desks < c.names.length ? ' · ' + t('class.seat_more_desks', { n: c.names.length - desks }) : '');
  return <Sheet open wide title={title} onClose={() => { if (!pick && !show) onClose(); }}>
    <div class="seating" ref={box} onPointerDown={down} onKeyDown={e => { if (e.key === 'Escape' && sel != null) { e.stopPropagation(); e.preventDefault(); setSel(null); } }} data-seating>
      {arrange ? <>
        <div class="seatbar"><b>{t('class.seat_arrange')}</b><span class="mute small">{t('class.seat_arrange_say')}</span><span class="grow" /><Button size="sm" variant="primary" onClick={() => setArrange(false)} data-seat-done>{t('class.done')}</Button></div>
        <div class="seatbar"><span class="mute small">{t('class.seat_start_from')}</span>{KINDS.map(k => <Button size="sm" onClick={() => room(k)} data-seat-room={k}>{t(KIND[k][0])}</Button>)}<span class="grow" />
          {[['w', 'class.seat_cols', B.SEAT_MAX_W], ['h', 'class.seat_rows', B.SEAT_MAX_H]].map(([k, l, max]) => <span class="seatstep"><span>{t(l)}</span>
            <IconButton icon="minus" size="sm" label={t('class.seat_fewer', { what: t(l) })} disabled={s[k] <= 1} onClick={() => size(k, -1)} data-seat-size={k + '-'} /><b>{s[k]}</b>
            <IconButton icon="plus" size="sm" label={t('class.seat_more', { what: t(l) })} disabled={s[k] >= max} onClick={() => size(k, 1)} data-seat-size={k + '+'} /></span>)}</div>
        <div class="seatwrap"><div class="seatroom arr"><Grid c={c} s={s} how="arrange" flip={s.flip} onCell={onCell} /></div></div>
      </> : <>
        <div class="seatbar"><span class="mute" data-seat-sum>{sum}</span><span class="grow" />
          <Button size="sm" icon="shuffle" onClick={shuffle} data-seat-shuffle>{t('class.seat_shuffle')}</Button>
          <Button size="sm" icon="people" onClick={() => setPick('groups')} data-seat-groups>{t('class.pk_make_groups')}</Button>
          <Button size="sm" variant="primary" onClick={() => setPick('pick')} data-seat-pick>{t('class.pk_pick')}</Button>
          <Menu label={t('class.seat_more_menu')} trigger={m => <IconButton {...m} icon="dots" label={t('class.seat_more_menu')} data-seat-menu />} items={[
            { label: t('class.seat_arrange'), onSelect: () => { setSel(null); setArrange(true); } },
            { label: t('class.seat_order'), onSelect: () => put(c, t('class.u_seat'), k => { B.seatFill(k, false); }, t('class.seat_ordered')) },
            { label: t('class.seat_empty'), onSelect: () => put(c, t('class.u_seat'), m => { const r = B.seatOf(m); for (const k of Object.keys(r.desks)) r.desks[k] = ''; r.pins = []; B.seatSave(m, r); }, t('class.seat_emptied')) },
            { label: t(s.flip ? 'class.seat_front_top' : 'class.seat_front_bottom'), onSelect: () => put(c, t('class.u_seat'), m => { const r = B.seatOf(m); if (r) { r.flip = !r.flip; B.seatSave(m, r); } }) },
            { label: t('class.seat_show'), onSelect: () => setShow(true) },
            { label: t('class.seat_print'), onSelect: print }]} /></div>
        {selName && <div class="seatselbar" aria-live="polite" data-seat-sel><span><b data-raw>{B.pkNice(selName)}</b> · {t(seated.has(selName) ? 'class.seat_sel_say' : 'class.seat_sel_say_drag')}</span><span class="grow" />
          {seated.has(selName) && <><Button size="sm" aria-pressed={String(s.pins.includes(selName))} onClick={pin} data-seat-pin>{t(s.pins.includes(selName) ? 'class.seat_pinned' : 'class.seat_pin')}</Button>
            <Button size="sm" onClick={() => moveTo(selName, null)} data-seat-unseat>{t('class.seat_unseat')}</Button></>}
          <Button size="sm" variant="quiet" onClick={() => setSel(null)}>{t('common.cancel')}</Button></div>}
        <div class="seatwrap"><div class="seatroom"><Grid c={c} s={s} how="use" flip={s.flip} sel={sel} onDesk={onDesk} /></div>
          <aside class="seattray" aria-label={t('class.seat_not_seated')} data-seat-tray onClick={e => { if (e.target === e.currentTarget && selName && seated.has(selName)) moveTo(selName, null); }}>
            <h3>{t('class.seat_not_seated')}{out.length > 0 && <span> {out.length}</span>}</h3>
            {out.length ? <div class="seatchips">{out.map(o => <button type="button" class={'seatchip' + (o.i === sel ? ' sel' : '')} data-n={o.i} title={B.pkNice(o.n)} onClick={() => { if (Date.now() - dragged.current > 400) setSel(sel === o.i ? null : o.i); }} data-raw>{short[o.i]}</button>)}</div>
              : <p class="mute small">{t('class.seat_all_seated')}</p>}
            <p class="mute small">{t('class.seat_hint')}</p></aside></div>
      </>}
    </div>
    {show && <Show c={c} s={s} onClose={() => setShow(false)} />}
    {pick && <Picker classes={[c]} mode={pick} onClose={() => setPick(null)} />}
  </Sheet>;
}

// The chart on its own, as the students see it: the front of the room at the top, full screen where the browser allows.
function Show({ c, s, onClose }) {
  const el = useRef(null);
  useEffect(() => {
    const box = el.current; box.focus();
    let was = false; const full = () => { const on = document.fullscreenElement === box; if (was && !on) onClose(); was = on; };
    document.addEventListener('fullscreenchange', full);
    try { const p = box.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch {}
    return () => { document.removeEventListener('fullscreenchange', full); try { if (document.fullscreenElement === box) document.exitFullscreen().catch(() => {}); } catch {} };
  }, []);
  return <div class="seatshow" ref={el} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('class.seat_title', { name: c.name })} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); onClose(); } }} data-seat-show>
    <h2 data-raw>{c.name}</h2><div class="seatroom" style={{ '--sw': s.w, '--sh': s.h }}><Grid c={c} s={s} how="show" flip={false} /></div>
    <button type="button" class="seatshowx" onClick={onClose}>{t('class.close_esc')}</button></div>;
}
