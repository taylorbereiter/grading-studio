/* ---------------- work with no paper: a video by its link, the partners in it, and a page for notes ---------------- */
// For presentations, speeches and anything else that is watched rather than read.
// A link is kept as a tiny file on the student (a web shortcut, the kind Windows and a Mac make: "Name.url"), so it is saved, carried,
// merged, removed and given to partners exactly like any file. Nothing is fetched: the video stays where it is, and plays only when asked.
// The notes page is a PDF made here, so the pen, typed text, comments, the score and the export all work on it as on a paper.
const LINK_RX = /\.(url|webloc)$/i;
// A web address somebody typed or pasted: http or https only, or ''.
function linkClean(v) {
  v = String(v || '').trim().replace(/&amp;/g, '&'); if (!v || /\s/.test(v)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
}
// The address inside a shortcut file, or ''.
function linkOf(data) {
  if (!data || !data.length || data.length > 20000) return '';
  let s = ''; try { s = new TextDecoder().decode(data); } catch { return ''; }
  const m = /^\s*URL\s*=\s*(\S+)/mi.exec(s) || /<string>\s*([^<\s]+)\s*<\/string>/i.exec(s);
  return m ? linkClean(m[1]) : '';
}
const linkBytes = url => new TextEncoder().encode('[InternetShortcut]\r\nURL=' + url + '\r\n');
const linkHost = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
// How a link can play on the page: the player address the site itself gives for embedding, or the file itself. null: it opens in its own window only.
function linkPlayer(url) {
  let u; try { u = new URL(url); } catch { return null; }
  const h = u.hostname.replace(/^www\./, '').toLowerCase(), p = u.pathname, id = s => (/^[\w-]{6,}$/.test(s || '') ? s : '');
  let m;
  if (h === 'drive.google.com') { const k = id((m = /\/file\/d\/([^/]+)/.exec(p)) ? m[1] : u.searchParams.get('id')); return k ? { frame: 'https://drive.google.com/file/d/' + k + '/preview' } : null; }
  if (h === 'docs.google.com' && (m = /^\/presentation\/d\/([^/]+)/.exec(p)) && id(m[1])) return { frame: 'https://docs.google.com/presentation/d/' + m[1] + '/embed' };
  if (h === 'youtu.be') { const k = id(p.slice(1).split('/')[0]); return k ? { frame: 'https://www.youtube-nocookie.com/embed/' + k } : null; }
  if (h === 'youtube.com' || h === 'm.youtube.com') { const k = id((m = /^\/(?:shorts|embed|live)\/([^/]+)/.exec(p)) ? m[1] : u.searchParams.get('v')); return k ? { frame: 'https://www.youtube-nocookie.com/embed/' + k } : null; }
  if (h === 'vimeo.com' && (m = /^\/(\d+)/.exec(p))) return { frame: 'https://player.vimeo.com/video/' + m[1] };
  if (h === 'loom.com' && (m = /^\/share\/([\w-]+)/.exec(p))) return { frame: 'https://www.loom.com/embed/' + m[1] };
  if (MEDIA_RX.test(p)) return VIDEO_RX.test(p) ? { video: url } : { audio: url };
  return null;
}
const linkTitle = f => f.name.replace(LINK_RX, '').replace(/ \(added \d+\)$/, '');
// A video file kept in this browser (not a web link): the student's shortcut file names it as "gs-video:<id>", and the video itself is in its own database.
const vidRef = data => { if (!data || !data.length || data.length > 4000) return ''; let s = ''; try { s = new TextDecoder().decode(data); } catch { return ''; } const m = /^\s*URL\s*=\s*gs-video:([\w-]{6,40})\s*$/mi.exec(s); return m ? m[1] : ''; };
const vidBytes = (id, name, size) => new TextEncoder().encode('[InternetShortcut]\r\nURL=gs-video:' + id + '\r\nName=' + String(name || '').replace(/[\r\n]+/g, ' ').slice(0, 120) + '\r\nSize=' + (size || 0) + '\r\n');
// What a link or kept video is known by, the same for every partner who has it.
const linkKey = f => { const v = vidRef(f.data); return v ? 'gs-video:' + v : linkOf(f.data); };

/* ---------- a video filmed sideways, turned the right way up ---------- */
// batch.vrot = { the link (linkKey) or a video file's path: 90 | 180 | 270 }, so partners sharing a link see it turned too. Only how it is shown here
// changes: the video and the link stay as they are. A site's player turns as a whole, captions and buttons with it, since the page can't reach inside it.
const vrotKey = f => (f.kind === 'link' ? linkKey(f) : f.path);
const vrotOf = f => (batch && batch.vrot && batch.vrot[vrotKey(f)]) || 0;
const VROT_BTN = '<button class="btn sm" data-vrot title="Turn the video a quarter turn, for one filmed sideways" aria-label="Turn the video">⟳ Turn</button>';
// Puts the player in a box of its own and turns it inside; returns the box (the part the size bar drags).
function vidRot(player, f) {
  const box = document.createElement('div'); box.className = 'vrotbox';
  player.replaceWith(box); box.appendChild(player);
  const fit = () => {
    const d = vrotOf(f), side = d === 90 || d === 270;
    box.classList.toggle('on', !!d); box.dataset.turn = d;
    if (!d) { player.style.cssText = ''; return; }
    const W = box.clientWidth, H = box.clientHeight;
    player.style.cssText = side ? 'position:absolute;width:' + H + 'px;height:' + W + 'px;left:' + (W - H) / 2 + 'px;top:' + (H - W) / 2 + 'px;max-height:none;min-height:0;transform:rotate(' + d + 'deg)'
      : 'position:absolute;inset:0;width:100%;height:100%;max-height:none;min-height:0;transform:rotate(180deg)';
  };
  new ResizeObserver(fit).observe(box);
  box.vfit = fit; fit();
  return box;
}
function vidTurn(st, f, card) {
  const k = vrotKey(f), d = (vrotOf(f) + 90) % 360;
  batch.vrot ||= {}; if (d) batch.vrot[k] = d; else delete batch.vrot[k];
  if (!Object.keys(batch.vrot).length) delete batch.vrot;
  for (const b of document.querySelectorAll('#paper .vrotbox')) if (b.vfit) b.vfit();
  const n = card && card.querySelector('.vrnote'); if (n) n.hidden = !d;
  saveSoon();
}

// The card above the paper. The player stays at the top while the notes page scrolls under it.
function linkCard(st, f) {
  if (vidRef(f.data)) return vfileCard(st, f);
  const url = linkOf(f.data), play = linkPlayer(url), ticks = !!play && (!play.frame || frameTicks(play.frame));
  const el = document.createElement('div'); el.className = 'media vlink';
  el.innerHTML = '<div class="mstick"><div class="mhead"><b>' + esc(linkTitle(f)) + '</b><span class="muted">' + esc(linkHost(url)) + '</span></div><div class="vlslot" hidden></div>' +
    (play && ticks ? '<div class="mctl vdrive" hidden><button class="btn sm" data-skip="-10">◀◀ 10s</button><button class="btn sm" data-skip="10">10s ▶▶</button>' +
      '<span class="seg">' + [1, 1.25, 1.5, 2].map(r => '<button data-rate="' + r + '" aria-pressed="' + (r === store.get('gs.rate', 1)) + '">' + r + '×</button>').join('') + '</span>' +
      (play.video && document.pictureInPictureEnabled ? PIP_BTN : '') + '</div>' : '') +
    '<div class="mctl">' + (play ? '<button class="btn sm primary" data-vplay aria-pressed="false">▶ Play here</button>' : '') +
    (ticks ? '<button class="btn sm" data-vstamp title="Adds where the video is to your comment, like [2:15]">+ Time to comment</button>' : '') +
    '<button class="btn sm' + (play ? '' : ' primary') + '" data-vopen title="Opens the video in a window of its own, to keep beside this one">Open in its own window</button>' +
    '<button class="btn sm" data-vcopy>Copy link</button>' + (play && (play.frame || play.video) ? VROT_BTN : '') + '</div>' +
    (play && play.frame && !ticks ? '<p class="muted vlnote vrnote"' + (vrotOf(f) ? '' : ' hidden') + '>The site’s own captions turn with the video. For captions the right way up, paste a transcript below and turn on Captions under the video.</p>' : '') +
    '<p class="muted vlnote">' + (play ? 'Only the link is kept here; the video stays where it is. If it asks you to sign in or won’t play, open it in its own window.' : 'Only the link is kept here. This site can’t play inside the page, so it opens in a window of its own.') + '</p></div>';
  // where the player is: the page's own video, or a site's player that says so (YouTube, Vimeo). null when nothing is playing here or the site doesn't say.
  const now = () => { const m = el.querySelector('.vlslot video, .vlslot audio'); if (m) return m; const fr = el.querySelector('.vlslot iframe'), t = fr && frameTime(fr); return t == null ? null : { currentTime: t }; };
  // the player as something to drive: the page's own video, or a site's player that takes orders (YouTube, Vimeo)
  const drive = {
    ok: () => el.isConnected && !!el.querySelector('.vlslot video, .vlslot audio, .vlslot iframe') && ticks,
    skip(d) { const m = el.querySelector('.vlslot video, .vlslot audio'); if (m) { m.currentTime = Math.max(0, m.currentTime + d); return; } const fr = el.querySelector('.vlslot iframe'), t = fr && frameTime(fr); if (t != null) frameSeek(fr, Math.max(0, t + d)); },
    rate(r) { const m = el.querySelector('.vlslot video, .vlslot audio'); if (m) m.playbackRate = r; else { const fr = el.querySelector('.vlslot iframe'); if (fr) frameRate(fr, r); } },
    toggle() { const m = el.querySelector('.vlslot video, .vlslot audio'); if (m) { m.paused ? m.play().catch(() => {}) : m.pause(); return; } const fr = el.querySelector('.vlslot iframe'); if (fr) frameToggle(fr); },
  };
  el.onclick = e => {
    const sk = e.target.closest('[data-skip]'); if (sk) { drive.skip(+sk.dataset.skip); return; }
    const rt = e.target.closest('[data-rate]'); if (rt) { store.set('gs.rate', +rt.dataset.rate); drive.rate(+rt.dataset.rate); for (const b of el.querySelectorAll('[data-rate]')) b.setAttribute('aria-pressed', b === rt); return; }
    if (e.target.closest('[data-pip]')) { vidFloat(el.querySelector('.vlslot video')); return; }
    if (e.target.closest('[data-vopen]')) { window.open(url, '_blank', 'noopener,noreferrer,popup,width=980,height=640'); return; }
    if (e.target.closest('[data-vrot]')) { vidTurn(st, f, el); if (el.querySelector('.vlslot').hidden) fill(); return; }
    if (e.target.closest('[data-vcopy]')) { navigator.clipboard.writeText(url).then(() => toast('Link copied'), () => toast('The link couldn’t be copied')); return; }
    if (e.target.closest('[data-vstamp]')) { const m = now(); if (!m) return toast('Press ▶ Play here first, then play the video to the moment you mean'); addStamp(st, m.currentTime); return; }
    const b = e.target.closest('[data-vplay]'); if (!b) return;
    const slot = el.querySelector('.vlslot'), on = slot.hidden;
    slot.hidden = !on; b.setAttribute('aria-pressed', on); b.textContent = on ? 'Close the player' : '▶ Play here';
    if (!on) { slot.innerHTML = ''; const dr = el.querySelector('.vdrive'); if (dr) dr.hidden = true; if (curPlay === drive) curPlay = null; return; }
    fill();
  };
  // c: a clip to start at, or nothing for the whole video
  const fill = c => {
    const slot = el.querySelector('.vlslot'), b = el.querySelector('[data-vplay]');
    slot.hidden = false; slot.innerHTML = ''; b.setAttribute('aria-pressed', 'true'); b.textContent = 'Close the player';
    if (play.frame) { const fr = playerFrame(frameTicking(c ? clipFrame(play.frame, c).src : play.frame), linkTitle(f)); slot.appendChild(fr); frameClock(fr); vidGrip(slot, vidRot(fr, f)); }
    else { const m = document.createElement(play.video ? 'video' : 'audio'); m.controls = true; m.preload = 'metadata'; m.src = play.video || play.audio; slot.appendChild(m); if (play.video) vidGrip(slot, vidRot(m, f)); if (c) clipRun(m, c); }
    const dr = el.querySelector('.vdrive');
    if (dr) { dr.hidden = false; if (!curPlay || !curPlay.ok()) curPlay = drive; const r = store.get('gs.rate', 1); if (r !== 1) { const m = slot.querySelector('video, audio'); if (m) m.playbackRate = r; else { const fr = slot.querySelector('iframe'); fr.addEventListener('load', () => setTimeout(() => { if (fr.isConnected) frameRate(fr, r); }, 1200)); } } }
  };
  clipStrip(el.querySelector('.mstick'), f, now, c => (play ? fill(c) : clipShow(c.id)), play && play.frame && !ticks ? 'drive' : '');
  // a pasted transcript: a line with a time plays the video from there (a site's player starts again at that time)
  const pan = trPanel(el, f, { make: false, seek: t => {
    const m = el.querySelector('.vlslot video, .vlslot audio');
    if (m) { try { m.currentTime = t; } catch {} m.play().catch(() => {}); return; }
    if (play) { fill({ a: t }); return; }
    toast('This site can’t play inside the page. Open it in its own window and go to ' + fmtTime(t) + '.');
  } });
  let seen = false, n = 0; const iv = setInterval(() => { if (!el.isConnected) { if (seen || ++n > 40) clearInterval(iv); return; } seen = true; const m = now(); if (m) pan.tick(m.currentTime, !('paused' in m) || !m.paused); }, 500);
  return el;
}

/* ---------- video files kept in this browser ---------- */
// The video goes in a database of its own (grading-studio-videos), stored as the file itself, so a long video fits as long as the computer has room
// and it is only read when it plays. The student gets a tiny shortcut file naming it ("gs-video:<id>"), so saving, partners, Remove and merging
// treat it like a link. Partners share one stored copy. It never leaves this browser: not in take-home files, the linked folder or the export.
let vkDbP = null;
const vkDb = () => vkDbP ||= new Promise((res, rej) => { const r = indexedDB.open('grading-studio-videos', 1); r.onupgradeneeded = () => r.result.createObjectStore('v'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function vkDo(mode, fn) {
  const db = await vkDb();
  return new Promise((res, rej) => { const tx = db.transaction('v', mode), req = fn(tx.objectStore('v')); tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}
const vkSeen = new Map();   // id -> { name, url, blob } or null, while this page is open
// Keeps a video file. id: to put a file back under the name a shortcut already has. Throws with plain words when there isn't room.
async function vkPut(file, id) {
  id = id || uid();
  try { const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; if (e && e.quota && e.quota - (e.usage || 0) < file.size * 1.05) throw new Error('room'); } catch (err) { if (err.message === 'room') throw new Error('There isn’t room on this computer for that video (' + fmtSize(file.size) + '). Free up some space, or use a link to the video instead.'); }
  askToKeep();
  try { await vkDo('readwrite', o => o.put({ id, name: file.name, type: file.type || MIME[extOf(file.name)] || '', size: file.size, at: Date.now(), blob: file }, id)); }
  catch (err) { console.error(err); throw new Error('This browser couldn’t keep that video, usually because the computer is out of room. A link to the video works at any size.'); }
  const was = vkSeen.get(id); if (was) URL.revokeObjectURL(was.url); vkSeen.delete(id);
  return id;
}
async function vkGet(id) {
  if (vkSeen.has(id)) return vkSeen.get(id);
  let r = null; try { r = await vkDo('readonly', o => o.get(id)); } catch (e) { console.error(e); }
  const out = r && r.blob ? { name: r.name, size: r.size, blob: r.blob, url: URL.createObjectURL(r.blob.type ? r.blob : new Blob([r.blob], { type: r.type || MIME[extOf(r.name)] || '' })) } : null;
  vkSeen.set(id, out); return out;
}
// Videos no shortcut names any more go, a while after the last one went (so one being added right now is never caught).
async function vkSweep() {
  try {
    if (!vkDbP && indexedDB.databases && !(await indexedDB.databases()).some(d => d.name === 'grading-studio-videos')) return;   // never made here: nothing to sweep, and no database made for it
    const ids = await vkDo('readonly', o => o.getAllKeys()); if (!ids || !ids.length) return;
    const used = new Set();
    for (const r of (await idbDo('readonly', o => o.getAll())) || []) { const v = r && /\.url$/i.test(r.path || '') && vidRef(r.data); if (v) used.add(v); }
    if (batch) for (const st of batch.students) for (const f of st.files.concat(st.gone || [])) { const v = f.kind === 'link' && vidRef(f.data); if (v) used.add(v); }
    const old = Date.now() - 15 * 60e3;
    for (const id of ids) { if (used.has(id)) continue; const r = await vkDo('readonly', o => o.get(id)); if (r && r.at > old) continue; await vkDo('readwrite', o => o.delete(id)); const was = vkSeen.get(id); if (was) URL.revokeObjectURL(was.url); vkSeen.delete(id); }
  } catch (e) { console.error(e); }
}
const vkClear = () => vkDo('readwrite', o => o.clear()).catch(e => console.error(e)).then(() => { for (const v of vkSeen.values()) if (v) URL.revokeObjectURL(v.url); vkSeen.clear(); });
const vidPick = () => new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,audio/*,' + Object.keys(MIME).map(x => '.' + x).join(','); inp.onchange = () => res(inp.files[0] || null); inp.click(); });
function vfileCard(st, f) {
  const id = vidRef(f.data), hold = document.createElement('div'); hold.className = 'media vfile';
  hold.innerHTML = '<div class="mstick"><div class="mhead"><b>' + esc(linkTitle(f)) + '</b><span class="muted">Opening the video…</span></div></div>';
  vkGet(id).then(k => {
    if (!hold.isConnected && !hold.parentNode) return;
    if (k) { hold.replaceWith(mediaCard(st, f, k)); return; }
    hold.querySelector('.mhead .muted').textContent = 'video file';
    hold.querySelector('.mstick').insertAdjacentHTML('beforeend', '<p class="vlnote">This video isn’t in this browser. A video file stays in the browser it was added in: it doesn’t go in take-home files or the linked folder.</p><div class="mctl"><button class="btn sm primary" data-vkback>Choose the video file…</button></div>');
    hold.querySelector('[data-vkback]').onclick = async () => {
      const file = await vidPick(); if (!file) return;
      try { await vkPut(file, id); toast('The video is back'); openStudent(cur, f.path); } catch (err) { sayDlg(err.message); }
    };
  });
  return hold;
}

/* ---------- where a site's player is ---------- */
// YouTube and Vimeo tell the page where their player is when asked (their own embed messages), so + Clip and + Time to comment can start there.
// Google Drive's player says nothing, so its times are typed.
const frameTicks = src => /youtube-nocookie\.com\/embed\/|player\.vimeo\.com\//.test(src);
function frameTicking(src) {
  if (!/youtube-nocookie\.com\/embed\//.test(src)) return src;
  return src + (src.includes('?') ? '&' : '?') + 'enablejsapi=1' + (/^https?:/.test(location.origin) ? '&origin=' + encodeURIComponent(location.origin) : '');
}
const clocks = new Set();
function frameClock(fr) {
  if (!frameTicks(fr.src)) return;
  const k = { fr, t: null, at: 0, on: false, yt: /youtube/.test(fr.src) }, to = k.yt ? 'https://www.youtube-nocookie.com' : 'https://player.vimeo.com';
  const ask = () => { try { const w = fr.contentWindow; if (!w) return; if (k.yt) w.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), to); else for (const v of ['timeupdate', 'play', 'pause', 'seeked']) w.postMessage(JSON.stringify({ method: 'addEventListener', value: v }), to); } catch {} };
  k.ask = ask; clocks.add(k);
  let n = 0; fr.addEventListener('load', () => { ask(); const iv = setInterval(() => { if (k.t != null || ++n > 12 || !fr.isConnected) return clearInterval(iv); ask(); }, 500); });
}
window.addEventListener('message', e => {
  if (!clocks.size || !/^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)$/.test(e.origin)) return;
  for (const k of clocks) {
    if (!k.fr.isConnected) { clocks.delete(k); continue; }
    if (e.source !== k.fr.contentWindow) continue;
    let d = e.data; if (typeof d === 'string') try { d = JSON.parse(d); } catch { return; }
    if (!d || typeof d !== 'object') return;
    const at = (t, on) => { if (typeof t === 'number' && isFinite(t)) { k.t = t; k.at = Date.now(); } if (on != null) k.on = on; };
    if (k.yt && d.info && typeof d.info === 'object') at(d.info.currentTime, d.info.playerState != null ? d.info.playerState === 1 : null);
    else if (!k.yt) { if (d.event === 'ready') k.ask(); else if (d.event === 'timeupdate' || d.event === 'seeked') at(d.data && d.data.seconds, d.event === 'timeupdate' ? true : null); else if (d.event === 'pause') at(d.data && d.data.seconds, false); else if (d.event === 'play') at(d.data && d.data.seconds, true); }
    return;
  }
});
// Orders to a site's player, in its own embed messages: go to a time, a speed, play or pause. Drive's player takes none.
function frameSay(fr, yt, vimeo) {
  for (const k of clocks) if (k.fr === fr) { try { fr.contentWindow.postMessage(JSON.stringify(k.yt ? { event: 'command', func: yt[0], args: yt[1] } : vimeo), k.yt ? 'https://www.youtube-nocookie.com' : 'https://player.vimeo.com'); } catch {} return k; }
  return null;
}
function frameSeek(fr, t) { const k = frameSay(fr, ['seekTo', [t, true]], { method: 'setCurrentTime', value: t }); if (k) { k.t = t; k.at = Date.now(); } }
const frameRate = (fr, r) => { frameSay(fr, ['setPlaybackRate', [r]], { method: 'setPlaybackRate', value: r }); };
function frameToggle(fr) { for (const k of clocks) if (k.fr === fr) { frameSay(fr, [k.on ? 'pauseVideo' : 'playVideo', []], { method: k.on ? 'pause' : 'play' }); if (k.on) { k.t = frameTime(fr); k.at = Date.now(); } k.on = !k.on; if (k.on) k.at = Date.now(); return; } }
// A video of the page's own in a small window that stays on top of every other (the browser's picture in picture).
const PIP_BTN = '<button class="btn sm" data-pip title="Keeps the video in a small window on top of everything else, so the whole screen is free for the paper">Float</button>';
function vidFloat(m) { if (!m) return; if (document.pictureInPictureElement === m) document.exitPictureInPicture().catch(() => {}); else m.requestPictureInPicture().catch(() => toast('This browser couldn’t float the video')); }
let curPlay = null;   // a link's player that takes orders, for the keys (Space, J, L) when there is no video file on screen
function frameTime(fr) { for (const k of clocks) if (k.fr === fr) return k.t == null ? null : k.t + (k.on ? (Date.now() - k.at) / 1000 : 0); return null; }

/* ---------- a video as big as she likes ---------- */
// The bar under a video drags it taller (and the card wider to match), without going full screen. One size for every video, kept in this browser (gs.vidH).
const VID_MIN = 160;
function vidHApply(h) {
  const r = document.documentElement;
  if (h) { r.style.setProperty('--vid-h', Math.round(h) + 'px'); r.classList.add('vidsized'); } else { r.style.removeProperty('--vid-h'); r.classList.remove('vidsized'); }
  const p = $('#paper'); r.classList.toggle('vidtall', !!h && !!p && p.clientHeight > 0 && h > p.clientHeight * 0.55);   // that tall, it scrolls away with the page instead of covering the notes page
}
function vidGrip(host, player) {
  const g = document.createElement('div'); g.className = 'vgrip'; g.tabIndex = 0; g.setAttribute('role', 'separator'); g.setAttribute('aria-orientation', 'horizontal');
  g.setAttribute('aria-label', 'Video size'); g.title = 'Drag to make the video bigger or smaller. Double-click for the usual size.';
  player.after(g);
  const set = (h, keep) => { h = Math.max(VID_MIN, Math.min(window.innerHeight * 0.92, h)); vidHApply(h); if (keep) store.set('gs.vidH', Math.round(h)); };
  let tapped = 0;
  g.onpointerdown = e => {
    e.preventDefault();
    if (Date.now() - tapped < 400) { tapped = 0; store.del('gs.vidH'); vidHApply(0); return; }   // a double click: the usual size
    g.setPointerCapture(e.pointerId); g.classList.add('on');
    const y0 = e.clientY, h0 = player.getBoundingClientRect().height, sh = document.createElement('div'); sh.className = 'vgripshield'; document.body.appendChild(sh);   // a site's player would catch the pointer
    g.onpointermove = ev => set(h0 + ev.clientY - y0);
    g.onpointerup = g.onpointercancel = ev => { g.onpointermove = g.onpointerup = g.onpointercancel = null; g.classList.remove('on'); sh.remove(); const dy = ev.clientY - y0; if (Math.abs(dy) < 3) tapped = Date.now(); else set(h0 + dy, true); };
  };
  g.onkeydown = e => { const d = e.key === 'ArrowDown' ? 40 : e.key === 'ArrowUp' ? -40 : 0; if (!d) return; e.preventDefault(); e.stopPropagation(); set(player.getBoundingClientRect().height + d, true); };
  vidHApply(store.get('gs.vidH', 0));
}
Object.assign(window.__gs, { vidRef, linkKey, vrotOf, vkPut, vkGet, vkSweep, frameTicking, vidHApply, trParse, trLines, trText, trSet, asrStandIn });

/* ---------- the notes page ---------- */
const NP_W = 595.28, NP_H = 841.89, NP_M = 48, NP_TAIL = '%GradingStudio-notes';
const NP_KINDS = [['lined', 'Lined', 'Ruled lines, with a margin for the time'], ['rubric', 'Rubric rows', 'A box for each row of the rubric'], ['cols', 'Two columns', 'Went well, and to work on'], ['blank', 'Blank', 'Only the title']];
const isNotes = d => !!d && d.length > 64 && new TextDecoder('latin1').decode(d.subarray(d.length - 64)).includes(NP_TAIL);
const notesFileOf = st => st.files.find(f => f.kind === 'pdf' && !f.virtual && isNotes(f.data)) || null;
let npLast = 'lined';
// kind: one of NP_KINDS. title: printed at the top. rows: the rubric's row names, for 'rubric'.
async function notesPdf(kind, title, rows) {
  const { rgb } = PDFLib, doc = await PDFLib.PDFDocument.create();
  title = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Notes';
  doc.setTitle(title);   // no Creator: 'Grading Studio' there means a flattened export (imported.js)
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const can = new Set(font.getCharacterSet()), ink = rgb(0.1, 0.1, 0.12), gray = rgb(0.42, 0.45, 0.5), rule = rgb(0.8, 0.84, 0.9), edge = rgb(0.66, 0.71, 0.79);
  // A label: real text where the PDF's own font can write it, else a small picture of it drawn by the browser (any alphabet).
  const label = async (page, text, x, y, size, o) => {
    o = o || {}; const f = o.bold ? bold : font, col = o.gray ? gray : ink;
    if ([...text].every(ch => can.has(ch.codePointAt(0)))) {
      let t = text; if (o.max) while (t.length > 1 && f.widthOfTextAtSize(t, size) > o.max) t = t.slice(0, -2).trimEnd() + '…';
      const w = f.widthOfTextAtSize(t, size); page.drawText(t, { x: o.right ? x - w : x, y, size, font: f, color: col }); return;
    }
    const S = 3, c = document.createElement('canvas'), g = c.getContext('2d'), face = (o.bold ? 700 : 400) + ' ' + size * S + 'px "Inter", system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Thai", Tahoma, sans-serif';
    g.font = face; const w = Math.min(g.measureText(text).width / S, o.max || 1e4);
    c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.ceil(size * 1.6 * S);
    const g2 = c.getContext('2d'); g2.font = face; g2.fillStyle = o.gray ? '#6B7280' : '#1a1a1f'; g2.textBaseline = 'alphabetic'; g2.fillText(text, 0, size * 1.2 * S);
    const png = await new Promise(r => c.toBlob(r, 'image/png')), img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    page.drawImage(img, { x: o.right ? x - w : x, y: y - size * 0.4, width: w, height: size * 1.6 });
  };
  const line = (page, x1, y1, x2, y2, col, t) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t || 0.7, color: col || rule });
  const R = NP_W - NP_M, top = NP_H - NP_M;
  const start = async () => {
    const page = doc.addPage([NP_W, NP_H]);
    await label(page, title, NP_M, top - 14, 15, { bold: true, max: R - NP_M - 70 });
    await label(page, tr('Notes'), R, top - 13, 9, { gray: true, right: true });
    line(page, NP_M, top - 24, R, top - 24, edge, 0.9);
    return page;
  };
  const ruled = (page, x1, x2, from, to, step) => { for (let y = from; y >= to; y -= step) line(page, x1, y, x2, y); };
  if (kind === 'rubric' && rows && rows.length) {
    const all = rows.map(r => String(r || '').trim() || tr('Row')).concat(rows.length % 5 !== 0 ? [tr('Other notes')] : []);
    for (let i = 0; i < all.length; i += 5) {
      const page = await start(), part = all.slice(i, i + 5), gap = 10, y0 = top - 38, h = Math.min(190, (y0 - NP_M - gap * (part.length - 1)) / part.length);
      for (const [k, name] of part.entries()) {
        const t = y0 - k * (h + gap);
        page.drawRectangle({ x: NP_M, y: t - h, width: R - NP_M, height: h, borderColor: edge, borderWidth: 0.8 });
        await label(page, name, NP_M + 10, t - 17, 10.5, { bold: true, max: R - NP_M - 20 });
        ruled(page, NP_M + 10, R - 10, t - 46, t - h + 12, 24);
      }
    }
  } else if (kind === 'cols') {
    const page = await start(), mid = NP_W / 2;
    await label(page, tr('Went well'), NP_M, top - 44, 10.5, { bold: true });
    await label(page, tr('To work on'), mid + 12, top - 44, 10.5, { bold: true });
    line(page, mid, top - 30, mid, NP_M, edge, 0.8);
    ruled(page, NP_M, mid - 12, top - 78, NP_M, 26); ruled(page, mid + 12, R, top - 78, NP_M, 26);
  } else if (kind === 'blank') {
    await start();
  } else {
    const page = await start(), mx = NP_M + 52;
    await label(page, tr('Time'), NP_M, top - 40, 8, { gray: true });
    line(page, mx, top - 30, mx, NP_M, edge, 0.8);
    ruled(page, NP_M, R, top - 72, NP_M, 26);
  }
  const bytes = await doc.save(), tail = new TextEncoder().encode('\n' + NP_TAIL + ' ' + uid().slice(0, 8).padEnd(8, '0') + '\n'), out = new Uint8Array(bytes.length + tail.length);
  out.set(bytes); out.set(tail, bytes.length); return out;
}
// The little pictures to choose from. rows: the rubric's rows, or none (then Rubric rows can't be picked).
const NP_ART = {
  lined: '<path d="M6 12h36M6 19h36M6 26h36M6 33h36M6 40h36M6 47h36" /><path d="M14 9v43" class="e"/>',
  rubric: '<rect x="6" y="10" width="36" height="12" rx="1.5" class="e"/><rect x="6" y="25" width="36" height="12" rx="1.5" class="e"/><rect x="6" y="40" width="36" height="12" rx="1.5" class="e"/><path d="M9 14h12M9 29h12M9 44h12" class="k"/>',
  cols: '<path d="M24 9v43" class="e"/><path d="M6 12h10M28 12h10" class="k"/><path d="M6 19h14M6 26h14M6 33h14M6 40h14M6 47h14M28 19h14M28 26h14M28 33h14M28 40h14M28 47h14"/>',
  blank: '',
};
function npTiles(sel, rows, none) {
  return '<div class="nptiles" role="group" aria-label="Notes page">' + (none ? '<button class="nptile" data-np="" aria-pressed="' + (!sel) + '"><svg viewBox="0 0 48 60" aria-hidden="true" class="none"><path d="M12 18l24 24M36 18L12 42" class="e"/></svg><b>None</b></button>' : '') +
    NP_KINDS.map(([k, name, about]) => { const off = k === 'rubric' && !(rows && rows.length);
      return '<button class="nptile" data-np="' + k + '" aria-pressed="' + (sel === k) + '"' + (off ? ' disabled title="This assignment has no rubric rows"' : ' title="' + esc(about) + '"') + '><svg viewBox="0 0 48 60" aria-hidden="true"><rect x="1" y="1" width="46" height="58" rx="3" class="pg"/><path d="M6 6h16" class="k"/>' + NP_ART[k] + '</svg><b>' + name + '</b></button>'; }).join('') + '</div>';
}
const npPick = (box, k) => { for (const b of box.querySelectorAll('.nptile')) b.setAttribute('aria-pressed', b.dataset.np === k); };
const npRows = su => (su && su.mode === 'rubric' && Array.isArray(su.criteria) ? su.criteria : []);
const npFileName = s => (String(s || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Notes');

// Adds files to a student and says which ones they became (a name already taken gets a number).
async function addAndFind(st, list) {
  const had = new Set(st.files);
  await addFiles(st, list, true);
  return st.files.filter(f => !had.has(f));
}
const copyFor = (st, f) => ({ path: f.name, file: new File([f.data], f.name), from: st.key });
// A partner's own copy of one of st's files: the one they have, or a new one.
async function partnerCopy(st, f, to) {
  if (f.kind === 'link') { const have = to.files.find(x => x.kind === 'link' && linkKey(x) === linkKey(f)); if (have) return have; }
  const have = to.files.find(x => x.from === st.key && x.name === f.name); if (have) return have;
  return (await addAndFind(to, [copyFor(st, f)]))[0] || null;
}
// The paper a group's marks are made on, for st: the group's own if it has one, else st's notes page, else the file given.
async function partnersJoin(st, anchor, list, extra) {
  const g0 = groupOf(st), shared = g0 && groupFileOf(g0, st);
  if (shared) anchor = shared;
  for (const to of list) {
    for (const f of extra) if (f !== anchor) await partnerCopy(st, f, to);
    if (groupMates(st).includes(to)) continue;
    let theirs = null;
    if (anchor && anchor.kind !== 'media') theirs = (isNotes(anchor.data) && !anchor.added && notesFileOf(to)) || await partnerCopy(st, anchor, to);
    groupAdd(st, anchor, to, theirs);
  }
}

// The list of students to tick, as in Group work…
function partnerList(st, picked, locked) {
  const anon = anonOn(), others = batch.students.map((s, i) => ({ s, i, label: shownName(s, i) })).filter(x => x.s !== st);
  if (anon) others.sort((a, b) => anonPos(a.i) - anonPos(b.i));
  const draw = () => {
    const q = $('#vdFind').value.toLowerCase().split(/\s+/).filter(Boolean);
    const list = others.filter(x => q.every(w => x.label.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))));
    $('#vdList').innerHTML = list.length ? list.map(x => { const lock = locked.has(x.s), on = lock || picked.has(x.s);
      return '<button class="mvrow vdrow" role="checkbox" aria-checked="' + on + '" data-vdto="' + x.i + '"' + (lock ? ' disabled' : '') + '><span><i aria-hidden="true"></i>' + esc(x.label) + '</span><span class="muted">' + (lock ? 'In the group' : on ? 'Partner' : '') + '</span></button>'; }).join('') : '<p class="muted">No name matches.</p>';
  };
  return { draw, html: '<input class="btn" id="vdFind" placeholder="' + (anon ? 'Type a paper number' : 'Type a name') + '" autocomplete="off" style="width:100%;margin-bottom:8px"><div id="vdList" class="mvlist vdlist"></div>' };
}

/* ---------- Add: A video… ---------- */
const VID_HINT = 'Paste the link: Google Drive, YouTube or anywhere else';
function openAddVideo(st, asFile) {
  if (!st) return;
  const who = shownName(st, batch.students.indexOf(st)), rows = npRows(setup), picked = new Set(), locked = new Set(groupMates(st));
  let np = notesFileOf(st) ? '' : (npLast === 'rubric' && !rows.length ? 'lined' : npLast), file = null, by = asFile ? 'file' : 'link';
  const pl = partnerList(st, picked, locked);
  openDlg('<div class="bh"><h2>Video for ' + esc(who) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb vdbox"><span class="seg vdby" role="group" aria-label="The video"><button data-vdby="link" aria-pressed="true">A link</button><button data-vdby="file" aria-pressed="false">A video file</button></span>' +
    '<div id="vdLinkBox"><input class="btn" id="vdLink" placeholder="' + VID_HINT + '" aria-label="Link to the video" autocomplete="off" spellcheck="false">' +
    '<p class="muted vdsay">Only the link is kept here, so the video stays where it is and nothing slows down.</p></div>' +
    '<div id="vdFileBox" hidden><div class="vdfile"><button class="btn" id="vdFile">Choose a video file…</button><span id="vdFileName" class="muted">or drop it here</span></div>' +
    '<p class="muted vdsay">Kept in this browser on this computer, at any length, as long as there is room. It doesn’t go in take-home files.</p></div>' +
    '<label class="vdlab" for="vdName">Name it</label><input class="btn" id="vdName" value="Presentation video" autocomplete="off">' +
    '<div class="vdlab">Notes page<small>A page to write on while you watch. It is marked, scored and returned like a paper.</small></div>' + npTiles(np, rows, true) +
    '<div class="vdlab">Partners<small>Tick everyone else in the video. They get the video and the notes page, and one set of marks and one grade covers the group.</small></div>' + pl.html + '</div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="vdAdd" disabled>Add to ' + esc(who) + '</button></div>');
  const link = $('#vdLink'), add = $('#vdAdd'), box = $('#dlgBox');
  const ready = () => {
    const v = link.value.trim(), ok = by === 'file' ? !!file : !!linkClean(v);
    add.disabled = !ok; link.classList.toggle('bad', by === 'link' && !!v && !ok);
    add.textContent = 'Add to ' + who + (picked.size ? ' and ' + picked.size + (picked.size === 1 ? ' partner' : ' partners') : '');
  };
  const setBy = k => { by = k; for (const b of box.querySelectorAll('[data-vdby]')) b.setAttribute('aria-pressed', b.dataset.vdby === k); $('#vdLinkBox').hidden = k !== 'link'; $('#vdFileBox').hidden = k !== 'file'; ready(); if (k === 'link') link.focus(); };
  const useFile = f => { if (!f) return; if (!MEDIA_RX.test(f.name) && !/^(video|audio)\//.test(f.type)) return toast('That isn’t a video or sound file'); file = f; $('#vdFileName').innerHTML = '<b>' + esc(f.name) + '</b> · ' + fmtSize(f.size); setBy('file'); };
  pl.draw(); link.oninput = ready; $('#vdFind').oninput = pl.draw;
  box.ondragover = e => { if (by === 'file') e.preventDefault(); };
  box.ondrop = e => { if (by !== 'file') return; e.preventDefault(); useFile(e.dataTransfer.files[0]); };
  box.onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const t = e.target.closest('.nptile'); if (t && !t.disabled) { np = t.dataset.np; npPick(box, np); return; }
    const row = e.target.closest('[data-vdto]'); if (row && !row.disabled) { const s = batch.students[+row.dataset.vdto]; if (picked.has(s)) picked.delete(s); else picked.add(s); pl.draw(); ready(); return; }
    const sb = e.target.closest('[data-vdby]'); if (sb) { setBy(sb.dataset.vdby); if (sb.dataset.vdby === 'file' && !file) useFile(await vidPick()); return; }
    if (e.target.closest('#vdFile')) { useFile(await vidPick()); return; }
    if (e.target !== add || add.disabled) return;
    const url = by === 'file' ? '' : linkClean(link.value), name = npFileName($('#vdName').value || 'Presentation video'), partners = [...picked], kind = np;
    add.disabled = true; add.textContent = 'Adding…';
    try { await videoAdd(st, { url, file: by === 'file' ? file : null, name, kind, partners }); closeDlg(); }
    catch (err) { console.error(err); add.disabled = false; ready(); sayDlg((err && err.message) || String(err)); }
  };
  if (asFile) setBy('file'); else link.focus();
}
// The student's shortcut for a link or a kept video file, ready for addFiles.
async function videoEntry(o) {
  if (o.file) { const id = await vkPut(o.file); return { path: o.name + '.url', file: new File([vidBytes(id, o.file.name, o.file.size)], o.name + '.url') }; }
  return { path: o.name + '.url', file: new File([linkBytes(o.url)], o.name + '.url') };
}
// o: { url | file, name, kind: a notes page or '', partners: [students] }. quiet: no toast and the student isn't opened (many at once).
async function videoAdd(st, o, quiet) {
  const list = [await videoEntry(o)];
  if (o.kind) { npLast = o.kind; const n = npFileName(o.name.replace(/\s*video$/i, '') + ' notes') + '.pdf'; list.push({ path: n, file: new File([await notesPdf(o.kind, batch.name, npRows(setup))], n, { type: 'application/pdf' }) }); }
  const made = await addAndFind(st, list), vid = made.find(f => f.kind === 'link' || f.kind === 'media') || made[0], page = made.find(f => f.kind === 'pdf') || notesFileOf(st);
  const all = [...new Set([...groupMates(st), ...(o.partners || [])])];
  if (all.length) await partnersJoin(st, page || vid, all, made.filter(f => f.kind !== 'media'));
  if (quiet) return made;
  saveSoon(); renderList();
  toast('Added the video to ' + groupNames([st, ...all]));
  await openStudent(batch.students.indexOf(st), vid && vid.path);
  return made;
}
// The paper a group shares when there is no notes page: the student's first paper or Word file.
const groupPaper = st => st.files.find(f => !f.virtual && (viewable(f) || f.kind === 'docx')) || null;

/* ---------- Add: A notes page… ---------- */
function openAddNotes(st) {
  if (!st) return;
  const who = shownName(st, batch.students.indexOf(st)), rows = npRows(setup), mates = groupMates(st), g = groupOf(st), share = mates.length && !(g && groupFileOf(g, st));
  let np = npLast === 'rubric' && !rows.length ? 'lined' : npLast;
  openDlg('<div class="bh"><h2>Notes page for ' + esc(who) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb vdbox"><p class="muted" style="margin:0 0 4px;font-size:14px">A page to write on while you watch or listen: a presentation, a speech, a performance. Write with the pen or type on it, then score and return it like a paper.' + (share ? ' ' + esc(groupNames(mates)) + (mates.length > 1 ? ' get' : ' gets') + ' it too, with the same marks.' : '') + '</p>' +
    npTiles(np, rows, false) + '<label class="vdlab" for="npName">Name it</label><input class="btn" id="npName" value="Notes" autocomplete="off"></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="npAdd">Add to ' + esc(who) + '</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const t = e.target.closest('.nptile'); if (t && !t.disabled) { np = t.dataset.np; npPick($('#dlgBox'), np); return; }
    if (e.target.id !== 'npAdd') return;
    const name = npFileName($('#npName').value) + '.pdf';
    closeDlg(); npLast = np;
    try {
      const made = await addAndFind(st, [{ path: name, file: new File([await notesPdf(np, batch.name, rows)], name, { type: 'application/pdf' }) }]);
      if (share && made[0]) await partnersJoin(st, made[0], mates.slice(), []);
      if (share && made[0]) { const gg = groupOf(st); if (gg) { gg.p[st.key] = made[0].path; for (const m of mates) { const c = m.files.find(x => x.from === st.key && x.name === made[0].name); if (c) gg.p[m.key] = c.path; } groupSync(); } }
      saveSoon(); renderList(); toast('Added a notes page to ' + groupNames(share ? [st, ...mates] : [st]));
      await openStudent(batch.students.indexOf(st), made[0] && made[0].path);
    } catch (err) { console.error(err); toast('That page couldn’t be added: ' + ((err && err.message) || err)); }
  };
}

/* ---------- videos and partners for the whole class, in one list ---------- */
// rows: [{ k, label, has: what video they have already ('' for none), mates: [k] already in their group }]. Used before the assignment is
// opened (the roster) and after (Setup > Partners and videos…). Returns { draw(), drop(files), out() }: out() gives the groups to make,
// [{ k: [keys, the first is the one whose video and paper the group shares], url, file }], only where something is new.
function pvList(host, rows) {
  const vid = new Map(), grp = new Map();   // k -> { url, file } ; k -> a Set shared by everyone in one new group
  let open = null;   // the row whose partners are being picked
  const R = k => rows.find(r => r.k === k), mine = k => grp.get(k) || new Set([k]);
  const old = k => new Set([k, ...((R(k) || {}).mates || [])]);
  const team = k => { const s = new Set(); for (const x of mine(k)) for (const y of old(x)) s.add(y); for (const x of [...s]) for (const y of mine(x)) s.add(y); return [...s].sort((a, b) => rows.findIndex(r => r.k === a) - rows.findIndex(r => r.k === b)); };
  const leadOf = k => { const t = team(k); return t.find(x => R(x) && R(x).has) || t.find(x => vid.get(x) && (vid.get(x).url || vid.get(x).file)) || t[0]; };
  const tog = (k, o) => {
    const g = mine(k);
    if (g.has(o)) { g.delete(o); grp.delete(o); if (g.size < 2) for (const x of g) grp.delete(x); }
    else { const og = grp.get(o); if (og) { og.delete(o); if (og.size < 2) for (const x of og) grp.delete(x); } g.add(o); for (const x of g) grp.set(x, g); const v = vid.get(o); if (v && !vid.get(k)) { vid.set(k, v); vid.delete(o); } }
  };
  const label = k => (R(k) || {}).label || k;
  const draw = () => {
    host.innerHTML = rows.map((r, i) => {
      const t = team(r.k), lead = leadOf(r.k), v = vid.get(r.k) || {}, others = t.filter(x => x !== r.k);
      let what;
      if (lead !== r.k && (R(lead).has || (vid.get(lead) && (vid.get(lead).url || vid.get(lead).file)))) what = '<span class="muted"><span>Same video as:</span> <b data-raw>' + esc(label(lead)) + '</b></span>';
      else if (r.has) what = '<span class="pvhas" data-raw title="' + esc(r.has) + '">' + esc(r.has) + '</span>';
      else if (v.file) what = '<span class="pvfile"><b data-raw>' + esc(v.file.name) + '</b> <span data-raw>' + fmtSize(v.file.size) + '</span><button class="icon" data-pvunfile="' + i + '" aria-label="Take the file off">✕</button></span>';
      else what = '<input class="btn pvlink' + (v.url && !linkClean(v.url) ? ' bad' : '') + '" data-pvlink="' + i + '" value="' + esc(v.url || '') + '" placeholder="Paste a link to their video" aria-label="Link to the video" autocomplete="off" spellcheck="false"><button class="btn sm" data-pvfile="' + i + '" title="A video file on this computer">File…</button>';
      return '<div class="pvrow' + (open === r.k ? ' on' : '') + '"><span class="pvname" data-raw>' + esc(r.label) + '</span><span class="pvvid">' + what + '</span>' +
        '<button class="btn sm pvpbtn" data-pvp="' + i + '" aria-expanded="' + (open === r.k) + '">' + (others.length ? '<span>With:</span> <span data-raw>' + esc(others.map(label).join(', ')) + '</span>' : '+ Partners') + '</button>' +
        (open === r.k ? '<div class="pvpick" role="group" aria-label="Partners">' + rows.filter(x => x.k !== r.k).map(x => { const lock = old(r.k).has(x.k), on = lock || t.includes(x.k);
          return '<button class="pvchip" data-pvto="' + rows.indexOf(x) + '" aria-pressed="' + on + '"' + (lock ? ' disabled title="Already in the group"' : '') + ' data-raw>' + esc(x.label) + '</button>'; }).join('') + '<button class="link" data-pvdone>Done</button></div>' : '') + '</div>';
    }).join('');
  };
  host.addEventListener('input', e => { const l = e.target.closest('[data-pvlink]'); if (!l) return; const k = rows[+l.dataset.pvlink].k; vid.set(k, { url: l.value }); l.classList.toggle('bad', !!l.value.trim() && !linkClean(l.value)); host.dispatchEvent(new Event('pvchange')); });
  host.addEventListener('change', e => { if (e.target.closest('[data-pvlink]')) draw(); });   // the group's other rows follow once the link is in
  host.addEventListener('click', async e => {
    const b = e.target.closest('[data-pvp],[data-pvto],[data-pvdone],[data-pvfile],[data-pvunfile]'); if (!b) return;
    e.stopPropagation();
    if (b.dataset.pvp != null) { const k = rows[+b.dataset.pvp].k; open = open === k ? null : k; }
    else if (b.dataset.pvdone != null) open = null;
    else if (b.dataset.pvto != null && open) tog(open, rows[+b.dataset.pvto].k);
    else if (b.dataset.pvfile != null) { const f = await vidPick(); if (!f) return; vid.set(rows[+b.dataset.pvfile].k, { file: f }); }
    else if (b.dataset.pvunfile != null) vid.delete(rows[+b.dataset.pvunfile].k);
    draw(); host.dispatchEvent(new Event('pvchange'));
    if (b.dataset.pvp != null || b.dataset.pvto != null) { const again = host.querySelector(b.dataset.pvp != null ? '[data-pvp="' + b.dataset.pvp + '"]' : '[data-pvto="' + b.dataset.pvto + '"]'); if (again) again.focus(); }
  });
  // files dropped on the list: each goes to the student named in its file name
  const drop = files => {
    const people = rows.map(r => [nameWords(r.label)]), miss = [];
    for (const f of files) { if (!MEDIA_RX.test(f.name)) { miss.push(f.name); continue; } const g = guessAmong(f.name, people); if (g.i < 0 || rows[g.i].has) { miss.push(f.name); continue; } vid.set(leadOf(rows[g.i].k), { file: f }); }
    draw(); host.dispatchEvent(new Event('pvchange'));
    if (miss.length) toast((miss.length === 1 ? 'This file didn’t match a name: ' : 'These files didn’t match a name: ') + wordsJoin(miss.slice(0, 4)) + (miss.length > 4 ? '…' : '') + '. Use File… on the right row.', 8000);
  };
  const out = () => {
    const done = new Set(), list = [];
    for (const r of rows) {
      if (done.has(r.k)) continue;
      const t = team(r.k); t.forEach(x => done.add(x));
      const lead = leadOf(r.k), v = R(lead).has ? null : (t.map(x => vid.get(x)).find(x => x && (x.file || linkClean(x.url || ''))) || null);
      const fresh = t.filter(x => !old(lead).has(x));
      if (!v && !fresh.length) continue;
      list.push({ k: [lead, ...t.filter(x => x !== lead)], url: v && !v.file ? linkClean(v.url) : '', file: v && v.file || null });
    }
    return list;
  };
  const bad = () => rows.some(r => { const v = vid.get(r.k); return v && v.url && v.url.trim() && !linkClean(v.url); });
  draw();
  return { draw, drop, out, bad };
}
// Puts the groups pvList gave on the open assignment. stOf(k): the student for a row.
async function pvApply(groups, stOf) {
  let n = 0;
  for (const g of groups) {
    const all = g.k.map(stOf).filter(Boolean); if (!all.length) continue;
    // the group shares the paper of whoever has one: the one with the video first, else the first with a notes page or a paper
    let st = all[0];
    if (!g.url && !g.file && !(notesFileOf(st) || groupPaper(st))) st = all.find(s => notesFileOf(s) || groupPaper(s)) || st;
    const partners = all.filter(s => s !== st && !groupMates(st).includes(s));
    if (g.url || g.file) await videoAdd(st, { url: g.url, file: g.file, name: 'Presentation video', kind: '', partners }, true);
    else if (partners.length) { const gg = groupOf(st), anchor = (gg && groupFileOf(gg, st)) || notesFileOf(st) || groupPaper(st) || st.files.find(f => f.kind === 'link'); if (!anchor) continue; await partnersJoin(st, anchor, partners, st.files.filter(f => f.kind === 'link' && f !== anchor)); }
    n++;
  }
  groupSync(); saveSoon(); renderList();
  return n;
}
const pvHas = st => { const f = st.files.find(x => x.kind === 'link') || st.files.find(x => x.kind === 'media'); return f ? (f.kind === 'link' ? linkTitle(f) + (vidRef(f.data) ? '' : ' · ' + linkHost(linkOf(f.data))) : f.name) : ''; };

/* ---------- Setup > Partners and videos… on an open assignment ---------- */
function openPartners() {
  if (!batch) return;
  const anon = anonOn(), list = batch.students.map((st, i) => ({ st, i })).filter(x => x.st.files.length || !x.st.gap);
  if (anon) list.sort((a, b) => anonPos(a.i) - anonPos(b.i));
  const rows = list.map(({ st, i }) => ({ k: st.key, label: shownName(st, i), has: pvHas(st), mates: groupMates(st).map(s => s.key) }));
  openDlg('<div class="bh"><h2>Partners and videos</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb vdbox"><p class="muted" style="margin:0;font-size:14px">Pick each group’s partners: one grade covers the group, and a group with no video shares the first one’s paper and marks. Paste a link to a video, or choose a video file. You can also drop video files here, and each goes to the student named in its file name.</p><div id="pvList" class="pvlist"></div></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="pvGo" disabled>Save</button></div>', false, 'lg');
  const box = $('#dlgBox'), host = $('#pvList'), pv = pvList(host, rows), go = $('#pvGo');
  host.addEventListener('pvchange', () => { go.disabled = !pv.out().length || pv.bad(); });
  box.ondragover = e => e.preventDefault();
  box.ondrop = e => { e.preventDefault(); pv.drop([...e.dataTransfer.files]); };
  box.onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target !== go || go.disabled) return;
    go.disabled = true; go.textContent = 'Saving…';
    try { const n = await pvApply(pv.out(), k => batch.students.find(s => s.key === k)); closeDlg(); toast(n === 1 ? 'Saved 1 group or video' : 'Saved ' + n + ' groups and videos'); openStudent(cur); }
    catch (err) { console.error(err); go.disabled = false; go.textContent = 'Save'; sayDlg((err && err.message) || String(err)); }
  };
}

/* ---------- an assignment with no papers at all: a notes page for everyone on the roster, their videos and their partners ---------- */
function openStartNotes(it) {
  const f = findItem(it.id), c = f && f.c !== lib.loose ? f.c : null, names = c ? c.names.filter(n => String(n).trim()) : [];
  if (!names.length) return sayDlg('This needs the class’s roster, so there is a page for each student. Add the students to the class first, then come back to this assignment.', { lg: 1 });
  const rows = npRows(it.setup);
  let np = npLast === 'rubric' && !rows.length ? 'lined' : npLast;
  openDlg('<div class="bh"><h2>“' + esc(it.name) + '” with no papers</h2></div>' +
    '<div class="bb vdbox"><p style="margin:0 0 4px">For presentations, speeches, performances and videos. Each of the ' + names.length + ' students in ' + esc(c.name) + ' gets a notes page to write on while you watch. Mark it, score it and return it like a paper.</p>' + npTiles(np, rows, false) +
    (rows.length ? '' : '<p class="muted" style="margin:8px 0 0;font-size:13px">Rubric rows can be picked once this assignment has a rubric.</p>') +
    '<div class="vdlab">Videos and partners<small>Optional, and you can add them later too. Paste a link or choose a file for each video, or drop video files here and each goes to the student named in its file name. Partners share one notes page, one set of marks and one grade.</small></div><div id="pvList" class="pvlist"></div></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="snGo">Make the pages and open</button></div>', false, 'lg');
  const box = $('#dlgBox'), folder = n => String(n).replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-').trim();
  const pv = pvList($('#pvList'), names.map(n => ({ k: folder(n), label: n, has: '', mates: [] })));
  $('#pvList').addEventListener('pvchange', () => { $('#snGo').disabled = pv.bad(); });
  box.ondragover = e => e.preventDefault();
  box.ondrop = e => { e.preventDefault(); pv.drop([...e.dataTransfer.files]); };
  box.onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const t = e.target.closest('.nptile'); if (t && !t.disabled) { np = t.dataset.np; npPick(box, np); return; }
    if (e.target.id !== 'snGo') return;
    e.target.disabled = true; npLast = np;
    const groups = pv.out();
    try {
      const bytes = await notesPdf(np, it.name, rows);
      const make = k => names.map(n => ({ path: folder(n) + '/' + npFileName(it.name) + ' notes' + (k > 1 ? ' (' + k + ')' : '') + '.pdf', data: bytes.slice() }));
      // a download is known by its names and sizes: a second one of the same name in the same class is given a name of its own, so it starts empty
      let k = 1, list = make(k);
      while (k < 50 && (store.get(batchIdOf(list), null) || keptMeta.has(batchIdOf(list)))) list = make(++k);
      const id = batchIdOf(list);
      closeDlg();
      await intake(list, it.name, it);
      if (groups.length && batch && batch.id === id) {
        const stOf = key => batch.students.find(s => s.key === key);
        await pvApply(groups, stOf);
        toast(groups.length === 1 ? 'Added 1 group or video' : 'Added ' + groups.length + ' groups and videos');
        openStudent(cur);
      }
    } catch (err) { console.error(err); closeDlg(); toast('The pages couldn’t be made: ' + ((err && err.message) || err)); }
  };
}
Object.assign(window.__gs, { linkOf, linkClean, linkPlayer, notesPdf, isNotes, videoAdd, openAddVideo, openAddNotes, openStartNotes, openPartners, pvApply });

