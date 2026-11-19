// The Planner's own commands in the command bar (src/planner/rail.js findRows): loaded the first time the bar opens. A lesson
// on no class or day, every lesson in one list, the Semester view, each unit.
import { addCommand } from '../../services/commands.js';
import { t } from '../../i18n/t.js';
import { go, PARTS } from '../router.js';
import { loadPlan } from '../../planning/plan.js';
import './cal-lines.js';
import './lines.js';

// Each unit by its title (src/planner/rail.js findRows units), read again each time the bar opens: it opens on its Course line.
let unitCmds = [];
export function addUnitCommands() {
  return loadPlan().then(p => {
    unitCmds.forEach(f => f());
    unitCmds = (p.units || []).filter(u => u && u.id && u.title).map(u => addCommand({ id: 'unit-' + u.id, label: () => u.title, also: u.course + ' ' + t('plan.units'), group: t('plan.units'), icon: 'cal', run: () => go('library', 'units', u.id) }));
  }).catch(e => console.error(e));
}
export function addPlanCommands() {
  addCommand({ id: 'plan-loose', label: () => t('cal.new_loose'), group: t('cmd.group_do'), icon: 'plus', run: () => Promise.all([loadPlan(), PARTS.calx()]).then(([p, m]) => m.newLoose(p)).catch(e => console.error(e)) });
  addCommand({ id: 'plan-sem', label: () => t('cal.sem'), group: t('cmd.group_go'), icon: 'cal', run: () => go('calendar', 'semester') });
  addCommand({ id: 'plan-all', label: () => t('cal.all_lessons'), group: t('cmd.group_go'), icon: 'slides', run: () => go('calendar', 'all') });
}
