// A tiny local web server. It answers only this computer (127.0.0.1) and serves one page and the language files, nothing else from the repo.
const http = require('http'), fs = require('fs'), path = require('path');
// Answers a request for a language file (lang/<code>.js, written by the build) and says whether it did. For a test's own server too.
function langFile(res, p) {
  if (!/^\/lang\/[A-Za-z-]+\.js$/.test(p)) return false;
  const f = path.join(__dirname, '..', '..', p); if (!fs.existsSync(f)) return false;
  res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f)); return true;
}
function serve(html, port = 0, { keepAlive } = {}) {
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    // The one other thing a page asks its address for: the file of the language it is set to (lang/<code>.js, written by the build).
    if (langFile(res, p)) return;
    if (p !== '/' && p !== '/index.html' && p !== '/blank') { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(p === '/blank' ? '<!doctype html><title>blank</title>' : typeof html === 'function' ? html() : html);   // /blank: same address, no app, for planting saved data first
  });
  return new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(port, '127.0.0.1', () => { if (!keepAlive) srv.unref(); resolve({ url: 'http://localhost:' + srv.address().port + '/', port: srv.address().port, close: () => new Promise(r => { srv.closeAllConnections(); srv.close(r); }) }); });
  });
}
module.exports = { serve, langFile };
