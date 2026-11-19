// The grading side's writes: one function per kind of record, each doing what the current app does when it saves that record, so
// what lands in storage is the same bytes the current app would have written for the same change.
//
//   saveWork(id, change)      one download's marks and scores (src/app/keep.js saveNow -> src/folder.js stampWork -> src/saving.js
//                             writeWork -> src/app/kept.js keepWork): stamps, the full copy and its row, the quick copy and its list,
//                             the window note; then the folder copy and Drive sync hear of it (shared/saved.js -> whole/).
//   saveLibrary(change)       classes, rosters, units, to-dos (src/app/library.js saveLib with src/folder.js's store.set): stamps,
//                             then the copies made from it, the Planner's name picker (gs.rolls) and the teacher's words (gs.words).
//   saveSetting(key, value)   the other grading records that travel with the work (gs.setup, gs.bank, gs.rubrics…).
//
// Every write first checks: this window holds the lock; the saved work is at the format this build knows (the new app never
// changes the format); no other window has started replacing everything; and a download that was forgotten stays forgotten.
// The merge engine is the current app's own (engines/merge.js), loaded on the first write so it is not in the first load.
import { papers, edits, added, examples, work, meta, quick, quickList, newestWork, library, deleted, pickerRolls, gradingSetup, commentBank, rubrics, rubricsGone, carryNo, historySame, readings, videos, rubricPages, watchCodes, workTimer, setupUndo, lastBackup } from './index.js';
import { words } from '../planning/index.js';
import { mayWrite } from '../shared/lock.js';
import { json, text, setText, remove } from '../shared/ls.js';
import * as tabs from '../shared/tabs.js';
import { saved } from '../shared/saved.js';
import { KNOWN } from '../services/assistant.js';
import { writeMany, openExisting } from '../shared/idb.js';

export const DATA_V = __GS_DATA_V__;
export class CannotSave extends Error { constructor(why, what) { super(what + ': ' + why); this.name = 'CannotSave'; this.why = why; } }
let engine = null, engineNow = null, count = null;
// The timer's count of papers marked (students/count.js), loaded with the first save of work, as the merge engine is.
const counter = () => (count ||= import('./count.js'));
const merge = () => (engine ||= import('../engines/merge.js').then(m => (engineNow = m)));
const copy = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function check(what) {
  mayWrite(what);
  let v = 0; try { v = +JSON.parse(text('gs.dataV')); } catch {} if (!(v >= 1)) v = 1;
  if (v !== DATA_V) throw new CannotSave('format', what);   // saved by a newer (or older) version: the current app moves it on first
  if (!tabs.live()) throw new CannotSave('replaced', what);
}

