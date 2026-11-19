// The Planner folder's other files and writes, loaded only when one is linked (planning/write.js, app/plan/pfolder.jsx): units, the
// rubric bank, the README for the assistant, the check that a folder holds no grading files, and the planning side's writes for the
// folder itself (linkPlannerFolder, writePlannerFolderAll, saveFolderNote), each checked as every write in planning/write.js is.
import { writeFile, plannerFolder, writeLessonFile, writeTimetableFile, writeActivitiesFile } from './folder.js';
import { kv } from './index.js';
import { check, tell } from './write.js';
import { changePlannerRecord, readPlannerRecord, readPlannerValues } from './change.js';
import { existingFile, writeRecordFile, removeRecordFile, FolderFileChanged } from './folder-file.js';
import { mirrorCollection, mirrorRecord } from './folder-mirror.js';
import { withFolderLock } from './folder-lock.js';
import { saved } from '../shared/saved.js';
/* ---------- units, the rubric bank, and the folder written whole ---------- */
const pf = () => import('../engines/pfolder.js');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bare = u => { if (!u) return u; const { _file, _mod, _sync, ...content } = u; return content; };
function sameRecords(previous, current) {
  const byId = new Map(previous.map(r => [r.id, r]));
  return previous.length === current.length && current.every(r => same(byId.get(r.id), r));
}
const checkedBlob = id => readPlannerRecord('kv', 'file:' + id);

// A unit's referenced files are mirrored beside its JSON under the existing names.
async function writeUnitFile(u, dir, previous) {
  const P = await pf();
  const base = P.unitBase(u), name = base + '.unit.json', files = u.files || [];
  if (files.length) {
    const fd = await dir.getDirectoryHandle(base + ' files', { create: true });
    for (const x of files) {
      if (x.kind === 'doc') {
        const blob = await checkedBlob(x.id);
        if (blob) {
          const { docxOf } = await import('../engines/plantools.js');
          await writeFile(fd, x.name + '.docx', await docxOf(await blob.text(), x.name));
        }
        continue;
      }
      const existing = await existingFile(fd, x.name);
      if (existing && existing.size === x.size && existing.lastModified >= (x.added || 0)) continue;
      const blob = await checkedBlob(x.id);
      if (blob) await writeFile(fd, x.name, blob);
    }
  }
  const text = JSON.stringify(P.unitForFile({ ...u, files }), null, 2);
  try {
    const mod = await writeRecordFile(dir, name, text, u, previous);
    return { ...u, _file: name, _mod: mod };
  } catch (e) {
    if (e instanceof FolderFileChanged) {
      const latest = (await unitsList()).find(item => item.id === u.id);
      if (same(latest, u)) {
        // Units have no Versions screen. Keep the committed local version
        // before either Planner can import the independently edited file.
        const file = await existingFile(dir, name);
        const raw = file && await file.text();
        let incoming;
        try { incoming = JSON.parse(raw); } catch {}
        const { retainUnit, unitChanged } = await import('./unit-recovery.js');
        if (!incoming || unitChanged(u, incoming)) await retainUnit(dir, u);
      }
    }
    throw e;
  }
}
// On rename, remove an old attachment only after proving the new folder has
// the same bytes. Anything added or edited independently stays in place.
async function removeUnitReplica(dir, old, kept) {
  if (!await removeRecordFile(dir, old) || !kept || !old.files?.length) return;
  const folderName = unit => unit._file.replace(/\.unit\.json$/, ' files');
  const oldName = folderName(old), newName = folderName(kept);
  if (oldName === newName) return;
  let from, to;
  try { from = await dir.getDirectoryHandle(oldName); to = await dir.getDirectoryHandle(newName); }
  catch (e) { if (e.name === 'NotFoundError') return; throw e; }
  for (const ref of old.files) {
    const name = ref.kind === 'doc' ? ref.name + '.docx' : ref.name;
    const a = await existingFile(from, name), b = await existingFile(to, name);
    if (!a || !b || a.size !== b.size) continue;
    const left = new Uint8Array(await a.arrayBuffer()), right = new Uint8Array(await b.arrayBuffer());
    if (left.every((byte, i) => byte === right[i])) await from.removeEntry(name);
  }
  // A nonempty directory may contain the teacher's own files.
  for await (const entry of from.values()) return;
  await dir.removeEntry(oldName);
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
    const record = was && { id: x.id, _file: was.file, _mod: was.mod };
    if (was?.file === name && was.text === text && await existingFile(dir, name)) return;
    const mod = await writeRecordFile(dir, name, text, record);
    out[x.id] = { file: name, mod, text };
    if (record && record._file !== name) await removeRecordFile(dir, record);
    changed = true;
  };
  const ok = r => r && r.id && r.name;
  for (const r of (bank.rubrics || []).filter(r => ok(r) && Array.isArray(r.criteria) && r.criteria.length)) await one('rubrics', normRubric(r));
  for (const s of (bank.scales || []).filter(ok)) await one('scales', normBankScale(s));
  for (const id of Object.keys(out)) if (!seen.has(id)) {
    await removeRecordFile(dir, { id, _file: out[id].file, _mod: out[id].mod });
    delete out[id]; changed = true;
  }
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
  // If the directory cannot be inspected, the caller must leave it unlinked.
  for await (const [name, handle] of h.entries()) {
    if (name === 'gs-folder.json' && handle.kind === 'file') return true;
    if (name === 'Grading Studio' && handle.kind === 'directory') return true;
    if (/^(downloads|snapshots|library\.json|tombstones\.json)$/.test(name)) return true;
  }
  return false;
}

