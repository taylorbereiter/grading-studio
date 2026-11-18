// Video and audio papers on the marking screen (src/app/media.js mediaCard, src/video.js linkCard, vfileCard, vidRot, vidGrip, and
// trPanel): a recording plays above the paper with back and ahead 10 seconds, speed, + Time to comment, Turn for a video filmed
// sideways, and a picture-in-picture window; a link plays on the page where the site allows it (YouTube, Vimeo, Loom, Google Drive and
// Slides) or opens in a window of its own; a video kept in this browser plays from its own database. Under each, the transcript: one
// she pastes, or one made in this browser by the speech engine, each line playing the video from there, with captions under the
// video. Add, A notes page… makes a page to write on beside a video. What changes the work is mark/change.js. Videos from Google Drive
// come with Drive (part d6); clips to show the class, and partners sharing a video, come with group work.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, IconButton, Segmented, Dialog, TextInput, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import * as V from '../../engines/gmedia.js';
import { videos } from '../../students/index.js';
import { prefs } from '../../students/prefs.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './setup-lines.js';

// the tests stand in for the speech engine here, so it is never downloaded
if (typeof window !== 'undefined') window.__media = { asrStandIn: V.asrStandIn };
const RATES = [1, 1.25, 1.5, 2];
const rate = () => +prefs.get('gs.rate', 1) || 1;
const urls = new WeakMap();
const urlOf = f => { if (!urls.has(f)) urls.set(f, URL.createObjectURL(new Blob([f.data], { type: V.MIME[V.extOf(f.name)] || '' }))); return urls.get(f); };
const kept = new Map();   // a kept video's id -> { name, url, blob } or null, while this page is open
async function keptGet(id) {
  if (kept.has(id)) return kept.get(id);
  const r = await videos.get(id).catch(() => null), v = r && r.blob ? { name: r.name, blob: r.blob, url: URL.createObjectURL(r.blob) } : null;
  kept.set(id, v); return v;
}

