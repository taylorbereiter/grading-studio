// Quick mark (src/quiz.js openQuiz), loaded as a part of its own (router.js PARTS.quick): a paper quiz marked answer by answer. Each
// answer is cut from its page (engines/gquiz.js qzCrop) and shown as a card, by question (everyone's answer to one question) or by
// student (one paper, question by question). A click on an answer marks it wrong or right again, the buttons give its points, and
// the mark goes on the paper where it will be returned, with the total once every question is marked. Each mark is one undo step
// (mark/change.js quickDo); Give the rest is one step for all of them. A drag on an answer lines that paper's page up; a drag on
// the mark moves it on that paper only. Keys as the current app has them (qmKey). The boxes are set in Boxes (mark/quickboxes.jsx).
// Example on an answer (or E) keeps it as a strong example with the name covered, and takes it back (class/exsave.jsx keepAnswer).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Segmented, toast, useModal, Mic } from '../../ui/index.js';
import { putWords } from './dictate.js';
import { state, use, fmtNum, COLORS, NOTE_COLORS, PTS_AMBER, ptsColor, percentFor, setCheckInk, totalInk } from '../../engines/gcore.js';
import { shownName, lightForPage, lightCanvas } from '../../engines/gdraw.js';
import { copyPicture, canvasPng } from '../../engines/gsnip.js';
import * as Z from '../../engines/gquiz.js';
import { prefs } from '../../students/prefs.js';
import { exampleRecords } from '../../students/index.js';
import { onSaved } from '../../shared/saved.js';
import { assistant } from '../../services/assistant.js';
import { libs } from './paper.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import { PARTS } from '../router.js';
import './lines.js';
import './paper-lines.js';

// What she was looking at last, as the current app keeps it while the page is open (qzView, qzAt, qzStu, qzOnly).
const KEEP = { view: 'q', at: 0, stu: 0, only: false };
export const SIZES = ['S', 'M', 'L', 'F'];
const sizeNow = () => { const s = prefs.get('gs.qmSize', null); return SIZES.includes(s) ? s : window.innerWidth < 900 ? 'F' : 'L'; };
const ptsOf = q => +q.pts || 1;
const qOf = id => state().batch.quiz.qs.find(x => x.id === id);
// After a step is done or taken back: the open Quick mark draws again (nothing when it is closed).
let redraw = () => {};
const again = () => redraw();
const howSay = q => (Z.qzByPts(q) ? t('paper.qm_scale', { n: fmtNum(ptsOf(q)) }) : t(ptsOf(q) === 1 ? 'paper.qm_rw1' : 'paper.qm_rw', { n: fmtNum(ptsOf(q)) })) + ' · ' +
  ({ x: t('paper.qb_how_x'), cx: t('paper.qb_how_cx'), pts: t('paper.qb_how_pts') }[q.how] || t('paper.qb_how_cx'));
const keySay = () => { const a = Z.qzAnsMode(); return t('paper.qm_key') + ' ' + t(a === 'off' ? 'paper.qm_key_off' : a === 'all' ? 'paper.qm_key_all' : 'paper.qm_key_miss'); };
const total = (st, n) => (Z.ibQzOn() ? Z.ibQzSay(st) : fmtNum(Z.quizSum(st)) + ' / ' + fmtNum(Z.quizMax()) + (n === state().batch.quiz.qs.length && percentFor(Z.quizSum(st)) != null ? ' = ' + percentFor(Z.quizSum(st)) + '%' : ''));

