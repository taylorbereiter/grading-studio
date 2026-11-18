// A newer copy of a download (src/carryover.js): a download is known by its file names and sizes, so one new or changed file makes
// it look brand new. When papers come in with no work of their own, earlier work is looked through for an older copy; her marks and
// scores are copied in under the new download's id, and the older copy is never written to. The comparing and mapping are the
// current app's own (engines/gopen.js compareFiles, compareNames, matchLevel, mapPaths…); what this file adds is the reading of the
// earlier work through students/index.js and every write through students/write.js (carryExtras, carryEdits, markNewer, saveSetting).
// Loaded with mark/open.js.
import { state } from '../../engines/gcore.js';
import * as E from '../../engines/gopen.js';
import { quick, work, carryNo } from '../../students/index.js';
import { saveSetting, carryExtras, carryEdits, markNewer } from '../../students/write.js';
import { kdo, idbDo } from '../../engines/gstore.js';

const hasWork = d => !!d && !!d.s && Object.keys(d.s).length > 0;
const b = () => state().batch;

// Every download with saved work, newest copy of each, newest first (earlierWork).
async function earlierWork(id, keep = hasWork) {
  const all = new Map();
  for (const k of quick.ids()) { const key = quick.prefix + k; if (key !== id) all.set(key, quick.json(k, null)); }
  try { for (const [k, v] of await work.entries()) if (k !== id) all.set(k, E.newestWork(all.get(k), v)); } catch (e) { console.error(e); }
  return [...all].filter(([, d]) => keep(d)).sort((a, c) => (c[1].t || 0) - (a[1].t || 0));
}
// The same names and sizes as a download already kept, so the same id, but some bytes differ (changedInPlace).
export async function changedInPlace(id, list) {
  const rec = await E.paperGet(id); if (!rec || !rec.entries) return [];
  const old = new Map(rec.entries.map(e => [E.nfc(e.path), e]));
  return list.filter(e => { const o = old.get(E.nfc(e.path)); return o && o.data && e.data && !E.sameBytes(o.data, e.data); }).map(e => e.path);
}
// An older copy of this download, already worked on (findEarlier). ask(e) says whether to bring the work over when it isn't plainly
// the same download; e: { name, named, nOld, same, unchecked }. A no is kept (gs.carryNo), so it isn't asked again.
export async function findEarlier(id, list, assignment, ask) {
  if (hasWork(E.newestWork(quick.json(id.slice(quick.prefix.length), null), await work.get(id).catch(() => null)))) return null;
  if (list.some(e => E.hasGsTail(e.data))) return null;   // an exported file brings its own marks back
  const newKeys = new Set(list.map(e => E.nfc(E.studentOf(e.path)))), said = (carryNo.json({}) || {})[id] || [];
  const near = (await earlierWork(id)).filter(([k, d]) => !said.includes(k) && Object.keys(d.s).some(x => newKeys.has(E.nfc(x))))
    .sort(([a], [c]) => (assignment && assignment.batchId === c ? 1 : 0) - (assignment && assignment.batchId === a ? 1 : 0)).slice(0, 12);
  if (!near.length) return null;
  let best = null;
  for (const [k, d] of near) {
    const rec = await E.paperGet(k), m = state().keptMeta.get(k) || {}, linked = !!assignment && assignment.batchId === k;
    const c = rec && rec.entries ? E.compareFiles(rec.entries.filter(e => e.data && !E.houseFile(e.path)), list) : E.compareNames(d, list);
    const lvl = E.matchLevel(c, linked), score = lvl * 10 + c.same / Math.max(1, c.nOld + c.nNew);
    if (lvl && (!best || score > best.score)) best = { from: k, d, c, m, lvl, score, linked };
    if (linked) break;
  }
  if (!best) return null;
  if (best.lvl < 2 && !(ask && await ask({ name: best.m.name || '', named: best.c.named, nOld: best.c.nOld, same: best.c.same, unchecked: !!best.c.unchecked }))) {
    const no = carryNo.json({}) || {}; (no[id] ||= []).push(best.from); saveSetting('gs.carryNo', no);
    return null;
  }
  const f = best.m.asg && !assignment ? E.findItem(best.m.asg) : null;
  if (f) best.asg = f.it;
  return best;
}
// The older copy's work, its student and file names moved to the new download's (carryInto). Sets batch.keptWork and batch.carry.
export async function carryInto(e, list) {
  const { c, d, from } = e, bb = b(), keyOf = new Map(list.map(x => [E.nfc(E.studentOf(x.path)), E.studentOf(x.path)]));
  // files she added herself aren't in the papers, and they come along, so their marks do too
  const added = await idbDo('readonly', o => o.getAll(E.underId(from))).then(r => (r || []).filter(x => x.bid === from && x.key !== E.REF_KEY), () => []);
  for (const r of added) { c.map[r.path] ||= r.path; c.goneFiles = c.goneFiles.filter(p => p !== r.path); if (!keyOf.has(E.nfc(r.key))) keyOf.set(E.nfc(r.key), r.key); }
  const carry = { from, name: e.m.name || '', t: Date.now(), flags: c.flags, goneFiles: c.goneFiles, goneStudents: [], layouts: [], edits: [], unchecked: !!c.unchecked };
  const touched = st => Object.keys(c.flags).some(p => E.nfc(E.studentOf(p)) === E.nfc(st));
  for (const [p, k] of Object.entries(d.moved || {})) if (c.map[p] && !keyOf.has(E.nfc(k))) keyOf.set(E.nfc(k), k);
  const s = {}, P = E.mapPaths;
  for (const [key, o] of Object.entries(d.s)) {
    const nk = keyOf.get(E.nfc(key));
    if (!nk) { carry.goneStudents.push(key); continue; }
    const x = { ...o, f: P(o.f, c.map) || {}, h: P(o.h, c.map), tr: P(o.tr, c.map), r: P(o.r, c.map), sk: P(o.sk, c.map), inc: P(o.inc, c.map) };
    if (o.g && o.g.tries) x.g = { ...o.g, tries: o.g.tries.map(t => t.files ? { ...t, files: t.files.map(q => c.map[q] || q) } : t) };
    if (o.L || o.o) {
      if (touched(key)) { delete x.L; delete x.o; if (o.L) carry.layouts.push(nk); }
      else {
        if (o.L) x.L = o.L.map(l => ({ ...l, file: l.file && (c.map[l.file] || l.file), pages: l.pages.map(([p, n]) => [c.map[p] || p, n]) }));
        if (o.o) x.o = o.o.map(i => i.startsWith('f:') && c.map[i.slice(2)] ? 'f:' + c.map[i.slice(2)] : i);
      }
    }
    s[nk] = x;
  }
  const moved = d.moved ? Object.fromEntries(Object.entries(d.moved).filter(([p]) => c.map[p]).map(([p, k]) => [c.map[p], keyOf.get(E.nfc(k)) || k])) : undefined;
  const removed = d.removed ? Object.fromEntries(Object.entries(d.removed).filter(([p]) => c.map[p]).map(([p, r]) => [c.map[p], r.by && c.map[r.by] ? { ...r, by: c.map[r.by] } : r])) : undefined;
  const share = d.share && { ...d.share, boxes: E.mapBoxes(d.share.boxes, c.map), checked: E.mapBoxes(d.share.checked, c.map) };
  const scan = c.unchecked || !d.scan ? undefined : P(d.scan, Object.fromEntries(Object.entries(c.map).filter(([, to]) => !c.flags[to])));
  const grpMap = l => l && l.map(g => ({ ...g, k: g.k.map(k => keyOf.get(E.nfc(k)) || k), p: Object.fromEntries(Object.entries(g.p || {}).map(([k, p]) => [keyOf.get(E.nfc(k)) || k, c.map[p] || p])) }));
  const groups = grpMap(d.groups), groupsOwn = grpMap(d.groupsOwn);
  const clips = d.clips && d.clips.map(x => (x.p ? { ...x, p: c.map[x.p] || x.p } : x));
  const vrot = d.vrot && Object.fromEntries(Object.entries(d.vrot).map(([k, v]) => [c.map[k] || k, v]));
  bb.keptWork = { ...d, t: Date.now(), s, moved, removed, carry, scan, share, groups, groupsOwn, clips, vrot, lightPg: E.mapLit(d.lightPg, c.map), lightPgL: E.mapLit(d.lightPgL, c.map) };
  bb.carry = carry;
  // late files and readings sit beside the work under the download's id: copied, never moved (carryExtras)
  if (!await carryExtras(from, bb.id, added)) carry.extrasFailed = true;
  const m = state().keptMeta.get(from);
  if (m) { m.newer = bb.id; try { await markNewer(from, bb.id); } catch (er) { console.error(er); } }
}
// No older copy with marks or scores, but she may have answered about the very same page in one (carryScan).
export async function carryScan(id, list) {
  const said = d => !!d.scan && Object.values(d.scan).some(x => Object.values(x.rec || {}).some(r => r.off));
  for (const [k, d] of (await earlierWork(id, said)).slice(0, 12)) {
    const rec = await E.paperGet(k); if (!rec || !rec.entries) continue;
    const was = new Map(rec.entries.map(e => [E.nfc(e.path), e])), scan = {};
    for (const e of list) { const o = was.get(E.nfc(e.path)); if (o && d.scan[o.path] && E.sameBytes(o.data, e.data)) scan[e.path] = d.scan[o.path]; }
    if (Object.keys(scan).length) return scan;
  }
  return null;
}
// Her marks and Word fill-ins on the rubric page follow each student to it, and other Word edits come along (carryRubric).
export async function carryRubric({ c, d, from }) {
  const bb = b(), carry = bb.carry, id = bb.id, was = d.setup && d.setup.rubricPage, now = state().setup.rubricPage, sameRubric = !was || !now || was.id === now.id;
  const isRub = p => !c.map[p] && !c.goneFiles.includes(p) && E.rubricNamed(d, p);
  const stOf = key => bb.students.find(x => E.nfc(x.key) === E.nfc(key));
  const pageOf = key => { const st = stOf(key), f = sameRubric && st && st.files.find(f => f.virtual); return f ? f.path : null; };
  const left = new Set();
  for (const [key, o] of Object.entries(d.s)) {
    const to = pageOf(key), x = to && bb.keptWork.s[stOf(key).key];
    for (const part of ['f', 'h', 'tr', 'r', 'sk', 'inc']) for (const p of Object.keys(o[part] || {})) {
      if (c.map[p]) continue;
      if (x && isRub(p)) (x[part] ||= {})[to] = o[part][p];
      else if (!c.goneFiles.includes(p)) left.add(p);
    }
    if (!x) continue;
    if (x.L) x.L = x.L.map(l => ({ ...l, pages: l.pages.map(([p, n]) => [isRub(p) ? to : p, n]) }));
    if (x.o) x.o = x.o.map(i => i.startsWith('f:') && isRub(i.slice(2)) ? 'f:' + to : i);
  }
  try {
    const range = IDBKeyRange.bound(from + '|', from + '|￿');
    const keys = await kdo('edits', 'readonly', o => o.getAllKeys(range)) || [], vals = await kdo('edits', 'readonly', o => o.getAll(range)) || [];
    const put = [];
    keys.forEach((k, i) => {
      const path = k.slice(from.length + 1), to = isRub(path) ? pageOf((d.moved && d.moved[path]) || E.studentOf(path)) : c.map[path];
      if (to && !c.flags[to]) put.push([id + '|' + to, vals[i]]);
      else carry.edits.push(path);
    });
    if (put.length) await carryEdits(id, put);
  } catch (er) { console.error(er); carry.extrasFailed = true; }
  carry.goneFiles.push(...left);
}
export const carryRoster = e => E.carryRoster(e);
// Same names and sizes, different bytes: those files are flagged (flagInPlace).
export function flagInPlace(paths) {
  const bb = b();
  bb.carry ||= { from: null, name: '', t: Date.now(), flags: {}, goneFiles: [], goneStudents: [], layouts: [], edits: [], unchecked: false };
  for (const p of paths) bb.carry.flags[p] = 'changed';
}
export const lostPages = f => E.lostPages(f);