/* ---------- the Planner folder (src/planner/lessons.js folderLink, folderReconnect, folderWriteAll) ---------- */
// Links a folder picked by the teacher (null unlinks it). The caller has checked it holds no grading files (folder.js holdsGrading).
export async function linkPlannerFolder(h) {
  await withFolderLock(async () => {
    check('gs-lessons/kv/dir');
    if (h) await kv.put(h, 'dir'); else await kv.del('dir');
  });
  tell('gs-plan-out'); saved({ kind: 'plan', id: 'dir', side: 'planning' });
}
// Everything written to the folder: the README for the assistant, the folder's mark, the timetable, every lesson, unit, activity and
// rubric, as the current Planner does when the folder is linked or permission is given again. p: the plan as read (planning/plan.js).
const lessonList = () => readPlannerValues('lessons');
const unitsList = async () => (await readPlannerRecord('kv', 'units')) ?? [];

async function mirrorLesson(id, previous, f) {
  const read = key => readPlannerRecord('lessons', key);
  const acknowledge = async (key, before, written) => {
    let matched = false;
    await changePlannerRecord('lessons', key, current => {
      if (!same(current, before)) return;
      matched = true;
      return same(current, written) ? undefined : written;
    });
    return matched;
  };
  const write = async (stored, last) => {
    const copy = { ...stored };
    await writeLessonFile(copy, f, last);
    return copy;
  };
  return mirrorRecord(id, previous, f.dir, read, acknowledge, write);
}

async function mirrorUnits(before, force, f) {
  if (!f.ok) return;
  const dir = await f.dir.getDirectoryHandle('Units', { create: true });
  const read = async id => (await unitsList()).find(u => u.id === id);
  const acknowledge = async (id, source, written) => {
    let matched = false;
    await changePlannerRecord('kv', 'units', list => {
      const i = list?.findIndex(u => u.id === id) ?? -1;
      if (i < 0 || !same(list[i], source)) return;
      matched = true;
      if (!same(list[i], written)) {
        list[i] = written;
        return list;
      }
    });
    return matched;
  };
  return mirrorCollection(before, unitsList, (id, old) => mirrorRecord(id, old, dir, read, acknowledge,
    (stored, last) => writeUnitFile(stored, dir, last), removeUnitReplica), force);
}

// Timetable, activities and bank can also change while the file is being
// written. Repeat using fresh committed data until it matches the export.
async function mirrorKv(name, f) {
  let current = await readPlannerRecord('kv', name);
  for (;;) {
    const source = current;
    if (name === 'setup' && source) await writeTimetableFile(source, f);
    if (name === 'activities') await writeActivitiesFile(source || [], f);
    if (name === 'bank' && source) {
      const files = await readPlannerRecord('kv', 'bankFiles');
      const written = await writeBankFiles(source, files, f);
      if (written) await changePlannerRecord('kv', 'bankFiles', now => {
        if (!same(now, files)) throw new Error('Planner rubric files changed');
        return written;
      });
    }
    current = await readPlannerRecord('kv', name);
    if (same(source, current)) return;
  }
}

export async function writePlannerFolderAll(p) {
  return withFolderLock(async () => {
    check('gs-lessons/lessons');
    const f = await plannerFolder({ strict: true }); if (!f?.ok) return false;
    if (p.failed?.length) throw new Error('Planner folder source could not be read');
    (await import('./engine.js')).engine(p);
    await writeFolderNotes(f);
    await mirrorKv('setup', f);
    let knownLessons = await mirrorCollection(p.lessons, lessonList, (id, old) => mirrorLesson(id, old, f), true);
    let knownUnits = await mirrorUnits(p.units, true, f);
    await mirrorKv('activities', f);
    await mirrorKv('bank', f);
    // Edits to lessons during unit I/O and vice versa must also reach disk.
    for (;;) {
      const lessonsNow = await lessonList(), unitsNow = await unitsList();
      if (sameRecords(knownLessons, lessonsNow) && sameRecords(knownUnits, unitsNow)) break;
      knownLessons = await mirrorCollection(knownLessons, lessonList, (id, old) => mirrorLesson(id, old, f), false);
      knownUnits = await mirrorUnits(knownUnits, false, f);
    }
    tell('gs-plan-out'); saved({ kind: 'plan', id: 'dir', side: 'planning' });
    return true;
  });
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
export async function afterSave(name, value, was, f, token) {
  return withFolderLock(async () => {
    if (!token) f = await plannerFolder({ strict: true });
    if (!f?.ok) return;
    if (name === 'units') return mirrorUnits(Array.isArray(was) ? was : [], !was, f);
    return mirrorKv(name, f);
  }, token);
}

export async function finishLessonFile(lesson, folder, token) {
  return withFolderLock(async () => {
    if (!token) folder = await plannerFolder({ strict: true });
    if (!folder) return;
    let result;
    try { result = await mirrorLesson(lesson.id, lesson, folder); }
    catch (e) {
      // A pending export is retried by the scanner. If the file was edited
      // independently, the scanner brings it through the normal review path.
      await changePlannerRecord('lessons', lesson.id, current => {
        if (current && !current._sync && same(bare(current), bare(lesson))) return { ...current, _sync: 1 };
      });
      throw e;
    }
    if (result && same(bare(lesson), bare(result))) {
      Object.assign(lesson, result);
      if (!result._sync) delete lesson._sync;
    }
    return result;
  }, token);
}

export async function finishLessonRemoval(lesson, f) {
  if (!lesson._file) return;
  return withFolderLock(async () => {
    f = await plannerFolder({ strict: true });
    if (!f || await readPlannerRecord('lessons', lesson.id)) return;
    if (f.ok) await removeRecordFile(f.dir, lesson);
    else await changePlannerRecord('kv', 'syncGoneFiles', names => {
      if (!names?.includes(lesson._file)) return [...(names || []), lesson._file];
    });
  });
}
