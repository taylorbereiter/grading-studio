// Builds the new app into next/: the pages (next/index.html, next/proof.html) and their code (next/dist/). The current app's build
// (build.js) is not touched, and nothing here goes into its pages or its size budgets.
//
//   node next/build.js          (npm run next:build)
//
// ES modules, split into chunks by esbuild, Preact for the screens. Every page of the new app starts with the same few lines
// as the current app's (src/samplemode.js), so the sample keeps its own names here too. The output is committed, since the
// site is served from the repository, and CI checks it is what next/src builds.
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const ROOT = path.join(__dirname, '..'), NEXT = __dirname, DIST = path.join(NEXT, 'dist');

// The current app's languages, each by its code and its own name (the same list as build.js LANGS), for the Language setting.
function langList() {
  const src = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8'), L = JSON.parse(/const LANGS = (\[.*\]);/.exec(src)[1].replace(/'/g, '"'));
  return L.map(([code, file, obj]) => {
    const text = fs.readFileSync(path.join(ROOT, 'src/lang-' + file + '.js'), 'utf8').replace(/^\/\*[\s\S]*?\*\/[ \t]*\r?\n/, '') + '\nreturn ' + obj + ';';
    return [code, new Function(text)().name];
  });
}
// The saved-work format the current app writes (src/migrate.js DATA_V). The new app never changes the format: it writes only to
// saved work at this version, so it never writes over work a newer version has changed.
function dataVersion() {
  const src = fs.readFileSync(path.join(ROOT, 'src/migrate.js'), 'utf8'), m = /const MIGRATIONS = \[([\s\S]*?)\n  \];/.exec(src);
  if (!m) throw new Error('src/migrate.js: MIGRATIONS not found');
  return Math.max(1, ...[...m[1].matchAll(/^\s*\{\s*to:\s*(\d+)/gm)].map(x => +x[1]));
}
// next/version.json: every file the new app's worker (next/sw.js) keeps, with its SHA-256, so a version is only ever taken whole.
function writeVersion() {
  const crypto = require('crypto'), sum = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(NEXT, f))).digest('hex');
  const files = { 'index.html': sum('index.html') };
  for (const f of fs.readdirSync(DIST).sort()) if (!/^(meta\.json|gallery|proof)/.test(f)) files['dist/' + f] = sum('dist/' + f);
  const build = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version;
  fs.writeFileSync(path.join(NEXT, 'version.json'), JSON.stringify({ version: version + '-next', build, files }, null, 1) + '\n');
}

// next/src/engines/merge.js: the current app's merge code (src/merge.js, which touches neither the page nor storage), made into a
// module so the new app stamps and merges saved work with the very same functions. Made here, never edited by hand.
function writeEngines() {
  const src = fs.readFileSync(path.join(ROOT, 'src/merge.js'), 'utf8');
  const out = '// MADE BY next/build.js FROM src/merge.js. Do not edit: change src/merge.js and build again.\n/* eslint-disable */\n' + src +
    '\nexport { hashOf, recHash, revsOf, stampData, workCounts, workVec, libPrev, stampLib, mergeLib, mergeWork, mergeStates, mergeLs, focusShared, planTimeMerge, taughtInMerge, vJoin, tabDiffers, tabMerge };\n';
  fs.mkdirSync(path.join(NEXT, 'src/engines'), { recursive: true });
  const f = path.join(NEXT, 'src/engines/merge.js');
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out) fs.writeFileSync(f, out);
  return out;
}

