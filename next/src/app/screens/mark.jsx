// Marking (design screenshot 6): one assignment, full window. Mark / Grades / Insights / Return across the top with Setup beside
// them; the student list on the left, the student's paper large in the middle, their score on the right, Next student at the foot.
// The papers open the way the current app reopens a download kept in this browser (mark/open.js), and every page is drawn by the
// current app's own drawing code (engines/gdraw.js), so what she sees is what she marked there, mark for mark.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useMemo, useCallback } from 'preact/hooks';
import { Tabs, Button, IconButton, Icon, EmptyState, Dialog, Progress, Avatar, TextInput } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go, href, PARTS } from '../router.js';
import { register } from '../../services/shortcuts.js';
import { openKept, NotKept } from '../mark/open.js';
import { openPages, renderPage, fitScale } from '../mark/paper.js';
import { use, gradeOf, maxPoints, fmtNum, state } from '../../engines/gcore.js';
import { shownName } from '../../engines/gdraw.js';
import { toast } from '../../ui/index.js';
import '../mark/lines.js';

// The checks' way in (next/test/browser/mark.test.js): the open work, drawing one page at a given scale, and waiting for a save.
const seam = { state, gradeOf, renderPage, ready: false, saved: () => (MK ? MK.M.saveNowDone() : Promise.resolve()) };
if (typeof window !== 'undefined') window.__mark = seam;

const TABS = ['mark', 'grades', 'insights', 'return'];
const TAB_LINE = { mark: () => t('mark.mark'), grades: () => t('mark.grades'), insights: () => t('mark.insights'), return: () => t('mark.return') };
const keep = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem('gsn.mark.' + k)); sessionStorage.setItem('gsn.mark.' + k, JSON.stringify(v)); } catch {} return null; };

// What a student's row says: their score as a percent, or missing / excused / late.
function rowScore(st) {
  const g = gradeOf(st), s = st.grade.status;
  if (s === 'missing') return { text: t('mark.missing'), tone: 'warn' };
  if (s === 'excused') return { text: t('mark.excused'), tone: 'mute' };
  if (g.total == null) return null;
  return { text: g.pct != null ? fmtNum(g.pct) + '%' : fmtNum(g.total), done: !!g.done };
}
const isMarked = st => { const g = gradeOf(st); return !!g.done && !st.gap; };

function StudentList({ batch, cur, onPick }) {
  const [q, setQ] = useState(''), box = useRef(null);
  useEffect(() => register({ id: 'mark-find', keys: '/', label: 'mark.find', run: () => { const i = box.current && box.current.querySelector('input'); if (i) i.focus(); } }), []);
  const missing = batch.students.filter(st => st.grade.status === 'missing' || !st.files.length).length;
  const rows = batch.students.map((st, i) => ({ st, i, name: shownName(st, i) })).filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  return <aside class="mk-list" aria-label={t('mark.students')}>
    <div class="mk-lhead mute"><span>{t('mark.papers', { n: batch.students.filter(st => st.files.length).length })}</span>{missing > 0 && <span>{t('mark.missing_n', { n: missing })}</span>}</div>
    <div ref={box} class="mk-find"><TextInput icon="search" label={t('mark.find')} value={q} onInput={e => setQ(e.target.value)} /></div>
    <ol class="mk-rows">{rows.map(({ st, i, name }) => { const sc = rowScore(st);
      return <li><button type="button" class={'mk-row' + (i === cur ? ' on' : '')} aria-current={i === cur ? 'true' : undefined} onClick={() => onPick(i)} data-st={i}>
        <Avatar name={name} size="sm" /><span class="nm" data-raw>{name}</span>
        {sc && <span class={'sc ' + (sc.tone || '')}>{sc.done && <Icon name="check" size="xs" />}{sc.text}</span>}
      </button></li>; })}</ol>
  </aside>;
}

// One page: a canvas drawn by the current app's code at the scale the paper area allows.
function Page({ pg, room, tall, zoom }) {
  const ref = useRef(null), wrap = useRef(null);
  useEffect(() => {
    if (!ref.current || !room) return;
    pg.canvas = ref.current;
    pg.wrapEl = wrap.current; if (MK) MK.M.bind(pg, wrap.current);
    renderPage(pg, fitScale(pg, room, tall, (state().disp || {}).fit, zoom));
  }, [pg, room, zoom]);
  return <div ref={wrap} class={'pg' + (pg.out ? ' out' : '')} data-tool={state().tool}><canvas ref={ref} data-page={pg.file.path + '|' + pg.idx} /></div>;
}