/* a mark, as the current app gives it (qmMark, qmHalf, qmRest, qmSpotSet, the drag in qmBindDrag) */
async function mark(st, q, v) {
  const was = Z.quizMarks(st)[q.id];
  if (v != null) v = Math.round(Math.min(ptsOf(q), Math.max(0, v)) * 2) / 2;
  if (v === was || (v == null && was == null)) return false;
  await C.quickDo([st], () => Z.quizSet(st, q, v), again);
  return true;
}
function halfOf(st, q) {
  const v = Z.quizMarks(st)[q.id];
  let n = v == null ? 0.5 : v % 1 ? Math.floor(v) : v + 0.5;
  if (n > ptsOf(q)) n = ptsOf(q) - 0.5;
  return n;
}
const R4 = v => Math.round(v * 10000) / 10000, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// A mark moved on one paper only (or put back, with at null). at is the mark's middle, as shares of their page.
function spotSet(st, q, at) {
  return C.quickDo([st], async () => {
    const bq = state().batch.quiz, sp = ((bq.spot ||= {})[st.key] ||= {});
    if (at) { const [dx, dy] = Z.qzShift(st, q.n); sp[q.id] = [R4(clamp(at[0], 0, 1) - dx), R4(clamp(at[1], 0, 1) - dy)]; }
    else { delete sp[q.id]; if (!Object.keys(sp).length) delete bq.spot[st.key]; }
    const v = Z.quizMarks(st)[q.id];
    if (v != null) await Z.qzPaper(st, q, v);
  }, again);
}
// That paper's page lined up: every box on it moves by the same amount, and the marks already given with them.
function shiftBy(st, q, fx, fy) {
  return C.quickDo([st], async () => {
    const sh = ((state().batch.quiz.shift ||= {})[st.key] ||= {}), [ox, oy] = sh[q.n] || [0, 0];
    sh[q.n] = [R4(clamp(ox + fx, -0.3, 0.3)), R4(clamp(oy + fy, -0.3, 0.3))];
    await Z.qzRedoPaper(st);
  }, again);
}

