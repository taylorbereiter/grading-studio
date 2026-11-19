// The Planner folder's other files and writes, loaded only when one is linked (planning/write.js, app/plan/pfolder.jsx): units, the
// rubric bank, the README for the assistant, the check that a folder holds no grading files, and the planning side's writes for the
// folder itself (linkPlannerFolder, writePlannerFolderAll, saveFolderNote), each checked as every write in planning/write.js is.
import { writeFile, plannerFolder, writeLessonFile, writeTimetableFile, writeActivitiesFile } from './folder.js';
import { kv, lessons } from './index.js';
import { check, tell } from './write.js';
import { changePlannerRecord } from './change.js';
import { saved } from '../shared/saved.js';
const fileBlob = id => kv.get('file:' + id).catch(() => null);
/* ---------- units, the rubric bank, and the folder written whole ---------- */
const pf = () => import('../engines/pfolder.js');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bare = u => { if (!u) return u; const { _file, _mod, ...c } = u; return c; };
// Units/<course> - <title>.unit.json with its files beside it in "<same name> files" (src/planner/units.js unitFolderWrite). Only the
// units that changed since `was` (all of them when was is null) are written, as the current Planner writes the one she changed.
// Returns the units with _file and _mod set where they were written, or null when nothing was written.
export async function writeUnitFiles(list, was, f, fileBlob) {
  if (!f || !f.ok || !Array.isArray(list)) return null;
  const P = await pf(), dir = await f.dir.getDirectoryHandle('Units', { create: true });
  let out = null;
  for (let i = 0; i < list.length; i++) {
    const u = list[i]; if (!u || !u.id) continue;
    const old = Array.isArray(was) ? was.find(x => x && x.id === u.id) : null;
    if (was && old && same(bare(old), bare(u)) && old._file) continue;
    const base = P.unitBase(u), name = base + '.unit.json', files = Array.isArray(u.files) ? u.files : [];
    if (u._file && u._file !== name) {   // renamed: its files folder goes with it
      try { await dir.removeEntry(u._file); } catch {}
      try { await dir.removeEntry(u._file.replace(/\.unit\.json$/, ' files'), { recursive: true }); } catch {}
    }
    if (files.length) {
      const fd = await dir.getDirectoryHandle(base + ' files', { create: true });
      for (const x of files) {
        // documents go there as Word files, so the assistant and Word can both open them
        if (x.kind === 'doc') { const b = await fileBlob(x.id); if (b) { const { docxOf } = await import('../engines/plantools.js'); await writeFile(fd, x.name + '.docx', await docxOf(await b.text(), x.name)); } continue; }
        let have = null; try { have = await (await fd.getFileHandle(x.name)).getFile(); } catch {}
        if (have && have.size === x.size && have.lastModified >= (x.added || 0)) continue;
        const b = await fileBlob(x.id); if (b) await writeFile(fd, x.name, b);
      }
    }
    const n = { ...u, files };
    n._mod = await writeFile(dir, name, JSON.stringify(P.unitForFile(n), null, 2)); n._file = name;
    (out ||= list.slice())[i] = { ...u, _file: name, _mod: n._mod };
  }
  return out;
}
// Rubrics/<name>.rubric.json and <name>.scale.json (src/planner/bank.js bankFileWrite, bankFileRemove), each written only when its
// words changed; files: kv bankFiles, { id: { file, mod, text } }. Returns the new files record, or null when it is unchanged.
export async function writeBankFiles(bank, files, f) {
  if (!f || !f.ok || !bank) return null;
  const P = await pf(), { normRubric, normBankScale } = await import('../engines/pbank.js'), dir = await f.dir.getDirectoryHandle('Rubrics', { create: true });
  const out = { ...(files || {}) }, seen = new Set(); let changed = false;
  const one = async (kind, x) => {
    seen.add(x.id);
    const name = P.bankBase(kind, x), was = out[x.id], text = JSON.stringify(P.bankForFile(kind, x), null, 2);
    if (was && was.file !== name) { try { await dir.removeEntry(was.file); } catch {} }
    if (was && was.file === name && was.text === text) return;
    out[x.id] = { file: name, mod: await writeFile(dir, name, text), text }; changed = true;
  };
  const ok = r => r && r.id && r.name;
  for (const r of (bank.rubrics || []).filter(r => ok(r) && Array.isArray(r.criteria) && r.criteria.length)) await one('rubrics', normRubric(r));
  for (const s of (bank.scales || []).filter(ok)) await one('scales', normBankScale(s));
  for (const id of Object.keys(out)) if (!seen.has(id)) { try { await dir.removeEntry(out[id].file); } catch {} delete out[id]; changed = true; }
  return changed ? out : null;
}
// The README for the assistant and the folder's own mark (src/planner/lessons.js folderWriteAll), written when the folder is linked
// or permission is given again, under the teacher's own name for her assistant.
export async function writeFolderNotes(f) {
  if (!f || !f.ok) return;
  const P = await pf();
  await writeFile(f.dir, 'README - for ' + P.plAi() + '.md', P.folderReadme());
  await writeFile(f.dir, P.FOLDER_MARK, JSON.stringify({ kind: 'grading-studio-planner-folder', note: 'Planning only: lessons, units, the timetable, files added to units, rubrics and grading scales. Never student work or grades.' }, null, 2));
}
// The Planner folder must never be the grading folder or hold it: the assistant reads everything in it (src/planner/units.js
// notGradingFolder). True when h holds grading files.
export async function holdsGrading(h) {
  try { await h.getFileHandle('gs-folder.json'); return true; } catch {}
  try { await h.getDirectoryHandle('Grading Studio'); return true; } catch {}
  try { for await (const [n] of h.entries()) if (/^(downloads|snapshots|library\.json|tombstones\.json)$/.test(n)) return true; } catch {}
  return false;
}