/* one download's marks and scores */
// change(data) changes a copy of the newest saved work in place. Returns { quick, full } as the current app's save label reads them.
// fresh: a download brought in just now, with no work saved yet (its papers were kept first, keepPapers below).
// hold: the marking screen's own note of what it opened and saw (src/app/open.js batch.revs, src/saving.js b.seen, b.behind): the
// record change makes replaces the saved one, stamped against what the screen opened, and when another window has saved this
// download since, only what changed here goes in (src/saving.js saveBehind, tabMerge). Without a hold, change works on the newest copy.
// A write and the read before it are one step for every window of the new app (the "gs-save" lock), so two never interleave.
export async function saveWork(id, change, { fresh = false, hold = null } = {}) {
  return oneAtATime(async () => {
    check(id);
    const tomb = (json('gs.tomb', {}) || {})[id];
    if (tomb && !again.has(id)) throw new CannotSave('forgotten', id);
    const seen = tomb ? tomb.v || {} : null;
    const prev = await newestWork(id); if (!prev && !fresh) throw new CannotSave('missing', id);
    const M = await merge(), data = hold ? {} : prev ? copy(prev) : {};
    change(data);
    data.t = Date.now();
    let out = data;
    if (hold) {
      if (!hold.revs) hold.revs = M.revsOf(prev);
      if (!hold.bad) hold.wasOk = hold.revs;   // a change whose save failed still counts as this window's own, until one works
      const was = hold.wasOk, st = tabs.savedStamp(id);
      hold.revs = M.stampData(hold.revs, data, tabs.devId(), Date.now(), seen);
      if (prev && (hold.behind || (st && st !== hold.seen))) {
        if (!hold.behind && !M.tabDiffers(was, prev)) hold.seen = st;   // it saved nothing new
        else {
          hold.behind = true;
          const m = M.tabMerge(data, was, prev);
          if (!m.changed) return { quick: true, full: true, merged: true };
          out = m.data;
        }
      }
    } else M.stampData(M.revsOf(prev), data, tabs.devId(), Date.now(), seen);
    const r = await writeWork(id, out, M);
    if (tomb) { const tb = json('gs.tomb', {}) || {}; delete tb[id]; deleted.setJson(tb); again.delete(id); saved({ kind: 'setting', id: 'gs.tomb', side: 'students', from: 'local' }); }
    if (hold) { hold.bad = !r.full; hold.seen = tabs.savedStamp(id); }
    saved({ kind: 'work', id, side: 'students', data: out, before: prev });
    return r;
  });
}
// The read and write of a save as one step across this browser's windows of the new app. Windows of the current app don't ask;
// the stamps and the merge above keep their work, as they always have between two of its own windows.
const oneAtATime = fn => (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) ? navigator.locks.request('gs-save', fn) : fn();
// Leaving the page (the tab closing or reloading), as the current app's saveNow(true) on beforeunload: there is no time to wait, so
// only the quick copy is written, at once, over the quick copy already there. The next open reads the newer of the two copies
// (index.js newestWork), and its first save writes the full copy. False when it could not (no save yet this visit, or no quick copy).
// With a hold that is behind another window, only what changed here goes in, from the quick copy (there is no time to read more).
export const leavingReady = () => merge();
export function saveWorkLeaving(id, change, { hold = null } = {}) {
  if (!engineNow) return false;
  check(id);
  if ((json('gs.tomb', {}) || {})[id]) return false;
  const qid = id.replace(/^gs\.b\./, ''), prev = quick.json(qid); if (!prev) return false;
  const M = engineNow;
  let data = hold ? {} : copy(prev); change(data); data.t = Date.now();
  if (hold && hold.revs) {
    if (!hold.bad) hold.wasOk = hold.revs;
    const was = hold.wasOk, st = tabs.savedStamp(id);
    hold.revs = M.stampData(hold.revs, data, tabs.devId(), Date.now(), null);
    if (hold.behind || (st && st !== hold.seen)) {
      if (hold.behind || M.tabDiffers(was, prev)) { const m = M.tabMerge(data, was, prev); if (!m.changed) return true; data = m.data; }
    }
  } else M.stampData(M.revsOf(prev), data, tabs.devId(), Date.now(), null);
  quick.setText(qid, JSON.stringify(data));
  const idx = quickList.json({}) || {}; idx[id] = data.t; quickList.setJson(idx);
  tabs.stamp(id, data.t);
  saved({ kind: 'work', id, side: 'students', data, before: prev });
  return true;
}
async function writeWork(id, data, M) {
  const idx = quickList.json({}) || {}; idx[id] = data.t;
  const qid = id.replace(/^gs\.b\./, '');
  const put = (k, v) => { try { quick.setText(k, JSON.stringify(v)); return true; } catch (e) { if (e && e.name === 'ReadOnly') throw e; return false; } };
  let ok = put(qid, data);
  tabs.stamp(id, data.t);
  const kept = new Set((await meta.keys()).map(String));
  const order = Object.entries(idx).sort((p, q) => q[1] - p[1]).map(([k]) => k);
  for (const k of order.slice(12)) if (kept.has(k)) { quick.remove(k.replace(/^gs\.b\./, '')); delete idx[k]; }
  while (!ok && order.length > 1) { const k = order.pop(); if (k === id || !kept.has(k)) continue; quick.remove(k.replace(/^gs\.b\./, '')); delete idx[k]; ok = put(qid, data); }
  quickList.setJson(idx);
  let full = true;
  try {
    await work.put(data, id);
    const m0 = await meta.get(id), m = { ...(m0 || { id }), t: data.t }, students = (m0 && m0.n || 0) + (m0 && m0.joined || 0);
    m.n = students;
    delete m.fb; delete m.sent; delete m.sentT; delete m.joined; Object.assign(m, M.workCounts(data));
    if (m.joined) m.n = students - m.joined;
    delete m.ret; if (!(data.returned && data.returned.ok)) delete m.back;
    // the papers this save finished count toward today, and toward a focus session running (src/app/kept.js keepWork: fcSeen, fcGain)
    try { await (await counter()).workCounted(id, m0, m); } catch (e) { console.error(e); }
    await meta.put(m, id);
  } catch (e) { if (e && e.name === 'ReadOnly') throw e; console.error(e); full = false; }
  if (full && !ok) quick.remove(qid);
  if ((text('gsc.saved.' + id) || '').startsWith(tabs.TAB + ':')) tabs.stamp(id, data.t + ':full');
  return { quick: ok, full };
}