/* ---------------- clips: a part of a video worth showing the class ---------------- */
// batch.clips: [{ id, u: the link | p: the path of a video file, a: where it starts (seconds), b: where it ends (or none), t: what it shows }]
// A clip is only two times and a label, saved with the assignment's work. Nothing is cut or copied: playing it starts the video there.
// A clip on a link belongs to the link, so partners with the same link see the same clips.
// Shown to the class, the screen has the label and the video and never a student's name.
function clipSecs(v) {
  v = String(v == null ? '' : v).trim(); if (!v) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(v)) return NaN;
  return v.split(':').reduce((n, x) => n * 60 + parseFloat(x), 0);
}
const clipSpan = c => fmtTime(c.a) + (c.b != null ? '–' + fmtTime(c.b) : '');
const clipsOf = f => (batch.clips || []).filter(c => (f.kind === 'link' ? c.u && c.u === linkKey(f) : c.p === f.path));
function clipFile(c) {
  for (const st of batch.students) for (const f of st.files) if (c.u ? f.kind === 'link' && linkKey(f) === c.u : f.path === c.p) return f;
  return null;
}
// A site's player started at the clip. stops: the player itself stops at the end.
function clipFrame(src, c) {
  const a = Math.floor(c.a), b = c.b != null ? Math.ceil(c.b) : null;
  if (/youtube-nocookie\.com\/embed\//.test(src)) return { src: src + '?start=' + a + (b != null ? '&end=' + b : '') + '&autoplay=1', stops: b != null };
  if (/player\.vimeo\.com\//.test(src)) return { src: src + '#t=' + a + 's', stops: false };
  if (/drive\.google\.com\/file\//.test(src) || /loom\.com\/embed\//.test(src)) return { src: src + '?t=' + a, stops: false };
  return { src, stops: false };
}
// Plays a video or sound from the clip's start and stops it at its end.
function clipRun(m, c) {
  const go = () => { try { m.currentTime = c.a; } catch {} m.play().catch(() => {}); };
  if (m.readyState >= 1) go(); else m.addEventListener('loadedmetadata', go, { once: true });
  m.onclipstop && m.removeEventListener('timeupdate', m.onclipstop);
  if (c.b != null) { m.onclipstop = () => { if (m.currentTime >= c.b) { m.pause(); m.removeEventListener('timeupdate', m.onclipstop); m.onclipstop = null; } }; m.addEventListener('timeupdate', m.onclipstop); }
}
// A frame for a site's player, the same wherever one is made.
function playerFrame(src, title) {
  const fr = document.createElement('iframe');
  fr.title = title; fr.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture'; fr.allowFullscreen = true;
  fr.referrerPolicy = 'strict-origin-when-cross-origin'; fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation');
  fr.src = src; return fr;
}
const clipsBtn = () => { const b = $('#clipsBtn'); if (b) b.hidden = !(batch && batch.clips && batch.clips.length); };
// The row of clips under a player. media(): the video or sound on the card, when the page plays it itself. play(c): plays a clip on the card.
// hint: 'drive' when the site's player can't say where it is.
function clipStrip(host, f, media, play, hint) {
  const box = document.createElement('div'); box.className = 'clips'; host.appendChild(box);
  let form = false, edit = null;   // edit: the clip whose title and times are being changed
  const draw = () => {
    const list = clipsOf(f), own = !!media();
    box.innerHTML = '<div class="cliprow">' + list.map(c => '<span class="clip"><button data-clipplay="' + c.id + '" title="Play this part">▶ ' + esc(c.t) + ' <small>' + clipSpan(c) + '</small></button>' +
      '<button data-clipshow="' + c.id + '" title="Full screen, with the label and without the student’s name">Show to the class</button><button data-clipedit="' + c.id + '" title="Change this clip’s title or its times">Edit</button><button data-clipdel="' + c.id + '" aria-label="Delete the clip ' + esc(c.t) + '" title="Delete this clip">×</button></span>').join('') +
      (form ? '' : '<button class="btn sm" data-clipnew title="Save a part of this video to show the class later">+ Clip</button>') + '</div>' +
      (form ? '<div class="clipform"><label>From <input class="btn sm" data-ca placeholder="0:00" inputmode="numeric" autocomplete="off" aria-label="Where the clip starts"></label>' + (own ? '<button class="link" data-cnow="a">now</button>' : '') +
        '<label>to <input class="btn sm" data-cb placeholder="end" inputmode="numeric" autocomplete="off" aria-label="Where the clip ends"></label>' + (own ? '<button class="link" data-cnow="b">now</button>' : '') +
        '<input class="btn sm clipname" data-ct placeholder="What it shows, like Strong opening" maxlength="80" autocomplete="off" aria-label="What the clip shows">' +
        '<button class="btn sm primary" data-clipsave>' + (edit ? 'Save changes' : 'Save clip') + '</button><button class="btn sm" data-clipcancel>Cancel</button>' +
        '<small class="muted">' + (own ? 'It starts where the video is. Press now at the end, or type the times.' : hint === 'drive' ? 'Google Drive’s player doesn’t tell the page where it is, so type the times from the player, like 2:15.' : 'Play the video here and + Clip starts where it is, or type the times, like 2:15.') + ' Nothing is cut: a clip is the two times and its label.</small></div>' : '');
  };
  draw();
  box.onclick = e => {
    e.stopPropagation();
    const q = s => box.querySelector(s), by = id => (batch.clips || []).find(c => c.id === id);
    if (e.target.closest('[data-clipnew]')) { form = true; edit = null; draw(); const m = media(); if (m && m.currentTime > 0) q('[data-ca]').value = fmtTime(m.currentTime); q(m && m.currentTime > 0 ? '[data-ct]' : '[data-ca]').focus(); return; }
    if (e.target.closest('[data-clipcancel]')) { form = false; edit = null; draw(); return; }
    const ed = e.target.closest('[data-clipedit]');
    if (ed) { const c = by(ed.dataset.clipedit); if (!c) return; form = true; edit = c; draw(); q('[data-ca]').value = fmtTime(c.a); q('[data-cb]').value = c.b != null ? fmtTime(c.b) : ''; const t = q('[data-ct]'); t.value = c.t; t.focus(); t.select(); return; }
    const now = e.target.closest('[data-cnow]'); if (now) { const m = media(); if (m) q('[data-c' + now.dataset.cnow + ']').value = fmtTime(m.currentTime); return; }
    if (e.target.closest('[data-clipsave]')) {
      const a = clipSecs(q('[data-ca]').value), b = clipSecs(q('[data-cb]').value);
      if (a == null || isNaN(a)) { q('[data-ca]').focus(); return toast('Type where the clip starts, like 2:15'); }
      if (isNaN(b) || (b != null && b <= a)) { q('[data-cb]').focus(); return toast('The end has to be after the start'); }
      if (edit) { edit.a = a; if (b != null) edit.b = b; else delete edit.b; edit.t = q('[data-ct]').value.trim().slice(0, 80) || edit.t; form = false; edit = null; saveSoon(); draw(); return; }
      const n = (batch.clips ||= []).length + 1;
      batch.clips.push({ id: uid(), ...(f.kind === 'link' ? { u: linkKey(f) } : { p: f.path }), a, ...(b != null ? { b } : {}), t: q('[data-ct]').value.trim().slice(0, 80) || 'Clip ' + n });
      form = false; saveSoon(); clipsBtn(); draw(); return;
    }
    const d = e.target.closest('[data-clipdel]');
    if (d) { const c = by(d.dataset.clipdel), at = batch.clips.indexOf(c); if (!c) return; batch.clips.splice(at, 1); saveSoon(); clipsBtn(); draw();
      toastDo('Deleted the clip “' + c.t + '”', 'Undo', () => { batch.clips.splice(Math.min(at, batch.clips.length), 0, c); saveSoon(); clipsBtn(); if (box.isConnected) draw(); }); return; }
    const p = e.target.closest('[data-clipplay]'); if (p) { const c = by(p.dataset.clipplay); if (c) play(c); return; }
    const s = e.target.closest('[data-clipshow]'); if (s) clipShow(s.dataset.clipshow);
  };
  box.onkeydown = e => { if (e.key === 'Enter' && e.target.closest('.clipform input')) { e.preventDefault(); box.querySelector('[data-clipsave]').click(); } e.stopPropagation(); };
}

/* ---------- a clip on the screen the class sees ---------- */
let clipStage = null;
function clipShow(id) {
  const list = () => (batch.clips || []).filter(c => clipFile(c));
  let at = Math.max(0, list().findIndex(c => c.id === id));
  clipClose();
  const el = document.createElement('div'); el.id = 'clipStage'; el.className = 'pk clipstage'; el.tabIndex = -1; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'A clip, shown to the class');
  document.body.appendChild(el);
  const draw = () => {
    const all = list(), c = all[at]; if (!c) return clipClose();
    const f = clipFile(c), vr = f.kind === 'link' && vidRef(f.data);
    if (vr && !vkSeen.has(vr)) { vkGet(vr).then(() => { if (clipStage && clipStage.el === el) draw(); }); return; }   // a kept video is read first
    const kv = vr && vkSeen.get(vr), url = f.kind === 'link' && !vr ? linkOf(f.data) : '';
    const pl = vr ? (kv ? { [VIDEO_RX.test(kv.name) ? 'video' : 'audio']: kv.url } : null) : url ? linkPlayer(url) : { [VIDEO_RX.test(f.name) ? 'video' : 'audio']: mediaUrl(f) };
    const fr = pl && pl.frame ? clipFrame(pl.frame, c) : null;
    el.innerHTML = '<div class="clipbar"><b>' + esc(c.t) + '</b><span>' + (c.b != null ? fmtTime(c.a) + ' to ' + fmtTime(c.b) : 'from ' + fmtTime(c.a)) + (fr && !fr.stops && c.b != null ? ' · stop it at ' + fmtTime(c.b) : '') + '</span><span class="sp"></span>' +
      (all.length > 1 ? '<button data-cs="prev" aria-label="The clip before"' + (at ? '' : ' disabled') + '>‹</button><span>' + (at + 1) + ' of ' + all.length + '</span><button data-cs="next" aria-label="The next clip"' + (at < all.length - 1 ? '' : ' disabled') + '>›</button>' : '') +
      '<button data-cs="again">Play again</button><button data-cs="full">Full screen</button><button data-cs="close">Close <kbd>Esc</kbd></button></div><div class="clipmain"></div>';
    const main = el.querySelector('.clipmain');
    if (!pl) { main.innerHTML = vr ? '<p>This video isn’t in this browser.</p>' : '<p>This site can’t play inside the page. Close this and use Open in its own window.</p>'; return; }
    if (fr) main.appendChild(playerFrame(fr.src, c.t));
    else { const m = document.createElement(pl.video ? 'video' : 'audio'); m.controls = true; m.playsInline = true; m.src = pl.video || pl.audio; main.appendChild(m); clipRun(m, c); }
  };
  const key = e => {
    if (e.key === 'Escape') clipClose(); else if (e.key === 'ArrowRight' && at < list().length - 1) { at++; draw(); } else if (e.key === 'ArrowLeft' && at > 0) { at--; draw(); } else if (e.target.closest && e.target.closest('#clipStage')) { e.stopPropagation(); return; } else return;
    e.preventDefault(); e.stopPropagation();
  };
  el.onclick = e => {
    const b = e.target.closest('[data-cs]'); if (!b) return;
    const k = b.dataset.cs;
    if (k === 'close') return clipClose();
    if (k === 'full') { try { if (document.fullscreenElement) document.exitFullscreen(); else { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } } catch {} return; }
    if (k === 'prev') at--; if (k === 'next') at++;
    draw();
  };
  document.addEventListener('keydown', key, true);
  clipStage = { el, key };
  draw(); el.focus();
}
function clipClose() {
  if (!clipStage) return;
  document.removeEventListener('keydown', clipStage.key, true);
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
  clipStage.el.remove(); clipStage = null;
}
Object.assign(window.__gs, { clipSecs, clipFrame, clipShow, clipClose, clipsOf });