async function build() {
  writeEngines();
  fs.rmSync(DIST, { recursive: true, force: true });
  const r = await esbuild.build({
    entryPoints: { main: path.join(NEXT, 'src/main.js'), proof: path.join(NEXT, 'src/proof.js'), parts: path.join(NEXT, 'src/ui/index.js'), gallery: path.join(NEXT, 'src/gallery/main.jsx'),
      'parts-css': path.join(NEXT, 'src/ui/parts.css'), 'gallery-css': path.join(NEXT, 'src/gallery/gallery.css'), 'shell-css': path.join(NEXT, 'src/app/shell.css') },
    loader: { '.woff2': 'file', '.json': 'json' }, assetNames: '[name]-[hash]',
    outdir: DIST, bundle: true, splitting: true, format: 'esm', target: ['chrome109', 'safari16'], minify: true,
    chunkNames: 'chunk-[hash]', entryNames: '[name]', metafile: true, absWorkingDir: ROOT, legalComments: 'none', logLevel: 'warning',
    jsxFactory: 'h', jsxFragment: 'Fragment', define: { __GS_LANGS__: JSON.stringify(langList()), __GS_DATA_V__: String(dataVersion()) },
  });
  fs.writeFileSync(path.join(DIST, 'meta.json'), JSON.stringify(r.metafile, null, 1) + '\n');
  // The tokens, as a stylesheet: made from next/src/ui/tokens.js, the one place colours and sizes are written.
  const tokens = await import(require('url').pathToFileURL(path.join(NEXT, 'src/ui/tokens.js')).href);
  fs.writeFileSync(path.join(DIST, 'tokens.css'), tokens.css());
  const sample = fs.readFileSync(path.join(ROOT, 'src/samplemode.js'), 'utf8').replace(/^[ \t]*\/\/.*\r?\n/gm, '');
  const page = (title, entry, body) => '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + title + '</title>\n' +
    '<script>' + sample + '</script>\n' +
    '<style>:root{--bg:#F4F5F7;--ink:#1B1F24;--muted:#5B6470;--line:#E4E6EA}:root[data-theme="dark"]{--bg:#14181F;--ink:#E8EAED;--muted:#A3ABB5;--line:#2A3039}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.wrap{max-width:640px;margin:0 auto;padding:48px 16px}h1{font-size:24px;margin:0 0 12px}p{color:var(--muted)}.state{color:var(--ink);border-top:1px solid var(--line);padding-top:12px}</style>\n' +
    '<script>try{if(JSON.parse(localStorage.getItem("gs.theme"))==="dark")document.documentElement.dataset.theme="dark"}catch(e){}</script>\n' +
    '<script type="module" src="dist/' + entry + '.js"></script></head><body>' + body + '</body></html>\n';
  // Pages with the parts: the tokens and parts stylesheets, and the teacher's theme put on before anything is drawn (read only).
  const look = '<script>(function(){var L=' + JSON.stringify(tokens.LOOKS) + ',v=null;try{v=JSON.parse(localStorage.getItem("gs.look"))}catch(e){}if(L.indexOf(v)<0){var d=null;try{d=JSON.parse(localStorage.getItem("gs.theme"))}catch(e){}v=d==="dark"?"midnight":' + JSON.stringify(tokens.DEFAULT_LOOK) + '}document.documentElement.dataset.look=v})()</script>\n';
  const partsPage = (title, entry, css, style, body) => '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="data:,"><title>' + title + '</title>\n' +
    '<script>' + sample + '</script>\n' + look +
    '<link rel="stylesheet" href="dist/tokens.css"><link rel="stylesheet" href="dist/parts-css.css">' + css.map(c => '<link rel="stylesheet" href="dist/' + c + '.css">').join('') + (style ? '<style>' + style + '</style>' : '') + '\n' +
    '<script type="module" src="dist/' + entry + '.js"></script></head><body>' + body + '</body></html>\n';
  fs.writeFileSync(path.join(NEXT, 'index.html'), partsPage('Grading Studio (new)', 'main', ['shell-css'], '.wrap{max-width:640px;margin:0 auto;padding:48px 16px}h1{font-size:var(--t5);margin:0 0 12px}p{color:var(--mute)}.state{color:var(--ink);border-top:1px solid var(--line);padding-top:12px}', '<div id="app"></div>'));
  fs.writeFileSync(path.join(NEXT, 'gallery.html'), partsPage('Parts gallery', 'gallery', ['gallery-css'], '', '<div id="app"></div>'));
  fs.writeFileSync(path.join(NEXT, 'proof.html'), page('Saved-work proof', 'proof', '<p>Saved-work proof page. Used by the checks, not by teachers.</p>'));
  writeVersion();
  const sizes = Object.entries(r.metafile.outputs).map(([f, o]) => path.basename(f) + ' ' + (o.bytes / 1024).toFixed(1) + ' KB').join(', ');
  console.log('next/: ' + sizes);
}
module.exports = { writeEngines };
if (require.main === module) build().catch(e => { console.error(e); process.exit(1); });
