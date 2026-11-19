// Reading the Planner folder (src/planner/lessons.js folderRead, planFolderCatchUp, profileFolderRead; units.js unitsFolderRead;
// activities.js actFolderRead; bank.js bankFolderRead): what the assistant added or changed there comes in. A file changed since
// the app last wrote it wins. A lesson the assistant changed keeps the teacher's own under Versions, and waits for her to look at it
// (pending, as the current Planner keeps it); a new one arrives marked "Ready for you" (status review, the current Planner's own
// word for a lesson the assistant has finished), so both show as arrived and not reviewed until she marks them Ready.
// Everything is saved through planning/write.js. Returns { added, changed }, or null when no folder can be read now.
import { kv } from './index.js';
import { readAll } from './plan.js';
import { engine } from './engine.js';
import { plannerFolder } from './folder.js';
import { saveLesson, saveVersion, saveKv } from './write.js';
import { saveFolderNote } from './folder-more.js';

const copy = v => JSON.parse(JSON.stringify(v));
const NEWER = 1500;   // a file within this of the app's own write is the app's own

// After a sync from her other device: a lesson that changed there goes to its file here, and a lesson deleted there has its file
// taken away, or reading the folder would bring the old copy back.
async function catchUp(f, p) {
  const gone = (await kv.get('syncGoneFiles').catch(() => null)) || [];
  for (const name of gone) if (!p.lessons.some(l => l._file === name)) { try { await f.dir.removeEntry(name); } catch {} }
  if (gone.length) await saveFolderNote('syncGoneFiles', null);
  for (const l of p.lessons.filter(l => l._sync)) { const n = copy(l); delete n._sync; await saveLesson(n); }
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
async function changedThere(old, l, P, E) {
  if (!old) return;
  if (!l.taught && old.taught) l.taught = old.taught;   // a file written without the taught notes doesn't lose them
  if (JSON.stringify(old.slides.map(P.slideKey)) === JSON.stringify(l.slides.map(P.slideKey)) && old.title === l.title) { if (old.pending) l.pending = old.pending; return; }
  await saveVersion(old, 'Before ' + P.plAi() + '’s changes', E.snap, E.MAX_VERSIONS);
  l.pending = old.pending || { at: Date.now(), before: copy(old.slides), title: old.title };
}

async function readLessons(f, p, E, P, out) {
  for await (const [name, h] of f.dir.entries()) {
    if (h.kind !== 'file' || !/\.lesson\.json$/i.test(name)) continue;
    const file = await h.getFile(), mine = p.lessons.find(l => l._file === name);
    if (mine && mine._mod && file.lastModified <= mine._mod + NEWER) continue;
    let j; try { j = JSON.parse(await file.text()); } catch { continue; }
    const l = E.normLesson(j), old = p.lessons.find(x => x.id === l.id);
    if (old && old._file && old._file !== name) continue;   // a stale copy under an old name
    if (!old) { E.deckStart(l); if (!l.status) l.status = 'review'; }   // a new deck from the assistant: title, then agenda
    await pictures(f, l, E);
    l._file = name; l._mod = file.lastModified; if (old) l.created = old.created;
    await changedThere(old, l, P, E);
    // a new file gets its id, and its title and agenda slides, written back
    const s = await saveLesson(l, { file: !j.id || !old });
    const i = p.lessons.findIndex(x => x.id === s.id); if (i >= 0) p.lessons[i] = s; else p.lessons.push(s);
    old ? out.changed++ : out.added++;
  }
}

// Units/*.unit.json: the weeks, title, start and Atlas link. Files stay as the app has them.
async function readUnits(f, p, E, out) {
  let dir; try { dir = await f.dir.getDirectoryHandle('Units'); } catch { return; }
  const list = p.units.slice(); let n0 = 0, firstNew = [];
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file' || !/\.unit\.json$/i.test(name)) continue;
    const file = await h.getFile(), mine = list.find(u => u._file === name);
    if (mine && mine._mod && file.lastModified <= mine._mod + NEWER) continue;
    let j; try { j = JSON.parse(await file.text()); } catch { continue; }
    const old = list.find(u => u.id === j.id) || mine;
    if (old && old._file && old._file !== name) continue;
    const n = E.normUnit({ ...j, id: old ? old.id : j.id });
    if (old) { n.files = old.files; n.color = n.color || old.color; } else n.files = [];   // files only come in through the app
    n._file = name; n._mod = file.lastModified;
    const i = list.findIndex(u => u.id === n.id); if (i >= 0) list[i] = n; else list.push(n);
    old ? out.changed++ : out.added++; n0++;
    if (!j.id) firstNew.push(n.id);
  }
  if (!n0) return;
  // the rest are kept as read; a new file without an id is then written back with one (under the unit's own name)
  await saveKv('units', list.filter(u => !firstNew.includes(u.id)), { file: false });
  if (firstNew.length) await saveKv('units', list);
  p.units = list;
}

// activities.json: the teacher's own activities.
async function readActivities(f, p, out) {
  let file; try { file = await (await f.dir.getFileHandle('activities.json')).getFile(); } catch { return; }
  // the time it was last read is kept in memory, as the current Planner keeps it; the list is compared, so reading again is harmless
  if (actSeen && file.lastModified <= actSeen + NEWER) return;
  actSeen = file.lastModified;
  let j; try { j = JSON.parse(await file.text()); } catch { return; }
  const { normActivity } = await import('../engines/activities.js');
  const list = (Array.isArray(j) ? j : []).map(normActivity).filter(Boolean);
  if (JSON.stringify(list) === JSON.stringify(p.activities || [])) return;
  await saveKv('activities', list, { file: false }); p.activities = list; out.changed++;
}
let actSeen = 0;

