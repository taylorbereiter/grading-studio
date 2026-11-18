// Arrange pages (src/app/arrange.js openArrange): a student's papers as files of pages. Pick pages (click, Shift for a run, Ctrl or ⌘
// to add one), then drag them, or move them with the buttons or the arrow keys, take them out, turn them, combine files, start a new
// file, rename a file or leave it out of what goes back. Pages taken out wait in a tray. Nothing changes until Save, which is one
// step on the undo list (mark/change.js arrangeSave). Loaded with the file tools (mark/fileui.jsx).
import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, Checkbox, Segmented, useModal, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import * as D from '../../engines/gdraw.js';
import { thumbCache } from '../../engines/gmark.js';
import { shownName } from '../../engines/gdraw.js';
import { fileShown } from '../../engines/gfiles.js';
import { prefs } from '../../students/prefs.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './lines.js';

const SIZES = [90, 130, 190];
const isMac = () => /Mac|iP/.test(navigator.platform || '');
// A page's small picture (thumbFor), from the open student's documents. While names are hidden it isn't drawn, since its name covers
// aren't here yet.
async function thumbFor(st, path, p, extra) {
  const f = D.fileByPath(st, path), r = (D.rotOf(f, p) + (extra || 0)) % 360, k = path + '|' + p + '|' + r + (D.skewOf(f, p) ? '|' + D.skewOf(f, p) : '');
  if (D.anonOn()) return '';
  if (thumbCache.has(k)) return thumbCache.get(k);
  const doc = state().docMap.get(path); if (!doc) return '';
  const page = await doc.getPage(p + 1), at = sc => page.getViewport({ scale: sc, rotation: ((page.rotate || 0) + r) % 360 });
  const vp = at(180 / at(1).width), c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp, transform: D.skewXf(f, p, vp), annotationMode: state().pdfjsLib.AnnotationMode.ENABLE }).promise;
  const u = c.toDataURL('image/jpeg', 0.7);
  thumbCache.set(k, u);
  return u;
}
function Thumb({ st, it, turn }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; thumbFor(st, it[0], it[1], 90 * turn).then(u => { if (live) setSrc(u); }, () => {}); return () => { live = false; }; }, [it, turn]);
  return src ? <img src={src} alt="" draggable={false} /> : <span class="ph" />;
}
// The page big, on a double-click (bigPage).
function Big({ st, it, turn, onClose }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; (async () => {
    if (D.anonOn()) return;
    const f = D.fileByPath(st, it[0]), doc = state().docMap.get(it[0]); if (!doc) return;
    const page = await doc.getPage(it[1] + 1), r = (D.rotOf(f, it[1]) + 90 * turn) % 360, at = sc => page.getViewport({ scale: sc, rotation: ((page.rotate || 0) + r) % 360 });
    const vp = at(1400 / at(1).width), c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, transform: D.skewXf(f, it[1], vp) }).promise;
    if (live) setSrc(c.toDataURL('image/jpeg', 0.85));
  })().catch(e => console.error(e)); return () => { live = false; }; }, [it]);
  return <div class="arr-big" onClick={onClose} role="presentation">{src ? <img src={src} alt={t('mark.a_page', { n: it[1] + 1 })} /> : <div class="loading" aria-busy="true" />}</div>;
}

