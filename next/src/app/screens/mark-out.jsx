// Grades, Insights and Return (design screenshot 6's other three tabs), loaded as a part of their own when one of them opens
// (router.js PARTS.out). What each shows and makes is the current app's (mark/out.js, over engines/gexport.js): the Grades tab's
// rows and copies (src/app/dialogs.js openGrades), Insights' summary (src/rubrics.js ovDraw), and Return's files (src/app/export.js
// openExport, src/tabs.js returnSideHtml). E is mark/out.js, loaded by the marking screen with its libraries.
import { h, Fragment } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { Button, Checkbox, Segmented, Icon, Progress, Card, EmptyState, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { state, fmtNum, fmtPct, rowsTop, maxPoints } from '../../engines/gcore.js';
import { shownName, anonOn } from '../../engines/gdraw.js';
import '../mark/lines.js';

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch {} a.remove(); return true; }
}
const cut = s => (s.length > 40 ? s.slice(0, 40) + '…' : s);
const copyCell = v => copy(v).then(() => toast(v ? t('mark.copied', { text: cut(v) }) : t('mark.copied_empty')));
const Cell = ({ v, children, cls = '' }) => <td class={cls}><button type="button" class="cp" data-copy={v} onClick={() => copyCell(v)}>{children == null ? v : children}</button></td>;

/* ---------------- Grades ---------------- */
export function Grades({ E, onOpen }) {
  const [, tick] = useState(0), s = state(), su = s.setup, rub = su.mode === 'rubric', ib = E.X.ibSetup(), b = s.batch;
  const cls = b.classId != null ? (s.lib.classes || []).find(c => c.id === b.classId) : null;
  const banded = !ib && !!(E.X.meGrade() || {}).bands, rows = E.rows();
  const save = (name, blob) => E.saveFile(name, blob);
  const copyAll = async k => { const r = E.copyText(k); await copy(r.text); toast(t('mark.copied_rows', { n: r.n })); };
  return <section class="mk-out mk-grades" aria-labelledby="mk-g-h">
    <header class="oh"><h2 id="mk-g-h" class="t3">{t('mark.grades')}</h2><span class="mute" id="glSum">{E.summary()}</span>
      {cls && <Segmented label={t('mark.g_order')} size="sm" value={E.order()} onChange={v => { E.setOrder(v); tick(n => n + 1); }}
        options={[{ value: 'folder', label: t('mark.g_folder') }, { value: 'roster', label: t('mark.g_roster', { name: cls.name }) }]} />}</header>
    <p class="mute help">{t('mark.g_help')}</p>
    <div class="tbl gl"><table id="glTable"><thead><tr><th>{t('mark.g_num')}</th><th>{t('mark.g_student')}</th>
      {rub && su.criteria.map(c => <th data-raw>{c}</th>)}
      {ib ? <th>{t('mark.g_status')}</th> : <><th>{t('mark.g_total', { n: maxPoints() })}</th><th>{t('mark.g_pct')}</th></>}
      {banded && <th>{t('mark.g_band')}</th>}<th title={t('mark.g_paper_tip')}>{t('mark.g_paper')}</th><th>{t('mark.g_comment')}</th></tr></thead>
      <tbody>{rows.map(r => r.missing
        ? <tr class="gap"><td class="n">{r.n}</td><td class="nm"><span data-raw>{r.missing}</span> <span class="mute">{t('mark.g_no_folder')}</span></td>
          {rub && su.criteria.map(() => <td />)}<td />{!ib && <td />}{banded && <td />}<td /><td /></tr>
        : <tr data-i={r.i}><td class="n">{r.n}</td>
          <td class="nm"><button type="button" class="link" onClick={() => onOpen(r.i)} data-raw>{shownName(r.st, r.i)}</button>
            {r.none && <span class="mute"> {t('mark.g_none_in')}</span>}{r.off && <span class="pill warn">{t('mark.g_off')}</span>}</td>
          {r.rows.map(v => <Cell v={v} cls="c" />)}
          <Cell v={ib ? '' : r.total} cls="c">{ib ? '' : r.totalText}{r.status && <span class="stag">{r.status.toLowerCase()}</span>}</Cell>
          {!ib && <Cell v={r.pct} cls="c">{fmtPct(r.g.pct)}</Cell>}
          {banded && <Cell v={r.band} cls="c" />}
          <td class="op">{paperCell(r.paper)}</td>
          <Cell v={r.comment} cls="cm"><span data-raw>{r.comment}</span></Cell></tr>)}</tbody></table></div>
    <footer class="of">
      {ib ? <Button onClick={() => copyAll('lv')}>{t('mark.g_copy_levels')}</Button>
        : <><Button onClick={() => copyAll('total')}>{t('mark.g_copy_totals')}</Button><Button onClick={() => copyAll('pct')}>{t('mark.g_copy_pcts')}</Button></>}
      <Button onClick={() => copyAll('tsv')}>{t('mark.g_copy_table')}</Button>
      <Button onClick={async () => save('Grade sheet - ' + b.name + '.pdf', await E.sheetPdf())}>{t('mark.g_sheet')}</Button>
      <Button variant="primary" icon="download" onClick={() => save('Grades - ' + b.name + '.csv', new Blob([E.csv()], { type: 'text/csv' }))}>{t('mark.g_csv')}</Button>
    </footer>
  </section>;
}
function paperCell(p) {
  if (!p) return <span class="mute">–</span>;
  if (p.ask === 'many') return <span class="pill warn">{t('mark.g_pick', { n: p.n })}</span>;
  if (p.ask === 'confirm') return <span class="pill warn">{t('mark.g_confirm', { said: p.said })}</span>;
  return <><span class="opv">{p.said}</span>{p.differs && <span class="pill warn" title={p.differs}>{t('mark.g_differs')}</span>}</>;
}

