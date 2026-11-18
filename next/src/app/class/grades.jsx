// A class's Grades tab (design screenshot 5): the gradebook as the current app draws it on a class page (src/book.js bkTable), every
// number from the lifted engine (engines/gbook.js through students/book.js): each assignment of the term grouped by its type, each
// cell as the current app words it, each type's average and the term grade at the right with why it is what it is, the class
// average along the foot. The term and percent or points are switches above it; Copy scores copies the table as the current app does.
import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Segmented, Icon, EmptyState, Button, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href } from '../router.js';
import { copyText } from '../../services/clipboard.js';
import { useBook, classBook } from './data.js';
import { engine as B } from '../../students/book.js';
import { fmtNum } from '../../engines/gcore.js';
import './lines.js';

const keep = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem('gsn.book.' + k)); sessionStorage.setItem('gsn.book.' + k, JSON.stringify(v)); } catch {} return null; };
const DEF = { ic: 'class.type_ic', sum: 'class.type_sum', fm: 'class.type_fm', xc: 'class.type_xc', '': 'class.type_none' };
// A type's short name: a default type in the app's words, the teacher's own as typed.
export const typeName = (id, own) => (DEF[id] != null && (!own || B.bkIsDef(id) || id === 'xc' || id === '') ? t(DEF[id]) : own);
const day = s => (s ? B.bkDay(s) : '');
export const pct = v => (v == null ? '' : B.pctAvgText(v));

// One cell as the current app words it (src/book.js bkCellText).
function Cell({ cell, show, col }) {
  if (col.type === 'xc') return cell && cell.xc ? <span class="bxc">+{fmtNum(cell.xc)}</span> : <span class="none">–</span>;
  if (!cell) return <span class="none">–</span>;
  if (cell.st === 'missing') return <span class="ms">{t('class.missing')}</span>;
  if (cell.st === 'excused') return <span class="st">{t('class.excused')}</span>;
  if (col.type === 'fm') return cell.fb ? <Icon name="check" size="sm" label={t('class.fb_done')} /> : cell.started ? <span class="st">{t('class.started')}</span> : <span class="none">–</span>;
  if (cell.pct == null) return cell.fb ? <Icon name="check" size="sm" label={t('class.fb_no_score')} /> : <span class="none">–</span>;
  const v = show === 'pts' && cell.total != null ? <>{fmt(cell.total)}<small>/{fmt(cell.max)}</small></> : cell.pct + '%';
  return <>{v}{cell.tries && <span class="tag" title={cell.tries} data-raw>{t('class.retake')}</span>}{cell.partial ? <span class="tag">{t('class.partial')}</span> : cell.out ? <span class="tag">{t('class.left_out')}</span> : cell.st === 'late' ? <span class="tag">{t('class.late')}</span> : null}</>;
}
const fmt = n => (n == null ? '' : fmtNum(n));
// A tick for feedback (copied as the current app's ✓).
const ticked = (cell, col) => !!cell && col.type !== 'xc' && !cell.st && cell.fb && (col.type === 'fm' || cell.pct == null);
const low = (cell, col) => col.type !== 'xc' && col.type !== 'fm' && cell && cell.pct != null && cell.pct < 60 && !cell.st;

