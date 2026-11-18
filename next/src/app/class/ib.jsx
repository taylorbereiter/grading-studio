// IB classes in the gradebook (src/ib.js). An MYP class: each task's levels as evidence, and on the right the level the teacher
// judges fits best for each criterion this term, with its total and 1 to 7; levels are never averaged. A DP class: the percent's 1 to
// 7 on the class's own boundaries, and the grade she predicts. And the box that says how a class is graded. Every rule is the lifted
// engine's; every change goes through the library save as one undo step.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Sheet, Dialog, Button, IconButton, Select, TextInput, Checkbox, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href } from '../router.js';
import { copyText } from '../../services/clipboard.js';
import { engine as B, change, classIn } from '../../students/book.js';
import { itemIn } from './bookedit.jsx';
import { undo as undoLast } from '../../services/undo.js';
import { roundPct } from '../../engines/gcore.js';
import { initials, pct } from './grades.jsx';
import './lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const lvAt = (c, term, n) => ((c.lv || {})[term] || {})[n] || {};
// The level she sets (ibLvSet): c.lv[term][name] = { A: 6, t }; a level set again clears it.
function setLv(c, term, n, k, v) {
  return change(t('class.u_level'), l => {
    const k0 = classIn(l, c.id); if (!k0) return;
    k0.lv ||= {}; k0.lv[term] ||= {};
    const r = { ...(k0.lv[term][n] || {}) }; if (v == null) delete r[k]; else r[k] = v; r.t = Date.now();
    if (Object.keys(r).length > 1) k0.lv[term][n] = r; else delete k0.lv[term][n];
  }, true);
}
const bandWord = v => { const b = B.ibBandName(v); return b === 'limited' ? t('class.band_limited') : b === 'adequate' ? t('class.band_adequate') : b === 'substantial' ? t('class.band_substantial') : b === 'excellent' ? t('class.band_excellent') : ''; };

