// Remove from this computer (src/takehome.js removeHere): all student work leaves this browser, the Planner's stays. The caller has
// asked her to type REMOVE and has every other window stop first. A linked folder isn't touched: this browser stops saving to it.
import { F } from './folder.js';
import { removeAllWork } from '../students/write.js';
import { dropSchoolFilesAndFocus } from '../planning/remove.js';
import { meta, lastBackup } from '../students/index.js';

// What the box warns about: how many downloads, and whether anything changed since the last take-home file.
export async function removeInfo() {
  const list = (await meta.entries()).map(([, m]) => m).filter(Boolean), last = +(lastBackup.json(0) || 0);
  return { n: list.length, last, newer: list.filter(m => (m.t || 0) > last).length, folder: F.state !== 'none' ? F.name : '' };
}
export async function removeHere() {
  if (F.mod && F.state !== 'none') await F.mod.unlink();
  await removeAllWork();
  await dropSchoolFilesAndFocus();
}
