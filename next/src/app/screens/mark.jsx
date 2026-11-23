// Marking (design screenshot 6): one assignment, full window. Mark / Grades / Insights / Return across the top with Setup beside
// them; the student list on the left, the student's paper large in the middle, their score on the right, Next student at the foot.
// The papers open the way the current app reopens a download kept in this browser (mark/open.js), and every page is drawn by the
// current app's own drawing code (engines/gdraw.js), so what she sees is what she marked there, mark for mark.
import { watchWindows } from '../mark/windows.js';
import { h, Fragment } from 'preact';
import { useRove } from '../mark/rove.js';
import { useState, useEffect, useRef, useMemo, useCallback } from 'preact/hooks';
import { Tabs, Button, IconButton, Icon, EmptyState, Dialog, Progress, Avatar, TextInput, Menu, Mic } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go, href, PARTS } from '../router.js';
import { register, pieces } from '../../services/shortcuts.js';
import { addCommand } from '../../services/commands.js';
import { assistant } from '../../services/assistant.js';
import { openPages, renderPage, fitScale } from '../mark/paper.js';
import { installTouch } from '../mark/touch.js';
import { use, gradeOf, maxPoints, fmtNum, state, rowSteps, rowTop, setupOver, DEFAULT_SETUP, SCALE12, SCALE_FIVES, noScore, xcSay, ibSetup, quizOn } from '../../engines/gcore.js';
import { prefs } from '../../students/prefs.js';
import { onSaved } from '../../shared/saved.js';
import { shownName, anonOn, anonOrder, quizLabel } from '../../engines/gdraw.js';
import { toast } from '../../ui/index.js';
import '../mark/lines.js';

// The checks' way in (next/test/browser/mark.test.js): the open work, drawing one page at a given scale, and waiting for a save.
const seam = { state, gradeOf, renderPage, ready: false, maths: { state, gradeOf, setupOver, DEFAULT_SETUP, SCALE12, SCALE_FIVES, fmtNum }, saved: () => (MK ? MK.M.saveNowDone() : Promise.resolve()) };
if (typeof window !== 'undefined') window.__mark = seam;

const TABS = ['mark', 'grades', 'insights', 'examples', 'return'];
// buttons that belong together: one stop in the Tab order, the arrow keys among them (mark/rove.js)
function Rove({ as = 'div', vertical, children, ...rest }) { const rv = useRove(vertical); return h(as, { ...rest, ...rv }, children); }
const TAB_LINE = { mark: () => t('mark.mark'), grades: () => t('mark.grades'), insights: () => t('mark.insights'), examples: () => t('mark.examples'), return: () => t('mark.return') };
// The assignment's copies in linked classes (one group, src/linked.js lkTwins): their examples show on its Examples tab when asked.
const twinsOf = (lib, a) => (a && a.group ? [...((lib && lib.classes) || []), ...(lib && lib.loose ? [lib.loose] : [])].flatMap(c => c.units.flatMap(u => u.items.filter(x => x.group === a.group && x.id !== a.id).map(x => x.id))) : []);
const keep = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem('gsn.mark.' + k)); sessionStorage.setItem('gsn.mark.' + k, JSON.stringify(v)); } catch {} return null; };

// What a student's row says: their score as a percent, or missing / excused / late.
// A percent unless she switched the list to points (gs.listPts); a part score is its points so far, and extra credit follows ("85% +2%").
function rowScore(st, pts, fm) {
  const g = gradeOf(st), s = st.grade.status;
  if (s === 'missing') return { text: t('mark.missing'), tone: 'warn' };
  if (s === 'excused') return { text: t('mark.excused'), tone: 'mute' };
  if (!st.files.length && g.total == null && g.pct == null) return { text: t('mark.missing'), tone: 'warn' };
  if (fm) return st.grade.fb ? { text: t('mark.fb_done_short'), done: true } : null;
  // an MYP task: each criterion's level in turn, as the current app's list has them (src/ib.js ibListSay)
  if (ibSetup() && g.total != null) { const su = state().setup; return { text: su.ib.map((k, i) => (k ? (st.grade.rubric[i] == null ? '–' : fmtNum(st.grade.rubric[i])) : null)).filter(x => x !== null).join(' '), done: !!g.done }; }
  if (g.total == null) return g.pct != null ? { text: fmtNum(g.pct) + '%', done: !!g.done } : null;
  const x = !!g.xc && g.base != null, pc = x ? g.bpct : g.pct, tot = x ? g.base : g.total, of = g.outOf != null ? g.outOf : maxPoints();
  const more = x ? ' +' + (!pts && !g.partial ? xcSay(g) : fmtNum(g.xc) + (g.xcU === 'pct' ? '%' : '')) : '';
  if (!pts && !g.partial && pc != null) return { text: fmtNum(pc) + '%' + more, done: !!g.done };
  return { text: (!of || g.partial ? fmtNum(tot) : fmtNum(tot) + '\u2009/\u2009' + fmtNum(of)) + more, done: !!g.done };
}
// The list's filters (src/markscreen.js LIST_FILTERS), for this visit to this assignment only. A paper is flagged when something on it
// needs a look: a page to rescan, a grade on the paper to confirm or pick, a score that differs from the paper, a new or changed file.
// The grade-on-the-paper checks come with the export engine, which loads as the papers are read.
let OE = null;
const flagged = (st, b) => st.files.some(f => Object.values(f.sc || {}).some(r => r.re)) || (b.carry && st.files.some(f => b.carry.flags[f.path]))
  || (OE && (OE.manyReads(st) || (st.doubts && st.doubts.length) || (!noScore(st) && OE.disagreeNote(st))));
const LF = ['all', 'todo', 'flag', 'nopaper', 'late', 'out'];
const LF_MATCH = {
  all: () => true,
  todo: (st, b, fm) => !noScore(st) && (fm ? !st.grade.fb : !gradeOf(st).done),
  flag: (st, b) => !!flagged(st, b),
  nopaper: st => !st.files.length && !noScore(st),
  late: st => st.grade.status === 'late',
  out: st => !!st.grade.outAvg && !noScore(st),
};
const LF_LINE = { all: () => t('mark.lf_all'), todo: fm => t(fm ? 'mark.lf_finish' : 'mark.lf_todo'), flag: () => t('mark.lf_flag'), nopaper: () => t('mark.lf_nopaper'), late: () => t('mark.lf_late'), out: () => t('mark.lf_out') };
// The students the list shows, in order: Previous, Next and the arrow keys walk these. The open one always stays.
// With names hidden, the papers go in the shuffled order (src/app/anon.js anonOrder).
const shownOrder = (b, lf, cur, fm) => (anonOn() ? anonOrder() : b.students.map((st, i) => i)).filter(i => lf === 'all' || i === cur || LF_MATCH[lf](b.students[i], b, fm));
const isMarked = st => { const g = gradeOf(st); return !!g.done && !st.gap; };

