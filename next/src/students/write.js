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
import { work, meta, quick, quickList, newestWork, library, deleted, pickerRolls, gradingSetup, commentBank, rubrics, rubricsGone, carryNo, historySame } from './index.js';
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
export async function saveWork(id, change) {
  check(id);
  if ((json('gs.tomb', {}) || {})[id]) throw new CannotSave('forgotten', id);
  const prev = await newestWork(id); if (!prev) throw new CannotSave('missing', id);
  const M = await merge(), data = copy(prev);
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
