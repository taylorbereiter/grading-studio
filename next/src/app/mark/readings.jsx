// Readings on the marking screen (src/app/readings.js): any file shown above the papers while she grades, like the reading or the
// prompt, kept in this browser with the download and never sent back to students. A file is for everyone, or only for one student;
// one student can have an everyone file left off (batch.refSkip[key] = [paths], saved with the work). The Readings box (from More for
// this paper) adds and takes off files for everyone and for the student on screen; each file is a card above the paper that folds,
// with Hide for this student (or Remove), a zoom bar, Ctrl + scroll to zoom and a bottom edge to drag taller. The Word document the
// current app kept beside every paper (src/app/media.js refDoc, gs.rd.<id>) shows first, and Readings can take it off.
// The records are the current app's: { bid, key: REF_KEY, path, name, data, added, for } in the added files' store under
// "download id|REF_KEY|path", so either app shows what the other added. A lazy part of its own, loaded by More for this paper.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, Checkbox, Dialog, Icon, toast } from '../../ui/index.js';
import { state, use } from '../../engines/gcore.js';
import { shownName, viewable, vpRot } from '../../engines/gdraw.js';
import { idbDo } from '../../engines/gstore.js';
import * as E from '../../engines/gopen.js';
import { readings } from '../../students/index.js';
import { keepAdded, dropAdded, dropReadingDoc } from '../../students/write.js';
import { prefs } from '../../students/prefs.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { DriveButton } from '../drive-button.jsx';
import { libs } from './paper.js';
import './read-lines.js';
import './setup-lines.js';

// The open download's readings: read once for each download, and again after each change here. subs: what draws them.
const S = { id: null, list: [], ready: null, subs: new Set() };
const tell = () => S.subs.forEach(f => f());
const b = () => state().batch;
const keyOf = path => b().id + '|' + E.REF_KEY + '|' + path;
export function load(again) {
  const bb = b(); if (!bb) return Promise.resolve();
  if (!again && S.id === bb.id && S.ready) return S.ready;
  S.id = bb.id;
  return (S.ready = (async () => {
    let recs = [];
    try { recs = (await idbDo('readonly', o => o.getAll(E.underId(bb.id)))) || []; } catch { recs = []; }
    if (S.id !== bb.id) return;
    S.list = recs.filter(r => r.bid === bb.id && r.key === E.REF_KEY).sort((x, y) => x.added - y.added).map(r => ({ path: r.path, name: r.name, data: r.data, for: r.for || '' }));
    tell();
  })());
}
// A hook: the list, drawn again when it changes
function useList() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick(n => n + 1); S.subs.add(f); load(); return () => S.subs.delete(f); }, []);
  return S.id === (b() && b().id) ? S.list : [];
}
const skipped = (st, r) => !r.for && ((b().refSkip && b().refSkip[st.key]) || []).includes(r.path);
export const refsFor = st => (S.id === (b() && b().id) ? S.list : []).filter(r => (r.for ? r.for === st.key : true) && !skipped(st, r));
// the Word document kept the current app's older way: { name, b64, at }
const docNow = () => { const bb = b(); return bb ? readings.json(bb.id, null) : null; };
export const count = st => refsFor(st).length + (docNow() ? 1 : 0);
const saved = () => PARTS.marking().then(m => m.M.changedNow(), e => console.error(e));

function setSkip(st, path, off) {
  const bb = b(), m = bb.refSkip || (bb.refSkip = {}), l = new Set(m[st.key] || []);
  if (off) l.add(path); else l.delete(path);
  if (l.size) m[st.key] = [...l]; else delete m[st.key];
  if (!Object.keys(m).length) delete bb.refSkip;
  saved(); tell();
}
// files: from the computer or Drive. st: only for this student; none: for everyone.
async function addRefs(files, st) {
  const bb = b(), who = st ? st.key : '';
  let n = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.arrayBuffer()), path = (who ? who + '/' : '') + f.name;
    try { await keepAdded(bb.id, { bid: bb.id, key: E.REF_KEY, path, name: f.name, data, added: Date.now(), for: who }, keyOf(path)); }
    catch (e) { console.error(e); toast(t('rd.no_room', { name: f.name })); continue; }
    S.list = S.list.filter(r => r.path !== path).concat({ path, name: f.name, data, for: who }); n++;
  }
  if (!n) return;
  saved(); tell();
  const name = st ? shownName(st, bb.students.indexOf(st)) : '';
  toast(n === 1 ? (st ? t('rd.added_for', { file: files[0].name, name }) : t('rd.added', { file: files[0].name })) : (st ? t('rd.added_n_for', { n, name }) : t('rd.added_n', { n })));
}
async function dropRef(path) {
  const bb = b();
  try { await dropAdded(bb.id, keyOf(path)); } catch (e) { console.error(e); }
  bb.goneNow = { ...(bb.goneNow || (bb.revs || {}).gone || {}), [E.REF_KEY + '|' + path]: Date.now() };   // noteGone: a copy elsewhere doesn't bring it back
  S.list = S.list.filter(r => r.path !== path);
  if (bb.refSkip) { for (const k of Object.keys(bb.refSkip)) { bb.refSkip[k] = bb.refSkip[k].filter(p => p !== path); if (!bb.refSkip[k].length) delete bb.refSkip[k]; } if (!Object.keys(bb.refSkip).length) delete bb.refSkip; }
  saved(); tell();
}
function dropDoc() { dropReadingDoc(b().id); tell(); }

