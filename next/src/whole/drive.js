// The Drive sync (src/app/drive.js syncOnce and planSync, the same steps in the same order): the same work on every device she signs
// in on, through one hidden file in her own Drive (grading-studio-sync.json) and one for the Planner (grading-studio-plan.json).
// Each side is merged with the current app's own merge (engines/merge.js), student by student and field by field; where a folder
// would ask, the copy changed later is kept, the same choice on both devices. Nothing goes anywhere but this browser and her Drive.
// What comes in is written through the two sides' own writes (students/write.js take*, planning/write.js takePlan, whole/carry.js),
// each marked from: 'sync' so it isn't taken for news.
import { G, GOK, gcid, gsync, gToken, gRenew, gAuto, gLive, G_REDIRECT, gRedirect, SYNC_SCOPE, whoAmI, onGoogle, changed } from './google.js';
import { localState, addedDates, applyRow } from './apply.js';
import { takeLs } from './carry.js';
import { carryLs } from './folder.js';
import { library, deleted } from '../students/index.js';
import { takeLibrary, takeTombs } from '../students/write.js';
import { lessons, kv, setupRecord, planTime, taughtIn, planCopy, planSeen, planBig } from '../planning/index.js';
import { takePlan, savePref } from '../planning/write.js';
import { setText as lsSet, json as lsJson } from '../shared/ls.js';
import { devId } from '../shared/tabs.js';
import { onSaved } from '../shared/saved.js';
import { openHold, flushOpen } from '../app/openwork.js';
import { sampleOn } from '../app/sample.js';

