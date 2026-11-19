// The take-home file (src/takehome.js): everything for grading, and the Planner, in one passphrase-protected file, made here and
// brought in on another computer, in the same format as the current app's, so either app reads the other's.
//   "GSWORK1\n", the header's length (4 bytes), the header as JSON: { v, kdf: { name, hash, iter, salt }, cipher, chunk, np }
//   a short check block, which tells a wrong passphrase apart from a damaged file
//   chunks of AES-256-GCM, each chunk bytes of plain data and a 16-byte tag, the last one shorter or equal.
// A chunk's nonce is np (7 random bytes), its number (4 bytes) and 1 if it's the last; the hash of everything up to the check
// block is authenticated with each one. Inside, frames: 4 bytes of JSON length, the JSON, then { n } bytes: info, ls, tomb, dl,
// then papers, late files, readings, Word edits, school files, examples, the Planner's records, and { k: 'end' }.
// Nothing is ever all in memory: records are read one at a time, chunks go straight to the disk, and reading back slices the file.
// Bringing one in: the whole file is checked first, then what would change is shown, then (other windows stopped, a safety copy
// made) the bytes go in before any mark or score, so a browser out of room has changed nothing that matters.
import { localState, addedDates, applyRow, keptBytes, tombs } from './apply.js';
import { carryLs, LS_LOCAL, F } from './folder.js';
import { takeLs } from './carry.js';
import { snapshot, version } from './safety.js';
import { devId } from '../shared/tabs.js';
import { papers, meta, edits, added, library, exampleRecords, examplePictures } from '../students/index.js';
import { takePapers, takeAdded, takeEdit, takeLibrary, takeTombs, takeExample, noteBackup, migrateLib, DATA_V } from '../students/write.js';
import { school, schoolFiles, lessons, kv } from '../planning/index.js';
import { saveSchoolFile, takePlan } from '../planning/write.js';

export const TAKE_EXT = '.gswork';
const TAKE_MAGIC = 'GSWORK1\n', TAKE_ITER = 1000000, TAKE_CHUNK = 4 * 1024 * 1024, CHECK_I = 0xffffffff;
const te = new TextEncoder(), td = new TextDecoder();
const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
export class TakeError extends Error { constructor(code) { super(code); this.code = code; } }
async function takeKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const takeNonce = (np, i, flag) => { const n = new Uint8Array(12); n.set(np); new DataView(n.buffer).setUint32(7, i); n[11] = flag; return n; };
const engine = () => import('../engines/merge.js');

/* what goes in besides the work */
// The Planner's own settings kept in this browser go along; the focus session going on, and the phone's notes waiting for the
// Planner (they come by sync), stay.
const PLAN_LS_SKIP = /^gsp\.(presentTimer|focusRun|focusQ|focusGo|taughtIn)$/;
export function planLs() {
  const o = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gsp.') && !PLAN_LS_SKIP.test(k)) o[k] = localStorage.getItem(k); } } catch {}
  return o;
}
// The Planner's records, one at a time (a Planner can hold big PDFs). Its folder's link belongs to this computer and stays.
export async function planFrames(frame) {
  let n = 0;
  for (const [name, store] of [['lessons', lessons], ['kv', kv]]) {
    for (const k of await store.keys()) {
      const v = await store.get(k);
      if (typeof FileSystemHandle !== 'undefined' && v instanceof FileSystemHandle) continue;
      if (v instanceof Blob) { await frame({ k: 'plan', s: name, key: k, blob: v.type || '', fname: v.name || '' }, new Uint8Array(await v.arrayBuffer())); n++; continue; }
      let j; try { j = JSON.parse(JSON.stringify(v === undefined ? null : v)); } catch { continue; }
      await frame({ k: 'plan', s: name, key: k, v: j }); n++;
    }
  }
  return n;
}
const schoolRefs = () => {
  let s = null; try { s = school.json(null); } catch {}
  const seen = new Set(), out = [];
  for (const i of (s && Array.isArray(s.items) ? s.items : [])) if (i && !i.gone && i.file && i.file.hash && !seen.has(i.file.hash)) { seen.add(i.file.hash); out.push(i.file); }
  return out;
};
async function exPics(r) { const out = []; for (let n = 0; n < (r.pages || []).length; n++) { const b = await examplePictures.get(r.id + '|' + n); if (!b) return null; out.push(b); } return out; }

