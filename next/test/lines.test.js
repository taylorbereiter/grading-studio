// Named lines (next/docs/languages.md): every line the new app shows is in next/lang/en.json and is used, and no part types
// English of its own. The browser check (next/test/browser/words.test.js) then proves the second on the drawn gallery.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
// en.json: the app's lines. gallery.en.json: the gallery page's own, never shipped with the app (only gallery/ may use them).
const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lang', f), 'utf8'));
const APP = read('en.json'), GAL = read('gallery.en.json'), BLD = read('building.en.json'), PLAN = read('plan.en.json'), TOOL = read('tools.en.json'), EDIT = read('edit.en.json'), MORE = read('more.en.json'), MARK = read('mark.en.json'), SETUP = read('setup.en.json'), PAPER = read('paper.en.json'), VIDEO = read('video.en.json'), SAVING = read('saving.en.json'), CLASS = read('class.en.json'), TODO = read('todo.en.json'), FOCUS = read('focus.en.json'), SCHOOL = read('school.en.json'), HELP = read('help.en.json'), HOME = read('home.en.json'), SETS = read('settings.en.json'), PREFS = read('prefs.en.json'), ENGINE = read('engine.en.json'), PRESENT = read('present.en.json'), CAL = read('calendar.en.json'), LES = read('lesson.en.json'), EN = { ...LES, ...APP, ...PRESENT, ...CAL, ...ENGINE, ...HOME, ...SETS, ...TODO, ...FOCUS, ...SCHOOL, ...HELP, ...PREFS, ...GAL, ...BLD, ...PLAN, ...TOOL, ...EDIT, ...MORE, ...MARK, ...SETUP, ...PAPER, ...VIDEO, ...SAVING, ...CLASS };
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
  // the engines' lines are found by their English (app/engine-lines.js); the engine tests below hold them to what the engines draw
  assert.deepEqual(Object.keys(EN).filter(k => !(k in ENGINE) && !all.includes("'" + k + "'")), []);
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
  // and the lesson screen's later parts' (next/lang/lesson.en.json), through app/plan/les-lines.js
  assert.ok(Object.keys(LES).every(k => k.startsWith('les.')) && !Object.keys(APP).some(k => k.startsWith('les.')));
  for (const [f, s] of Object.entries(text)) if (/'les\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '\.\.?\/(plan\/)?les-lines\.js';/.test(s), f + ' uses a lesson line without importing plan/les-lines.js');
  // and the Calendar's and units' occasional tools (next/lang/more.en.json), through app/plan/more-lines.js
  assert.ok(Object.keys(MORE).every(k => k.startsWith('more.')) && !Object.keys(APP).some(k => k.startsWith('more.')));
  for (const [f, s] of Object.entries(text)) if (/'more\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '\.\.?\/(plan\/)?more-lines\.js';/.test(s), f + ' uses a tools line without importing plan/more-lines.js');
  // and Present's (next/lang/present.en.json), through app/plan/present-lines.js
  assert.ok(Object.keys(PRESENT).every(k => k.startsWith('present.')) && !Object.keys(APP).some(k => k.startsWith('present.')));
  for (const [f, s] of Object.entries(text)) if (/'present\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '\.\.?\/(plan\/)?present-lines\.js';/.test(s), f + ' uses a Present line without importing plan/present-lines.js');
  // and the Calendar's (next/lang/calendar.en.json), through app/plan/cal-lines.js
  assert.ok(Object.keys(CAL).every(k => k.startsWith('cal.')) && !Object.keys(APP).some(k => k.startsWith('cal.')));
  for (const [f, s] of Object.entries(text)) if (/'cal\.[a-z0-9_]+'/.test(noComments(s))) assert.ok(/import '\.\.?\/(plan\/)?cal-lines\.js';/.test(s), f + ' uses a Calendar line without importing plan/cal-lines.js');
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
// Home's and the Settings page's own lines (next/lang/home.en.json, settings.en.json) load with that screen, so the first load
// stays small: only that screen may use them.
test('Home and Settings page lines are used only by their screen, which loads them', () => {
  for (const [L, file, lines] of [[HOME, 'app/screens/home.jsx', 'home-lines.js'], [SETS, 'app/screens/settings.jsx', 'settings-lines.js']]) {
    for (const k of Object.keys(L)) { assert.ok(!(k in APP), k + ' is in en.json too'); for (const [f, s] of Object.entries(text)) if (f !== file) assert.ok(!s.includes("'" + k + "'"), f + ' uses ' + k + ', which loads only with ' + file); }
    assert.ok(text[file].includes("import './" + lines + "';"), file + ' imports ' + lines);
  }
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
// The eight languages (next/lang/<code>.json): only lines the app has, each with the English line's parameters (a plural's "one"
// may give the number the English spells out).
test('each language holds only the app\'s lines, with their parameters', () => {
  const codes = ['zh-Hant', 'zh-Hans', 'es', 'fr', 'de', 'pt-BR', 'ja', 'ko'];
  const ps = s => new Set([...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]));
  for (const c of codes) {
    const L = read(c + '.json');
    assert.ok(typeof L['@locale'] === 'string' && L['@locale'], c + ' has its locale');
    for (const [k, v] of Object.entries(L)) {
      if (k === '@locale') continue;
      assert.ok(k in EN, c + ' has a line the app lacks: ' + k);
      const en = EN[k];
      assert.equal(typeof v, typeof en, c + ' ' + k + ' is a plural in one and not the other');
      const forms = typeof en === 'object' ? Object.keys(en) : [null];
      for (const f of forms) {
        const a = ps(f ? en[f] : en), b = ps(f ? v[f] : v), all = typeof en === 'object' ? new Set(Object.values(en).flatMap(x => [...ps(x)])) : a;
        for (const p of b) assert.ok(all.has(p), c + ' ' + k + ' has {' + p + '} the English lacks');
        for (const p of a) assert.ok(b.has(p), c + ' ' + k + ' drops {' + p + '}');
      }
    }
  }
});
// Every line the app shows is in every language (stage 7). A line that is truly the same in a language (French "Note", German
// "Name", "Google Drive") is listed for that language in next/lang/same.json instead, and must not also be in the language file.
// A new line therefore needs its eight translations before it can merge.
test('every app line is in every language, or marked the same there', () => {
  const codes = ['zh-Hant', 'zh-Hans', 'es', 'fr', 'de', 'pt-BR', 'ja', 'ko'], same = read('same.json'), app = Object.keys(EN).filter(k => !(k in GAL) && !(k in BLD));
  for (const [k, cs] of Object.entries(same)) { assert.ok(app.includes(k), 'same.json names a line the app lacks: ' + k); for (const c of cs) assert.ok(codes.includes(c), 'same.json ' + k + ': ' + c); }
  const missing = [];
  for (const c of codes) {
    const L = read(c + '.json');
    for (const k of app) { const sm = (same[k] || []).includes(c); if (sm) assert.ok(!(k in L), c + ' ' + k + ' is marked the same but also translated'); else if (!(k in L)) missing.push(c + ' ' + k); }
    for (const [k, v] of Object.entries(L)) {
      if (k === '@locale') continue;
      assert.ok(!/\b(Claude|Gemini|ChatGPT|Copilot)\b/.test(JSON.stringify(v)), c + ' ' + k + ' names an assistant');
      for (const x of typeof v === 'object' ? Object.values(v) : [v]) assert.ok(String(x).trim(), c + ' ' + k + ' is empty');
      // French and Brazilian Portuguese use "one" for 0 too, so "one" says the number whenever "other" does
      if ((c === 'fr' || c === 'pt-BR') && typeof v === 'object' && /\{n\}/.test(EN[k].other) && /\{n\}/.test(EN[k].one)) assert.ok(/\{n\}/.test(v.one), c + ' ' + k + ' one drops {n}');
    }
  }
  assert.deepEqual(missing, []);
});

// The engines' own words (next/lang/engine.en.json). The lifted engines keep the current app's English and pass what they draw
// through tr(s), which app/engine-lines.js sets to find the line by its English. So each English text given to tr must be a line,
// and each line must be something an engine draws. A text is read as its shape: the words in its quotes, with {} for what is worked
// out ('returned ' + fmtDay(t) is "returned {}", the line "returned {date}"); a ? : gives each of its two texts.
const ENGINES = Object.fromEntries(Object.entries(text).filter(([f]) => /^engines\/g\w+\.js$/.test(f)));
const isWord = s => /[A-Za-z]{2}/.test(s.replace(/\{\}/g, ''));
const lineShape = s => s.replace(/\{\w+\}/g, '{}');
// the end of what starts at i (a bracket, or the argument list just opened), skipping quoted text
function closeAt(src, i, d = 1) {
  for (let q = null; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c) && !--d) return i;
  }
  return i;
}
// where each top-level character that passes the test is in an expression (not inside brackets or quotes)
function topAt(e, test) {
  const at = [];
  for (let i = 0, d = 0, q = null; i < e.length; i++) {
    const c = e[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) d--;
    else if (!d && test(e, i)) at.push(i);
  }
  return at;
}
const literal = e => { const m = /^'((?:[^'\\]|\\.)*)'$|^"((?:[^"\\]|\\.)*)"$/.exec(e); return m ? (m[1] ?? m[2]).replace(/\\(.)/g, '$1') : null; };
const isQ = (s, i) => s[i] === '?' && s[i + 1] !== '?' && s[i + 1] !== '.' && s[i - 1] !== '?';
function shapes(e) {
  e = e.trim();
  while (e.startsWith('(') && closeAt(e, 1) === e.length - 1) e = e.slice(1, -1).trim();
  const lit = literal(e); if (lit != null) return [lit];
  const qs = topAt(e, isQ);
  if (qs.length) {
    // the : that closes the first ?, counting any ? : inside its first text
    const rest = e.slice(qs[0] + 1); let n = 0, colon = -1;
    for (const i of topAt(rest, (s, k) => isQ(s, k) || s[k] === ':')) { if (rest[i] === '?') n++; else if (!n--) { colon = i; break; } }
    return [...shapes(rest.slice(0, colon)), ...shapes(rest.slice(colon + 1))];
  }
  const plus = topAt(e, (s, i) => s[i] === '+' && s[i + 1] !== '+' && s[i - 1] !== '+' && s[i + 1] !== '=');
  if (plus.length) {
    let out = [''];
    [0, ...plus.map(i => i + 1)].forEach((from, k) => {
      const part = e.slice(from, k < plus.length ? plus[k] : e.length), sub = shapes(part).map(x => (isWord(x) || literal(part.trim()) != null ? x : '{}'));
      out = out.flatMap(a => sub.map(b => a + b));
    });
    return out.map(x => x.replace(/(\{\})+/g, '{}'));
  }
  // an object of words looked up by a key ({ '': 'Normal text', h: 'Heading' }[sty]): each of its texts
  if (e.startsWith('{')) return [...e.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
  return ['{}'];
}
// every text given to tr(…) in the engines, with the file it is in
const trTexts = () => Object.entries(ENGINES).flatMap(([f, s]) => [...s.matchAll(/(?<![\w$.])tr\(/g)].flatMap(m => shapes(s.slice(m.index + 3, closeAt(s, m.index + 3))).map(x => [f, x])));
// words an engine hands to tr by a name (tr(STATUS_LABEL[g.status]), tr(tryName(n)), tr(foot), the typed notes' marks and sizes)
const BY_NAME = [['engines/gexport.js', /const STATUS_LABEL = (\{[^}]*\})/], ['engines/gexport.js', /const tryName = n => ([^;\n]+);/], ['engines/gexport.js', /const foot = ([^;\n]+);/],
  ['engines/gnotes.js', /const TN_K = (\{.*\});/], ['engines/gnotes.js', /const TN_SIZE = (\{.*\});/]];
const byName = () => BY_NAME.flatMap(([f, rx]) => { const m = rx.exec(ENGINES[f]); assert.ok(m, f + ' has no ' + rx); return shapes(m[1]).map(x => [f, x]); });
const forms = v => (typeof v === 'string' ? [v] : Object.values(v));
test('engine lines live in engine.en.json and load with the marking screens', () => {
  assert.ok(Object.keys(ENGINE).every(k => k.startsWith('engine.')) && !Object.keys(APP).some(k => k.startsWith('engine.')));
  for (const [f, s] of Object.entries(text)) {
    if (/engine\.en\.json/.test(noComments(s))) assert.equal(f, 'app/engine-lines.js', f + ' loads the engine lines');
    assert.ok(!/'engine\.[a-z0-9_]+'/.test(noComments(s)), f + ' names an engine line (they are found by their English)');
  }
  // one line for each English text, so a text finds one line
  const seen = new Map();
  for (const [k, v] of Object.entries(ENGINE)) for (const s of forms(v)) { assert.ok(!seen.has(s), k + ' and ' + seen.get(s) + ' have the same English'); seen.set(s, k); }
  // the lines load with the screens that use them, never with the first page
  const users = Object.entries(text).filter(([, s]) => /import '(\.\.\/)+engine-lines\.js';/.test(s)).map(([f]) => f).sort();
  assert.deepEqual(users, ['app/mark/marking.js', 'app/mark/open.js', 'app/mark/quizmaker.jsx']);
});
test('every text the engines give tr( has a line, by its English', () => {
  const lines = new Set(Object.values(ENGINE).flatMap(forms).map(lineShape));
  const all = [...trTexts(), ...byName()];
  assert.ok(all.length > 80, 'the engines\' tr( calls were found');
  assert.deepEqual(all.filter(([, x]) => isWord(x) && !lines.has(x)).map(([f, x]) => f + ': ' + JSON.stringify(x)), []);
});
test('every engine line is drawn by an engine', () => {
  const drawn = new Set([...trTexts(), ...byName()].map(([, x]) => x));
  assert.deepEqual(Object.entries(ENGINE).filter(([, v]) => !forms(v).some(s => drawn.has(lineShape(s)))).map(([k]) => k), []);
});
