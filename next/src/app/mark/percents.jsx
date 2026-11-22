// Insights' Percents view and the summary's charts (src/rubrics.js pctShell, pctDraw, bandsHtml, stripHtml, spreadHtml, rowsHtml,
// src/tabs.js insRowsHtml), loaded as a part of their own (router.js PARTS.percents) when Insights opens, so Grades, Insights and
// Return keep to their size. Who counts, the middle of the class, the bands and the target are kept for each class (gs.pctView); the
// places in an average are the one setting everywhere (gs.avgDp); What if is only ever a preview and changes no score.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Card, Menu, Segmented, Tooltip, toast, HeldInput } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { state, gradeOf, maxPoints, percentFor, roundPct, fmtNum, rowTop, rowHalf, rowsTop } from '../../engines/gcore.js';
import { shownName, rosterMatch } from '../../engines/gdraw.js';
import { natural, batchClass, findItem } from '../../engines/gopen.js';
import { readBook, classCols, classIn, engine as B } from '../../students/book.js';
import { prefs } from '../../students/prefs.js';
import { copyText } from '../../services/clipboard.js';
import './lines.js';
import './setup-lines.js';
import './pct-lines.js';
import '../screens/prefs-lines.js';
import '../class/lines.js';

const TENS = [90, 80, 70, 60], FIVES = [95, 90, 85, 80, 75, 70, 65, 60];
const pct2 = v => Math.round(v * 100 + 1e-9) / 100;
const mean = a => (a.length ? pct2(a.reduce((x, y) => x + y, 0) / a.length) : null);
const med = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length; return roundPct(m % 2 ? b[(m - 1) / 2] : (b[m / 2 - 1] + b[m / 2]) / 2); };
const oneDp = v => fmtNum(Math.round(v * 10) / 10);
const avgText = (X, v) => (v == null ? '' : X.pctAvgText(v)), pctText = v => (v == null ? '' : fmtNum(v) + '%');
const names = who => who.slice(0, 12).join(', ') + (who.length > 12 ? ' ' + t('pc.more', { n: who.length - 12 }) : '');
// one tooltip for pointing and for the keyboard: the value, what it is, and who (src/rubrics.js ovTip)
const Tip = ({ v, l, n, children }) => <Tooltip text={<><b>{v}</b> <span>{l}</span>{n && <em data-raw>{n}</em>}</>}>{children}</Tooltip>;

// Who counts and how, for this class (pvLoad, pvSet): read from storage each time, and written back as it is now with this one change.
const VIEW0 = { late: true, out: false, part: false, mid: 'mean', target: 70, band: '10', cuts: TENS };
const classKey = () => { const c = batchClass(); return c ? c.id : ''; };
const viewNow = () => { const all = prefs.get('gs.pctView', {}) || {}; return { ...VIEW0, ...(all[classKey()] || {}) }; };
function viewSet(k, v) {
  const all = { ...(prefs.get('gs.pctView', {}) || {}) }, id = classKey(), was = { ...VIEW0, ...(all[id] || {}) }; was[k] = v;
  all[id] = { late: was.late, out: was.out, part: was.part, mid: was.mid, target: was.target, band: was.band, cuts: was.cuts };
  prefs.set('gs.pctView', all);
}
const dpNow = () => { const d = +prefs.get('gs.avgDp', 2); return d === 0 || d === 1 ? d : 2; };
const cutsOf = pv => (pv.band === '5' ? FIVES : pv.band === 'own' ? (pv.cuts && pv.cuts.length ? pv.cuts : TENS) : TENS);

