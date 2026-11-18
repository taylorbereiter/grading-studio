// Hide names while marking, and Check the covers (src/app/anon.js setAnon, openAnon; src/app/claude.js checkCovers). Papers show as
// Paper 1, Paper 2… in a shuffled order and the names on them are covered; scores still go to the right student. In Check the covers
// she goes through every paper drawn the way the covers leave it, drags a box over a name (or takes off one the name search put on),
// uses her last box on every paper, and says each paper looks right. The order, her boxes, the covers she took off and which papers she
// has looked at are the current app's own records (batch.anon, batch.share), kept by the lifted code (engines/gnames.js) and saved by
// the marking screen, so the current app opens the same. Loaded on its own (router.js PARTS.covers).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, Dialog, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { state, pdfjsLib } from '../../engines/gcore.js';
import { coverRx, fileByPath, vpRot, viewBytes, anonOrder } from '../../engines/gdraw.js';
import * as X from '../../engines/gexport.js';
import * as N from '../../engines/gnames.js';
import { libs } from './paper.js';
import './paper-lines.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ctrl = /Mac|iP(hone|ad)/.test(navigator.platform || '') ? '⌘Z' : 'Ctrl+Z';

// ctx: { M: the marking code, open: show student i }
export function setAnon(on, ctx) {
  const b = state().batch;
  if (on && !(b.anon && b.anon.order && b.anon.order.length)) N.anonShuffle();
  b.anon = b.anon || { on: false, order: [] }; b.anon.on = on;
  ctx.M.changedNow();
  if (on) ctx.open(anonOrder()[0]);
  ctx.reopen();
  toast(t(on ? 'paper.hn_on' : 'paper.hn_off'));
}
export function shuffle(ctx) { N.anonShuffle(); ctx.M.changedNow(); ctx.open(anonOrder()[0]); toast(t('paper.hn_shuffled')); }
// The covers on a page of the open paper while names are hidden: typed names found (when finding names is on), Kami boxes with names,
// and her own boxes (src/app/anon.js anonCovers). paper.js asks before it draws the page, so a name never shows.
export async function pageCovers(pg) { return N.anonCovers(state().batch.students[state().cur], pg); }

function countLine(all) {
  if (N.stillCounting()) return t('paper.hn_counting');
  const list = N.coverList(all), n = list.filter(x => N.coverOk(x.st, x.d)).length;
  return list.length ? t('paper.hn_checked', { n, of: list.length }) : t('paper.hn_no_pdf');
}

// The switch's dialog: what hiding names does, how many papers have had their covers looked at, Word papers that would show names,
// and the papers the name search doubts (when finding names is on).
export function AnonDialog({ ctx, onClose, onCheck }) {
  const [, tick] = useState(0), b = state().batch;
  useEffect(() => { let live = true; (async () => { await libs(); await N.ensureCounts(); if (live) tick(n => n + 1); await N.findNames(); if (live) tick(n => n + 1); })(); return () => { live = false; }; }, []);
  const seen = !!(b.anon && b.anon.order && b.anon.order.length), off = !X.nameFindOn();
  const words = b.students.flatMap((st, i) => st.files.filter(f => off ? !f.virtual && f.kind === 'docx' : N.wordNoName(st, f)).map(f => ({ st, i, f })));
  const flags = N.namesLooking() ? null : N.nameFlagged(true);
  const start = again => { if (again) N.anonShuffle(); onClose(); setAnon(true, ctx); };
  return <Dialog open title={t('paper.hn_title')} onClose={onClose} actions={<>
    <Button onClick={() => onCheck(N.coverFirst(true))} data-hncheck>{t('paper.hn_check')}</Button><span class="grow" />
    {seen && <Button onClick={() => start(true)} data-hnshuf>{t('paper.hn_shuf_start')}</Button>}
    <Button variant="primary" onClick={() => start(false)} data-hnstart>{t('paper.hn_start')}</Button></>}>
    <div class="mk-hn">
      <p>{t('paper.hn_p1')}</p>
      <p><b>{t('paper.hn_cover_h')}</b> {t('paper.hn_cover')} <span data-hncount>{countLine(true)}</span></p>
      {words.length > 0 && <div class="mk-warn" data-hnword><b>{off ? t('paper.hn_word_off', { n: words.length }) : t('paper.hn_word_on', { n: words.length })}</b> {t('paper.hn_word_turn', { n: words.length })}
        <ul>{words.map(x => <li><button type="button" class="link" onClick={() => { onClose(); ctx.open(x.i); }} data-raw>{x.st.key}</button> <span data-raw>{x.f.name}</span></li>)}</ul></div>}
      {!off && (flags == null ? <p class="mute">{t('paper.hn_looking')}</p> : flags.length > 0 && <div class="mk-warn" data-hnflags><b>{t('paper.hn_flags', { n: flags.length })}</b>
        <ul>{flags.map(x => <li><button type="button" class="link" onClick={() => onCheck(x.i)} data-raw>{N.coverName(x.st, x.k)}</button> {x.say}</li>)}</ul></div>)}
    </div>
  </Dialog>;
}

