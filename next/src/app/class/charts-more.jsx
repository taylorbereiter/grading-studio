// The rest of the class charts (src/classpage.js bkMoving, bkStacks, bkRubricRows, bkScatter; src/book.js bkSpread), loaded when
// the charts sheet opens: who is moving, where the class stands assignment by assignment, the rubric rows across the summatives,
// summatives against in-class work, and the spread on each assignment. Every number from the lifted engine, as the current app works it out.
import { h, Fragment } from 'preact';
import { t } from '../../i18n/t.js';
import { engine as B } from '../../students/book.js';
import { fmtNum, roundPct } from '../../engines/gcore.js';
import { pct } from './grades.jsx';
import './lines.js';

const W = 640;
const band = p => { const v = roundPct(p); return v >= 90 ? 5 : v >= 80 ? 4 : v >= 70 ? 3 : v >= 60 ? 2 : 1; };
const BANDS = ['class.band_low', [60, 69], [70, 79], [80, 89], [90, 100]];
const bandName = i => (i ? t('class.band', { lo: BANDS[i][0], hi: BANDS[i][1] }) : t('class.band_low'));
const q = (v, f) => { const k = (v.length - 1) * f, i = Math.floor(k); return v[i] + (v[Math.ceil(k)] - v[i]) * (k - i); };
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const one = v => fmtNum(Math.round(v * 10) / 10);
const Sec = ({ id, title, say, children }) => <section data-chart={id}><h3>{title}</h3>{children}{say && <p class="mute small">{say}</p>}</section>;

export function MoreCharts({ c, cols, conf, labelOf, inn, whole }) {
  const sc = B.bkScored(cols), names = c.names.filter(inn);
  return <>
    <Sec id="move" title={t('class.mv_t')} say={t('class.mv_say')}><Moving names={names} sc={sc} whole={whole} /></Sec>
    <Sec id="stacks" title={t('class.sk_t')} say={t('class.sk_say')}><Stacks names={names} sc={sc} /></Sec>
    <Rows c={c} names={names} cols={cols} />
    {B.bkIsType('sum') && B.bkIsType('ic') && <Sec id="scatter" title={t('class.sx_t', { a: labelOf('sum'), b: labelOf('ic') })} say={t('class.sx_say', { a: labelOf('sum'), b: labelOf('ic') })}>
      <Scatter names={names} cols={cols} conf={conf} labelOf={labelOf} /></Sec>}
    <Sec id="spread" title={t('class.sp_t')} say={t('class.sp_say')}><Spread names={names} sc={sc} /></Sec>
  </>;
}

// Each student's last three scores against their earlier ones: the five biggest rises and drops.
function Moving({ names, sc, whole }) {
  const list = [];
  for (const n of names) { const v = sc.map(col => col.cells.get(n)).filter(B.bkCounts).map(k => k.pct); if (v.length < 4) continue; const a = B.bkMean(v.slice(-3)), b = B.bkMean(v.slice(0, -3)); list.push({ n, d: Math.round((a - b) * 10) / 10, a, b }); }
  if (!list.length) return <p class="mute" data-move-none>{t(whole ? 'class.mv_none_year' : 'class.mv_none')}</p>;
  list.sort((x, y) => y.d - x.d);
  const up = list.filter(x => x.d > 0).slice(0, 5), down = list.filter(x => 0 > x.d).slice(-5), both = up.concat(down);
  if (!both.length) return <p class="mute" data-move-none>{t('class.mv_flat')}</p>;
  const m = Math.max(5, Math.ceil(Math.max(...both.map(x => Math.abs(x.d))) / 5) * 5), step = m > 30 ? 10 : 5, L = 150, P = 48, rh = 28, gap = up.length && down.length ? 10 : 0, H = both.length * rh + gap + 30;
  const X = v => L + P + (v + m) / (2 * m) * (W - L - 2 * P), ticks = []; for (let v = -m; v <= m; v += step) ticks.push(v);
  const say = d => (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1);
  return <><svg class="cp-line cp-ch" viewBox={'0 0 ' + W + ' ' + H} role="img" data-raw aria-label={both.map(x => x.n + ' ' + say(x.d)).join(', ')} data-move>
    {ticks.map(v => <>{v !== 0 && <line x1={X(v)} x2={X(v)} y1="0" y2={H - 24} class="g" />}<text x={X(v)} y={H - 8} text-anchor="middle" class="tk">{(v > 0 ? '+' : 0 > v ? '−' : '') + Math.abs(v)}</text></>)}
    {both.map((x, k) => { const y = k * rh + (k >= up.length ? gap : 0) + 4, x0 = X(0), far = Math.abs(X(x.d) - x0) < 5 ? x0 + (x.d > 0 ? 5 : -5) : X(x.d);
      return <g data-move-row={x.d > 0 ? 'up' : 'down'}><text x="0" y={y + 13} class="tk lb">{cut(x.n, 22)}</text>
        <rect x={Math.min(x0, far)} y={y} width={Math.abs(far - x0)} height="18" rx="4" class={'mv ' + (x.d > 0 ? 'up' : 'down')}><title>{x.n + ': ' + say(x.d) + ' · ' + t('class.mv_tip', { a: pct(x.a), b: pct(x.b) })}</title></rect>
        <text x={far + (x.d > 0 ? 6 : -6)} y={y + 13} text-anchor={x.d > 0 ? 'start' : 'end'} class="tk me">{say(x.d)}</text></g>; })}
    <line x1={X(0)} x2={X(0)} y1="0" y2={H - 24} class="zero" /></svg>
    <div class="chleg"><span><i class="mv up" />{t('class.mv_up')}</span><span><i class="mv down" />{t('class.mv_down')}</span></div></>;
}