/* one answer */
function MarkOver({ st, q, r }) {
  const v = Z.quizMarks(st)[q.id], look = Z.qzLook(q, v), s = Z.qzSpot(st, q), sz = Z.qzSz(st, q.n), W = sz.W * r.w;
  const kind = !look ? 'pin' : look.k === 'text' ? 'txt' : look.k === 'check' ? 'ok' : 'x', pt = kind === 'pin' ? 22 : kind === 'txt' ? 15 : 24;
  const style = { left: (s.x - r.x) / r.w * 100 + '%', top: (s.y - r.y) / r.h * 100 + '%', fontSize: 'max(13px, ' + (pt / W * 100).toFixed(2) + 'cqw)' };
  if (kind === 'pin') style.width = style.height = '1em';
  if (kind === 'txt') style.color = ptsColor(v, ptsOf(q));
  if (kind === 'txt' && s.margin) {   // in the margin, text sits beside the box, as on the paper
    const x = s.right ? s.x - 11 / sz.W : q.x + Z.qzShift(st, q.n)[0] - 6 / sz.W;
    Object.assign(style, { left: (x - r.x) / r.w * 100 + '%', transform: s.right ? 'translate(0,-50%)' : 'translate(-100%,-50%)' });
  }
  return <span class={'qmmk ' + kind} style={style} title={t(kind === 'pin' ? 'paper.qm_pin_tip' : 'paper.qm_mk_tip')} data-qmmk>{kind === 'txt' ? look.text : kind === 'ok' ? '✓' : kind === 'x' ? '✗' : ''}</span>;
}
function Card({ i, q, qi, view, ver, focus, onNote, noteOpen, onPeek, onCopy, kept, onStar }) {
  const st = state().batch.students[i], v = Z.quizMarks(st)[q.id], pts = ptsOf(q), scale = Z.qzByPts(q);
  const [crop, setCrop] = useState(undefined), img = useRef(), drag = useRef(null), el = useRef();
  const ck = Z.qzCropKey(st, q);
  useEffect(() => { let live = true; Z.qzCrop(st, q).then(c => { if (live) setCrop(c); }, e => { console.error(e); if (live) setCrop(null); }); return () => { live = false; }; }, [ck]);
  useEffect(() => { if (focus && el.current) el.current.focus({ preventScroll: false }); }, [focus]);
  const state_ = v == null ? '' : v >= pts ? ' right' : v <= 0 ? ' wrong' : ' some';
  const down = e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const mk = e.target.closest('[data-qmmk]'), b = mk && mk.getBoundingClientRect();
    drag.current = { mk, x0: e.clientX, y0: e.clientY, moved: false, mx0: b ? b.left + b.width / 2 : 0, my0: b ? b.top + b.height / 2 : 0 };
    el.current.focus({ preventScroll: true });
  };
  const move = e => {
    const d = drag.current; if (!d || !img.current) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    if (d.mk) d.mk.style.translate = dx + 'px ' + dy + 'px'; else img.current.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  };
  const up = async e => {
    const d = drag.current; drag.current = null; if (!d) return;
    if (!d.moved) {
      if (Z.qzHow(q) === 'pts' && scale) return;   // a points question is scored with its buttons or keys
      return mark(st, q, v != null && v <= 0 ? pts : 0);
    }
    const r = crop.r, shown = img.current.getBoundingClientRect();
    if (d.mk) { d.mk.style.translate = ''; return spotSet(st, q, [r.x + (d.mx0 + e.clientX - d.x0 - shown.left) / (shown.width || 1) * r.w, r.y + (d.my0 + e.clientY - d.y0 - shown.top) / (shown.height || 1) * r.h]); }
    img.current.style.transform = '';
    return shiftBy(st, q, -(e.clientX - d.x0) / (shown.width || 1) * r.w, -(e.clientY - d.y0) / (shown.height || 1) * r.h);
  };
  let btns;
  if (!scale) btns = <><button type="button" class="qmb no" aria-pressed={v === 0 ? 'true' : 'false'} title={t('paper.qm_wrong_tip')} onClick={() => mark(st, q, 0)} data-v="0">✗</button>
    <button type="button" class="qmb ok" aria-pressed={v === pts ? 'true' : 'false'} title={t('paper.qm_right_tip', { n: fmtNum(pts) })} onClick={() => mark(st, q, pts)} data-v={pts}>✓</button></>;
  else {
    const steps = Z.qzSteps(pts), words = Z.qzStepWords(pts), half = v != null && v % 1 !== 0 && !steps.includes(v);
    btns = <>{steps.map((s, k) => <button type="button" class={'qmb' + (s >= pts ? ' ok' : s <= 0 ? ' no' : '') + (words[k] ? ' w' : '')} aria-pressed={v != null && (v === s || (half && Math.floor(v) === s && s !== pts)) ? 'true' : 'false'}
      title={words[k] ? fmtNum(s) + ': ' + words[k] : undefined} onClick={() => mark(st, q, s)} data-v={s}>{fmtNum(s)}{words[k] && <small data-raw>{words[k]}</small>}</button>)}
      <button type="button" class="qmb half" aria-pressed={half ? 'true' : 'false'} title={t('paper.qm_half_tip')} onClick={() => mark(st, q, halfOf(st, q))} data-half>+½</button></>;
  }
  const note = Z.qzNoteOf(st, q), ans = Z.qzAnsOf(st, q);
  return <div ref={el} class={'qmc' + state_} tabIndex={0} data-st={i} data-q={q.id}>
    <div class="qmch">{view === 'q' ? <b data-raw>{shownName(st, i)}</b>
      : <><b data-raw>{Z.quizLabel(q, qi)}</b>{q.key && <span class="qmkey" title={keySay()} data-raw>{q.key}</span>}<span class="mute">{t(pts === 1 ? 'paper.qm_pt' : 'paper.qm_pts', { n: fmtNum(pts) })}</span></>}
      {v != null && scale && <span class="qmchip">{t('paper.qm_of', { n: fmtNum(v), of: fmtNum(pts) })}</span>}
      <span class="qmchr">{Z.qzOwn(st, q) && <button type="button" class="link" title={t('paper.qm_reset_tip')} onClick={() => spotSet(st, q, null)} data-reset>{t('paper.qm_reset')}</button>}
        <Button size="sm" title={t('paper.qm_copy_tip')} onClick={() => onCopy(st, q, qi)} data-qcopy>{t('paper.qm_copy')}</Button>
        <Button size="sm" title={t('paper.qm_peek_tip')} onClick={() => onPeek(st, q, qi)} data-peek>{t('paper.qm_peek')}</Button>
        <Button size="sm" icon="spark" variant={kept ? 'primary' : undefined} aria-pressed={kept ? 'true' : 'false'} title={t(kept ? 'paper.qm_ex_on' : 'paper.qm_ex_tip')} onClick={() => onStar(st, q, qi)} data-ex>{t('paper.qm_ex')}</Button></span></div>
    <div class={'qmimg' + (crop ? ' in' : '')} title={t(scale && Z.qzHow(q) === 'pts' ? 'paper.qm_img_pts' : 'paper.qm_img_tip')} onPointerDown={down} onPointerMove={move} onPointerUp={up} data-qmimg>
      {crop === undefined ? <span class="mute">…</span> : !crop ? <span class="mute">{t('paper.qm_no_page')}</span>
        : <><img ref={img} alt="" draggable={false} src={crop.url} /><MarkOver st={st} q={q} r={crop.r} key={ver} /></>}</div>
    <div class="qmbtns">{btns}<button type="button" class="qmb cm" title={t('paper.qm_cm_tip')} onClick={() => onNote(i, q)} data-qnote>{t('paper.qm_cm')}</button>
      {v != null && <button type="button" class="qmb clr" title={t('paper.qm_clear')} onClick={() => mark(st, q, null)} data-v="">{t('paper.qm_clear')}</button>}</div>
    {noteOpen ? <NoteEd st={st} q={q} onDone={() => { onNote(null); el.current && el.current.focus({ preventScroll: true }); }} />
      : note && <button type="button" class="qmnote" title={t('paper.qm_note_tip')} onClick={() => onNote(i, q)} data-qnoteline><span>{t(note.t === 'note' ? 'paper.qm_note_c' : 'paper.qm_note_t')}</span> <span data-raw>{note.text}</span></button>}
    {ans && <div class="qmans" title={t('paper.qm_ans_tip')}><span class="qzgold">{t('paper.qm_answer')}</span><span data-raw>{String(q.key).trim()}</span></div>}
  </div>;
}

