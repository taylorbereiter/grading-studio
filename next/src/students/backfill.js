// Counts the oldest kept downloads lack (audit H-047), filled in once a little after the app opens, as the current app does when it
// first reads the kept list (src/app/kept.js loadKept). Loaded on its own, so the first page doesn't carry it.
import { backfillCounts } from './write.js';
import { readLibrary, readKept, cardOf } from './counts.js';

export async function run() {
  const lib = readLibrary(), kept = await readKept();
  return backfillCounts(id => { const it = cardOf(lib, kept, id); return !!(it && it.type === 'fm'); });
}
