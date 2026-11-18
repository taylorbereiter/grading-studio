// Split a scan (src/app/scansplit.js openSplit, src/scans.js): one PDF of everyone's papers, in any order, its pages given to names on
// the roster. Pick pages (click, Shift for a run, Ctrl or ⌘ to add one), then drag them onto a name, click the name, or type it and
// press Enter. Each page is read as it comes (the lifted scanLook): turned and straightened when the app is sure, with a way back,
// and flagged when it may be upside down, crooked, blank or faint. Leave out blank pages shows the pages first. Give to several is
// group work; ⚑ Needs rescan flags pages and they can still be given; Lighting changes how the pages look and can go along for
// marking. Open for grading makes one PDF per student and brings them in (mark/open.js bringIn); with a download open (into), the
// pages are added to its students instead, like a makeup scan. What was decided goes along with each student's new file (the lifted
// scanHint, taken as the papers open: mark/change.js takeSplit). A quiz made here reading its codes off the pages comes with (f).
// Loaded as a part of its own (router.js PARTS.split).
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, IconButton, Checkbox, Segmented, useModal, toast } from '../../ui/index.js';
import { state, use } from '../../engines/gcore.js';
import * as D from '../../engines/gdraw.js';
import * as G from '../../engines/gfiles.js';
import * as E from '../../engines/gopen.js';
import { prefs } from '../../students/prefs.js';
import { t } from '../../i18n/t.js';
import { PARTS, go } from '../router.js';
import { libs } from './paper.js';
import * as C from './change.js';
import './lines.js';

const SIZES = [110, 160, 230];
const isMac = () => /Mac|iP/.test(navigator.platform || '');
const clean = s => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();

// The split's state (the current app's SP), one object, so the lifted helpers that take it (spView, spXf, spWho, spLight, scanHint)
// work on it unchanged.
async function start(file, asg, into, lib) {
  const pdfjs = await libs(), data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
  const bb = state().batch, classes = (lib && lib.classes) || [];
  const c = into ? (bb && bb.classId != null ? classes.find(k => k.id === bb.classId) : null) || null
    : asg && asg.classId ? classes.find(k => k.id === asg.classId) || null : classes.find(k => (k.names || []).length) || null;
  if (!into) use({ lib });
  const size = +prefs.get('gs.spsize', 1);
  const me = { name: file.name.replace(/\.pdf$/i, ''), data, doc, n: doc.numPages, thumbs: [], ink: [], sc: {}, rot: {}, skew: {}, owner: Array(doc.numPages).fill(''), more: {}, raw: [], re: new Set(), L: null, Lp: {}, keepL: true, several: false, skip: new Set(), sel: new Set(), anchor: 0,
    names: into ? G.splitIntoNames(c) : c ? c.names.slice() : [], classId: c ? c.id : '', asg: asg || null, into: !!into, last: 1, size: size >= 0 && size <= 2 ? size : 1, classes };
  pick(me, 0, into ? 1 : guess(me));
  return me;
}
// A first guess at pages per student, so the first pick is a whole paper: page count over roster size when it comes out even.
function guess(me) { const r = me.names.length; if (!r || me.n < r) return 1; return me.n % r === 0 ? me.n / r : 1; }
const free = (me, i) => !me.owner[i] && !me.skip.has(i);
// Pick k pages that nobody has yet, starting at page i.
function pick(me, i, k) { me.sel = new Set(); for (let p = i; p < me.n && me.sel.size < k; p++) if (free(me, p)) me.sel.add(p); me.anchor = me.sel.size ? Math.min(...me.sel) : 0; }
const pagesOf = (me, nm) => me.owner.map((_, i) => G.spWho(me, i).includes(nm) ? i : -1).filter(i => i >= 0);
// Take one student off a page; the next one on it, if any, becomes its first.
function takeOff(me, i, nm) {
  if (me.owner[i] === nm) me.owner[i] = (me.more[i] || []).shift() || '';
  else if (me.more[i]) me.more[i] = me.more[i].filter(x => x !== nm);
  if (me.more[i] && !me.more[i].length) delete me.more[i];
}
function give(me, nm) {
  if (!nm) return false;
  if (!me.sel.size) { toast(t('mark.s_pick_first')); return false; }
  const list = [...me.sel].sort((a, b) => a - b);
  if (me.several) {   // group work: the pages stay picked, so the next name clicked is added too
    for (const p of list) { me.skip.delete(p); if (!me.owner[p]) me.owner[p] = nm; else if (!G.spWho(me, p).includes(nm)) (me.more[p] ||= []).push(nm); }
    return true;
  }
  for (const p of list) { me.owner[p] = nm; delete me.more[p]; me.skip.delete(p); }
  me.last = list.length; me.sel = new Set();
  let nx = list[list.length - 1] + 1; while (nx < me.n && !free(me, nx)) nx++;
  if (nx >= me.n) { nx = 0; while (nx < me.n && !free(me, nx)) nx++; }
  me.anchor = nx < me.n ? nx : 0;
  return true;
}
function matches(me, q) {
  const w = (q || '').toLowerCase().split(/\s+/).filter(Boolean), idx = me.names.map((_, i) => i);
  if (!w.length) return idx;
  const words = nm => nm.toLowerCase().split(/[\s,]+/).filter(Boolean);
  return idx.filter(i => w.every(x => words(me.names[i]).some(y => y.startsWith(x)))).sort((a, b) => (pagesOf(me, me.names[a]).length ? 1 : 0) - (pagesOf(me, me.names[b]).length ? 1 : 0));
}
// "1–3, 7" from [0, 1, 2, 6]
const range = list => G.spRange(list);

