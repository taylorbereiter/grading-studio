// Learning goals (src/goals.js): the teacher's own list (lib.goals), and a class's percent on each from the rubric rows and quiz
// questions tagged with it, through the lifted goalData. A sheet from under the gradebook: what to reteach (each goal's class
// average, lowest first), every student on every goal, and where each goal's scores come from. Each assignment counts the same.
// The list is edited here as the current app edits it (a removed goal is remembered in lib.goalsGone so a merge keeps it gone).
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Sheet, Dialog, Button, IconButton } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href } from '../router.js';
import { engine as B, change } from '../../students/book.js';
import { roundPct } from '../../engines/gcore.js';
import { pct } from './grades.jsx';
import './lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const shade = p => ({ background: 'color-mix(in oklab, var(--acc) ' + Math.round(Math.max(0, Math.min(100, p)) * 0.85) + '%, var(--s))', color: p >= 60 ? 'var(--white)' : 'var(--ink)' });

// The goals with scores in these columns, with the class average and who is under the line, leaving out who she left out.
export function goalsOf(x, cols, left) {
  B.bookUse({ lib: x.lib }); B.bkUse({ cls: x.c.id });
  return B.goalData(x.c, cols).map(d => { const inn = x.c.names.filter(n => d.stu.has(n) && !(left && left.has(n))); return { ...d, avg: inn.length ? B.bkMean(inn.map(n => d.stu.get(n))) : null, n: inn.length, low: inn.filter(n => roundPct(d.stu.get(n)) < B.GOAL_LOW) }; });
}

export function GoalsSheet({ x, cols, term, left, onClose }) {
  const { c } = x, [edit, setEdit] = useState(false), [sort, setSort] = useState({ k: 'name', dir: 1 });
  B.bookUse({ lib: x.lib });
  const list = B.goalList(), data = goalsOf(x, cols, left);
  const order = data.filter(d => d.avg != null).sort((a, b) => a.avg - b.avg), least = order.length > 1 && roundPct(order[0].avg) !== roundPct(order[order.length - 1].avg) ? order[0] : null;
  const sg = data.find(d => d.g.id === sort.k), val = r => (sort.k === 'name' ? r.i : sg && sg.stu.has(r.n) ? sg.stu.get(r.n) : null);
  const rows = c.names.map((n, i) => ({ n, i })).sort((a, b) => { const p = val(a), q = val(b); return p == null || q == null ? (p == null ? 1 : 0) - (q == null ? 1 : 0) || a.i - b.i : (p - q) * sort.dir || a.i - b.i; });
  const sortBy = k => setSort(sort.k === k ? { k, dir: -sort.dir } : { k, dir: k === 'name' ? 1 : -1 });
  const aria = k => (sort.k === k ? (sort.dir < 0 ? 'descending' : 'ascending') : undefined);
  const unused = list.filter(g => !data.some(d => d.g.id === g.id));
  return <Sheet open wide title={t('class.gl_title')} onClose={onClose}>
    <div class="cp-goals" data-goals>
      <div class="lhead"><p class="mute small">{list.length ? t('class.gl_say') : t('class.gl_none')}</p><span class="end"><Button size="sm" variant={list.length ? undefined : 'primary'} onClick={() => setEdit(true)} data-goals-edit>{t(list.length ? 'class.gl_edit' : 'class.gl_add')}</Button></span></div>
      {list.length > 0 && !data.length && <p class="mute" data-goals-empty>{term === '*' ? t('class.gl_nothing_year') : t('class.gl_nothing_term')} {t('class.gl_how')}</p>}
      {data.length > 0 && <>
        <section><h3>{t('class.gl_reteach')}</h3><p class="mute small">{t('class.gl_reteach_say', { n: B.GOAL_LOW })}</p>
          <div class="cp-bands" data-goal-bars>{order.map(d => <div class={'cp-band' + (d === least ? ' lo' : '')} title={d.low.length ? t('class.gl_under_who', { n: B.GOAL_LOW, names: d.low.slice(0, 12).join(', ') }) : ''}>
            <span><span data-raw>{d.g.name}</span>{d === least && <span class="tag">{t('class.gl_lowest')}</span>}</span>
            <div class="bar"><i style={{ width: Math.min(100, d.avg) + '%' }} /><em class="cut" style={{ left: B.GOAL_LOW + '%' }} /></div><b class="num">{pct(d.avg)}</b>
            <small class="mute">{t('class.n_students', { n: d.n })} · {d.low.length ? t('class.gl_n_under', { n: d.low.length, pct: B.GOAL_LOW }) : t('class.gl_none_under', { pct: B.GOAL_LOW })}</small></div>)}</div></section>
        <section><h3>{t('class.gl_every')}</h3><p class="mute small">{t('class.gl_every_say')}</p>
          <div class="cp-heatw"><table class="cp-heat gl" data-goal-heat>
            <thead><tr><th aria-sort={aria('name')}><button type="button" class="colbtn" onClick={() => sortBy('name')}>{t('class.student')}</button></th>
              {data.map(d => <th aria-sort={aria(d.g.id)}><button type="button" class="colbtn" onClick={() => sortBy(d.g.id)}><span data-raw>{d.g.name}</span></button></th>)}</tr></thead>
            <tbody>{rows.map(r => <tr class={left && left.has(r.n) ? 'out' : ''}><th scope="row"><a class="link" href={href('class', x.c.id, 'people', x.c.names.indexOf(r.n) + 1)} data-raw data-goal-stu>{r.n}</a></th>{data.map(d => { const v = d.stu.get(r.n);
              return <td>{v == null ? <span class="gc none" title={t('class.gl_no_score')} /> : <span class="gc" style={shade(v)} title={r.n + ' · ' + d.g.name + ': ' + roundPct(v) + '% · ' + d.per.get(r.n).map(k => k.col.name + ' ' + roundPct(k.pct) + '%').join(' · ')} data-raw>{roundPct(v)}</span>}</td>; })}</tr>)}
              <tr class="foot"><th scope="row">{t('class.class_avg')}</th>{data.map(d => <td class="num">{d.avg != null ? roundPct(d.avg) + '%' : '–'}</td>)}</tr></tbody></table></div></section>
        <details class="cp-from"><summary>{t('class.gl_from')}</summary><table class="cp-tab"><thead><tr><th>{t('class.gl_goal')}</th><th>{t('class.gl_asg')}</th><th>{t('class.gl_tagged')}</th><th>{t('class.gl_papers')}</th></tr></thead>
          <tbody>{data.flatMap(d => d.from.map((f, k) => <tr><td data-raw>{k ? '' : d.g.name}</td><td data-raw>{f.col.name}{f.col.due && <span class="mute"> {B.bkDay(f.col.due)}</span>}</td><td data-raw>{f.parts.join(', ')}</td><td class="num">{f.n}</td></tr>))}</tbody></table>
          {unused.length > 0 && <p class="mute small">{t('class.gl_unused')} <span data-raw>{unused.map(g => g.name).join(', ')}</span></p>}</details>
      </>}
    </div>
    {edit && <GoalsDialog lib={x.lib} onClose={() => setEdit(false)} />}
  </Sheet>;
}

