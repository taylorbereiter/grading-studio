// Lists the lines of the language files (src/lang-*.js, their "words") that no file of the app has in it word for word: the
// candidates for lines no screen can draw any more. A candidate is not proof: a line can be put together while the app runs
// (from pieces, a name or a number), so check each one by hand before taking it out, and take it out of every language file.
//   node test/tools/lang-unused.js            the candidates, one per line, with the files that have them
//   node test/tools/lang-unused.js --bytes    and roughly what they cost
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'src');
const LANG_RE = /^lang(-.+)?\.js$/;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const app = walk(SRC).filter(f => /\.(js|html|json)$/.test(f) && !LANG_RE.test(path.basename(f))).concat([path.join(ROOT, 'sample.js'), path.join(ROOT, 'build.js')].filter(f => fs.existsSync(f)));
// The text of the app as it would be read: strings joined across " + ", escapes and the common HTML entities undone.
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&hellip;': '…', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&mdash;': '—', '&ndash;': '–', '&middot;': '·', '&times;': '×', '&rarr;': '→', '&larr;': '←' };
const read = f => {
  const raw = fs.readFileSync(f, 'utf8');
  const joined = raw.replace(/(['"`])\s*\+\s*(?:\/\/[^\n]*)?\n?\s*\1/g, '');
  const un = s => s.replace(/\\u\{?([0-9a-fA-F]{4,5})\}?/g, (x, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n').replace(/&[a-z]+;|&#39;/g, e => ENT[e] || e);
  return [raw, un(raw), un(joined)].join('\n');
};
const corpus = app.map(read).join('\n');
// Each language's words, read the way build.js reads the file.
const langs = fs.readdirSync(SRC).filter(f => /^lang-.+\.js$/.test(f));
const objOf = f => { const s = fs.readFileSync(path.join(SRC, f), 'utf8'), name = /const (LANG_\w+) = \{/.exec(s)[1]; return new Function(s + '\nreturn ' + name + ';')(); };
const where = {};
for (const f of langs) { const P = objOf(f); for (const k of Object.keys(P.words)) (where[k] = where[k] || []).push(f.replace(/^lang-|\.js$/g, '')); }
const bytes = process.argv.includes('--bytes');
let n = 0;
for (const [k, fs_] of Object.entries(where).sort((a, b) => a[0].localeCompare(b[0]))) {
  const text = k.includes('|') ? k.slice(k.indexOf('|') + 1) : k;
  if (corpus.includes(text)) continue;
  n++;
  console.log(JSON.stringify(k) + (fs_.length === langs.length ? '' : '   (only in ' + fs_.join(', ') + ')') + (bytes ? '   ~' + Math.round(k.length * 1.6 * fs_.length) + ' B' : ''));
}
console.error(n + ' of ' + Object.keys(where).length + ' lines are nowhere in the app word for word');
