// After-class notes from the phone onto their lessons (src/planner/present.js taughtFold, audit hook H-053). The phone never writes a
// lesson: its note waits in gsp.taughtIn ({ items: { '<lesson>|<class>|<date>': { slide, of, x, t, f } } }) and is put on the lesson
// here, on a computer, when the app opens and when another window or the sync changes it, unless a note for that class and day was
// written here later. Once put on (or passed over) it is marked f: 1, so a note removed here stays removed.
import { taughtIn } from './index.js';
import { loadPlan } from './plan.js';
import { engine } from './engine.js';
import { saveLesson, foldedTaught } from './write.js';

const phone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches;
let running = null;
export function taughtFold() {
  if (phone()) return Promise.resolve();
  if (!running) running = foldNow().catch(e => console.error(e)).finally(() => { running = null; });
  return running;
}
async function foldNow() {
  const T = taughtIn.json(null); if (!T || typeof T !== 'object' || !T.items || typeof T.items !== 'object') return;
  const p = await loadPlan(), E = engine(p), done = [], put = new Map();
  for (const [k, v] of Object.entries(T.items)) {
    if (!v || typeof v !== 'object' || v.f || !(+v.t > 0)) continue;
    const i = k.indexOf('|'), j = k.lastIndexOf('|'); if (i < 0 || j <= i) continue;
    const id = k.slice(0, i), base = put.get(id) || p.lessons.find(x => x.id === id); if (!base) continue;   // not here (yet): it waits
    const classId = k.slice(i + 1, j), date = k.slice(j + 1), had = (base.taught || []).find(x => x.classId === classId && x.date === date);
    if (!had || (had.at || 0) < +v.t) {
      const l = put.get(id) || JSON.parse(JSON.stringify(base)), t = { classId, date, slide: v.slide, of: v.of, note: v.x, at: +v.t };
      if (had && had.agenda) t.agenda = had.agenda;
      l.taught = E.normTaught([...(l.taught || []).filter(x => !(x.classId === classId && x.date === date)), t]); put.set(id, l);
    }
    done.push([k, v.t]);
  }
  if (!done.length) return;
  for (const l of put.values()) await saveLesson(l);
  foldedTaught(done);
}
export function watchTaught() {
  taughtFold();
  window.addEventListener('storage', e => { if (e.key === 'gsp.taughtIn' && e.newValue) taughtFold(); });
}
