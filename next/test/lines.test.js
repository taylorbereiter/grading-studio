// Named lines (next/docs/languages.md): every line the new app shows is in next/lang/en.json and is used, and no part types
// English of its own. The browser check (next/test/browser/words.test.js) then proves the second on the drawn gallery.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
// en.json: the app's lines. gallery.en.json: the gallery page's own, never shipped with the app (only gallery/ may use them).
const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lang', f), 'utf8'));
const APP = read('en.json'), GAL = read('gallery.en.json'), EN = { ...APP, ...GAL };
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(d, x.name)) : /\.jsx?$/.test(x.name) ? [path.join(d, x.name)] : []);
const files = walk(SRC);
const text = Object.fromEntries(files.map(f => [path.relative(SRC, f).split(path.sep).join('/'), fs.readFileSync(f, 'utf8')]));

test('every t() line is in en.json', () => {
  const missing = [];
  for (const [f, s] of Object.entries(text)) for (const m of noComments(s).matchAll(/\bt\(\s*'([^']+)'/g)) if (!(m[1] in EN)) missing.push(f + ': ' + m[1]);
  assert.deepEqual(missing, []);
});
test('every line in en.json is used (named in full somewhere in next/src)', () => {
  const all = Object.values(text).join('\n');
  assert.deepEqual(Object.keys(EN).filter(k => !all.includes("'" + k + "'")), []);
});
test('gallery lines stay in the gallery, app lines in the app file', () => {
  assert.ok(Object.keys(GAL).every(k => k.startsWith('gallery.')) && !Object.keys(APP).some(k => k.startsWith('gallery.')));
  for (const [f, s] of Object.entries(text)) if (!f.startsWith('gallery/')) assert.ok(!/'gallery\./.test(noComments(s)), f + ' uses a gallery line');
});
test('lines are well formed: area.name keys, plural lines have one and other, no stray braces', () => {
  for (const [k, v] of Object.entries(EN)) {
    assert.match(k, /^[a-z]+\.[a-z0-9_]+$/, k);
    const forms = typeof v === 'string' ? [v] : (assert.ok(v.one && v.other, k + ' plural needs one and other'), Object.values(v));
    for (const s of forms) assert.ok(!/\{[^}]*\{|\}[^{]*\}/.test(s.replace(/\{\w+\}/g, '')), k + ': stray brace');
  }
});
// Words typed into a part. JSX text with a letter, or a quoted literal given to aria-label, title, placeholder, alt or label.
// A line can opt out with "// not-words" at its end (key names such as Ctrl, which are not translated).
test('no part types words of its own', () => {
  const bad = [];
  for (const [f, s] of Object.entries(text)) {
    if (!/^(ui|services|gallery)\/|^main\.js$/.test(f)) continue;
    s.split('\n').forEach((line, i) => {
      if (/\/\/ not-words\s*$/.test(line)) return;
      const l = noComments(line);
      for (const m of l.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) if (!/^\s*$/.test(m[1]) && !/=>|&&|\|\||[=;(]|^\s*:|\?\s*$/.test(m[1])) bad.push(f + ':' + (i + 1) + ' text "' + m[1].trim() + '"');
      for (const m of l.matchAll(/\b(aria-label|title|placeholder|alt|label|text|sub|heading)=(["'])([^"']*[A-Za-z][^"']*)\2/g)) bad.push(f + ':' + (i + 1) + ' ' + m[1] + '="' + m[3] + '"');
      for (const m of l.matchAll(/\b(label|text|title|sub|heading)\s*:\s*(['"])([^'"]*[A-Za-z]\s+[A-Za-z][^'"]*)\2/g)) bad.push(f + ':' + (i + 1) + ' ' + m[1] + ": '" + m[3] + "'");
      for (const m of l.matchAll(/\btoast\(\s*(['"])/g)) bad.push(f + ':' + (i + 1) + ' toast with typed words');
    });
  }
  assert.deepEqual(bad, []);
});
test('no assistant is named in a part: the name comes from services/assistant.js', () => {
  const names = /\b(Claude|Gemini|ChatGPT|Copilot)\b/;
  for (const [f, s] of Object.entries(text)) if (f !== 'services/assistant.js') assert.ok(!names.test(noComments(s)), f + ' names an assistant');
  for (const [k, v] of Object.entries(EN)) assert.ok(!names.test(JSON.stringify(v)), 'en.json ' + k + ' names an assistant');
});
