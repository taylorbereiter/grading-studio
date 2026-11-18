// Charts for a class (src/book.js bkClassView, src/classpage.js bkHeat), drawn as the design draws them: a sheet from under the
// gradebook with the class's numbers at the top, every student and every assignment shaded by score, where the term grades
// landed, each assignment's class average, and the other classes beside this one. Every number from the lifted engine.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Sheet } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine as B, classCols } from '../../students/book.js';
import { roundPct } from '../../engines/gcore.js';
import { pct } from './grades.jsx';
import './lines.js';

const BANDS = [[90, 100], [80, 89], [70, 79], [60, 69], [0, 59]];
const middle = v => { const s = v.slice().sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

export function ChartsSheet({ x, cols, all, term, left, labelOf, onClose }) {
  const { c, conf, lib } = x;
  const [sort, setSort] = useState({ k: 'grade', dir: -1 });
  const rows = c.names.map((n, i) => ({ n, i, r: B.bkGrade(n, cols, conf) })), inn = rows.filter(r => !left.has(r.n));
  const gl = inn.filter(r => r.r.grade != null).map(r => r.r.grade), avg = gl.length ? B.bkMean(gl) : null, mid = middle(gl);
  const typeAvg = id => { const ps = inn.map(r => r.r.by[id]).filter(v => v != null); return ps.length ? pct(B.bkMean(ps)) : '–'; };
  const miss = cols.flatMap(col => c.names.filter(n => (col.cells.get(n) || {}).st === 'missing'));
  const heat = cols.filter(k => k.type !== 'xc');
  const scored = cols.filter(k => k.type !== 'fm' && k.type !== 'xc' && B.bkIsType(k.type));
  const colAvg = col => { const ps = c.names.filter(n => !left.has(n)).map(n => col.cells.get(n)).filter(B.bkCounts).map(k => k.pct); return ps.length ? B.bkMean(ps) : null; };
  const valOf = row => {
    if (sort.k === 'name') return row.i; if (sort.k === 'grade') return row.r.grade;
    const col = heat.find(k => k.key === sort.k), cell = col && col.cells.get(row.n);
    return !col ? null : col.type === 'fm' ? (cell && cell.fb ? 1 : 0) : B.bkCounts(cell) ? cell.pct : null;
  };
  const sorted = rows.slice().sort((a, b) => { const p = valOf(a), q = valOf(b); return p == null || q == null ? (p == null ? 1 : 0) - (q == null ? 1 : 0) || a.i - b.i : (p - q) * sort.dir || a.i - b.i; });
  const sortBy = k => setSort(sort.k === k ? { k, dir: -sort.dir } : { k, dir: k === 'name' ? 1 : -1 });
  const aria = k => (sort.k === k ? (sort.dir < 0 ? 'descending' : 'ascending') : undefined);
  const others = lib.classes.filter(k => k.names.length).map(k => { const kc = classCols(lib, k, all).filter(y => term === '*' || y.termId === term), gs = k.names.map(n => B.bkGrade(n, kc, conf).grade).filter(v => v != null); return { k, v: gs.length ? B.bkMean(gs) : null }; }).filter(o => o.v != null);
  const counts = BANDS.map(([lo, hi]) => gl.filter(v => roundPct(v) >= lo && (roundPct(v) <= hi || (lo === 90 && v > 100))).length), most = Math.max(1, ...counts);
  const bandName = ([lo, hi]) => (lo ? t('class.band', { lo, hi }) : t('class.band_low'));
  const shade = p => ({ background: 'color-mix(in oklab, var(--acc) ' + Math.round(Math.max(0, Math.min(100, p)) * 0.85) + '%, var(--s))' });
  const line = scored.map(colAvg);
  return <Sheet open wide title={t('class.charts')} onClose={onClose}>
    <div class="cp-charts" data-charts>
      <div class="cp-tiles">
        <div class="cp-tile main" data-tile="avg"><span>{t(term === '*' ? 'class.avg_grade' : 'class.term_avg')}</span><b>{avg != null ? pct(avg) : '–'}</b><small>{t('class.n_students', { n: gl.length })}{left.size ? ' · ' + t('class.n_left_out', { n: left.size }) : ''}</small></div>
        <div class="cp-tile" data-tile="mid"><span>{t('class.middle_grade')}</span><b>{mid != null ? pct(mid) : '–'}</b><small>{t('class.middle_say')}</small></div>
        {B.bkCountTypes(conf).map(([id]) => <div class="cp-tile"><span>{t('class.type_avg', { type: labelOf(id) })}</span><b>{typeAvg(id)}</b><small>{t('class.n_asg', { n: cols.filter(k => k.type === id).length })}</small></div>)}
        <div class="cp-tile" data-tile="miss"><span>{t('class.missing_work')}</span><b>{miss.length}</b><small>{miss.length ? t('class.across_n', { n: new Set(miss).size }) : t('class.nothing_out')}</small></div>
      </div>
      {heat.length > 0 && <section><h3>{t('class.heat_t')}</h3><p class="mute small">{t('class.heat_say')}</p>
        <div class="cp-heatw"><table class="cp-heat" data-heat>
          <thead><tr><th aria-sort={aria('name')}><button type="button" class="colbtn" onClick={() => sortBy('name')}>{t('class.student')}</button></th>
            {heat.map(col => <th aria-sort={aria(col.key)}><button type="button" class="colbtn v" title={col.name} onClick={() => sortBy(col.key)}><span data-raw>{col.name}</span></button></th>)}
            <th aria-sort={aria('grade')}><button type="button" class="colbtn" onClick={() => sortBy('grade')}>{t(term ? 'class.term_grade' : 'class.grade')}</button></th></tr></thead>
          <tbody>{sorted.map(row => <tr class={left.has(row.n) ? 'out' : ''}><th scope="row" data-raw>{row.n}</th>
            {heat.map(col => { const cell = col.cells.get(row.n), on = col.type === 'fm' ? !!(cell && cell.fb) : B.bkCounts(cell);
              const say = !cell ? '–' : cell.st === 'missing' ? t('class.missing') : cell.st === 'excused' ? t('class.excused') : col.type === 'fm' ? (cell.fb ? t('class.fb_done') : '–') : cell.pct != null ? cell.pct + '%' : '–';
              return <td title={row.n + ': ' + say} data-raw><span class={'hc' + (cell && cell.st === 'missing' ? ' ms' : '')} style={on ? shade(col.type === 'fm' ? 100 : cell.pct) : undefined} aria-label={say} /></td>; })}
            <td class="num">{row.r.grade != null ? pct(row.r.grade) : '–'}</td></tr>)}</tbody></table></div></section>}
      {scored.length > 0 && line.some(v => v != null) && <section><h3>{t('class.each_avg')}</h3><Line cols={scored} pts={line} refv={avg} /></section>}
      <section><h3>{t(term === '*' ? 'class.grades_t' : 'class.term_grades_t')}</h3>
        <div class="cp-bands" data-bands>{BANDS.map((b, i) => <div class="cp-band"><span>{bandName(b)}</span><div class="bar"><i style={{ width: counts[i] / most * 100 + '%' }} /></div><b class="num">{counts[i]}</b></div>)}</div>
        <p class="mute small">{t('class.bands_say')}</p></section>
      <section><h3>{t('class.compare_t')}</h3>
        {others.length ? <div class="cp-bands" data-compare>{others.map(o => <div class={'cp-band' + (o.k.id === c.id ? ' me' : '')}><span data-raw>{o.k.name}</span><div class="bar"><i style={{ width: Math.min(100, o.v) + '%' }} /></div><b class="num">{pct(o.v)}</b></div>)}</div>
          : <p class="mute small">{t('class.compare_none')}</p>}
        <p class="mute small">{t('class.compare_say')}</p></section>
    </div>
  </Sheet>;
}

// Each assignment's class average in date order, with the average grade as a line across.
function Line({ cols, pts, refv }) {
  const W = 640, L = 44, R = 20, T = 14, Bm = 28, H = 190;
  const vals = pts.filter(v => v != null).concat(refv != null ? [refv] : []);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10), top = Math.max(...vals), hi = top > 100 ? Math.ceil(top / 10) * 10 : Math.min(100, Math.ceil((top + 2) / 10) * 10) || 100;
  const X = i => L + (cols.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (cols.length - 1)), Y = v => T + (hi - v) / Math.max(10, hi - lo) * (H - T - Bm);
  const grid = []; for (let v = lo; v <= hi; v += 10) grid.push(v);
  const seg = []; let run = []; pts.forEach((v, i) => { if (v == null) { if (run.length) seg.push(run); run = []; } else run.push(X(i) + ',' + Y(v)); }); if (run.length) seg.push(run);
  return <svg class="cp-line" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={cols.map((k, i) => k.name + ' ' + (pts[i] != null ? pct(pts[i]) : '–')).join(', ')} data-raw>
    {grid.map(v => <><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} class="g" /><text x={L - 8} y={Y(v) + 4} text-anchor="end" class="tk">{v}%</text></>)}
    {refv != null && <line x1={L} x2={W - R} y1={Y(refv)} y2={Y(refv)} class="ref" />}
    {seg.map(r => <polyline points={r.join(' ')} class="ln" />)}
    {pts.map((v, i) => v != null && <circle cx={X(i)} cy={Y(v)} r="4.5" class="dot"><title>{cols[i].name + ': ' + pct(v)}</title></circle>)}
    {cols.map((k, i) => <text x={X(i)} y={H - 8} text-anchor="middle" class="tk">{k.due ? B.bkDay(k.due) : ''}</text>)}
  </svg>;
}
