// Under the score on the marking screen (src/grades.js statusHtml's ⋯, xcHtml, pctHtml, tryHtml): Leave out of the average, Extra credit
// points, Score as a percent (rubric rows), and retakes, a second try that keeps the first, with which try counts. What changes the
// grade is mark/change.js, each change one undo step; taking a retake off happens at once with Undo (the current app asks with a
// second click). Loaded with the file tools (mark/fileui.jsx).
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, IconButton, Menu, Segmented, toast, HeldInput } from '../../ui/index.js';
import { state, gradeOf, noScore, ibSetup, fmtNum, fmtPct, retakeRule, RETAKE_RULES } from '../../engines/gcore.js';
import { t } from '../../i18n/t.js';
import { useRove } from './rove.js';
import * as C from './change.js';
import './lines.js';
import './setup-lines.js';
import './paper-lines.js';
import './inout-lines.js';
import { tryOfFile } from '../../engines/gopen.js';
import { shownName, anonOn } from '../../engines/gdraw.js';

const RULE = { high: ['setup.sm_r_high', 'setup.sm_r_high_say', 'setup.sm_c_high'], last: ['setup.sm_r_last', 'setup.sm_r_last_say', 'setup.sm_c_last'], avg: ['setup.sm_r_avg', 'setup.sm_r_avg_say', 'setup.sm_c_avg'] };
const tryName = n => (n === 1 ? t('setup.sm_try1') : t('setup.sm_try_n', { n }));
const tryScore = x => (x.total != null ? fmtNum(x.total) + ' / ' + fmtNum(x.max) + ' · ' : '') + fmtPct(x.pct);
const fm = () => { const a = state().batch.assignment; return !!a && a.type === 'fm'; };