/* a download's papers (src/app/kept.js keepPapers and paperPut) */
// The files of a download brought in, kept in this browser so it reopens by itself, and its row in the list of kept work. A download
// over about 100 MB is kept in pieces ("id|file|piece"), the list going in last so it never names a piece that isn't there.
const PAPER_ONE = 100e6, PAPER_PIECE = 64e6;
// A forgotten download brought in again on purpose (src/folder.js stampWork, folderPapers): it isn't forgotten any more. Its papers
// are kept, and its first save takes the tombstone away and is stamped with everything the tombstone had seen, so a synced copy or a
// folder that still has the tombstone gives way to it. Until that save the tombstone stays. True when it was forgotten.
const again = new Set();
export function bringBack(id) { if (!(json('gs.tomb', {}) || {})[id]) return false; again.add(id); return true; }
export async function keepPapers(b, label, list) {
  check(b.id);
  if ((json('gs.tomb', {}) || {})[b.id] && !again.has(b.id)) throw new CannotSave('forgotten', b.id);
  const id = b.id, rec = { id, label: label || '', entries: list };
  await putPapers(id, rec);
  const m0 = await meta.get(id);
  const m = { ...(m0 || {}), id, name: b.name, n: b.students.length, t: Date.now(), asg: b.assignment ? b.assignment.id : (m0 || {}).asg, papers: true, size: list.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) };
  await meta.put(m, id);
  saved({ kind: 'papers', id, side: 'students' });
  return m;
}

// The papers record itself, whole or in pieces (src/app/kept.js paperPut).
async function putPapers(id, rec) {
  const under = IDBKeyRange.bound(id + '|', id + '|\uffff');
  const held = e => (e.data ? e.data.buffer.byteLength : 0);
  if (rec.entries.reduce((a, e) => a + held(e), 0) <= PAPER_ONE) { await papers.del(under); await papers.put(rec, id); }
  else {
    try {
      const entries = [];
      for (let i = 0; i < rec.entries.length; i++) {
        const e = rec.entries[i], d = e.data;
        if (!d) { entries.push(e); continue; }
        let n = 0;
        for (let at = 0; at < d.length; at += PAPER_PIECE, n++) await papers.put(d.slice(at, at + PAPER_PIECE), id + '|' + i + '|' + n);
        entries.push({ path: e.path, data: null, parts: n, size: d.length });
      }
      await papers.put({ ...rec, entries }, id);
    } catch (e) { await papers.del(id).catch(() => {}); await papers.del(under).catch(() => {}); throw e; }
  }
}

/* a Word paper edited in the app (src/app/word.js keepEdit, dropEdit) */
// { data, orig, t } under "download id|file path", so the edit comes back next time. Taking it back off is noted with the work's
// own save (the caller marks it gone with noteGone, as the current app does), so a copy elsewhere doesn't bring it back.
export async function keepEdit(id, path, rec) { check(id); await edits.put({ data: rec.data, orig: rec.orig || null, t: rec.t }, id + '|' + path); saved({ kind: 'edit', id, side: 'students' }); }
export async function dropEdit(id, path) { check(id); await edits.del(id + '|' + path); saved({ kind: 'edit', id, side: 'students' }); }

/* a file she added to a student (src/app/kept.js addFiles), kept in this browser under "download id|student|file path" */
export async function keepAdded(id, rec, key) { check(id); await added.put(rec, key); saved({ kind: 'added', id, side: 'students' }); }