// Readings, from More for this paper: the files for everyone, and this student's own set. Done closes it.
export function ReadingsDialog({ st, cur, onClose }) {
  const list = useList(), all = list.filter(r => !r.for), own = list.filter(r => r.for === st.key), doc = docNow(), name = shownName(st, cur);
  const forAll = useRef(null), forOne = useRef(null);
  const pick = ref => { const i = ref.current; if (i) { i.value = ''; i.click(); } };
  const take = (ref, who) => e => { const fs = [...e.currentTarget.files]; e.currentTarget.value = ''; if (fs.length) addRefs(fs, who); };
  return <Dialog open title={t('rd.title')} onClose={onClose} actions={<Button variant="primary" onClick={onClose} data-rddone>{t('rd.done')}</Button>}>
    <div class="mk-rd" data-readings>
      <p class="mute">{t('rd.about')}</p>
      <h3>{t('rd.everyone')}</h3>
      {all.length || doc ? <div class="rd-list">
        {doc && <div class="rd-row"><b data-raw>{doc.name}</b><span class="mute">{t('rd.your_doc')}</span><span class="grow" /><Button size="sm" onClick={dropDoc} data-rddoc>{t('rd.remove')}</Button></div>}
        {all.map(r => <div class="rd-row" key={r.path}><b data-raw>{r.name}</b><span class="grow" /><Button size="sm" onClick={() => dropRef(r.path)} data-rdrm={r.path}>{t('rd.remove_all')}</Button></div>)}
      </div> : <p class="mute">{t('rd.none')}</p>}
      <div class="rd-btns"><Button size="sm" variant="primary" icon="plus" onClick={() => pick(forAll)} data-rdadd>{t('rd.add_all')}</Button>
        <input ref={forAll} type="file" multiple hidden onChange={take(forAll, null)} data-rdfile /><DriveButton input={forAll} data-rddrive /></div>
      <h3>{t('rd.for', { name })}</h3>
      {all.length > 0 && <div class="rd-list">{all.map(r => <div class="rd-row" key={'on:' + r.path} data-rdon={r.path}><Checkbox label={t('rd.show', { file: r.name })} checked={!skipped(st, r)} onChange={on => setSkip(st, r.path, !on)} /></div>)}</div>}
      {own.length > 0 && <div class="rd-list">{own.map(r => <div class="rd-row" key={r.path}><b data-raw>{r.name}</b><span class="mute">{t('rd.only', { name })}</span><span class="grow" /><Button size="sm" onClick={() => dropRef(r.path)} data-rdrm={r.path}>{t('rd.remove')}</Button></div>)}</div>}
      <div class="rd-btns"><Button size="sm" icon="plus" onClick={() => pick(forOne)} data-rdmine>{t('rd.add_one', { name })}</Button>
        <input ref={forOne} type="file" multiple hidden onChange={take(forOne, st)} data-rdfileone /><DriveButton input={forOne} data-rddriveone /></div>
      {all.length > 0 && <p class="mute rd-hint">{t('rd.hint')}</p>}
    </div>
  </Dialog>;
}

