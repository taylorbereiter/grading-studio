// The Planner's setup file and the new school year (src/planner/lessons.js setupFileOf, loadSetupFile, applySetup, the setup drop;
// src/planner/units.js yearMoveOn). Loaded only when one of them is used (router.js PARTS.setupFile).
//
// A setup file is everything a teacher typed into the Planner's setup (the timetable, days off, events, the semester, the slide
// template and rules, the words for the school's systems, the default look) as one .json, to carry to another computer or hand to
// a colleague as a start. Loading one is what the current Planner does: the timetable is replaced, a class keeps the page link it
// had here, units only come in when they are not here yet (her edits stay), and a missing unit plan link is filled in.
import { toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine } from '../../planning/engine.js';
import { saveKv, saveLesson, saveYearsDone } from '../../planning/write.js';
import { loadPlan, plannerKv } from '../../planning/plan.js';
import { newYear } from '../../planning/index.js';
import { saveFailed } from './save.js';
import './cal-lines.js';

export const SETUP_KIND = 'grading-studio-lessons-setup';
const isDate = s => /^\d{4}-\d\d-\d\d$/.test(s || '');
const linkOf = u => (/^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
const deckClean = d => { if (!d || typeof d !== 'object') return null; const o = {}; if (d.agenda === false) o.agenda = false; if (d.sizes === 'any') o.sizes = 'any'; if (typeof d.add === 'string' && d.add) o.add = d.add; return Object.keys(o).length ? o : null; };

// The file, from a setup as it is typed (the timetable's draft) and the words and look kept beside it.
export function setupFileOf(d, p) {
  const words = p && p.words, look = p && p.deflook;
  return { kind: SETUP_KIND, version: 1, ...(d.profile ? { profile: d.profile } : {}),
    semStart: d.semStart || '', semEnd: d.semEnd || '', classes: d.classes || [], daysOff: d.daysOff || [], events: d.events || [], ...(d.claudeUrl ? { claudeUrl: d.claudeUrl } : {}),
    ...(words ? { sys: words.sys || '', unitPlans: words.unit || '' } : {}), ...(look ? { look } : {}),
    template: d.template || '', ...(d.template ? { tplName: d.tplName || '' } : {}), ...(deckClean(d.deck) ? { deck: deckClean(d.deck) } : {}) };
}
const saveAs = (name, b) => { const a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); };
export function saveSetupFile(d, p) {
  saveAs(t('cal.setup_file_name') + '.json', new Blob([JSON.stringify(setupFileOf(d, p), null, 1)], { type: 'application/json' }));
  toast(t('cal.setup_saved', { name: t('cal.setup_file_name') + '.json' }));
}
export const isSetupFile = j => !!j && typeof j === 'object' && Array.isArray(j.classes) && !Array.isArray(j.lessons);

