// Progress sheets (src/sheet.js): one printed page per student for a parent meeting, worked out from the gradebook's own columns
// the way its table and the student page are. Printed from this browser; nothing is sent, and nothing is saved but the teacher's
// three choices in lib.book.sheet { cls, rep, notes } (each on unless false), as the current app keeps them.
import { h, Fragment } from 'preact';
import { useState, useLayoutEffect, useRef } from 'preact/hooks';
import { Sheet, Button, Segmented, Checkbox } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { engine as B, change } from '../../students/book.js';
import { fmtNum, roundPct } from '../../engines/gcore.js';
import { pct, typeName } from './grades.jsx';
import './lines.js';

const confOf = lib => { const s = (lib.book && lib.book.sheet) || {}; return { cls: s.cls !== false, rep: s.rep !== false, notes: s.notes !== false }; };
const q = (v, p) => { const i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };
const dash = v => (v != null ? v : '–');

export function SheetsSheet({ x, term, who, left, onClose }) {
  const { c, conf: bconf } = x, [on, setOn] = useState(null), pages = useRef(null), [, redraw] = useState(0);
  B.bookUse({ lib: x.lib }); B.bkUse({ cls: c.id });
  const conf = B.ibConf(c, bconf), all = B.bkClassCols(c, x.cols), tabs = B.bkTabs(all), o = confOf(x.lib), rc = B.rptConf();
  const tm = [on, term].find(v => v != null && tabs.some(tb => tb[0] === v)) ?? tabs[0][0];
  B.bkUse({ cls: c.id, term: tm });
  const cols = tm === '*' ? all : all.filter(k => k.termId === tm), names = who ? [who] : c.names, inn = n => !(left && left.has(n));
  const label = ([id, name]) => (id === '*' ? t('class.whole_year') : id === '' ? t(conf.terms.length ? 'class.outside_terms' : 'class.this_year') : name);
  const period = label(tabs.find(tb => tb[0] === tm) || ['', '']), today = date(new Date(), { year: 'numeric', month: 'long', day: 'numeric' });
  const myp = B.classWay(c) === 'myp';
  const rep = n => { const key = tm === '*' ? 'year' : tm || 'all', e = ((B.infoOf(c, n).rep || {})[key]) || {}; return { text: e.text != null ? e.text : B.rptDraft(c, n, B.rptFacts(c, cols, conf, n, tm), rc, e.v), draft: !e.done && e.text == null }; };
  const reps = o.rep ? Object.fromEntries(names.map(n => [n, rep(n)])) : {}, drafts = names.filter(n => reps[n] && reps[n].draft && reps[n].text.trim()).length;
  const save = part => change(t('class.u_sheets'), l => { l.book = { ...(l.book || {}), sheet: { ...((l.book || {}).sheet || {}), ...part } }; }, true).then(() => redraw(k => k + 1));
  // A sheet that runs past a page is drawn smaller until it fits: 245 mm is what a Letter page holds inside its margins.
  useLayoutEffect(() => {
    const room = 245 * 96 / 25.4;
    for (const el of pages.current ? pages.current.querySelectorAll('.pssin') : []) {
      el.style.zoom = '';
      for (let k = 0, z = 1; k < 4; k++) { const hh = el.getBoundingClientRect().height; if (hh <= room || z <= 0.6) break; z = Math.max(0.6, Math.floor(z * room / hh * 100) / 100); el.style.zoom = String(z); }
    }
  });
  const print = () => {
    const out = document.createElement('div'); out.id = 'pssPrint'; out.innerHTML = pages.current ? pages.current.innerHTML : ''; document.body.appendChild(out);
    document.body.classList.add('pssprinting');
    const done = () => { window.removeEventListener('afterprint', done); document.body.classList.remove('pssprinting'); out.remove(); };
    window.addEventListener('afterprint', done); window.print();
  };
  return <Sheet open wide title={t(who ? 'class.pss_one' : 'class.pss_all')} onClose={onClose}>
    <div class="cp-pss" data-pss-sheet>
      <div class="pssbar">
        <Segmented label={t('class.term')} value={tm} onChange={setOn} options={tabs.map(tb => ({ value: tb[0], label: label(tb) }))} />
        <span class="grow" />
        <span data-pss-opt="cls"><Checkbox label={t(myp ? 'class.pss_cls_myp' : 'class.pss_cls')} checked={o.cls} onChange={v => save({ cls: v })} /></span>
        <span data-pss-opt="rep"><Checkbox label={t('class.pss_rep')} checked={o.rep} onChange={v => save({ rep: v })} /></span>
        <span data-pss-opt="notes"><Checkbox label={t('class.pss_notes')} checked={o.notes} onChange={v => save({ notes: v })} /></span>
        <Button variant="primary" icon="file" onClick={print} data-pss-print>{names.length === 1 ? t('class.pss_print') : t('class.pss_print_n', { n: names.length })}</Button>
      </div>
      <p class="mute small">{t(names.length === 1 ? 'class.pss_say_one' : 'class.pss_say')}{drafts > 0 && <span class="pssdraft"> {t('class.pss_drafts', { n: drafts })}</span>}</p>
      <div class="psspages" ref={pages}>{names.map(n => (myp ? <MypOne key={n} {...{ c, all, cols, conf, n, o, rep: reps[n], period, today, tm, inn }} /> : <One key={n} {...{ c, all, cols, conf, n, o, rep: reps[n], period, today, tm, inn }} />))}</div>
    </div>
  </Sheet>;
}

