/* ---------------- units, assignments and rosters (kept in this browser only) ---------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
let fresh = store.get('gs.lib', null) == null;   // a browser nobody has used yet: it gets the welcome, and nothing of anyone's
// Each class holds its roster and its own units; each unit holds assignment cards. Assignments with no class sit in
// lib.loose. (Before 10/29 units were shared by every class; migrateLib moves each card into its class's unit of the same name.)
function migrateLib(l) {
  l.classes ||= []; for (const c of l.classes) { c.units ||= []; c.names ||= []; }
  l.loose ||= { id: '', units: [] };
  for (const u of l.units || []) for (const it of u.items || []) {
    const c = l.classes.find(k => k.id === it.classId) || l.loose;
    let cu = c.units.find(x => x.name === u.name); if (!cu) c.units.push(cu = { id: uid(), name: u.name, items: [] });
    cu.items.push(it);
  }
  l.units = [];
  return l;
}
let lib = migrateLib(store.get('gs.lib', null) || { classes: [] });
// A brand-new browser starts with nothing in it: no classes, no scale, no school system. (Until 11/10 three starter classes were
// added here. A browser that got them keeps them, and keeps lib.seed2627, which nothing reads any more.)
/* ---------------- how this teacher works: lib.me ---------------- */
// Where their students hand work in, what a unit links to, and how they usually grade. Asked in the welcome (src/welcome.js) and
// changed in Settings. It lives in lib, so it goes wherever their classes go. A browser from before the welcome has no lib.me and
// reads as ME_OLD, which is every word and default the app had then: nothing is written for it until its teacher changes a setting.
const ME_OLD = { sys: 'ManageBac', unit: 'Atlas', scale12: true };   // scale12: Rubric setup offers the 12-point scale (12 = 100, 11 = 95…) as a preset
const ME_NEW = { sys: '', unit: '', grade: { way: 'rubric' } };
// A brand-new browser has the new teacher's answers from its first moment (in memory: nothing is stored until something is saved),
// so whatever it saves first, a class or a paper dropped past the welcome, carries them.
if (fresh && !lib.me) lib.me = JSON.parse(JSON.stringify(ME_NEW));
const me = () => lib.me || ME_OLD;
// Whether this teacher takes attendance here (src/attend.js). On unless they turn it off in Settings; days already saved are kept either way.
const attOn = () => me().att !== false;
// A real day written YYYY-MM-DD. Here, not in attend.js, because the address is read before that file has run.
const attDayOk = d => { if (!/^\d{4}-\d\d-\d\d$/.test(d || '')) return false; const t = new Date(d + 'T12:00:00'); return !isNaN(t) && t.getMonth() + 1 === +d.slice(5, 7) && t.getDate() === +d.slice(8); };
function meSet(part) { lib.me = { ...me(), ...part }; saveLib(); gradeDefaultApply(); }
// The school system by name, for the words on screen: "Open a ManageBac download", "Comment for Canvas". Empty: no system named.
const sysName = () => String(me().sys || '').trim();
const SYS_LIST = ['Google Classroom', 'ManageBac', 'Canvas', 'Microsoft Teams', 'Moodle', 'Schoology'];
const sysOr = other => sysName() || other;
const sysLink = () => sysName() || 'Class page';   // the link each class can carry to its page in the school's system
const sysDl = () => sysName() ? 'the ' + sysName() + ' download' : 'the papers';
// The same idea for a unit: where its plan lives. "Atlas" for a teacher who had it before.
const unitWord = () => unitLinkName() || 'unit plan';
// The link a unit can carry: "Atlas" for a teacher who had it before, a plain "unit plan" for everyone else.
const unitLinkName = () => String(me().unit || '').trim();
// The ways of grading the welcome and Settings offer. Each is only a starting setup for a new assignment (Rubric setup still
// changes any one of them), and for letters and IB grades, the percent each grade starts at.
const GRADE_WAYS = [
  ['rubric', 'Rubric rows', 'Score each row 0 to 4, half points too. The total and percent add up by themselves.', { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: null }, null],
  ['points', 'Points', 'Type a total, like 17 out of 20. Each assignment has its own “out of”.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 20, scale: null }, null],
  ['percent', 'Percent', 'Type a percent for each paper.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, null],
  ['letters', 'Letter grades', 'A to F, worked out from the percent. You set where each letter starts.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, [[90, 'A'], [80, 'B'], [70, 'C'], [60, 'D'], [0, 'F']]],
  ['ib7', 'IB 1 to 7', '1 to 7, worked out from the percent. You set the boundaries for your subject.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, [[85, '7'], [70, '6'], [55, '5'], [40, '4'], [25, '3'], [10, '2'], [0, '1']]],
];
const gradeWay = k => GRADE_WAYS.find(w => w[0] === k) || null;
// What me() says about grading, tidied: { way, setup, bands }. setup can carry a row scale of the teacher's own (top, tops, half: start.js);
// with none, a rubric row is 0 to 4 with half points. No answer (a browser from before): null, and the old default stands.
function meGrade() {
  const g = me().grade; if (!g || typeof g !== 'object') return null;
  const w = gradeWay(g.way) || GRADE_WAYS[0], su = g.setup && typeof g.setup === 'object' ? g.setup : w[3];
  const bands = Array.isArray(g.bands) ? g.bands.filter(b => Array.isArray(b) && isFinite(+b[0]) && String(b[1] || '').trim()).map(b => [+b[0], String(b[1]).trim().slice(0, 12)]).sort((a, b) => b[0] - a[0]) : null;
  return { way: w[0], setup: { mode: su.mode === 'points' ? 'points' : 'rubric', criteria: Array.isArray(su.criteria) && su.criteria.length ? su.criteria.map(String) : w[3].criteria.slice(), outOf: +su.outOf || w[3].outOf, scale: su.scale && typeof su.scale === 'object' ? su.scale : null, ...rowScaleOf(su) }, bands: bands && bands.length ? bands : null };
}
const DEFAULT_SETUP_OLD = { ...DEFAULT_SETUP };
// Makes DEFAULT_SETUP this teacher's own. Called once their answer is read, and again when they change it.
function gradeDefaultApply() {
  const g = meGrade(), d = g ? g.setup : DEFAULT_SETUP_OLD, hadOwn = store.get('gs.setup', null) != null;
  for (const k of Object.keys(DEFAULT_SETUP)) delete DEFAULT_SETUP[k];
  Object.assign(DEFAULT_SETUP, JSON.parse(JSON.stringify(d)));
  if (!batch && !hadOwn) setup = { ...DEFAULT_SETUP };
}
gradeDefaultApply();
// The grade a percent earns, for a teacher who grades in letters or 1 to 7: the first boundary it reaches. '' when they don't.
function bandOf(pct) {
  const g = meGrade(); if (!g || !g.bands || pct == null || isNaN(pct)) return '';
  const b = g.bands.find(b => pct >= b[0]); return b ? b[1] : g.bands[g.bands.length - 1][1];
}
const bandSay = pct => { const b = bandOf(pct); return b ? ' · ' + b : ''; };
function saveLib() { libVer++; if (!store.set('gs.lib', lib)) toast('This browser is out of room to keep your units and rosters.'); wordsShare(); }
// The two names (the school's system, where unit plans live) are also kept where the Planner can read them, beside the class links:
// it is a separate page that never opens grading's work. Only for a teacher who has said them; nothing is written otherwise.
function wordsShare() {
  if (!lib.me) return;
  try { const v = JSON.stringify({ sys: sysName(), unit: unitLinkName(), ...(me().scale12 ? { scale12: true } : {}) }); if (localStorage.getItem('gs.words') !== v) localStorage.setItem('gs.words', v); } catch {}
}
const holders = () => lib.classes.concat([lib.loose]);
const holderById = id => id ? lib.classes.find(c => c.id === id) || null : lib.loose;
const findItem = id => { for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
const findUnit = id => { for (const c of holders()) { const u = c.units.find(x => x.id === id); if (u) return { c, u }; } return null; };
const classById = id => lib.classes.find(c => c.id === id);
// The same words as the Grades list's own summary.
const keptMore = m => (m.partial ? ' · ' + m.partial + ' partial' : '') + (m.off ? ' · ' + m.off + ' missing or excused' : '');
function batchSummary(it) {
  if (!it.batchId) return 'No papers yet';
  const data = store.get(it.batchId, null);
  const d = new Date(it.opened || (data && data.t) || Date.now());
  let n = 0;
  if (data) for (const k in data.s) { const g = data.s[k].g; if (g && (g.rubric.some(v => v != null) || g.points !== '')) n++; }
  const m = keptMeta.get(it.batchId);
  if (m) return (m.scored || 0) + ' of ' + (m.n - (m.off || 0)) + ' scored' + keptMore(m) + (m.papers ? '' : ' · papers not kept');
  return 'Opened ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (data ? ' · ' + n + ' scored' : '') + ' · drop the same ZIP to keep going';
}