// How many students landed in each range, assignment by assignment.
function Stacks({ names, sc }) {
  const cols = sc.map(col => { const by = [[], [], [], [], []]; for (const n of names) { const cell = col.cells.get(n); if (B.bkCounts(cell)) by[band(cell.pct) - 1].push(n); } return { col, by, n: by.reduce((a, b) => a + b.length, 0) }; }).filter(x => x.n);
  if (!cols.length) return <p class="mute">{t('class.ch_none')}</p>;
  const most = Math.max(...cols.map(x => x.n)), tick = most <= 6 ? 1 : most <= 12 ? 2 : most <= 20 ? 5 : most <= 40 ? 10 : 20, top = Math.ceil(most / tick) * tick;
  const L = 34, R = 6, T = 8, PH = 190, H = T + PH + 40, step = (W - L - R) / cols.length, bw = Math.max(8, Math.min(52, step * 0.62)), Y = v => T + PH - v / top * PH, ticks = []; for (let v = 0; v <= top; v += tick) ticks.push(v);
  return <><svg class="cp-line cp-ch" viewBox={'0 0 ' + W + ' ' + H} role="img" data-raw aria-label={cols.map(x => x.col.name + ': ' + x.by.map((b, i) => (b.length ? b.length + ' ' + bandName(i) : '')).filter(Boolean).join(', ')).join('. ')} data-stacks>
    {ticks.map(v => <><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} class="g" /><text x={L - 8} y={Y(v) + 4} text-anchor="end" class="tk">{v}</text></>)}
    {cols.map((x, i) => { const cx = L + step * (i + 0.5); let acc = 0;
      return <g data-stack={x.col.key}>{x.by.map((who, b) => { if (!who.length) return null; const y0 = Y(acc), y1 = Y(acc + who.length), hh = Math.max(2, y0 - y1 - 2); acc += who.length;
        return <rect x={cx - bw / 2} y={y0 - 1 - hh} width={bw} height={hh} rx="2" class={'sk b' + (b + 1)} data-n={who.length}><title>{bandName(b) + ' · ' + x.col.name + ': ' + who.join(', ')}</title></rect>; })}
        <text x={cx} y={T + PH + 16} text-anchor="middle" class="tk lb">{cut(x.col.name, Math.max(4, Math.floor(step / 6.6)))}</text>
        <text x={cx} y={H - 6} text-anchor="middle" class="tk">{x.col.due ? B.bkDay(x.col.due) : ''}</text></g>; })}</svg>
    <div class="chleg">{[4, 3, 2, 1, 0].map(i => <span><i class={'sk b' + (i + 1)} />{bandName(i)}</span>)}</div></>;
}