const Tile = ({ l, v, s, main }) => <div class={'psst' + (main ? ' main' : '')}><span>{l}</span><b>{v}</b><small>{s || ' '}</small></div>;
const Head = ({ c, n, period, today }) => <header class="psshead"><div><small>{t('class.pss_report')}</small><h3 data-raw>{n}</h3></div><p><span data-raw>{c.name}</span><br />{period} · {today}</p></header>;
const Missing = ({ miss }) => <section><h4>{t('class.pss_missing_h')}</h4>{miss.length ? <ul class="psslist">{miss.map(k => <li><span data-raw>{k.name}</span>{k.due && <small> {B.bkDay(k.due)}</small>}</li>)}</ul> : <p class="pssnone">{t('class.pss_none_missing')}</p>}</section>;
const Foot = ({ o, rep }) => <>{rep && rep.text.trim() && <section class="pssrep"><h4>{t('class.rp_comment')}</h4><p data-raw>{rep.text}</p></section>}
  {o.notes && <section class="pssnotes"><h4>{t('class.pss_notes_h')}</h4><i /><i /><i /></section>}</>;
const Tasks = ({ head, rows }) => { const wide = rows.length > 14, half = Math.ceil(rows.length / 2), tab = list => <table class="psstab"><thead><tr>{head.map((x, i) => <th class={i === 3 ? 'pssv' : ''}>{x}</th>)}</tr></thead><tbody>{list}</tbody></table>;
  return [wide, !rows.length ? <p class="mute">{t('class.pss_nothing')}</p> : wide ? <div class="psshalves">{tab(rows.slice(0, half))}{tab(rows.slice(half))}</div> : tab(rows)]; };

function score(col, cell) {
  if (col.type === 'xc') return t('class.pss_xc', { n: fmtNum(cell.xc) });
  if (cell && cell.st === 'missing') return <b class="pssmiss">{t('class.missing')}</b>;
  if (cell && cell.st === 'excused') return t('class.excused');
  if (col.type === 'fm') return cell && cell.fb ? t('class.pss_fb') : t('class.pss_no_fb');
  if (!cell || cell.pct == null) return <span class="mute">{t('class.pss_not_scored')}</span>;
  const more = cell.st === 'late' ? t('class.late') : cell.partial ? t('class.pss_partial') : cell.out ? t('class.pss_not_counted') : '';
  return <>{cell.pct}%{cell.total != null && <small> {fmtNum(cell.total)}/{fmtNum(cell.max)}</small>}{more && <small> {more}</small>}</>;
}

