// What starts a little after the app opens and nothing on the first screen needs, kept out of the first load (stage 8 brief: the
// first load is full). Email links open the teacher's way (app/mailcatch.js, D-023); kept videos nothing names any more are cleared
// (students/write.js sweepVideos, H-048), a little after opening and after a download goes. While this address is moving
// (site.json movingTo, app/saving/moving.jsx), someone with work here is told once a day (src/moving.js moveAsk).
import { onSaved } from '../shared/saved.js';
import { mailClick } from '../app/mailcatch.js';
import { json as lsJson } from '../shared/ls.js';

export function startLater() {
  document.addEventListener('click', mailClick, true);
  const sweep = () => import('../students/write.js').then(m => m.sweepVideos()).catch(err => { if (!(err && /lock|ReadOnly|CannotSave/.test(err.name + err.message))) console.error(err); });
  setTimeout(sweep, window.__gsSweepMs || 20000);
  onSaved(e => { if (e.kind === 'papers' && e.gone) setTimeout(sweep, 0); });
  if (window.__gsMove || __GS_MOVE__) setTimeout(async () => {
    try {
      const has = ((lsJson('gs.lib', null) || {}).classes || []).length || (await (await import('../students/index.js')).meta.keys()).length;
      if (has) (await import('../app/saving/moving.jsx')).moveAsk();
    } catch (e) { console.error(e); }
  }, 1200);
}