// The class average on each rubric row, wherever the same row name comes back across the summatives; the lowest row stands out.
function Rows({ c, names, cols }) {
  const per = B.chRowAvgs({ ...c, names }, cols), hi = B.chRowTop(B.chSums(cols));
  if (!per.length) return <Sec id="rows" title={t('class.rr_t')}><p class="mute">{t('class.rr_none')}</p></Sec>;
  const keys = []; for (const p of per) for (const k of p.by.keys()) if (!keys.includes(k)) keys.push(k);
  const series = keys.map(k => { const pts = per.map(p => (p.by.has(k) ? B.bkMean(p.by.get(k).v) : null)), have = pts.filter(v => v != null); return { k, name: per.find(p => p.by.has(k)).by.get(k).name, pts, mean: B.bkMean(have), last: have[have.length - 1] }; });
  const low = series.reduce((a, b) => (b.mean < a.mean ? b : a)), vals = series.flatMap(x => x.pts).filter(v => v != null);
  const lo = Math.max(0, Math.min(hi - 1, Math.floor(Math.min(...vals) - 0.25))), tick = hi - lo > 2 ? 1 : 0.5, n = per.length;
  const L = 34, R = 176, T = 12, Bm = 44, H = 250, X = i => (n === 1 ? L + (W - L - R) / 2 : L + 20 + i * (W - L - R - 40) / (n - 1)), Y = v => T + (hi - v) / (hi - lo) * (H - T - Bm);
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += tick) ticks.push(v);
  const labs = series.map(x => ({ x, y: Y(x.last) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 15) labs[i].y = labs[i - 1].y + 15;
  const over = labs.length ? labs[labs.length - 1].y - (H - Bm + 6) : 0; if (over > 0) for (const l of labs) l.y -= over;
  const segs = x => { const out = []; let run = []; x.pts.forEach((v, i) => { if (v == null) { if (run.length) out.push(run); run = []; } else run.push(X(i) + ',' + Y(v)); }); if (run.length) out.push(run); return out; };
  return <Sec id="rows" title={t('class.rr_t')} say={t('class.rr_say', { n: hi })}>
    <svg class="cp-line cp-ch" viewBox={'0 0 ' + W + ' ' + H} role="img" data-raw aria-label={series.map(x => x.name + ': ' + x.pts.map((v, i) => (v != null ? per[i].col.name + ' ' + one(v) : '')).filter(Boolean).join(', ')).join('. ')} data-rows>
      {ticks.map(v => <><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} class="g" /><text x={L - 8} y={Y(v) + 4} text-anchor="end" class="tk">{fmtNum(v)}</text></>)}
      {per.map((p, i) => <><text x={X(i)} y={H - Bm + 18} text-anchor="middle" class="tk lb">{cut(p.col.name, Math.max(8, Math.floor((W - L - R) / n / 6.6)))}</text><text x={X(i)} y={H - 6} text-anchor="middle" class="tk">{p.col.due ? B.bkDay(p.col.due) : ''}</text></>)}
      {series.filter(x => x !== low).concat([low]).map(x => <g data-row={x.name} class={x === low ? 'lo' : ''}>{segs(x).map(r => <polyline points={r.join(' ')} class="rl" />)}
        {x.pts.map((v, i) => v != null && <circle cx={X(i)} cy={Y(v)} r="4.5" class="rd"><title>{x.name + ' · ' + per[i].col.name + ': ' + t('class.rr_tip', { v: one(v), n: hi })}</title></circle>)}</g>)}
      {labs.map(l => <text x={W - R + 14} y={l.y + 4} class={'tk lb' + (l.x === low ? ' me' : '')}>{cut(l.x.name, 18) + ' ' + one(l.x.last)}</text>)}
    </svg></Sec>;
}