// Each page read and drawn small (splitRender): its scan read first, so a page the app turns is drawn turned.
async function read(me, live, each) {
  const pdfjs = await libs();
  for (let i = 0; i < me.n && live(); i++) {
    if (me.thumbs[i]) continue;
    const page = await me.doc.getPage(i + 1);
    if (!me.sc[i]) {
      let rec; try { rec = await G.scanLook(page, 0); } catch { rec = { typed: 1 }; }
      me.sc[i] = rec;
      if (rec.sure === 2 && rec.turn) { me.rot[i] = rec.turn; rec.didTurn = rec.turn; }
      if (rec.skewSure === 2) { me.skew[i] = rec.skew; rec.didSkew = rec.skew; }
    }
    if (!live()) return;
    const vp0 = G.spView(me, i, page, 1), vp = G.spView(me, i, page, 520 / vp0.width);
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    try { await page.render({ canvasContext: ctx, viewport: vp, transform: G.spXf(me, i, vp), annotationMode: pdfjs.AnnotationMode.ENABLE }).promise; } catch {}
    me.ink[i] = G.splitInk(ctx, cv.width, cv.height);
    me.raw[i] = cv.toDataURL('image/jpeg', 0.78);
    const L = G.spLight(me, i); if (L) D.lightCanvas(ctx, cv.width, cv.height, L);
    me.thumbs[i] = L ? cv.toDataURL('image/jpeg', 0.78) : me.raw[i];
    cv.width = cv.height = 0;
    each(i);
  }
}
// The thumbnails drawn again from the page as it was read, with the lighting now set (spRelight).
async function relight(me, list, live, each) {
  for (const i of list) {
    if (!live()) return;
    if (!me.raw[i]) continue;
    const L = G.spLight(me, i);
    if (L) {
      const im = new Image(); im.src = me.raw[i]; await im.decode().catch(() => {});
      if (!live()) return;
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); D.lightCanvas(x, c.width, c.height, L);
      me.thumbs[i] = c.toDataURL('image/jpeg', 0.78); c.width = c.height = 0;
    } else me.thumbs[i] = me.raw[i];
    each(i);
  }
}
// One page big enough to read a handwritten name (bigPage). dark: drawn darker, for checking a page that may be blank (scanDarken).
async function bigOf(me, i, w, dark) {
  const pdfjs = await libs(), page = await me.doc.getPage(i + 1), vp0 = G.spView(me, i, page, 1), vp = G.spView(me, i, page, w / vp0.width);
  const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: ctx, viewport: vp, transform: G.spXf(me, i, vp), annotationMode: pdfjs.AnnotationMode.ENABLE }).promise;
  if (dark) G.scanDarken(ctx, cv.width, cv.height);
  else { const L = G.spLight(me, i); if (L) D.lightCanvas(ctx, cv.width, cv.height, L); }
  const u = cv.toDataURL('image/jpeg', 0.85); cv.width = cv.height = 0; page.cleanup();
  return u;
}
// A page's tags (scanCard): what was done, with a way back, or what to look at.
function Tags({ me, i, onFix }) {
  const r = me.sc[i], out = [];
  if (me.re.has(i)) out.push(<button type="button" class="re" onClick={e => { e.stopPropagation(); onFix(i, 'unre'); }} title={t('mark.s_unre_tip')} data-spfix="unre">{t('mark.s_re_tag')}</button>);
  if (G.spLight(me, i)) out.push(<span title={t('mark.s_lit_tip')}>{t('mark.s_lit_tag')}</span>);
  if (r) {
    const off = r.off || {}, turned = !!r.didTurn && me.rot[i] === r.didTurn, straight = !!me.skew[i];
    const fix = (how, text, tip) => <button type="button" onClick={e => { e.stopPropagation(); onFix(i, how); }} title={tip} data-spfix={how}>{text}</button>;
    if (turned || straight) out.push(fix('back', t(turned && straight ? 'mark.s_both' : turned ? 'mark.s_turned' : 'mark.s_straight'), t('mark.s_back_tip')));
    if (r.turn && !r.didTurn && !me.rot[i] && !off.turn) out.push(fix('turn', t(r.turn === 180 ? 'mark.s_upside' : 'mark.s_side')));
    else if (r.side && !r.turn && !me.rot[i] && !off.turn) out.push(fix('right', t('mark.s_side')));
    if (r.skew && !r.didSkew && !straight && !off.skew) out.push(fix('skew', t('mark.s_crooked')));
    if (r.blank) out.push(<span title={t('mark.s_blank_tip')}>{t('mark.s_blank')}</span>);
    if (r.faint) out.push(<span title={t(r.soft ? 'mark.s_soft_tip' : 'mark.s_faint_tip')}>{t('mark.s_faint')}</span>);
  }
  return <span class="sptags" data-fl={i}>{out}</span>;
}
// What was read, in one line (scanSplitSays).
const says = me => { const s = G.scanSplitSays(me); return s; };