export function Arrange({ st, onClose }) {
  const A = useRef(null);
  if (!A.current) A.current = { ...C.arrangeStart(st), sel: new Set(), anchor: null, turns: new Map(), everyone: false, drag: false };
  const a = A.current, [, tick] = useState(0), redraw = () => tick(n => n + 1);
  const [size, setSize] = useState(() => { const v = +prefs.get('gs.arrsize', 1); return v >= 0 && v <= 2 ? v : 1; }), [big, setBig] = useState(null), [ins, setIns] = useState(null);
  const p = useModal(true, onClose, { initial: '[data-asave]' });
  const anon = D.anonOn(), bb = state().batch;
  const lists = () => a.L.map(d => d.pages).concat([a.tray]);
  const listOf = w => w === 'tray' ? a.tray : a.L[+w].pages;
  const picked = () => lists().flatMap(l => l.filter(it => a.sel.has(it)));
  const turnOf = it => a.turns.get(it[0] + '|' + it[1]) || 0;
  const nameOf = path => fileShown(st, (D.fileByPath(st, path) || { name: path }).name);
  const first = () => { if (!a.sel.size) { toast(t('mark.a_pick_first')); return false; } return true; };
  const move = how => {
    if (!first()) return;
    for (const l of lists()) {
      if (how === 'start' || how === 'end') { const x = l.filter(it => a.sel.has(it)), y = l.filter(it => !a.sel.has(it)); l.splice(0, l.length, ...(how === 'start' ? x.concat(y) : y.concat(x))); }
      else if (how < 0) { for (let i = 1; i < l.length; i++) if (a.sel.has(l[i]) && !a.sel.has(l[i - 1])) [l[i - 1], l[i]] = [l[i], l[i - 1]]; }
      else { for (let i = l.length - 2; i >= 0; i--) if (a.sel.has(l[i]) && !a.sel.has(l[i + 1])) [l[i], l[i + 1]] = [l[i + 1], l[i]]; }
    }
    redraw();
  };
  const turn = () => { if (!first()) return; for (const it of picked()) a.turns.set(it[0] + '|' + it[1], (turnOf(it) + 1) % 4); redraw(); };
  const takeOut = () => { if (!first()) return; for (const d of a.L) { const out = d.pages.filter(it => a.sel.has(it)); d.pages = d.pages.filter(it => !a.sel.has(it)); a.tray.push(...out); } redraw(); };
  const light = () => {
    if (!first()) return;
    const its = picked().map(([path, n]) => [D.fileByPath(st, path), n]).filter(([f]) => f);
    const on = !its.every(([f, n]) => D.pageLit(st, f, n, a.lp));
    for (const [f, n] of its) D.setPageLit(st, f, n, on, a.lp);
    redraw();
  };
  const pick = (e, it, l) => {
    if (e.shiftKey && a.anchor && l.includes(a.anchor)) { const x = l.indexOf(a.anchor), y = l.indexOf(it); a.sel = new Set(l.slice(Math.min(x, y), Math.max(x, y) + 1)); }
    else if (e.metaKey || e.ctrlKey) { a.sel.has(it) ? a.sel.delete(it) : a.sel.add(it); a.anchor = it; }
    else { a.sel = new Set([it]); a.anchor = it; }
    redraw();
  };
  const keys = e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || big) return;
    if (!a.sel.size) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); takeOut(); }
    else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); turn(); }
  };
  // Dragging: the picked pages land in front of the first page at the drop spot that isn't itself moving.
  const dropIndex = (zone, e) => {
    const kids = [...zone.querySelectorAll('.ath')];
    for (let k = 0; k < kids.length; k++) { const r = kids[k].getBoundingClientRect(); if (e.clientY < r.top) return k; if (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2) return k; }
    return kids.length;
  };
  const drop = (w, e) => {
    e.preventDefault(); setIns(null);
    if (!a.drag) return;
    const dst = listOf(w), k = dropIndex(e.currentTarget, e), moving = picked();
    let before = null; for (let j = k; j < dst.length; j++) if (!a.sel.has(dst[j])) { before = dst[j]; break; }
    for (const l of lists()) for (let j = l.length - 1; j >= 0; j--) if (a.sel.has(l[j])) l.splice(j, 1);
    dst.splice(before ? dst.indexOf(before) : dst.length, 0, ...moving);
    a.drag = false; redraw();
  };
  const col = (items, w, head) => <div class="acol" data-where={w}>{head}
    <div class={'adrop' + (ins && ins.w === w && ins.k >= items.length ? ' insEnd' : '')} data-where={w}
      onDragOver={e => { if (!a.drag) return; e.preventDefault(); const k = dropIndex(e.currentTarget, e); if (!ins || ins.w !== w || ins.k !== k) setIns({ w, k }); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIns(null); }}
      onDrop={e => drop(w, e)} onClick={e => { if (e.target === e.currentTarget) { a.sel = new Set(); redraw(); } }}>
      {items.map((it, i) => { const f = D.fileByPath(st, it[0]), off = a.lit && f && !D.pageLit(st, f, it[1], a.lp), on = a.sel.has(it);
        return <div key={it[0] + '|' + it[1]} class={'ath' + (on ? ' sel' : '') + (on && a.drag ? ' dragging' : '') + (ins && ins.w === w && ins.k === i ? ' ins' : '')} draggable
          onDragStart={e => { if (!a.sel.has(it)) { a.sel = new Set([it]); a.anchor = it; } a.drag = true; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'page'); redraw(); }}
          onDragEnd={() => { a.drag = false; setIns(null); redraw(); }}>
          <button type="button" class="apick" aria-pressed={on ? 'true' : 'false'} onClick={e => pick(e, it, items)} onDblClick={() => setBig(it)} data-apg={it[0] + '|' + it[1]}
            aria-label={t('mark.a_page', { n: it[1] + 1 }) + (a.many ? ', ' + nameOf(it[0]) : '')}>
            <Thumb st={st} it={it} turn={turnOf(it)} />
            <span class="cap">{w === 'tray' ? '' : <b>{i + 1}</b>}{w === 'tray' ? '' : ' · '}{t('mark.a_page', { n: it[1] + 1 })}{a.many ? <span data-raw>{' · ' + nameOf(it[0])}</span> : ''}</span>
          </button>
          {off && <span class="aoff">{t('mark.a_light_off')}</span>}
          {w !== 'tray' && <button type="button" class="rm" title={t('mark.a_take_one')} aria-label={t('mark.a_take_one')} onClick={() => { a.tray.push(...listOf(w).splice(i, 1)); redraw(); }} data-arm={w + ':' + i}>×</button>}
        </div>; })}
      {!items.length && <div class="empty">{t(w === 'tray' ? 'mark.a_tray_empty' : 'mark.a_drag_here')}</div>}
    </div></div>;
  const strip = a.strip = C.stripNow(a.L, a.strip), cards = strip.some(x => typeof x === 'string');
  const cardName = id => { const f = D.fileByPath(st, id.slice(2)); return fileShown(st, f ? f.name : id.slice(2)); };
  const kindOf = id => { const f = D.fileByPath(st, id.slice(2)); return !f ? '' : t(f.kind === 'docx' ? 'mark.a_word' : f.kind === 'text' ? 'mark.a_text' : 'mark.a_file'); };
  const n = a.sel.size, none = !n;
  const save = async () => {
    const r = await C.arrangeSave(st, { L: a.L, strip: a.strip, everyone: a.everyone, lp: a.lp, turns: a.turns });
    onClose();
    if (r) toast(t('mark.a_same_n', { n: r }));
    toast(t('mark.a_saved'), { undo: C.undo });
  };
  return <dialog class="dlg mk-arr" aria-labelledby="arrT" {...p} onKeyDown={e => { p.onKeyDown(e); keys(e); }}>
    <header><h2 id="arrT">{t('mark.a_title')}</h2><span class="mute" data-raw>{shownName(st, bb.students.indexOf(st))}</span></header>
    <div class="arrbar">
      <Segmented label={t('mark.a_size')} value={String(size)} onChange={v => { setSize(+v); prefs.set('gs.arrsize', +v); }}
        options={[{ value: '0', label: t('mark.a_s') }, { value: '1', label: t('mark.a_m') }, { value: '2', label: t('mark.a_l') }]} />
      <Button size="sm" disabled={none} onClick={() => move('start')} title={t('mark.a_start_tip')} data-amv="start">{t('mark.a_start')}</Button>
      <Button size="sm" disabled={none} onClick={() => move(-1)} title={t('mark.a_earlier_tip')} data-amv="-1">{t('mark.a_earlier')}</Button>
      <Button size="sm" disabled={none} onClick={() => move(1)} title={t('mark.a_later_tip')} data-amv="1">{t('mark.a_later')}</Button>
      <Button size="sm" disabled={none} onClick={() => move('end')} title={t('mark.a_end_tip')} data-amv="end">{t('mark.a_end')}</Button>
      <Button size="sm" disabled={none} onClick={takeOut} title={t('mark.a_out_tip')} data-aout>{t('mark.a_out')}</Button>
      <Button size="sm" icon="turnr" disabled={none} onClick={turn} title={t('mark.a_turn_tip')} data-aturn>{t('mark.a_turn')}</Button>
      {a.lit && <Button size="sm" icon="sun" disabled={none} onClick={light} data-alight>{t('mark.a_light')}</Button>}
      <span class="grow" /><span class={'mute' + (n ? ' on' : '')} role="status">{n ? t('mark.a_picked', { n }) : t('mark.a_picked_none')}</span>
    </div>
    {cards && <div class="aseq"><div class="aseqh"><b>{t('mark.a_order')}</b><span class="mute">{t('mark.a_order_text')}</span><span class="grow" />
      <Checkbox checked={a.everyone} onChange={v => { a.everyone = v; redraw(); }} label={t('mark.a_order_all')} /></div>
      <ol class="aseqr">{strip.map((x, k) => <li class={'aseqc' + (typeof x === 'string' ? ' card' : '')}><b>{k + 1}</b> <span data-raw>{typeof x === 'string' ? cardName(x) : fileShown(st, x.name)}</span>
        <span class="mute">{typeof x === 'string' ? kindOf(x) : t('mark.f_pages', { n: x.pages.length })}</span>
        <button type="button" title={t('mark.a_f_earlier')} aria-label={t('mark.a_f_earlier')} disabled={!k} onClick={() => { [strip[k - 1], strip[k]] = [strip[k], strip[k - 1]]; redraw(); }} data-sq={k + ':-1'}>←</button>
        <button type="button" title={t('mark.a_f_later')} aria-label={t('mark.a_f_later')} disabled={k >= strip.length - 1} onClick={() => { [strip[k], strip[k + 1]] = [strip[k + 1], strip[k]]; redraw(); }} data-sq={k + ':1'}>→</button></li>)}</ol></div>}
    <p class="mute ahint">{t('mark.a_hint', { mod: isMac() ? '⌘' : 'Ctrl' })}</p>
    <div class="body arrbody" style={{ '--aw': SIZES[size] + 'px' }}><div class="acols">
      {a.L.map((d, di) => col(d.pages, String(di), <div class="ahead">
        <input type="text" class="input" value={fileShown(st, d.name)} aria-label={t('mark.a_name')} readOnly={anon} title={anon ? t('mark.a_name_hidden') : undefined}
          onInput={e => { d.name = e.currentTarget.value; }} data-aname={di} data-raw />
        <Checkbox checked={D.docIn(st, d)} onChange={v => { d.out = !v; redraw(); }} label={t('mark.a_send')} />
        {a.L.length > 1 && <button type="button" class="link" onClick={() => { a.tray.push(...d.pages); a.L.splice(di, 1); redraw(); }} data-adel={di}>{t('mark.a_del_file')}</button>}
      </div>))}
      {col(a.tray, 'tray', <div class="ahead"><b>{t('mark.a_tray')}</b><small class="mute">{t('mark.a_tray_text')}</small></div>)}
    </div></div>
    <footer class="arrfoot"><span class="grp">
      <Button onClick={() => { const keep = a.L.filter(d => !d.out), from = keep.length ? keep : a.L, one = from[0] || { name: 'Combined.pdf' };
        a.L = [{ name: one.name, pages: from.flatMap(d => d.pages), out: false }].concat(a.L.filter(d => keep.length && d.out)); redraw(); }} data-acombine>{t('mark.a_combine')}</Button>
      <Button icon="plus" onClick={() => { a.L.push({ name: t('mark.a_new_name', { n: a.L.length + 1 }) + '.pdf', pages: [], out: false }); redraw(); }} data-anew>{t('mark.a_new')}</Button>
      <Button variant="quiet" onClick={() => { Object.assign(a, C.arrangeReset(st), { tray: [], sel: new Set() }); redraw(); }} data-areset>{t('mark.a_reset')}</Button></span>
      <span class="grp"><Button onClick={onClose}>{t('mark.cancel')}</Button><Button variant="primary" onClick={save} data-asave>{t('mark.a_save')}</Button></span></footer>
    {big && <Big st={st} it={big} turn={turnOf(big)} onClose={() => setBig(null)} />}
  </dialog>;
}
