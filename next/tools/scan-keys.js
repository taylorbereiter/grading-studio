// Lists every saved-work name the current app's source spells out: localStorage and sessionStorage keys (gs.*, gsp.*, gsc.*, gsm.*)
// and IndexedDB database names, each with the files that use it. next/test/keys.test.js holds the registry (next/src/shared/keys.js)
// against this, so a key added to the current app without a line in the registry fails the check.
//
//   node next/tools/scan-keys.js          prints the list
//   node next/tools/scan-keys.js --json   as JSON
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'src');

function files(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) out.push(...files(p));
    else if (/\.(js|html)$/.test(f.name) && !/^lang-/.test(f.name) && f.name !== 'sample-data.js') out.push(p);
  }
  return out;
}
// A key is a quoted string that starts with one of the app's own prefixes. One that ends in "." is a prefix: the rest is made at run time.
const KEY = /['"`]((?:gs|gsp|gsc|gsm)\.[A-Za-z0-9_.-]*)['"`]/g, DB = /['"`](grading-studio-(?:keep|added|examples|school|videos|folder|models|safety)|gs-lessons)['"`]/g;
function scan() {
  const keys = {}, dbs = {};
  for (const f of files(SRC)) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/'), text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(KEY)) if (m[1] !== 'gs.' && m[1] !== 'gsp.' && m[1] !== 'gsc.') (keys[m[1]] ||= new Set()).add(rel);
    for (const m of text.matchAll(DB)) (dbs[m[1]] ||= new Set()).add(rel);
  }
  const plain = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, [...o[k]].sort()]));
  return { keys: plain(keys), dbs: plain(dbs) };
}
module.exports = { scan };
if (require.main === module) {
  const r = scan();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else { for (const [k, f] of Object.entries(r.keys)) console.log(k.padEnd(22), f.join(' ')); console.log(); for (const [k, f] of Object.entries(r.dbs)) console.log(k.padEnd(26), f.join(' ')); }
}
