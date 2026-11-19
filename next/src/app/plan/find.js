// The Planner's own commands in the command bar (src/planner/rail.js findRows): loaded the first time the bar opens. A lesson
// on no class or day, every lesson in one list, the Semester view, each unit, and searching inside lessons.
import { addCommand } from '../../services/commands.js';
import { t } from '../../i18n/t.js';
import { go, PARTS } from '../router.js';
import { loadPlan } from '../../planning/plan.js';
import './cal-lines.js';
import './lines.js';
import '../screens/prefs-lines.js';
import { plannerFolder } from '../../planning/folder.js';

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
  addCommand({ id: 'plan-import', label: () => t('plan.import_lesson'), also: t('cal.import_sub'), group: t('cmd.group_do'), icon: 'upload', run: () => go('calendar', 'import') });
  addCommand({ id: 'plan-sem', label: () => t('cal.sem'), group: t('cmd.group_go'), icon: 'cal', run: () => go('calendar', 'semester') });
  // Search inside lessons for "…" (src/planner/rail.js, extras.js findDlg): slides, notes, documents and units, in Library > Search
  addCommand({ id: 'plan-search', query: true, label: q => t('cal.search_inside', { q }), group: t('cal.search'), icon: 'search', run: q => go('library', 'search', q) });
  addCommand({ id: 'plan-all', label: () => t('cal.all_lessons'), group: t('cmd.group_go'), icon: 'slides', run: () => go('calendar', 'all') });
}

// The Planner folder as one command (src/planner/rail.js): Link it, give permission again, or look in it, as it stands now.
let folderCmd = null;
export async function addFolderCommand() {
  if (!('showDirectoryPicker' in window)) return;
  const f = await plannerFolder().catch(() => null), how = !f ? 'link' : f.ok ? 'look' : 'permit';
  if (folderCmd) folderCmd();
  folderCmd = addCommand({ id: 'plan-folder', label: () => t(how === 'link' ? 'prefs.pf_link' : how === 'look' ? 'prefs.pf_look' : 'prefs.pf_permit'), also: t('prefs.pf_h'), group: t('cmd.group_do'), icon: 'folder',
    run: () => PARTS.pfolder().then(m => m.folderDo(how)).catch(e => console.error(e)) });
}