/* writing */
// sink: { write(bytes), close(), abort() }. onp(bytes so far). stop(): true to stop. more (a year's file): { info: more fields
// for the info frame, onPlan: n => told how many Planner records went in }.
export async function takeWrite(sink, pass, onp, stop, more) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), np = crypto.getRandomValues(new Uint8Array(7));
  const hdr = te.encode(JSON.stringify({ v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iter: TAKE_ITER, salt: b64(salt) }, cipher: 'AES-256-GCM', chunk: TAKE_CHUNK, np: b64(np) }));
  const head = new Uint8Array(TAKE_MAGIC.length + 4 + hdr.length);
  head.set(te.encode(TAKE_MAGIC)); new DataView(head.buffer).setUint32(TAKE_MAGIC.length, hdr.length); head.set(hdr, TAKE_MAGIC.length + 4);
  const key = await takeKey(pass, salt, TAKE_ITER), ad = await crypto.subtle.digest('SHA-256', head);
  await sink.write(head);
  await sink.write(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: takeNonce(np, CHECK_I, 2), additionalData: ad }, key, new Uint8Array(16))));
  const buf = new Uint8Array(TAKE_CHUNK);
  let fill = 0, idx = 0, total = 0;
  const seal = async last => {
    if (stop && stop()) throw new DOMException('Stopped', 'AbortError');
    await sink.write(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: takeNonce(np, idx++, last ? 1 : 0), additionalData: ad }, key, buf.subarray(0, fill))));
    total += fill; fill = 0; if (onp) onp(total);
  };
  const push = async u => {
    for (let at = 0; at < u.length;) {
      if (fill === TAKE_CHUNK) await seal(false);
      const n = Math.min(u.length - at, TAKE_CHUNK - fill);
      buf.set(u.subarray(at, at + n), fill); fill += n; at += n;
    }
  };
  const frame = async (o, bytes) => {
    const j = te.encode(JSON.stringify(bytes ? { ...o, n: bytes.length } : o)), len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, j.length);
    await push(len); await push(j); if (bytes) await push(bytes);
  };
  const A = await localState(), ids = [...new Set([...Object.keys(A.meta), ...Object.keys(A.work)])];
  await frame({ k: 'info', app: 'Grading Studio', kind: 'take-home', t: Date.now(), from: location.host || 'an offline copy', ver: __GS_APP_VERSION__, dataV: version(), downloads: ids.length, ...((more && more.info) || {}) });
  await frame({ k: 'ls', ls: carryLs() });
  await frame({ k: 'tomb', tomb: A.tomb });
  for (const id of ids) await frame({ k: 'dl', id, work: A.work[id] || null, meta: A.meta[id] || null });
  for (const id of (await papers.keys()).filter(k => !String(k).includes('|'))) {   // one file's bytes at a time, however big the download
    const rec = await papers.get(id), es = (rec && rec.entries) || [];
    for (let i = 0; i < es.length; i++) { const data = await keptBytes(id, i, es[i]); await frame({ k: 'paper', id, label: rec.label || '', path: es[i].path, ...(data ? {} : { none: true }) }, data || undefined); }
  }
  for (const k of await added.keys()) { const rec = await added.get(k); if (!rec) continue; const { data, ...r } = rec, i = k.indexOf('|'); await frame({ k: 'added', id: k.slice(0, i), lk: k.slice(i + 1), rec: r }, data); }
  for (const k of await edits.keys()) {
    const rec = await edits.get(k); if (!rec || !rec.data) continue;
    const i = k.indexOf('|'), orig = rec.orig || new Uint8Array(0), both = new Uint8Array(rec.data.length + orig.length);
    both.set(rec.data); both.set(orig, rec.data.length);
    await frame({ k: 'edit', id: k.slice(0, i), path: k.slice(i + 1), t: rec.t || 1, nd: rec.data.length, hasOrig: !!rec.orig }, both);
  }
  for (const f of schoolRefs()) { const r = await schoolFiles.get(f.hash).catch(() => null); if (r && r.data) await frame({ k: 'school', hash: f.hash }, r.data); }
  for (const r of await exampleRecords()) {
    const w = r.watch ? 'exw' : 'ex';   // watch-list records go in frames an older copy skips, so it never shows a concern as a strong example
    if (r.gone) { await frame({ k: w, rec: r }); continue; }
    const blobs = await exPics(r); if (!blobs) continue;
    await frame({ k: w, rec: r });
    for (let i = 0; i < blobs.length; i++) await frame({ k: w + 'pix', id: r.id, i }, new Uint8Array(await blobs[i].arrayBuffer()));
  }
  const planN = await planFrames(frame);
  await frame({ k: 'planls', ls: planLs() });
  if (more && more.onPlan) more.onPlan(planN);
  await frame({ k: 'end' });
  await seal(true);
  await sink.close();
  return total;
}
// Straight to the disk where the browser allows it; otherwise the chunks wait as small Blobs (kept out of the tab's memory) until
// the download starts. A school's policy can block the save box: only her saying no stops here.
let sinkFor = null;   // tests hand in a file handle here: the save box can't be driven
export const useSink = h => { sinkFor = h; };
export async function takeSink(name, kind) {
  try {
    const fh = sinkFor || (window.showSaveFilePicker ? await window.showSaveFilePicker({ suggestedName: name, types: [{ description: kind, accept: { 'application/octet-stream': [TAKE_EXT] } }] }) : null);
    if (fh) { const w = await fh.createWritable(); return { name: fh.name, write: b => w.write(b), close: () => w.close(), abort: () => w.abort(), file: () => fh.getFile(), save: async () => {} }; }
  } catch (e) { if (e && e.name === 'AbortError') throw e; console.error(e); }
  const parts = []; let blob = null;
  const give = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
  return { name, write: async b => { parts.push(new Blob([b])); }, close: async () => { blob = new Blob(parts, { type: 'application/octet-stream' }); }, abort: async () => {}, file: async () => blob, save: async () => give(), plain: true };
}
// A take-home file: written, and kept as the last backup.
export async function makeTakeHome(sink, pass, onp, stop) {
  const size = await takeWrite(sink, pass, onp, stop);
  if (sink.plain) await sink.save();
  noteBackup();
  return size;
}
// Downloads this browser has work for, but not the papers: the file can't carry what isn't here.
export const papersLacking = async () => (await meta.entries()).map(([, m]) => m).filter(m => m && !m.papers).map(m => m.name || '');
export const sizeHere = async () => (await meta.entries()).reduce((a, [, m]) => a + ((m && m.size) || 0), 0);

