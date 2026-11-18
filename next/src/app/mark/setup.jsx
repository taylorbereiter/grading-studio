// Rubric setup on the marking screen (src/app/dialogs.js openSetup, src/rubrics.js, src/goals.js), loaded as a part of its own
// (router.js PARTS.setup): how this one is scored, Just the total or rubric rows, each row's name, learning goal and what each score
// means, how every row is scored, the grading scale, and her own rubric brought in for every student (a Word file stays Word; a PDF
// or picture is a page to mark up), with rows read out of it. All of it lives in the dialog until Save, which is one undo step
// (mark/change.js setupSave). The current app asks before a Save that changes scores already given; here the dialog says it as it
// goes (what would change, in counts), and Save goes at once with Undo.
import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Button, IconButton, Segmented, Dialog, TextInput, Select, Switch, toast } from '../../ui/index.js';
import { state, rowsTop, rowHalf, rowsMax, rowLevels, rowSteps, rowScaleOf, topOk, ROW_TOP, SCALE12, SCALE_FIVES } from '../../engines/gcore.js';
import { WORD_RX } from '../../engines/gdraw.js';
import * as S from '../../engines/gsetup.js';
import * as E from '../../engines/gopen.js';
import { libs } from './paper.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './lines.js';

const J = v => JSON.parse(JSON.stringify(v));
const ROW_MAX = 6, TOP_MAX = 10;
const draftMax = d => (d.mode === 'rubric' ? rowsMax(d) : Math.round(+d.outOf || 0));

// What Save would do to scores already given (setupSaveNote), as counts for the line above Save.
function stakes(d, from, n0) {
  const s = state(), b = s.batch; if (!b) return [];
  const S0 = b.students, gone = [...Array(n0).keys()].filter(i => !from.includes(i)), out = [], has = v => v !== '' && v != null;
  const nGone = S0.filter(st => gone.some(i => st.grade.rubric[i] != null)).length;
  if (nGone) out.push(t('mark.su_gone', { n: nGone }));
  if (d.mode === 'rubric') {
    const off = S0.filter(st => d.criteria.some((_, i) => { const f = from[i], v = f == null ? null : st.grade.rubric[f]; return v != null && !rowSteps(d, i).includes(v); })).length;
    if (off) out.push(t('mark.su_off', { n: off }));
  }
  if (d.mode !== s.setup.mode) {
    const n = d.mode === 'points' ? S0.filter(st => st.grade.rubric.some(v => v != null)).length : S0.filter(st => has(st.grade.points)).length;
    if (n) out.push(t(d.mode === 'points' ? 'mark.su_rows_wait' : 'mark.su_total_wait', { n }));
  }
  return out;
}

