// Opening an assignment's papers in the new app, the way the current app reopens a download kept in this browser
// (src/app/open.js intake with fromKeep, from src/app/kept.js reopenKept): the same lifted steps in the same order, so the same
// students, files, pages and marks come out. Nothing here writes: what the current app saves on opening (a card's batchId, a
// quiz from the card) is left for the first change the teacher makes, which saves through students/write.js.
import * as E from '../../engines/gopen.js';
import { use, setupOver, state, kget, DEFAULT_SETUP } from '../../engines/gcore.js';
import { meGrade, useLib } from '../../engines/gways.js';
import { useStore } from '../../engines/gstore.js';
import { prefs } from '../../students/prefs.js';
import { library, gradingSetup, meta } from '../../students/index.js';
import { keepPapers, saveLibrary, saveWork, bringBack } from '../../students/write.js';
import * as K from './carry.js';
import { PARTS } from '../router.js';
import { setOpenWork } from '../openwork.js';
import { saving } from '../../services/saving.js';
import { savedStamp } from '../../shared/tabs.js';
import '../engine-lines.js';   // the engines' own words in the language, before any paper is opened

export class NotKept extends Error { constructor(id) { super('The papers for this one aren’t kept in this browser.'); this.name = 'NotKept'; this.id = id; } }

// The kept downloads' rows (keptMeta), as loadKept reads them.
async function keptRows() { const m = new Map(); for (const [k, v] of await meta.entries()) m.set(k, v); return m; }

// Her usual way of grading as what a new assignment starts with (src/app/library.js gradeDefaultApply): DEFAULT_SETUP becomes her own.
const DEFAULT_OLD = JSON.parse(JSON.stringify(DEFAULT_SETUP));
function gradeDefaultApply(lib) {
  useLib(lib); const g = meGrade(), d = JSON.parse(JSON.stringify(g ? g.setup : DEFAULT_OLD));
  for (const k of Object.keys(DEFAULT_SETUP)) delete DEFAULT_SETUP[k];
  Object.assign(DEFAULT_SETUP, d);
}
async function begin() {
  useStore(prefs);
  const lib = library.json(null) || { classes: [], loose: { id: '', units: [] } };
  for (const c of lib.classes || []) { c.units ||= []; c.names ||= []; }
  lib.loose ||= { id: '', units: [] }; lib.loose.units ||= [];
  // fflate: a download kept as a ZIP is unzipped, and a .doc is told from a Word file, as the current app does
  gradeDefaultApply(lib);
  use({ lib, keptMeta: await keptRows(), setup: setupOver(gradingSetup.json(null)), batch: null, cur: 0, fflate: state().fflate || await PARTS.zip() });
  setOpenWork(null);
  return lib;
}
// The files of a download as intake reads them: ZIPs opened (a ZIP inside a student's folder opens inside that folder), junk left out.
async function rawOf(entries, label) {
  const raw = [];
  for (const e of entries) {
    if (E.junk(e.path)) continue;
    if (/\.zip$/i.test(e.path)) {
      const data = e.data || new Uint8Array(await e.file.arrayBuffer());
      const dir = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/') + 1) : '';
      try { E.unzipInto(data, dir, raw, dir ? 1 : 0); } catch { if (dir) raw.push({ path: e.path, data }); continue; }
      if (!label && !dir) label = e.path.split('/').pop().replace(/\.zip$/i, '');
      continue;
    }
    raw.push({ path: e.path, file: e.file, data: e.data });
  }
  return { raw, label };
}
// Each student's files, and the list of what is kept in this browser (every file, the house files too).
async function studentsOf(raw) {
  await E.srcRead(raw);
  await E.spellLikeSaved(raw);
  // a photo of a paper becomes a PDF page (makeFile, pictureToPdf), which needs pdf-lib: loaded first when there is one
  if (!state().PDFLib && raw.some(r => /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?|avif)$/i.test(r.path))) use({ PDFLib: await PARTS.pdflib() });
  const map = E.groupRaw(raw), keys = [...map.keys()].sort(E.natural), students = [], keepList = [];
  for (const key of keys) {
    const files = [];
    for (const r of map.get(key).sort((a, b) => E.natural(a.path, b.path))) {
      const data = r.data || (r.file ? new Uint8Array(await r.file.arrayBuffer()) : null);
      keepList.push({ path: r.path, data });
      if (!E.houseFile(r.path)) files.push(await E.makeFile(r.path, data));
    }
    if (!files.length && map.get(key).every(r => E.houseFile(r.path))) continue;
    students.push({ key, files, grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} });
  }
  return { students, keepList };
}

