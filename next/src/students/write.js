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
import { papers, edits, added, work, meta, quick, quickList, newestWork, library, deleted, pickerRolls, gradingSetup, commentBank, rubrics, rubricsGone, carryNo, historySame, readings, videos } from './index.js';
import { words } from '../planning/index.js';
import { mayWrite } from '../shared/lock.js';
import { json, text, setText, remove } from '../shared/ls.js';
import * as tabs from '../shared/tabs.js';
import { saved } from '../shared/saved.js';
import { KNOWN } from '../services/assistant.js';

export const DATA_V = __GS_DATA_V__;
export class CannotSave extends Error { constructor(why, what) { super(what + ': ' + why); this.name = 'CannotSave'; this.why = why; } }
let engine = null;
const merge = () => (engine ||= import('../engines/merge.js'));
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
export async function saveWork(id, change, { fresh = false } = {}) {
  check(id);
  if ((json('gs.tomb', {}) || {})[id]) throw new CannotSave('forgotten', id);
  const prev = await newestWork(id); if (!prev && !fresh) throw new CannotSave('missing', id);
  const M = await merge(), data = prev ? copy(prev) : {};
  change(data);
  data.t = Date.now();
  M.stampData(M.revsOf(prev), data, tabs.devId(), Date.now(), null);
  const r = await writeWork(id, data, M);
  saved({ kind: 'work', id, side: 'students', data, before: prev });
  return r;
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
export async function keepPapers(b, label, list) {
  check(b.id);
  if ((json('gs.tomb', {}) || {})[b.id]) throw new CannotSave('forgotten', b.id);
  const id = b.id, rec = { id, label: label || '', entries: list }, under = IDBKeyRange.bound(id + '|', id + '|\uffff');
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
  const m0 = await meta.get(id);
  const m = { ...(m0 || {}), id, name: b.name, n: b.students.length, t: Date.now(), asg: b.assignment ? b.assignment.id : (m0 || {}).asg, papers: true, size: list.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) };
  await meta.put(m, id);
  saved({ kind: 'papers', id, side: 'students' });
  return m;
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

/* the library */
export async function saveLibrary(change) {
  check('gs.lib');
  const M = await merge(), was = library.json(null) || { classes: [], loose: { id: '', units: [] } }, prev = M.libPrev(was), l = migrateLib(copy(was));
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
function migrateLib(l) {
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
const SETTINGS = { 'gs.setup': gradingSetup, 'gs.bank': commentBank, 'gs.rubrics': rubrics, 'gs.rubricsGone': rubricsGone, 'gs.carryNo': carryNo, 'gs.histSame': historySame };
export function saveSetting(key, value) {
  const acc = SETTINGS[key]; if (!acc) throw new Error('Not a grading setting: ' + key);
  check(key);
  acc.setJson(value);
  saved({ kind: 'setting', id: key, side: 'students' });
}
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
