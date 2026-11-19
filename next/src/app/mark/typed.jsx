// Typed notes and the Timer, under the comment on the marking screen (src/typednotes.js, src/sidepane.js spTimerDraw). The page she
// types on, its bar, the margin's times and marks, and every change are the lifted engine's (engines/gnotes.js), drawn into the box
// here; the listeners src/typednotes.js puts on the grading page are ported below, on this box only. Clear this student's notes has
// no confirm: it goes at once, with Undo. The Timer is a stopwatch for a talk given live, with the length the assignment asks for.
import { h, Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Menu, toast, copyButton, Mic } from '../../ui/index.js';
import { copyText } from '../../services/clipboard.js';
import { state, use } from '../../engines/gcore.js';
import * as N from '../../engines/gnotes.js';
import { tnHas } from '../../engines/gdraw.js';
import { fmtTime } from '../../engines/gmedia.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './setup-lines.js';
import './paper-lines.js';
import { PARTS } from '../router.js';

const b = () => state().batch;
const st0 = () => { const s = state(); return s.batch ? s.batch.students[s.cur] : null; };
// the video or recording playing above the paper, if there is one (src/video.js vidClock, vidSeek)
const player = () => document.querySelector('.media video, .media audio');
const nowOf = st => { const m = player(); if (m && !m.paused) return m.currentTime; const c = N.spClockOf(st); return c.at ? N.spClockMs(c) / 1000 : null; };
let keep = null;   // the screen's save for the assignment's setup (marking.js keepSetup)
export const useKeep = f => { keep = f; };
const setupKept = () => (keep ? keep() : Promise.resolve());

// the menus on the notes' bar (src/markscreen.js kmOpen, kmClose): one open at a time, Esc and a click elsewhere close it
let kmOn = null;
const SIZES = { s: 'setup.tn_size_s', '': 'setup.tn_size_m', l: 'setup.tn_size_l' }, HOW = { under: 'setup.tm_under', in: 'setup.tm_in', over: 'setup.tm_over' };
function kmClose(focus) { const x = kmOn; if (!x) return; kmOn = null; if (!x.isConnected) return; x.setAttribute('aria-expanded', 'false'); const m = x.nextElementSibling; if (m) m.hidden = true; if (focus) x.focus({ preventScroll: true }); }
function kmOpen(x) {
  kmClose(); const m = x.nextElementSibling; if (!m || !m.classList.contains('km')) return;
  m.hidden = false; x.setAttribute('aria-expanded', 'true'); kmOn = x;
  const first = [...m.querySelectorAll('button')].find(y => !y.disabled && y.checkVisibility()); if (first) first.focus({ preventScroll: true });
}