// cuts: the lowest percent of each band, highest first; the last band is everything below the last cut (bandsOf)
function bandsOf(list, cuts) {
  const b = cuts.map((c, i) => ({ lo: c, hi: i ? cuts[i - 1] - 1 : 100 })).concat(cuts.length ? [{ lo: 0, hi: cuts[cuts.length - 1] - 1, below: true }] : [{ lo: 0, hi: 100 }]);
  for (const x of b) { x.label = x.below ? t('pc.band_below', { n: x.hi + 1 }) : x.lo === x.hi ? String(x.lo) : t('pc.band_to', { a: x.lo, b: x.hi }); x.who = list.filter(p => p.pct >= x.lo && (p.pct <= x.hi || (!x.below && x === b[0] && p.pct > 100))); }
  return b;
}
function Bands({ list, cuts }) {
  const b = bandsOf(list, cuts), most = Math.max(1, ...b.map(x => x.who.length)), n = list.length;
  return <div class="pc-bands">{b.map(x => { const k = x.who.length, share = n ? Math.round(k / n * 100) : 0;
    const row = <div class="pc-band" tabindex={k ? 0 : undefined} aria-label={x.label + '%: ' + t('pc.band_tip', { n: k, p: share })} data-band={x.label}><span>{x.label}</span><div class="pc-bt"><i style={{ width: (k / most * 100) + '%' }} /></div><span class="num"><b>{k}</b>{n ? ' · ' + share + '%' : ''}</span></div>;
    return k ? <Tip v={t('pc.band_tip', { n: k, p: share })} l={x.label + '%'} n={names(x.who.map(p => p.name))}>{row}</Tip> : row; })}</div>;
}
// a dot for each paper on a line of percents, stacked where they meet, with lines for the middle of the class and the target (stripHtml)
function Strip({ list, mid, midName, target, X, onOpen }) {
  if (!list.length) return <p class="mute">{t('pc.none')}</p>;
  const lo = Math.min(50, Math.floor(Math.min(...list.map(p => p.pct), target != null ? target : 100) / 10) * 10), x = p => (Math.min(100, Math.max(lo, p)) - lo) / (100 - lo) * 100, seen = {}, ticks = [];
  for (let k = lo; k <= 100; k += 10) ticks.push(k);
  const near = mid != null && target != null && Math.abs(x(mid) - x(target)) < 22;
  const top = Math.max(1, ...Object.values(list.reduce((o, p) => ((o[p.pct] = (o[p.pct] || 0) + 1), o), {})));
  return <div class="pc-strip" style={{ height: (54 + Math.min(top, 8) * 13) + 'px' }}><div class="pc-ax" />{ticks.map(k => <span class="pc-tk" style={{ left: x(k) + '%' }}>{k}%</span>)}
    {mid != null && <div class={'pc-ln' + (near && target > mid ? ' l' : '')} style={{ left: x(mid) + '%' }}><span>{midName + ' ' + (midName === t('setup.i_average') ? avgText(X, mid) : pctText(mid))}</span></div>}
    {target != null && <div class={'pc-ln tg' + (near && target <= mid ? ' l' : '')} style={{ left: x(target) + '%' }}><span>{t('pc.target_at', { n: target })}</span></div>}
    {list.map(p => { const k = seen[p.pct] = (seen[p.pct] || 0) + 1;
      return <Tip v={p.pct + '%'} l={p.name} n={fmtNum(p.total) + ' / ' + fmtNum(p.max)}><button type="button" class={'pc-dot' + (target != null && p.pct < target ? ' lo' : '')} aria-label={p.name + ', ' + p.pct + '%'} onClick={() => onOpen(p.i)} data-pcdot={p.i} style={{ left: x(p.pct) + '%', bottom: (22 + Math.min(k - 1, 7) * 13) + 'px' }} /></Tip>; })}</div>;
}

// Who counts, each with the percent they'd have with What if added (pctList)
function pctList(X, pv, add) {
  const max = maxPoints(), out = [], tags = { late: 0, out: 0, part: 0 };
  state().batch.students.forEach((st, i) => {
    const g = gradeOf(st);
    if (g.status === 'missing' || g.status === 'excused' || g.total == null || g.pct == null || !X.onThisScale(st, g, max)) return;
    if (!g.done && !g.partial) return;
    const tag = g.out ? 'out' : g.partial ? 'part' : g.status === 'late' ? 'late' : '';
    if (tag) tags[tag]++;
    if (tag && !pv[tag]) return;
    const total = add ? Math.max(0, Math.min(max, g.total + add)) : g.total;
    out.push({ i, name: shownName(st, i), total, max, pct: add ? percentFor(total) : g.pct, base: g.pct, tag });
  });
  return { list: out, tags };
}
const TAG = { late: 'mark.late', out: 'pc.tag_out', part: 'pc.tag_part' };