function StudentList({ batch, cur, onPick, onReport, lf, setLf, fold, setFold, fm, onHide, onShuffle }) {
  const [q, setQ] = useState(''), box = useRef(null), [pts, setPts] = useState(() => !!prefs.get('gs.listPts', false)), [menu, setMenu] = useState(false);
  const findNow = () => { if (fold) setFold(false); setTimeout(() => { const i = box.current && box.current.querySelector('input'); if (i) i.focus(); }); };
  useEffect(() => register({ id: 'mark-find', keys: '/', label: 'mark.find', run: findNow }), [fold]);
  const missing = batch.students.filter(st => st.grade.status === 'missing' || !st.files.length).length;
  const order = shownOrder(batch, lf, cur, fm);
  const rows = order.map(i => ({ st: batch.students[i], i, name: shownName(batch.students[i], i) })).filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const way = v => { setPts(v); if (v) prefs.set('gs.listPts', true); else prefs.del('gs.listPts'); };
  const count = k => batch.students.filter(st => LF_MATCH[k](st, batch, fm)).length;
  // Enter in the find box opens the first match; Esc clears it
  const findKey = e => { if (e.key === 'Enter' && rows[0]) { e.preventDefault(); onPick(rows[0].i); e.currentTarget.blur(); } if (e.key === 'Escape') { e.preventDefault(); setQ(''); e.currentTarget.blur(); } };
  return <aside class={'mk-list' + (fold ? ' fold' : '')} aria-label={t('mark.students')}>
    <div class="mk-lhead mute"><span>{anonOn() ? t('mark.hn_head') : t('mark.papers', { n: batch.students.filter(st => st.files.length).length })}</span>{missing > 0 && <span>{t('mark.missing_n', { n: missing })}</span>}</div>
    <div ref={box} class="mk-find" onKeyDown={findKey}><TextInput icon="search" label={t('mark.find')} placeholder={t('mark.find')} value={q} onInput={setQ} /></div>
    <div class="mk-lbar">
      <span class="mk-lf"><button type="button" class={'chip' + (lf !== 'all' ? ' on' : '')} aria-haspopup="menu" aria-expanded={menu ? 'true' : 'false'} onClick={() => setMenu(v => !v)} data-lf-open><Icon name="menu" size="xs" />{LF_LINE[lf](fm)}</button>
        {menu && <div class="mk-lfmenu" role="menu" aria-label={t('mark.lf_show')} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(false); } }}>{LF.map(k => { const n = count(k);
          return (k === 'all' || k === 'todo' || k === 'flag' || n > 0 || lf === k) && <button type="button" role="menuitemradio" aria-checked={lf === k ? 'true' : 'false'} data-lf={k} onClick={() => { setLf(k); setMenu(false); }}><span>{LF_LINE[k](fm)}</span><span class="mute">{n}</span></button>; })}
          {!fm && <><b class="sep mute" role="presentation">{t('mark.lf_way')}</b>{[[false, 'mark.lf_pct', 'pct'], [true, 'mark.lf_pts', 'pts']].map(([v, k, d]) => <button type="button" role="menuitemradio" aria-checked={pts === v ? 'true' : 'false'} onClick={() => { way(v); setMenu(false); }} data-way={d}><span>{t(k)}</span></button>)}</>}
          {onReport && <button type="button" role="menuitem" class="sep" onClick={() => { setMenu(false); onReport(); }} data-report><span>{t('mark.op_title')}</span></button>}
          <button type="button" role="menuitem" class="sep" onClick={() => { setMenu(false); setFold(true); }} data-listfold><span>{t('mark.list_fold')}</span><kbd>[</kbd></button></div>}</span>
      <span class="grow" />
      {fold && <IconButton icon="chr" size="sm" label={t('mark.list_keep')} kbd="[" onClick={() => setFold(false)} data-listfold />}
    </div>
    <ol class="mk-rows">{rows.map(({ st, i, name }) => { const sc = rowScore(st, pts, fm), fl = flagged(st, batch);
      return <li><button type="button" class={'mk-row' + (i === cur ? ' on' : '')} aria-current={i === cur ? 'true' : undefined} onClick={() => onPick(i)} data-st={i} title={fold ? name : undefined}>
        <Avatar name={name} size="sm" /><span class="nm" data-raw>{name}</span>{fl && <span class="bang" title={t('mark.lf_flagged')} aria-label={t('mark.lf_flagged')}>!</span>}
        {st.grade.status === 'late' && <span class="pill">{t('mark.late')}</span>}
        {AN[st.grade.anchor] && <span class="pill anch" title={t('mark.an_tag', { lv: t(AN[st.grade.anchor]) })} data-anchtag>{t(AN[st.grade.anchor]).toLowerCase()}</span>}
        {sc && <span class={'sc ' + (sc.tone || '')}>{sc.done && <Icon name="check" size="xs" />}{sc.text}</span>}
      </button></li>; })}
      {lf !== 'all' && !q && rows.length <= 1 && <li class="mute mk-lfnone">{t('mark.lf_none')} <button type="button" class="link" onClick={() => setLf('all')}>{t('mark.lf_everyone')}</button></li>}</ol>
    {onHide && <div class="mk-lfoot">
      <button type="button" class="hn-sw" role="switch" aria-checked={anonOn() ? 'true' : 'false'} title={t('mark.hn_sw_tip')} onClick={onHide} data-anonsw>{t('mark.hn_sw')}<i /></button>
      <span class="grow" />{anonOn() && <Button size="sm" variant="quiet" title={t('mark.hn_shuf_tip')} onClick={onShuffle} data-anonshuf>{t('mark.hn_shuf')}</Button>}</div>}
  </aside>;
}

// One page: a canvas drawn by the current app's code at the scale the paper area allows.
function Page({ pg, room, tall, zoom, FU }) {
  const ref = useRef(null), wrap = useRef(null);
  useEffect(() => {
    if (!ref.current || !room) return;
    pg.canvas = ref.current;
    pg.wrapEl = wrap.current; if (MK) MK.M.bind(pg, wrap.current);
    renderPage(pg, fitScale(pg, room, tall, (state().disp || {}).fit, zoom));
  }, [pg, room, zoom]);
  return <>{FU && pg.impTop && <FU.ImpNote pg={pg} />}{FU && <FU.ScanNote pg={pg} />}<div ref={wrap} class={'pg' + (pg.out ? ' out' : '')} data-tool={state().tool}><canvas ref={ref} data-page={pg.file.path + '|' + pg.idx} />{FU && <FU.TurnChip pg={pg} />}{FU && <FU.LightChip pg={pg} />}{FU && <FU.Unskew pg={pg} />}</div></>;
}

// The marking tools load as a part of their own (router.js PARTS.marking, screens/mark-tools.jsx) once the paper is open, so
// the read-only paper shows as soon as it can. Until they are there, the paper is drawn and nothing on it can be changed.
let MK = null, TN = null, PM = null, TB = null;   // the marking tools, typed notes with the Timer, More for this paper (each its own part), and the top bar's (mark/topbar.jsx, with More)
const SAVE_LINE = { saving: () => t('mark.saving'), saved: () => t('mark.saved'), partly: () => t('mark.partly'), not: () => t('mark.not_saved') };
const saveLine = k => (SAVE_LINE[k] ? SAVE_LINE[k]() : t('mark.cannot'));

// A Word paper: the current app's Word card (mark/word.js, a part of its own), changeable once the marking tools are there.
function WordPaper({ st, f, FU }) {
  const box = useRef(null), [n, setN] = useState(0), [pdf, setPdf] = useState(false), M = MK && MK.M;
  useEffect(() => {
    let live = true, card = null;
    PARTS.word().then(m => { if (!live || !box.current) return; card = m.wordCard(st, f, M); box.current.replaceChildren(card.el); });
    const again = () => setN(k => k + 1), host = box.current;
    const ask = () => setPdf(true);
    host.addEventListener('wordreopen', again); host.addEventListener('wordpdf', ask);
    return () => { live = false; host.removeEventListener('wordreopen', again); host.removeEventListener('wordpdf', ask); if (card) card.close(); };
  }, [st, f, M, n]);
  useEffect(() => { if (!FU) return; const look = () => { if (FU.takeWordAsk(f.path)) setPdf(true); }; look(); return FU.onWordAsk(look); }, [FU, f]);   // Find's Convert (A-005)
  return <><div ref={box} class="wordwrap"><div class="loading" aria-busy="true" /></div>{pdf && FU && <FU.PdfAsk st={st} f={f} onClose={() => setPdf(false)} />}</>;
}

// A recording or a video link (mark/media.jsx, a part of its own); its name until the part is there.
let MEDIA = null;
function MediaFile({ st, f }) {
  const [, again] = useState(0);
  useEffect(() => { if (!MEDIA) PARTS.media().then(m => { MEDIA = m; again(1); }, e => console.error(e)); }, []);
  return MEDIA ? <MEDIA.MediaCard st={st} f={f} /> : <div class="fcard"><Icon name="play" /><span data-raw>{f.name}</span></div>;
}
// A text file or any other file (mark/files.jsx, a part of its own); its name until the part is there.
let FILES = null;
function OtherFile({ f }) {
  const [, again] = useState(0);
  useEffect(() => { if (!FILES) PARTS.files().then(m => { FILES = m; again(1); }, e => console.error(e)); }, []);
  return FILES ? <FILES.FileCard f={f} /> : <div class="fcard"><Icon name="file" /><span data-raw>{f.name}</span></div>;
}

