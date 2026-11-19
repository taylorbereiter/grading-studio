// A unit, changed or made new from the Course line (design: Course line > unit), kept as the current Planner keeps units
// (kv "units", src/planner/units.js normUnit, renderUnit, pasteWeeksDlg, unitDelete): its name, course, the Monday it starts,
// how many weeks, the unit plan link, and each week's focus, standards and notes. The weeks can be typed or pasted as one line
// each. Deleting a unit takes its files with it, as the Planner does; lessons stay. Saved with Save, as one.
import { h, Fragment } from 'preact';
import { useState, useId } from 'preact/hooks';
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
  const set = patch => setU({ ...u, ...patch });
  const week = (i, patch) => set({ weeks: u.weeks.map((w, j) => j === i ? { ...w, ...patch } : w) });
  const write = async list => { setBusy(true); try { await saveKv('units', list); onClose(true); } catch (e) { saveFailed(e); } finally { setBusy(false); } };
  const save = () => {
    if (!u.title.trim()) return toast(t('plan.unit_needs_name'));
    if (u.atlas && !/^https?:\/\//.test(u.atlas.trim())) return toast(t('plan.link_bad'));
    const n = E.normUnit({ ...u, title: u.title.trim(), atlas: (u.atlas || '').trim(), updated: Date.now() });
    if (unit._file) n._file = unit._file; if (unit._mod) n._mod = unit._mod;
    const list = (p.units || []).filter(x => x.id !== n.id); list.push(n); write(list);
  };
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
  return <Sheet open wide title={isNew ? t('plan.new_unit') : t('plan.edit_unit')} icon={<Icon name="cal" />} onClose={() => onClose(false)}
    footer={<>{!isNew && <Button variant="quiet" disabled={busy} onClick={remove} data-focus="delete-unit">{sure ? t('plan.delete_unit_sure') : t('plan.delete_unit')}</Button>}<span class="grow" />
      <Button variant="quiet" onClick={() => onClose(false)}>{t('common.cancel')}</Button><Button variant="primary" disabled={busy} onClick={save} data-focus="save-unit">{t('common.save')}</Button></>}>
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