// The marking tools load as a part of their own (router.js PARTS.marking, screens/mark-tools.jsx) once the paper is open, so
// the read-only paper shows as soon as it can. Until they are there, the paper is drawn and nothing on it can be changed.
let MK = null;
const SAVE_LINE = { saving: () => t('mark.saving'), saved: () => t('mark.saved'), partly: () => t('mark.partly'), not: () => t('mark.not_saved') };
const saveLine = k => (SAVE_LINE[k] ? SAVE_LINE[k]() : t('mark.cannot'));

function Paper({ batch, cur, zoom }) {
  const st = batch.students[cur], [got, setGot] = useState(null), area = useRef(null), [size, setSize] = useState([0, 0]);
  useEffect(() => {
    let live = true; setGot(null);
    use({ cur });
    seam.ready = false;
    if (st) openPages(st, () => live).then(r => { if (live) { setGot(r); seam.ready = true; } });
    return () => { live = false; };
  }, [batch, cur]);
  useEffect(() => {
    const el = area.current; if (!el) return;
    const measure = () => { const cs = getComputedStyle(el); setSize([el.clientWidth - (parseFloat(cs.paddingLeft) || 18) - (parseFloat(cs.paddingRight) || 18), el.clientHeight]); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, []);
  return <div class="mk-paper" ref={area} tabindex="-1">
    {!st ? null : !st.files.length ? <EmptyState icon="inbox" title={t('mark.nothing_in')} />
      : !got ? <div class="loading" aria-busy="true" />
      : got.cards.map(c => c.kind === 'file' ? <div class="fcard"><Icon name="file" /><span data-raw>{c.f.name}</span></div>
        : <section class="doc">
          <header class="fhead"><span data-raw>{c.d.name}</span>{!c.on && <span class="pill">{t(c.auto ? 'mark.left_out_auto' : 'mark.left_out')}</span>}</header>
          {c.pages.map(pg => <Page key={pg.file.path + '|' + pg.idx} pg={pg} room={size[0]} tall={size[1]} zoom={zoom} />)}
        </section>)}
  </div>;
}

function ScorePanel({ batch, cur, onNext, onPrev }) {
  const st = batch.students[cur]; if (!st) return null;
  const g = gradeOf(st), max = maxPoints(), name = shownName(st, cur);
  const file = st.files[0];
  return <aside class="mk-side" aria-label={t('mark.score')}>
    <div class="who"><Avatar name={name} /><div><h2 class="t4" data-raw>{name}</h2>
      <p class="mute">{t('mark.n_of', { n: cur + 1, of: batch.students.length })}{file ? <>, <span data-raw>{file.name}</span></> : ''}</p></div></div>
    <div class="total"><b>{g.total != null ? fmtNum(g.total) : '–'}</b><span class="mute">{max ? t('mark.out_of', { n: fmtNum(max) }) : ''}</span>
      <span class="grow" /><span class="pct">{g.pct != null ? fmtNum(g.pct) + '%' : ''}</span></div>
    {g.total == null && <p class="mute">{t('mark.no_score')}</p>}
    {st.grade.comment && <p class="comment" data-raw>{st.grade.comment}</p>}
    <div class="foot"><IconButton icon="chl" label={t('mark.prev')} onClick={onPrev} disabled={cur === 0} />
      <Button variant="primary" kbd="Enter" onClick={onNext} disabled={cur >= batch.students.length - 1} data-next>{t('mark.next')}</Button></div>
  </aside>;
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
  const [zoom, setZoom] = useState(() => keep('zoom') || 1), [, tick] = useState(0);
  useEffect(() => { if (!w) return; let off = null, live = true;
    PARTS.marking().then(m => { if (!live) return; MK = m; off = m.start({ toast: text => toast(text), openStudent: i => pickRef.current(i), changed: () => tick(n => n + 1) }); tick(n => n + 1); });
    return () => { live = false; if (off) off(); }; }, [w]);
  useEffect(() => {
    let live = true; setW(null); setErr(null);
    openKept(id, { question: q => new Promise(done => setAsk({ q, done: v => { setAsk(null); done(v); } })) })
      .then(r => { if (!live) return; if (!r) return history.back(); setW(r); setCur(Math.min(r.cur || 0, r.batch.students.length - 1)); }, e => { console.error(e); if (live) setErr(e); });
    return () => { live = false; if (MK) MK.M.saveNowDone(); };
  }, [id]);
  const pick = useCallback(i => { if (!w) return; const n = Math.max(0, Math.min(w.batch.students.length - 1, i)); if (MK) MK.M.commit(); if (n !== state().cur) seam.ready = false; setCur(n); use({ cur: n }); }, [w]);
  const pickRef = useRef(pick); pickRef.current = pick;
  useEffect(() => {
    if (!w) return;
    const offs = [
      register({ id: 'mark-next', keys: ['arrowdown', 'arrowright'], label: 'mark.next', run: () => pick(cur + 1) }),
      register({ id: 'mark-prev', keys: ['arrowup', 'arrowleft'], label: 'mark.prev', run: () => pick(cur - 1) }),
    ];
    return () => offs.forEach(f => f());
  }, [w, cur]);
  const cls = w && w.batch.classId != null ? (w.lib.classes || []).find(c => c.id === w.batch.classId) : null;
  const marked = w ? w.batch.students.filter(isMarked).length : 0, n = w ? w.batch.students.filter(st => !st.gap || st.files.length).length : 0;
  const close = () => (cls ? go('class', cls.id) : go('home'));
  return <div class="markscreen" data-tab={tab}>
    <header class="mk-top">
      <IconButton icon="x" label={t('mark.close')} onClick={close} />
      <h1 class="mk-title">{cls && <span class="dot" />}{cls && <b data-raw>{cls.name}</b>}<span data-raw class="asg">{w ? w.batch.name : ''}</span></h1>
      <Tabs label={t('mark.tabs')} value={tab} onChange={v => go('mark', id, v === 'mark' ? '' : v)}
        tabs={TABS.map(k => ({ id: k, label: TAB_LINE[k]() }))} />
      <span class="grow" />
      {w && <span class="mk-save mute" role="status" data-save={MK ? MK.M.saveLabel() : 'saved'}>{saveLine(MK ? MK.M.saveLabel() : 'saved')}</span>}
      {w && <span class="mk-prog mute">{t('mark.marked_of', { n: marked, of: n })}<Progress value={marked} max={Math.max(1, n)} label={t('mark.marked_of', { n: marked, of: n })} /></span>}
      <Button icon="settings" size="sm" disabled title={t('mark.later')}>{t('mark.setup')}</Button>
    </header>
    <RubricAsk ask={ask} />
    {err ? <EmptyState icon="inbox" title={t(err instanceof NotKept ? 'mark.not_kept' : 'mark.page_bad')} text={err instanceof NotKept ? t('mark.not_kept_text') : ''} />
      : !w ? <div class="loading" aria-busy="true" aria-label={t('mark.opening')} />
      : tab !== 'mark' ? <EmptyState icon="grades" title={TAB_LINE[tab]()} text={t('mark.later')} />
      : <div class="mk-body">
        <StudentList batch={w.batch} cur={cur} onPick={pick} />
        <div class="mk-mid">
          {MK && <MK.Tools />}
          <Paper batch={w.batch} cur={cur} zoom={zoom} />
          <div class="mk-zoom"><IconButton icon="minus" label={t('mark.zoom_out')} onClick={() => { const z = Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10); setZoom(z); keep('zoom', z); }} />
            <span>{t('mark.zoom', { n: Math.round(zoom * 100) })}</span>
            <IconButton icon="plus" label={t('mark.zoom_in')} onClick={() => { const z = Math.min(3, Math.round((zoom + 0.1) * 10) / 10); setZoom(z); keep('zoom', z); }} /></div>
        </div>
        <ScorePanel batch={w.batch} cur={cur} onNext={() => pick(cur + 1)} onPrev={() => pick(cur - 1)} />
      </div>}
  </div>;
}
