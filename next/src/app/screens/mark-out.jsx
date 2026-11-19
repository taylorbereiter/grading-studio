// Grades, Insights and Return (design screenshot 6's other three tabs), loaded as a part of their own when one of them opens
// (router.js PARTS.out). What each shows and makes is the current app's (mark/out.js, over engines/gexport.js): the Grades tab's
// rows and copies (src/app/dialogs.js openGrades), Insights' summary (src/rubrics.js ovDraw), and Return's files (src/app/export.js
// openExport, src/tabs.js returnSideHtml). E is mark/out.js, loaded by the marking screen with its libraries.
import { h, Fragment } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { Button, Checkbox, Segmented, Icon, Progress, Card, EmptyState, toast } from '../../ui/index.js';
import { copyText } from '../../services/clipboard.js';
import { t } from '../../i18n/t.js';
import { state, fmtNum, fmtPct, rowsTop, maxPoints, gradeOf } from '../../engines/gcore.js';
import { shownName, anonOn } from '../../engines/gdraw.js';
import '../mark/lines.js';
import '../mark/setup-lines.js';
import '../mark/paper-lines.js';
import { PARTS } from '../router.js';
import { saving } from '../../services/saving.js';
import { store } from '../../engines/gstore.js';
import { go as goTo } from '../router.js';

const copy = text => copyText(text);
const cut = s => (s.length > 40 ? s.slice(0, 40) + '…' : s);
const copyCell = v => copy(v).then(() => toast(v ? t('setup.copied', { text: cut(v) }) : t('setup.copied_empty')));
const Cell = ({ v, children, cls = '' }) => <td class={cls}><button type="button" class="cp" data-copy={v} title={cls === "cm" ? v : undefined} onClick={() => copyCell(v)}>{children == null ? v : children}</button></td>;

