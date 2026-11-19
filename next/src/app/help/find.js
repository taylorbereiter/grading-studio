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
import { loadPlan } from '../../planning/plan.js';
import { toast } from '../../ui/index.js';
import { currentLook, saveLook } from '../../services/theme.js';
import { assistant } from '../../services/assistant.js';

// The light look she had before the dark one (kept in this browser), else the usual one.
const lightLook = () => { try { const v = localStorage.getItem('gsn.lightLook'); if (v && v !== 'midnight') return v; } catch { } return 'graphite'; };
import './lines.js';
import '../saving/lines.js';
import '../screens/prefs-lines.js';
import '../mark/setup-lines.js';

const SETTINGS = [['saving.take', 'saving'], ['saving.bring', 'saving'], ['saving.y_start', 'saving'], ['saving.y_open', 'saving'], ['saving.rm', 'saving'],
  ['saving.where_h', 'saving'], ['saving.hist_h', 'saving'], ['saving.safe_h', 'saving'], ['update.title', 'about'], ['prefs.size_h', 'display'], ['prefs.full_h', 'display'],
  ['settings.language', 'display'], ['prefs.phone_h', 'display'], ['setup.sg_disp_h', 'marking'], ['setup.sg_inks_h', 'marking'], ['setup.sg_names_h', 'marking'], ['prefs.tch_h', 'marking'], ['prefs.goal_h', 'grading']];
export function addHelpCommands(keys) {
  addFindRows(keys);
  for (const x of TOPICS) addCommand({ id: 'help-' + x.id, label: () => t(x.q), also: x.w ? t(x.w) : '', group: t('help.cmd_group'), icon: 'help', run: () => go('help', x.id) });
  for (const [line, g] of SETTINGS) addCommand({ id: 'set-' + line, label: () => t(line), also: t('nav.settings'), group: t('nav.settings'), icon: 'settings', run: () => go('settings', g) });
}

let mine = [];
// [id, line, icon, address, group]: the time tracker and the shortcut list (the main screens are the shell's own), the calendar's views, the timetable and Library's tabs
const NAV = [['time', 'nav.time', 'clock'], ['keys', 'keys.title', 'keyboard', 'help/keys'],
  ['cal-class', 'plan.by_class', 'cal', 'calendar/class', 'nav.calendar'], ['cal-time', 'plan.by_time', 'week', 'calendar/time', 'nav.calendar'], ['cal-month', 'plan.month', 'cal', 'calendar/month', 'nav.calendar'],
  ['timetable', 'settings.timetable', 'cal', 'settings/timetable', 'nav.settings'], ['lib-activities', 'plan.lib_activities', 'spark', 'library', 'nav.library'], ['lib-past', 'plan.lib_past', 'slides', 'library/past', 'nav.library'],
  ['lib-units', 'plan.lib_units', 'cal', 'library/units', 'nav.library'], ['lib-rubrics', 'plan.lib_rubrics', 'grades', 'library/rubrics', 'nav.library']];
const JOBS = [['help.cmd_open_work', 'upload', 'work'], ['help.cmd_open_folder', 'folder', 'work'], ['help.cmd_split', 'image', 'work'], ['help.cmd_match', 'people', 'work'], ['help.cmd_new_asg', 'plus', 'asg'], ['help.cmd_add_class', 'plus', 'new'], ['help.cmd_gc', 'school', 'new']];
// each class's pages, and the ones inside them (the current app's class tools: attendance, seating, charts, goals, report comments, missing work)
const PAGES = [['work', 'help.cmd_p_work'], ['people', 'help.cmd_p_people'], ['grades', 'help.cmd_p_grades'], ['todo', 'help.cmd_p_todo'],
  ['people/attendance', 'help.cmd_p_att'], ['people/seating', 'help.cmd_p_seat'], ['grades/charts', 'help.cmd_p_charts'], ['grades/goals', 'help.cmd_p_goals'],
  ['grades/reports', 'help.cmd_p_reports'], ['todo/missing', 'help.cmd_p_missing']];