// An MYP class's gradebook (ibBookView).
export function MypBook({ x, cols, all, term, termName, tab }) {
  const { c } = x, crit = B.ibCrit(c), bounds = B.ibBounds(c), icols = B.ibCols(c, cols), top = crit.length * B.IB_TOP;
  const [fit, setFit] = useState(null), [add, setAdd] = useState(null);
  const yr = B.ibCols(c, all).filter(k => !k.fm), few = crit.map(k => [k.k, yr.filter(y => y.crit.includes(k.k)).length]).filter(k => 2 > k[1]);
  const copy = () => {
    const rows = [[t('class.student'), ...crit.map(k => k.k), t('class.total'), t('class.grade')].join('\t')].concat(c.names.map(n => { const lv = lvAt(c, term, n), r = B.ibTerm(lv, crit, bounds); return [n, ...crit.map(k => (B.ibLevel(lv[k.k]) == null ? '' : lv[k.k])), r.total == null ? '' : r.total, r.grade == null ? '' : r.grade].join('\t'); }));
    copyText(rows.join('\n')).then(ok => toast(t(ok ? 'class.copied_table' : 'class.copy_failed')));
  };
  return <>
    <div class="cp-ibbar"><Button size="sm" icon="copy" onClick={copy} data-ib-copy>{t('class.copy_levels')}</Button><Button size="sm" variant="primary" icon="plus" onClick={() => setAdd({})} data-ib-add>{t('class.add_levels')}</Button></div>
    {yr.length > 0 && few.length > 0 && <div class="cp-note" role="note">{few.map(([k, n]) => t(n ? 'class.crit_once' : 'class.crit_none', { k })).join(' ')} {t('class.crit_twice')}</div>}
    <div class="card gbw"><table class="book ib" ref={tab} data-book={c.id} data-term={term} data-myp>
      <thead><tr class="cp-grp"><th />{icols.length > 0 && <th colSpan={icols.length} class="sep">{t('class.evidence')}</th>}<th colSpan={crit.length + 2} class="sep"><span data-raw>{termName}</span> · {t('class.your_judgment')}</th></tr>
        <tr class="c" data-rove><th>{t('class.student')}</th>
          {icols.map((k, j) => <th class={j ? '' : 'sep'} data-col={k.key}>{k.typed ? <button type="button" class="colbtn" tabIndex={j ? -1 : 0} onClick={() => setAdd({ itId: k.key })}><span data-raw>{k.name}</span><small>{B.bkDay(k.due)} · {k.crit.join(' ') || t('class.no_criteria')}{k.fm ? ' · ' + t('class.formative') : ''}</small></button>
            : <><span data-raw>{k.name}</span><small>{B.bkDay(k.due)} · {k.crit.join(' ') || t('class.no_criteria')}</small></>}</th>)}
          {crit.map((k, j) => <th class={'avg' + (j ? '' : ' sep')} title={k.name}>{k.k}</th>)}<th class="avg">{t('class.total')}<small>{t('class.of_n', { n: top })}</small></th><th class="term">{t('class.grade')}<small>{t('class.one_to_seven')}</small></th></tr></thead>
      <tbody>{c.names.map((n, i) => { const lv = lvAt(c, term, n), r = B.ibTerm(lv, crit, bounds);
        return <tr data-stu={i}><th scope="row"><a class="stu" href={href('class', c.id, 'people', i + 1)}><span class="cav" aria-hidden="true" data-raw>{initials(n)}</span><span data-raw>{n}</span></a></th>
          {icols.map((k, j) => { const cell = k.cells.get(n); return <td class={j ? '' : 'sep'}>{!cell ? <span class="none">–</span> : cell.st ? <span class="st">{cell.st === 'missing' ? t('class.missing') : t('class.excused')}</span> : k.crit.filter(q => cell.lv[q] != null).map(q => <span class="iblv"><i>{q}</i>{cell.lv[q]}</span>)}</td>; })}
          {crit.map((k, j) => { const v = B.ibLevel(lv[k.k]), ev = B.ibEvFor(icols, n, k.k).length;
            return <td class={'avg ibset' + (j ? '' : ' sep')}><button type="button" class="ibcell" onClick={() => setFit(i)} aria-label={t('class.level_for', { k: k.k, name: n }) + ': ' + (v != null ? v : ev ? t('class.not_set') : t('class.no_evidence'))} data-fit={i + ':' + k.k}>
              {v != null ? <b>{v}</b> : ev ? <span class="todo">{t('class.set')}</span> : <span class="none">{t('class.no_evidence')}</span>}</button></td>; })}
          <td class="avg">{r.total != null ? r.total : <span class="none">–</span>}</td><td class="term" data-grade={r.grade != null ? r.grade : ''}>{r.grade != null ? r.grade : <span class="none">–</span>}</td></tr>; })}</tbody>
    </table></div>
    <p class="mute small">{t('class.myp_say')}</p>
    {fit != null && <FitSheet c={c} crit={crit} bounds={bounds} icols={icols} term={term} termName={termName} i={fit} onStep={setFit} onClose={() => setFit(null)} />}
    {add && <AddLevels c={c} itId={add.itId} onClose={() => setAdd(null)} />}
  </>;
}