/* reading */
// Checks the passphrase and gets ready to read. Throws TakeError: notours, newer, pass, damaged.
export async function takeOpen(file, pass) {
  const start = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (td.decode(start.subarray(0, TAKE_MAGIC.length)) !== TAKE_MAGIC) throw new TakeError('notours');
  const len = new DataView(start.buffer).getUint32(TAKE_MAGIC.length), hs = TAKE_MAGIC.length + 4 + len;
  if (hs + 32 > start.length) throw new TakeError('damaged');
  let h; try { h = JSON.parse(td.decode(start.subarray(TAKE_MAGIC.length + 4, hs))); } catch { throw new TakeError('damaged'); }
  if (h.v !== 1) throw new TakeError(h.v > 1 ? 'newer' : 'damaged');
  const iter = h.kdf && h.kdf.iter, chunk = h.chunk;
  if (!(iter >= 100000 && iter <= 20000000) || !(chunk >= 4096 && chunk <= 64 * 1024 * 1024) || h.kdf.name !== 'PBKDF2' || h.cipher !== 'AES-256-GCM') throw new TakeError('damaged');
  let salt, np; try { salt = unb64(h.kdf.salt); np = unb64(h.np); } catch { throw new TakeError('damaged'); }
  if (np.length !== 7) throw new TakeError('damaged');
  const key = await takeKey(pass, salt, iter), ad = await crypto.subtle.digest('SHA-256', start.subarray(0, hs));
  try { await crypto.subtle.decrypt({ name: 'AES-GCM', iv: takeNonce(np, CHECK_I, 2), additionalData: ad }, key, start.subarray(hs, hs + 32)); }
  catch { throw new TakeError('pass'); }
  const body = hs + 32, tagged = chunk + 16, bodyLen = file.size - body, nChunks = Math.ceil(bodyLen / tagged), lastLen = bodyLen - (nChunks - 1) * tagged;
  if (nChunks < 1 || lastLen < 16) throw new TakeError('damaged');
  const plainLen = (nChunks - 1) * chunk + lastLen - 16;
  let held = -1, heldBytes = null;
  const chunkAt = async i => {
    if (i === held) return heldBytes;
    const s = body + i * tagged, last = i === nChunks - 1, ct = await file.slice(s, Math.min(s + tagged, file.size)).arrayBuffer();
    let p; try { p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: takeNonce(np, i, last ? 1 : 0), additionalData: ad }, key, ct); }
    catch { throw new TakeError('damaged'); }
    held = i; heldBytes = new Uint8Array(p);
    return heldBytes;
  };
  const read = async (off, n) => {
    if (off + n > plainLen) throw new TakeError('damaged');
    const out = new Uint8Array(n);
    for (let at = 0; at < n;) {
      const i = Math.floor((off + at) / chunk), c = await chunkAt(i), from = off + at - i * chunk, m = Math.min(n - at, c.length - from);
      out.set(c.subarray(from, from + m), at); at += m;
    }
    return out;
  };
  return { read, chunkAt, chunk, plainLen };
}
// Goes through the whole file first, so a damaged or changed one fails before anything is touched, and collects all but the bytes.
export async function takeScan(rd, onp) {
  const B = { work: {}, meta: {}, tomb: {}, added: {}, edits: {}, papers: {}, addedAt: {}, editAt: {}, school: {}, ex: {}, exAt: {}, ls: {}, lib: null, info: null };
  let pos = 0, seen = -1, ended = false;
  const skipTo = async end => { const stop = Math.ceil(end / rd.chunk); for (let i = seen + 1; i < stop; i++) { await rd.chunkAt(i); seen = i; if (onp) onp((i + 1) * rd.chunk); } };
  try {
    while (!ended) {
      if (pos + 4 > rd.plainLen) throw new TakeError('damaged');
      const len = new DataView((await rd.read(pos, 4)).buffer).getUint32(0);
      const f = JSON.parse(td.decode(await rd.read(pos + 4, len)));
      pos += 4 + len;
      seen = Math.max(seen, Math.floor((pos - 1) / rd.chunk));
      const n = f.n || 0;
      if (f.k === 'info') B.info = f;
      else if (f.k === 'ls') { B.ls = f.ls || {}; try { B.lib = JSON.parse(B.ls['gs.lib']); } catch {} }
      else if (f.k === 'tomb') B.tomb = f.tomb || {};
      else if (f.k === 'dl') { if (f.work) B.work[f.id] = f.work; if (f.meta) B.meta[f.id] = f.meta; }
      else if (f.k === 'paper') { const p = B.papers[f.id] ||= { label: f.label, entries: [], size: 0 }; p.entries.push({ path: f.path, off: pos, n, none: f.none }); p.size += n; }
      else if (f.k === 'added') { (B.addedAt[f.id] ||= {})[f.lk] = { rec: f.rec, off: pos, n }; (B.added[f.id] ||= {})[f.lk] = f.rec.added || 0; }
      else if (f.k === 'edit') { (B.editAt[f.id] ||= {})[f.path] = { t: f.t, off: pos, n, nd: f.nd, hasOrig: f.hasOrig }; (B.edits[f.id] ||= {})[f.path] = f.t; }
      else if (f.k === 'ex' || f.k === 'exw') { if (f.rec && f.rec.id) B.ex[f.rec.id] = f.rec; }
      else if (f.k === 'expix' || f.k === 'exwpix') B.exAt[f.id + '|' + f.i] = { off: pos, n };
      else if (f.k === 'school') B.school[f.hash] = { off: pos, n };
      else if (f.k === 'plan') (B.plan ||= []).push({ f, off: pos, n });
      else if (f.k === 'planls') B.planLs = f.ls || {};
      else if (f.k === 'end') ended = true;
      await skipTo(pos + n);
      pos += n;
    }
  } catch (e) { if (e instanceof TakeError) throw e; console.error(e); throw new TakeError('damaged'); }
  if (pos !== rd.plainLen || !B.info || B.info.app !== 'Grading Studio') throw new TakeError('damaged');
  if ((B.info.dataV || 0) > DATA_V) throw new TakeError('newer');
  return B;
}
export const takeSource = (rd, B) => ({
  async papers(id) {
    const p = B.papers[id]; if (!p) return null;
    const entries = [];
    for (const e of p.entries) entries.push({ path: e.path, data: e.none ? null : await rd.read(e.off, e.n) });
    return { id, label: p.label, entries };
  },
  async added(id, k) { const a = B.addedAt[id] && B.addedAt[id][k]; return a ? { ...a.rec, data: await rd.read(a.off, a.n) } : null; },
  async edit(id, p) {
    const e = B.editAt[id] && B.editAt[id][p]; if (!e) return null;
    const both = await rd.read(e.off, e.n);
    return { t: e.t, data: both.slice(0, e.nd), orig: e.hasOrig ? both.slice(e.nd) : null };
  },
  async exPics(r) {
    const out = [];
    for (let i = 0; i < (r.pages || []).length; i++) { const a = B.exAt[r.id + '|' + i]; if (!a) return null; out.push(new Blob([await rd.read(a.off, a.n)], { type: 'image/jpeg' })); }
    return out;
  },
  async school(hash) { const s = B.school && B.school[hash]; return s ? rd.read(s.off, s.n) : null; },
  async plan(r) { return r.n ? rd.read(r.off, r.n) : new Uint8Array(0); },
});
// Opens and checks a file; { B, src } or throws TakeError.
export async function readTakeHome(file, pass, onp) {
  const rd = await takeOpen(file, pass), B = await takeScan(rd, onp);
  return { B, src: takeSource(rd, B), plainLen: rd.plainLen };
}

