const fs = require('fs');
const nm = fs.existsSync('node_modules/pdfjs-dist') ? 'node_modules/' : 'libs/node_modules/';
let h = fs.readFileSync('src/app.html', 'utf8');
// The app's own style sheets ship without their comments (the font's licence, added apart, keeps its own).
const css = f => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rep = (k, v) => { h = h.split(k).join(v); };
// Inter (SIL Open Font License, which asks that its text travels with the font), built in so nothing is fetched on load.
const face = (file, range) => '@font-face{font-family:"Inter";font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,' + fs.readFileSync('src/fonts/' + file).toString('base64') + ') format("woff2");unicode-range:' + range + '}\n';
const fontCss = ('/*\n' + fs.readFileSync('src/fonts/OFL.txt', 'utf8') + '*/\n' +
  face('inter-latin-wght-normal.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD') +
  face('inter-latin-ext-wght-normal.woff2', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'));
// The sample is kept apart from real work by a few lines that run before anything else, on both pages (src/samplemode.js).
// A file with no template literal in it can't hold a line whose leading spaces mean anything, so they don't ship either (about 65 KB).
const dent = js => js.includes('`') ? js : js.replace(/^[ \t]+/gm, '');
const sampleMode = fs.readFileSync('src/samplemode.js', 'utf8').replace(/^[ \t]*\/\/.*\r?\n/gm, '');
rep('/*@@SAMPLEMODE@@*/', sampleMode);
rep('/*@@FONT@@*/', fontCss);
const tokensCss = css('src/tokens.css'), partsCss = css('src/parts.css');   // the same tokens and shared parts in both pages
rep('/*@@TOKENS@@*/', tokensCss);
rep('/*@@PARTSCSS@@*/', partsCss);
rep('/*@@POLISHCSS@@*/', css('src/polish.css') + css('src/scans.css') + css('src/quiz.css'));
rep('/*@@RUBRICSCSS@@*/', css('src/rubrics.css') + css('src/book.css'));
rep('/*@@INSIGHTCSS@@*/', css('src/insight.css'));
rep('/*@@SHELLCSS@@*/', css('src/rail.css') + css('src/shell.css') + css('src/today.css') + css('src/classpage.css') + css('src/goals.css') + css('src/ib.css') + css('src/tabs.css') + css('src/markscreen.css') + css('src/sidepane.css') + css('src/typednotes.css') + css('src/safe.css') + css('src/welcome.css') + css('src/examples.css') + css('src/help.css') + css('src/school.css') + css('src/classroom.css') + css('src/reports.css') + css('src/attend.css') + css('src/missing.css') + css('src/todo.css') + css('src/focus.css') + css('src/tracker.css') + css('src/gradeplan.css') + css('src/sheet.css') + css('src/touch.css') + css('src/phone.css') + css('src/seating.css') + css('src/pick.css') + css('src/snip.css') + css('src/video.css') + css('src/setupin.css'));
rep('/*@@PDFJS@@*/', fs.readFileSync(nm + 'pdfjs-dist/build/pdf.min.js', 'utf8'));
rep('/*@@PDFLIB@@*/', fs.readFileSync(nm + 'pdf-lib/dist/pdf-lib.min.js', 'utf8'));
rep('/*@@H2C@@*/', fs.readFileSync(nm + 'html2canvas/dist/html2canvas.min.js', 'utf8'));
rep('/*@@MAMMOTH@@*/', fs.readFileSync(nm + 'mammoth/mammoth.browser.min.js', 'utf8'));
rep('/*@@FFLATE@@*/', fs.readFileSync(nm + 'fflate/umd/index.js', 'utf8'));
// What the page packs is written in 85 characters, 5 for every 4 bytes (src/lang.js, unpack85, reads it back): the printable ones but " \ and <.
const P85 = (() => { let a = ''; for (let c = 33; c < 127; c++) if (c !== 34 && c !== 92 && c !== 60) a += String.fromCharCode(c); return a.slice(0, 85); })();
function pack85(buf) {
  let out = '';
  for (let i = 0; i < buf.length; i += 4) {
    const k = Math.min(4, buf.length - i); let v = 0;
    for (let j = 0; j < 4; j++) v = v * 256 + (j < k ? buf[i + j] : 0);
    const d = []; for (let j = 0; j < 5; j++) { d.unshift(P85[v % 85]); v = Math.floor(v / 85); }
    out += d.slice(0, k + 1).join('');
  }
  return out;
}
const squeeze = s => pack85(Buffer.from(require('fflate').deflateSync(Buffer.from(s, 'utf8'), { level: 9 })));
// pdf.js's worker waits as text until a paper is opened, so the grading page keeps it squeezed (src/app/start.js unpacks it).
rep('/*@@WORKERZ@@*/', squeeze(fs.readFileSync(nm + 'pdfjs-dist/build/pdf.worker.min.js', 'utf8')));
// The main code is in src/app/, one file per part of the app, joined in the order src/app/order.json gives. They share one scope, as when they were one file.
const APP = Symbol('app'), appSrc = require('./src/app/order.json').map(n => dent(fs.readFileSync('src/app/' + n + '.js', 'utf8'))).join('');
// migrate.js runs first; the rest of the app waits inside gsData.boot until saved work is ready for it.
// Reads iPhone photos. libheif and libde265, built by libheif-js, are under the LGPL, whose text travels with them. Packed to a third of its size (heicLoad unpacks it) and left alone until a photo needs it.
rep('/*@@HEICLICENSE@@*/', 'libheif-js ' + require('./' + nm + 'libheif-js/package.json').version + ': libheif (https://github.com/strukturag/libheif), libde265 (https://github.com/strukturag/libde265), built by https://github.com/catdad-experiments/libheif-js\n' + fs.readFileSync(nm + 'libheif-js/libheif-wasm/LICENSE', 'utf8'));
{
  const js = fs.readFileSync(nm + 'libheif-js/libheif-wasm/libheif-bundle.js', 'utf8'), b64 = js.match(/[A-Za-z0-9+/=]{100000,}/)[0], wasm = Buffer.from(b64, 'base64'), head = Buffer.alloc(4);
  head.writeUInt32LE(wasm.length);
  rep('/*@@HEIC@@*/', require('zlib').deflateRawSync(Buffer.concat([head, wasm, Buffer.from(js.replace(b64, () => '@@WASM@@'))]), { level: 9, memLevel: 9 }).toString('base64'));
}
// Lines that are only a comment stay in src/ but don't ship, to keep the one file from growing. A test in polish.test.js checks each one really is a comment.
// The stickers in the right-click menu: small pictures in src/stickers, built in so nothing is fetched.
const stickerSrc = JSON.stringify(Object.fromEntries(fs.readdirSync('src/stickers').filter(f => f.endsWith('.webp')).sort().map(f => [f.slice(0, -5), 'data:image/webp;base64,' + fs.readFileSync('src/stickers/' + f).toString('base64')])));
// The languages (src/lang.js says how they are used). Each is one file, src/lang-<file>.js.
// The pages at the web address carry none of them: the build writes each one out as lang/<code>.js, and a page fetches the one
// the teacher chose and no other, so twenty languages cost a teacher who uses one of them one small file.
// The double-click copies have nowhere to fetch from, so they carry every language inside, squeezed and written as text (LANG_PACKED),
// and unpack the one in use.
// To add a language, add its file and a line here: the code a browser knows it by, the file, the name of the object the file makes.
const LANGS = [['zh-Hant', 'zh', 'LANG_ZH'], ['zh-Hans', 'zh-hans', 'LANG_ZHS'], ['es', 'es', 'LANG_ES'], ['fr', 'fr', 'LANG_FR'], ['de', 'de', 'LANG_DE'], ['pt-BR', 'pt', 'LANG_PT'], ['ja', 'ja', 'LANG_JA'], ['ko', 'ko', 'LANG_KO']];
const langFiles = {}, langNames = {}, langPacked = {};
{
  const fflate = require('fflate');
  for (const [code, file, obj] of LANGS) {
    // lines that are only a comment ship in neither copy, nor does the note at the top of the file (it explains the file to whoever edits it)
    const src = (fs.readFileSync('src/lang-' + file + '.js', 'utf8').replace(/^\/\*[\s\S]*?\*\/[ \t]*\r?\n/, '') + '\nreturn ' + obj + ';').replace(/^[ \t]*\/\/.*\r?\n/gm, '');
    langNames[code] = new Function(src)().name;
    // Leading spaces don't ship either (dent, above), nor the space after each colon and comma between two quoted words; the
    // squeezed file must read back the same as the source. Comment lines are already out.
    const lean = dent(src).replace(/(?<!\\)"([:,]) "/g, '"$1"');
    if (JSON.stringify(new Function(lean)()) !== JSON.stringify(new Function(src)())) throw new Error('lang-' + file + '.js reads differently once squeezed');
    langPacked[code] = squeeze(lean);
    langFiles['lang/' + code + '.js'] = '(window.__gsLangs = window.__gsLangs || {})[' + JSON.stringify(code) + '] = (function () {\n' + lean + '\n})();\n';
  }
}
// What fills the sample (src/sample-data.js) is handled the same way: sample.js beside the pages at the web address, fetched only when
// somebody opens the sample, and squeezed inside the double-click copy.
const sampleSrc = dent(fs.readFileSync('src/sample-data.js', 'utf8').replace(/^[ \t]*\/\/.*\r?\n/gm, '')) + '\nreturn SAMPLE;';
// The builder is named by a stamp of its own contents. A page only uses the builder it was made with, and a sample another one made is made again.
const sampleStamp = require('crypto').createHash('sha256').update(sampleSrc).digest('hex').slice(0, 8);
const sampleFile = 'window.__gsSampleData = (function () {\n' + sampleSrc + '\n})();\nwindow.__gsSampleData.api = ' + JSON.stringify(sampleStamp) + ';\n';
const SAMPLE_INSIDE = 'const SAMPLE_PACKED = ' + JSON.stringify(squeeze(sampleSrc)) + ';', SAMPLE_FETCHED = 'const SAMPLE_PACKED = "";';
const LANG_INSIDE = 'const LANG_PACKED = ' + JSON.stringify(langPacked) + ';', LANG_FETCHED = 'const LANG_PACKED = {};';
const langSrc = 'const LANG_NAMES = ' + JSON.stringify(langNames) + ';\n' + LANG_INSIDE;
const sampleConsts = 'const SAMPLE_API = ' + JSON.stringify(sampleStamp) + ';\nconst SAMPLE_STAMP = ' + JSON.stringify(sampleStamp) + ';\n' + SAMPLE_INSIDE;
// In a page at the web address, before anything else runs: fetch the chosen language's file. It is a plain script beside the page,
// so the browser waits for it, and the offline copy (src/sw.js) keeps it with the pages.
const hosted = page => { if (page.split(LANG_INSIDE).length !== 2) throw new Error('the languages are not in the page once'); return page.replace(LANG_INSIDE, () => LANG_FETCHED).replace(SAMPLE_INSIDE, () => SAMPLE_FETCHED); };
// Each file is asked for with a stamp of its contents (lang/es.js?1a2b3c4d), so a page never gets the file of another version from a browser's own cache.
const langStamp = Object.fromEntries(LANGS.map(([code]) => [code, require('crypto').createHash('sha256').update(langFiles['lang/' + code + '.js']).digest('hex').slice(0, 8)]));
const LANG_LOADER = '<script>try{var gsLangV=' + JSON.stringify(langStamp) + ',gsL=JSON.parse(localStorage.getItem("gs.lang"));if(typeof gsL==="string"&&Object.prototype.hasOwnProperty.call(gsLangV,gsL))document.write(\'<script src="lang/\'+gsL+\'.js?\'+gsLangV[gsL]+\'"><\\/script>\')}catch(e){}</script>';
// A note after the code on a line ("x = 1;   // why") is left out of the page too, unless the code before it might still be inside a string.
const tailNote = (line, code) => (code.replace(/\\./g, '').match(/['"`]/g) || []).length % 2 ? line : code;
rep('/*@@APP@@*/', (fs.readFileSync('src/migrate.js', 'utf8') + '\ngsData.boot(function () {\n' + ['@langs', '@sample', 'lang', 'helpdata', 'pickshare', 'beside', APP, 'names', 'marking', 'stamps', 'grades', 'saving', 'carryover', 'exportreport', 'feedback', 'rubrics', 'rubricup', 'book', 'bookimport', 'intake', 'polish', 'insight', 'people', 'scans', 'merge', 'folder', 'takehome', 'quiz', 'imported', 'marksout', 'pastetext', 'groups', 'video', 'sidepane', 'typednotes', 'anchors', 'wordnotes', 'wordpdf', 'classpage', 'seating', 'attend', 'goals', 'ib', 'mbentry', 'reports', 'missing', 'sheet', 'tabs', 'markscreen', 'examples', 'linked', 'watch', 'snip', 'touch', 'today', 'todo', 'lofi', 'focus', 'tracker', 'gradeplan', 'settings', 'safe', 'newyear', 'welcome', 'setupin', 'help', 'school', 'classroom', 'qr', 'phone', 'solo', 'shell', 'moving', 'fullscreen', 'mail', 'sample'].map(n => n === APP ? appSrc : n === '@langs' ? langSrc : n === '@sample' ? sampleConsts : dent(fs.readFileSync('src/' + n + '.js', 'utf8'))).join('\n') + '\n});').replace(/^[ \t]*\/\/.*\r?\n/gm, '').replace(/^(.*?[;{}),])[ \t]{2,}\/\/ .*$/gm, tailNote).replace('/*@@STICKERS@@*/{}', () => stickerSrc));
// The Google sign-in key (a Client ID, not a secret: every page that signs in with Google shows its own). site.json holds the one for the
// pages at the web address; GCID in the environment is for a copy of your own.
rep("'/*@@GCID@@*/'", JSON.stringify(process.env.GCID || require('./site.json').googleClientId || ''));
// Where this copy lives and where it is moving to (site.json), only while a move is on. Otherwise the app has no address written into it.
{ const site = require('./site.json'); rep("'/*@@SITE@@*/'", JSON.stringify(site.movingTo ? { address: site.address || '', movingTo: site.movingTo } : null)); }
const VERSION = require('./package.json').version, whatsNew = require('./src/whatsnew.json');
rep("'/*@@WHATSNEW@@*/'", JSON.stringify({ [VERSION]: whatsNew[VERSION] || [] }));   // what this version brought, for About (only this one is shown; a newer version's notes come in version.json)
rep("'/*@@VERSION@@*/'", JSON.stringify(VERSION));   // the version shown in the app: set it in package.json
fs.mkdirSync('out', { recursive: true });
const fullHtml = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + h + '\n</body></html>';
fs.writeFileSync('Grading Studio.html', fullHtml);
fs.writeFileSync('out/Grading Studio.html', fullHtml);
// The pages at the web address can be installed as an app: they name the install card and the icon. The double-click copies don't, having no address to install from.
// The pages at the web address also add one to a daily count of browsers that open them (src/visits.js): only at the addresses in site.json.
const VISITS = (() => { const site = require('./site.json'), src = fs.readFileSync('src/visits.js', 'utf8').replace(/\/\*[\s\S]*?\*\/\s*/, '');
  if (src.split("'/*@@HOME@@*/'").length !== 2) throw new Error('src/visits.js: the address is not in it once');
  return '<script>' + src.replace("'/*@@HOME@@*/'", () => JSON.stringify([site.address, site.movingTo].filter(Boolean))).trim() + '</script>'; })();
const HOSTED = '<meta name="robots" content="noindex"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icons/icon-192.png"><link rel="apple-touch-icon" href="icons/icon-192.png"><meta name="theme-color" content="#FFFFFF">' + LANG_LOADER + VISITS + '</head>';
fs.writeFileSync('index.html', hosted(fullHtml).replace('</head>', HOSTED));
fs.mkdirSync('lang', { recursive: true });
for (const f of fs.readdirSync('lang')) if (!langFiles['lang/' + f]) fs.unlinkSync('lang/' + f);
for (const [f, src] of Object.entries(langFiles)) fs.writeFileSync(f, src);
fs.writeFileSync('sample.js', sampleFile);
fs.writeFileSync('out/artifact.html', h.split('�').join('\\uFFFD'));
console.log((h.length / 1e6).toFixed(2) + 'MB');
// The Planner: its own page, built only from src/planner. No grading code goes into it.
{
  let p = fs.readFileSync('src/planner/planner.html', 'utf8');
  const prep = (k, v) => { p = p.split(k).join(v); };
  prep('/*@@SAMPLEMODE@@*/', sampleMode);
  prep('/*@@FONT@@*/', fontCss);
  prep('/*@@TOKENS@@*/', tokensCss);
  prep('/*@@PARTSCSS@@*/', partsCss);
  prep('/*@@RAILCSS@@*/', css('src/rail.css'));   // the sidebar's look is shared; its code is the Planner's own (src/planner/rail.js)
  prep('/*@@PRESENTCSS@@*/', css('src/present.css') + css('src/pick.css') + css('src/focus.css'));   // + the focus timer's panel (src/planner/plfocus.js)   // presenting a lesson (src/planner/present.js)
  prep('/*@@FFLATE@@*/', fs.readFileSync(nm + 'fflate/umd/index.js', 'utf8'));
  // pdf.js for the side panel's books; the worker waits as text until a book is opened
  prep('/*@@PDFJS@@*/', fs.readFileSync(nm + 'pdfjs-dist/build/pdf.min.js', 'utf8'));
  prep('/*@@MAMMOTH@@*/', fs.readFileSync(nm + 'mammoth/mammoth.browser.min.js', 'utf8'));
  prep('/*@@WORKER@@*/', fs.readFileSync(nm + 'pdfjs-dist/build/pdf.worker.min.js', 'utf8'));
  prep('/*@@PLANNER@@*/', ('(() => {\n' + ['base', '../beside', 'bank', 'review', 'lessons', 'plain', 'looks', 'boxes', 'rich', 'activities', 'materials', 'links', 'plexamples', 'finished', 'share', 'variants', 'extras', 'library', 'panel', 'notebook', '../pickshare', 'present', '@langs', '../lang', '../helpdata', 'rail', 'units', 'plannext', '../fullscreen', '../mail', 'plantime', '../lofi', 'plfocus'].map(n => n === '@langs' ? langSrc : fs.readFileSync('src/planner/' + n + '.js', 'utf8')).join('\n') + '\n})();').replace(/^[ \t]*\/\/.*\r?\n/gm, ''));
  const page = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"></head><body>\n' + p + '\n</body></html>';
  fs.writeFileSync('planner.html', hosted(page).replace('<meta name="robots" content="noindex"></head>', HOSTED));
  fs.writeFileSync('Planner.html', page);
  console.log('Planner ' + (p.length / 1e6).toFixed(2) + 'MB');
}
// What lets the pages be installed and kept on a computer (src/sw.js says how). version.json names this build by the pages themselves,
// so the same source always gives the same name, and a kept copy can be checked against it.
{
  const sha = f => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const files = { 'index.html': sha('index.html'), 'planner.html': sha('planner.html') }, langs = Object.fromEntries(Object.keys(langFiles).map(f => [f, sha(f)]));
  fs.writeFileSync('version.json', JSON.stringify({ version: VERSION, build: require('crypto').createHash('sha256').update(files['index.html'] + files['planner.html'] + Object.values(langs).join('')).digest('hex').slice(0, 12), notes: whatsNew[VERSION] || [], files, langs }, null, 1) + '\n');
  fs.writeFileSync('sw.js', fs.readFileSync('src/sw.js', 'utf8'));
  fs.writeFileSync('manifest.webmanifest', JSON.stringify({
    name: 'Grading Studio', short_name: 'Grading Studio', description: 'Mark papers, plan lessons and hand work back. Everything stays on this computer.',
    start_url: './', scope: './', display: 'standalone', background_color: '#F4F5F7', theme_color: '#FFFFFF',
    icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
  }, null, 1) + '\n');
}
