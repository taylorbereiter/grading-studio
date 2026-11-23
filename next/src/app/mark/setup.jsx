// Rubric setup on the marking screen (src/app/dialogs.js openSetup, src/rubrics.js, src/goals.js), loaded as a part of its own
// (router.js PARTS.setup): how this one is scored, Just the total or rubric rows, each row's name, learning goal and what each score
// means, how every row is scored, the grading scale, and her own rubric brought in for every student (a Word file stays Word; a PDF
// or picture is a page to mark up), with rows read out of it. All of it lives in the dialog until Save, which is one undo step
// (mark/change.js setupSave). The current app asks before a Save that changes scores already given; here the dialog says it as it
// goes (what would change, in counts), and Save goes at once with Undo.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, IconButton, Segmented, Dialog, TextInput, Select, Switch, toast } from '../../ui/index.js';
import { state, rowsTop, rowHalf, rowsMax, rowLevels, rowSteps, rowScaleOf, topOk, ROW_TOP, SCALE12, SCALE_FIVES } from '../../engines/gcore.js';
import { WORD_RX } from '../../engines/gdraw.js';
import * as S from '../../engines/gsetup.js';
import * as E from '../../engines/gopen.js';
import { libs } from './paper.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import { readBank, keepRubric, dropRubric, keepScale, uid } from '../../students/bank.js';
import { undo as undoLast } from '../../services/undo.js';
import { onSaved } from '../../shared/saved.js';
import './lines.js';
import './setup-lines.js';
import { DriveButton } from '../drive-button.jsx';
import { heicSay } from './heic.js';
import { library } from '../../students/index.js';
import { PARTS } from '../router.js';

const J = v => JSON.parse(JSON.stringify(v));
const ROW_MAX = 6, TOP_MAX = 10;
const draftMax = d => (d.mode === 'rubric' ? rowsMax(d) : Math.round(+d.outOf || 0));

// What Save would do to scores already given (setupSaveNote), as counts for the line above Save.
function stakes(d, from, n0) {
  const s = state(), b = s.batch; if (!b) return [];
  const S0 = b.students, gone = [...Array(n0).keys()].filter(i => !from.includes(i)), out = [], has = v => v !== '' && v != null;
  const nGone = S0.filter(st => gone.some(i => st.grade.rubric[i] != null)).length;
  if (nGone) out.push(t('setup.su_gone', { n: nGone }));
  if (d.mode === 'rubric') {
    const off = S0.filter(st => d.criteria.some((_, i) => { const f = from[i], v = f == null ? null : st.grade.rubric[f]; return v != null && !rowSteps(d, i).includes(v); })).length;
    if (off) out.push(t('setup.su_off', { n: off }));
  }
  if (d.mode !== s.setup.mode) {
    const n = d.mode === 'points' ? S0.filter(st => st.grade.rubric.some(v => v != null)).length : S0.filter(st => has(st.grade.points)).length;
    if (n) out.push(t(d.mode === 'points' ? 'setup.su_rows_wait' : 'setup.su_total_wait', { n }));
  }
  return out;
}

