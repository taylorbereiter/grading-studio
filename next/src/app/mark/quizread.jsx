// A quiz made here, read back from the scan (src/quizread.js qrReadAll, openQuizLook), loaded with Quick mark (router.js PARTS.quizread):
// every scanned page of the quiz found by its code, the bubbles read, and the clear answers scored (only questions not marked yet,
// unless read again) as one undo step (mark/change.js quickDo). Answers the scan isn't sure of wait for her in Quiz scan, each with
// its picture and the scan's best guess; Save scores is one step too. Pages printed before the quiz last changed aren't read.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, toast, useModal } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import { shownName, viewable } from '../../engines/gdraw.js';
import * as Z from '../../engines/gquiz.js';
import * as K from '../../engines/gqmake.js';
import { libs } from './paper.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './lines.js';
import './quick-lines.js';

export const made = () => { const Q = state().batch && state().batch.quiz; return !!(Q && Q.made && Q.qs.some(q => q.auto)); };
// Scores set together, one step: marks on the papers, the score and the total (qrApply).
function apply(list) {
  if (!list.length) return Promise.resolve();
  const sts = [...new Set(list.map(x => x.st))];
  return C.quickDo(sts, async () => {
    for (const x of list) { const g = x.st.grade, m = g.q ? { ...g.q } : {}; if (x.v == null) delete m[x.q.id]; else m[x.q.id] = x.v; g.q = m; await Z.qzPaper(x.st, x.q, x.v); }
    for (const st of sts) { Z.quizScore(st); await Z.qzTotal(st); }
  });
}
// Read every scanned page of this quiz (qrReadAll). Returns true when something waits for her (or pages were too old to read).
export async function readAll(again) {
  await libs();
  const b0 = state().batch, Q = b0 && b0.quiz, mq = Q && Q.made; if (!mq || !Q.qs.some(q => q.auto)) return false;
  // papers just brought in take a moment to be laid out as pages
  for (let k = 0; k < 100 && state().batch === b0 && b0.students.some(st => st.files.some(f => viewable(f) && !f.virtual) && !Z.quizPages(st).length); k++) await new Promise(r => setTimeout(r, 200));
  const list = [], look = [];
  let pages = 0, old = 0, read = 0, blank = 0, seen = 0;
  toast(t('qk.qr_reading'));
  // the readings and the shifts they find are one step with the scores
  const work = [];
  for (const i of Z.quizWho()) {
    const st = b0.students[i]; if (state().batch !== b0) return false;
    const r = await K.qrStudent(st, Q, mq); pages += r.pages; old += r.old;
    if (r.pages) seen++;
    const qa = { ...(st.grade.qa || {}) };
    for (const a of K.qrDecide(r.b)) {
      if (a.why) { if (again || Z.quizMarks(st)[a.q.id] == null) look.push({ s: st.key, q: a.q.id, why: a.why, guess: a.guess || '' }); continue; }
      qa[a.q.id] = a.ans; read++; if (a.blank) blank++;
      if (a.v != null && (again || Z.quizMarks(st)[a.q.id] == null)) list.push({ st, q: a.q, v: a.v });
    }
    if (Object.keys(qa).length) work.push([st, qa]);
  }
  if (state().batch !== b0) return false;
  await C.quickDo(b0.students, async () => {
    for (const [st, qa] of work) st.grade.qa = qa;
    Q.look = look.length ? look : undefined;
    Q.lastRead = { pages, seen, read, blank, old, t: Date.now() };
  });
  await apply(list);
  if (look.length || old) return true;
  toast(seen ? t(seen === 1 ? 'qk.qr_scored1' : 'qk.qr_scored', { n: read, who: seen }) : t('qk.qr_none'));
  return false;
}