// Loads one. True when it was a setup file.
export async function applySetup(j) {
  if (!isSetupFile(j)) { toast(t('cal.setup_bad')); return false; }
  try {
    const p = await loadPlan(), E = engine(p), now = await plannerKv('setup').catch(() => null) || p.setup || {};
    const old = id => ((now.classes) || []).find(x => x.id === String(id)) || {};
    const sun = j.classes.some(c => (c.meets || []).some(m => +m.dow === 0));
    const monday = s => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + (sun && d.getDay() === 0 ? 1 : -((d.getDay() + 6) % 7))); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const setup = {
      classes: j.classes.map(c => { const mb = linkOf(c.mb) || linkOf(old(c.id).mb); return { id: String(c.id), name: String(c.name || c.id), course: String(c.course || ''), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#1F6FB2', ...(mb ? { mb } : {}),
        meets: (c.meets || []).map(m => ({ dow: +m.dow, start: String(m.start || ''), end: String(m.end || ''), label: String(m.label || '') })) }; }),
      daysOff: (j.daysOff || []).map(d => ({ date: String(d.date), label: String(d.label || t('cal.no_school')) })),
      events: (j.events || []).map(e => ({ date: String(e.date), to: e.to ? String(e.to) : '', label: String(e.label || '') })),
      template: typeof j.template === 'string' ? j.template : now.template || '',
      tplName: String(typeof j.template === 'string' ? (j.template ? j.tplName || '' : '') : now.tplName || '').slice(0, 120),
      semStart: isDate(j.semStart) ? monday(j.semStart) : '', semEnd: isDate(j.semEnd) ? monday(j.semEnd) : '',
      claudeUrl: /^https:\/\/claude\.ai\//.test(j.claudeUrl) ? String(j.claudeUrl) : '', profile: String(j.profile || '').slice(0, 80) };
    const deck = deckClean(j.deck); if (deck) setup.deck = deck;
    if (typeof j.sys === 'string' || typeof j.unitPlans === 'string' || (j.plain && !p.words)) await saveKv('words', { sys: String(j.sys || '').slice(0, 40), unit: String(j.unitPlans || '').slice(0, 40) });
    await saveKv('setup', setup);
    // units only when they are not here yet; a unit here gets a missing unit plan link, nothing else
    let nu = 0, units = p.units.slice(), changed = false;
    for (const x of Array.isArray(j.units) ? j.units : []) {
      const u = E.normUnit(x), i = units.findIndex(v => v.id === u.id);
      if (x.id && i < 0) { units.push(u); nu++; changed = true; }
      else if (i >= 0 && !units[i].atlas && u.atlas) { units[i] = { ...units[i], atlas: u.atlas }; changed = true; }
    }
    if (changed) await saveKv('units', units);
    if (typeof j.look === 'string' && !p.deflook) { const { LOOKS } = await import('../../engines/plantools.js'); if (LOOKS[j.look]) await saveKv('deflook', j.look); }
    const n = setup.classes.length;
    toast([setup.profile ? t('cal.setup_loaded_named', { name: setup.profile, n }) : t('cal.setup_loaded', { n }), nu ? t('cal.setup_units', { n: nu }) : '', setup.template ? t('cal.setup_tpl') : ''].filter(Boolean).join(' '));
    await loadPlan(true);
    return true;
  } catch (e) { saveFailed(e); return false; }
}
export async function setupFrom(file) {
  if (!file) return false;
  let j; try { j = JSON.parse(await file.text()); } catch { toast(t('cal.setup_bad')); return false; }
  return applySetup(j);
}
export function loadSetupFile() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.onchange = () => setupFrom(i.files[0]);
  i.click();
}

// A new school year, started from Settings (whole/newyear.js leaves gsp.newYear = { id, from }): done once, the first time the app
// opens after it, as the current Planner does when it opens. Units and the semester move 52 weeks on (a Monday stays a Monday), the
// old year's days off and events go, and every lesson that was on a class goes to Past lessons under the old year's name with no
// dates and no taught notes. Nothing is deleted. kv 'yearsDone' remembers the moves done, in whichever app made them.
export async function yearMoveOn() {
  const ask = newYear.json(null);
  if (!ask || typeof ask.id !== 'string') return false;
  const done = (await plannerKv('yearsDone')) || [];
  if (done.includes(ask.id)) return false;
  const p = await loadPlan(true);
  if (p.failed && p.failed.length) return false;   // a record not read: try again next time rather than move half a year
  const later = s => { if (!isDate(s)) return s; const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + 364); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const from = String(ask.from || t('cal.last_year')).slice(0, 120);
  try {
    let moved = 0;
    for (const l of p.lessons) {
      if (!(l.slots || []).length && !(l.taught || []).length) continue;
      const n = { ...l, slots: [] }; delete n.taught;
      if ((l.slots || []).length && !l.library) n.library = from;
      await saveLesson(n); moved++;
    }
    if (p.units.length) await saveKv('units', p.units.map(u => ({ ...u, start: later(u.start) })));
    const s = await plannerKv('setup').catch(() => null) || p.setup;
    if (s) await saveKv('setup', { ...s, semStart: later(s.semStart), semEnd: later(s.semEnd), daysOff: [], events: [] });
    await saveYearsDone([...done, ask.id]);
    await loadPlan(true);
    toast(moved ? t('cal.year_moved_n', { n: moved, name: from }) : t('cal.year_moved'), { ms: 8000 });
    return true;
  } catch (e) { saveFailed(e); return false; }
}