// The player turned inside its box, for a video filmed sideways (vidRot): only how it shows here changes.
function Turned({ f, children }) {
  const box = useRef(null), [, tick] = useState(0);
  useEffect(() => { const o = new ResizeObserver(() => tick(n => n + 1)); if (box.current) o.observe(box.current); return () => o.disconnect(); }, []);
  const d = V.vrotOf(f), side = d === 90 || d === 270, W = box.current ? box.current.clientWidth : 0, H = box.current ? box.current.clientHeight : 0;
  const style = !d ? null : side ? { position: 'absolute', width: H + 'px', height: W + 'px', left: (W - H) / 2 + 'px', top: (H - W) / 2 + 'px', transform: 'rotate(' + d + 'deg)' }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(180deg)' };
  const h0 = +prefs.get('gs.vidH', 0) || 0;
  return <div ref={box} class={'vrot' + (d ? ' on' : '')} data-turn={d} style={h0 ? { height: h0 + 'px' } : null}>{children(style)}
    <span class="vgrip" role="separator" aria-orientation="horizontal" aria-label={t('setup.v_size')} tabIndex={0}
      onPointerDown={e => { const el = box.current, y0 = e.clientY, h1 = el.offsetHeight; e.currentTarget.setPointerCapture(e.pointerId);
        const mv = ev => { el.style.height = Math.max(140, Math.min(900, h1 + ev.clientY - y0)) + 'px'; tick(n => n + 1); };
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); prefs.set('gs.vidH', el.offsetHeight); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up); }}
      onKeyDown={e => { if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault(); const el = box.current, v = Math.max(140, Math.min(900, el.offsetHeight + (e.key === 'ArrowUp' ? -20 : 20))); el.style.height = v + 'px'; prefs.set('gs.vidH', v); tick(n => n + 1); }} /></div>;
}
// Back and ahead, speed, the time into the comment, Turn and the floating window, for a player this page can drive.
function Controls({ st, f, m, video }) {
  const [r, setR] = useState(rate);
  return <div class="mctl">
    <Button size="sm" onClick={() => { const x = m(); if (x) x.currentTime = Math.max(0, x.currentTime - 10); }} data-skip="-10">{t('setup.v_back')}</Button>
    <Button size="sm" onClick={() => { const x = m(); if (x) x.currentTime = x.currentTime + 10; }} data-skip="10">{t('setup.v_ahead')}</Button>
    <Segmented size="sm" label={t('setup.v_speed')} value={String(r)} onChange={v => { prefs.set('gs.rate', +v); setR(+v); const x = m(); if (x) x.playbackRate = +v; }} options={RATES.map(x => ({ value: String(x), label: x + '×' }))} />
    <Button size="sm" onClick={() => { const x = m(); if (x) C.addStamp(st, x.currentTime); toast(t('setup.v_stamped')); }} title={t('setup.v_stamp_tip')} data-stamp>{t('setup.v_stamp')}</Button>
    {video && <Button size="sm" icon="turnr" onClick={() => C.vidTurn(f)} title={t('setup.v_turn_tip')} data-vrot>{t('setup.v_turn')}</Button>}
    {video && document.pictureInPictureEnabled && <Button size="sm" onClick={() => { const x = m(); if (!x) return; if (document.pictureInPictureElement === x) document.exitPictureInPicture().catch(() => {}); else x.requestPictureInPicture().catch(() => {}); }} title={t('setup.v_float_tip')} data-pip>{t('setup.v_float')}</Button>}
  </div>;
}
// A recording: the student's own file, or a video kept in this browser (k: { name, url }).
function Recording({ st, f, k }) {
  const ref = useRef(null), [now, setNow] = useState(0), video = V.VIDEO_RX.test(k ? k.name : f.name);
  useEffect(() => { if (ref.current) ref.current.playbackRate = rate(); }, []);
  const src = k ? k.url : urlOf(f), m = () => ref.current;
  const seek = s => { const x = m(); if (!x) return; x.currentTime = s; if (x.paused) x.play().catch(() => {}); };
  return <div class="media" data-media={f.path}>
    <div class="mstick"><div class="mhead"><b data-raw>{k ? V.linkTitle(f) : f.name}</b><span class="mute">{t(video ? 'setup.v_video' : 'setup.v_audio')}</span></div>
      {video ? <Turned f={f}>{style => <video ref={ref} controls preload="metadata" playsInline src={src} style={style} onTimeUpdate={e => setNow(e.currentTarget.currentTime)} />}</Turned>
        : <audio ref={ref} controls preload="metadata" src={src} onTimeUpdate={e => setNow(e.currentTarget.currentTime)} />}
      <Caption f={f} now={now} />
      <Controls st={st} f={f} m={m} video={video} /></div>
    <Transcript f={f} seek={seek} now={now} bytes={async () => k ? new Uint8Array(await k.blob.arrayBuffer()) : f.data} />
  </div>;
}
// A link (linkCard): plays here where the site lets it, or opens in its own window.
function Link({ st, f }) {
  const url = V.linkOf(f.data), play = V.linkPlayer(url), ticks = !!play && !play.frame, [on, setOn] = useState(false), ref = useRef(null), [now, setNow] = useState(0);
  const m = () => ref.current, seek = s => { if (!on) setOn(true); requestAnimationFrame(() => { const x = m(); if (x) { x.currentTime = s; x.play().catch(() => {}); } }); };
  return <div class="media vlink" data-media={f.path}>
    <div class="mstick"><div class="mhead"><b data-raw>{V.linkTitle(f)}</b><span class="mute" data-raw>{V.linkHost(url)}</span></div>
      {on && play && <Turned f={f}>{style => play.frame ? <iframe src={play.frame} title={V.linkTitle(f)} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerpolicy="strict-origin-when-cross-origin" style={style} />
        : play.video ? <video ref={ref} controls preload="metadata" playsInline src={play.video} style={style} onTimeUpdate={e => setNow(e.currentTarget.currentTime)} /> : <audio ref={ref} controls src={play.audio} onTimeUpdate={e => setNow(e.currentTarget.currentTime)} />}</Turned>}
      {on && <Caption f={f} now={now} />}
      {on && ticks && <Controls st={st} f={f} m={m} video={!!play.video} />}
      <div class="mctl">
        {play && <Button size="sm" variant={on ? undefined : 'primary'} aria-pressed={on ? 'true' : 'false'} onClick={() => setOn(v => !v)} data-vplay>{t(on ? 'setup.v_close' : 'setup.v_play')}</Button>}
        <Button size="sm" variant={play ? undefined : 'primary'} onClick={() => window.open(url, '_blank', 'noopener,noreferrer,popup,width=980,height=640')} title={t('setup.v_open_tip')} data-vopen>{t('setup.v_open')}</Button>
        <Button size="sm" onClick={() => navigator.clipboard.writeText(url).then(() => toast(t('setup.v_copied')), () => toast(t('setup.v_not_copied')))} data-vcopy>{t('setup.v_copy')}</Button>
        {play && play.frame && <Button size="sm" icon="turnr" onClick={() => C.vidTurn(f)} title={t('setup.v_turn_tip')} data-vrot>{t('setup.v_turn')}</Button>}</div>
      {play && play.frame && V.vrotOf(f) > 0 && <p class="mute vlnote">{t('setup.v_caps_turn')}</p>}
      <p class="mute vlnote">{t(play ? 'setup.v_link_note' : 'setup.v_link_only')}</p></div>
    <Transcript f={f} seek={seek} now={now} />
  </div>;
}
// A video file kept in this browser (vfileCard): found in its own database, or a way to put it back.
function Kept({ st, f }) {
  const id = V.vidRef(f.data), [k, setK] = useState(undefined);
  useEffect(() => { let live = true; keptGet(id).then(v => { if (live) setK(v); }); return () => { live = false; }; }, [id]);
  if (k === undefined) return <div class="media vfile"><div class="mstick"><div class="mhead"><b data-raw>{V.linkTitle(f)}</b><span class="mute">{t('setup.v_opening')}</span></div></div></div>;
  if (k) return <Recording st={st} f={f} k={k} />;
  return <div class="media vfile" data-media={f.path}><div class="mstick"><div class="mhead"><b data-raw>{V.linkTitle(f)}</b><span class="mute">{t('setup.v_file')}</span></div>
    <p class="vlnote">{t('setup.v_not_here')}</p></div></div>;
}
export function MediaCard({ st, f }) {
  if (f.kind === 'media') return <Recording st={st} f={f} />;
  if (V.vidRef(f.data)) return <Kept st={st} f={f} />;
  return <Link st={st} f={f} />;
}

