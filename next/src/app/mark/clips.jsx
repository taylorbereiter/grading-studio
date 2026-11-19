// Clips (src/video.js clipStrip, clipShow; inventory rows 361 and 521): a part of a video worth showing the class, kept as two times
// and a label in batch.clips ({ id, u: the link | p: a video file's path, a, b?, t }). Nothing is cut or copied: playing a clip starts
// the video there. A clip on a link belongs to the link, so partners with the same link see the same clips. Each add, change or
// delete is one undo step (mark/change.js clipsChange). Shown to the class, the screen has the label and the video and never a
// student's name; left and right move between clips, Esc closes. Setup > Clips to show the class plays them all in turn.
import { h, Fragment } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { Button, IconButton, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import * as V from '../../engines/gmedia.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './video-lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const span = c => (c.b != null ? t('video.cl_span', { a: V.fmtTime(c.a), b: V.fmtTime(c.b) }) : t('video.cl_from', { a: V.fmtTime(c.a) }));

// Plays a video or sound from the clip's start and stops it at its end (src/video.js clipRun).
export function runClip(m, c) {
  const go = () => { try { m.currentTime = c.a; } catch {} m.play().catch(() => {}); };
  if (m.readyState >= 1) go(); else m.addEventListener('loadedmetadata', go, { once: true });
  if (m.onclipstop) m.removeEventListener('timeupdate', m.onclipstop);
  if (c.b != null) { m.onclipstop = () => { if (m.currentTime >= c.b) { m.pause(); m.removeEventListener('timeupdate', m.onclipstop); m.onclipstop = null; } }; m.addEventListener('timeupdate', m.onclipstop); }
}
// The row of clips under a player. media(): the video or sound this page plays itself, if it does; a clip plays there, or else on
// the class's screen. hint: 'drive' when the site's player can't say where it is.
export function ClipStrip({ f, media, hint }) {
  const [form, setForm] = useState(null), [, tick] = useState(0), [show, setShow] = useState(null);
  const play = c => { const m = media && media(); if (m) runClip(m, c); else setShow(c.id); };
  const list = V.clipsOf(f), own = !!(media && media()), A = useRef(null), T = useRef(null);
  const change = fn => { C.clipsChange(fn); tick(n => n + 1); };
  const open = c => { const m = media && media(); setForm(c ? { edit: c.id, a: V.fmtTime(c.a), b: c.b != null ? V.fmtTime(c.b) : '', t: c.t } : { edit: null, a: m && m.currentTime > 0 ? V.fmtTime(m.currentTime) : '', b: '', t: '' }); };
  useEffect(() => { if (form && !form.focused) { (form.a && !form.edit ? T : form.edit ? T : A).current?.focus(); form.focused = true; } }, [form]);
  const now = k => { const m = media && media(); if (m) setForm(o => ({ ...o, [k]: V.fmtTime(m.currentTime) })); };
  const save = () => {
    const a = V.clipSecs(form.a), b = V.clipSecs(form.b);
    if (a == null || isNaN(a)) { A.current?.focus(); return toast(t('video.cl_need_start')); }
    if (isNaN(b) || (b != null && b <= a)) return toast(t('video.cl_end_after'));
    const title = form.t.trim().slice(0, 80);
    if (form.edit) change(B => { const c = (B.clips || []).find(x => x.id === form.edit); if (!c) return; c.a = a; if (b != null) c.b = b; else delete c.b; c.t = title || c.t; });
    else change(B => { const n = (B.clips ||= []).length + 1; B.clips.push({ id: uid(), ...(f.kind === 'link' ? { u: V.linkKey(f) } : { p: f.path }), a, ...(b != null ? { b } : {}), t: title || t('video.cl_n', { n }) }); });
    setForm(null);
  };
  const del = c => { change(B => { B.clips = (B.clips || []).filter(x => x.id !== c.id); }); toast(t('video.cl_deleted', { name: c.t }), { undo: C.undo }); };
  const key = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } e.stopPropagation(); };
  return <div class="clips" data-clips onKeyDown={e => e.stopPropagation()}>
    <div class="cliprow">{list.map(c => <span class="clip" data-clip={c.id}>
      <Button size="sm" icon="play" onClick={() => play(c)} title={t('video.cl_play_tip')} data-clipplay><span data-raw>{c.t}</span> <small class="mute">{span(c)}</small></Button>
      <Button size="sm" variant="quiet" onClick={() => setShow(c.id)} title={t('video.cl_show_tip')} data-clipshow>{t('video.cl_show')}</Button>
      <Button size="sm" variant="quiet" onClick={() => open(c)} data-clipedit>{t('video.cl_edit')}</Button>
      <IconButton size="sm" icon="x" label={t('video.cl_delete', { name: c.t })} onClick={() => del(c)} data-clipdel /></span>)}
      {!form && <Button size="sm" icon="plus" onClick={() => open(null)} title={t('video.cl_new_tip')} data-clipnew>{t('video.cl_new')}</Button>}</div>
    {form && <div class="clipform" onKeyDown={key}>
      <label>{t('video.cl_from_l')} <input ref={A} class="input sm" value={form.a} onInput={e => setForm(o => ({ ...o, a: e.currentTarget.value }))} placeholder="0:00" inputmode="numeric" autocomplete="off" aria-label={t('video.cl_start_l')} data-ca /></label>
      {own && <button type="button" class="link" onClick={() => now('a')}>{t('video.cl_now')}</button>}
      <label>{t('video.cl_to_l')} <input class="input sm" value={form.b} onInput={e => setForm(o => ({ ...o, b: e.currentTarget.value }))} placeholder={t('video.cl_end_ph')} inputmode="numeric" autocomplete="off" aria-label={t('video.cl_end_l')} data-cb /></label>
      {own && <button type="button" class="link" onClick={() => now('b')}>{t('video.cl_now')}</button>}
      <input ref={T} class="input sm clipname" value={form.t} onInput={e => setForm(o => ({ ...o, t: e.currentTarget.value }))} placeholder={t('video.cl_name_ph')} maxLength={80} autocomplete="off" aria-label={t('video.cl_name_l')} data-ct data-raw />
      <Button size="sm" variant="primary" onClick={save} data-clipsave>{t(form.edit ? 'video.cl_save_edit' : 'video.cl_save')}</Button>
      <Button size="sm" onClick={() => setForm(null)} data-clipcancel>{t('common.cancel')}</Button>
      <small class="mute">{t(own ? 'video.cl_hint_own' : hint === 'drive' ? 'video.cl_hint_drive' : 'video.cl_hint')} {t('video.cl_nothing_cut')}</small></div>}
    {show && <ClipStage first={show} onClose={() => setShow(null)} />}
  </div>;
}

