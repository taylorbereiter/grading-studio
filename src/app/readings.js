/* ---------------- readings: any file shown above every student's paper (kept with this download, never exported) ---------------- */
const REF_KEY = '\u0001reading';   // can't be a student's folder name
let refFiles = [];   // [{ path, name, data, for }]: for = a student's key when the file is only for that student
// One student can have an everyone-file left off (batch.refSkip[key] = [paths]) and files of their own,
// like a different reading for a student who wrote a different summative.
const refSkipped = (st, r) => !r.for && !!(batch.refSkip && batch.refSkip[st.key] || []).includes(r.path);
const refsFor = st => refFiles.filter(r => (r.for ? r.for === st.key : true) && !refSkipped(st, r));
function setRefSkip(st, path, off) {
  const m = batch.refSkip || (batch.refSkip = {}), l = new Set(m[st.key] || []);
  off ? l.add(path) : l.delete(path);
  if (l.size) m[st.key] = [...l]; else delete m[st.key];
  saveNow();
}
const refId = path => batch.id + '|' + REF_KEY + '|' + path;
async function loadRefs() {
  refFiles = [];
  let recs = [];
  try { recs = (await idbDo('readonly', o => o.getAll(underId(batch.id)))) || []; } catch { return; }
  for (const r of recs.filter(r => r.bid === batch.id && r.key === REF_KEY).sort((a, b) => a.added - b.added)) refFiles.push({ path: r.path, name: r.name, data: r.data, for: r.for || '' });
}
function pickRefs(st) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;   // any kind of file
  inp.onchange = () => addRefs([...inp.files], st);
  inp.click();
}
async function addRefs(files, st) {
  let n = 0;
  const who = st ? st.key : '';
  for (const f of files) {
    const data = new Uint8Array(await f.arrayBuffer()), path = (who ? who + '/' : '') + f.name;
    try { await idbDo('readwrite', o => o.put({ bid: batch.id, key: REF_KEY, path, name: f.name, data, added: Date.now(), for: who }, refId(path))); }
    catch { toast('This browser is out of room to keep ' + f.name); continue; }
    refFiles = refFiles.filter(r => r.path !== path).concat({ path, name: f.name, data, for: who }); n++;
    noteAdded(batch, REF_KEY + '|' + path);
  }
  if (!n) return;
  saveSoon(); openStudent(cur); refreshReadings();
  const where = st ? ' for ' + shownName(st, batch.students.indexOf(st)) : ' above every paper';
  toast((n === 1 ? '“' + files[0].name + '” now shows' : n + ' files now show') + where);
}
async function dropRef(path) {
  try { await idbDo('readwrite', o => o.delete(refId(path))); } catch {}
  noteGone(batch, REF_KEY + '|' + path);
  refFiles = refFiles.filter(r => r.path !== path);
  if (batch.refSkip) for (const k of Object.keys(batch.refSkip)) { batch.refSkip[k] = batch.refSkip[k].filter(p => p !== path); if (!batch.refSkip[k].length) delete batch.refSkip[k]; }
  saveNow(); openStudent(cur); refreshReadings();
}
// Readings, from the button above the paper: the files for everyone, and this student's own set.
function openReadings() {
  const st = batch.students[cur], nm = esc(shownName(st, cur)), rd = store.get(refKey(), null);
  const all = refFiles.filter(r => !r.for), own = refFiles.filter(r => r.for === st.key);
  openDlg('<div class="bh"><h2>Readings</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<p class="muted" style="margin-top:0;font-size:14px">Files shown above the papers while you grade, like the reading or the prompt. They stay in this browser and are never sent back to students.</p>' +
    '<h3 style="margin:14px 0 6px">For everyone</h3>' +
    (all.length || rd ? '<div class="rdl">' + (rd ? '<div class="rdrow"><b>' + esc(rd.name) + '</b><span class="sp"></span><button class="btn sm" data-refdel>Remove</button></div>' : '') +
      all.map(r => '<div class="rdrow"><b>' + esc(r.name) + '</b><span class="sp"></span><button class="btn sm" data-refrm="' + esc(r.path) + '">Remove for everyone</button></div>').join('') + '</div>'
      : '<p class="muted" style="font-size:14px">None yet.</p>') +
    '<button class="btn sm primary" data-refadd>+ Add a file for everyone…</button>' +
    '<h3 style="margin:22px 0 6px">For ' + nm + '</h3>' +
    (all.length ? '<div class="rdl">' + all.map(r => '<label class="chk rdrow" style="margin:0"><input type="checkbox" data-refon="' + esc(r.path) + '"' + (refSkipped(st, r) ? '' : ' checked') + '> Show ' + esc(r.name) + '</label>').join('') + '</div>' : '') +
    (own.length ? '<div class="rdl">' + own.map(r => '<div class="rdrow"><b>' + esc(r.name) + '</b> <span class="muted" style="font-size:13px">only for ' + nm + '</span><span class="sp"></span><button class="btn sm" data-refrm="' + esc(r.path) + '">Remove</button></div>').join('') + '</div>' : '') +
    '<button class="btn sm" data-refmine>+ Add a file just for ' + nm + '…</button>' +
    (all.length ? '<p class="muted" style="font-size:13px;margin-bottom:0">For a student with a different reading: untick the everyone file above, then add theirs.</p>' : '') +
    '</div><div class="bf"><button class="btn primary" data-close>Done</button></div>', true);
  const box = $('#dlgBox');
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-refadd]')) return pickRefs();
    if (e.target.closest('[data-refmine]')) return pickRefs(st);
    const rr = e.target.closest('[data-refrm]'); if (rr) return dropRef(rr.dataset.refrm);
    if (e.target.closest('[data-refdel]')) { store.del(refKey()); openStudent(cur); return refreshReadings(); }
  };
  box.onchange = e => { const c = e.target.closest('[data-refon]'); if (!c) return; setRefSkip(st, c.dataset.refon, !c.checked); openStudent(cur); };
}
function refreshReadings() { if ($('#dlgBox') && $('#dlgBox').querySelector('[data-refmine]')) openReadings(); }
// A folded-open card with the reading: PDF and picture pages, a Word file, text, a recording, or a download link.
async function refCard(r, st) {
  const det = document.createElement('details'); det.className = 'refd';
  const k = 'gs.refOpen.' + r.path; det.open = store.get(k, true); det.ontoggle = () => store.set(k, det.open);
  det.innerHTML = '<summary>' + esc(r.name) + ' <span class="muted" style="font-weight:400;font-size:13px">· ' + (r.for ? 'only for this student' : 'shown with every paper') + ', not sent back</span>' +
    (st ? ' <button class="link" data-refhide style="font-size:13px;font-weight:400">' + (r.for ? 'Remove' : 'Hide for this student') + '</button>' : '') + '</summary><div class="refbody"></div>';
  const hb = det.querySelector('[data-refhide]');
  if (hb) hb.onclick = e => { e.preventDefault(); if (r.for) return dropRef(r.path); setRefSkip(st, r.path, true); openStudent(cur); toast('Hidden for this student. Readings… brings it back or adds a different file.'); };
  const body = det.querySelector('.refbody');
  const f = await makeFile('reading/' + r.path, r.data.slice());
  // Pages and Word or text files get a zoom bar and a box she can drag taller or shorter. Both are remembered for this file.
  const zk = 'gs.refZoom.' + r.path, hk = 'gs.refH.' + r.path, ZMIN = 0.5, ZMAX = 3;
  let zoom = Math.min(ZMAX, Math.max(ZMIN, +store.get(zk, 1) || 1)), apply = () => {};
  const bar = document.createElement('div'); bar.className = 'refbar';
  bar.innerHTML = '<span class="seg"><button data-rz="-" title="Zoom out" aria-label="Zoom out">−</button><button data-rz="1" title="Back to fit the width" class="rzv"></button><button data-rz="+" title="Zoom in" aria-label="Zoom in">+</button></span><span class="muted">Pinch or Ctrl + scroll on the reading to zoom. Drag the bottom edge to make it taller.</span>';
  const scroll = document.createElement('div'); scroll.className = 'refscroll';
  const h0 = +store.get(hk, 0); if (h0) scroll.style.maxHeight = h0 + 'px';
  const grip = document.createElement('div'); grip.className = 'refgrip'; grip.title = 'Drag to make the reading taller or shorter'; grip.setAttribute('role', 'separator'); grip.setAttribute('aria-orientation', 'horizontal');
  const showZ = () => { bar.querySelector('.rzv').textContent = Math.round(zoom * 100) + '%'; };
  let zt = 0;
  const setZoom = (z, now) => {
    z = Math.round(Math.min(ZMAX, Math.max(ZMIN, z)) * 100) / 100;
    if (z === zoom) return;
    const fx = scroll.scrollLeft / Math.max(1, scroll.scrollWidth), fy = scroll.scrollTop / Math.max(1, scroll.scrollHeight);
    zoom = z; showZ(); store.set(zk, zoom);
    clearTimeout(zt); const go = async () => { try { await apply(); } catch { return; } scroll.scrollLeft = fx * scroll.scrollWidth; scroll.scrollTop = fy * scroll.scrollHeight; };
    if (now) go(); else { apply(true); zt = setTimeout(go, 160); }
  };
  bar.onclick = e => { const b = e.target.closest('[data-rz]'); if (!b) return; const v = b.dataset.rz; setZoom(v === '+' ? zoom * 1.25 : v === '-' ? zoom / 1.25 : 1, true); };
  scroll.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); e.stopPropagation(); setZoom(zoom * Math.exp(-e.deltaY / 300)); }, { passive: false });   // the reading zooms, not the papers under it
  grip.onpointerdown = e => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const y0 = e.clientY, start = scroll.getBoundingClientRect().height;
    grip.onpointermove = m => { const hh = Math.max(120, Math.round(start + m.clientY - y0)); scroll.style.maxHeight = hh + 'px'; scroll.style.height = hh + 'px'; };
    grip.onpointerup = grip.onpointercancel = () => { grip.onpointermove = grip.onpointerup = grip.onpointercancel = null; const hh = parseInt(scroll.style.maxHeight) || 0; if (hh) store.set(hk, hh); scroll.style.height = ''; };
  };
  grip.onkeydown = e => { if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault(); const hh = Math.max(120, Math.round(scroll.getBoundingClientRect().height + (e.key === 'ArrowDown' ? 60 : -60))); scroll.style.maxHeight = hh + 'px'; store.set(hk, hh); };
  grip.tabIndex = 0;
  const framed = () => { showZ(); body.append(bar, scroll, grip); };
  try {
    if (f.kind === 'docx' || f.kind === 'text') {
      const c = f.kind === 'docx' ? await docxCard({ name: r.name, data: r.data }, r.name) : textCard(f);
      const h = c.querySelector('.fhead'); if (h) h.remove();
      apply = () => { c.style.zoom = zoom; };
      apply(); scroll.appendChild(c); framed();
    }
    else if (viewable(f)) {
      await workerReady;
      const doc = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
      docs.push(doc);   // let go of with the paper's own files when she moves to another student
      const box = document.createElement('div'); box.className = 'refpages'; scroll.appendChild(box); framed();
      const dpr = window.devicePixelRatio || 1, w = Math.min(860, ($('#paper').clientWidth || 900) - 80), turn = { rot: f.photoTurn ? { 0: f.photoTurn } : null };
      const pgs = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i), c = document.createElement('canvas');
        pgs.push({ page, c, v1: vpRot(turn, i - 1, page, 1), i, drawn: 0 }); box.appendChild(c);
      }
      // Quick look while pinching: stretch what's drawn. Then draw each page sharp at the new size.
      let job = 0;
      apply = async quick => {
        const pw = Math.round(w * zoom);
        for (const p of pgs) { p.c.style.width = pw + 'px'; p.c.style.height = Math.round(pw * p.v1.height / p.v1.width) + 'px'; }
        if (quick) return;
        const me = ++job;
        for (const p of pgs) {
          if (me !== job) return;
          if (p.drawn === pw) continue;
          const vp = vpRot(turn, p.i - 1, p.page, pw / p.v1.width * dpr), off = document.createElement('canvas');
          off.width = Math.ceil(vp.width); off.height = Math.ceil(vp.height);
          const ctx = off.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, off.width, off.height);
          await p.page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
          if (me !== job) return;
          p.c.width = off.width; p.c.height = off.height; p.c.getContext('2d').drawImage(off, 0, 0); p.drawn = pw;
        }
      };
      await apply();
    }
    else if (f.kind === 'media') { const v = document.createElement(/\.(mp4|mov|webm|m4v)$/i.test(r.name) ? 'video' : 'audio'); v.controls = true; v.src = URL.createObjectURL(new Blob([r.data])); v.style.width = '100%'; body.appendChild(v); }
    else body.appendChild(otherCard(f));
  } catch { body.innerHTML = '<p class="muted">This file couldn’t be shown here.</p>'; }
  return det;
}