const SYNC_NAME = 'grading-studio-sync.json';
// A phone's screen (src/phone.js PHONE): it sends no papers and makes no copies of big lessons for itself.
export const PHONE = typeof screen !== 'undefined' && (() => { try { const k = localStorage.getItem('gs.phone'); if (k === '1' || k === '0') return k === '1'; return Math.min(screen.width, screen.height) < 600 && matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
const engine = () => import('../engines/merge.js');
export const S = { state: '', t: null, busy: null, again: false, file: null, libVer: 0, onDone: new Set() };
const coord = (k, v) => { try { lsSet(k, JSON.stringify(v)); } catch (e) { if (e && e.name === 'ReadOnly') throw e; } };
export const paused = () => /^signin/.test(S.state || '');
// The papers going up after the marks: sending, full (her Drive is full, so papers stay here), notsent, or '' when done.
export function setPapersState(s) { setState(s ? 'papers_' + s : 'synced'); }
function setState(s) { S.state = s; changed(); }
export const syncState = () => S.state;
export const syncAt = () => +lsJson('gs.syncAt', 0) || 0;
// a library save made here, not a merge's (so a save during a sync is merged in again rather than written over)
onSaved(e => { if (e.kind === 'library' && !e.from) S.libVer++; });

const ver = async () => String((await (await gsync('files/' + S.file.id + '?fields=id,version')).json()).version || '');
async function read() {
  if (!S.file) { const f = (await (await gsync('files?spaces=appDataFolder&fields=files(id)&q=' + encodeURIComponent("name='" + SYNC_NAME + "' and trashed=false"))).json()).files[0]; S.file = f ? { id: f.id } : null; }
  if (!S.file) return null;
  S.file.ver = await ver();
  const r = await gsync('files/' + S.file.id + '?alt=media');
  try { return await r.json(); } catch { return null; }
}
async function write(body) {
  if (S.file) {
    if (S.file.ver && await ver() !== S.file.ver) throw Object.assign(new Error('changed on another device'), { status: 412 });
    const r = await gsync('https://www.googleapis.com/upload/drive/v3/files/' + S.file.id + '?uploadType=media&fields=id,version', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    let v = ''; try { v = String((await r.clone().json()).version || ''); } catch {}
    S.file.ver = v || await ver();
    return;
  }
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify({ name: SYNC_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
  fd.append('file', new Blob([body], { type: 'application/json' }));
  S.file = { id: (await (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id };
}
// Where a folder would ask her, the copy changed later is kept (the same choice on both devices); a download forgotten on one
// device and worked on since on another comes back.
function decide(asks, M) {
  const out = {};
  for (const q of asks) {
    if (q.gone) { out['!' + q.id] = 'back'; continue; }
    const ta = q.ta || 0, tb = q.tb || 0, side = ta !== tb ? (tb > ta ? 'b' : 'a') : M.hashOf(q.b) > M.hashOf(q.a) ? 'b' : 'a';
    (out[q.id] ||= {})[q.key] = side;
  }
  return out;
}
const libNow = () => { const l = library.json(null); if (!l) return { classes: [], loose: { id: '', units: [] } }; l.classes ||= []; for (const c of l.classes) { c.units ||= []; c.names ||= []; } l.loose ||= { id: '', units: [] }; return l; };
const dvAdded = files => Object.fromEntries(Object.entries(files || {}).map(([id, f]) => [id, Object.fromEntries(Object.entries(f.added || {}).map(([k, r]) => [k, r.added || 0]))]));
// The papers part (late files come with the marks; papers wait until she opens them) is whole/papers.js's, once it is loaded.
export const P = { files: lsJson('gs.cloudP', null) || {}, sent: null, source: () => ({ papers: async () => null, edit: async () => null, added: async () => null }), upSoon: () => {} };
function cloud(files) { P.files = Object.fromEntries(Object.entries(files || {}).filter(([, f]) => f && f.papers)); coord('gs.cloudP', P.files); }
function filesOut(was, tomb) { const o = { ...(was || {}), ...(P.sent || {}) }; for (const id of Object.keys(o)) if (tomb[id]) delete o[id]; return o; }
// The timetable for Today on a device that has no Planner of its own. Lessons stay put.
async function planOf() {
  const su = await setupRecord.get().catch(() => null);
  if (!su || !Array.isArray(su.classes) || !su.classes.length) return null;
  return { classes: su.classes.map(c => ({ id: c.id, name: c.name, color: c.color, meets: c.meets })), semStart: su.semStart || '', semEnd: su.semEnd || '', daysOff: su.daysOff || [] };
}

async function once() {
  setState('syncing');
  await import('./papers.js');
  await flushOpen();
  const M = await engine();
  const got = await read(), B = got && got.app === 'Grading Studio sync' ? { work: got.work || {}, meta: got.meta || {}, tomb: got.tomb || {}, added: dvAdded(got.files), edits: {}, lib: got.lib, ls: got.ls || {} } : null;
  const A = await localState(), dev = devId(), now = Date.now();
  let rows = [], tomb = A.tomb;
  if (B) {
    B.edits = A.edits;   // Word edits stay on the computer they were made on
    await addedDates(A, B);
    const v0 = S.libVer;
    let libm = M.mergeLib(libNow(), B.lib, { dev, now });
    if (libm.asks.length) libm = M.mergeLib(libNow(), B.lib, { dev, now, answers: decide(libm.asks, M) });
    for (const w of Object.values(A.work)) if (libm.mapA[w.cls]) w.cls = libm.mapA[w.cls];
    for (const w of Object.values(B.work)) if (libm.mapB[w.cls]) w.cls = libm.mapB[w.cls];
    let plan = M.mergeStates(A, B, { dev, now, linked: M.libLinked(libm.lib, libm.cards) });
    if (plan.asks.length) plan = M.mergeStates(A, B, { dev, now, linked: M.libLinked(libm.lib, libm.cards), answers: decide(plan.asks, M) });
    M.libFollow(libm, plan.rows, dev, now);
    rows = plan.rows; tomb = plan.tomb;
    // The download open on screen keeps what's there; it takes what came in the next time round, once it's closed.
    const hold = openHold(), open = hold && hold.id;
    const came = rows.filter(r => r.kind === 'new' || r.kind === 'gone' && r.onA || r.toA || (r.meta && JSON.stringify(r.meta) !== JSON.stringify(r.ma)));
    for (const row of came) if (row.id !== open && row.kind !== 'askGone') await applyRow(row, P.source(got.files || {}), 'sync', hold);
    // a library saved while the rows above were written: merged in again, so the copy taken before doesn't write over it
    if (S.libVer !== v0) { libm.lib = M.mergeLib(libNow(), libm.lib, { dev, now }).lib; libm.toA = true; }
    if (libm.toA) takeLibrary(libm.lib);
    if (JSON.stringify(deleted.json({}) || {}) !== JSON.stringify(tomb)) takeTombs(tomb);
    if (got.plan && JSON.stringify(got.plan) !== JSON.stringify(planCopy.json(null))) savePref('gs.planCopy', got.plan);
    for (const [k, v] of Object.entries(M.mergeLs(carryLs(), B.ls, k => Object.keys(tomb).some(id => k.includes(id))))) takeLs(k, v);
    if (got.pt) { const m = M.planTimeMerge(planTime.json(null), got.pt); if (m.toA) takeLs('gsp.planTime', JSON.stringify(m.out)); }
    if (got.tn) { const m = M.taughtInMerge(taughtIn.json(null), got.tn); if (m.toA) takeLs('gsp.taughtIn', JSON.stringify(m.out)); }
    if (open && rows.some(r => r.id === open && r.toA)) S.again = false;   // nothing to push for it until it is closed and merged
  }
  // What goes up: the merged copy. A row's own "papers" says where they are kept, so it stays on each device.
  const out = { app: 'Grading Studio sync', v: 1, t: now, lib: libNow(), work: {}, meta: {}, tomb, ls: carryLs() };
  const ids = new Set([...Object.keys(A.work), ...Object.keys(A.meta), ...rows.map(r => r.id)]);
  for (const id of ids) {
    if (tomb[id]) continue;
    const row = rows.find(r => r.id === id), w = row ? row.work : A.work[id], m = row ? row.meta : A.meta[id];
    if (w) out.work[id] = w;
    if (m) { const { papers, size, ...rest } = m; out.meta[id] = rest; }
  }
  delete out.ls['gs.lib'];
  if (out.ls['gs.focus']) try { out.ls['gs.focus'] = JSON.stringify(M.focusShared(JSON.parse(out.ls['gs.focus']))); } catch {}
  out.plan = (await planOf()) || (got && got.plan) || null;
  out.planT = await planSync(got && got.planT, M);
  out.files = filesOut(got && got.files, tomb);
  const pt = planTime.json(null); if (pt && typeof pt === 'object') out.pt = pt;
  const tn = M.taughtInMerge(taughtIn.json(null), null).out; if (Object.keys(tn.items).length) out.tn = tn;
  const body = JSON.stringify(out);
  if (!got || body !== JSON.stringify({ ...got, t: now })) await write(body);
  coord('gs.syncAt', now);
  cloud(out.files);
  // the pictures of big lessons go up after the marks (a few seconds' worth each sync), and the copies made go in now
  if (P.liteMake && await P.liteMake()) {
    const t = await planSync(out.planT, M);
    if (t !== out.planT) { out.planT = t; await write(JSON.stringify(out)); }
  }
  setState('synced');
  S.onDone.forEach(f => f());
  P.upSoon();
}
export function syncNow() {
  if (!G.email || sampleOn()) return Promise.resolve();
  if (S.busy) { S.again = true; return S.busy; }
  clearTimeout(S.t); S.t = null;
  S.busy = (async () => {
    for (let tries = 1; ; tries++) {
      try { await once(); return; } catch (e) {
        // the other device saved first: merge again with what it saved, a little later each time, and stop after a few tries
        if (e && e.status === 412 && tries < 5) { await new Promise(r => setTimeout(r, 500 * 2 ** tries + Math.random() * 500)); continue; }
        console.warn(e); setState(e && (e.why === 'signin' || e.why === 'closed') ? 'signin' : e && e.why === 'away' ? 'away' : 'not'); return;
      }
    }
  })().finally(() => { S.busy = null; if (S.again) { S.again = false; syncNow(); } });
  return S.busy;
}
export function syncSoon() { if (!G.email || sampleOn()) return; clearTimeout(S.t); setState('saving'); S.t = setTimeout(syncNow, 15000); }
export async function signIn() {
  if (sampleOn()) return 'sample';
  if (!gcid()) return 'setup';
  await gToken(true);
  await whoAmI();
  syncNow();
  return G.email;
}

/* the Planner through Drive (src/app/drive.js planSync, planHere, planApply): lessons, units, the timetable, the comment bank,
   activities and words, both ways, in a file of its own. What changed here since the last sync is found by comparing with what
   was seen then (gs.planSeen). A lesson too big to send stays on its own device; a phone gets a copy of it with its pictures in
   Drive, made by whole/papers.js (planLite) once that part is loaded. */
const PLAN_NAME = 'grading-studio-plan.json', PLAN_KEYS = ['setup', 'units', 'bank', 'activities', 'words', 'deflook'], PLAN_BIG = 2e6;
const PF = { file: null };
const planVer = async () => String((await (await gsync('files/' + PF.file.id + '?fields=id,version')).json()).version || '');
async function planRead() {
  if (!PF.file) { const f = (await (await gsync('files?spaces=appDataFolder&orderBy=createdTime&fields=files(id)&q=' + encodeURIComponent("name='" + PLAN_NAME + "' and trashed=false"))).json()).files[0]; PF.file = f ? { id: f.id } : null; }
  if (!PF.file) return null;
  PF.file.ver = await planVer();
  try { return await (await gsync('files/' + PF.file.id + '?alt=media')).json(); } catch { return null; }
}
async function planWrite(body) {
  if (PF.file) {
    if (await planVer() !== PF.file.ver) throw Object.assign(new Error('changed on another device'), { status: 412 });
    await gsync('https://www.googleapis.com/upload/drive/v3/files/' + PF.file.id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  } else {
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify({ name: PLAN_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
    fd.append('file', new Blob([body], { type: 'application/json' }));
    PF.file = { id: (await (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id };
  }
  PF.file.ver = await planVer();
}
const planOutV = (k, v) => k === 'units' && Array.isArray(v) ? v.map(u => { if (!u || typeof u !== 'object') return u; const { _file, _mod, ...x } = u; return x; }) : v;
export const shaLite = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); };
async function planHere() {
  let seen = planSeen.json(null) || { keys: {}, ids: [], gone: {}, t: {} };
  let all = [], kvs = {};
  try {
    all = (await lessons.entries()).map(([, v]) => v);
    for (const k of PLAN_KEYS) { const v = await kv.get(k); if (v !== undefined) kvs[k] = planOutV(k, v); }
  } catch { return null; }
  if (!all.length && !Object.keys(kvs).length && (seen.ids || []).length) seen = { keys: {}, ids: [], gone: { ...(seen.gone || {}) }, t: {} };
  const A = { lessons: {}, kv: {}, gone: { ...(seen.gone || {}) } }, ids = new Set(), big = new Set(), bigInfo = {}, bigL = {}, liteL = {};
  for (const l of all) {
    if (!l || !l.id) continue;
    const { _file, _mod, _sync, ...x } = l, j = JSON.stringify(x); ids.add(x.id);
    if (x._lite || j.includes('"src":"gsblob:')) { liteL[x.id] = x; continue; }
    if (j.length > PLAN_BIG) { big.add(x.id); bigL[x.id] = x; bigInfo[x.id] = { title: String(x.title || '').slice(0, 200), slots: Array.isArray(x.slots) ? x.slots.map(s => ({ classId: s && s.classId, date: s && s.date })) : [], updated: x.updated || 0 }; continue; }
    A.lessons[x.id] = x;
  }
  const lost = [];
  for (const id of seen.ids || []) if (!ids.has(id) && !A.gone['l:' + id] && !(PHONE && (seen.lite || []).includes(id))) lost.push(id);
  for (const [k, v] of Object.entries(kvs)) { const h = shaLite(JSON.stringify(v)); A.kv[k] = { v, t: seen.keys[k] === h ? (seen.t[k] || 0) : seen.at ? -1 : null }; }
  const mine = !seen.at ? !!(all.length || Object.keys(kvs).length) : lost.length > 0 || JSON.stringify(bigInfo) !== JSON.stringify(seen.big || {}) || Object.values(A.kv).some(x => x.t === -1) || [...ids].some(id => !(seen.ids || []).includes(id) && !liteL[id]) || Object.values(A.lessons).some(l => (l.updated || 0) > (seen.at || 0))
    || (!PHONE && [...big].some(id => !(seen.liteDone || []).includes(id)));
  return { A, seen, big, bigInfo, bigL, liteL, lost, mine };
}
// The copies of big lessons for a phone (whole/papers.js): { made: id -> { updated, lite }, due: [] }.
export const LITE = { made: new Map(), due: [] };
async function planSync(remoteT, M) {
  LITE.due = [];
  if (sampleOn()) return remoteT;
  const here = await planHere(); if (!here) return remoteT;
  const { A, seen, big, bigInfo, bigL, liteL, lost, mine } = here;
  if (!mine && remoteT && remoteT === seen.planT) return remoteT;
  const now = Date.now(), B = (await planRead()) || { lessons: {}, kv: {}, gone: {} };
  for (const id of lost) A.gone['l:' + id] = now;
  for (const [k, x] of Object.entries(A.kv)) if (x.t === -1) x.t = now; else if (x.t === null) x.t = B.kv && B.kv[k] ? 0 : now;
  for (const id of big) { delete A.gone['l:' + id]; if (B.lessons && B.lessons[id]) A.lessons[id] = B.lessons[id]; }
  for (const id of Object.keys(liteL)) delete A.gone['l:' + id];
  const lite = {}, liteDone = [], waits = new Set();
  if (!PHONE) for (const id of big) {
    const u = bigL[id].updated || 0, m = LITE.made.get(id), d = B.lite && B.lite[id] && typeof B.lite[id] === 'object' && B.lite[id].id === id && (B.lite[id].updated || 0) === u ? B.lite[id] : null;
    if (m && m.updated === u) { if (m.lite) lite[id] = m.lite; liteDone.push(id); }
    else if (d && (seen.liteDone || []).includes(id)) { LITE.made.set(id, { updated: u, lite: d }); lite[id] = d; liteDone.push(id); }
    else { waits.add(id); LITE.due.push(bigL[id]); }
  }
  for (const id of LITE.made.keys()) if (!big.has(id)) LITE.made.delete(id);
  A.lite = lite;
  const Mg = M.mergePlan(A, B);
  const bigs = { ...(B.big && typeof B.big === 'object' ? B.big : {}) };
  for (const id of Object.keys(bigs)) if (Mg.gone['l:' + id] || (A.lessons[id] && !big.has(id))) delete bigs[id];
  for (const [id, b] of Object.entries(bigInfo)) bigs[id] = waits.has(id) ? { ...b, why: 'up' } : b;
  for (const id of Object.keys(bigs)) if (Mg.lite && Mg.lite[id] && (Mg.lite[id].updated || 0) >= ((bigs[id] && bigs[id].updated) || 0)) delete bigs[id];
  if (Object.keys(bigs).length) Mg.big = bigs;
  if (JSON.stringify(planBig.json(null) || {}) !== JSON.stringify(bigs)) savePref('gs.planBig', bigs);
  await planApply(A, Mg, big, liteL);
  const body = JSON.stringify(Mg), t = shaLite(body);
  const was = { keys: Object.fromEntries(Object.entries(Mg.kv).map(([k, x]) => [k, shaLite(JSON.stringify(x.v))])), t: Object.fromEntries(Object.entries(Mg.kv).map(([k, x]) => [k, x.t])), ids: [...new Set([...Object.keys(Mg.lessons), ...big])], gone: Mg.gone, big: bigInfo, lite: Object.keys(Mg.lite || {}), liteDone, at: now };
  savePref('gs.planSeen', { ...was, planT: null });
  if (JSON.stringify(B) !== body) await planWrite(body);
  savePref('gs.planSeen', { ...was, planT: t });
  return t;
}
async function planApply(A, M, big, liteL = {}) {
  const lite = PHONE && M.lite && typeof M.lite === 'object' ? M.lite : {}, had = {}, put = [];
  for (const id of new Set([...Object.keys(M.lessons), ...Object.keys(lite)])) {
    if (big.has(id)) continue;
    const f = M.lessons[id], c = lite[id] && typeof lite[id] === 'object' && lite[id].id === id ? lite[id] : null;
    const w = c && (!f || (c.updated || 0) > (f.updated || 0)) ? { ...c, _lite: 1 } : f, here = liteL[id] || A.lessons[id];
    if (!w || (liteL[id] && (w.updated || 0) < (liteL[id].updated || 0)) || JSON.stringify(here) === JSON.stringify(w)) continue;
    had[id] = here; put.push(w);
  }
  const del = Object.keys(M.gone).filter(k => k.startsWith('l:')).map(k => k.slice(2)).filter(id => (A.lessons[id] || liteL[id]) && !big.has(id));
  for (const id of del) had[id] = liteL[id] || A.lessons[id];
  const keys = Object.entries(M.kv).filter(([k, x]) => !A.kv[k] || JSON.stringify(A.kv[k].v) !== JSON.stringify(x.v)).map(([k, x]) => [k, x.v]);
  if (!put.length && !del.length && !keys.length) return;
  await takePlan({ put, del, keys, had, seenKv: Object.fromEntries(Object.entries(A.kv).map(([k, x]) => [k, x.v])), out: planOutV });
}

/* when it runs (src/app/drive.js): soon after a save, on coming back to the page, every five minutes while in front, and as the
   page is left with the key there is. Nothing asks Google for a new key while the page is out of sight. */
let started = false;
export function startDrive() {
  if (started || typeof window === 'undefined') return; started = true;
  const back = () => {
    if (!G.email || sampleOn()) return;
    if (gAuto() && !G_REDIRECT && G.token && G.exp - Date.now() < 15 * 60000 && !back.busy) { back.busy = true; gRenew().catch(() => {}).finally(() => { back.busy = false; syncNow(); }); return; }
    syncNow();
  };
  const leave = () => { G.quiet = true; if (S.t && G.email && gLive() && !sampleOn()) syncNow(); };
  window.addEventListener('focus', back);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { G.quiet = false; back(); } else leave(); });
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', () => { if (document.visibilityState === 'visible') G.quiet = false; });
  setInterval(() => { if (G.email && GOK && document.visibilityState === 'visible' && gLive() && !S.busy && !sampleOn()) syncNow(); }, 5 * 60000);
  try { new BroadcastChannel('gs-plan-out').onmessage = () => syncSoon(); } catch {}
  // Signed in last time: reconnect quietly when the page opens. On an iPhone's home screen that's a trip to Google and back, once an hour at most.
  if (GOK && G.email && gcid() && !sampleOn()) setTimeout(() => {
    if (G_REDIRECT && !gLive()) {
      if (navigator.onLine === false) return setState('offline');
      let last = 0; try { last = +sessionStorage.getItem('gs.gQuiet') || 0; } catch {}
      if (Date.now() - last > 50 * 60000) { try { sessionStorage.setItem('gs.gQuiet', String(Date.now())); } catch {} return gRedirect(SYNC_SCOPE, true); }
      return setState('signin');
    }
    gToken(false).then(() => { changed(); syncNow(); }).catch(() => setState('signin'));
  }, 400);
  // Back from signing in on Google's page with no account kept yet: finish signing in.
  if (GOK && G_REDIRECT && G.token && !G.email) setTimeout(() => whoAmI().then(() => syncNow()).catch(e => console.error(e)), 400);
  onGoogle(() => {});
}
