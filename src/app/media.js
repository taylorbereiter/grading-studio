/* ---------------- audio, video and Word files ---------------- */
// Recordings play beside the rubric; a transcript can be made in this browser (Whisper), and Word files are shown as pages.
const MEDIA_RX = /\.(mp4|mov|m4v|webm|mkv|3gp|mp3|m4a|wav|aac|ogg|oga|opus|flac|weba|aif|aiff|caf|amr)$/i;
const VIDEO_RX = /\.(mp4|mov|m4v|webm|mkv|3gp)$/i;
const MIME = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', '3gp': 'video/3gpp', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', weba: 'audio/webm', aif: 'audio/aiff', aiff: 'audio/aiff', caf: 'audio/x-caf', amr: 'audio/amr' };
const extOf = n => (n.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
const mediaUrl = f => f.url || (f.url = URL.createObjectURL(new Blob([f.data], { type: MIME[extOf(f.name)] || '' })));
const fmtTime = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const CAN_TRANSCRIBE = window.self === window.top;   // the speech engine downloads its model; a preview frame can't
let curMedia = null;   // the first player on screen, for the keys

// kept: a video file kept in this browser for a student's shortcut f ({ name, url, blob }, video.js), played the same way
function mediaCard(st, f, kept) {
  const el = document.createElement('div'); el.className = 'media';
  const vid = VIDEO_RX.test(kept ? kept.name : f.name);
  el.innerHTML = '<div class="mstick"><div class="mhead"><b>' + esc(kept ? linkTitle(f) : f.name) + '</b><span class="muted">' + (vid ? 'video' : 'audio') + '</span></div>' +
    (vid ? '<video controls preload="metadata" playsinline></video>' : '<audio controls preload="metadata"></audio>') +
    '<div class="mctl"><button class="btn sm" data-skip="-10">◀◀ 10s</button><button class="btn sm" data-skip="10">10s ▶▶</button>' +
    '<span class="seg">' + [1, 1.25, 1.5, 2].map(r => '<button data-rate="' + r + '" aria-pressed="' + (r === (store.get('gs.rate', 1))) + '">' + r + '×</button>').join('') + '</span>' +
    '<button class="btn sm" data-stamp title="Adds the time to your comment, like [2:15]">+ Time to comment</button></div></div>' +
    '<p class="muted trstat" style="font-size:13px;margin:6px 0 0"></p>';
  const m = el.querySelector('audio,video');
  m.src = kept ? kept.url : mediaUrl(f); m.playbackRate = store.get('gs.rate', 1);
  m.onratechange = () => {};
  mediaWatch(el, m, kept ? { name: kept.name, data: kept.blob, kind: 'media', size: kept.blob.size } : f);
  if (vid) vidGrip(el.querySelector('.mstick'), m);
  if (!curMedia) curMedia = m;
  clipStrip(el.querySelector('.mstick'), f, () => m, c => clipRun(m, c));
  const pan = trPanel(el, f, { make: CAN_TRANSCRIBE, seek: t => { m.currentTime = t; if (m.paused) m.play().catch(() => {}); } });
  el.querySelector('.mstick').after(el.querySelector('.trbox'));
  m.ontimeupdate = () => pan.tick(m.currentTime, !m.paused);
  el.onclick = e => {
    const s = e.target.closest('[data-skip]'); if (s) { m.currentTime = Math.max(0, m.currentTime + +s.dataset.skip); return; }
    const r = e.target.closest('[data-rate]');
    if (r) { m.playbackRate = +r.dataset.rate; store.set('gs.rate', m.playbackRate); for (const b of el.querySelectorAll('[data-rate]')) b.setAttribute('aria-pressed', b === r); return; }
    if (e.target.closest('[data-stamp]')) { addStamp(st, m.currentTime); return; }
  };
  return el;
}

/* ---------- transcripts ---------- */
// On the file, saved with the assignment's work like its marks (keep.js), so it is kept, carried, merged and cleared with them:
//   { w: [[word, seconds]] }  made in this browser by the speech engine (readings.js), or
//   { l: [[line, seconds or null]] }  pasted or typed by the teacher, for any video: a link (Google Drive won't hand its captions to this page) or a file.
// It is the student's words, so it never leaves this browser: not in the export, a take-home file or the linked folder.
const trMakeable = f => f.kind === 'media' || (f.kind === 'link' && !!vidRef(f.data));
// The lines to show: pasted ones as they are, made ones cut after a sentence once a line is long enough.
function trLines(tr) {
  if (!tr) return [];
  if (Array.isArray(tr.l)) return tr.l.map(([s, t]) => ({ t: t == null ? null : +t, s: String(s) }));
  const out = []; let cur = null, len = 0;
  (tr.w || []).forEach(([w, t], i) => {
    if (!cur) { cur = { t: +t, w: [] }; out.push(cur); len = 0; }
    cur.w.push([w, +t, i]); len += String(w).length;
    if ((len > 60 && /[.?!]["”’)]?\s*$/.test(w)) || len > 180) cur = null;
  });
  return out;
}
// As text to change: a line each, starting with its time.
const trText = tr => trLines(tr).map(x => (x.t != null ? '[' + fmtTime(x.t) + '] ' : '') + (x.w ? x.w.map(y => y[0]).join('').trim() : x.s)).join('\n');
// Pasted text as lines. A line may start with its time (1:05, 01:05, [00:01:05], (1:05), 1:05 - 1:12). A time alone on a line goes with the
// text under it, the way YouTube and caption files (.srt, .vtt) write it. Markdown stars, bullets, cue numbers and tags are left out.
const TR_TS = /^[[(]?\s*((?:\d{1,2}:)?\d{1,3}:\d{2})(?:[.,]\d{1,3})?\s*[\])]?/;
const TR_TO = /^\s*(?:-->|–|—|-|to)\s*[[(]?\s*(?:\d{1,2}:)?\d{1,3}:\d{2}(?:[.,]\d{1,3})?\s*[\])]?/;
function trParse(text) {
  const lines = String(text || '').slice(0, 400000).replace(/\r\n?/g, '\n').split('\n'), out = [];
  const secs = v => v.split(':').reduce((n, x) => n * 60 + +x, 0);
  let pend = null, glue = false;
  for (let i = 0; i < lines.length; i++) {
    let s = lines[i].replace(/<[^>]*>/g, '').replace(/\*\*|__/g, '').replace(/^\s*(?:[-•*]|\d+\.)\s+(?=\S)/, '').replace(/\s+/g, ' ').trim();
    if (!s) { glue = false; continue; }
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(s)) continue;
    if (/^\d+$/.test(s) && TR_TS.test((lines[i + 1] || '').trim())) continue;   // a cue's number in a caption file
    const m = TR_TS.exec(s); let t = null;
    if (m) { t = secs(m[1]); s = s.slice(m[0].length).replace(TR_TO, '').replace(/^(\s*(?:align|position|line|size|vertical|region):\S+)+/, '').replace(/^[\s:|–—-]+/, '').trim(); }
    if (m && !s) { pend = t; glue = false; continue; }
    if (t == null && pend != null) { out.push([s, pend]); pend = null; glue = true; continue; }
    if (t == null && glue && out.length) { out[out.length - 1][0] += ' ' + s; continue; }
    out.push([s, t]); glue = false;
  }
  return out.length ? { l: out } : null;
}
// Puts a transcript on a file, or takes it off (tr null). Partners with the same video get the same one.
function trSet(f, tr) {
  const same = f.kind === 'link' && batch ? batch.students.flatMap(s => s.files).filter(x => x.kind === 'link' && linkKey(x) === linkKey(f)) : [];
  for (const x of same.includes(f) ? same : same.concat(f)) { if (tr) x.tr = tr; else delete x.tr; }
  saveSoon();
}
// The transcript under a player: make it here (a recording or a kept video), paste it, change it, take it off, and click a line to play from there.
// o: { make: the speech engine can run here and f is a recording, seek(seconds) }. Returns { tick(seconds, playing) } to light up where the video is.
function trPanel(card, f, o) {
  const box = document.createElement('div'); box.className = 'trbox'; card.appendChild(box);
  const canMake = !!o.make && trMakeable(f);
  let mode = '', err = '', stop = null, marks = [], times = [], last = -1;
  // captions: the line being said, upright under the player, so a sideways video turned on its side still has words to read.
  // Where the player can't say where it is (Google Drive), the teacher steps through the lines with ‹ and ›, or clicks a line.
  let caps = [], capAt = -1;
  const strip = document.createElement('div'); strip.className = 'trcap'; strip.hidden = true;
  strip.innerHTML = '<button class="icon" data-capgo="-1" aria-label="The line before" title="The line before">‹</button><p class="trcapt" aria-live="polite"></p><button class="icon" data-capgo="1" aria-label="The next line" title="The next line">›</button>';
  const mctl = card.querySelector('.mstick .mctl'); if (mctl) mctl.before(strip);
  const capShow = () => {
    strip.hidden = !(store.get('gs.trCap', 0) && caps.length && mode === '');
    if (strip.hidden) return;
    if (capAt < 0 || capAt >= caps.length) capAt = 0;
    strip.querySelector('.trcapt').textContent = caps[capAt].s;
    strip.querySelector('[data-capgo="-1"]').disabled = capAt <= 0; strip.querySelector('[data-capgo="1"]').disabled = capAt >= caps.length - 1;
    for (const p of box.querySelectorAll('.trans .trl.cap')) p.classList.remove('cap');
    const row = box.querySelectorAll('.trans .trl')[capAt]; if (row) row.classList.add('cap');
  };
  strip.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-capgo]'); if (!b) return; capAt = Math.max(0, Math.min(caps.length - 1, capAt + +b.dataset.capgo)); capShow(); });
  const draw = () => { drawBox(); caps = trLines(f.tr).map(x => ({ t: x.t, s: x.w ? x.w.map(y => y[0]).join('').trim() : x.s })); capShow(); };
  const drawBox = () => {
    const tr = f.tr;
    marks = []; times = []; last = -1;
    if (mode === 'edit') {
      box.innerHTML = '<div class="trform"><label class="trlab">' + (tr ? 'Change the transcript' : 'Paste a transcript') + '<textarea class="btn trta" rows="8" spellcheck="false" placeholder="[0:00] The first line&#10;[0:12] The next line"></textarea></label>' +
        '<div class="trrow"><button class="btn sm primary" data-trsave>Save</button><button class="btn sm" data-trcancel>Cancel</button></div>' +
        '<small class="muted">A line that starts with a time, like 1:05 or [00:01:05], plays the video from there. Caption files (.srt, .vtt) paste in too. It stays in this browser.</small></div>';
      const ta = box.querySelector('textarea'); ta.value = tr ? trText(tr) : ''; ta.focus(); return;
    }
    if (mode === 'ask') {
      box.innerHTML = '<div class="trask"><p>To make a transcript, this browser downloads a speech engine once, about 150 MB. After that it works without the internet. The video stays on this computer: nothing is uploaded.</p>' +
        '<div class="trrow"><button class="btn sm primary" data-trgo>Download and make the transcript</button><button class="btn sm" data-trcancel>Not now</button></div></div>';
      return;
    }
    if (mode === 'make') {
      box.innerHTML = '<div class="trmaking"><div class="prog"><i style="width:0%"></i></div><div class="trrow"><span class="trmsg" role="status">Starting…</span><button class="btn sm" data-trstop>Cancel</button></div>' +
        '<small class="muted">Made in this browser; nothing is uploaded. You can keep marking while it works, but keep this student open.</small></div>';
      return;
    }
    if (!tr) {
      box.innerHTML = '<div class="trrow trnone">' + (canMake ? '<button class="btn sm" data-trmake title="Writes out what is said, in this browser. Click a line to play from there.">Make transcript</button>' : '') +
        '<button class="btn sm" data-trpaste title="Paste a transcript you have, for example from Gemini or the video’s own captions">Paste a transcript</button>' +
        (err ? '<small class="trerr">' + esc(err) + '</small>' : f.kind === 'link' && !canMake ? '<small class="muted">Google Drive and other sites don’t share their captions with this page. Paste one you have, for example from Gemini.</small>' : '') + '</div>';
      return;
    }
    const lines = trLines(tr);
    box.innerHTML = '<div class="trhead"><b>Transcript</b><span class="muted">' + (tr.w ? 'made in this browser' : 'pasted') + '</span><span class="sp"></span>' +
      '<button class="link" data-trcap aria-pressed="' + !!store.get('gs.trCap', 0) + '" title="Shows the line being said under the video, the right way up">Captions under the video</button><button class="link" data-trpaste>Edit</button>' + (canMake ? '<button class="link" data-trmake>Make again</button>' : '') + '<button class="link" data-trdel>Remove</button></div>' +
      '<div class="trans">' + lines.map(x => '<p class="trl"' + (x.t != null ? ' data-t="' + x.t + '"' : '') + '>' + (x.t != null ? '<time>' + fmtTime(x.t) + '</time>' : '') +
        (x.w ? x.w.map(([w, t, i]) => '<span data-t="' + t + '" data-i="' + i + '">' + esc(w) + '</span>').join('') : '<span>' + esc(x.s) + '</span>') + '</p>').join('') + '</div>';
    marks = tr.w ? [...box.querySelectorAll('.trans span[data-i]')] : [...box.querySelectorAll('.trans .trl[data-t]')];
    times = marks.map(e => +e.dataset.t);
  };
  const make = async () => {
    if (!store.get('gs.asrHave', 0) && mode !== 'ask') { mode = 'ask'; err = ''; draw(); return; }
    if (f.tr && mode !== 'ask' && !await askDlg('Make the transcript again? The one you have will be replaced.', { ok: 'Make it again' })) return;
    mode = 'make'; err = ''; draw();
    const me = stop = { on: false };
    const say = (t, p) => { if (stop !== me) return; const s = box.querySelector('.trmsg'), b = box.querySelector('.prog i'); if (s) s.textContent = t; if (b && p != null) b.style.width = Math.round(p * 100) + '%'; };
    let lock = null; try { lock = await navigator.wakeLock.request('screen'); } catch {}
    try { await transcribeFile(f, say, me); if (stop === me) toast('The transcript is ready. Click a line to play from there.'); }
    catch (er) { if (!me.on) { console.error(er); err = (er && er.message) || String(er); } }
    try { lock && lock.release(); } catch {}
    if (stop === me) { stop = null; mode = ''; if (box.isConnected) draw(); }
  };
  box.addEventListener('click', async e => {
    e.stopPropagation();
    const row = e.target.closest('.trans .trl'); if (row) { capAt = [...box.querySelectorAll('.trans .trl')].indexOf(row); capShow(); }
    const w = e.target.closest('.trans [data-t]'); if (w) { o.seek(+w.dataset.t); return; }
    const cb = e.target.closest('[data-trcap]'); if (cb) { const on = !store.get('gs.trCap', 0); if (on) store.set('gs.trCap', 1); else store.del('gs.trCap'); cb.setAttribute('aria-pressed', on); capShow(); return; }
    if (e.target.closest('[data-trpaste]')) { mode = 'edit'; err = ''; draw(); return; }
    if (e.target.closest('[data-trcancel]')) { mode = ''; draw(); return; }
    if (e.target.closest('[data-trmake], [data-trgo]')) { make(); return; }
    if (e.target.closest('[data-trstop]')) { if (stop) stop.on = true; stop = null; asrStop(); mode = ''; draw(); toast('Stopped. No transcript was made.'); return; }
    if (e.target.closest('[data-trsave]')) {
      const v = box.querySelector('textarea').value, tr = trParse(v);
      if (!tr && v.trim()) return toast('There’s no text in that to keep');
      const had = f.tr; trSet(f, tr); mode = ''; draw();
      if (!tr && had) toastDo('Took the transcript off', 'Undo', () => { trSet(f, had); if (box.isConnected) draw(); });
      return;
    }
    if (e.target.closest('[data-trdel]')) { const had = f.tr; trSet(f, null); draw(); toastDo('Took the transcript off', 'Undo', () => { trSet(f, had); if (box.isConnected) draw(); }); }
  });
  box.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' && mode === 'edit') { e.preventDefault(); mode = ''; draw(); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && mode === 'edit') { e.preventDefault(); box.querySelector('[data-trsave]').click(); } });
  draw();
  return {
    tick(t, playing) {
      if (t != null && caps.length && !strip.hidden) { let k = -1; caps.forEach((c, i) => { if (c.t != null && c.t <= t + 0.05) k = i; }); if (k >= 0 && k !== capAt) { capAt = k; capShow(); } }
      if (!times.length || t == null) return;
      let lo = 0, hi = times.length - 1, k = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (times[mid] <= t + 0.05) { k = mid; lo = mid + 1; } else hi = mid - 1; }
      if (k === last) return;
      if (last >= 0 && marks[last]) marks[last].classList.remove('now');
      last = k; const sp = marks[k]; if (!sp) return;
      sp.classList.add('now');
      const tb = box.querySelector('.trans');
      if (playing && tb) { const r = sp.getBoundingClientRect().top - tb.getBoundingClientRect().top + tb.scrollTop; if (r < tb.scrollTop + 10 || r > tb.scrollTop + tb.clientHeight - 30) tb.scrollTop = r - 40; }
    },
  };
}
function addStamp(st, t) {
  const tag = '[' + fmtTime(t) + '] ';
  st.grade.comment = (st.grade.comment && !/\s$/.test(st.grade.comment) ? st.grade.comment + '\n' : st.grade.comment || '') + tag;
  touchGrade(st);
  saveSoon(); renderGrade(); renderList();
  const ta = $('#cmtIn'); if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
}
// Word (.docx) files show as a readable page. Old .doc files can't be read in a browser.
let mammothP = null;
async function docxHtml(bytes) {
  const r = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  // A link in a student's Word file keeps only web or email addresses, so a planted script link can't run here.
  const t = document.createElement('template'); t.innerHTML = r.value;
  for (const el of t.content.querySelectorAll('*')) for (const at of [...el.attributes]) if (/^on/i.test(at.name)) el.removeAttribute(at.name);
  for (const a of t.content.querySelectorAll('a[href]')) if (!/^(https?:|mailto:|#)/i.test(a.getAttribute('href').trim())) a.removeAttribute('href');
  for (const im of t.content.querySelectorAll('img[src]')) if (!/^data:image\//i.test(im.getAttribute('src'))) im.removeAttribute('src');
  return t.innerHTML;
}
async function docxCard(f, title) {
  const el = document.createElement('div'); el.className = 'docx';
  el.innerHTML = '<div class="fhead"><span style="color:var(--fg)">' + esc(title || f.name) + '</span><span>Word file</span></div><div class="dpage"><p class="muted">Opening…</p></div>';
  try { el.querySelector('.dpage').innerHTML = await docxHtml(f.data); for (const a of el.querySelectorAll('a')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } }
  catch { el.querySelector('.dpage').innerHTML = '<p>This Word file couldn’t be opened.</p>'; }
  return el;
}
// A Word document Taylor keeps beside every student in one download (her rubric and notes). Kept in this browser.
const refKey = () => 'gs.rd.' + batch.id;
function refDoc() { const r = store.get(refKey(), null); if (!r) return null; const bin = atob(r.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { name: r.name, data: u }; }
async function pickRefDoc() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.docx,.docm,.dotx,.dotm';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const u = new Uint8Array(await f.arrayBuffer());
    let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    if (!store.set(refKey(), { name: f.name, b64: btoa(s), at: Date.now() })) return toast('That document is too big to keep in this browser');
    toast('“' + f.name + '” now shows above every paper'); openStudent(cur);
  };
  inp.click();
}

