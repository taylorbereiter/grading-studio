// Attendance (src/attend.js): who was here, late or absent (reason unknown or excused), by day for each class. Everyone starts as
// present, so a day is one press for each student who isn't, or one press on "Everyone is here". Look back is one table, students
// down and days across, with each student's totals. Saved on the class as the current app saves it (c.att, through the lifted attSet,
// attTake and attClear), each press one undo step. Opened from the People tab; the day before or after follows the class's timetable.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Sheet, Button, Segmented, Menu, IconButton, HeldInput, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href } from '../router.js';
import { engine as B, change, classIn, attPlan } from '../../students/book.js';
import { copyText } from '../../services/clipboard.js';
import './lines.js';

const WAYS = ['p', 'l', 'a', 'e'], WORD = { p: 'class.att_p', l: 'class.att_l', a: 'class.att_a', e: 'class.att_e' };
const at = d => new Date(d + 'T12:00:00');
const long = d => date(at(d), { weekday: 'long', month: 'long', day: 'numeric' });
const short = d => date(at(d), { month: 'short', day: 'numeric' });
// "22 present · 1 late": only what there is.
const N = { p: 'class.att_n_p', l: 'class.att_n_l', a: 'class.att_n_a', e: 'class.att_n_e' };
export const attSay = o => WAYS.filter(k => o[k]).map(k => t(N[k], { n: o[k] })).join(' · ');
const keep = (k, v) => { try { if (v === undefined) return sessionStorage.getItem('gsn.att.' + k); sessionStorage.setItem('gsn.att.' + k, v); } catch {} return null; };
export const attOn = lib => !(lib && lib.me && lib.me.att === false);

