// What spans both sides by nature (stage 2 brief, item 7): the folder copy, the Drive sync, the year file and take-home file, and
// the sample. Imported only by main.js and the proof page; it may use both sides, and neither side uses it (next/test/wall.test.js).
// Every save through the layer comes here (shared/saved.js), one at a time, in the order they were made.
import { onSaved } from '../shared/saved.js';
import { folderSaved, folderState, onFolder } from './folder.js';
import { markSyncDue, syncDue, syncPayload } from './sync.js';

let queue = Promise.resolve(), started = false;
// The keys a save makes the current app sync for (src/app/drive.js SYNC_RX: gs.lib, setup, bank, rubrics, school, a download's quick
// copy). Lessons and planning time go up with the next sync of anything else, as they do today.
const SYNCS = e => e.kind === 'work' || e.kind === 'library' || (e.kind === 'setting' && /^gs\.(setup|bank|rubrics)$/.test(e.id)) || (e.kind === 'pref' && e.id === 'gs.school');
export function startWhole() {
  if (started) return; started = true;
  onSaved(e => { if (SYNCS(e)) markSyncDue(); queue = queue.then(() => folderSaved(e)).catch(err => console.error(err)); });
}
// Resolves when every folder write so far has finished.
export const settled = () => queue;
export { folderState, onFolder, syncDue, syncPayload };