function One({ c, all, cols, conf, n, o, rep, period, tm, today, inn }) {
  const r = B.bkGrade(n, cols, conf), everyone = c.names.filter(inn).map(k => B.bkGrade(k, cols, conf));
  const cavg = ty => { const ps = everyone.map(g => (ty ? g.by[ty] : g.grade)).filter(v => v != null); return ps.length ? B.bkMean(ps) : null; };
  const vs = v => (o.cls && v != null ? t('class.pss_class', { v: pct(v) }) : '');
  const fm = cols.filter(k => k.type === 'fm'), miss = cols.filter(k => k.type !== 'xc' && (k.cells.get(n) || {}).st === 'missing');
  const lab = id => { const k = B.bkCats().find(y => y[0] === id); return typeName(id, k && k[2]); };
  const ct = B.bkCountTypes(conf), dp = B.classWay(c) !== 'dp' ? '' : (() => { const g = r.grade == null ? null : B.ibGradeOf(roundPct(r.grade), B.ibBounds(c)), p = B.ibPredOf(c, n, tm); return [g != null ? t('class.pss_ib', { g }) : '', p != null ? t('class.pss_pred', { g: p }) : ''].filter(Boolean).join(' · '); })();
  const rows = cols.filter(k => k.type !== 'xc' || k.cells.get(n)).map(col => <tr><td data-raw>{col.name}</td><td>{lab(col.type)}</td><td>{B.bkDay(col.due)}</td><td class="pssv">{score(col, col.cells.get(n))}</td></tr>);
  const [wide, tasks] = Tasks({ head: [t('class.pss_asg'), t('class.pss_type'), t('class.pss_date'), t('class.pss_score')], rows });
  let terms = null;
  if (conf.terms.length) {
    const keys = ct.map(([k]) => k).concat(['']);
    const vals = conf.terms.map(tt => { const cs = all.filter(k => k.termId === tt.id), g = B.bkGrade(n, cs, conf), cl = c.names.filter(inn).map(k => B.bkGrade(k, cs, conf).grade).filter(v => v != null); return { name: tt.name, v: keys.map(k => (k ? g.by[k] : g.grade)), cls: cl.length ? B.bkMean(cl) : null }; });
    const yr = keys.map((k, j) => { const have = vals.map(v => v.v[j]).filter(v => v != null); return have.length ? B.bkMean(have) : null; });
    const cell = v => <td class="pssv">{v != null ? pct(v) : '–'}</td>;
    terms = <section><h4>{t('class.pss_by_term')}</h4><table class="psstab"><thead><tr><th />{ct.map(([id]) => <th class="pssv">{lab(id)}</th>)}<th class="pssv">{t('class.pss_grade')}</th>{o.cls && <th class="pssv">{t('class.pss_class_h')}</th>}</tr></thead>
      <tbody>{vals.map(v => <tr><td data-raw>{v.name}</td>{v.v.map(cell)}{o.cls && cell(v.cls)}</tr>)}<tr class="pssyr"><td>{t('class.pss_year')}</td>{yr.map(cell)}{o.cls && <td />}</tr></tbody></table></section>;
  }
  return <article class="pss" data-pss={n}><div class="pssin"><Head c={c} n={n} period={period} today={today} />
    <div class="psstiles"><Tile main l={tm === '*' || !conf.terms.length ? t('class.pss_grade') : t('class.pss_term_grade')} v={<>{r.grade != null ? pct(r.grade) : '–'}{r.grade != null && r.soFar && <small> {t('class.pss_so_far')}</small>}</>}
      s={[dp, r.xc ? t('class.pss_inc_xc', { n: fmtNum(r.xc) }) : '', vs(cavg(''))].filter(Boolean).join(' · ')} />
      {ct.map(([id]) => <Tile l={lab(id)} v={r.by[id] != null ? pct(r.by[id]) : '–'} s={[t('class.pss_counted', { n: cols.filter(k => k.type === id && B.bkCounts(k.cells.get(n))).length, of: cols.filter(k => k.type === id).length }), vs(cavg(id))].filter(Boolean).join(' · ')} />)}
      <Tile l={t('class.missing')} v={String(miss.length)} s={miss.length ? t('class.pss_pieces', { n: miss.length }) : t('class.pss_outstanding')} />
      {fm.length > 0 && <Tile l={t('class.pss_feedback')} v={t('class.rp_n_of', { n: fm.filter(k => (k.cells.get(n) || {}).fb).length, of: fm.length })} s={t('class.pss_formative')} />}</div>
    <section class="psschart"><h4>{t('class.pss_over_time')}</h4><BandLine c={c} sc={B.bkScored(cols)} n={n} band={o.cls} inn={inn} /></section>
    <div class={'pssgrid' + (wide ? ' wide' : '')}><section><h4>{t('class.pss_asgs')}</h4>{tasks}</section><aside>{terms}<Missing miss={miss} /></aside></div>
    <Foot o={o} rep={rep} /></div></article>;
}

