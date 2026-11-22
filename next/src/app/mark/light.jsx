// Lighting for washed-out scans (src/app/lighting.js): brightness, contrast, darker writing, sharpen and black and white, for the whole
// download or one student, Auto fix, the rubric left alone or fixed too, and Use in the export. Each page then has a ☀ in its corner to
// turn lighting off or on there (Shift for every page in between), and ▾ for that page's own lighting, the rest of the file, the whole
// file, or the same page on every paper. The student's file isn't changed. Every choice is one undo step, a slider drag one step (the
// current app's lightSnap). Drawing is the current app's (engines/gdraw.js lightBmp). Loaded with the file tools (mark/fileui.jsx).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Checkbox, Segmented, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import * as D from '../../engines/gdraw.js';
import { fieldSnap } from '../../engines/gmark.js';
import { t } from '../../i18n/t.js';
import { libs } from './paper.js';
import * as C from './change.js';
import './lines.js';
import './setup-lines.js';

const KEYS = ['light', 'lightOpt', 'lightPg', 'lightPgL'];
const b = () => state().batch, st0 = () => b() && b().students[state().cur];
const heard = new Set(), emit = () => heard.forEach(f => f());
function useLight() { const [, n] = useState(0); useEffect(() => { const f = () => n(k => k + 1); heard.add(f); return () => heard.delete(f); }, []); }
let raf = 0;
// lightApply: every page drawn again, the chips, and a save.
export const lightApply = () => apply();
function apply() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { for (const pg of state().pages) D.draw(pg); C.changed(); emit(); }); }
const snap = join => { if (b()) fieldSnap(b(), KEYS, apply, 'lighting', join); };
const ROWS = [['b', 'setup.l_b', -60, 60], ['c', 'setup.l_c', 0, 400], ['d', 'setup.l_d', 0, 100], ['s', 'setup.l_s', 0, 100]];
function Sliders({ L, onSet, tag }) {
  return <>{ROWS.map(([k, label, min, max]) => <label class="mk-lsl"><span>{t(label)}</span>
    <input type="range" min={min} max={max} step="1" value={L[k] || 0} onInput={e => onSet({ ...L, [k]: +e.currentTarget.value }, tag + k)} data-l={k} /><b>{L[k] || 0}</b></label>)}
    <Checkbox checked={!!L.g} onChange={v => onSet({ ...L, g: v ? 1 : 0 })} label={t('setup.l_g')} /></>;
}