/* ---------- the Planner folder (src/planner/lessons.js folderLink, folderReconnect, folderWriteAll) ---------- */
// Links a folder picked by the teacher (null unlinks it). The caller has checked it holds no grading files (folder.js holdsGrading).
export async function linkPlannerFolder(h) {
  check('gs-lessons/kv/dir');
  if (h) await kv.put(h, 'dir'); else await kv.del('dir');
  tell('gs-plan-out'); saved({ kind: 'plan', id: 'dir', side: 'planning' });
}
// Everything written to the folder: the README for the assistant, the folder's mark, the timetable, every lesson, unit, activity and
// rubric, as the current Planner does when the folder is linked or permission is given again. p: the plan as read (planning/plan.js).
export async function writePlannerFolderAll(p) {
  check('gs-lessons/lessons');
  const f = await plannerFolder(); if (!f || !f.ok) return false;
  (await import('./engine.js')).engine(p);
  await writeFolderNotes(f);
  if (p.setup) await writeTimetableFile(p.setup, f);
  for (const l0 of p.lessons) { const l = JSON.parse(JSON.stringify(l0)); try { await writeLessonFile(l, f); await lessons.put(l); } catch (e) { console.error(e); } }
  const u = await writeUnitFiles(p.units, null, f, fileBlob); if (u) await kv.put(u, 'units');
  await writeActivitiesFile(p.activities, f);
  if (p.bank) { const b = await writeBankFiles(p.bank, await kv.get('bankFiles'), f); if (b) await kv.put(b, 'bankFiles'); }
  tell('gs-plan-out'); saved({ kind: 'plan', id: 'dir', side: 'planning' });
  return true;
}
// What reading the folder keeps beside the records: kv bankFiles (where each rubric's file is), profMod (the profile.json last
// loaded) and syncGoneFiles (lesson files to take out, emptied once they are).
const FOLDER_KV = ['bankFiles', 'profMod', 'syncGoneFiles'];
export async function saveFolderNote(key, value) {
  if (!FOLDER_KV.includes(key)) throw new Error('Not a Planner folder record: ' + key);
  check('gs-lessons/kv/' + key);
  if (value == null) await kv.del(key); else await kv.put(value, key);
}
// After a save of units or the bank (planning/write.js saveKv): a unit she changed goes to Units/, and the bank's rubrics and scales
// to Rubrics/ (src/planner/units.js unitWriteSoon, bank.js bankWriteSoon); where each was written is kept with it (units' _file
// and _mod, kv bankFiles).
export async function afterSave(name, value, was, f) {
  if (name === 'units') {
    const written = await writeUnitFiles(value, Array.isArray(was) ? was : null, f, fileBlob);
    if (written) {
      await changePlannerRecord('kv', 'units', list => {
        if (!Array.isArray(list)) return;
        return list.map(u => {
          const file = written.find(v => v && u && v.id === u.id);
          return file && file._file && same(bare(file), bare(u)) ? { ...u, _file: file._file, _mod: file._mod } : u;
        });
      });
    }
  }
  if (name === 'bank') { const b = await writeBankFiles(value, await kv.get('bankFiles'), f); if (b) await kv.put(b, 'bankFiles'); }
}

export async function finishLessonFile(l, folder) {
  try { await writeLessonFile(l, folder); } catch (e) { console.error(e); l._sync = 1; }
  // Only apply the folder metadata for the revision actually written. An edit
  // or deletion during folder I/O must not be replaced by the old lesson.
  await changePlannerRecord('lessons', l.id, current => {
    if (!current || current.updated !== l.updated) return;
    for (const key of ['_file', '_mod', '_sync']) {
      if (key in l) current[key] = l[key]; else delete current[key];
    }
    return current;
  });
}
