// Reading the Planner folder (src/planner/lessons.js folderRead, planFolderCatchUp, profileFolderRead; units.js unitsFolderRead;
// activities.js actFolderRead; bank.js bankFolderRead): what the assistant added or changed there comes in. A file changed since
// the app last wrote it wins. A lesson the assistant changed keeps the teacher's own under Versions, and waits for her to look at it
// (pending, as the current Planner keeps it); a new one arrives marked "Ready for you" (status review, the current Planner's own
// word for a lesson the assistant has finished), so both show as arrived and not reviewed until she marks them Ready.
// Everything is saved through planning/write.js. Returns { added, changed }, or null when no folder can be read now.
import { textStrict } from '../shared/ls.js';
import { readPlannerRecord, changePlannerRecord } from './change.js';
import { openExistingStrict, NotThere } from '../shared/idb.js';
import { withFolderLock } from './folder-lock.js';
import { engine } from './engine.js';
import { plannerFolder } from './folder.js';
import { check, finishLessonSave, finishKvSave } from './write.js';
import { FolderFileChanged, removeRecordFile, replaceFileText } from './folder-file.js';
import { afterSave, finishLessonFile, saveFolderNote } from './folder-more.js';

const copy = v => JSON.parse(JSON.stringify(v));
const NEWER = 1500;   // a file within this of the app's own write is the app's own

// Screen reads can fall back to display defaults. A folder scan may write those records
// back, so it needs a successful read of each source and companion record first.
async function readImportPlan() {
  const keys = ['setup', 'units', 'activities', 'bank', 'bankFiles', 'deflook', 'words', 'profMod', 'syncGoneFiles'];
  const db = await openExistingStrict('gs-lessons');
  if (!db) throw new NotThere('gs-lessons');
  try {
    const { stored, lessons } = await new Promise((resolve, reject) => {
      const tx = db.transaction(['lessons', 'kv'], 'readonly'), kv = tx.objectStore('kv');
      const list = tx.objectStore('lessons').getAll(), values = keys.map(key => kv.get(key));
      tx.onabort = () => reject(tx.error || new Error('Planner folder read aborted'));
      tx.oncomplete = () => resolve({
        stored: Object.fromEntries(keys.map((key, i) => [key, values[i].result])), lessons: list.result
      });
    });
    let setup = stored.setup;
    if (setup == null) {
      const mirror = textStrict('gs.planCopy');
      if (mirror != null) setup = JSON.parse(mirror);
    }
    if (setup != null && !Array.isArray(setup.classes)) throw new Error('Invalid Planner timetable');
    return { ...stored, stored, lessons, setup, units: stored.units || [], activities: stored.activities || [] };
  } finally { db.close(); }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function importRecord(f, p, key, value, file = false, extra) {
  const was = p.stored[key];
  await changePlannerRecord('kv', key, (latest, store) => {
    if (!same(latest, was)) throw new Error('Planner record changed while reading the folder: ' + key);
    if (extra) extra(store);
    return value;
  });
  p[key] = p.stored[key] = value;
  await finishKvSave(key, value, was, file, f.lock);
}

// A missing optional file is ordinary. A failed read must keep the scan retryable.
async function optional(open) {
  try { return await open(); } catch (e) { if (e.name !== 'NotFoundError') throw e; return null; }
}
async function jsonFile(file) {
  const text = await file.text();
  try { return JSON.parse(text); } catch { return null; }
}

// After a sync from her other device: a lesson that changed there goes to its file here, and a lesson deleted there has its file
// taken away, or reading the folder would bring the old copy back.
async function catchUp(f, p) {
  const gone = p.syncGoneFiles || [];
  for (const name of gone) if (!p.lessons.some(l => l._file === name)) await optional(() => f.dir.removeEntry(name));
  if (gone.length) await changePlannerRecord('kv', 'syncGoneFiles', (latest, store) => {
    const keep = (latest || []).filter(name => !gone.includes(name));
    if (keep.length) return keep;
    store.delete('syncGoneFiles');
  });
  const conflicts = new Set();
  for (const l of p.lessons) if (l._sync) {
    try { await finishLessonFile(l, f, f.lock); }
    catch (e) { if (!(e instanceof FolderFileChanged)) throw e; conflicts.add(l.id); }
    // A changed external file is handled by readLessons, which keeps a version.
  }
  return conflicts;
}

// The pictures of a lesson file are in images/ beside it.
async function pictures(f, l, E) {
  let idir = null; const dir = async () => (idir ||= await f.dir.getDirectoryHandle('images'));
  const url = async p => { const b = await (await (await dir()).getFileHandle(p.slice(7))).getFile(); return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); }); };
  for (const s of l.slides) if (s.img && /^images\//.test(s.img.src)) {
    try {
      s.img.src = await url(s.img.src);
      if (!s.img.w) { const bm = await createImageBitmap(await (await fetch(s.img.src)).blob()); s.img.w = bm.width; s.img.h = bm.height; bm.close(); }
    } catch { delete s.img; }
  }
  for (const s of l.slides) for (const x of s.ctx || []) if (/^images\//.test(x.src)) { try { x.src = await url(x.src); } catch { x.src = ''; } }
  const T = l.slides.some(s => (s.img || (s.ctx || []).length || (s.video && !s.video.thumb))) ? await import('../engines/plantools.js') : null;
  if (!T) return;
  l.slides.forEach(s => { if (s.img && !T.imgSrc(s.img.src)) delete s.img; if (s.ctx) { s.ctx = s.ctx.filter(x => T.imgSrc(x.src)); if (!s.ctx.length) delete s.ctx; } });
  // the assistant gives just the link of a video
  for (const s of l.slides) if (s.video && T.ytId(s.video.url) && !s.video.thumb) { try { const v = await T.videoFrom(s.video.url); s.video = { ...v, start: s.video.start || v.start, title: s.video.title || v.title }; } catch {} }
}

