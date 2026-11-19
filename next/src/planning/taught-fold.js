// After-class notes from the phone onto their lessons (src/planner/present.js taughtFold, audit hook H-053). The phone never writes a
// lesson: its note waits in gsp.taughtIn ({ items: { '<lesson>|<class>|<date>': { slide, of, x, t, f } } }) and is put on the lesson
// here, on a computer, when the app opens and when another window or the sync changes it, unless a note for that class and day was
// written here later. Once put on (or passed over) it is marked f: 1, so a note removed here stays removed.
import { normTaught } from '../engines/planner.js';
import { changeLesson } from './lesson-change.js';
import { readTaughtNotes, foldedTaught } from './taught-in.js';

const phone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches;
let running = null, again = false;
export function taughtFold() {
  if (phone()) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    do { again = false; await foldNow(); } while (again);
  })().catch(e => console.error(e)).finally(() => { running = null; });
  return running;
}
async function foldNow() {
  const T = readTaughtNotes(), grouped = new Map(), done = [];
  for (const [k, v] of Object.entries(T.items)) {
    if (!v || typeof v !== 'object' || v.f || !(+v.t > 0)) continue;
    const i = k.indexOf('|'), j = k.lastIndexOf('|'); if (i < 0 || j <= i) continue;
    const id = k.slice(0, i);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push({ key: k, classId: k.slice(i + 1, j), date: k.slice(j + 1), note: v });
  }
  for (const [id, notes] of grouped) {
    await changeLesson(id, lesson => {
      let taught = lesson.taught || [], changed = false;
      for (const { key, classId, date, note } of notes) {
        const matches = x => x.classId === classId && x.date === date;
        const had = taught.find(matches);
        if (!had || (had.at || 0) < +note.t) {
          const t = { classId, date, slide: note.slide, of: note.of, note: note.x, at: +note.t };
          if (had && had.agenda) t.agenda = had.agenda;
          taught = normTaught([...taught.filter(x => !matches(x)), t]);
          changed = true;
        }
        done.push([key, note.t]);
      }
      if (changed) return { ...lesson, taught };
    });
  }
  if (done.length) foldedTaught(done);
}
export function watchTaught() {
  taughtFold();
  window.addEventListener('storage', e => { if (e.key === 'gsp.taughtIn' && e.newValue) taughtFold(); });
}
