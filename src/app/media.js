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

function mediaCard(st, f) {
  const el = document.createElement('div'); el.className = 'media';
  const vid = VIDEO_RX.test(f.name);
  el.innerHTML = '<div class="mstick"><div class="mhead"><b>' + esc(f.name) + '</b><span class="muted">' + (vid ? 'video' : 'audio') + '</span></div>' +
    (vid ? '<video controls preload="metadata" playsinline></video>' : '<audio controls preload="metadata"></audio>') +
    '<div class="mctl"><button class="btn sm" data-skip="-10">◀◀ 10s</button><button class="btn sm" data-skip="10">10s ▶▶</button>' +
    '<span class="seg">' + [1, 1.25, 1.5, 2].map(r => '<button data-rate="' + r + '" aria-pressed="' + (r === (store.get('gs.rate', 1))) + '">' + r + '×</button>').join('') + '</span>' +
    '<button class="btn sm" data-stamp title="Adds the time to your comment, like [2:15]">+ Time to comment</button>' +
    (CAN_TRANSCRIBE ? '<button class="btn sm" data-tr>' + (f.tr ? 'Transcript ✓' : 'Make transcript') + '</button>' : '') + '</div></div>' +
    '<div class="trans" ' + (f.tr ? '' : 'hidden') + '></div><p class="muted trstat" style="font-size:13px;margin:6px 0 0"></p>';
  const m = el.querySelector('audio,video');
  m.src = mediaUrl(f); m.playbackRate = store.get('gs.rate', 1);
  m.onratechange = () => {};
  mediaWatch(el, m, f);
  if (!curMedia) curMedia = m;
  const tr = el.querySelector('.trans');
  const showTr = () => {
    if (!f.tr) return;
    tr.hidden = false;
    tr.innerHTML = f.tr.w.map(([w, t], i) => '<span data-t="' + t + '" data-i="' + i + '">' + esc(w) + '</span>').join('');
  };
  showTr();
  let last = -1;
  m.ontimeupdate = () => {
    if (!f.tr) return;
    const t = m.currentTime, W = f.tr.w; let lo = 0, hi = W.length - 1, k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (W[mid][1] <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (k === last) return;
    const old = tr.querySelector('.now'); if (old) old.classList.remove('now');
    const sp = k >= 0 && tr.children[k]; if (sp) { sp.classList.add('now'); if (!m.paused) { const r = sp.offsetTop - tr.offsetTop; if (r < tr.scrollTop + 10 || r > tr.scrollTop + tr.clientHeight - 30) tr.scrollTop = r - 40; } }
    last = k;
  };
  el.onclick = async e => {
    const s = e.target.closest('[data-skip]'); if (s) { m.currentTime = Math.max(0, m.currentTime + +s.dataset.skip); return; }
    const r = e.target.closest('[data-rate]');
    if (r) { m.playbackRate = +r.dataset.rate; store.set('gs.rate', m.playbackRate); for (const b of el.querySelectorAll('[data-rate]')) b.setAttribute('aria-pressed', b === r); return; }
    if (e.target.closest('[data-stamp]')) { addStamp(st, m.currentTime); return; }
    const w = e.target.closest('.trans [data-t]'); if (w) { m.currentTime = +w.dataset.t; if (m.paused) m.play().catch(() => {}); return; }
    if (e.target.closest('[data-tr]')) {
      if (f.tr && !await askDlg('Make the transcript again? The one you have will be replaced.', { ok: 'Make it again' })) return;
      const btn = el.querySelector('[data-tr]'); btn.disabled = true;
      try { await transcribeFile(f, msg => { el.querySelector('.trstat').textContent = msg; }); btn.textContent = 'Transcript ✓'; showTr(); el.querySelector('.trstat').textContent = ''; saveSoon(); }
      catch (er) { el.querySelector('.trstat').textContent = er.message || String(er); }
      btn.disabled = false;
    }
  };
  return el;
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