// Leave out blank pages (splitBlankView): she sees each page first, drawn darker so faint writing shows, and keeps any with writing.
function Blank({ me, list, onDone, onBig }) {
  const [pics, setPics] = useState({}), [kept, setKept] = useState(() => new Set()), [ready, setReady] = useState(false);
  useEffect(() => { let live = true; (async () => {
    for (const i of list) {
      try { const u = await bigOf(me, i, 900, true); if (!live) return; setPics(p => ({ ...p, [i]: u })); }
      catch (e) { console.warn(e); if (!live) return; setKept(k => new Set(k).add(i)); setPics(p => ({ ...p, [i]: 'bad' })); }   // a page that can't be drawn can't be checked, so it stays
    }
    if (live) setReady(true);
  })(); return () => { live = false; }; }, []);
  const left = list.filter(i => !kept.has(i));
  const keep = i => setKept(k => { const n = new Set(k); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return <div class="spblank" role="dialog" aria-label={t('mark.s_blank_t')} data-spblankview>
    <header><h3>{t('mark.s_blank_t')}</h3><span class="mute">{t('mark.s_blank_sub')}</span></header>
    <p>{t('mark.s_blank_text')}</p>
    <div class="spbk-list">{list.map(i => <div class={'spbk' + (kept.has(i) ? ' kept' : '') + (pics[i] === 'bad' ? ' bad' : '')} data-bk={i}>
      {pics[i] && pics[i] !== 'bad' ? <img src={pics[i]} alt={t('mark.s_page', { n: i + 1 })} onClick={() => onBig(i)} /> : pics[i] === 'bad' ? <span class="mute">{t('mark.s_cant_draw')}</span> : <span class="ph" aria-busy="true" />}
      <div class="spbf"><b>{t('mark.s_page', { n: i + 1 })}</b>{pics[i] !== 'bad' && <Button size="sm" aria-pressed={kept.has(i) ? 'true' : 'false'} onClick={() => keep(i)} data-bkkeep>{t(kept.has(i) ? 'mark.s_kept' : 'mark.s_keep')}</Button>}</div></div>)}</div>
    <footer><Button onClick={() => onDone(null)} data-bkno>{t('mark.s_keep_all')}</Button>
      <Button variant="primary" disabled={!ready || !left.length} onClick={() => onDone(left)} data-bkgo>{ready ? t('mark.s_leave_n', { n: left.length }) : t('mark.s_getting')}</Button></footer>
  </div>;
}

// Lighting for the scan (spLightOpen): the whole scan's, or the picked pages' own. Only how the pages look here and in the big view,
// unless Keep it for grading is on.
function Lighting({ me, onSet, onClose }) {
  const [, tick] = useState(0);
  me.Lsel ??= me.sel.size ? 'sel' : 'all';
  const now = () => { if (me.Lsel === 'sel') { const p = [...me.sel].sort((a, b) => a - b)[0]; return { ...D.LIGHT0, ...((p != null && me.Lp[p]) || me.L || {}) }; } return { ...D.LIGHT0, ...(me.L || {}) }; };
  const L = now(), n = me.sel.size;
  const set = v => {
    const on = D.lightOn(v) ? v : null, list = [];
    if (me.Lsel === 'sel' && me.sel.size) for (const p of me.sel) { if (on) me.Lp[p] = on; else delete me.Lp[p]; list.push(p); }
    else { me.L = on; for (let i = 0; i < me.n; i++) if (!me.Lp[i]) list.push(i); }
    onSet(list); tick(k => k + 1);
  };
  const auto = () => {
    const p = me.Lsel === 'sel' && me.sel.size ? Math.min(...me.sel) : me.raw.findIndex(Boolean);
    if (p < 0 || !me.raw[p]) return toast(t('mark.s_still'));
    const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); set({ ...now(), ...D.lightAuto({ bmp: c }) }); }; im.src = me.raw[p];
  };
  const reset = () => { if (me.Lsel === 'sel') return set(D.LIGHT0); const all = [...Array(me.n).keys()]; me.L = null; me.Lp = {}; onSet(all); tick(k => k + 1); };
  const ROWS = [['b', 'mark.l_b', -60, 60], ['c', 'mark.l_c', 0, 400], ['d', 'mark.l_d', 0, 100], ['s', 'mark.l_s', 0, 100]];
  return <div class="mk-light splight" role="dialog" aria-label={t('mark.s_light_t')} data-splightp>
    <header><b>{t('mark.l_title')}</b><span class="grow" /><Button size="sm" onClick={auto} data-splauto>{t('mark.s_auto')}</Button><IconButton icon="x" size="sm" label={t('mark.s_close')} onClick={onClose} /></header>
    <Segmented label={t('mark.s_light_t')} value={me.Lsel} onChange={v => { me.Lsel = v; tick(k => k + 1); }}
      options={[{ value: 'all', label: t('mark.s_whole') }, { value: 'sel', label: n ? t('mark.s_picked_n', { n }) : t('mark.s_picked'), disabled: !n }]} />
    {ROWS.map(([k, label, min, max]) => <label class="mk-lsl"><span>{t(label)}</span>
      <input type="range" min={min} max={max} step="1" value={L[k] || 0} onInput={e => set({ ...now(), [k]: +e.currentTarget.value })} data-spl={k} /><b>{L[k] || 0}</b></label>)}
    <Checkbox checked={!!L.g} onChange={v => set({ ...now(), g: v ? 1 : 0 })} label={t('mark.l_g')} />
    <p class="mute">{t('mark.s_light_only')}</p>
    <Checkbox checked={me.keepL} onChange={v => { me.keepL = v; tick(k => k + 1); }} label={t('mark.s_light_keep')} />
    <Button size="sm" variant="quiet" onClick={reset} data-splreset>{t('mark.l_reset')}</Button>
  </div>;
}

