// A new school year (src/newyear.js): everything from the year closing goes into one passphrase-protected file (the take-home
// format, info.kind 'year'), the file is read back and checked, and only then are this year's downloads cleared and the library
// carried on (engines/gyear.js nyLib). Opening an archived year saves the year here to its own checked file first, then puts the
// file's grading work in place of this browser's. The caller has every other window stop first (shared/tabs.js finish, over).
import { takeWrite, takeSink, takeOpen, takeScan, takeSource } from './takehome.js';
import { localState } from './apply.js';
import { carryLs, F } from './folder.js';
import { takeLs } from './carry.js';
import { snapshot, version, putBackData } from './safety.js';
import { papers, meta, library, exampleRecords, examplePictures, examples as exStore } from '../students/index.js';
import { dropDownload, keepExample, dropExample, takeLibrary, takePapers, takeExample, noteBackup, migrateLib } from '../students/write.js';
import { startNewYear, saveSchoolFile } from '../planning/write.js';
import { lessons, kv, schoolFiles } from '../planning/index.js';

const Y = () => import('../engines/gyear.js');
const libNow = () => { const l = library.json(null); return l ? migrateLib(l) : { classes: [], loose: { id: '', units: [] } }; };
const clone = o => JSON.parse(JSON.stringify(o));

// What the box shows: the year's name (guessed from the term dates unless she named it), the years archived, and what carries.
export async function yearInfo() {
  const G = await Y(), lib = libNow(); G.yearUse(lib);
  const now = G.nyGuess();
  let planner = false; try { planner = (await lessons.keys()).length > 0 || (await kv.keys()).length > 0; } catch {}
  return { now, next: G.nyNext(now), named: !!lib.year, years: Array.isArray(lib.years) ? lib.years : [], classes: (lib.classes || []).length, downloads: (await meta.keys()).length, planner };
}

// What has to be in the file: every download, the papers this browser keeps, the library, and as many Planner records as went in.
async function expect() {
  const A = await localState();
  return { ids: [...new Set([...Object.keys(A.meta), ...Object.keys(A.work)])].sort(), papers: (await meta.entries()).filter(([, m]) => m && m.papers).map(([id]) => id), lib: carryLs()['gs.lib'] || '' };
}
async function check(file, pass, want, onp) {
  const rd = await takeOpen(file, pass), B = await takeScan(rd, onp);
  const ids = [...new Set([...Object.keys(B.meta), ...Object.keys(B.work)])].sort();
  return JSON.stringify(ids) === JSON.stringify(want.ids) && want.papers.every(id => B.papers[id]) && (B.ls['gs.lib'] || '') === want.lib && (B.plan || []).length === want.plan;
}
// Makes the year's file and checks it. kind: what the save box calls it. onp(stage 'save' | 'check', bytes, of). Returns { name, size } or throws: AbortError
// (she closed the save box), or one with check: true (it didn't read back the same). Nothing here is changed either way.
export async function yearArchive(year, pass, kind, onp) {
  const G = await Y(), sink = await takeSink(G.nyFileName(year), kind), want = await expect();
  const total = (await meta.entries()).reduce((a, [, m]) => a + ((m && m.size) || 0), 0);
  try {
    const size = await takeWrite(sink, pass, n => onp && onp('save', n, total), null, { info: { kind: 'year', year }, onPlan: n => { want.plan = n; } });
    const file = await sink.file();
    if (onp) onp('check', 0, file.size);
    if (!await check(file, pass, want, n => onp && onp('check', Math.min(n, file.size), file.size))) throw Object.assign(new Error('The file did not match'), { check: true });
    await sink.save();
    noteBackup();
    return { name: sink.name, size };
  } catch (e) { try { await sink.abort(); } catch {} throw e; }
}

// The new year. o: { from, to, dates, planner, roster, file }.
export async function yearStart(o) {
  const G = await Y(), lib = libNow(), A = await localState();
  G.yearUse(lib);
  const ids = [...new Set([...Object.keys(A.meta), ...Object.keys(A.work), ...(await meta.keys())])];
  const next = G.nyLib(lib, A.work, o), names = G.nyNames(lib);
  try { await snapshot('Before starting ' + o.to, version()); } catch (e) { console.error(e); }
  if (F.mod && (F.state === 'ok' || F.state === 'decide')) { try { await F.mod.folderSnapshot('Before starting ' + o.to); } catch (e) { console.error(e); } }
  for (const id of ids) await dropDownload(id, 'local');
  const left = await meta.keys();
  if (left.length) throw new Error(left.length + ' downloads could not be cleared');
  // Anything else kept with her work that's about a student (keyed by name). Settings, the comment bank and saved rubrics stay;
  // the school's links, files and notes aren't about a student, whatever they're called.
  for (const [k, v] of Object.entries(carryLs())) {
    if (k === 'gs.lib' || k === 'gs.school') continue;
    let x; try { x = JSON.parse(v); } catch { continue; }
    if (G.nyAbout(x, names)) takeLs(k, null, 'local');
  }
  takeLibrary(migrateLib(next), 'local');
  // The watch list goes with the roster; a strong example is kept, no longer anyone's (src/watch.js wlNewYear).
  if (!o.roster) {
    try {
      for (const r of await exampleRecords()) {
        if (r.gone) continue;
        if (r.watch) await dropExample(r); else if (r.who) await keepExample({ ...r, who: null }, null);
      }
    } catch (e) { console.error(e); }
    takeLs('gs.wlCodes', null, 'local');
  }
  if (o.planner) startNewYear({ id: Date.now().toString(36), from: o.from, dates: !!o.dates });
}