// question(q): how the screen asks which rubric to use when the card and the saved work disagree (returns 'a', 'b' or null).
// onStep(n, of): papers coming down from her Google Drive, the first time a download is opened on this device (src/app/drive.js dvPull).
export async function openKept(id, { question, onStep } = {}) {
  const lib = await begin();
  let rec = await E.paperGet(id);
  const S = saving();
  if (!rec && S && S.inDrive(id)) { await S.pull(id, onStep); rec = await E.paperGet(id); }
  if (!rec) throw new NotKept(id);
  let { raw, label } = await rawOf(rec.entries, rec.label);
  if (!raw.length) throw new NotKept(id);
  const { students } = await studentsOf(raw);
  const r = await assemble({ raw, label, students, lib, assignment: E.cardOfKept(id), question });
  // work just carried over from an older copy says so once, as the download opens (carrySay)
  if (r && carriedNow === id) { r.carried = true; carriedNow = null; }
  return r;
}
let carriedNow = null;

export class NothingIn extends Error { constructor() { super('Nothing found in what you dropped'); this.name = 'NothingIn'; } }
// Papers brought in (src/app/open.js intake, not from the kept list): the same steps, then the papers are kept in this browser and,
// for an assignment card, the card is linked to them (assignment.batchId), each through students/write.js. entries: [{ path, file|data }].
// A newer copy of a download already worked on brings that work over (mark/carry.js); carry(e) asks when it isn't plainly the same one.
export async function bringIn(entries, { label, assignment, question, carry, drive } = {}) {
  const lib = await begin();
  if (entries.length === 1 && /\.gswork$/i.test(entries[0].path)) throw new NothingIn();
  const got = await rawOf(entries, label);
  if (!got.raw.length) throw new NothingIn();
  const { students, keepList } = await studentsOf(got.raw);
  if (!students.length) throw new NothingIn();
  const id = E.batchIdOf(got.raw);
  if (assignment) assignment = (E.findItem(assignment.id) || {}).it || assignment;
  const paperList = keepList.filter(e => !E.houseFile(e.path));
  const sameSize = await K.changedInPlace(id, paperList).catch(e => { console.error(e); return []; });   // same names and sizes, different bytes
  const earlier = paperList.every(e => E.isNotes(e.data)) ? null : await K.findEarlier(id, paperList, assignment, carry).catch(e => { console.error(e); return null; });
  if (earlier && earlier.asg) assignment = earlier.asg;
  if (!assignment) assignment = E.cardOfKept(id);
  const r = await assemble({ raw: got.raw, label: got.label, students, lib, assignment, question, earlier, paperList });
  if (!r) return null;
  const b = r.batch;
  // a download she forgot, brought in again: kept, and saved straight away so it stays (src/folder.js folderPapers)
  const back = bringBack(id);
  await keepPapers(b, got.label, keepList);
  if (back && !earlier && !drive && !sameSize.length && !(b.fresh && b.keptWork && b.keptWork.scan)) await saveWork(id, d => { d.s = d.s || {}; }, { fresh: true });
  // the carried work is this download's first saved work, so it is there when the papers open for marking
  if (earlier) { const kw = b.keptWork; await saveWork(id, d => { for (const k of Object.keys(kw)) if (k !== 't' && kw[k] !== undefined) d[k] = kw[k]; }, { fresh: true }); carriedNow = id; }
  else if (b.fresh && b.keptWork && b.keptWork.scan) await saveWork(id, d => { d.s = {}; d.scan = b.keptWork.scan; }, { fresh: true });
  // papers picked in Drive: Return can save the marked ones next to them (batch.drive, as src/app/drive.js openFromDrive keeps it)
  if (drive) { b.drive = drive; await saveWork(id, d => { d.s = d.s || {}; d.drive = drive; }, { fresh: true }); }
  if (sameSize.length) { K.flagInPlace(sameSize); const c = b.carry; await saveWork(id, d => { d.carry = c; }, { fresh: true }); r.changed = sameSize.length; }
  if (assignment) {
    const aid = assignment.id, su = { ...state().setup, spot: undefined };
    await saveLibrary(l => { const f = findIn(l, aid); if (f) { f.batchId = id; f.opened = Date.now(); if (!f.setup || r.toCard) f.setup = su; } });
  }
  return r;
}
export const findIn = (l, id) => { for (const c of [...(l.classes || []), l.loose].filter(Boolean)) for (const u of c.units || []) for (const it of u.items || []) if (it.id === id) return it; return null; };

