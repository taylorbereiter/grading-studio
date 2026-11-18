// The entry list (src/mbentry.js): one task's scores, short and in order, in a narrow window the teacher keeps beside the school's own
// gradebook (ManageBac and others take no file of scores, so each score is typed by hand). Each student's score, or the level for
// each criterion in an MYP class, in the order the school's page lists them (her setting: lib.me.mbOrder). A press on a student greys
// the row and moves on. Nothing is connected or sent. Its own window where the browser allows one, else a panel on this page.
import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { t } from '../../i18n/t.js';
import { engine as B, change } from '../../students/book.js';
import { fmtNum } from '../../engines/gcore.js';
import { copyText } from '../../services/clipboard.js';
import './lines.js';

const ORDERS = [['', 'class.mb_roster'], ['last', 'class.mb_last'], ['first', 'class.mb_first']];
const orderOf = lib => (['last', 'first'].includes((lib.me || {}).mbOrder) ? lib.me.mbOrder : '');
// What can be listed: every task of the class, newest first, and in an MYP class the term's levels after them.
function tasksOf(x) {
  if (x.way === 'myp') return B.ibCols(x.c, x.cols).sort((a, b) => b.t - a.t).map(k => ({ key: k.key, name: k.name })).concat({ key: '*lv', name: t('class.mb_term_levels') });
  return x.cols.filter(k => k.type !== 'xc').slice().reverse().map(k => ({ key: k.key, name: k.name }));
}
// One row per student (mbRows): { i, name, vals: [[criterion or '', value or null]], st }, and the task's "out of" where it has one.
function rowsOf(x, key, term, how) {
  const c = x.c, rows = []; let max = null, get = () => ({ vals: [['', null]] });
  if (x.way === 'myp') {
    const crit = B.ibCrit(c).map(k => k.k);
    if (key === '*lv') get = n => { const lv = ((c.lv || {})[term] || {})[n] || {}; return { vals: crit.map(k => [k, B.ibLevel(lv[k])]) }; };
    else { const col = B.ibCols(c, x.cols.filter(k => k.key === key))[0]; if (col) get = n => { const cell = col.cells.get(n); return { st: cell && cell.st, vals: col.crit.map(k => [k, cell && cell.lv[k] != null ? cell.lv[k] : null]) }; }; }
  } else {
    const col = x.cols.find(k => k.key === key);
    if (col) {
      for (const k of col.cells.values()) if (k.max) { max = k.max; break; }
      get = n => { const k = col.cells.get(n); if (!k) return { vals: [['', null]] }; if (k.st === 'missing' || k.st === 'excused') return { st: k.st, vals: [['', null]] };
        return { vals: [['', k.total != null ? fmtNum(k.total) : k.pct != null ? k.pct + '%' : null]] }; };
    }
  }
  for (const i of B.mbSorted(c.names, how)) { const r = get(c.names[i]); rows.push({ i, name: c.names[i], vals: r.vals, st: r.st || '' }); }
  return { rows, max };
}

