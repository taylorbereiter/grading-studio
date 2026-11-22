// An MYP class's charts (src/ib.js ibClassView): grades set, the middle grade and each criterion's middle level, the levels set and
// the most recent evidence by criterion, the 1 to 7s, each task's middle level, and how often each criterion was assessed this year.
// Nothing is an average of levels: a middle level is the one half the class is at or above. Read only. Loaded on its own.
import { h, Fragment } from 'preact';
import { Sheet } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine as B } from '../../students/book.js';
import './lines.js';

const lvAt = (c, term, n) => ((c.lv || {})[term] || {})[n] || {};
const BAND = { limited: 'class.band_limited', adequate: 'class.band_adequate', substantial: 'class.band_substantial', excellent: 'class.band_excellent' };
// the middle of the levels, or "5 to 6" between two
const mid = list => { const m = B.ibMid(list); return m == null ? '–' : String(m).replace(' to ', '–'); };
const SEGS = () => [['0', v => v === 0]].concat(B.IB_BANDS.map(([lo, hi, l]) => [lo + '–' + hi + ' ' + t(BAND[l] || 'class.not_set'), v => v >= lo && v <= hi]));

function Stack({ crit, valsOf, none, id }) {
  const segs = SEGS();
  return <><div class="cp-ibstacks" data-myp-stack={id}>{crit.map(x => { const vals = valsOf(x.k), no = vals.filter(p => p.v == null);
    const seg = (cls, list, label) => list.length > 0 && <i class={'ibseg ' + cls} style={{ flex: list.length }} title={x.k + ' · ' + label + ': ' + list.map(p => p.name).join(', ')} data-raw>{list.length}</i>;
    return <div class="cp-ibstack"><span data-raw title={x.name}><b>{x.k}</b> {x.name}</span><div class="ibsegs">{segs.map(([l, fn], i) => seg('s' + i, vals.filter(p => p.v != null && fn(p.v)), l))}{seg('sn', no, none)}</div><b class="num">{mid(vals.map(p => p.v))}</b></div>; })}</div>
    <div class="chleg">{segs.map(([l], i) => <span><i class={'ibseg s' + i} />{l}</span>)}<span><i class="ibseg sn" />{none}</span></div></>;
}

