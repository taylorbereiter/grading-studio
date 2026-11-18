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
import '../mark/setup-lines.js';

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch {} a.remove(); return true; }
}
const cut = s => (s.length > 40 ? s.slice(0, 40) + '…' : s);
const copyCell = v => copy(v).then(() => toast(v ? t('setup.copied', { text: cut(v) }) : t('setup.copied_empty')));
const Cell = ({ v, children, cls = '' }) => <td class={cls}><button type="button" class="cp" data-copy={v} onClick={() => copyCell(v)}>{children == null ? v : children}</button></td>;

/* ---------------- Grades ---------------- */
export function Grades({ E, onOpen }) {
  const [, tick] = useState(0), s = state(), su = s.setup, rub = su.mode === 'rubric', ib = E.X.ibSetup(), b = s.batch;
  const cls = b.classId != null ? (s.lib.classes || []).find(c => c.id === b.classId) : null;
  const banded = !ib && !!(E.X.meGrade() || {}).bands, rows = E.rows();
  const save = (name, blob) => E.saveFile(name, blob);
  const copyAll = async k => { const r = E.copyText(k); await copy(r.text); toast(t('setup.copied_rows', { n: r.n })); };
  return <section class="mk-out mk-grades" aria-labelledby="mk-g-h">
    <header class="oh"><h2 id="mk-g-h" class="t3">{t('mark.grades')}</h2><span class="mute" id="glSum">{E.summary()}</span>
      {cls && <Segmented label={t('setup.g_order')} size="sm" value={E.order()} onChange={v => { E.setOrder(v); tick(n => n + 1); }}
        options={[{ value: 'folder', label: t('setup.g_folder') }, { value: 'roster', label: t('setup.g_roster', { name: cls.name }) }]} />}</header>
    <p class="mute help">{t('setup.g_help')}</p>
    <div class="tbl gl"><table id="glTable"><thead><tr><th>{t('setup.g_num')}</th><th>{t('setup.g_student')}</th>
      {rub && su.criteria.map(c => <th data-raw>{c}</th>)}
      {ib ? <th>{t('setup.g_status')}</th> : <><th>{t('setup.g_total', { n: maxPoints() })}</th><th>{t('setup.g_pct')}</th></>}
      {banded && <th>{t('setup.g_band')}</th>}<th title={t('setup.g_paper_tip')}>{t('setup.g_paper')}</th><th>{t('setup.g_comment')}</th></tr></thead>
      <tbody>{rows.map(r => r.missing
        ? <tr class="gap"><td class="n">{r.n}</td><td class="nm"><span data-raw>{r.missing}</span> <span class="mute">{t('setup.g_no_folder')}</span></td>
          {rub && su.criteria.map(() => <td />)}<td />{!ib && <td />}{banded && <td />}<td /><td /></tr>
        : <tr data-i={r.i}><td class="n">{r.n}</td>
          <td class="nm"><button type="button" class="link" onClick={() => onOpen(r.i)} data-raw>{shownName(r.st, r.i)}</button>
            {r.none && <span class="mute"> {t('setup.g_none_in')}</span>}{r.off && <span class="pill warn">{t('setup.g_off')}</span>}</td>
          {r.rows.map(v => <Cell v={v} cls="c" />)}
          <Cell v={ib ? '' : r.total} cls="c">{ib ? '' : r.totalText}{r.status && <span class="stag">{r.status.toLowerCase()}</span>}</Cell>
          {!ib && <Cell v={r.pct} cls="c">{fmtPct(r.g.pct)}</Cell>}
          {banded && <Cell v={r.band} cls="c" />}
          <td class="op">{paperCell(r.paper)}</td>
          <Cell v={r.comment} cls="cm"><span data-raw>{r.comment}</span></Cell></tr>)}</tbody></table></div>
    <footer class="of">
      {ib ? <Button onClick={() => copyAll('lv')}>{t('setup.g_copy_levels')}</Button>
        : <><Button onClick={() => copyAll('total')}>{t('setup.g_copy_totals')}</Button><Button onClick={() => copyAll('pct')}>{t('setup.g_copy_pcts')}</Button></>}
      <Button onClick={() => copyAll('tsv')}>{t('setup.g_copy_table')}</Button>
      <Button onClick={async () => save('Grade sheet - ' + b.name + '.pdf', await E.sheetPdf())}>{t('setup.g_sheet')}</Button>
      <Button variant="primary" icon="download" onClick={() => save('Grades - ' + b.name + '.csv', new Blob([E.csv()], { type: 'text/csv' }))}>{t('setup.g_csv')}</Button>
    </footer>
  </section>;
}
function paperCell(p) {
  if (!p) return <span class="mute">–</span>;
  if (p.ask === 'many') return <span class="pill warn">{t('setup.g_pick', { n: p.n })}</span>;
  if (p.ask === 'confirm') return <span class="pill warn">{t('setup.g_confirm', { said: p.said })}</span>;
  return <><span class="opv">{p.said}</span>{p.differs && <span class="pill warn" title={p.differs}>{t('setup.g_differs')}</span>}</>;
}

