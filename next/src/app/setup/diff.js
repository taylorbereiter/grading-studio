// What a setup would change, one part per subject, in the new app's own words (the current app's src/setupin.js stpDiff says the
// same things in its own). Each part: { key, title, lines, sub }. key is what bringing it in is asked for (stpApply's pick). A part
// with no lines changes nothing and is left out. Names the teacher typed are parameters, never translated.
import { stpPanelWidth } from '../../engines/gpanel.js';
import { t, date, num } from '../../i18n/t.js';
import '../screens/prefs-lines.js';
import '../plan/lines.js';

const day = s => date(new Date(s + 'T12:00:00'), { month: 'short', day: 'numeric', year: 'numeric' });
const list = (a, n = 6) => (a.length > n ? t('prefs.su_list_more', { list: a.slice(0, n).join(', '), n: a.length - n }) : a.join(', '));
const dows = d => date(new Date(2024, 0, 7 + d), { weekday: 'long' });
const WAY = { rubric: 'prefs.su_way_rubric', points: 'prefs.su_way_points', percent: 'prefs.su_way_percent', letters: 'prefs.su_way_letters', myp: 'prefs.su_way_myp', ib7: 'prefs.su_way_ib7' };
const INK = { red: 'prefs.su_ink_red', blue: 'prefs.su_ink_blue', green: 'prefs.su_ink_green', purple: 'prefs.su_ink_purple', black: 'prefs.su_ink_black' };
const wayName = k => (WAY[k] ? t(WAY[k]) : k);
const TAB = { gradebook: 'prefs.su_tab_gradebook', students: 'prefs.su_tab_students', attendance: 'prefs.su_tab_attendance', seating: 'prefs.su_tab_seating', missing: 'prefs.su_tab_missing', charts: 'prefs.su_tab_charts', goals: 'prefs.su_tab_goals', reports: 'prefs.su_tab_reports' };
const LAYOUT = { agenda: 'plan.layout_agenda', objectives: 'plan.layout_objectives', warmup: 'plan.layout_warmup', exit: 'plan.layout_exit', steps: 'plan.layout_steps', discuss: 'plan.layout_discuss', content: 'plan.layout_content', twocol: 'plan.layout_twocol', text: 'plan.layout_text', passage: 'plan.layout_passage', vocab: 'plan.layout_vocab', picture: 'plan.layout_picture', fullpic: 'plan.layout_fullpic', textpic: 'plan.layout_textpic', picprompt: 'plan.layout_picprompt', video: 'plan.layout_video' };
const TYPE = { sum: 'prefs.su_t_sum', ic: 'prefs.su_t_ic', fm: 'prefs.su_t_fm' };

