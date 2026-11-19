// Lesson packs and files dropped on the app (src/planner/library.js packImport, src/planner/lessons.js drop): a pack is a .zip
// with pack.json ({ kind: 'grading-studio-lesson-pack', name, lessons, units }); its lessons go into Library > Past lessons under
// the pack's name (l.library), with their files, and a unit already here gets a missing unit plan link and files it lacks. A lesson
// file (.gslesson), a .lesson.json or a pack dropped anywhere opens or comes in. Planning files only, never a student's work.
import { unzip, strFromU8 } from 'fflate';
import { toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go, PARTS } from '../router.js';
import { engine } from '../../planning/engine.js';
import { saveLesson, saveLessonFile, saveKv } from '../../planning/write.js';
import { loadPlan } from '../../planning/plan.js';
import { saveFailed } from './save.js';
import './cal-lines.js';

const open = (u8, want) => new Promise((res, rej) => unzip(u8, { filter: want }, (e, z) => (e ? rej(e) : res(z))));
export const PACK_KIND = 'grading-studio-lesson-pack';

// Brings a pack in. The lessons made, or null when it was not a pack.
export async function packImport(p, file) {
  const E = engine(p), T = await import('../../engines/plantools.js');
  toast(t('cal.pack_opening', { name: file.name }));
  const u8 = new Uint8Array(await file.arrayBuffer());
  let z; try { z = await open(u8, f => f.name === 'pack.json'); } catch { toast(t('cal.zip_bad')); return null; }
  let j; try { j = JSON.parse(strFromU8(z['pack.json'])); } catch { toast(t('cal.pack_bad')); return null; }
  if (!j || j.kind !== PACK_KIND) { toast(t('cal.pack_bad')); return null; }
  const have = id => (p.lessons || []).some(l => l.id === id);
  const lessons = (Array.isArray(j.lessons) ? j.lessons : []).filter(x => x && Array.isArray(x.slides) && !have(x.id));
  const units = (Array.isArray(j.units) ? j.units : []).filter(x => x && (p.units || []).some(u => u.id === x.id));
  const want = new Set();
  for (const x of [...lessons, ...units]) for (const f of x.files || []) if (f && f.path) want.add(f.path);
  try { z = want.size ? await open(u8, f => want.has(f.name)) : {}; } catch { toast(t('cal.zip_bad')); return null; }
  const store = async f => { const d = z[f.path]; if (!d || d.length > E.MAX_FILE) return null; const id = E.lid(), b = new Blob([d], { type: String(f.type || '') || E.mimeOf(String(f.name || '')) }); await saveLessonFile(b, id); return { id, b }; };
  const made = []; let nf = 0, na = 0;
  for (const x of lessons) {
    const files = [];
    for (const f of x.files || []) { const s = await store(f); if (s) { files.push({ id: s.id, name: String(f.name || 'File'), kind: 'other', type: s.b.type, size: s.b.size, added: Date.now() }); nf++; } }
    const l = E.normLesson({ ...x, files, library: String(x.library || j.name || file.name.replace(/\.zip$/i, '')).slice(0, 120) });
    l.slides.forEach(s => { if (s.img && !T.imgSrc(s.img.src)) delete s.img; });
    made.push(await saveLesson(l));
  }
  let list = null;
  for (const x of units) {
    list ||= (p.units || []).map(u => ({ ...u, files: [...(u.files || [])] }));
    const u = list.find(v => v.id === x.id); let ch = false;
    if (!u.atlas && /^https?:\/\//.test(x.atlas || '')) { u.atlas = String(x.atlas); ch = true; na++; }
    for (const f of x.files || []) {
      if (u.files.some(g => g.name === f.name)) continue;
      const s = await store(f); if (!s) continue;
      u.files.push({ id: s.id, name: E.uniqueName(u, String(f.name || 'File')), kind: ['atlas', 'summative', 'other'].includes(f.kind) ? f.kind : 'other', type: s.b.type, size: s.b.size, added: Date.now() }); ch = true; nf++;
    }
    if (ch) u.updated = Date.now();
  }
  if (list && (na || nf)) await saveKv('units', list);
  const skipped = (j.lessons || []).length - lessons.length;
  toast([made.length ? t('cal.pack_lessons', { n: made.length }) : t('cal.pack_none'), nf ? t('cal.pack_files', { n: nf }) : '', na ? t('cal.pack_links', { n: na }) : '', skipped > 0 && made.length ? t('cal.pack_skipped', { n: skipped }) : ''].filter(Boolean).join(' '),
    made.length ? { ms: 8000, action: { label: t('cal.pack_see'), run: () => go('library', 'past') } } : {});
  return made;
}

// Files dropped where nothing else took them: a lesson file opens, a .lesson.json comes in, a pack goes to Past lessons.
export async function dropped(files) {
  try {
    const p = await loadPlan(), ok = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) { const ls = await packImport(p, f); if (ls && ls.length) ok.push(...ls); }
      else if (/\.gslesson$/i.test(f.name) || /\.json$/i.test(f.name)) { const T = await PARTS.tools(); const ls = /\.gslesson$/i.test(f.name) ? [await T.shareOpen(p, f)].filter(Boolean) : await T.importText(p, await f.text()); ok.push(...ls); }
    }
    if (ok.length === 1 && !ok[0].library) go('lesson', ok[0].id);
  } catch (e) { saveFailed(e); }
}
export const takes = f => /\.(zip|gslesson|json)$/i.test(f && f.name || '');