// The teacher's list of goals (src/goals.js goalsDlg): her own words, one a line. Enter on the last line starts the next.
// add: a new line ready at the end (Rubric setup's New goal…); onClose gets the id of a goal just made, if there is one
export function GoalsDialog({ lib, add, onClose }) {
  B.bookUse({ lib });
  const was = B.goalList(), [rows, setRows] = useState(() => { const r = was.map(g => ({ id: g.id, name: g.name })); if (add || !r.length) r.push({ id: '', name: '' }); return r; });
  const set = (i, v) => setRows(rows.map((r, k) => (k === i ? { ...r, name: v } : r)));
  const focusLast = () => setTimeout(() => { const all = document.querySelectorAll('dialog[open] [data-goal-row]'); if (all.length) all[all.length - 1].focus(); });
  const done = async () => {
    const now = Date.now(), seen = new Set(), next = [];
    for (const r of rows) { const name = r.name.trim().replace(/\s+/g, ' '); if (!name || seen.has(name.toLowerCase())) continue; seen.add(name.toLowerCase()); const old = r.id ? was.find(g => g.id === r.id) : null; next.push(old ? (old.name === name ? old : { ...old, name, at: now }) : { id: uid(), name, at: now }); }
    if (JSON.stringify(next) !== JSON.stringify(was)) await change(t('class.u_goals'), l => {
      const gone = { ...(l.goalsGone || {}) }; for (const g of was) if (!next.some(k => k.id === g.id)) gone[g.id] = now;
      if (next.length) l.goals = next; else delete l.goals; if (Object.keys(gone).length) l.goalsGone = gone;
    }, true);
    const made = next.find(g => !was.some(w => w.id === g.id));
    onClose(made ? made.id : undefined);
  };
  return <Dialog open title={t('class.gl_list')} onClose={onClose} actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={done} data-goals-done>{t('class.done')}</Button></>}>
    <p class="mute small">{t('class.gl_list_say')}</p>
    <div class="goalrows">{rows.map((r, i) => <div class="goalrow"><input class="input" maxLength={80} value={r.name} placeholder={t('class.gl_ph')} aria-label={t('class.gl_n', { n: i + 1 })} onInput={e => set(i, e.currentTarget.value)}
      onKeyDown={e => { if (e.key !== 'Enter') return; e.preventDefault(); if (i === rows.length - 1 && r.name.trim()) { setRows(rows.concat({ id: '', name: '' })); focusLast(); } else done(); }} data-goal-row={i} />
      <IconButton icon="x" size="sm" label={t('class.gl_remove', { n: i + 1 })} onClick={() => { const k = rows.filter((_, j) => j !== i); setRows(k.length ? k : [{ id: '', name: '' }]); }} /></div>)}</div>
    <Button size="sm" icon="plus" onClick={() => { setRows(rows.concat({ id: '', name: '' })); focusLast(); }} data-goal-add>{t('class.gl_add_one')}</Button>
    {was.some(g => !rows.some(r => r.id === g.id)) && <p class="mute small">{t('class.gl_gone_say')}</p>}
  </Dialog>;
}

// One student's goals on their page (src/goals.js goalsStu): nothing unless they have a score on a goal.
export function GoalsStudent({ x, cols, n }) {
  const data = goalsOf(x, cols).filter(d => d.stu.has(n)); if (!data.length) return null;
  return <section class="sp-sec" aria-labelledby="h-gl" data-goals-stu><h3 id="h-gl">{t('class.gl_title')}</h3>
    <div class="cp-bands">{data.map(d => { const v = d.stu.get(n); return <div class="cp-band" title={d.per.get(n).map(k => k.col.name + ' ' + roundPct(k.pct) + '%').join(' · ')}><span data-raw>{d.g.name}</span>
      <div class="bar"><i style={{ width: Math.min(100, v) + '%' }} />{d.avg != null && <em class="avg" style={{ left: Math.min(100, d.avg) + '%' }} />}</div><b class="num">{pct(v)}</b></div>; })}</div>
    <p class="mute small">{t('class.gl_stu_say')}</p></section>;
}
