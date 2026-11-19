// The rubric bank, edited (the current Planner's src/planner/bank.js renderBank, bankUnitSection, bankEditor, bankEdSave, bankDrop):
//   BankList    Library > Rubrics: every rubric and grading scale, sorted by course and unit, with New rubric and New scale, and for
//               each one Edit, Duplicate, Move to… (another unit) and Delete
//   UnitBank    the same for one unit, beside its weeks on the Course line
//   BankEditor  one rubric (rows, how they are scored, what each score means, a grading scale) or one grading scale (a percent for
//               each score), Save
// The bank is the Planner's kv "bank" = { rubrics, scales, gone }: only a rubric's wording and a scale's percents, never a score, a name
// or anything about a student. Grading's Rubric setup reads the same record. Each save reads the record again and changes only that one
// (bankUpdate), so a save in another window at the same moment isn't lost; each is one undo step. Delete happens at once with Undo,
// where the current Planner asks with a second click. The bank's files in a linked Planner folder (Rubrics/) come with stage 6.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Dialog, Sheet, Button, IconButton, Icon, Menu, Select, Switch, TextInput, EmptyState, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { bank as bankRec, words } from '../../planning/index.js';
import { saveKv } from '../../planning/write.js';
import * as undoList from '../../services/undo.js';
import { rebaseList, rebaseMap } from '../../shared/rebase.js';
import { L, lid } from '../../engines/planner.js';
import { tidyBank, normRubric, normBankScale, presetScale, rescale, scaleTop, bMax, bLevels, bOneTop, B_TOP, B_TOP_MAX, bankNatural, bankScales } from '../../engines/pbank.js';
import { saveFailed } from './save.js';
import './lines.js';
import './more-lines.js';

const J = o => JSON.parse(JSON.stringify(o));
const usable = (kind, x) => x && x.id && x.name && (kind === 'scales' ? x.scale && typeof x.scale === 'object' : Array.isArray(x.criteria) && x.criteria.length);
// a row's name as text, also where an older save kept it as { name }
const rowsText = x => (Array.isArray(x.criteria) ? { ...x, criteria: x.criteria.map(c => (c && typeof c === 'object' ? String(c.name || '') : c)) } : x);
const listOf = (b, kind) => ((b && b[kind]) || []).filter(x => usable(kind, x)).map(rowsText);

// Read, change and write in one go; the whole record before and after is the undo step.
// A read that fails stops the change, so a bank that couldn't be read is never written over (audit H-010). Undo and redo change the
// bank as it is then, keeping what was saved in between (audit H-012).
const byId = { key: x => (x && x.id) || JSON.stringify(x) };
const bankStep = (from, to) => async () => { const now = tidyBank(await bankRec.get());
  await saveKv('bank', { ...now, rubrics: rebaseList(now.rubrics, from.rubrics, to.rubrics, byId), scales: rebaseList(now.scales, from.scales, to.scales, byId), gone: rebaseMap(now.gone, from.gone, to.gone) }); };
async function bankUpdate(label, fn) {
  const before = tidyBank(await bankRec.get()), after = J(before);
  fn(after);
  await saveKv('bank', after);
  undoList.record({ label, undo: bankStep(after, before), redo: bankStep(before, after) });
  return after;
}
async function bankPut(kind, item, label) {
  item.at = Date.now();
  await bankUpdate(label, b => { const l = b[kind], i = l.findIndex(x => x.id === item.id); if (i >= 0) l[i] = item; else l.push(item); l.sort((x, y) => bankNatural(x.name, y.name)); delete b.gone[item.id]; });
}
async function bankRemove(kind, id, label) { await bankUpdate(label, b => { b[kind] = b[kind].filter(x => x.id !== id); b.gone[id] = Date.now(); }); }