// The Lighting panel (openLight). It stays beside the paper, so she sees what she sets.
export function LightPanel({ onClose }) {
  useLight();
  const box = useRef(null), bb = b(), st = st0();
  useEffect(() => { if (box.current) box.current.focus({ preventScroll: true }); }, []);
  // Escape closes it also when nothing else would take it (src/polish.js): the keyboard on nothing, no mark picked, no box open (A-108).
  // The paper counts as nothing: here it takes the focus when clicked, or back after a tool closes, where the current app's page has none.
  const shut = useRef(onClose); shut.current = onClose;
  useEffect(() => { const k = e => { const a = document.activeElement, free = !a || a === document.body || a.classList.contains('mk-paper');
    if (e.key !== 'Escape' || !free || state().selected || document.querySelector('dialog[open]')) return; e.preventDefault(); e.stopPropagation(); shut.current(); };
    addEventListener('keydown', k, true); return () => removeEventListener('keydown', k, true); }, []);
  if (!bb || !st) return null;
  const L = D.lightFor(st), o = D.lightOpts(), only = D.lightKey(st) !== '*', name = D.shownName(st, state().cur);
  const set = (v, join) => { snap(join); bb.light ||= {}; if (only) bb.light[st.key] = v; else bb.light['*'] = v; apply(); };
  const opt = (k, v) => { snap(); bb.lightOpt = { ...D.lightOpts(), [k]: v }; apply(); };
  const offs = Object.entries(bb.lightPg || {}).filter(([, v]) => v === false).map(([k]) => k), offHere = offs.filter(k => k.startsWith(st.key + '|')).length;
  const owns = Object.keys(bb.lightPgL || {}), ownHere = owns.filter(k => k.startsWith(st.key + '|')).length;
  const auto = () => { const pg = state().pages.find(q => q.bmp && q.file.kind !== 'docx'); if (!pg) return toast(t('setup.l_no_scan')); set({ ...D.lightAuto(pg), s: L.s || 0, g: L.g || 0 }); };
  const who = v => { const want = v === 'one'; snap(); if (want && !only) { bb.light ||= {}; bb.light[st.key] = { ...D.lightFor(st) }; } if (!want && only) delete bb.light[st.key]; apply(); };
  return <div class="mk-light" role="dialog" aria-label={t('mark.l_title')} tabindex="-1" ref={box} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <div class="lph"><b>{t('mark.l_title')}</b><span class="grow" />
      <button type="button" class="mk-switch" role="switch" aria-checked={o.on ? 'true' : 'false'} onClick={() => opt('on', !o.on)} data-lon><i />{t(o.on ? 'setup.l_on' : 'setup.l_off')}</button>
      <IconButton icon="x" size="sm" label={t('mark.close')} onClick={onClose} data-lx /></div>
    <div class={'lpbody' + (o.on ? '' : ' off')}>
      <Button variant="primary" size="sm" onClick={auto} data-lauto>{t('setup.l_auto')}</Button>
      <Sliders L={L} onSet={set} tag="panel" />
      <Segmented label={t('setup.l_who')} value={only ? 'one' : 'all'} onChange={who} options={[{ value: 'all', label: t('setup.l_all') }, { value: 'one', label: t('setup.l_only', { name }) }]} />
      <div><button type="button" class="link" onClick={() => { set({ ...D.LIGHT0 }); if (only) { delete bb.light[st.key]; apply(); } }} data-lreset>{t('setup.l_reset')}</button></div>
      <div class="lpsec"><h3>{t('setup.l_pages')}</h3><p class="mute">{t('setup.l_pages_text')}</p>
        <span>{t('setup.l_rub')}</span>
        <Segmented label={t('setup.l_rub')} value={o.rub ? '1' : '0'} onChange={v => opt('rub', v === '1')} options={[{ value: '0', label: t('setup.l_rub_leave') }, { value: '1', label: t('setup.l_rub_fix') }]} />
        {offs.length > 0 && <p>{t('setup.l_offs', { here: offHere, n: offs.length })} <button type="button" class="link" onClick={() => { snap(); for (const [k, v] of Object.entries(bb.lightPg || {})) if (v === false) delete bb.lightPg[k]; apply(); }} data-lpgreset>{t('setup.l_offs_back')}</button></p>}
        {owns.length > 0 && <p>{t('setup.l_owns', { here: ownHere, n: owns.length })} <button type="button" class="link" onClick={() => { snap(); bb.lightPgL = {}; apply(); }} data-lpgown>{t('setup.l_owns_same')}</button></p>}</div>
      <Checkbox checked={o.exp} onChange={v => opt('exp', v)} label={t('setup.l_exp')} />
      <p class="mute">{t(o.exp ? 'setup.l_exp_on' : 'setup.l_exp_off')}</p>
    </div>
  </div>;
}

