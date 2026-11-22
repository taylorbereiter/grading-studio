// Scores on a phone (src/phone.js phScoresRender, phOneRender, phPut): the class's assignments, newest first with the ones still
// waiting for scores at the top, then one assignment with a box per student. Saved the way typing in the gradebook saves (bkParse,
// bkPut), so the gradebook and the term grades read them as typed in there. A scored paper shows its score; it changes in the paper.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, IconButton, Menu, Dialog, TextInput, HeldInput, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine as B, change } from '../../students/book.js';
import { fmtNum } from '../../engines/gcore.js';
import { itemIn } from './bookedit.jsx';
import { typeName } from './grades.jsx';
import './lines.js';

const keep = (k, v) => { try { if (v === undefined) return sessionStorage.getItem('gsn.ph.' + k); if (v) sessionStorage.setItem('gsn.ph.' + k, v); else sessionStorage.removeItem('gsn.ph.' + k); } catch {} return null; };
// How far along a column is: students with a score, Missing or Excused, out of the roster (phCount).
// A list of items is one stop in the Tab order: arrow keys move inside it.
const rove = e => { const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0; if (!d) return; const all = [...e.currentTarget.querySelectorAll('.phitem')], nx = all[all.indexOf(document.activeElement) + d]; if (nx) { e.preventDefault(); nx.focus(); } };
const countOf = (c, col) => c.names.filter(n => { const k = col.cells.get(n); return k && (k.pct != null || k.st === 'missing' || k.st === 'excused' || k.xc || k.fb); }).length;
function put(col, n, rec, label) {
  return change(label || t('class.u_score'), l => {
    const it = col.it && itemIn(l, col.it.id); if (!it) return;
    if (!it.typed && col.d) it.typed = { max: B.bkColMax(col), s: {} };
    if (!it.typed) it.typed = { max: null, s: {} };
    B.bkUse({ cls: col.cls }); B.bkPut({ ...col, it, typed: it.typed }, n, rec);
  }, true);
}

