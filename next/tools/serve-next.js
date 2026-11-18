// A tiny local web server for the new app's pages (next/), for the checks and the gallery pictures. Answers only this computer.
const http = require('http'), fs = require('fs'), path = require('path');
const NEXT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.json': 'application/json' };
function serveNext(port = 0) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(NEXT, path.normalize(p));
    if (!f.startsWith(NEXT + path.sep) || !/^\/(index|gallery|proof)\.html$|^\/(sw\.js|version\.json)$|^\/dist\//.test(p) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise((resolve, reject) => { srv.once('error', reject); srv.listen(port, '127.0.0.1', () => { srv.unref(); resolve({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(r => { srv.closeAllConnections(); srv.close(r); }) }); }); });
}
module.exports = { serveNext };
if (require.main === module) serveNext(+process.argv[2] || 4174).then(s => console.log('next/ at ' + s.url + 'gallery.html'));