/* a newer copy of a download (src/carryover.js carryExtras, carryRubric, carryInto) */
// What sits beside the older copy's work is copied under the new download's id, never moved: its readings, the files she added
// (each record with the new id), and the Word edits that still fit. The older copy's row in the list says which is newer.
// Returns false when the added files couldn't be copied (the current app's carry.extrasFailed).
export async function carryExtras(from, id, recs) {
  check(id);
  const old = readings.json(from, null);
  if (old) readings.setJson(id, old);
  try { for (const r of recs) await added.put({ ...r, bid: id }, id + '|' + r.key + '|' + r.path); return true; }
  catch (e) { console.error(e); return false; }
  finally { saved({ kind: 'added', id, side: 'students' }); }
}
export async function carryEdits(id, puts) { check(id); for (const [k, v] of puts) await edits.put(v, k); saved({ kind: 'edit', id, side: 'students' }); }
export async function markNewer(from, id) { check(from); const m = await meta.get(from); if (!m) return; m.newer = id; await meta.put(m, from); saved({ kind: 'papers', id: from, side: 'students' }); }

// Rows kept before downloads counted feedback given and papers marked have neither count: worked out once from the saved work
// (src/app/kept.js keptFbCounts, keptMarkCounts, run as the kept list is read; audit H-047), so a feedback-only card never reads
// "0 of 20" and Focus doesn't fall back on scores. fmOf(id): the download's card is a formative activity.
export async function backfillCounts(fmOf) {
  try { check('meta'); } catch { return 0; }   // a window that may not write, or saved work of another version: left as it is
  let done = 0;
  for (const [id, m] of await meta.entries()) {
    if (!m || !m.n || (m.marked != null && (m.fb != null || !fmOf(id)))) continue;
    try {
      const w = await newestWork(id); if (!w) continue;
      const c = (await merge()).workCounts(w), now = await meta.get(id); if (!now) continue;
      const n = { ...now };
      if (n.fb == null && c.fb && fmOf(id)) n.fb = c.fb;
      if (n.marked == null) n.marked = c.marked;
      if (JSON.stringify(n) === JSON.stringify(now)) continue;
      await meta.put(n, id); done++;
    } catch (e) { if (e && e.name === 'ReadOnly') return done; console.error(e); }
  }
  if (done) saved({ kind: 'papers', id: '', side: 'students' });
  return done;
}

/* the library */
// Written at once when the merge engine is already loaded (leavingReady), so a save made as the page is left (pagehide) lands.
export function saveLibrary(change) {
  if (engineNow) { try { return Promise.resolve(libWrite(engineNow, change)); } catch (e) { return Promise.reject(e); } }
  return merge().then(M => libWrite(M, change));
}
function libWrite(M, change) {
  check('gs.lib');
  const was = library.json(null) || { classes: [], loose: { id: '', units: [] } }, prev = M.libPrev(was), l = migrateLib(copy(was));
  change(l);
  M.stampLib(l, prev, tabs.devId(), Date.now());
  library.setJson(l);
  shareRolls(l); shareWords(l);
  saved({ kind: 'library', id: 'gs.lib', side: 'students' });
  return l;
}
// The shape the current app reads the library into before it changes it (src/app/library.js migrateLib): each class with its units
// and roster, the loose cards, and units shared by every class (before 10/29) moved into each class's unit of the same name.
const uid = () => Math.random().toString(36).slice(2, 10);
export function migrateLib(l) {
  l.classes ||= []; for (const c of l.classes) { c.units ||= []; c.names ||= []; }
  l.loose ||= { id: '', units: [] };
  for (const u of l.units || []) for (const it of u.items || []) {
    const c = l.classes.find(k => k.id === it.classId) || l.loose;
    let cu = c.units.find(x => x.name === u.name); if (!cu) c.units.push(cu = { id: uid(), name: u.name, items: [] });
    cu.items.push(it);
  }
  l.units = [];
  return l;
}
// The rosters for the Planner's name picker (src/seating.js rollsShare).
function shareRolls(l) {
  const v = JSON.stringify((l.classes || []).filter(c => (c.names || []).length).map(c => [c.name, c.names]));
  if (v === '[]') { if (pickerRolls.text() != null) pickerRolls.remove(); }
  else if (pickerRolls.text() !== v) pickerRolls.setText(v);
}
// The teacher's own words, where the Planner reads them (src/app/library.js wordsShare). Only for a teacher who has said them.
const urlClean = v => { const s = String(v == null ? '' : v).trim().slice(0, 400); if (!s) return ''; try { const u = new URL(s); return u.protocol === 'https:' && u.hostname.includes('.') ? u.href : ''; } catch { return ''; } };
function shareWords(l) {
  const m = l.me; if (!m) return;
  const ai = String(m.ai == null ? (m.scale12 ? KNOWN[1][0] : '') : m.ai).trim().slice(0, 30);   // as src/app/library.js aiName
  const v = JSON.stringify({ sys: String(m.sys || '').trim(), unit: String(m.unit || '').trim(), ai, ...(m.scale12 ? { scale12: true } : {}), ...(ai && urlClean(m.aiUrl) ? { link: urlClean(m.aiUrl) } : {}), ...(m.aiOpen === 'tab' ? { tab: true } : {}),
    ...(m.aiUrls && Object.keys(m.aiUrls).length ? { urls: m.aiUrls } : {}), ...(Array.isArray(m.aiOff) && m.aiOff.length ? { off: m.aiOff } : {}) });
  if (words.text() !== v) words.setText(v);
}