/* ---------------- Insights ---------------- */
const oneDp = v => fmtNum(Math.round(v * 10) / 10);
export function Insights({ E, onOpen }) {
  const s = useMemo(() => E.stats(), [E]), ib = E.X.ibSetup(), su = state().setup;
  const tile = (l, v, sub, main) => <div class={'tile' + (main ? ' main' : '')}><div class="tl">{l}</div><div class="tv num">{v}</div>{sub && <div class="ts mute">{sub}</div>}</div>;
  const of = v => fmtNum(v) + ' / ' + fmtNum(s.max);
  const most = s.bins.length ? Math.max(1, ...s.bins.map(x => x.who.length)) : 1;
  const groups = [['mark.i_not_scored', s.notScored], ['mark.i_partial', s.partial], ['mark.i_missing', s.missing], ['mark.i_excused', s.excused], ['mark.i_off_scale', s.offScale], ['mark.i_own_off', s.ownOff], ['mark.i_left_out', s.leftOut], ['mark.i_late', s.counted.filter(x => x.late)]].filter(g => g[1].length);
  return <section class="mk-out mk-ins" aria-labelledby="mk-i-h">
    <header class="oh"><h2 id="mk-i-h" class="t3">{t('mark.insights')}</h2></header>
    <p class="mute" id="ovLeft">{E.leftOut(s)}</p>
    {s.n > 0 && !ib && <div class="tiles" id="ovTiles">{s.meanPct != null
      ? <>{tile(t('mark.i_average'), E.X.pctAvgText(s.meanPct), oneDp(s.mean) + ' / ' + fmtNum(s.max), true)}{tile(t('mark.i_middle'), s.medPct + '%', of(s.median))}{tile(t('mark.i_lowest'), s.lowPct + '%', of(s.low))}{tile(t('mark.i_highest'), s.highPct + '%', of(s.high))}</>
      : <>{tile(t('mark.i_average'), oneDp(s.mean), '/ ' + fmtNum(s.max), true)}{tile(t('mark.i_middle'), fmtNum(s.median))}{tile(t('mark.i_lowest'), fmtNum(s.low))}{tile(t('mark.i_highest'), fmtNum(s.high))}</>}</div>}
    <div class="charts">
      {!ib && <Card title={t('mark.i_spread')} id="ovSpread">{!s.n || !s.bins.length ? <p class="mute">{t('mark.i_no_spread')}</p> : <>
        <div class="bars" role="list">{s.bins.map(x => <div class="bar" role="listitem" aria-label={x.label + ': ' + t('mark.i_students', { n: x.who.length })} title={x.who.slice(0, 12).join(', ')}>
          <i style={{ height: (x.who.length / most * 100) + '%' }} /><span class="num">{fmtNum(x.lo)}</span></div>)}</div>
        <p class="mute cap">{t('mark.i_spread_cap', { n: fmtNum(s.max) })}</p></>}</Card>}
      <Card title={t('mark.i_rows')} id="ovRows">{su.mode !== 'rubric' ? <p class="mute">{t('mark.i_total_only')}</p> : !s.rows.some(x => x.n) ? <p class="mute">{t('mark.i_no_rows')}</p> : <>
        <div class="rowsb">{s.rows.map(x => <div class="rb" aria-label={x.name + ': ' + (x.n ? oneDp(x.avg) : '–')}>
          <div class="rn"><span data-raw>{x.name}</span>{x.lowest && <span class="stag">{t('mark.i_lowest_tag')}</span>}</div>
          <div class="rt"><i class={x.lowest ? 'on' : ''} style={{ width: (x.n ? Math.min(100, x.avg / x.top * 100) : 0) + '%' }} /></div>
          <span class="rv num">{x.n ? oneDp(x.avg) : '–'}{!rowsTop(su) && x.n ? ' / ' + x.top : ''}</span></div>)}</div>
        <p class="mute cap">{t('mark.i_rows_cap')}</p></>}</Card>
    </div>
    <Card title={t('mark.i_who')} id="ovWho">
      {!(s.notScored.length + s.partial.length + s.rosterOnly.length) && <p class="ok">{t('mark.i_all_done')}</p>}
      {groups.map(([k, list]) => <details open class="who"><summary>{t(k)} ({list.length})</summary>
        <ul>{list.map(o => <li><button type="button" class="link" onClick={() => onOpen(o.i)} data-raw>{o.name}</button>{o.note && <span class="mute"> {o.note}</span>}</li>)}</ul></details>)}
      {s.rosterOnly.length > 0 && <details open class="who"><summary>{t('mark.i_roster_only')} ({s.rosterOnly.length})</summary>
        {!anonOn() && <ul>{s.rosterOnly.map(n => <li data-raw>{n}</li>)}</ul>}</details>}
    </Card>
  </section>;
}

