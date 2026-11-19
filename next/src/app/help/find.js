// Every Help answer in the command bar (src/help.js helpFindRows): loaded the first time the bar opens, each row opening its answer.
// And the settings people look for by name (the feature list's row 6: take-home, bring in, new year, archived year, remove, where
// saved, go back, updates, text size, full screen, language, Word papers, mark colours, name covers, tablet), each opening its group.
// And, read again each time the bar opens (src/shell.js findRows): every assignment and class page, the common jobs (rows 3 and 5),
// and every keyboard shortcut that can run now, so a marking tool or paper action is found by its name (row 4). The students of
// the open assignment are the marking screen's own commands (screens/mark.jsx).
import { addCommand, loadWhenOpened } from '../../services/commands.js';
import { t } from '../../i18n/t.js';
import { go, PARTS, current } from '../router.js';
import { TOPICS } from './topics.js';
import './lines.js';
import '../saving/lines.js';
import '../screens/prefs-lines.js';
import '../mark/setup-lines.js';

const SETTINGS = [['saving.take', 'saving'], ['saving.bring', 'saving'], ['saving.y_start', 'saving'], ['saving.y_open', 'saving'], ['saving.rm', 'saving'],
  ['saving.where_h', 'saving'], ['saving.hist_h', 'saving'], ['saving.safe_h', 'saving'], ['update.title', 'about'], ['prefs.size_h', 'display'], ['prefs.full_h', 'display'],
  ['settings.language', 'display'], ['prefs.phone_h', 'display'], ['setup.sg_disp_h', 'marking'], ['setup.sg_inks_h', 'marking'], ['setup.sg_names_h', 'marking'], ['prefs.tch_h', 'marking']];
export function addHelpCommands(keys) {
  addFindRows(keys);
  for (const x of TOPICS) addCommand({ id: 'help-' + x.id, label: () => t(x.q), also: x.w ? t(x.w) : '', group: t('help.cmd_group'), icon: 'help', run: () => go('help', x.id) });
  for (const [line, g] of SETTINGS) addCommand({ id: 'set-' + line, label: () => t(line), also: t('nav.settings'), group: t('nav.settings'), icon: 'settings', run: () => go('settings', g) });
}

let mine = [];
const JOBS = [['help.cmd_open_work', 'upload', 'work'], ['help.cmd_open_folder', 'folder', 'work'], ['help.cmd_split', 'image', 'work'], ['help.cmd_match', 'people', 'match'], ['help.cmd_new_asg', 'plus', 'asg'], ['help.cmd_add_class', 'plus', 'new'], ['help.cmd_gc', 'school', 'new']];
const PAGES = [['work', 'help.cmd_p_work'], ['people', 'help.cmd_p_people'], ['grades', 'help.cmd_p_grades'], ['todo', 'help.cmd_p_todo']];
async function findRows() {
  const [rows, S] = await Promise.all([PARTS.asgRows().then(m => m.assignmentRows()), import('../sample.js')]);
  mine.forEach(f => f()); mine = [];
  const add = c => mine.push(addCommand(c)), firstCls = (await import('../../crossings.js').then(m => m.classesForHome()).catch(() => [])).filter(c => !c.loose);
  for (const r of rows) add({ id: 'asg-' + r.id, label: r.name || t('help.cmd_asg'), also: (r.cls || t('help.cmd_no_class')) + ' ' + r.unit, group: t('help.cmd_asg'), icon: 'grades', run: () => go('mark', r.id) });
  for (const c of firstCls) for (const [k, line] of PAGES) add({ id: 'cp-' + c.id + '-' + k, label: t(line, { name: c.name }), group: t('help.cmd_pages'), icon: 'people', run: () => go('class', c.id, k) });
  for (const [k, icon, to] of JOBS) add({ id: 'job-' + k, label: t(k), group: t('cmd.group_do'), icon, run: () => (to === 'new' ? go('class', 'new') : go('class', to === 'asg' && /^class\//.test(current().pattern || '') && current().params.id !== 'new' ? current().params.id : firstCls[0] ? firstCls[0].id : '-', 'work', to === 'asg' ? 'new' : to === 'match' ? 'match' : null)) });
  add(S.sampleOn() ? { id: 'job-sample', label: t('help.cmd_leave_sample'), group: t('cmd.group_do'), icon: 'x', run: S.leaveSample } : { id: 'job-sample', label: t('help.cmd_sample'), group: t('cmd.group_do'), icon: 'spark', run: () => S.enterSample() });
  for (const s of keyList()) if (!s.hidden && !/^(command-bar|fold|undo|redo|mark-(next|prev|score|nudge.*))$/.test(s.id)) add({ id: 'key-' + s.id, label: t(s.label), also: s.group ? t(s.group) : '', group: t('cmd.group_do'), icon: 'keyboard', keys: s.keys[0], when: s.when, run: () => s.run({ shiftKey: false, preventDefault() {} }) });
}
const refresh = () => findRows().catch(e => console.error(e));
// keys: every shortcut as registered (services/shortcuts.js), handed in by the shell
let keyList = () => [];
export function addFindRows(keys) { if (keys) keyList = keys; refresh(); loadWhenOpened(refresh, true); }