// The student's scores as a line over the class's middle half (src/classpage.js bkBandLine), or the line alone.
export function BandLine({ c, sc, n, band, inn }) {
  const cols = sc.map(col => { const v = c.names.filter(inn).map(k => col.cells.get(k)).filter(B.bkCounts).map(k => k.pct).sort((a, b) => a - b), cell = col.cells.get(n); return { col, v, me: B.bkCounts(cell) ? cell.pct : null, miss: !!cell && cell.st === 'missing' }; }).filter(k => k.v.length || k.miss);
  const qs = cols.map(k => (band && k.v.length ? [q(k.v, 0.25), q(k.v, 0.5), q(k.v, 0.75)] : null)), vals = qs.filter(Boolean).flat().concat(cols.map(k => k.me).filter(v => v != null));
  if (!vals.length) return <p class="mute">{t('class.pss_nothing')}</p>;
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 8) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...vals) + 2) / 10) * 10) || 100;
  const k = cols.length, W = 860, L = 44, R = 30, T = 16, Bm = 30, H = 220, X = i => L + (k === 1 ? (W - L - R) / 2 : i * (W - L - R) / (k - 1)), Y = v => T + (hi - Math.min(hi, v)) / Math.max(10, hi - lo) * (H - T - Bm);
  const grid = []; for (let v = lo; v <= hi; v += 10) grid.push(v);
  const runs = []; let run = []; qs.forEach((x, i) => { if (!x) { if (run.length) runs.push(run); run = []; } else run.push(i); }); if (run.length) runs.push(run);
  const seg = []; run = []; cols.forEach((x, i) => { if (x.me == null) { if (run.length) seg.push(run); run = []; } else run.push(X(i) + ',' + Y(x.me)); }); if (run.length) seg.push(run);
  return <><svg class="cp-line pssline" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={cols.map((x, i) => x.col.name + ' ' + (x.me != null ? x.me + '%' : x.miss ? t('class.missing') : '–')).join('. ')} data-raw>
    {grid.map(v => <><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} class="g" /><text x={L - 8} y={Y(v) + 4} text-anchor="end" class="tk">{v}%</text></>)}
    {runs.map(r => (r.length === 1 ? <><rect class="band" x={X(r[0]) - 14} y={Y(qs[r[0]][2])} width="28" height={Math.max(2, Y(qs[r[0]][0]) - Y(qs[r[0]][2]))} /><line class="med" x1={X(r[0]) - 14} x2={X(r[0]) + 14} y1={Y(qs[r[0]][1])} y2={Y(qs[r[0]][1])} /></>
      : <><polygon class="band" points={r.map(i => X(i) + ',' + Y(qs[i][2])).concat([...r].reverse().map(i => X(i) + ',' + Y(qs[i][0]))).join(' ')} /><polyline class="med" points={r.map(i => X(i) + ',' + Y(qs[i][1])).join(' ')} /></>))}
    {seg.map(r => <polyline points={r.join(' ')} class="ln" />)}
    {cols.map((x, i) => (x.me != null ? <circle cx={X(i)} cy={Y(x.me)} r="5" class="dot"><title>{x.col.name + ': ' + x.me + '%' + (qs[i] ? ' · ' + t('class.pss_middle', { lo: roundPct(qs[i][0]), hi: roundPct(qs[i][2]) }) : '')}</title></circle>
      : x.miss ? <circle cx={X(i)} cy={H - Bm - 10} r="6" class="miss"><title>{x.col.name + ': ' + t('class.missing')}</title></circle> : null))}
    {cols.map((x, i) => <text x={X(i)} y={H - 8} text-anchor="middle" class="tk">{x.col.due ? B.bkDay(x.col.due) : ''}</text>)}
  </svg>{band && <div class="pssleg"><span><i class="me" />{t('class.pss_leg_me')}</span><span><i class="band" />{t('class.pss_leg_band')}</span><span><i class="med" />{t('class.pss_leg_med')}</span></div>}</>;
}

