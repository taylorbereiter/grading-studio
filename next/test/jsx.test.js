// A file that uses <>…</> must import Fragment from preact, or the screen fails only when that branch first draws.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.jsx$/.test(e.name) ? [path.join(d, e.name)] : []);
test('every .jsx file that uses <> imports Fragment', () => {
  const bad = walk(path.join(__dirname, '..', 'src')).filter(f => { const s = fs.readFileSync(f, 'utf8'); return /<>/.test(s) && !/import\s*\{[^}]*\bFragment\b[^}]*\}\s*from\s*'preact'/.test(s); });
  assert.deepEqual(bad.map(f => path.relative(path.join(__dirname, '..'), f)), []);
});
