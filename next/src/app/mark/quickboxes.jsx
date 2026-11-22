// Quick mark's boxes (src/quiz.js openQuizBoxes), loaded with Quick mark (router.js PARTS.quick): one paper's pages, on which she drags
// a box around each question, in order. Boxes can overlap. A drag on a box's number moves it, a click picks it, its corners resize it,
// and its circle is where its mark goes. Beside the pages, each question's points, how it is scored (right or wrong, or a scale like
// 0 to 2), how it is marked and its answer; what each step of a scale means; in an MYP class, each question's criterion and the
// points that earn each level; where marks, answer notes and the total go. Keys for the picked box: arrows move it, Shift + arrows
// resize it, Ctrl D copies it just below, Delete takes it out. Save boxes is one undo step (mark/change.js quickBoxesSave).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, Segmented, toast, useModal, HeldInput } from '../../ui/index.js';
import { state, fmtNum } from '../../engines/gcore.js';
import { shownName } from '../../engines/gdraw.js';
import * as Z from '../../engines/gquiz.js';
import * as S from '../../engines/gsetup.js';
import { prefs } from '../../students/prefs.js';
import { library } from '../../students/index.js';
import { libs } from './paper.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import { PARTS } from '../router.js';
import './lines.js';
import './paper-lines.js';

const J = v => JSON.parse(JSON.stringify(v));
const R = v => Math.round(v * 10000) / 10000, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10);
const HOW = () => [['x', t('paper.qb_how_x')], ['cx', t('paper.qb_how_cx')], ['pts', t('paper.qb_how_pts')]];
const ANS = () => [['miss', t('paper.qb_ans_miss')], ['all', t('paper.qb_ans_all')], ['off', t('paper.qb_ans_off')]];
const AT = () => [['right', t('paper.qb_at_right')], ['under', t('paper.qb_at_under')], ['mark', t('paper.qb_at_mark')]];
const atWord = k => t(k === 'under' ? 'paper.qb_atw_under' : k === 'mark' ? 'paper.qb_atw_mark' : 'paper.qb_atw_right');

// One page, drawn once (qzPage at 1100 across) and kept while the editor is open.
function PageImg({ st, n, onSize }) {
  const box = useRef(), [got, setGot] = useState(false);
  useEffect(() => {
    let live = true, c = null;
    setGot(false);
    Z.qzPage(st, n, 1100).then(pg => { if (!live) { if (pg) pg.c.width = 0; return; } if (!pg) return; c = pg.c; c.className = 'qbimg'; box.current.replaceChildren(c); setGot(true); onSize(); }, e => console.error(e));
    return () => { live = false; if (c) { c.width = 0; c.remove(); } };
  }, [st.key, n]);
  // the canvas goes into a box of its own, which Preact leaves empty
  return <div class="qbimgbox">{!got && <span class="mute">{t('paper.qm_drawing')}</span>}<div ref={box} class="qbcv" /></div>;
}