function wire(box) {
  const tnIn = e => { const ed = e.target.closest && e.target.closest('.tned'); return ed && box.contains(ed) && N.tnGetSt() === st0() ? ed : null; };
  const on = (k, f, o) => { box.addEventListener(k, f, o); return () => box.removeEventListener(k, f, o); };
  const offs = [
    on('input', e => { if (tnIn(e) && !N.tnIsQuiet()) N.tnSync(e.inputType || ''); }),
    on('beforeinput', e => {
      if (!tnIn(e)) return;
      const ty = e.inputType;
      if (ty === 'insertParagraph' || ty === 'insertLineBreak') { e.preventDefault(); return N.tnEnter(); }
      if (ty === 'historyUndo' || ty === 'historyRedo') { e.preventDefault(); return ty === 'historyUndo' ? C.undo() : C.redo(); }
      if (ty === 'insertFromDrop') e.preventDefault();
    }),
    on('keydown', e => {
      if (kmOn && box.contains(kmOn)) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return kmClose(true); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); e.stopPropagation();
          const list = [...kmOn.nextElementSibling.querySelectorAll('button')].filter(y => !y.disabled && y.checkVisibility()), i = list.indexOf(document.activeElement), n = list.length;
          if (n) list[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n].focus();
          return;
        }
      }
      const ed = tnIn(e); if (!ed || e.isComposing) return;
      e.stopPropagation();   // a key typed in the notes is the notes', never a marking key
      const cmd = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), c = e.code, stop = () => { e.preventDefault(); };
      if (cmd && !e.altKey && (k === 'z' || k === 'y')) { stop(); return k === 'z' && !e.shiftKey ? C.undo() : C.redo(); }
      if (cmd && !e.altKey && !e.shiftKey && /^[biu]$/.test(k)) { stop(); return document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[k]); }
      if (cmd && e.altKey && !e.shiftKey && /^Digit[012]$/.test(c)) { stop(); return N.tnStyle(['', 'h', 'h2'][+c.slice(5)]); }
      if (cmd && e.shiftKey && !e.altKey && (c === 'Digit8' || c === 'Digit7')) { stop(); return N.tnList(c === 'Digit8' ? 'ul' : 'ol'); }
      if (cmd || e.altKey) return;
      if (k === 'escape') { e.preventDefault(); ed.blur(); return; }
      const p = N.tnPos(), L = N.tnGetL(), x = p && L[p.a[0]], list = y => y.y === 'ul' || y.y === 'ol';
      if (e.key === 'Tab' && p && L.slice(p.a[0], p.z[0] + 1).every(list)) { stop(); return N.tnIndent(!e.shiftKey); }
      if (e.key === 'Backspace' && p && x && list(x) && !p.a[1] && p.a[0] === p.z[0] && !p.z[1]) { stop(); return N.tnApply(xs => { const y = xs[0]; if (y.d) delete y.d; else delete y.y; }); }
    }),
    on('paste', e => {
      if (!tnIn(e)) return;
      e.preventDefault();
      const cd = e.clipboardData; if (!cd) return;
      const html = cd.getData('text/html'), txt = cd.getData('text/plain') || '';
      let P = html ? N.tnFromHtml(html) : [];
      if (!P.length) P = txt.replace(/\r\n?/g, '\n').split('\n').map(N.tnParse).filter((x, i, a) => x.s || (i && i < a.length - 1));
      if (P.length) N.tnInsert(P);
    }),
    on('drop', e => { if (tnIn(e)) e.preventDefault(); }),
    // the bar's buttons, the margin's times and the clock leave the selection where it is, so she types on
    on('mousedown', e => { if (e.target.closest('.tnbar button, .tngut button, .tnclock')) e.preventDefault(); }),
    on('click', e => click(e, box)),
  ];
  const sel = () => { const ed = box.querySelector('.tned'), s = getSelection(); if (!ed || !s.rangeCount || !ed.contains(s.anchorNode)) return; N.tnRngSet(s.getRangeAt(0).cloneRange()); N.tnBar(box, N.tnGetSt()); };
  const away = e => { if (kmOn && !e.target.closest('.kmw')) kmClose(); };
  document.addEventListener('selectionchange', sel); document.addEventListener('click', away, true);
  return () => { offs.forEach(f => f()); document.removeEventListener('selectionchange', sel); document.removeEventListener('click', away, true); kmClose(); };
}

