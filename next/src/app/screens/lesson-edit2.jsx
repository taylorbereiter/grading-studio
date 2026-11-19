// The lesson editor's second part (router.js PARTS edit2), loaded when the editor opens: what the editor does beyond typing, kept
// out of lesson-edit.jsx so both stay inside the route budget. The planner engine and its tools come in from the editor (E, T), so
// this part carries only its own code and lines.
//
// A Video slide's link (src/planner/lessons.js videoDlg, setVideo): a YouTube link or any web link, where it starts, and taking it off.
// Kept on the slide as the current Planner keeps it: s.video = { url, title, by, start, thumb }.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useLayoutEffect } from 'preact/hooks';
import { Button, Icon, TextInput, Sheet, Checkbox, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import '../plan/les-lines.js';
import '../plan/edit-lines.js';
import '../plan/lines.js';
import { ExamplePicker } from '../plan/example-pick.jsx';
import { isExample, exampleSize } from '../plan/examples.js';
import { LazyDrive } from '../drive-lazy.js';
import { TextBox } from '../../ui/services.jsx';
import { planTime } from '../../planning/index.js';

const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
// The link to open: a YouTube video starts where the slide says (lessons.js videoLink).
export const videoLink = (T, v) => { const id = T.ytId(v.url); return id ? 'https://www.youtube.com/watch?v=' + id + (v.start ? '&t=' + v.start + 's' : '') : v.url; };
// A link on a slide (lessons.js setVideo): the same link keeps what was found before; a new one asks YouTube for its title and picture.
export async function videoPatch(T, s, url, start) {
  const v = s.video && s.video.url === url ? { ...s.video } : await T.videoFrom(url);
  if (start != null) v.start = start;
  const p = { video: v, layout: 'video' };
  if (!s.title && v.title) p.title = v.title.length > 48 ? v.title.slice(0, 46).trim() + '…' : v.title;
  return p;
}

// Under the slide's boxes on a Video slide: add or change the link, and watch it.
export function VideoRow({ s, T, onOpen }) {
  return <div class="row vidrow"><Button size="sm" icon="play" onClick={onOpen} data-focus="video-link">{s.video ? t('les.video_change') : t('les.video_add')}</Button>
    {s.video && <a class="btn sm quiet" href={videoLink(T, s.video)} target="_blank" rel="noopener" data-focus="video-watch">{t('les.video_watch')}<Icon name="arrow" size="xs" /></a>}</div>;
}

export function VideoSheet({ s, T, onPatch, onClose }) {
  const v = s.video || {}, [u, setU] = useState(v.url || ''), [st, setSt] = useState(v.start ? mmss(v.start) : ''), [busy, setBusy] = useState(false);
  useEffect(() => { setU(v.url || ''); setSt(v.start ? mmss(v.start) : ''); }, [s.id]);
  const use = async () => {
    let x = u.trim(); if (x && !/^https?:\/\//i.test(x)) x = 'https://' + x;
    if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(x)) return toast(t('les.video_bad'));
    const m = /^\s*(?:(\d+):)?(\d+)\s*$/.exec(st), start = m ? (+m[1] || 0) * 60 + +m[2] : 0;
    setBusy(true); try { onPatch(await videoPatch(T, s, x, start)); onClose(); } finally { setBusy(false); }
  };
  return <Sheet open title={t('les.video')} icon={<Icon name="play" />} onClose={onClose} footer={<>
    {s.video && <Button variant="quiet" icon="trash" onClick={() => { onPatch({ video: undefined }); onClose(); }} data-focus="video-off">{t('les.video_off')}</Button>}
    <span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={use} disabled={busy} data-focus="video-use">{t('les.video_use')}</Button></>}>
    <TextInput label={t('les.video_url')} placeholder={t('les.video_url_ph')} value={u} onInput={setU} onKeyDown={e => { if (e.key === 'Enter') use(); }} data-focus="video-url" autoFocus />
    <TextInput label={t('les.video_start')} placeholder="0:00" value={st} onInput={setSt} data-focus="video-start" />
    <p class="mute">{t('les.video_about')}</p>
  </Sheet>;
}

// The look of every slide in the lesson (src/planner/looks.js lookDlg): colors and background; layouts and text stay.
// k: what the editor hands over (the plan, the engine and its tools, the slide drawing, the kv write, the looks' lines).
export function LookSheet({ k: { p, T, Slide, saveKv, LOOK_LINE }, d, s, onPick, onClose }) {
  const cur = T.lookOf(d), [mine, setMine] = useState(p.deflook === cur);
  const pick = k => { onPick(k); if (mine) saveKv('deflook', k).catch(e => console.error(e)); toast(t('edit.look_set', { name: t(LOOK_LINE[k]) })); };
  return <Sheet open wide title={t('edit.look')} icon={<Icon name="image" />} onClose={onClose} footer={<><Checkbox label={t('edit.look_default')} checked={mine} onChange={v => { setMine(v); saveKv('deflook', v ? T.lookOf(d) : '').catch(e => console.error(e)); }} /><span class="grow" /><Button onClick={onClose}>{t('common.close')}</Button></>}>
    <p class="mute">{t('edit.look_about')}</p>
    <div class="looks">{Object.keys(T.LOOKS).filter(k => k !== 'wood' || T.ownTpl()).map(k => <button type="button" class={'look' + (k === cur ? ' on' : '')} aria-pressed={String(k === cur)} onClick={() => pick(k)} data-look={k}>
      <Slide slide={s} lesson={{ ...d, look: k }} plan={p} width={164} /><span>{t(LOOK_LINE[k])}{k === 'wood' ? ' ' + t('edit.look_yours') : ''}</span></button>)}</div>
  </Sheet>;
}
export function Tips({ onClose }) {
  return <Sheet open title={t('edit.tips')} icon={<Icon name="info" />} onClose={onClose} footer={<><span class="grow" /><Button variant="primary" onClick={onClose}>{t('common.close')}</Button></>}>
    <ul class="tips">{['edit.tip_box', 'edit.tip_move', 'edit.tip_lists', 'edit.tip_format', 'edit.tip_keys', 'edit.tip_undo', 'edit.tip_pic', 'edit.tip_comment'].map(k => <li>{t(k)}</li>)}</ul>
  </Sheet>;
}

// A picture from this computer, made small enough to keep in a lesson as the current Planner does (src/planner/lessons.js shrinkPic):
// 1600 px is plenty for a slide.
async function shrinkPic(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = url; });
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
export function PictureField({ s, setSlide }) {
  const [picking, setPicking] = useState(false);
  const file = async e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; if (!f) return; try { setSlide({ img: { ...(await shrinkPic(f)), source: s.img ? s.img.source : '' } }, true); } catch { } };
  const ex = s.img && isExample(s.img.src);
  return <div class="picfield"><span class="lab">{t('plan.picture')}</span>
    {ex && <p class="mute">{t('plan.example_ref')}</p>}
    <div class="row"><label class="btn sm"><Icon name="upload" />{s.img ? t('plan.replace_picture') : t('plan.choose_picture')}<input type="file" accept="image/*" class="vh" onChange={file} /></label><LazyDrive />
      <Button size="sm" icon="image" onClick={() => setPicking(true)} data-focus="add-example">{t('plan.add_example')}</Button>
      {s.img && <Button size="sm" variant="quiet" icon="trash" onClick={() => setSlide({ img: undefined }, true)}>{t('plan.remove_picture')}</Button>}</div>
    {s.img && !ex && <TextInput label={t('plan.picture_source')} value={s.img.source || ''} onInput={v => setSlide({ img: { ...s.img, source: v.replace(/\n+/g, ' ') } })} />}
    <ExamplePicker open={picking} onClose={() => setPicking(false)} onPick={async ref => { setPicking(false); const z = await exampleSize(ref); setSlide({ img: { src: ref, w: z.w, h: z.h, source: '' } }, true); }} />
  </div>;
}

