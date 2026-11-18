// An IB MYP class's task on the marking screen (src/ib.js ibPanelAsk, ibPanelHead, ibTaskDlg, ibTotalHtml): above the rows, the band
// that asks which criteria this task assesses, or once chosen a Criteria link; the dialog that ticks them (each a row scored 0 to 8,
// one undo step: mark/change.js ibTaskApply); and in place of the total, the levels given, with a Stamp of them. Loaded with the file
// tools (mark/fileui.jsx).
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Dialog, toast } from '../../ui/index.js';
import { state, fmtNum, ibSetup } from '../../engines/gcore.js';
import * as S from '../../engines/gsetup.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './lines.js';
import './paper-lines.js';

function TaskDialog({ c, onClose }) {
  const su = state().setup, crit = S.ibCrit(c), was = ibSetup() ? su.ib.filter(Boolean) : [];
  const [on, setOn] = useState(was), [busy, setBusy] = useState(false);
  // papers whose levels or scores would go: a criterion taken off, or a total before there were criteria
  const old = ibSetup() ? su.ib : [], from = crit.filter(x => on.includes(x.k)).map(x => old.indexOf(x.k));
  const lose = state().batch.students.filter(st => (st.grade.rubric || []).some((v, i) => v != null && !from.includes(i)) || (!ibSetup() && st.grade.points !== '' && st.grade.points != null)).length;
  const save = async () => {
    if (!on.length) return toast(t('paper.ib_one'));
    setBusy(true);
    try { if (await C.ibTaskApply(c, on, S)) { onClose(); toast(t('paper.ib_done', { list: state().setup.ib.join(', ') }), { undo: C.undo }); } else setBusy(false); }
    catch (e) { console.error(e); setBusy(false); toast(t('mark.cannot')); }
  };
  return <Dialog open title={t('paper.ib_title')} onClose={onClose}
    actions={<><Button onClick={onClose} data-ibcancel>{t('paper.ib_cancel')}</Button><Button variant="primary" disabled={busy} onClick={save} data-ibsave>{t('paper.ib_save')}</Button></>}>
    <div class="mk-ibtask" data-ibtask>
      <p class="mute">{t('paper.ib_about', { top: S.IB_TOP })}</p>
      <div class="ib-list" role="group" aria-label={t('paper.ib_crit')}>{crit.map(x => <label class="ib-chk"><input type="checkbox" checked={on.includes(x.k)} onChange={e => { const v = e.currentTarget.checked; setOn(o => (v ? [...o, x.k] : o.filter(k => k !== x.k))); }} data-ibtk={x.k} /> <b>{x.k}</b> <span data-raw>{x.name}</span></label>)}</div>
      {lose > 0 && on.length > 0 && <p class="mk-warn" data-iblose>{t('paper.ib_lose', { n: lose })}</p>}
      <p class="mute">{t('paper.ib_note')}</p>
    </div>
  </Dialog>;
}

// Above the rows: in an MYP class, the band to choose this task's criteria, or the Criteria link once they are chosen.
export function IbAsk() {
  const [dlg, setDlg] = useState(false), c = S.ibTaskClass();
  if (!c) return null;
  return <>{ibSetup() ? <Button size="sm" variant="quiet" onClick={() => setDlg(true)} data-ibset>{t('paper.ib_crit')}</Button>
    : <div class="mk-ibask" data-ibask><span data-raw>{t('paper.ib_ask', { cls: c.name })}</span><Button size="sm" variant="primary" onClick={() => setDlg(true)} data-ibset>{t('paper.ib_choose')}</Button></div>}
    {dlg && <TaskDialog c={c} onClose={() => setDlg(false)} />}</>;
}

// In place of the total: each criterion's level, how many are marked, and a Stamp of the levels.
export function IbTotal({ st, onStamp }) {
  const lv = S.ibTaskLevels(st), on = lv.filter(x => x[1] != null);
  return <div class="total mk-ibtl" data-ibtotal>
    <span class="ib-lvs">{on.length ? on.map(([k, v]) => <span class="ib-lv"><i>{k}</i><b>{fmtNum(v)}</b></span>) : <b>–</b>}</span>
    <span class="mute">{on.length === lv.length ? t('paper.ib_levels', { top: S.IB_TOP }) : t('paper.ib_n_of', { n: on.length, of: lv.length })}</span>
    <span class="grow" />
    {on.length > 0 && <Button size="sm" icon="stamp" onClick={onStamp} title={t('paper.ib_stamp_tip', { text: S.ibStampText(st) })} data-stampscore>{t('paper.ib_stamp')}</Button>}
  </div>;
}