async function click(e, box) {
  const km = e.target.closest('[data-km]');
  if (km && box.contains(km)) return km === kmOn ? kmClose() : kmOpen(km);
  const st = N.tnGetSt(); if (!st || st !== st0()) return;
  // the ⋯ opens with the three sizes folded under their item
  if (e.target.closest('.kdots')) { const sb = box.querySelector('[data-tnm="size"]'); sb.setAttribute('aria-expanded', 'false'); sb.nextElementSibling.hidden = true; }
  const el = e.target.closest('[data-tnsz],[data-tnf],[data-tnl],[data-tns],[data-tnmk],[data-tntm],[data-tnclk],[data-tnt],[data-tnts],[data-tnrub],[data-tnm],[data-tnback]'); if (!el) return;
  if (kmOn && !el.closest('[data-kmstay]')) kmClose();
  const d = el.dataset, setup = state().setup;
  if (d.tnf) { if (d.tnf === 'hl') return N.tnHl(); N.tnRestore(); return document.execCommand(d.tnf); }
  if (d.tnl) return N.tnList(d.tnl);
  if (d.tns != null) return N.tnStyle(d.tns);
  if (d.tnmk != null) return N.tnMark(d.tnmk);
  if (d.tntm != null) return N.tnTime();
  if (d.tnclk != null) { N.spClockGo(N.spClockOf(st)); return N.tnBar(box, st); }
  if (d.tnts != null) return N.tnShowTime(+d.tnts);
  if (d.tnt) { const x = N.tnGetL()[+d.tnt], m = player(); if (x && x.t != null) { if (m) { m.currentTime = x.t; m.play().catch(() => {}); } else toast(t('setup.tn_no_video')); } return; }
  if (d.tnrub != null) { N.tnSetL(setup.criteria.flatMap(s => [{ s: String(s), k: 'h' }, { s: '' }])); N.tnPaint(); N.tnSetPos({ a: [1, 0], z: [1, 0] }); return N.tnPut(st, false); }
  if (d.tnback != null || d.tnm === 'back') { if (N.tnBackOn()) setup.tnBack = false; else delete setup.tnBack; await setupKept(); N.tnBar(box, st); return toast(t(N.tnBackOn() ? 'setup.tn_back_on' : 'setup.tn_back_off')); }
  if (d.tnsz != null) {
    if (!N.tnBackOn() || d.tnsz === N.tnSizeOf()) return;
    C.setupStep(['tnSize'], () => { if (d.tnsz) setup.tnSize = d.tnsz; else delete setup.tnSize; }, () => { setupKept(); if (N.tnGetSt()) N.tnBar(box, N.tnGetSt()); });
    return toast(t('setup.tn_size_now', { size: t(SIZES[d.tnsz] || 'setup.tn_size_m') }));
  }
  const m = d.tnm;
  if (m === 'size') { const sub = el.nextElementSibling, open = sub.hidden; sub.hidden = !open; el.setAttribute('aria-expanded', String(open)); if (open) { const c = sub.querySelector('[aria-checked=true]') || sub.querySelector('button'); if (c) c.focus(); } return; }
  if (m === 'alltimes') { const hid = N.tnAllHid(); N.tnShowTime(null); return toast(t(hid ? 'setup.tn_times_shown' : 'setup.tn_times_hidden')); }
  if (m === 'times') { const { prefs } = await import('../../students/prefs.js'); if (N.tnTimesOn()) prefs.set('gs.tnTime', false); else prefs.del('gs.tnTime'); return N.tnMore(); }
  if (m === 'head') { setup.tnHead = N.tnGetL().filter(x => x.k === 'h' && x.s.trim()).map(x => x.s.trim()); await setupKept(); N.tnBar(box, st); return toast(t('setup.tn_heads_set', { n: setup.tnHead.length })); }
  if (m === 'unhead') { delete setup.tnHead; await setupKept(); N.tnLoad(box, st); return toast(t('setup.tn_heads_off')); }
  if (m === 'copy') return copyText(N.tnText(N.tnGetL())).then(ok => toast(t(ok ? 'setup.tn_copied' : 'setup.tn_not_copied')));
  if (m === 'clear') {
    N.tnSnap(st); const left = (N.tnStored(st) || []).filter(x => N.tnHidden(x, st));
    if (left.length) st.grade.tn = { l: left }; else delete st.grade.tn;
    C.touched(st); N.tnLoad(box, st);
    return toast(t('setup.tn_cleared'), { undo: C.undo });
  }
}

// Copy text in the notes' bar, beside its More menu: the same press as a transcript's (ui copyButton). The bar is drawn again for
// each student, so the button goes back in after each drawing.
function copyIn(host) {
  const bar = host.querySelector('.tnbar'); if (!bar || bar.querySelector('[data-copytext]')) return;
  const b = copyButton(() => N.tnText(N.tnGetL())); b.dataset.tncopy = '';
  const more = [...bar.children].filter(x => x.classList.contains('kmw')).pop();
  bar.insertBefore(b, more || null);
}
// The notes for the student on screen: drawn again after any change from outside (Undo, a merge), never while she is typing.
export function TypedNotes({ st }) {
  const box = useRef(null);
  useEffect(() => { N.tnUse({ host: box.current, now: nowOf }); const off = wire(box.current); return () => { off(); N.tnUse({ host: null }); }; }, []);
  useEffect(() => { if (box.current && st) { N.tnDraw(box.current, st); copyIn(box.current); } });
  // dictation, as every long box has: the words go in where the cursor was in the notes (the selection stays there while the mic is pressed)
  const said = w => { const ed = box.current && box.current.querySelector('.tned'); if (!ed) return; ed.focus(); document.execCommand('insertText', false, ' ' + w.trim()); };
  return <><div ref={box} class="mk-tn" data-raw /><span class="mk-tnmic"><Mic onText={said} /></span><BankMenu /></>;
}
// Saved comments (gs.bank, Settings > Marking) into the notes where the caret was (inventory 312).
function BankMenu() {
  const [bank, setBank] = useState(null);
  useEffect(() => { PARTS.cbank().then(m => m.readBank()).then(setBank, () => setBank([])); }, []);
  const put = c => { N.tnRestore(); document.execCommand('insertText', false, c); };
  const items = !bank ? [] : bank.length ? bank.map(c => ({ label: c, onSelect: () => put(c) })) : [{ label: t('paper.tn_bank_none'), disabled: true }];
  return <div class="mk-tnbank"><Menu label={t('paper.tn_bank')} trigger={b => <Button {...b} size="sm" variant="quiet" icon="comment" onMouseDown={e => e.preventDefault()} data-tnbank>{t('paper.tn_bank')}</Button>} items={items} /></div>;
}