// Each student's pages as a PDF of their own (splitGo), with what was decided for each page going along (scanHint).
async function make(me) {
  const { PDFDocument } = await PARTS.pdflib(), src = await PDFDocument.load(me.data, { ignoreEncryption: true, updateMetadata: false });
  const file = clean((me.asg && me.asg.name) || me.name) || 'Scan';
  const entries = [], t0 = Date.now(), all = G.spAll(me);
  // Lighting set for the whole scan is the download's own; set page by page, it goes to each student who got one of those pages.
  const wide = me.keepL && me.L && !Object.keys(me.Lp).length && !me.into;
  for (const [k, nm] of all.entries()) {
    const out = await PDFDocument.create(), mine = pagesOf(me, nm).sort((a, b) => a - b);
    out.setModificationDate(new Date(t0 + k * 1000));   // group work: two students' copies of the same pages are still two files, each found again by its own bytes
    if (!src.isEncrypted) { for (const pg of await out.copyPages(src, mine)) out.addPage(pg); }
    else for (const i of mine) await raster(out, me.doc, i, 200);   // a locked PDF copies as blank pages
    const made = await out.save(); G.scanHint(me, made, mine, nm, me.keepL && !wide);
    entries.push({ path: clean(nm) + '/' + file + '.pdf', data: made, nm });
  }
  return { entries, all, wide };
}
// One page drawn as a picture into a new PDF, at its own size (rasterInto).
async function raster(out, doc, i, dpi) {
  const pdfjs = await libs(), page = await doc.getPage(i + 1), vp1 = page.getViewport({ scale: 1 }), k = dpi / 72;
  const c = document.createElement('canvas'); c.width = Math.ceil(vp1.width * k); c.height = Math.ceil(vp1.height * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: k }), annotationMode: pdfjs.AnnotationMode.ENABLE }).promise;
  const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
  out.addPage([vp1.width, vp1.height]).drawImage(await out.embedJpg(jpg), { x: 0, y: 0, width: vp1.width, height: vp1.height });
  c.width = c.height = 0; page.cleanup();
}

