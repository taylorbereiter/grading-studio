/* ---------------- late or forgotten files: added to a student's submission, kept in this browser ---------------- */
// The download itself never changes. Added files live in IndexedDB under this download's id, so they come back
// when the same download is opened again, and they export with the student's other files.
let addDbP = null;
const addDb = () => addDbP ||= new Promise((res, rej) => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
/* ---------------- keeping every download: papers and work in this browser's IndexedDB ---------------- */
// papers: the files as opened (so a download reopens in one click), work: a full copy of marks and scores,
// meta: a small summary per download for the list. All of it stays on this computer.
let keepDbP = null, keepOk = false;
const keepDb = () => keepDbP ||= new Promise((res, rej) => {
  const r = indexedDB.open('grading-studio-keep', 2);
  r.onupgradeneeded = () => { for (const n of ['papers', 'work', 'meta', 'edits']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function kdo(name, mode, fn) {
  const db = await keepDb();
  return new Promise((res, rej) => { const tx = db.transaction(name, mode), req = fn(tx.objectStore(name)); tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}
const kget = (name, k) => kdo(name, 'readonly', o => o.get(k)).catch(() => null);
let keptMeta = new Map();
async function loadKept() {
  try { const all = await kdo('meta', 'readonly', o => o.getAll()); keepOk = true; keptMeta = new Map((all || []).map(m => [m.id, m])); } catch { keptMeta = new Map(); }
  await keptFbCounts();
  if (!batch) renderLib();
  renderBackup();
  setTimeout(vkSweep, 20000);
}
// Work saved before formative activities counted Feedback complete has no count of it yet: worked out once from the saved work, so a feedback-only card never reads "0 of 20".
async function keptFbCounts() {
  for (const m of keptMeta.values()) {
    if (m.fb != null || !m.n) continue;
    const it = cardOfKept(m.id); if (!it || it.type !== 'fm') continue;
    try {
      const work = await kget('work', m.id), fb = work && workCounts(work).fb; if (!fb) continue;   // none complete: nothing to store
      const n = { ...m, fb };
      await kdo('meta', 'readwrite', o => o.put(n, m.id)); keptMeta.set(m.id, n);
    } catch (e) { console.error(e); }
  }
}
let askedKeep = false;
function askToKeep() {   // asks the browser not to clear this site's storage when the disk gets full
  if (askedKeep || !navigator.storage || !navigator.storage.persist) return;
  askedKeep = true; navigator.storage.persist().catch(() => {});
}
// A browser refuses one record over about 130 MB. A larger download is kept in pieces: under its id a list with nothing big in it, { path, data: null, parts, size } for each file,
// and each file's bytes under "id|file number|piece number". The list goes in last, so it never names a piece that isn't there. A download that fits stays one record, as it always was.
const PAPER_ONE = 100e6, PAPER_PIECE = 64e6;
const underId = id => IDBKeyRange.bound(id + '|', id + '|\uffff');
const paperHeads = async () => ((await kdo('papers', 'readonly', o => o.getAllKeys())) || []).filter(k => !String(k).includes('|'));
const paperDrop = id => kdo('papers', 'readwrite', o => { o.delete(id); o.delete(underId(id)); });
async function paperPut(id, rec) {
  const held = e => e.data ? e.data.buffer.byteLength : 0;   // a view is stored with its whole buffer
  if (rec.entries.reduce((a, e) => a + held(e), 0) <= PAPER_ONE) return kdo('papers', 'readwrite', o => { o.delete(underId(id)); o.put(rec, id); });
  try {
    const entries = [];
    for (let i = 0; i < rec.entries.length; i++) {
      const e = rec.entries[i], d = e.data;
      if (!d) { entries.push(e); continue; }
      let n = 0;
      for (let at = 0; at < d.length; at += PAPER_PIECE, n++) { const part = d.slice(at, at + PAPER_PIECE); await kdo('papers', 'readwrite', o => o.put(part, id + '|' + i + '|' + n)); }
      entries.push({ path: e.path, data: null, parts: n, size: d.length });
    }
    await kdo('papers', 'readwrite', o => o.put({ ...rec, entries }, id));
  } catch (e) { await paperDrop(id).catch(() => {}); throw e; }
}
// One file's bytes, one file at a time. A piece gone missing throws, so nothing goes on as if the file were whole.
async function keptBytes(id, i, e) {
  if (e.parts == null) return e.data || null;
  const out = new Uint8Array(e.size);
  for (let n = 0, at = 0; n < e.parts; n++) {
    const part = await kdo('papers', 'readonly', o => o.get(id + '|' + i + '|' + n));
    if (!part) throw new Error('A piece of a kept file is missing: ' + e.path);
    out.set(part, at); at += part.length;
  }
  return out;
}
async function paperGet(id) {
  const rec = await kget('papers', id);
  if (!rec || !rec.entries || !rec.entries.some(e => e.parts != null)) return rec;
  try {
    const entries = [];
    for (let i = 0; i < rec.entries.length; i++) entries.push({ path: rec.entries[i].path, data: await keptBytes(id, i, rec.entries[i]) });
    return { ...rec, entries };
  } catch (e) { console.error(e); return null; }
}
let keepWait = null;   // the papers still going into the browser
async function keepPapers(b, label, list, again) {
  try {
    const more = {};
    if (list && (again || !(keptMeta.get(b.id) || {}).papers)) {
      await paperPut(b.id, { id: b.id, label: label || '', entries: list });
      more.papers = true; more.size = list.reduce((a, e) => a + (e.data ? e.data.length : 0), 0);
    }
    const m = { ...(keptMeta.get(b.id) || {}), id: b.id, name: b.name, n: b.students.length, t: Date.now(), asg: b.assignment ? b.assignment.id : (keptMeta.get(b.id) || {}).asg, ...more };   // only now: a big download takes a while, and she may have saved since
    await kdo('meta', 'readwrite', o => o.put(m, b.id)); keepOk = true; keptMeta.set(b.id, m);
    folderPapers(b);
  } catch (e) {
    console.error(e);
    if (list) toast('This browser couldn’t keep these papers, usually because it’s out of room. Your marks are still saved, but the papers won’t reopen by themselves or go in a take-home file: drop the download in again to reopen it.', 12000);
  }
}
let keepT = null;
function keepWork(b, data) {
  const m = { ...(keptMeta.get(b.id) || { id: b.id, name: b.name }), n: b.students.length, t: data.t };
  delete m.fb; Object.assign(m, workCounts(data));   // fb is there only while some feedback is complete
  if (!data.returned) delete m.ret;
  keptMeta.set(b.id, m);
  return kdo('work', 'readwrite', o => o.put(data, b.id)).then(() => kdo('meta', 'readwrite', o => o.put(m, b.id))).then(() => { keepOk = true; return true; })
    .catch(e => { keepOk = false; console.error(e); if (e && e.name === 'InvalidStateError') keepDbP = null; keepDb().catch(() => { keepDbP = null; }); return false; });   // so Try again reopens a store that went away
}
// The card a download belongs to: the one it was last opened through, or else one that opens it. Its rubric lives on the card, so every way in has to find it.
function cardOfKept(id) {
  const m = keptMeta.get(id), f = m && m.asg ? findItem(m.asg) : null;
  if (f) return f.it;
  for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.batchId === id); if (it) return it; }
  return null;
}
async function reopenKept(id, assignment) {
  const rec = await paperGet(id);
  if (!rec) { toast('The papers for this one aren’t kept in this browser. Drop the download in again.'); return; }
  await intake(rec.entries, rec.label, assignment || cardOfKept(id), true);
}
async function forgetKept(id) {
  try { await gsData.forget(id); }   // first, so if this fails it can simply be clicked again
  catch (e) { console.error(e); return toast('That didn’t work, so nothing was forgotten. Try again.'); }
  lsPut(forgotKey(id), String(Date.now()));   // any tab with it open lets go now
  await exForgetWork(id);   // its strong examples stay; whose they were goes
  await noteForgotten(id);
  try {
    await paperDrop(id);
    for (const n of ['work', 'meta']) await kdo(n, 'readwrite', o => o.delete(id));
    await kdo('edits', 'readwrite', o => o.delete(IDBKeyRange.bound(id + '|', id + '|\uffff')));
    const recs = (await idbDo('readonly', o => o.getAll())) || [];
    await idbDo('readwrite', o => { for (const r of recs) if (r.bid === id) o.delete(r.bid + '|' + r.key + '|' + r.path); });
  } catch {}
  store.del(id); store.del('gs.rd.' + id); const idx = store.get('gs.batches', {}); delete idx[id]; store.set('gs.batches', idx);
  try { localStorage.removeItem(savedKey(id)); } catch {}
  const seen = store.get('gs.openSeen', {}); if (seen[id]) { delete seen[id]; store.set('gs.openSeen', seen); }
  keptMeta.delete(id); renderLib();
  vkSweep();   // a video file kept for that download, when nothing else names it
}
const fmtSize = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
// The lists of kept work are on Today (today.js draws them).
function renderKept() { if (shellReady) homeRender(); }
async function idbDo(mode, fn) {
  const db = await addDb();
  return new Promise((res, rej) => { const tx = db.transaction('files', mode), req = fn(tx.objectStore('files')); tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error); });
}
const addKey = (st, path) => batch.id + '|' + st.key + '|' + path;
const fmtDay = t => new Date(t).toLocaleDateString(LANG_LOCALE, { month: 'short', day: 'numeric' });
const addTag = f => {
  const was = replacedOf(f);
  // pages made from the student's own Word file: a short tag, since nothing here is hers
  if (was && madeFromWord(f)) return '<span class="addtag" title="Converted from ' + esc(fileShown(batch.students[cur], was.name)) + ' on ' + fmtDay(f.added) + '. The Word file is under Removed files, below the paper.">From Word</span>' + lateLink(f);
  return '<span class="addtag" title="You added this file">' + (f.from ? (anonOn() ? 'Group work copy' : 'Group work, shared from ' + esc(f.from)) : was ? 'Replaced ' + esc(fileShown(batch.students[cur], was.name)) : 'Added by you') + ' · ' + fmtDay(f.added) + '</span>' + lateLink(f);
};
async function loadAdded() {
  let recs = [];
  try { recs = (await idbDo('readonly', o => o.getAll(underId(batch.id)))) || []; } catch { return; }
  for (const r of recs.filter(r => r.bid === batch.id && r.key !== REF_KEY).sort((a, b) => a.added - b.added)) {   // readings sit in the same store, and aren't a student
    let st = batch.students.find(s => s.key === r.key);
    if (!st) { st = { key: r.key, files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }; batch.students.push(st); }   // added from a later scan
    if (st.files.some(f => f.path === r.path)) continue;
    const f = await makeFile(r.path, r.data); f.added = r.added; f.akey = r.key; if (r.from) f.from = r.from; st.files.push(f);
  }
}
function pickAdd(st) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = true;   // any kind of file
  inp.onchange = () => addFiles(st, [...inp.files].map(f => ({ path: f.name, file: f })));
  inp.click();
}
async function addFiles(st, list, quiet) {
  list = list.filter(e => e.file && !junk(e.path) && !houseFile(e.path));
  // A ZIP added to a student is opened and its files added. A ZIP with a folder per student goes through Bring in files.
  if (list.some(e => /\.zip$/i.test(e.file.name))) {
    const out = [];
    for (const e of list) {
      if (!/\.zip$/i.test(e.file.name)) { out.push(e); continue; }
      const got = await expandPicked([e.file]), tops = new Set(got.map(g => g.path.split('/')[1]).filter((x, i) => got[i].path.split('/').length > 2));
      if (!quiet && tops.size >= 2) return bringIn(got);
      out.push(...got.map(g => ({ path: g.path, file: g.file })));
    }
    list = out;
  }
  if (!list.length) return;
  commitEditors();
  let last = null;
  for (const e of list) {
    const bytes = new Uint8Array(await e.file.arrayBuffer());
    const name = e.file.name.replace(/[\\/]+/g, '-'), base = st.key + '/' + name;
    let path = base, k = 2;
    while (st.files.some(f => f.path === path) || (st.gone || []).some(f => f.path === path)) path = base.replace(/(\.[^./]+)?$/, ' (added ' + k++ + ')$1');
    const f = await makeFile(path, bytes); f.added = Date.now(); f.akey = st.key; if (e.from) f.from = e.from;
    if (f.photoTurn) f.rot = { 0: f.photoTurn };
    if (viewable(f)) {
      try { await workerReady; const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise; f.numPages = d.numPages; d.destroy(); } catch {}
      if (st.layout && f.numPages) st.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
      try { f.scan = await scanFile(f, f.hand || setup.spot || null); f.kami = f.scan.kami; } catch {}
    }
    st.files.push(f); last = f;
    try { await idbDo('readwrite', o => o.put({ bid: batch.id, key: st.key, path: f.path, name: f.name, data: bytes, added: f.added, ...(f.from ? { from: f.from } : {}) }, addKey(st, f.path))); }
    catch { toast('This browser couldn’t keep ' + f.name + ' for next time. It’s here until you close the download.'); }
  }
  refound(st); saveSoon(); renderList(); wordScoresAll();
  $('#trAllBtn').hidden = !CAN_TRANSCRIBE || !batch.students.some(x => x.files.some(f => f.kind === 'media'));
  if (quiet) return;
  const i = batch.students.indexOf(st);
  toast('Added ' + list.length + (list.length === 1 ? ' file' : ' files') + ' to ' + shownName(st, batch.students.indexOf(st)));
  openStudent(i, last && last.path);
}
async function removeAdded(st, path) {
  const f = fileByPath(st, path); if (!f || !f.added) return;
  st.files.splice(st.files.indexOf(f), 1);
  if (st.layout) { st.layout = st.layout.map(d => ({ ...d, pages: d.pages.filter(([q]) => q !== path) })).filter(d => d.pages.length); if (!st.layout.length) st.layout = null; }
  if (st.inc) delete st.inc[path];
  try { await idbDo('readwrite', o => o.delete(batch.id + '|' + (f.akey || st.key) + '|' + path)); } catch {}
  noteGone(batch, (f.akey || st.key) + '|' + path);
  if (st.forder) st.forder = st.forder.filter(x => x !== 'f:' + path);
  refound(st); saveSoon(); renderList(); openStudent(cur);
  toast('Removed ' + fileShown(st, f.name));
  vkSweep();
}