export default function Grades({ classId }) {
  const b = useBook(), [show, setShow] = useState(() => keep('show') || 'pct'), [term, setTerm] = useState(() => keep('term:' + classId)), tab = useRef(null);
  if (!b) return <div class="loading" aria-busy="true" />;
  const x = classBook(b, classId);
  if (!x) return <EmptyState icon="warn" title={t('class.read_failed')} />;
  const { c, conf } = x;
  if (!c.names.length) return <EmptyState icon="people" title={t('class.no_roster')} text={t('class.no_roster_text')} action={<a class="btn" href={href('class', classId, 'people')}>{t('class.add_roster')}</a>} />;
  const tabs = B.bkTabs(x.cols), on = term != null && tabs.some(tb => tb[0] === term) ? term : x.now;
  const cols = on === '*' ? x.cols : x.cols.filter(k => k.termId === on);
  const pick = v => { setTerm(v); keep('term:' + classId, v); };
  const termLabel = ([id, name]) => (id === '*' ? t('class.whole_year') : id === '' ? t(conf.terms.length ? 'class.outside_terms' : 'class.this_year') : name);
  const ct = B.bkCountTypes(conf), w = conf.w, labelOf = id => { const k = B.bkCats().find(y => y[0] === id); return typeName(id, k && k[2]); };
  const weights = ct.map(([id]) => t('class.weight', { type: labelOf(id), n: +w[id] })).join(', ');
  const termName = termLabel(tabs.find(tb => tb[0] === on) || ['', '']);
  const copy = () => {
    const el = tab.current; if (!el) return;
    const rows = [...el.querySelectorAll('tr')].filter(r => !r.classList.contains('cp-grp')).map(r => [...r.children].map(td => (td.dataset.copy || td.textContent).replace(/\s+/g, ' ').trim()).join('\t'));
    copyText(rows.join('\n')).then(ok => toast(t(ok ? 'class.copied_table' : 'class.copy_failed')));
  };
  return <section class="book-wrap" aria-labelledby="h-book">
    <div class="lhead"><h2 id="h-book">{t('class.gradebook')}</h2>
      <span class="mute" data-book-sum><span data-raw>{termName}</span>{weights ? ', ' + t('class.weighted', { list: weights }) : ''}</span>
      <span class="end"><Button size="sm" icon="copy" onClick={copy} disabled={!cols.length} data-book-copy>{t('class.copy_scores')}</Button></span></div>
    <div class="bookbar">
      {tabs.length > 1 && <Segmented label={t('class.term')} value={on} onChange={pick} options={tabs.map(tb => ({ value: tb[0], label: termLabel(tb) }))} />}
      <span class="grow" />
      <Segmented size="sm" label={t('class.show')} value={show} onChange={v => { setShow(v); keep('show', v); }} options={[{ value: 'pct', label: t('class.show_pct') }, { value: 'pts', label: t('class.show_pts') }]} />
    </div>
    {on === '*' ? <Year x={x} ct={ct} labelOf={labelOf} tab={tab} /> : !cols.length ? <EmptyState icon="grades" title={t('class.nothing_graded', { name: c.name })} text={t('class.nothing_graded_text')} />
      : <Table x={x} cols={cols} show={show} ct={ct} labelOf={labelOf} term={on} tab={tab} />}
  </section>;
}

// Why a grade is what it is (src/book.js bkWhy), in words: each counted type's average and weight, extra credit, the cap.
function why(r, conf, ct, labelOf) {
  const parts = ct.map(([id]) => t('class.why_type', { type: labelOf(id), w: +conf.w[id], v: r.by[id] != null ? pct(r.by[id]) : t(conf.empty === 'zero' ? 'class.why_zero' : 'class.why_none') }));
  if (r.xcIc) parts.push(t('class.why_xc_ic', { n: fmt(r.xcIc) }));
  if (r.xcTerm) parts.push(t('class.why_xc', { n: fmt(r.xcTerm) }));
  if (r.capped) parts.push(t('class.why_cap'));
  return parts.join(' · ');
}

function Table({ x, cols, show, ct, labelOf, term, tab }) {
  const { c, conf } = x, groups = B.bkGroups(cols), w = conf.w;
  const grades = c.names.map(n => B.bkGrade(n, cols, conf));
  const avgOf = id => { const ps = grades.map(r => (id ? r.by[id] : r.grade)).filter(v => v != null); return ps.length ? pct(B.bkMean(ps)) : '–'; };
  const colAvg = col => {
    if (col.type === 'xc') return t('class.n_given', { n: c.names.filter(n => col.cells.get(n)).length });
    if (col.type === 'fm') return c.names.filter(n => (col.cells.get(n) || {}).fb).length + '/' + c.names.length;
    const ps = c.names.map(n => col.cells.get(n)).filter(B.bkCounts).map(k => k.pct); return ps.length ? pct(B.bkMean(ps)) : '–';
  };
  const outOf = col => { const m = [...col.cells.values()].find(k => k && k.max); return m ? t('class.out_of', { n: fmt(m.max) }) : day(col.due); };
  return <div class="card gbw"><table class="book" ref={tab} data-book={c.id} data-term={term}>
    <thead><tr class="cp-grp"><th />{groups.map(g => <th colSpan={g.cols.length} class="sep">{typeName(g.t, g.s)}{g.t === 'fm' ? ' · ' + (+w.fm > 0 ? w.fm + '%' : t('class.fb_only')) : g.t && g.t !== 'xc' && +w[g.t] > 0 ? ' · ' + w[g.t] + '%' : ''}</th>)}<th colSpan={ct.length + 1} class="sep" /></tr>
      <tr class="c"><th>{t('class.student')}</th>
        {groups.map(g => g.cols.map((col, j) => <th class={j ? '' : 'sep'} data-col={col.key}><span data-raw>{col.name}</span><small>{outOf(col)}</small></th>))}
        {ct.map(([id], j) => <th class={'avg' + (j ? '' : ' sep')} data-copy={t('class.avg_of', { type: labelOf(id) })}>{labelOf(id)}<small>{t('class.average_w', { n: +w[id] })}</small></th>)}
        <th class={'term' + (ct.length ? '' : ' sep')}>{t(term ? 'class.term_grade' : 'class.grade')}</th></tr></thead>
    <tbody>{c.names.map((n, i) => { const r = grades[i];
      return <tr data-stu={i}><th scope="row"><a class="stu" href={href('class', c.id, 'people', i + 1)}><span class="cav" aria-hidden="true" data-raw>{initials(n)}</span><span data-raw>{n}</span></a></th>
        {groups.map(g => g.cols.map((col, j) => { const cell = col.cells.get(n); return <td class={(j ? '' : 'sep') + (low(cell, col) ? ' lo' : '')} data-cell={col.key} data-copy={ticked(cell, col) ? '✓' : undefined}><Cell cell={cell} show={show} col={col} /></td>; }))}
        {ct.map(([id], j) => <td class={'avg' + (j ? '' : ' sep')}>{r.by[id] != null ? pct(r.by[id]) : <span class="none">–</span>}{id === 'ic' && r.xcIc ? <span class="tag">{t('class.xc_short')}</span> : null}</td>)}
        <td class={'term' + (ct.length ? '' : ' sep')} title={why(r, conf, ct, labelOf)} data-grade={r.grade != null ? Math.round(r.grade * 100) / 100 : ''} data-copy={r.grade != null ? pct(r.grade) : '–'}>
          {r.grade != null ? pct(r.grade) : <span class="none">–</span>}{r.soFar && r.grade != null ? <small>{t('class.so_far')}</small> : null}{r.xcTerm ? <span class="tag">{t('class.xc_short')}</span> : null}</td></tr>; })}</tbody>
    <tfoot><tr><th scope="row">{t('class.class_average')}</th>{groups.map(g => g.cols.map((col, j) => <td class={j ? '' : 'sep'}>{colAvg(col)}</td>))}
      {ct.map(([id], j) => <td class={'avg' + (j ? '' : ' sep')}>{avgOf(id)}</td>)}<td class={'term' + (ct.length ? '' : ' sep')}>{avgOf('')}</td></tr></tfoot>
  </table></div>;
}