// file: the scan; asg: the assignment card it's for; into: add to the open download; lib: the library (its classes and rosters).
// onOpen(id): where the papers go when they open (the class page goes to the marking screen).
export function Split({ file, asg, into, lib, onClose }) {
  const S = useRef(null), [me, setMe] = useState(null), [, tick] = useState(0), redraw = () => tick(k => k + 1);
  const [q, setQ] = useState(''), [big, setBig] = useState(null), [blank, setBlank] = useState(null), [light, setLight] = useState(false), [busy, setBusy] = useState(false), [adding, setAdding] = useState(false);
  const live = useRef(true), litRun = useRef(0);
  useEffect(() => { live.current = true; let m = null;
    start(file, asg, into, lib).then(x => { if (!live.current) return x.doc.destroy(); m = x; S.current = x; window.__split = () => S.current; setMe(x);
      read(x, () => live.current && S.current === x, () => redraw()).then(() => redraw(), e => console.error(e)); }, e => { console.error(e); toast(t('mark.s_not_pdf', { name: file.name })); onClose(); });
    return () => { live.current = false; if (m && !m.gone) m.doc.destroy(); window.__split = null; }; }, []);
  const p = useModal(true, () => close());
  const close = () => { if (big != null) return setBig(null); if (blank) return setBlank(null); if (light) return setLight(false); onClose(); };
  if (!me) return <dialog class="dlg mk-split" aria-label={t('mark.s_title', { name: file.name })} {...p}><div class="loading" aria-busy="true" /></dialog>;
  const fix = (i, how) => {
    if (how === 'unre') { me.re.delete(i); return redraw(); }
    const r = me.sc[i] || (me.sc[i] = { typed: 1 }), off = r.off ||= {};
    if (how === 'back') { if (r.didTurn && me.rot[i] === r.didTurn) { delete me.rot[i]; off.turn = 1; } if (me.skew[i]) { delete me.skew[i]; off.skew = 1; } }
    else if (how === 'turn') { me.rot[i] = r.turn; r.didTurn = r.turn; }   // the same tag as a page turned by itself, with its way back
    else if (how === 'skew') me.skew[i] = r.skew;
    else if (how === 'right') { const v = ((me.rot[i] || 0) + 90) % 360; if (v) { me.rot[i] = v; r.didTurn = v; } else delete me.rot[i]; off.turn = 1; }
    me.thumbs[i] = ''; redraw(); read(me, () => live.current, () => redraw());
  };
  const click = (i, e) => {
    if (e.shiftKey) { me.sel = new Set(); const a = Math.min(me.anchor, i), b = Math.max(me.anchor, i); for (let k = a; k <= b; k++) if (free(me, k) || a === b) me.sel.add(k); e.preventDefault(); }
    else if (e.metaKey || e.ctrlKey) { me.sel.has(i) ? me.sel.delete(i) : me.sel.add(i); me.anchor = i; }
    else { me.sel = new Set([i]); me.anchor = i; }
    redraw();
  };
  const giveTo = nm => { if (give(me, nm)) redraw(); };
  const relit = list => { const run = ++litRun.current; clearTimeout(me.litT); me.litT = setTimeout(() => relight(me, list, () => live.current && run === litRun.current, () => redraw()), 120); };
  const leaveBlank = () => {
    if (me.ink.filter(v => v != null).length < me.n) return toast(t('mark.s_still'));
    const list = me.ink.map((v, i) => (me.sc[i] ? me.sc[i].blank : v < 0.0015) && !me.owner[i] && !me.skip.has(i) ? i : -1).filter(i => i >= 0);
    if (!list.length) return toast(t('mark.s_no_blank'));
    setBlank(list);
  };
  const blankDone = out => {
    setBlank(null); if (!out) return;
    out = out.filter(i => !me.owner[i]);
    for (const i of out) { me.skip.add(i); me.sel.delete(i); }
    toast(t('mark.s_left_n', { n: out.length })); redraw();
  };
  const skipSel = () => { if (!me.sel.size) return toast(t('mark.s_pick_out')); for (const k of me.sel) { me.skip.add(k); me.owner[k] = ''; delete me.more[k]; } const last = Math.max(...me.sel); pick(me, last + 1, me.last); redraw(); };
  const flag = () => { if (!me.sel.size) return toast(t('mark.s_pick_re')); const all = [...me.sel].every(k => me.re.has(k)); for (const k of me.sel) all ? me.re.delete(k) : me.re.add(k); redraw(); };
  const setCls = v => {
    me.classId = v === '' ? '' : (me.classes.find(k => String(k.id) === v) || {}).id ?? '';
    const k = me.classes.find(x => x.id === me.classId) || null, extra = G.spAll(me).filter(nm => !(k ? k.names : []).includes(nm));
    me.names = me.into ? G.splitIntoNames(k) : (k ? k.names.slice() : []);
    me.names = me.names.concat(extra.filter(nm => !me.names.includes(nm)));
    redraw();
  };
  const go1 = async () => {
    setBusy(true); me.gone = true;
    let made;
    try { made = await make(me); }
    catch (e) { console.error(e); me.gone = false; setBusy(false); return toast(t('mark.s_too_big')); }
    me.doc.destroy();
    if (me.into) return into1(made);
    try {
      const O = await PARTS.bring();
      const r = await O.bringIn(made.entries.map(e => ({ path: e.path, data: e.data })), { label: me.name, assignment: me.asg });
      if (!r) { onClose(); return; }
      C.afterSplit({ id: r.batch.id, wide: made.wide ? { ...me.L } : null, cls: me.classId, lit: me.keepL && (me.L || Object.keys(me.Lp).length) });
      onClose(r.batch.id);
      go('mark', r.batch.id);
    } catch (e) { console.error(e); toast(e && e.name === 'NothingIn' ? t('mark.w_nothing') : e && e.name === 'CannotSave' ? t('mark.cannot') : t('mark.w_failed')); onClose(); }
  };
  // Into the open download (splitGo with into): each student's pages added to them as a file of their own; someone new is added.
  const into1 = async ({ entries, all }) => {
    const bb = state().batch, k = me.classes.find(x => x.id === me.classId), m = k ? G.rosterMatch(k.names) : new Map(), keep = bb.students[state().cur];
    let first = null;
    for (const e of entries) {
      const nm = e.path.slice(0, e.path.indexOf('/')), owner = all.find(o => clean(o) === nm) || nm;
      let st = bb.students.find(x => x.key === owner) || m.get(owner);
      if (!st) { st = { key: nm, files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }; bb.students.push(st); }
      await C.addFiles(st, [{ path: e.path, file: new File([e.data], me.name + '.pdf', { type: 'application/pdf' }) }]);
      first ||= st;
    }
    G.scanHintsAll(); if (Object.keys(me.Lp).length || me.L) state().lightPagesChanged();
    E.rosterSort(); use({ cur: Math.max(0, bb.students.indexOf(keep)) });
    C.changed();
    toast(t('mark.s_added', { n: entries.length }));
    onClose();
    if (first) C.reopen(bb.students.indexOf(first));
  };
  const W = SIZES[me.size] || 160, sel = [...me.sel].sort((a, b) => a - b), shown = matches(me, q);
  const given = me.owner.filter(Boolean).length, left = me.n - given - me.skip.size, who = G.spAll(me).length, shared = Object.keys(me.more).length, re = me.re.size;
  const none = me.names.filter(nm => !pagesOf(me, nm).length), read1 = me.thumbs.filter(Boolean).length;
  const info = sel.length ? t(sel.length === 1 ? 'mark.s_sel_one' : 'mark.s_sel_many', { pages: range(sel) }) : free(me, me.anchor) && me.owner.some(Boolean) ? t('mark.s_next', { n: me.anchor + 1 }) : t('mark.s_none_picked');
  const foot = [t('mark.s_foot', { n: who, given, of: me.n }), shared ? t('mark.s_foot_shared', { n: shared }) : '', re ? t('mark.s_foot_re', { n: re }) : ''].filter(Boolean).join(' · ');
  return <dialog class="dlg mk-split" aria-labelledby="spT" {...p} onCancel={e => { e.preventDefault(); close(); }}
    onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); } p.onKeyDown(e); }}>
    <header><h2 id="spT">{t('mark.s_title', { name: me.name })}</h2><span class="mute" data-spstat>{read1 < me.n ? t('mark.s_reading', { n: read1, of: me.n }) : says(me)}</span><span class="mute">{t('mark.s_pages', { n: me.n })}</span></header>
    <div class="spwrap">
      <div class="spleft">
        <div class="spbar">
          <Segmented size="sm" label={t('mark.a_size')} value={String(me.size)} onChange={v => { me.size = +v; prefs.set('gs.spsize', me.size); redraw(); }} options={[{ value: '0', label: 'S' }, { value: '1', label: 'M' }, { value: '2', label: 'L' }]} />
          <Button size="sm" icon="sun" aria-pressed={light ? 'true' : 'false'} onClick={() => setLight(v => !v)} title={t('mark.s_light_tip')} data-splight>{t('mark.l_title')}</Button>
          <Button size="sm" icon="flag" onClick={flag} title={t('mark.s_re_tip')} data-spre>{t('mark.s_re')}</Button>
          <Button size="sm" icon="people" aria-pressed={me.several ? 'true' : 'false'} onClick={() => { me.several = !me.several; toast(t(me.several ? 'mark.s_sev_on' : 'mark.s_sev_off')); redraw(); }} title={t('mark.s_sev_tip')} data-spsev>{t('mark.s_sev')}</Button>
          <Button size="sm" onClick={leaveBlank} data-spblank>{t('mark.s_blank_btn')}</Button>
          <Button size="sm" onClick={skipSel} data-spskip>{t('mark.s_skip')}</Button>
          <span class="grow" /><span class={'spsel' + (sel.length ? ' on' : '')} data-spsel>{info}</span>
        </div>
        <p class="mute sphint">{t('mark.s_hint', { mod: isMac() ? '⌘' : 'Ctrl' })}</p>
        <div class="sppages" style={{ '--spw': W + 'px' }}>
          {Array.from({ length: me.n }, (_, i) => { const o = me.owner[i], sk = me.skip.has(i), k = sel.indexOf(i);
            return <div class={'spg' + (k >= 0 ? ' sel' : '') + (o ? ' own' : '') + (sk ? ' skip' : '')} data-spg={i} draggable
              onClick={e => click(i, e)} onDblClick={() => setBig(i)}
              onDragStart={e => { if (!me.sel.has(i)) { me.sel = new Set([i]); me.anchor = i; redraw(); } e.dataTransfer.setData('text/plain', 'pages'); e.dataTransfer.effectAllowed = 'move'; }}>
              {me.thumbs[i] ? <img src={me.thumbs[i]} alt={t('mark.s_page', { n: i + 1 })} draggable={false} /> : <span class="ph" />}
              {k >= 0 && <span class="sppick">{sel.length > 1 ? t('mark.s_k_of', { k: k + 1, n: sel.length }) : t('mark.s_picked1')}</span>}
              <span class="spbtns"><IconButton icon="search" size="sm" label={t('mark.s_big')} onClick={e => { e.stopPropagation(); setBig(i); }} data-zoom /><IconButton icon="turnr" size="sm" label={t('mark.f_turn_r')} onClick={e => { e.stopPropagation(); fix(i, 'right'); }} data-spturn /></span>
              <Tags me={me} i={i} onFix={fix} />
              <div class="spf"><span class="spno">{i + 1}</span>
                {(o || sk) && <>{sk ? <span class="spown">{t('mark.s_left_out')}</span> : <span class="spown" data-raw title={G.spWho(me, i).join(', ')}>{o + (me.more[i] ? ' +' + me.more[i].length : '')}</span>}
                  <IconButton icon="x" size="sm" label={t('mark.s_take_back')} onClick={e => { e.stopPropagation(); me.owner[i] = ''; delete me.more[i]; me.skip.delete(i); redraw(); }} data-unpg /></>}</div>
            </div>; })}
        </div>
      </div>
      <div class="spright">
        <label class="spcls"><span>{t('mark.s_class')}</span><select class="input" value={me.classId === '' ? '' : String(me.classId)} onChange={e => setCls(e.currentTarget.value)} data-spcls>
          <option value="">{t('mark.s_no_roster')}</option>{me.classes.map(k => <option value={String(k.id)} data-raw>{k.name + ' (' + k.names.length + ')'}</option>)}</select></label>
        <input class="input" value={q} onInput={e => setQ(e.currentTarget.value)} placeholder={t('mark.s_find')} aria-label={t('mark.s_find')} autocomplete="off" data-spfind
          onKeyDown={e => { if (e.key !== 'Enter') return; e.preventDefault(); const m = matches(me, q); if (m.length && give(me, me.names[m[0]])) { setQ(''); redraw(); } }} />
        <div class="spnames">{shown.length ? shown.map((i, k) => { const nm = me.names[i], pg = pagesOf(me, nm);
          return <div class={'spname' + (pg.length ? ' has' : '') + (q && k === 0 ? ' top' : '')} data-spn={i} role="button" tabIndex={0}
            onClick={() => giveTo(nm)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); giveTo(nm); } }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over'); }} onDragLeave={e => e.currentTarget.classList.remove('over')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); giveTo(nm); }}>
            <span class="spck">{pg.length ? '✓' : ''}</span><b data-raw>{nm}</b>
            {pg.length > 0 && <><span class="mute">{t('mark.s_p', { pages: range(pg) })}{pg.some(x => me.more[x]) ? ' · ' + t('mark.s_shared') : ''}{pg.some(x => me.re.has(x)) ? ' · ⚑' : ''}</span>
              <Button size="sm" variant="quiet" onClick={e => { e.stopPropagation(); for (let x = 0; x < me.n; x++) takeOff(me, x, nm); redraw(); }} title={t('mark.s_unall_tip')} data-unall>{t('mark.s_unall')}</Button></>}
          </div>; }) : <p class="mute">{me.names.length ? t('mark.s_no_match') : t('mark.s_no_names')}</p>}</div>
        {adding ? <AddName onAdd={nm => { setAdding(false); nm = (nm || '').trim(); if (nm && !me.names.includes(nm)) me.names.push(nm); redraw(); }} />
          : <Button size="sm" variant="quiet" icon="plus" onClick={() => setAdding(true)} data-spadd>{t('mark.s_add')}</Button>}
      </div>
    </div>
    <footer><span class="mute" data-spfoot>{foot}{left > 0 && <b class="warn">{' · ' + t('mark.s_foot_left', { n: left })}</b>}{none.length > 0 && who > 0 && <span data-raw>{' · ' + t('mark.s_foot_none', { names: none.join(', ') })}</span>}</span>
      <span class="grp"><Button onClick={onClose}>{t('mark.cancel')}</Button><Button variant="primary" disabled={!who || busy} onClick={go1} data-spgo>{busy ? t('mark.s_making') : t(me.into ? 'mark.s_go_into' : 'mark.s_go')}</Button></span></footer>
    {light && <Lighting me={me} onSet={relit} onClose={() => setLight(false)} />}
    {blank && <Blank me={me} list={blank} onDone={blankDone} onBig={setBig} />}
    {big != null && <Big me={me} i={big} onClose={() => setBig(null)} />}
  </dialog>;
}
function AddName({ onAdd }) {
  const [v, setV] = useState(''), ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return <form class="spaddname" onSubmit={e => { e.preventDefault(); onAdd(v); }}>
    <input ref={ref} class="input" value={v} onInput={e => setV(e.currentTarget.value)} aria-label={t('mark.s_add_name')} placeholder={t('mark.s_add_name')} autocomplete="off" data-raw data-spaddname />
    <Button size="sm" type="submit" data-spaddok>{t('mark.s_add_ok')}</Button><Button size="sm" variant="quiet" onClick={() => onAdd('')}>{t('mark.cancel')}</Button></form>;
}
function Big({ me, i, onClose }) {
  const [src, setSrc] = useState(me.thumbs[i] || '');
  useEffect(() => { let live = true; bigOf(me, i, 1400, false).then(u => { if (live) setSrc(u); }, e => console.error(e)); return () => { live = false; }; }, [i]);
  return <div class="arr-big spbig" onClick={onClose} role="presentation" data-spbig><img src={src} alt={t('mark.s_page', { n: i + 1 })} /><span>{t('mark.s_big_close', { n: i + 1 })}</span></div>;
}
