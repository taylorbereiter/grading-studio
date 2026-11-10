const fs = require('fs');
const nm = fs.existsSync('node_modules/pdfjs-dist') ? 'node_modules/' : 'libs/node_modules/';
let h = fs.readFileSync('src/app.html', 'utf8');
const rep = (k, v) => { h = h.split(k).join(v); };
// Inter (SIL Open Font License, which asks that its text travels with the font), built in so nothing is fetched on load.
const face = (file, range) => '@font-face{font-family:"Inter";font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,' + fs.readFileSync('src/fonts/' + file).toString('base64') + ') format("woff2");unicode-range:' + range + '}\n';
const fontCss = ('/*\n' + fs.readFileSync('src/fonts/OFL.txt', 'utf8') + '*/\n' +
  face('inter-latin-wght-normal.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD') +
  face('inter-latin-ext-wght-normal.woff2', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'));
rep('/*@@FONT@@*/', fontCss);
rep('/*@@POLISHCSS@@*/', fs.readFileSync('src/polish.css', 'utf8') + fs.readFileSync('src/scans.css', 'utf8') + fs.readFileSync('src/quiz.css', 'utf8'));
rep('/*@@RUBRICSCSS@@*/', fs.readFileSync('src/rubrics.css', 'utf8') + fs.readFileSync('src/book.css', 'utf8'));
rep('/*@@INSIGHTCSS@@*/', fs.readFileSync('src/insight.css', 'utf8'));
rep('/*@@SHELLCSS@@*/', fs.readFileSync('src/shell.css', 'utf8') + fs.readFileSync('src/classpage.css', 'utf8') + fs.readFileSync('src/tabs.css', 'utf8'));
rep('/*@@PDFJS@@*/', fs.readFileSync(nm + 'pdfjs-dist/build/pdf.min.js', 'utf8'));
rep('/*@@PDFLIB@@*/', fs.readFileSync(nm + 'pdf-lib/dist/pdf-lib.min.js', 'utf8'));
rep('/*@@H2C@@*/', fs.readFileSync(nm + 'html2canvas/dist/html2canvas.min.js', 'utf8'));
rep('/*@@MAMMOTH@@*/', fs.readFileSync(nm + 'mammoth/mammoth.browser.min.js', 'utf8'));
rep('/*@@FFLATE@@*/', fs.readFileSync(nm + 'fflate/umd/index.js', 'utf8'));
rep('/*@@WORKER@@*/', fs.readFileSync(nm + 'pdfjs-dist/build/pdf.worker.min.js', 'utf8'));
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
rep('/*@@APP@@*/', (fs.readFileSync('src/migrate.js', 'utf8') + '\ngsData.boot(function () {\n' + ['app', 'names', 'marking', 'stamps', 'grades', 'saving', 'carryover', 'exportreport', 'rubrics', 'book', 'intake', 'polish', 'insight', 'people', 'scans', 'merge', 'folder', 'takehome', 'quiz', 'imported', 'marksout', 'pastetext', 'groups', 'wordnotes', 'wordpdf', 'classpage', 'tabs', 'shell'].map(n => fs.readFileSync('src/' + n + '.js', 'utf8')).join('\n') + '\n});').replace(/^[ \t]*\/\/.*\r?\n/gm, '').replace('/*@@STICKERS@@*/{}', () => stickerSrc));
rep("'/*@@GCID@@*/'", JSON.stringify(process.env.GCID || ''));
rep("'/*@@VERSION@@*/'", JSON.stringify(require('./package.json').version));   // the version shown in the app: set it in package.json
fs.mkdirSync('out', { recursive: true });
const fullHtml = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + h + '\n</body></html>';
fs.writeFileSync('Grading Studio.html', fullHtml);
fs.writeFileSync('out/Grading Studio.html', fullHtml);
fs.writeFileSync('index.html', fullHtml.replace('</head>', '<meta name="robots" content="noindex"></head>'));
fs.mkdirSync('out/netlify', { recursive: true });
fs.writeFileSync('out/netlify/index.html', '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"></head><body>\n' + h + '\n</body></html>');
fs.writeFileSync('out/artifact.html', h.split('�').join('\\uFFFD'));
console.log((h.length / 1e6).toFixed(2) + 'MB');
// The Planner: its own page, built only from src/planner. No grading code goes into it.
{
  let p = fs.readFileSync('src/planner/planner.html', 'utf8');
  const prep = (k, v) => { p = p.split(k).join(v); };
  prep('/*@@FONT@@*/', fontCss);
  prep('/*@@FFLATE@@*/', fs.readFileSync(nm + 'fflate/umd/index.js', 'utf8'));
  // pdf.js for the side panel's books; the worker waits as text until a book is opened
  prep('/*@@PDFJS@@*/', fs.readFileSync(nm + 'pdfjs-dist/build/pdf.min.js', 'utf8'));
  prep('/*@@MAMMOTH@@*/', fs.readFileSync(nm + 'mammoth/mammoth.browser.min.js', 'utf8'));
  prep('/*@@WORKER@@*/', fs.readFileSync(nm + 'pdfjs-dist/build/pdf.worker.min.js', 'utf8'));
  prep('/*@@PLANNER@@*/', ('(() => {\n' + ['base', 'bank', 'review', 'lessons', 'looks', 'rich', 'activities', 'materials', 'finished', 'variants', 'extras', 'library', 'panel', 'notebook', 'units'].map(n => fs.readFileSync('src/planner/' + n + '.js', 'utf8')).join('\n') + '\n})();').replace(/^[ \t]*\/\/.*\r?\n/gm, ''));
  const page = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"></head><body>\n' + p + '\n</body></html>';
  fs.writeFileSync('planner.html', page);
  fs.writeFileSync('Planner.html', page);
  console.log('Planner ' + (p.length / 1e6).toFixed(2) + 'MB');
}