// profile.json: the teacher's profile, loaded when it is new or changed (src/planner/lessons.js applySetup), so each computer picks
// it up: the timetable, units not here yet, a missing Atlas link, the default look.
async function readProfile(f, p, E, P) {
  let file; try { file = await (await f.dir.getFileHandle('profile.json')).getFile(); } catch { return; }
  if ((await kv.get('profMod').catch(() => null)) === file.lastModified) return;
  let j; try { j = JSON.parse(await file.text()); } catch { return; }
  if (!j || !Array.isArray(j.classes)) return;
  await saveFolderNote('profMod', file.lastModified);
  const was = p.setup || {}, old = id => (was.classes || []).find(x => x.id === String(id)) || {}, sun = P.meetsOn(0, j.classes);
  const monday = s => P.ymd(E.mondayOf(P.parseYmd(s), sun));
  const setup = { classes: j.classes.map(c => ({ id: String(c.id), name: String(c.name || c.id), course: String(c.course || ''), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#1F6FB2', ...((u => u ? { mb: u } : {})(P.mbUrl(c.mb) || P.mbUrl(old(c.id).mb))), meets: (c.meets || []).map(m => ({ dow: +m.dow, start: String(m.start || ''), end: String(m.end || ''), label: String(m.label || '') })) })),
    daysOff: (j.daysOff || []).map(d => ({ date: String(d.date), label: String(d.label || 'No school') })), events: (j.events || []).map(e => ({ date: String(e.date), to: e.to ? String(e.to) : '', label: String(e.label || '') })),
    template: typeof j.template === 'string' ? j.template : was.template || '',
    tplName: String(typeof j.template === 'string' ? (j.template ? j.tplName || 'Your template' : '') : was.tplName || '').slice(0, 120),
    semStart: /^\d{4}-\d\d-\d\d$/.test(j.semStart) ? monday(j.semStart) : '', semEnd: /^\d{4}-\d\d-\d\d$/.test(j.semEnd) ? monday(j.semEnd) : '',
    claudeUrl: /^https:\/\/claude\.ai\//.test(j.claudeUrl) ? String(j.claudeUrl) : '', profile: String(j.profile || '').slice(0, 80) };
  const deck = P.deckClean(j.deck); if (deck) setup.deck = deck;
  if (typeof j.sys === 'string' || typeof j.unitPlans === 'string' || (j.plain && !(await kv.get('words').catch(() => null)))) await saveKv('words', { sys: String(j.sys || '').slice(0, 40), unit: String(j.unitPlans || '').slice(0, 40) });
  await saveKv('setup', setup); p.setup = setup; E.L.setup = setup;
  let units = null;
  for (const x of Array.isArray(j.units) ? j.units : []) {
    const u = E.normUnit(x), list = units || p.units, had = list.find(v => v.id === u.id);
    if (x.id && !had) (units ||= list.slice()).push(u);
    else if (had && !had.atlas && u.atlas) { units ||= list.slice(); units[units.indexOf(had)] = { ...had, atlas: u.atlas }; }   // fill in a missing Atlas link, nothing else
  }
  if (units) { await saveKv('units', units); p.units = units; }
  const { LOOKS } = await import('../engines/plantools.js');
  if (LOOKS[j.look] && !p.deflook) { await saveKv('deflook', j.look); p.deflook = j.look; }
}

// Rubrics/*.rubric.json and *.scale.json.
async function readBank(f, p, P, out) {
  let dir; try { dir = await f.dir.getDirectoryHandle('Rubrics'); } catch { return; }
  const B = await import('../engines/pbank.js');
  const files = { ...((await kv.get('bankFiles').catch(() => null)) || {}) }, byFile = new Map(Object.entries(files).map(([id, v]) => [v.file, { id, ...v }]));
  const bank = copy(p.bank || { rubrics: [], scales: [], gone: {}, units: [] }); bank.rubrics ||= []; bank.scales ||= []; bank.gone ||= {};
  let any = false;
  for await (const [name, h] of dir.entries()) {
    const kind = /\.rubric\.json$/i.test(name) ? 'rubrics' : /\.scale\.json$/i.test(name) ? 'scales' : null;
    if (h.kind !== 'file' || !kind) continue;
    const file = await h.getFile(), mine = byFile.get(name);
    if (mine && file.lastModified <= mine.mod + NEWER) continue;
    let j; try { j = JSON.parse(await file.text()); } catch { continue; }
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
  await saveFolderNote('bankFiles', files);
  await saveKv('bank', bank); p.bank = bank;
}
// A unit named in a file, as the bank refers to it (src/planner/bank.js unitRef).
function unitRef(p, x) {
  const u = p.units.find(u => u.course === String(x.course || '') && String(u.title || '').trim().toLowerCase() === String(x.title || '').trim().toLowerCase());
  return u ? { id: u.id, course: u.course, title: u.title } : null;
}

let running = null;
export function readPlannerFolder() {
  return (running ||= (async () => {
    const f = await plannerFolder(); if (!f || !f.ok) return null;
    const out = { added: 0, changed: 0 };
    let p = await readAll(); const E = engine(p), P = await import('../engines/pfolder.js');
    try { await catchUp(f, p); } catch (e) { console.error(e); }
    p = await readAll(); engine(p);
    try { await readLessons(f, p, E, P, out); } catch (e) { console.error(e); return { ...out, failed: true }; }
    try { await readUnits(f, p, E, out); } catch (e) { console.error(e); }
    try { await readActivities(f, p, out); } catch (e) { console.error(e); }
    try { await readProfile(f, p, E, P); } catch (e) { console.error(e); }
    try { await readBank(f, p, P, out); } catch (e) { console.error(e); }
    return out;
  })().finally(() => { running = null; }));
}