/* ---------------- Insights ---------------- */
const oneDp = v => fmtNum(Math.round(v * 10) / 10);
export function Insights({ E, onOpen }) {
  const s = useMemo(() => E.stats(), [E]), ib = E.X.ibSetup(), su = state().setup;
  const tile = (l, v, sub, main) => <div class={'tile' + (main ? ' main' : '')}><div class="tl">{l}</div><div class="tv num">{v}</div>{sub && <div class="ts mute">{sub}</div>}</div>;
  const of = v => fmtNum(v) + ' / ' + fmtNum(s.max);
  const most = s.bins.length ? Math.max(1, ...s.bins.map(x => x.who.length)) : 1;
  const groups = [['setup.i_not_scored', s.notScored], ['setup.i_partial', s.partial], ['setup.i_missing', s.missing], ['setup.i_excused', s.excused], ['setup.i_off_scale', s.offScale], ['setup.i_own_off', s.ownOff], ['setup.i_left_out', s.leftOut], ['setup.i_late', s.counted.filter(x => x.late)]].filter(g => g[1].length);
  return <section class="mk-out mk-ins" aria-labelledby="mk-i-h">
    <header class="oh"><h2 id="mk-i-h" class="t3">{t('mark.insights')}</h2></header>
    <p class="mute" id="ovLeft">{E.leftOut(s)}</p>
    {s.n > 0 && !ib && <div class="tiles" id="ovTiles">{s.meanPct != null
      ? <>{tile(t('setup.i_average'), E.X.pctAvgText(s.meanPct), oneDp(s.mean) + ' / ' + fmtNum(s.max), true)}{tile(t('setup.i_middle'), s.medPct + '%', of(s.median))}{tile(t('setup.i_lowest'), s.lowPct + '%', of(s.low))}{tile(t('setup.i_highest'), s.highPct + '%', of(s.high))}</>
      : <>{tile(t('setup.i_average'), oneDp(s.mean), '/ ' + fmtNum(s.max), true)}{tile(t('setup.i_middle'), fmtNum(s.median))}{tile(t('setup.i_lowest'), fmtNum(s.low))}{tile(t('setup.i_highest'), fmtNum(s.high))}</>}</div>}
    <div class="charts">
      {!ib && <Card title={t('setup.i_spread')} id="ovSpread">{!s.n || !s.bins.length ? <p class="mute">{t('setup.i_no_spread')}</p> : <>
        <div class="bars" role="list">{s.bins.map(x => <div class="bar" role="listitem" aria-label={x.label + ': ' + t('setup.i_students', { n: x.who.length })} title={x.who.slice(0, 12).join(', ')}>
          <i style={{ height: (x.who.length / most * 100) + '%' }} /><span class="num">{fmtNum(x.lo)}</span></div>)}</div>
        <p class="mute cap">{t('setup.i_spread_cap', { n: fmtNum(s.max) })}</p></>}</Card>}
      <Card title={t('setup.i_rows')} id="ovRows">{su.mode !== 'rubric' ? <p class="mute">{t('setup.i_total_only')}</p> : !s.rows.some(x => x.n) ? <p class="mute">{t('setup.i_no_rows')}</p> : <>
        <div class="rowsb">{s.rows.map(x => <div class="rb" aria-label={x.name + ': ' + (x.n ? oneDp(x.avg) : '–')}>
          <div class="rn"><span data-raw>{x.name}</span>{x.lowest && <span class="stag">{t('setup.i_lowest_tag')}</span>}</div>
          <div class="rt"><i class={x.lowest ? 'on' : ''} style={{ width: (x.n ? Math.min(100, x.avg / x.top * 100) : 0) + '%' }} /></div>
          <span class="rv num">{x.n ? oneDp(x.avg) : '–'}{!rowsTop(su) && x.n ? ' / ' + x.top : ''}</span></div>)}</div>
        <p class="mute cap">{t('setup.i_rows_cap')}</p></>}</Card>
    </div>
    <Card title={t('setup.i_who')} id="ovWho">
      {!(s.notScored.length + s.partial.length + s.rosterOnly.length) && <p class="ok">{t('setup.i_all_done')}</p>}
      {groups.map(([k, list]) => <details open class="who"><summary>{t(k)} ({list.length})</summary>
        <ul>{list.map(o => <li><button type="button" class="link" onClick={() => onOpen(o.i)} data-raw>{o.name}</button>{o.note && <span class="mute"> {o.note}</span>}</li>)}</ul></details>)}
      {s.rosterOnly.length > 0 && <details open class="who"><summary>{t('setup.i_roster_only')} ({s.rosterOnly.length})</summary>
        {!anonOn() && <ul>{s.rosterOnly.map(n => <li data-raw>{n}</li>)}</ul>}</details>}
    </Card>
  </section>;
}

