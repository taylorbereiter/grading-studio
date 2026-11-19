// Converts the current app's eight languages (src/lang-*.js) into the new app's named lines (next/docs/languages.md): for every
// line in next/lang/*.en.json, the wording the current app gives the same English today. Nothing is translated anew.
//
// How a line is matched: the English is rendered with stand-in values for its parameters, put through the current app's own
// translation (src/lang.js trWith: whole line, words, fills and rules, exactly as the current page would), and the stand-ins are
// put back as parameters. A plural line is rendered once for each form (n = 1 for "one", n = 37 for "other"). A line whose
// translation loses or repeats a stand-in, or that comes back unchanged, stays English and is listed.
// Help answers are matched by topic: a piece whose English is still the current app's (src/helpdata.js) takes that piece's
// translation; a piece reworded for the new screens stays English and is listed.
//
// Since stage 7 every line has its own translation (most written new, not converted), so a run never replaces or removes a line
// a language already has: it only adds a converted line where the language has none, drops lines the app no longer has, and
// prints the lines still missing (next/test/lines.test.js fails on those unless next/lang/same.json says the line is the same
// in that language). Run: node next/tools/lang-convert.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..'), NEXT = path.join(ROOT, 'next'), LANG = path.join(NEXT, 'lang');
const LANGS = [['zh-Hant', 'zh', 'LANG_ZH'], ['zh-Hans', 'zh-hans', 'LANG_ZHS'], ['es', 'es', 'LANG_ES'], ['fr', 'fr', 'LANG_FR'], ['de', 'de', 'LANG_DE'], ['pt-BR', 'pt', 'LANG_PT'], ['ja', 'ja', 'LANG_JA'], ['ko', 'ko', 'LANG_KO']];
// Lines that never ship in the app: the parts gallery's and the "still being built" page's.
const SKIP_FILES = ['gallery.en.json', 'building.en.json'];

// The current app's translation, run as it is: src/lang.js from its helpers to tr (no page, no observer).
const langSrc = fs.readFileSync(path.join(ROOT, 'src/lang.js'), 'utf8');
const defs = langSrc.slice(langSrc.indexOf('const langCap'), langSrc.indexOf('const LANG_ROOTS'));
function translator(file, obj) {
  const ctx = { console, Intl, LANG_PACK: null };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'lang-' + file + '.js'), 'utf8') + '\n;globalThis.__P = ' + obj + ';', ctx);
  vm.runInContext(defs + '\n;globalThis.__tr = (s, ctx) => trWith(s, __P, ctx);', ctx);
  return { P: ctx.__P, tr: ctx.__tr };
}

const SAMPLE = i => String(7351 + i * 1117);   // stand-ins: numbers, so a rule that wants a number or a name matches either
const params = s => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]))];
// One English string through the current app, with its parameters put back. null when it doesn't come through whole.
function one(tr, en, nVal) {
  const ps = params(en), vals = {};
  ps.forEach((p, i) => { vals[p] = p === 'n' && nVal != null ? String(nVal) : SAMPLE(i); });
  const shown = en.replace(/\{(\w+)\}/g, (m, k) => vals[k]);
  const out = tr(shown);
  if (out === shown) return null;
  let back = out;
  for (const p of ps) {
    const v = vals[p], re = new RegExp('(?<![\\d.])' + v.replace(/\./g, '\\.') + '(?![\\d.])', 'g'), hits = (back.match(re) || []).length;
    if (hits !== 1) return null;
    back = back.replace(re, '{' + p + '}');
  }
  if (/\{\d\}|\{t\d\}/.test(back)) return null;   // a fill that was missing a piece
  return back;
}
function convert(tr, en) {
  if (typeof en === 'string') return one(tr, en);
  // a plural line: each form the English has
  const o = {};
  for (const [form, s] of Object.entries(en)) { const v = one(tr, s, form === 'one' ? 1 : 37); if (v == null) return null; o[form] = v; }
  return o;
}

