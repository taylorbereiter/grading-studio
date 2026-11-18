// The rubric bank as Rubric setup reads and writes it (src/rubrics.js bankRead, bankWrite, bankRubrics, savedRubrics): the Planner's
// kv "bank" = { rubrics, scales, gone } and its units, and grading's own list of saved rubrics (gs.rubrics, gs.rubricsGone), which the
// take-home file and older copies still carry; any there that the bank hasn't got are listed too. Only a rubric's wording and a
// scale's percents: never a score, a name or anything about a student. Each change is one undo step that puts all three back.
import { bank as bankRec, units as unitRec } from '../planning/index.js';
import { saveKv } from '../planning/write.js';
import { rubrics as savedRec, rubricsGone as goneRec } from './index.js';
import { saveSetting } from './write.js';
import * as undo from '../services/undo.js';

const J = o => JSON.parse(JSON.stringify(o));
const tidy = b => ({ rubrics: Array.isArray(b && b.rubrics) ? b.rubrics : [], scales: Array.isArray(b && b.scales) ? b.scales : [], gone: b && b.gone && typeof b.gone === 'object' ? b.gone : {} });
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const okRubric = r => r && r.id && r.name && Array.isArray(r.criteria) && r.criteria.length;
const okScale = s => s && s.id && s.name && s.scale && typeof s.scale === 'object';
const saved = () => { const a = savedRec.json([]); return Array.isArray(a) ? a.filter(okRubric) : []; };
export const uid = () => Math.random().toString(36).slice(2, 10);

// { rubrics, scales, units }: the bank's, with grading's own saved rubrics it hasn't got (and that weren't deleted since)
export async function readBank() {
  const [b0, us] = await Promise.all([bankRec.get().catch(() => null), unitRec.get().catch(() => null)]);
  const b = tidy(b0), gone = { ...(goneRec.json({}) || {}), ...b.gone };
  const own = b.rubrics.filter(okRubric), more = saved().filter(r => !own.some(x => x.id === r.id) && !(gone[r.id] >= (r.at || 0)));
  const units = (Array.isArray(us) ? us : []).filter(u => u && u.id).map(u => ({ id: String(u.id), course: String(u.course || ''), title: String(u.title || ''), start: String(u.start || ''), weeks: Array.isArray(u.weeks) ? u.weeks.length : 1 }));
  return { rubrics: own.concat(more).map(r => ({ ...r, criteria: r.criteria.map(c => (c && typeof c === 'object' ? String(c.name || '') : String(c))) })).sort((x, y) => natural(x.name, y.name)), scales: b.scales.filter(okScale), units };
}

async function snap() { return { bank: tidy(await bankRec.get().catch(() => null)), saved: savedRec.json(null), gone: goneRec.json(null) }; }
async function put(s) { await saveKv('bank', s.bank); saveSetting('gs.rubrics', s.saved == null ? [] : s.saved); saveSetting('gs.rubricsGone', s.gone == null ? {} : s.gone); }
// fn(b, list, gone): change the bank, grading's saved list and what was deleted. One undo step.
export async function changeBank(label, fn) {
  const before = await snap(), after = J(before);
  after.saved = Array.isArray(after.saved) ? after.saved : []; after.gone = after.gone && typeof after.gone === 'object' ? after.gone : {};
  fn(after.bank, after.saved, after.gone);
  after.bank.rubrics.sort((x, y) => natural(x.name, y.name)); after.bank.scales.sort((x, y) => natural(x.name, y.name)); after.saved.sort((x, y) => natural(x.name, y.name));
  await put(after);
  undo.record({ label, undo: () => put(before), redo: () => put(after) });
}
// A rubric saved from Rubric setup: in place of one with its id or its name.
export const keepRubric = (label, r) => changeBank(label, (b, list) => {
  const same = x => x.id === r.id || String(x.name).toLowerCase() === r.name.toLowerCase();
  b.rubrics = b.rubrics.filter(x => !same(x)); b.rubrics.push(r); delete b.gone[r.id];
  const i = list.findIndex(same); if (i >= 0) list.splice(i, 1); list.push(r);
});
export const dropRubric = (label, id) => changeBank(label, (b, list, gone) => {
  b.rubrics = b.rubrics.filter(x => x.id !== id); b.gone[id] = Date.now(); gone[id] = Date.now();
  const i = list.findIndex(x => x.id === id); if (i >= 0) list.splice(i, 1);
});
export const keepScale = (label, s) => changeBank(label, b => { b.scales = b.scales.filter(x => x.id !== s.id && String(x.name).toLowerCase() !== s.name.toLowerCase()); b.scales.push(s); delete b.gone[s.id]; });