// A site's player started at the clip, or the video or sound this page plays, from its start to its end.
function ClipPlayer({ c }) {
  const f = V.clipFile(c), ref = useRef(null);
  const url = f && f.kind === 'link' ? V.linkOf(f.data) : '', pl = !f ? null : url ? V.linkPlayer(url) : f.kind === 'media' ? { [V.VIDEO_RX.test(f.name) ? 'video' : 'audio']: URL.createObjectURL(new Blob([f.data], { type: V.MIME[V.extOf(f.name)] || '' })) } : null;
  const fr = pl && pl.frame ? V.clipFrame(pl.frame, c) : null;
  useEffect(() => { if (ref.current) runClip(ref.current, c); }, [c.id, c.a, c.b]);
  if (!pl) return <p>{t('video.cl_cant')}</p>;
  if (fr) return <><iframe src={fr.src} title={c.t} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerpolicy="strict-origin-when-cross-origin" />
    {!fr.stops && c.b != null && <p class="mute">{t('video.cl_stop_at', { b: V.fmtTime(c.b) })}</p>}</>;
  return pl.video ? <video ref={ref} controls playsInline src={pl.video} /> : <audio ref={ref} controls src={pl.audio} />;
}

// The screen the class sees: the label and the video, never a student's name. first: the clip to start on (or the first).
export function ClipStage({ first, onClose }) {
  const all = (state().batch.clips || []).filter(c => V.clipFile(c));
  const [at, setAt] = useState(Math.max(0, all.findIndex(c => c.id === first))), box = useRef(null);
  const c = all[at], cur = useRef();
  cur.current = { at, n: all.length, onClose };
  // one listener for the stage's life, set before the first paint, so an arrow never reaches the marking screen's next-student key
  useLayoutEffect(() => {
    const key = e => {
      const { at, n, onClose } = cur.current;
      if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') setAt(Math.min(n - 1, at + 1)); else if (e.key === 'ArrowLeft') setAt(Math.max(0, at - 1)); else return;
      e.preventDefault(); e.stopPropagation();
    };
    document.addEventListener('keydown', key, true); box.current?.focus();
    return () => { document.removeEventListener('keydown', key, true); try { if (document.fullscreenElement) document.exitFullscreen(); } catch {} };
  }, []);
  useEffect(() => { if (!c) onClose(); }, [c]);
  if (!c) return null;
  const full = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else box.current.requestFullscreen().catch(() => {}); } catch {} };
  return <div ref={box} class="clipstage" tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('video.cl_stage')} data-clipstage>
    <div class="clipbar"><b data-raw>{c.t}</b><span>{span(c)}</span><span class="grow" />
      {all.length > 1 && <><IconButton icon="chl" label={t('video.cl_prev')} disabled={!at} onClick={() => setAt(at - 1)} data-cs="prev" /><span data-csat>{t('video.cl_of', { n: at + 1, of: all.length })}</span>
        <IconButton icon="chr" label={t('video.cl_next')} disabled={at >= all.length - 1} onClick={() => setAt(at + 1)} data-cs="next" /></>}
      <Button size="sm" onClick={full}>{t('video.cl_full')}</Button><Button size="sm" onClick={onClose} kbd="Esc" data-cs="close">{t('common.close')}</Button></div>
    <div class="clipmain" key={c.id + ':' + at}><ClipPlayer c={c} /></div>
  </div>;
}