// Which unit an item belongs to: the Planner's own unit by id, else one with the same course and name, else the name it was saved with.
function refUnit(p, ref) {
  if (!ref) return null;
  return p.units.find(u => u.id === ref.id) || p.units.find(u => u.course === ref.course && String(u.title || '').trim().toLowerCase() === String(ref.title || '').trim().toLowerCase()) || null;
}
const refKey = (p, ref) => { if (!ref) return ''; const u = refUnit(p, ref); return u ? u.id : 'ref:' + ref.course + '|' + ref.title; };
const unitRef = u => (u ? { id: u.id, course: u.course, title: u.title } : null);
function refFromKey(p, key, was) {
  if (!key) return null;
  const u = p.units.find(x => x.id === key); if (u) return unitRef(u);
  return was && refKey(p, was) === key ? was : null;
}
const refLabel = (p, ref) => { if (!ref) return t('more.bk_no_unit'); const u = refUnit(p, ref) || ref; return (u.course ? u.course + ' · ' : '') + (u.title || ''); };
function unitOptions(p, key) {
  const out = [{ value: '', label: t('more.bk_no_unit') }], seen = new Set();
  const courses = [...new Set(p.units.map(u => u.course || ''))];
  for (const c of courses) for (const u of p.units.filter(x => (x.course || '') === c).sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')))) { seen.add(u.id); out.push({ value: u.id, label: (c ? c + ' · ' : '') + u.title }); }
  if (key && !seen.has(key) && key.startsWith('ref:')) { const [course, title] = key.slice(4).split('|'); out.push({ value: key, label: t('more.bk_elsewhere', { name: (course ? course + ' · ' : '') + title }) }); }
  return out;
}
const scale12On = () => { const w = words.json(null); return !!(w && w.scale12); };
const about = (kind, x) => kind === 'scales' ? t('more.bk_scale_about', { n: scaleTop(x.scale) })
  : t('more.bk_rubric_about', { n: x.criteria.length, max: bMax(x) }) + (x.levels && x.levels.some(r => r && Object.keys(r).length) ? ' · ' + t('more.bk_with_levels') : '') + (x.scale ? ' · ' + t('more.bk_with_scale') : '');
export const newItem = (p, kind, unitKey) => {
  const ref = refFromKey(p, unitKey || '', null);
  if (kind === 'scales') return { ...normBankScale({ scale: presetScale('fives', 12), unit: ref, id: lid() }), name: '' };
  return { id: lid(), name: '', criteria: [t('more.bk_row_n', { n: 1 }), t('more.bk_row_n', { n: 2 }), t('more.bk_row_n', { n: 3 })], levels: [{}, {}, {}], scale: null, ...(ref ? { unit: ref } : {}) };
};

// One item in a list: its name, what it is, and its menu.
function Item({ p, kind, x, open, onMove }) {
  const b = p.bank;
  const dup = () => { const c = kind === 'rubrics' ? normRubric({ ...J(x), id: lid(), name: t('more.bk_copy_of', { name: x.name }) }) : normBankScale({ ...J(x), id: lid(), name: t('more.bk_copy_of', { name: x.name }) }); open(kind, c, true); };
  const del = () => bankRemove(kind, x.id, t('more.bk_step_del')).then(() => toast(t('more.bk_deleted', { name: x.name }), { undo: undoList.undo }), saveFailed);
  return <li><div class="lrow bk-row" data-bkitem={x.id}>
    <button type="button" class="bk-open" onClick={() => open(kind, kind === 'rubrics' ? normRubric(x) : normBankScale(x), false)} data-bkopen={x.id}>
      <span class="lead"><Icon name="grades" /></span><span class="main"><b data-raw>{x.name}</b><small>{about(kind, x)}</small></span></button>
    <Menu label={t('more.bk_more', { name: x.name })} trigger={tp => <IconButton {...tp} icon="dots" size="sm" label={t('more.bk_more', { name: x.name })} data-bkmenu={x.id} />}
      items={[{ label: t('more.bk_edit'), icon: 'pen', onSelect: () => open(kind, kind === 'rubrics' ? normRubric(x) : normBankScale(x), false) },
        { label: t('more.bk_dup'), icon: 'copy', onSelect: dup },
        { label: t('more.bk_move'), icon: 'arrow', onSelect: () => onMove(kind, x) },
        { label: t('more.bk_del'), icon: 'trash', onSelect: del }]} />
  </div></li>;
}
function MoveTo({ p, kind, x, onClose }) {
  const [key, setKey] = useState(refKey(p, x.unit));
  const go = () => {
    if (key === refKey(p, x.unit)) return onClose();
    const ref = refFromKey(p, key, x.unit), moved = { ...J(x) }; if (ref) moved.unit = ref; else delete moved.unit;
    bankPut(kind, moved, t('more.bk_step_move')).then(() => { onClose(); toast(t('more.bk_moved', { name: x.name, to: refLabel(p, ref) }), { undo: undoList.undo }); }, saveFailed);
  };
  return <Dialog open title={t('more.bk_move_title', { name: x.name })} onClose={onClose} actions={<><Button onClick={onClose}>{t('more.bk_cancel')}</Button><Button variant="primary" onClick={go} data-bkmoveok>{t('more.bk_move_ok')}</Button></>}>
    <Select label={t('more.bk_unit')} value={key} options={unitOptions(p, key)} onChange={setKey} data-bkmoveto />
  </Dialog>;
}
// The list, everything or one unit's, with the editor and Move to… it opens.
function useEditors(p) {
  const [ed, setEd] = useState(null), [mv, setMv] = useState(null);
  const open = (kind, item, isNew) => setEd({ kind, item: J(item), isNew });
  const ui = <>{ed && <BankEditor p={p} {...ed} onClose={() => setEd(null)} />}{mv && <MoveTo p={p} {...mv} onClose={() => setMv(null)} />}</>;
  return { open, onMove: (kind, x) => setMv({ kind, x }), ui };
}
const sortIt = l => l.slice().sort((a, b) => (a[0] === b[0] ? bankNatural(a[1].name, b[1].name) : a[0] === 'rubrics' ? -1 : 1));
export function BankList({ p }) {
  const E = useEditors(p), b = p.bank || {};
  const items = [...listOf(b, 'rubrics').map(x => ['rubrics', x]), ...listOf(b, 'scales').map(x => ['scales', x])];
  const by = new Map(); for (const it of items) { const k = refKey(p, it[1].unit); if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
  const courses = [...new Set([...p.units.map(u => u.course || ''), ...[...by.keys()].filter(k => k.startsWith('ref:')).map(k => k.slice(4).split('|')[0])])];
  const top = <div class="bk-new"><Button icon="plus" onClick={() => E.open('rubrics', newItem(p, 'rubrics'), true)} data-bknew="rubrics">{t('more.bk_new_rubric')}</Button>
    <Button icon="plus" onClick={() => E.open('scales', newItem(p, 'scales'), true)} data-bknew="scales">{t('more.bk_new_scale')}</Button></div>;
  if (!items.length) return <>{top}<EmptyState icon="grades" title={t('plan.no_bank')} text={t('plan.no_bank_text')} />{E.ui}</>;
  const list = l => <ul class="list">{sortIt(l).map(([kind, x]) => <Item p={p} kind={kind} x={x} open={E.open} onMove={E.onMove} />)}</ul>;
  return <>
    <p class="mute">{t('plan.bank_note')}</p>{top}
    {courses.map(c => { const us = [...p.units.filter(u => (u.course || '') === c).sort((a, b) => String(a.start || '').localeCompare(String(b.start || ''))).map(u => [u.id, u.title]),
      ...[...by.keys()].filter(k => k.startsWith('ref:') && k.slice(4).split('|')[0] === c).map(k => [k, t('more.bk_elsewhere', { name: k.slice(4).split('|').slice(1).join('|') })])].filter(([k]) => by.has(k));
      return us.length ? <section class="libsec"><h2 class="t4" data-raw>{c}</h2>{us.map(([k, title]) => <div class="bk-unit"><h3 class="t5" data-raw>{title}</h3>{list(by.get(k))}</div>)}</section> : null; })}
    {by.has('') && <section class="libsec"><h2 class="t4">{t('plan.no_unit')}</h2>{list(by.get(''))}</section>}
    {E.ui}
  </>;
}
export function UnitBank({ p, u }) {
  const E = useEditors(p), b = p.bank || {};
  const mine = [...listOf(b, 'rubrics').map(x => ['rubrics', x]), ...listOf(b, 'scales').map(x => ['scales', x])].filter(([, x]) => refKey(p, x.unit) === u.id);
  return <section class="side-sec ubank" aria-labelledby="h-ubank"><h2 id="h-ubank" class="sub">{t('more.bk_unit_h')}</h2>
    {mine.length ? <ul class="list">{sortIt(mine).map(([kind, x]) => <Item p={p} kind={kind} x={x} open={E.open} onMove={E.onMove} />)}</ul> : <p class="mute">{t('more.bk_unit_none')}</p>}
    <div class="row gap"><Button size="sm" icon="plus" onClick={() => E.open('rubrics', newItem(p, 'rubrics', u.id), true)} data-bknew="rubrics">{t('more.bk_rubric')}</Button>
      <Button size="sm" icon="plus" onClick={() => E.open('scales', newItem(p, 'scales', u.id), true)} data-bknew="scales">{t('more.bk_scale')}</Button></div>
    {E.ui}
  </section>;
}

// A score's percent for each score from the top down; blank goes by the plain share of points.
function ScaleRows({ scale, top, set }) {
  if (!scale) return <p class="hint">{t('more.bk_no_scale_say')}</p>;
  const tooBig = top > 40;
  if (tooBig) return <p class="hint">{t('more.bk_top_40')}</p>;
  const rows = []; for (let k = top; k >= 0; k--) rows.push(k);
  return <><div class="bk-scale">{rows.map(k => <label><span>{k}</span>=<input class="input" type="number" step="0.5" min="0" max="200" value={scale[k] == null ? '' : scale[k]} aria-label={t('more.bk_pct_for', { n: k })}
    onInput={e => { const v = e.currentTarget.value, s = { ...scale }; if (v === '') delete s[k]; else s[k] = +v; set(s); }} data-bksk={k} />%</label>)}</div>
    <p class="hint">{t('more.bk_scale_hint')}</p></>;
}
function Presets({ top, cur, set, kind, selfId }) {
  const saved = bankScales().filter(s => scaleTop(s.scale) === top && s.id !== selfId);
  return <div class="bk-pre">
    {top === 12 && scale12On() && <Button size="sm" onClick={() => set(presetScale('usual', 12))} data-bkpre="usual">{t('more.bk_pre_usual')}</Button>}
    <Button size="sm" onClick={() => set(presetScale('fives', top))} data-bkpre="fives">{t('more.bk_pre_fives', { n: Math.max(0, top - 3) })}</Button>
    <Button size="sm" onClick={() => set(presetScale('plain', top))} data-bkpre="plain">{t('more.bk_pre_plain')}</Button>
    {kind === 'rubrics' && cur !== null && <Button size="sm" onClick={() => set(null)} data-bkpre="none">{t('more.bk_pre_none')}</Button>}
    {saved.length > 0 && <div class="selwrap"><select class="input" aria-label={t('more.bk_pre_saved')} value="" onChange={e => { const v = e.currentTarget.value; if (v) set(presetScale(null, top, v)); }} data-bksaved>
      <option value="">{t('more.bk_pre_saved')}</option>{saved.map(s => <option value={s.id}>{s.name}</option>)}</select><Icon name="chd" /></div>}
  </div>;
}
export function BankEditor({ p, kind, item, isNew, onClose }) {
  L.bank = p.bank || { rubrics: [], scales: [] };   // saved scales for "Use a saved scale" (pbank reads L.bank as the Planner does)
  const [x, setX] = useState(() => (kind === 'rubrics' && !item.levels ? { ...item, levels: item.criteria.map(() => ({})) } : item));
  const [key, setKey] = useState(refKey(p, item.unit)), [busy, setBusy] = useState(false);
  const rub = kind === 'rubrics', put = o => setX(v => ({ ...v, ...o }));
  const rowsTop = v => { const to = Math.round(+v); if (!(to >= 1 && to <= B_TOP_MAX)) return; const was = bMax(x), n = { ...x }; delete n.tops; if (to === B_TOP) delete n.top; else n.top = to; n.scale = rescale(x.scale, was, bMax(n)); setX(n); };
  const addRow = () => { const was = bMax(x), n = { ...x, criteria: [...x.criteria, t('more.bk_row_n', { n: x.criteria.length + 1 })], levels: [...x.levels, {}], ...(Array.isArray(x.tops) ? { tops: [...x.tops, null] } : {}) }; n.scale = rescale(x.scale, was, bMax(n)); setX(n); };
  const dropRow = i => { const was = bMax(x), n = { ...x, criteria: x.criteria.filter((_, k) => k !== i), levels: x.levels.filter((_, k) => k !== i), ...(Array.isArray(x.tops) ? { tops: x.tops.filter((_, k) => k !== i) } : {}) }; n.scale = rescale(x.scale, was, bMax(n)); setX(n); };
  const scaleTopSet = v => { const top = Math.max(1, Math.min(40, Math.round(+v) || 1)), was = scaleTop(x.scale); if (top !== was) put({ scale: rescale(x.scale, was, top) || presetScale('plain', top) }); };
  const save = async () => {
    const name = String(x.name || '').trim();
    if (!name) { toast(t('more.bk_name_first')); const n = document.querySelector('[data-bkname]'); if (n) n.focus(); return; }
    const same = listOf(p.bank, kind).find(o => o.id !== x.id && o.name.toLowerCase() === name.toLowerCase());
    if (same) return toast(t('more.bk_same_name', { name: same.name }));
    const ref = refFromKey(p, key, x.unit), clean = rub ? normRubric({ ...x, name, unit: ref }) : normBankScale({ ...x, name, unit: ref });
    setBusy(true);
    try { await bankPut(kind, clean, t('more.bk_step_save')); onClose(); toast(t('more.bk_saved', { name: clean.name }), { undo: undoList.undo }); } catch (e) { saveFailed(e); setBusy(false); }
  };
  const del = () => bankRemove(kind, x.id, t('more.bk_step_del')).then(() => { onClose(); toast(t('more.bk_deleted', { name: x.name }), { undo: undoList.undo }); }, saveFailed);
  const one = rub ? bOneTop(x) : 0, top = rub ? bMax(x) : scaleTop(x.scale);
  return <Sheet open wide title={isNew ? t(rub ? 'more.bk_new_rubric' : 'more.bk_new_scale') : x.name} onClose={onClose}
    footer={<>{!isNew && <Button variant="quiet" onClick={del} data-bkdel>{t('more.bk_del')}</Button>}<span class="grow" />
      <Button onClick={onClose} data-bkcancel>{t('more.bk_cancel')}</Button><Button variant="primary" onClick={save} disabled={busy} data-bksave>{t('more.bk_save')}</Button></>}>
    <div class="bk-ed">
      <TextInput label={t('more.bk_name')} value={x.name} placeholder={t(rub ? 'more.bk_name_rubric_eg' : 'more.bk_name_scale_eg')} onInput={v => put({ name: v })} data-raw data-bkname />
      <Select label={t('more.bk_unit')} value={key} options={unitOptions(p, key)} onChange={setKey} data-bkunit />
      {rub ? <>
        <div class="bk-top"><Select label={t('more.bk_rows_top')} value={one ? String(one) : ''} options={[...(one ? [] : [{ value: '', label: t('more.bk_rows_own') }]), ...Array.from({ length: B_TOP_MAX }, (_, k) => ({ value: String(k + 1), label: String(k + 1) }))]} onChange={rowsTop} data-bktop />
          <Switch label={t('more.bk_half')} checked={x.half !== false} onChange={v => { const n = { ...x }; if (v) delete n.half; else n.half = false; setX(n); }} />
          <span class="hint">{t('more.bk_out_of', { n: bMax(x) })}</span></div>
        {x.criteria.map((c, i) => { const lv = x.levels[i] || {}, n = bLevels(x, i).filter(v => String(lv[v] || '').trim()).length;
          return <div class="bk-rowed"><div class="bk-rowh"><b>{i + 1}</b><input class="input" value={c} aria-label={t('more.bk_row_name', { n: i + 1 })} onInput={e => { const v = e.currentTarget.value; setX(o => ({ ...o, criteria: o.criteria.map((y, k) => k === i ? v : y) })); }} data-raw data-bkrow={i} />
            <IconButton icon="x" size="sm" label={t('more.bk_row_out', { n: i + 1 })} disabled={x.criteria.length < 2} onClick={() => dropRow(i)} data-bkrowout={i} /></div>
            <details><summary data-bklv={i}>{n ? t('more.bk_levels_n', { n }) : t('more.bk_levels')}</summary>
              {bLevels(x, i).map(v => <label class="bk-lv"><b>{v}</b><textarea class="input" rows={2} value={lv[v] || ''} placeholder={v === 0 ? t('more.bk_optional') : ''} aria-label={t('more.bk_lv_for', { v, n: i + 1 })}
                onInput={e => { const s = e.currentTarget.value; setX(o => ({ ...o, levels: o.levels.map((r, k) => k === i ? { ...r, [v]: s } : r) })); }} data-raw data-bklvi={i + ':' + v} /></label>)}</details></div>; })}
        <div><Button size="sm" icon="plus" disabled={x.criteria.length >= 12} onClick={addRow} data-bkrowadd>{t('more.bk_row_add')}</Button></div>
        <h3 class="t5">{t('more.bk_scale_h')}</h3>
        <Presets top={top} cur={x.scale} set={s => put({ scale: s })} kind={kind} selfId={x.id} />
        <ScaleRows scale={x.scale} top={top} set={s => put({ scale: s })} />
      </> : <>
        <TextInput label={t('more.bk_top')} type="number" min="1" max="40" step="1" value={String(top)} onBlur={e => scaleTopSet(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') scaleTopSet(e.currentTarget.value); }} data-bkstop />
        <h3 class="t5">{t('more.bk_pcts')}</h3>
        <Presets top={top} cur={x.scale} set={s => s && put({ scale: s })} kind={kind} selfId={x.id} />
        <ScaleRows scale={x.scale} top={top} set={s => put({ scale: s })} />
      </>}
    </div>
  </Sheet>;
}
export { bankPut, bankUpdate, refKey, refFromKey };