/* the speech engine (same as the Interview Transcriber), in a worker so the page stays smooth */
function whisperWorker() {
  let pipeline, env, asr = null, loadedKey = '';
  const libReady = (async () => {
    ({ pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'));
    env.allowLocalModels = false;
    let ok = false; try { ok = !!(await caches.open('gs-probe')); } catch (e) {}
    if (!ok) {
      const open = () => new Promise((res, rej) => { const r = indexedDB.open('grading-studio-models', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const key = k => typeof k === 'string' ? k : k.url;
      env.useBrowserCache = false; env.useCustomCache = true;
      env.customCache = {
        async match(k) { try { const db = await open(); const v = await new Promise((res, rej) => { const q = db.transaction('files').objectStore('files').get(key(k)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); return v ? new Response(v.body, { headers: v.headers }) : undefined; } catch (e) { return undefined; } },
        async put(k, response) { try { const body = await response.arrayBuffer(); const headers = {}; response.headers.forEach((v, n) => headers[n] = v); const db = await open(); await new Promise((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put({ body, headers }, key(k)); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} },
      };
    }
  })();
  const MODEL = 'onnx-community/whisper-base.en_timestamped';
  const DT = { wasm: { encoder_model: 'fp32', decoder_model_merged: 'q8' }, webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } };
  async function load() {
    if (asr) return;
    let device = 'wasm'; try { if (navigator.gpu && await navigator.gpu.requestAdapter()) device = 'webgpu'; } catch (e) {}
    const files = {};
    const progress_callback = p => { if (p.status === 'progress' && p.total) { files[p.file] = [p.loaded, p.total]; let l = 0, t = 0; for (const k in files) { l += files[k][0]; t += files[k][1]; } postMessage({ type: 'loading', loaded: l, total: t }); } };
    try { asr = await pipeline('automatic-speech-recognition', MODEL, { device, dtype: DT[device], progress_callback }); if (device === 'webgpu') await asr(new Float32Array(16000), { return_timestamps: 'word' }); }
    catch (e) { if (device !== 'webgpu') throw e; device = 'wasm'; asr = await pipeline('automatic-speech-recognition', MODEL, { device, dtype: DT.wasm, progress_callback }); }
    loadedKey = device;
  }
  async function run(audio) {
    try {
      const out = await asr(audio, { return_timestamps: 'word' });
      const w = (out.chunks || []).map(c => [c.text, c.timestamp[0]]);
      if (!w.length && out.text && out.text.trim()) throw 0;
      return w;
    } catch (e) {
      const out = await asr(audio, { return_timestamps: true }), w = [];
      for (const c of out.chunks || []) { const parts = c.text.trim().split(/\s+/).filter(Boolean), a = c.timestamp[0] || 0, b = c.timestamp[1] || audio.length / 16000; parts.forEach((p, i) => w.push([' ' + p, a + (b - a) * i / parts.length])); }
      return w;
    }
  }
  self.onmessage = async ({ data }) => {
    try {
      try { await libReady; } catch (e) { throw new Error('Couldn’t download the speech engine. Check the internet connection (it’s only needed the first time).'); }
      await load();
      if (data.type === 'load') postMessage({ type: 'ready' });
      else postMessage({ type: 'result', job: data.job, words: await run(data.audio) });
    } catch (e) { postMessage({ type: 'error', job: data.job, message: String(e && e.message || e) }); }
  };
}
let asrW = null; const asrJobs = new Map(); let asrSeq = 0, asrLoad = null;
function asrCall(msg, transfer) {
  if (!asrW) {
    asrW = new Worker(URL.createObjectURL(new Blob(['(' + whisperWorker.toString() + ')()'], { type: 'text/javascript' })));
    asrW.onmessage = ({ data }) => {
      if (data.type === 'loading') { if (asrLoad) asrLoad(data.loaded / data.total); return; }
      const j = asrJobs.get(data.job ?? 0); if (!j) return; asrJobs.delete(data.job ?? 0);
      data.type === 'error' ? j.rej(new Error(data.message)) : j.res(data);
    };
    asrW.onerror = e => { for (const j of asrJobs.values()) j.rej(new Error(e.message || 'The speech engine couldn’t start.')); asrJobs.clear(); asrW = null; };
  }
  const job = msg.type === 'load' ? 0 : ++asrSeq;
  return new Promise((res, rej) => { asrJobs.set(job, { res, rej }); asrW.postMessage({ ...msg, job }, transfer || []); });
}
const SR = 16000;
async function decodeAudio(bytes) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  let ctx; try { ctx = new Ctx({ sampleRate: SR }); } catch (e) { ctx = new Ctx(); }
  try {
    const ab = await ctx.decodeAudioData(bytes.slice().buffer);
    let x = ab.getChannelData(0).slice();
    if (ab.numberOfChannels > 1) { const b = ab.getChannelData(1); for (let i = 0; i < x.length; i++) x[i] = (x[i] + b[i]) / 2; }
    if (ab.sampleRate !== SR) { const n = Math.round(x.length * SR / ab.sampleRate), y = new Float32Array(n), r = ab.sampleRate / SR; for (let i = 0; i < n; i++) { const p = i * r, k = Math.floor(p), fr = p - k; y[i] = (x[k] || 0) * (1 - fr) + (x[k + 1] || 0) * fr; } x = y; }
    return x;
  } finally { try { ctx.close(); } catch (e) {} }
}
// Pieces of at most 28 s, cut at the quietest moment between 18 and 28 s so words aren't split.
function planChunks(x) {
  const F = 320, frames = Math.ceil(x.length / F), rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; const a = f * F, b = Math.min(x.length, a + F); for (let i = a; i < b; i++) s += x[i] * x[i]; rms[f] = Math.sqrt(s / Math.max(1, b - a)); }
  const out = []; let start = 0;
  while (start < x.length) {
    if (x.length - start <= 28 * SR) { out.push([start, x.length]); break; }
    const lo = Math.floor((start + 18 * SR) / F), hi = Math.floor((start + 28 * SR) / F);
    let best = hi, bv = Infinity;
    for (let f = lo; f <= hi - 15; f++) { let v = 0; for (let k = 0; k < 15; k++) v += rms[f + k] || 0; if (v < bv) { bv = v; best = f + 7; } }
    out.push([start, best * F]); start = best * F;
  }
  return out.map(([a, b]) => { let s = 0; for (let i = a; i < b; i += 4) s += x[i] * x[i]; return { a, b, rms: Math.sqrt(s / Math.max(1, (b - a) / 4)) }; });
}
async function transcribeFile(f, say) {
  say('Starting the speech engine…');
  asrLoad = p => say('Downloading the speech engine, one time only… ' + Math.round(p * 100) + '%');
  await asrCall({ type: 'load' }); asrLoad = null;
  say('Reading the sound…');
  let x; try { x = await decodeAudio(f.data); } catch { throw new Error('This browser couldn’t read the sound in this file. Try Chrome, or convert it to .mp4 or .m4a.'); }
  const chunks = planChunks(x), dur = x.length / SR, words = [];
  for (let c = 0; c < chunks.length; c++) {
    const { a, b, rms } = chunks[c];
    if (rms > 0.002) {
      const res = await asrCall({ type: 'run', audio: x.slice(a, b) });
      for (const [w, t] of res.words) { const s = (w || '').trim(); if (!s || /^[\[(].*[\])]$/.test(s)) continue; words.push([w, +(a / SR + Math.max(0, t || 0)).toFixed(2)]); }
    }
    say('Transcribing ' + fmtTime(b / SR) + ' of ' + fmtTime(dur) + '…');
  }
  f.tr = { w: words };
}

// Every recording in the download, one after another. Each transcript is saved as soon as it's done,
// so stopping (or closing the tab) keeps the ones already made.
let trAll = null;
function openTranscripts() {
  const all = batch.students.flatMap((st, i) => st.files.filter(f => f.kind === 'media').map(f => ({ st, i, f })));
  const have = all.filter(x => x.f.tr).length;
  const render = (msg) => {
    $('#trBody').innerHTML = '<p style="margin-top:0"><b>' + all.length + (all.length === 1 ? ' recording' : ' recordings') + '</b> in this download' + (have ? ', ' + have + ' with a transcript already' : '') + '.</p>' +
      (have && !trAll ? '<label class="chk"><input type="checkbox" id="trRedo"> Make the existing ones again too</label>' : '') +
      '<p class="muted" style="font-size:13px">Runs in this browser (nothing is uploaded). The speech engine downloads once. Keep this tab open while it works; you can keep grading in the meantime.</p>' +
      '<div class="prog"' + (trAll ? '' : ' hidden') + '><i style="width:' + (trAll ? trAll.pct : 0) + '%"></i></div><p id="trMsg" style="font-size:14px">' + esc(msg || '') + '</p>';
  };
  openDlg('<div class="bh"><h2>Transcripts</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="trBody"></div>' +
    '<div class="bf"><button class="btn" data-close>Close</button><button class="btn primary" data-go>' + (trAll ? 'Stop' : 'Make transcripts') + '</button></div>', true);
  render(trAll ? trAll.msg : '');
  const box = $('#dlgBox');
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('[data-go]')) return;
    if (trAll) { trAll.stop = true; e.target.textContent = 'Stopping after this one…'; return; }
    const redo = !!($('#trRedo') && $('#trRedo').checked), todo = all.filter(x => redo || !x.f.tr);
    if (!todo.length) return toast('Every recording already has a transcript');
    e.target.closest('[data-go]').textContent = 'Stop';
    trAll = { stop: false, pct: 0, msg: '' };
    let lock = null; try { lock = await navigator.wakeLock.request('screen'); } catch {}
    const say = m => { trAll.msg = m; const el = $('#trMsg'); if (el) el.textContent = m; const bar = $('#trBody .prog'); if (bar) { bar.hidden = false; bar.firstChild.style.width = trAll.pct + '%'; } };
    let done = 0, failed = 0;
    for (let k = 0; k < todo.length && !trAll.stop; k++) {
      const { st, i, f } = todo[k];
      trAll.pct = Math.round(100 * k / todo.length);
      try {
        await transcribeFile(f, m => say('Student ' + (i + 1) + ' (' + (k + 1) + ' of ' + todo.length + ') · ' + f.name + ' · ' + m));
        done++; saveNow();
        if (i === cur && $('#dlg').hidden) openStudent(cur);
      } catch (er) { failed++; console.error(er); }
    }
    try { lock && lock.release(); } catch {}
    const stopped = trAll.stop; trAll = null;
    const msg = (stopped ? 'Stopped. ' : 'Done. ') + done + (done === 1 ? ' transcript' : ' transcripts') + ' made' + (failed ? ', ' + failed + ' couldn’t be read (try Chrome, or convert those to .mp4 or .m4a)' : '') + '.';
    toast(msg);
    if (!$('#dlg').hidden && $('#trBody')) { render(msg); const g = box.querySelector('[data-go]'); if (g) g.textContent = 'Make transcripts'; }
    renderList(); if ($('#dlg').hidden) openStudent(cur);
  };
}

