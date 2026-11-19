// The assistant box (src/planner/panel.js "the Claude box"): things gathered from the lesson, its books, videos, unit weeks and
// notebooks, kept as chips in kv "cbox" ({ text, chips }) exactly as the current Planner keeps them, so either app shows the same box.
// Each chip keeps its English label for the current Planner, which shows chip.label as stored; the new app names chips in the
// teacher's language from their kind (beside2.jsx). Copying builds plain, self-contained text from each chip: it names no folder,
// path or file on her computer (a file chip gives its name and, for a document, its words).
import { readPlannerRecord, changePlannerRecord } from '../../planning/change.js';
import { saved } from '../../shared/saved.js';
import { tell } from '../../planning/write.js';
import { toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { saveFailed } from './save.js';
import './les-lines.js';

const subs = new Set();
export const onBox = f => { subs.add(f); return () => subs.delete(f); };
const ping = b => { for (const f of subs) f(b); };
try { const ch = new BroadcastChannel('gs-cbox'); ch.onmessage = () => readBox().then(ping, () => {}); } catch { }
let pending = Promise.resolve();

function boxRecord(value) {
  if (value === undefined) return { text: '', chips: [] };
  if (!value || !Array.isArray(value.chips)) throw new Error('Cannot read the saved assistant box');
  return { ...value, text: String(value.text || '') };
}
export async function readBox() {
  await pending;
  return boxRecord(await readPlannerRecord('kv', 'cbox'));
}
// Preserve the order of local inputs, and read the actual box inside the transaction for each edit.
export function changeBox(edit) {
  const task = pending.then(async () => {
    const box = await changePlannerRecord('kv', 'cbox', raw => edit(boxRecord(raw)));
    if (box === undefined) return;
    ping(box);
    tell('gs-cbox'); tell('gs-plan-out');
    saved({ kind: 'plan', id: 'cbox', side: 'planning' });
    return box;
  });
  pending = task.catch(() => {});
  return task;
}

// Remove only the chips displayed when the teacher pressed the control, including the right count of duplicates.
export function takeChips(chips, selected) {
  const rest = chips.slice(), removed = [];
  for (const chip of selected) {
    const key = JSON.stringify(chip);
    const i = rest.findIndex(x => JSON.stringify(x) === key);
    if (i >= 0) removed.push(...rest.splice(i, 1));
  }
  return { rest, removed };
}
// A chip to the box: { kind, label, ... } in the current Planner's shapes (slide, page, video, week, notebook, file, lesson, quote).
export async function boxAdd(chip, { quiet } = {}) {
  try { await changeBox(b => ({ ...b, chips: [...b.chips, chip] })); if (!quiet) toast(t('les.box_added')); return true; }
  catch (e) { saveFailed(e); return false; }
}
// Dragged things carry a chip as JSON under this type (src/planner/panel.js data-chip), or a slide's place.
export const CHIP_TYPE = 'text/x-chip';