// The line being said, upright under the video, when Captions under the video is on.
function Caption({ f, now }) {
  const [, tick] = useState(0);
  useEffect(() => { const h = () => tick(n => n + 1); addEventListener('gs-trcap', h); return () => removeEventListener('gs-trcap', h); }, []);
  const lines = V.trLines(f.tr); if (!prefs.get('gs.trCap', 0) || !lines.length) return null;
  let k = 0; lines.forEach((x, i) => { if (x.t != null && x.t <= now + 0.05) k = i; });
  const x = lines[k];
  return <p class="trcap" aria-live="polite" data-raw>{x.w ? x.w.map(y => y[0]).join('').trim() : x.s}</p>;
}
// The transcript under a player (trPanel). bytes(): the recording, when one can be made here.
function Transcript({ f, seek, now, bytes }) {
  const [mode, setMode] = useState(''), [text, setText] = useState(''), [err, setErr] = useState(''), [say, setSay] = useState(['', 0]), stop = useRef(null), [, tick] = useState(0);
  const canMake = !!bytes && V.trMakeable(f) && window.self === window.top, tr = f.tr;
  const make = async () => {
    if (!prefs.get('gs.asrHave', 0) && mode !== 'ask') return setMode('ask');
    setMode('make'); setErr('');
    const me = stop.current = { on: false };
    try { if (await C.trMake(f, await bytes(), (s, p) => { if (stop.current === me) setSay([s, p == null ? null : p]); }, me)) toast(t('setup.v_tr_ready')); }
    catch (e) { if (!me.on) { console.error(e); setErr((e && e.message) || String(e)); } }
    if (stop.current === me) { stop.current = null; setMode(''); }
  };
  const save = () => { const v = text, x = V.trParse(v); if (!x && v.trim()) return toast(t('setup.v_tr_empty')); const had = f.tr; C.trSet(f, x); setMode(''); if (!x && had) toast(t('setup.v_tr_off'), { undo: C.undo }); };
  if (mode === 'edit') return <div class="trbox"><label class="trlab">{t(tr ? 'setup.v_tr_change' : 'setup.v_tr_paste')}
    <textarea class="input trta" rows="8" spellcheck={false} value={text} onInput={e => setText(e.currentTarget.value)} placeholder={'[0:00] …\n[0:12] …'} data-raw data-trta
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); setMode(''); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }} /></label>
    <div class="trrow"><Button size="sm" variant="primary" onClick={save} data-trsave>{t('setup.v_save')}</Button><Button size="sm" onClick={() => setMode('')}>{t('setup.cancel')}</Button></div>
    <small class="mute">{t('setup.v_tr_how')}</small></div>;
  if (mode === 'ask') return <div class="trbox"><p>{t('setup.v_tr_ask')}</p><div class="trrow"><Button size="sm" variant="primary" onClick={make} data-trgo>{t('setup.v_tr_go')}</Button><Button size="sm" onClick={() => setMode('')}>{t('setup.v_not_now')}</Button></div></div>;
  if (mode === 'make') return <div class="trbox"><div class="prog"><i style={{ width: Math.round((say[1] || 0) * 100) + '%' }} /></div>
    <div class="trrow"><span role="status" data-trmsg>{say[0] || t('setup.v_tr_start')}</span><Button size="sm" onClick={() => { if (stop.current) stop.current.on = true; stop.current = null; V.asrStop(); setMode(''); toast(t('setup.v_tr_stopped')); }} data-trstop>{t('setup.cancel')}</Button></div>
    <small class="mute">{t('setup.v_tr_making')}</small></div>;
  if (!tr) return <div class="trbox"><div class="trrow trnone">{canMake && <Button size="sm" onClick={make} title={t('setup.v_tr_make_tip')} data-trmake>{t('setup.v_tr_make')}</Button>}
    <Button size="sm" onClick={() => { setText(''); setMode('edit'); }} title={t('setup.v_tr_paste_tip')} data-trpaste>{t('setup.v_tr_paste')}</Button>
    {err ? <small class="trerr">{err}</small> : f.kind === 'link' && !canMake ? <small class="mute">{t('setup.v_tr_sites')}</small> : null}</div></div>;
  const lines = V.trLines(tr); let at = -1; lines.forEach((x, i) => { if (x.t != null && x.t <= now + 0.05) at = i; });
  const cap = !!prefs.get('gs.trCap', 0);
  return <div class="trbox"><div class="trhead"><b>{t('setup.v_tr')}</b><span class="mute">{t(tr.w ? 'setup.v_tr_made' : 'setup.v_tr_pasted')}</span><span class="grow" />
    <Button size="sm" variant="quiet" aria-pressed={cap ? 'true' : 'false'} onClick={() => { if (cap) prefs.del('gs.trCap'); else prefs.set('gs.trCap', 1); dispatchEvent(new Event('gs-trcap')); tick(n => n + 1); }} title={t('setup.v_caps_tip')} data-trcap>{t('setup.v_caps')}</Button>
    <Button size="sm" variant="quiet" onClick={() => { setText(V.trText(tr)); setMode('edit'); }} data-trpaste>{t('setup.v_edit')}</Button>
    {canMake && <Button size="sm" variant="quiet" onClick={make} data-trmake>{t('setup.v_tr_again')}</Button>}
    <Button size="sm" variant="quiet" onClick={() => { C.trSet(f, null); toast(t('setup.v_tr_off'), { undo: C.undo }); }} data-trdel>{t('setup.v_remove')}</Button></div>
    <div class="trans" data-raw>{lines.map((x, i) => <p class={'trl' + (i === at ? ' now' : '')} data-t={x.t != null ? x.t : undefined} onClick={() => { if (x.t != null) seek(x.t); }}>
      {x.t != null && <time>{V.fmtTime(x.t)}</time>}{x.w ? x.w.map(([w, s]) => <span data-t={s} onClick={e => { e.stopPropagation(); seek(s); }}>{w}</span>) : <span>{x.s}</span>}</p>)}</div></div>;
}