export function setupParts(M, S, planNow) {
  const parts = [], add = (key, title, lines, sub) => { if (lines.length) parts.push({ key, title: t(title), lines, sub: sub ? t(sub) : '' }); };
  const K = M.stpKey, m = M.me();
  if (S.panelWidth != null && S.panelWidth !== stpPanelWidth()) add('panelWidth', 'prefs.su_h_panel', [num(S.panelWidth) + ' px']);
  // her school's words, the assistant, the programme and the School page's people
  if (S.school || S.prog || S.staff || S.staffRoles) {
    const L = [], s = S.school || {};
    if (s.sys != null && s.sys !== M.sysName()) L.push(s.sys ? t('prefs.su_sys', { name: s.sys }) : t('prefs.su_sys_none'));
    if (s.mbOrder != null && s.mbOrder !== M.mbOrder()) L.push(t(s.mbOrder === 'last' ? 'prefs.su_order_last' : s.mbOrder === 'first' ? 'prefs.su_order_first' : 'prefs.su_order_roster'));
    if (s.unit != null && s.unit !== M.unitLinkName()) L.push(s.unit ? t('prefs.su_unit', { name: s.unit }) : t('prefs.su_unit_none'));
    if (s.ai != null && s.ai !== (m.ai || '')) L.push(s.ai ? t('prefs.su_ai', { name: s.ai }) : t('prefs.su_ai_none'));
    if (s.aiUrl != null && s.aiUrl !== M.aiUrlClean(m.aiUrl)) L.push(s.aiUrl ? t('prefs.su_ai_url', { link: s.aiUrl }) : t('prefs.su_ai_url_none'));
    if (s.aiOpen != null && s.aiOpen !== (m.aiOpen === 'tab' ? 'tab' : '')) L.push(t(s.aiOpen ? 'prefs.su_ai_tab' : 'prefs.su_ai_side'));
    if (s.aiUrls != null && JSON.stringify(s.aiUrls) !== JSON.stringify(m.aiUrls || {})) L.push(Object.keys(s.aiUrls).length ? t('prefs.su_ai_urls', { list: list(Object.keys(s.aiUrls)) }) : t('prefs.su_ai_urls_none'));
    if (s.aiOff != null && JSON.stringify(s.aiOff) !== JSON.stringify(m.aiOff || [])) L.push(s.aiOff.length ? t('prefs.su_ai_off', { list: list(s.aiOff) }) : t('prefs.su_ai_off_none'));
    if (S.prog && S.prog !== (m.prog || '')) L.push(t('prefs.su_prog', { name: S.prog }));
    if (S.staffRoles) L.push(t('prefs.su_roles', { list: list(S.staffRoles) }));
    const fresh = (S.staff || []).filter(x => !M.stpPersonHere(x));
    if (fresh.length) L.push(t('prefs.su_people', { list: list(fresh.map(x => (x.role ? x.name + ' (' + x.role + ')' : x.name))) }));
    add('school', 'prefs.su_h_school', L, 'prefs.su_s_school');
  }
  // how a new assignment is graded
  if (S.grading) {
    const g = S.grading, now = M.meGrade(), L = [];
    if (!now || now.way !== g.way || JSON.stringify(now.setup.criteria) !== JSON.stringify(g.setup.criteria) || JSON.stringify(now.bands || null) !== JSON.stringify(g.bands || null) || (now.setup.outOf !== g.setup.outOf)) {
      L.push(now ? t('prefs.su_way_was', { way: wayName(g.way), was: wayName(now.way) }) : t('prefs.su_way', { way: wayName(g.way) }));
      if (g.setup.mode === 'rubric') L.push(t('prefs.su_rows', { list: list(g.setup.criteria, 8) })); else L.push(t('prefs.su_total', { n: g.setup.outOf }));
      if (g.setup.top) L.push(t(g.setup.half === false ? 'prefs.su_top_whole' : 'prefs.su_top', { n: g.setup.top }));
      if (g.setup.scale) L.push(t('prefs.su_scale', { n: Object.keys(g.setup.scale).length }));
      if (g.bands) L.push(t('prefs.su_bands', { list: g.bands.map(b => t('prefs.su_band', { grade: b[1], n: b[0] })).join(' · ') }));
    }
    add('grading', 'prefs.su_h_grading', L, 'prefs.su_s_grading');
  }
  // classes, their links, units, IB and times
  if (S.classes.length) {
    const L = [], fresh = [], linked = [], units = [], times = [], ibs = [], course = [], libc = (M.me && lib(M).classes) || [];
    for (const c of S.classes) {
      const had = libc.find(x => K(x.name) === K(c.name));
      if (!had) fresh.push(c.name); else if (c.link && c.link !== M.mbOf(had)) linked.push(c.name);
      if (c.course && (!had || M.lkKey(had.course) !== M.lkKey(c.course))) course.push(c.name + ' (' + c.course + ')');
      if (c.ib && (!had || M.stpIbChanges(had, c.ib))) ibs.push(c.name + ' (' + c.ib.way.toUpperCase() + ')');
      const nu = c.units.filter(u => !had || !had.units.some(x => K(x.name) === K(u))); if (nu.length) units.push(c.name + ' (' + nu.length + ')');
      if (c.meets) {
        const p = planNow && Array.isArray(planNow.classes) ? planNow.classes.find(x => x && K(x.name) === K(c.name)) : null, was = p && Array.isArray(p.meets) ? p.meets.map(x => x.dow + x.start + x.end).join() : null;
        if (was !== c.meets.map(x => x.dow + x.start + x.end).join()) times.push(c.name);
      }
    }
    if (fresh.length) L.push(t('prefs.su_new_classes', { n: fresh.length, list: list(fresh) }));
    if (linked.length) L.push(t('prefs.su_links', { list: list(linked) }));
    if (ibs.length) L.push(t('prefs.su_ib', { list: list(ibs) }));
    if (units.length) L.push(t('prefs.su_units', { list: list(units) }));
    if (course.length) L.push(t('prefs.su_course', { list: list(course) }));
    if (times.length) L.push(t('prefs.su_times', { list: list(times) }));
    add('classes', 'prefs.su_h_classes', L, 'prefs.su_s_classes');
  }
  // the semester, days off and dates
  if (S.calendar) {
    const k = S.calendar, L = [], p = planNow || {}, off = Array.isArray(p.daysOff) ? p.daysOff : [], ev = Array.isArray(p.events) ? p.events : [];
    if (k.start && (M.stpMonday(k.start) !== p.semStart || M.stpMonday(k.end) !== p.semEnd)) L.push(t('prefs.su_sem', { from: day(k.start), to: day(k.end) }));
    const no = k.daysOff.filter(d => !off.some(x => x && x.date === d.date && x.label === d.label)); if (no.length) L.push(t('prefs.su_off', { n: no.length, list: list([...new Set(no.map(d => d.label))], 5) }));
    const ne = k.events.filter(e => !ev.some(x => x && x.date === e.date && x.label === e.label)); if (ne.length) L.push(t('prefs.su_events', { n: ne.length, list: list(ne.map(e => e.label), 5) }));
    add('calendar', 'prefs.su_h_calendar', L, 'prefs.su_s_calendar');
  }
  // terms
  if (S.terms.length) {
    const cur = M.bkConf().terms, L = [];
    for (const x of S.terms) { const had = cur.find(y => K(y.name) === K(x.name)); if (!had) L.push(t('prefs.su_term', { name: x.name, from: day(x.start), to: day(x.end) })); else if (had.start !== x.start || had.end !== x.end) L.push(t('prefs.su_term_moves', { name: x.name, from: day(x.start), to: day(x.end) })); }
    add('terms', 'prefs.su_h_terms', L, 'prefs.su_s_terms');
  }
  // what a term grade is made of
  if (S.book) {
    const b = S.book, conf = M.bkConf(), L = [];
    if (b.w && Object.keys(b.w).some(k => (+conf.w[k] || 0) !== b.w[k])) L.push(t('prefs.su_weights', { list: Object.keys(b.w).map(k => (TYPE[k] ? t(TYPE[k]) : k) + ' ' + num(b.w[k]) + '%').join(', ') }));
    if (b.empty && b.empty !== conf.empty) L.push(t(b.empty === 'zero' ? 'prefs.su_empty_zero' : 'prefs.su_empty_other'));
    if (b.xcTo && b.xcTo !== conf.xcTo) L.push(t(b.xcTo === 'ic' ? 'prefs.su_xc_ic' : 'prefs.su_xc_term'));
    if (b.xcCap != null && b.xcCap !== conf.xcCap) L.push(t(b.xcCap ? 'prefs.su_cap' : 'prefs.su_nocap'));
    if (b.retake && b.retake !== M.retakeRule()) L.push(t({ high: 'prefs.su_rt_high', last: 'prefs.su_rt_last', avg: 'prefs.su_rt_avg' }[b.retake]));
    if (b.types && M.stpOwnTypes()) { const own = b.types.filter(x => !M.BK_TYPES.some(y => K(y[1]) === K(x.name) || K(y[2]) === K(x.name))).map(x => x.name); if (own.length) L.push(t('prefs.su_types', { list: list(own) })); }
    add('book', 'prefs.su_h_book', L, 'prefs.su_s_book');
  }
  // saved rubrics, comments and goals
  if (S.rubrics.length) {
    const cur = M.savedRubrics(), same = (x, r) => JSON.stringify([x.criteria, x.levels || null, x.scale || null, x.top || 4, x.half !== false]) === JSON.stringify([r.criteria, r.levels || null, r.scale || null, r.top || 4, r.half !== false]);
    const fresh = S.rubrics.filter(r => !cur.some(x => K(x.name) === K(r.name))), chg = S.rubrics.filter(r => { const x = cur.find(y => K(y.name) === K(r.name)); return x && !same(x, r); }), L = [];
    if (fresh.length) L.push(t('prefs.su_rubrics', { n: fresh.length, list: list(fresh.map(r => t('prefs.su_rubric_rows', { name: r.name, n: r.criteria.length })), 5) }));
    if (chg.length) L.push(t('prefs.su_rubrics_chg', { list: list(chg.map(r => r.name), 5) }));
    add('rubrics', 'prefs.su_h_rubrics', L, 'prefs.su_s_rubrics');
  }
  if (S.comments.length) { const bank = M.bankNow ? M.bankNow() : [], n = S.comments.filter(c => !bank.includes(c)); add('comments', 'prefs.su_h_comments', n.length ? [t('prefs.su_comments', { n: n.length, first: n[0].length > 70 ? n[0].slice(0, 70) + '…' : n[0] })] : [], 'prefs.su_s_comments'); }
  if (S.goals.length) { const cur = M.goalList(), n = S.goals.filter(x => !cur.some(y => K(y.name) === K(x))); add('goals', 'prefs.su_h_goals', n.length ? [t('prefs.su_goals', { n: n.length, list: list(n, 5) })] : [], 'prefs.su_s_goals'); }
  // the Planner's deck rules
  if (S.deck) {
    const now = (planNow && planNow.deck && typeof planNow.deck === 'object' ? planNow.deck : {}), L = [];
    if (S.deck.agenda != null && S.deck.agenda !== (now.agenda !== false)) L.push(t(S.deck.agenda ? 'prefs.su_agenda' : 'prefs.su_noagenda'));
    if (S.deck.sizes != null && (S.deck.sizes === 'any') !== (now.sizes === 'any')) L.push(t(S.deck.sizes === 'any' ? 'prefs.su_sizes_any' : 'prefs.su_sizes'));
    if (S.deck.add && S.deck.add !== (M.STP_LAYOUTS[now.add] ? now.add : 'content')) L.push(t('prefs.su_newslide', { name: LAYOUT[S.deck.add] ? t(LAYOUT[S.deck.add]) : S.deck.add }));
    add('deck', 'prefs.su_h_deck', L, 'prefs.su_s_deck');
  }
  // marking and handing back
  if (S.mark) {
    const x = S.mark, now = M.stpMarkNow(), L = [], yes = (k, on, off) => { if (x[k] != null && x[k] !== now[k]) L.push(t(x[k] ? on : off)); };
    yes('xnames', 'prefs.su_xnames', 'prefs.su_xnames_off'); yes('xone', 'prefs.su_xone', 'prefs.su_xone_off'); yes('anchorCover', 'prefs.su_cover', 'prefs.su_cover_off');
    yes('nameFind', 'prefs.su_find', 'prefs.su_find_off'); yes('sheetfound', 'prefs.su_sheet', 'prefs.su_sheet_off'); yes('listPts', 'prefs.su_listpts', 'prefs.su_listpct');
    if (x.ptsInk != null && x.ptsInk !== now.ptsInk) L.push(x.ptsInk === 'credit' ? t('prefs.su_pts_credit') : x.ptsInk ? t('prefs.su_pts_ink', { ink: INK[x.ptsInk] ? t(INK[x.ptsInk]) : x.ptsInk }) : t('prefs.su_pts_pen'));
    if (x.fside != null && x.fside !== now.fside) L.push(t({ show: 'prefs.su_fs_show', all: 'prefs.su_fs_all' }[x.fside] || 'prefs.su_fs_hide'));
    if (x.mail != null && x.mail !== now.mail) L.push(t({ outlook: 'prefs.su_mail_outlook', app: 'prefs.su_mail_app' }[x.mail] || 'prefs.su_mail_gmail'));
    add('mark', 'prefs.su_h_mark', L, 'prefs.su_s_mark');
  }
  // the focus timer and the daily goal
  if (S.focus) {
    const c = M.fcConf(), f = S.focus, L = [], yes = (k, on, off) => { if (f[k] != null && f[k] !== c[k]) L.push(t(f[k] ? on : off)); };
    if (f.len != null && f.len !== c.len) L.push(t('prefs.su_fc_len', { n: f.len }));
    if (f.llen != null && f.llen !== c.llen) L.push(t('prefs.su_fc_llen', { n: f.llen }));
    if (f.brk != null && f.brk !== c.brk) L.push(t('prefs.su_fc_brk', { n: f.brk }));
    if (f.pe != null && f.pe !== c.pe) L.push(f.pe ? t('prefs.su_fc_pe', { n: f.pe }) : t('prefs.su_fc_pe_off'));
    const gk = g => (g ? JSON.stringify([g.k, g.n, g.per || 'day', g.days || null]) : '');
    if ('goal' in f && gk(f.goal) !== gk(c.goal)) L.push(!f.goal ? t('prefs.su_fc_nogoal') : t(f.goal.per === 'week' ? (f.goal.k === 'min' ? 'prefs.su_fc_wk_min' : 'prefs.su_fc_wk_pap') : (f.goal.k === 'min' ? 'prefs.su_fc_day_min' : 'prefs.su_fc_day_pap'), { n: f.goal.n }) + (f.goal.days ? ' · ' + f.goal.days.map(dows).join(', ') : ''));
    yes('sg', 'prefs.su_fc_sg', 'prefs.su_fc_sg_off'); yes('sound', 'prefs.su_fc_sound', 'prefs.su_fc_sound_off'); yes('title', 'prefs.su_fc_title', 'prefs.su_fc_title_off');
    yes('track', 'prefs.su_fc_track', 'prefs.su_fc_track_off'); yes('free', 'prefs.su_fc_free', 'prefs.su_fc_free_off'); yes('quiet', 'prefs.su_fc_quiet', 'prefs.su_fc_quiet_off');
    yes('short', 'prefs.su_fc_short', 'prefs.su_fc_short_off'); yes('music', 'prefs.su_fc_music', 'prefs.su_fc_music_off');
    if (f.idle != null && f.idle !== c.idle) L.push(t('prefs.su_fc_idle', { n: f.idle }));
    if ('wk' in f && f.wk !== c.wk) L.push(f.wk === false ? t('prefs.su_fc_wk_off') : t('prefs.su_fc_wk', { day: dows(f.wk) }));
    if ((f.mood != null && f.mood !== c.mood) || (f.mvol != null && f.mvol !== c.mvol) || (f.mamb != null && f.mamb !== c.mamb)) L.push(t('prefs.su_fc_mood'));
    add('focus', 'prefs.su_h_focus', L, '');
  }
  // to-do categories
  if (S.todo) {
    const now = M.tdCats(), next = M.stpTodoNext(S.todo), names = next.corder.ids.map(id => { const c = next.cats.find(x => x.id === id); return (c && c.name) || (M.TD_CAT0.find(b => b[0] === id) || [])[1]; }), L = [];
    if (names.join('\n') !== now.map(c => c.name).join('\n')) L.push(t('prefs.su_td', { list: names.join(', ') }));
    for (const x of S.todo) if (x.w) { const c = now.find(y => K(y.name) === K(x.name)); if (!c || c.w !== x.w) L.push(t('prefs.su_td_words', { name: x.name, words: x.w })); }
    const gone = now.filter(c => !next.corder.ids.includes(c.id));
    if (L.length) parts.push({ key: 'todo', title: t('prefs.su_h_todo'), lines: L, sub: gone.length ? t('prefs.su_s_todo_gone', { list: gone.map(c => c.name).join(', ') }) : '' });
  }
  if (S.att != null && S.att !== M.attOn()) add('att', 'prefs.su_h_att', [t(S.att ? 'prefs.su_att' : 'prefs.su_att_off')], S.att ? '' : 'prefs.su_s_att');
  if (S.tabs && S.tabs.join() !== M.tabsKept().join()) add('tabs', 'prefs.su_h_tabs', [S.tabs.length ? t('prefs.su_tabs', { list: S.tabs.map(k => t(TAB[k] || 'prefs.su_tab_more')).join(', ') }) : t('prefs.su_tabs_none')], 'prefs.su_s_tabs');
  return parts;
}
// The library the engine was handed (students/setup.js hand), read through its own helper.
const lib = M => (M.libNow ? M.libNow() : { classes: [] });
