// Each language's lines are kept in files by area, the same areas as the English (next/lang/<area>.en.json, and en.json, whose
// area is "core"): next/lang/<code>/<area>.json. A screen's lines file loads its area in the chosen language with it
// (i18n/t.js addLines), so a language's lines arrive with the screens that use them and no one file holds them all.
// '@locale' is in core. Used by tools/lang-convert.js and the tests; node next/tools/lang-areas.js writes every file again.
const fs = require('fs'), path = require('path');
const LANG = path.join(__dirname, '..', 'lang');
const CODES = ['zh-Hant', 'zh-Hans', 'es', 'fr', 'de', 'pt-BR', 'ja', 'ko'];
const SKIP = ['gallery.en.json'];   // the gallery page's own lines never ship
// area -> its English lines
function english() {
  const out = {};
  for (const f of fs.readdirSync(LANG).filter(f => /^(\w+\.)?en\.json$/.test(f) && !SKIP.includes(f)).sort()) out[f === 'en.json' ? 'core' : f.slice(0, -8)] = JSON.parse(fs.readFileSync(path.join(LANG, f), 'utf8'));
  return out;
}
const areaFiles = code => { const d = path.join(LANG, code); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')).sort() : []; };
// one language, every area as one object (key -> line, and '@locale')
function readLang(code) { const out = {}; for (const f of areaFiles(code)) Object.assign(out, JSON.parse(fs.readFileSync(path.join(LANG, code, f), 'utf8'))); return out; }
// one language's areas as they are on disk: area -> lines
function readAreas(code) { return Object.fromEntries(areaFiles(code).map(f => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(LANG, code, f), 'utf8'))])); }
// writes one language from one object, each line into its English area's file, in the English order
function writeLang(code, all) {
  const EN = english(), d = path.join(LANG, code); fs.mkdirSync(d, { recursive: true });
  for (const f of areaFiles(code)) if (!(f.slice(0, -5) in EN)) fs.unlinkSync(path.join(d, f));
  for (const [area, en] of Object.entries(EN)) {
    const out = area === 'core' && all['@locale'] ? { '@locale': all['@locale'] } : {};
    for (const k of Object.keys(en)) if (all[k] != null) out[k] = all[k];
    fs.writeFileSync(path.join(d, area + '.json'), JSON.stringify(out, null, 1) + '\n');
  }
}
module.exports = { LANG, CODES, english, readLang, readAreas, writeLang };
if (require.main === module) for (const c of CODES) { const one = path.join(LANG, c + '.json'); writeLang(c, fs.existsSync(one) ? JSON.parse(fs.readFileSync(one, 'utf8')) : readLang(c)); if (fs.existsSync(one)) fs.unlinkSync(one); }