/* ---------------- Return ---------------- */
const when = ms => { const d = new Date(ms); return d.toDateString() === new Date().toDateString() ? t('mark.r_today', { t: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }) : t('mark.r_on', { d: d.toLocaleDateString([], { day: 'numeric', month: 'short' }) }); };
export function Return({ E, cur, onOpen }) {
  const [, tick] = useState(0), [say, setSay] = useState(''), [bar, setBar] = useState(null), [keep, setKeep] = useState(true), [sheet, setSheet] = useState(true), [dpi, setDpi] = useState(150);
  const s = state(), b = s.batch, p = E.plan(), o = E.opts(), redo = () => tick(n => n + 1);
  const r = b.returned || {}, canDir = !!(window.showDirectoryPicker && window.self === window.top);
  const opt = (k, v) => { E.setOpt(k, v); redo(); };
  const go = async toDir => {
    if (E.exporting()) return toast(t('mark.r_busy'));
    let dir = null;
    if (toDir) { try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'grading-studio' }); } catch (er) { if (er && er.name !== 'AbortError') toast(t('mark.r_dir_no')); return; } }
    setBar(0);
    try {
      const out = await E.exportAll({ keep, dpi, sheet, dir, onStep: (k, n, of) => { if (k === 'read') { setSay(t('mark.r_reading')); setBar(of ? 0.3 * n / of : 0); } else { setSay(t('mark.r_baking', { n: Math.min(n + 1, of), of })); setBar(0.3 + 0.7 * (of ? n / of : 1)); } } });
      if (!out.nOut && !out.zip) setSay(t('mark.r_none'));
      else { if (out.zip) E.saveFile(out.name, out.zip); setSay((dir ? t('mark.r_done_dir', { n: out.nOut, dir: dir.name }) : t('mark.r_done_zip', { n: out.nOut })) + (r.ok ? '' : ' ' + t('mark.r_once'))); }
      if (out.failed.length) toast(t('mark.r_failed', { n: out.failed.length, list: out.failed.map(f => f.path.split('/').pop() + ' (' + f.why + ')').join(', ') }), { ms: 8000 });
    } catch (er) { console.error(er); setSay(t('mark.r_wrong', { why: er.message || String(er) })); }
    setBar(null); redo();
  };
  const st = b.students[cur], who = st && st.files.length ? shownName(st, cur) : '';
  const one = async () => {
    if (E.exporting()) return toast(t('mark.r_busy'));
    try {
      const x = await E.exportOne(st);
      if (x.none) toast(t('mark.r_one_nothing', { name: who }));
      else { E.saveFile(x.name, x.blob); toast(x.n === 1 ? t('mark.r_one_saved', { name: x.name }) : t('mark.r_one_zip', { n: x.n })); }
    } catch (er) { console.error(er); toast(t('mark.r_wrong', { why: er.message || String(er) })); }
    redo();
  };
  const sent = b.students.map((x, i) => ({ x, i })).filter(y => y.x.grade.sent).sort((a, c) => c.x.grade.sent - a.x.grade.sent);
  const state1 = <p class="rtdone" id="rtState">{r.ok
    ? <><span>✓ {t('mark.r_returned', { when: when(r.ok) })}</span> <Button size="sm" variant="quiet" data-unreturn onClick={() => { E.marking().markReturned(false); toast(t('mark.r_unmarked')); redo(); }}>{t('mark.r_unmark')}</Button></>
    : <><span>{r.t ? t('mark.r_exported', { when: when(r.t), n: r.n || 0 }) : ''}</span> <Button size="sm" data-doreturn onClick={() => { E.marking().markReturned(true); toast(t('mark.r_marked')); redo(); }}>{t('mark.r_mark')}</Button></>}</p>;
  const earlyBox = p.early.length > 0 && <Checkbox label={t('mark.r_early', { n: p.early.length })} checked={o.early} onChange={v => opt('early', v)} />;
  return <section class="mk-out mk-ret" aria-labelledby="mk-r-h">
    <div class="rtmain">
      <header class="oh"><h2 id="mk-r-h" class="t3">{t('mark.return')}</h2></header>
      {p.files ? <>
        <p class="big t2" id="rtReady">{t('mark.r_ready', { n: p.files })}</p>
        <p class="mute">{t('mark.r_from', { n: p.students })}{p.skipped > 0 && ' ' + t('mark.r_skipped', { n: p.skipped })}{p.left > 0 && ' ' + t('mark.r_left', { n: p.left })}</p>
        {earlyBox}
        <div class="go"><Button variant="primary" icon="download" data-go="zip" disabled={bar != null} onClick={() => go(false)}>{t('mark.r_zip')}</Button>
          {canDir && <Button data-go="dir" disabled={bar != null} onClick={() => go(true)}>{t('mark.r_dir')}</Button>}</div>
        {bar != null && <Progress value={bar} max={1} label={say} />}
        <p class="mute" role="status" id="xStatus">{say}</p>
        {state1}
        <details class="xopts"><summary>{t('mark.r_options')}</summary>
          <Checkbox label={t('mark.r_keep')} checked={keep} onChange={setKeep} />
          <Checkbox label={t('mark.r_one')} checked={o.one} onChange={v => opt('one', v)} /><p class="hint mute">{t('mark.r_one_hint')}</p>
          <Checkbox label={t('mark.r_names')} checked={o.names} onChange={v => opt('names', v)} />
          <p class="hint mute">{o.names ? (p.example ? t('mark.r_names_like', { name: anonOn() ? '…' : p.example }) : '') : t('mark.r_names_off')}</p>
          <Checkbox label={t('mark.r_sheet')} checked={sheet} onChange={setSheet} />
          <Checkbox label={t('mark.r_edit')} checked={o.edit} onChange={v => opt('edit', v)} /><p class="hint mute">{t('mark.r_edit_hint')}</p>
          <Checkbox label={t('mark.r_key')} checked={o.key} onChange={v => opt('key', v)} />
          <Checkbox label={t('mark.r_fb')} checked={o.fb} onChange={v => opt('fb', v)} /><p class="hint mute">{t('mark.r_fb_hint')}</p>
          <Checkbox label={t('mark.r_all')} checked={o.all} onChange={v => opt('all', v)} />
          <div class="sharp"><span>{t('mark.r_sharp')}</span><Segmented size="sm" label={t('mark.r_sharp')} value={String(dpi)} onChange={v => setDpi(+v)} options={[{ value: '150', label: t('mark.r_standard') }, { value: '220', label: t('mark.r_extra') }]} /></div>
        </details>
        <p class="mute foot">{t('mark.r_foot')}</p>
      </> : <>
        <p>{p.nOut ? t('mark.r_all_early') : t('mark.r_nothing')}</p>{earlyBox}
        <Checkbox label={t('mark.r_all')} checked={o.all} onChange={v => opt('all', v)} />{state1}
      </>}
    </div>
    <aside class="rtside">
      <Card title={t('mark.r_one_title')} id="rtOne"><p class="mute">{t('mark.r_one_text')}</p>
        {sent.length > 0 && <ul class="sent">{sent.slice(0, 6).map(y => <li><button type="button" class="link" onClick={() => onOpen(y.i)} data-raw>{shownName(y.x, y.i)}</button> <span class="mute">{t('mark.r_sent', { when: when(y.x.grade.sent) })}</span></li>)}
          {sent.length > 6 && <li class="mute">{t('mark.r_more', { n: sent.length - 6 })}</li>}</ul>}
        {who ? <Button data-rtone onClick={one}>{t('mark.r_one_btn', { name: who })}</Button> : <p class="mute">{t('mark.r_one_none')}</p>}</Card>
    </aside>
  </section>;
}

// The tab, read once the papers have been read (a grade written on a paper counts), as the current app reads them first.
export default function Out({ tab, E, cur, onOpen }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { let live = true; E.readPapers().then(() => live && setOk(true), e => { console.error(e); if (live) setOk(true); }); return () => { live = false; }; }, [E]);
  if (!ok) return <div class="loading" aria-busy="true" aria-label={t('mark.reading')} />;
  const P = { E, cur, onOpen };
  return tab === 'grades' ? <Grades {...P} /> : tab === 'insights' ? <Insights {...P} /> : tab === 'return' ? <Return {...P} /> : <EmptyState title="" />;
}