// The side pane (src/sidepane.js): a second column on the paper, on the right, the left or across the top, with a video beside the
// notes page, the rubric's words beside an essay, or one file beside another. B opens and closes it. The file it shows isn't moved:
// the paper turns into a grid and that file takes the pane's place, so a video in it keeps playing. gs.sp, in this browser, as the
// current app keeps it: { on: she opened it, so it stays for every student; noVid: she closed it on a video, so a video doesn't open
// it; tab: the kind of thing it last showed; at: 'left' | 'top' (right when missing); w, h: its share of the width or height }.
const SP_SIDE = 260, SP_MAIN = 300, SP_TOP = 150, SP_HEAD = 44;
const spConf = () => { const c = prefs.get('gs.sp', null); return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; };
function spSet(o) {
  const c = { ...spConf(), ...o };
  for (const k of Object.keys(c)) if (c[k] == null || c[k] === false) delete c[k];
  if (Object.keys(c).length) prefs.set('gs.sp', c); else prefs.del('gs.sp');
}
const docKey = d => 'doc:' + (d.file || d.name);
const linkName = f => f.name.replace(/\.(url|webloc)$/i, '').replace(/ \(added \d+\)$/, '');
// What can go in the pane: the rubric in full, then the student's files when something else is left for the main column.
function spTabs(st, got, su) {
  const out = [], vids = st.files.filter(f => f.kind === 'link' || f.kind === 'media');
  if (su.mode === 'rubric' && su.criteria.length) out.push({ key: 'rubric', kind: 'rubric', tool: true });
  if (vids.length + got.cards.length > 1) {
    for (const f of vids) out.push({ key: 'file:' + f.path, kind: 'video', label: f.kind === 'link' ? linkName(f) : f.name });
    for (const c of got.cards) out.push(c.kind === 'file' ? { key: 'file:' + c.f.path, kind: 'f:' + c.f.name, label: c.f.name } : { key: docKey(c.d), kind: 'f:' + c.d.name, label: c.d.name });
  }
  return out;
}
const spHasVideo = tabs => tabs.some(x => x.kind === 'video') && tabs.some(x => x.kind !== 'video' && !x.tool);
const spChoose = tabs => { const c = spConf(); return tabs.find(x => x.kind === c.tab) || tabs.find(x => x.kind === 'video') || tabs.find(x => x.kind === 'rubric') || tabs[0]; };
const spWanted = tabs => { const c = spConf(); return tabs.length > 0 && (!!c.on || (!c.noVid && spHasVideo(tabs))); };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// The pane's bar: its tabs, where it sits, close; and the edge that sizes it (drag, double-click for the usual size, or the arrows).
function SideBar({ tabs, on, at, onPick, onClose, onAt, onSize }) {
  const grip = useRef(null), last = useRef(0);
  const down = e => {
    e.preventDefault();
    if (Date.now() - last.current < 400) { last.current = 0; onSize(null); return; }   // a double click: the usual size
    const g = grip.current, paper = g.closest('.mk-paper'), x0 = e.clientX, y0 = e.clientY; g.setPointerCapture(e.pointerId); g.classList.add('on');
    const share = ev => { const r = paper.getBoundingClientRect(), cs = getComputedStyle(paper), pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0, W = paper.clientWidth - pl - pr;
      return at === 'top' ? (ev.clientY - r.top - (parseFloat(cs.paddingTop) || 0) - SP_HEAD) / Math.max(1, paper.clientHeight) : (at === 'left' ? ev.clientX - r.left - pl : r.left + paper.clientWidth - pr - ev.clientX) / Math.max(1, W); };
    const mv = ev => { const v = clampN(share(ev), 0.15, 0.85), r = paper.getBoundingClientRect(); paper.style.setProperty('--sp-px', Math.round(v * (at === 'top' ? paper.clientHeight : r.width)) + 'px'); };
    g.onpointermove = mv;
    g.onpointerup = g.onpointercancel = ev => { g.onpointermove = g.onpointerup = g.onpointercancel = null; g.classList.remove('on');
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) last.current = Date.now(); else onSize(clampN(share(ev), 0.15, 0.85)); };
  };
  const key = e => {
    const d = (at === 'top' ? { ArrowDown: 1, ArrowUp: -1 } : at === 'left' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowLeft: 1, ArrowRight: -1 })[e.key]; if (!d) return;
    e.preventDefault(); e.stopPropagation(); const c = spConf(); onSize(clampN((at === 'top' ? c.h || 0.44 : c.w || 0.46) + d * 0.04, 0.15, 0.85));
  };
  const AT = [['right', 'mark.sp_right'], ['left', 'mark.sp_left'], ['top', 'mark.sp_top']];
  return <div class="mk-sph" data-sp>
    <div ref={grip} class="spgrip" role="separator" tabindex="0" aria-orientation={at === 'top' ? 'horizontal' : 'vertical'} aria-label={t('mark.sp_size')} title={t('mark.sp_size_tip')} onPointerDown={down} onKeyDown={key} data-spgrip><i /></div>
    <div class="sptabs" role="tablist" aria-label={t('mark.sp_tabs')}>{tabs.map(x => <button type="button" role="tab" class="sptab" aria-selected={x.key === on ? 'true' : 'false'} onClick={() => onPick(x.key)} data-sptab={x.key} data-raw={x.tool ? undefined : ''}>{x.tool ? t('mark.sp_rubric') : x.label.replace(/\.(pdf|docx?|docm|txt|rtf|jpe?g|png|heic|mp4|mov|m4a|mp3|webm)$/i, '')}</button>)}</div>
    <Menu label={t('mark.sp_where')} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('mark.sp_where')} data-spwhere />} items={AT.map(([k, l]) => ({ label: t(l), checked: at === k, onSelect: () => onAt(k) }))} />
    <IconButton icon="x" size="sm" label={t('mark.sp_close')} kbd="B" onClick={onClose} data-spclose />
  </div>;
}
// The rubric in full: every row with what each score means; a click gives that score, as in the score panel.
function SideRubric({ st, onSetup }) {
  const su = state().setup, g = st.grade.rubric, M = MK && MK.M, words = (i, v) => ((su.levels && su.levels[i]) || {})[v] || '';
  const any = su.criteria.some((_, i) => rowSteps(su, i).some(v => words(i, v)));
  return <div class="in-sp mk-sprub">
    {!any && <p class="mute">{t('mark.sp_no_words')} <button type="button" class="link" onClick={onSetup} data-spedit>{t('mark.su_menu')}</button></p>}
    {su.criteria.map((c, i) => { const v = g[i];
      return <section class="sprow"><h4><span data-raw>{c}</span><em>{v == null ? '' : fmtNum(v) + ' / ' + rowTop(su, i)}</em></h4>
        <div class="splv">{rowSteps(su, i).filter(w => w % 1 === 0 && (w > 0 || words(i, w))).map(w =>
          <button type="button" class={'splvb' + (v === w ? ' on' : '')} aria-pressed={v === w ? 'true' : 'false'} disabled={!M} onClick={() => M.setRow(i, w)} data-sprow={i} data-spv={w}><b>{w}</b>{words(i, w) && <span data-raw>{words(i, w)}</span>}</button>)}</div></section>; })}
  </div>;
}

