// Old-format saved work, as written by the code from before saved-data versions (see test/tools/capture-legacy.js).
// The JSON was frozen from that old build. The papers are generated again here and checked against the old build's hashes,
// which rebuilds the same backup ZIP and the same browser storage it left behind.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { zipSync, strToU8 } = require('fflate');
const { standardFiles, extraFiles, quizFiles } = require('./fixtures');

const DIR = path.join(__dirname, '..', 'fixtures', 'legacy-v1');
const read = n => fs.readFileSync(path.join(DIR, n), 'utf8');
async function loadLegacy() {
  const text = read('backup.json'), backup = JSON.parse(text), list = JSON.parse(read('bins.json'));
  const expected = JSON.parse(read('expected.json')), ls = JSON.parse(read('localstorage.json'));
  // The old build counted a grade printed in a paper's own text. A student could have typed it, so now it waits for her OK. No saved score or mark is involved: it's read again on opening.
  for (const b of Object.values(expected)) for (const st of (b && b.students) || []) if (st.computed && st.computed.paper) st.computed = { total: null, pct: null, done: false };
  const gen = { ...await standardFiles(), ...await extraFiles(), ...await quizFiles() };
  const bins = list.map(b => {
    const u = gen[b.file];
    if (!u || crypto.createHash('sha256').update(u).digest('hex') !== b.sha256) throw new Error('Generated ' + b.file + ' no longer matches what the old build saved. Don’t change test/helpers/fixtures.js output.');
    return u;
  });
  const zip = () => {
    const files = { 'backup.json': strToU8(text) };
    list.forEach((b, i) => { files[b.entry] = [bins[i], { level: 0 }]; });   // as makeBackup packs them
    return zipSync(files);
  };
  // { __bin: 3 } in the backup is { __b: '3' } for plant().
  const ref = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.__bin === 'number' ? { __b: String(v.__bin) } : Array.isArray(v) ? v.map(ref) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ref(x)])) : v;
  const recs = s => s.k.map((k, i) => [k, ref(s.v[i])]);
  const seed = () => ({
    ls,
    bins: Object.fromEntries(bins.map((u, i) => [String(i), u])),
    idb: {
      'grading-studio-keep': { version: 2, stores: Object.fromEntries(Object.entries(backup.keep).map(([n, s]) => [n, recs(s)])) },
      'grading-studio-added': { version: 1, stores: { files: recs(backup.added) } },
    },
  });
  return { backup, expected, ls, gen, zip, seed };
}
// Empty page lists don't matter: the app drops them when it saves.
const noEmpty = marks => Object.fromEntries(Object.entries(marks).filter(([, a]) => a.length));
module.exports = { loadLegacy, noEmpty };