// One student's evidence for each criterion and the levels to choose from (ibFitBox). The outlined level is the most recent, a hint.
export function FitBox({ c, crit, bounds, icols, term, termName, i }) {
  const n = c.names[i], lv = lvAt(c, term, n), r = B.ibTerm(lv, crit, bounds), top = crit.length * B.IB_TOP;
  return <div class="cp-fit" data-fit-box={i}>
    <p class="mute small"><span data-raw>{termName}</span> · {t('class.fit_say', { n: r.set, of: crit.length })}</p>
    {crit.map(k => { const list = B.ibEvFor(icols, n, k.k), ev = B.ibEvidence(list), v = B.ibLevel(lv[k.k]);
      return <div class="cp-fitrow"><div class="nm" data-raw><b>{k.k}</b> {k.name}</div>
        <div class="ev">{list.length ? list.sort((a, b) => a.t - b.t).map(e => <span class={'cp-ev' + (e.fm ? ' fm' : '')} data-raw>{e.name} <b>{e.v}</b></span>) : <span class="mute">{t('class.no_evidence')}</span>}</div>
        <div><div class="cp-lvls" role="radiogroup" aria-label={t('class.level_k', { k: k.k })}>{Array.from({ length: B.IB_TOP + 1 }, (_, l) => <button type="button" role="radio" aria-checked={String(v === l)} class={v === l ? 'on' : v == null && ev.hint === l ? 'hint' : ''} onClick={() => setLv(c, term, n, k.k, v === l ? null : l)} data-lv={k.k + ':' + l}>{l}</button>)}</div>
          <div class="mute small">{v != null ? (ev.n ? t('class.recent_high', { last: ev.last, high: ev.high }) : t('class.set_no_ev')) + ' · ' + bandWord(v) : ev.n ? t('class.recent_not_set', { last: ev.last }) : t('class.nothing_yet')}</div></div></div>; })}
    <div class="cp-fitsum"><span>{t('class.total')} <b>{r.total != null ? r.total : '–'}</b> {t('class.of_n', { n: top })}</span><span>{t('class.grade')} <b class="g" data-fit-grade>{r.grade != null ? r.grade : '–'}</b></span>
      <span class="mute small">{r.need.length ? t('class.still_to_set', { list: r.need.join(', ') }) : r.grade == null ? t('class.below_lowest') : ''} {t('class.hint_say')}</span></div>
  </div>;
}
function FitSheet({ c, i, onStep, onClose, ...rest }) {
  return <Sheet open wide title={<span data-raw>{c.names[i]}</span>} onClose={onClose} footer={<><Button disabled={!i} onClick={() => onStep(i - 1)} data-fit-prev>{t('class.prev_student')}</Button><span class="grow" /><Button variant="primary" disabled={i >= c.names.length - 1} onClick={() => onStep(i + 1)} data-fit-next>{t('class.next_student')}</Button></>}>
    <FitBox c={c} i={i} {...rest} />
  </Sheet>;
}

// Levels typed in for a task (ibAddView, ibAddSave): its name, date, the criteria it assessed, a level per student for each.
function AddLevels({ c, itId, onClose }) {
  const crit = B.ibCrit(c), it0 = itId ? c.units.flatMap(u => u.items).find(k => k.id === itId) : null;
  const [a, setA] = useState(() => ({ name: it0 ? it0.name : '', due: it0 ? it0.due || '' : B.isoDay(Date.now()), fm: !!it0 && it0.type === 'fm', crit: it0 && it0.crit ? it0.crit.slice() : crit.slice(0, 2).map(k => k.k), s: it0 ? JSON.parse(JSON.stringify((it0.typed && it0.typed.s) || {})) : {} }));
  const [err, setErr] = useState('');
  const on = crit.filter(k => a.crit.includes(k.k));
  const put = (n, k, v) => { const s = { ...a.s }, r = { ...(s[n] || {}) }; r.l = { ...(r.l || {}) }; if (v === '') delete r.l[k]; else r.l[k] = v; s[n] = r; setA({ ...a, s }); };
  const save = () => {
    if (!a.name.trim()) { setErr(t('class.name_needed_task')); return; }
    if (!a.crit.length) return toast(t('class.tick_crit'));
    const s = {};
    for (const [n, r] of Object.entries(a.s)) {
      const l = {};
      for (const k of a.crit) { const raw = r.l && r.l[k]; if (raw == null || raw === '') continue; const v = B.ibLevel(raw); if (v == null) return toast(t('class.level_whole', { n: B.IB_TOP })); l[k] = v; }
      if (Object.keys(l).length || r.st) s[n] = { l, ...(r.st ? { st: r.st } : {}) };
    }
    change(t('class.u_levels'), l => {
      const k0 = classIn(l, c.id); if (!k0) return;
      const was = it0 && itemIn(l, it0.id), typed = B.typedStamp(was && was.typed, { lv: true, s }), type = a.fm ? 'fm' : was && was.type && was.type !== 'fm' ? was.type : 'sum', due = a.due || B.isoDay(Date.now());
      if (was) Object.assign(was, { name: a.name.trim(), type, due, crit: a.crit.slice(), typed });
      else { let u = k0.units[k0.units.length - 1]; if (!u) k0.units.push(u = { id: uid(), name: t('class.unit_1'), items: [] }); u.items.push({ id: uid(), name: a.name.trim(), classId: k0.id, type, due, crit: a.crit.slice(), typed }); }
    }, true);
    onClose();
  };
  const del = () => { change(t('class.u_levels_del'), l => { const k0 = classIn(l, c.id); if (k0) for (const u of k0.units) u.items = u.items.filter(k => k.id !== it0.id); }, true); toast(t('class.levels_deleted'), { undo: undoLast }); onClose(); };
  return <Sheet open wide title={t(it0 && it0.typed ? 'class.change_levels' : 'class.add_levels')} onClose={onClose}
    footer={<>{it0 && it0.typed && <Button onClick={del} data-ib-del>{t('class.delete_levels')}</Button>}<span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-ib-save>{t('common.save')}</Button></>}>
    <div class="cp-add" data-ib-addbox>
      <p class="mute small">{t('class.add_levels_say')}</p>
      <div class="cp-addgrid"><TextInput label={t('class.task')} value={a.name} error={err} onInput={v => setA({ ...a, name: v })} maxLength={80} placeholder={t('class.task_ph')} data-ib-name autofocus={!it0} />
        <TextInput type="date" label={t('class.date')} value={a.due} onInput={v => setA({ ...a, due: v })} />
        <Checkbox label={t('class.formative')} checked={a.fm} onChange={v => setA({ ...a, fm: v })} /></div>
      <div class="cp-crits" role="group" aria-label={t('class.assessed')}><span class="mute">{t('class.assessed')}</span>{crit.map(k => <Checkbox label={<span data-raw>{k.k} <span class="mute">{k.name}</span></span>} checked={a.crit.includes(k.k)} onChange={v => setA({ ...a, crit: crit.map(q => q.k).filter(q => (q === k.k ? v : a.crit.includes(q))) })} />)}</div>
      {on.length ? <table class="cp-ent"><thead><tr><th>{t('class.student')}</th>{on.map(k => <th>{k.k} <small class="mute">{t('class.zero_to', { n: B.IB_TOP })}</small></th>)}</tr></thead>
        <tbody>{c.names.map(n => <tr><td data-raw>{n}</td>{on.map(k => { const v = ((a.s[n] || {}).l || {})[k.k]; return <td><input class="input cp-sc" type="number" min="0" max={B.IB_TOP} step="1" value={v == null ? '' : v} aria-label={t('class.level_for', { k: k.k, name: n })} onInput={e => put(n, k.k, e.currentTarget.value)} data-ib-lv={k.k} /></td>; })}</tr>)}</tbody></table>
        : <p class="mute small">{t('class.tick_crit')}</p>}
    </div>
  </Sheet>;
}