/* ---------------- Return ---------------- */
const when = ms => { const d = new Date(ms); return d.toDateString() === new Date().toDateString() ? t('setup.r_today', { t: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }) : t('setup.r_on', { d: d.toLocaleDateString([], { day: 'numeric', month: 'short' }) }); };
export function Return({ E, cur, onOpen }) {
  const [, tick] = useState(0), [say, setSay] = useState(''), [bar, setBar] = useState(null), [keep, setKeep] = useState(true), [sheet, setSheet] = useState(true), [dpi, setDpi] = useState(150);
  const s = state(), b = s.batch, p = E.plan(), o = E.opts(), redo = () => tick(n => n + 1);
  const r = b.returned || {}, canDir = !!(window.showDirectoryPicker && window.self === window.top);
  const opt = (k, v) => { E.setOpt(k, v); redo(); };
  const go = async toDir => {
    if (E.exporting()) return toast(t('setup.r_busy'));
    let dir = null;
    if (toDir) { try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'grading-studio' }); } catch (er) { if (er && er.name !== 'AbortError') toast(t('setup.r_dir_no')); return; } }
    setBar(0);
    try {
      const out = await E.exportAll({ keep, dpi, sheet, dir, onStep: (k, n, of) => { if (k === 'read') { setSay(t('setup.r_reading')); setBar(of ? 0.3 * n / of : 0); } else { setSay(t('setup.r_baking', { n: Math.min(n + 1, of), of })); setBar(0.3 + 0.7 * (of ? n / of : 1)); } } });
      if (!out.nOut && !out.zip) setSay(t('setup.r_none'));
      else { if (out.zip) E.saveFile(out.name, out.zip); setSay((dir ? t('setup.r_done_dir', { n: out.nOut, dir: dir.name }) : t('setup.r_done_zip', { n: out.nOut })) + (r.ok ? '' : ' ' + t('setup.r_once'))); }
      if (out.failed.length) toast(t('setup.r_failed', { n: out.failed.length, list: out.failed.map(f => f.path.split('/').pop() + ' (' + f.why + ')').join(', ') }), { ms: 8000 });
    } catch (er) { console.error(er); setSay(t('setup.r_wrong', { why: er.message || String(er) })); }
    setBar(null); redo();
  };
  const st = b.students[cur], who = st && st.files.length ? shownName(st, cur) : '';
  const one = async () => {
    if (E.exporting()) return toast(t('setup.r_busy'));
    try {
      const x = await E.exportOne(st);
      if (x.none) toast(t('setup.r_one_nothing', { name: who }));
      else { E.saveFile(x.name, x.blob); toast(x.n === 1 ? t('setup.r_one_saved', { name: x.name }) : t('setup.r_one_zip', { n: x.n })); }
    } catch (er) { console.error(er); toast(t('setup.r_wrong', { why: er.message || String(er) })); }
    redo();
  };
  const sent = b.students.map((x, i) => ({ x, i })).filter(y => y.x.grade.sent).sort((a, c) => c.x.grade.sent - a.x.grade.sent);
  const state1 = <p class="rtdone" id="rtState">{r.ok
    ? <><span>✓ {t('setup.r_returned', { when: when(r.ok) })}</span> <Button size="sm" variant="quiet" data-unreturn onClick={() => { E.marking().markReturned(false); toast(t('setup.r_unmarked')); redo(); }}>{t('setup.r_unmark')}</Button></>
    : <><span>{r.t ? t('setup.r_exported', { when: when(r.t), n: r.n || 0 }) : ''}</span> <Button size="sm" data-doreturn onClick={() => { E.marking().markReturned(true); toast(t('setup.r_marked')); redo(); }}>{t('setup.r_mark')}</Button></>}</p>;
  const earlyBox = p.early.length > 0 && <Checkbox label={t('setup.r_early', { n: p.early.length })} checked={o.early} onChange={v => opt('early', v)} />;
  return <section class="mk-out mk-ret" aria-labelledby="mk-r-h">
    <div class="rtmain">
      <header class="oh"><h2 id="mk-r-h" class="t3">{t('mark.return')}</h2></header>
      {p.files ? <>
        <p class="big t2" id="rtReady">{t('setup.r_ready', { n: p.files })}</p>
        <p class="mute">{t('setup.r_from', { n: p.students })}{p.skipped > 0 && ' ' + t('setup.r_skipped', { n: p.skipped })}{p.left > 0 && ' ' + t('setup.r_left', { n: p.left })}</p>
        {earlyBox}
        <div class="go"><Button variant="primary" icon="download" data-go="zip" disabled={bar != null} onClick={() => go(false)}>{t('setup.r_zip')}</Button>
          {canDir && <Button data-go="dir" disabled={bar != null} onClick={() => go(true)}>{t('setup.r_dir')}</Button>}</div>
        {bar != null && <Progress value={bar} max={1} label={say} />}
        <p class="mute" role="status" id="xStatus">{say}</p>
        {state1}
        <details class="xopts"><summary>{t('setup.r_options')}</summary>
          <Checkbox label={t('setup.r_keep')} checked={keep} onChange={setKeep} />
          <Checkbox label={t('setup.r_one')} checked={o.one} onChange={v => opt('one', v)} /><p class="hint mute">{t('setup.r_one_hint')}</p>
          <Checkbox label={t('setup.r_names')} checked={o.names} onChange={v => opt('names', v)} />
          <p class="hint mute">{o.names ? (p.example ? t('setup.r_names_like', { name: anonOn() ? '…' : p.example }) : '') : t('setup.r_names_off')}</p>
          <Checkbox label={t('setup.r_sheet')} checked={sheet} onChange={setSheet} />
          <Checkbox label={t('setup.r_edit')} checked={o.edit} onChange={v => opt('edit', v)} /><p class="hint mute">{t('setup.r_edit_hint')}</p>
          <Checkbox label={t('setup.r_key')} checked={o.key} onChange={v => opt('key', v)} />
          <Checkbox label={t('setup.r_fb')} checked={o.fb} onChange={v => opt('fb', v)} /><p class="hint mute">{t('setup.r_fb_hint')}</p>
          <Checkbox label={t('setup.r_all')} checked={o.all} onChange={v => opt('all', v)} />
          <div class="sharp"><span>{t('setup.r_sharp')}</span><Segmented size="sm" label={t('setup.r_sharp')} value={String(dpi)} onChange={v => setDpi(+v)} options={[{ value: '150', label: t('setup.r_standard') }, { value: '220', label: t('setup.r_extra') }]} /></div>
        </details>
        <p class="mute foot">{t('setup.r_foot')}</p>
      </> : <>
        <p>{p.nOut ? t('setup.r_all_early') : t('setup.r_nothing')}</p>{earlyBox}
        <Checkbox label={t('setup.r_all')} checked={o.all} onChange={v => opt('all', v)} />{state1}
      </>}
    </div>
    <aside class="rtside">
      <Card title={t('setup.r_one_title')} id="rtOne"><p class="mute">{t('setup.r_one_text')}</p>
        {sent.length > 0 && <ul class="sent">{sent.slice(0, 6).map(y => <li><button type="button" class="link" onClick={() => onOpen(y.i)} data-raw>{shownName(y.x, y.i)}</button> <span class="mute">{t('setup.r_sent', { when: when(y.x.grade.sent) })}</span></li>)}
          {sent.length > 6 && <li class="mute">{t('setup.r_more', { n: sent.length - 6 })}</li>}</ul>}
        {who ? <Button data-rtone onClick={one}>{t('setup.r_one_btn', { name: who })}</Button> : <p class="mute">{t('setup.r_one_none')}</p>}</Card>
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
