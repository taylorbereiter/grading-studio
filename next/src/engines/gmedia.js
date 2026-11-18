// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, docs, once, tr, PDFLib, store } from './gcore.js';
import { rgb, one } from './gdraw.js';

// src/app/media.js
const MEDIA_RX = /\.(mp4|mov|m4v|webm|mkv|3gp|mp3|m4a|wav|aac|ogg|oga|opus|flac|weba|aif|aiff|caf|amr)$/i;
// src/app/media.js
const VIDEO_RX = /\.(mp4|mov|m4v|webm|mkv|3gp)$/i;
// src/app/media.js
const MIME = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', '3gp': 'video/3gpp', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', weba: 'audio/webm', aif: 'audio/aiff', aiff: 'audio/aiff', caf: 'audio/x-caf', amr: 'audio/amr' };
// src/app/media.js
const extOf = n => (n.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
// src/app/media.js
const fmtTime = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// src/app/media.js
const trMakeable = f => f.kind === 'media' || !!keptId(f);
// src/app/media.js
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
// src/app/media.js
const trText = tr => trLines(tr).map(x => (x.t != null ? '[' + fmtTime(x.t) + '] ' : '') + (x.w ? x.w.map(y => y[0]).join('').trim() : x.s)).join('\n');
// src/app/media.js
const TR_TS = /^[[(]?\s*((?:\d{1,2}:)?\d{1,3}:\d{2})(?:[.,]\d{1,3})?\s*[\])]?/;
// src/app/media.js
const TR_TO = /^\s*(?:-->|–|—|-|to)\s*[[(]?\s*(?:\d{1,2}:)?\d{1,3}:\d{2}(?:[.,]\d{1,3})?\s*[\])]?/;
// src/app/media.js
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
// src/app/readings.js
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
// src/app/readings.js
let asrW = null; const asrJobs = new Map(); let asrSeq = 0, asrLoad = null;
// src/app/readings.js
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
// src/app/readings.js
const SR = 16000;
// src/app/readings.js
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
// src/app/readings.js
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
// src/app/readings.js
function asrStop() {
  if (!asrW) return;
  try { asrW.terminate(); } catch (e) {}
  asrW = null; asrLoad = null;
  for (const j of asrJobs.values()) j.rej(Object.assign(new Error('Stopped'), { name: 'AbortError' }));
  asrJobs.clear();
}
// src/app/readings.js
const asrStandIn = {};   // the tests put stand-ins here ({ call, decode }) so no speech engine is downloaded
// src/app/readings.js
async function transcribe(bytes, say, stop) {
  stop = stop || {};
  const asrCall_ = asrStandIn.call || asrCall, decodeAudio_ = asrStandIn.decode || decodeAudio;
  const halt = () => { if (stop.on) throw Object.assign(new Error('Stopped'), { name: 'AbortError' }); };
  say('Starting the speech engine…', 0);
  asrLoad = p => say('Downloading the speech engine, one time only… ' + Math.round(p * 100) + '%', 0);
  await asrCall_({ type: 'load' }); asrLoad = null; halt();
  store.set('gs.asrHave', 1);   // downloaded once in this browser: the next transcript doesn't ask first
  say('Reading the sound…', 0);
  let x; try { x = await decodeAudio_(bytes); } catch { throw new Error('This browser couldn’t read the sound in this file. Try Chrome, or convert it to .mp4 or .m4a.'); }
  halt();
  const chunks = planChunks(x), dur = x.length / SR, words = [];
  for (let c = 0; c < chunks.length; c++) {
    const { a, b, rms } = chunks[c];
    if (rms > 0.002) {
      const res = await asrCall_({ type: 'run', audio: x.slice(a, b) });
      for (const [w, t] of res.words) { const s = (w || '').trim(); if (!s || /^[\[(].*[\])]$/.test(s)) continue; words.push([w, +(a / SR + Math.max(0, t || 0)).toFixed(2)]); }
    }
    halt();
    say('Transcribing ' + fmtTime(b / SR) + ' of ' + fmtTime(dur) + '…', b / x.length);
  }
  return words;
}
// src/app/library.js
const uid = () => Math.random().toString(36).slice(2, 10);
// src/app/kept.js
const fmtSize = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
// src/video.js
const LINK_RX = /\.(url|webloc)$/i;
// src/video.js
function linkClean(v) {
  v = String(v || '').trim().replace(/&amp;/g, '&'); if (!v || /\s/.test(v)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
}
// src/video.js
function linkOf(data) {
  if (!data || !data.length || data.length > 20000) return '';
  let s = ''; try { s = new TextDecoder().decode(data); } catch { return ''; }
  const m = /^\s*URL\s*=\s*(\S+)/mi.exec(s) || /<string>\s*([^<\s]+)\s*<\/string>/i.exec(s);
  return m ? linkClean(m[1]) : '';
}
// src/video.js
const linkBytes = url => new TextEncoder().encode('[InternetShortcut]\r\nURL=' + url + '\r\n');
// src/video.js
const linkHost = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
// src/video.js
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
// src/video.js
const linkTitle = f => f.name.replace(LINK_RX, '').replace(/ \(added \d+\)$/, '');
// src/video.js
const vidRef = data => { if (!data || !data.length || data.length > 4000) return ''; let s = ''; try { s = new TextDecoder().decode(data); } catch { return ''; } const m = /^\s*URL\s*=\s*gs-video:([\w-]{6,40})\s*$/mi.exec(s); return m ? m[1] : ''; };
// src/video.js
const vidBytes = (id, name, size) => new TextEncoder().encode('[InternetShortcut]\r\nURL=gs-video:' + id + '\r\nName=' + String(name || '').replace(/[\r\n]+/g, ' ').slice(0, 120) + '\r\nSize=' + (size || 0) + '\r\n');
// src/video.js
const drvRef = data => { if (!data || !data.length || data.length > 4000) return ''; let s = ''; try { s = new TextDecoder().decode(data); } catch { return ''; } const m = /^\s*GsDrive\s*=\s*([\w-]{10,120})\s*$/mi.exec(s); return m ? m[1] : ''; };
// src/video.js
const keptId = f => { if (!f || f.kind !== 'link') return ''; const v = vidRef(f.data); if (v) return v; const d = drvRef(f.data); return d ? 'd-' + d : ''; };
// src/video.js
const linkKey = f => { const v = vidRef(f.data); return v ? 'gs-video:' + v : linkOf(f.data); };
// src/video.js
const vrotKey = f => (f.kind === 'link' ? linkKey(f) : f.path);
// src/video.js
const vrotOf = f => (batch && batch.vrot && batch.vrot[vrotKey(f)]) || 0;
// src/video.js
const frameTicks = src => /youtube-nocookie\.com\/embed\/|player\.vimeo\.com\//.test(src);
// src/video.js
const NP_W = 595.28, NP_H = 841.89, NP_M = 48, NP_TAIL = '%GradingStudio-notes';
// src/video.js
const isNotes = d => !!d && d.length > 64 && new TextDecoder('latin1').decode(d.subarray(d.length - 64)).includes(NP_TAIL);
// src/video.js
const notesFileOf = st => st.files.find(f => f.kind === 'pdf' && !f.virtual && isNotes(f.data)) || null;
// src/video.js
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
// src/video.js
const npRows = su => (su && su.mode === 'rubric' && Array.isArray(su.criteria) ? su.criteria : []);
// src/video.js
const npFileName = s => (String(s || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Notes');
// src/video.js
const linkSpot = url => { const p = url && linkPlayer(url); return p && p.frame ? p.frame : ''; };
// src/video.js
const linkSame = f => linkSpot(linkOf(f.data));
// src/video.js
function sameVideo(st, o) {
  if (o.file) return null;
  const url = o.drive ? 'https://drive.google.com/file/d/' + o.drive.id + '/view' : linkClean(o.url), spot = linkSpot(url);
  if (!url) return null;
  return st.files.find(f => f.kind === 'link' && !vidRef(f.data) && (linkOf(f.data) === url || (!!spot && linkSame(f) === spot))) || null;
}
export { linkClean, linkOf, linkPlayer, linkTitle, linkHost, linkBytes, vidRef, drvRef, keptId, linkKey, vrotKey, vrotOf, frameTicks, fmtSize, MEDIA_RX, VIDEO_RX, MIME, extOf, fmtTime, trLines, trText, trParse, trMakeable, transcribe, asrStop, asrStandIn, notesPdf, npRows, npFileName, isNotes, notesFileOf, NP_TAIL, vidBytes, sameVideo };
export { uid };
