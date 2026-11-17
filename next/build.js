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

async function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  const r = await esbuild.build({
    entryPoints: { main: path.join(NEXT, 'src/main.js'), proof: path.join(NEXT, 'src/proof.js'), parts: path.join(NEXT, 'src/ui/index.js'), gallery: path.join(NEXT, 'src/gallery/main.jsx'),
      'parts-css': path.join(NEXT, 'src/ui/parts.css'), 'gallery-css': path.join(NEXT, 'src/gallery/gallery.css') },
    loader: { '.woff2': 'file', '.json': 'json' }, assetNames: '[name]-[hash]',
    outdir: DIST, bundle: true, splitting: true, format: 'esm', target: ['chrome109', 'safari16'], minify: true,
    chunkNames: 'chunk-[hash]', entryNames: '[name]', metafile: true, absWorkingDir: ROOT, legalComments: 'none', logLevel: 'warning',
    jsxFactory: 'h', jsxFragment: 'Fragment',
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
  fs.writeFileSync(path.join(NEXT, 'index.html'), partsPage('Grading Studio (new)', 'main', [], '.wrap{max-width:640px;margin:0 auto;padding:48px 16px}h1{font-size:var(--t5);margin:0 0 12px}p{color:var(--mute)}.state{color:var(--ink);border-top:1px solid var(--line);padding-top:12px}', '<div id="app"></div>'));
  fs.writeFileSync(path.join(NEXT, 'gallery.html'), partsPage('Parts gallery', 'gallery', ['gallery-css'], '', '<div id="app"></div>'));
  fs.writeFileSync(path.join(NEXT, 'proof.html'), page('Saved-work proof', 'proof', '<p>Saved-work proof page. Used by the checks, not by teachers.</p>'));
  const sizes = Object.entries(r.metafile.outputs).map(([f, o]) => path.basename(f) + ' ' + (o.bytes / 1024).toFixed(1) + ' KB').join(', ');
  console.log('next/: ' + sizes);
}
build().catch(e => { console.error(e); process.exit(1); });
