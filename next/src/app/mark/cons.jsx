// Insights > Consistency (src/insight.js openCons, openSame): did her scores drift as she went? The reading is the current app's own
// (engines/ginsight.js consData, driftRead, rowDrifts: the scores in the order she gave them, the first third against the last,
// and how often a shuffle of the same scores makes a gap that big), so both apps say the same thing about the same work. The words,
// the chart, the list and the same-score papers side by side are drawn here. Nothing here changes saved work. Loaded on its own
// (router.js PARTS.cons).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { Button } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { state, maxPoints, fmtNum, pdfjsLib } from '../../engines/gcore.js';
import { shownName, anonOn, anonRx, scrub, fileByPath } from '../../engines/gdraw.js';
import * as I from '../../engines/ginsight.js';
import './paper-lines.js';

// The gap in words is the gap between the two rounded numbers said beside it, so they always add up (src/insight.js roughGap).
const gapOf = (r, max) => Math.abs(+I.roughly(r.early, max) - +I.roughly(r.late, max)) || I.roughStep(max);
const when = ms => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Say({ r, max }) {
  if (r.level === 'few') return <p class="cs-say" data-csay="few"><b>{t('paper.cs_few_h')}</b> {r.n ? t('paper.cs_few_n', { n: r.n }) : t('paper.cs_few_none')} {t('paper.cs_few_min', { n: I.DRIFT_MIN })}</p>;
  const nums = t('paper.cs_nums', { k: r.third, a: I.roughly(r.early, max), b: I.roughly(r.late, max), max: fmtNum(max) });
  if (r.level === 'none') return <p class="cs-say" data-csay="none"><b>{t('paper.cs_none_h')}</b> {nums} {r.n < I.DRIFT_SURE ? t('paper.cs_none_few', { n: r.n }) : t('paper.cs_none_chance')}</p>;
  const lower = r.gap < 0, way = t(lower ? 'paper.cs_lower' : 'paper.cs_higher', { n: fmtNum(gapOf(r, max)) }), why = t(lower ? 'paper.cs_why_lower' : 'paper.cs_why_higher');
  if (r.level === 'hint') return <p class="cs-say" data-csay="hint"><b>{t('paper.cs_hint_h')}</b> {way} {nums} {t('paper.cs_hint', { n: r.n })} {why}</p>;
  return <p class="cs-say" data-csay="likely"><b>{t('paper.cs_likely_h')}</b> {way} {nums} {t('paper.cs_likely', { n: r.n })} {why}</p>;
}

// One dot per paper, in the order she scored them; the two short lines are the first and last third's averages.
function Chart({ pts, read, max, onOpen }) {
  const W = 640, H = 210, L = 34, R = 14, T = 18, B = 26, n = pts.length, vs = pts.map(p => p.v), b = state().batch;
  const hi = Math.max(max, ...vs), lo = Math.max(0, Math.floor(Math.min(...vs)) - 1), span = Math.max(1, hi - lo), step = span <= 6 ? 1 : span <= 14 ? 2 : span <= 40 ? 5 : 10;
  const x = i => n >= 2 ? L + 12 + i * (W - L - R - 24) / (n - 1) : (L + W - R) / 2, y = v => T + (hi - v) * (H - T - B) / span;
  const grid = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(v);
  const seg = (a, z, v, end) => <><line class="dmean" x1={x(a) - 8} x2={x(z) + 8} y1={y(v)} y2={y(v)} /><text class="dlab" x={end ? x(z) + 8 : x(a) - 8} y={y(v) - 10} text-anchor={end ? 'end' : 'start'}>{t('paper.cs_about', { v: I.roughly(v, max) })}</text></>;
  return <div class="cs-chart"><svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('paper.cs_chart')}>
    {grid.map(v => <><line class="dgrid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text class="dax" x={L - 8} y={y(v) + 4} text-anchor="end">{fmtNum(v)}</text></>)}
    <text class="dax" x={L} y={H - 6}>{t('paper.cs_first')}</text><text class="dax" x={W - R} y={H - 6} text-anchor="end">{t('paper.cs_last')}</text>
    {read.level !== 'few' && <>{seg(0, read.third - 1, read.early)}{seg(n - read.third, n - 1, read.late, true)}</>}
    {pts.map((p, k) => {
      const label = t('paper.cs_dot', { who: shownName(b.students[p.i], p.i), v: fmtNum(p.v), max: fmtNum(max), k: k + 1, n });
      const go = e => { if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(p.i); } };
      return <g class="dpt"><circle class="dhit" cx={x(k)} cy={y(p.v)} r="12" tabindex="0" role="button" aria-label={label} data-csdot={p.i} onClick={go} onKeyDown={go}><title>{label}</title></circle><circle class="ddot" cx={x(k)} cy={y(p.v)} r="4.5" /></g>;
    })}
  </svg></div>;
}

