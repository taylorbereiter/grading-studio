// Writes next/docs/saved-work.md from the registry (next/src/shared/keys.js), the current app's source (who names each key),
// and the hand-written parts in next/docs/parts/. Run after changing the registry: npm run next:docs.
// next/test/keys.test.js fails when the file is not what this writes.
const fs = require('fs'), path = require('path');
const { scan } = require('./scan-keys');
const NEXT = path.join(__dirname, '..');

async function make() {
  const K = await import('../src/shared/keys.js'), { keys } = scan();
  const used = name => {
    const f = name.endsWith('.') ? Object.entries(keys).filter(([k]) => k === name || k.startsWith(name)).flatMap(([, v]) => v) : keys[name] || [];
    return [...new Set(f)].sort().map(x => x.replace(/^src\//, '')).join(', ') || '(no longer in the source)';
  };
  const row = e => '| `' + e[0] + (e[0].endsWith('.') ? '<id>' : '') + '` | ' + e[1] + ' | ' + e[2] + ' | ' + e[3] + ' | ' + e[4] + ' | ' + used(e[0]) + ' |';
  const head = '| Key | Side | Kind | Format | What it holds | Named in (src/) |\n|---|---|---|---|---|---|';
  const bySide = (list, side) => list.filter(e => e[1] === side);
  let md = `# Saved work: every store and key, and the layer over them

This file is made by \`npm run next:docs\` from next/src/shared/keys.js; edit that file and next/docs/parts/, not this one.

The new app (next/) reads and writes the current app's saved work where it already is, in the format it already has. Nothing
moves and nothing is converted: a teacher can go back and forth between the two versions, and the saved-work check proves it
(test/tools/saved-work.js, below).

## The layer

| Module | What it is |
|---|---|
| next/src/shared/keys.js | the registry: every key and database below, with its side of the wall |
| next/src/shared/idb.js | IndexedDB without harm: opens with no version and aborts any upgrade, so a database that isn't there stays not there (making it would stop the current app making its stores); never holds a connection; values pass through untouched |
| next/src/shared/ls.js | localStorage as text, and as JSON the way the current app writes it |
| next/src/shared/lock.js | one writer (below). Every write in idb.js and ls.js asks it first and refuses with ReadOnly |
| next/src/shared/records.js | builds typed accessors, each checked against the registry and its side |
| next/src/students/index.js | the grading side's typed accessors: work, papers, meta, edits, quick copies, added files, examples, videos, the library, rubrics… |
| next/src/planning/index.js | the Planner side's: lessons, kv records, school files, school links, taught-in notes, planning time |
| next/src/shared/device.js | the teacher's own words, the linked folder's handle, cached model files |
| next/src/crossings.js | the only module holding both sides: named, read-only functions for what planning needs from grading |
| next/src/shared/dump.js, next/src/proof.js | reading everything through the registry, and the proof's test page |

No module in the layer touches the page (no DOM). The sample: every page of the new app starts with the current app's sample lines
(src/samplemode.js, put in by next/build.js), so while the sample is open the layer reads and writes the sample's own names, as the
current app does.

**Rules for writing through the layer.** Values are stored as given; a JSON key is written with JSON.stringify as the current app
does. A save of a download's work is more than one record in the current app (src/saving.js writeWork: grading-studio-keep/work,
its meta row, the quick copy gs.b.<id>, gs.batches, and the gsc.saved.<id> stamp other windows watch), and it also goes to the
linked folder and starts a Drive sync. Stage 0 gives the records; the whole save, with the folder and Drive, comes with the stage
that first writes marks (next/docs/engines.md).

## One writer

The browser lock \`gs-writer\` (Web Locks). Every page of the current app takes a share of it (src/lock.js, run straight after the
sample lines on both pages), so any number of them work side by side as before. The new app takes it alone.

- Asked at once (ifAvailable), never waited out. Granted means this window writes. Only a browser with no Locks API, or one where
  asking throws, is let through: the current app as before, the new app after asking on a BroadcastChannel.
- A current-app page that can't get its share (the new app has the lock) is covered with a plain message, "Grading Studio is open
  in the new version in another window. Close that window to work here.", and takes no input. It stays in line, and when the new
  app's window closes it reloads, so it starts again from what is saved.
- A new-app window that can't get the lock opens read-only: every write refuses, and the page says why. It stays in line and is
  told when it becomes the writer; it must read everything again before writing.
- takeOver() takes the lock from the windows that have it; the current app's pages are then covered at once.
- In the sample the lock has the sample's own name (src/samplemode.js renames locks), so the sample and real work never block each other.
- Interim: before the switch the new app speaks the current app's multi-window protocol instead (next/docs/engines.md).
- Checked by test/lock.test.js.

## The proof

\`npm run saved-work\` (test/tools/saved-work.js), on every pull request, now also:

1. opens the layer in an empty browser: it reads nothing and makes no database, and every store and work key has a typed accessor;
2. has main's pages make work (a class, a term of scores, an assignment from a ZIP, marks, scores, a comment, a late file, a
   timetable and a lesson), then reads every record through the layer: each must be the same as the browser holds, every name
   must be in the registry, and reading must change nothing;
3. writes every record back through the typed accessors: every record must be the same afterwards, and main's pages must then
   show and keep exactly what they do from an untouched copy;
4. changes a lesson's title and a student's comment through the layer, and main's pages must show both;
5. reads the old-format work in test/fixtures/legacy-v1 through the layer, record for record.

The current app's own legs (web address and double-clicked copy, main against this build and back) are unchanged.

## localStorage

### The grading side (students)

${head}
${bySide(K.LOCAL, 'students').map(row).join('\n')}

### The Planner side (planning)

${head}
${bySide(K.LOCAL, 'planning').map(row).join('\n')}

### Neither side (shared)

${head}
${bySide(K.LOCAL, 'shared').map(row).join('\n')}

### sessionStorage

${head}
${K.SESSION.map(row).join('\n')}

## IndexedDB

| Database | Version | Side | Opened by | Store | Keyed by | What it holds |
|---|---|---|---|---|---|---|
${Object.entries(K.DATABASES).flatMap(([n, d]) => Object.entries(d.stores).map(([s, x]) => '| `' + n + '` | ' + d.version + ' | ' + d.side + ' | ' + d.by + ' | `' + s + '` | ' + x.key + ' | ' + x.what + ' |')).join('\n')}

## CacheStorage

| Cache | Side | Kind | What it holds |
|---|---|---|---|
${K.CACHES.map(c => '| `' + c[0] + '` | ' + c[1] + ' | ' + c[2] + ' | ' + c[3] + ' |').join('\n')}

The service worker's caches (\`gs-app-1\`, \`gs-next-1\`, \`gs-kept-1\`) hold the pages, not work: see next/docs/sw.md.

`;
  for (const f of fs.readdirSync(path.join(NEXT, 'docs', 'parts')).sort()) md += fs.readFileSync(path.join(NEXT, 'docs', 'parts', f), 'utf8').trim() + '\n\n';
  return md.trim() + '\n';
}
module.exports = { make };
if (require.main === module) make().then(md => { fs.writeFileSync(path.join(NEXT, 'docs', 'saved-work.md'), md); console.log('next/docs/saved-work.md'); });
