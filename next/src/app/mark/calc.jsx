// The calculator on the marking screen (src/app/calc.js openCalc): a small window that floats over the paper, opened from the score
// panel or with =. It reads sums with the current app's own reader (engines/gcalc.js calcEval, no eval), has Score to percent on her
// grading scale, Average, and History (gs.calchist), and stays where she drags it (gs.calcpos). While it is open, numbers and
// + − × ÷ ( ) type straight into it, even after a click on the paper. Use as score puts the answer in the points box; Score sticker
// puts it on the paper where she clicks next. Loaded on its own (router.js PARTS.calc).
import { h, Fragment } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { IconButton, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { calcEval, calcFmt, calcKeyOf, stickerText } from '../../engines/gcalc.js';
import { maxPoints, percentFor, roundPct, state } from '../../engines/gcore.js';
import { prefs } from '../../students/prefs.js';
import './lines.js';
import './paper-lines.js';

const KEYS = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='];
const KEY_LINE = { C: () => t('paper.ca_clear'), '⌫': () => t('paper.ca_back') };   // the others are signs and digits, not words

export function Calculator({ M, onClose }) {
  const inp = useRef(null), box = useRef(null);
  const [src, setSrc] = useState(''), [hist, setHist] = useState(() => { const h0 = prefs.get('gs.calchist', []); return Array.isArray(h0) ? h0 : []; });
  const max = maxPoints(), [pts, setPts] = useState(''), [of, setOf] = useState(max ? String(max) : ''), [avg, setAvg] = useState('');
  let v = null, bad = false; try { v = calcEval(src); } catch { bad = !!src.trim(); }
  const keep = h => { setHist(h); prefs.set('gs.calchist', h); };
  const done = () => { const e = (inp.current ? inp.current.value : src).trim(); let v = null; try { v = calcEval(e); } catch {} if (v == null) return; const a = calcFmt(v); if (e !== a) keep([{ e, v: a }, ...hist].slice(0, 12)); setSrc(a); requestAnimationFrame(() => inp.current && inp.current.select()); };
  // a sign right after an answer carries on from it; a number starts over
  const typeIn = c => { const el = inp.current; if (!el) return; el.focus();
    const all = el.value && el.selectionStart === 0 && el.selectionEnd === el.value.length;
    if (all && /^[+\-*/^%)]$/.test(c)) el.setSelectionRange(el.value.length, el.value.length);
    el.setRangeText(c, el.selectionStart, el.selectionEnd, 'end'); setSrc(el.value); };
  // numbers and signs go into it while it is open, wherever the focus is (not / which finds a student, and not a box she is typing in)
  // the key listener stays put and reads the newest render through this, so a key right after another never sees the sum before it
  const now = useRef(null); now.current = { done, typeIn, onClose };
  // listening from the moment it goes into the page (a layout effect), so a key pressed as it appears is not lost
  useLayoutEffect(() => {
    const key = e => { const { done, typeIn, onClose } = now.current;
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === '/') return;
      const a = document.activeElement, mine = box.current && box.current.contains(a);
      if (!mine && a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
      const k = calcKeyOf(e); if (!k) return;
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (k === '=' && !(e.key === 'Enter' || e.code === 'Equal' || e.code === 'NumpadEqual' || e.code === 'NumpadEnter')) return;
      e.preventDefault(); e.stopPropagation();
      if (k === '=') done(); else { if (!mine && inp.current) inp.current.setSelectionRange(inp.current.value.length, inp.current.value.length); typeIn(k); }
    };
    addEventListener('keydown', key, true); return () => removeEventListener('keydown', key, true);
  }, []);
  useEffect(() => { const p = prefs.get('gs.calcpos', null), el = box.current; if (p && el) { el.style.left = Math.max(0, Math.min(innerWidth - 60, p.x)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 40, p.y)) + 'px'; el.style.right = 'auto'; } if (inp.current) inp.current.focus(); }, []);
  const drag = e => {
    if (e.target.closest('button')) return;
    const el = box.current, r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => { el.style.left = Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; el.style.right = 'auto'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); prefs.set('gs.calcpos', { x: parseInt(el.style.left), y: parseInt(el.style.top) }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  const press = c => { if (c === 'C') setSrc(''); else if (c === '⌫') setSrc(s => s.slice(0, -1)); else if (c === '=') done(); else setSrc(s => s + c); if (inp.current) inp.current.focus(); };
  const points = state().setup.mode !== 'rubric', paper = state().pages.length > 0;
  const use = () => { if (v == null) return; M.setPoints(calcFmt(v)); M.leftPoints(); toast(t('paper.ca_used', { n: calcFmt(v) })); };
  const stick = () => { if (v == null) return; const a = v; done(); if (points) { M.setPoints(calcFmt(a)); M.leftPoints(); } if (M.stampText(stickerText(a))) toast(t('mark.stamp_where')); };
  const lab = v == null ? null : stickerText(v);
  const pctSay = () => { if (pts === '' || !+of) return t('paper.ca_pct_none'); const straight = +pts / +of * 100, scaled = +of === max ? percentFor(+pts) : null;
    return scaled != null ? t('paper.ca_pct_scale', { p: scaled, s: calcFmt(straight) }) : t('paper.ca_pct_plain', { p: roundPct(straight), s: calcFmt(straight) }); };
  const ns = (avg.match(/-?\d+(\.\d+)?/g) || []).map(Number), sum = ns.reduce((a, b) => a + b, 0);
  return <div ref={box} class="mk-calc" role="dialog" aria-label={t('paper.ca_title')} data-calc>
    <div class="cph" onPointerDown={drag}><b>{t('paper.ca_title')}</b><span class="grow" /><IconButton icon="x" size="sm" label={t('paper.ca_close')} onClick={onClose} /></div>
    <input ref={inp} class="input" value={src} autocomplete="off" spellcheck={false} placeholder={t('paper.ca_ph')} aria-label={t('paper.ca_sum')} data-calcin
      onInput={e => setSrc(e.currentTarget.value)} />
    <div class="cpo" aria-live="polite" data-calcout>{bad ? '…' : v == null ? '0' : <>= <b>{calcFmt(v)}</b></>}
      {v != null && points && <button type="button" class="link" onClick={use} title={t('paper.ca_use_tip')} data-calcuse>{t('paper.ca_use')}</button>}
      {v != null && paper && <button type="button" class="link" onClick={stick} title={t('paper.ca_stick_tip')} data-calcstick>{t('paper.ca_stick')}</button>}</div>
    {lab && paper && <div class="mute cps">{t('paper.ca_sticker', { s: lab.replace('/', ' / ').replace(' = ', ' · ') })}</div>}
    <div class="cpk">{KEYS.map(k => <button type="button" class={k === '=' ? 'eq' : /[÷×−+]/.test(k) ? 'op' : ''} aria-label={KEY_LINE[k] ? KEY_LINE[k]() : undefined} onClick={() => press(k)} data-ck={k}>{k}</button>)}</div>
    <div class="cpsec"><div class="dl">{t('paper.ca_pct_h')}</div>
      <div class="cprow"><input class="input" type="number" step="0.5" min="0" value={pts} placeholder={t('paper.ca_score')} aria-label={t('paper.ca_score')} onInput={e => setPts(e.currentTarget.value)} data-calcpts />
        <span>{t('paper.ca_out_of')}</span><input class="input" type="number" step="0.5" min="0" value={of} aria-label={t('paper.ca_out_of')} onInput={e => setOf(e.currentTarget.value)} /></div>
      <div class="mute" data-calcpct>{pctSay()}</div></div>
    <div class="cpsec"><div class="dl">{t('paper.ca_avg_h')}</div>
      <input class="input" value={avg} placeholder={t('paper.ca_avg_ph')} aria-label={t('paper.ca_avg_h')} autocomplete="off" onInput={e => setAvg(e.currentTarget.value)} data-calcavg />
      {ns.length > 0 && <div class="mute" data-calcavgout>{t('paper.ca_avg_say', { a: calcFmt(sum / ns.length), s: calcFmt(sum), n: ns.length })}</div>}</div>
    <div class="cpsec"><div class="dl">{t('paper.ca_hist_h')}</div>
      {hist.length ? <>{hist.map(x => <button type="button" class="cphi" onClick={() => { setSrc(x.v); if (inp.current) inp.current.focus(); }}><span data-raw>{x.e}</span><b>{x.v}</b></button>)}
        <button type="button" class="link" onClick={() => keep([])} data-calcclear>{t('paper.ca_hist_clear')}</button></> : <p class="mute">{t('paper.ca_hist_none')}</p>}</div>
  </div>;
}