export function SetupDialog({ onClose }) {
  const s = state(), b = s.batch;
  const [d] = useState(() => J(s.setup)), [, again] = useState(0), re = () => again(n => n + 1);
  const [from] = useState(() => d.criteria.map((_, i) => i)), n0 = useRef(d.criteria.length);
  const [page, setPage] = useState(undefined), [found, setFound] = useState(null), [goal, setGoal] = useState((b && b.goal) || ''), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const file = useRef(null);
  const goals = S.goalList(), max = draftMax(d), rp = page === undefined ? d.rubricPage : page;
  const scale12 = !!(s.lib.me || { scale12: true }).scale12;

  const setMode = m => { d.mode = m; re(); };
  const rowName = (i, v) => { d.criteria[i] = v; re(); };
  const rowOut = i => {
    d.criteria.splice(i, 1);
    if (d.levels) d.levels.splice(i, 1); if (Array.isArray(d.ib)) d.ib.splice(i, 1); if (Array.isArray(d.tops)) d.tops.splice(i, 1); if (d.goals) d.goals.splice(i, 1);
    from.splice(i, 1); open.clear(); re();
  };
  const rowAdd = () => { d.criteria.push(t('mark.su_row_n', { n: d.criteria.length + 1 })); if (Array.isArray(d.tops)) d.tops.push(null); if (Array.isArray(d.ib)) d.ib.push(null); from.push(null); re(); };
  const setTop = v => { const k = topOk(v); if (!k) return; delete d.tops; if (k === ROW_TOP) delete d.top; else d.top = k; open.clear(); re(); };
  const setHalf = on => { if (on) delete d.half; else d.half = false; re(); };
  const setLevel = (i, v, txt) => { d.levels ||= []; while (d.levels.length <= i) d.levels.push({}); (d.levels[i] ||= {})[v] = txt; re(); };
  const setGoalRow = (i, id) => { d.goals ||= []; while (d.goals.length <= i) d.goals.push(null); d.goals[i] = id || null; re(); };
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
        const m = await E.makeFile(f.name, bytes);
        if (m.kind !== 'pdf' && m.kind !== 'img') throw new Error('not a page');
        await state().PDFLib.PDFDocument.load(m.data, { ignoreEncryption: true });
        setPage({ bytes: m.data, name: f.name });
        got = m.data === bytes ? await S.ruFromPdf(bytes).catch(() => null) : null;
      }
      setFound(got && got.rows.length ? got : null);
      if (d.mode === 'rubric' && d.criteria.every((c, i) => c === t('mark.su_row_n', { n: i + 1 }))) { d.outOf = rowsMax(d); d.mode = 'points'; }   // her rubric replaces the generic rows
      re();
    } catch (e) { console.error(e); toast(t('mark.su_bad_file')); }
    setBusy(false);
  };
  const useRows = () => { S.rubricRowsInto(d, found); from.length = 0; d.criteria.forEach((_, i) => from.push(i < n0.current ? i : null)); setFound(null); open.clear(); re(); };

  const save = async () => {
    setBusy(true);
    try {
      d.criteria = d.criteria.map((c, i) => c.trim() || t('mark.su_row_n', { n: i + 1 }));
      d.levels = S.tidyLevels(d); if (!d.levels) delete d.levels;
      { const rs = rowScaleOf(d); for (const k of ['top', 'tops', 'half']) delete d[k]; if (d.mode === 'rubric') Object.assign(d, rs); }   // only a scale that isn't 0 to 4 with halves is written down
      d.goals = S.goalsTidy(d); if (!d.goals) delete d.goals;
      await C.setupSave(d, { page, from: from.slice(), n0: n0.current, goal: b && goal !== ((b && b.goal) || '') ? goal : undefined });
      onClose();
      toast(t('mark.su_saved'), { undo: C.undo });
    } catch (e) { console.error(e); setBusy(false); toast(e && e.name === 'CannotSave' && e.why === 'room' ? t('mark.su_too_big') : t('mark.cannot')); }
  };

  const say = stakes(d, from, n0.current), top = rowsTop(d);
  const topOpts = [...(top ? [] : [{ value: '', label: t('mark.su_each_own') }]), ...[...Array(TOP_MAX).keys()].map(k => ({ value: String(k + 1), label: String(k + 1) }))];
  const goalOpts = sel => [{ value: '', label: t('mark.su_no_goal') }, ...goals.map(g => ({ value: g.id, label: g.name })), ...(sel && !goals.some(g => g.id === sel) ? [{ value: sel, label: t('mark.su_goal_gone') }] : [])];

  return <Dialog open title={t('mark.su_title')} onClose={onClose}
    actions={<><Button onClick={onClose} data-sucancel>{t('mark.su_cancel')}</Button><Button variant="primary" disabled={busy} onClick={save} data-susave>{t('mark.su_save')}</Button></>}>
    <div class="mk-su" data-setup>
      <Segmented label={t('mark.su_how')} value={d.mode} onChange={setMode} options={[{ value: 'points', label: t('mark.su_total') }, { value: 'rubric', label: t('mark.su_rows') }]} />
      <p class="mute mk-swsay">{t('mark.su_total_say')}</p>

      {d.mode === 'rubric' ? <div class="su-rows" data-surows>
        {d.criteria.map((c, i) => { const lv = rowLevels(d, i), n = lv.filter(v => S.levelIn(d, i, v).trim()).length;
          return <div class="su-row" data-surow={i}>
            <div class="su-rowline"><TextInput label={t('mark.su_row_label', { n: i + 1 })} value={c} onInput={v => rowName(i, v)} data-raw data-suname={i} />
              {!!goals.length && <Select label={t('mark.su_goal_row')} value={(d.goals && d.goals[i]) || ''} options={goalOpts(d.goals && d.goals[i])} onChange={v => setGoalRow(i, v)} data-raw data-sugoal={i} />}
              {d.criteria.length > 1 && <IconButton icon="x" size="sm" label={t('mark.su_row_out', { n: i + 1 })} onClick={() => rowOut(i)} data-surm={i} />}</div>
            <details class="lved" open={open.has(i)} onToggle={e => { if (e.currentTarget.open) open.add(i); else open.delete(i); }}>
              <summary data-sulv={i}>{n ? t('mark.su_means_n', { n, of: lv.length }) : t('mark.su_means')}</summary>
              {lv.map(v => <label class="lvin"><b>{v}</b><textarea class="input" rows="2" data-raw aria-label={t('mark.su_means_v', { v })} value={S.levelIn(d, i, v)} onInput={e => setLevel(i, v, e.currentTarget.value)} data-sulvi={i + ':' + v} /></label>)}
              <span class="mute lvnote">{rowHalf(d) ? t('mark.su_means_half') : t('mark.su_means_blank')}</span>
            </details>
          </div>; })}
        {d.criteria.length < ROW_MAX && <div><Button size="sm" icon="plus" onClick={rowAdd} data-suadd>{t('mark.su_add_row')}</Button></div>}
        <div class="su-scale">
          <Select label={t('mark.su_top')} value={top ? String(top) : ''} options={topOpts} onChange={setTop} data-sutop />
          <Switch label={t('mark.su_half')} checked={rowHalf(d)} onChange={setHalf} />
          <span class="mute">{t('mark.su_out_all', { n: rowsMax(d) })}</span>
        </div>
      </div> : <div class="su-out"><TextInput label={t('mark.su_out_of')} type="number" min="1" step="0.5" value={String(d.outOf ?? '')} onInput={v => { d.outOf = v; re(); }} data-suout />
        {!!goals.length && b && <Select label={t('mark.su_goal_all')} value={goal} options={goalOpts(goal)} onChange={setGoal} data-raw data-sugoalall />}</div>}

      <div class="su-grade" data-suscale>
        <b>{t('mark.su_scale')}</b>
        <span class="su-btns">{scale12 && <Button size="sm" onClick={() => preset('usual')} data-supreset="usual">{t('mark.su_usual')}</Button>}
          <Button size="sm" onClick={() => preset('fives')} data-supreset="fives">{t('mark.su_fives')}</Button>
          <Button size="sm" onClick={() => preset('none')} data-supreset="none">{t('mark.su_none')}</Button></span>
        {!d.scale ? <p class="mute">{t('mark.su_none_say')}</p> : max > 40 ? <p class="mute">{t('mark.su_too_many')}</p>
          : <><div class="su-grid">{[...Array(max + 1).keys()].reverse().map(k => <label><span>{k}</span>=<input class="input" type="number" step="0.5" value={d.scale[k] == null ? '' : String(d.scale[k])} onInput={e => scaleAt(k, e.currentTarget.value)} data-susk={k} /></label>)}</div>
            <p class="mute">{t('mark.su_blank_rows')}</p></>}
      </div>

      <div class="su-page" data-supage>
        <b>{t('mark.su_page')}</b>
        <p class="mute">{t('mark.su_page_say')}</p>
        <span class="su-btns"><Button size="sm" icon="upload" disabled={busy} onClick={() => { file.current.value = ''; file.current.click(); }} data-suup>{rp ? t('mark.su_replace') : t('mark.su_bring')}</Button>
          {rp && <><b data-raw>{rp.name || t('mark.su_page_name')}</b>
            <Segmented size="sm" label={t('mark.su_where')} value={d.rubricPos || 'end'} onChange={v => { d.rubricPos = v; re(); }} options={[{ value: 'end', label: t('mark.su_after') }, { value: 'start', label: t('mark.su_before') }]} />
            <Button size="sm" variant="quiet" onClick={() => { setPage(null); setFound(null); }} data-surprm>{t('mark.su_remove')}</Button></>}</span>
        {found && <p class="su-found"><span>{t('mark.su_found')}</span> <Button size="sm" onClick={useRows} data-suuse>{t('mark.su_use_rows')}</Button></p>}
        <input ref={file} type="file" hidden accept=".docx,.docm,.pdf,.png,.jpg,.jpeg,.heic,.heif,.gif,.webp" onChange={e => bringIn(e.currentTarget.files[0])} data-sufile />
      </div>

      {!!say.length && <div class="su-say" role="status" data-susay>{say.map(x => <p>{x}</p>)}</div>}
      <p class="mute">{b && b.assignment ? t('mark.su_kept_for', { name: b.assignment.name }) : t('mark.su_kept')}</p>
    </div>
  </Dialog>;
}