// Check the covers: every paper, drawn as the covers leave it. all: every paper (hiding names), not only the ones that go to an assistant.
export function CheckCovers({ ctx, start = 0, all = true, onDone }) {
  const [list, setList] = useState(null), [pos, setPos] = useState(0), [find, setFind] = useState(''), [only, setOnly] = useState('all'), [, tick] = useState(0);
  const body = useRef(null), undo = useRef([]), last = useRef(null), drawn = useRef(-1), token = useRef(0), now = useRef({});
  const redo = () => tick(n => n + 1);
  useEffect(() => { let live = true; (async () => {
    await libs(); await N.ensureCounts(); await X.classCommon();
    const l = N.coverList(all); if (!live) return;
    if (!l.length) { toast(t('paper.cc_none')); return onDone(); }
    setList(l); setPos(Math.min(start || 0, l.length - 1));
    N.findNames().then(() => { if (live) redo(); });
  })(); return () => { live = false; }; }, []);
  const save = () => ctx.M.changedNow();
  const finish = () => { save(); onDone(); };
  const flagOf = x => N.coverOk(x.st, x.d) ? '' : N.nameFlag(x.st, x.d);
  const shown = () => { const q = find.trim().toLowerCase(); return list.map((x, i) => i).filter(i => (only === 'all' || (only === 'todo' ? !N.coverOk(list[i].st, list[i].d) : !!flagOf(list[i]))) && (!q || N.coverName(list[i].st, list[i].k).toLowerCase().includes(q))); };
  const go = d => { const p = pos + d; if (p >= list.length) { toast(t('paper.cc_last')); return finish(); } setPos(Math.max(0, p)); };
  const looked = () => {
    if (drawn.current !== token.current) return toast(t('paper.cc_drawing'));
    N.coverMark(list[pos].st, list[pos].d, true); save();
    const n = list.findIndex((x, i) => i > pos && !N.coverOk(x.st, x.d));
    if (n >= 0) return setPos(n);
    toast(t(list.every(x => N.coverOk(x.st, x.d)) ? 'paper.cc_all_done' : 'paper.cc_last')); finish();
  };
  const step = dd => { const vis = shown(); if (!vis.length) return; const at = vis.indexOf(pos), to = at === -1 ? vis.find(i => dd > 0 ? i > pos : pos > i) : vis[at + dd]; if (to != null && to !== pos) setPos(to); };
  const takeBack = () => {
    const u = undo.current.pop(); if (!u) return toast(t('paper.cc_nothing'));
    const sh = N.shareState(), offs = (sh.off ||= {});
    if (u.off === 'took') { const l = offs[u.k] || [], at = l.lastIndexOf(u.b); if (at >= 0) l.splice(at, 1); if (!l.length) delete offs[u.k]; }
    else if (u.off === 'gave') (offs[u.k] ||= []).push(u.b);
    else { const arr = sh.boxes[u.k] || [], at = arr.lastIndexOf(u.b); if (at >= 0) arr.splice(at, 1); }
    N.coverMark(list[u.i].st, list[u.i].d, false); save();
    if (u.i === pos) { token.current++; redo(); draw(); } else setPos(u.i);
  };
  const every = () => {
    const L = last.current; if (!L) return;
    let n = 0;
    for (const { d } of list) {
      const at = L.first ? d.pages[0] : d.pages.find(([, p]) => p === L.p); if (!at) continue;
      const sh = N.shareState(), k = N.boxKey(at[0], at[1]), arr = sh.boxes[k] || (sh.boxes[k] = []);
      if (!arr.some(b => b.join() === L.b.join())) { arr.push(L.b.slice()); n++; N.coverAgain(at[0], at[1]); }
    }
    save(); toast(t('paper.cc_every_done', { n })); draw();
  };
  now.current = { list, pos, find, go, looked, step, takeBack, finish, shown, setFind, setPos };
  // the keys: up and down through the papers as listed, left and right a paper back or on, Enter says it looks right, Ctrl Z takes back the last box, Esc finishes
  useEffect(() => {
    const key = e => {
      const c = now.current; if (!c.list) return;
      const typing = e.target && e.target.hasAttribute && e.target.hasAttribute('data-ccfind'), stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (e.key === 'Escape' && typing && c.find) { stop(); c.setFind(''); }
      else if (e.key === 'Escape') { stop(); c.finish(); }
      else if (typing && e.key === 'Enter') { stop(); const vis = c.shown(); if (vis.length) c.setPos(vis[0]); }
      else if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      else if (!typing && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { stop(); c.takeBack(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { stop(); c.step(e.key === 'ArrowUp' ? -1 : 1); }
      else if (e.key === 'ArrowLeft') { stop(); c.go(-1); }
      else if (e.key === 'ArrowRight') { stop(); c.go(1); }
      else if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button'))) { stop(); c.looked(); }
    };
    addEventListener('keydown', key, true); return () => removeEventListener('keydown', key, true);
  }, []);
  // the pages of this paper, with the covers drawn in; drag for a box, click a box to take it off
  const draw = async () => {
    const host = body.current; if (!host || !list) return;
    const my = ++token.current, { st, d } = list[pos], rx = coverRx(st);
    host.replaceChildren(); host.scrollTop = 0;
    const js = new Map();
    try {
      for (const [path, p] of d.pages) {
        if (my !== token.current) break;
        const f = fileByPath(st, path);
        if (!js.has(path)) js.set(path, await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise);
        const avail = host.clientWidth - 40, dpr = window.devicePixelRatio || 1;
        const pg0 = await js.get(path).getPage(p + 1), v1 = vpRot(f, p, pg0, 1), kk = Math.min(1.6, avail / (v1.width * 1.4));
        const r = await X.sharePage(st, f, js.get(path), p, kk * dpr, rx, X.shareOpts(st));
        if (my !== token.current) break;
        const c = r.c, g = c.getContext('2d');
        c.dataset.ccpage = p; c.className = 'cc-page';
        Object.assign(c.style, { width: (r.W + r.side) * kk + 'px', height: r.H * kk + 'px' });
        if (r.gone.length) { g.save(); g.setTransform(kk * dpr, 0, 0, kk * dpr, 0, 0); g.strokeStyle = '#1F6FB2'; g.lineWidth = 1.5 / kk; g.setLineDash([5 / kk, 3 / kk]); for (const q of r.gone) g.strokeRect(q.x, q.y, q.w, q.h); g.restore(); }
        const base = g.getImageData(0, 0, c.width, c.height);
        const inside = (x, y, q) => x >= q.x - 2 && x <= q.x + q.w + 2 && y >= q.y - 2 && y <= q.y + q.h + 2;
        const autoAt = (x, y) => r.covers.filter(q => !q.own && inside(x, y, q)).sort((a, z) => a.w * a.h - z.w * z.h)[0];
        const goneAt = (x, y) => r.gone.find(q => inside(x, y, q));
        const fracOf = q => [q.x / r.W, q.y / r.H, q.w / r.W, q.h / r.H].map(v => Math.round(v * 10000) / 10000);
        const k = N.boxKey(path, p), own = () => N.shareState().boxes[k] || (N.shareState().boxes[k] = []);
        const fr = e => { const bb = c.getBoundingClientRect(); return [(e.clientX - bb.left) / kk, (e.clientY - bb.top) / kk]; };
        let d0 = null, sel = null;
        const paint = () => { g.putImageData(base, 0, 0); if (sel) { g.save(); g.setTransform(kk * dpr, 0, 0, kk * dpr, 0, 0); g.fillStyle = 'rgba(17,17,17,.75)'; g.fillRect(sel.x, sel.y, sel.w, sel.h); g.restore(); } };
        const onOwn = (x, y) => own().findIndex(q => x >= q[0] * r.W && x <= (q[0] + q[2]) * r.W && y >= q[1] * r.H && y <= (q[1] + q[3]) * r.H);
        c.onpointerdown = e => { e.preventDefault(); c.setPointerCapture(e.pointerId); d0 = fr(e); sel = null; };
        c.onpointermove = e => {
          const [x, y] = fr(e);
          if (!d0) { c.style.cursor = onOwn(x, y) >= 0 || autoAt(x, y) || goneAt(x, y) ? 'pointer' : 'crosshair'; return; }
          sel = { x: Math.min(x, d0[0]), y: Math.min(y, d0[1]), w: Math.abs(x - d0[0]), h: Math.abs(y - d0[1]) }; paint();
        };
        c.onpointerup = () => {
          if (!d0) return; const s0 = d0; d0 = null;
          if (!sel || sel.w < 4 || sel.h < 3) {
            sel = null; paint();
            const [x, y] = s0, hit = onOwn(x, y);
            if (hit >= 0) { own().splice(hit, 1); N.coverMark(st, d, false); save(); return draw(); }
            const offs = (N.shareState().off ||= {}), a = autoAt(x, y);
            if (a) { const bx = fracOf(a); (offs[k] ||= []).push(bx); undo.current.push({ k, b: bx, i: pos, off: 'took' }); N.coverMark(st, d, false); save(); toast(t('paper.cc_took', { key: ctrl })); return draw(); }
            const gq = goneAt(x, y);
            if (gq) { const l = offs[k] || [], at = l.findIndex(bx => N.sameSpot(gq, bx, r.W, r.H)); if (at >= 0) { const [bx] = l.splice(at, 1); if (!l.length) delete offs[k]; undo.current.push({ k, b: bx, i: pos, off: 'gave' }); } N.coverMark(st, d, false); save(); return draw(); }
            return;
          }
          const fx = v => Math.round(v * 10000) / 10000;
          const bx = [fx(clamp(sel.x / r.W, 0, 1)), fx(clamp(sel.y / r.H, 0, 1)), fx(Math.min(sel.w / r.W, 1)), fx(Math.min(sel.h / r.H, 1))];
          own().push(bx); undo.current.push({ k, b: bx, i: pos }); last.current = { b: bx, first: d.pages[0][0] === path && d.pages[0][1] === p, p };
          N.coverMark(st, d, false); save(); redo(); draw();
        };
        host.appendChild(c);
        pg0.cleanup();
      }
    } catch (er) {
      console.error(er);
      if (my === token.current) { const m = document.createElement('p'); m.className = 'mute cc-bad'; m.textContent = t('paper.cc_cant'); host.appendChild(m); }
    } finally { if (my === token.current) { drawn.current = my; redo(); } for (const v of js.values()) v.destroy(); }
  };
  useEffect(() => { if (list) draw(); }, [list, pos]);
  if (!list) return <Dialog open title={t('paper.cc_title')} onClose={onDone}><div class="loading" aria-busy="true" /></Dialog>;
  const x = list[pos], ok = list.map(y => N.coverOk(y.st, y.d)), nOk = ok.filter(Boolean).length, flags = list.map(flagOf), nf = flags.filter(Boolean).length;
  const vis = shown(), segs = { all: t('paper.cc_all', { n: list.length }), todo: t('paper.cc_todo', { n: list.length - nOk }), flag: t('paper.cc_flagged', { n: nf }) };
  const boxes = d => d.pages.reduce((n, [path, p]) => n + ((N.shareState().boxes[N.boxKey(path, p)] || []).length), 0);
  return <Dialog open title={N.coverName(x.st, x.k)} onClose={finish} actions={<>
    <span class="mute cc-hint">{t('paper.cc_hint', { key: ctrl })}</span><span class="grow" />
    {last.current && <Button onClick={every} data-ccevery>{t('paper.cc_every')}</Button>}
    <Button onClick={() => go(-1)} disabled={pos === 0} data-ccback>{t('paper.cc_back')}</Button>
    <Button variant="primary" onClick={looked} data-ccnext>{t(pos === list.length - 1 ? 'paper.cc_right_done' : 'paper.cc_right')}</Button></>}>
    <div class="mk-cc" data-cc>
      <div class="cc-top"><span class={ok[pos] ? 'cc-state' : 'cc-state stag'} data-ccstate>{t(ok[pos] ? 'paper.cc_ok' : 'paper.cc_not')}</span>
        {ok[pos] && <button type="button" class="link" onClick={() => { N.coverMark(x.st, x.d, false); save(); redo(); }} data-ccundo>{t('paper.cc_unmark')}</button>}
        {flags[pos] && <span class="stag">{flags[pos]}</span>}
        <span class="grow" /><span class="mute">{t('paper.cc_count', { n: pos + 1, of: list.length })}</span></div>
      <div class="cc-mid">
        <aside class="cc-side" aria-label={t('paper.cc_papers')}>
          <b>{t('paper.cc_prog', { n: nOk, of: list.length })}</b><div class="cc-bar"><i style={{ width: (100 * nOk / list.length) + '%' }} /></div>
          <input type="search" class="input" placeholder={t('paper.cc_find')} aria-label={t('paper.cc_find')} value={find} onInput={e => setFind(e.currentTarget.value)} autocomplete="off" data-ccfind />
          <span class="cc-seg" role="group">{['all', 'todo', 'flag'].filter(k => k !== 'flag' || nf).map(k => <button type="button" class="chip" aria-pressed={only === k ? 'true' : 'false'} onClick={() => setOnly(k)} data-ccf={k}>{segs[k]}</button>)}</span>
          <ul class="cc-rows">{vis.length ? vis.map(i => { const y = list[i], nb = boxes(y.d);
            return <li><button type="button" aria-current={i === pos ? 'true' : undefined} onClick={() => setPos(i)} data-ccgo={i}>
              <span class={'cc-ic' + (ok[i] ? ' done' : flags[i] ? ' flag' : '')} aria-hidden="true">{ok[i] ? '✓' : flags[i] ? '!' : ''}</span>
              <span class="cc-nm"><span data-raw>{N.coverName(y.st, y.k)}</span>{nb > 0 && <span class="pill">{t('paper.cc_boxes', { n: nb })}</span>}{flags[i] && <small>{flags[i]}</small>}
                <span class="sr">{t(ok[i] ? 'paper.cc_sr_ok' : 'paper.cc_sr_not')}</span></span></button></li>; })
            : <li class="mute">{find.trim() ? t('paper.cc_no_match', { q: find.trim() }) : only === 'todo' ? t('paper.cc_all_done') : t('paper.cc_nothing_show')}</li>}</ul>
          {nOk === list.length && <p class="ok">{t('paper.cc_every_checked')}</p>}
        </aside>
        <div class="cc-body" ref={body} />
      </div>
    </div>
  </Dialog>;
}