// The rubric bank in Rubric setup (src/rubrics.js rubricLibRaw, scaleBankRaw, rubricUse, rubricSave, scaleSave): saved rubrics by
// unit with Use, Save to the bank… with a name and a unit, and saved grading scales with the same top score. Saving or deleting is one
// undo step at once; the current app asks before replacing one of the same name or deleting.
const slug = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const refUnit = (bk, ref) => (!ref ? null : bk.units.find(u => u.id === ref.id) || bk.units.find(u => u.course === ref.course && slug(u.title) === slug(ref.title)) || null);
const unitKeyOf = (bk, ref) => { if (!ref || !(ref.id || ref.title)) return ''; const u = refUnit(bk, ref); return u ? u.id : 'ref:' + (ref.course || '') + '|' + (ref.title || ''); };
const unitLabel = (bk, k) => { if (!k) return t('setup.sb_no_unit'); const u = bk.units.find(x => x.id === k); if (u) return (u.course ? u.course + ' · ' : '') + u.title; const [c, ...rest] = k.slice(4).split('|'); return (c ? c + ' · ' : '') + rest.join('|'); };
const keyRef = (bk, k, was) => { if (!k) return null; const u = bk.units.find(x => x.id === k); if (u) return { id: u.id, course: u.course, title: u.title }; return was && unitKeyOf(bk, was) === k ? { id: was.id || '', course: was.course || '', title: was.title || '' } : null; };
function unitOpts(bk, all) {
  const out = all ? [{ value: '*', label: t('setup.sb_every') }] : [];
  out.push({ value: '', label: t('setup.sb_no_unit') });
  for (const u of bk.units.slice().sort((a, b) => a.course.localeCompare(b.course) || a.start.localeCompare(b.start))) out.push({ value: u.id, label: (u.course ? u.course + ' · ' : '') + u.title });
  for (const k of new Set([...bk.rubrics, ...bk.scales].map(r => unitKeyOf(bk, r.unit)).filter(k => k.startsWith('ref:')))) out.push({ value: k, label: unitLabel(bk, k) });
  return out;
}
// Save to the bank…: a name and a unit, under the button that asked
function AskSave({ bk, name, onSave, onCancel }) {
  const [n, setN] = useState(name), [k, setK] = useState('');
  return <div class="su-ask" data-suask>
    <TextInput label={t('setup.sb_name')} value={n} onInput={setN} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSave(n.trim(), k); } }} data-raw data-subname />
    <Select label={t('setup.sb_unit')} value={k} options={unitOpts(bk, false)} onChange={setK} data-subunit />
    <p class="mute">{t('setup.sb_only')}</p>
    <span class="su-btns"><Button size="sm" onClick={onCancel}>{t('setup.su_cancel')}</Button><Button size="sm" variant="primary" disabled={!n.trim()} onClick={() => onSave(n.trim(), k)} data-subok>{t('setup.sb_save_ok')}</Button></span>
  </div>;
}