// A lesson file changed outside the app (src/planner/review.js claudeChanged).
function changedThere(old, l, P, E) {
  if (!old) return;
  // The folder instructions reserve notebook entries and uploaded decks for the teacher.
  if ('notebook' in old) l.notebook = old.notebook; else delete l.notebook;
  for (const key of ['final', 'finals']) if (old[key] && !l[key]) l[key] = old[key];
  if (!l.taught && old.taught) l.taught = old.taught;   // a file written without the taught notes doesn't lose them
  if (JSON.stringify(old.slides.map(P.slideKey)) === JSON.stringify(l.slides.map(P.slideKey)) && old.title === l.title) { if (old.pending) l.pending = old.pending; return; }
  const version = { at: Date.now(), label: 'Before ' + P.plAi() + '’s changes', lesson: E.snap(old) };
  l.pending = old.pending || { at: Date.now(), before: copy(old.slides), title: old.title };
  return version;
}

// A pending export can contain progress that was never in the linked file. Distinct
// classes and dates coexist. For one slot the latest record wins, with local confirmation
// winning a tie. Save any displaced record in a readable lesson copy before reconciling.
async function reconcileTaught(dir, handle, source, fileLesson, local, incoming, E) {
  if (!local?._sync || !local.taught?.length) return;
  const key = t => t.classId + '|' + t.date;
  const disk = incoming.taught || [], browser = E.normTaught(local.taught);
  const merged = E.normTaught([...disk, ...browser].sort((a, b) => a.at - b.at));
  const winners = new Map(merged.map(t => [key(t), t]));
  const displaced = rows => rows.some(t => !same(t, winners.get(key(t))));
  check('gs-lessons/lessons');
  const { retainFolderCopy } = await import('./folder-recovery.js');
  if (displaced(browser)) await retainFolderCopy(dir, E.fileBase(local), '.lesson.json', JSON.stringify(E.lessonForFile(local, null), null, 2));
  if (displaced(disk)) await retainFolderCopy(dir, E.fileBase(incoming), '.lesson.json', source);
  if (!same(merged, disk)) {
    if (!same(local, await readPlannerRecord('lessons', local.id))) throw new Error('Lesson changed while reconciling teaching history');
    // Patch the original JSON so other file edits, including its image paths, survive intact.
    const original = new Map((Array.isArray(fileLesson.taught) ? fileLesson.taught : []).filter(Boolean).map(t => [key(t), t]));
    const taught = merged.map(t => ({ ...original.get(key(t)), ...t, agenda: t.agenda }));
    check('gs-lessons/lessons');
    incoming._mod = await replaceFileText(handle, source, JSON.stringify({ ...fileLesson, taught }, null, 2));
  }
  incoming.taught = merged;
}