function Paper({ batch, cur, zoom, ver, FU, ctl, onSp, onZoom, onSetup }) {
  const st = batch.students[cur], [got, setGot] = useState(null), area = useRef(null), [size, setSize] = useState([0, 0]), was = useRef(null);
  useEffect(() => {
    // the same student opened again after a change keeps showing until the pages are ready, so the paper doesn't flash and a dialog
    // open under it (Add, A video…) isn't lost
    let live = true; if (!was.current || was.current[0] !== batch || was.current[1] !== cur) setGot(null); was.current = [batch, cur, ver];
    use({ cur });
    seam.ready = false;
    if (st) openPages(st, () => live, FU && FU.impAuto).then(r => { if (live) { setGot(r); seam.ready = true; } });
    return () => { live = false; };
  }, [batch, cur, ver]);
  // a finger moves the page once a pencil has been used, two pinch to zoom, a palm does nothing (src/touch.js)
  const zr = useRef(zoom); zr.current = zoom;
  useEffect(() => area.current && installTouch(area.current, { zoom: () => zr.current, setZoom: onZoom, commit: () => { if (MK) MK.M.commit(); } }), []);
  useEffect(() => {
    const el = area.current; if (!el) return;
    const measure = () => { const cs = getComputedStyle(el); setSize([el.clientWidth - (parseFloat(cs.paddingLeft) || 18) - (parseFloat(cs.paddingRight) || 18), el.clientHeight]); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, []);
  // until the effect above has run for a newly opened student, what was got is the last student's
  const fresh = !!was.current && was.current[0] === batch && was.current[1] === cur, gotNow = fresh ? got : null;
  if (!fresh || was.current[2] !== ver) seam.ready = false;   // the pages are opening again: not ready until they have
  // the side pane: what it can show, whether it is open and on what, and where it sits
  const [mine, setMine] = useState(null), [, spAgain] = useState(0);
  const tabs = st && gotNow ? spTabs(st, gotNow, state().setup) : [];
  const base = mine && st && mine.k === st.key ? mine : { k: st && st.key, shown: spWanted(tabs), key: (spChoose(tabs) || {}).key };
  const sel = base.shown ? tabs.find(x => x.key === base.key) || spChoose(tabs) : null;
  const spOpen = key => {
    if (!tabs.length) { toast(t('mark.sp_nothing')); return; }
    spSet({ on: true, noVid: null });
    const k = key && tabs.some(x => x.key === key) ? key : (sel || spChoose(tabs)).key;
    if (key) spSet({ tab: tabs.find(x => x.key === k).kind });
    setMine({ k: st.key, shown: true, key: k });
  };
  const spClose = () => { spSet({ on: null, noVid: spHasVideo(tabs) ? true : spConf().noVid }); setMine({ ...base, shown: false }); };
  const spPick = key => { const x = tabs.find(y => y.key === key); if (!x) return; spSet({ tab: x.kind }); setMine({ k: st.key, shown: true, key }); };
  if (ctl) ctl.current = { toggle: () => (sel ? spClose() : spOpen()), open: spOpen, has: k => tabs.some(x => x.key === k) };
  useEffect(() => { if (onSp) onSp({ n: tabs.length, shown: !!sel }); }, [tabs.length, !!sel]);
  const c = spConf(), W = size[0], H = size[1];
  let at = sel ? (c.at === 'left' || c.at === 'top' ? c.at : 'right') : '';
  if (at && at !== 'top' && W < SP_SIDE + SP_MAIN + 16) at = 'top';   // a narrow window: one above the other
  const side = at && at !== 'top', px = !at ? 0 : at === 'top' ? Math.round(clampN((c.h || 0.44) * H, SP_TOP, Math.max(SP_TOP, H - 180))) : Math.round(clampN((c.w || 0.46) * W, SP_SIDE, W - 16 - SP_MAIN));
  const inSp = k => !!at && sel.key === k;
  const roomOf = k => !at ? W : inSp(k) ? (side ? px - 24 : W - 24) : side ? W - px - 16 : W;
  const tallOf = k => at === 'top' && inSp(k) ? px - 24 : H;
  const cl = k => inSp(k) ? ' in-sp' : '';
  const spSize = v => { spSet(at === 'top' ? { h: v } : { w: v }); spAgain(n => n + 1); };
  const spAt = k => { spSet({ at: k === 'right' ? null : k }); spAgain(n => n + 1); };
  const n = st ? st.files.length + 5 : 0;
  return <div class={'mk-paper' + (at ? ' sp-' + at : '')} ref={area} tabindex="-1" style={at ? { '--sp-px': px + 'px', '--sp-h': H + 'px', gridTemplateRows: side ? 'repeat(' + n + ', auto)' : undefined } : undefined}>
    {st && PM && <PM.ReadingCards key="rd" st={st} />}{!st ? null : !st.files.length ? <><EmptyState icon="inbox" title={t('mark.nothing_in')} />{FU && <FU.FilesFoot key={st.key} st={st} name={shownName(st, cur)} />}</>
      : !gotNow ? <div class="loading" aria-busy="true" />
      : <>{FU && <FU.GroupBand key="band" st={st} />}{st.files.filter(f => f.kind === 'link').concat(st.files.filter(f => f.kind === 'media')).map(f => <div key={'file:' + f.path} class={'fwrap' + cl('file:' + f.path)}><header class="fhead"><span data-raw>{f.kind === 'link' ? f.name.replace(/\.(url|webloc)$/i, '').replace(/ \(added \d+\)$/, '') : f.name}</span><span class="mute">{t(f.kind === 'media' ? 'mark.v_recording' : 'mark.v_link_kind')}</span>{FU && <FU.AddTag st={st} f={f} />}{FU && <FU.CarryTag st={st} f={f} />}<span class="grow" />{FU && <FU.FileMenu st={st} path={f.path} name={f.name} />}</header><MediaFile key={f.path} st={st} f={f} /></div>)}
        {gotNow.cards.map(c => c.kind === 'file' ? <div key={'file:' + c.f.path} class={'fwrap' + cl('file:' + c.f.path)}>{FU && c.f.added && c.f.kind !== 'docx' && <FU.AddTag st={st} f={c.f} />}{FU && <FU.CarryTag st={st} f={c.f} />}{FU && <FU.FileMenu st={st} path={c.f.path} name={c.f.name} />}{c.f.kind === 'docx' && c.f.data ? <WordPaper key={c.f.path} st={st} f={c.f} FU={FU} /> : <OtherFile key={c.f.path} f={c.f} />}</div>
        : <section key={docKey(c.d)} class={'doc' + cl(docKey(c.d))}>
          <header class="fhead"><span data-raw>{c.d.name}</span>{FU && <FU.AddTag st={st} f={st.files.find(f => f.path === (c.d.file || c.d.pages[0][0])) || {}} />}{!c.on && <span class="pill">{t(c.auto ? 'mark.left_out_auto' : 'mark.left_out')}</span>}{FU && <FU.CarryTag st={st} f={st.files.find(f => f.path === (c.d.file || c.d.pages[0][0])) || {}} />}<span class="grow" />{FU && !c.on && <FU.BackIn st={st} d={c.d} />}{FU && <FU.FileMenu st={st} path={c.d.file || c.d.pages[0][0]} name={c.d.name} d={c.d} on={c.on} auto={c.auto} />}</header>
          {c.pages.map(pg => <Page key={pg.file.path + '|' + pg.idx} pg={pg} room={roomOf(docKey(c.d))} tall={tallOf(docKey(c.d))} zoom={zoom} FU={FU} />)}
        </section>)}{FU && <FU.FilesFoot key={st.key} st={st} name={shownName(st, cur)} />}
        {at && <SideBar key="sp-bar" tabs={tabs} on={sel.key} at={at} onPick={spPick} onClose={spClose} onAt={spAt} onSize={spSize} />}
        {at && sel.tool && <SideRubric key="sp-rubric" st={st} onSetup={onSetup} />}</>}
  </div>;
}

// The score, as the current app's panel has it: a row for each criterion with its steps (or points), the total and percent,
// Missing / Excused / Late, the comment, and Next to score. Until the marking tools have loaded it shows the score and can't change it.
// Enter presses Next to score only from nowhere in particular (or a score slider), never over a button she has focused.
// a number key scores from anywhere but a box she types in; a score slider counts as nowhere in particular
const keyable = () => { const a = document.activeElement; return !a || !(a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || a.classList.contains('srange'); };
const free = () => { const a = document.activeElement; return !a || a === document.body || (a.classList && (a.classList.contains('srange') || a.classList.contains('mk-paper'))); };
// an anchor paper's tag in the list (src/anchors.js anchorTag)
const AN = { high: 'mark.an_high', mid: 'mark.an_mid', low: 'mark.an_low' };
const STATUS = [['missing', () => t('mark.missing')], ['excused', () => t('mark.excused')], ['late', () => t('mark.late')]];
function ScorePanel({ batch, cur, onNext, onPrev, FU, fm, first, last, solo, onCalc, onSolo, onSetup }) {
  // pointing at a score shows what it means, in place of the words for the score given (src/rubrics.js levelPreview)
  const [peek, setPeek] = useState(null);
  const st = batch.students[cur]; if (!st) return null;
  const g = gradeOf(st), max = maxPoints(), name = shownName(st, cur), su = state().setup, M = MK && MK.M, off = !M;
  const file = st.files[0], row = M ? M.rowInHand() : -1, gr = st.grade;
  const next = () => { if (!M) return onNext(); if (!M.nextUnscored()) toast(t('mark.everyone_scored')); };
  const stamp = r => { if (!state().pages.length) return toast(t('mark.stamp_open')); if (M.scoreStamp(r)) toast(t('mark.stamp_where')); };
  // the points box: up and down go to the last or next student, not half a point; Enter leaves the box
  const ptsKey = e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.currentTarget.blur(); (e.key === 'ArrowDown' ? onNext : onPrev)(); } };
  const lvl = (i, v) => (v == null ? '' : String((su.levels && su.levels[i] && su.levels[i][v]) || ''));

  return <aside class="mk-side" aria-label={t('mark.score')}><div class="mk-sbody">
    <div class="who"><Avatar name={name} /><div><h2 class="t4" data-raw>{name}</h2>
      <p class="mute">{t('mark.n_of', { n: cur + 1, of: batch.students.length })}{file ? <>, <span data-raw>{file.name}</span></> : ''}</p>{PM && <PM.Sent st={st} />}</div>
      {PM && M && <PM.PaperMore st={st} cur={cur} onSolo={solo ? null : onSolo} onSetup={onSetup} />}</div>
    {fm ? <><h3 class="mk-h">{t('mark.fb_head')}</h3>
      <p class="mute">{t('mark.fb_text')} {PM && M && <PM.ChangeType />}</p>
      <div class="mk-fb"><Button aria-pressed={gr.fb ? 'true' : 'false'} icon={gr.fb ? 'check' : undefined} disabled={off} onClick={() => M.setFb(!gr.fb)} kbd="F" data-fb>{t(gr.fb ? 'mark.fb_done' : 'mark.fb_mark')}</Button>
        {!gr.fb && !last && <Button variant="primary" disabled={off} onClick={() => { M.setFb(true); onNext(); }} kbd="Shift F" data-fbnext>{t('mark.fb_next')}</Button>}</div></>
    : <>{FU && M && <FU.IbAsk />}{PM && M ? <PM.ScoreHead onSetup={onSetup} /> : <h3 class="mk-h vh">{t('mark.score')}</h3>}
    {su.mode === 'rubric' ? <div class="mk-crits">{su.criteria.map((c, i) => { const v = gr.rubric[i], steps = rowSteps(su, i), top = rowTop(su, i), k = steps.indexOf(v);
      const pct = k < 0 ? 0 : steps.length > 1 ? (k / (steps.length - 1)) * 100 : 100, pk = peek && peek.i === i && lvl(i, peek.v), say = pk || lvl(i, v);
      return <div class={'mk-crit' + (i === row ? ' on' : '') + (v == null ? ' unset' : '')} data-row={i} style={{ '--f': pct / 100 }}>
        <div class="cn"><button type="button" class="nm" tabindex="-1" onClick={() => M && M.pickRow(i)} data-raw>{c}</button>{v != null && M && <IconButton icon="stamp" size="sm" label={t('mark.stamp_row', { c })} tabindex="-1" onClick={() => stamp(i)} data-critstamp={i} />}<em>{v == null ? <small>{'– / ' + top}</small> : <>{fmtNum(v)}<small>{' / ' + top}</small></>}</em></div>
        <div class="strack"><input type="range" class={'srange' + (v == null ? ' unset' : '')} min="0" max={steps.length - 1} step="1" value={Math.max(0, k)} disabled={off}
          aria-label={t('mark.row_score', { c })} aria-valuetext={v == null ? t('mark.not_scored') : t('mark.v_of', { v: fmtNum(v), of: top }) + (say ? ', ' + say : '')}
          onInput={e => M.setRow(i, steps[+e.currentTarget.value], { toggle: false })}
          onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); if (v != null) M.setRow(i, v); }
            if (e.key === 'Enter' && prefs.get('gs.enterNext', null) !== false) { e.preventDefault(); e.currentTarget.blur(); next(); } }} />
        <div class="sticks" role="group" aria-label={t('mark.row_score', { c })}>{steps.map((w, j) => <button type="button" class={w % 1 ? 'half' : ''} style={{ '--at': steps.length > 1 ? j / (steps.length - 1) : 0 }} data-v={w} tabindex="-1" aria-pressed={v === w ? 'true' : 'false'} disabled={off} onClick={() => M.setRow(i, w)} onMouseEnter={() => setPeek({ i, v: w })} onMouseLeave={() => setPeek(null)}>{fmtNum(w)}</button>)}</div></div>
        {say && <p class={'lvl mute' + (pk ? ' peek' : '')} title={say} data-raw data-lvl={i}>{say}</p>}
      </div>; })}</div>
      : <div class="mk-pts"><input type="text" inputmode="decimal" aria-label={t('mark.points')} value={gr.pk != null && gr.pk !== '' ? gr.pk + '%' : gr.points} disabled={off}
          onInput={e => M.setPoints(e.currentTarget.value, e.currentTarget)} onBlur={() => M && M.leftPoints()} onKeyDown={ptsKey} /><span class="mute">{t('mark.out_of_pts', { n: su.outOf })}</span></div>}
    {FU && M && ibSetup() ? <FU.IbTotal st={st} onStamp={() => stamp(null)} /> : <div class={'total' + (g.total == null ? ' none' : '')}><b>{g.total != null ? fmtNum(g.total) : '–'}</b><span class="mute">{max ? t('mark.out_of', { n: fmtNum(max) }) : ''}</span>
      <span class="grow" /><span class="pct">{g.pct != null ? fmtNum(g.pct) + '%' : ''}</span></div>}
    {g.total == null && <p class="mute nosc">{t('mark.no_score')}</p>}</>}
    <CommentBox value={gr.comment || ''} off={off} onInput={v => M.setComment(v)} />
    {M && <CommentChips text={gr.comment || ''} onAdd={c => M.setComment((gr.comment || '').trim() ? (gr.comment || '').replace(/\s+$/, '') + ' ' + c : c)} />}
    <Rove class="mk-stat" role="group" aria-label={t('mark.mark_as')}>{STATUS.map(([k, l]) => <button type="button" class="chip" aria-pressed={gr.status === k ? 'true' : 'false'} disabled={off} data-status={k} onClick={() => M.setStatus(k)}>{l()}</button>)}{FU && M && <FU.ScoreMore st={st} />}</Rove>
    {FU && M && <FU.Anchors st={st} />}
    {FU && M && <FU.PastWork st={st} />}
    {TN && M && <TN.NotesPart st={st} />}</div>
    {/* Previous, Next to score and Next: one stop in the Tab order (Next to score first), the arrow keys among them */}
    {!solo && <Rove class="foot" role="group" aria-label={t('mark.students')}><IconButton icon="chl" variant="plain" label={t('mark.prev')} onClick={onPrev} disabled={first} data-prev />
      {fm ? <><IconButton icon="chr" variant="plain" label={t('mark.next')} onClick={onNext} disabled={last} data-next-plain />{M && batch.students.some(x => x !== st && !noScore(x) && !x.grade.fb) && <Button variant="quiet" size="sm" kbd="N" onClick={next} data-nextfb data-rovehome>{t('mark.next_fb')}</Button>}</>
        : <><Button variant="primary" kbd="Enter" onClick={next} data-next data-rovehome>{t('mark.next_score')}</Button><IconButton icon="chr" variant="plain" label={t('mark.next')} onClick={onNext} disabled={last} data-next-plain /></>}</Rove>}
  </aside>;
}