// The cards above the paper: her kept Word document, then this student's readings.
export function Cards({ st }) {
  useList();
  const doc = docNow(), list = refsFor(st);
  if (!doc && !list.length) return null;
  return <div class="rd-cards" data-rdcards>
    {doc && <Card key={'doc:' + doc.name} st={st} r={{ path: '', name: doc.name, data: null, doc }} />}
    {list.map(r => <Card key={st.key + '|' + r.path} st={st} r={r} />)}
  </div>;
}
const ZMIN = 0.5, ZMAX = 3;
const unb64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
// One reading (refCard): PDF and picture pages, a Word file or text with a zoom bar and a box she can drag taller, a recording, or a
// file that can't be shown here. Open or folded, the zoom and the height are remembered for this file in this browser.
function Card({ st, r }) {
  const doc = !!r.doc, ok = doc ? 'gs.rdOpen' : 'gs.refOpen.' + r.path, zk = 'gs.refZoom.' + r.path, hk = 'gs.refH.' + r.path;
  const [open, setOpen] = useState(prefs.get(ok, true) !== false);
  const [zoom, setZoomNow] = useState(() => (doc ? 1 : Math.min(ZMAX, Math.max(ZMIN, +prefs.get(zk, 1) || 1))));
  const [kind, setKind] = useState('');   // '' while it is read, then 'frame', 'media', 'other' or 'bad'
  const scroll = useRef(null), view = useRef(null), media = useRef(null), z = useRef(zoom), timer = useRef(0);
  const height = doc ? 0 : +prefs.get(hk, 0) || 0;
  useEffect(() => {
    let live = true, close = () => {};
    (async () => {
      const data = doc ? unb64(r.doc.b64) : r.data;
      if (!data) throw new Error('no data');
      if (/\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?|avif)$/i.test(r.name) && !state().PDFLib) use({ PDFLib: await PARTS.pdflib() });
      const f = await E.makeFile('reading/' + (r.path || r.name), data.slice());
      if (!live) return;
      const host = scroll.current;
      if (f.kind === 'docx' || f.kind === 'text') {
        let c;
        if (f.kind === 'docx') { const card = (await PARTS.word()).wordCard(st, f, null, { readOnly: true }); close = card.close; c = card.el; }
        else { c = document.createElement('div'); c.className = 'docx'; const p = document.createElement('div'); p.className = 'dpage ftext'; p.dataset.raw = ''; p.textContent = new TextDecoder().decode(f.data); c.append(p); }
        const hd = c.querySelector('.fhead'); if (hd) hd.remove();
        if (!live) return close();
        view.current = { apply: () => { c.style.zoom = z.current; } };
        view.current.apply(); host.replaceChildren(c); setKind('frame');
      } else if (viewable(f)) {
        const pdfjs = await libs(), pdf = await pdfjs.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
        if (!live) return pdf.destroy();
        close = () => pdf.destroy();
        const box = document.createElement('div'); box.className = 'rd-pages'; host.replaceChildren(box); setKind('frame');
        const dpr = window.devicePixelRatio || 1, w = Math.min(860, (host.clientWidth || 900) - 16), turn = { rot: f.photoTurn ? { 0: f.photoTurn } : null };
        const pgs = [];
        for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i), c = document.createElement('canvas'); pgs.push({ page, c, v1: vpRot(turn, i - 1, page, 1), i, drawn: 0 }); box.append(c); }
        // a quick look while zooming: what is drawn is stretched; then each page is drawn sharp at the new size
        let job = 0;
        view.current = { apply: async quick => {
          const pw = Math.round(w * z.current);
          for (const p of pgs) { p.c.style.width = pw + 'px'; p.c.style.height = Math.round(pw * p.v1.height / p.v1.width) + 'px'; }
          if (quick) return;
          const me = ++job;
          for (const p of pgs) {
            if (me !== job || !live) return;
            if (p.drawn === pw) continue;
            const vp = vpRot(turn, p.i - 1, p.page, pw / p.v1.width * dpr), off = document.createElement('canvas');
            off.width = Math.ceil(vp.width); off.height = Math.ceil(vp.height);
            const ctx = off.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, off.width, off.height);
            await p.page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjs.AnnotationMode.ENABLE }).promise;
            if (me !== job || !live) return;
            p.c.width = off.width; p.c.height = off.height; p.c.getContext('2d').drawImage(off, 0, 0); p.drawn = pw;
          }
        } };
        await view.current.apply();
      } else if (f.kind === 'media') {
        const v = document.createElement(/\.(mp4|mov|webm|m4v)$/i.test(r.name) ? 'video' : 'audio'), url = URL.createObjectURL(new Blob([data]));
        v.controls = true; v.src = url; v.style.width = '100%';
        close = () => URL.revokeObjectURL(url);
        media.current.replaceChildren(v); setKind('media');
      } else setKind('other');
    })().catch(e => { if (!live) return; console.error(e); setKind('bad'); });   // (a card let go of while it was drawn stops quietly)
    return () => { live = false; clearTimeout(timer.current); close(); };
  }, [r.path, r.name, r.data, doc && r.doc.at]);
  const setZoom = (to, now) => {
    to = Math.round(Math.min(ZMAX, Math.max(ZMIN, to)) * 100) / 100;
    if (to === z.current || !view.current) return;
    const s = scroll.current, fx = s.scrollLeft / Math.max(1, s.scrollWidth), fy = s.scrollTop / Math.max(1, s.scrollHeight);
    z.current = to; setZoomNow(to); prefs.set(zk, to);
    clearTimeout(timer.current);
    const go = async () => { try { await view.current.apply(); } catch { return; } s.scrollLeft = fx * s.scrollWidth; s.scrollTop = fy * s.scrollHeight; };
    if (now) go(); else { view.current.apply(true); timer.current = setTimeout(go, 160); }
  };
  // Ctrl + scroll zooms the reading, not the papers under it
  useEffect(() => {
    const s = scroll.current; if (!s || doc) return;
    const wheel = e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); e.stopPropagation(); setZoom(z.current * Math.exp(-e.deltaY / 300)); };
    s.addEventListener('wheel', wheel, { passive: false });
    return () => s.removeEventListener('wheel', wheel);
  }, [kind]);
  const grip = e => {
    e.preventDefault(); const g = e.currentTarget, s = scroll.current; g.setPointerCapture(e.pointerId);
    const y0 = e.clientY, start = s.getBoundingClientRect().height;
    g.onpointermove = m => { const hh = Math.max(120, Math.round(start + m.clientY - y0)); s.style.maxHeight = hh + 'px'; s.style.height = hh + 'px'; };
    g.onpointerup = g.onpointercancel = () => { g.onpointermove = g.onpointerup = g.onpointercancel = null; const hh = parseInt(s.style.maxHeight) || 0; if (hh) prefs.set(hk, hh); s.style.height = ''; };
  };
  const gripKey = e => { if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault(); const s = scroll.current, hh = Math.max(120, Math.round(s.getBoundingClientRect().height + (e.key === 'ArrowDown' ? 60 : -60))); s.style.maxHeight = hh + 'px'; prefs.set(hk, hh); };
  const hide = e => {
    e.preventDefault(); e.stopPropagation();
    if (r.for) return dropRef(r.path);
    setSkip(st, r.path, true); toast(t('rd.hidden'));
  };
  // while it is read, the card already takes the room it will (the bar and grip kept in place unseen, and a PDF or picture the
  // reading's full height), so a card above that finishes drawing doesn't push the one she is reaching for down the screen
  const frame = kind === 'frame' || kind === '', wait = kind === '' ? ' rd-wait' : '', tall = kind === '' && /\.(pdf|png|jpe?g|gif|webp|bmp|heic|heif|tiff?|avif)$/i.test(r.name);
  return <details class="rd-card" open={open} onToggle={e => { const o = e.currentTarget.open; if (o !== open) { setOpen(o); prefs.set(ok, o); } }} data-rdcard={r.path || 'doc'}>
    <summary>{doc ? <span>{t('rd.doc_card', { name: r.doc.name })}</span> : <><span data-raw>{r.name}</span> <span class="mute">· {t(r.for ? 'rd.card_one' : 'rd.card_all')}</span>
      <button type="button" class="link" onClick={hide} data-rdhide>{t(r.for ? 'rd.remove' : 'rd.hide')}</button></>}</summary>
    <div class="rd-body">
      {frame && !doc && <div class={'rd-bar' + wait} role="toolbar" aria-label={t('rd.zoom')}>
        <span class="seg"><button type="button" title={t('rd.zoom_out')} aria-label={t('rd.zoom_out')} onClick={() => setZoom(z.current / 1.25, true)} data-rz="-">−</button>
          <button type="button" class="rzv" title={t('rd.zoom_fit')} onClick={() => setZoom(1, true)} data-rz="1">{Math.round(zoom * 100)}%</button>
          <button type="button" title={t('rd.zoom_in')} aria-label={t('rd.zoom_in')} onClick={() => setZoom(z.current * 1.25, true)} data-rz="+">+</button></span>
        <span class="mute">{t('rd.zoom_how')}</span></div>}
      <div ref={scroll} class={'rd-scroll' + (tall ? ' rd-tall' : '')} hidden={!frame} style={height ? { maxHeight: height + 'px' } : undefined}>{kind === '' && <div class="loading" aria-busy="true" />}</div>
      {frame && !doc && <div class={'rd-grip' + wait} role="separator" aria-orientation="horizontal" tabindex="0" title={t('rd.grip')} aria-label={t('rd.grip')} onPointerDown={grip} onKeyDown={gripKey} />}
      <div ref={media} hidden={kind !== 'media'} />
      {kind === 'other' && <div class="fcard other"><Icon name="file" /><div class="grow"><b data-raw>{r.name}</b><p>{t('rd.cant')}</p></div></div>}
      {kind === 'bad' && <p class="mute">{t('rd.cant')}</p>}
    </div>
  </details>;
}
