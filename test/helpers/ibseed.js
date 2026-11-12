// A made-up MYP Sciences class with four tasks of typed-in levels, for the IB tests and pictures. Every name is made up.
const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Edda Pretend', 'Finn Notreal'];
function ibSeed({ lv = true } = {}) {
  const task = (id, name, due, crit, rows, more) => ({ id, name, classId: 'c1', type: 'sum', due, crit, ...more,
    typed: { lv: true, s: Object.fromEntries(NAMES.map((n, i) => [n, rows[i]]).filter(x => x[1]).map(([n, r]) => [n, { l: Object.fromEntries(crit.map((k, j) => [k, r[j]]).filter(x => x[1] != null)) }])) } });
  const lib = {
    classes: [
      { id: 'c1', name: 'MYP 3 Sciences', names: NAMES, way: 'myp', ib: { group: 'sci' }, units: [{ id: 'u1', name: 'Unit 1', items: [
        task('i1', 'Cells lab report', '2026-09-12', ['A', 'D'], [[6, 5], [4, 3], [8, 7], [3, 2], [5, 5], [6, 6]]),
        task('i2', 'Density inquiry', '2026-09-30', ['B', 'C'], [[5, 6], [4, 4], [7, 8], [3, 3], [6, 5], [5, 6]]),
        task('i3', 'Unit test', '2026-10-14', ['A'], [[7], [4], [8], [5], [5], [6]]),
        task('i4', 'Energy investigation', '2026-11-03', ['B', 'C', 'D'], [[6, 6, 6], [3, 5, 4], [8, 7, 7], [4, 4, null], [6, 6, 6], [5, 6, 6]]),
      ] }] },
      { id: 'c2', name: 'Grade 9 English', names: NAMES.slice(0, 3), units: [] },
    ],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-01-15' }, { id: 't2', name: 'Term 2', start: '2027-01-16', end: '2027-06-30' }] },
  };
  if (lv) lib.classes[0].lv = { t1: {
    'Aria Testwell': { A: 7, B: 6, C: 6, t: 1 }, 'Bram Sample': { A: 4, B: 4, C: 5, D: 4, t: 1 }, 'Cleo Fixture': { A: 8, B: 8, C: 7, D: 7, t: 1 },
    'Dov Madeup': { A: 5, B: 4, C: 4, t: 1 }, 'Finn Notreal': { A: 6, B: 5, C: 6, D: 6, t: 1 } } };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
module.exports = { ibSeed, NAMES };
