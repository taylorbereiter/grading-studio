// Video and audio papers on the marking screen (src/app/media.js mediaCard, src/video.js linkCard, vfileCard, vidRot, vidGrip, and
// trPanel): a recording plays above the paper with back and ahead 10 seconds, speed, + Time to comment, Turn for a video filmed
// sideways, and a picture-in-picture window; a link plays on the page where the site allows it (YouTube, Vimeo, Loom, Google Drive and
// Slides) or opens in a window of its own; a video kept in this browser plays from its own database. Under each, the transcript: one
// she pastes, or one made in this browser by the speech engine, each line playing the video from there, with captions under the
// video. Add, A notes page… makes a page to write on beside a video. What changes the work is mark/change.js. A video from Google Drive
// (src/video.js driveCard, drvPlayer) plays straight from Drive, or from its download kept in this browser.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, IconButton, Segmented, Dialog, TextInput, CopyButton, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import * as V from '../../engines/gmedia.js';
import { videos } from '../../students/index.js';
import { prefs } from '../../students/prefs.js';
import { t } from '../../i18n/t.js';
import { register } from '../../services/shortcuts.js';
import { saving } from '../../services/saving.js';
import { PARTS } from '../router.js';
import { sampleOn } from '../sample.js';
import * as C from './change.js';
import { ClipStrip } from './clips.jsx';
import { VidDir } from './vdir.jsx';
import { frameTicks, frameTicking, frameMedia } from './frame.js';
import { troubleOf, troubleText } from '../../engines/greport.js';
import { shownName, anonOn, anonOrder } from '../../engines/gdraw.js';
import { groupMates } from '../../engines/ggroup.js';
import './inout-lines.js';
import './lines.js';
import './setup-lines.js';
import './video-lines.js';

