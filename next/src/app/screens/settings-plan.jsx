// Settings > Timetable (design: settings, planning group): the classes and when they meet, each class's one colour, days off,
// school events, the semester, and the teacher's slide rules. All of it is the current Planner's own setup record (gs-lessons kv
// "setup", src/planner/lessons.js setup dialog and deck rules), changed here and saved as one with Save, as the Planner saves it;
// a linked Planner folder gets timetable.json too. The slide template, its name and the teacher profile are kept as they are.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Button, IconButton, TextInput, Select, Switch, toast, EmptyState } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href } from '../router.js';
import { usePlan } from '../plan.js';
import { saveKv } from '../../planning/write.js';
import { saveFailed } from '../plan/save.js';
import '../plan/lines.js';

// The colours a class can have: the current Planner's unit colours (src/planner/units.js UNIT_COLORS). Shown as the theme's own.
export const CLASS_COLORS = ['#1F6FB2', '#7B3FC4', '#B71E42', '#0E7C66', '#B35C00', '#3D5A80', '#8E3B8A', '#2F6B2F'];
const DOWS = [1, 2, 3, 4, 5, 6, 0];
const ADD = ['content', 'twocol', 'text', 'steps', 'discuss', 'warmup', 'exit', 'objectives', 'passage', 'vocab', 'picture', 'textpic', 'video'];
const ADD_LINE = { content: 'plan.layout_content', twocol: 'plan.layout_twocol', text: 'plan.layout_text', steps: 'plan.layout_steps', discuss: 'plan.layout_discuss', warmup: 'plan.layout_warmup',
  exit: 'plan.layout_exit', objectives: 'plan.layout_objectives', passage: 'plan.layout_passage', vocab: 'plan.layout_vocab', picture: 'plan.layout_picture', textpic: 'plan.layout_textpic', video: 'plan.layout_video' };
const copy = x => JSON.parse(JSON.stringify(x));
const nid = () => 'c' + Math.random().toString(36).slice(2, 8);
const dayName = d => date(new Date(2024, 0, 7 + d), { weekday: 'long' });
const isDate = s => /^\d{4}-\d\d-\d\d$/.test(s || '');

// The teacher's slide template (src/planner/lessons.js readTemplate): a .pptx or .potx with a Title Slide and a Title and Content
// layout, kept in the setup as base64 for Download slides.
async function readTemplate(file) {
  if (!file) return null;
  const say = m => { toast(m); return null; };
  if (!/\.(pptx|potx)$/i.test(file.name)) return say(t('plan.tpl_not_pptx'));
  if (file.size > 40 * 1024 * 1024) return say(t('plan.tpl_too_big'));
  const u8 = new Uint8Array(await file.arrayBuffer());
  const [{ unzipSync }, { tplLayouts }] = await Promise.all([import('fflate'), import('../../engines/planner.js')]);
  let z; try { z = unzipSync(u8); } catch { return say(t('plan.tpl_cant_open')); }
  if (!z['ppt/presentation.xml']) return say(t('plan.tpl_cant_open'));
  const lay = tplLayouts(z);
  if (!lay.title || !lay.content) return say(t('plan.tpl_needs_layouts'));
  let b = ''; for (let i = 0; i < u8.length; i += 0x8000) b += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { b64: btoa(b), name: file.name.replace(/\.(pptx|potx)$/i, '').slice(0, 120) };
}

function Dates({ list, onChange, label, add }) {
  return <div class="dlist">{list.map((x, i) => <div class="drow">
    <TextInput label={t('plan.date')} type="date" value={x.date} onInput={v => onChange(list.map((y, j) => j === i ? { ...y, date: v } : y))} />
    <TextInput label={label} value={x.label} onInput={v => onChange(list.map((y, j) => j === i ? { ...y, label: v } : y))} />
    <IconButton icon="trash" label={t('common.delete')} onClick={() => onChange(list.filter((_, j) => j !== i))} /></div>)}
    <div><Button size="sm" icon="plus" onClick={() => onChange([...list, { date: '', label: '' }])}>{add}</Button></div></div>;
}

function ClassCard({ c, onChange, onRemove }) {
  const set = patch => onChange({ ...c, ...patch });
  const meet = (i, patch) => set({ meets: c.meets.map((m, j) => j === i ? { ...m, ...patch } : m) });
  return <Card>
    <div class="ccrow"><span class="dot big" style={{ '--cc': c.color }} />
      <TextInput label={t('plan.class_name')} value={c.name} onInput={v => set({ name: v })} />
      <TextInput label={t('plan.course')} hint={t('plan.course_hint')} value={c.course || ''} onInput={v => set({ course: v })} />
      <IconButton icon="trash" label={t('plan.remove_class')} onClick={onRemove} /></div>
    <div class="ccsw" role="radiogroup" aria-label={t('plan.class_colour')}>{CLASS_COLORS.map((x, i) => <button type="button" role="radio" aria-checked={String(c.color.toLowerCase() === x.toLowerCase())}
      aria-label={t('plan.colour_n', { n: i + 1 })} style={{ '--cc': x }} onClick={() => set({ color: x })} />)}</div>
    <h3 class="sub">{t('plan.meets')}</h3>
    {c.meets.map((m, i) => <div class="mrow">
      <Select label={t('plan.day')} value={String(m.dow)} options={DOWS.map(d => ({ value: String(d), label: dayName(d) }))} onChange={v => meet(i, { dow: +v })} data-raw />
      <TextInput label={t('plan.starts')} type="time" value={m.start} onInput={v => meet(i, { start: v })} />
      <TextInput label={t('plan.ends')} type="time" value={m.end} onInput={v => meet(i, { end: v })} />
      <TextInput label={t('plan.period_label')} value={m.label || ''} onInput={v => meet(i, { label: v })} />
      <IconButton icon="trash" label={t('plan.remove_meeting')} onClick={() => set({ meets: c.meets.filter((_, j) => j !== i) })} /></div>)}
    <div><Button size="sm" icon="plus" onClick={() => set({ meets: [...c.meets, { dow: 1, start: '08:00', end: '09:00', label: '' }] })}>{t('plan.add_meeting')}</Button></div>
  </Card>;
}

