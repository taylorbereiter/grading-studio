/* ---------------- the linked folder: every save goes to the browser and to a folder she picked once ---------------- */
// Grading Studio/          (made inside the folder she picks, unless she picked this very folder)
//   gs-folder.json         says what this folder is
//   README.txt             the same, for a person
//   library.json           rosters, units, rubrics, saved comments, settings
//   tombstones.json        forgotten downloads, so they stay forgotten
//   files/<sha256>.dat     papers, late files, readings and Word edits. Bytes are written once, however many downloads share them
//   downloads/<id>/        info.json (which files, and the row for the list) and work.json (marks, scores, comments)
//   snapshots/             dated copies of everything but the bytes, as gzipped JSON, to go back to
// A half-written file can't be the only copy: JSON goes to name.new first and then to name, and the .new is removed last. Whichever parses is whole, and .new is the newer one
// if it's still there. Browsers put a whole file in place only when it's closed, and a bad bytes file is caught by its size and hash when it's read back.
// Any FileSystemDirectoryHandle will do, so tests hand it one from the browser's private file system.
const FOLDER_SUB = 'Grading Studio', FOLDER_RETRY = 20000;
const fld = { picked: null, root: null, name: '', state: 'none', why: '', at: 0, prog: '', work: new Map(), lib: false, gone: new Set(), run: null, sync: null, again: false, booted: false, seen: new Map(), info: new Map(), hold: {}, holdSet: {}, holdLib: {}, asks: [], answers: {}, day: '', timer: null, have: null };

/* who's saving */
function devId() {
  let d = null; try { d = localStorage.getItem('gsc.dev'); } catch {}   // outside gs.*, so no copy of her work carries it to another computer
  if (!d) { d = 'd' + crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 12); try { localStorage.setItem('gsc.dev', d); } catch {} }
  return d;
}
const tombs = () => store.get('gs.tomb', {});
// saveNow calls this with each save, before it's written: what changed gets its stamps.
function stampWork(b, data) {
  for (const st of b.students) for (const f of st.files) if (f.edited) ((data.s[st.key] ||= { f: {}, g: st.grade, h: {} }).e ||= {})[f.path] = f.edited;
  if (b.goneNow) data.gone = b.goneNow;
  const tb = tombs(), seen = tb[b.id] && tb[b.id].v;   // she opened a forgotten download again, on purpose, so it isn't forgotten any more
  if (seen) { delete tb[b.id]; store.set('gs.tomb', tb); }
  b.revs = stampData(b.revs, data, devId(), Date.now(), seen);
}
// A late file or reading taken off, so merging doesn't bring it back.
function noteGone(b, k) { b.goneNow = { ...(b.goneNow || (b.revs || {}).gone || {}), [k]: Date.now() }; }
// A reading replaced under the same name: the folder needs the new bytes.
function noteAdded(b, k) { const i = fld.info.get(b.id); if (i) delete i.added[k]; }
// The tombstone holds everything this copy had seen, plus an entry of its own, so a copy with changes it hadn't seen is told apart from one it had.
async function noteForgotten(id) {
  const tb = tombs(); if (tb[id]) return;
  const w = newestWork(store.get(id, null), await kget('work', id)), m = keptMeta.get(id) || {}, t = Date.now();
  tb[id] = { t, name: m.name || '', v: vJoin(workVec(w), { ['!' + id + ':' + t]: 1 }) };
  store.set('gs.tomb', tb);
  if (fld.state !== 'none') { fld.gone.add(id); fld.work.delete(id); folderKick(); }
}
// Opening a forgotten download again saves it straight away, so the save says so.
function folderPapers(b) { if (tombs()[b.id]) saveSoon(); else if (fld.state !== 'none') { if (!fld.work.has(b.id)) fld.work.set(b.id, null); folderKick(); } }
function folderSaved(b, data) { if (fld.state === 'none') return; fld.work.set(b.id, data); folderKick(); }
let setLibFrom, libNews;   // setLibFrom replaces the whole library, a merge having already stamped it, and says if it fit. libNews: another tab changed it.
{
  const raw = store.set.bind(store), rawDel = store.del.bind(store), LIB_RX = /^gs\.(lib|setup|bank|tomb|carryNo|rubrics|rubricsGone|histSame|rp\..+|rd\..+)$/;
  let prev = libPrev(store.get('gs.lib', null)), libSeen = lsRaw('gs.lib');
  const mark = k => { if (LIB_RX.test(k) && fld.state !== 'none') { fld.lib = true; folderKick(); } };
  const roomy = (k, v) => { let ok = raw(k, v); while (!ok && !k.startsWith('gs.b.') && freeQuick()) ok = raw(k, v); return ok; };   // a roster matters more than a quick copy with its full copy kept
  const refs = () => { if (batch && batch.assignment) { const f = findItem(batch.assignment.id); if (f) batch.assignment = f.it; } };
  store.set = (k, v) => {
    if (!tabLive()) return true;   // another tab has replaced everything, and this tab's copy mustn't come back
    if (k === 'gs.lib') {
      prev = stampLib(v, prev, devId(), Date.now());
      const now = lsRaw('gs.lib');
      if (now && now !== libSeen) {   // another tab saved it since this one last looked: both sets of changes stay
        let other = null; try { other = JSON.parse(now); } catch {}
        if (other) {
          const m = mergeLib(v, other, { dev: devId(), now: Date.now() });
          v = lib = migrateLib(m.lib); prev = libPrev(v); refs();
          if (batch && m.mapA[batch.classId]) batch.classId = m.mapA[batch.classId];
        }
      }
    }
    const ok = roomy(k, v);
    if (ok) { if (k === 'gs.lib') libSeen = lsRaw('gs.lib'); mark(k); }
    return ok;
  };
  store.del = k => { if (!tabLive()) return; rawDel(k); mark(k); };
  setLibFrom = l => { prev = libPrev(l); const ok = roomy('gs.lib', l); if (ok) libSeen = lsRaw('gs.lib'); return ok; };
  // A box she has open may be holding parts of the library to change, so with one open it waits, and her save merges instead.
  libNews = () => {
    const now = lsRaw('gs.lib');
    if (!now || now === libSeen || !$('#dlg').hidden || (shellReady && classPanelBusy())) return;
    let other = null; try { other = JSON.parse(now); } catch {}
    if (!other) return;
    lib = migrateLib(other); prev = libPrev(lib); libSeen = now; refs();
    if (batch) renderTopAtlas(); else renderLib();
  };
}
const browserFull = () => Object.assign(new DOMException('The small store is full', 'QuotaExceededError'), { small: true });
// What travels with her work. Quick copies travel as work, and the rest belongs to this browser.
const LS_LOCAL = /^gs\.(b\..+|batches|syncT|dataV|lastBackup|gcid|gEmail|tomb|refOpen\..*)$/;
function carryLs() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.') && !LS_LOCAL.test(k)) o[k] = localStorage.getItem(k); }
  return o;
}