// A DP class's predicted grades (ibPredView): the percent, the 1 to 7 it earns as a hint, and hers.
export function PredSheet({ x, cols, all, term, termName, onClose }) {
  const { c, conf } = x, bounds = B.ibBounds(c);
  const pctOf = n => { if (term !== '*' || !conf.terms.length) return B.bkGrade(n, cols, conf).grade; const v = conf.terms.map(tm => B.bkGrade(n, all.filter(k => k.termId === tm.id), conf).grade).filter(v => v != null); return v.length ? B.bkMean(v) : null; };
  const predOf = n => { const p = ((c.pred || {})[term] || {})[n]; return p && Number.isInteger(p.g) && p.g >= 1 && p.g <= 7 ? p.g : null; };
  const setPred = (n, g) => change(t('class.u_pred'), l => { const k = classIn(l, c.id); if (!k) return; k.pred ||= {}; k.pred[term] ||= {}; k.pred[term][n] = g == null ? { t: Date.now() } : { g, t: Date.now() }; }, true);
  const copy = () => copyText([[t('class.student'), t('class.predicted')].join('\t')].concat(c.names.map(n => [n, predOf(n) ?? ''].join('\t'))).join('\n')).then(ok => toast(t(ok ? 'class.copied_table' : 'class.copy_failed')));
  return <Sheet open wide title={t('class.predicted_grades')} onClose={onClose} footer={<><Button icon="copy" onClick={copy}>{t('class.copy_pred')}</Button><span class="grow" /><Button variant="primary" onClick={onClose}>{t('class.done')}</Button></>}>
    <table class="cp-ent" data-pred><thead><tr><th>{t('class.student')}</th><th class="r"><span data-raw>{termName}</span></th><th class="r">{t('class.worked_out')}</th><th>{t('class.predicted')}</th></tr></thead>
      <tbody>{c.names.map(n => { const p = pctOf(n), g = p == null ? null : B.ibGradeOf(roundPct(p), bounds), mine = predOf(n);
        return <tr><td data-raw>{n}</td><td class="r">{p != null ? pct(p) : '–'}</td><td class="r"><b>{g != null ? g : '–'}</b></td>
          <td><div class="cp-lvls" role="radiogroup" aria-label={t('class.pred_for', { name: n })}>{[1, 2, 3, 4, 5, 6, 7].map(v => <button type="button" role="radio" aria-checked={String(mine === v)} class={mine === v ? 'on' : mine == null && g === v ? 'hint' : ''} onClick={() => setPred(n, mine === v ? null : v)} data-pred={v}>{v}</button>)}</div></td></tr>; })}</tbody></table>
    <p class="mute small">{t('class.pred_say')}</p>
  </Sheet>;
}
// What follows a DP student's percent (ibDpSay): the 1 to 7 on the class's boundaries, and the predicted grade.
export function DpSay({ c, p, n, term }) {
  if (B.classWay(c) !== 'dp') return null;
  const g = p == null ? null : B.ibGradeOf(roundPct(p), B.ibBounds(c)), pr = (((c.pred || {})[term] || {})[n] || {}).g;
  return <>{g != null && <b class="ibg7" title={t('class.on_bounds')}> {g}</b>}{Number.isInteger(pr) && <small> {t('class.pred_n', { n: pr })}</small>}</>;
}