export function TimetableSettings() {
  const p = usePlan();
  const [d, setD] = useState(null), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { if (p && !dirty) setD(copy(p.setup || { classes: [] })); }, [p]);
  if (!p || !d) return <div class="loading" aria-busy="true" />;
  const put = next => { setD(next); setDirty(true); };
  const deck = d.deck || {};
  const setDeck = patch => { const n = { ...deck, ...patch }; for (const k of Object.keys(n)) if (n[k] == null) delete n[k]; const next = { ...d, deck: n }; if (!Object.keys(n).length) delete next.deck; put(next); };
  const bad = (d.classes || []).some(c => !c.name.trim()) ? t('plan.needs_name') : '';
  const save = async () => {
    if (bad) return toast(bad);
    setBusy(true);
    try {
      const next = copy(d);
      next.classes = next.classes.map(c => ({ ...c, name: c.name.trim(), course: (c.course || '').trim(), meets: c.meets.filter(m => /^\d\d:\d\d$/.test(m.start)).map(m => ({ dow: +m.dow, start: m.start, end: m.end || '', label: (m.label || '').trim() })) }));
      for (const k of ['daysOff', 'events']) { const v = (next[k] || []).filter(x => isDate(x.date)).map(x => ({ date: x.date, label: (x.label || '').trim() })); if (v.length) next[k] = v; else delete next[k]; }
      for (const k of ['semStart', 'semEnd']) if (!isDate(next[k])) delete next[k];
      await saveKv('setup', next); setDirty(false); toast(t('plan.timetable_saved'));
    } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  return <div class="ttset">
    {!(d.classes || []).length && <EmptyState icon="cal" title={t('home.no_timetable')} text={t('plan.no_timetable_text')} />}
    {(d.classes || []).map((c, i) => <ClassCard c={c} onChange={x => put({ ...d, classes: d.classes.map((y, j) => j === i ? x : y) })} onRemove={() => put({ ...d, classes: d.classes.filter((_, j) => j !== i) })} />)}
    <div><Button icon="plus" onClick={() => put({ ...d, classes: [...(d.classes || []), { id: nid(), name: '', course: '', color: CLASS_COLORS[(d.classes || []).length % 8], meets: [] }] })} data-focus="add-class">{t('plan.add_class')}</Button></div>
    <Card title={t('plan.semester')}><div class="drow">
      <TextInput label={t('plan.sem_start')} type="date" value={d.semStart || ''} onInput={v => put({ ...d, semStart: v })} />
      <TextInput label={t('plan.sem_end')} type="date" value={d.semEnd || ''} onInput={v => put({ ...d, semEnd: v })} /></div></Card>
    <Card title={t('plan.days_off')}><Dates list={d.daysOff || []} label={t('plan.what_day')} add={t('plan.add_day_off')} onChange={v => put({ ...d, daysOff: v })} /></Card>
    <Card title={t('plan.events')}><Dates list={d.events || []} label={t('plan.what_event')} add={t('plan.add_event')} onChange={v => put({ ...d, events: v })} /></Card>
    <Card title={t('plan.slide_template')}>
      <p class="mute" role="status">{d.template ? <>{t('plan.tpl_yours')} <b data-raw>{d.tplName || ''}</b></> : t('plan.tpl_plain')}</p>
      <div class="row"><label class="btn sm"><input type="file" class="vh" accept=".pptx,.potx" onChange={async e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; const x = await readTemplate(f); if (x) put({ ...d, template: x.b64, tplName: x.name }); }} data-tpl />{d.template ? t('plan.tpl_pick_another') : t('plan.tpl_pick')}</label>
        {d.template && <Button size="sm" variant="quiet" onClick={() => { const n = { ...d, template: '' }; delete n.tplName; put(n); }}>{t('plan.tpl_use_plain')}</Button>}</div>
    </Card>
    <Card title={t('plan.slide_rules')}>
      <Switch label={t('plan.rule_agenda')} checked={deck.agenda !== false} onChange={v => setDeck({ agenda: v ? null : false })} />
      <Switch label={t('plan.rule_any_size')} checked={deck.sizes === 'any'} onChange={v => setDeck({ sizes: v ? 'any' : null })} />
      <Select label={t('plan.rule_add')} value={deck.add || 'content'} options={ADD.map(k => ({ value: k, label: t(ADD_LINE[k]) }))} onChange={v => setDeck({ add: v === 'content' ? null : v })} />
    </Card>
    <div class="savebar"><span class="mute" role="status">{dirty ? t('plan.unsaved') : ''}</span><span class="grow" />
      <Button variant="quiet" disabled={!dirty || busy} onClick={() => { setD(copy(p.setup || { classes: [] })); setDirty(false); }}>{t('common.cancel')}</Button>
      <Button variant="primary" disabled={!dirty || busy} onClick={save} data-focus="save-timetable">{t('common.save')}</Button></div>
  </div>;
}