const put = (c, label, fn) => change(label, l => { const k = classIn(l, c.id); if (k) fn(k); }, true);
const save = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })); a.download = name.replace(/[\\/:*?"<>|]+/g, ' '); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const csv = rows => rows.map(r => r.map(v => { const s = B.csvSafe(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
const tsv = rows => rows.map(r => r.map(v => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');

export function AttendSheet({ x, day, onClose }) {
  const { c } = x, today = B.isoDay(Date.now());
  const [view, setView] = useState(day === 'all' ? 'all' : 'day'), [d, setD] = useState(day && day !== 'all' && B.attDayOk(day) ? day : today);
  const [, ready] = useState(0);
  useEffect(() => { let live = true; attPlan().then(p => { B.planUse(p); if (live) ready(1); }); return () => { live = false; B.planUse(null); }; }, []);
  return <Sheet open wide title={t('class.att_title', { name: c.name })} onClose={onClose}>
    <div class="att" data-att={c.id}>
      <div class="attbar"><Segmented label={t('class.att_title_short')} value={view} onChange={setView} options={[{ value: 'day', label: t('class.att_take') }, { value: 'all', label: t('class.att_back') }]} /></div>
      {view === 'day' ? <Day c={c} d={d} today={today} setD={setD} /> : <Back x={x} open={k => { setD(k); setView('day'); }} />}
    </div>
  </Sheet>;
}

function Day({ c, d, today, setD }) {
  const r = B.attRec(c, d), list = useRef(null), [focus, setFocus] = useState(null);
  useEffect(() => { if (focus == null || !list.current) return; const b = list.current.querySelector('[data-att-row="' + focus.i + '"] [data-att-s="' + focus.k + '"]'); if (b) b.focus(); setFocus(null); });
  const set = (i, k, move) => { const n = c.names[i]; put(c, t('class.u_att'), m => B.attSet(m, d, n, k)); setFocus({ i: move && i + 1 < c.names.length ? i + 1 : i, k: move && i + 1 < c.names.length ? B.attOf(c, d, c.names[i + 1]) || 'p' : k }); };
  // a note is saved when she leaves the box (src/attend.js saves it on change), and what she types is held while she is in it: a
  // plain onChange is a save per key here (preact/compat), and a redraw from that save put the saved, trimmed words back under her cursor (a space typed was lost)
  const note = (i, v) => { const n = c.names[i]; if (B.attNote(c, d, n) !== v.trim()) put(c, t('class.u_att'), m => B.attSet(m, d, n, null, v)); };
  const all = () => { put(c, t('class.u_att'), m => B.attTake(m, d)); toast(t('class.att_all_saved')); };
  const clear = () => put(c, t('class.u_att_clear'), m => B.attClear(m, d));
  const ids = c.names.some(n => B.infoOf(c, n).id);
  const copy = () => copyText(tsv([[...(ids ? [t('class.att_id')] : []), t('class.att_student'), long(d), t('class.att_note')], ...c.names.map(n => [...(ids ? [B.infoOf(c, n).id || ''] : []), n, t(WORD[B.attOf(c, d, n) || 'p']), B.attNote(c, d, n)])]))
    .then(ok => toast(ok ? t('class.att_copied_day', { day: long(d) }) : t('class.copy_failed')));
  // P, L, A and E set the student whose row has the focus and move to the next; up and down move between students
  const keyDown = e => {
    const row = e.target.closest && e.target.closest('[data-att-row]'); if (!row || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = +row.dataset.attRow, k = e.key.toLowerCase();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const j = i + (e.key === 'ArrowDown' ? 1 : -1); if (j >= 0 && j < c.names.length) { e.preventDefault(); setFocus({ i: j, k: B.attOf(c, d, c.names[j]) || 'p' }); } return; }
    if (WAYS.includes(k)) { e.preventDefault(); set(i, k, true); }
  };
  return <>
    <div class="attnav">
      <IconButton icon="chl" label={t('class.att_earlier')} onClick={() => setD(B.attStep(c, d, -1))} data-att-prev />
      <b data-att-day={d}>{long(d)}</b>{d === today && <span class="tag">{t('class.att_today')}</span>}
      <IconButton icon="chr" label={t('class.att_later')} onClick={() => setD(B.attStep(c, d, 1))} data-att-next />
      <input type="date" class="input attpick" value={d} aria-label={t('class.att_go_date')} onChange={e => { if (B.attDayOk(e.currentTarget.value)) setD(e.currentTarget.value); }} data-att-pick />
      {d !== today && <Button size="sm" onClick={() => setD(today)}>{t('class.att_today')}</Button>}
      <span class="grow" />
      {r ? <><Button size="sm" icon="copy" onClick={copy} data-att-copy>{t('class.att_copy_day')}</Button>
        <Menu label={t('class.att_more_day')} items={[{ label: t('class.att_clear'), icon: 'trash', onSelect: clear }]} trigger={m => <IconButton {...m} icon="dots" label={t('class.att_more_day')} data-att-more />} /></>
        : <Button size="sm" variant="primary" icon="check" onClick={all} data-att-all>{t('class.att_all')}</Button>}
    </div>
    <p class={'attsum' + (r ? '' : ' no')} data-att-sum>{r ? attSay(B.attDayCount(c, d)) : t('class.att_not_taken')}</p>
    <div class={'attlist' + (r ? '' : ' untaken')} ref={list} onKeyDown={keyDown}>{c.names.map((n, i) => {
      const s = B.attOf(c, d, n) || 'p', nt = B.attNote(c, d, n);
      return <div class={'attrow s' + s} data-att-row={i}><span class="attn" data-raw>{n}</span>
        <div class="seg attseg" role="radiogroup" aria-label={n}>{WAYS.map(k => <button type="button" role="radio" aria-checked={String(s === k)} tabIndex={s === k ? 0 : -1} onClick={() => set(i, k)} data-att-s={k}>{t(WORD[k])}</button>)}</div>
        {(s !== 'p' || nt) && <HeldInput type="text" class="input attnote" maxLength={120} value={nt} placeholder={t('class.att_note_ph')} aria-label={t('class.att_note_for', { name: n })} onBlur={e => note(i, e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-att-note />}
      </div>; })}</div>
    <p class="mute small">{r ? t('class.att_saved') : t('class.att_starts')} {t('class.att_keys')}</p>
  </>;
}

function Back({ x, open }) {
  const { c } = x, terms = x.conf.terms.filter(k => k.start && k.end);
  const [term, setTerm] = useState(() => { const v = keep('term'); return v === '*' || terms.some(k => k.id === v) ? v : terms.length ? B.bkTermNow(terms) : '*'; });
  const tm = terms.find(k => k.id === term), days = B.attDays(c, tm && tm.start, tm && tm.end), name = tm ? tm.name || t('class.att_term') : t('class.att_all_dates');
  const ids = c.names.some(n => B.infoOf(c, n).id);
  const rows = () => [[...(ids ? [t('class.att_id')] : []), t('class.att_student'), t('class.att_a'), t('class.att_e'), t('class.att_l'), ...days],
    ...c.names.map(n => { const o = B.attCount(c, n, days); return [...(ids ? [B.infoOf(c, n).id || ''] : []), n, o.a, o.e, o.l, ...days.map(k => t(WORD[B.attOf(c, k, n)]))]; })];
  const pickTerm = v => { setTerm(v); keep('term', v); };
  const unk = B.attUnknown(c, days);
  return <>
    <div class="attnav">
      {terms.length > 0 && <Segmented label={t('class.att_dates')} value={term} onChange={pickTerm} options={terms.map(k => ({ value: k.id, label: k.name || t('class.att_term') })).concat({ value: '*', label: t('class.att_all_dates') })} />}
      <span class="grow" />
      {days.length > 0 && <><Button size="sm" icon="copy" onClick={() => copyText(tsv(rows())).then(ok => toast(ok ? t('class.att_copied_n', { n: days.length }) : t('class.copy_failed')))} data-att-copyall>{t('class.att_copy_table')}</Button>
        <Button size="sm" icon="download" onClick={() => save(t('class.att_file', { name: c.name, from: days[0], to: days[days.length - 1] }) + '.csv', csv(rows()))} data-att-csv>{t('class.att_csv')}</Button></>}
    </div>
    {!days.length ? <p class="mute" data-att-none>{term === '*' ? t('class.att_none_yet') : t('class.att_none_in', { name })} <button type="button" class="link" onClick={() => open(B.isoDay(Date.now()))}>{t('class.att_take_today')}</button></p> : <>
      <div class="attwrap"><table class="atttab" data-att-tab>
        <thead><tr><th class="attn2">{t('class.att_student')}</th><th class="attt">{t('class.att_abs')}<small>{t('class.att_unknown')}</small></th><th class="attt">{t('class.att_abs')}<small>{t('class.att_excused')}</small></th><th class="attt">{t('class.att_l')}</th>
          {days.map(k => <th class="attd"><button type="button" class="link" onClick={() => open(k)} title={long(k)} data-att-open={k}><small>{date(at(k), { weekday: 'short' })}</small><span>{short(k)}</span></button></th>)}</tr></thead>
        <tbody>{c.names.map((n, i) => { const o = B.attCount(c, n, days);
          return <tr><th class="attn2" scope="row"><a class="link" href={href('class', c.id, 'people', i + 1)} data-raw>{n}</a></th>{[o.a, o.e, o.l].map(v => <td class={'attt' + (v ? '' : ' z')}>{v}</td>)}
            {days.map(k => { const s = B.attOf(c, k, n), nt = B.attNote(c, k, n); return <td><span class={'attc s' + s} title={n + ' · ' + t(WORD[s]) + (nt ? ' · ' + nt : '')}>{s === 'p' ? '' : s.toUpperCase()}{nt && <i />}</span></td>; })}</tr>; })}
          <tr class="attfoot"><th class="attn2" scope="row">{t('class.att_here')}</th><td /><td /><td />{days.map(k => { const o = B.attDayCount(c, k); return <td>{o.p + o.l}</td>; })}</tr></tbody>
      </table></div>
      <div class="attleg">{WAYS.map(k => <span><b class={'attc s' + k}>{k === 'p' ? '' : k.toUpperCase()}</b>{t(WORD[k])}</span>)}<span><b class="attc sp"><i /></b>{t('class.att_has_note')}</span></div>
      <p class="mute small">{term === '*' ? t('class.att_days', { n: days.length }) : t('class.att_days_in', { n: days.length, name })} {t('class.att_back_say')}</p>
      {unk.length > 0 && <p class="attunk" data-att-unk><b>{t('class.att_unk', { n: unk.length })}</b> {unk.slice(0, 8).map((u, j) => <>{j ? ' · ' : ''}<button type="button" class="link" onClick={() => open(u.d)} data-raw>{u.n + ', ' + short(u.d)}</button></>)}{unk.length > 8 ? ' ' + t('class.att_unk_more', { n: unk.length - 8 }) : ''} {t('class.att_unk_say')}</p>}
    </>}
  </>;
}

// One student's attendance on their page (src/attend.js attStuHtml): in the term the gradebook is on, or every day.
export function AttStudent({ c, n, term, onDay }) {
  const days = B.attDays(c, term && term.start, term && term.end); if (!days.length) return null;
  const o = B.attCount(c, n, days);
  const line = k => { const ds = days.filter(d => B.attOf(c, d, n) === k); return ds.length ? <p class="attstu"><b>{t(WORD[k])}</b> {ds.map((d, j) => <>{j ? ', ' : ''}<button type="button" class="link" onClick={() => onDay(d)}>{short(d)}</button>{B.attNote(c, d, n) && <span data-raw> ({B.attNote(c, d, n)})</span>}</>)}</p> : null; };
  return <section class="sp-sec" aria-labelledby="h-att" data-att-stu><h3 id="h-att">{t('class.attendance')}</h3>
    <p>{o.a || o.l || o.e ? t('class.att_here_list', { here: t('class.att_here_of', { h: o.p + o.l, n: days.length }), list: attSay({ ...o, p: 0 }) }) : t('class.att_here_never', { here: t('class.att_here_of', { h: o.p + o.l, n: days.length }), never: t('class.att_never_late') })}</p>
    {line('a')}{line('e')}{line('l')}</section>;
}