async function assemble({ raw, label, students, lib, assignment, question, earlier, paperList }) {
  const bid = E.batchIdOf(raw);
  const keptWork = await kget('work', bid);
  const work0 = E.newestWork(prefs.get(bid, null), keptWork);
  const rub = await rubricAt(assignment, work0, (assignment && assignment.name) || label || 'This download', question);
  if (!rub) return null;
  const batch = { id: bid, name: (assignment && assignment.name) || label || 'Your download', students, assignment: assignment || null, opened: Date.now() };
  let setup = state().setup;
  if (rub.su) setup = setupOver(rub.su);
  delete setup.spot;
  use({ batch, setup });
  setOpenWork(batch.id, batch);
  batch.keptWork = keptWork;
  // no work saved for it yet (papers just brought in): its first save makes the record (students/write.js saveWork fresh)
  if (!keptWork && !prefs.get(bid, null)) batch.fresh = true;
  if (earlier) await K.carryInto(earlier, paperList);   // or the work from the older copy of this download
  else if (paperList && !keptWork && !prefs.get(bid, null)) { const scan = await K.carryScan(bid, paperList).catch(e => { console.error(e); return null; }); if (scan) batch.keptWork = { t: Date.now(), s: {}, scan }; }
  const saved = E.newestWork(prefs.get(bid, null), batch.keptWork);
  await E.applyRubricPage();
  if (earlier) await K.carryRubric(earlier);
  await E.loadAdded();
  if (setup.rubricPage) await E.applyRubricPage(batch.students.filter(st => !st.files.some(f => f.virtual)));
  await E.loadRefs();
  await E.loadEdits();
  batch.revs = E.revsOf(E.revsBase(saved));
  batch.seen = savedStamp(bid);   // whose save this window opened (src/saving.js b.seen): a newer stamp means another window saved since
  batch.lastS = saved && saved.s;
  E.restore();
  await E.photoTurns();
  if (saved && saved.cls != null) batch.classId = saved.cls;
  E.rosterSort();
  if (earlier) K.carryRoster(earlier);
  if (batch.classId && (!saved || saved.cls == null)) Object.assign(batch.revs.ph, E.partHashes({ cls: batch.classId }));
  if (batch.restoredKey) { const k = batch.students.findIndex(st => st.key === batch.restoredKey); if (k >= 0) batch.restoredCur = k; }
  if (assignment && assignment.goal && !batch.goal && !assignment.batchId) batch.goal = assignment.goal;
  if (assignment && assignment.quiz && assignment.quiz.made && (!batch.quiz || JSON.stringify(batch.quiz.made) !== JSON.stringify(assignment.quiz.made))) batch.quiz = E.qmkFor(batch.quiz, assignment.quiz);
  else if (assignment && assignment.quiz && !batch.quiz && !assignment.batchId) batch.quiz = JSON.parse(JSON.stringify(assignment.quiz));
  const cur = Math.max(0, batch.restoredCur || 0);
  use({ cur });
  return { batch, setup: state().setup, lib, cur, toCard: !!rub.toCard };
}
// Which rubric the papers open with (src/app/open.js rubricAtOpen): the card's, or what the work was scored with, or the last one
// saved. When the two disagree and would change a score, the screen asks (question returns 'a' for the card's, 'b' for the work's).
async function rubricAt(card, work, name, question) {
  const mine = card && card.setup, own = work && work.setup;
  if (mine && own && E.rubricsDiffer(mine, own) && E.workScored(work)) {
    const said = question ? await question({ a: mine, b: own, name }) : 'b';
    return said && (said === 'a' ? { su: mine, said } : { su: own, said, toCard: true });
  }
  if (mine || own) return { su: mine || own };
  const last = setupOver(card ? gradingSetup.json(null) : state().setup), fit = E.workScored(work) ? E.rubricFitting(work, last) : null;
  if (fit) {
    const said = question ? await question({ a: last, b: fit, name, fit: true }) : 'b';
    return said && { su: said === 'a' ? last : fit, said };
  }
  return { su: card ? last : null };
}
