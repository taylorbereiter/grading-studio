// A stand-in for Google (copied from test/drive-sync.test.js fakeDrive): Google's sign-in script, as far as the app uses it, and
// Drive's answers from memory, so a test never reaches a real account. Two pages hooked to the same one share one Drive.
function fakeDrive() {
  const D = { body: null, plan: null, planV: 0, etag: 0, readAt: null, blobs: {}, n: 0, writes: 0, refused: 0, afterRead: null, seq: [] };
  D.hook = async page => {
    await page.evaluateOnNewDocument(() => {
      // Google's sign-in script, as far as the app uses it: a key straight away, for whatever was asked
      window.google = { accounts: { oauth2: {
        initTokenClient: o => ({ requestAccessToken: () => (window.__gReq = (window.__gReq || 0) + 1) && setTimeout(() => o.callback({ access_token: 'tok-' + o.scope.length, expires_in: 3600, scope: o.scope }), 10) }),
        revoke: () => {},
      } } };
    });
    await page.setRequestInterception(true);
    page.on('request', r => answer(r).catch(e => { console.error(e); r.respond({ status: 500, body: String(e) }).catch(() => {}); }));
    const answer = async r => {
      const u = r.url();
      if (!/googleapis\.com|accounts\.google\.com/.test(u)) return r.continue();
      if (/alt=media/.test(u) && /files\/f1/.test(u)) D.reads = (D.reads || 0) + 1;
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match', 'Access-Control-Allow-Methods': 'GET, POST, PATCH', 'Access-Control-Expose-Headers': 'ETag' };
      const json = (o, status = 200, h = {}) => r.respond({ status, headers: { ...cors, ...h }, contentType: 'application/json', body: JSON.stringify(o) });
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors, body: '' });
      if (/\/about\?/.test(u)) return json({ user: { emailAddress: 'teacher@example.com' } });
      if (/drive\/v3\/files\?spaces=appDataFolder/.test(u) && /\.dat/.test(decodeURIComponent(u))) return json({ files: Object.entries(D.blobs).map(([id, b]) => ({ id, name: b.name })) });
      // the Planner's own file (src/app/drive.js, planSync)
      if (/drive\/v3\/files\?spaces=appDataFolder/.test(u) && /grading-studio-plan/.test(decodeURIComponent(u))) return json({ files: D.plan ? [{ id: 'f2' }] : [] });
      if (/drive\/v3\/files\/f2\?fields=id,version/.test(u)) return json({ id: 'f2', version: String(D.planV) });
      if (/drive\/v3\/files\/f2\?alt=media/.test(u)) return json(JSON.parse(D.plan));
      if (/upload\/drive\/v3\/files\/f2\?uploadType=media/.test(u) && r.method() === 'PATCH') { D.plan = r.postData() || await r.fetchPostData(); D.planV++; return json({ id: 'f2' }); }
      if (/drive\/v3\/files\?spaces=appDataFolder/.test(u)) return json({ files: D.body ? [{ id: 'f1' }] : [] });
      const blob = u.match(/drive\/v3\/files\/(p\d+)\?alt=media/);
      if (blob && D.failGet) return json({ error: { message: 'Backend Error' } }, 500);
      if (blob) return r.respond({ status: 200, headers: cors, contentType: 'application/octet-stream', body: D.blobs[blob[1]].body });
      if (/drive\/v3\/files\/f1\?fields=id,version/.test(u)) { if (D.readAt != null && D.readAt !== D.etag) D.refused++; D.readAt = null; return json({ id: 'f1', version: String(D.etag) }); }
      if (/drive\/v3\/files\/f1\?alt=media/.test(u)) { D.readAt = D.etag; const out = json(JSON.parse(D.body), 200, { ETag: '"' + D.etag + '"' }); if (D.afterRead) { const f = D.afterRead; D.afterRead = null; f(); } return out; }
      if (/upload\/drive\/v3\/files\/f1\?uploadType=media/.test(u) && r.method() === 'PATCH') {
        D.body = r.postData() || await r.fetchPostData(); D.etag++; D.writes++; D.readAt = null; D.seq.push('sync'); return json({ id: 'f1' });
      }
      if (/upload\/drive\/v3\/files\?uploadType=multipart/.test(u)) {
        const raw = r.content ? await r.content() : null, bin = raw ? Buffer.from(raw).toString('latin1') : null;   // a paper's bytes as they are (a PDF isn't text)
        const t = (raw ? Buffer.from(raw).toString('utf8') : '') || r.postData() || await r.fetchPostData() || '', dat = t.match(/"name":"([0-9a-f]+\.dat)"/);
        if (dat && D.failDat) return json({ error: { message: 'Backend Error' } }, 500);
        if (dat) {   // a paper: the part after the metadata, up to the closing boundary
          const src = bin || t, b = src.split(/\r\n/)[0], parts = src.split(b), body = Buffer.from(parts[2].slice(parts[2].indexOf('\r\n\r\n') + 4, -2), 'latin1'), id = 'p' + (++D.n);
          D.blobs[id] = { name: dat[1], body }; D.seq.push('pic'); return json({ id });
        }
        if (/grading-studio-plan\.json/.test(t)) { const b = t.split(/\r\n/)[0], parts = t.split(b); D.plan = parts[2].slice(parts[2].indexOf('\r\n\r\n') + 4, -2); D.planV++; D.planMade = (D.planMade || 0) + 1; return json({ id: 'f2' }); }
        const i = t.indexOf('{"app"'), j = t.lastIndexOf('}');
        D.body = t.slice(i, j + 1); D.etag++; D.writes++; D.readAt = null; D.seq.push('sync'); return json({ id: 'f1' });
      }
      return json({ error: { message: 'not in this test: ' + u } }, 404);
    };
  };
  D.file = () => JSON.parse(D.body);
  D.planFile = () => JSON.parse(D.plan);
  return D;
}
module.exports = { fakeDrive };
