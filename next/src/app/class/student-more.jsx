// The rest of one student's page (src/book.js bkOneView, src/classpage.js bkStrip, bkBandLine, bkStuRows), loaded with the page
// only when a student is shown: each counted type's average against the class's with how many counted, formative feedback given,
// every assignment of the term as one block (scored in its range, missing, late, excused, feedback), the student's scores over the
// class's middle half, and their rubric rows across the summatives against the class. Every number from the lifted engine.
import { h, Fragment } from 'preact';
import { t } from '../../i18n/t.js';
import { engine as B } from '../../students/book.js';
import { fmtNum, roundPct } from '../../engines/gcore.js';
import { pct } from './grades.jsx';
import { BandLine } from './sheets.jsx';
import './lines.js';

const BANDS = [[0, 59], [60, 69], [70, 79], [80, 89], [90, 100]];
const one = v => fmtNum(Math.round(v * 10) / 10);

export function StudentMore({ c, n, cols, conf, labelOf, inn, whole }) {
  const all = c.names.filter(inn).map(k => B.bkGrade(k, cols, conf)), r = B.bkGrade(n, cols, conf);
  const cavg = id => { const ps = all.map(g => (id ? g.by[id] : g.grade)).filter(v => v != null); return ps.length ? B.bkMean(ps) : null; };
  const fm = cols.filter(k => k.type === 'fm');
  const bars = B.bkCountTypes(conf).map(([id]) => ({ id, v: r.by[id], ref: cavg(id), n: cols.filter(k => k.type === id && B.bkCounts(k.cells.get(n))).length, of: cols.filter(k => k.type === id).length }));
  return <>
    <section class="sp-sec" aria-labelledby="h-bytype" data-stu-types><h3 id="h-bytype">{t('class.st_by_type')}</h3>
      <div class="cp-bands">{bars.map(b => <div class="cp-band stbar" data-stu-type={b.id}><span>{labelOf(b.id)}</span>
        <div class="bar"><i style={{ width: Math.min(100, b.v || 0) + '%' }} />{b.ref != null && <em style={{ left: Math.min(100, b.ref) + '%' }} title={t('class.st_class_avg', { v: pct(b.ref) })} />}</div>
        <b class="num">{b.v != null ? pct(b.v) : '–'}</b><small class="mute">{[t('class.pss_counted', { n: b.n, of: b.of }), b.ref != null ? t('class.st_class_avg', { v: pct(b.ref) }) : ''].filter(Boolean).join(' · ')}</small></div>)}
        {fm.length > 0 && <div class="cp-band stbar" data-stu-fb><span>{t('class.pss_feedback')}</span><div class="bar"><i style={{ width: fm.filter(k => (k.cells.get(n) || {}).fb).length / fm.length * 100 + '%' }} /></div>
          <b class="num">{t('class.rp_n_of', { n: fm.filter(k => (k.cells.get(n) || {}).fb).length, of: fm.length })}</b><small class="mute">{t('class.pss_formative')}</small></div>}</div>
    </section>
    <Strip c={c} n={n} cols={cols} labelOf={labelOf} whole={whole} conf={conf} />
    <section class="sp-sec" aria-labelledby="h-against" data-stu-line><h3 id="h-against">{t('class.st_against')}</h3>
      <BandLine c={c} sc={B.bkScored(cols)} n={n} band inn={inn} /><p class="mute small">{t('class.st_against_say')}</p></section>
    <Rows c={c} n={n} cols={cols} inn={inn} />
  </>;
}

// Every assignment in date order, each as one block (src/classpage.js bkStrip).
function Strip({ c, n, cols: all, labelOf, whole, conf }) {
  const cols = all.filter(k => k.type !== 'xc' || k.cells.get(n));
  if (!cols.length) return null;
  const block = col => {
    const cell = col.cells.get(n);
    if (col.type === 'xc') return ['xc', t('class.st_xc', { n: fmtNum(cell.xc) })];
    if (cell && cell.st === 'missing') return ['miss', t('class.missing')];
    if (cell && cell.st === 'excused') return ['exc', t('class.excused')];
    if (col.type === 'fm') return ['fm', cell && cell.fb ? t('class.fb_given') : cell && cell.started ? t('class.started') : t('class.st_no_fb')];
    if (cell && cell.pct != null) return [B.bkCounts(cell) ? 'b' + band(cell.pct) : 'nc', cell.pct + '%' + (cell.partial ? ' · ' + t('class.partial') : cell.out ? ' · ' + t('class.left_out') : cell.st === 'late' ? ' · ' + t('class.late') : '')];
    return ['none', t('class.st_not_scored')];
  };
  return <section class="sp-sec" aria-labelledby="h-strip" data-stu-strip><h3 id="h-strip">{t(whole || !conf.terms.length ? 'class.st_year' : 'class.st_term')}</h3>
    <div class="ststrip">{cols.map(col => { const [k, say] = block(col), cell = col.cells.get(n);
      return <div class="stsi" data-strip={col.key}><span class={'stc ' + k} title={cell && cell.total != null ? fmtNum(cell.total) + ' / ' + fmtNum(cell.max) : undefined}>{say}</span>
        <b data-raw>{col.name}</b><small class="mute">{[labelOf(col.type), col.due ? B.bkDay(col.due) : ''].filter(Boolean).join(' · ')}</small></div>; })}</div>
    <div class="stleg">{BANDS.map(([lo, hi], i) => <span><i class={'stc b' + (i + 1)} />{lo ? t('class.band', { lo, hi }) : t('class.band_low')}</span>)}<span><i class="stc miss" />{t('class.missing')}</span><span><i class="stc fm" />{t('class.type_fm')}</span></div>
  </section>;
}
const band = p => { const v = roundPct(p); return v >= 90 ? 5 : v >= 80 ? 4 : v >= 70 ? 3 : v >= 60 ? 2 : 1; };

// Their average on each rubric row across the summatives, the class average as a tick (src/classpage.js bkStuRows).
function Rows({ c, n, cols, inn }) {
  const fold = per => { const m = new Map(); for (const p of per) for (const [k, e] of p.by) { if (!m.has(k)) m.set(k, { name: e.name, v: [] }); m.get(k).v.push(...e.v); } return m; };
  const cls = { ...c, names: c.names.filter(inn) };
  const mine = fold(B.chRowAvgs(c, cols, n)), them = fold(B.chRowAvgs(cls, cols)), T = B.chRowTop(B.chSums(cols));
  return <section class="sp-sec" aria-labelledby="h-rows" data-stu-rows><h3 id="h-rows">{t('class.st_rows')}</h3>
    {!mine.size ? <p class="mute">{t('class.st_rows_none')}</p>
      : <div class="cp-bands">{[...mine].map(([k, e]) => { const v = B.bkMean(e.v), cv = them.has(k) ? B.bkMean(them.get(k).v) : null;
        return <div class="cp-band stbar" data-stu-row={e.name}><span data-raw title={e.name}>{e.name}</span>
          <div class="bar"><i style={{ width: Math.min(100, v / T * 100) + '%' }} />{cv != null && <em style={{ left: Math.min(100, cv / T * 100) + '%' }} />}</div>
          <b class="num">{one(v)}</b><small class="mute">{cv != null ? t('class.st_class_n', { v: one(cv) }) : ''}</small></div>; })}</div>}
    {mine.size > 0 && <p class="mute small">{t('class.st_rows_say', { n: T })}</p>}
  </section>;
}
