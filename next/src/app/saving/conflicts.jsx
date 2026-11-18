// Two versions to choose between (src/takehome.js showConflicts, conflictsHtml, sideHtml, partSide): what the merge couldn't choose
// for her, side by side, with nothing chosen until she chooses. Used by the folder now and by Bring work in.
// asks: the merge's questions; other: the name of the far side. onDone(answers) or onDone(null) for later.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Sheet, Button, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { readLibrary } from '../../students/counts.js';
import './lines.js';

const PART = { setup: 'saving.part_setup', cls: 'saving.part_cls', share: 'saving.part_share', drive: 'saving.part_drive', light: 'saving.part_light', lightOpt: 'saving.part_light', lightPg: 'saving.part_light', lightPgL: 'saving.part_light', anon: 'saving.part_anon', moved: 'saving.part_moved', removed: 'saving.part_removed', refSkip: 'saving.part_refskip', quiz: 'saving.part_quiz', groups: 'saving.part_groups', groupsOwn: 'saving.part_groups', clips: 'saving.part_clips', vrot: 'saving.part_vrot', returned: 'saving.part_returned', carry: 'saving.part_carry', scan: 'saving.part_scan' };
const when = v => v ? date(new Date(v), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : t('saving.cf_earlier');
const keyOf = a => a.gone ? '!' + a.id : a.id + '|' + a.key;
const fileName = p => String(p).split('/').pop();

// One student who changed in both places.
function Side({ r, at, anon, crit }) {
  if (!r) return <div class="mute">{t('saving.cf_nothing')}</div>;
  const g = r.g || {}, rows = g.rubric || [], out = [<div class="mute">{t('saving.cf_changed', { when: when(at) })}</div>];
  if (rows.some(v => v != null)) out.push(<div>{t('saving.cf_rubric', { list: rows.map((v, i) => (crit && crit[i] ? crit[i] + ': ' : '') + (v == null ? '–' : v)).join(', ') })}</div>);
  if (g.points != null && g.points !== '') out.push(<div>{t('saving.cf_points', { v: g.points })}</div>);
  if (g.sheet != null && g.sheet !== '') out.push(<div>{t('saving.cf_sheet', { v: g.sheet })}</div>);
  if (g.status) out.push(<div>{t('saving.cf_marked', { v: g.status })}</div>);
  if (g.comment) out.push(<div class="cf-c" data-raw>“{g.comment}”</div>);
  for (const [p, pages] of Object.entries(r.f || {})) {
    const n = Object.values(pages).reduce((a, x) => a + x.length, 0), ft = r.ft && r.ft[p];
    out.push(<div><span data-raw={anon ? undefined : ''}>{t('saving.cf_file_marks', { n, file: anon ? t('saving.cf_a_file') : fileName(p) })}</span>{ft ? <span class="mute"> ({when(ft)})</span> : null}</div>);
  }
  if (out.length === 1) out.push(<div class="mute">{t('saving.cf_empty')}</div>);
  return <>{out}</>;
}
// One setting that changed in both places.
function PartSide({ part, v, other, at, anon }) {
  const out = at == null ? [] : [<div class="mute">{t('saving.cf_changed', { when: when(at) })}</div>];
  if (part === 'setup') {
    const c = (v && v.criteria) || [];
    if (!v) out.push(<div>{t('saving.cf_no_setup')}</div>);
    else if (v.mode === 'points') out.push(<div>{t('saving.cf_points_of', { n: v.outOf })}</div>);
    else out.push(<div>{t('saving.cf_rubric_rows', { n: c.length })}</div>, <div class="mute" data-raw>{c.join(', ')}</div>);
    if (v && v.rubricPage && v.rubricPage.name) out.push(<div class="mute" data-raw>{v.rubricPage.name}</div>);
  } else if (part === 'cls') { const c = (readLibrary().classes || []).find(x => x.id === v); out.push(c ? <div data-raw>{c.name}</div> : <div>{t('saving.cf_no_class')}</div>); }
  else if (part === 'anon') out.push(<div>{t(v && v.on ? 'saving.cf_on' : 'saving.cf_off')}</div>);
  else for (const [p, k] of Object.entries(v || {})) if (other && other[p] != null && other[p] !== k) out.push(<div data-raw={anon ? undefined : ''}>{anon ? t('saving.cf_one_student') : t('saving.cf_goes_to', { file: fileName(p), key: k })}</div>);
  return <>{out}</>;
}
export function Conflicts({ asks, title, intro, other, later, noNewest, onDone }) {
  const [pick, setPick] = useState({});
  const choose = (a, v) => setPick(p => ({ ...p, [keyOf(a)]: v }));
  // The computers' clocks may not agree, so this only fills in the choice: she can still look before she confirms.
  const newest = () => { const p = {}; for (const a of asks) p[keyOf(a)] = a.gone ? 'gone' : a.tb > a.ta ? 'b' : 'a'; setPick(p); };
  const ok = () => { if (asks.some(a => !pick[keyOf(a)])) return toast(t('saving.cf_each')); onDone(pick); };
  const radio = (a, i, v, label, body) => <label class="cf-side"><span><input type="radio" name={'cf' + i} value={v} checked={pick[keyOf(a)] === v} onChange={() => choose(a, v)} /> <b>{label}</b></span>{body}</label>;
  return <Sheet open wide title={title || t('saving.cf_title')} onClose={() => onDone(null)}
    footer={<><Button onClick={() => onDone(null)} data-cflater>{later || t('saving.cf_later')}</Button>{!noNewest && <Button onClick={newest} data-cfnew>{t('saving.cf_newest')}</Button>}<Button variant="primary" onClick={ok} data-cfok>{t('saving.cf_ok')}</Button></>}>
    <p>{intro || t('saving.cf_intro')}</p>
    {asks.map((a, i) => a.gone
      ? <div class="cf-row" data-cf={i}><h3 data-raw>{a.name}</h3><p>{t('saving.cf_gone')}</p>
        <div class="cf-cols">{radio(a, i, 'gone', t('saving.cf_leave'))}{radio(a, i, 'back', t('saving.cf_back'))}</div></div>
      : <div class="cf-row" data-cf={i}>
        <h3>{a.part ? t(PART[a.part] || 'saving.part_other') : a.anon ? t('saving.cf_anon') : <span data-raw>{a.key}</span>} <span class="mute">· <span data-raw>{a.name}</span></span></h3>
        {a.part === 'setup' ? <p class="mute">{t('saving.cf_setup_note')}</p> : a.ca ? <p class="mute">{t('saving.cf_rows_diff')}</p> : null}
        <div class="cf-cols">
          {radio(a, i, 'a', a.la || t('saving.cf_here'), a.part ? <PartSide part={a.part} v={a.a} other={a.b} at={a.ta} anon={a.anon} /> : <Side r={a.a} at={a.ta} anon={a.anon} crit={a.ca} />)}
          {radio(a, i, 'b', a.lb || other || t('saving.cf_folder'), a.part ? <PartSide part={a.part} v={a.b} other={a.a} at={a.tb} anon={a.anon} /> : <Side r={a.b} at={a.tb} anon={a.anon} crit={a.cb} />)}
        </div></div>)}
  </Sheet>;
}
