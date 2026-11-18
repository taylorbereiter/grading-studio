// The grading side's saved work: papers, marks, scores, rosters and everything made from them. Planning code may not import
// this (next/test/wall.test.js); what the Planner needs from here goes through a named, read-only function in crossings.js.
import { idbStore, localKey, localFamily } from '../shared/records.js';
const S = 'students';

// Downloads (grading-studio-keep). A big download's papers are kept in pieces, "id|i|n"; paperFiles() puts them together.
export const papers = idbStore(S, 'grading-studio-keep', 'papers');
export const work = idbStore(S, 'grading-studio-keep', 'work');
export const meta = idbStore(S, 'grading-studio-keep', 'meta');
export const edits = idbStore(S, 'grading-studio-keep', 'edits');
export async function paperFiles(id) {
  const whole = await papers.get(id); if (whole !== undefined) return whole;
  const parts = await papers.entries(IDBKeyRange.bound(id + '|', id + '|￿'));
  return parts.length ? parts.map(([, v]) => v) : undefined;
}
// The quick copy of a download's work, and the list of which downloads have one (src/saving.js writeWork keeps both).
export const quick = localFamily(S, 'gs.b.');
export const quickList = localKey(S, 'gs.batches');
// The newest of the two copies of a download's work, as the current app picks it (src/saving.js newestWork).
export async function newestWork(id) {
  const a = quick.json(id.replace(/^gs\.b\./, '')), b = await work.get(id);
  return !a ? b || null : !b ? a : (b.t || 0) > (a.t || 0) ? b : a;
}

export const added = idbStore(S, 'grading-studio-added', 'files');
export const examples = idbStore(S, 'grading-studio-examples', 'ex');
export const examplePictures = idbStore(S, 'grading-studio-examples', 'pix');
// Every example record, the watch list's too: a watch-list picture is an ordinary record with watch: 1 (src/examples.js), and a
// deleted one stays as { id, u, gone: true } so a merge doesn't bring it back. [] in a browser that never kept one.
export const exampleRecords = async () => (await examples.entries()).map(([, v]) => v).filter(Boolean);
export const videos = idbStore(S, 'grading-studio-videos', 'v');
export const safetyCopies = idbStore(S, 'grading-studio-safety', 'meta');
export const safetyData = idbStore(S, 'grading-studio-safety', 'data');

export const library = localKey(S, 'gs.lib');
export const gradingSetup = localKey(S, 'gs.setup');
export const setupUndo = localKey(S, 'gs.setupUndo');
export const commentBank = localKey(S, 'gs.bank');
export const rubrics = localKey(S, 'gs.rubrics');
export const rubricsGone = localKey(S, 'gs.rubricsGone');
export const deleted = localKey(S, 'gs.tomb');
export const readings = localFamily(S, 'gs.rd.');
export const rubricPages = localFamily(S, 'gs.rp.');
export const dataVersion = localKey(S, 'gs.dataV');
export const carryNo = localKey(S, 'gs.carryNo');
export const historySame = localKey(S, 'gs.histSame');
export const pickerRolls = localKey(S, 'gs.rolls');
export const watchCodes = localKey(S, 'gs.wlCodes');
export const workTimer = localKey(S, 'gs.focus');
export const lastBackup = localKey(S, 'gs.lastBackup');
export const sheetFound = localKey(S, 'gs.sheetfound');