// How a class is graded (ibDlg): points and percent, MYP criteria and boundaries, or DP boundaries and components.
export function GradingDialog({ c, onClose }) {
  const way0 = B.classWay(c), ib = c.ib || {};
  const [d, setD] = useState(() => ({ way: way0, group: way0 === 'myp' && B.ibGroup(ib.group) ? ib.group : way0 === 'myp' ? 'own' : 'sci', crit: way0 === 'myp' ? B.ibCrit(c) : B.ibGroupCrit(B.ibGroup(ib.group) ? ib.group : 'sci'),
    mypB: way0 === 'myp' ? B.ibBounds(c) : null, dpB: way0 === 'dp' ? B.ibBounds(c) : B.ibBoundsClean(null, B.IB_BOUNDS_DP), touched: false,
    dpW: Object.fromEntries(B.bkCats().filter(k => k[0] !== 'fm').map(k => [k[0], +((way0 === 'dp' && ib.w && ib.w[k[0]] != null ? ib.w : B.bkConf().w)[k[0]]) || 0])) }));
  const set = part => setD({ ...d, ...part });
  const mypB = d.mypB || B.ibBoundsFor(d.crit.length), top = d.crit.length * B.IB_TOP;
  const ways = [['', t('class.way_pts'), t('class.way_pts_say')], ['myp', t('class.way_myp'), t('class.way_myp_say')], ['dp', t('class.way_dp'), t('class.way_dp_say')]];
  const groups = B.IB_GROUPS.map(g => ({ value: g[0], label: g[1] }));
  const bound = (b, key, max) => <div class="cp-bounds">{b.map(([lo, g], i) => <label class="cp-bound"><span>{t('class.grade_n', { n: g })}</span><span class="mute">{t('class.from')}</span>
    <input class="input" type="number" min="0" max={max} step="1" value={lo} aria-label={t('class.lowest_for', { n: g })} onInput={e => { const v = e.currentTarget.value; if (v === '' || !isFinite(+v)) return; const nb = b.map(r => r.slice()); nb[i][0] = Math.round(+v); set({ [key]: nb, touched: true }); }} data-bound={g} /></label>)}</div>;
  const save = () => {
    change(t('class.u_grading'), l => {
      const k = classIn(l, c.id); if (!k) return;
      if (d.way === 'myp') { const crit = d.crit.map((x, i) => ({ k: x.k, name: x.name || t('class.criterion_k', { k: B.ibLetter(i) }) })); k.way = 'myp'; k.ib = { ...(k.ib || {}), group: d.group, crit, bounds: mypB.map(r => r.slice()) }; }
      else if (d.way === 'dp') { k.way = 'dp'; k.ib = { ...(k.ib || {}), bounds: d.dpB.map(r => r.slice()) }; const usual = B.bkConf().w; if (Object.keys(d.dpW).every(q => d.dpW[q] === (+usual[q] || 0))) delete k.ib.w; else k.ib.w = { ...d.dpW }; }
      else delete k.way;
    }, true);
    toast(t(d.way === 'myp' ? 'class.now_myp' : d.way === 'dp' ? 'class.now_dp' : 'class.now_pts', { name: c.name }));
    onClose();
  };
  const check = () => {
    const b = d.way === 'myp' ? mypB : d.way === 'dp' ? d.dpB : null;
    if (b && !b.every((r, i) => !i || r[0] < b[i - 1][0])) return toast(t('class.bounds_order'));
    if (d.way === 'dp' && !Object.values(d.dpW).some(v => v > 0)) return toast(t('class.one_counts'));
    save();
  };
  return <Sheet open wide title={t('class.graded_how', { name: c.name })} onClose={onClose} footer={<><span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={check} data-grading-save>{t('common.save')}</Button></>}>
    <div class="cp-ways" role="radiogroup" aria-label={t('class.graded_how_short')}>{ways.map(([k, l, s]) => <button type="button" role="radio" aria-checked={String(d.way === k)} class={'cp-way' + (d.way === k ? ' on' : '')} onClick={() => set({ way: k })} data-way={k || 'pts'}><b>{l}</b><span>{s}</span></button>)}</div>
    {d.way === 'myp' && <div class="cp-ibcols"><div>
      <Select label={t('class.subject_group')} value={d.group} options={groups} onChange={v => setD({ ...d, group: v, crit: B.ibGroupCrit(v), mypB: d.touched ? d.mypB : null })} data-ib-group />
      <p class="small"><b>{t('class.criteria')}</b> <span class="mute">{t('class.criteria_say', { n: B.IB_TOP })}</span></p>
      {d.crit.map((x, i) => <div class="cp-crit"><b>{x.k}</b><input class="input" value={x.name} maxLength={80} aria-label={t('class.crit_name', { k: x.k })} onInput={e => set({ crit: d.crit.map((y, j) => (j === i ? { ...y, name: e.currentTarget.value } : y)) })} />
        <IconButton icon="x" label={t('class.crit_remove', { k: x.k })} disabled={d.crit.length < 2} onClick={() => { const crit = d.crit.filter((_, j) => j !== i).map((y, j) => ({ ...y, k: B.ibLetter(j) })); set({ crit, mypB: d.touched ? d.mypB : null }); }} /></div>)}
      {d.crit.length < 6 && <Button size="sm" icon="plus" onClick={() => set({ crit: d.crit.concat({ k: B.ibLetter(d.crit.length), name: t('class.criterion_k', { k: B.ibLetter(d.crit.length) }) }), mypB: d.touched ? d.mypB : null })}>{t('class.add_crit')}</Button>}</div>
      <div><p class="small"><b>{t('class.boundaries')}</b> <span class="mute">{t('class.bounds_myp', { n: top })}</span></p>{bound(mypB, 'mypB', top)}
        <p class="mute small">{d.crit.length === 4 ? t('class.bounds_published') : t('class.bounds_scaled', { n: d.crit.length })}</p></div></div>}
    {d.way === 'myp' && <p class="mute small">{t('class.ib_holds')}</p>}
    {d.way === 'dp' && <div class="cp-ibcols"><div><p class="small"><b>{t('class.boundaries')}</b> <span class="mute">{t('class.bounds_dp')}</span></p>{bound(d.dpB, 'dpB', 100)}<p class="mute small">{t('class.bounds_dp_say')}</p></div>
      <div><p class="small"><b>{t('class.components')}</b> <span class="mute">{t('class.components_say')}</span></p>
        <div class="cp-bounds">{B.bkCats().filter(k => k[0] !== 'fm').map(k => <label class="cp-bound"><span data-raw>{k[1]}</span><input class="input" type="number" min="0" max="100" step="1" value={d.dpW[k[0]] || 0} aria-label={t('class.weight_of', { type: k[1] })} onInput={e => { const v = e.currentTarget.value; if (v === '' || !isFinite(+v)) return; set({ dpW: { ...d.dpW, [k[0]]: Math.max(0, Math.min(100, Math.round(+v))) } }); }} data-dpw={k[0]} /><span class="mute">%</span></label>)}</div>
        <p class="mute small">{t('class.components_note')}</p></div></div>}
    {!d.way && <p class="mute small">{t('class.way_pts_note')}</p>}
  </Sheet>;
}
