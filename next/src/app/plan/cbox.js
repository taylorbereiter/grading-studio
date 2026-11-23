// The assistant box (src/planner/panel.js "the Claude box"): things gathered from the lesson, its books, videos, unit weeks and
// notebooks, kept as chips in kv "cbox" ({ text, chips }) exactly as the current Planner keeps them, so either app shows the same box.
// Each chip keeps its English label for the current Planner, which shows chip.label as stored; the new app names chips in the
// teacher's language from their kind (beside2.jsx). Copying builds plain, self-contained text from each chip: it names no folder,
// path or file on her computer (a file chip gives its name and, for a document, its words).
import { readPlannerRecord, changePlannerRecord } from '../../planning/change.js';
import { saved } from '../../shared/saved.js';
import { tell } from '../../planning/write.js';
import { toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { saveFailed } from './save.js';
import './les-lines.js';
import './tool-lines.js';

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

// Where words picked by a right-click came from (plan/ctx.jsx), as the current Planner names it in the chip it keeps (English, as
// stored) and as the new app shows it in her language.
const enDay = d => new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const EN_WHERE = { week: v => 'Week of ' + enDay(v), unit: v => 'Unit “' + v + '”', doc: v => 'Document “' + v + '”', lesson: v => 'Lesson “' + v + '”', // not-words
  sem: () => 'Semester plan', units: () => 'Units', acts: () => 'Activity bank', past: () => 'Past lessons', bank: () => 'Rubrics', planner: () => 'Planner' }; // not-words
export const whereEn = w => (EN_WHERE[w && w.k] || EN_WHERE.planner)(w && w.v);
const WHERE = { week: 'les.where_week', unit: 'les.where_unit', doc: 'les.where_doc', lesson: 'les.where_lesson', sem: 'les.where_sem', units: 'les.where_units', acts: 'les.where_acts', past: 'les.where_past', bank: 'les.where_bank', planner: 'les.where_planner' };
const whereName = w => t(WHERE[w && w.k] || WHERE.planner, { v: w && w.k === 'week' ? date(new Date(w.v + 'T12:00'), { day: 'numeric', month: 'short' }) : (w && w.v) || '' });
export const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
// The chip's name in her language, from what it points at; the stored English label when the new app can't name it.
export function chipName(p, c) {
  const L = (p && p.lessons) || [];
  if (c.kind === 'slide') { const l = L.find(x => x.id === c.lesson), sl = l && l.slides[c.i]; if (!sl) return c.label || ''; return t('les.chip_slide', { lesson: l.title || '', n: c.i + 1 }) + (sl.title ? ': ' + sl.title : ''); }
  if (c.kind === 'page') return t('les.chip_page', { book: c.bookName || (c.label || '').split(', ')[0], n: c.page });
  if (c.kind === 'video') return t('les.chip_video', { url: c.url });
  if (c.kind === 'week' && c.unit) return t('les.chip_week', { unit: c.unit, n: c.n, of: c.of });
  if (c.kind === 'notebook') { const o = c.t === 'lesson' ? L.find(x => x.id === c.id) : c.t === 'unit' ? ((p && p.units) || []).find(x => x.id === c.id) : null; return t('les.chip_nb', { name: o ? o.title : t('tool.nb_general') }); }
  if (c.kind === 'lesson') { const l = L.find(x => x.id === c.lesson); return (l && l.title) || c.label || ''; }
  if (c.kind === 'quote' && c.where) return whereName(c.where) + (c.text ? ': “' + cut(c.text, 70) + '”' : '');
  if (c.kind === 'note' && c.about) return t('les.chip_note', { what: chipName(p, c.about) });
  return c.label || '';
}