/* what bringing it in would do */
const exU = r => r.u || r.t || 0;
// The file's examples against these: the newer of each wins, a deleted one goes (src/examples.js exMergePlan).
async function exPlan(B) {
  const A = await exampleRecords(), a = new Map(A.map(r => [r.id, r])), had = new Set(A.filter(r => !r.gone).map(r => r.id));
  const list = Object.values(B.ex || {}).filter(r => !a.has(r.id) ? !r.gone : exU(r) > exU(a.get(r.id)));
  return { list, add: list.filter(r => !r.gone && !had.has(r.id)).length, change: list.filter(r => !r.gone && had.has(r.id)).length, drop: list.filter(r => r.gone && had.has(r.id)).length };
}
// A year's file is left out: last year's lessons are in Past lessons. A Planner with nothing in it takes everything; one in use
// takes only what it hasn't got, by lesson and by record, so nothing made here is ever replaced.
async function planPlan(B) {
  const none = { n: 0, lessons: 0, other: 0, empty: false, list: [] };
  if (!B.plan || !B.plan.length || (B.info && B.info.kind === 'year')) return none;
  const have = { lessons: new Set(await lessons.keys()), kv: new Set(await kv.keys()) };
  const u = have.kv.has('units') ? await kv.get('units') : null, units = Array.isArray(u) ? u.length : 0;
  const empty = !have.lessons.size && !have.kv.has('setup') && !units;
  const list = B.plan.filter(r => (r.f.s === 'lessons' || r.f.s === 'kv') && (empty || !have[r.f.s].has(r.f.key)));
  const n = list.filter(r => r.f.s === 'lessons').length;
  return { n: list.length, lessons: n, other: list.length - n, empty, list };
}
const libHere = () => { const l = library.json(null); return l ? migrateLib(l) : { classes: [], loose: { id: '', units: [] } }; };
async function mergePlan(B) {
  const M = await engine(), A = await localState(), dev = devId(), now = Date.now(), work = {};
  await addedDates(A, B);
  const libm = M.mergeLib(libHere(), B.lib, { dev, now });
  for (const w of Object.values(A.work)) if (libm.mapA[w.cls]) w.cls = libm.mapA[w.cls];
  for (const [id, w] of Object.entries(B.work)) work[id] = libm.mapB[w.cls] ? { ...w, cls: libm.mapB[w.cls] } : w;
  const Bm = { ...B, work }, plan = M.mergeStates(A, Bm, { dev, now, linked: M.libLinked(libm.lib, libm.cards) });
  return { M, A, B: Bm, libm, plan, dev, now, lsSet: M.mergeLs(carryLs(), B.ls, k => Object.keys(plan.tomb).some(id => k.includes(id))) };
}
// A question and the copy here she'd be answering it about. If either is new, she hasn't really answered it.
const askSig = (M, a) => a.gone ? '!' + a.id + '|' + (a.work && a.work.t) : a.id + '|' + a.key + '|' + M.recHash(a.a);
// What would change, for the preview. Nothing is touched here.
export async function bringPreview(B) {
  const { M, plan, libm, lsSet } = await mergePlan(B), rows = plan.rows, asks = [...plan.asks, ...libm.asks];
  const ex = await exPlan(B), pl = await planPlan(B);
  const nw = rows.filter(r => r.kind === 'new'), mg = rows.filter(r => r.kind === 'merge'), gn = rows.filter(r => r.kind === 'gone');
  const lsReal = Object.keys(lsSet).filter(k => k !== 'gs.rubricsGone' && /^gs\.(bank|setup|rubrics|school|rp\.|rd\.)/.test(k));
  const nothing = !pl.n && !ex.list.length && !nw.length && !gn.some(r => r.onA) && !libm.notes.length && !lsReal.length && !asks.length && !mg.some(r => r.extra || r.setIn.length || r.rows.some(x => x.pick === 'b'));
  const need = nw.reduce((a, r) => a + ((B.papers && B.papers[r.id] && B.papers[r.id].size) || 0), 0);
  let room = 0; try { const q = await navigator.storage.estimate(); if (need && q.quota - q.usage < need * 1.1) room = q.quota - q.usage; } catch {}
  return {
    nothing, asks, shown: asks.map(a => askSig(M, a)),
    fresh: nw.map(r => { const n = (r.meta && r.meta.n) || Object.keys((r.work && r.work.s) || {}).length; return { id: r.id, name: r.name, n, scored: r.work && r.meta ? r.meta.scored || 0 : null, size: (B.papers && B.papers[r.id] && B.papers[r.id].size) || 0 }; }),
    merged: mg.map(r => ({ id: r.id, name: r.name, extra: r.extra || 0, anon: !!r.anon, come: r.rows.filter(x => x.pick === 'b').map(x => x.key), stay: r.rows.filter(x => x.pick === 'a').map(x => x.key), lined: r.lined || [], dated: r.rows.filter(x => x.by === 'date').length, setIn: r.setIn, pooled: r.setBoth.filter(x => x.pooled).map(x => x.k), later: r.setBoth.filter(x => !x.pooled).map(x => x.k) })),
    gone: gn.map(r => ({ id: r.id, name: r.name, onA: !!r.onA })),
    notes: libm.notes, cardOff: rows.filter(r => r.cardOff).map(r => r.name),
    also: { bank: !!lsSet['gs.bank'], school: !!lsSet['gs.school'], other: lsReal.some(k => k !== 'gs.bank' && k !== 'gs.school') },
    ex: { add: ex.add, change: ex.change, drop: ex.drop }, planner: { n: pl.n, lessons: pl.lessons, other: pl.other, empty: pl.empty },
    same: rows.filter(r => r.kind === 'same' || r.kind === 'onlyA').length, need, room,
  };
}
// Bringing it in. The caller has every other window stop first, so this is the last word on what's here. Says false, having
// changed nothing, if that leaves a question she hasn't seen (another window saved while the preview was open).
// answers: { 'id|key': 'a' | 'b', '!id': 'gone' | 'back' } as the two-versions choice gives them.
export async function bringIn(B0, src, shown, picked, onStep) {
  const { M, A, B, libm: open, lsSet, plan: openPlan, dev, now } = await mergePlan(B0);
  const seen = new Set(shown);
  if ([...openPlan.asks, ...open.asks].some(a => !seen.has(askSig(M, a)))) return false;
  const answers = {};
  for (const a of [...openPlan.asks, ...open.asks]) { if (a.gone) answers['!' + a.id] = picked['!' + a.id]; else (answers[a.id] ||= {})[a.key] = picked[a.id + '|' + a.key]; }
  const libm = open.asks.length ? M.mergeLib(libHere(), B.lib, { dev, now, answers }) : open;
  const plan = M.mergeStates(A, B, { answers, dev, now, linked: M.libLinked(libm.lib, libm.cards) });
  M.libFollow(libm, plan.rows, dev, now);
  await snapshot('Before bringing work in', version());
  if (F.mod && (F.state === 'ok' || F.state === 'decide')) { try { await F.mod.folderSnapshot('Before bringing work in'); } catch (e) { console.error(e); } }
  let done = 0;
  const step = () => onStep && onStep(++done, plan.rows.length * 2);
  // bytes first: if there is no room for them, her marks and scores haven't changed yet
  for (const r of plan.rows) {
    step();
    if (r.kind === 'gone' || r.kind === 'askGone' || r.kind === 'onlyA' || (r.ma && r.ma.papers)) continue;
    const rec = await src.papers(r.id); if (!rec) continue;
    await takePapers(r.id, rec, 'take');
    r.meta = { ...r.meta, papers: true, size: rec.entries.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) }; r.ma = { ...(r.ma || {}), papers: true };
  }
  for (const r of plan.rows) {
    if (r.files) for (const k of r.files.fromB) { const rec = await src.added(r.id, k); if (rec) await takeAdded(r.id + '|' + k, rec, 'take'); }
    if (r.edits) for (const p of r.edits.fromB) { const rec = await src.edit(r.id, p); if (rec) await takeEdit(r.id + '|' + p, rec, 'take'); }
  }
  const have = new Set(await schoolFiles.keys());
  for (const h of Object.keys(B0.school || {})) if (!have.has(h)) { const b = await src.school(h); if (b) await saveSchoolFile(h, b); }
  const pl = await planPlan(B0);
  if (pl.n) {
    const put = [], keys = [];
    for (const r of pl.list) {   // one record at a time: a Planner can hold big files
      const f = r.f; let v = f.v;
      if ('blob' in f) { const bytes = await src.plan(r); v = f.fname ? new File([bytes], f.fname, { type: f.blob || '' }) : new Blob([bytes], { type: f.blob || '' }); }
      if (f.s === 'lessons') put.push(v); else keys.push([f.key, v]);
    }
    await takePlan({ put, keys });
    for (const [k, v] of Object.entries(B0.planLs || {})) if (k.startsWith('gsp.') && !PLAN_LS_SKIP.test(k) && (pl.empty || localStorage.getItem(k) == null)) takeLs(k, v, 'take');
  }
  // Rosters next, with no marks or scores changed yet: a score with no paper hangs on its roster.
  if (libm.toA) takeLibrary(libm.lib, 'take');
  for (const [k, v] of Object.entries(lsSet)) if (takeLs(k, v, 'take') === false) throw Object.assign(new Error('This browser’s small store is full'), { small: true });
  const none = { papers: async () => null, added: async () => null, edit: async () => null };
  for (const r of plan.rows) {
    if (r.kind !== 'gone' && r.kind !== 'askGone' && r.ma && r.ma.papers) r.meta = { ...r.meta, papers: true };
    if (r.files) r.files.fromB = []; if (r.edits) r.edits.fromB = [];
    step();
    await applyRow(r, none, 'take');
  }
  if (JSON.stringify(tombs()) !== JSON.stringify(plan.tomb)) takeTombs(plan.tomb, 'take');
  if (src.exPics) for (const r of (await exPlan(B0)).list) {
    if (r.gone) { await takeExample(r, null, 'take'); continue; }
    const blobs = await src.exPics(r); if (blobs && blobs.length === (r.pages || []).length) await takeExample(r, blobs, 'take');
  }
  // Work from an older format updates itself on the reload, and every step is safe to run twice.
  const v = B.info && B.info.dataV;
  if (!v) takeLs('gs.dataV', null, 'take'); else if (v < version()) takeLs('gs.dataV', String(v), 'take');
  return true;
}