/* reading the browser, one record at a time */
// Each record in its own short transaction, so a year of papers is never in memory at once and the tab can breathe between them.
async function eachRec(open, name, fn) {
  const db = await open();
  let last, first = true;
  for (;;) {
    const got = await new Promise((res, rej) => {
      const q = db.transaction(name).objectStore(name).openCursor(first ? undefined : IDBKeyRange.lowerBound(last, true));
      q.onsuccess = () => res(q.result ? { k: q.result.key, v: q.result.value } : null); q.onerror = () => rej(q.error);
    });
    if (!got) return;
    last = got.k; first = false;
    await fn(got.k, got.v);
  }
}
// Everything about the browser's copy except the bytes.
async function localState() {
  const A = { work: {}, meta: {}, tomb: tombs(), added: {}, edits: {} };
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.b.')) { const d = store.get(k, null); if (d) A.work[k] = d; } }
  await eachRec(keepDb, 'work', (k, v) => { A.work[k] = newestWork(A.work[k], v); });
  await eachRec(keepDb, 'meta', (k, v) => { A.meta[k] = v; });
  await eachRec(keepDb, 'edits', (k, v) => { const i = k.indexOf('|'); (A.edits[k.slice(0, i)] ||= {})[k.slice(i + 1)] = v.t || 1; });
  for (const k of (await idbDo('readonly', o => o.getAllKeys())) || []) { const i = k.indexOf('|'); (A.added[k.slice(0, i)] ||= {})[k.slice(i + 1)] = 0; }
  return A;
}
// A late file's own date matters only when the other copy says it was taken off, or has one with the same name, which may be a newer one.
async function addedDates(A, B) {
  for (const [id, have] of Object.entries(A.added)) {
    const gone = (B.work[id] && B.work[id].gone) || {}, there = (B.added && B.added[id]) || {};
    for (const k of Object.keys(have)) if (k in gone || k in there) { const r = await idbDo('readonly', o => o.get(id + '|' + k)); have[k] = (r && r.added) || 0; }
  }
}
// Puts one download's row of a merge into the browser. src gives the bytes: papers(id), added(id, k), edit(id, path).
async function applyRow(row, src) {
  const { id } = row;
  if (row.kind === 'gone') { if (row.onA) { const tb = tombs(); tb[id] ||= { t: row.t, name: row.name, v: {} }; store.set('gs.tomb', tb); await forgetKept(id); } return; }
  if (row.kind === 'askGone' || row.kind === 'onlyA' && !row.toA) return;
  let m = row.meta;
  if (!(row.ma && row.ma.papers)) {
    const rec = await src.papers(id);
    if (rec) { await paperPut(id, rec); m = { ...m, papers: true, size: rec.entries.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) }; }
    else if (row.meta) m = { ...m, papers: false };
  }
  for (const k of row.files.fromB) { const rec = await src.added(id, k); if (rec) await idbDo('readwrite', o => o.put(rec, id + '|' + k)); }
  for (const k of row.files.dropA) await idbDo('readwrite', o => o.delete(id + '|' + k));
  for (const p of row.edits.fromB) { const rec = await src.edit(id, p); if (rec) await kdo('edits', 'readwrite', o => o.put(rec, id + '|' + p)); }
  for (const p of row.edits.dropA) await kdo('edits', 'readwrite', o => o.delete(id + '|' + p));
  if (row.work && row.toA) {
    await kdo('work', 'readwrite', o => o.put(row.work, id));
    { const v = tabStamp(id, row.work.t); if (batch && batch.id === id) batch.seen = v; }   // other tabs are told, and this one knows it was itself
    store.del(id); const idx = store.get('gs.batches', {}); if (id in idx) { delete idx[id]; store.set('gs.batches', idx); }   // the quick copy is out of date now
  }
  if (m && JSON.stringify(m) !== JSON.stringify(row.ma)) { await kdo('meta', 'readwrite', o => o.put(m, id)); keptMeta.set(id, m); }
}