// the tests stand in for the speech engine here, so it is never downloaded
if (typeof window !== 'undefined') window.__media = { asrStandIn: V.asrStandIn };
const RATES = [1, 1.25, 1.5, 2];
// The keys for the player on screen (src/app/wiring.js keydown, curMedia): Space plays or pauses, J and L go back or ahead 5 seconds.
// The last player drawn is the one they drive, while it is on the page.
let curMedia = null;
const playing = () => !!(curMedia && curMedia.isConnected);
register({ id: 'mark-media-play', keys: ' ', label: 'setup.v_key_play', group: 'mark.tools', when: playing, run: () => { if (curMedia.paused) curMedia.play().catch(() => {}); else curMedia.pause(); } });
register({ id: 'mark-media-back', keys: 'j', label: 'setup.v_key_back', group: 'mark.tools', when: playing, run: () => { curMedia.currentTime = Math.max(0, curMedia.currentTime - 5); } });
register({ id: 'mark-media-ahead', keys: 'l', label: 'setup.v_key_ahead', group: 'mark.tools', when: playing, run: () => { curMedia.currentTime += 5; } });
const own = el => { if (el) curMedia = el; };
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
function Controls({ st, f, m, video, turn = video }) {
  const [r, setR] = useState(rate);
  return <div class="mctl">
    <Button size="sm" onClick={() => { const x = m(); if (x) x.currentTime = Math.max(0, x.currentTime - 10); }} data-skip="-10">{t('setup.v_back')}</Button>
    <Button size="sm" onClick={() => { const x = m(); if (x) x.currentTime = x.currentTime + 10; }} data-skip="10">{t('setup.v_ahead')}</Button>
    <Segmented size="sm" label={t('setup.v_speed')} value={String(r)} onChange={v => { prefs.set('gs.rate', +v); setR(+v); const x = m(); if (x) x.playbackRate = +v; }} options={RATES.map(x => ({ value: String(x), label: x + '×' }))} />
    <Button size="sm" onClick={() => { const x = m(); if (x) C.addStamp(st, x.currentTime); toast(t('setup.v_stamped')); }} title={t('setup.v_stamp_tip')} data-stamp>{t('setup.v_stamp')}</Button>
    {turn && <Button size="sm" icon="turnr" onClick={() => C.vidTurn(f)} title={t('setup.v_turn_tip')} data-vrot>{t('setup.v_turn')}</Button>}
    {video && document.pictureInPictureEnabled && <Button size="sm" onClick={() => { const x = m(); if (!x) return; if (document.pictureInPictureElement === x) document.exitPictureInPicture().catch(() => {}); else x.requestPictureInPicture().catch(() => {}); }} title={t('setup.v_float_tip')} data-pip>{t('setup.v_float')}</Button>}
  </div>;
}
// A recording: the student's own file, or a video kept in this browser (k: { name, url }).
function Recording({ st, f, k, at, extra, onErr, note }) {
  const ref = useRef(null), [now, setNow] = useState(0), video = V.VIDEO_RX.test(k ? k.name : f.name);
  // the student's own recording says so when it won't play, with Download, or when only its sound plays (src/intake.js mediaWatch, D-046)
  const [bad, setBad] = useState(''), mine = !k;
  const wont = () => { if (!mine) return; f.noPlay = true; setBad('play'); };
  const meta = e => { if (mine && video && !e.currentTarget.videoWidth) { f.noPicture = true; setBad('sound'); } };
  const down = () => PARTS.outEngine().then(E => E.saveFile(f.name, new Blob([f.data])), e => console.error(e));
  useEffect(() => { const x = ref.current; if (x) { x.playbackRate = rate(); own(x); if (at) x.addEventListener('loadedmetadata', () => { x.currentTime = at; }, { once: true }); } }, []);
  const src = k ? k.url : urlOf(f), m = () => ref.current;
  const seek = s => { const x = m(); if (!x) return; x.currentTime = s; if (x.paused) x.play().catch(() => {}); };
  return <div class="media" data-media={f.path}>
    <div class="mstick"><div class="mhead"><b data-raw>{k ? V.linkTitle(f) : f.name}</b><span class="mute">{note || t(video ? 'setup.v_video' : 'setup.v_audio')}</span></div>
      {video ? <Turned f={f}>{style => <video ref={ref} controls preload="metadata" playsInline src={src} style={style} onTimeUpdate={e => setNow(e.currentTarget.currentTime)} onLoadedMetadata={meta} onError={onErr ? (() => onErr(ref.current ? ref.current.currentTime : 0)) : wont} />}</Turned>
        : <audio ref={ref} controls preload="metadata" src={src} onTimeUpdate={e => setNow(e.currentTarget.currentTime)} onError={wont} />}
      {bad && <p class="vlnote" role="status" data-mbad={bad}>{bad === 'play' ? troubleText(troubleOf(f)) : t('video.no_picture')}</p>}
      {bad && <div class="mctl"><Button size="sm" onClick={down} data-mdl>{t('setup.wd_download')}</Button></div>}
      <Caption f={f} now={now} />
      <Controls st={st} f={f} m={m} video={video} />{extra && extra(m)}<ClipStrip f={f} media={m} /></div>
    <Transcript f={f} seek={seek} now={now} bytes={k && !k.blob ? null : async () => k ? new Uint8Array(await k.blob.arrayBuffer()) : f.data} />
  </div>;
}
// A link (linkCard): plays here where the site lets it, or opens in its own window. YouTube and Vimeo say where their player is
// (frame.js), so Back and Ahead, the speed, + Time to comment, clips and captions work on them as on a video file (D-050, D-051, H-058).
function Link({ st, f }) {
  const url = V.linkOf(f.data), play = V.linkPlayer(url), ticks = !!play && (!play.frame || frameTicks(play.frame)), [on, setOn] = useState(false), ref = useRef(null), [now, setNow] = useState(0);
  const fr = useRef(null), fm = useRef(null);
  useEffect(() => {
    if (!on) { fm.current = null; return; }
    if (ref.current) { own(ref.current); return; }
    const x = frameMedia(fr.current); if (!x) return;
    fm.current = x; x.playbackRate = rate(); own(x);
    const h = () => setNow(x.currentTime); x.addEventListener('timeupdate', h);
    return () => x.removeEventListener('timeupdate', h);
  }, [on]);
  const m = () => ref.current || fm.current, seek = s => { if (!on) setOn(true); requestAnimationFrame(() => { const x = m(); if (x) { x.currentTime = s; x.play().catch(() => {}); } }); };
  return <div class="media vlink" data-media={f.path}>
    <div class="mstick"><div class="mhead"><b data-raw>{V.linkTitle(f)}</b><span class="mute" data-raw>{V.linkHost(url)}</span></div>
      {on && play && <Turned f={f}>{style => play.frame ? <iframe ref={fr} src={ticks ? frameTicking(play.frame) : play.frame} title={V.linkTitle(f)} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerpolicy="strict-origin-when-cross-origin" style={style} />
        : play.video ? <video ref={ref} controls preload="metadata" playsInline src={play.video} style={style} onTimeUpdate={e => setNow(e.currentTarget.currentTime)} /> : <audio ref={ref} controls src={play.audio} onTimeUpdate={e => setNow(e.currentTarget.currentTime)} />}</Turned>}
      {on && <Caption f={f} now={now} />}
      {on && ticks && <Controls st={st} f={f} m={m} video={!!play.video} turn={false} />}
      <div class="mctl">
        {play && <Button size="sm" variant={on ? undefined : 'primary'} aria-pressed={on ? 'true' : 'false'} onClick={() => setOn(v => !v)} data-vplay>{t(on ? 'setup.v_close' : 'setup.v_play')}</Button>}
        <Button size="sm" variant={play ? undefined : 'primary'} onClick={() => window.open(url, '_blank', 'noopener,noreferrer,popup,width=980,height=640')} title={t('setup.v_open_tip')} data-vopen>{t('setup.v_open')}</Button>
        <Button size="sm" onClick={() => navigator.clipboard.writeText(url).then(() => toast(t('setup.v_copied')), () => toast(t('setup.v_not_copied')))} data-vcopy>{t('setup.v_copy')}</Button>
        {play && (play.frame || play.video) && <Button size="sm" icon="turnr" onClick={() => C.vidTurn(f)} title={t('setup.v_turn_tip')} data-vrot>{t('setup.v_turn')}</Button>}</div>
      {play && play.frame && !ticks && V.vrotOf(f) > 0 && <p class="mute vlnote">{t('setup.v_caps_turn')}</p>}
      <p class="mute vlnote">{t(play ? 'setup.v_link_note' : 'setup.v_link_only')}</p>
      <ClipStrip f={f} media={on && ticks ? m : null} hint={play && play.frame && !ticks ? 'drive' : ''} /></div>
    <Transcript f={f} seek={seek} now={now} />
  </div>;
}
// A video file kept in this browser (vfileCard): found in its own database, or a way to put it back.
function Kept({ st, f }) {
  const id = V.vidRef(f.data), [k, setK] = useState(undefined);
  useEffect(() => { let live = true; keptGet(id).then(v => { if (live) setK(v); }); return () => { live = false; }; }, [id]);
  if (k === undefined) return <div class="media vfile"><div class="mstick"><div class="mhead"><b data-raw>{V.linkTitle(f)}</b><span class="mute">{t('setup.v_opening')}</span></div></div></div>;
  if (k) return <Recording st={st} f={f} k={k} />;
  // Choose the video file… puts it back, under the same name, so every paper that has it finds it (src/video.js vfileCard, D-045)
  const back = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*,audio/*'; i.onchange = async () => { const file = i.files[0]; if (!file) return;
    try { await (await PARTS.write()).keepVideo(file, id); kept.delete(id); toast(t('video.vk_back')); setK(await keptGet(id)); } catch (e) { console.error(e); toast((e && e.why === 'room') ? t('setup.v_room') : t('setup.v_fail', { why: (e && e.message) || String(e) })); } }; i.click(); };
  return <div class="media vfile" data-media={f.path}><div class="mstick"><div class="mhead"><b data-raw>{V.linkTitle(f)}</b><span class="mute">{t('setup.v_file')}</span></div>
    <p class="vlnote">{t('setup.v_not_here')}</p><div class="mctl"><Button size="sm" variant="primary" onClick={back} data-vkback>{t('setup.v_choose')}</Button></div></div></div>;
}
const drvMeta = (f, k) => (new RegExp('^\\s*' + k + '\\s*=\\s*(.+)$', 'mi').exec(new TextDecoder().decode(f.data)) || [, ''])[1].trim();
const VID_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v', 'video/x-matroska': 'mkv', 'video/3gpp': '3gp' };
const drvBad = new Set(), drvWeb = new Set(), drvGetting = new Map();   // while this page is open: wouldn't stream; chose Drive's player; downloads under way
function drvSay(e) {
  const m = (e && e.message) || String(e), s = e && e.status;
  if (e && e.why === 'room') return t('video.drv_room', { size: e.size });
  if (s === 404 || /\b404\b/.test(m)) return t('video.drv_gone');
  if (s === 401 || (e && (e.why === 'signin' || e.why === 'closed'))) return t('video.drv_signin');
  if (s === 403 || /\b403\b/.test(m)) return t('video.drv_no');
  return m;
}
// One download for each Drive video, shared by every card that asks. onStep(percent).
function drvGet(f, onStep) {
  const S = saving(), id = V.drvRef(f.data), key = 'd-' + id;
  if (!drvGetting.has(id)) drvGetting.set(id, (async () => {
    let name = drvMeta(f, 'Name') || V.linkTitle(f);
    const size = +drvMeta(f, 'Size') || 0;
    try { const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; if (size && e && e.quota && e.quota - (e.usage || 0) < size * 1.05) throw Object.assign(new Error('room'), { why: 'room', size: V.fmtSize(size) }); } catch (e) { if (e.why === 'room') throw e; }
    const blob = await S.vidBytes(id, (n, tot) => { const all = tot || size; if (all) for (const cb of drvGetting.get(id).steps) cb(Math.min(100, Math.round(n / all * 100))); }, true);
    const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : V.MIME[V.extOf(name)] || 'video/mp4';
    if (!V.VIDEO_RX.test(name)) name += '.' + (VID_EXT[type.split(';')[0]] || 'mp4');
    await (await PARTS.write()).keepVideo(new File([blob], name, { type }), key);
    kept.delete(key); return keptGet(key);
  })().finally(() => drvGetting.delete(id)));
  const p = drvGetting.get(id); p.steps = p.steps || new Set(); if (onStep) p.steps.add(onStep);
  return p;
}
// A video from her Drive: its download kept here, played straight from Drive, or the ways to watch it.
function DriveVideo({ st, f }) {
  const S = saving(), id = V.drvRef(f.data), key = 'd-' + id, size = +drvMeta(f, 'Size') || 0;
  const [k, setK] = useState(undefined), [stream, setStream] = useState(null), [why, setWhy] = useState(''), [at, setAt] = useState(0), [busy, setBusy] = useState(''), [pc, setPc] = useState(-1), [, tick] = useState(0);
  useEffect(() => { let live = true; keptGet(key).then(v => { if (live) { if (!v) kept.delete(key); setK(v); } }); S.vidStreamOk().then(v => { if (live) setStream(v); }); return () => { live = false; }; }, [key]);
  const getOne = async () => {
    setBusy('get'); setPc(0);
    try { setK(await drvGet(f, setPc)); setWhy(''); } catch (e) { console.error(e); setWhy(drvSay(e)); }
    setBusy(''); setPc(-1);
  };
  const gb = size ? t('video.drv_get_n', { size: V.fmtSize(size) }) : t('video.drv_get');
  const bar = pc >= 0 && <><div class="prog"><i style={{ width: pc + '%' }} /></div><p class="mute vlnote" role="status">{t('video.drv_getting', { p: pc })}</p></>;
  if (drvWeb.has(key)) return <Link st={st} f={f} />;
  if (k === undefined || stream === null) return <div class="media vfile vdrv"><div class="mstick"><div class="mhead"><b data-raw>{V.linkTitle(f)}</b><span class="mute">{t('video.drive')}</span></div></div></div>;
  if (k) return <Recording key="kept" st={st} f={f} k={k} at={at} note={t('video.drv_kept')} extra={m => <><div class="mctl"><Button size="sm" onClick={async () => { const x = m(); setAt(x ? x.currentTime : 0); if (x) x.pause();
    try { await (await PARTS.write()).dropVideo(key); } catch (e) { console.error(e); } kept.delete(key); toast(t('video.drv_dropped')); setK(null); }} data-drvdrop>{t('video.drv_drop')}</Button></div>
    <p class="mute vlnote">{t('video.drv_kept_note')}</p></>} />;
  const ok = stream && !drvBad.has(id);
  if (ok && S.vidReady() && !why) return <Recording key="stream" st={st} f={f} at={at} k={{ name: V.VIDEO_RX.test(drvMeta(f, 'Name')) ? drvMeta(f, 'Name') : 'video.mp4', url: S.vidUrl(id) }} note={t('video.drv_stream')}
    onErr={async now => { setAt(now); if (!S.vidReady()) return tick(n => n + 1); drvBad.add(id); let w = ''; try { await S.vidCheck(id); } catch (e) { w = drvSay(e); } setWhy(w || t('video.drv_bad')); }}
    extra={() => <><div class="mctl"><Button size="sm" disabled={!!busy} onClick={getOne} data-drvget>{gb}</Button></div>{bar || <p class="mute vlnote">{t('video.drv_stream_note')}</p>}</>} />;
  return <div class="media vfile vdrv" data-media={f.path}><div class="mstick"><div class="mhead"><b data-raw>{V.linkTitle(f)}</b><span class="mute">{t('video.drive')}</span></div>
    <div class="mctl">
      {ok && <Button size="sm" variant="primary" disabled={!!busy} onClick={async () => { setBusy('play'); try { await S.vidSignIn(); drvBad.delete(id); setWhy(''); } catch (e) { console.error(e); setWhy(drvSay(e)); } setBusy(''); }} data-drvplay>{t('video.drv_play')}</Button>}
      <Button size="sm" variant={ok ? undefined : 'primary'} disabled={!!busy} onClick={getOne} data-drvget>{gb}</Button>
      <Button size="sm" onClick={() => { drvWeb.add(key); tick(n => n + 1); }} data-drvweb>{t('video.drv_web')}</Button></div>
    {bar || <p class="mute vlnote" data-drvwhy>{busy === 'play' ? t('video.drv_opening') : why || t(ok ? 'video.drv_note' : 'video.drv_note2')}</p>}</div></div>;
}
export function MediaCard({ st, f }) {
  if (f.kind === 'media') return <Recording st={st} f={f} />;
  if (V.vidRef(f.data)) return <Kept st={st} f={f} />;
  if (V.drvRef(f.data) && saving() && saving().google().can && !sampleOn()) return <DriveVideo st={st} f={f} />;
  return <Link st={st} f={f} />;
}

// The line being said, upright under the video, when Captions under the video is on. ‹ and › step through the lines (src/app/media.js
// trPanel capgo, D-048), for a player that can't say where it is (Google Drive) or to read ahead; playing again follows the player.
function Caption({ f, now }) {
  const [, tick] = useState(0), [man, setMan] = useState(null);
  useEffect(() => { const h = () => tick(n => n + 1); addEventListener('gs-trcap', h); return () => removeEventListener('gs-trcap', h); }, []);
  useEffect(() => setMan(null), [now]);
  const lines = V.trLines(f.tr); if (!prefs.get('gs.trCap', 0) || !lines.length) return null;
  let k = 0; lines.forEach((x, i) => { if (x.t != null && x.t <= now + 0.05) k = i; });
  if (man != null) k = Math.max(0, Math.min(lines.length - 1, man));
  const x = lines[k];
  return <div class="trcapbar"><IconButton icon="chl" size="sm" label={t('video.cap_prev')} disabled={k <= 0} onClick={() => setMan(k - 1)} data-capgo="-1" />
    <p class="trcap" aria-live="polite" data-raw>{x.w ? x.w.map(y => y[0]).join('').trim() : x.s}</p>
    <IconButton icon="chr" size="sm" label={t('video.cap_next')} disabled={k >= lines.length - 1} onClick={() => setMan(k + 1)} data-capgo="1" /></div>;
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
  // Make again asks first (src/app/media.js askDlg, D-047): the one she has is replaced
  if (mode === 'again') return <div class="trbox"><p data-tragain>{t('video.tr_again_q')}</p><div class="trrow"><Button size="sm" variant="primary" onClick={() => { setMode(''); make(); }} data-tragainok>{t('video.tr_again_ok')}</Button><Button size="sm" onClick={() => setMode('')}>{t('setup.cancel')}</Button></div></div>;
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
    <CopyButton text={() => V.trText(f.tr)} data-trcopy />
    <Button size="sm" variant="quiet" aria-pressed={cap ? 'true' : 'false'} onClick={() => { if (cap) prefs.del('gs.trCap'); else prefs.set('gs.trCap', 1); dispatchEvent(new Event('gs-trcap')); tick(n => n + 1); }} title={t('setup.v_caps_tip')} data-trcap>{t('setup.v_caps')}</Button>
    <Button size="sm" variant="quiet" onClick={() => { setText(V.trText(tr)); setMode('edit'); }} data-trpaste>{t('setup.v_edit')}</Button>
    {canMake && <Button size="sm" variant="quiet" onClick={() => setMode('again')} data-trmake>{t('setup.v_tr_again')}</Button>}
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

// Partners in the video (src/video.js partnerList, D-037): a find box, and everyone else ticked who is in it; those already in her
// group are ticked and can't be taken off here.
function PartnerPick({ st, picked, onTog }) {
  const [q, setQ] = useState(''), bb = state().batch, anon = anonOn(), ord = anon ? anonOrder() : null, locked = new Set(groupMates(st));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = bb.students.map((s, i) => ({ s, i, name: shownName(s, i) })).filter(r => r.s !== st && (r.s.files.length || !r.s.gap) && words.every(w => r.name.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))))
    .sort((x, y) => (ord ? ord.indexOf(x.i) - ord.indexOf(y.i) : 0));
  return <><TextInput icon="search" label={t('setup.f_find')} placeholder={t(anon ? 'inout.mv_num' : 'inout.mv_name')} value={q} onInput={setQ} autocomplete="off" data-vdfind />
    <div class="vdlist">{rows.map(r => { const lock = locked.has(r.s), on = lock || picked.has(r.s.key);
      return <button type="button" class="chip" role="checkbox" aria-checked={on ? 'true' : 'false'} disabled={lock} title={lock ? t('setup.pv_locked') : undefined} onClick={() => onTog(r.s.key)} data-vdto={r.s.key}><span data-raw>{r.name}</span></button>; })}
      {!rows.length && <p class="mute">{t('setup.f_none_found')}</p>}</div></>;
}

// Add, A video… (openAddVideo): a link or a video file, its name, a notes page to write on while she watches, and partners in it.
export function VideoAdd({ st, name, onClose, file: file0 }) {
  const rows = V.npRows(state().setup), has = !!V.notesFileOf(st);
  const [by, setBy] = useState(file0 ? 'file' : 'link'), [url, setUrl] = useState(''), [file, setFile] = useState(file0 || null), [title, setTitle] = useState(t('setup.v_name0')), [drv, setDrv] = useState(null);
  const S = saving(), canDrive = !!(S && S.google().pickNow);
  const [kind, setKind] = useState(has ? '' : 'lined'), [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(() => new Set()), tog = k => setPicked(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const clean = V.linkClean(url), ok = by === 'file' ? !!file : by === 'drive' ? !!drv : !!clean;
  const fromDrive = async () => { try { const [d] = await S.vidPick({ title: t('video.drv_choose') }); if (d) { setDrv(d); setBy('drive'); } } catch (e) { console.error(e); toast(t('setup.v_fail', { why: (e && e.message) || String(e) })); } };
  const pick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*,audio/*'; i.onchange = () => use1(i.files[0]); i.click(); };
  const use1 = f => { if (!f) return; if (!V.MEDIA_RX.test(f.name) && !/^(video|audio)\//.test(f.type)) return toast(t('setup.v_not_media')); setFile(f); setBy('file'); };
  const go = async () => {
    setBusy(true);
    try {
      if (kind) npLast = kind;
      const r = await C.videoAdd(st, { url: by === 'link' ? clean : '', file: by === 'file' ? file : null, drive: by === 'drive' ? drv : null, name: V.npFileName(title || t('setup.v_name0')), kind });
      // the partners get the video and the notes page, and one set of marks and one grade covers the group (pvApply)
      if (picked.size) await C.partnersApply([{ k: [st.key, ...picked], url: '', file: null }], false);
      toast(r.had && !r.made.length ? t('setup.v_has', { name }) : t('setup.v_added', { name }));
      C.reopen();
      onClose();
    } catch (e) { console.error(e); setBusy(false); toast((e && e.why === 'room') ? t('setup.v_room') : t('setup.v_fail', { why: (e && e.message) || String(e) })); }
  };
  return <Dialog open title={t('setup.v_add_t', { name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('setup.cancel')}</Button><Button variant="primary" onClick={go} disabled={!ok || busy} data-vdadd>{picked.size ? t('video.vd_add_with', { name, n: picked.size }) : t('setup.v_np_add', { name })}</Button></>}>
    <div onDragOver={e => { if (by === 'file') e.preventDefault(); }} onDrop={e => { if (by !== 'file') return; e.preventDefault(); use1(e.dataTransfer.files[0]); }}>
    <Segmented label={t('setup.v_which')} value={by} onChange={v => { setBy(v); if (v === 'file' && !file) pick(); if (v === 'drive' && !drv) fromDrive(); }} options={[{ value: 'link', label: t('setup.v_by_link') }, { value: 'file', label: t('setup.v_by_file') }].concat(canDrive ? [{ value: 'drive', label: t('video.by_drive') }] : [])} />
    {by === 'drive' ? <><div class="vdfile"><Button onClick={fromDrive} data-vddrive>{t('video.drv_choose')}</Button><span class="mute" data-raw>{drv ? drv.name : ''}</span><VidDir /></div>
      <p class="mute">{t('video.drv_say')}</p></>
      : by === 'link' ? <><TextInput label={t('setup.v_link')} value={url} onInput={setUrl} placeholder={t('setup.v_link_ph')} autocomplete="off" spellcheck={false} error={url.trim() && !clean ? t('setup.v_bad_link') : ''} data-vdlink />
      <p class="mute">{t('setup.v_link_say')}</p></>
      : <><div class="vdfile"><Button onClick={pick} data-vdfile>{t('setup.v_choose')}</Button><span class="mute" data-raw>{file ? file.name : t('setup.v_or_drop')}</span></div>
      <p class="mute">{t('setup.v_file_say')}</p></>}
    <TextInput label={t('setup.v_np_name')} value={title} onInput={setTitle} autocomplete="off" data-vdname />
    <p class="vdlab"><b>{t('setup.v_np_kind')}</b> <small class="mute">{t('setup.v_np_say')}</small></p>
    <div class="nptiles" role="radiogroup" aria-label={t('setup.v_np_kind')}>
      <button type="button" class="nptile" role="radio" aria-checked={kind === '' ? 'true' : 'false'} onClick={() => setKind('')} data-np="none"><span class="npart none" aria-hidden="true" /><b>{t('setup.v_np_none')}</b></button>
      {KINDS.map(([k, label, tip]) => { const off = k === 'rubric' && !rows.length;
        return <button type="button" class="nptile" role="radio" aria-checked={kind === k ? 'true' : 'false'} disabled={off} title={t(off ? 'setup.v_np_norows' : tip)} onClick={() => setKind(k)} data-np={k}><span class={'npart ' + k} aria-hidden="true" /><b>{t(label)}</b></button>; })}</div>
    <p class="vdlab"><b>{t('video.vd_partners')}</b> <small class="mute">{t('video.vd_partners_say')}</small></p>
    <PartnerPick st={st} picked={picked} onTog={tog} />
    </div>
  </Dialog>;
}