async function readLessons(f, p, E, P, out, conflicts, only) {
  const files = only ? [[only.name, await f.dir.getFileHandle(only.name)]] : f.dir.entries();
  for await (const [name, h] of files) {
    if (h.kind !== 'file' || !/\.lesson\.json$/i.test(name)) continue;
    const file = await h.getFile(), mine = p.lessons.find(l => l._file === name);
    if (mine && !conflicts.has(mine.id) && mine._mod && file.lastModified <= mine._mod + NEWER) continue;
    const source = await file.text();
    let j; try { j = JSON.parse(source); } catch { continue; }
    if (!j || typeof j !== 'object' || (only && j.id !== only.id)) continue;
    const l = E.normLesson(j), old = p.lessons.find(x => x.id === l.id);
    if (old && old._file && old._file !== name) continue;   // a stale copy under an old name
    if (!old) { E.deckStart(l); if (!l.status) l.status = 'review'; }   // a new deck from the assistant: title, then agenda
    await pictures(f, l, E);
    l._file = name; l._mod = file.lastModified; if (old) l.created = old.created;
    await reconcileTaught(f.dir, h, source, j, old, l, E);
    const version = changedThere(old, l, P, E);
    // a new file gets its id, and its title and agenda slides, written back
    const normalize = !j.id || !old;
    if (normalize) l._sync = 1;   // catchUp retries a failed file write using this same lesson ID
    l.updated = Math.max(Date.now(), (old?.updated || 0) + 1);
    await changePlannerRecord('lessons', l.id, (latest, store, versions) => {
      if (!same(latest, old)) throw new Error('Lesson changed while reading the folder: ' + l.id);
      if (version) {
        const key = 'ver:' + l.id, read = versions.get(key);
        read.onsuccess = () => {
          const previous = read.result ?? [];
          if (!Array.isArray(previous)) { versions.transaction.abort(); return; }
          try { versions.put([version, ...previous].slice(0, E.MAX_VERSIONS), key); }
          catch { versions.transaction.abort(); }
        };
      }
      return l;
    }, version ? 'kv' : undefined);
    const s = await finishLessonSave(l, normalize, f.lock);
    const i = p.lessons.findIndex(x => x.id === s.id); if (i >= 0) p.lessons[i] = s; else p.lessons.push(s);
    old ? out.changed++ : out.added++;
  }
}

// The classic Planner flushes pending lessons on startup. Resolve an accessible conflict
// with this very file before reporting completion, whichever Planner the teacher opens next.
export async function recoverLessonFileConflict(id, error) {
  if (!(error instanceof FolderFileChanged)) return false;
  return withFolderLock(async lock => {
    const folder = await plannerFolder({ strict: true });
    if (!folder?.ok) return false;
    const p = await readImportPlan(), lesson = p.lessons.find(l => l.id === id);
    if (!lesson) return false;
    if (!lesson._sync) {
      if (lesson._file !== error.fileName || !lesson._mod) return false;
      const file = await (await folder.dir.getFileHandle(error.fileName)).getFile();
      return file.lastModified === lesson._mod;
    }
    const out = { added: 0, changed: 0 };
    await readLessons({ ...folder, lock }, p, engine(p), await import('../engines/pfolder.js'),
      out, new Set([id]), { id, name: error.fileName });
    return out.changed === 1;
  });
}

// Units/*.unit.json: the weeks, title, start and Atlas link. Files stay as the app has them.
async function readUnits(f, p, E, out) {
  const dir = await optional(() => f.dir.getDirectoryHandle('Units')); if (!dir) return;
  const list = p.units.slice(); let n0 = 0, firstNew = [];
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file' || !/\.unit\.json$/i.test(name)) continue;
    const file = await h.getFile(), mine = list.find(u => u._file === name);
    const j = await jsonFile(file); if (!j || typeof j !== 'object') continue;
    if (j.id && mine && mine._mod && file.lastModified === mine._mod) continue;
    const old = list.find(u => u.id === j.id) || mine;
    if (old && old._file && old._file !== name) continue;
    let n = E.normUnit({ ...j, id: old ? old.id : j.id });
    if (old) {
      const { importUnit } = await import('./unit-recovery.js');
      n = await importUnit(dir, old, n, file);
    } else n.files = [];   // attachments only come in through the app
    n._file = name; n._mod = file.lastModified;
    const i = list.findIndex(u => u.id === n.id); if (i >= 0) list[i] = n; else list.push(n);
    old ? out.changed++ : out.added++; n0++;
    if (!j.id) firstNew.push(n.id);
  }
  if (!n0) return;
  await importRecord(f, p, 'units', list);
  if (firstNew.length) {
    // Store each generated ID before normalizing its file. If I/O fails, a
    // retry finds the same unit by its source filename, even at the same mtime.
    await afterSave('units', list, list.filter(u => !firstNew.includes(u.id)), f, f.lock);
    p.units = p.stored.units = await readPlannerRecord('kv', 'units');
  }
}