/* the other grading records that travel with the work */
const SETTINGS = { 'gs.setup': gradingSetup, 'gs.bank': commentBank, 'gs.rubrics': rubrics, 'gs.rubricsGone': rubricsGone, 'gs.carryNo': carryNo, 'gs.histSame': historySame, 'gs.focus': workTimer, 'gs.setupUndo': setupUndo };
export function saveSetting(key, value) {
  const acc = SETTINGS[key]; if (!acc) throw new Error('Not a grading setting: ' + key);
  check(key);
  acc.setJson(value);
  saved({ kind: 'setting', id: key, side: 'students' });
}
/* her rubric file for every student (src/app/dialogs.js openSetup: store.set('gs.rp.' + id, base64)), under a new id each time it's
   brought in; the setup names it (setup.rubricPage). Throws CannotSave('room') when this browser has no room for it. */
export function keepRubricPage(id, b64) {
  check('gs.rp.');
  try { rubricPages.setJson(id, b64); } catch (e) { if (e && e.name === 'ReadOnly') throw e; throw new CannotSave('room', 'gs.rp.'); }
  saved({ kind: 'setting', id: 'gs.rp.' + id, side: 'students' });
}
export function dropRubricPage(id) { check('gs.rp.'); rubricPages.remove(id); saved({ kind: 'setting', id: 'gs.rp.' + id, side: 'students' }); }
export const forgotten = () => deleted.json({}) || {};

/* a video file kept in this browser (src/video.js vkPut): the file itself in grading-studio-videos, under an id the student's
   shortcut file names ("gs-video:<id>"). Throws CannotSave('room') when the computer has no room for it. */
export async function keepVideo(file, id) {
  check('videos');
  id = id || uid();
  try { const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; if (e && e.quota && e.quota - (e.usage || 0) < file.size * 1.05) throw new CannotSave('room', file.name); } catch (er) { if (er && er.why === 'room') throw er; }
  await videos.put({ id, name: file.name, type: file.type || '', size: file.size, at: Date.now(), blob: file }, id);
  saved({ kind: 'video', id, side: 'students' });
  return id;
}

// A kept video taken out of this browser (src/video.js vkDrop): a Drive video's download, Remove download. Drive's copy isn't touched.
export async function dropVideo(id) {
  check('videos');
  await videos.del(id);
  saved({ kind: 'video', id, side: 'students' });
}