export function PhoneScores({ x, onTable }) {
  const { c } = x, [key, setKey] = useState(() => keep('col:' + c.id)), [start, setStart] = useState(null);
  const open = k => { setKey(k); keep('col:' + c.id, k || ''); };
  const col = key && x.cols.find(k => k.key === key);
  if (col) return <One c={c} col={col} onBack={() => open(null)} />;
  const rows = x.cols.slice().reverse().map(k => ({ k, n: countOf(c, k) })).sort((a, b) => (a.n >= c.names.length) - (b.n >= c.names.length));
  const fresh = c.units.flatMap(u => u.items).filter(it => !x.cols.some(k => k.it && k.it.id === it.id) && it.type !== 'fm' && !it.done);
  const label = id => { const k = B.bkCats().find(y => y[0] === id); return typeName(id, k && k[2]); };
  return <section class="phs" data-phone-scores>
    <div class="lhead"><h2>{t('class.ph_asg')}</h2><span class="end"><Button size="sm" onClick={onTable} data-ph-table>{t('class.ph_table')}</Button></span></div>
    <div class="card phlist" data-rove onKeyDown={rove}>{rows.length ? rows.map(({ k, n }, j) => <button type="button" class="phitem" tabIndex={j ? -1 : 0} onClick={() => open(k.key)} data-ph-col={k.key}>
      <span class="phn"><b data-raw>{k.name}</b><small>{[k.due ? t('class.ph_due', { day: B.bkDay(k.due) }) : '', k.d ? t('class.ph_papers') : '', label(k.type)].filter(Boolean).join(' · ')}</small></span>
      <span class={'phc' + (n >= c.names.length ? ' done' : '')}>{n >= c.names.length ? '✓' : n + ' / ' + c.names.length}</span></button>) : <p class="mute">{t('class.ph_none')}</p>}</div>
    {fresh.length > 0 && <><h3 class="sub">{t('class.ph_start')}</h3>
      <div class="card phlist" data-rove onKeyDown={rove}>{fresh.slice(-8).reverse().map((it, j) => <button type="button" class="phitem" tabIndex={j ? -1 : 0} onClick={() => setStart(it)} data-ph-new={it.id}><span class="phn"><b data-raw>{it.name}</b><small>{it.due ? t('class.ph_due', { day: B.bkDay(it.due) }) : t('class.ph_no_scores')}</small></span></button>)}</div></>}
    {start && <StartBox it={start} onClose={ok => { setStart(null); if (ok) open(start.id); }} />}
  </section>;
}
// An assignment with no scores yet: what it is out of, or empty for percents.
function StartBox({ it, onClose }) {
  const [v, setV] = useState('');
  const go = async () => { const max = parseFloat(String(v).replace(',', '.')); await change(t('class.u_score'), l => { const k = itemIn(l, it.id); if (k) k.typed = { max: max > 0 ? max : null, s: {} }; }, true); onClose(true); };
  return <Dialog open title={<span data-raw>{it.name}</span>} onClose={() => onClose(false)} actions={<><Button onClick={() => onClose(false)}>{t('common.cancel')}</Button><Button variant="primary" onClick={go} data-ph-start>{t('class.ph_go')}</Button></>}>
    <TextInput label={t('class.ph_out_of')} value={v} onInput={setV} inputMode="decimal" autofocus data-ph-max />
  </Dialog>;
}
function One({ c, col, onBack }) {
  const max = col.typed && col.typed.max, s = (col.typed && col.typed.s) || {}, fm = col.type === 'fm' && !(col.typed && col.typed.lv);
  const done = countOf(c, col), [see, setSee] = useState(null);   // See the paper (class/phsee.jsx)
  const keyDown = e => { if (e.key !== 'Enter') return; e.preventDefault(); const all = [...e.currentTarget.closest('.phstus').querySelectorAll('.phin')], nx = all[all.indexOf(e.currentTarget) + 1]; if (nx) nx.focus(); else e.currentTarget.blur(); };
  // a score is read when she leaves the box (Enter moves on), and what she types is held while she is in it: a plain onChange is a
  // save per key here (preact/compat), and a redraw from that save put the saved score back under her cursor ("8." went back to "8", so 8.5 was saved as 85)
  const typed = (n, text) => { const r = s[n] || {}, rec = B.bkParse(text, r, col); if (rec === undefined) return toast(t('class.not_a_score')); if (JSON.stringify(rec) !== JSON.stringify(B.bkParse(B.bkCellVal(r, col), r, col))) put(col, n, rec); };
  return <section class="phs" data-ph-one={col.key}>
    {see && <see.P col={col} c={c} n={see.n} score={see.score} onClose={() => setSee(null)} />}
    <div class="phtop"><Button size="sm" icon="chl" onClick={onBack} data-ph-back><span data-raw>{c.name}</span></Button></div>
    <h2 class="phtitle" data-raw>{col.name}</h2>
    <p class="mute small">{[max ? t('class.ph_max', { n: fmtNum(+max) }) : '', t('class.ph_done', { n: done, of: c.names.length }), fm ? t('class.ph_tap_fb') : t('class.ph_saved')].filter(Boolean).join(' · ')}</p>
    {col.d && <p class="mute small">{t('class.ph_paper_say')}</p>}
    <div class="card phstus">{c.names.map(n => {
      const cell = col.cells.get(n), paper = col.d && cell && !cell.typed, r = s[n] || {}, st = (paper ? cell.st : r.st) || '';
      const val = paper ? (cell.total != null ? fmtNum(cell.total) + (cell.max ? ' / ' + fmtNum(cell.max) : '') : cell.pct != null ? cell.pct + '%' : '') : B.bkCellVal(r, col);
      return <div class={'phstu' + (st ? ' st-' + st : '')} data-ph-stu={n}><span class="phname" data-raw>{n}</span>
        {fm && !paper ? <Button size="sm" variant={r.fb ? 'primary' : undefined} aria-pressed={String(!!r.fb)} onClick={() => put(col, n, { ...r, v: null, fb: !r.fb })} data-ph-fb>{r.fb ? t('class.fb_done') : t('class.ph_fb_q')}</Button>
          : paper ? <><span class="phpaper" title={t('class.ph_on_paper')}>{val || (st ? t(st === 'missing' ? 'class.missing' : 'class.excused') : '–')}</span>
            <IconButton size="sm" icon="eye" label={t('class.ph_see', { name: n })} onClick={() => import('./phsee.jsx').then(m => setSee({ P: m.PhSee, n, score: val }), e => console.error(e))} data-phsee={n} /></>
          : <><HeldInput class="input phin" type="text" inputMode="decimal" enterKeyHint="next" autoComplete="off" value={st === 'missing' || st === 'excused' ? '' : val} placeholder={st === 'missing' ? t('class.missing') : st === 'excused' ? t('class.excused') : '–'}
              aria-label={t('class.cell_label', { name: n })} onBlur={e => typed(n, e.currentTarget.value)} onKeyDown={keyDown} data-ph-in />
            <Menu label={t('class.ph_more_for', { name: n })} items={[{ label: t('class.missing'), onSelect: () => put(col, n, { v: null, st: 'missing' }) }, { label: t('class.excused'), onSelect: () => put(col, n, { v: null, st: 'excused' }) }, { label: t('class.ph_clear'), onSelect: () => put(col, n, null, t('class.u_cleared')) }]}
              trigger={m => <IconButton {...m} size="sm" icon="dots" label={t('class.ph_more_for', { name: n })} data-ph-more />} /></>}
      </div>; })}</div>
  </section>;
}