// The comment for the student: a long text box, so it has dictation like every other (ui Mic); words go in where the cursor is.
function CommentBox({ value, off, onInput }) {
  const ta = useRef(null), [on, setOn] = useState(false);
  const put = words => { const el = ta.current; if (!el) return; const v = el.value, a = el.selectionStart ?? v.length, b = el.selectionEnd ?? v.length, before = v.slice(0, a), sp = before && !/\s$/.test(before) ? ' ' : '';
    onInput(before + sp + words.trim() + v.slice(b)); };
  return <span class={'dfield mk-cbox' + (on ? ' listening' : '')}><textarea ref={ta} class="mk-cmt" aria-label={t('mark.comment_for')} placeholder={t('mark.comment_for_ph')} value={value} disabled={off} data-raw
    onInput={e => onInput(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur(); }} />{!off && <Mic onText={put} onListening={setOn} />}</span>;
}
// Her saved comments, one click from the comment box (src/markscreen.js cmtChips): the first three as chips, the rest and saving this
// one under Saved comments. They are the comment bank the current app keeps (gs.bank), changed through students/write.js.
let BANK = null;
function CommentChips({ text, onAdd }) {
  const [bank, setBank] = useState(BANK), [open, setOpen] = useState(false);
  useEffect(() => { let live = true; const read = () => PARTS.cbank().then(m => m.readBank()).then(b => { BANK = b; if (live) setBank(b); }, e => console.error(e));
    // saved here, or in another window (H-061: its storage event)
    const other = e => { if (e.key === 'gs.bank' || e.key === null) read(); }; addEventListener('storage', other);
    read(); const off = onSaved(e => { if (e.kind === 'setting' && e.id === 'gs.bank') read(); }); return () => { live = false; off(); removeEventListener('storage', other); }; }, []);
  if (!bank) return null;
  const short = c => { c = String(c).replace(/\s+/g, ' ').trim(); return c.length > 26 ? c.slice(0, 25).trimEnd() + '…' : c; };
  const save = () => { const c = text.trim(); if (!c) return toast(t('mark.cb_type_first')); if (bank.includes(c)) return toast(t('mark.cb_already'));
    PARTS.cbank().then(m => m.addToBank(c, t('mark.cb_saved_step'))).then(b => { BANK = b; setBank(b); toast(t('mark.cb_saved')); }, e => console.error(e)); };
  return <Rove class="mk-cbank" role="group" aria-label={t('mark.cb_saved_comments')}>{bank.slice(0, 3).map(c => <button type="button" class="chip" title={c} data-raw onClick={() => onAdd(c)} data-cbank>{short(c)}</button>)}
    <span class="mk-cbm"><button type="button" class="chip" aria-haspopup="menu" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(v => !v)} data-cbmore>{t('mark.cb_saved_comments')}</button>
      {open && <div class="mk-lfmenu up" role="menu" aria-label={t('mark.cb_saved_comments')} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
        <button type="button" role="menuitem" onClick={() => { setOpen(false); save(); }} data-cbsave><span>{t('mark.cb_save')}</span></button>
        {bank.length ? bank.map(c => <button type="button" role="menuitem" title={c} data-raw onClick={() => { setOpen(false); onAdd(c); }}><span>{c.length > 90 ? c.slice(0, 89) + '…' : c}</span></button>) : <p class="mute">{t('mark.cb_none')}</p>}
        <a class="link" href={href('settings', 'marking')} data-cbedit>{t('mark.cb_edit')}</a></div>}</span></Rove>;
}

// Only this student (src/solo.js): when a student comes to the desk, the screen shows them and nobody else. Only a flag in this
// browser (gs.solo); the list, the tabs and the way to anyone else step aside, and it ends only by holding the button for 1.5 s.
// A flag with no time (from before, or come in through sync) or older than three hours is let go (11/23: an old one kept taking over).
const soloOf = b => {
  const s = prefs.get('gs.solo', null);
  if (s && !(s.at > 0 && Date.now() - s.at <= 3 * 3600e3 && s.at <= Date.now() + 6e4)) { prefs.del('gs.solo'); return null; }
  return s && b && s.id === b.id && s.key != null ? s : null;
};
function SoloBar({ st, name, asg, onEnd }) {
  const [hold, setHold] = useState(false), tm = useRef(0), [SW, setSW] = useState(null);
  useEffect(() => { let live = true; PARTS.solowork().then(m => live && setSW(() => m.OtherWork), e => console.error(e)); return () => { live = false; }; }, []);
  const down = on => { clearTimeout(tm.current); setHold(on); if (on) tm.current = setTimeout(() => { setHold(false); onEnd(); }, 1500); };
  useEffect(() => () => clearTimeout(tm.current), []);
  return <div class="mk-solo" role="region" aria-label={t('mark.solo')}>
    <Icon name="user" /><b>{t('mark.solo')}</b><span data-raw>{name}</span><span class="mute" data-raw>{asg}</span><span class="grow" />{SW && <SW st={st} />}
    <button type="button" class={'btn sm mk-hold' + (hold ? ' holding' : '')} data-soloend onPointerDown={e => { if (e.button === 0) { e.preventDefault(); down(true); } }} onPointerUp={() => down(false)} onPointerLeave={() => hold && down(false)} onPointerCancel={() => down(false)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) down(true); } }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') down(false); }} onContextMenu={e => e.preventDefault()}>
      <span class="fill" aria-hidden="true" /><span>{t('mark.solo_hold')}</span></button>
  </div>;
}

function RubricAsk({ ask }) {
  if (!ask) return null;
  const { q, done } = ask;
  return <Dialog open title={t('mark.which_rubric')} onClose={() => done(null)} actions={<>
    <Button onClick={() => done(null)}>{t('mark.not_now')}</Button>
    <Button onClick={() => done('b')}>{t(q.fit ? 'mark.fits' : 'mark.with_work')}</Button>
    <Button variant="primary" onClick={() => done('a')}>{t(q.fit ? 'mark.last_saved' : 'mark.on_card')}</Button></>}>
    <p>{t('mark.which_rubric_text')}</p></Dialog>;
}