/* her own words on the paper (qmNoteOpen, qmNoteDone, qzNoteSet): a comment in the margin with a line to the answer, or text under it */
function NoteEd({ st, q, onDone }) {
  const m = Z.qzNoteOf(st, q), ink = COLORS[state().inkColor] || COLORS.red;
  const [as, setAs] = useState(m ? (m.t === 'note' ? 'note' : 'text') : prefs.get('gs.qmNoteAs', 'note') === 'text' ? 'text' : 'note');
  const [col, setCol] = useState((m && m.color) || ink), ta = useRef();
  useEffect(() => { const x = ta.current; if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, []);
  const save = async () => {
    const text = ta.current.value.trim();
    if (text || m) { prefs.set('gs.qmNoteAs', as); await C.quickDo([st], () => Z.qzNoteSet(st, q, text, as, col), again); }
    onDone();
  };
  const keys = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(); }
    else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); e.stopPropagation(); save(); }
    else e.stopPropagation();
  };
  return <div class="qmned" data-qmned>
    <textarea ref={ta} rows={2} class="input" placeholder={t('paper.qm_note_ph')} aria-label={t('paper.qm_cm')} style={{ color: col }} defaultValue={m ? m.text : ''} onKeyDown={keys} data-raw />
    <div class="qmnedc"><Mic onText={w => { putWords(ta.current, w); ta.current.focus(); }} /><span class="mute">{t('paper.qm_color')}</span>{Object.entries(NOTE_COLORS).map(([k, v]) => <button type="button" class="sw" style={{ background: v }} aria-pressed={v === col || (k === 'yellow' && col === PTS_AMBER) ? 'true' : 'false'}
      aria-label={t('paper.qm_note_in', { c: k })} title={k} onClick={() => { setCol(v); ta.current.focus(); }} data-qnc={k} />)}</div>
    <div class="qmnedb"><Segmented size="sm" label={t('paper.qm_note_as')} value={as} onChange={v => { setAs(v); ta.current.focus(); }} options={[{ value: 'note', label: t('paper.qm_as_note') }, { value: 'text', label: t('paper.qm_as_text') }]} />
      <span class="mute">{t('paper.qm_note_keys')}</span><Button size="sm" variant="primary" onClick={save} data-nsave>{t('paper.qm_save')}</Button></div>
  </div>;
}