// Kept videos that no shortcut file names any more go (src/video.js vkSweep, src/app/kept.js; H-048): looked for in every added file
// and every kept download's papers. One kept in the last 15 minutes stays, so a video being added right now is never caught. A
// browser that never kept a video has nothing to sweep, and no database is made for it. Gives how many went.
const shortcutId = d => {
  if (!d || !d.length || d.length > 4000) return ''; let s = ''; try { s = new TextDecoder().decode(d); } catch { return ''; }
  const v = /^\s*URL\s*=\s*gs-video:([\w-]{6,40})\s*$/mi.exec(s); if (v) return v[1];
  const g = /^\s*GsDrive\s*=\s*([\w-]{10,120})\s*$/mi.exec(s); return g ? 'd-' + g[1] : '';
};
export async function sweepVideos() {
  check('videos');
  const ids = await videos.keys(); if (!ids.length) return 0;
  const used = new Set(), see = r => { const v = r && /\.url$/i.test(r.path || '') && shortcutId(r.data); if (v) used.add(v); };
  for (const [, r] of await added.entries()) see(r);
  for (const [k, r] of await papers.entries()) {
    if (r && Array.isArray(r.entries)) r.entries.forEach((e, i) => { if (e && e.data) see(e); else if (e && e.parts === 1 && /\.url$/i.test(e.path || '')) used.add('?' + k + '|' + i + '|0'); });
  }
  // a shortcut kept in pieces (a large download): its one piece read on its own
  for (const q of [...used].filter(x => x[0] === '?')) { used.delete(q); see({ path: '.url', data: await papers.get(q.slice(1)) }); }
  const old = Date.now() - 15 * 60e3; let n = 0;
  for (const id of ids) {
    if (used.has(id)) continue;
    const r = await videos.get(id); if (r && r.at > old) continue;
    await videos.del(id); n++;
  }
  if (n) saved({ kind: 'video', id: '', side: 'students' });
  return n;
}

/* strong examples and the watch list (grading-studio-examples: ex and pix; src/examples.js exPut, exDelete) */
// A record and its pictures in one transaction, as exPut writes them: u stamps the change (the newer one wins a merge), new
// pictures replace the old ones. A browser that never kept one gets the database made as the current app makes it (shared/idb.js ensure).
export async function keepExample(rec, blobs) {
  check('grading-studio-examples');
  rec = { ...rec, u: Date.now() };
  const lo = rec.id + '|', hi = rec.id + '|\uffff';
  await writeMany('grading-studio-examples', ['ex', 'pix'], o => {
    o.ex.put(rec, rec.id);
    if (rec.gone || blobs) o.pix.delete(IDBKeyRange.bound(lo, hi));
    if (blobs) blobs.forEach((b, n) => o.pix.put(b, rec.id + '|' + n));
  });
  saved({ kind: 'example', id: rec.id, side: 'students' });
  return rec;
}
// Deleting leaves { id, t, gone: true } (watch: 1 kept for a watch-list one), so a copy elsewhere doesn't bring it back.
// An example as it came from elsewhere (a linked folder or a take-home file: src/examples.js exTake, exPut raw), its stamp kept.
export async function takeExample(rec, blobs, from = 'folder') {
  check('grading-studio-examples');
  const lo = rec.id + '|', hi = rec.id + '|\uffff';
  await writeMany('grading-studio-examples', ['ex', 'pix'], o => {
    o.ex.put(rec, rec.id);
    if (rec.gone || blobs) o.pix.delete(IDBKeyRange.bound(lo, hi));
    if (blobs) blobs.forEach((b, n) => o.pix.put(b, rec.id + '|' + n));
  });
  saved({ kind: 'example', id: rec.id, side: 'students', from });
}
export const dropExample = r => keepExample({ id: r.id, t: Date.now(), gone: true, ...(r.watch ? { watch: 1 } : {}) });
// The watch list's codes for students (gs.wlCodes): kept in this browser only, never in the folder, Drive or a take-home file.
export function saveWatchCodes(map) { check('gs.wlCodes'); watchCodes.setJson(map); }

/* what a merge takes in from elsewhere: the Drive sync file or a linked folder (src/folder.js applyRow, forgetKept; src/app/drive.js
   syncOnce). Each write is what the current app writes for the same row, and says so with from: 'sync' (or 'folder'), so the copy
   it came from isn't sent the same thing straight back as news. */