export default function MarkScreen({ route, classes }) {
  const id = route.params.id, tab = TABS.includes(route.params.tab) ? route.params.tab : 'mark';
  const [w, setW] = useState(null), [err, setErr] = useState(null), [cur, setCur] = useState(0), [ask, setAsk] = useState(null);
  const [zoom, setZoom] = useState(() => keep('zoom') || 1), [, tick] = useState(0), zr = useRef(zoom); zr.current = zoom;
  const zoomTo = z => { z = Math.min(3, Math.max(0.5, Math.round(z * 100) / 100)); zr.current = z; setZoom(z); keep('zoom', z); };
  // the list's filter (this visit to this assignment only), the list folded to a strip ([, gs.listOpen), the score panel folded away
  // (], gs.panels.R), and Only this student (gs.solo)
  const [Calc, setCalc] = useState(null);
  // Hide names and Check the covers (mark/covers.jsx), loaded when first asked for
  const [CV, setCV] = useState(null), [cvDlg, setCvDlg] = useState(null);
  const cvCtx = { M: MK && MK.M, open: i => pickRef.current(i), cur: () => state().cur, reopen: () => setVer(v => v + 1) };
  const checkCovers = async j => { const m = CV || await PARTS.covers(); setCV(m); setCvDlg({ k: 'check', st: state().batch.students[j] }); };
  const hideNames = async again => { const m = CV || await PARTS.covers(); setCV(m); if (again) return m.shuffle(cvCtx); if (anonOn()) m.setAnon(false, cvCtx); else setCvDlg({ k: 'anon' }); };
  const spCtl = useRef(null), [sp, setSp] = useState({ n: 0, shown: false });
  const openCalc = () => { if (Calc) return setCalc(null); PARTS.calc().then(m => setCalc(() => m.Calculator), e => console.error(e)); };
  const [lf, setLf] = useState('all'), [fold, setFoldS] = useState(() => prefs.get('gs.listOpen', null) === false), [noR, setNoR] = useState(() => !!(prefs.get('gs.panels', {}) || {}).R), [soloK, setSoloK] = useState(0);
  useEffect(() => setLf('all'), [id]);
  // the keys read these, not the render's own values, so a key pressed again before the keys are set up anew still turns it back
  const foldR = useRef(fold), noRR = useRef(noR); foldR.current = fold; noRR.current = noR;
  const setFold = v => { foldR.current = v; setFoldS(v); prefs.set('gs.listOpen', !v); };
  const setPanel = v => { noRR.current = v; setNoR(v); prefs.set('gs.panels', { ...(prefs.get('gs.panels', {}) || {}), R: v }); };
  useEffect(() => { if (!w) return; let off = null, live = true;
    PARTS.marking().then(m => { if (!live) return; MK = m; off = m.start({ toast: text => toast(text), openStudent: i => pickRef.current(i), changed: () => tick(n => n + 1), zoom: { get: () => zr.current, set: zoomTo } }); tick(n => n + 1);
      PARTS.pmore().then(x => { PM = x; if (live) tick(n => n + 1); return x.topbar(); }).then(x => { TB = x; if (live) tick(n => n + 1); }, e => console.error(e)); });
    return () => { live = false; if (off) off(); }; }, [w]);
  // again: the download opened once more from storage (another window saved it), on the student she was on (wantKey)
  const [again, setAgain] = useState(0), wantKey = useRef(null), [dl, setDl] = useState(null);
  useEffect(() => {
    let live = true; setW(null); setErr(null); seam.read = false; seam.ready = false;
    // the opener (mark/open.js, with the lifted opening code) loads as a part of its own, so it isn't in this screen's own load
    PARTS.bring().then(O => O.openKept(id, { question: q => new Promise(done => setAsk({ q, done: v => { setAsk(null); done(v); } })), onStep: (n, of) => live && setDl({ n, of }) }))
      .then(r => { if (!live) return; setDl(null); if (!r) return history.back(); setW(r);
        const k = wantKey.current, at = k ? r.batch.students.findIndex(st => st.key === k) : -1; wantKey.current = null;
        const n = at >= 0 ? at : Math.min(r.cur || 0, r.batch.students.length - 1); setCur(n); if (at >= 0) use({ cur: at }); }, e => { if (e.name !== 'NotKept') console.error(e); if (live) setErr(e); });   // papers not kept here: the page says so, nothing went wrong
    return () => { live = false; seam.ready = false; if (MK) MK.M.saveNowDone(); };
  }, [id, again]);
  // other windows: their saves come in when she comes back here, a download forgotten there closes here (mark/windows.js)
  useEffect(() => watchWindows({
    batch: () => (w && state().batch === w.batch ? w.batch : null), cur: () => state().cur,
    save: () => (MK ? MK.M.saveNowDone() : Promise.resolve()),
    reopen: key => { wantKey.current = key; setAgain(n => n + 1); toast(t('mark.win_reopened')); },
    forgotten: () => { toast(t('mark.win_forgot')); history.back(); },
  }), [w]);
  const solo = w ? soloOf(w.batch) : null, soloI = solo ? w.batch.students.findIndex(st => st.key === solo.key) : -1;
  const pick = useCallback(i => { if (!w) return; if (soloOf(w.batch)) return; const n = Math.max(0, Math.min(w.batch.students.length - 1, i)); if (MK) MK.M.commit(); if (n !== state().cur) seam.ready = false; setCur(n); use({ cur: n }); }, [w]);
  const pickRef = useRef(pick); pickRef.current = pick;
  // Only this student opens straight on them, after a reload too
  useEffect(() => { if (w && soloI >= 0 && cur !== soloI) { if (MK) MK.M.commit(); seam.ready = false; setCur(soloI); use({ cur: soloI }); } }, [w, soloI]);
  const fm = !!(MK && MK.M.fmNow());
  const order = w ? shownOrder(w.batch, lf, cur, fm) : [], at = order.indexOf(cur);
  const step = d => { const n = order[at + d]; if (n != null) pick(n); };
  const soloStart = () => { if (!w || !w.batch.students[cur]) return; if (MK) MK.M.commit(); prefs.set('gs.solo', { id: w.batch.id, key: w.batch.students[cur].key, at: Date.now() }); setSoloK(k => k + 1); };
  const soloEnd = () => { prefs.del('gs.solo'); setSoloK(k => k + 1); };
  // Grades, Insights and Return load as a part of their own, with the export engine and its libraries, the first time one opens.
  const [out, setOut] = useState(null);
  // the Examples tab (class/examples.jsx AsgExamples), between Insights and Return once the assignment has an example (exTabSay)
  const [EX, setEX] = useState(null), [exN, setExN] = useState(0);
  useEffect(() => { if (!w) return; let live = true; const tw = twinsOf(state().lib, w.batch.assignment);
    const read = () => import('../../students/index.js').then(S => S.exampleRecords()).then(l => live && setExN(l.filter(r => !r.gone && !r.watch && (r.work === w.batch.id || (r.asg && tw.includes(r.asg)))).length), () => {});
    read(); const off = onSaved(e => { if (e.kind === 'example') read(); }); return () => { live = false; off(); }; }, [w]);
  useEffect(() => { if (tab === 'examples' && !EX) PARTS.examples().then(setEX, e => console.error(e)); }, [tab]);
  useEffect(() => { if (!w || tab === 'mark' || tab === 'examples' || out) return; let live = true;
    Promise.all([PARTS.out(), PARTS.outEngine(), PARTS.marking()]).then(([p, E, m]) => { E.withMarking(m.M); seam.out = E; if (live) setOut({ Out: p.default, E }); }, e => console.error(e));
    return () => { live = false; }; }, [w, tab]);
  const openOn = i => { pick(i); go('mark', id, ''); };
  // A student's files changed (mark/change.js through mark/fileui.jsx, loaded with the tools): the paper opens again.
  const [FU, setFU] = useState(null), [ver, setVer] = useState(0), [carried, setCarried] = useState(false), [light, setLight] = useState(false), [rescans, setRescans] = useState(false);
  useEffect(() => setCarried(!!(w && w.carried)), [w]);
  useEffect(() => { if (!w || !MK) return; let live = true;
    PARTS.fileui().then(m => { if (!live) return; m.wire(MK.M, i => { if (i >= 0) pickRef.current(i); setVer(v => v + 1); }, spCtl); setFU(m); m.takeSplit(); m.pdfAuto(); m.impAutoNow();
      PARTS.typed().then(x => { x.useKeep(MK.M.keepSetup); TN = x; if (live) tick(n => n + 1); }, e => console.error(e));
      // the papers are read in the background as they open, as the current app reads them (src/app/open.js scanAll): a grade written on
      // a paper, notes made in other apps, and marks from other apps that could be hers
      // (a download opened again partway through, another window's work coming in, leaves the first read without its papers: not an error)
      PARTS.outEngine().then(E => { E.withMarking(MK.M); OE = E.X; return E.readPapers(); }).then(() => { seam.read = true; if (live) tick(n => n + 1); }, e => { if (live) console.error(e); }); }, e => console.error(e));
    return () => { live = false; }; }, [w, !!MK]);
  // What opened: a line after the papers open when there's something new to say, and the whole report from the student list.
  const [rep, setRep] = useState(null), [repList, setRepList] = useState(false);
  const [su, setSu] = useState(null);
  useEffect(() => { if (!w) return; let live = true; setRep(null); PARTS.report().then(m => { if (live) setRep(m); }, e => console.error(e)); return () => { live = false; }; }, [w]);
  useEffect(() => {
    if (!w) return;
    const offs = [
      register({ id: 'mark-next', keys: ['arrowdown', 'arrowright'], label: 'mark.next', when: () => !solo && !(MK && MK.M.pickedNow()), run: () => step(1) }),
      register({ id: 'mark-prev', keys: ['arrowup', 'arrowleft'], label: 'mark.prev', when: () => !solo && !(MK && MK.M.pickedNow()), run: () => step(-1) }),
      register({ id: 'mark-side', keys: 'b', label: 'mark.sp_key', group: 'mark.score', when: () => !solo && !!spCtl.current, run: () => spCtl.current.toggle() }),
      register({ id: 'mark-calc', keys: '=', label: 'mark.calc', when: () => !!MK && !Calc && !MK.M.resizable(), run: openCalc }),
      register({ id: 'mark-unscored', keys: 'n', label: 'mark.next_score', when: () => !!MK && !solo, run: () => { if (!MK.M.nextUnscored()) toast(t('mark.everyone_scored')); } }),
      register({ id: 'mark-list', keys: '[', label: 'mark.list_keep', when: () => !solo, run: () => (TB && TB.pin()) || setFold(!foldR.current) }),
      register({ id: 'mark-panel', keys: ']', label: 'mark.panel_fold', run: () => setPanel(!noRR.current) }),
      register({ id: 'mark-solo', keys: 'i', label: 'mark.solo_start', when: () => !solo && tab === 'mark', run: soloStart }),
      // F turns Feedback complete on or off; Shift F sets it on and goes to the next student
      register({ id: 'mark-fb', keys: 'f', label: 'mark.fb_key', group: 'mark.score', when: () => !!MK && MK.M.fmNow() && !noScore(w.batch.students[cur]), run: e => { if (!e.shiftKey) return MK.M.setFb(!w.batch.students[cur].grade.fb); MK.M.setFb(true); if (!solo) step(1); } }),
      // on a score slider too, as the current app's scoreKey(e, onRange): the number scores that row, and the next row's slider takes the keyboard
      register({ id: 'mark-score', keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.'], label: 'mark.key_score', group: 'mark.score', inInputs: true, when: () => !!MK && state().setup.mode === 'rubric' && keyable(), run: e => {
        const sl = e.target.closest && e.target.closest('.srange') && e.target.closest('[data-row]'); if (sl && e.key !== '.') MK.M.pickRow(+sl.dataset.row);
        const r = MK.M.scoreKey(e.key);
        if (sl) setTimeout(() => { const n = document.querySelector('.mk-crit[data-row="' + MK.M.rowInHand() + '"] .srange'); if (n) n.focus({ preventScroll: true }); });
        if (r === 'none') toast(t('mark.every_row')); else if (r === 'over') toast(t('mark.row_top', { n: rowTop(state().setup, MK.M.rowInHand()) })); else if (r === 'nohalf') toast(t('mark.no_half'));
      } }),
      register({ id: 'mark-enter', keys: 'enter', label: 'mark.next_score', group: 'mark.score', when: () => !!MK && free() && prefs.get('gs.enterNext', null) !== false, run: () => { if (!MK.M.nextUnscored()) toast(t('mark.everyone_scored')); } }),
    ];
    // with Only this student on, nothing that could show someone else answers: finding, the list, the command bar
    const shut = e => { if (solo && (e.key === '/' || e.key === '[' || e.key === '?' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) e.preventDefault(); };
    addEventListener('keydown', shut, true);
    return () => { removeEventListener('keydown', shut, true); offs.forEach(f => f()); };
  }, [w, cur, lf, fold, noR, solo, fm, tab, Calc]);
  const cls = w && w.batch.classId != null ? (w.lib.classes || []).find(c => c.id === w.batch.classId) : null;
  const marked = w ? w.batch.students.filter(isMarked).length : 0, n = w ? w.batch.students.filter(st => !st.gap || st.files.length).length : 0;
  const close = () => (cls ? go('class', cls.id) : go('home'));
  const openSetup = () => PARTS.setup().then(m => setSu(m), e => console.error(e));
  // Setup (the current app's More menu, This assignment): Rubric setup, Bring in files (several late papers at once, each sorted to its
  // student: mark/bringin.jsx) and Partners and videos (mark/partners.jsx)
  const [setupDlg, setSetupDlg] = useState(null);
  // Share with your assistant (mark/share.jsx), from this menu and from Insights; the assistant's name is handed in with ctx
  const openShare = kind => PARTS.share().then(S => setSetupDlg({ k: 'sh', S, kind: typeof kind === 'string' ? kind : null }), e => console.error(e));
  // Grade sheet and Consistency from Find: the tab, and the view on it (screens/mark-out.jsx), at its own address (grades/sheet, insights/consistency)
  const [askV, setAskV] = useState(null), view = (k, v) => { setAskV({ v }); go('mark', id, k, { sheet: 'sheet', cons: 'consistency' }[v]); };
  const bringMany = () => PARTS.bringin().then(B => setSetupDlg({ k: 'fof', B }), e => console.error(e));
  const setupItems = [{ label: t('mark.su_menu'), icon: 'settings', onSelect: openSetup }, { label: t('mark.bf_menu'), icon: 'upload', onSelect: bringMany },
    // What opened (src/app/screens.js openRepBtn, A-121): the same report as the student list's menu
    ...(rep ? [{ label: t('mark.op_title'), icon: 'info', onSelect: () => setRepList(true) }] : []),
    { label: t('mark.pv_menu'), icon: 'people', onSelect: () => PARTS.partners().then(P => setSetupDlg({ k: 'pv', P }), e => console.error(e)) },
    { label: t('mark.qm_menu'), icon: 'check', onSelect: () => quick() },
    ...(w && (w.batch.clips || []).length ? [{ label: t('mark.cl_menu'), icon: 'play', onSelect: () => PARTS.clips().then(Cl => setSetupDlg({ k: 'cl', Cl }), e => console.error(e)) }] : []),
    { label: t('mark.sh_menu'), icon: 'assist', onSelect: openShare },
    { label: t('mark.calc'), icon: 'grades', kbd: '=', onSelect: openCalc },
    { label: t('mark.solo_start'), sub: t('mark.solo_tip'), icon: 'user', kbd: 'I', onSelect: soloStart },
    { label: t('mark.hn_sw'), sub: t('mark.hn_sw_tip'), checked: anonOn(), onSelect: () => hideNames() },
    ...(w && w.batch.quiz && w.batch.quiz.made ? [{ label: t('mark.qr_menu'), icon: 'image', onSelect: () => quizScan() }] : []),
    // Transcripts for every recording (mark/transcripts.jsx, loaded through More for this paper's part), only when there are recordings
    ...(w && w.batch.students.some(st => st.files.some(f => f.kind === 'media' || f.kind === 'link')) ? [{ label: t('mark.tr_menu'), icon: 'text', onSelect: () => PARTS.pmore().then(P => P.transcripts()).then(T => setSetupDlg({ k: 'tr', T }), e => console.error(e)) }] : []),
    // Gradebook, the unit plan and class page links, Bring back (mark/topbar.jsx)
    ...(w && TB ? TB.items({ batch: w.batch, cls, share: openShare, dlg: D => setSetupDlg({ k: 'tb', D }) }) : [])];
  // The command bar while an assignment is open (src/shell.js findRows): its students, its tabs, the Setup menu and closing it
  const setupRef = useRef(setupItems); setupRef.current = setupItems;
  useEffect(() => { if (!w) return; const g = t('mark.cmd_students'), th = t('mark.cmd_this');
    const offs = w.batch.students.map((st, i) => addCommand({ id: 'st-' + i, label: shownName(st, i), group: g, icon: 'user', run: () => openOn(i) }));
    TABS.forEach(k => offs.push(addCommand({ id: 'tab-' + k, label: TAB_LINE[k], group: th, icon: 'grades', run: () => go('mark', id, k === 'mark' ? '' : k) })));
    setupItems.forEach((x, n) => offs.push(addCommand({ id: 'su-' + n, label: x.label, group: th, icon: x.icon, run: () => setupRef.current[n] && setupRef.current[n].onSelect() })));
    offs.push(addCommand({ id: 'asg-close', label: () => t('mark.cmd_close'), group: th, icon: 'x', run: close }));
    if (cls) offs.push(addCommand({ id: 'asg-book', label: () => t('mark.cmd_book'), group: th, icon: 'grades', run: () => go('class', cls.id, 'grades') }));
    if (TB) offs.push(...TB.commands({ group: th, share: openShare, view, late: bringMany }));
    return () => offs.forEach(f => f()); }, [w, id, ver, setupItems.length, !!TB]);
  // a quiz made here (mark/quizread.jsx): Quiz scan shows what the scan read; before the first reading, it reads the papers first
  const quizScan = async again => { const R = await PARTS.quizread(); if ((again || !state().batch.quiz.lastRead) && !await R.readAll(!!again)) return; setSetupDlg({ k: 'qr', R }); };
  const readOnce = useRef(null);
  useEffect(() => { if (!w || !FU || readOnce.current === w.batch.id) return; readOnce.current = w.batch.id; const Q = w.batch.quiz; if (Q && Q.made && !Q.lastRead && Q.qs.some(q => q.auto)) quizScan().catch(e => console.error(e)); }, [w, FU]);
  // Quick mark (mark/quick.jsx): the cards once the quiz has boxes, the boxes (mark/quickboxes.jsx) before that or when she asks
  const quick = boxes => (boxes || !quizOn() ? PARTS.quickboxes().then(B => setSetupDlg({ k: 'qb', B })) : PARTS.quick().then(Q => setSetupDlg({ k: 'qm', Q }))).catch(e => console.error(e));
  return <div class={'markscreen' + (solo ? ' solo' : '') + (noR ? ' nor' : '')} data-tab={tab}>
    {solo && w && w.batch.students[cur] && <SoloBar st={w.batch.students[cur]} name={shownName(w.batch.students[cur], cur)} asg={w.batch.name} onEnd={soloEnd} />}
    <header class="mk-top">
      {!solo && <IconButton icon="x" label={t('mark.close')} onClick={close} />}
      <h1 class="mk-title">{cls && <span class="dot" />}{cls && <b data-raw>{cls.name}</b>}<span data-raw class="asg">{w ? w.batch.name : ''}</span></h1>
      {!solo && <Tabs label={t('mark.tabs')} value={tab} onChange={v => go('mark', id, v === 'mark' ? '' : v)}
        tabs={TABS.filter(k => k !== 'examples' || exN || tab === k).map(k => ({ id: k, label: TAB_LINE[k](), count: k === 'examples' && exN ? exN : null }))} />}
      <span class="grow" />
      {w && <span class="mk-save mute" role="status" data-save={MK ? MK.M.saveLabel() : 'saved'}>{saveLine(MK ? MK.M.saveLabel() : 'saved')}</span>}
      {/* marked so far and the average (one button to Insights), Quick mark and Setup: one stop in the Tab order */}
      <Rove class="mk-acts" role="toolbar" aria-label={t('mark.cmd_this')}>
      {w && (TB ? <TB.Prog batch={w.batch} fm={fm} X={OE} onOpen={() => go('mark', id, 'insights')} /> : <span class="mk-prog mute">{t('mark.marked_of', { n: marked, of: n })}<Progress value={marked} max={Math.max(1, n)} label={t('mark.marked_of', { n: marked, of: n })} /></span>)}
      {w && MK && !solo && quizOn() && <Button size="sm" icon="check" onClick={() => quick()} data-quicktop>{t('mark.qm_open')}</Button>}
      {!solo && (w && MK ? <Menu label={t('mark.setup_tip')} trigger={b => <Button {...b} icon="settings" size="sm" title={t('mark.setup_tip')} data-setupopen>{t('mark.setup')}</Button>} items={setupItems} />
        : <Button icon="settings" size="sm" disabled data-setupopen>{t('mark.setup')}</Button>)}</Rove>
    </header>
    {su && <su.SetupDialog onClose={() => setSu(null)} />}
    {setupDlg && setupDlg.k === 'fof' && <setupDlg.B.FilesOrFolder kind="bring" onClose={() => setSetupDlg(null)} onPick={list => setupDlg.B.bringFiles(list, o => setSetupDlg({ k: 'bring', B: setupDlg.B, ...o }))} />}
    {setupDlg && setupDlg.k === 'bring' && <setupDlg.B.BringFiles rows={setupDlg.rows} dups={setupDlg.dups} onClose={() => setSetupDlg(null)} />}
    {setupDlg && setupDlg.k === 'tr' && <setupDlg.T.Transcripts onClose={() => setSetupDlg(null)} />}
    {setupDlg && setupDlg.k === 'pv' && <setupDlg.P.Partners onClose={() => setSetupDlg(null)} />}
    {setupDlg && setupDlg.k === 'sh' && <setupDlg.S.Share ctx={{ ...cvCtx, ai: assistant() }} kind={setupDlg.kind === 'back' ? null : setupDlg.kind} back={setupDlg.kind === 'back'} onClose={() => setSetupDlg(null)} />}
    {setupDlg && setupDlg.k === 'tb' && <setupDlg.D onClose={() => setSetupDlg(null)} />}
    {w && TB && <TB.Full fm={() => !!(MK && MK.M.fmNow())} />}
    {setupDlg && setupDlg.k === 'cl' && <setupDlg.Cl.ClipStage onClose={() => setSetupDlg(null)} />}
    {setupDlg && setupDlg.k === 'qm' && <setupDlg.Q.QuickMark onClose={() => setSetupDlg(null)} onBoxes={() => quick(true)} onOpen={pick} />}
    {setupDlg && setupDlg.k === 'qr' && <setupDlg.R.QuizLook onClose={() => setSetupDlg(null)} onAgain={() => quizScan(true)} />}
    {setupDlg && setupDlg.k === 'qb' && <setupDlg.B.QuickBoxes onClose={() => setSetupDlg(null)} onSaved={on => (on ? quick() : setSetupDlg(null))} />}
    {CV && cvDlg && cvDlg.k === 'check' && <CV.CheckCovers ctx={cvCtx} start={cvDlg.start} st={cvDlg.st} onDone={() => { setCvDlg(cvDlg.back ? { k: cvDlg.back } : null); cvCtx.reopen(); }} />}
    <RubricAsk ask={ask} />
    {FU && rescans && <FU.Rescans onClose={() => setRescans(false)} onGo={tab === 'mark' ? pick : openOn} />}
    {err ? <EmptyState icon="inbox" title={t(err.name === 'NotKept' ? 'mark.not_kept' : 'mark.page_bad')} text={err.name === 'NotKept' ? t('mark.not_kept_text') : ''} />
      : !w ? (dl ? <p class="mk-dl mute" role="status" data-mkdl>{t('mark.from_drive', { n: dl.n, of: dl.of })}</p> : <div class="loading" aria-busy="true" aria-label={t('mark.opening')} />)
      : tab === 'examples' && !solo ? (EX ? <div class="mk-outwrap"><EX.AsgExamples batch={w.batch} twins={twinsOf(state().lib, w.batch.assignment)} label={quizLabel} /></div> : <div class="loading" aria-busy="true" />)
      : tab !== 'mark' && !solo ? (out && MK ? <div class="mk-outwrap"><out.Out tab={tab} sub={route.params.sub} ai={assistant().name} E={out.E} cur={cur} onOpen={openOn} onShare={openShare} onSheet={() => go('mark', id, 'grades')} rescans={FU ? FU.rescanList() : []} onRescans={() => setRescans(true)} onCovers={checkCovers} view={askV} /></div> : <div class="loading" aria-busy="true" aria-label={t('mark.reading')} />)
      : <><div class="mk-body">
        {!solo && <StudentList batch={w.batch} cur={cur} onPick={pick} onReport={rep ? () => setRepList(true) : null} lf={lf} setLf={setLf} fold={fold} setFold={setFold} fm={fm} onHide={MK ? () => hideNames() : null} onShuffle={() => hideNames(true)} />}
        <div class="mk-mid">
          {MK && <MK.Tools />}
          <Paper batch={w.batch} cur={cur} zoom={zoom} ver={ver} FU={FU} ctl={spCtl} onSp={setSp} onZoom={zoomTo} onSetup={openSetup} />
          {FU && light && <FU.LightPanel onClose={() => setLight(false)} />}
          <Rove class="mk-zoom" role="toolbar" aria-label={t('mark.view_tools')}>{sp.n > 0 && <IconButton icon="slides" label={t('mark.sp_open')} kbd="B" aria-pressed={sp.shown ? 'true' : 'false'} onClick={() => spCtl.current && spCtl.current.toggle()} data-spbtn />}{noR && <IconButton icon="chl" label={t('mark.panel_show')} kbd="]" onClick={() => setPanel(false)} data-panelshow />}{FU && FU.rescanCount() > 0 && <IconButton icon="flag" label={t('mark.rs_title_n', { n: FU.rescanCount() })} title={t('mark.rs_title_n', { n: FU.rescanCount() })} onClick={() => setRescans(true)} data-rescans />}{FU && <IconButton icon="sun" label={t('mark.l_title')} aria-pressed={light ? 'true' : 'false'} onClick={() => setLight(v => !v)} data-light />}{TB && <TB.FullBtn />}<IconButton icon="minus" label={t('mark.zoom_out')} onClick={() => zoomTo(Math.round((zoom - 0.1) * 10) / 10)} />
            <button type="button" class="mk-z0" title={t('mark.zoom_reset', { key: pieces('mod+0').join(' ') })} onClick={() => zoomTo(1)} data-zoom0>{t('mark.zoom', { n: Math.round(zoom * 100) })}</button>
            <IconButton icon="plus" label={t('mark.zoom_in')} onClick={() => zoomTo(Math.round((zoom + 0.1) * 10) / 10)} /></Rove>
        </div>
        {!noR && <ScorePanel batch={w.batch} cur={cur} FU={FU} fm={fm} solo={!!solo} first={at <= 0} last={at < 0 || at >= order.length - 1} onCalc={openCalc} onSolo={soloStart} onSetup={openSetup} onNext={() => step(1)} onPrev={() => step(-1)} />}
      </div>
      {Calc && MK && <Calc M={MK.M} onClose={() => setCalc(null)} />}
      {CV && cvDlg && cvDlg.k === 'anon' && <CV.AnonDialog ctx={cvCtx} onClose={() => setCvDlg(null)} onCheck={i => setCvDlg({ k: 'check', start: i, back: 'anon' })} />}
      {rep && <rep.OpenedBar key={w.batch.id} onList={() => setRepList(true)} />}
      {FU && carried && <FU.CarryBox onClose={() => setCarried(false)} />}
      {rep && repList && <rep.OpenedList onClose={() => setRepList(false)} onGo={pick} />}</>}
  </div>;
}
