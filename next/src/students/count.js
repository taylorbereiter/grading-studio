// Papers marked today (src/focus.js fcSeen, fcGain): each save of work tells the timer's log how far its download has come, before
// its row changes, and a session running hears of the papers the save finished. The counting is the lifted engine's
// (engines/gcount.js), handed every kept row as it stood before this save, the library, and the timer's store below.
import * as E from '../engines/gcount.js';
import { meta, workTimer, library } from './index.js';
import { focusRun, focusQueue, focusGo, planTime, timeCount } from '../planning/index.js';
import { readLibrary } from './counts.js';
import { saveSetting } from './write.js';

// What the lifted timer calls "store": gs.focus is saved work on this side (it goes with the folder and the take-home file); the
// session and the Planner's counts are the planning side's keys, read and written by the current app's pages as well.
const KEYS = { 'gsp.focusRun': focusRun, 'gsp.focusQ': focusQueue, 'gsp.focusGo': focusGo, 'gsp.planTime': planTime, 'gsp.timeCount': timeCount };
export const timerStore = {
  get(k, d) { const a = k === 'gs.focus' ? workTimer : k === 'gs.lib' ? library : KEYS[k]; if (!a) return d; const v = a.json(null); return v == null ? d : v; },
  set(k, v) { if (k === 'gs.focus') return saveSetting(k, v); const a = KEYS[k]; if (a) a.setJson(v); },
  del(k) { const a = KEYS[k]; if (a) a.remove(); },
};
export async function workCounted(id, m0, m) {
  const kept = new Map(await meta.entries());
  E.countUse({ lib: readLibrary(), keptMeta: kept, store: timerStore });
  E.fcSeen(id);
  E.fcGain(m0, m);
}