function EntryList({ x, lib, term, first, onClose, win }) {
  const tasks = tasksOf(x);
  const [key, setKey] = useState(tasks.some(k => k.key === first) ? first : tasks.length ? tasks[0].key : '');
  const [how, setHow] = useState(orderOf(lib)), [cur, setCur] = useState(0), [done, setDone] = useState(() => new Set());
  const { rows, max } = rowsOf(x, key, term, how), at = Math.max(0, Math.min(rows.length - 1, cur));
  useEffect(() => { const el = (win || window).document.querySelector('[data-mb] li.cur'); if (el) el.scrollIntoView({ block: 'nearest' }); });
  const tick = j => { const r = rows[j]; if (!r) return; const d = new Set(done);
    if (d.has(r.i)) { d.delete(r.i); setCur(j); } else { d.add(r.i); const nx = rows.findIndex((y, k) => k > j && !d.has(y.i)); setCur(nx >= 0 ? nx : j); } setDone(d); };
  const step = by => { const r = rows[at]; if (!r) return; const d = new Set(done);
    if (by > 0) { d.add(r.i); setCur(Math.min(rows.length - 1, at + 1)); } else { const j = Math.max(0, at - 1); d.delete(rows[j].i); setCur(j); } setDone(d); };
  const onKey = e => {
    if (e.target.closest && e.target.closest('select, button')) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape' && !win) onClose();
  };
  const order = v => { setHow(v); setCur(0); change(t('class.u_mb_order'), l => { if (v) l.me = { ...(l.me || {}), mbOrder: v }; else if (l.me) delete l.me.mbOrder; }, true); };
  const copy = () => copyText(rows.map(r => (r.st ? '' : r.vals.map(v => (v[1] == null ? '' : String(v[1]).replace('%', ''))).join('\t'))).join('\n')).then(ok => setCopied(ok ? 1 : -1));
  const [copied, setCopied] = useState(0);
  return <div class="mbx" data-mb tabIndex={-1} onKeyDown={onKey}>
    <header><b>{t('class.mb_title')}</b><span data-raw>{x.c.name}</span><button type="button" onClick={onClose} data-mb-close>{t('class.mb_close')}</button></header>
    <select value={key} aria-label={t('class.mb_task')} onChange={e => { setKey(e.currentTarget.value); setDone(new Set()); setCur(0); }} data-mb-task>{tasks.map(k => <option value={k.key}>{k.name}</option>)}</select>
    <div class="mbseg" role="group" aria-label={t('class.mb_order')}>{ORDERS.map(([v, l]) => <button type="button" aria-pressed={String(how === v)} onClick={() => order(v)} data-mb-order={v}>{t(l)}</button>)}</div>
    <div class="mbcount"><span>{t('class.mb_done', { n: done.size, of: rows.length })}{max ? ' · ' + t('class.out_of', { n: fmtNum(max) }) : ''}</span>
      {done.size > 0 && <button type="button" onClick={() => { setDone(new Set()); setCur(0); }} data-mb-reset>{t('class.mb_over')}</button>}
      {x.way !== 'myp' && <button type="button" onClick={copy} data-mb-copy>{copied > 0 ? t('class.mb_copied') : copied < 0 ? t('class.copy_failed') : t('class.copy_scores')}</button>}</div>
    <ol>{rows.map((r, j) => <li class={(j === at ? 'cur' : '') + (done.has(r.i) ? ' done' : '')} onClick={() => tick(j)} data-mb-row={j}>
      <span class="mbok" aria-hidden="true">{done.has(r.i) ? '✓' : ''}</span><span class="mbn" data-raw>{r.name}</span>
      <span class="mbv">{r.st ? <span class="mbst">{t(r.st === 'missing' ? 'class.missing' : 'class.excused')}</span> : r.vals.map(([k, v]) => <span class="mbc">{k && <i>{k}</i>}{v == null ? <span class="mbno">–</span> : String(v)}</span>)}</span></li>)}</ol>
    <p class="mbhint">{t('class.mb_hint')}</p>
  </div>;
}

// Opens the list: its own small window where the browser allows it (given this page's styles), else a panel on this page.
let open = null;
export function openEntry(x, lib, term, key) {
  if (open) open.close();
  const W = 400, H = Math.min(900, (screen.availHeight || 800) - 60), L = Math.max(0, (screen.availLeft || 0) + (screen.availWidth || 1200) - W - 16);
  let w = null; try { w = window.open('about:blank', 'gsEntryList', 'popup,width=' + W + ',height=' + H + ',left=' + L + ',top=' + ((screen.availTop || 0) + 30)); } catch {}
  let host, close;
  if (w && w.document) {
    const d = w.document; d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"><title></title></head><body class="mbwin"></body></html>'); d.close();
    d.title = t('class.mb_title') + ' · ' + x.c.name;
    d.documentElement.className = document.documentElement.className; for (const k of Object.keys(document.documentElement.dataset)) d.documentElement.dataset[k] = document.documentElement.dataset[k];
    for (const s of document.querySelectorAll('style, link[rel="stylesheet"]')) d.head.appendChild(d.importNode(s, true));
    host = d.body; close = () => { render(null, host); if (!w.closed) w.close(); open = null; };
    w.addEventListener('pagehide', () => { if (open && open.w === w) open = null; });
  } else {
    host = document.createElement('div'); host.className = 'mbpanel'; document.body.appendChild(host);
    close = () => { render(null, host); host.remove(); open = null; };
  }
  render(<EntryList x={x} lib={lib} term={term} first={key} onClose={() => close()} win={w} />, host);
  open = { w, close };
  const el = host.querySelector('[data-mb]'); if (el) el.focus();
}