export function Percents({ E, onOpen }) {
  const X = E.X, [, again] = useState(0), re = () => again(n => n + 1);
  const [add, setAdd] = useState(0), [sort, setSort] = useState({ k: 'pct', dir: -1 });
  const pv = viewNow(), set = (k, v) => { viewSet(k, v); re(); };
  const { list, tags } = pctList(X, pv, add), ps = list.map(p => p.pct), n = list.length, cuts = cutsOf(pv), byMed = pv.mid === 'median';
  const avg = mean(ps), md = med(ps), mid = byMed ? md : avg, midName = byMed ? t('pc.middle') : t('setup.i_average');
  const b = bandsOf(list, cuts), rows = list.map(p => ({ ...p, vs: Math.round((p.pct - mid) * 100) / 100, band: (b.find(x => x.who.includes(p)) || {}).label || '' }));
  const by = sort.k === 'name' ? (a, c) => natural(a.name, c.name) : sort.k === 'band' ? (a, c) => a.pct - c.pct : (a, c) => (a[sort.k] - c[sort.k]) || (a.pct - c.pct);
  rows.sort((a, c) => by(a, c) * sort.dir || natural(a.name, c.name));
  const copy = () => copyText(rows.map(r => r.name + '\t' + r.pct + '%').join('\n')).then(ok => toast(ok ? t('pc.copied', { n: rows.length }) : t('copy.failed')));
  const th = (k, l, r) => <th class={r ? 'r' : ''} aria-sort={sort.k === k ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none'}><button type="button" onClick={() => setSort(s => (s.k === k ? { k, dir: -s.dir } : { k, dir: k === 'name' ? 1 : -1 }))} data-psort={k}>{l}{sort.k === k ? (sort.dir < 0 ? ' ▾' : ' ▴') : ''}</button></th>;
  // held: saved once she leaves the box (ui HeldInput), so a save never redraws the number under the cursor; live: a preview only
  const num = (label, value, onSet, o, held) => <label class="pc-num"><span>{label}</span>{held ? <HeldInput type="number" class="input" value={value} {...o} onChange={e => onSet(e.currentTarget.value)} />
    : <input type="number" class="input" value={value} {...o} onInput={e => onSet(e.currentTarget.value)} />}</label>;
  const m0 = ps.length ? ps.reduce((a, c) => a + c, 0) / n : 0, sd = n ? Math.round(Math.sqrt(ps.reduce((a, p) => a + (p - m0) ** 2, 0) / n)) : 0;
  const below = list.filter(p => pv.target > p.pct).length, was = add ? (byMed ? med(list.map(p => p.base)) : mean(list.map(p => p.base))) : null;
  const tile = (l, v, sub, main) => <div class={'tile' + (main ? ' main' : '')}><div class="tl">{l}</div><div class="tv num">{v}</div>{sub && <div class="ts mute">{sub}</div>}</div>;
  const who = [['late', 'pc.late'], ['out', 'pc.out'], ['part', 'pc.part']];
  return <div class="pc" data-pct>
    <div class="pc-opts">
      <Menu label={t('pc.who')} trigger={x => <Button {...x} size="sm" icon="people" data-pcwho>{t('pc.who')}</Button>}
        items={who.map(([k, l]) => ({ label: t(l), sub: t('mark.papers', { n: tags[k] }), checked: !!pv[k], onSelect: () => set(k, !pv[k]) }))} />
      <Segmented size="sm" label={t('pc.mid_h')} value={pv.mid} onChange={v => set('mid', v)} options={[{ value: 'mean', label: t('setup.i_average') }, { value: 'median', label: t('setup.i_middle') }]} />
      <span data-pcdp><Segmented size="sm" label={t('prefs.dp_h')} value={String(dpNow())} onChange={v => { if (+v === 2) prefs.del('gs.avgDp'); else prefs.set('gs.avgDp', +v); re(); }} options={[t('prefs.dp_0'), t('prefs.dp_1'), t('prefs.dp_2')].map((label, d) => ({ value: String(d), label }))} /></span>
      {num(t('pc.target'), pv.target, v => { const x = +v; if (v !== '' && x >= 0 && x <= 100) set('target', x); }, { min: 0, max: 100, step: 1, 'data-pctarget': '' }, true)}
      <Segmented size="sm" label={t('pc.bands')} value={pv.band} onChange={v => set('band', v)} options={[{ value: '10', label: t('pc.tens') }, { value: '5', label: t('pc.fives') }, { value: 'own', label: t('pc.own') }]} />
      {num(t('pc.add'), add, v => { const x = +v; if (!isNaN(x)) setAdd(Math.max(-100, Math.min(100, x))); }, { step: 0.5, 'data-pcadd': '' })}
    </div>
    {pv.band === 'own' && <div class="pc-cuts" data-pccuts>{cuts.concat(['', '']).slice(0, 8).map((v, j) => <HeldInput type="number" class="input" min="1" max="100" value={String(v)} aria-label={t('pc.cut')} data-pccut={j}
      onChange={e => { const all = [...e.currentTarget.parentNode.querySelectorAll('input')].map(x => +x.value).filter(x => x > 0 && x <= 100); set('cuts', [...new Set(all)].sort((a, c) => c - a)); }} />)}</div>}
    {add !== 0 && <p class="mute" data-pcpreview>{t('pc.preview')}</p>}
    {!n ? <p class="mute">{t('pc.none')}</p> : <>
      <div class="tiles pc-tiles" id="pTiles">
        {tile(midName, byMed ? pctText(mid) : avgText(X, mid), add ? t('pc.now', { v: byMed ? pctText(was) : avgText(X, was), d: (add > 0 ? '+' : '') + fmtNum(add) }) : t('pc.counted', { n }), true)}
        {tile(byMed ? t('setup.i_average') : t('pc.middle'), byMed ? avgText(X, avg) : pctText(md))}
        {tile(t('pc.range'), ps.length > 1 ? Math.min(...ps) + '–' + Math.max(...ps) + '%' : ps[0] + '%')}
        {tile(t('pc.gap'), '±' + sd)}
        {tile(t('pc.below', { n: pv.target }), below)}</div>
      <div class="charts"><Card title={t('pc.bands')}><Bands list={list} cuts={cuts} /></Card>
        <Card title={t('pc.every')}><Strip list={list} mid={mid} midName={midName} target={pv.target} X={X} onOpen={onOpen} /></Card></div>
      <div class="pc-th"><h3 class="t4">{t('pc.table')}</h3><Button size="sm" icon="copy" onClick={copy} data-pccopy>{t('pc.copy')}</Button></div>
      <table class="pc-tab"><thead><tr>{th('name', t('setup.g_student'))}{th('total', t('mark.points'), 1)}{th('pct', t('mark.lf_pct'), 1)}{th('vs', byMed ? t('pc.vs_mid') : t('pc.vs_avg'), 1)}{th('band', t('pc.band'))}</tr></thead>
        <tbody>{rows.map(r => <tr class={r.pct < pv.target ? 'lo' : ''} data-pcrow={r.i}><td><button type="button" class="link" onClick={() => onOpen(r.i)} data-raw>{r.name}</button>{r.tag && <span class="stag">{t(TAG[r.tag]).toLowerCase()}</span>}</td>
          <td class="r num">{fmtNum(r.total) + ' / ' + fmtNum(r.max)}</td><td class="r num"><b>{r.pct}%</b></td><td class="r num">{(r.vs > 0 ? '+' : '') + fmtNum(r.vs)}</td><td>{r.band}</td></tr>)}</tbody></table></>}
  </div>;
}

// The summary's Score spread: a bar for each score, each one pointed at or reached by the keyboard says whose it is, and See this as a
// table lists them (spreadHtml, C-023, C-901).
export function Spread({ s }) {
  if (!s.n || !s.bins.length) return <p class="mute">{t('setup.i_no_spread')}</p>;
  const most = Math.max(1, ...s.bins.map(x => x.who.length));
  return <><div class="bars" role="list">{s.bins.map(x => { const k = x.who.length, say = t('setup.i_students', { n: k }), bar = <div class="bar" role="listitem" tabindex={k ? 0 : undefined} aria-label={t('pc.score', { v: x.label }) + ': ' + say} data-bin={x.lo}>
      <i style={{ height: (k / most * 100) + '%' }} /><span class="num">{fmtNum(x.lo)}</span></div>;
    return k ? <Tip v={say} l={t('pc.score', { v: x.label })} n={names(x.who)}>{bar}</Tip> : bar; })}</div>
    <p class="mute cap">{t('setup.i_spread_cap', { n: fmtNum(s.max) })}</p>
    <details class="pc-see" data-spreadtbl><summary>{t('pc.see')}</summary><table class="pc-tab"><thead><tr><th>{t('mark.score')}</th><th class="r">{t('mark.students')}</th><th>{t('pc.who_col')}</th></tr></thead>
      <tbody>{s.bins.filter(x => x.who.length).reverse().map(x => <tr><td>{x.label}</td><td class="r num">{x.who.length}</td><td data-raw>{x.who.join(', ')}</td></tr>)}</tbody></table></details></>;
}
// The rows the class found hardest, each bar with its average and how many were at half or less (rowsHtml, C-023).
export function Rows({ s }) {
  const su = state().setup, one = rowsTop(su);
  return <div class="rowsb">{s.rows.map(x => { const tip = x.n ? t('pc.row_avg', { v: oneDp(x.avg) + (one ? '' : ' / ' + x.top) }) : '–', sum = x.n ? t('pc.row_sum', { n: x.n, low: x.low, half: fmtNum(x.top / 2) }) : '';
    const row = <div class="rb" tabindex={x.n ? 0 : undefined} aria-label={x.name + ': ' + tip + (sum ? '. ' + sum : '')} data-rowbar={x.r}>
      <div class="rn"><span data-raw>{x.name}</span>{x.lowest && <span class="stag">{t('setup.i_lowest_tag')}</span>}</div>
      <div class="rt"><i class={x.lowest ? 'on' : ''} style={{ width: (x.n ? Math.min(100, x.avg / x.top * 100) : 0) + '%' }} /></div>
      <span class="rv num">{x.n ? oneDp(x.avg) : '–'}{!one && x.n ? ' / ' + x.top : ''}</span></div>;
    return x.n ? <Tip v={tip} l={x.name} n={sum}>{row}</Tip> : row; })}</div>;
}
// How each row was scored: every scored row counted by level, in the rubric's own order; a half point counts with the whole number
// below it (src/tabs.js insRowsHtml, A-017).
export function Levels({ X }) {
  const su = state().setup, bb = state().batch; if (su.mode !== 'rubric' || !su.criteria.length) return null;
  const hi = Math.max(...su.criteria.map((_, r) => rowTop(su, r))), lv = Array.from({ length: hi + 1 }, (_, v) => v), shade = v => 'b' + (1 + Math.round(v / Math.max(1, hi) * 4));
  const rows = su.criteria.map((name, r) => { const by = lv.map(() => []);
    bb.students.forEach((st, i) => { const v = st.grade.outAvg ? null : X.rowShown(st, r); if (v != null) by[Math.max(0, Math.min(hi, Math.floor(v)))].push(shownName(st, i)); });
    return { name, by, n: by.reduce((a, c) => a + c.length, 0) }; });
  if (!rows.some(x => x.n)) return null;
  const shown = rows.some(x => x.by[0].length) ? lv : lv.slice(1);
  return <Card title={t('pc.lv_h')} id="insRows"><div class="pc-lv" role="group" aria-label={t('pc.lv_h')}>{rows.map(x => <div class="pc-lvr"><div class="pc-lvn" data-raw title={x.name}>{x.name}</div><div class="pc-lvt">
    {x.n ? shown.map(v => { const who = x.by[v], k = who.length; if (!k) return null; const say = t('mark.papers', { n: k }) + ' · ' + Math.round(k / x.n * 100) + '%';
      return <Tip v={say} l={t('pc.lv_tip', { v, row: x.name })} n={names(who)}><i class={'pc-seg ' + shade(v)} style={{ flex: k }} tabindex="0" aria-label={x.name + ': ' + t('mark.papers', { n: k }) + ', ' + v} data-lv={v}>{k / x.n > 0.07 ? k : ''}</i></Tip>; })
      : <span class="mute">–</span>}</div></div>)}</div>
    <div class="pc-leg">{shown.map(v => <span><i class={'pc-sw ' + shade(v)} />{v}</span>)}</div>
    <p class="mute cap">{t('pc.lv_cap')}{rowHalf(su) ? ' ' + t('pc.lv_half') : ''}</p></Card>;
}

// Read after the summary, from the saved work of the class's other assignments (src/tabs.js insMore): Change since the last summative
// (A-018) and The same assignment in your other classes (A-019). Read only; a failed read shows neither.
const quart = (v, f) => { const k = (v.length - 1) * f, i = Math.floor(k); return v[i] + (v[Math.ceil(k)] - v[i]) * (k - i); };
export function More({ E, s, onOpen }) {
  const [got, setGot] = useState(null);
  useEffect(() => { let live = true; const c = batchClass(); if (!c || !c.names.length) return;
    readBook().then(r => { if (live) setGot(r); }, e => console.error(e)); return () => { live = false; }; }, []);
  const c = batchClass(), bb = state().batch; if (!got || !c) return null;
  const f = bb.assignment && findItem(bb.assignment.id), me = f ? f.it : null, bc = classIn(got.lib, c.id) || c;
  return <><Move X={E.X} c={c} cols={classCols(got.lib, bc, got.cols)} me={me} onOpen={onOpen} /><Across X={E.X} got={got} c={c} me={me} s={s} /></>;
}
// This assignment's finished percents by roster name, as they stand on screen now (insNow)
function nowOf(X, c) {
  const m = rosterMatch(c.names), max = maxPoints(), out = new Map(), bb = state().batch;
  c.names.forEach(n => { const st = m.get(n); if (!st) return; const g = gradeOf(st), i = bb.students.indexOf(st);
    if (g.status === 'missing' || g.status === 'excused' || g.partial || g.out || !g.done || g.pct == null || !X.onThisScale(st, g, max)) return;
    out.set(n, { pct: g.pct, i, name: shownName(st, i) }); });
  return out;
}
function Move({ X, c, cols, me, onOpen }) {
  const bb = state().batch, mine = me ? cols.find(x => x.key === me.id) : null, due = (mine && mine.due) || (me && me.due) || B.isoDay(Date.now());
  const prev = cols.filter(x => x.type === 'sum' && (!me || x.key !== me.id) && x.dl !== bb.id && (!x.due || x.due <= due) && c.names.some(n => B.bkCounts(x.cells.get(n)))).sort((a, b) => (a.due || '').localeCompare(b.due || '')).pop();
  const card = body => <Card title={t('pc.mv_h')} id="insMove">{body}</Card>;
  if (!prev) return card(<p class="mute" data-raw>{t('pc.mv_wait', { name: c.name })}</p>);
  const now = nowOf(X, c), list = [];
  for (const n of c.names) { const a = prev.cells.get(n), b = now.get(n); if (B.bkCounts(a) && b) list.push({ name: b.name, i: b.i, a: a.pct, b: b.pct, d: b.pct - a.pct }); }
  if (!list.length) return card(<p class="mute" data-raw>{t('pc.mv_none', { name: prev.name })}</p>);
  list.sort((x, y) => y.d - x.d || natural(x.name, y.name));
  const lo = Math.max(0, Math.floor((Math.min(...list.flatMap(x => [x.a, x.b])) - 4) / 10) * 10), X0 = v => (Math.min(100, v) - lo) / (100 - lo) * 100;
  const up = list.filter(x => x.d > 0).length, down = list.filter(x => 0 > x.d).length;
  return card(<><div class="pc-mv">{list.map(x => { const r = Math.abs(Math.round(x.d)), k = Math.sign(x.d) + 1, say = [t('class.rp_down', { n: r }), '0', t('class.rp_up', { n: r })][k];
    return <Tip v={say} l={x.name} n={prev.name + ' ' + x.a + '%, ' + t('pc.mv_this') + ' ' + x.b + '%'}><button type="button" class={'pc-mvr ' + ['down', 'same', 'up'][k]} aria-label={x.name + ': ' + x.a + '%, ' + x.b + '%'} onClick={() => onOpen(x.i)} data-mv={x.i}>
      <span class="pc-mvn" data-raw>{x.name}</span><span class="pc-mvt"><i class="ln" style={{ left: Math.min(X0(x.a), X0(x.b)) + '%', width: Math.abs(X0(x.b) - X0(x.a)) + '%' }} /><i class="was" style={{ left: X0(x.a) + '%' }} /><i class="now" style={{ left: X0(x.b) + '%' }} /></span>
      <span class="num">{['\u2212', '', '+'][k] + r}</span></button></Tip>; })}</div>
    <div class="pc-leg"><span data-raw><i class="pc-sw was" />{prev.name}{prev.due ? ' \u00b7 ' + B.bkDay(prev.due) : ''}</span><span><i class="pc-sw now" />{t('pc.mv_this')}</span><span><i class="pc-sw up" />{t('pc.mv_up', { n: up })}</span><span><i class="pc-sw down" />{t('pc.mv_down', { n: down })}</span></div>
    <p class="mute cap">{t('pc.mv_cap')}</p></>);
}
function Across({ X, got, c, me, s }) {
  if (!me || !me.group) return null;
  const rows = [];
  for (const k of got.lib.classes) {
    const it = k.units.flatMap(u => u.items).find(x => x.group === me.group); if (!it) continue;
    let ps;
    if (String(k.id) === String(c.id)) ps = s.counted.map(x => x.pct).filter(v => v != null);
    else { const col = classCols(got.lib, k, got.cols).find(x => x.key === it.id); ps = col ? k.names.map(n => col.cells.get(n)).filter(B.bkCounts).map(x => x.pct) : []; }
    rows.push({ k, me: String(k.id) === String(c.id), ps: ps.sort((a, b) => a - b) });
  }
  if (rows.length < 2) return null;
  const lo = Math.max(0, Math.floor((Math.min(100, ...rows.flatMap(r => r.ps)) - 4) / 10) * 10), x = v => (Math.min(100, v) - lo) / (100 - lo) * 100, ticks = [];
  for (let k = lo; k <= 100; k += 10) ticks.push(k);
  return <Card title={t('pc.ax_h')} id="insAcross"><div class="pc-ax2" role="group">{rows.map(r => { const name = <span class="pc-axn" data-raw>{r.k.name}</span>;
    if (!r.ps.length) return <div class={'pc-axr' + (r.me ? ' me' : '')} data-across>{name}<div class="pc-axt" /><span class="mute">{t('class.ph_no_scores')}</span></div>;
    const q1 = quart(r.ps, 0.25), q2 = quart(r.ps, 0.5), q3 = quart(r.ps, 0.75), avg = B.bkMean(r.ps), lo0 = r.ps[0], hi = r.ps[r.ps.length - 1];
    const say = t('class.sp_tip', { lo: lo0, hi, a: roundPct(q1), b: roundPct(q3), m: Math.round(q2) });
    return <Tip v={t('class.sx_axis', { a: X.pctAvgText(avg) })} l={r.k.name} n={t('pc.ax_n', { n: r.ps.length }) + ', ' + say}><div class={'pc-axr' + (r.me ? ' me' : '')} tabindex="0" aria-label={r.k.name + ': ' + X.pctAvgText(avg) + ', ' + say} data-across>{name}
      <div class="pc-axt"><i class="a" style={{ left: x(lo0) + '%', width: Math.max(0.8, x(hi) - x(lo0)) + '%' }} /><i class="q" style={{ left: x(q1) + '%', width: Math.max(0.8, x(q3) - x(q1)) + '%' }} /><i class="m" style={{ left: x(q2) + '%' }} /></div>
      <span class="num"><b>{X.pctAvgText(avg)}</b> <small>{r.ps.length}</small></span></div></Tip>; })}
    <div class="pc-axr pc-axk" aria-hidden="true"><span /><div class="pc-axt">{ticks.map(k => <span style={{ left: x(k) + '%' }}>{k}%</span>)}</div><span /></div></div>
    <p class="mute cap">{t('class.sp_say')} {t('pc.ax_cap')}</p></Card>;
}
