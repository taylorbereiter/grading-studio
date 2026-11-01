// A tiny local web server. It answers only this computer (127.0.0.1) and serves one page, nothing else from the repo.
const http = require('http');
function serve(html, port = 0, { keepAlive } = {}) {
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p !== '/' && p !== '/index.html' && p !== '/blank') { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(p === '/blank' ? '<!doctype html><title>blank</title>' : typeof html === 'function' ? html() : html);   // /blank: same address, no app, for planting saved data first
  });
  return new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(port, '127.0.0.1', () => { if (!keepAlive) srv.unref(); resolve({ url: 'http://localhost:' + srv.address().port + '/', port: srv.address().port, close: () => new Promise(r => { srv.closeAllConnections(); srv.close(r); }) }); });
  });
}
module.exports = { serve };