// Settings' rest, ready before a row needs it: a window opened after waiting for a file is stopped by the browser.
let more = null;
async function findRows() {
  const [rows, kept, S] = await Promise.all([PARTS.asgRows().then(m => m.assignmentRows()), PARTS.asgRows().then(m => m.keptRows()).catch(() => []), import('../sample.js')]);
  if (!more) PARTS.setmore().then(m => { more = m; }, e => console.error(e));
  mine.forEach(f => f()); mine = [];
  const add = c => mine.push(addCommand(c)), allCls = await import('../../crossings.js').then(m => m.classesForHome()).catch(() => []), firstCls = allCls.filter(c => !c.loose);
  for (const r of rows) add({ id: 'asg-' + r.id, label: r.name || t('help.cmd_asg'), also: (r.cls || t('help.cmd_no_class')) + ' ' + r.unit, group: t('help.cmd_asg'), icon: 'grades', run: () => go('mark', r.id) });
  for (const r of kept) add({ id: 'kept-' + r.id, label: r.name || t('help.cmd_a_download'), also: t('help.cmd_kept'), group: t('help.cmd_asg'), icon: 'grades', run: () => go('mark', r.id) });
  // the time tracker, the shortcut list, the calendar's views, Library's tabs, every lesson (newest day first) and every class
  for (const [id, line, icon, ...to] of NAV) add({ id: 'go-' + id, label: () => t(line), also: to[1] ? t(to[1]) : '', group: t(to[1] || 'cmd.group_go'), icon, run: () => go(...(to[0] || id).split('/')) });
  const pl = await loadPlan().catch(() => null), cls = id => (((pl && pl.setup && pl.setup.classes) || []).find(c => c.id === id) || {}).name || '';
  for (const l of (pl && pl.lessons) || []) {
    const s = [...(l.slots || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    add({ id: 'lesson-' + l.id, label: l.title || t('plan.untitled'), also: (s ? cls(s.classId) + ' ' + s.date : '') + ' ' + t('plan.lessons'), group: t('plan.lessons'), icon: 'slides', run: () => go('lesson', l.id) });
  }
  for (const c of allCls) add({ id: 'class-' + (c.id || '-'), label: c.loose ? t('nav.no_class') : c.name, also: t('nav.classes'), group: t('nav.classes'), icon: 'people', run: () => go('class', c.id || '-') });
  for (const c of firstCls) for (const [k, line] of PAGES) add({ id: 'cp-' + c.id + '-' + k.replace('/', '-'), label: t(line, { name: c.name }), group: t('help.cmd_pages'), icon: 'people', run: () => go('class', c.id, ...k.split('/')) });
  for (const [k, icon, to] of JOBS) add({ id: 'job-' + k, label: t(k), group: t('cmd.group_do'), icon, run: () => (to === 'new' ? go('class', 'new') : go('class', to === 'asg' && /^class\//.test(current().pattern || '') && current().params.id !== 'new' ? current().params.id : firstCls[0] ? firstCls[0].id : '-', 'work', to === 'asg' ? 'new' : null)) });
  add(S.sampleOn() ? { id: 'job-sample', label: t('help.cmd_leave_sample'), group: t('cmd.group_do'), icon: 'x', run: S.leaveSample } : { id: 'job-sample', label: t('help.cmd_sample'), group: t('cmd.group_do'), icon: 'spark', run: () => S.enterSample() });
  // Go to: To do by week and the strong examples; a dark or a light look in one press; a screenshot from any screen; her assistant beside the app
  add({ id: 'go-todo-week', label: t('help.cmd_todo_week'), also: t('nav.todo'), group: t('cmd.group_go'), icon: 'week', run: () => go('todo', 'week') });
  add({ id: 'go-examples', label: t('help.cmd_examples'), also: t('nav.library'), group: t('cmd.group_go'), icon: 'image', run: () => go('library', 'examples') });
  const dark = currentLook() === 'midnight';
  add({ id: 'look-dark', label: t(dark ? 'help.cmd_light' : 'help.cmd_dark'), also: t('look.title'), group: t('nav.settings'), icon: dark ? 'sun' : 'moon', run: () => { if (!dark) try { localStorage.setItem('gsn.lightLook', currentLook()); } catch { } if (!saveLook(dark ? lightLook() : 'midnight')) toast(t('look.not_kept')); } });
  if (current().chunk !== 'mark') add({ id: 'snip', label: t('help.cmd_snip'), also: t('help.cmd_snip_also'), group: t('cmd.group_do'), icon: 'crop', run: () => PARTS.snip().then(m => m.startSnip({ toast })).catch(e => console.error(e)) });
  const ai = assistant();
  if (ai.link) add({ id: 'ai-beside', label: ai.name ? t('help.cmd_beside', { name: ai.name }) : t('help.cmd_beside_generic'), group: t('cmd.group_do'), icon: 'assist', run: () => (more ? more.openBeside(ai.link, ai.tab) : window.open(ai.link, '_blank', 'noopener')) });
  for (const s of keyList()) if (!s.hidden && !/^(command-bar|fold|undo|redo|mark-(next|prev|score|nudge.*))$/.test(s.id)) add({ id: 'key-' + s.id, label: t(s.label), also: s.group ? t(s.group) : '', group: t('cmd.group_do'), icon: 'keyboard', keys: s.keys[0], when: s.when, run: () => s.run({ shiftKey: false, preventDefault() {} }) });
}
const refresh = () => findRows().catch(e => console.error(e));
// keys: every shortcut as registered (services/shortcuts.js), handed in by the shell
let keyList = () => [];
export function addFindRows(keys) { if (keys) keyList = keys; refresh(); loadWhenOpened(refresh, true); }