/* the whole page, with the box and the mark's spot (qmPeek), for an answer that runs outside its box */
function Peek({ st, q, qi, onClose }) {
  const box = useRef(), [none, setNone] = useState(false), [dims, setDims] = useState(null);
  useEffect(() => {
    let live = true, c = null;
    Z.qzPage(st, q.n, 1400).then(pg => {
      if (!live) { if (pg) pg.c.width = 0; return; }
      if (!pg) return setNone(true);
      const L = lightForPage(st, pg.f, pg.p); if (L) lightCanvas(pg.c.getContext('2d'), pg.c.width, pg.c.height, L);
      c = pg.c; c.className = 'qmpkimg'; box.current.querySelector('.qbcv').replaceChildren(c); setDims({ W: pg.W, H: pg.H });
    }, e => { console.error(e); if (live) setNone(true); });
    return () => { live = false; if (c) { c.width = 0; c.remove(); } };
  }, []);
  const [dx, dy] = Z.qzShift(st, q.n), s = dims ? Z.qzSpot(st, q, dims) : null;
  useEffect(() => { const b = box.current && box.current.querySelector('.qmpkbox'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'center' }); }, [dims]);
  return <div class="qmpeek" role="dialog" aria-label={t('paper.qm_peek')} data-qmpeek onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="qmpkbar"><b data-raw>{shownName(st, state().batch.students.indexOf(st))}</b><span class="mute">{t('paper.qm_peek_at', { q: Z.quizLabel(q, qi), n: q.n + 1 })}</span><span class="grow" />
      <Button size="sm" onClick={onClose} data-peekx>{t('paper.qm_peek_back')}</Button></div>
    <div class="qmpkpg">{none ? <span class="mute">{t('paper.qm_no_page')}</span> : <div class="qmpkwrap" ref={box}><div class="qbcv" />{!dims && <span class="mute">{t('paper.qm_drawing')}</span>}
      {dims && <><div class="qmpkbox" style={{ left: (q.x + dx) * 100 + '%', top: (q.y + dy) * 100 + '%', width: q.w * 100 + '%', height: q.h * 100 + '%' }} /><div class="qmpkspot" style={{ left: s.x * 100 + '%', top: s.y * 100 + '%' }} /></>}</div>}</div>
  </div>;
}

/* Colors (qmInkSay, inkRows, qmInkSet): one for ✗ (her pen's), one for ✓, and one for points: the ✗ color, one of her own, or by credit */
function inkAll() {
  const s = state();
  for (const st of s.batch.students) for (const f of st.files || []) for (const list of Object.values(f.marks || {})) for (const m of list) {
    if (!m.qz && !m.qzn) continue;
    m.color = m.t === 'check' ? s.CHECK_INK : m.qz === 'total' ? totalInk() : m.t === 'text' && m.qz ? Z.qzMarkInk(m.qz, st) : COLORS[s.inkColor] || COLORS.red;
  }
}
function Colors() {
  const s = state();
  const set = fn => C.quickDo(s.batch.students, () => { fn(); inkAll(); }, again);
  const sw = (k, v, on, say, fn) => <button type="button" class="sw" style={{ background: v }} aria-pressed={on ? 'true' : 'false'} aria-label={say + ' ' + k} title={k} onClick={() => set(fn)} />;
  const row = (on, say, fn, attr) => <div class="qmirow" data-qmink={attr}><span>{say}</span>{Object.entries(COLORS).map(([k, v]) => sw(k, v, k === on, say, () => fn(k)))}</div>;
  const x = COLORS[s.inkColor] || COLORS.red;
  return <div class="qminkpop" data-qminkpop>
    {row(s.inkColor, t('paper.qm_ink_x'), k => { use({ inkColor: k }); prefs.set('gs.ink', k); }, 'x')}
    {row(s.checkInk, t('paper.qm_ink_ok'), k => { setCheckInk(k); prefs.set('gs.checkInk', k); }, 'ok')}
    <div class="qmirow" data-qmink="pts"><span>{t('paper.qm_ink_pts')}</span><button type="button" class="chip" aria-pressed={s.ptsInk === '' ? 'true' : 'false'} title={t('paper.qm_ink_same_tip')} onClick={() => set(() => { use({ ptsInk: '' }); prefs.set('gs.ptsInk', ''); })} data-qpts="">{t('paper.qm_ink_same')}</button>
      {Object.entries(COLORS).map(([k, v]) => sw(k, v, k === s.ptsInk, t('paper.qm_ink_pts'), () => { use({ ptsInk: k }); prefs.set('gs.ptsInk', k); }))}</div>
    <div class="qmirow"><span /><button type="button" class="chip" aria-pressed={s.ptsInk === 'credit' ? 'true' : 'false'} title={t('paper.qm_ink_credit_tip')} onClick={() => set(() => { use({ ptsInk: 'credit' }); prefs.set('gs.ptsInk', 'credit'); })} data-qpts="credit">
      {t('paper.qm_ink_credit')} <i class="qmcr" style={{ background: s.CHECK_INK }} /><i class="qmcr" style={{ background: PTS_AMBER }} /><i class="qmcr" style={{ background: x }} /></button></div>
    {s.ptsInk === 'credit' && <p class="mute">{t('paper.qm_ink_credit_say')}</p>}
    <p class="mute">{t('paper.qm_ink_note')}</p>
  </div>;
}

