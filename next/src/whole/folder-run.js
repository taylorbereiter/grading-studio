// The linked folder's own part (src/folder.js, the same steps in the same order), loaded once a folder is linked:
// Grading Studio/          (made inside the folder she picks, unless she picked this very folder)
//   gs-folder.json         says what this folder is
//   README.txt             the same, for a person
//   library.json           rosters, units, rubrics, saved comments, settings
//   tombstones.json        forgotten downloads, so they stay forgotten
//   files/<sha256>.dat     papers, late files, readings and Word edits, each written once however many downloads share them
//   downloads/<id>/        info.json (which files, and the row for the list) and work.json (marks, scores, comments)
//   examples/<id>.json     one strong example and the names of its pictures in files/
//   snapshots/             dated copies of everything but the bytes, as gzipped JSON, to go back to
//   Papers/, Videos/       plain copies to open from Finder or Explorer (only ever written)
// JSON goes to name.new first and then to name, and the .new is removed last, so a half-written file is never the only copy.
// The browser and the folder are compared student by student (engines/merge.js) when the folder is linked, comes back, or was
// written by someone else; each save in between goes straight to the folder. What comes in is written through the grading side's
// own writes, marked from: 'folder'. Any FileSystemDirectoryHandle will do, so tests hand it one from the browser's private files.
import { F, setFolder, carryLs } from './folder.js';
import { localState, addedDates, applyRow, keptBytes, tombs } from './apply.js';
import { takeLs } from './carry.js';
import { snapshot, putBackData } from './safety.js';
import { folderHandle } from '../shared/device.js';
import { devId } from '../shared/tabs.js';
import { text as lsRaw } from '../shared/ls.js';
import { papers, meta, edits, added, library, examples as exStore, examplePictures, exampleRecords, videos } from '../students/index.js';
import { takeLibrary, takeTombs, takeExample, keepVideo } from '../students/write.js';
import { school, schoolFiles } from '../planning/index.js';
import { saveSchoolFile } from '../planning/write.js';
import { openWork, flushOpen } from '../app/openwork.js';
import { toast } from '../ui/overlay.jsx';
import { t } from '../i18n/t.js';
import '../app/saving/lines.js';

const SUB = 'Grading Studio', RETRY = 20000, SCH_DAYS = 14;
const fld = { picked: null, root: null, why: '', at: 0, prog: '', work: new Map(), lib: false, gone: new Set(), run: null, sync: null, again: false, seen: new Map(), info: new Map(), hold: {}, holdSet: {}, holdLib: {}, asks: [], answers: {}, day: '', timer: null, have: null };
const engine = () => import('../engines/merge.js');
const set = s => { F.state = s; setFolder(s); };
const LIB_RX = /^gs\.(lib|setup|bank|tomb|carryNo|rubrics|rubricsGone|histSame|school|rp\..+|rd\..+)$/;
const under = id => IDBKeyRange.bound(id + '|', id + '|￿');