export function SetupDialog({ onClose }) {
  const s = state(), b = s.batch;
  const [d] = useState(() => J(s.setup)), [, again] = useState(0), re = () => again(n => n + 1);
  const [from] = useState(() => d.criteria.map((_, i) => i)), n0 = useRef(d.criteria.length);
  const [page, setPage] = useState(undefined), [found, setFound] = useState(null), [goal, setGoal] = useState((b && b.goal) || ''), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const file = useRef(null);
  const [bk, setBk] = useState(null), [fk, setFk] = useState('*'), [asking, setAsking] = useState('');
  const loadBank = () => readBank().then(setBk, e => { console.error(e); setBk({ rubrics: [], scales: [], units: [] }); });
  // Undo, a change here, or one in another window or the current app (its gs-bank channel, src/rubrics.js bankChan): read again
  useEffect(() => {
    loadBank(); const off = onSaved(e => { if ((e.kind === 'plan' && e.id === 'bank') || (e.kind === 'setting' && /^gs\.rubrics/.test(e.id))) loadBank(); });
    let ch = null; try { ch = new BroadcastChannel('gs-bank'); ch.onmessage = () => loadBank(); } catch {}
    return () => { off(); if (ch) ch.close(); };
  }, []);
  const goals = S.goalList(), max = draftMax(d), rp = page === undefined ? d.rubricPage : page;
  const scale12 = !!(s.lib.me || { scale12: true }).scale12;

  const setMode = m => { d.mode = m; re(); };
  const rowName = (i, v) => { d.criteria[i] = v; re(); };
  const rowOut = i => {
    d.criteria.splice(i, 1);
    if (d.levels) d.levels.splice(i, 1); if (Array.isArray(d.ib)) d.ib.splice(i, 1); if (Array.isArray(d.tops)) d.tops.splice(i, 1); if (d.goals) d.goals.splice(i, 1);
    from.splice(i, 1); open.clear(); re();
  };
  const rowAdd = () => { d.criteria.push(t('setup.su_row_n', { n: d.criteria.length + 1 })); if (Array.isArray(d.tops)) d.tops.push(null); if (Array.isArray(d.ib)) d.ib.push(null); from.push(null); re(); };
  const setTop = v => { const k = topOk(v); if (!k) return; delete d.tops; if (k === ROW_TOP) delete d.top; else d.top = k; open.clear(); re(); };
  const setHalf = on => { if (on) delete d.half; else d.half = false; re(); };
  const setLevel = (i, v, txt) => { d.levels ||= []; while (d.levels.length <= i) d.levels.push({}); (d.levels[i] ||= {})[v] = txt; re(); };
  const setGoalRow = (i, id) => { d.goals ||= []; while (d.goals.length <= i) d.goals.push(null); d.goals[i] = id || null; re(); };
  // her list of learning goals (src/goals.js goalsDlg): Tag rows…, Edit goals…, or New goal… in a picker, which then picks the goal made
  const [gbox, setGbox] = useState(null);
  const editGoals = (add, row) => PARTS.goals().then(m => setGbox({ G: m.GoalsDialog, add, row }), e => console.error(e));
  const goalsBack = id => { const l = library.json(null), cur = state().lib, row = gbox && gbox.row; if (l && cur) for (const k of ['goals', 'goalsGone']) { if (l[k]) cur[k] = l[k]; else delete cur[k]; }
    setGbox(null); if (typeof id === 'string' && row != null) { if (row === 'all') setGoal(id); else setGoalRow(row, id); } re(); };
  const goalPick = (row, v) => (v === '+' ? editGoals(true, row) : row === 'all' ? setGoal(v) : setGoalRow(row, v));
  const goalLine = <p class="goalline" data-sugoalline>{goals.length ? <button type="button" class="link" onClick={() => editGoals(false)} data-sugoals>{t('setup.su_goal_edit')}</button>
    : <><button type="button" class="link" onClick={() => editGoals(false)} data-sugoals>{t(d.mode === 'rubric' ? 'setup.su_goal_tag_rows' : 'setup.su_goal_tag_score')}</button> <span class="mute">{t('setup.su_goal_opt')}</span></>}</p>;
  const preset = k => {
    if (k === 'none') d.scale = null;
    else if (max === 12) d.scale = { ...(k === 'usual' ? SCALE12 : SCALE_FIVES) };
    else { d.scale = {}; for (let v = max; v >= 0; v--) d.scale[v] = Math.round((k === 'fives' ? 100 - (max - v) * 5 : v / max * 100) * 10) / 10; }
    re();
  };
  const scaleAt = (k, v) => { if (v === '') delete d.scale[k]; else d.scale[k] = +v; re(); };

  // her rubric file: Word stays Word; a PDF or picture becomes the page each student gets (makeFile reads a picture as the paper does)
  const bringIn = async f => {
    if (!f) return;
    setBusy(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let got = null;
      if (WORD_RX.test(f.name)) {
        try { got = S.ruFromWord(bytes); } catch { got = null; }
        setPage({ bytes, name: f.name });
        if (!d.rubricPos) d.rubricPos = 'start';   // a Word rubric sits above their work unless she moves it
      } else {
        await libs();
        heicSay(f.name);
        const m = await E.makeFile(f.name, bytes);
        if (m.kind !== 'pdf' && m.kind !== 'img') throw new Error('not a page');
        await state().PDFLib.PDFDocument.load(m.data, { ignoreEncryption: true });
        setPage({ bytes: m.data, name: f.name });
        got = m.data === bytes ? await S.ruFromPdf(bytes).catch(() => null) : null;
      }
      setFound(got && got.rows.length ? got : null);
      if (d.mode === 'rubric' && d.criteria.every((c, i) => c === t('setup.su_row_n', { n: i + 1 }))) { d.outOf = rowsMax(d); d.mode = 'points'; }   // her rubric replaces the generic rows
      re();
    } catch (e) { console.error(e); toast(t('setup.su_bad_file')); }
    setBusy(false);
  };
  const useRows = () => { S.rubricRowsInto(d, found); from.length = 0; d.criteria.forEach((_, i) => from.push(i < n0.current ? i : null)); setFound(null); open.clear(); re(); };

  const useRubric = r => {
    for (const k of ['top', 'tops', 'half']) delete d[k];   // the saved rubric's own row scale, or 0 to 4 with halves when it says none
    Object.assign(d, rowScaleOf(r), { mode: 'rubric', criteria: r.criteria.slice(), levels: r.levels ? J(r.levels) : undefined, goals: Array.isArray(r.goals) ? r.goals.slice() : undefined, scale: r.scale ? { ...r.scale } : null, rubricName: r.name });
    from.length = 0; r.criteria.forEach((_, i) => from.push(i)); n0.current = r.criteria.length;   // a saved rubric's rows go by place
    open.clear(); re(); toast(t('setup.sb_filled', { name: r.name }));
  };
  const saveRubric = async (name, key) => {
    if (!name) return;
    const old = bk.rubrics.find(r => r.name.toLowerCase() === name.toLowerCase());
    const r = { id: old ? old.id : uid(), name, criteria: d.criteria.map((c, i) => c.trim() || t('setup.su_row_n', { n: i + 1 })), levels: S.tidyLevels(d), scale: d.scale ? { ...d.scale } : null, ...rowScaleOf(d), at: Date.now() };
    if (!r.levels) delete r.levels;
    const tags = S.goalsTidy(d); if (tags) r.goals = tags;   // a saved rubric keeps its rows' learning goals
    const unit = keyRef(bk, key, old && old.unit); if (unit) r.unit = unit;
    try { await keepRubric(t('setup.sb_step_save'), r); } catch (e) { console.error(e); return toast(t('setup.sb_not_saved')); }
    d.rubricName = name; setAsking(''); setFk(key || '*'); await loadBank();
    toast(t(old ? 'setup.sb_replaced' : 'setup.sb_saved', { name, unit: unitLabel(bk, key) }), { undo: undoLast });
  };
  const deleteRubric = async r => {
    try { await dropRubric(t('setup.sb_step_del'), r.id); } catch (e) { console.error(e); return toast(t('setup.sb_not_saved')); }
    await loadBank(); toast(t('setup.sb_deleted', { name: r.name }), { undo: undoLast });
  };
  const saveScale = async (name, key) => {
    if (!name) return;
    const old = bk.scales.find(x => x.name.toLowerCase() === name.toLowerCase()), scale = {};
    for (let k = max; k >= 0; k--) if (d.scale[k] != null && d.scale[k] !== '' && isFinite(+d.scale[k])) scale[k] = +d.scale[k];
    if (scale[max] == null) scale[max] = 100;   // so its top score is always known
    const sc = { id: old ? old.id : uid(), name, scale, at: Date.now() }, unit = keyRef(bk, key, old && old.unit); if (unit) sc.unit = unit;
    try { await keepScale(t('setup.sb_step_scale'), sc); } catch (e) { console.error(e); return toast(t('setup.sb_not_saved')); }
    setAsking(''); await loadBank(); toast(t(old ? 'setup.sb_replaced' : 'setup.sb_saved', { name, unit: unitLabel(bk, key) }), { undo: undoLast });
  };
  const fitScales = bk ? bk.scales.filter(x => Math.max(...Object.keys(x.scale).map(Number)) === max) : [];

  const save = async () => {
    setBusy(true);
    try {
      d.criteria = d.criteria.map((c, i) => c.trim() || t('setup.su_row_n', { n: i + 1 }));
      d.levels = S.tidyLevels(d); if (!d.levels) delete d.levels;
      { const rs = rowScaleOf(d); for (const k of ['top', 'tops', 'half']) delete d[k]; if (d.mode === 'rubric') Object.assign(d, rs); }   // only a scale that isn't 0 to 4 with halves is written down
      d.goals = S.goalsTidy(d); if (!d.goals) delete d.goals;
      await C.setupSave(d, { page, from: from.slice(), n0: n0.current, goal: b && goal !== ((b && b.goal) || '') ? goal : undefined });
      onClose();
      toast(t('setup.su_saved'), { undo: C.undo });
    } catch (e) { console.error(e); setBusy(false); toast(e && e.name === 'CannotSave' && e.why === 'room' ? t('setup.su_too_big') : t('mark.cannot')); }
  };

  const say = stakes(d, from, n0.current), top = rowsTop(d);
  const topOpts = [...(top ? [] : [{ value: '', label: t('setup.su_each_own') }]), ...[...Array(TOP_MAX).keys()].map(k => ({ value: String(k + 1), label: String(k + 1) }))];
  const goalOpts = sel => [{ value: '', label: t('setup.su_no_goal') }, ...goals.map(g => ({ value: g.id, label: g.name })), ...(sel && !goals.some(g => g.id === sel) ? [{ value: sel, label: t('setup.su_goal_gone') }] : []), { value: '+', label: t('setup.su_goal_new') }];

  return <Dialog open title={t('mark.su_title')} onClose={onClose}
    actions={<><Button onClick={onClose} data-sucancel>{t('setup.su_cancel')}</Button><Button variant="primary" disabled={busy} onClick={save} data-susave>{t('setup.su_save')}</Button></>}>
    <div class="mk-su" data-setup>
      <Segmented label={t('setup.su_how')} value={d.mode} onChange={setMode} options={[{ value: 'points', label: t('setup.su_total') }, { value: 'rubric', label: t('setup.su_rows') }]} />
      <p class="mute mk-swsay">{t('setup.su_total_say')}</p>

      {d.mode === 'rubric' ? <div class="su-rows" data-surows>
        {d.criteria.map((c, i) => { const lv = rowLevels(d, i), n = lv.filter(v => S.levelIn(d, i, v).trim()).length;
          return <div class="su-row" data-surow={i}>
            <div class="su-rowline"><TextInput label={t('setup.su_row_label', { n: i + 1 })} value={c} onInput={v => rowName(i, v)} data-raw data-suname={i} />
              {!!goals.length && <Select label={t('setup.su_goal_row')} value={(d.goals && d.goals[i]) || ''} options={goalOpts(d.goals && d.goals[i])} onChange={v => goalPick(i, v)} data-raw data-sugoal={i} />}
              {d.criteria.length > 1 && <IconButton icon="x" size="sm" label={t('setup.su_row_out', { n: i + 1 })} onClick={() => rowOut(i)} data-surm={i} />}</div>
            <details class="lved" open={open.has(i)} onToggle={e => { if (e.currentTarget.open) open.add(i); else open.delete(i); }}>
              <summary data-sulv={i}>{n ? t('setup.su_means_n', { n, of: lv.length }) : t('setup.su_means')}</summary>
              {lv.map(v => <label class="lvin"><b>{v}</b><textarea class="input" rows="2" data-raw aria-label={t('setup.su_means_v', { v })} value={S.levelIn(d, i, v)} onInput={e => setLevel(i, v, e.currentTarget.value)} data-sulvi={i + ':' + v} /></label>)}
              <span class="mute lvnote">{rowHalf(d) ? t('setup.su_means_half') : t('setup.su_means_blank')}</span>
            </details>
          </div>; })}
        {d.criteria.length < ROW_MAX && <div><Button size="sm" icon="plus" onClick={rowAdd} data-suadd>{t('setup.su_add_row')}</Button></div>}
        {goalLine}
        <div class="su-scale">
          <Select label={t('setup.su_top')} value={top ? String(top) : ''} options={topOpts} onChange={setTop} data-sutop />
          <Switch label={t('setup.su_half')} checked={rowHalf(d)} onChange={setHalf} />
          <span class="mute">{t('setup.su_out_all', { n: rowsMax(d) })}</span>
        </div>
        {bk && <div class="su-bank" data-subank>
          <b>{t('setup.sb_title')}</b>
          {bk.rubrics.length > 0 && <Select label={t('setup.sb_show')} value={fk} options={unitOpts(bk, true)} onChange={setFk} data-subfilter />}
          {(() => { const shown = fk === '*' ? bk.rubrics : bk.rubrics.filter(r => unitKeyOf(bk, r.unit) === fk);
            if (!bk.rubrics.length) return <p class="mute">{t('setup.sb_none')}</p>;
            if (!shown.length) return <p class="mute">{t('setup.sb_none_unit')}</p>;
            return <ul class="su-blist">{shown.map(r => <li data-subitem={r.id}><span><b data-raw>{r.name}</b><small>{t('setup.sb_about', { n: r.criteria.length })}{fk === '*' ? ' · ' + unitLabel(bk, unitKeyOf(bk, r.unit)) : ''}</small></span>
              <Button size="sm" onClick={() => useRubric(r)} data-subuse={r.id}>{t('setup.sb_use')}</Button>
              <IconButton icon="x" size="sm" label={t('setup.sb_del', { name: r.name })} onClick={() => deleteRubric(r)} data-subdel={r.id} /></li>)}</ul>; })()}
          {asking === 'rubric' ? <AskSave bk={bk} name={d.rubricName || (b && b.assignment && b.assignment.name) || ''} onSave={saveRubric} onCancel={() => setAsking('')} />
            : <div><Button size="sm" onClick={() => setAsking('rubric')} data-subsave>{t('setup.sb_save')}</Button></div>}
        </div>}
      </div> : <div class="su-out"><TextInput label={t('setup.su_out_of')} type="number" min="1" step="0.5" value={String(d.outOf ?? '')} onInput={v => { d.outOf = v; re(); }} data-suout />
        {!!goals.length && b && <Select label={t('setup.su_goal_all')} value={goal} options={goalOpts(goal)} onChange={v => goalPick('all', v)} data-raw data-sugoalall />}{b && goalLine}</div>}

      <div class="su-grade" data-suscale>
        <b>{t('setup.su_scale')}</b>
        <span class="su-btns">{scale12 && <Button size="sm" onClick={() => preset('usual')} data-supreset="usual">{t('setup.su_usual')}</Button>}
          <Button size="sm" onClick={() => preset('fives')} data-supreset="fives">{t('setup.su_fives')}</Button>
          <Button size="sm" onClick={() => preset('none')} data-supreset="none">{t('setup.su_none')}</Button>
          {fitScales.length > 0 && <span class="selwrap"><select class="input" aria-label={t('setup.sb_scales')} value="" onChange={e => { const sc = fitScales.find(x => x.id === e.currentTarget.value); if (sc) { d.scale = { ...sc.scale }; re(); toast(t('setup.sb_scale_used', { name: sc.name })); } }} data-suscuse>
            <option value="">{t('setup.sb_scales')}</option>{fitScales.map(x => <option value={x.id}>{x.name}</option>)}</select></span>}
          {bk && d.scale && max <= 40 && asking !== 'scale' && <Button size="sm" variant="quiet" onClick={() => setAsking('scale')} data-suscsave>{t('setup.sb_scale_save')}</Button>}</span>
        {asking === 'scale' && bk && <AskSave bk={bk} name={t('setup.sb_scale_name', { n: max })} onSave={saveScale} onCancel={() => setAsking('')} />}
        {!d.scale ? <p class="mute">{t('setup.su_none_say')}</p> : max > 40 ? <p class="mute">{t('setup.su_too_many')}</p>
          : <><div class="su-grid">{[...Array(max + 1).keys()].reverse().map(k => <label><span>{k}</span>=<input class="input" type="number" step="0.5" value={d.scale[k] == null ? '' : String(d.scale[k])} onInput={e => scaleAt(k, e.currentTarget.value)} data-susk={k} /></label>)}</div>
            <p class="mute">{t('setup.su_blank_rows')}</p></>}
      </div>

      <div class="su-page" data-supage>
        <b>{t('setup.su_page')}</b>
        <p class="mute">{t('setup.su_page_say')}</p>
        <span class="su-btns"><Button size="sm" icon="upload" disabled={busy} onClick={() => { file.current.value = ''; file.current.click(); }} data-suup>{rp ? t('setup.su_replace') : t('setup.su_bring')}</Button><DriveButton input={file} />
          {rp && <><b data-raw>{rp.name || t('setup.su_page_name')}</b>
            <Segmented size="sm" label={t('setup.su_where')} value={d.rubricPos || 'end'} onChange={v => { d.rubricPos = v; re(); }} options={[{ value: 'end', label: t('setup.su_after') }, { value: 'start', label: t('setup.su_before') }]} />
            <Button size="sm" variant="quiet" onClick={() => { setPage(null); setFound(null); }} data-surprm>{t('setup.su_remove')}</Button></>}</span>
        {found && <p class="su-found"><span>{t('setup.su_found')}</span> <Button size="sm" onClick={useRows} data-suuse>{t('setup.su_use_rows')}</Button></p>}
        <input ref={file} type="file" hidden accept=".docx,.docm,.pdf,.png,.jpg,.jpeg,.heic,.heif,.gif,.webp" onChange={e => bringIn(e.currentTarget.files[0])} data-sufile />
      </div>

      {!!say.length && <div class="su-say" role="status" data-susay>{say.map(x => <p>{x}</p>)}</div>}
      <p class="mute">{b && b.assignment ? t('setup.su_kept_for', { name: b.assignment.name }) : t('setup.su_kept')}</p>
    </div>
    {gbox && h(gbox.G, { lib: state().lib, add: gbox.add, onClose: goalsBack })}
  </Dialog>;
}