// A download's merged marks and scores: the full copy, the other windows told (this one too: hold.seen), the quick copy dropped.
export async function takeWork(id, data, from = 'sync') {
  check(id);
  await work.put(data, id);
  const st = tabs.stamp(id, data.t);
  quick.remove(id.replace(/^gs\.b\./, ''));
  const idx = quickList.json({}) || {}; if (id in idx) { delete idx[id]; quickList.setJson(idx); }
  saved({ kind: 'work', id, side: 'students', from, data });
  return st;
}
export async function takeMeta(id, m, from = 'sync') { check(id); await meta.put(m, id); saved({ kind: 'papers', id, side: 'students', from }); }
export async function takePapers(id, rec, from = 'sync') { check(id); await putPapers(id, rec); saved({ kind: 'papers', id, side: 'students', from }); }
export async function takeAdded(key, rec, from = 'sync') { const id = key.split('|')[0]; check(id); if (rec) await added.put(rec, key); else await added.del(key); saved({ kind: 'added', id, side: 'students', from }); }
export async function takeEdit(key, rec, from = 'sync') { const id = key.split('|')[0]; check(id); if (rec) await edits.put(rec, key); else await edits.del(key); saved({ kind: 'edit', id, side: 'students', from }); }
// The library as a merge left it (already stamped): put in whole, with the copies made from it.
export function takeLibrary(l, from = 'sync') {
  check('gs.lib');
  l = migrateLib(l);
  library.setJson(l); shareRolls(l); shareWords(l);
  saved({ kind: 'library', id: 'gs.lib', side: 'students', from });
  return l;
}
export function takeTombs(tb, from = 'sync') { check('gs.tomb'); deleted.setJson(tb); saved({ kind: 'setting', id: 'gs.tomb', side: 'students', from }); }
// A download forgotten elsewhere: everything of it in this browser goes (src/app/kept.js forgetKept), its strong examples stay
// without saying whose they were, and any window with it open lets go.
export async function dropDownload(id, from = 'sync') {
  check(id);
  tabs.forget(id);
  try { for (const [, r] of await examples.entries()) if (r && r.work === id && r.from) await writeMany('grading-studio-examples', ['ex'], o => o.ex.put({ ...r, from: null }, r.id)); } catch (e) { console.error(e); }
  try {
    await papers.del(id); await papers.del(IDBKeyRange.bound(id + '|', id + '|￿'));
    await work.del(id); await meta.del(id);
    await edits.del(IDBKeyRange.bound(id + '|', id + '|￿'));
    for (const [k, r] of await added.entries()) if (r && r.bid === id) await added.del(k);
  } catch (e) { console.error(e); }
  quick.remove(id.replace(/^gs\.b\./, '')); readings.remove(id);
  const idx = quickList.json({}) || {}; if (id in idx) { delete idx[id]; quickList.setJson(idx); }
  try { remove('gsc.saved.' + id); } catch {}
  saved({ kind: 'papers', id, side: 'students', from, gone: true });
}

// A take-home file or a year's file was made: Remove from this computer says how long ago (src/takehome.js store.set gs.lastBackup).
export function noteBackup() { check('gs.lastBackup'); lastBackup.setJson(Date.now()); saved({ kind: 'setting', id: 'gs.lastBackup', side: 'students', from: 'local' }); }
// Remove from this computer (src/takehome.js removeHere): every download with its papers, marks, scores and comments, late files,
// readings, Word edits, examples, kept videos and safety copies, and every gs.* setting but how the app looks. The Planner's work
// stays. The caller has stopped the other windows first; school files and the focus session go through the Planner's own write.
const LS_LOOKS = /^gs\.(theme|ink|hl|penW|disp|zoom|panels|rate|arrsize|spsize|sheetall|xall|xedit|rdOpen|calcpos|calchist|gcid|dataV)$/;
async function clearIf(db, stores) {
  const d = await openExisting(db); if (!d) return;
  const has = stores.filter(s => d.objectStoreNames.contains(s)); d.close();
  if (has.length) await writeMany(db, has, o => { for (const s of has) o[s].clear(); });
}
export async function removeAllWork() {
  check('grading-studio-keep');
  await clearIf('grading-studio-keep', ['papers', 'work', 'meta', 'edits']);
  await clearIf('grading-studio-added', ['files']);
  await clearIf('grading-studio-examples', ['ex', 'pix']);
  await clearIf('grading-studio-videos', ['v']);
  await clearIf('grading-studio-safety', ['meta', 'data']);
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && (k.startsWith('gsc.saved.') || k.startsWith('gsc.forgot.') || k === 'gsc.win' || (k.startsWith('gs.') && !LS_LOOKS.test(k)))) remove(k); }
  saved({ kind: 'library', id: 'gs.lib', side: 'students', from: 'local', gone: true });
}