// The frame round the box picked on the slide (src/planner/boxes.js boxFrame): drag the bar to move it, a corner or side to resize it,
// snapped to 4 slide units and kept on the slide. Kept on the slide as s.box[k] = { x, y, w, h } in 1280 x 720 slide units.
const BOX_MIN_W = 80, BOX_MIN_H = 36;
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
export function Frame({ host, k, name, moved, onDone, onBack }) {
  const [r, setR] = useState(null), drag = useRef(null);
  const find = () => { const el = host.current && host.current.querySelector('.ls-slide [data-k="' + k + '"]'), sb = host.current && host.current.querySelector('.slidebox'); return el && sb ? { el, kk: sb.clientWidth / 1280 } : null; };
  useLayoutEffect(() => { if (drag.current) return; const f = find(); const n = f ? { x: f.el.offsetLeft, y: f.el.offsetTop, w: f.el.offsetWidth, h: f.el.offsetHeight, kk: f.kk } : null; if (JSON.stringify(n) !== JSON.stringify(r)) setR(n); });
  if (!r) return null;
  const down = (e, hd) => {
    const f = find(); if (!f) return; e.preventDefault(); e.stopPropagation();
    drag.current = { hd, el: f.el, kk: f.kk, x0: e.clientX, y0: e.clientY, b: { x: r.x, y: r.y, w: r.w, h: r.h }, now: null };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
  };
  const move = e => {
    const D = drag.current; if (!D) return;
    const dx = (e.clientX - D.x0) / D.kk, dy = (e.clientY - D.y0) / D.kk, sn = v => Math.round(v / 4) * 4; let { x, y, w, h } = D.b;
    if (D.hd === 'move') { x += dx; y += dy; }
    else { if (D.hd.includes('e')) w += dx; if (D.hd.includes('s')) h += dy; if (D.hd.includes('w')) { x += dx; w -= dx; } if (D.hd.includes('n')) { y += dy; h -= dy; }
      if (w < BOX_MIN_W) { if (D.hd.includes('w')) x -= BOX_MIN_W - w; w = BOX_MIN_W; } if (h < BOX_MIN_H) { if (D.hd.includes('n')) y -= BOX_MIN_H - h; h = BOX_MIN_H; } }
    x = Math.max(0, Math.min(1280 - w, sn(x))); y = Math.max(0, Math.min(720 - h, sn(y))); w = Math.min(1280 - x, sn(w)); h = Math.min(720 - y, sn(h));
    Object.assign(D.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    D.now = { x, y, w, h }; setR({ ...D.now, kk: D.kk });
  };
  const up = () => { const D = drag.current; drag.current = null; if (D && D.now) onDone(D.now); };
  const kk = r.kk;
  return <div class="edframe" style={{ left: r.x * kk + 'px', top: r.y * kk + 'px', width: r.w * kk + 'px', height: r.h * kk + 'px' }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    <span class={'grips' + (r.y * kk < 30 ? ' in' : '')}><b class="grip" onPointerDown={e => down(e, 'move')} data-h="move" title={t('edit.box_drag')}><Icon name="grip" size="xs" />{name}</b>
      {moved && <button type="button" class="grip back" onPointerDown={e => e.stopPropagation()} onClick={onBack} data-focus="box-back">{t('edit.box_back')}</button>}</span>
    {HANDLES.map(hd => <i class={'hd hd-' + hd} onPointerDown={e => down(e, hd)} data-h={hd} aria-hidden="true" />)}
  </div>;
}

// Beside the lesson's name: the time spent planning it (src/planner/plantime.js ptBadge, from a minute), whether it is saved
// (lessons.js #lsSaved). Whether the name and the title slide's title are kept the same is in the lesson's ⋯ menu (lesson-side.jsx).
export const titleSlideOf = d => d.slides.find(s => s.layout === 'title');
const plainTitle = x => String(x || '').replace(/\\([*_{])/g, (m, c) => '\u0000' + '*_{'.indexOf(c)).replace(/\*\*|__|\*|\{\/\}|\{(red|orange|green|blue|purple|gray)\}/g, '').replace(/\u0000(\d)/g, (m, i) => '*_{'[i]).replace(/\s+/g, ' ').trim();
// The lesson's name was typed: the title slide follows (lessons.js titleToSlide). A title slide's title was typed: the name follows.
export function linkTitles(n, i) {
  const s = !n.titleApart && titleSlideOf(n); if (!s) return n;
  if (i == null) s.title = n.title;
  else if (n.slides[i] === s) { const x = plainTitle(s.title); if (x) n.title = x; }
  return n;
}
const planSecs = id => { const P = planTime.json(null) || {}; let s = 0; for (const d of Object.values((P && P.days) || {})) if (d && d.a && d.a[id]) s += +d.a[id] || 0; return s; };
export function TopExtras({ d, saving }) {
  const secs = planSecs(d.id), m = Math.round(secs / 60), hr = Math.floor(m / 60);
  return <>
    {secs >= 60 && <span class="mute ptime" data-focus="plan-time" title={t('les.plan_time_tip')}>{hr ? (m % 60 ? t('les.plan_hr_min', { h: hr, m: m % 60 }) : t('les.plan_hr', { h: hr })) : t('les.plan_min', { n: m })}</span>}
    <span class="mute savest" role="status" data-focus="save-state">{saving ? t('les.saving') : t('les.saved')}</span>
  </>;
}

// Dragging and pasting in the editor (src/planner/lessons.js onLessonDrop, dropFromWeb, addVideoLink, the paste listener, startEdit):
//   a thumbnail dragged onto another moves that slide there;
//   pictures let go on the slide or a thumbnail go on that slide (a slide that can't hold one gets a picture slide after it),
//   several pictures make a slide each;
//   a picture or link from another tab: the picture is fetched where the site allows it; a YouTube link makes a video slide;
//   pasting a picture puts it on a slide, pasting a YouTube link makes a video slide;
//   clicking the picture box on the slide chooses a picture.
// A .pptx or .zip is left to the lesson page (the finished deck). k: { d, i, at, setCur, E, T } from the editor, read at the moment.
const PIC = ['picture', 'fullpic', 'textpic', 'picprompt'], canPic = s => PIC.includes(s.layout);
// Where a picture goes (lessons.js pictureSlide): the slide if it can hold one, a text slide turned into text + picture, or a new
// picture slide after it. Returns the index it went to.
function picAt(E, sl, i) {
  const s = sl[i]; if (canPic(s)) return i;
  if (s.layout === 'content' || s.layout === 'text') { s.layout = s.body.trim() ? 'textpic' : 'picture'; return i; }
  sl.splice(i + 1, 0, E.normSlide({ layout: 'picture', fmt: 2 })); return i + 1;
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export function Drops({ root, k }) {
  const K = useRef(k); K.current = k;
  const file = useRef(null);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const pics = async (list, j, source) => {
      const got = []; for (const f of list) { try { got.push(await shrinkPic(f)); } catch { } }
      if (!got.length) return;
      const { at, E } = K.current; let last = j;
      at(sl => { got.forEach((g, n) => { last = n ? last + 1 : picAt(E, sl, j); if (n) sl.splice(last, 0, E.normSlide({ layout: 'picture', fmt: 2 })); sl[last] = { ...sl[last], img: { ...g, source: n ? '' : source || '' } }; }); });
      K.current.setCur(last);
      if (got.length > 1) toast(t('les.pics_n', { n: got.length }));
    };
    // A video link (lessons.js addVideoLink): on this slide when it is an empty video or text slide, otherwise on a new one after it.
    const video = async (url, plain) => {
      const { d, i, at, E, T } = K.current, s = d.slides[i];
      if (plain && !T.ytId(url)) { if (s.layout !== 'video') return toast(t('les.links_on_video')); }
      const here = (s.layout === 'video' && (!s.video || plain)) || ((s.layout === 'content' || s.layout === 'text') && !s.body.trim() && !s.title.trim());
      const j = here ? i : i + 1, p = await videoPatch(T, here ? s : { title: '' }, url, null);
      at(sl => { if (!here) sl.splice(j, 0, E.normSlide({ layout: 'video', fmt: 2 })); sl[j] = { ...sl[j], ...p }; }, j);
    };
    const fromWeb = async dt => {
      const { T } = K.current, html = dt.getData('text/html') || '', uri = (dt.getData('text/uri-list') || '').split('\n').find(x => x && !x.startsWith('#')) || dt.getData('text/plain') || '';
      const img = ((/<img[^>]+src="([^"]+)"/i.exec(html) || [])[1] || '').replace(/&amp;/g, '&'), link = (/<a[^>]+href="([^"]+)"/i.exec(html) || [])[1] || uri;
      if (T.ytId(link) || T.ytId(uri)) return video(T.ytId(link) ? link : uri);
      const src = img || (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(uri) ? uri : '');
      if (!src) { if (/^https?:\/\//.test(uri)) return video(uri.trim(), true); return; }
      try { const r = await fetch(src, /^data:/.test(src) ? undefined : { mode: 'cors' }); if (!r.ok) throw 0; const b = await r.blob(); if (!/^image\//.test(b.type)) throw 0;
        await pics([b], K.current.i, /^data:/.test(src) ? '' : hostOf(link && !T.ytId(link) ? link : src)); }
      catch { toast(t('les.pic_blocked'), { ms: 8000 }); }
    };
    const kinds = e => [...((e.dataTransfer && e.dataTransfer.types) || [])];
    const files = e => [...((e.dataTransfer && e.dataTransfer.files) || [])];
    const ours = e => { const ty = kinds(e); return ty.includes('text/x-slide') || ty.includes('Files') || ty.includes('text/uri-list') || ty.includes('text/html'); };
    const start = e => { const th = e.target.closest && e.target.closest('.ed-list [data-slide-i]'); if (!th) return; e.dataTransfer.setData('text/x-slide', th.dataset.slideI); e.dataTransfer.effectAllowed = 'move'; };
    const over = e => { if (!ours(e)) return; e.preventDefault(); el.classList.add('dropping'); };
    const leave = e => { if (!e.relatedTarget || !el.contains(e.relatedTarget)) el.classList.remove('dropping'); };
    const drop = async e => {
      el.classList.remove('dropping');
      const fs = files(e); if (fs.some(f => /\.(pptx|zip)$/i.test(f.name))) return;   // the lesson page takes those
      if (!ours(e)) return;
      e.preventDefault(); e.stopPropagation();
      const th = e.target.closest && e.target.closest('.ed-list [data-slide-i]'), j = th ? +th.dataset.slideI : K.current.i;
      const from = e.dataTransfer.getData('text/x-slide');
      if (from !== '') { const a = +from; if (!th || a === j) return; K.current.at(sl => { const [x] = sl.splice(a, 1); sl.splice(j, 0, x); }, j); return; }
      // read now: the browser hands what was dragged over only while the drop is happening
      const got = {}; for (const x of ['text/html', 'text/uri-list', 'text/plain']) got[x] = e.dataTransfer.getData(x);
      const im = fs.filter(f => /^image\//.test(f.type));
      if (im.length) { const h = got['text/html'], src = (/<img[^>]+src="([^"]+)"/i.exec(h || '') || [])[1] || got['text/uri-list'] || ''; return pics(im, j, hostOf(src.replace(/&amp;/g, '&'))); }
      if (!fs.length) { if (th) K.current.setCur(j); return fromWeb({ getData: x => got[x] || '' }); }
    };
    const paste = e => {
      const a = e.target;
      if (!el.isConnected || document.querySelector('dialog[open]') || (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable))) return;
      const cd = e.clipboardData; if (!cd) return;
      const f = [...cd.files].filter(x => /^image\//.test(x.type));
      if (f.length) { e.preventDefault(); return pics(f.slice(0, 1), K.current.i, ''); }
      const s = (cd.getData('text/plain') || '').trim();
      if (K.current.T.ytId(s)) { e.preventDefault(); video(s); }
    };
    const click = e => { const b = e.target.closest && e.target.closest('.ed-stagewrap .ls-slide [data-k="img"]'); if (b && file.current) file.current.click(); };
    el.addEventListener('dragstart', start); el.addEventListener('dragover', over); el.addEventListener('dragleave', leave); el.addEventListener('drop', drop); el.addEventListener('click', click);
    document.addEventListener('paste', paste);
    Drops.pics = pics;
    return () => { el.removeEventListener('dragstart', start); el.removeEventListener('dragover', over); el.removeEventListener('dragleave', leave); el.removeEventListener('drop', drop); el.removeEventListener('click', click); document.removeEventListener('paste', paste); };
  }, [root.current]);
  return <input type="file" accept="image/*" class="vh" ref={file} tabIndex={-1} aria-hidden="true" data-pic-box onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; if (f) Drops.pics([f], K.current.i, ''); }} />;
}

// The layout gallery (src/planner/looks.js addSlideDlg): every layout as a small slide in the lesson's look, in the current Planner's
// three groups. mode 'add' puts a new slide after this one; 'change' changes this one and keeps its words. The small slides show this
// slide's own words in each layout (change) or the layout's name (add), so no sample text needs a line in every language.
const GROUPS = [['les.ly_start', ['title', 'agenda', 'objectives', 'warmup', 'exit']], ['les.ly_teach', ['steps', 'discuss', 'content', 'twocol', 'text', 'passage', 'vocab']], ['les.ly_pics', ['picture', 'fullpic', 'textpic', 'picprompt', 'video']]];
export function LayoutSheet({ k: { p, E, Slide, LAYOUT_LINE }, d, s, mode, onPick, onExample, onClose }) {
  const change = mode === 'change', name = x => LAYOUT_LINE[x] ? t(LAYOUT_LINE[x]) : x;
  const shown = x => change ? { ...s, layout: x } : E.normSlide({ layout: x, title: name(x), fmt: 2 });
  return <Sheet open wide title={change ? t('les.layout_for') : t('les.add_a_slide')} icon={<Icon name="plus" />} onClose={onClose} footer={<><span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button></>}>
    {change && <p class="mute">{t('les.layout_keeps')}</p>}
    {GROUPS.map(([g, ks]) => <section><h3 class="sub">{t(g)}</h3><div class="looks">{ks.filter(x => E.LAYOUTS[x]).map(x => <button type="button" class={'look' + (change && x === s.layout ? ' on' : '')} aria-pressed={change ? String(x === s.layout) : undefined} onClick={() => { onPick(x); onClose(); }} data-layout={x}>
      <Slide slide={shown(x)} lesson={d} plan={p} width={164} /><span>{name(x)}</span></button>)}</div></section>)}
    {!change && <section><h3 class="sub">{t('les.from_examples')}</h3><Button size="sm" icon="image" onClick={onExample} data-focus="ex-slides">{t('les.pick_example')}</Button></section>}
  </Sheet>;
}

// Strong examples onto slides (src/planner/plexamples.js plxToSlides): one slide a page, after this one. A whole paper fills the slide
// (Full picture), an answer or part sits under a title. Kept by reference, as every example in the new app is (plan/examples.js).
export function ExampleSlides({ k: { E, at, i }, onClose }) {
  return <ExamplePicker open many onClose={onClose} onPick={async (refs, r, pages, label) => {
    onClose();
    const sizes = await Promise.all(refs.map(ref => exampleSize(ref).catch(() => ({ w: 16, h: 10 })))), many = refs.length > 1 || r.pages > 1;
    at(sl => refs.forEach((ref, j) => sl.splice(i + 1 + j, 0, { ...E.normSlide({ layout: r.kind === 'paper' ? 'fullpic' : 'picture', title: r.kind === 'paper' ? t('les.ex_slide_n', { name: label }) : t('les.ex_slide'), size: 28, fmt: 2 }),
      img: { src: ref, w: sizes[j].w, h: sizes[j].h, source: r.title + ' · ' + label + (many ? ', ' + t('plan.page_n', { n: pages[j] + 1 }) : '') } })), i + refs.length);
    toast(refs.length === 1 ? t('les.ex_added') : t('les.ex_added_n', { n: refs.length }));
  }} />;
}

// Arrow keys and Page Up / Page Down move between slides when no box has the cursor (src/planner/lessons.js editor keys).
export function SlideKeys({ n, i, setCur }) {
  // Where she is now, read when the key comes (two quick presses can arrive before the editor draws the first).
  const at = useRef(i); at.current = i;
  useEffect(() => {
    const key = e => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = e.target, typing = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
      if (typing || document.querySelector('dialog[open], [role="menu"]')) return;
      const k = e.key, dn = k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown', up = k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp';
      if (!dn && !up) return;
      e.preventDefault(); at.current = Math.max(0, Math.min(n - 1, at.current + (dn ? 1 : -1))); setCur(at.current);
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [n]);
  return null;
}

// Clicking a box on the slide puts the cursor in that box's own field beside it (the new editor types beside the slide, not on it).
export function focusField(form, k) {
  const f = form && form.querySelector('[data-box="' + k + '"]'); if (!f) return;
  const el = f.matches('input, textarea, [contenteditable]') ? f : f.querySelector('input, textarea, [contenteditable]');
  if (el) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
}

// What she wants on this slide, for the assistant and never shown (the slide's ask, src/planner/lessons.js), from the slide's actions.
export function AskSheet({ s, ai, onSave, onClose }) {
  const [v, setV] = useState(s.ask || '');
  return <Sheet open title={t('les.slide_ask', { name: ai })} icon={<Icon name="assist" />} onClose={onClose} footer={<><span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={() => { onSave(v.trim()); onClose(); }} data-focus="ask-save">{t('common.save')}</Button></>}>
    <TextBox label={t('les.slide_ask', { name: ai })} value={v} onInput={setV} rows={4} data-focus="slide-ask" autoFocus />
  </Sheet>;
}

// The editor's own words that live in the lesson lines (lesson.en.json), so the editor's route needn't carry that file.
export const words = { layoutN: name => t('les.layout_n', { name }), addLayout: () => t('les.add_layout'), openComments: n => t('les.open_comments', { n }), slideAsk: name => t('les.slide_ask', { name }) };