/* ---------------- Grades ---------------- */
// Return's check sends a grade to confirm here, on the grade sheet
let sheetNext = false;
export function Grades({ E, onOpen, sub }) {
  const [, tick] = useState(0), s = state(), su = s.setup, rub = su.mode === 'rubric', ib = E.X.ibSetup(), b = s.batch;
  const cls = b.classId != null ? (s.lib.classes || []).find(c => c.id === b.classId) : null;
  const banded = !ib && !!(E.X.meGrade() || {}).bands, rows = E.rows();
  const save = (name, blob) => E.saveFile(name, blob);
  const copyAll = async k => { const r = E.copyText(k); await copy(r.text); toast(t('setup.copied_rows', { n: r.n })); };
  const [view, setView] = useState(() => (sheetNext ? ((sheetNext = false), 'sheet') : sub === 'sheet' ? 'sheet' : 'table')), [SH, setSH] = useState(null), [only, setOnly] = useState(false);
  // a paper whose own grade differs from hers, has more than one grade, or a doubtful one (src/tabs.js glPaperOf): how many, and just those
  const check = r => !!(r.paper && (r.paper.ask || r.paper.differs)), nCheck = rows.filter(check).length;
  useEffect(() => { if (view === 'sheet' && !SH) PARTS.sheet().then(setSH, e => console.error(e)); }, [view]);
  const views = <Segmented label={t('paper.gs_view')} size="sm" value={view} onChange={setView} options={[{ value: 'table', label: t('paper.gs_table') }, { value: 'sheet', label: t('paper.gs_sheet') }]} />;
  if (view === 'sheet') return <section class="mk-out mk-grades" aria-labelledby="mk-g-h">
    <header class="oh"><h2 id="mk-g-h" class="t3">{t('paper.gs_sheet')}</h2>{views}</header>
    {SH ? <SH.Sheet E={E} onOpen={onOpen} /> : <div class="loading" aria-busy="true" />}
    <footer class="of"><Button variant="primary" icon="download" onClick={async () => save('Grade sheet - ' + b.name + '.pdf', await E.sheetPdf())} data-sheetpdf>{t('setup.g_sheet')}</Button></footer>
  </section>;
  return <section class="mk-out mk-grades" aria-labelledby="mk-g-h">
    <header class="oh"><h2 id="mk-g-h" class="t3">{t('mark.grades')}</h2>{views}<span class="mute" id="glSum">{E.summary()}</span>
      {cls && <Segmented label={t('setup.g_order')} size="sm" value={E.order()} onChange={v => { E.setOrder(v); tick(n => n + 1); }}
        options={[{ value: 'folder', label: t('setup.g_folder') }, { value: 'roster', label: t('setup.g_roster', { name: cls.name }) }]} />}</header>
    <p class="mute help">{t('setup.g_help')}</p>
    {nCheck > 0 && <p class="gs-check" data-gcheck>{t('paper.g_check', { n: nCheck })} <button type="button" class="link" onClick={() => setOnly(!only)} data-gonly>{t(only ? 'paper.g_check_all' : 'paper.g_check_only')}</button></p>}
    <div class="tbl gl"><table id="glTable"><thead><tr><th>{t('setup.g_num')}</th><th>{t('setup.g_student')}</th>
      {rub && su.criteria.map(c => <th data-raw>{c}</th>)}
      {ib ? <th>{t('setup.g_status')}</th> : <><th>{t('setup.g_total', { n: maxPoints() })}</th><th>{t('setup.g_pct')}</th></>}
      {banded && <th>{t('setup.g_band')}</th>}<th title={t('setup.g_paper_tip')}>{t('setup.g_paper')}</th><th>{t('setup.g_comment')}</th></tr></thead>
      <tbody>{rows.filter(r => !only || !nCheck || check(r)).map(r => r.missing
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
export function Insights({ E, onOpen, onShare, sub }) {
  const s = useMemo(() => E.stats(), [E]), ib = E.X.ibSetup(), su = state().setup;
  const [view, setView] = useState(sub === 'consistency' ? 'cons' : 'overview'), [CS, setCS] = useState(null);
  useEffect(() => { if (view === 'cons' && !CS) PARTS.cons().then(setCS, e => console.error(e)); }, [view]);
  const views = <Segmented label={t('paper.i_view')} size="sm" value={view} onChange={setView} options={[{ value: 'overview', label: t('paper.i_overview') }, { value: 'cons', label: t('paper.i_cons') }]} />;
  // Share with your assistant (mark/share.jsx, opened by the marking screen as from its Setup menu)
  const shareBtn = onShare && <Button size="sm" icon="assist" onClick={onShare} data-insshare>{t('paper.sh_menu')}</Button>;
  if (view === 'cons') return <section class="mk-out mk-ins" aria-labelledby="mk-i-h">
    <header class="oh"><h2 id="mk-i-h" class="t3">{t('paper.i_cons')}</h2>{views}</header>
    {CS ? <CS.Consistency E={E} onOpen={onOpen} /> : <div class="loading" aria-busy="true" />}
  </section>;
  const tile = (l, v, sub, main) => <div class={'tile' + (main ? ' main' : '')}><div class="tl">{l}</div><div class="tv num">{v}</div>{sub && <div class="ts mute">{sub}</div>}</div>;
  const of = v => fmtNum(v) + ' / ' + fmtNum(s.max);
  const most = s.bins.length ? Math.max(1, ...s.bins.map(x => x.who.length)) : 1;
  const groups = [['setup.i_not_scored', s.notScored], ['setup.i_partial', s.partial], ['setup.i_missing', s.missing], ['setup.i_excused', s.excused], ['setup.i_off_scale', s.offScale], ['setup.i_own_off', s.ownOff], ['setup.i_left_out', s.leftOut], ['setup.i_late', s.counted.filter(x => x.late)]].filter(g => g[1].length);
  return <section class="mk-out mk-ins" aria-labelledby="mk-i-h">
    <header class="oh"><h2 id="mk-i-h" class="t3">{t('mark.insights')}</h2>{views}{shareBtn}</header>
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
// Anchor papers (src/anchors.js anchorCardHtml, anchorExport): the high, middle and low paper, and one button for all three.
function AnchorCard({ E, onOpen }) {
  const X = E.X, b = state().batch, [, tick] = useState(0), [busy, setBusy] = useState(false);
  if (!X.anchorsHere() && !b.students.some(s => s.grade.anchor)) return null;
  const n = X.ANCHORS.filter(([k]) => X.anchorOf(k) >= 0).length, cover = X.anchorCoverOn();
  const first = X.ANCHORS.find(([k]) => X.anchorOf(k) >= 0);
  const out = async () => {
    setBusy(true);
    try {
      const r = await E.anchorsOut();
      if (r.none) return toast(t('paper.an_first'));
      E.saveFile(r.name, r.blob);
      toast(r.n === 1 ? t('paper.an_saved_one', { name: r.name }) : t('paper.an_saved_n', { n: r.n }));
      if (r.failed.length) toast(t('paper.an_failed', { list: r.failed.map(f => f.why ? f.lv + ' (' + f.why + ')' : t('paper.an_no_pages', { lv: f.lv })).join(', ') }));
    } catch (e) { console.error(e); toast(t('paper.an_wrong', { e: e.message || String(e) })); }
    finally { setBusy(false); }
  };
  return <Card title={t('paper.an_h')} id="rtAnchors">
    {!n && <p class="mute">{t('paper.an_pick')}</p>}
    <ul class="anchlist">{X.ANCHORS.map(([k, name]) => { const j = X.anchorOf(k), st = j >= 0 ? b.students[j] : null, g = st && gradeOf(st);
      const sc = g && g.total != null ? fmtNum(g.total) + ' / ' + fmtNum(g.outOf != null ? g.outOf : maxPoints()) + (g.pct != null ? ' · ' + fmtPct(g.pct) : '') : g && g.pct != null ? fmtPct(g.pct) : '';
      return <li class={st ? '' : 'none'} data-anchli={k}><b>{t(k === 'high' ? 'mark.an_high' : k === 'mid' ? 'mark.an_mid' : 'mark.an_low')}</b>
        {st ? <><button type="button" class="link" onClick={() => onOpen(j)} data-raw>{shownName(st, j)}</button><span class="mute">{sc}</span></> : <span class="mute">{t('paper.an_none')}</span>}</li>; })}</ul>
    {n > 0 && <>
      <Checkbox checked={cover} onChange={v => { E.anchorCover(v); tick(x => x + 1); }} label={t('paper.an_cover')} />
      <p class="mute">{t('paper.an_files', { name: X.anchorFile(first[0], 0, 1), n })} {t(cover ? 'paper.an_cover_say' : 'paper.an_plain')}</p>
      <Button variant="primary" disabled={busy} onClick={out} data-anchout>{t(busy ? 'paper.an_making' : 'paper.an_out')}</Button></>}
  </Card>;
}
const when = ms => { const d = new Date(ms); return d.toDateString() === new Date().toDateString() ? t('setup.r_today', { t: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }) : t('setup.r_on', { d: d.toLocaleDateString([], { day: 'numeric', month: 'short' }) }); };
// The mark key lives in Settings, Marking: go there and bring its card into view.
const toMarkKey = () => { goTo('settings', 'marking'); let n = 0; const look = () => { const el = document.querySelector('[data-sgmk]'); if (el) { el.closest('section').scrollIntoView({ block: 'start' }); const i = el.querySelector('input'); if (i) i.focus(); } else if (n++ < 40) setTimeout(look, 75); }; look(); };
export function Return({ E, cur, onOpen, onShare, onSheet, rescans = [], onRescans }) {
  const [RC, setRC] = useState(null), [fails, setFails] = useState([]), [optsOpen, setOptsOpen] = useState(() => !!store.get('gs.xopts', false));
  useEffect(() => { PARTS.retcards().then(setRC, e => console.error(e)); }, []);
  const [, tick] = useState(0), [say, setSay] = useState(''), [bar, setBar] = useState(null), [keep, setKeep] = useState(true), [sheet, setSheet] = useState(true), [dpi, setDpi] = useState(150);
  const s = state(), b = s.batch, p = E.plan(), o = E.opts(), redo = () => tick(n => n + 1);
  const r = b.returned || {}, canDir = !!(window.showDirectoryPicker && window.self === window.top);
  const opt = (k, v) => { E.setOpt(k, v); redo(); };
  const S = saving(), toDrive = !!(S && S.google().email);
  const go = async toDir => {
    if (E.exporting()) return toast(t('setup.r_busy'));
    let dir = null;
    if (toDir === 'drive') return goDrive();
    if (toDir) { try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'grading-studio' }); } catch (er) { if (er && er.name !== 'AbortError') toast(t('setup.r_dir_no')); return; } }
    setBar(0);
    try {
      const out = await E.exportAll({ keep, dpi, sheet, dir, onStep: (k, n, of) => { if (k === 'read') { setSay(t('setup.r_reading')); setBar(of ? 0.3 * n / of : 0); } else { setSay(t('setup.r_baking', { n: Math.min(n + 1, of), of })); setBar(0.3 + 0.7 * (of ? n / of : 1)); } } });
      if (!out.nOut && !out.zip) setSay(t('setup.r_none'));
      else { if (out.zip) E.saveFile(out.name, out.zip); setSay((dir ? t('setup.r_done_dir', { n: out.nOut, dir: dir.name }) : t('setup.r_done_zip', { n: out.nOut })) + (r.ok ? '' : ' ' + t('setup.r_once'))); }
      setFails(out.failed); afterOut(out);
    } catch (er) { console.error(er); setSay(t('setup.r_wrong', { why: er.message || String(er) })); }
    setBar(null); redo();
  };
  // Once the files are out: if she has left the Return tab meanwhile, a toast says what's next with Mark as returned (src/tabs.js
  // setReturned, A-081); while the tab is open, the button under the download says it. A failed list she can't see goes in a toast.
  const afterOut = out => {
    if (document.getElementById('rtState')) return;
    if (out.failed.length) toast(t('setup.r_failed', { n: out.failed.length, list: out.failed.map(f => f.path.split('/').pop() + ' (' + f.why + ')').join(', ') }), { ms: 8000 });
    if (out.nOut && !(state().batch.returned || {}).ok) { const b0 = state().batch; toast(t('setup.r_once'), { ms: 10000, action: { label: t('setup.r_mark'), run: () => { if (state().batch === b0) E.marking().markReturned(true); } } }); }
  };
  // Save to Google Drive (src/app/export.js data-go="drive"): the same files, in a new folder next to the papers opened from Drive, or in My Drive
  const goDrive = async () => {
    setBar(0);
    try {
      const out = await E.exportAll({ keep, dpi, sheet, onStep: (k, n, of) => { if (k === 'read') { setSay(t('setup.r_reading')); setBar(of ? 0.25 * n / of : 0); } else { setSay(t('setup.r_baking', { n: Math.min(n + 1, of), of })); setBar(0.25 + 0.5 * (of ? n / of : 1)); } } });
      if (!out.nOut && !out.zip) setSay(t('setup.r_none'));
      else {
        const name = 'Marked - ' + b.name, from = b.drive || null;
        const where = await S.driveSave(name, out.files, from, (n, of) => { setSay(t('setup.r_drive_saving', { n, of })); setBar(0.75 + 0.25 * n / of); });
        setSay(t(where !== 'next' ? 'setup.r_drive_root' : from.kind === 'folder' ? 'setup.r_drive_in' : from.kind === 'zip' ? 'setup.r_drive_zip' : 'setup.r_drive_next', { name }) + (r.ok ? '' : ' ' + t('setup.r_once')));
      }
      setFails(out.failed); afterOut(out);
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
    : <>{r.t ? <span>{t('setup.r_exported', { when: when(r.t), n: r.n || 0 })}</span> : null} <Button size="sm" data-doreturn onClick={() => { E.marking().markReturned(true); toast(t('setup.r_marked')); redo(); }}>{t('setup.r_mark')}</Button></>}</p>;
  const earlyBox = p.early.length > 0 && <><Checkbox label={t('setup.r_early', { n: p.early.length })} checked={o.early} onChange={v => opt('early', v)} />{RC && <RC.Early early={p.early} on={o.early} />}</>;
  const checkBox = RC && <RC.Check E={E} onOpen={onOpen} onSheet={() => { sheetNext = true; onSheet(); }} />;
  return <section class="mk-out mk-ret" aria-labelledby="mk-r-h">
    <div class="rtmain">
      <header class="oh"><h2 id="mk-r-h" class="t3">{t('mark.return')}</h2></header>
      {p.files ? <>
        <p class="big t2" id="rtReady">{t('setup.r_ready', { n: p.files })}</p>
        <p class="mute">{t('setup.r_from', { n: p.students })}{p.skipped > 0 && ' ' + t('setup.r_skipped', { n: p.skipped })}{p.left > 0 && ' ' + t('setup.r_left', { n: p.left })}</p>
        {earlyBox}
        {checkBox}
        <div class="go"><Button variant="primary" icon="download" data-go="zip" disabled={bar != null} onClick={() => go(false)}>{t('setup.r_zip')}</Button>
          {canDir && <Button data-go="dir" disabled={bar != null} onClick={() => go(true)}>{t('setup.r_dir')}</Button>}
          {toDrive && <Button icon="drive" data-go="drive" disabled={bar != null} onClick={() => go('drive')}>{t('setup.r_drive')}</Button>}</div>
        {bar != null && <Progress value={bar} max={1} label={say} />}
        <p class="mute" role="status" id="xStatus">{say}</p>
        {RC && fails.length > 0 && <RC.Fails failed={fails} onClose={() => setFails([])} />}
        {state1}
        <details class="xopts" open={optsOpen} onToggle={e => { const v = e.currentTarget.open; if (v !== optsOpen) { setOptsOpen(v); store.set('gs.xopts', v); } }}><summary data-xoptssay>{RC ? RC.optsSay({ o, keep, sheet, dpi }) : t('setup.r_options')}</summary>
          <Checkbox label={t('setup.r_keep')} checked={keep} onChange={setKeep} />
          <Checkbox label={t('setup.r_one')} checked={o.one} onChange={v => opt('one', v)} /><p class="hint mute">{t('setup.r_one_hint')}</p>
          <Checkbox label={t('setup.r_names')} checked={o.names} onChange={v => opt('names', v)} />
          <p class="hint mute">{o.names ? (p.example ? t('setup.r_names_like', { name: anonOn() ? '…' : p.example }) : '') : t('setup.r_names_off')}</p>
          <Checkbox label={t('setup.r_sheet')} checked={sheet} onChange={setSheet} />
          <Checkbox label={t('setup.r_edit')} checked={o.edit} onChange={v => opt('edit', v)} /><p class="hint mute">{t('setup.r_edit_hint')}</p>
          <Checkbox label={t('setup.r_key')} checked={o.key} onChange={v => opt('key', v)} />{RC && <RC.KeyHint p={p} onChange={toMarkKey} />}
          <Checkbox label={t('setup.r_fb')} checked={o.fb} onChange={v => opt('fb', v)} /><p class="hint mute">{t('setup.r_fb_hint')}</p>
          <Checkbox label={t('setup.r_all')} checked={o.all} onChange={v => opt('all', v)} />
          <div class="sharp"><span>{t('setup.r_sharp')}</span><Segmented size="sm" label={t('setup.r_sharp')} value={String(dpi)} onChange={v => setDpi(+v)} options={[{ value: '150', label: t('setup.r_standard') }, { value: '220', label: t('setup.r_extra') }]} /></div>
        </details>
        <p class="mute foot">{t('setup.r_foot')}</p>
      </> : <>
        <p>{p.nOut ? t('setup.r_all_early') : t('setup.r_nothing')}</p>{earlyBox}{checkBox}
        <Checkbox label={t('setup.r_all')} checked={o.all} onChange={v => opt('all', v)} />{state1}
      </>}
    </div>
    <aside class="rtside">
      <Card title={t('setup.r_one_title')} id="rtOne"><p class="mute">{t('setup.r_one_text')}</p>
        {sent.length > 0 && <ul class="sent">{sent.slice(0, 6).map(y => <li><button type="button" class="link" onClick={() => onOpen(y.i)} data-raw>{shownName(y.x, y.i)}</button> <span class="mute">{t('setup.r_sent', { when: when(y.x.grade.sent) })}</span></li>)}
          {sent.length > 6 && <li class="mute">{t('setup.r_more', { n: sent.length - 6 })}</li>}</ul>}
        {who ? <Button data-rtone onClick={one}>{t('setup.r_one_btn', { name: who })}</Button> : <p class="mute">{t('setup.r_one_none')}</p>}</Card>
      <AnchorCard E={E} onOpen={onOpen} />
      {RC && onShare && <RC.AskCard onShare={onShare} />}
      {RC && <RC.RescanCard list={rescans} onShow={onRescans} />}
    </aside>
  </section>;
}

// The tab, read once the papers have been read (a grade written on a paper counts), as the current app reads them first.
export default function Out({ tab, sub, E, cur, onOpen, onShare, onSheet, rescans, onRescans }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { let live = true; E.readPapers().then(() => live && setOk(true), e => { console.error(e); if (live) setOk(true); }); return () => { live = false; }; }, [E]);
  if (!ok) return <div class="loading" aria-busy="true" aria-label={t('mark.reading')} />;
  const P = { E, cur, onOpen, onShare, onSheet, rescans, onRescans, sub };
  return tab === 'grades' ? <Grades {...P} /> : tab === 'insights' ? <Insights {...P} /> : tab === 'return' ? <Return {...P} /> : <EmptyState title="" />;
}
