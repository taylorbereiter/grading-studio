// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
let lib = { me: null };
export const useLib = l => { lib = l || { me: null }; };
import { setup, rowScaleOf } from './gcore.js';

// src/app/library.js
const ME_OLD = { sys: 'ManageBac', unit: 'Atlas', scale12: true, ai: 'Claude' };   // scale12: Rubric setup offers the 12-point scale (12 = 100, 11 = 95…) as a preset
// src/app/library.js
const me = () => lib.me || ME_OLD;
// src/app/library.js
const GRADE_WAYS = [
  ['rubric', 'Rubric rows', 'Score each row 0 to 4, half points too. The total and percent add up by themselves.', { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: null }, null],
  ['points', 'Points', 'Type a total, like 17 out of 20. Each assignment has its own “out of”.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 20, scale: null }, null],
  ['percent', 'Percent', 'Type a percent for each paper.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, null],
  ['letters', 'Letter grades', 'A to F, worked out from the percent. You set where each letter starts.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, [[90, 'A'], [80, 'B'], [70, 'C'], [60, 'D'], [0, 'F']]],
  ['myp', 'IB MYP criteria', 'Each criterion is marked 0 to 8. You choose the level that fits best, and the total becomes a final grade of 1 to 7.', { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: null }, null],   // new classes start as MYP classes (classNewWay, ib.js)
  ['ib7', 'IB DP 1 to 7', 'A final grade of 1 to 7, worked out from the percent, as in the Diploma. You set the boundaries for your subject.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, [[85, '7'], [70, '6'], [55, '5'], [40, '4'], [25, '3'], [10, '2'], [0, '1']]],
];
// src/app/library.js
const gradeWay = k => GRADE_WAYS.find(w => w[0] === k) || null;
// src/app/library.js
function meGrade() {
  const g = me().grade; if (!g || typeof g !== 'object') return null;
  const w = gradeWay(g.way) || GRADE_WAYS[0], su = g.setup && typeof g.setup === 'object' ? g.setup : w[3];
  const bands = Array.isArray(g.bands) ? g.bands.filter(b => Array.isArray(b) && isFinite(+b[0]) && String(b[1] || '').trim()).map(b => [+b[0], String(b[1]).trim().slice(0, 12)]).sort((a, b) => b[0] - a[0]) : null;
  return { way: w[0], setup: { mode: su.mode === 'points' ? 'points' : 'rubric', criteria: Array.isArray(su.criteria) && su.criteria.length ? su.criteria.map(String) : w[3].criteria.slice(), outOf: +su.outOf || w[3].outOf, scale: su.scale && typeof su.scale === 'object' ? su.scale : null, ...rowScaleOf(su) }, bands: bands && bands.length ? bands : null };
}
export { GRADE_WAYS, gradeWay, meGrade, ME_OLD };
