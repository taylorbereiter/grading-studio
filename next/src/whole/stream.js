// A Drive video on the marking screen (src/app/drive.js driveBytes, driveStreamOk, driveVideos, pickVidDir; src/video.js drvGet): played
// straight from Drive, a little at a time, through the new app's service worker (next/sw.js gs-drive/<id>), or brought down whole to be
// kept in this browser for offline. The worker asks the page for her key when it has none (gs-drive-token); this never opens a sign-in.
import { G, gToken, gfetch, gcid, gHas, gLive, PICK_SCOPE } from './google.js';
import { driveVideoDir } from '../planning/index.js';
import { savePref } from '../planning/write.js';
import { pick, VIDEO } from './pick.js';

// Signed in for the chooser's files right now, so a video can play or come down without asking anything.
export const pickReady = () => gLive() && gHas(PICK_SCOPE);
let on = false, asking = null;
// Whether this page's service worker plays Drive videos (the web address, not a preview).
export function streamOk() {
  const sw = typeof navigator !== 'undefined' && navigator.serviceWorker;
  if (!sw || !sw.controller) return Promise.resolve(false);
  if (on) return Promise.resolve(true);
  return asking || (asking = new Promise(res => {
    const ch = new MessageChannel(), done = v => { clearTimeout(to); asking = null; on = v; res(v); }, to = setTimeout(() => done(false), 1500);
    ch.port1.onmessage = e => done(!!(e.data && e.data.drive));
    try { sw.controller.postMessage({ type: 'gs-drive-ok' }, [ch.port2]); } catch { done(false); }
  }));
}
export const streamUrl = id => 'gs-drive/' + encodeURIComponent(id);
// The worker's ask for her key (whole/index.js passes it on).
export function answer(e) {
  const d = e.data || {}, p = e.ports && e.ports[0]; if (!p) return;
  if (d.fresh) { G.token = null; G.exp = 0; }
  (gcid() && gHas(PICK_SCOPE) ? gToken(false, 'pick') : Promise.reject(new Error('signin'))).then(t => p.postMessage({ token: t, exp: G.exp }), () => p.postMessage({ token: null }));
}
// One picked video's bytes, a piece at a time. onStep(got, total). interactive: only after a press.
export async function bytes(id, onStep, interactive) {
  const r = await gfetch('files/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', {}, interactive, 'pick');
  const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (onStep) onStep(got, total); }
  return new Blob(parts, { type: r.headers.get('content-type') || '' });
}
// Still in her Drive? Throws with the status when not.
export const check = id => gfetch('files/' + encodeURIComponent(id) + '?fields=id&supportsAllDrives=true', {}, false, 'pick');
export async function pickVidDir(labels) {
  const [d] = await pick({ folder: true, mimes: VIDEO, labels });
  if (d) savePref('gs.gVidDir', { id: d.id, name: d.name });
  return d || null;
}
// Videos she picks, opening in her videos folder (asking for the folder first, once).
// Through vidPick so the first load doesn't grow (app/mark/vdir.jsx): { dir: true } is Change folder, { now: true } the folder kept
export async function videos(o = {}) {
  if (o.dir) return pickVidDir();
  if (o.now) return driveVideoDir.json(null);
  let dir = driveVideoDir.json(null); if (!dir || !dir.id) { dir = await pickVidDir(o.labels); if (!dir) return []; }
  return pick({ parent: dir.id, parentName: dir.name, multi: !!o.multi, mimes: VIDEO, title: o.title, labels: o.labels });
}