function Rows({ rows }) {
  if (state().setup.mode !== 'rubric' || rows.length < 2) return null;
  if (!rows.some(x => x.read.n >= I.DRIFT_SURE)) return <p class="mute hsm">{t('paper.cs_rows_few', { n: I.DRIFT_SURE })}</p>;
  return <ul class="cs-rows">{rows.map(({ name, top, read: r }) => <li><b data-raw>{name}</b>{': '}{r.n < I.DRIFT_SURE ? t('paper.cs_row_few') : r.level === 'none' ? t('paper.cs_row_none') : t(r.gap < 0 ? 'paper.cs_row_lower' : 'paper.cs_row_higher', { n: fmtNum(gapOf(r, top || 4)) })}</li>)}</ul>;
}

export function Consistency({ E, onOpen }) {
  const [same, setSame] = useState(null), [, tick] = useState(0);
  const d = useMemo(() => {
    const c = I.consData(), max = maxPoints();
    return { ...c, max, read: I.driftRead(c.pts.map(p => p.v), max), rows: I.rowDrifts() };
  }, [same]);
  if (same != null) return <Same v={same} E={E} onOpen={onOpen} onBack={() => { setSame(null); tick(n => n + 1); }} />;
  const b = state().batch, { pts, noTime, off, groups, max, read } = d;
  const left = [noTime.length ? t('paper.cs_no_time', { n: noTime.length }) : '', off.length ? t('paper.cs_at_once', { n: off.length }) : ''].filter(Boolean);
  const pairs = [...groups].filter(([, l]) => l.length > 1).sort((a, z) => parseFloat(z[0]) - parseFloat(a[0])), single = groups.size - pairs.length;
  return <div class="cs" data-cons>
    <h3 class="t4">{t('paper.cs_h_drift')}</h3>
    <Say r={read} max={max} />
    {pts.length > 0 && <><Chart pts={pts} read={read} max={max} onOpen={onOpen} /><Rows rows={d.rows} /></>}
    <p class="mute hsm">{t('paper.cs_foot')}{left.length ? ' ' + t('paper.cs_left', { list: left.join('; ') }) : ''}</p>
    {pts.length > 0 && <details class="cs-list"><summary>{t('paper.cs_list')}</summary>
      <div class="tbl"><table><thead><tr><th>{t('paper.cs_order')}</th><th>{t(anonOn() ? 'paper.cs_paper' : 'paper.cs_student')}</th><th>{t('paper.cs_score')}</th><th>{t('paper.cs_scored')}</th></tr></thead>
        <tbody>{pts.map((p, k) => <tr><td class="n num">{k + 1}</td><td><button type="button" class="link" onClick={() => onOpen(p.i)} data-raw>{shownName(b.students[p.i], p.i)}</button></td><td class="num">{fmtNum(p.v)} / {fmtNum(max)}</td><td>{when(p.t)}</td></tr>)}</tbody></table></div></details>}
    <h3 class="t4">{t('paper.cs_h_same')}</h3>
    {pairs.length ? <><p class="mute hsm">{t('paper.cs_pick')}{single ? ' ' + t('paper.cs_single') : ''}</p>
      <div class="cs-chips">{pairs.map(([v, l]) => <Button size="sm" onClick={() => setSame(v)} data-cssame={String(v)}><b class="num">{I.sameLabel(v)}</b>&nbsp;{t('paper.cs_n_papers', { n: l.length })}</Button>)}</div></>
      : <p class="mute hsm">{t('paper.cs_none_same')}</p>}
  </div>;
}