/* the folder itself */
const dlDirName = id => encodeURIComponent(id);
async function writeBytes(dir, name, data) {
  try {
    const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable();
    try { await w.write(data); await w.close(); } catch (e) { try { await w.abort(); } catch {} throw e; }
    return fh;
  } catch (e) { if (e) e.onFolder = true; throw e; }   // running out of room here is told apart from the browser running out
}
export async function writeJson(dir, name, obj) {
  const s = JSON.stringify(obj);
  await writeBytes(dir, name + '.new', s);
  const fh = await writeBytes(dir, name, s);
  await dir.removeEntry(name + '.new').catch(() => {});
  return fh;
}
export async function readJson(dir, name) {
  for (const n of [name + '.new', name]) {
    let s; try { s = await (await (await dir.getFileHandle(n)).getFile()).text(); } catch (e) { if (e.name === 'NotFoundError') continue; throw e; }
    let o; try { o = JSON.parse(s); } catch { continue; }   // cut short: the other one is whole
    if (n !== name) await writeJson(dir, name, o);   // a .new still here means that write never finished, so finish it
    return o;
  }
  return null;
}
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
export async function putBlob(bytes) {
  const dir = await fld.root.getDirectoryHandle('files', { create: true }), hash = await sha(bytes), name = hash + '.dat';
  if (fld.have) fld.have.add(name);
  try { if ((await (await dir.getFileHandle(name)).getFile()).size === bytes.length) return { hash, size: bytes.length }; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
  await writeBytes(dir, name, bytes);
  return { hash, size: bytes.length };
}
export async function getBlob(ref) {
  const dir = await fld.root.getDirectoryHandle('files'), bytes = new Uint8Array(await (await (await dir.getFileHandle(ref.hash + '.dat')).getFile()).arrayBuffer());
  if (bytes.length !== ref.size || await sha(bytes) !== ref.hash) throw Object.assign(new Error('A file in your folder is damaged: ' + ref.hash), { damaged: true });
  return bytes;
}
const dlDir = async (id, make) => (await fld.root.getDirectoryHandle('downloads', { create: !!make })).getDirectoryHandle(dlDirName(id), { create: !!make });
const dlInfo = async (id, dir) => fld.info.get(id) || await readJson(dir, 'info.json') || { id, papers: null, added: {}, edits: {} };
async function addedRef(id, k) { const r = await added.get(id + '|' + k); if (!r) return null; const { data, ...x } = r; return { ...x, ...await putBlob(data) }; }
async function editRef(id, p) { const r = await edits.get(id + '|' + p); return r ? { t: r.t || 1, data: await putBlob(r.data), orig: r.orig ? await putBlob(r.orig) : null } : null; }
// The folder brought up to date with the browser for one download. data: the work to write, or null to leave it. A student she
// hasn't decided about stays as the folder has them, Word edits too.
async function pushDownload(id, data) {
  const dir = await dlDir(id, true), info = await dlInfo(id, dir), before = JSON.stringify(info), held = fld.hold[id], isHeld = p => !!held && ('e:' + p) in held;
  const there = r => !fld.have || !r || !r.hash || fld.have.has(r.hash + '.dat');
  if (!info.papers || !info.papers.every(there)) {
    const rec = await papers.get(id);
    if (rec && rec.entries) {
      const list = [];
      for (let i = 0; i < rec.entries.length; i++) { const d = await keptBytes(id, i, rec.entries[i]); list.push({ path: rec.entries[i].path, ...(d ? await putBlob(d) : {}) }); }
      info.papers = list; info.label = rec.label || '';
    }
  }
  const ak = new Map((await added.entries(under(id))).map(([k, r]) => [k.slice(id.length + 1), r]));
  for (const k of Object.keys(info.added)) if (!ak.has(k) || !there(info.added[k]) || (ak.get(k) && (ak.get(k).added || 0) !== (info.added[k].added || 0))) delete info.added[k];   // replaced under the same name: the new bytes go
  for (const k of ak.keys()) if (!info.added[k]) { const r = await addedRef(id, k); if (r) info.added[k] = r; }
  const ek = new Set((await edits.keys(under(id))).map(k => k.slice(id.length + 1)));
  for (const p of Object.keys(info.edits)) if (!isHeld(p) && (!ek.has(p) || !there(info.edits[p].data) || !there(info.edits[p].orig))) delete info.edits[p];
  for (const p of ek) {
    if (isHeld(p)) continue;
    const known = data && Object.values(data.s || {}).map(r => r.e && r.e[p]).find(Boolean);
    if (info.edits[p] && (!known || known === info.edits[p].t)) continue;
    const r = await editRef(id, p); if (r) info.edits[p] = r;
  }
  const m = await meta.get(id); if (m) info.meta = m;
  if (JSON.stringify(info) !== before) await writeJson(dir, 'info.json', info);
  fld.info.set(id, info);
  if (data) {
    let out = held ? { ...data, s: { ...data.s, ...held } } : data;
    if (fld.holdSet[id]) {   // a setting she hasn't decided about stays as the folder has it too
      out = { ...out, pv: { ...out.pv } };
      for (const [k, h] of Object.entries(fld.holdSet[id])) { if (h.val === undefined) delete out[k]; else out[k] = h.val; if (h.v) out.pv[k] = h.v; else delete out.pv[k]; }
    }
    const fh = await writeJson(dir, 'work.json', out);
    fld.seen.set(id, (await fh.getFile()).lastModified);
  }
}
// Has someone else (another browser, say) written this download since this window last did?
async function foreignWrite(id) {
  if (!fld.seen.has(id)) return false;
  try { return (await (await (await dlDir(id)).getFileHandle('work.json')).getFile()).lastModified !== fld.seen.get(id); } catch (e) { if (e.name === 'NotFoundError') return false; throw e; }
}
async function pushLibrary() {
  const ls = carryLs();
  if (ls['gs.lib'] && Object.keys(fld.holdLib).length) ls['gs.lib'] = (await engine()).libHold(ls['gs.lib'], fld.holdLib);   // a card's rubric she hasn't decided about stays as the folder has it
  await writeJson(fld.root, 'library.json', { t: Date.now(), ls });
  await writeJson(fld.root, 'tombstones.json', tombs());
}
// All of what's in the folder, except the bytes.
async function stateOf() {
  const B = { work: {}, meta: {}, tomb: await readJson(fld.root, 'tombstones.json') || {}, added: {}, edits: {}, info: {}, ls: null, lib: null, have: new Set(), missing: new Set() };
  fld.info.clear(); fld.seen.clear(); papersIdx = null;
  for await (const [n] of (await fld.root.getDirectoryHandle('files', { create: true })).entries()) B.have.add(n);
  fld.have = B.have;
  const l = await readJson(fld.root, 'library.json');
  if (l) { B.ls = l.ls || {}; try { B.lib = JSON.parse(B.ls['gs.lib']); } catch {} }
  const dls = await fld.root.getDirectoryHandle('downloads', { create: true });
  for await (const [nm, h] of dls.entries()) {
    if (h.kind !== 'directory') continue;
    const id = decodeURIComponent(nm), info = await readJson(h, 'info.json'), work = await readJson(h, 'work.json');
    if (work) { B.work[id] = work; try { fld.seen.set(id, (await (await h.getFileHandle('work.json')).getFile()).lastModified); } catch {} }
    if (info) {
      B.info[id] = info; fld.info.set(id, info);
      B.meta[id] = { ...(info.meta || { id, name: info.label || 'A download', n: 0, t: (work && work.t) || 0 }), id, papers: !!info.papers };
      B.added[id] = Object.fromEntries(Object.entries(info.added || {}).map(([k, r]) => [k, r.added || 0]));
      B.edits[id] = Object.fromEntries(Object.entries(info.edits || {}).map(([p, r]) => [p, r.t || 1]));
    }
  }
  return B;
}
// The bytes of what's in the folder. One missing or damaged is noted in B.missing and the rest carry on.
const sourceOf = B => {
  const blob = async (id, ref) => {
    if (B.have.has(ref.hash + '.dat')) { try { return await getBlob(ref); } catch (e) { if (!e.damaged && e.name !== 'NotFoundError') throw e; } }
    B.missing.add(id); return null;
  };
  return {
    async papers(id) {
      const i = B.info[id]; if (!i || !i.papers) return null;
      const entries = [];
      for (const e of i.papers) { const data = e.hash ? await blob(id, e) : null; if (e.hash && !data) return null; entries.push({ path: e.path, data }); }
      return { id, label: i.label || '', entries };
    },
    async added(id, k) { const r = B.info[id] && B.info[id].added[k]; if (!r) return null; const { hash, size, ...x } = r, data = await blob(id, { hash, size }); return data && { ...x, data }; },
    async edit(id, p) {
      const r = B.info[id] && B.info[id].edits[p]; if (!r) return null;
      const data = await blob(id, r.data), orig = r.orig ? await blob(id, r.orig) : null;
      return data && (orig || !r.orig) ? { t: r.t, data, orig } : null;
    },
  };
};

/* snapshots */
const snapRx = /^(\d{4})-(\d\d)-(\d\d) (\d\d)(\d\d)(?:-\d+)? (.+)\.gsnap$/;
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
export async function snapList() {
  const dir = await fld.root.getDirectoryHandle('snapshots', { create: true }), out = [];
  for await (const [name, h] of dir.entries()) { const m = h.kind === 'file' && snapRx.exec(name); if (m) out.push({ name, t: new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime(), why: m[6] }); }
  return out.sort((a, b) => b.t - a.t);
}
export const gzRead = async (dir, name) => JSON.parse(await new Response((await (await dir.getFileHandle(name)).getFile()).stream().pipeThrough(new DecompressionStream('gzip'))).text());
async function gzWrite(dir, name, obj) {
  const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable();
  await new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip')).pipeTo(w);
}
// why: 'daily', or what it was made before. Everything in the browser but the bytes, which are in files/ for as long as a snapshot names them.
export async function folderSnapshot(why) {
  const d = new Date(), A = await localState(), ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.') && !k.startsWith('gs.b.')) ls[k] = localStorage.getItem(k); }
  const add = {}, ed = {};
  for (const id of Object.keys(A.meta)) {
    add[id] = {}; ed[id] = {};
    for (const k of Object.keys(A.added[id] || {})) { const r = await addedRef(id, k); if (r) add[id][k] = r; }
    for (const p of Object.keys(A.edits[id] || {})) { const r = await editRef(id, p); if (r) ed[id][p] = r; }
  }
  const dir = await fld.root.getDirectoryHandle('snapshots', { create: true }), have = await snapList();
  const base = ymd(d) + ' ' + pad2(d.getHours()) + pad2(d.getMinutes()), nm = n => base + (n ? '-' + n : '') + ' ' + why.replace(/[\\/:*?"<>|]+/g, '-') + '.gsnap';
  let n = 0; while (have.some(s => s.name === nm(n))) n++;
  await gzWrite(dir, nm(n), { t: d.getTime(), why, ls, work: A.work, meta: A.meta, added: add, edits: ed });
  const keep = (await engine()).snapKeep(await snapList(), Date.now());
  for (const s of await snapList()) if (!keep.has(s.name)) await dir.removeEntry(s.name).catch(() => {});
}
async function dailySnapshot() {
  const today = ymd(new Date());
  if (fld.day === today) return;
  fld.day = today;
  if (!(await snapList()).some(s => s.why === 'daily' && ymd(new Date(s.t)) === today)) await folderSnapshot('daily');
}
// Going back to a snapshot: its work goes in place of the browser's, a safety copy having been made first; the next sync makes the
// folder match. Examples stay as they are (anonymous pictures, apart from the work that goes back).
export async function folderGoBack(name) {
  await snapshot('Before going back to a snapshot from your folder');
  await folderSnapshot('Before going back');
  const s = await gzRead(await fld.root.getDirectoryHandle('snapshots'), name), rec = { ls: s.ls, stores: {} };
  const put = (where, k, v) => { const o = rec.stores[where] ||= { k: [], v: [] }; o.k.push(k); o.v.push(v); };
  for (const [id, w] of Object.entries(s.work || {})) put('grading-studio-keep/work', id, w);
  for (const [id, m] of Object.entries(s.meta || {})) put('grading-studio-keep/meta', id, m);
  for (const [id, list] of Object.entries(s.edits || {})) for (const [p, r] of Object.entries(list)) put('grading-studio-keep/edits', id + '|' + p, { t: r.t, data: await getBlob(r.data), orig: r.orig ? await getBlob(r.orig) : null });
  for (const [id, list] of Object.entries(s.added || {})) for (const [k, r] of Object.entries(list)) { const { hash, size, ...x } = r; put('grading-studio-added/files', id + '|' + k, { ...x, data: await getBlob({ hash, size }) }); }
  for (const [where, list] of [['grading-studio-examples/ex', await exStore.entries()], ['grading-studio-examples/pix', await examplePictures.entries()]]) for (const [k, v] of list) put(where, k, v);
  await putBackData(rec);
  carryAfterPutBack();
}
// One snapshot's work and Word edits, to look at and to put back one assignment from (src/safe.js gbRead): the bytes read only if wanted.
export const snapOn = () => !!fld.root && (F.state === 'ok' || F.state === 'saving' || F.state === 'decide');
export async function snapRead(name) {
  const s = await gzRead(await fld.root.getDirectoryHandle('snapshots'), name), ed = {};
  for (const [id, list] of Object.entries(s.edits || {})) { ed[id] = {}; for (const [p, r] of Object.entries(list)) ed[id][p] = { t: r.t || 1, data: () => getBlob(r.data), orig: async () => (r.orig ? getBlob(r.orig) : null) }; }
  return { work: s.work || {}, edits: ed };
}
// She went back on purpose, so the next sync takes the browser's side of everything.
export function carryAfterPutBack() { if (F.state !== 'none') try { localStorage.setItem('gsc.win', '1'); } catch {} }
const schHashes = (v, now) => { let s = v; if (typeof v === 'string') { try { s = JSON.parse(v); } catch { s = null; } } const out = new Set(), at = now || Date.now(); for (const i of (s && Array.isArray(s.items) ? s.items : [])) if (i && i.file && i.file.hash && (!i.gone || at - (i.at || 0) < SCH_DAYS * 864e5)) out.add(i.file.hash); return out; };
// Forget means gone: out of the folder, out of its snapshots, and its bytes go unless something else still uses them.
async function folderRemove(id) {
  await papersForget(id);
  const dls = await fld.root.getDirectoryHandle('downloads', { create: true });
  await dls.removeEntry(dlDirName(id), { recursive: true }).catch(e => { if (e.name !== 'NotFoundError') throw e; });
  fld.info.delete(id); fld.seen.delete(id); delete fld.hold[id]; delete fld.holdSet[id];
  const used = new Set(), mark = r => { if (r && r.hash) used.add(r.hash); }, markAll = (a, e) => { for (const r of Object.values(a || {})) mark(r); for (const r of Object.values(e || {})) { mark(r.data); mark(r.orig); } };
  for await (const [, h] of dls.entries()) { if (h.kind !== 'directory') continue; const i = await readJson(h, 'info.json'); if (!i) continue; (i.papers || []).forEach(mark); markAll(i.added, i.edits); }
  for (const h of schHashes(lsRaw('gs.school'))) used.add(h);
  const dir = await fld.root.getDirectoryHandle('snapshots', { create: true });
  for (const { name } of await snapList()) {
    let s; try { s = await gzRead(dir, name); } catch { continue; }
    for (const h of schHashes((s.ls || {})['gs.school'], s.t)) used.add(h);
    if (s.work && s.work[id] || s.meta && s.meta[id] || s.added && s.added[id] || s.edits && s.edits[id] || Object.keys(s.ls || {}).some(k => k.includes(id))) {
      for (const part of [s.work, s.meta, s.added, s.edits]) if (part) delete part[id];
      for (const k of Object.keys(s.ls || {})) if (k.includes(id)) delete s.ls[k];
      await gzWrite(dir, name, s);
    }
    for (const x of Object.keys(s.added || {})) markAll(s.added[x], s.edits && s.edits[x]);
  }
  for (const h of await exHashes()) used.add(h);
  const files = await fld.root.getDirectoryHandle('files', { create: true }), drop = [];
  for await (const [n] of files.entries()) if (!used.has(n.replace(/\.dat$/, ''))) drop.push(n);
  for (const n of drop) await files.removeEntry(n).catch(() => {});
}

/* Papers/: plain copies she can open from Finder or Explorer, by class and assignment, only ever written */
const PAPERS = 'Papers', seg = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-').replace(/[. ]+$/, '').trim().slice(0, 60) || '-';
const dirAt = async (root, parts, make) => { let d = root; for (const p of parts) d = await d.getDirectoryHandle(p, { create: make }); return d; };
async function rmAt(root, parts) { for (let i = parts.length; i > 0; i--) { try { await (await dirAt(root, parts.slice(0, i - 1), false)).removeEntry(parts[i - 1], { recursive: i === parts.length }); } catch { return; } } }
function findItem(l, id) { if (!id) return null; for (const c of [...(l.classes || []), l.loose].filter(Boolean)) for (const u of c.units || []) for (const it of u.items || []) if (it.id === id) return { c, it }; return null; }
function cardOf(l, id) { for (const c of [...(l.classes || []), l.loose].filter(Boolean)) for (const u of c.units || []) for (const it of u.items || []) if (it.batchId === id) return { c, it }; return null; }
function papersDir(id, info, idx) {
  const l = library.json(null) || { classes: [] }, f = findItem(l, (info.meta || {}).asg) || cardOf(l, id);
  const base = seg(f ? (f.c === l.loose ? 'No class' : f.c.name) : 'No class') + '/' + seg(f ? f.it.name : info.label || (info.meta && info.meta.name) || 'A download');
  const taken = new Set(Object.entries(idx).filter(([k]) => k !== id).map(([, v]) => v.dir.toLowerCase()));
  let dir = base, n = 1; while (taken.has(dir.toLowerCase())) dir = base + ' (' + ++n + ')';
  return dir;
}
let papersIdx = null;
async function papersMirror(ids, check) {
  const idx = papersIdx ||= await readJson(fld.root, 'papers-index.json') || {}, before = JSON.stringify(idx), files = await fld.root.getDirectoryHandle('files', { create: true }), top = await fld.root.getDirectoryHandle(PAPERS, { create: true });
  for (const id of ids) {
    const info = fld.info.get(id); if (!info) continue;
    const want = {};
    for (const e of info.papers || []) if (e.hash) want[e.path] = e.hash;
    for (const r of Object.values(info.added || {})) if (r.hash && r.path) want[r.path] = r.hash;
    let had = idx[id] || { dir: '', files: {} };
    const dir = papersDir(id, info, idx);
    if (had.dir && had.dir !== dir) { await rmAt(top, had.dir.split('/')); had = { dir, files: {} }; }
    had.dir = dir;
    const at = p => [...dir.split('/'), ...p.split('/').map(seg)];
    for (const p of Object.keys(had.files)) if (!(p in want)) { await rmAt(top, at(p)); delete had.files[p]; }
    for (const [p, h] of Object.entries(want)) {
      const a = at(p), name = a.pop();
      if (had.files[p] === h && !check) continue;
      const d = await dirAt(top, a, true);
      if (had.files[p] === h) { try { await d.getFileHandle(name); continue; } catch {} }
      let src; try { src = await (await files.getFileHandle(h + '.dat')).getFile(); } catch { continue; }
      const w = await (await d.getFileHandle(name, { create: true })).createWritable();
      try { await src.stream().pipeTo(w); } catch (e) { e.onFolder = true; throw e; }
      had.files[p] = h;
    }
    idx[id] = had;
  }
  if (JSON.stringify(idx) !== before) await writeJson(fld.root, 'papers-index.json', idx);
}
async function papersForget(id) {
  const idx = papersIdx ||= await readJson(fld.root, 'papers-index.json') || {};
  if (!idx[id]) return;
  await rmAt(await fld.root.getDirectoryHandle(PAPERS, { create: true }), idx[id].dir.split('/'));
  delete idx[id]; await writeJson(fld.root, 'papers-index.json', idx);
}

/* examples (src/examples.js exFolderRun): examples/<id>.json holds { rec, pix: [{ hash, size }] }; a watch-list record is <id>.w.json */
const exU = r => r.u || r.t || 0;
async function exPics(r) { const out = []; for (let n = 0; n < (r.pages || []).length; n++) { const b = await examplePictures.get(r.id + '|' + n); if (!b) return null; out.push(b); } return out; }
async function exSync() {
  const dir = await fld.root.getDirectoryHandle('examples', { create: true }), ids = new Set(), B = new Map();
  for await (const [nm, h] of dir.entries()) { const m = h.kind === 'file' && /^(.+)\.json(?:\.new)?$/.exec(nm); if (m) ids.add(m[1]); }
  for (const id of ids) { const o = await readJson(dir, id + '.json'), rid = id.replace(/\.w$/, ''); if (o && o.rec && o.rec.id === rid && !(B.has(rid) && exU(B.get(rid).rec) >= exU(o.rec))) B.set(rid, o); }
  const A = await exampleRecords();
  if (!A.length && !B.size) return;
  const a = new Map(A.map(r => [r.id, r])), bm = new Map([...B.values()].map(o => [o.rec.id, o.rec]));
  const toA = [...bm.values()].filter(r => !a.has(r.id) ? !r.gone : exU(r) > exU(a.get(r.id))), toB = A.filter(r => !bm.has(r.id) || exU(r) > exU(bm.get(r.id)));
  for (const r of toA) {
    if (r.gone) { await takeExample(r, null); continue; }
    const out = [];
    try { for (const ref of B.get(r.id).pix || []) out.push(new Blob([await getBlob(ref)], { type: 'image/jpeg' })); } catch (e) { if (e.damaged || e.name === 'NotFoundError') continue; throw e; }
    if (out.length === (r.pages || []).length) await takeExample(r, out);
  }
  for (const r of toB) {
    const fn = r.id + (r.watch ? '.w' : '') + '.json';
    if (r.gone) { await writeJson(dir, fn, { rec: r, pix: [] }); continue; }
    const blobs = await exPics(r); if (!blobs) continue;
    const pix = []; for (const b of blobs) pix.push(await putBlob(new Uint8Array(await b.arrayBuffer())));
    await writeJson(dir, fn, { rec: r, pix });
  }
}
async function exHashes() {
  const out = new Set();
  let dir; try { dir = await fld.root.getDirectoryHandle('examples'); } catch (e) { if (e.name === 'NotFoundError') return out; throw e; }
  const ids = new Set();
  for await (const [nm, h] of dir.entries()) { const m = h.kind === 'file' && /^(.+)\.json(?:\.new)?$/.exec(nm); if (m) ids.add(m[1]); }
  for (const id of ids) { const o = await readJson(dir, id + '.json'); for (const ref of (o && o.pix) || []) if (ref && ref.hash) out.add(ref.hash); }
  return out;
}
/* the School page's files (src/school.js schFolderSync): each on the list is in the browser and in files/, whichever has it gives it */
async function schSync() {
  let s = null; try { s = school.json(null); } catch {}
  const seen = new Set(), refs = [];
  for (const i of (s && Array.isArray(s.items) ? s.items : [])) if (i && !i.gone && i.file && i.file.hash && !seen.has(i.file.hash)) { seen.add(i.file.hash); refs.push(i.file); }
  if (!refs.length) return;
  const dir = await fld.root.getDirectoryHandle('files', { create: true }), have = new Set((await schoolFiles.keys()) || []);
  for (const f of refs) {
    let there = false; try { there = (await (await dir.getFileHandle(f.hash + '.dat')).getFile()).size === f.size; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
    if (have.has(f.hash)) { if (!there) { const r = await schoolFiles.get(f.hash); if (r && r.data) await putBlob(r.data); } }
    else if (there) { try { await saveSchoolFile(f.hash, await getBlob(f)); } catch (e) { if (!e.damaged) throw e; } }
  }
}
/* video files (src/video.js vkFolderSync): Videos/<name> [<id>].<ext>, copied straight from the stored file; with full, one the
   browser lacks comes in from the folder. Nothing in Videos/ is deleted here. */
const vkName = r => { const m = /^(.*?)(\.[\w]{1,6})?$/.exec(r.name || 'video'); return seg(m[1]) + ' [' + r.id + ']' + (m[2] || ''); };
async function vkSync(full) {
  const dir = await fld.root.getDirectoryHandle('Videos', { create: true }), there = new Map();
  for await (const [n, h] of dir.entries()) { const m = h.kind === 'file' && / \[([\w-]{6,40})\](\.\w+)?$/.exec(n); if (m) there.set(m[1], h); }
  let ids = []; try { ids = (await videos.keys()) || []; } catch {}
  for (const id of ids) {
    if (there.has(id)) continue;
    const r = await videos.get(id); if (!r || !r.blob) continue;
    const w = await (await dir.getFileHandle(vkName({ ...r, id }), { create: true })).createWritable();
    try { await r.blob.stream().pipeTo(w); } catch (e) { e.onFolder = true; throw e; }
  }
  if (full) for (const [id, h] of there) if (!ids.includes(id)) { try { const f = await h.getFile(); await keepVideo(new File([f], f.name.replace(/ \[[\w-]+\](?=\.\w+$|$)/, ''), { type: f.type }), id); } catch (e) { console.error(e); } }
}

/* the write queue */
function kick() {
  if (F.state === 'none' || F.state === 'ask' || F.state === 'lost' || fld.run || fld.sync) return;
  if (!fld.work.size && !fld.lib && !fld.gone.size) return;
  fld.run = runQueue().finally(() => { fld.run = null; kick(); });
}
async function runQueue() {
  set('saving');
  try {
    for (const id of [...fld.gone]) { await folderRemove(id); fld.gone.delete(id); fld.lib = true; }
    for (const [id, data] of [...fld.work]) {
      if (fld.work.get(id) === data) fld.work.delete(id);
      if (await foreignWrite(id)) { fld.run = null; reconcile(); return; }   // pushing would take off what only the folder has
      try { await pushDownload(id, data); } catch (e) { if (!fld.work.has(id)) fld.work.set(id, data); throw e; }
    }
    if (fld.lib) { fld.lib = false; try { await pushLibrary(); await schSync(); } catch (e) { fld.lib = true; throw e; } }
    await dailySnapshot();
    await papersMirror([...fld.info.keys()]).catch(e => console.error(e));
    try { await exSync(); } catch (e) { console.error(e); }
    try { await vkSync(false); } catch (e) { console.error(e); }
    fld.at = Date.now(); set(fld.asks.length ? 'decide' : 'ok');
  } catch (e) { await trouble(e); }
}
async function trouble(e) {
  console.error(e);
  let p = 'granted'; try { p = await fld.picked.queryPermission({ mode: 'readwrite' }); } catch {}
  fld.why = e && e.name === 'QuotaExceededError' ? (e.onFolder ? 'full' : 'room') : '';
  set(p === 'granted' ? 'lost' : 'ask');
  clearTimeout(fld.timer);
  if (p === 'granted') fld.timer = setTimeout(() => resume(false), RETRY);
}
// Back to working: no folder change is taken on trust, so everything is compared again.
export async function resume(ask) {
  clearTimeout(fld.timer);
  if (!fld.picked) return false;
  let p = 'lost';
  try { p = await fld.picked.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask) p = await fld.picked.requestPermission({ mode: 'readwrite' }); } catch (e) { console.error(e); }
  if (p !== 'granted') { set(p === 'lost' ? 'lost' : 'ask'); return false; }
  fld.day = '';
  try { fld.root = await rootOf(fld.picked); await reconcile(); return true; } catch (e) { await trouble(e); return false; }
}
async function rootOf(picked) {
  const has = async d => { try { await d.getFileHandle('gs-folder.json'); return true; } catch (e) { if (e.name === 'NotFoundError' || e.name === 'TypeMismatchError') return false; throw e; } };
  if (await has(picked) || picked.name === SUB) return picked;
  return picked.getDirectoryHandle(SUB, { create: true });
}
const README = `This folder is where Grading Studio keeps a copy of your grading work: the papers, marks, scores, comments, rosters and rubrics.

It's saved here by itself every time you work, so there's nothing to do. Please leave these files as they are. They hold student work, so keep the folder private.

files/ holds the papers and other files, under coded names. downloads/ holds your work on each download. snapshots/ holds dated copies you can go back to.
Papers/ has plain copies of the papers, by class and assignment, to open from here. Videos/ has the students' video files. Deleting a copy in Papers/ loses nothing: it comes back.
If this browser is ever cleared, open Grading Studio, link this folder again, and everything comes back.
`;
// The browser and the folder compared, per student, and each brought up to date with the other.
export function reconcile() {
  if (fld.sync) { fld.again = true; return fld.sync; }
  fld.sync = reconcileNow().catch(trouble).finally(() => {
    fld.sync = null; fld.have = null;
    if (fld.again) { fld.again = false; reconcile(); } else kick();
  });
  return fld.sync;
}
async function reconcileNow() {
  set('saving');
  await flushOpen();
  fld.work.clear();   // all in the browser now, so what follows covers it
  const root = fld.root, M = await engine();
  if (!await readJson(root, 'gs-folder.json')) { await writeJson(root, 'gs-folder.json', { app: 'Grading Studio', v: 1, made: Date.now() }); await writeBytes(root, 'README.txt', README); }
  const A = await localState(), B = await stateOf(), dev = devId(), now = Date.now();
  await addedDates(A, B);
  let prefer; try { if (localStorage.getItem('gsc.win')) prefer = 'a'; } catch {}
  const libA = library.json(null) || { classes: [], loose: { id: '', units: [] } };
  const libm = M.mergeLib(libA, B.lib, { prefer, dev, now, answers: fld.answers });
  for (const w of Object.values(A.work)) if (libm.mapA[w.cls]) w.cls = libm.mapA[w.cls];
  for (const w of Object.values(B.work)) if (libm.mapB[w.cls]) w.cls = libm.mapB[w.cls];
  const plan = M.mergeStates(A, B, { answers: fld.answers, prefer, dev, now, linked: M.libLinked(libm.lib, libm.cards) });
  M.libFollow(libm, plan.rows, dev, now);
  const open = openWork(), taking = plan.rows.filter(r => r.kind === 'new' || r.kind === 'gone' && r.onA || r.kind === 'merge' && (r.extra || r.setIn.length || r.rows.some(x => x.pick === 'b')));
  const hadWork = Object.keys(A.work).length > 0;
  if ((taking.length || libm.notes.length) && hadWork) {   // to undo a merge that went wrong
    try { await snapshot('Before bringing in work from your folder'); } catch (e) { console.error(e); }
    await folderSnapshot('Before bringing in work');
  }
  const src = sourceOf(B), n = plan.rows.length;
  let i = 0, students = 0;
  fld.hold = {}; fld.holdSet = {}; fld.holdLib = {}; fld.asks = [...plan.asks, ...libm.asks];
  for (const a of plan.asks) { if (a.part) (fld.holdSet[a.id] ||= {})[a.part] = { val: a.b, v: a.vb }; else if (!a.gone) (fld.hold[a.id] ||= {})[a.key] = a.b; }
  for (const a of libm.asks) { fld.holdLib[a.id] = a.there; const w = B.work[a.batchId]; if (w) (fld.holdSet[a.batchId] ||= {}).setup = { val: w.setup, v: w.pv && w.pv.setup }; }
  for (const row of plan.rows) {
    fld.prog = n > 3 ? ++i + ' / ' + n : ''; setFolder();
    if (row.kind === 'gone') { await applyRow(row, src, 'folder'); await folderRemove(row.id); continue; }
    if (row.kind === 'askGone') continue;
    await applyRow(row, src, 'folder');
    for (const k of (row.files || { fromA: [] }).fromA) { const x = fld.info.get(row.id); if (x && x.added[k]) delete x.added[k]; }
    await pushDownload(row.id, row.toB || !B.work[row.id] ? row.work || null : null);
    students += (row.rows || []).filter(x => x.pick === 'b').length;
  }
  fld.prog = '';
  if (libm.toA) takeLibrary(libm.lib, 'folder');
  const tomb = { ...plan.tomb };
  if (JSON.stringify(tombs()) !== JSON.stringify(tomb)) takeTombs(tomb, 'folder');
  const ls = prefer ? {} : M.mergeLs(carryLs(), B.ls || {}, k => Object.keys(tomb).some(id => k.includes(id)));
  for (const [k, v] of Object.entries(ls)) takeLs(k, v, 'folder');
  await pushLibrary();
  await schSync();
  try { await exSync(); } catch (e) { console.error(e); }
  try { await papersMirror([...fld.info.keys()], true); } catch (e) { console.error(e); }
  try { await vkSync(true); } catch (e) { console.error(e); }
  fld.lib = false; fld.answers = {};
  try { localStorage.removeItem('gsc.win'); } catch {}
  await dailySnapshot();
  fld.at = Date.now();
  set(fld.asks.length ? 'decide' : 'ok');
  // the download open on screen: its window notices the newer work, saves what it has (merged in) and opens again
  if (open && taking.some(r => r.id === open)) { toast(t('saving.f_reopened'), { ms: 6000 }); window.dispatchEvent(new Event('focus')); }
  else if (!hadWork && taking.length && !B.missing.size) toast(t('saving.f_all_back'), { ms: 6000 });
  else if (students) toast(t('saving.f_came', { n: students }), { ms: 6000 });
  const lostIn = plan.rows.filter(r => B.missing.has(r.id) && !(A.meta[r.id] && A.meta[r.id].papers === false)).map(r => r.name);
  if (lostIn.length) toast(t('saving.f_lost', { list: lostIn.join(', ') }), { ms: 15000 });
}

/* linking, and after each save */
export async function boot(h) { fld.picked = h; F.name = h.name; await resume(false); }
export async function use(h) {
  fld.picked = h; F.name = h.name; F.booted = true; set('saving'); fld.info.clear(); fld.seen.clear();
  await folderHandle.put(h, 'dir');
  return resume(false);
}
export async function pick() { await use(await window.showDirectoryPicker({ id: 'gs-folder', mode: 'readwrite' })); return F.state; }
export const snaps = async () => fld.root ? snapList() : [];
export async function unlink() {
  await folderHandle.del('dir').catch(() => {});
  clearTimeout(fld.timer);
  Object.assign(fld, { picked: null, root: null, hold: {}, holdSet: {}, holdLib: {}, asks: [], lib: false }); fld.work.clear(); fld.gone.clear(); fld.info.clear(); fld.seen.clear();
  F.name = ''; set('none');
}
// A save through the layer, or a write taken in from the Drive sync.
export function saved(e) {
  if (e.kind === 'work' && e.id) fld.work.set(e.id, e.data || null);
  else if (e.kind === 'papers' && e.id) { if (e.gone) { fld.gone.add(e.id); fld.work.delete(e.id); } else if (!fld.work.has(e.id)) fld.work.set(e.id, null); }
  else if ((e.kind === 'added' || e.kind === 'edit') && e.id) { if (!fld.work.has(e.id)) fld.work.set(e.id, null); }
  else if ((e.kind === 'library' || e.kind === 'setting' || e.kind === 'pref') && LIB_RX.test(e.id || 'gs.lib')) fld.lib = true;
  else if (e.kind === 'example' || e.kind === 'video') { fld.lib = fld.lib || false; if (fld.root && F.state === 'ok') { (e.kind === 'example' ? exSync() : vkSync(false)).catch(err => console.error(err)); } return; }
  else return;
  kick();
}
// Two versions to choose between: answers { 'id|key': 'a'|'b', '!id': 'gone'|'back' }, then compared again with them.
export function decide(ans) {
  for (const a of fld.asks) { if (a.gone) fld.answers['!' + a.id] = ans['!' + a.id]; else (fld.answers[a.id] ||= {})[a.key] = ans[a.id + '|' + a.key]; }
  return reconcile();
}
export const info = () => ({ state: F.state, name: F.name, root: fld.root ? fld.root.name : '', at: fld.at, why: fld.why, prog: fld.prog, asks: fld.asks });
export async function wait() { for (let n = 0; n < 800; n++) { if (!fld.run && !fld.sync && !fld.work.size && !fld.lib && !fld.gone.size) return F.state; await new Promise(r => setTimeout(r, 25)); } return 'busy'; }
if (typeof window !== 'undefined') window.addEventListener('focus', () => { if (F.state === 'lost') resume(false); });