// Opening an archived year: checks the whole file. Throws TakeError (pass, notours, newer, damaged).
export async function yearOpen(file, pass, onp) {
  const rd = await takeOpen(file, pass), B = await takeScan(rd, n => onp && onp(Math.min(n, rd.plainLen), rd.plainLen));
  return { B, rd, year: (B.info && B.info.year) || '', n: Object.keys(B.meta).length || (B.info && B.info.downloads) || 0, t: B.info && B.info.t };
}
// The work keys that belong to one year, and the ones that stay with this browser whatever year is open.
const YEAR_KEY = /^gs\.(b\..+|batches|tomb|dataV|wlCodes|rolls|setupUndo|refOpen\..*)$/;
// Puts the file's grading work in place of this browser's. The year that was here is already in its own checked file (was:
// { name, at, file }). The Planner is not changed; school files and examples belong to every year, so those here stay.
export async function yearReplace(opened, was) {
  const { B, rd } = opened, src = takeSource(rd, B);
  try { await snapshot('Before opening ' + (B.info.year || 'an archived year'), version()); } catch (e) { console.error(e); }
  if (F.mod && F.state !== 'none') await F.mod.unlink();
  const years = Array.isArray(libNow().years) ? libNow().years : [], carried = carryLs(), ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.') && !(k in carried) && !YEAR_KEY.test(k)) ls[k] = localStorage.getItem(k); }
  for (const [k, v] of Object.entries(B.ls || {})) if (k !== 'gs.dataV') ls[k] = v;
  // The archived library keeps the list of every year's file, the one just made included.
  try {
    const l = JSON.parse(ls['gs.lib'] || 'null');
    if (l) {
      const seen = new Set(), all = [...(Array.isArray(l.years) ? l.years : []), ...years, was].filter(y => y && y.name && !seen.has(y.name + '|' + y.file) && seen.add(y.name + '|' + y.file));
      if (!l.year && B.info.year) l.year = B.info.year;
      l.years = all.filter(y => y.name !== l.year);
      ls['gs.lib'] = JSON.stringify(migrateLib(l));
    }
  } catch (e) { console.error(e); }
  ls['gs.tomb'] = JSON.stringify(B.tomb || {});
  if (carried['gs.school']) {
    const M = await import('../engines/merge.js'), set = M.mergeLs({ 'gs.school': ls['gs.school'] }, { 'gs.school': carried['gs.school'] }, () => false);
    ls['gs.school'] = set['gs.school'] || ls['gs.school'] || carried['gs.school'];
  }
  const v = B.info && B.info.dataV;
  if (v && v < version()) ls['gs.dataV'] = String(v);
  const have = new Set(await schoolFiles.keys());
  for (const h of Object.keys(B.school || {})) if (!have.has(h)) { const b = await src.school(h); if (b) await saveSchoolFile(h, b); }
  // papers first: this year's go, the file's come in (their meta follows in the put back)
  for (const id of (await papers.keys()).filter(k => !String(k).includes('|'))) await dropDownload(id, 'local');
  for (const id of await meta.keys()) await dropDownload(id, 'local');
  const rec = { ls, stores: {} }, put = (where, k, x) => { const o = rec.stores[where] ||= { k: [], v: [] }; o.k.push(k); o.v.push(x); };
  for (const id of new Set([...Object.keys(B.meta), ...Object.keys(B.work), ...Object.keys(B.papers)])) {
    const p = await src.papers(id);
    if (p) await takePapers(id, p, 'take');
    for (const k of Object.keys((B.added && B.added[id]) || {})) { const r = await src.added(id, k); if (r) put('grading-studio-added/files', id + '|' + k, r); }
    for (const e of Object.keys((B.edits && B.edits[id]) || {})) { const r = await src.edit(id, e); if (r) put('grading-studio-keep/edits', id + '|' + e, r); }
    if (B.work[id]) put('grading-studio-keep/work', id, B.work[id]);
    const m = B.meta[id] || { id, name: (p && p.label) || 'A download', n: 0, t: (B.work[id] && B.work[id].t) || Date.now() };
    put('grading-studio-keep/meta', id, { ...m, papers: !!p, ...(p ? { size: p.entries.reduce((a, x) => a + (x.data ? x.data.length : 0), 0) } : {}) });
  }
  for (const [where, list] of [['grading-studio-examples/ex', await exStore.entries()], ['grading-studio-examples/pix', await examplePictures.entries()]]) for (const [k, x] of list) put(where, k, x);
  await putBackData(rec);
  // the year's own examples come back beside the ones here
  for (const r of Object.values(B.ex || {})) {
    if (r.gone || (await exStore.get(r.id))) continue;
    const blobs = await src.exPics(r); if (blobs && blobs.length === (r.pages || []).length) await takeExample(clone(r), blobs, 'take');
  }
}
