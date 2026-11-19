// What spans both sides by nature (stage 2 brief, item 7): the folder copy, the Drive sync, the year file and take-home file, and
// the sample. Imported only by main.js and the proof page; it may use both sides, and neither side uses it (next/test/wall.test.js).
// Screens reach it through services/saving.js, which main.js hands its controls to.
// Every save through the layer comes here (shared/saved.js), one at a time, in the order they were made.
import { onSaved } from '../shared/saved.js';
import { folderSaved, folderState, onFolder, folderBoot, folderRun, F } from './folder.js';
import { markSyncDue, syncDue } from './due.js';
import { G, gAuto, setAuto, signOut, googleCan, onGoogle, G_REDIRECT, gHas, gLive, PICK_SCOPE } from './google.js';
import { provideSaving, changedSaving } from '../services/saving.js';
import { json as lsJson } from '../shared/ls.js';

let queue = Promise.resolve(), started = false, booting = Promise.resolve();
const fr = (k, ...p) => async (...a) => (await folderRun())[k](...p, ...a);
// The keys a save makes the current app sync for (src/app/drive.js SYNC_RX: gs.lib, setup, bank, rubrics, school, a download's quick
// copy). Lessons and planning time go up with the next sync of anything else, as they do today. What a sync or a folder took in
// (from) isn't news to send back.
const SYNCS = e => !e.from && (e.kind === 'work' || e.kind === 'library' || (e.kind === 'setting' && /^gs\.(setup|bank|rubrics)$/.test(e.id)) || (e.kind === 'pref' && e.id === 'gs.school'));
export function startWhole() {
  if (started) return; started = true;
  // The sync itself loads after the first screen is drawn (it brings the merge and the writes with it).
  let D = null;
  const drive = () => import('./drive.js').then(m => { if (!D) { D = m; m.startDrive(); } return m; });
  onSaved(e => { if (SYNCS(e)) { markSyncDue(); if (G.email) drive().then(m => m.syncSoon()); } queue = queue.then(() => folderSaved(e)).catch(err => console.error(err)); });
  if (G.email || G.token) setTimeout(drive, 0);
  onGoogle(changedSaving); onFolder(changedSaving);
  booting = folderBoot().catch(e => console.error(e));
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'gs-drive-token') import('./stream.js').then(m => m.answer(e)); });
  const V = () => import('./stream.js');
  provideSaving({
    google: () => ({ can: googleCan(), pickNow: googleCan() && (!G_REDIRECT || (gLive() && gHas(PICK_SCOPE))), email: G.email, state: D ? D.syncState() : '', at: +lsJson('gs.syncAt', 0) || 0, auto: gAuto(), paused: D ? D.paused() : false, redirect: G_REDIRECT }),
    signIn: async () => (await drive()).signIn(), signOut, setAuto,
    syncNow: async () => (await drive()).syncNow(),
    // papers waiting in Drive (whole/papers.js): fetched the first time a download is opened here
    inDrive: id => !!(G.email && (lsJson('gs.cloudP', null) || {})[id]),
    pull: async (id, onStep) => { await drive(); return (await import('./papers.js')).pull(id, onStep); },
    // Drive's chooser beside every place that takes files (whole/pick.js)
    driveFill: async (inp, o) => (await import('./pick.js')).fill(inp, o),
    drivePick: async o => (await import('./pick.js')).pick(o),
    driveSave: async (name, files, from, onStep) => (await import('./pick.js')).saveTo(name, files, from, onStep),
    driveFiles: async (picked, o = {}) => { const P = await import('./pick.js'); return P.filesOf(picked, P.kinds(o.accept, o.office).want, o.say); },
    // a Drive video (whole/stream.js): played from Drive through the worker, or brought down to keep here
    vidReady: () => googleCan() && gLive() && gHas(PICK_SCOPE),
    vidStreamOk: async () => (await V()).streamOk(),
    vidUrl: id => 'gs-drive/' + encodeURIComponent(id),
    vidBytes: async (id, onStep, interactive) => (await V()).bytes(id, onStep, interactive),
    vidCheck: async id => (await V()).check(id),
    vidPick: async o => (await V()).videos(o),
    // the videos folder the chooser opens in, and Change folder (src/video.js vidDir, pickVidDir)
    vidDir: () => lsJson('gs.gVidDir', null), vidPickDir: async () => (await V()).pickVidDir(),
    vidSignIn: async () => { const { gToken } = await import('./google.js'); return gToken(true, 'pick'); },
    pullOne: async (id, key) => { await drive(); return (await import('./papers.js')).pullOne(id, key); },
    // the linked folder (whole/folder.js, folder-run.js), going back to its dated copies, and this browser's safety copies (whole/safety.js)
    folder: () => ({ state: F.state, booted: F.booted, name: F.name, canPick: 'showDirectoryPicker' in window, ...(F.mod ? F.mod.info() : {}) }),
    folderPick: fr('pick'), folderUse: fr('use'), folderStop: fr('unlink'), folderResume: fr('resume', true), folderDecide: fr('decide'), folderWait: fr('wait'), snapList: fr('snaps'), goBack: fr('folderGoBack'),
    safetyList: async () => (await import('./safety.js')).snapshots(),
    // a forgotten download out of every safety copy (Forget these papers on the class page)
    safetyForget: async id => (await import('./safety.js')).forget(id),
    putBack: async id => { await (await import('./safety.js')).putBack(id); if (F.mod) F.mod.carryAfterPutBack(); },
    // the take-home file, a new school year and Remove from this computer (whole/takehome.js, newyear.js, remove.js)
    take: () => import('./takehome.js'), year: () => import('./newyear.js'), remove: () => import('./remove.js'),
  });
}
// Resolves when every save so far has reached the linked folder: the folder found again, the queue gone through, and the folder's own
// writes (which wait a moment to gather changes) finished.
export const settled = async () => { await booting; await queue; if (F.mod && F.state !== 'none') await F.mod.wait(); };
export const syncPayload = async o => (await import('./sync.js')).syncPayload(o);
export { folderState, onFolder, syncDue };