// The Timer: start, pause, carry on, reset, + Time to comment, and the length the assignment asks for (setup.talk, minutes).
export function Timer({ st }) {
  const [, tick] = useState(0), c = N.spClockOf(st), s = N.spClockMs(c) / 1000, [lo, hi] = N.spTalk();
  useEffect(() => { if (!c.at) return; const iv = setInterval(() => tick(n => n + 1), 500); return () => clearInterval(iv); }, [c.at, st]);
  const how = s < 1 || (lo == null && hi == null) ? '' : lo != null && s < lo * 60 ? 'under' : hi != null && s > hi * 60 ? 'over' : 'in';
  const talk = (i, v) => { const tk = N.spTalk(); tk[i] = v > 0 && isFinite(v) ? Math.min(600, Math.round(v * 2) / 2) : null; const su = state().setup; if (tk[0] == null && tk[1] == null) delete su.talk; else su.talk = tk; setupKept(); tick(n => n + 1); };
  const num = (i, v, label) => <input type="number" class="input mk-tmnum" min="0" max="600" step="0.5" inputmode="decimal" aria-label={label} value={v == null ? '' : v} onChange={e => talk(i, parseFloat(e.currentTarget.value))} data-tmtalk={i} />;
  return <div class="mk-timer" data-how={how}>
    <div class="mk-tmrow"><b class="mk-tmclock num" role="timer" data-tmclock>{fmtTime(s)}</b>
      <Button size="sm" variant={c.at ? undefined : 'primary'} aria-pressed={c.at ? 'true' : 'false'} onClick={() => { N.spClockGo(c); tick(n => n + 1); }} data-tmgo>{t(c.at ? 'setup.tm_pause' : c.ms ? 'setup.tm_carry' : 'setup.tm_start')}</Button>
      <Button size="sm" disabled={!c.at && !c.ms} onClick={() => { c.ms = 0; c.at = 0; tick(n => n + 1); }} data-tmreset>{t('setup.tm_reset')}</Button>
      <Button size="sm" variant="quiet" title={t('setup.tm_stamp_tip')} onClick={() => { C.addStamp(st, N.spClockMs(c) / 1000); toast(t('setup.v_stamped')); }} data-tmstamp>{t('setup.v_stamp')}</Button></div>
    <div class="mk-tmrow"><span class="mute">{t('setup.tm_asked')}</span>{num(0, lo, t('setup.tm_least'))}<span aria-hidden="true">–</span>{num(1, hi, t('setup.tm_most'))}</div>
    {how && <p class={'mk-tmhow ' + how} data-tmhow={how}>{t(HOW[how])}</p>}
  </div>;
}

// Under the comment: Typed notes, and the Timer for a student with no video. Each opens and closes; notes already typed open it.
let openN = false, openT = false;
export function NotesPart({ st }) {
  const [, again] = useState(0), hasVid = st.files.some(f => f.kind === 'media' || f.kind === 'link');
  const nOn = openN || tnHas(st), tOn = !hasVid && (openT || N.spClockMs(N.spClockOf(st)) > 0);
  return <div class="mk-notes">
    <button type="button" class="mk-disc" aria-expanded={nOn ? 'true' : 'false'} onClick={() => { openN = !nOn; again(n => n + 1); }} data-tnopen>{t('setup.tn_title')}</button>
    {nOn && <TypedNotes st={st} />}
    {!hasVid && <><button type="button" class="mk-disc" aria-expanded={tOn ? 'true' : 'false'} onClick={() => { openT = !tOn; again(n => n + 1); }} data-tmopen>{t('setup.tm_title')}</button>
      {tOn && <Timer st={st} />}</>}
  </div>;
}
