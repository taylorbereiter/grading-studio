// The linked Planner folder (the current Planner's "Planner folder", kv "dir"): a lesson saved here also goes to its file there,
// exactly as src/planner/lessons.js folderWrite writes it. Pictures go to images/<slide id>-<hash>.png|jpg (written only when not
// there yet), the lesson to "<date> - <title>.lesson.json" with two-space JSON, the old file is removed when the name changes, and
// the record keeps _file and _mod (the file's time) so the current Planner knows the file is its own and doesn't read it back in.
//
// Without permission to write there now (the browser asks again after a restart), the lesson is kept with _sync: 1, and the
// current Planner writes its file the next time it opens with the folder (planFolderCatchUp), as it does for a lesson that came
// by Drive. The sample never writes to a folder.
import { kv, lessons } from './index.js';

async function writeFile(dir, name, data) { const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close(); return (await fh.getFile()).lastModified; }

// The folder handle, or null when none is linked. { dir, ok }: ok is false while permission must be asked for again.
export async function plannerFolder() {
  if (typeof window !== 'undefined' && window.__gsSample && window.__gsSample.on) return null;
  const dir = await kv.get('dir').catch(() => null); if (!dir) return null;
  let p = 'denied'; try { p = await dir.queryPermission({ mode: 'readwrite' }); } catch {}
  return { dir, ok: p === 'granted' };
}
// l: the lesson as it is being stored (it gets _file and _mod, or _sync). Returns 'written', 'later' or 'none'.
export async function writeLessonFile(l, f) {
  if (!f) return 'none';
  if (!f.ok) { l._sync = 1; return 'later'; }
  const { lessonForFile, fileBase, b64ToU8 } = await import('../engines/planner.js');
  const imgs = new Map(), data = lessonForFile(l, imgs), name = fileBase(l) + '.lesson.json';
  if (imgs.size) { const idir = await f.dir.getDirectoryHandle('images', { create: true }); for (const [p, src] of imgs) { try { await idir.getFileHandle(p.slice(7)); } catch { await writeFile(idir, p.slice(7), b64ToU8(src.split(',')[1])); } } }
  if (l._file && l._file !== name) { try { await f.dir.removeEntry(l._file); } catch {} }
  l._mod = await writeFile(f.dir, name, JSON.stringify(data, null, 2)); l._file = name;
  delete l._sync;
  return 'written';
}
// A lesson deleted: its file goes too (src/planner/lessons.js folderRemove). Without permission now, its name is left for the
// current Planner to remove when it next opens (kv syncGoneFiles, as a lesson deleted on another device is).
export async function removeLessonFile(l, f) {
  if (!f || !l._file) return;
  if (f.ok) { try { await f.dir.removeEntry(l._file); } catch {} return; }
  const gone = (await kv.get('syncGoneFiles').catch(() => null)) || [];
  if (!gone.includes(l._file)) await kv.put([...gone, l._file], 'syncGoneFiles');
}
export { lessons as lessonStore };