// Add, A notes page… (openAddNotes): a page to write on while she watches or listens, scored and returned like a paper.
let npLast = 'lined';   // the kind of notes page picked last, while this page is open
const KINDS = [['lined', 'setup.v_np_lined', 'setup.v_np_lined_tip'], ['rubric', 'setup.v_np_rubric', 'setup.v_np_rubric_tip'], ['cols', 'setup.v_np_cols', 'setup.v_np_cols_tip'], ['blank', 'setup.v_np_blank', 'setup.v_np_blank_tip']];
export function NotesAdd({ st, name, onClose }) {
  const rows = V.npRows(state().setup), [kind, setKind] = useState(() => (npLast === 'rubric' && !rows.length ? 'lined' : npLast));
  const [title, setTitle] = useState(t('setup.v_np_name0')), [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    npLast = kind;
    try { const made = await C.notesAdd(st, kind, title); if (made.length) { toast(t('setup.v_np_added', { name })); C.reopen(); } }
    catch (e) { console.error(e); toast(t('setup.v_np_fail', { why: (e && e.message) || String(e) })); }
    onClose();
  };
  return <Dialog open title={t('setup.v_np_t', { name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('setup.cancel')}</Button><Button variant="primary" onClick={go} disabled={busy} data-npadd>{t('setup.v_np_add', { name })}</Button></>}>
    <p class="mute">{t('setup.v_np_text')}</p>
    <div class="nptiles" role="radiogroup" aria-label={t('setup.v_np_kind')}>{KINDS.map(([k, label, tip]) => { const off = k === 'rubric' && !rows.length;
      return <button type="button" class="nptile" role="radio" aria-checked={kind === k ? 'true' : 'false'} disabled={off} title={t(off ? 'setup.v_np_norows' : tip)} onClick={() => setKind(k)} data-np={k}>
        <span class={'npart ' + k} aria-hidden="true" /><b>{t(label)}</b></button>; })}</div>
    <TextInput label={t('setup.v_np_name')} value={title} onInput={setTitle} autocomplete="off" data-npname />
  </Dialog>;
}

// Add, A video… (openAddVideo): a link or a video file, its name, and a notes page to write on while she watches. Partners in the
// video come with group work.
export function VideoAdd({ st, name, onClose, file: file0 }) {
  const rows = V.npRows(state().setup), has = !!V.notesFileOf(st);
  const [by, setBy] = useState(file0 ? 'file' : 'link'), [url, setUrl] = useState(''), [file, setFile] = useState(file0 || null), [title, setTitle] = useState(t('setup.v_name0'));
  const [kind, setKind] = useState(has ? '' : 'lined'), [busy, setBusy] = useState(false);
  const clean = V.linkClean(url), ok = by === 'file' ? !!file : !!clean;
  const pick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*,audio/*'; i.onchange = () => use1(i.files[0]); i.click(); };
  const use1 = f => { if (!f) return; if (!V.MEDIA_RX.test(f.name) && !/^(video|audio)\//.test(f.type)) return toast(t('setup.v_not_media')); setFile(f); setBy('file'); };
  const go = async () => {
    setBusy(true);
    try {
      if (kind) npLast = kind;
      const r = await C.videoAdd(st, { url: by === 'link' ? clean : '', file: by === 'file' ? file : null, name: V.npFileName(title || t('setup.v_name0')), kind });
      toast(r.had && !r.made.length ? t('setup.v_has', { name }) : t('setup.v_added', { name }));
      C.reopen();
      onClose();
    } catch (e) { console.error(e); setBusy(false); toast((e && e.why === 'room') ? t('setup.v_room') : t('setup.v_fail', { why: (e && e.message) || String(e) })); }
  };
  return <Dialog open title={t('setup.v_add_t', { name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('setup.cancel')}</Button><Button variant="primary" onClick={go} disabled={!ok || busy} data-vdadd>{t('setup.v_np_add', { name })}</Button></>}>
    <div onDragOver={e => { if (by === 'file') e.preventDefault(); }} onDrop={e => { if (by !== 'file') return; e.preventDefault(); use1(e.dataTransfer.files[0]); }}>
    <Segmented label={t('setup.v_which')} value={by} onChange={v => { setBy(v); if (v === 'file' && !file) pick(); }} options={[{ value: 'link', label: t('setup.v_by_link') }, { value: 'file', label: t('setup.v_by_file') }]} />
    {by === 'link' ? <><TextInput label={t('setup.v_link')} value={url} onInput={setUrl} placeholder={t('setup.v_link_ph')} autocomplete="off" spellcheck={false} error={url.trim() && !clean ? t('setup.v_bad_link') : ''} data-vdlink />
      <p class="mute">{t('setup.v_link_say')}</p></>
      : <><div class="vdfile"><Button onClick={pick} data-vdfile>{t('setup.v_choose')}</Button><span class="mute" data-raw>{file ? file.name : t('setup.v_or_drop')}</span></div>
      <p class="mute">{t('setup.v_file_say')}</p></>}
    <TextInput label={t('setup.v_np_name')} value={title} onInput={setTitle} autocomplete="off" data-vdname />
    <p class="vdlab"><b>{t('setup.v_np_kind')}</b> <small class="mute">{t('setup.v_np_say')}</small></p>
    <div class="nptiles" role="radiogroup" aria-label={t('setup.v_np_kind')}>
      <button type="button" class="nptile" role="radio" aria-checked={kind === '' ? 'true' : 'false'} onClick={() => setKind('')} data-np="none"><span class="npart none" aria-hidden="true" /><b>{t('setup.v_np_none')}</b></button>
      {KINDS.map(([k, label, tip]) => { const off = k === 'rubric' && !rows.length;
        return <button type="button" class="nptile" role="radio" aria-checked={kind === k ? 'true' : 'false'} disabled={off} title={t(off ? 'setup.v_np_norows' : tip)} onClick={() => setKind(k)} data-np={k}><span class={'npart ' + k} aria-hidden="true" /><b>{t(label)}</b></button>; })}</div>
    </div>
  </Dialog>;
}