export function QuickBoxes({ onClose, onSaved }) {
  const bb = state().batch, who = Z.quizWho();
  const Q = useRef(null);
  if (!Q.current) {
    const q = bb.quiz ? J(bb.quiz) : { qs: [], how: 'x', side: 'left', total: null, shift: {} };
    q.how ||= 'x'; q.ans ||= 'miss'; q.at ||= 'right';
    q.words = J(Z.qzWordsAll());
    Q.current = q;
  }
  const W = Q.current;
  const [si, setSi] = useState(() => { const was = W.qs.length ? who.find(i => bb.students[i].key === W.from) : null; return was != null ? was : who[0]; });
  const [sel, setSel] = useState(null), [mode, setMode] = useState(null), [ansBack, setAnsBack] = useState(false), [, again] = useState(0), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const re = () => again(n => n + 1);
  const p = useModal(true, () => close()), pagesEl = useRef(), drag = useRef(null);
  useEffect(() => { let live = true; libs().then(() => { if (live) setReady(true); }); return () => { live = false; }; }, []);
  const close = () => { Z.qzLetGo(); onClose(); };
  const st = bb.students[si], qOf = id => W.qs.find(q => q.id === id), c = S.ibTaskClass();
  const pinAt = q => {
    if (q.mx != null) return [q.mx, q.my];
    const sz = Z.qzSz(st, q.n), right = (W.side || 'left') === 'right';
    return [right ? q.x + q.w + 15 / sz.W : Math.max(13 / sz.W, q.x - 15 / sz.W), Math.max(12 / sz.H, q.y + 12 / sz.H)];
  };
  const ansAt = q => {
    if (q.nx != null) return [q.nx, q.ny];
    const sz = Z.qzSz(st, q.n);
    if (W.at === 'under') return [q.x + q.w - 10 / sz.W, q.y + q.h + 6 / sz.H];
    if (W.at === 'mark') { const [px, py] = pinAt(q); return [px + 16 / sz.W, py]; }
    return [q.x + q.w, q.y + q.h / 2 + 6 / sz.H];
  };
  const moved = bb.students.reduce((a, s) => a + s.files.reduce((b2, f) => b2 + Object.values(f.marks || {}).reduce((c2, l) => c2 + l.filter(Z.qzMoved).length, 0), 0), 0);
  const pick = id => { setSel(id); setMode(null); };
  const sum = W.qs.reduce((a, q) => a + (+q.pts || 0), 0);
  const nPages = ready ? Z.quizPages(st).length : 0;

  /* on a page: a drag draws a new box, even inside another; a click picks the box under it; a drag on a box's number moves it, on the
     picked box's corners resizes it, on a circle moves where its mark (or gold answer line) goes */
  const down = (e, n) => {
    if (e.button !== 0) return;
    const w = e.currentTarget, img = w.querySelector('canvas'); if (!img) return;
    const r = img.getBoundingClientRect(), at = ev => [clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)], p0 = at(e);
    if (mode === 'total') { W.total = { n, x: Math.round(p0[0] * 1000) / 1000, y: Math.round(p0[1] * 1000) / 1000 }; setMode(null); return; }
    if (mode === 'spot') {
      const q = qOf(sel); setMode(null);
      if (q && q.n === n) { q.mx = R(p0[0]); q.my = R(p0[1]); re(); } else if (q) toast(t('paper.qb_spot_page', { n: q.n + 1, q: Z.quizLabel(q, W.qs.indexOf(q)) }));
      return;
    }
    e.preventDefault(); w.setPointerCapture(e.pointerId); pagesEl.current.focus({ preventScroll: true });
    const pin = e.target.closest('[data-qbpin]'), apin = e.target.closest('[data-qbapin]'), hd = e.target.closest('[data-c]'), tab = e.target.closest('[data-qbtab]');
    let kind = 'draw', q = null;
    if (pin) { kind = 'pin'; q = qOf(pin.dataset.qbpin); } else if (apin) { kind = 'apin'; q = qOf(apin.dataset.qbapin); } else if (hd) { kind = hd.dataset.c; q = qOf(sel); } else if (tab) { kind = 'move'; q = qOf(tab.dataset.qbtab); }
    const hit = e.target.closest('[data-qbbox]');
    drag.current = { kind, q, orig: q ? { ...q } : null, hit: hit && hit.dataset.qbbox, w, n, p0, at, r, moved: false, sel: null };
  };
  const move = e => {
    const d = drag.current; if (!d) return;
    const pp = d.at(e), dx = pp[0] - d.p0[0], dy = pp[1] - d.p0[1];
    if (!d.moved && Math.hypot(dx * d.r.width, dy * d.r.height) < 4) return;
    d.moved = true;
    const q = d.q, o = d.orig;
    if (d.kind === 'draw') { d.sel = { x: Math.min(pp[0], d.p0[0]), y: Math.min(pp[1], d.p0[1]), w: Math.abs(dx), h: Math.abs(dy), n: d.n }; return re(); }
    if (!q) return;
    if (d.kind === 'pin') { q.mx = R(pp[0]); q.my = R(pp[1]); }
    else if (d.kind === 'apin') { q.nx = R(pp[0]); q.ny = R(pp[1]); }
    else if (d.kind === 'move') {
      q.x = R(clamp(o.x + dx, 0, 1 - o.w)); q.y = R(clamp(o.y + dy, 0, 1 - o.h));
      if (o.mx != null) { q.mx = R(clamp(o.mx + q.x - o.x, 0, 1)); q.my = R(clamp(o.my + q.y - o.y, 0, 1)); }
      if (o.nx != null) { q.nx = R(clamp(o.nx + q.x - o.x, 0, 1)); q.ny = R(clamp(o.ny + q.y - o.y, 0, 1)); }
    } else {   // a corner: nw, ne, sw or se
      let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
      if (d.kind[1] === 'w') x0 = pp[0]; else x1 = pp[0];
      if (d.kind[0] === 'n') y0 = pp[1]; else y1 = pp[1];
      q.x = R(Math.min(x0, x1)); q.y = R(Math.min(y0, y1)); q.w = R(Math.max(0.02, Math.abs(x1 - x0))); q.h = R(Math.max(0.01, Math.abs(y1 - y0)));
    }
    re();
  };
  const up = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    if (d.kind === 'draw') {
      if (!d.moved) return pick(d.hit || null);
      if (!d.sel || d.sel.w < 0.02 || d.sel.h < 0.01) return re();
      const last = W.qs[W.qs.length - 1];
      const q = { id: uid(), lab: '', n: d.n, x: R(d.sel.x), y: R(d.sel.y), w: R(d.sel.w), h: R(d.sel.h), pts: last ? last.pts : 1, key: '', how: W.how };
      if (last && last.ib) q.ib = last.ib;
      if (last && last.kind) q.kind = last.kind;   // after a short answer, the next box is one too
      W.qs.push(q); return pick(q.id);
    }
    if (d.q) pick(d.q.id);
  };
  const keys = e => {
    p.onKeyDown(e);
    if (!sel || e.target.closest('input,select,textarea')) return;
    const q = qOf(sel); if (!q) return;
    const k = e.key, stp = 0.002;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); W.qs = W.qs.filter(x => x.id !== sel); return pick(null); }
    if ((e.ctrlKey || e.metaKey) && (k === 'd' || k === 'D')) {
      e.preventDefault();
      const y = R(clamp(q.y + q.h + 0.01, 0, 1 - q.h)), cp = { ...q, id: uid(), lab: '', y };
      if (q.mx != null) cp.my = R(clamp(q.my + y - q.y, 0, 1));
      if (q.nx != null) cp.ny = R(clamp(q.ny + y - q.y, 0, 1));
      W.qs.splice(W.qs.indexOf(q) + 1, 0, cp); return pick(cp.id);
    }
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (!mv) return;
    e.preventDefault();
    if (e.shiftKey) { q.w = R(clamp(q.w + mv[0] * stp, 0.02, 1 - q.x)); q.h = R(clamp(q.h + mv[1] * stp, 0.01, 1 - q.y)); }
    else {
      const x = R(clamp(q.x + mv[0] * stp, 0, 1 - q.w)), y = R(clamp(q.y + mv[1] * stp, 0, 1 - q.h));
      if (q.mx != null) { q.mx = R(clamp(q.mx + x - q.x, 0, 1)); q.my = R(clamp(q.my + y - q.y, 0, 1)); }
      if (q.nx != null) { q.nx = R(clamp(q.nx + x - q.x, 0, 1)); q.ny = R(clamp(q.ny + y - q.y, 0, 1)); }
      q.x = x; q.y = y;
    }
    re();
  };

  /* the list beside the pages */
  const setPts = (q, v) => { v = +v; if (v > 0 && v <= 100) q.pts = Math.round(v * 2) / 2; re(); };
  const setKind = (q, v) => { q.kind = v; if (v === 'scale' && (+q.pts || 1) <= 1) q.pts = 2; re(); };   // a scale of 0 to 1 is right or wrong
  const goals = S.goalList();
  // Edit goals… / Tag questions with learning goals… (src/quiz.js data-qgoals; D-011): the teacher's list, then a Goal on each question
  const [gbox, setGbox] = useState(null);
  const editGoals = () => PARTS.goals().then(m => setGbox(() => m.GoalsDialog), e => console.error(e));
  // the list as it was saved, on the screen's own copy of the library, so the Goal on each question offers it now
  const goalsBack = () => { const l = library.json(null), cur = state().lib; if (l && cur) for (const k of ['goals', 'goalsGone']) { if (l[k]) cur[k] = l[k]; else delete cur[k]; } setGbox(null); re(); };
  const tops = [...new Set(W.qs.filter(Z.qzByPts).map(q => +q.pts || 1))].sort((a, b2) => a - b2);
  const lvNote = k => {
    const tb = Z.ibQzRaw(W, k), max = Z.ibQzMax(W, c, k);
    if (!tb || tb.every(v => v == null)) return t('paper.qb_lv_none');
    if (!Z.ibQzTable(W, k)) return t('paper.qb_lv_fill', { n: S.IB_TOP });
    return tb[S.IB_TOP - 1] > max ? t('paper.qb_lv_over', { n: S.IB_TOP, p: fmtNum(tb[S.IB_TOP - 1]), max: fmtNum(max) }) : '';
  };
  const lvOk = () => {
    if (!c) return true;
    for (const k of Object.keys(W.lvb || {})) { const tb = Z.ibQzRaw(W, k); if (!tb || tb.every(v => v == null)) delete W.lvb[k]; }
    const bad = Object.keys(W.lvb || {}).filter(k => !Z.ibQzTable(W, k));
    if (bad.length) { toast(t('paper.qb_lv_bad', { list: bad.join(', ') })); return false; }
    if (W.lvb && !Object.keys(W.lvb).length) delete W.lvb;
    return true;
  };
  const save = async () => {
    if (!lvOk()) return;
    const out = J(W);   // the editor keeps drawing from W while this saves
    for (const q of out.qs) if (!(+q.pts > 0)) q.pts = 1;
    for (const k of Object.keys(out.words)) if (out.words[k].length !== Z.qzSteps(+k).length) delete out.words[k];
    if (Object.keys(out.words).length) prefs.set('gs.qmWords', { ...Z.qzWordsMine(), ...out.words }); else delete out.words;   // her words start her next quiz too
    out.from = st.key;
    setBusy(true);
    try {
      const say = await C.quickBoxesSave(out, ansBack, Z, S);
      if (!out.qs.length) Z.qzLetGo();   // with boxes, Quick mark opens next on the same documents
      toast(say === 'rubric' ? t('paper.qb_saved_rubric', { n: fmtNum(sum) }) : say === 'points' ? t('paper.qb_saved_points', { n: fmtNum(sum) }) : t('paper.qb_saved'), { undo: C.undo });
      onSaved(W.qs.length > 0);
    } catch (e) { console.error(e); setBusy(false); toast(t('mark.cannot')); }
  };
  const q = qOf(sel);
  const row = (k, on, list, set, attr) => <Segmented size="sm" label={k} value={on} onChange={v => { set(v); re(); }} options={list.map(([value, label]) => ({ value, label }))} data-attr={attr} />;
  return <><dialog class="dlg mk-qb" aria-labelledby="qbT" {...p} onKeyDown={keys} data-qb>
    <header><h2 id="qbT">{t('paper.qb_title')}</h2>
      <label class="qbwho"><span>{t('paper.qb_on')}</span><select class="input sm" value={si} onChange={e => { setSi(+e.currentTarget.value); }} data-qbwho data-raw>{who.map(i => <option value={i}>{shownName(bb.students[i], i)}</option>)}</select></label></header>
    <div class="body qbwrap">
      <div class="qbpages" ref={pagesEl} tabIndex={-1} data-qbpages>{!ready ? <div class="loading" aria-busy="true" /> : Array.from({ length: nPages }, (_, n) => {
        const d = drag.current;
        return <div class="qbpg" key={st.key + '|' + n} onPointerDown={e => down(e, n)} onPointerMove={move} onPointerUp={up} data-qbpg={n}>
          <div class="qbpn">{t('paper.qb_page', { n: n + 1 })}</div><PageImg st={st} n={n} onSize={re} />
          {W.qs.map((x, i) => {
            if (x.n !== n) return null;
            const on = x.id === sel, [px, py] = pinAt(x), lab = Z.quizLabel(x, i);
            return <Fragment key={x.id}><div class={'qbbox' + (on ? ' on' : '')} style={{ left: x.x * 100 + '%', top: x.y * 100 + '%', width: x.w * 100 + '%', height: x.h * 100 + '%' }} data-qbbox={x.id}>
              <span data-qbtab={x.id} data-raw>{lab}</span>{on && ['nw', 'ne', 'sw', 'se'].map(k => <i class={'qbh ' + k} data-c={k} />)}</div>
              <div class={'qbpin' + (on ? ' on' : '')} style={{ left: px * 100 + '%', top: py * 100 + '%' }} title={t('paper.qb_pin_tip')} data-qbpin={x.id}>{(x.how || 'cx') === 'pts' ? fmtNum(+x.pts || 1) : '✗'}</div>
              {W.ans !== 'off' && String(x.key || '').trim() && (() => { const [ax, ay] = ansAt(x); return <div class={'qbapin' + (on ? ' on' : '')} style={{ left: ax * 100 + '%', top: ay * 100 + '%' }} title={t('paper.qb_apin_tip', { q: lab })} data-qbapin={x.id} data-raw>{/^\d/.test(lab) ? 'Q' + lab : lab}</div>; })()}</Fragment>;
          })}
          {W.total && W.total.n === n && <div class="qbtot" style={{ left: W.total.x * 100 + '%', top: W.total.y * 100 + '%' }} data-qbtot>{fmtNum(sum) + '/' + fmtNum(sum)}</div>}
          {d && d.kind === 'draw' && d.sel && d.sel.n === n && <div class="qbbox ghost" style={{ left: d.sel.x * 100 + '%', top: d.sel.y * 100 + '%', width: d.sel.w * 100 + '%', height: d.sel.h * 100 + '%' }} />}
        </div>;
      })}</div>
      <div class="qbside">
        <p class="mute">{t('paper.qb_about')}</p>
        {W.qs.length ? <><table class="qbt"><thead><tr><th>{t('paper.qb_q')}</th><th>{t('paper.qb_pts')}</th><th>{t('paper.qb_kind')}</th><th>{t('paper.qb_how')}</th><th>{t('paper.qb_key')}</th><th /></tr></thead>
          <tbody>{W.qs.map((x, i) => <Fragment key={x.id}><tr class={x.id === sel ? 'on' : ''} onFocusIn={() => { if (sel !== x.id) pick(x.id); }} data-qbrow={x.id}>
            <td><input class="input sm" value={x.lab || String(i + 1)} aria-label={t('paper.qb_q_name')} maxLength={12} onInput={e => { x.lab = e.currentTarget.value.trim() === String(i + 1) ? '' : e.currentTarget.value; re(); }} data-qlab data-raw /></td>
            <td><HeldInput class="input sm" type="number" min="0.5" step="0.5" value={String(x.pts)} aria-label={t('paper.qb_pts')} onChange={e => setPts(x, e.currentTarget.value)} data-qpts /></td>
            <td><select class="input sm" value={Z.qzByPts(x) ? 'scale' : 'rw'} aria-label={t('paper.qb_kind')} onChange={e => setKind(x, e.currentTarget.value)} data-qkind><option value="rw">{t('paper.qb_rw')}</option><option value="scale">{t('paper.qm_scale', { n: fmtNum(+x.pts || 1) })}</option></select></td>
            <td><select class="input sm" value={x.how || 'cx'} aria-label={t('paper.qb_how')} onChange={e => { x.how = e.currentTarget.value; re(); }} data-qhow>{HOW().map(([k, l]) => <option value={k}>{l}</option>)}</select></td>
            <td><input class="input sm" value={x.key || ''} placeholder={t('paper.qb_key_ph')} aria-label={t('paper.qb_key_label')} maxLength={160} onInput={e => { x.key = e.currentTarget.value; re(); }} data-qkey data-raw /></td>
            <td><button type="button" class="icon" aria-label={t('paper.qb_del')} title={t('paper.qb_del')} onClick={() => { W.qs = W.qs.filter(y => y.id !== x.id); if (sel === x.id) setSel(null); re(); }} data-del={x.id}>✕</button></td></tr>
            {(goals.length > 0 || c) && <tr class={'qgrow' + (x.id === sel ? ' on' : '')}><td colSpan={6}>
              {c && <label>{t('paper.qb_crit')} <select class="input sm" value={Z.ibQzOf(x, c)} aria-label={t('paper.qb_crit_for', { q: Z.quizLabel(x, i) })} onChange={e => { x.ib = e.currentTarget.value; re(); }} data-qib data-raw>{S.ibCrit(c).map(y => <option value={y.k}>{y.k + ' ' + y.name}</option>)}</select></label>}
              {goals.length > 0 && <label>{t('paper.qb_goal')} <select class="input sm" value={x.goal || ''} aria-label={t('paper.qb_goal_for', { q: Z.quizLabel(x, i) })} onChange={e => { if (e.currentTarget.value) x.goal = e.currentTarget.value; else delete x.goal; re(); }} data-qgoal data-raw>
                <option value="">{t('paper.qb_goal_none')}</option>{goals.map(g => <option value={g.id}>{g.name}</option>)}</select></label>}</td></tr>}</Fragment>)}</tbody></table>
          <p class="hsm goalline"><button type="button" class="link" onClick={editGoals} data-qgoals>{t(goals.length ? 'paper.qb_goals_edit' : 'paper.qb_goals_tag')}</button></p></>
          : <p class="mute">{t('paper.qb_none')}</p>}
        {c && W.qs.length > 0 && <div class="qbwords ibqlv" data-qblv><p><b>{t('paper.qb_lv_h')}</b> <span class="mute">{t('paper.qb_lv_sub')}</span></p>
          {Z.ibQzUsed(W, c).map(k => { const tb = Z.ibQzRaw(W, k) || [], max = Z.ibQzMax(W, c, k), x = S.ibCrit(c).find(y => y.k === k);
            return <div class="ibqrow" data-ibqk={k}><span><b data-raw>{k}</b> <span data-raw>{x.name}</span> <span class="mute">{t('paper.qb_lv_of', { n: fmtNum(max) })}</span></span>
              <div class="qbwrow">{Array.from({ length: S.IB_TOP }, (_, i) => <label class="qbw"><b>{i + 1}</b><HeldInput class="input sm" type="number" min="0.5" step="0.5" value={tb[i] != null ? String(tb[i]) : ''} aria-label={t('paper.qb_lv_cell', { n: i + 1, k })}
                onChange={e => { const v = e.currentTarget.value.trim() === '' ? null : Math.round(+e.currentTarget.value * 2) / 2; W.lvb ||= {}; const a = W.lvb[k] = Z.ibQzRaw(W, k) || Array(S.IB_TOP).fill(null); a[i] = v != null && v > 0 && v <= 1000 ? v : null; re(); }} data-ibql={i} /></label>)}</div>
              <span><button type="button" class="link" onClick={() => { (W.lvb ||= {})[k] = Z.ibQzEven(max); re(); }} data-ibqeven={k}>{t('paper.qb_lv_even')}</button> <button type="button" class="link" onClick={() => { if (W.lvb) delete W.lvb[k]; re(); }} data-ibqclear={k}>{t('paper.qb_lv_clear')}</button> <span class="mute" data-ibqsay>{lvNote(k)}</span></span></div>; })}</div>}
        {tops.length > 0 && <div class="qbwords" data-qbwords><p><b>{t('paper.qb_words_h')}</b> <span class="mute">{t('paper.qb_words_sub')}</span></p>
          {tops.map(top => { const w = W.words[String(top)] && W.words[String(top)].length === Z.qzSteps(top).length ? W.words[String(top)] : Z.qzStepWords(top, W.words);
            return <div class="qbwrow"><span class="mute">{t('paper.qb_words_row', { n: fmtNum(top) })}</span>{Z.qzSteps(top).map((s2, k) => <label class="qbw"><b>{fmtNum(s2)}</b><input class="input sm" value={w[k] || ''} placeholder="—" maxLength={30} aria-label={t('paper.qb_words_cell', { s: fmtNum(s2), n: fmtNum(top) })}
              onInput={e => { const a = W.words[String(top)] ||= Z.qzStepWords(top, W.words); a[k] = e.currentTarget.value.trim().slice(0, 30); }} data-qword={top + ':' + k} data-raw /></label>)}</div>; })}</div>}
        {q && <div class="qbspot" data-qbspot><b>{t('paper.qb_mark_of', { q: Z.quizLabel(q, W.qs.indexOf(q)) })}</b><Button size="sm" onClick={() => setMode(mode === 'spot' ? null : 'spot')} data-spot>{mode === 'spot' ? t('paper.qb_click') : t('paper.qb_spot')}</Button>
          {q.mx != null ? <button type="button" class="link" onClick={() => { delete q.mx; delete q.my; re(); }} data-margin>{t('paper.qb_margin_back')}</button> : <span class="mute">{t('paper.qb_margin')}</span>}</div>}
        {q && W.ans !== 'off' && String(q.key || '').trim() && <div class="qbspot"><b>{t('paper.qb_line')}</b><span class="mute">{q.nx != null ? t('paper.qb_line_pin') : t('paper.qb_line_at', { at: atWord(W.at) })}</span>
          {q.nx != null && <button type="button" class="link" onClick={() => { delete q.nx; delete q.ny; re(); }} data-ansdef>{t('paper.qb_line_back', { at: atWord(W.at) })}</button>}</div>}
        <div class="qbopt">
          <div class="qbo"><span>{t('paper.qb_new_how')}</span>{row(t('paper.qb_new_how'), W.how, HOW(), v => { W.how = v; }, 'how')}</div>
          <div class="qbo"><span>{t('paper.qb_side')}</span>{row(t('paper.qb_side'), W.side || 'left', [['left', t('paper.qb_side_left')], ['right', t('paper.qb_side_right')]], v => { W.side = v; }, 'side')}<span class="mute">{t('paper.qb_side_sub')}</span></div>
          <div class="qbo"><span>{t('paper.qb_ans')}</span>{row(t('paper.qb_ans'), W.ans, ANS(), v => { W.ans = v; }, 'ans')}
            <span class="qbanssay"><span class="qzgold">{t('paper.qm_answer')}</span><span class="mute">{t(W.ans === 'off' ? 'paper.qb_ans_say_off' : W.ans === 'all' ? 'paper.qb_ans_say_all' : 'paper.qb_ans_say_miss')}</span></span></div>
          {W.ans !== 'off' && <div class="qbo"><span>{t('paper.qb_at')}</span>{row(t('paper.qb_at'), W.at, AT(), v => { W.at = v; }, 'at')}<span class="mute">{t('paper.qb_at_sub')}</span>
            {moved > 0 && <button type="button" class="link" onClick={() => setAnsBack(v => !v)} data-ansback>{ansBack ? t('paper.qb_keep_moved') : t('paper.qb_put_back', { n: moved })}</button>}
            {moved > 0 && ansBack && <span class="mute">{t('paper.qb_back_say')}</span>}</div>}
          <div class="qbo"><span>{t('paper.qb_total')}</span><Button size="sm" onClick={() => setMode(mode === 'total' ? null : 'total')} data-qbtotal>{mode === 'total' ? t('paper.qb_click') : W.total ? t('paper.qb_total_move') : t('paper.qb_total_pick')}</Button>
            <span class="mute">{W.total ? t(c ? 'paper.qb_total_lv_at' : 'paper.qb_total_at', { n: W.total.n + 1 }) : t(c ? 'paper.qb_total_lv_opt' : 'paper.qb_total_opt')}</span>
            {W.total && mode !== 'total' && <button type="button" class="link" onClick={() => { W.total = null; re(); }} data-nototal>{t('paper.qb_no_total')}</button>}</div>
          <p class="mute">{t('paper.qb_keys')}</p></div>
      </div>
    </div>
    <footer><span class="mute grow" data-qbsum>{W.qs.length ? t(W.qs.length === 1 ? 'paper.qb_sum1' : 'paper.qb_sum', { n: W.qs.length, pts: fmtNum(sum) }) : t('paper.qb_none')}</span>
      <Button onClick={close} data-qbcancel>{t('paper.qb_cancel')}</Button><Button variant="primary" disabled={busy} onClick={save} data-qbsave>{t('paper.qb_save')}</Button></footer>
  </dialog>
  {gbox && h(gbox, { lib: state().lib, onClose: goalsBack })}</>;
}
