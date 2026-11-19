// A class's Grades tab (design screenshot 5): the gradebook as the current app draws it on a class page (src/book.js bkTable), every
// number from the lifted engine (engines/gbook.js through students/book.js): each assignment of the term grouped by its type, each
// cell as the current app words it, each type's average and the term grade at the right with why it is what it is, the class
// average along the foot. The term and percent or points are switches above it; Copy scores copies the table as the current app does.
import { h, Fragment } from 'preact';
import { useState, useRef, useLayoutEffect } from 'preact/hooks';
import { Segmented, Icon, EmptyState, Button, Menu, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href, PARTS } from '../router.js';
import { copyText } from '../../services/clipboard.js';
import { useBook, classBook, handoff } from './data.js';
import { engine as B, change } from '../../students/book.js';
import { prefs } from '../../students/prefs.js';
import { fmtNum } from '../../engines/gcore.js';
import { itemIn, ColDialog, TypesDialog, SetupSheet, AddSheet } from './bookedit.jsx';
import { ChartsSheet } from './charts.jsx';
import { openEntry } from './entry.jsx';
import { PhoneScores } from './phscores.jsx';

const onPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches;
import { MypBook, PredSheet, DpSay, GradingDialog } from './ib.jsx';
import { usePart } from '../parts.js';
import './lines.js';

// What-if: students left out of the class averages, per class, for this visit only and never saved (src/book.js bkLeftAll).
const leftAll = {};
export const leftOf = id => leftAll[id] || (leftAll[id] = new Set());
const onlyOn = () => prefs.get('gs.bkOnly', null) == 1;

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

