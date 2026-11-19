// The assistant box (src/planner/panel.js "the Claude box"): things gathered from the lesson, its books, videos, unit weeks and
// notebooks, kept as chips in kv "cbox" ({ text, chips }) exactly as the current Planner keeps them, so either app shows the same box.
// Each chip keeps its English label for the current Planner, which shows chip.label as stored; the new app names chips in the
// teacher's language from their kind (beside2.jsx). Copying builds plain, self-contained text from each chip: it names no folder,
// path or file on her computer (a file chip gives its name and, for a document, its words).
import { kv } from '../../planning/index.js';
import { savePlannerKv } from '../../planning/write.js';
import { toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { saveFailed } from './save.js';
import './les-lines.js';

const subs = new Set();
export const onBox = f => { subs.add(f); return () => subs.delete(f); };
const ping = b => { for (const f of subs) f(b); };
try { const ch = new BroadcastChannel('gs-cbox'); ch.onmessage = () => readBox().then(ping, () => {}); } catch { }
const tellOthers = () => { try { const ch = new BroadcastChannel('gs-cbox'); ch.postMessage('changed'); ch.close(); } catch { } };

export async function readBox() { const b = await kv.get('cbox'); return b && Array.isArray(b.chips) ? { text: String(b.text || ''), chips: b.chips } : { text: '', chips: [] }; }
export async function writeBox(b) { await savePlannerKv('cbox', { text: String(b.text || ''), chips: b.chips || [] }); ping(b); tellOthers(); }
// A chip to the box: { kind, label, ... } in the current Planner's shapes (slide, page, video, week, notebook, file, lesson, quote).
export async function boxAdd(chip, { quiet } = {}) {
  try { const b = await readBox(); b.chips.push(chip); await writeBox(b); if (!quiet) toast(t('les.box_added')); return true; }
  catch (e) { saveFailed(e); return false; }
}
// Dragged things carry a chip as JSON under this type (src/planner/panel.js data-chip), or a slide's place.
export const CHIP_TYPE = 'text/x-chip';