// An MYP class: levels by criterion and a 1 to 7, never a percent (src/ib.js ibSheetOne).
function MypOne({ c, all, cols, conf, n, o, rep, period, tm, today, inn }) {
  const crit = B.ibCrit(c), bounds = B.ibBounds(c), icols = B.ibCols(c, cols), top = crit.length * B.IB_TOP, cls = c.names.filter(inn);
  const lv = B.ibLvAt(c, tm, n), r = B.ibTerm(lv, crit, bounds), miss = icols.filter(k => (k.cells.get(n) || {}).st === 'missing');
  const mid = list => { const m = o.cls ? B.ibMid(list) : null; return m != null ? t('class.pss_mid', { v: m }) : ''; };
  const say = (k, cell) => (!cell ? <span class="mute">{t('class.pss_not_marked')}</span> : cell.st === 'missing' ? <b class="pssmiss">{t('class.missing')}</b> : cell.st === 'excused' ? t('class.excused')
    : k.crit.filter(x => cell.lv[x] != null).map(x => x + ' ' + cell.lv[x]).join(' · ') || <span class="mute">{t('class.pss_not_marked')}</span>);
  const rows = icols.map(k => <tr><td><span data-raw>{k.name}</span>{k.fm && <small> {t('class.pss_formative_one')}</small>}</td><td>{k.crit.join(' ')}</td><td>{B.bkDay(k.due)}</td><td class="pssv">{say(k, k.cells.get(n))}</td></tr>);
  const [wide, tasks] = Tasks({ head: [t('class.pss_task'), t('class.pss_criteria'), t('class.pss_date'), t('class.pss_levels')], rows });
  const line = (name, id, cl) => { const l = B.ibLvAt(c, id, n), g = B.ibTerm(l, crit, bounds); return <tr class={cl}><td data-raw>{name}</td>{crit.map(x => <td class="pssv">{dash(B.ibLevel(l[x.k]))}</td>)}<td class="pssv">{dash(g.total)}</td><td class="pssv">{g.grade != null ? <b>{g.grade}</b> : '–'}</td></tr>; };
  const terms = conf.terms.length ? <section><h4>{t('class.pss_by_term')}</h4><table class="psstab"><thead><tr><th />{crit.map(x => <th class="pssv" title={x.name} data-raw>{x.k}</th>)}<th class="pssv">{t('class.pss_total')}</th><th class="pssv">{t('class.pss_grade')}</th></tr></thead>
    <tbody>{conf.terms.map(tt => line(tt.name, tt.id, ''))}{Object.keys(B.ibLvAt(c, '*', n)).length > 0 && line(t('class.pss_year'), '*', 'pssyr')}</tbody></table></section> : null;
  return <article class="pss ibpss" data-pss={n}><div class="pssin"><Head c={c} n={n} period={period} today={today} />
    <div class="psstiles"><Tile main l={tm === '*' || !conf.terms.length ? t('class.pss_grade') : t('class.pss_term_grade')} v={<>{dash(r.grade)}{r.grade != null && <small> {t('class.pss_of_7')}</small>}</>}
      s={[r.need.length ? t('class.pss_to_set', { list: r.need.join(', ') }) : t('class.pss_total_of', { n: r.total, of: top }), mid(cls.map(k => B.ibTerm(B.ibLvAt(c, tm, k), crit, bounds).grade))].filter(Boolean).join(' · ')} />
      {crit.map(x => { const v = B.ibLevel(lv[x.k]); return <Tile l={<><b>{x.k}</b> <span data-raw>{x.name}</span></>} v={<>{dash(v)}{v != null && <small> {t('class.pss_of', { n: B.IB_TOP })}</small>}</>} s={[v != null ? B.ibBandName(v) : t('class.pss_not_set'), mid(cls.map(y => B.ibLevel(B.ibLvAt(c, tm, y)[x.k])))].filter(Boolean).join(' · ')} />; })}
      <Tile l={t('class.missing')} v={String(miss.length)} s={miss.length ? t('class.pss_pieces', { n: miss.length }) : t('class.pss_outstanding')} /></div>
    <p class="ibpsscap">{t('class.pss_myp_say')}</p>
    <div class={'pssgrid' + (wide ? ' wide' : '')}><section><h4>{t('class.pss_tasks')}</h4>{tasks}</section><aside>{terms}<Missing miss={miss} /></aside></div>
    <Foot o={o} rep={rep} /></div></article>;
}