// Every student's page count, so "every paper" reaches students not opened yet (ensureCounts).
async function counts() {
  const pdfjs = await libs();
  for (const s of b().students) for (const f of s.files) {
    if (!D.viewable(f) || f.numPages || f.bad) continue;
    try { const d = await pdfjs.getDocument({ data: (await D.viewBytes(f)).slice(), isEvalSupported: false }).promise; f.numPages = d.numPages; d.destroy(); } catch (e) { console.error(e); f.bad = true; }
  }
}
let last = null;   // the last page switched, for Shift-click runs
const nth = k => k === 0 ? t('setup.l_last') : k === 1 ? t('setup.l_2nd_last') : k === 2 ? t('setup.l_3rd_last') : t('setup.l_nth_last', { n: k + 1 });
// The ☀ in a page's corner while lighting is on (lightChip), with ▾ (lightMenu).
export function LightChip({ pg }) {
  useLight();
  const [menu, setMenu] = useState(false), st = st0();
  if (!st || !D.lightLive(st) || pg.file.kind === 'docx') return null;
  const pages = state().pages, on = D.pageLit(st, pg.file, pg.idx), own = !!D.pageOwnL(st, pg.file, pg.idx);
  const flip = e => {
    const want = !on; let run = [pg];
    if (e.shiftKey && last && last !== pg && pages.includes(last)) { const x = pages.indexOf(last), y = pages.indexOf(pg); run = pages.slice(Math.min(x, y), Math.max(x, y) + 1); }
    snap(); for (const q of run) D.setPageLit(st, q.file, q.idx, want);
    last = pg; apply();
    if (run.length > 1) toast(t(want ? 'setup.l_run_on' : 'setup.l_run_off', { n: run.length }));
  };
  return <span class={'mk-lchip' + (on ? '' : ' off') + (own ? ' own' : '')}>
    <button type="button" onClick={flip} title={(own ? t('setup.l_own_tip') + ' ' : '') + t('setup.l_chip_tip')} aria-pressed={on ? 'true' : 'false'} data-lpg>☀ <span>{t(on ? 'setup.l_page_on' : 'setup.l_page_off')}</span></button>
    <button type="button" onClick={() => setMenu(m => !m)} aria-label={t('setup.l_more')} aria-expanded={menu ? 'true' : 'false'} title={t('setup.l_more_tip')} data-lmenu>▾</button>
    {menu && <LightMenu pg={pg} st={st} onClose={() => setMenu(false)} />}
  </span>;
}
function LightMenu({ pg, st, onClose }) {
  useLight();
  const bb = b(), want = !D.pageLit(st, pg.file, pg.idx), L0 = D.layoutOf(st), di = L0.findIndex(d => d.pages.some(([q, p]) => q === pg.file.path && p === pg.idx)), d = L0[di];
  const pos = d ? d.pages.findIndex(([q, p]) => q === pg.file.path && p === pg.idx) : -1, back = d ? d.pages.length - 1 - pos : -1;
  const own = D.pageOwnL(st, pg.file, pg.idx), L = own || D.lightFor(st), key = st.key + '|' + pg.file.path + '|' + pg.idx;
  const setOwn = (v, join) => { snap(join); D.setPageOwnL(st, pg.file, pg.idx, v); if (v && !D.pageLit(st, pg.file, pg.idx)) D.setPageLit(st, pg.file, pg.idx, true); apply(); };
  const doIt = async how => {
    onClose(); snap();
    const setList = (s, list) => { let n = 0; for (const [path, p] of list) { const f = D.fileByPath(s, path); if (f) { D.setPageLit(s, f, p, want); n++; } } return n; };
    if (how === 'page' || !d) D.setPageLit(st, pg.file, pg.idx, want);
    else if (how === 'rest') setList(st, d.pages.slice(pos));
    else if (how === 'file') setList(st, d.pages);
    else {
      await counts();
      let n = 0;
      for (const s of bb.students) { const ds = D.layoutOf(s)[di]; if (!ds) continue; const it = how === 'from' ? ds.pages[pos] : ds.pages[ds.pages.length - 1 - back]; if (it) n += setList(s, [it]); }
      toast(t(want ? 'setup.l_every_on' : 'setup.l_every_off', { page: how === 'from' ? t('setup.l_page_n', { n: pos + 1 }) : t('setup.l_that_page'), n }));
    }
    last = pg; apply();
  };
  const copy = async how => {
    onClose(); snap();
    const put = (s, [path, p]) => { const f = D.fileByPath(s, path); if (!f) return 0; D.setPageOwnL(s, f, p, own); D.setPageLit(s, f, p, true); return 1; };
    let n = 0;
    if (how === 'rest') { for (const it of D.layoutOf(st)[di].pages.slice(pos + 1)) n += put(st, it); toast(t('setup.l_copied_rest', { n })); }
    else { await counts(); for (const s of bb.students) { const ds = D.layoutOf(s)[di], it = ds && ds.pages[pos]; if (it) n += put(s, it); } toast(t('setup.l_copied_every', { page: pos + 1, n })); }
    apply();
  };
  return <div class="mk-lmenu" role="dialog" aria-label={t('setup.l_more')} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <h3>{t('setup.l_this_page')}</h3>
    <Sliders L={L} onSet={setOwn} tag={'own' + key} />
    <div class="lmacts"><Button size="sm" variant="primary" onClick={() => { if (!pg.bmp) return toast(t('setup.l_loading')); setOwn({ ...D.lightAuto(pg), s: L.s || 0, g: L.g || 0 }); }} data-lpauto>{t('setup.l_auto_page')}</Button>
      <span class="grow" />{own && <button type="button" class="link" onClick={() => setOwn(null)} data-lpsame>{t('setup.l_same')}</button>}</div>
    {d && own && <><h3>{t('setup.l_use_on')}</h3>{pos < d.pages.length - 1 && <button type="button" class="mi" onClick={() => copy('rest')} data-lpcopy="rest">{t('setup.l_rest')}</button>}
      <button type="button" class="mi" onClick={() => copy('from')} data-lpcopy="from">{t('setup.l_every_n', { n: pos + 1 })}</button></>}
    <hr />
    <h3>{t(want ? 'setup.l_turn_on_for' : 'setup.l_turn_off_for')}</h3>
    <button type="button" class="mi" onClick={() => doIt('page')} data-lm="page">{t('setup.l_just')}</button>
    {d && <><button type="button" class="mi" onClick={() => doIt('rest')} data-lm="rest">{t('setup.l_and_rest')}</button><button type="button" class="mi" onClick={() => doIt('file')} data-lm="file">{t('setup.l_file')}</button>
      <h3>{t('setup.l_every_paper')}</h3><button type="button" class="mi" onClick={() => doIt('from')} data-lm="from">{t('setup.l_every_n', { n: pos + 1 })}</button>
      {back !== pos && <button type="button" class="mi" onClick={() => doIt('back')} data-lm="back">{t('setup.l_every_back', { which: nth(back) })}</button>}</>}
  </div>;
}