export default function Grades({ classId, sub }) {
  const b = useBook(), [show, setShow] = useState(() => keep('show') || 'pct'), [term, setTerm] = useState(() => keep('term:' + classId)), tab = useRef(null);
  const [box, setBox] = useState(null), [whole, setWhole] = useState(false), [Imp, setImp] = useState(null), [only, setOnly] = useState(onlyOn), [pick, setPick] = useState(false), [, redraw] = useState(0);
  // #/class/<id>/grades/type-<card> (the Assignments tab's No papers: just type the scores): that card's typing, then the address back
  useLayoutEffect(() => { if (!b || !/^type-/.test(sub || '')) return; setBox({ add: true, itId: sub.slice(5) }); location.replace(href('class', classId, 'grades')); }, [b, sub]);
  const Gl = usePart('goals', !!(box && box.goals)), Rp = usePart('reports', !!(box && box.reports)), Ps = usePart('sheets', !!(box && box.sheets));
  if (!b) return <div class="loading" aria-busy="true" />;
  const x = classBook(b, classId);
  if (x && handoff.rows && handoff.cls === classId && !box) { const rows = handoff.rows; handoff.rows = null; PARTS.bki().then(m => { setImp(() => m.ImportSheet); setBox({ imp: true, rows }); }); }
  if (!x) return <EmptyState icon="warn" title={t('class.read_failed')} />;
  const { c, conf } = x;
  // no roster yet: add one, or bring in the old gradebook, whose students can become the roster (src/book.js:251)
  if (!c.names.length) return <><EmptyState icon="people" title={t('class.no_roster')} text={t('class.no_roster_text')} action={<span class="row gap"><a class="btn" href={href('class', classId, 'people')}>{t('class.add_roster')}</a>
    <Button icon="upload" onClick={() => PARTS.bki().then(m => { setImp(() => m.ImportSheet); setBox({ imp: true }); })} data-bki-first>{t('class.bki_menu')}</Button></span>} />
    {box && box.imp && Imp && <Imp x={x} onClose={() => setBox(null)} />}</>;
  const tabs = B.bkTabs(x.cols), on = term != null && tabs.some(tb => tb[0] === term) ? term : x.now;
  const cols = on === '*' ? x.cols : x.cols.filter(k => k.termId === on);
  const choose = v => { setTerm(v); keep('term:' + classId, v); };
  const termLabel = ([id, name]) => (id === '*' ? t('class.whole_year') : id === '' ? t(conf.terms.length ? 'class.outside_terms' : 'class.this_year') : name);
  const ct = B.bkCountTypes(conf), w = conf.w, labelOf = id => { const k = B.bkCats().find(y => y[0] === id); return typeName(id, k && k[2]); };
  const weights = ct.map(([id]) => t('class.weight', { type: labelOf(id), n: +w[id] })).join(', ');
  const termName = termLabel(tabs.find(tb => tb[0] === on) || ['', '']);
  const copy = () => {
    const el = tab.current; if (!el) return;
    const rows = [...el.querySelectorAll('tr')].filter(r => !r.classList.contains('cp-grp')).map(r => [...r.children].map(td => (td.dataset.copy || td.textContent).replace(/\s+/g, ' ').trim()).join('\t'));
    copyText(rows.join('\n')).then(ok => toast(t(ok ? 'class.copied_table' : 'class.copy_failed')));
  };
  const setOnlyKept = v => { if (v) prefs.set('gs.bkOnly', 1); else prefs.del('gs.bkOnly'); setOnly(v); };
  const untyped = x.cols.filter(k => !k.type), left = leftOf(c.id), table = on !== '*', myp = x.way === 'myp', dp = x.way === 'dp';
  const more = [
    { label: t('class.term_setup'), sub: t('class.term_setup_sub'), icon: 'settings', onSelect: () => setBox({ setup: true }) },
    { label: t('class.graded_how_short'), icon: 'grades', onSelect: () => setBox({ grading: true }) },
    ...(dp ? [{ label: t('class.predicted_grades'), onSelect: () => setBox({ pred: true }) }] : []),
    ...(myp ? [] : [{ label: t('class.add_xc'), icon: 'plus', onSelect: () => setBox({ add: true, xc: true }) }, { label: t('class.bki_menu'), sub: t('class.bki_menu_sub'), icon: 'upload', onSelect: () => PARTS.bki().then(m => { setImp(() => m.ImportSheet); setBox({ imp: true }); }) }]),
    { label: t('class.mb_title'), sub: t('class.mb_sub'), icon: 'menu', onSelect: () => openEntry(x, x.lib, on) },
    { sep: true },
    ...(table && !myp ? [{ label: t('class.averages_only'), checked: only, onSelect: () => setOnlyKept(!only) }] : []),
    ...(table && !only && !myp ? [{ label: t('class.leave_out'), sub: t('class.leave_out_sub'), checked: pick, onSelect: () => setPick(!pick) }] : []),
    ...(myp && table ? [] : [{ label: t('class.copy_scores'), icon: 'copy', onSelect: copy, disabled: !cols.length }]),
  ];
  return <section class="book-wrap" aria-labelledby="h-book">
    <div class="lhead"><h2 id="h-book">{t('class.gradebook')}</h2>
      <span class="mute" data-book-sum><span data-raw>{termName}</span>{weights ? ', ' + t('class.weighted', { list: weights }) : ''}</span>
      <span class="end">{pick && <Button size="sm" onClick={() => setPick(false)} data-pick-done>{t('class.done')}</Button>}
        {!myp && <Button size="sm" variant="primary" icon="plus" onClick={() => setBox({ add: true })} data-book-add>{t('class.add_scores')}</Button>}
        <Menu label={t('class.more')} items={more} trigger={m => <Button {...m} size="sm" iconEnd="chd" data-book-more>{t('class.more')}</Button>} /></span></div>
    <div class="bookbar">
      {tabs.length > 1 && <Segmented label={t('class.term')} value={on} onChange={choose} options={tabs.map(tb => ({ value: tb[0], label: termLabel(tb) }))} />}
      <span class="grow" />
      {table && !only && !myp && <Segmented size="sm" label={t('class.show')} value={show} onChange={v => { setShow(v); keep('show', v); }} options={[{ value: 'pct', label: t('class.show_pct') }, { value: 'pts', label: t('class.show_pts') }]} />}
    </div>
    {untyped.length > 0 && <div class="cp-note" role="note" data-untyped>{untyped.length === 1 ? t('class.untyped_one', { name: untyped[0].name }) : t('class.untyped', { n: untyped.length })}
      <Button size="sm" onClick={() => setBox({ types: true })} data-set-types>{t('class.set_types')}</Button></div>}
    {table && !myp && !whole && onPhone() && x.cols.length ? <PhoneScores x={x} onTable={() => setWhole(true)} />
      : table && myp ? <MypBook x={x} cols={cols} all={x.cols} term={on} termName={termName} tab={tab} />
      : !table ? <Year x={x} ct={ct} labelOf={labelOf} tab={tab} /> : !cols.length ? <EmptyState icon="grades" title={t('class.nothing_graded', { name: c.name })} text={t('class.nothing_graded_text')} />
      : <Table x={x} cols={cols} show={show} ct={ct} labelOf={labelOf} term={on} tab={tab} only={only} pick={pick} left={left} onLeft={() => redraw(k => k + 1)} onCol={col => setBox({ col })} />}
    {c.names.length > 0 && <div class="gfoot">{table && !myp && <button type="button" class="gl2" onClick={() => setBox({ charts: true })} data-open-charts><span class="ic"><Icon name="chart" /></span>
      <span><b>{t('class.charts')} <Icon name="chr" size="xs" /></b><p>{t('class.charts_say')}</p></span></button>}
      <button type="button" class="gl2" onClick={() => setBox({ goals: true })} data-open-goals><span class="ic"><Icon name="target" /></span>
      <span><b>{t('class.gl_title')} <Icon name="chr" size="xs" /></b><p>{t('class.gl_card_say')}</p></span></button>
      <button type="button" class="gl2" onClick={() => setBox({ reports: true })} data-open-reports><span class="ic"><Icon name="edit" /></span>
      <span><b>{t('class.rp_title')} <Icon name="chr" size="xs" /></b><p>{t('class.rp_card_say')}</p></span></button>
      <button type="button" class="gl2" onClick={() => setBox({ sheets: true })} data-open-sheets><span class="ic"><Icon name="file" /></span>
      <span><b>{t('class.pss_open_all')} <Icon name="chr" size="xs" /></b><p>{t('class.pss_card_say')}</p></span></button></div>}
    {box && box.goals && Gl && <Gl.GoalsSheet x={x} cols={table ? cols : x.cols} term={on} left={left} onClose={() => setBox(null)} />}
    {box && box.reports && Rp && <Rp.ReportsSheet x={x} cols={table ? cols : x.cols} term={on} onClose={() => setBox(null)} />}
    {box && box.sheets && Ps && <Ps.SheetsSheet x={x} term={on} left={left} onClose={() => setBox(null)} />}
    {box && box.charts && <ChartsSheet x={x} cols={cols} all={b.cols} term={on} left={left} labelOf={labelOf} onClose={() => setBox(null)} />}
    {box && box.col && <ColDialog col={box.col} conf={conf} labelOf={labelOf} onClose={() => setBox(null)} onEditTyped={id => setBox({ add: true, itId: id })} />}
    {box && box.types && <TypesDialog cols={untyped} onClose={() => setBox(null)} />}
    {box && box.setup && <SetupSheet conf={conf} book={x.lib.book} onClose={() => setBox(null)} />}
    {box && box.imp && Imp && <Imp x={x} rows={box.rows} onClose={() => setBox(null)} />}
    {box && box.grading && <GradingDialog c={c} onClose={() => setBox(null)} />}
    {box && box.pred && <PredSheet x={x} cols={cols} all={x.cols} term={on} termName={termName} onClose={() => setBox(null)} />}
    {box && box.add && <AddSheet c={c} cols={x.cols} conf={conf} labelOf={labelOf} itId={box.itId} xc={box.xc} onClose={() => setBox(null)} />}
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

// Typing into the table (src/book.js bkCellEdit, bkKey, bkGridPaste): a cell takes the keys like a spreadsheet. Arrows and Tab move,
// Enter or a digit opens it, Enter goes down, Tab across, Escape leaves it as it was, Delete empties it; cells copied from a
// spreadsheet paste down and across. A score of a graded paper changes in its paper, so only typed-in cells (and a paper's column
// for a student with no paper) take keys.
const editable = (col, cell) => !!(col.typed || (col.d && col.it)) && !(cell && !cell.typed);
const fbOnly = col => col.type === 'fm' && !(col.typed && col.typed.lv);
function putScore(col, n, rec, label) {
  return change(label || t('class.u_score'), l => { const it = col.it && itemIn(l, col.it.id); if (!it) return; B.bkUse({ cls: col.cls }); B.bkPut({ ...col, it, typed: it.typed || null }, n, rec); }, true);
}
const recOf = (col, n) => ((col.typed || {}).s || {})[n] || {};
const cellAt = (root, key, n) => root && root.querySelector('td[data-bked="' + CSS.escape(key) + '"][data-bkn="' + CSS.escape(n) + '"]');
function nextCell(td, dr, dc) {
  const all = [...(dc ? td.parentElement : td.closest('tbody')).querySelectorAll(dc ? 'td[data-bked]' : 'td[data-bked="' + CSS.escape(td.dataset.bked) + '"]')];
  return all[all.indexOf(td) + (dc || dr)] || null;
}

function Table({ x, cols, show, ct, labelOf, term, tab, only, pick, left, onLeft, onCol }) {
  const { c, conf } = x, groups = only ? [] : B.bkGroups(cols), w = conf.w;
  const [edit, setEdit] = useState(null), [at, setAt] = useState(null), want = useRef(null);
  useLayoutEffect(() => { if (!want.current || edit) return; const td = cellAt(tab.current, want.current[0], want.current[1]); want.current = null; if (td) { td.focus(); td.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } });
  const grades = c.names.map(n => B.bkGrade(n, cols, conf)), inn = c.names.map(n => !left.has(n));
  const avgOf = id => { const ps = grades.filter((_, i) => inn[i]).map(r => (id ? r.by[id] : r.grade)).filter(v => v != null); return ps.length ? pct(B.bkMean(ps)) : '–'; };
  const names = c.names.filter((_, i) => inn[i]);
  const colAvg = col => {
    if (col.type === 'xc') return t('class.n_given', { n: names.filter(n => col.cells.get(n)).length });
    if (col.type === 'fm') return names.filter(n => (col.cells.get(n) || {}).fb).length + '/' + names.length;
    const ps = names.map(n => col.cells.get(n)).filter(B.bkCounts).map(k => k.pct); return ps.length ? pct(B.bkMean(ps)) : '–';
  };
  const outOf = col => { const m = [...col.cells.values()].find(k => k && k.max); return (m ? t('class.out_of', { n: fmt(m.max) }) : day(col.due)); };
  const byKey = k => cols.find(y => y.key === k);
  const first = (() => { for (const n of c.names) for (const g of groups) for (const col of g.cols) if (editable(col, col.cells.get(n))) return [col.key, n]; return null; })();
  const stop = at && byKey(at[0]) && c.names.includes(at[1]) ? at : first;
  const go = (key, n) => { want.current = [key, n]; setAt([key, n]); };
  const bad = () => toast(t('class.not_a_score'));
  const commit = (col, n, text) => { const r = recOf(col, n), rec = B.bkParse(text, r, col); if (rec === undefined) { if (String(text).trim() !== B.bkCellVal(r, col)) bad(); return; } if (JSON.stringify(rec) !== JSON.stringify(B.bkParse(B.bkCellVal(r, col), r, col))) putScore(col, n, rec); };
  const open = (td, seed) => {
    const col = byKey(td.dataset.bked), n = td.dataset.bkn; if (!col) return;
    if (fbOnly(col)) { const r = recOf(col, n); putScore(col, n, { ...r, v: null, fb: !r.fb }); go(col.key, n); return; }
    setAt([col.key, n]); setEdit({ key: col.key, n, seed });
  };
  const finish = (inp, keepIt, dr, dc) => {
    if (!edit || inp.dataset.off) return; const col = byKey(edit.key), td = inp.closest('td'), n = edit.n;
    inp.dataset.off = '1';
    if (keepIt && col) commit(col, n, inp.value);
    const to = (dr || dc) && td ? nextCell(td, dr, dc) : null;
    setEdit(null); if (to) go(to.dataset.bked, to.dataset.bkn); else go(edit.key, n);
  };
  const onKey = e => {
    const td = e.target.closest && e.target.closest('td[data-bked]'); if (!td || e.target !== td || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, col = byKey(td.dataset.bked);
    const mv = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1], Tab: [0, e.shiftKey ? -1 : 1] }[k];
    if (k === 'Enter' || k === ' ') { e.preventDefault(); return open(td); }
    if (mv) { const to = nextCell(td, mv[0], mv[1]); if (to || k !== 'Tab') e.preventDefault(); if (to) go(to.dataset.bked, to.dataset.bkn); return; }
    if ((k === 'Delete' || k === 'Backspace') && col) { e.preventDefault(); putScore(col, td.dataset.bkn, null, t('class.u_cleared')); return; }
    if (k.length === 1 && /[\d.,+me-]/i.test(k) && col && !fbOnly(col)) { e.preventDefault(); return open(td, k); }
  };
  const onPaste = e => {
    const td = e.target.closest && e.target.closest('td[data-bked]'); if (!td) return;
    const text = (e.clipboardData || window.clipboardData).getData('text'), inp = td.querySelector('input');
    if (inp && !/[\t\n]/.test(text.trim())) return;
    e.preventDefault(); if (inp) { inp.dataset.off = '1'; setEdit(null); }
    const lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n'), rows = [...td.closest('tbody').rows], j0 = [...td.parentElement.children].indexOf(td), puts = [];
    let row = rows.indexOf(td.parentElement), bads = 0, over = 0;
    for (const line of lines) {
      const tr = rows[row++]; if (!tr) { over++; continue; }
      line.split('\t').forEach((v, j) => {
        const cell = tr.children[j0 + j], col = cell && cell.dataset.bked && byKey(cell.dataset.bked); if (!col || !v.trim() || fbOnly(col)) return;
        const n = cell.dataset.bkn, rec = B.bkParse(v, recOf(col, n), col); if (rec === undefined) { bads++; return; }
        puts.push([col, n, rec]);
      });
    }
    if (puts.length) change(t('class.u_paste'), l => { for (const [col, n, rec] of puts) { const it = col.it && itemIn(l, col.it.id); if (!it) continue; const k = { ...col, it, typed: it.typed || null }; B.bkUse({ cls: col.cls }); B.bkPut(k, n, rec); } }, true);
    go(td.dataset.bked, td.dataset.bkn);
    toast([t('class.pasted', { n: puts.length }), bads ? t('class.paste_bad', { n: bads }) : '', over ? t('class.paste_over') : ''].filter(Boolean).join(' '));
  };
  const toggle = n => { if (left.has(n)) left.delete(n); else left.add(n); onLeft(); };
  return <div class={'card gbw' + (only ? ' only' : '')}><table class="book" ref={tab} data-book={c.id} data-term={term} onKeyDown={onKey} onPaste={onPaste}>
    <thead><tr class="cp-grp"><th />{groups.map(g => <th colSpan={g.cols.length} class="sep">{typeName(g.t, g.s)}{g.t === 'fm' ? ' · ' + (+w.fm > 0 ? w.fm + '%' : t('class.fb_only')) : g.t && g.t !== 'xc' && +w[g.t] > 0 ? ' · ' + w[g.t] + '%' : ''}</th>)}<th colSpan={ct.length + 1} class="sep" /></tr>
      <tr class="c" data-rove><th>{t('class.student')}</th>
        {groups.map(g => g.cols.map((col, j) => <th class={j ? '' : 'sep'} data-col={col.key}><button type="button" class="colbtn" tabIndex={g === groups[0] && !j ? 0 : -1} title={t('class.col_menu')} onClick={() => onCol(col)}
          onKeyDown={e => { const all = [...e.currentTarget.closest('tr').querySelectorAll('.colbtn')], i = all.indexOf(e.currentTarget), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d && all[i + d]) { e.preventDefault(); all[i + d].focus(); } }}>
          <span data-raw>{col.name}</span><small>{outOf(col)}</small></button></th>))}
        {ct.map(([id], j) => <th class={'avg' + (j ? '' : ' sep')} data-copy={t('class.avg_of', { type: labelOf(id) })}>{labelOf(id)}<small>{t('class.average_w', { n: +w[id] })}</small></th>)}
        <th class={'term' + (ct.length ? '' : ' sep')}>{t(term ? 'class.term_grade' : 'class.grade')}</th></tr></thead>
    <tbody>{c.names.map((n, i) => { const r = grades[i];
      return <tr data-stu={i} class={inn[i] ? '' : 'out'}><th scope="row">{pick && <input type="checkbox" class="cp-pick" checked={inn[i]} aria-label={t('class.count_in', { name: n })} onChange={() => toggle(n)} data-pick={i} />}
        <a class="stu" href={href('class', c.id, 'people', i + 1)}><span class="cav" aria-hidden="true" data-raw>{initials(n)}</span><span data-raw>{n}</span></a>{!inn[i] && <span class="tag">{t('class.left_out')}</span>}</th>
        {groups.map(g => g.cols.map((col, j) => { const cell = col.cells.get(n), ed = editable(col, cell), on = edit && edit.key === col.key && edit.n === n;
          return <td class={(j ? '' : 'sep') + (low(cell, col) ? ' lo' : '') + (ed ? ' ed' : '')} data-cell={col.key} data-copy={ticked(cell, col) ? '✓' : undefined}
            {...(ed ? { 'data-bked': col.key, 'data-bkn': n, tabIndex: stop && stop[0] === col.key && stop[1] === n ? 0 : -1, onClick: e => { if (!on && e.target.tagName !== 'INPUT') open(e.currentTarget); }, onFocus: () => setAt([col.key, n]) } : {})}>
            {on ? <input class="cin" defaultValue={edit.seed != null ? edit.seed : B.bkCellVal(recOf(col, n), col)} aria-label={t('class.cell_label', { name: n })} data-cin
              ref={el => { if (el && !el.dataset.f) { el.dataset.f = '1'; el.focus(); if (edit.seed != null) el.setSelectionRange(el.value.length, el.value.length); else el.select(); } }}
              onKeyDown={e => { const k = e.key, s = e.shiftKey ? -1 : 1;
                if (k === 'Enter' || k === 'Tab' || k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); finish(e.currentTarget, true, k === 'Tab' ? 0 : k === 'Enter' ? s : k === 'ArrowUp' ? -1 : 1, k === 'Tab' ? s : 0); }
                else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(e.currentTarget, false); } }}
              onBlur={e => finish(e.currentTarget, true)} /> : <Cell cell={cell} show={show} col={col} />}</td>; }))}
        {ct.map(([id], j) => <td class={'avg' + (j ? '' : ' sep')}>{r.by[id] != null ? pct(r.by[id]) : <span class="none">–</span>}{id === 'ic' && r.xcIc ? <span class="tag">{t('class.xc_short')}</span> : null}</td>)}
        <td class={'term' + (ct.length ? '' : ' sep')} title={why(r, conf, ct, labelOf)} data-grade={r.grade != null ? Math.round(r.grade * 100) / 100 : ''} data-copy={r.grade != null ? pct(r.grade) : '–'}>
          {r.grade != null ? pct(r.grade) : <span class="none">–</span>}<DpSay c={c} p={r.grade} n={n} term={term} />{r.soFar && r.grade != null ? <small>{t('class.so_far')}</small> : null}{r.xcTerm ? <span class="tag">{t('class.xc_short')}</span> : null}</td></tr>; })}</tbody>
    <tfoot><tr><th scope="row">{t('class.class_average')}{left.size > 0 && <small class="cp-leftn">{t('class.without_n', { n: left.size })} · <button type="button" class="link" onClick={() => { left.clear(); onLeft(); }} data-count-all>{t('class.count_everyone')}</button></small>}</th>
      {groups.map(g => g.cols.map((col, j) => <td class={j ? '' : 'sep'}>{colAvg(col)}</td>))}
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