let xcOpenFor = null, pkOpenFor = null;   // the paper whose box is open before it has a value
export function ScoreMore({ st }) {
  const [, again] = useState(0), re = () => again(n => n + 1);
  if (!st || noScore(st)) return null;
  const g = st.grade, su = state().setup, rub = su.mode === 'rubric' && !ibSetup(), tries = g.tries || [];
  if (xcOpenFor && xcOpenFor !== st.key) xcOpenFor = null; if (pkOpenFor && pkOpenFor !== st.key) pkOpenFor = null;
  const showXc = +g.xc > 0 || xcOpenFor === st.key, showPk = rub && (g.pk != null || pkOpenFor === st.key);
  const u = g.xc ? (g.xcU === 'pct' ? 'pct' : 'pts') : C.xcUnitNow();
  const addRetake = () => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.onchange = async () => { const made = await C.addFiles(st, [...i.files].map(file => ({ path: file.name, file })));
    if (made.notKept) toast(t('setup.f_not_kept', { name: made.notKept[0] })); if (made.length) toast(t('setup.f_added', { n: made.length, name: shownName(st, state().batch.students.indexOf(st)) })); re(); }; i.click(); };
  const focus = sel => setTimeout(() => { const e = document.querySelector(sel); if (e) { e.focus(); e.select && e.select(); } }, 0);
  const items = [
    { label: g.outAvg ? t('setup.sm_out_back') : t('setup.sm_out'), icon: 'minus', onSelect: () => { C.outAvg(st); re(); } },
    { label: t('setup.sm_xc'), icon: 'plus', onSelect: () => { xcOpenFor = st.key; re(); focus('[data-smxc]'); } },
    ...(rub ? [{ label: t('setup.sm_pk'), icon: 'half', onSelect: () => { pkOpenFor = st.key; re(); focus('[data-smpk]'); } }] : []),
    ...(fm() ? [] : [{ label: tries.length ? t('setup.sm_retake_more') : t('setup.sm_retake'), icon: 'redo', onSelect: () => {
      const was = C.retakeStart(st);
      if (!was) return toast(t('setup.sm_retake_first'));
      toast(t(st.files.length ? 'setup.sm_retake_kept_files' : 'setup.sm_retake_kept', { name: tryName(st.grade.tries.length), score: tryScore(was) }), { undo: C.undo });
    } }]),
  ];
  const gr = tries.length ? gradeOf(st) : null, rule = gr ? gr.tryRule || retakeRule() : 'high', n = tries.length + (gr && gr.tryNow ? 1 : 0);
  return <div class="mk-more" data-smore>
    <Menu label={t('setup.sm_more')} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('setup.sm_more')} data-smmenu />} items={items} />
    {g.outAvg && <p class="mk-note" data-smout>{t('setup.sm_out_note')} <Button size="sm" variant="quiet" onClick={() => { C.outAvg(st); re(); }}>{t('setup.sm_out_back')}</Button></p>}
    {showXc && <p class="mk-note mk-xc"><label>{t('setup.sm_xc_label')} <HeldInput class="input" type="number" step="0.5" min="0" value={+g.xc ? fmtNum(+g.xc) : ''}
        aria-label={t(u === 'pct' ? 'setup.sm_xc_pct' : 'setup.sm_xc_pts')} onChange={e => { C.setXc(st, e.currentTarget.value, u); if (!(+st.grade.xc > 0)) xcOpenFor = null; re(); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-smxc /></label>
      <Segmented size="sm" label={t('setup.sm_xc_in')} value={u} onChange={v => { C.setXcUnit(st, v); re(); }} options={[{ value: 'pts', label: t('setup.sm_pts') }, { value: 'pct', label: '%' }]} /></p>}
    {showPk && <p class="mk-note mk-xc"><label>{t('setup.sm_pk_label')} <HeldInput class="input" type="text" inputmode="decimal" value={g.pk != null ? String(g.pk) : ''} aria-label={t('setup.sm_pk_label')}
        onChange={e => { C.setPk(st, e.currentTarget.value); if (st.grade.pk == null) pkOpenFor = null; re(); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} data-smpk /></label>
      <Button size="sm" variant="quiet" onClick={() => { C.setPk(st, ''); pkOpenFor = null; re(); }} data-smpkoff>{t('setup.sm_remove')}</Button>
      <small>{t('setup.sm_pk_say')}</small></p>}
    {!!tries.length && <div class="mk-tries" data-smtries>
      <div class="hd"><b>{t('setup.sm_retake_h')}</b><span>{tryName(tries.length + 1)}</span><span class="grow" />
        <Button size="sm" variant="quiet" onClick={() => { C.retakeOff(st); toast(t('setup.sm_off_done', { name: tryName(tries.length) }), { undo: C.undo }); }} data-smoff>{t('setup.sm_off')}</Button></div>
      {tries.map((x, i) => <div class="row"><span>{tryName(i + 1)}</span><b>{tryScore(x)}</b>{x.late && <span class="stag">{t('setup.sm_late')}</span>}{x.comment && <span class="cm" data-raw title={x.comment}>“{x.comment.length > 60 ? x.comment.slice(0, 60) + '…' : x.comment}”</span>}</div>)}
      <div class="count"><span>{gr.tryNow ? t('setup.sm_counts', { pct: fmtPct(gr.pct), how: t(RULE[rule][2], { n }) }) : t(tries.length > 1 ? 'setup.sm_until_n' : 'setup.sm_until_1', { pct: fmtPct(gr.pct) })}</span>
        <Menu label={t('setup.sm_rule')} trigger={b => <Button {...b} size="sm" variant="quiet" data-smrule>{t('setup.sm_change')}</Button>}
          items={RETAKE_RULES.map(([k]) => ({ label: t(RULE[k][0]), icon: k === rule ? 'check' : undefined, onSelect: () => { C.retakeRuleSet(k).then(() => { re(); toast(t('setup.sm_rule_done', { how: t(RULE[k][1]) }), { undo: C.undo }); }); } }))} /></div>
      {/* until the retake has a paper of its own, the way to add it (src/grades.js tryHtml data-tryadd, src/app/kept.js pickAdd) */}
      {!st.files.some(f => !tryOfFile(st, f) && !f.virtual) && <Button size="sm" icon="file" onClick={addRetake} data-tryadd>{t('inout.tr_add')}</Button>}
    </div>}
  </div>;
}

// Under the score: Anchor paper, High Mid Low (src/anchors.js anchorHtml). Shown where anchors belong, once this paper is one: making
// it one is in More for this paper (mark/paper-more.jsx), so the row isn't one more thing to press on every paper.
export const anchorName = lv => t(lv === 'high' ? 'mark.an_high' : lv === 'mid' ? 'mark.an_mid' : 'mark.an_low');
export function Anchors({ st }) {
  const [, again] = useState(0), b = state().batch;
  if (!st || !st.files.length || noScore(st) || !C.anchorsHere() || !st.grade.anchor) return null;
  const on = st.grade.anchor || '';
  const tip = lv => { const j = C.anchorOf(lv), nm = anchorName(lv).toLowerCase(); return on === lv ? t('paper.an_on', { lv: nm }) : j >= 0 && b.students[j] !== st ? (anonOn() ? t('paper.an_move_anon', { lv: nm }) : t('paper.an_move', { lv: nm, who: b.students[j].key })) : t('paper.an_make', { lv: nm }); };
  return <AnchorRow><span class="lab" title={t('paper.an_tip')}>{t('paper.an_label')}</span>
    <AnchorSet>{C.ANCHOR_LV.map(lv => <button type="button" class="chip" aria-pressed={on === lv ? 'true' : 'false'} title={tip(lv)}
      onClick={() => { const now = C.setAnchor(st, lv); again(n => n + 1); if (now) toast(t('paper.an_set', { lv: anchorName(lv) })); }} data-anchor={lv}>{anchorName(lv)}</button>)}</AnchorSet></AnchorRow>;
}
const AnchorRow = ({ children }) => <div class="mk-anch" data-anchrow>{children}</div>;
function AnchorSet({ children }) { const rv = useRove(); return <span class="seg" role="group" aria-label={t('paper.an_label')} {...rv}>{children}</span>; }