export function MypChartsSheet({ x, cols, all, term, left, onClose }) {
  const { c } = x, crit = B.ibCrit(c), bounds = B.ibBounds(c), icols = B.ibCols(c, term === '*' ? all : cols);
  const who = c.names.filter(n => !left.has(n)), terms = who.map(n => ({ n, lv: lvAt(c, term, n), r: B.ibTerm(lvAt(c, term, n), crit, bounds) })), graded = terms.filter(k => k.r.grade != null);
  const miss = icols.flatMap(k => who.filter(n => (k.cells.get(n) || {}).st === 'missing')), most = Math.max(1, ...[1, 2, 3, 4, 5, 6, 7].map(g => graded.filter(k => k.r.grade === g).length));
  const yr = B.ibCols(c, all);
  return <Sheet open wide title={t('class.charts')} onClose={onClose}>
    <div class="cp-charts" data-charts data-myp-charts>
      <div class="cp-tiles">
        <div class="cp-tile main" data-tile="set"><span>{t('class.mc_set')}</span><b>{t('class.rp_n_of', { n: graded.length, of: who.length })}</b><small>{t('class.mc_set_say')}{left.size ? ' · ' + t('class.n_left_out', { n: left.size }) : ''}</small></div>
        <div class="cp-tile" data-tile="mid"><span>{t('class.middle_grade')}</span><b>{mid(graded.map(k => k.r.grade))}</b><small>{t('class.middle_say')}</small></div>
        {crit.map(k => <div class="cp-tile" data-tile={'lv-' + k.k}><span>{t('class.mc_crit_mid', { k: k.k })}</span><b>{mid(terms.map(r => B.ibLevel(r.lv[k.k])))}</b><small data-raw>{k.name}</small></div>)}
        <div class="cp-tile" data-tile="miss"><span>{t('class.missing_work')}</span><b>{miss.length}</b><small>{miss.length ? t('class.across_n', { n: new Set(miss).size }) : t('class.nothing_out')}</small></div>
      </div>
      <section data-chart="myp-set"><h3>{t('class.mc_levels')}</h3><Stack id="set" crit={crit} none={t('class.not_set')} valsOf={k => terms.map(r => ({ name: r.n, v: B.ibLevel(r.lv[k]) }))} /><p class="mute small">{t('class.mc_levels_say')}</p></section>
      <section data-chart="myp-last"><h3>{t('class.mc_recent')}</h3><Stack id="last" crit={crit} none={t('class.no_evidence')} valsOf={k => who.map(n => ({ name: n, v: B.ibEvidence(B.ibEvFor(icols, n, k)).last }))} /><p class="mute small">{t('class.mc_recent_say')}</p></section>
      <section data-chart="myp-grades"><h3>{t('class.mc_grades')}</h3>
        <div class="cp-bands" data-myp-grades>{[7, 6, 5, 4, 3, 2, 1].map(g => { const l = graded.filter(k => k.r.grade === g); return <div class="cp-band" title={l.map(k => k.n).join(', ')} data-raw><span>{t('class.mc_grade_n', { g })}</span><div class="bar"><i style={{ width: l.length / most * 100 + '%' }} /></div><b class="num">{l.length}</b></div>; })}</div>
        <p class="mute small">{t('class.mc_grades_say')}</p></section>
      <section data-chart="myp-tasks"><h3>{t('class.mc_tasks')}</h3>
        {icols.length ? <div class="cp-heatw"><table class="cp-ibtasks" data-myp-tasks><thead><tr><th>{t('class.mc_task')}</th>{crit.map(k => <th title={k.name} data-raw>{k.k}</th>)}<th>{t('class.mc_marked')}</th></tr></thead>
          <tbody>{icols.map(k => <tr class={k.fm ? 'fm' : ''}><th scope="row"><span data-raw>{k.name}</span> <small class="mute">{B.bkDay(k.due)}{k.fm ? ' · ' + t('class.formative') : ''}</small></th>
            {crit.map(q => { if (!k.crit.includes(q.k)) return <td class="mute">·</td>; const v = who.map(n => (k.cells.get(n) || { lv: {} }).lv[q.k]).filter(v => v != null).sort((a, b) => a - b);
              return <td class="num" title={v.length ? v[0] + '–' + v[v.length - 1] : ''}>{v.length ? <>{mid(v)} <small class="mute">{v[0]}–{v[v.length - 1]}</small></> : '–'}</td>; })}
            <td class="num">{t('class.rp_n_of', { n: who.filter(n => k.cells.has(n) && Object.keys(k.cells.get(n).lv || {}).length).length, of: who.length })}</td></tr>)}</tbody></table></div>
          : <p class="mute">{t('class.mc_no_task')}</p>}
        <p class="mute small">{t('class.mc_tasks_say')}</p></section>
      <section data-chart="myp-often"><h3>{t('class.mc_often')}</h3>
        <div class="cp-bands" data-myp-often>{crit.map(k => { const s = yr.filter(y => !y.fm && y.crit.includes(k.k)).length, f = yr.filter(y => y.fm && y.crit.includes(k.k)).length;
          return <div class="cp-band"><span data-raw><b>{k.k}</b> {k.name}</span><span>{t('class.mc_n_tasks', { n: s })}{f ? ' ' + t('class.mc_plus_fm', { n: f }) : ''}</span>{s < 2 ? <b class="warn">{t('class.mc_fewer')}</b> : <span />}</div>; })}</div>
        <p class="mute small">{t('class.crit_twice')}</p></section>
      <p class="mute small">{t('class.mc_foot')}</p>
    </div>
  </Sheet>;
}
