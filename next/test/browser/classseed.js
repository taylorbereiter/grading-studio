// The made-up class the class page's checks and pictures use (stage 5): test/helpers/steady.js gradingSeed with more columns.
const { gradingSeed } = require('../../../test/helpers/steady.js');

// A class with every kind of column: the seed's typed and kept work, plus a 12-point summative with a half, a typed percent ending
// in .5, a retake, extra credit to the in-class average and to the grade, a column moved to the next term, one on the last day of
// a term, a formative with feedback, a teacher's own type, excused, missing and late.
function bookSeed() {
  const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']), c = lib.classes[0], N = c.names, put = (vals, more = {}) => Object.fromEntries(N.map((n, i) => [n, vals[i] === 'm' ? { v: null, st: 'missing' } : vals[i] === 'e' ? { v: null, st: 'excused' } : vals[i] == null ? null : typeof vals[i] === 'object' ? vals[i] : { v: vals[i], ...more }]).filter(x => x[1]));
  const items = [
    { id: 'i7', name: 'Speech', type: 'sum', due: '2026-12-18', typed: { max: 12, s: put([7.5, 12, { v: 9, p: 72.5 }, 'e', { v: 6, tries: [4] }, { v: 10, st: 'late' }]) } },
    { id: 'i8', name: 'Bonus reading', type: 'xc', due: '2026-10-01', xcTo: 'ic', typed: { max: null, s: put([2, 1.5, null, 3]) } },
    { id: 'i9', name: 'Lab report', type: 'ic', due: '2027-01-10', typed: { max: 10, s: put([10, 9.5, 'm', 0, 7, 5]) } },
    { id: 'i10', name: 'Moved quiz', type: 'ic', due: '2026-11-02', term: 't2', typed: { max: 20, s: put([19, 'm', 13.5, 17, 'e', 20]) } },
    { id: 'i11', name: 'Draft', type: 'fm', due: '2026-10-10', typed: { max: null, s: put([{ v: null, fb: true }, { v: null, st: 'missing' }, { v: null, fb: true }]) } },
    { id: 'i12', name: 'Project', type: 'k1', due: '2026-11-20', typed: { max: 30, s: put([25, 22.5, 30, 'm', 18, 27]) } },
    { id: 'i13', name: 'Bonus project', type: 'xc', due: '2026-11-21', xcTo: 'term', typed: { max: null, s: put([null, 2, 5]) } },
  ];
  c.units[1].items.push(...items);
  lib.book = { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-12-18' }, { id: 't2', name: 'Term 2', start: '2027-01-04', end: '2027-03-26' }], cats: [{ id: 'ic' }, { id: 'sum' }, { id: 'fm' }, { id: 'k1', name: 'Projects', k: 1 }] };
  seed.ls['gs.lib'] = JSON.stringify(lib);
  return seed;
}

// Delay the read of the synthetic papers index until the test releases it.
function holdWorkIndex(p) {
  return p.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('grading-studio-keep');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('meta', 'readwrite'), store = tx.objectStore('meta');
      let held = true;
      window.releaseWorkIndex = () => { held = false; };
      const read = () => { if (held) store.get('test').onsuccess = read; };
      read(); tx.oncomplete = () => open.result.close(); resolve();
    };
  }));
}

module.exports = { bookSeed, holdWorkIndex };