// Quiz scan: what the scan read, and the answers it needs her to check (openQuizLook).
export function QuizLook({ onClose, onAgain }) {
  const bb = state().batch, Q = bb.quiz, R = Q.lastRead || {};
  const [look] = useState(() => (Q.look || []).map(l => ({ ...l, st: bb.students.find(s => s.key === l.s), q: Q.qs.find(q => q.id === l.q) })).filter(l => l.st && l.q));
  const [pick, setPick] = useState(() => look.map(l => { const ms = l.q.auto.t === 'ms'; return ms ? (l.guess ? l.guess.split('') : []) : l.guess ? [l.guess] : []; }));
  const [pics, setPics] = useState({}), [busy, setBusy] = useState(false);
  const p = useModal(true, onClose);
  useEffect(() => { let live = true; (async () => { await libs(); for (const [k, l] of look.entries()) { try { const c = await Z.qzCrop(l.st, l.q); if (!live) return; if (c) setPics(x => ({ ...x, [k]: c.url })); } catch {} } })(); return () => { live = false; }; }, []);
  const choose = (k, x) => setPick(all => all.map((on, j) => { if (j !== k) return on; const ms = look[k].q.auto.t === 'ms'; if (ms && x !== '-') { const o = on.filter(y => y !== '-'); return o.includes(x) ? o.filter(y => y !== x) : [...o, x]; } return [x]; }));
  const save = async () => {
    setBusy(true);
    const list = [], keep = [], ans = [];
    look.forEach((l, k) => {
      const on = pick[k];
      if (!on.length || (l.q.auto.t === 'sa' && on[0] === '-')) return keep.push(Q.look.find(x => x.s === l.s && x.q === l.q.id));
      const a = on[0] === '-' ? '' : on.slice().sort().join('');
      ans.push([l.st, l.q.id, a]);
      const v = a ? K.qrScoreOf(l.q, a) : 0; if (v != null) list.push({ st: l.st, q: l.q, v });
    });
    await C.quickDo([...new Set(look.map(l => l.st))], async () => {
      for (const [st, id, a] of ans) (st.grade.qa ||= {})[id] = a;
      Q.look = keep.filter(Boolean); if (!Q.look.length) delete Q.look;
      for (const x of list) { const g = x.st.grade; g.q = { ...(g.q || {}), [x.q.id]: x.v }; await Z.qzPaper(x.st, x.q, x.v); }
      for (const st of new Set(list.map(x => x.st))) { Z.quizScore(st); await Z.qzTotal(st); }
    });
    onClose();
    toast(list.length ? t(list.length === 1 ? 'qk.qr_saved1' : 'qk.qr_saved', { n: list.length }) : t('qk.qr_nothing'), list.length ? { undo: C.undo } : {});
  };
  return <dialog class="dlg mk-qr" aria-labelledby="qrT" {...p} data-qr>
    <header><h2 id="qrT">{t('qk.qr_title')}</h2></header>
    <div class="body">
      <div class="qftiles"><div><b>{R.pages || 0}</b><span>{t('qk.qr_t_pages')}</span></div><div><b>{R.seen || 0}</b><span>{t('qk.qr_t_seen')}</span></div>
        <div><b>{R.read || 0}</b><span>{R.blank ? t('qk.qr_t_read_blank', { n: R.blank }) : t('qk.qr_t_read')}</span></div><div class="need"><b>{look.length}</b><span>{t('qk.qr_t_need')}</span></div></div>
      {R.old > 0 && <p class="qfwarn">{t(R.old === 1 ? 'qk.qr_old1' : 'qk.qr_old', { n: R.old })}</p>}
      {look.length ? <><p>{t('qk.qr_pick')}</p>{look.map((l, k) => { const L = K.qzAutoLetters(l.q), sa = l.q.auto.t === 'sa', ms = l.q.auto.t === 'ms';
        return <div class={'qfrr' + (pick[k].length ? ' done' : '')} data-qrrow={k}><div class="qfrw"><b data-raw>{shownName(l.st, bb.students.indexOf(l.st))}</b><span class="mute">{t('qk.qr_q_why', { q: l.q.lab, why: t(WHY[l.why] || 'qk.qr_why_unclear') })}</span></div>
          <div class="qfcrop">{pics[k] ? <img alt="" src={pics[k]} /> : <span class="mute">{t('qk.qm_drawing')}</span>}</div>
          <div class="qfpick"><span class="mute">{sa ? t('qk.qr_your') : ms ? t('qk.qr_theirs_ms') : t('qk.qr_theirs')}</span>
            {L.map(x => <Button size="sm" variant={pick[k].includes(x) ? 'primary' : undefined} aria-pressed={pick[k].includes(x) ? 'true' : 'false'} onClick={() => choose(k, x)} data-ans={x}>{x}</Button>)}
            <Button size="sm" variant={pick[k][0] === '-' ? 'primary' : undefined} aria-pressed={pick[k][0] === '-' ? 'true' : 'false'} onClick={() => choose(k, '-')} data-ans="-">{sa ? t('qk.qr_later') : t('qk.qr_none_ans')}</Button></div></div>; })}</>
        : <p>{t('qk.qr_nothing_needs')}</p>}
    </div>
    <footer><span class="mute grow">{t('qk.qr_foot')}</span><Button onClick={() => { onClose(); onAgain(); }} title={t('qk.qr_again_tip')} data-qragain>{t('qk.qr_again')}</Button>
      <Button onClick={onClose} data-qrlater>{t('qk.qr_later')}</Button><Button variant="primary" disabled={busy} onClick={save} data-qrdone>{t('qk.qr_save')}</Button></footer>
  </dialog>;
}
// The scan's reasons, as qrDecide gives them (its own English words are the keys), in the app's words.
const WHY = { 'Score unclear': 'qk.qr_why_score', 'Very light': 'qk.qr_why_light', 'Not clear': 'qk.qr_why_unclear', 'Another bubble marked': 'qk.qr_why_other', 'Two bubbles filled': 'qk.qr_why_two' };
