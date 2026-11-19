// The Planner's own commands in the command bar (src/planner/rail.js findRows): loaded the first time the bar opens. A lesson
// on no class or day, every lesson in one list.
import { addCommand } from '../../services/commands.js';
import { t } from '../../i18n/t.js';
import { go, PARTS } from '../router.js';
import { loadPlan } from '../../planning/plan.js';
import './cal-lines.js';

export function addPlanCommands() {
  addCommand({ id: 'plan-loose', label: () => t('cal.new_loose'), group: t('cmd.group_do'), icon: 'plus', run: () => Promise.all([loadPlan(), PARTS.calx()]).then(([p, m]) => m.newLoose(p)).catch(e => console.error(e)) });
  addCommand({ id: 'plan-all', label: () => t('cal.all_lessons'), group: t('cmd.group_go'), icon: 'slides', run: () => go('calendar', 'all') });
}
