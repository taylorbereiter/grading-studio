// Named lines (next/docs/languages.md): every line the new app shows is in next/lang/en.json and is used, and no part types
// English of its own. The browser check (next/test/browser/words.test.js) then proves the second on the drawn gallery.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
// en.json: the app's lines. gallery.en.json: the gallery page's own, never shipped with the app (only gallery/ may use them).
const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lang', f), 'utf8'));
const APP = read('en.json'), GAL = read('gallery.en.json'), BLD = read('building.en.json'), PLAN = read('plan.en.json'), TOOL = read('tools.en.json'), EDIT = read('edit.en.json'), MORE = read('more.en.json'), MARK = read('mark.en.json'), SETUP = read('setup.en.json'), PAPER = read('paper.en.json'), VIDEO = read('video.en.json'), SAVING = read('saving.en.json'), CLASS = read('class.en.json'), TODO = read('todo.en.json'), FOCUS = read('focus.en.json'), SCHOOL = read('school.en.json'), HELP = read('help.en.json'), PREFS = read('prefs.en.json'), EN = { ...APP, ...TODO, ...FOCUS, ...SCHOOL, ...HELP, ...PREFS, ...GAL, ...BLD, ...PLAN, ...TOOL, ...EDIT, ...MORE, ...MARK, ...SETUP, ...PAPER, ...VIDEO, ...SAVING, ...CLASS };
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
  // the "not built yet" screen's own lines (next/lang/building.en.json): only that screen uses them, and they go when it goes
  assert.ok(Object.keys(BLD).every(k => k.startsWith('building.')) && !Object.keys(APP).some(k => k.startsWith('building.')));
  for (const [f, s] of Object.entries(text)) if (f !== 'app/screens/later.jsx') assert.ok(!/'building\./.test(noComments(s)), f + ' uses a building line');
});
// the planning screens' lines (next/lang/plan.en.json) load with those screens (app/plan/lines.js): a file that uses one imports it
test('planning lines live in plan.en.json and load where they are used', () => {
  assert.ok(Object.keys(PLAN).every(k => k.startsWith('plan.')) && !Object.keys(PLAN).some(k => k in APP));
  for (const [f, s] of Object.entries(text)) {
    const used = [...noComments(s).matchAll(/'(plan\.[a-z0-9_]+)'/g)].map(m => m[1]).filter(k => k in PLAN);
    if (used.length) assert.ok(/import '\.\.?\/(plan\/)?lines\.js';/.test(s), f + ' uses ' + used[0] + ' without importing plan/lines.js');
  }
  // the tools' lines (next/lang/tools.en.json) the same way, through app/plan/tool-lines.js
  assert.ok(Object.keys(TOOL).every(k => k.startsWith('tool.')) && !Object.keys(APP).some(k => k.startsWith('tool.')));
  for (const [f, s] of Object.entries(text)) if (/'tool\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '\.\.?\/(plan\/)?tool-lines\.js';/.test(s), f + ' uses a tool line without importing plan/tool-lines.js');
  // and the editor's (next/lang/edit.en.json), through app/plan/edit-lines.js
  assert.ok(Object.keys(EDIT).every(k => k.startsWith('edit.')) && !Object.keys(APP).some(k => k.startsWith('edit.')));
  for (const [f, s] of Object.entries(text)) if (/'edit\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '\.\.?\/(plan\/)?edit-lines\.js';/.test(s), f + ' uses an editor line without importing plan/edit-lines.js');
  // and the Calendar's and units' occasional tools (next/lang/more.en.json), through app/plan/more-lines.js
  assert.ok(Object.keys(MORE).every(k => k.startsWith('more.')) && !Object.keys(APP).some(k => k.startsWith('more.')));
  for (const [f, s] of Object.entries(text)) if (/'more\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '\.\.?\/(plan\/)?more-lines\.js';/.test(s), f + ' uses a tools line without importing plan/more-lines.js');
  // and the marking screens' (next/lang/mark.en.json), through app/mark/lines.js
  assert.ok(Object.keys(MARK).every(k => k.startsWith('mark.')) && !Object.keys(APP).some(k => k.startsWith('mark.')));
  for (const [f, s] of Object.entries(text)) if (/'mark\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+mark\/lines\.js';|import '\.\/lines\.js';/.test(s), f + ' uses a marking line without importing mark/lines.js');
  // and the marking screen's occasional parts' (next/lang/setup.en.json), through app/mark/setup-lines.js
  assert.ok(Object.keys(SETUP).every(k => k.startsWith('setup.')) && !Object.keys(APP).some(k => k.startsWith('setup.')));
  for (const [f, s] of Object.entries(text)) if (/'setup\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+mark\/setup-lines\.js';|import '\.\/setup-lines\.js';/.test(s), f + ' uses a setup line without importing mark/setup-lines.js');
  // and the marking screen's tools that load on their own, such as the calculator and the screenshot (next/lang/paper.en.json), through app/mark/paper-lines.js
  assert.ok(Object.keys(PAPER).every(k => k.startsWith('paper.')) && !Object.keys(APP).some(k => k.startsWith('paper.')));
  for (const [f, s] of Object.entries(text)) if (/'paper\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+mark\/paper-lines\.js';|import '\.\/paper-lines\.js';/.test(s), f + ' uses a paper line without importing mark/paper-lines.js');
  // and a Drive video's (next/lang/video.en.json), through app/mark/video-lines.js
  assert.ok(Object.keys(VIDEO).every(k => k.startsWith('video.')) && !Object.keys(APP).some(k => k.startsWith('video.')));
  for (const [f, s] of Object.entries(text)) if (/'video\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+mark\/video-lines\.js';|import '\.\/video-lines\.js';/.test(s), f + ' uses a video line without importing mark/video-lines.js');
  // and the folder's, going back in time's, safety copies' and the two-versions choice's (next/lang/saving.en.json), through app/saving/lines.js
  assert.ok(Object.keys(SAVING).every(k => k.startsWith('saving.')) && !Object.keys(APP).some(k => k.startsWith('saving.')));
  for (const [f, s] of Object.entries(text)) if (/'saving\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+(app\/)?saving\/lines\.js';|import '\.\/lines\.js';/.test(s), f + ' uses a saving line without importing saving/lines.js');
  // and the class page's tabs' (next/lang/class.en.json), through app/class/lines.js
  assert.ok(Object.keys(CLASS).every(k => k.startsWith('class.')) && !Object.keys(APP).some(k => k.startsWith('class.')));
  for (const [f, s] of Object.entries(text)) if (/'class\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+class\/lines\.js';|import '\.\/lines\.js';/.test(s), f + ' uses a class line without importing class/lines.js');
});
test('focus lines live in focus.en.json and load where they are used', () => {
  assert.ok(Object.keys(FOCUS).every(k => k.startsWith('focus.')) && !Object.keys(APP).some(k => k.startsWith('focus.')));
  for (const [f, s] of Object.entries(text)) if (/'focus\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+focus\/lines\.js';|import '\.\/lines\.js';/.test(s), f + ' uses a focus line without importing focus/lines.js');
});
test('School lines live in school.en.json and are used only by the School screen', () => {
  assert.ok(Object.keys(SCHOOL).every(k => k.startsWith('school.')) && !Object.keys(APP).some(k => k.startsWith('school.')));
  for (const [f, s] of Object.entries(text)) if (f !== 'app/screens/school.jsx') assert.ok(!/'school\.[a-z0-9_]+'/.test(noComments(s)), f + ' uses a School line');
});
test('Help lines live in help.en.json and load where they are used', () => {
  assert.ok(Object.keys(HELP).every(k => k.startsWith('help.')) && !Object.keys(APP).some(k => k.startsWith('help.')));
  for (const [f, s] of Object.entries(text)) if (/'help\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+help\/lines\.js';|import '\.\/lines\.js';/.test(s) || f === 'app/help/topics.js', f + ' uses a Help line without importing help/lines.js');
});
test('the rest of Settings has its lines in prefs.en.json and loads them where they are used', () => {
  assert.ok(Object.keys(PREFS).every(k => k.startsWith('prefs.')) && !Object.keys(APP).some(k => k.startsWith('prefs.')));
  for (const [f, s] of Object.entries(text)) if (/'prefs\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '(\.\.\/)+screens\/prefs-lines\.js';|import '\.\/prefs-lines\.js';/.test(s), f + ' uses a Settings line without importing screens/prefs-lines.js');
});
test('To do lines live in todo.en.json and are used only by the To do screen', () => {
  assert.ok(Object.keys(TODO).every(k => k.startsWith('todo.')) && !Object.keys(APP).some(k => k.startsWith('todo.')));
  for (const [f, s] of Object.entries(text)) if (f !== 'app/screens/todo.jsx') assert.ok(!/'todo\.[a-z0-9_]+'/.test(noComments(s)), f + ' uses a To do line');
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
    if (!/^(ui|services|gallery|app)\/|^main\.js$/.test(f)) continue;
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
  for (const [f, s] of Object.entries(text)) if (f !== 'services/assistant.js' && !f.startsWith('engines/')) assert.ok(!names.test(noComments(s)), f + ' names an assistant');
  for (const [k, v] of Object.entries(EN)) assert.ok(!names.test(JSON.stringify(v)), 'en.json ' + k + ' names an assistant');
});
