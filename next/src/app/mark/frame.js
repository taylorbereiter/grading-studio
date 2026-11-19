// Where a site's player is (src/video.js frameTicks, frameTicking, frameClock, frameSay, frameTime; H-058): YouTube and Vimeo tell the
// page where their player is when asked, in their own embed messages, and take orders the same way. frameMedia(iframe) wraps one as
// the few parts of a <video> the marking screen uses (currentTime, paused, playbackRate, play, pause, readyState, timeupdate and
// loadedmetadata), so Back and Ahead, the speed, + Time to comment, clips, captions, typed-note times and the keys work on it as they
// do on a video file (D-050, D-051). Google Drive's player says nothing, so it is not one of these.
export const frameTicks = src => /youtube-nocookie\.com\/embed\/|player\.vimeo\.com\//.test(src || '');
// YouTube answers only when asked for its messages in the address
export function frameTicking(src) {
  if (!/youtube-nocookie\.com\/embed\//.test(src)) return src;
  return src + (src.includes('?') ? '&' : '?') + 'enablejsapi=1' + (/^https?:/.test(location.origin) ? '&origin=' + encodeURIComponent(location.origin) : '');
}
const YT = 'https://www.youtube-nocookie.com', VM = 'https://player.vimeo.com';
const live = new Set();
let listening = false;
function listen() {
  if (listening) return; listening = true;
  addEventListener('message', e => {
    if (!live.size || (e.origin !== YT && e.origin !== VM)) return;
    for (const k of live) {
      if (!k.fr.isConnected) { k.stop(); continue; }
      if (e.source !== k.fr.contentWindow) continue;
      let d = e.data; if (typeof d === 'string') try { d = JSON.parse(d); } catch { return; }
      if (!d || typeof d !== 'object') return;
      if (k.yt && d.info && typeof d.info === 'object') k.heard(d.info.currentTime, d.info.playerState != null ? d.info.playerState === 1 : null);
      else if (!k.yt) {
        if (d.event === 'ready') k.ask();
        else if (d.event === 'timeupdate' || d.event === 'seeked') k.heard(d.data && d.data.seconds, d.event === 'timeupdate' ? true : null);
        else if (d.event === 'pause') k.heard(d.data && d.data.seconds, false);
        else if (d.event === 'play') k.heard(d.data && d.data.seconds, true);
      }
      return;
    }
  });
}
class FrameMedia extends EventTarget {
  constructor(fr) {
    super();
    this.fr = fr; this.yt = /youtube/.test(fr.src); this.t = null; this.at = 0; this.on = false; this.rate = 1;
    live.add(this); listen();
    let n = 0;
    const tries = () => { this.ask(); const iv = setInterval(() => { if (this.t != null || ++n > 12 || !fr.isConnected) return clearInterval(iv); this.ask(); }, 500); };
    fr.addEventListener('load', tries); tries();
    // the page's own clock between the player's messages, so captions, clips and the transcript follow along
    this.iv = setInterval(() => { if (!fr.isConnected) return this.stop(); if (this.on) this.dispatchEvent(new Event('timeupdate')); }, 250);
  }
  stop() { clearInterval(this.iv); live.delete(this); }
  ask() { try { const w = this.fr.contentWindow; if (!w) return; if (this.yt) w.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT); else for (const v of ['timeupdate', 'play', 'pause', 'seeked']) w.postMessage(JSON.stringify({ method: 'addEventListener', value: v }), VM); } catch {} }
  heard(t, on) {
    const first = this.t == null;
    if (typeof t === 'number' && isFinite(t)) { this.t = t; this.at = Date.now(); }
    if (on != null) { const was = this.on; this.on = on; if (was !== on) this.dispatchEvent(new Event(on ? 'play' : 'pause')); }
    if (first && this.t != null) this.dispatchEvent(new Event('loadedmetadata'));
    this.dispatchEvent(new Event('timeupdate'));
  }
  say(yt, vimeo) { try { this.fr.contentWindow.postMessage(JSON.stringify(this.yt ? { event: 'command', func: yt[0], args: yt[1] } : vimeo), this.yt ? YT : VM); } catch {} }
  get isConnected() { return this.fr.isConnected; }
  get known() { return this.t != null; }
  get readyState() { return this.t == null ? 0 : 1; }
  get paused() { return !this.on; }
  get currentTime() { return this.t == null ? 0 : this.t + (this.on ? (Date.now() - this.at) / 1000 * this.rate : 0); }
  set currentTime(v) { this.say(['seekTo', [v, true]], { method: 'setCurrentTime', value: v }); this.t = v; this.at = Date.now(); this.dispatchEvent(new Event('timeupdate')); }
  get playbackRate() { return this.rate; }
  set playbackRate(r) { this.rate = r; this.say(['setPlaybackRate', [r]], { method: 'setPlaybackRate', value: r }); }
  play() { this.t = this.currentTime; this.at = Date.now(); this.on = true; this.say(['playVideo', []], { method: 'play' }); return Promise.resolve(); }
  pause() { this.t = this.currentTime; this.at = Date.now(); this.on = false; this.say(['pauseVideo', []], { method: 'pause' }); }
}
const made = new WeakMap();
export function frameMedia(fr) { if (!fr || !frameTicks(fr.src)) return null; if (!made.has(fr)) made.set(fr, new FrameMedia(fr)); return made.get(fr); }
// Where a site's player on the page is, in seconds, when one is playing (typed notes take a line's time from here). null if none.
export function frameNow() { for (const k of live) if (k.isConnected && k.on) return k.currentTime; return null; }