// One dot per student: their summative average against their in-class average, the two furthest from the line named.
function Scatter({ names, cols, conf, labelOf }) {
  const pts = names.map(n => { const r = B.bkGrade(n, cols, conf); return r.by.sum != null && r.by.ic != null ? { n, x: r.by.ic, y: r.by.sum } : null; }).filter(Boolean);
  const a = labelOf('sum'), b = labelOf('ic');
  if (pts.length < 2) return <p class="mute" data-scatter-none>{t('class.sx_none', { a, b })}</p>;
  const all = pts.flatMap(p => [p.x, p.y]), lo = Math.max(0, Math.floor((Math.min(...all) - 3) / 10) * 10), hi = Math.max(100, Math.ceil(Math.max(...all) / 10) * 10);
  const S = 480, H = Math.round(S * 0.72), L = 58, R = 16, T = 12, Bm = 46, X = v => L + (v - lo) / (hi - lo) * (S - L - R), Y = v => T + (hi - v) / (hi - lo) * (H - T - Bm), tick = hi - lo > 60 ? 20 : 10;
  const ticks = []; for (let v = lo; v <= hi; v += tick) ticks.push(v);
  const far = [...pts].sort((p, q) => Math.abs(q.y - q.x) - Math.abs(p.y - p.x)).slice(0, 2).filter(p => Math.abs(p.y - p.x) >= 8);
  return <svg class="cp-line cp-ch sq" viewBox={'0 0 ' + S + ' ' + H} role="img" data-raw aria-label={pts.map(p => p.n + ': ' + a + ' ' + pct(p.y) + ', ' + b + ' ' + pct(p.x)).join('. ')} data-scatter>
    {ticks.map(v => <><line x1={L} x2={S - R} y1={Y(v)} y2={Y(v)} class="g" /><line x1={X(v)} x2={X(v)} y1={T} y2={H - Bm} class="g" />
      <text x={L - 8} y={Y(v) + 4} text-anchor="end" class="tk">{v}%</text><text x={X(v)} y={H - Bm + 16} text-anchor="middle" class="tk">{v}%</text></>)}
    <line x1={X(lo)} y1={Y(lo)} x2={X(hi)} y2={Y(hi)} class="ref" />
    <text x={L + 8} y={T + 16} class="tk">{t('class.sx_more', { a })}</text><text x={S - R - 8} y={H - Bm - 8} text-anchor="end" class="tk">{t('class.sx_more', { a: b })}</text>
    <text x={L + (S - L - R) / 2} y={H - 6} text-anchor="middle" class="tk">{t('class.sx_axis', { a: b })}</text>
    <text transform={'translate(12 ' + (T + (H - T - Bm) / 2) + ') rotate(-90)'} text-anchor="middle" class="tk">{t('class.sx_axis', { a })}</text>
    {pts.map(p => <circle cx={X(Math.min(hi, p.x))} cy={Y(Math.min(hi, p.y))} r="5.5" class="pt" data-pt={p.n}><title>{p.n + ': ' + a + ' ' + pct(p.y) + ', ' + b + ' ' + pct(p.x)}</title></circle>)}
    {far.map(p => { const up = p.y > p.x, nm = cut(p.n, 20), w = nm.length * 6.8, left = up ? X(p.x) - 10 - w >= L + 4 : X(p.x) + 10 + w > S - R;
      return <text x={X(p.x) + (left ? -10 : 10)} y={Y(p.y) + (up ? -4 : 13)} text-anchor={left ? 'end' : 'start'} class="tk me">{nm}</text>; })}
  </svg>;
}

// Lowest to highest on each assignment, the middle half darker, a line at the middle score.
function Spread({ names, sc }) {
  const rows = sc.map(col => ({ col, v: names.map(n => col.cells.get(n)).filter(B.bkCounts).map(k => k.pct).sort((a, b) => a - b) })).filter(r => r.v.length);
  if (!rows.length) return <p class="mute">{t('class.ch_none')}</p>;
  const lo = Math.max(0, Math.floor(Math.min(...rows.map(r => r.v[0])) / 10) * 10), L = 150, R = 16, rh = 28, H = rows.length * rh + 26, x = v => L + (Math.min(100, v) - lo) / Math.max(10, 100 - lo) * (W - L - R);
  const ticks = []; for (let v = lo; v <= 100; v += 10) ticks.push(v);
  return <svg class="cp-line cp-ch" viewBox={'0 0 ' + W + ' ' + H} role="img" data-raw aria-label={rows.map(({ col, v }) => col.name + ': ' + t('class.sp_tip', { lo: v[0], hi: v[v.length - 1], a: roundPct(q(v, 0.25)), b: roundPct(q(v, 0.75)), m: roundPct(q(v, 0.5)) })).join('. ')} data-spread>
    {ticks.map(v => <><line x1={x(v)} x2={x(v)} y1="0" y2={H - 22} class="g" /><text x={x(v)} y={H - 6} text-anchor="middle" class="tk">{v}%</text></>)}
    {rows.map(({ col, v }, i) => { const y = i * rh + 6, a = q(v, 0.25), b = q(v, 0.75), m = q(v, 0.5);
      return <g data-spread-row={col.key}><text x="0" y={y + 13} class="tk lb">{cut(col.name, 20)}</text>
        <rect x={x(v[0])} y={y + 5} width={Math.max(2, x(v[v.length - 1]) - x(v[0]))} height="8" rx="4" class="rng" />
        <rect x={x(a)} y={y + 1} width={Math.max(3, x(b) - x(a))} height="16" rx="4" class="iqr"><title>{col.name + ': ' + t('class.sp_tip', { lo: v[0], hi: v[v.length - 1], a: roundPct(a), b: roundPct(b), m: roundPct(m) })}</title></rect>
        <line x1={x(m)} x2={x(m)} y1={y} y2={y + 18} class="mid" /></g>; })}
  </svg>;
}