/* the folder itself */
const dlDirName = id => encodeURIComponent(id);
async function writeBytes(dir, name, data) {
  try {
    const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable();
    try { await w.write(data); await w.close(); } catch (e) { try { await w.abort(); } catch {} throw e; }
    return fh;
  } catch (e) { if (e) e.onFolder = true; throw e; }   // so running out of room here is told apart from the browser running out
}
async function writeJson(dir, name, obj) {
  const t = JSON.stringify(obj);
  await writeBytes(dir, name + '.new', t);
  const fh = await writeBytes(dir, name, t);
  await dir.removeEntry(name + '.new').catch(() => {});
  return fh;
}
async function readJson(dir, name) {
  for (const n of [name + '.new', name]) {
    let t;
    try { t = await (await (await dir.getFileHandle(n)).getFile()).text(); }
    catch (e) { if (e.name === 'NotFoundError') continue; throw e; }
    let o; try { o = JSON.parse(t); } catch { continue; }   // cut short: the other one is whole
    if (n !== name) await writeJson(dir, name, o);   // a .new still here means that write never finished, so finish it
    return o;
  }
  return null;
}
const hexOf = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const shaOf = async bytes => hexOf(await crypto.subtle.digest('SHA-256', bytes));
async function putBlob(bytes) {
  const dir = await fld.root.getDirectoryHandle('files', { create: true }), hash = await shaOf(bytes), name = hash + '.dat';
  if (fld.have) fld.have.add(name);
  try { if ((await (await dir.getFileHandle(name)).getFile()).size === bytes.length) return { hash, size: bytes.length }; }
  catch (e) { if (e.name !== 'NotFoundError') throw e; }
  await writeBytes(dir, name, bytes);
  return { hash, size: bytes.length };
}
async function getBlob(ref) {
  const dir = await fld.root.getDirectoryHandle('files'), bytes = new Uint8Array(await (await (await dir.getFileHandle(ref.hash + '.dat')).getFile()).arrayBuffer());
  if (bytes.length !== ref.size || await shaOf(bytes) !== ref.hash) throw Object.assign(new Error('A file in your folder is damaged: ' + ref.hash), { damaged: true });
  return bytes;
}
async function dlDir(id, make) { return (await fld.root.getDirectoryHandle('downloads', { create: !!make })).getDirectoryHandle(dlDirName(id), { create: !!make }); }
async function dlInfo(id, dir) { return fld.info.get(id) || await readJson(dir, 'info.json') || { id, papers: null, added: {}, edits: {} }; }
// A late file or Word edit from the browser: its bytes go in the folder, and this is what names them there.
async function addedRef(id, k) { const r = await idbDo('readonly', o => o.get(id + '|' + k)); if (!r) return null; const { data, ...x } = r; return { ...x, ...await putBlob(data) }; }
async function editRef(id, p) { const r = await kget('edits', id + '|' + p); return r ? { t: r.t || 1, data: await putBlob(r.data), orig: r.orig ? await putBlob(r.orig) : null } : null; }
// Brings the folder up to date with the browser for one download. data is the work to write, or null to leave it.
// Only ever after a merge has reached the browser: what the browser hasn't got goes from the folder's lists. During a sync, bytes the folder has lost are written again.
// A student she hasn't decided about stays as the folder has them, Word edits too: merging brings those over once she has.
async function pushDownload(id, data) {
  const dir = await dlDir(id, true), info = await dlInfo(id, dir), before = JSON.stringify(info), held = fld.hold[id], isHeld = p => !!held && editKey(p) in held;
  const there = r => !fld.have || !r || !r.hash || fld.have.has(r.hash + '.dat');
  if (!info.papers || !info.papers.every(there)) {
    const rec = await kget('papers', id);
    if (rec && rec.entries) {
      const list = [];
      for (let i = 0; i < rec.entries.length; i++) { const data = await keptBytes(id, i, rec.entries[i]); list.push({ path: rec.entries[i].path, ...(data ? await putBlob(data) : {}) }); }
      info.papers = list; info.label = rec.label || '';
    }
  }
  const range = IDBKeyRange.bound(id + '|', id + '|￿');
  const ak = new Set(((await idbDo('readonly', o => o.getAllKeys(range))) || []).map(k => k.slice(id.length + 1)));
  for (const k of Object.keys(info.added)) if (!ak.has(k) || !there(info.added[k])) delete info.added[k];
  for (const k of ak) if (!info.added[k]) { const r = await addedRef(id, k); if (r) info.added[k] = r; }
  const ek = new Set(((await kdo('edits', 'readonly', o => o.getAllKeys(range))) || []).map(k => k.slice(id.length + 1)));
  for (const p of Object.keys(info.edits)) if (!isHeld(p) && (!ek.has(p) || !there(info.edits[p].data) || !there(info.edits[p].orig))) delete info.edits[p];
  for (const p of ek) {
    if (isHeld(p)) continue;
    const known = data && Object.values(data.s || {}).map(r => r.e && r.e[p]).find(Boolean);
    if (info.edits[p] && (!known || known === info.edits[p].t)) continue;
    const r = await editRef(id, p); if (r) info.edits[p] = r;
  }
  const m = keptMeta.get(id) || await kget('meta', id); if (m) info.meta = m;
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
// Has someone else (another browser, say) written this download since this tab last did?
async function foreignWrite(id) {
  if (!fld.seen.has(id)) return false;
  try { return (await (await (await dlDir(id)).getFileHandle('work.json')).getFile()).lastModified !== fld.seen.get(id); }
  catch (e) { if (e.name === 'NotFoundError') return false; throw e; }
}
async function pushLibrary() {
  const ls = carryLs();
  if (ls['gs.lib'] && Object.keys(fld.holdLib).length) ls['gs.lib'] = libHold(ls['gs.lib'], fld.holdLib);   // a card's rubric she hasn't decided about stays as the folder has it too
  await writeJson(fld.root, 'library.json', { t: Date.now(), ls });
  await writeJson(fld.root, 'tombstones.json', tombs());
}
// All of what's in the folder, except the bytes.
async function folderState() {
  const B = { work: {}, meta: {}, tomb: await readJson(fld.root, 'tombstones.json') || {}, added: {}, edits: {}, info: {}, ls: null, lib: null, have: new Set(), missing: new Set() };
  fld.info.clear(); fld.seen.clear();   // the folder may have changed or gone away and come back, so nothing remembered about it counts
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
// The bytes of what's in the folder. One that's missing or damaged is noted in B.missing and the rest carry on. A download short of a paper comes without its papers, so its row says to drop it in again.
const folderSource = B => {
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
async function snapList() {
  const dir = await fld.root.getDirectoryHandle('snapshots', { create: true }), out = [];
  for await (const [name, h] of dir.entries()) {
    const m = h.kind === 'file' && snapRx.exec(name);
    if (m) out.push({ name, t: new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime(), why: m[6] });
  }
  return out.sort((a, b) => b.t - a.t);
}
const gzRead = async (dir, name) => JSON.parse(await new Response((await (await dir.getFileHandle(name)).getFile()).stream().pipeThrough(new DecompressionStream('gzip'))).text());
async function gzWrite(dir, name, obj) {
  const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable();
  await new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip')).pipeTo(w);
}
// why: 'daily', or what it was made before. Everything in the browser but the bytes, which are in files/ for as long as a snapshot names them.
// The folder's own lists aren't touched: it may hold files the browser is about to bring in.
async function folderSnapshot(why) {
  const d = new Date(), A = await localState(), ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.') && !k.startsWith('gs.b.')) ls[k] = localStorage.getItem(k); }
  const added = {}, edits = {};
  for (const id of Object.keys(A.meta)) {
    added[id] = {}; edits[id] = {};
    for (const k of Object.keys(A.added[id] || {})) { const r = await addedRef(id, k); if (r) added[id][k] = r; }
    for (const p of Object.keys(A.edits[id] || {})) { const r = await editRef(id, p); if (r) edits[id][p] = r; }
  }
  const dir = await fld.root.getDirectoryHandle('snapshots', { create: true }), have = await snapList();
  const base = ymd(d) + ' ' + pad2(d.getHours()) + pad2(d.getMinutes()), nm = n => base + (n ? '-' + n : '') + ' ' + why.replace(/[\\/:*?"<>|]+/g, '-') + '.gsnap';
  let n = 0; while (have.some(s => s.name === nm(n))) n++;
  await gzWrite(dir, nm(n), { t: d.getTime(), why, ls, work: A.work, meta: A.meta, added, edits });
  const keep = snapKeep(await snapList(), Date.now());
  for (const s of await snapList()) if (!keep.has(s.name)) await dir.removeEntry(s.name).catch(() => {});
}
async function dailySnapshot() {
  const today = ymd(new Date());
  if (fld.day === today) return;
  fld.day = today;
  if (!(await snapList()).some(s => s.why === 'daily' && ymd(new Date(s.t)) === today)) await folderSnapshot('daily');
}
// Going back to a snapshot. Its work goes in place of the browser's, a safety copy having been made first, and the next sync makes the folder match.
async function folderGoBack(name) {
  await gsData.snapshot('Before going back to a snapshot from your folder', gsData.version());
  await folderSnapshot('Before going back');
  const s = await gzRead(await fld.root.getDirectoryHandle('snapshots'), name), rec = { ls: s.ls, stores: {} };
  const put = (where, k, v) => { const o = rec.stores[where] ||= { k: [], v: [] }; o.k.push(k); o.v.push(v); };
  for (const [id, w] of Object.entries(s.work || {})) put('grading-studio-keep/work', id, w);
  for (const [id, m] of Object.entries(s.meta || {})) put('grading-studio-keep/meta', id, m);
  for (const [id, list] of Object.entries(s.edits || {})) for (const [p, r] of Object.entries(list)) put('grading-studio-keep/edits', id + '|' + p, { t: r.t, data: await getBlob(r.data), orig: r.orig ? await getBlob(r.orig) : null });
  for (const [id, list] of Object.entries(s.added || {})) for (const [k, r] of Object.entries(list)) { const { hash, size, ...x } = r; put('grading-studio-added/files', id + '|' + k, { ...x, data: await getBlob({ hash, size }) }); }
  batch = null;
  await gsData.putBackData(rec);
  carryAfterPutBack();
}
// She went back on purpose, so the next sync takes the browser's side of everything.
function carryAfterPutBack() { if (fld.state !== 'none') try { localStorage.setItem('gsc.win', '1'); } catch {} }
// Forget means gone: out of the folder, out of its snapshots, and its bytes go unless something else still uses them.
async function folderRemove(id) {
  const dls = await fld.root.getDirectoryHandle('downloads', { create: true });
  await dls.removeEntry(dlDirName(id), { recursive: true }).catch(e => { if (e.name !== 'NotFoundError') throw e; });
  fld.info.delete(id); fld.seen.delete(id); delete fld.hold[id]; delete fld.holdSet[id];
  const used = new Set(), mark = r => { if (r && r.hash) used.add(r.hash); }, markAll = (added, edits) => { for (const r of Object.values(added || {})) mark(r); for (const r of Object.values(edits || {})) { mark(r.data); mark(r.orig); } };
  for await (const [, h] of dls.entries()) {
    if (h.kind !== 'directory') continue;
    const i = await readJson(h, 'info.json'); if (!i) continue;
    (i.papers || []).forEach(mark); markAll(i.added, i.edits);
  }
  const dir = await fld.root.getDirectoryHandle('snapshots', { create: true });
  for (const { name } of await snapList()) {
    let s; try { s = await gzRead(dir, name); } catch { continue; }
    if (s.work && s.work[id] || s.meta && s.meta[id] || s.added && s.added[id] || s.edits && s.edits[id] || Object.keys(s.ls || {}).some(k => k.includes(id))) {
      for (const part of [s.work, s.meta, s.added, s.edits]) if (part) delete part[id];
      for (const k of Object.keys(s.ls || {})) if (k.includes(id)) delete s.ls[k];
      await gzWrite(dir, name, s);
    }
    for (const x of Object.keys(s.added || {})) markAll(s.added[x], s.edits && s.edits[x]);
  }
  const files = await fld.root.getDirectoryHandle('files', { create: true }), drop = [];
  for await (const [n] of files.entries()) if (!used.has(n.replace(/\.dat$/, ''))) drop.push(n);
  for (const n of drop) await files.removeEntry(n).catch(() => {});
}

/* the write queue */
function folderKick() {
  if (!tabLive()) return;
  if (fld.state === 'none' || fld.state === 'ask' || fld.state === 'lost' || fld.run || fld.sync) return;
  if (!fld.work.size && !fld.lib && !fld.gone.size) return;
  fld.run = folderRun().finally(() => { fld.run = null; folderKick(); });
}
async function folderRun() {
  setWhere('saving');
  try {
    for (const id of [...fld.gone]) { await folderRemove(id); fld.gone.delete(id); fld.lib = true; }
    for (const [id, data] of [...fld.work]) {
      if (fld.work.get(id) === data) fld.work.delete(id);
      if (await foreignWrite(id)) { fld.run = null; folderReconcile(); return; }   // with data or without: pushing would take off what only the folder has
      try { await pushDownload(id, data); }
      catch (e) { if (!fld.work.has(id)) fld.work.set(id, data); throw e; }
    }
    if (fld.lib) { fld.lib = false; try { await pushLibrary(); } catch (e) { fld.lib = true; throw e; } }
    await dailySnapshot();
    fld.at = Date.now(); setWhere(fld.asks.length ? 'decide' : 'ok');
  } catch (e) { await folderTrouble(e); }
}
async function folderTrouble(e) {
  console.error(e);
  let p = 'granted'; try { p = await fld.picked.queryPermission({ mode: 'readwrite' }); } catch {}
  fld.why = e && e.name === 'QuotaExceededError' ? (e.onFolder ? 'full' : 'room') : '';
  setWhere(p === 'granted' ? 'lost' : 'ask');
  clearTimeout(fld.timer);
  if (p === 'granted') fld.timer = setTimeout(() => folderResume(false), FOLDER_RETRY);
}
// Back to working: no folder change is taken on trust, so everything is compared again.
async function folderResume(ask) {
  clearTimeout(fld.timer);
  if (!fld.picked) return;
  let p = 'lost';
  try { p = await fld.picked.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask) p = await fld.picked.requestPermission({ mode: 'readwrite' }); }
  catch (e) { console.error(e); }
  if (p !== 'granted') { setWhere(p === 'lost' ? 'lost' : 'ask'); return false; }
  fld.day = '';   // the folder may be a new one by now, with no snapshot from today
  try { fld.root = await folderRoot(fld.picked); await folderReconcile(); return true; }
  catch (e) { await folderTrouble(e); return false; }
}
async function folderRoot(picked) {
  const has = async d => { try { await d.getFileHandle('gs-folder.json'); return true; } catch (e) { if (e.name === 'NotFoundError' || e.name === 'TypeMismatchError') return false; throw e; } };
  if (await has(picked) || picked.name === FOLDER_SUB) return picked;
  return picked.getDirectoryHandle(FOLDER_SUB, { create: true });
}
const FOLDER_README = `This folder is where Grading Studio keeps a copy of your grading work: the papers, marks, scores, comments, rosters and rubrics.

It's saved here by itself every time you work, so there's nothing to do. Please leave these files as they are. They hold student work, so keep the folder private.

files/ holds the papers and other files, under coded names. downloads/ holds your work on each download. snapshots/ holds dated copies you can go back to.
If this browser is ever cleared, open Grading Studio, link this folder again, and everything comes back.
`;
// The browser and the folder compared, per student, and each brought up to date with the other.
function folderReconcile() {
  if (fld.sync) { fld.again = true; return fld.sync; }
  fld.sync = reconcileNow().catch(folderTrouble).finally(() => {
    fld.sync = null; fld.have = null;
    if (fld.again) { fld.again = false; folderReconcile(); } else folderKick();
  });
  return fld.sync;
}
async function reconcileNow() {
  setWhere('saving');
  if (batch) await saveNow();
  for (const id of [...fld.work.keys()]) if (!saveBad.has(id)) fld.work.delete(id);   // all in the browser now, so what's below covers it; what's queued could only undo a merge
  const root = fld.root;
  if (!await readJson(root, 'gs-folder.json')) {
    await writeJson(root, 'gs-folder.json', { app: 'Grading Studio', v: 1, made: Date.now() });
    await writeBytes(root, 'README.txt', FOLDER_README);
  }
  const A = await localState(), B = await folderState(), dev = devId(), now = Date.now();
  await addedDates(A, B);
  let prefer; try { if (localStorage.getItem('gsc.win')) prefer = 'a'; } catch {}
  const libm = mergeLib(lib, B.lib, { prefer, dev, now, answers: fld.answers });
  for (const w of Object.values(A.work)) if (libm.mapA[w.cls]) w.cls = libm.mapA[w.cls];
  for (const w of Object.values(B.work)) if (libm.mapB[w.cls]) w.cls = libm.mapB[w.cls];
  const plan = mergeStates(A, B, { answers: fld.answers, prefer, dev, now, linked: libLinked(libm.lib, libm.cards) });
  libFollow(libm, plan.rows, dev, now);
  const open = batch && batch.id, taking = plan.rows.filter(r => r.kind === 'new' || r.kind === 'gone' && r.onA || r.kind === 'merge' && (r.extra || r.setIn.length || r.rows.some(x => x.pick === 'b')));
  const hadWork = Object.keys(A.work).length > 0;
  if ((taking.length || libm.notes.length) && hadWork) {   // to undo a merge that went wrong
    await gsData.snapshot('Before bringing in work from your folder', gsData.version());
    await folderSnapshot('Before bringing in work');
  }
  const src = folderSource(B), n = plan.rows.length;
  let i = 0, students = 0;
  fld.hold = {}; fld.holdSet = {}; fld.holdLib = {}; fld.asks = [...plan.asks, ...libm.asks];
  for (const a of plan.asks) { if (a.part) (fld.holdSet[a.id] ||= {})[a.part] = { val: a.b, v: a.vb }; else if (!a.gone) (fld.hold[a.id] ||= {})[a.key] = a.b; }
  for (const a of libm.asks) { fld.holdLib[a.id] = a.there; const w = B.work[a.batchId]; if (w) (fld.holdSet[a.batchId] ||= {}).setup = { val: w.setup, v: w.pv && w.pv.setup }; }
  for (const row of plan.rows) {
    fld.prog = n > 3 ? ++i + ' of ' + n : ''; renderWhere();
    if (row.kind === 'gone') { await applyRow(row, src); await folderRemove(row.id); continue; }
    if (row.kind === 'askGone') continue;
    await applyRow(row, src);
    for (const k of (row.files || { fromA: [] }).fromA) { const i = fld.info.get(row.id); if (i && i.added[k]) delete i.added[k]; }   // replaced here under the same name: the folder needs the new bytes
    await pushDownload(row.id, row.toB || !B.work[row.id] ? row.work || null : null);
    students += (row.rows || []).filter(x => x.pick === 'b').length;
  }
  fld.prog = '';
  if (libm.toA) { lib = migrateLib(libm.lib); if (!setLibFrom(lib)) throw browserFull(); if (batch && batch.assignment) { const f = findItem(batch.assignment.id); if (f) batch.assignment = f.it; } }
  const tomb = { ...plan.tomb }; store.set('gs.tomb', tomb);
  const set = prefer ? {} : mergeLs(carryLs(), B.ls || {}, k => Object.keys(tomb).some(id => k.includes(id)));   // going back: the folder takes what's here, and nothing newer comes back
  for (const [k, v] of Object.entries(set)) lsPut(k, v);
  await pushLibrary();
  fld.lib = false; fld.answers = {};
  try { localStorage.removeItem('gsc.win'); } catch {}
  await dailySnapshot();
  fld.at = Date.now(); fld.state = 'ok';
  setWhere(fld.asks.length ? 'decide' : 'ok');
  if (taking.length || libm.toA) { bank = store.get('gs.bank', bank); if (!batch) { const su = store.get('gs.setup', null); if (su) setup = { ...DEFAULT_SETUP, ...su }; } await loadKept(); }
  if (open && taking.some(r => r.id === open)) { toast('Newer work from your folder came in, so this download has been reopened.', 6000); const was = batch; await reopenKept(open, batch.assignment); if (batch === was) { closeDownload(); toast('Newer work came in from your folder, and this download is waiting for your answer. Open it when you’re ready.', 8000); } }   // not opened again (Not now): the copy on screen is out of date, and saving it would write over what just came in
  else if (!hadWork && taking.length && !B.missing.size) toast('Everything came back from your folder.', 6000);
  else if (students) toast('Newer work from your folder came in for ' + students + (students === 1 ? ' student.' : ' students.'), 6000);
  // A download already here with no papers has been told, and says so on its row.
  const lostIn = plan.rows.filter(r => B.missing.has(r.id) && !(A.meta[r.id] && A.meta[r.id].papers === false)).map(r => r.name);
  if (lostIn.length) sayDlg('Some files your folder lists aren’t in it any more, or are damaged, so they couldn’t come back. This affects: ' + lostIn.join(', ') + '.\n\nYour marks, scores and comments are all here. To get papers back, drop the same download in again. A late file or reading needs adding again.');
  if (fld.asks.length && $('#dlg').hidden) openFolderAsks();
}
function openFolderAsks() {
  showConflicts(fld.asks, { title: 'Two versions to choose between', intro: 'These aren’t the same in this browser and in your folder, so nothing was chosen for you. Until you decide, each place keeps its own.', other: 'In your folder', cancel: 'Decide later' }).then(ans => {
    if (!ans) return;
    for (const a of fld.asks) {
      if (a.gone) fld.answers['!' + a.id] = ans['!' + a.id];
      else (fld.answers[a.id] ||= {})[a.key] = ans[a.id + '|' + a.key];
    }
    folderReconcile();
  });
}

/* linking */
const folderKv = () => new Promise((res, rej) => { const r = indexedDB.open('grading-studio-folder', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function kvDo(mode, fn) { const db = await folderKv(); try { return await new Promise((res, rej) => { const tx = db.transaction('kv', mode), q = fn(tx.objectStore('kv')); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); }); } finally { db.close(); } }
async function folderUse(h) {
  fld.booted = true; fld.picked = h; fld.name = h.name; fld.state = 'saving'; fld.info.clear(); fld.seen.clear();
  await kvDo('readwrite', o => o.put(h, 'dir'));
  return folderResume(false);
}
async function folderPick() {
  if (!canPickFolder()) return sayDlg('Saving to a folder needs Chrome or Edge on a computer. Your work is still kept in this browser.');
  let h;
  try { h = await window.showDirectoryPicker({ id: 'gs-work', mode: 'readwrite', startIn: 'documents' }); }
  catch (e) { if (e && e.name !== 'AbortError') { console.error(e); toast('That folder couldn’t be used. Try another one.'); } return; }
  await folderUse(h);
  if (fld.state === 'ok' || fld.state === 'decide') toast('Done. Your work now saves to “' + fld.name + '” as well.', 6000);
}
async function folderUnlink() {
  await kvDo('readwrite', o => o.delete('dir')).catch(() => {});
  clearTimeout(fld.timer);
  Object.assign(fld, { picked: null, root: null, name: '', state: 'none', hold: {}, holdSet: {}, holdLib: {}, asks: [], lib: false }); fld.work.clear(); fld.gone.clear(); fld.info.clear(); fld.seen.clear();
  renderWhere();
}
async function folderBoot() {
  let h = null;
  try { h = await kvDo('readonly', o => o.get('dir')); } catch (e) { console.error(e); }
  fld.booted = true;   // from here on, no folder means none was chosen, and the app says so
  if (!h) return renderWhere();
  fld.picked = h; fld.name = h.name; fld.state = 'ask';
  await folderResume(false);
}

/* saying where her work is */
function setWhere(s) { fld.state = s; renderWhere(); }
const canPickFolder = () => 'showDirectoryPicker' in window;
function whereSay() {
  const nm = '“' + fld.name + '”', sh = fld.name.length > 24 ? '“' + fld.name.slice(0, 22) + '…”' : nm;   // the top bar has room for only so much, and what to do has to fit
  switch (fld.state) {
    case 'ok': return { safe: true, text: 'In this browser and your ' + nm + ' folder', tip: 'Every save goes to both' + (fld.at ? '. Last saved to the folder at ' + new Date(fld.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''), cls: '' };
    case 'saving': return { safe: true, text: 'Saving to your ' + nm + ' folder' + (fld.prog ? ' (' + fld.prog + ')' : '') + '…', tip: 'Your work is already in this browser', cls: '' };
    case 'ask': return { sub: sh + ' needs a click to reconnect', text: 'Only in this browser. ' + sh + ' needs a click to reconnect', tip: 'Chrome needs your OK to use the folder again. Choose “Allow on every visit” and it won’t ask next time.', cls: 'warn', act: 'Reconnect' };
    case 'lost': return { text: 'Only in this browser. ' + (fld.why === 'full' ? 'The disk with ' + nm + ' is full' : fld.why === 'room' ? 'This browser is out of room, so ' + nm + ' can’t catch up' : 'Can’t reach ' + nm), tip: 'It’ll catch up by itself as soon as the folder is back.', cls: 'warn' };
    case 'decide': return { safe: true, text: fld.asks.length + (fld.asks.length === 1 ? ' thing' : ' things') + ' to decide about your folder', tip: 'Two versions to choose between', cls: 'warn', act: 'Decide' };
    // Until a folder holds a second copy the work is not backed up, and every place that says where it is says so, in amber. Never "Saved" in green.
    default: return !fld.booted ? { safe: true, text: 'Checking where your work is kept…', tip: 'One moment', cls: '' }
      : { sub: 'Only in this browser', text: 'Not backed up. Only in this browser', tip: canPickFolder() ? 'Clearing this browser’s data would erase your work. Choose a folder and every save goes there too' : 'Clearing this browser’s data would erase your work. This browser can’t save to a folder, so make a take-home file when you finish marking', cls: 'warn' };
  }
}
function renderWhere() {
  const s = whereSay(), top = $('#saveWhere'), line = $('#whereLine'), first = $('#whereTop');
  if (first) {   // what needs her click goes at the top of the start screen too: Saving and carrying is far down, below all her classes
    const h = s.act ? '<span class="wtext' + (s.cls ? ' ' + s.cls : '') + '">' + esc(s.text) + '.</span> <button class="btn sm primary" data-wact>' + s.act + '</button>' : '';
    if (first.dataset.h !== h) { first.dataset.h = h; first.innerHTML = h; first.hidden = !h; }
  }
  if (top) { const cut = /^Not backed up\. /.exec(s.text); top.textContent = cut ? 'Not backed up' : s.text; if (cut) { const more = document.createElement('span'); more.className = 'sw-more'; more.textContent = s.text.slice(13); top.append(more); } top.title = s.tip; top.className = 'savewhere link' + (s.cls ? ' ' + s.cls : ''); }
  if (line) {
    const h = '<span class="wtext' + (s.cls ? ' ' + s.cls : '') + '">' + (fld.state === 'none' && fld.booted ? 'Your work is saved only in this browser, and is not backed up' : 'Your work is saved: ' + esc(s.text.charAt(0).toLowerCase() + s.text.slice(1))) + '.</span> ' +
      (s.act ? '<button class="btn sm primary" data-wact>' + s.act + '</button> ' : '') +
      (fld.state === 'none' ? (canPickFolder() ? '<button class="btn sm primary" data-wlink>Choose a folder…</button>' : '') : '<button class="btn sm" data-wopen>Folder…</button>') +
      (fld.state !== 'none' && fld.root ? ' <a class="btn sm" href="#/settings/history">Go back in time…</a>' : '');
    if (line.dataset.h !== h) { line.dataset.h = h; line.innerHTML = h; }   // a button shouldn't vanish under her click just because a save went by
  }
  railSavedRender(); renderNeeds(); safeAskRender();
}
function whereAct() { if (fld.state === 'decide') openFolderAsks(); else folderResume(true); }
document.addEventListener('click', e => {
  const t = e.target.closest('#saveWhere,[data-wact],[data-wlink],[data-wopen]'); if (!t) return;
  if (t.matches('[data-wlink]')) return folderPick();
  if (t.matches('[data-wact]')) return whereAct();
  if (t.id === 'saveWhere' && (fld.state === 'ask' || fld.state === 'decide')) return whereAct();
  openWhere();
});
window.addEventListener('focus', () => { if (fld.state === 'lost') folderResume(false); });
// The folder box: what's linked, and the dated snapshots to go back to.
async function openWhere() {
  const s = whereSay(), linked = fld.state !== 'none';
  openDlg('<div class="bh"><h2>Where your work is saved</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="whereBox"><p style="margin-top:0">' + esc(s.text) + '. ' + esc(s.tip) + '.</p>' +
    (linked ? '<p class="muted" style="font-size:14px">A copy of your papers, marks, scores, comments, rosters and rubrics is kept here, with no save button to remember' + (fld.root && fld.root.name !== fld.name ? ', in a folder called “' + esc(fld.root.name) + '” inside “' + esc(fld.name) + '”' : '') + '. If this browser is ever cleared, link the folder again and everything comes back.</p>'
      : '<p class="muted" style="font-size:14px">Choose a folder on this computer once, and every save goes there as well as to this browser, with a copy of each day to go back to. Choose something private: it holds student work. When Chrome asks, choose “Allow on every visit”. If you already have a Grading Studio folder, choose it and your work comes back.</p>') +
    '<p><button class="btn sm primary" data-wlink>' + (linked ? 'Use a different folder…' : 'Choose a folder…') + '</button>' + (linked ? ' <button class="btn sm" data-wstop>Stop using this folder</button>' : '') + '</p>' +
    (linked && fld.root ? '<p class="muted" style="font-size:14px;margin-bottom:0">The folder also keeps a copy of each day. <a class="link" href="#/settings/history" data-close>Go back in time…</a></p>' : '') +
    '</div><div class="bf"><button class="btn primary" data-close>Done</button></div>', true);
  const box = $('#dlgBox');
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-wlink]')) { closeDlg(); return; }
    if (e.target.closest('[data-wstop]')) {
      if (await askDlg('Stop saving to “' + fld.name + '”?\n\nWhat’s already in the folder stays there. Nothing in it is deleted. Your work carries on in this browser, with no second copy.', { ok: 'Stop using it', danger: true })) { await folderUnlink(); closeDlg(); toast('Not saving to a folder any more. The folder’s files are still there.'); }
    }
  };
}
// Everything goes back to a dated copy in the folder: asked first, since it replaces rosters and settings too, and how things are now is kept so it can be undone.
async function folderGoBackAsk(name, when) {
  if (!await askDlg('Go back to this copy from ' + when + '?\n\nYour marks, scores, comments, late files, readings, rosters and settings go back to how they were then, in this browser and in the folder. Papers stay. A copy of how things are now is made first, so this can be undone.', { ok: 'Go back' })) return;
  try { await tabsFinish(); tabsOver('go'); await folderGoBack(name); tabsOver('done'); toast('Done. Reloading…'); setTimeout(reloadHome, 700); }
  catch (er) { console.error(er); tabsOver('done'); toast('That didn’t finish. Your work may be partly back: use Put back on the newest safety copy under “Saving and carrying”.', 15000); }
}
folderBoot();
Object.assign(window.__gs, { folderUse, folderUnlink, folderResume, folderReconcile, folderState: () => ({ state: fld.state, name: fld.name, at: fld.at, asks: fld.asks, root: fld.root, picked: fld.picked }), folderWait: async () => { for (let i = 0; i < 400; i++) { if (!fld.run && !fld.sync && !fld.work.size && !fld.lib && !fld.gone.size) return fld.state; await new Promise(r => setTimeout(r, 25)); } return 'busy'; }, folderSnapshot, snapList, folderGoBack, carryParts: { mergeWork, mergeStates, mergeLib, recHash, stampData, revsOf } });