export function QuickMark({ onClose, onBoxes, onOpen }) {
  const bb = state().batch, qs = bb.quiz.qs, who = Z.quizWho();
  const [ver, setVer] = useState(0), [ready, setReady] = useState(false);
  const [view, setView] = useState(KEEP.view), [at, setAt] = useState(Math.min(KEEP.at, qs.length - 1)), [stu, setStu] = useState(who.includes(KEEP.stu) ? KEEP.stu : who[0]);
  const [only, setOnly] = useState(KEEP.only), [size, setSize] = useState(sizeNow()), [ink, setInk] = useState(false), [note, setNote] = useState(null), [peek, setPeek] = useState(null);
  // the answers kept as strong examples from this download (exAnswerOf), read again when one is kept or taken back anywhere
  const [kept, setKept] = useState(() => new Set());
  useEffect(() => { let live = true; const id = state().batch.id, read = () => exampleRecords().then(l => live && setKept(new Set(l.filter(r => !r.gone && !r.watch && r.kind === 'answer' && r.work === id && r.q && r.from).map(r => r.from.key + '|' + r.q.id))), () => {});
    read(); const off = onSaved(e => { if (e.kind === 'example') read(); }); return () => { live = false; off(); }; }, []);
  const star = (s, x, qi) => PARTS.exsave().then(m => m.keepAnswer(s, x, qi, () => close()));
  const [focusAt, setFocusAt] = useState(null), [seen, setSeen] = useState(!!prefs.get('gs.qmCopySeen', 0)), [copyNote, setCopyNote] = useState(false);
  const body = useRef(), p = useModal(true, () => close());
  Object.assign(KEEP, { view, at, stu, only });
  useEffect(() => { let live = true; libs().then(() => { if (live) setReady(true); }); redraw = () => { setVer(v => v + 1); }; return () => { live = false; redraw = () => {}; }; }, []);
  const close = () => { Z.qzLetGo(); onClose(); C.reopen(); };   // the open paper shows the new marks
  const q = qs[at], st = state().batch.students[stu];
  let cards = view === 'q' ? who.map(i => [i, q, at]) : qs.map((x, qi) => [stu, x, qi]);
  if (only) cards = cards.filter(([i, x]) => Z.quizMarks(state().batch.students[i])[x.id] == null);
  const done = view === 'q' ? who.filter(i => Z.quizMarks(state().batch.students[i])[q.id] != null).length : Z.quizCount(st);
  const all = view === 'q' ? who.length : qs.length;
  const go = d => { if (view === 'q') setAt(a => clamp(a + d, 0, qs.length - 1)); else { const k = who.indexOf(stu); setStu(who[clamp(k + d, 0, who.length - 1)]); } setFocusAt('first'); };
  const rest = () => {
    const list = cards.map(([i, x]) => [state().batch.students[i], x]).filter(([s, x]) => Z.quizMarks(s)[x.id] == null);
    if (!list.length) return;
    return C.quickDo([...new Set(list.map(x => x[0]))], async () => { for (const [s, x] of list) await Z.quizSet(s, x, ptsOf(x)); }, again);
  };
  const copy = async (s, x, qi) => {
    const blobP = Z.qzAnswerPic(s, x, qi).then(c => { if (!c) throw new Error('no page'); return canvasPng(c); });
    const say = t('paper.qm_question', { q: Z.quizLabel(x, qi) });
    const how = await copyPicture(blobP, say + '.png');
    if (how === 'none') return toast(t('paper.qm_no_page'));
    toast(how === 'copied' ? t('paper.qm_copied', { q: say, ai: assistant().name || t('paper.qm_ai_any') }) : t('paper.qm_saved_pic', { q: say }), { ms: 4000 });
    if (!seen) setCopyNote(true);
  };
  const cardEl = () => document.activeElement && document.activeElement.closest && document.activeElement.closest('.qmc');
  const keys = e => {
    p.onKeyDown(e);
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (peek) { if (e.key === 'Escape' || e.key === ' ') { stop(); setPeek(null); } return; }
    if (e.target.closest('select,input,textarea')) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey) { stop(); C.undo(); return; }
      const d = e.key === '=' || e.key === '+' ? 1 : e.key === '-' || e.key === '_' ? -1 : 0;
      if (d) { stop(); const z = SIZES[clamp(SIZES.indexOf(size) + d, 0, SIZES.length - 1)]; prefs.set('gs.qmSize', z); setSize(z); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { stop(); return close(); }
    if (e.key === '[' || e.key === ']') { stop(); return go(e.key === ']' ? 1 : -1); }
    const el = cardEl();
    if (!el) { if (/^Arrow/.test(e.key)) { const f = body.current && body.current.querySelector('.qmc'); if (f) { stop(); f.focus(); } } return; }
    const list = [...body.current.querySelectorAll('.qmc')], k = list.indexOf(el);
    const cols = view === 'q' ? Math.max(1, Math.round(body.current.clientWidth / el.offsetWidth)) : 1;
    const to = d => { const x = list[clamp(k + d, 0, list.length - 1)]; if (x) { x.focus(); x.scrollIntoView && x.scrollIntoView({ block: 'nearest' }); } };
    const s = state().batch.students[+el.dataset.st], x = qOf(el.dataset.q), qi = qs.indexOf(x), scale = !x || Z.qzByPts(x);
    const next = () => { const n = list[k + 1]; if (n) n.focus(); };
    if (e.key === 'ArrowRight') { stop(); return to(1); }
    if (e.key === 'ArrowLeft') { stop(); return to(-1); }
    if (e.key === 'ArrowDown') { stop(); return to(cols); }
    if (e.key === 'ArrowUp') { stop(); return to(-cols); }
    if (e.key === ' ') { stop(); return setPeek({ st: s, q: x, qi }); }
    if ((e.key === 'h' || e.key === 'H' || e.key === '½') && scale) { stop(); return mark(s, x, halfOf(s, x)); }
    if (/^[0-9]$/.test(e.key) && scale) { stop(); return mark(s, x, +e.key).then(next); }
    if ((e.key === '1' || e.key === '0') && !scale) { stop(); return mark(s, x, e.key === '1' ? ptsOf(x) : 0).then(next); }   // right is all its points
    if (e.key === 'x' || e.key === 'X') { stop(); return mark(s, x, 0).then(next); }
    if (e.key === 'c' || e.key === 'C') { stop(); return setNote(+el.dataset.st + '|' + x.id); }
    if (e.key === 'p' || e.key === 'P') { stop(); return copy(s, x, qi); }
    if (e.key === 'e' || e.key === 'E') { stop(); return star(s, x, qi); }   // keep as a strong example, or take it back
    if (e.key === 'Backspace' || e.key === 'Delete') { stop(); return mark(s, x, null); }
  };
  const nav = view === 'q'
    ? <><IconButton icon="chl" label={t('paper.qm_q_prev')} disabled={!at} onClick={() => go(-1)} data-qgo="-1" />
      <select class="input sm" aria-label={t('paper.qm_q_pick')} value={at} onChange={e => { setAt(+e.currentTarget.value); }} data-qmpick>{qs.map((x, i) => <option value={i}>{t('paper.qm_question', { q: Z.quizLabel(x, i) })}</option>)}</select>
      <IconButton icon="chr" label={t('paper.qm_q_next')} disabled={at >= qs.length - 1} onClick={() => go(1)} data-qgo="1" />
      {q.key && <span class="qmkey big" title={keySay()} data-raw>{q.key}</span>}<span class="mute">{howSay(q)}</span></>
    : <><IconButton icon="chl" label={t('paper.qm_s_prev')} disabled={who.indexOf(stu) <= 0} onClick={() => go(-1)} data-qgo="-1" />
      <select class="input sm" aria-label={t('paper.qm_s_pick')} value={stu} onChange={e => setStu(+e.currentTarget.value)} data-qmpick data-raw>{who.map(i => <option value={i}>{shownName(state().batch.students[i], i)}</option>)}</select>
      <IconButton icon="chr" label={t('paper.qm_s_next')} disabled={who.indexOf(stu) >= who.length - 1} onClick={() => go(1)} data-qgo="1" />
      <span class="qmtot" data-qmtot>{total(st, done)}</span></>;
  const s = state(), inkVars = { '--qm-x': COLORS[s.inkColor] || COLORS.red, '--qm-ok': s.CHECK_INK, '--qm-pts': s.ptsInk === 'credit' ? 'conic-gradient(' + s.CHECK_INK + ' 0 33%, ' + PTS_AMBER + ' 0 66%, ' + (COLORS[s.inkColor] || COLORS.red) + ' 0)' : ptsColor() };
  return <dialog class="dlg mk-qm" aria-labelledby="qmT" {...p} onKeyDown={keys} style={inkVars} data-qm>
    <header class="qmhd"><h2 id="qmT">{t('paper.qm_title')}</h2>
      <Segmented size="sm" label={t('paper.qm_view')} value={view} onChange={v => { setView(v); setFocusAt('first'); }} options={[{ value: 'q', label: t('paper.qm_by_q') }, { value: 's', label: t('paper.qm_by_s') }]} />
      <span class="qmnav">{nav}</span><span class="mute" role="status" data-qmprog>{t('paper.qm_done', { n: done, of: all })}</span>
      <span class="grow" />
      <span class="qmopts"><span class="mute">{t('paper.qm_size')}</span><Segmented size="sm" label={t('paper.qm_size')} value={size} onChange={z => { prefs.set('gs.qmSize', z); setSize(z); }} options={SIZES.map(z => ({ value: z, label: z === 'F' ? t('paper.qm_full') : z }))} />
        <Segmented size="sm" label={t('paper.qm_show')} value={only ? '1' : '0'} onChange={v => setOnly(v === '1')} options={[{ value: '0', label: t('paper.qm_all') }, { value: '1', label: t('paper.qm_not') }]} />
        <Button size="sm" aria-expanded={ink ? 'true' : 'false'} title={t('paper.qm_ink_tip')} onClick={() => setInk(v => !v)} data-qminkbtn>{t('paper.qm_ink')} <i class="qmdot x" /><i class="qmdot ok" /><i class="qmdot pts" /></Button>
        <Button size="sm" onClick={onBoxes} data-boxes>{t('paper.qm_boxes')}</Button></span>
      <IconButton icon="x" label={t('paper.qm_close')} onClick={close} data-qmclose /></header>
    {ink && <Colors />}
    {copyNote && <div class="qmcopynote" role="status" data-qmcopynote><p><b>{t('paper.qm_cn_h')}</b> {t('paper.qm_cn_1')}</p><p>{t('paper.qm_cn_2')}</p>
      <Button size="sm" onClick={() => { prefs.set('gs.qmCopySeen', 1); setSeen(true); setCopyNote(false); }} data-copyok>{t('paper.qm_cn_ok')}</Button></div>}
    <div ref={body} class={'body qmbody qmz-' + size + (view === 'q' ? ' qmgrid' : ' qmcol')} data-qmbody>
      {!ready ? <div class="loading" aria-busy="true" /> : !who.length ? <p class="mute">{t('paper.qm_none_papers')}</p>
        : cards.length ? cards.map(([i, x, qi], k) => <Card key={i + '|' + x.id} i={i} q={x} qi={qi} view={view} ver={ver} focus={focusAt === 'first' && k === 0 ? at + '|' + stu + '|' + view : false}
          noteOpen={note === i + '|' + x.id} onNote={(ii, qq) => setNote(ii == null ? null : ii + '|' + qq.id)} onPeek={(a, b2, c) => setPeek({ st: a, q: b2, qi: c })} onCopy={copy}
          kept={kept.has(state().batch.students[i].key + '|' + x.id)} onStar={star} />)
        : <p class="mute qmnone">{t('paper.qm_all_done')}</p>}
    </div>
    <footer class="qmfoot"><span class="mute qmhint">{view === 'q' ? (Z.qzByPts(q) ? t('paper.qm_hint_pts') : t('paper.qm_hint_rw')) + ' ' + t('paper.qm_hint_q') : t('paper.qm_hint_s')}</span>
      {view === 's' && <Button onClick={() => { close(); onOpen(stu); }} data-open>{t('paper.qm_open')}</Button>}
      <Button variant="primary" disabled={done === all} onClick={rest} data-rest>{view === 'q' && Z.qzByPts(q) ? t('paper.qm_rest_n', { n: fmtNum(ptsOf(q)) }) : t('paper.qm_rest')}</Button></footer>
    {peek && <Peek st={peek.st} q={peek.q} qi={peek.qi} onClose={() => setPeek(null)} />}
  </dialog>;
}