// Help: new key help.<topic>_q, _a1.., _w, _go, help.sec_<id>; the current English from src/helpdata.js.
const helpSrc = fs.readFileSync(path.join(ROOT, 'src/helpdata.js'), 'utf8');
const hctx = { LANG_PACK: null, console }; vm.createContext(hctx); vm.runInContext(helpSrc + '\n;globalThis.__H = { HELP, HELP_SECS };', hctx);
const OLD_HELP = Object.fromEntries(hctx.__H.HELP.map(x => [x.id.replace(/-/g, '_'), x]));
const OLD_SECS = Object.fromEntries(hctx.__H.HELP_SECS);
function helpLine(key, en, P) {
  const m = /^help\.(sec_(\w+)|(\w+?)_(q|w|go|a(\d+)))$/.exec(key); if (!m) return undefined;
  if (m[2]) return en === OLD_SECS[m[2]] && P.helpSecs && P.helpSecs[m[2]] ? P.helpSecs[m[2]] : null;
  const old = OLD_HELP[m[3]], tx = P.help && old && P.help[old.id]; if (!old || !tx) return null;
  const part = m[4];
  if (part === 'q') return en === old.q && tx.q ? tx.q : null;
  if (part === 'w') return tx.words || null;   // search words: the language's own
  if (part === 'go') return old.go && en === old.go[0] && tx.go ? tx.go[0] : null;
  const i = +m[5] - 1; return old.a && en === old.a[i] && tx.a && tx.a[i] ? tx.a[i] : null;
}

// A line only part of which the current app knows (a general rule like "<anything> of <n>" with English left around it) is not
// taken: it shows in Chinese and Japanese as English words from the line left in the translation. Names of products and
// programmes stay English in every language, so they don't count.
const KEEP = new Set(['Google', 'Classroom', 'Drive', 'Docs', 'Sheets', 'Slides', 'PDF', 'PDFs', 'MYP', 'csv', 'txt', 'docx', 'pptx', 'zip', 'ZIP', 'Grading', 'Studio', 'ManageBac', 'Word', 'PowerPoint', 'Atlas', 'YouTube', 'Gemini', 'ChatGPT', 'Claude', 'Canvas', 'Microsoft', 'Teams', 'Moodle', 'Schoology', 'Outlook', 'Gmail', 'Chrome', 'Edge', 'Safari', 'iPhone', 'iPad', 'Mac', 'Windows', 'HEIC', 'JPG', 'PNG', 'CSV', 'Excel', 'OneDrive', 'Dropbox', 'Wi', 'Fi', 'URL', 'Ctrl', 'Shift', 'Alt', 'Esc', 'Enter', 'Tab', 'Cmd', 'Option']);
const englishIn = (en, out) => { const w = s => new Set((JSON.stringify(s).replace(/\{\w+\}/g, '').match(/[A-Za-z]{3,}/g) || []).filter(x => x !== 'one' && x !== 'other' && !KEEP.has(x))); const a = w(en); return [...w(out)].some(x => a.has(x)); };

function main() {
  const files = fs.readdirSync(LANG).filter(f => /\.en\.json$|^en\.json$/.test(f) && !SKIP_FILES.includes(f)).sort();
  const EN = {}; for (const f of files) Object.assign(EN, JSON.parse(fs.readFileSync(path.join(LANG, f), 'utf8')));
  const missing = {}, counts = {}, all = {}, locales = {};
  for (const [code, file, obj] of LANGS) {
    const { P, tr } = translator(file, obj), out = {}; locales[code] = P.locale || code;
    for (const [key, en] of Object.entries(EN)) {
      let v = key.startsWith('help.') ? helpLine(key, en, P) : undefined;
      if (v === undefined) { try { v = convert(tr, en); } catch { v = null; } }
      if (v != null && JSON.stringify(v) !== JSON.stringify(en)) out[key] = v; else (missing[key] ||= []).push(code);
    }
    all[code] = out;
  }
  const partial = new Set(Object.keys(EN).filter(k => !k.startsWith('help.') && ['zh-Hant', 'ja'].some(c => all[c][k] != null && englishIn(EN[k], all[c][k]))));
  const same = JSON.parse(fs.readFileSync(path.join(LANG, 'same.json'), 'utf8'));
  for (const [code] of LANGS) {
    const conv = all[code];
    for (const k of partial) delete conv[k];
    const had = JSON.parse(fs.readFileSync(path.join(LANG, code + '.json'), 'utf8')), out = { '@locale': had['@locale'] || locales[code] };
    for (const k of Object.keys(EN)) { const v = had[k] != null ? had[k] : conv[k]; if (v != null) out[k] = v; else if (!(same[k] || []).includes(code)) (missing[k] ||= []).push(code); }
    fs.writeFileSync(path.join(LANG, code + '.json'), JSON.stringify(out, null, 1) + '\n');
    counts[code] = Object.keys(out).length - 1;
  }
  console.log('lines', Object.keys(EN).length, counts, 'still English somewhere', Object.keys(missing).length);
  for (const [k, c] of Object.entries(missing)) console.log('  ' + k + ': ' + c.join(', '));
}
if (require.main === module) main();
module.exports = { translator, convert };