// activities.json: the teacher's own activities.
async function readActivities(f, p, out) {
  const file = await optional(async () => (await f.dir.getFileHandle('activities.json')).getFile());
  if (!file) return;
  if (actSeen && file.lastModified === actSeen.mod && await actSeen.dir.isSameEntry(f.dir)) return;
  const j = await jsonFile(file); if (!Array.isArray(j)) return;
  const { normActivity } = await import('../engines/activities.js');
  const list = j.map(normActivity).filter(Boolean);
  if (!same(list, p.activities)) { await importRecord(f, p, 'activities', list); out.changed++; }
  actSeen = { dir: f.dir, mod: file.lastModified };
}
let actSeen = null;

// profile.json: the teacher's profile, loaded when it is new or changed (src/planner/lessons.js applySetup), so each computer picks
// it up: the timetable, units not here yet, a missing Atlas link, the default look.
async function readProfile(f, p, E, P) {
  const file = await optional(async () => (await f.dir.getFileHandle('profile.json')).getFile());
  if (!file || p.profMod === file.lastModified) return;
  const j = await jsonFile(file);
  if (!j || !Array.isArray(j.classes)) return;
  const was = p.setup || {}, old = id => (was.classes || []).find(x => x.id === String(id)) || {}, sun = P.meetsOn(0, j.classes);
  const monday = s => P.ymd(E.mondayOf(P.parseYmd(s), sun));
  const setup = { classes: j.classes.map(c => ({ id: String(c.id), name: String(c.name || c.id), course: String(c.course || ''), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#1F6FB2', ...((u => u ? { mb: u } : {})(P.mbUrl(c.mb) || P.mbUrl(old(c.id).mb))), meets: (c.meets || []).map(m => ({ dow: +m.dow, start: String(m.start || ''), end: String(m.end || ''), label: String(m.label || '') })) })),
    daysOff: (j.daysOff || []).map(d => ({ date: String(d.date), label: String(d.label || 'No school') })), events: (j.events || []).map(e => ({ date: String(e.date), to: e.to ? String(e.to) : '', label: String(e.label || '') })),
    template: typeof j.template === 'string' ? j.template : was.template || '',
    tplName: String(typeof j.template === 'string' ? (j.template ? j.tplName || 'Your template' : '') : was.tplName || '').slice(0, 120),
    semStart: /^\d{4}-\d\d-\d\d$/.test(j.semStart) ? monday(j.semStart) : '', semEnd: /^\d{4}-\d\d-\d\d$/.test(j.semEnd) ? monday(j.semEnd) : '',
    claudeUrl: /^https:\/\/claude\.ai\//.test(j.claudeUrl) ? String(j.claudeUrl) : '', profile: String(j.profile || '').slice(0, 80) };
  const deck = P.deckClean(j.deck); if (deck) setup.deck = deck;
  if (typeof j.sys === 'string' || typeof j.unitPlans === 'string' || (j.plain && !p.words)) {
    await importRecord(f, p, 'words', {
      ...p.words,
      sys: typeof j.sys === 'string' ? j.sys.slice(0, 40) : p.words?.sys || '',
      unit: typeof j.unitPlans === 'string' ? j.unitPlans.slice(0, 40) : p.words?.unit || ''
    });
  }
  await importRecord(f, p, 'setup', setup, true); E.L.setup = setup;
  let units = null;
  const profileUnits = new Set();
  for (const x of Array.isArray(j.units) ? j.units : []) {
    if (x.id) profileUnits.add(x.id);
    const u = E.normUnit(x), list = units || p.units, had = list.find(v => v.id === u.id);
    if (x.id && !had) (units ||= list.slice()).push(u);
    else if (had && !had.atlas && u.atlas) { units ||= list.slice(); units[units.indexOf(had)] = { ...had, atlas: u.atlas }; }   // fill in a missing Atlas link, nothing else
  }
  if (units) await importRecord(f, p, 'units', units);
  if (profileUnits.size) {
    // A previous attempt may have stored the unit before its folder write failed.
    await afterSave('units', p.units, p.units.filter(u => !profileUnits.has(u.id)), f, f.lock);
    p.units = p.stored.units = await readPlannerRecord('kv', 'units');
  }
  const { LOOKS } = await import('../engines/plantools.js');
  if (LOOKS[j.look] && !p.deflook) await importRecord(f, p, 'deflook', j.look);
  await saveFolderNote('profMod', file.lastModified);
}

// Rubrics/*.rubric.json and *.scale.json.
async function readBank(f, p, P, out) {
  const dir = await optional(() => f.dir.getDirectoryHandle('Rubrics')); if (!dir) return;
  const B = await import('../engines/pbank.js');
  const files = { ...(p.bankFiles || {}) }, byFile = new Map(Object.entries(files).map(([id, v]) => [v.file, { id, ...v }]));
  const bank = copy(p.bank || { rubrics: [], scales: [], gone: {}, units: [] }); bank.rubrics ||= []; bank.scales ||= []; bank.gone ||= {};
  let any = false;
  for await (const [name, h] of dir.entries()) {
    const kind = /\.rubric\.json$/i.test(name) ? 'rubrics' : /\.scale\.json$/i.test(name) ? 'scales' : null;
    if (h.kind !== 'file' || !kind) continue;
    const file = await h.getFile(), mine = byFile.get(name);
    if (mine && mine.text && file.lastModified <= mine.mod + NEWER) continue;
    const j = await jsonFile(file); if (!j || typeof j !== 'object') continue;
    const list = bank[kind], old = list.find(x => x.id === (j.id || (mine && mine.id)));
    if (old && files[old.id] && files[old.id].file !== name) continue;   // a stale copy under an old name
    const unit = j.unit ? (unitRef(p, j.unit) || B.normRef(j.unit)) : null;
    const item = kind === 'rubrics' ? B.normRubric({ ...j, id: old ? old.id : j.id, unit }) : B.normBankScale({ ...j, id: old ? old.id : j.id, unit });
    const dupe = list.find(x => x.id !== item.id && x.name.toLowerCase() === item.name.toLowerCase());
    if (dupe) item.name += ' (from ' + P.plAi() + ')';
    item.at = Date.now();
    const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item);
    list.sort((x, y) => B.bankNatural(x.name, y.name)); delete bank.gone[item.id];
    // a new file (or one whose name clashed) is written again by the bank's own write, with its id (or its new name)
    const again = !j.id || !!dupe;
    files[item.id] = { file: name, mod: file.lastModified, text: again ? '' : JSON.stringify(P.bankForFile(kind, item), null, 2) };
    old ? out.changed++ : out.added++; any = true;
  }
  if (!any) return;
  // The item and its filename/ID are one change. A file still awaiting its
  // generated ID has an empty text signature, and is retried after a disk error.
  await importRecord(f, p, 'bank', bank, false, store => store.put(files, 'bankFiles'));
  await afterSave('bank', bank, null, f, f.lock);
}
// A unit named in a file, as the bank refers to it (src/planner/bank.js unitRef).
function unitRef(p, x) {
  const u = p.units.find(u => u.course === String(x.course || '') && String(u.title || '').trim().toLowerCase() === String(x.title || '').trim().toLowerCase());
  return u ? { id: u.id, course: u.course, title: u.title } : null;
}

async function scanLinkedFolder() {
  const out = { added: 0, changed: 0 };
  try {
    // Unlinked and sample windows do not perform folder I/O or take a folder lock.
    if (!(await plannerFolder({ strict: true }))?.ok) return null;
    return await withFolderLock(async token => {
      // The teacher can change the link or its permission while this scan is queued.
      const f = await plannerFolder({ strict: true }); if (!f || !f.ok) return null;
      f.lock = token;
      let p = await readImportPlan();
      const catchingUp = p.lessons.some(l => l._sync);
      const conflicts = await catchUp(f, p);
      if (catchingUp) {
        const before = p.lessons;
        p = await readImportPlan();
        const present = new Set(p.lessons.map(l => l.id));
        for (const old of before) if (old._file && !present.has(old.id)) await removeRecordFile(f.dir, old);
      }
      const E = engine(p), P = await import('../engines/pfolder.js');
      await readLessons(f, p, E, P, out, conflicts);
      await readUnits(f, p, E, out);
      await readActivities(f, p, out);
      await readProfile(f, p, E, P);
      await readBank(f, p, P, out);
      return out;
    });
  } catch (e) { console.error(e); return { ...out, failed: true }; }
}

let running = null;
export function readPlannerFolder() {
  return (running ||= scanLinkedFolder().finally(() => { running = null; }));
}