/* an old backup ZIP: the same preview and merge, so it never overwrites newer work */
export async function readBackupZip(file) {
  const { unzipSync } = await import('fflate');
  let z, data;
  try { z = unzipSync(new Uint8Array(await file.arrayBuffer())); data = JSON.parse(td.decode(z['backup.json'])); } catch { throw new TakeError('notbackup'); }
  if (!data || !data.info || data.info.app !== 'Grading Studio') throw new TakeError('notbackup');
  if ((data.info.dataV || 0) > DATA_V) throw new TakeError('newer');
  const unpack = v => {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.__bin === 'number') return z['bin/' + v.__bin] || new Uint8Array(0);
    if (Array.isArray(v)) return v.map(unpack);
    if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = unpack(x); return o; }
    return v;
  };
  const keep = data.keep || {}, recs = d => d ? unpack(d) : { k: [], v: [] };
  const B = { work: {}, meta: {}, tomb: {}, added: {}, edits: {}, ls: {}, lib: null, papers: {}, info: { t: data.info.t, downloads: data.info.downloads, dataV: data.info.dataV || (data.ls && data.ls['gs.dataV'] ? +data.ls['gs.dataV'] : 0) } };
  const ps = recs(keep.papers), metas = recs(keep.meta), works = recs(keep.work), eds = recs(keep.edits), adds = recs(data.added);
  for (const [k, v] of Object.entries(data.ls || {})) {
    if (k.startsWith('gs.b.')) { try { B.work[k] = JSON.parse(v); } catch {} }
    else if (!LS_LOCAL.test(k)) B.ls[k] = v;
  }
  try { B.lib = JSON.parse(B.ls['gs.lib']); if (B.lib) migrateLib(B.lib); } catch {}
  const newest = (a, b) => !a ? b || null : !b ? a : (b.t || 0) > (a.t || 0) ? b : a;
  works.k.forEach((k, i) => { B.work[k] = newest(B.work[k], works.v[i]); });
  metas.k.forEach((k, i) => { B.meta[k] = metas.v[i]; });
  const paperOf = new Map(), addOf = new Map(), editOf = new Map();
  ps.k.forEach((k, i) => { paperOf.set(k, ps.v[i]); B.papers[k] = { size: (ps.v[i].entries || []).reduce((a, e) => a + (e.data ? e.data.length : 0), 0) }; });
  adds.k.forEach((k, i) => { const j = k.indexOf('|'), id = k.slice(0, j), lk = k.slice(j + 1); addOf.set(k, adds.v[i]); (B.added[id] ||= {})[lk] = adds.v[i].added || 0; });
  eds.k.forEach((k, i) => { const j = k.indexOf('|'), id = k.slice(0, j), p = k.slice(j + 1); editOf.set(k, eds.v[i]); (B.edits[id] ||= {})[p] = eds.v[i].t || 1; });
  return { B, src: { papers: async id => paperOf.get(id) || null, added: async (id, k) => addOf.get(id + '|' + k) || null, edit: async (id, p) => editOf.get(id + '|' + p) || null } };
}