// One column per paper, each turning its own pages, drawn as an assistant would see them (names covered in anonymous grading).
function Same({ v, E, onOpen, onBack }) {
  const b = state().batch, su = state().setup, list = I.consData().groups.get(v) || [];
  const back = useRef(null);
  useEffect(() => { if (back.current) back.current.focus(); }, []);
  return <div class="cs cs-same" data-cssameview>
    <div class="cs-sh"><h3 class="t4">{t('paper.cs_same_h', { v: typeof v === 'number' ? fmtNum(v) + ' / ' + fmtNum(maxPoints()) : I.sameLabel(v) })}</h3>
      <span class="mute">{t('paper.cs_n_papers', { n: list.length })}</span>
      <button type="button" class="btn sm" ref={back} onClick={onBack} data-csback>{t('paper.cs_back')}</button></div>
    <div class="cs-cols">{list.map(i => {
      const st = b.students[i], g = st.grade, rx = anonOn() ? anonRx(st) : null;
      const rows = su.mode === 'rubric' ? su.criteria.map((c, r) => g.rubric[r] == null ? '' : c + ' ' + fmtNum(g.rubric[r])).filter(Boolean).join(' · ') : '';
      const cm = (g.comment || '').trim();
      return <div class="cs-col" data-cscol={i}>
        <div class="cs-ch"><button type="button" class="link" onClick={() => onOpen(i)}><b data-raw>{shownName(st, i)}</b></button>
          {rows && <div class="mute hsm" data-raw>{rows}</div>}
          {cm && <div class="cs-cm" data-raw>{rx ? scrub(cm, rx) : cm}</div>}</div>
        <Pages st={st} rx={rx} E={E} />
      </div>;
    })}</div>
  </div>;
}

function Pages({ st, rx, E }) {
  const pages = useMemo(() => E.X.shareDocs(st).flatMap(d => d.pages), [st]);
  const [at, setAt] = useState(0), [bad, setBad] = useState(false), spot = useRef(null);
  useEffect(() => {
    if (!pages.length || !spot.current) return;
    let live = true, js = null; setBad(false);
    (async () => {
      try {
        await E.load();
        const [path, p] = pages[at], f = fileByPath(st, path);
        js = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
        if (!live || !spot.current) return;   // Back pressed while the file was opening
        const w = spot.current.clientWidth || 380, dpr = window.devicePixelRatio || 1;
        const pg = await js.getPage(p + 1), v1 = pg.getViewport({ scale: 1 }), k = Math.min(1.6, w / v1.width);
        const r = await E.X.sharePage(st, f, js, p, k * dpr, rx);
        if (!live || !spot.current) return;
        Object.assign(r.c.style, { width: '100%', height: 'auto', display: 'block', background: '#fff' });
        spot.current.replaceChildren(r.c);
      } catch (e) { if (live) { console.error(e); setBad(true); } }
      finally { if (js) js.destroy(); }
    })();
    return () => { live = false; };
  }, [at, pages]);
  if (!pages.length) return <p class="mute hsm">{t(st.files.length ? 'paper.cs_no_pdf' : 'paper.cs_no_paper')}</p>;
  return <>
    <div class="cs-nav"><button type="button" class="btn sm" aria-label={t('paper.cs_prev')} disabled={at === 0} onClick={() => setAt(at - 1)}>‹</button>
      <span class="mute">{t('paper.cs_page', { a: at + 1, b: pages.length })}</span>
      <button type="button" class="btn sm" aria-label={t('paper.cs_next')} disabled={at === pages.length - 1} onClick={() => setAt(at + 1)} data-csnext>›</button></div>
    {bad ? <p class="mute hsm">{t('paper.cs_cant')}</p> : <div class="cs-pg" ref={spot} data-cspage />}
  </>;
}
