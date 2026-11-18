// Lifts the Planner's engines out of the current app's source into an ES module for the new app, the way next/build.js already
// lifts src/merge.js: the very same code, cut out by name, never retyped. The current app is not changed.
//
// The Planner's files share one scope (build.js joins them inside one function), so each top-level declaration is cut out with
// every other declaration it names, and nothing else. A declaration on the DENY list (it draws a dialog, opens storage, touches
// the page) stops the build if anything lifted reaches it: an engine must not hold UI or saving. What the lifted code still needs
// from outside (fflate, the teacher's timetable in L.setup) comes in through the module's preamble.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');

// The Planner's files in the order build.js joins them.
const FILES = ['base', 'bank', 'review', 'lessons', 'plain', 'looks', 'boxes', 'rich', 'activities', 'materials', 'links', 'plexamples', 'finished',
  'share', 'variants', 'extras', 'library', 'panel', 'notebook', 'pldrive', 'present', 'rail', 'units', 'plannext', 'plantime', 'plfocus'];

// Top-level declarations: "function x", "async function x", "const|let|var x". A declaration runs to the next line that starts at
// the left edge with something other than a closing bracket or a comment.
// The grading page's files in the order build.js joins them inside gsData.boot (src/app/* in src/app/order.json at "APP").
function gradingFiles() {
  const b = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8'), m = /\['@langs', '@sample', (.*?)\]\.map\(n => n === APP/.exec(b);
  if (!m) throw new Error('lift: the grading file list was not found in build.js');
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/app/order.json'), 'utf8'));
  return m[1].split(',').map(s => s.trim().replace(/'/g, '')).flatMap(n => n === 'APP' ? app.map(a => 'src/app/' + a + '.js') : ['src/' + n + '.js']);
}
const cache = new Map();
function declarations(files = FILES.map(f => 'src/planner/' + f + '.js')) {
  const key = files.join('|'); if (cache.has(key)) return cache.get(key);
  const out = new Map(); cache.set(key, out);
  for (const f of files) {
    // Block comments that start at the left edge are dropped first (their lines would read as part of a declaration).
    const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^\/\*[\s\S]*?\*\//gm, m => m.replace(/[^\n]/g, '')).split('\n');
    let cur = null, tpl = false;   // tpl: inside a template string that runs over several lines
    for (const ln of lines) {
      if (tpl) { cur.lines.push(ln); if (ticks(ln) % 2) tpl = false; continue; }
      const m = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
      if (m) {
        cur = { name: m[1] || m[2], file: f, lines: [ln] }; if (ticks(ln) % 2) tpl = true;
        if (out.has(cur.name)) throw new Error('lift: ' + cur.name + ' is declared twice (' + out.get(cur.name).file + ', ' + f + ')');
        out.set(cur.name, cur);
        // const a = 1, b = 2 on one line: the other names point at the same declaration.
        if (m[2]) for (const x of ln.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?!=|>)/g)) if (!out.has(x[1]) && depth(ln.slice(0, x.index)) === 0) out.set(x[1], cur);
      } else if (cur && (/^[\s})\]]/.test(ln) || ln === '')) { cur.lines.push(ln); if (ticks(ln) % 2) tpl = true; }
      else if (ln.trim() && !/^\s*(\/\/|\/\*|\*)/.test(ln)) cur = null;
    }
  }
  return out;
}
const ticks = s => (s.replace(/\\./g, '').match(/`/g) || []).length;
function depth(s) { let d = 0; for (const c of s.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '')) { if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; } return d; }
// A comment at the end of a line counts too when it starts after a space (" // "), so a word in it isn't taken for a name.
const strip = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/(?<=[;,{}()\]\s])\s+\/\/\s.*$/gm, '');
// A lone "$" counts only when it is called ($(...)): otherwise it is the end of a regular expression.
// After a spread (...x) a word is a name; after a lone dot it is a property.
const names = text => { const t = strip(text), n = new Set(t.match(/(?<![\w$])(?<![^.]\.)[A-Za-z_$][\w$]*/g) || []); if (!/(?<![\w$.])\$\(/.test(t)) n.delete('$'); return n; };

// roots: the names to export. deny: names that must not be reached. given: names the preamble provides instead of the source.
// Names a declaration declares for itself inside (const/let/var, function and arrow parameters, catch): with scoped, these are not
// looked for at the top level. Only for whole names; a name used both ways in one declaration still counts (see below).
function locals(text) {
  const t = strip(text), out = new Set(), add = l => { for (const x of l.split(',')) { const m = /^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(?:=|$)/.exec(x); if (m) out.add(m[1]); } };
  for (const m of t.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of t.matchAll(/\b(?:const|let|var)\s+[[{]([^\]}]*)[\]}]/g)) add(m[1].replace(/[\w$]+\s*:/g, ''));
  for (const m of t.matchAll(/\bfunction\s*\*?\s*[\w$]*\s*\(([^()]*)\)/g)) add(m[1]);
  for (const m of t.matchAll(/\(([^()]*)\)\s*=>/g)) add(m[1].replace(/[[\]{}]/g, ''));
  for (const m of t.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) out.add(m[1]);
  for (const m of t.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of t.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+[[{]?([^;)]*?)\s+(?:of|in)\b/g)) add(m[1].replace(/[[\]{}]/g, ''));
  return out;
}
// files: the source files and their order (default: the Planner's); 'grading' is the grading page's.
// ignore: names that are only ever local variables in what is lifted (they share a name with an unrelated top-level declaration).
function lift({ roots, deny = [], given = [], ignore = [], preamble = '', header = '', files, scoped = false }) {
  const D = declarations(files === 'grading' ? gradingFiles() : files), seen = new Set(), q = [...roots], from = new Map();
  const giv = new Set([...given, ...ignore]), den = new Set(deny);
  while (q.length) {
    const n = q.shift(); if (seen.has(n) || giv.has(n)) continue;
    const d = D.get(n); if (!d) throw new Error('lift: ' + n + ' is not a top-level name in ' + (files === 'grading' ? 'the grading page' : 'src/planner'));
    if (den.has(n)) { const chain = [n]; for (let x = n; from.has(x); ) chain.push(x = from.get(x)); throw new Error('lift: ' + n + ' would be lifted (' + chain.reverse().join(' > ') + '), but it holds UI or saving'); }
    seen.add(n);
    const text = d.lines.join('\n'), own = scoped ? locals(text) : new Set();
    for (const id of names(text)) if (!own.has(id) && id !== n && D.has(id) && !seen.has(id) && !giv.has(id)) { if (!from.has(id)) from.set(id, n); q.push(id); }
  }
  // Keep the source order (file by file, line by line), so a const is declared before anything at load reads it.
  const decls = [...new Set([...seen].map(n => D.get(n)))];
  const order = new Map(); let i = 0; for (const d of D.values()) if (!order.has(d)) order.set(d, i++);
  decls.sort((a, b) => order.get(a) - order.get(b));
  const body = decls.map(d => '// ' + d.file + '\n' + d.lines.join('\n').replace(/\s+$/, '')).join('\n');
  return header + preamble + '\n' + body + '\nexport { ' + roots.join(', ') + ' };\n';
}
module.exports = { lift, declarations, gradingFiles };
