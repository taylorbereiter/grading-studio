// A unit, changed or made new from the Course line (design: Course line > unit), kept as the current Planner keeps units
// (kv "units", src/planner/units.js normUnit, renderUnit, pasteWeeksDlg, unitDelete): its name, course, the Monday it starts,
// how many weeks, the unit plan link, and each week's focus, standards and notes. The weeks can be typed or pasted as one line
// each. Deleting a unit takes its files with it, as the Planner does; lessons stay. Saved with Save, as one. The current unit page
// saved as she typed, so nothing typed is lost here either: closing with changes (Esc, the backdrop, ×, Cancel) asks first, and
// leaving the page under the sheet, or the window, saves them.
import { h, Fragment } from 'preact';
import { useState, useId, useRef, useEffect } from 'preact/hooks';
import { Sheet, Button, IconButton, Icon, TextInput, Select, Field, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { engine } from '../../planning/engine.js';
import { saveKv, dropLessonFile } from '../../planning/write.js';
import { saveFailed } from './save.js';
import { at, plus } from './lessons.js';
import './lines.js';
import './cal-lines.js';

const copy = x => JSON.parse(JSON.stringify(x));
// The Mondays a unit can start on, as the current Planner lists them (src/planner/units.js unit page "Starts"): the semester's,
// each with its school week, or else half a year either side of today; and the unit's own Monday if it falls outside.
function mondays(p, E, start) {
  const s = p.setup || {}, mon = d => E.normUnit({ start: d }).start, now = mon(new Date().toISOString().slice(0, 10));
  const a = s.semStart ? mon(s.semStart) : plus(now, -26 * 7), b = s.semEnd ? mon(s.semEnd) : plus(now, 30 * 7), out = [];
  for (let d = a; d <= b && out.length < 60; d = plus(d, 7)) out.push(d);
  if (start && !out.includes(start)) { out.push(start); out.sort(); }
  const md = d => date(at(d), { day: 'numeric', month: 'short', year: d.slice(0, 4) === now.slice(0, 4) ? undefined : 'numeric' });
  return out.map(d => { const n = s.semStart ? Math.round((at(d) - at(mon(s.semStart))) / 6048e5) + 1 : 0; return { value: d, label: n >= 1 && (!s.semEnd || d <= b) ? t('cal.start_week', { n, date: md(d) }) : md(d) }; });
}
const writing = w => !!(w && (String(w.focus || '').trim() || String(w.notes || '').trim() || String(w.standards || '').trim()));
function Area({ label, value, onInput, rows = 2, ...rest }) {
  const id = useId();
  return <Field label={label} id={id}><textarea id={id} class="input" rows={rows} value={value} onInput={e => onInput(e.currentTarget.value)} {...rest} /></Field>;
}

export function UnitSheet({ p, unit, courses, onClose }) {
  const E = engine(p);
  const [u, setU] = useState(() => copy(unit)), [paste, setPaste] = useState(null), [busy, setBusy] = useState(false), [sure, setSure] = useState(false);
  const isNew = !(p.units || []).some(x => x.id === unit.id);
  const [ask, setAsk] = useState(false), first = useRef(JSON.stringify(unit)), now = useRef(u), done = useRef(false);
  now.current = u;
  const dirty = () => !done.current && JSON.stringify(now.current) !== first.current;
  const set = patch => { setAsk(false); setU({ ...u, ...patch }); };
  const week = (i, patch) => set({ weeks: u.weeks.map((w, j) => j === i ? { ...w, ...patch } : w) });
  const write = async list => { setBusy(true); try { await saveKv('units', list); done.current = true; onClose(true); } catch (e) { saveFailed(e); } finally { setBusy(false); } };
  const made = (x, loose) => {
    const n = E.normUnit({ ...x, title: x.title.trim() || (loose ? t('cal.untitled_unit') : ''), atlas: (x.atlas || '').trim(), updated: Date.now() });
    if (unit._file) n._file = unit._file; if (unit._mod) n._mod = unit._mod;
    const list = (p.units || []).filter(y => y.id !== n.id); list.push(n); return list;
  };
  const save = () => {
    if (!u.title.trim()) return toast(t('plan.unit_needs_name'));
    if (u.atlas && !/^https?:\/\//.test(u.atlas.trim())) return toast(t('plan.link_bad'));
    write(made(u));
  };
  // Esc, the backdrop, × and Cancel: with nothing changed it closes; with changes it asks Save, Discard or Keep editing.
  const close = () => { if (!dirty()) { done.current = true; return onClose(false); } setAsk(true); };
  const discard = () => { done.current = true; onClose(false); };
  // The page changed under the sheet, or the window is closing: there is no one to ask, so what she typed is saved as it is.
  useEffect(() => {
    const away = () => { if (!dirty()) return; done.current = true; saveKv('units', made(now.current, true)).then(() => toast(t('cal.unit_saved_away', { name: now.current.title.trim() || t('cal.untitled_unit') })), e => saveFailed(e)); };
    const leaving = e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', leaving);
    return () => { window.removeEventListener('beforeunload', leaving); away(); };
  }, []);
  const remove = async () => {
    if (!sure) return setSure(true);
    for (const f of unit.files || []) if (f.id) await dropLessonFile(f.id).catch(e => console.error(e));
    write((p.units || []).filter(x => x.id !== unit.id));
  };
  const usePaste = () => {
    const lines = paste.split('\n').map(x => x.trim()).filter(Boolean).map(x => x.replace(/^(week|wk)\s*\d+\s*[:.\-–)]\s*/i, ''));
    if (lines.length) set({ weeks: lines.map((f, i) => ({ focus: f, notes: (u.weeks[i] || {}).notes || '', standards: (u.weeks[i] || {}).standards || '' })) });
    setPaste(null);
  };
  const mon = s => date(at(s), { day: 'numeric', month: 'short' });
  // One week fewer; when the last week has writing in it, it can be had back (src/planner/units.js asks first).
  const fewer = () => { const last = u.weeks[u.weeks.length - 1], was = u; set({ weeks: u.weeks.slice(0, -1) }); if (writing(last)) toast(t('cal.week_off', { n: u.weeks.length }), { undo: () => setU(was) }); };
  return <Sheet open wide title={isNew ? t('plan.new_unit') : t('plan.edit_unit')} icon={<Icon name="cal" />} onClose={close}
    footer={ask ? <><span class="grow uask" role="alert" data-unit-ask>{t('cal.unit_unsaved')}</span>
      <Button variant="quiet" onClick={discard} data-focus="unit-discard">{t('cal.unit_discard')}</Button><Button variant="quiet" onClick={() => setAsk(false)} data-focus="unit-keep">{t('cal.keep_editing')}</Button>
      <Button variant="primary" disabled={busy} onClick={save} data-focus="save-unit" autoFocus>{t('common.save')}</Button></>
      : <>{!isNew && <Button variant="quiet" disabled={busy} onClick={remove} data-focus="delete-unit">{sure ? t('plan.delete_unit_sure') : t('plan.delete_unit')}</Button>}<span class="grow" />
      <Button variant="quiet" onClick={close} data-unit-cancel>{t('common.cancel')}</Button><Button variant="primary" disabled={busy} onClick={save} data-focus="save-unit">{t('common.save')}</Button></>}>
    <div class="unitedit">
      <TextInput label={t('plan.unit_name')} value={u.title} onInput={v => set({ title: v })} data-focus="unit-name" />
      <div class="row">
        <Select label={t('plan.course')} value={u.course} options={courses.map(c => ({ value: c, label: c }))} onChange={v => set({ course: v })} data-raw />
        <Select label={t('plan.unit_starts')} value={E.normUnit({ start: u.start }).start} options={mondays(p, E, E.normUnit({ start: u.start }).start)} onChange={v => set({ start: v })} data-unit-start />
        <Field label={t('plan.unit_weeks')}><span class="step"><IconButton icon="minus" label={t('plan.week_fewer')} disabled={u.weeks.length <= 1} onClick={() => fewer()} data-week-fewer />
          <b class="num">{u.weeks.length}</b><IconButton icon="plus" label={t('plan.week_more')} onClick={() => set({ weeks: [...u.weeks, { focus: '', notes: '', standards: '' }] })} /></span></Field>
      </div>
      <div class="row ulink"><span class="grow"><TextInput label={t('plan.unit_link')} type="url" value={u.atlas || ''} onInput={v => set({ atlas: v })} /></span>
        {/^https?:\/\/\S+$/.test((u.atlas || '').trim()) && <Button icon="link" onClick={() => window.open(u.atlas.trim(), '_blank', 'noopener')} data-unit-open-link>{t('cal.open_link')}</Button>}</div>
      <div class="row"><h3 class="sub grow">{t('plan.weeks')}</h3><Button size="sm" onClick={() => setPaste(u.weeks.map(w => w.focus).join('\n'))} data-focus="paste-weeks">{t('plan.paste_weeks')}</Button></div>
      {paste != null ? <div class="paste"><Area label={t('plan.paste_weeks_help')} rows={10} value={paste} onInput={setPaste} data-paste />
        <div class="row"><span class="grow" /><Button size="sm" variant="quiet" onClick={() => setPaste(null)}>{t('common.cancel')}</Button><Button size="sm" variant="primary" onClick={usePaste} data-focus="use-weeks">{t('plan.use_weeks')}</Button></div></div>
        : <ol class="uweeks">{u.weeks.map((w, i) => <li><b>{t('plan.week_n', { n: i + 1 })}</b> <span class="mute" data-raw>{mon(plus(E.normUnit({ start: u.start }).start, i * 7))}</span>
          <Area label={t('plan.week_focus')} value={w.focus} onInput={v => week(i, { focus: v })} />
          <TextInput label={t('plan.week_standards')} value={w.standards} onInput={v => week(i, { standards: v })} />
          <Area label={t('plan.week_notes')} value={w.notes} onInput={v => week(i, { notes: v })} /></li>)}</ol>}
    </div>
  </Sheet>;
}