// The whole year (src/book.js bkYear): each term's type averages and grade side by side, then the year, the average of the terms a
// student has one in.
function Year({ x, ct, labelOf, tab }) {
  const { c, conf } = x, terms = conf.terms;
  if (!terms.length) return <EmptyState icon="cal" title={t('class.no_terms')} />;
  const per = terms.map(tm => x.cols.filter(k => k.termId === tm.id)), keys = ct.map(([id]) => id).concat(['']);
  const rows = c.names.map(n => { const g = per.map(cols => B.bkGrade(n, cols, conf)), yr = {}; for (const k of keys) { const v = g.map(r => (k ? r.by[k] : r.grade)).filter(v => v != null); yr[k] = v.length ? B.bkMean(v) : null; } return { n, g, yr }; });
  const head = () => keys.map((k, j) => <th class={(k ? 'avg' : 'term') + (j ? '' : ' sep')}>{k ? labelOf(k) : t('class.grade')}{k && <small>{t('class.average')}</small>}</th>);
  const v = x => (x != null ? pct(x) : <span class="none">–</span>);
  return <div class="card gbw"><table class="book year" ref={tab} data-book={c.id} data-term="*">
    <thead><tr class="cp-grp"><th />{terms.map(tm => <th colSpan={keys.length} class="sep" data-raw>{tm.name}</th>)}<th colSpan={keys.length} class="sep">{t('class.year')}</th></tr>
      <tr class="c"><th>{t('class.student')}</th>{terms.map(head)}{head()}</tr></thead>
    <tbody>{rows.map((r, i) => <tr data-stu={i}><th scope="row"><a class="stu" href={href('class', c.id, 'people', i + 1)}><span class="cav" aria-hidden="true" data-raw>{initials(r.n)}</span><span data-raw>{r.n}</span></a></th>
      {r.g.map(g => keys.map((k, j) => <td class={(k ? 'avg' : 'term') + (j ? '' : ' sep')}>{v(k ? g.by[k] : g.grade)}</td>))}{keys.map((k, j) => <td class={(k ? 'avg' : 'term') + (j ? '' : ' sep')} data-year={k || 'grade'}>{v(r.yr[k])}</td>)}</tr>)}</tbody>
  </table></div>;
}
export const initials = n => { const w = String(n).replace(/[,_]/g, ' ').split(/\s+/).filter(x => /\p{L}/u.test(x)); const p = /,/.test(n) ? [w[1], w[0]] : [w[0], w[w.length - 1]]; return p.filter(Boolean).map(x => x[0].toUpperCase()).join('').slice(0, 2) || '?'; };
