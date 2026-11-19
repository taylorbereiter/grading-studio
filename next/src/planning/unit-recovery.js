import { normUnit } from '../engines/planner.js';
import { unitBase, unitForFile } from '../engines/pfolder.js';
import { writeRecordFile } from './folder-file.js';

// Compare the fields the two Planners share, without generating revisions for a
// timestamp, a folder acknowledgement or an attachment's local blob identity.
export function unitChanged(local, incoming) {
  const material = u => unitForFile(normUnit({ ...u, updated: 1 }));
  return JSON.stringify(material(local)) !== JSON.stringify(material(incoming));
}

async function keepText(dir, unit, text) {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hash = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  const name = unitBase(unit).slice(0, 32) + ' - ' + hash + '.unit.json';
  const recovered = await dir.getDirectoryHandle('Recovered', { create: true });
  // Both Planners scan only the immediate files under Units. A retry can reuse
  // the same bytes, but must never overwrite a different recovery document.
  await writeRecordFile(recovered, name, text);
  const saved = await (await recovered.getFileHandle(name)).getFile();
  const readback = new Uint8Array(await saved.arrayBuffer());
  if (bytes.length !== readback.length || !bytes.every((b, i) => b === readback[i])) {
    throw new Error('Planner unit recovery file could not be verified');
  }
}

export function retainUnit(dir, unit) {
  const portable = unitForFile({ ...unit, files: unit.files || [] });
  return keepText(dir, unit, JSON.stringify(portable, null, 2));
}

export async function importUnit(dir, old, incoming, file) {
  const merged = { ...incoming, files: old.files || [], color: incoming.color || old.color };
  let displaced = !!incoming.notebook && incoming.notebook !== old.notebook;
  if (old.notebook) merged.notebook = old.notebook;
  else delete merged.notebook;
  // Each stored week is dated by its unit start and its position. If a week
  // was removed or added at the front, its neighbours' notes stay on their dates.
  const weeksApart = (Date.parse(incoming.start) - Date.parse(old.start)) / (7 * 86400000);
  const offset = Number.isInteger(weeksApart) ? weeksApart : 0;
  merged.weeks = incoming.weeks.map((week, i) => {
    const previous = old.weeks?.[offset + i];
    if (!previous) return week;
    const notes = previous.notes || '';
    if (week.notes && week.notes !== notes) displaced = true;
    return { ...week, notes };
  });
  if (unitChanged(old, merged)) await retainUnit(dir, old);
  // A full folder export can immediately follow this import. Preserve any
  // external teacher text that the ownership rules kept out of the active unit.
  if (displaced) await keepText(dir, incoming, await file.text());
  return merged;
}
