/* ---------------- Google sign-in: open from Drive, save to Drive, keep work the same on every computer ---------------- */
// Everything happens between this browser and Taylor's own Google account. The sign-in is never stored or sent anywhere else.
const GOOGLE_CLIENT_ID = '/*@@GCID@@*/';
const gcid = () => (/apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID) ? GOOGLE_CLIENT_ID : '') || store.get('gs.gcid', '');
// Keeping two devices the same needs only Grading Studio's own hidden folder in her Drive (drive.appdata: it can't see her other files).
// Opening papers from Drive and saving to it ask for the whole Drive, and only when she uses them.
const SYNC_SCOPE = 'https://www.googleapis.com/auth/drive.appdata', DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive ' + SYNC_SCOPE;
const G = { token: null, exp: 0, scope: '', client: null, cscope: '', email: store.get('gs.gEmail', ''), waiters: [] };
// A home-screen app on an iPhone can't use Google's pop-up window, so it goes to Google's page and comes back with the key in the address.
const G_REDIRECT = navigator.standalone === true;
const gBack = () => location.origin + location.pathname.replace(/index\.html$/, '');
{
  // Back from Google's page: the key is taken out of the address before anything reads it
  const h = new URLSearchParams(location.hash.replace(/^#/, '')), want = (() => { try { return sessionStorage.getItem('gs.gState'); } catch { return null; } })();
  if ((h.get('access_token') || h.get('error')) && h.get('state')) {
    if (want && h.get('state') === want && h.get('access_token')) { G.token = h.get('access_token'); G.exp = Date.now() + (+h.get('expires_in') || 3600) * 1000; G.scope = h.get('scope') || SYNC_SCOPE; try { sessionStorage.setItem('gs.gTok', JSON.stringify({ t: G.token, exp: G.exp, scope: G.scope })); } catch {} }
    try { sessionStorage.removeItem('gs.gState'); history.replaceState(null, '', location.pathname + location.search); } catch {}
  } else try { const k = JSON.parse(sessionStorage.getItem('gs.gTok')); if (k && k.exp > Date.now()) { G.token = k.t; G.exp = k.exp; G.scope = k.scope || ''; } } catch {}
}
function gRedirect(scope, quiet) {
  const st = crypto.getRandomValues(new Uint32Array(2)).join('');
  try { sessionStorage.setItem('gs.gState', st); } catch {}
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: gcid(), redirect_uri: gBack(), response_type: 'token', scope, include_granted_scopes: 'true', state: st, ...(G.email ? { login_hint: G.email } : {}), ...(quiet ? { prompt: 'none' } : {}) });
}
let gisP = null;
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return gisP || (gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { gisP = null; rej(new Error('Couldn’t reach Google. Check the internet connection.')); }; document.head.appendChild(s); }));
}
// Gets a fresh token; silent when she's already signed in to Google in this browser. full: the whole Drive, for opening and saving papers.
const gHas = scope => scope.split(' ').every(x => G.scope.split(' ').includes(x));
async function gToken(interactive, full) {
  const scope = full ? DRIVE_SCOPES : SYNC_SCOPE;
  if (G.token && Date.now() < G.exp - 60000 && gHas(scope)) return G.token;
  if (!gcid()) throw new Error('setup');
  if (G_REDIRECT) { if (interactive) gRedirect(scope); throw new Error('Sign in again to sync'); }
  await loadGis();
  if (!G.client || G.cscope !== scope) {
    G.cscope = scope;
    G.client = google.accounts.oauth2.initTokenClient({
      client_id: gcid(), scope, hint: G.email || undefined, include_granted_scopes: true,
      callback: r => { const w = G.waiters.splice(0); if (r.error) w.forEach(x => x.rej(new Error(r.error))); else { G.token = r.access_token; G.exp = Date.now() + (r.expires_in || 3600) * 1000; G.scope = r.scope || scope; w.forEach(x => x.res(G.token)); } },
      error_callback: e => { const w = G.waiters.splice(0); w.forEach(x => x.rej(new Error(e && e.type === 'popup_closed' ? 'Sign-in was closed' : 'Sign-in didn’t finish'))); },
    });
  }
  return new Promise((res, rej) => { G.waiters.push({ res, rej }); G.client.requestAccessToken({ prompt: interactive && !G.email ? 'consent' : '' }); });
}
// Every call but the sync's own (gsync) is for opening or saving papers, so it asks for the whole Drive.
async function gfetch(url, opt = {}, interactive, sync, again) {
  const t = await gToken(interactive, !sync);
  const r = await fetch(url.startsWith('http') ? url : 'https://www.googleapis.com/drive/v3/' + url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + t } });
  if (r.status === 401 && !again) { G.token = null; return gfetch(url, opt, interactive, sync, true); }
  if (!r.ok) { const e = new Error('Google Drive said ' + r.status + ': ' + ((await r.text()).match(/"message":\s*"([^"]+)/) || [, ''])[1]); e.status = r.status; throw e; }
  return r;
}
const gjson = (u, o, i) => gfetch(u, o, i).then(r => r.json());
const gsync = (u, o, i) => gfetch(u, o, i, true);
async function gList(q, fields) {
  const out = []; let page = '';
  do {
    const j = await gjson('files?pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=folder,name_natural&fields=nextPageToken,files(' + (fields || 'id,name,mimeType,size') + ')&q=' + encodeURIComponent(q) + (page ? '&pageToken=' + page : ''));
    out.push(...j.files); page = j.nextPageToken;
  } while (page);
  return out;
}
const FOLDER = 'application/vnd.google-apps.folder';
async function signIn() {
  if (sampleStops('Google Drive')) return;
  if (!gcid()) return driveSetup();
  try {
    await gToken(true);
    const me = await (await gsync('about?fields=user(emailAddress)')).json();
    G.email = me.user.emailAddress; store.set('gs.gEmail', G.email);
    renderGoogle(); toast('Signed in as ' + G.email);
    syncNow();
  } catch (e) { toast(e.message || 'Sign-in didn’t finish'); }
}
function signOut() {
  if (G.token && window.google) try { google.accounts.oauth2.revoke(G.token); } catch {}
  G.token = null; G.scope = ''; G.email = ''; store.del('gs.gEmail'); try { sessionStorage.removeItem('gs.gTok'); } catch {} renderGoogle(); toast('Signed out of Google');
}
// Google sign-in only works on the hosted copy (not a downloaded file or a preview frame).
const GOK = /^https?:$/.test(location.protocol) && window.self === window.top;
function renderGoogle() {
  for (const el of document.querySelectorAll('.gAcct, #pickDrive')) el.hidden = !GOK || !gcid();   // no key built in: nothing to sign in to
  if (!GOK || !gcid()) return;
  for (const el of document.querySelectorAll('.gAcct')) el.innerHTML = G.email
    ? '<span class="muted" style="font-size:13px">Google: ' + esc(G.email) + ' · <span id="syncState">' + (syncState || 'synced') + '</span></span> <button class="link" data-gout>Sign out</button>'
    : '<button class="btn sm" data-gin>Sign in with Google</button>';
  for (const b of document.querySelectorAll('.needG')) b.hidden = !G.email;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-gin]')) signIn();
  if (e.target.closest('[data-gout]')) signOut();
});
// Only shown if the page was built without its Google key.
function driveSetup() {
  openDlg('<div class="bh"><h2>Connect Google</h2></div><div class="bb"><p style="margin-top:0">This copy of Grading Studio doesn’t have its Google key yet. Paste the Client ID here (it ends in apps.googleusercontent.com).</p>' +
    '<div class="field"><input type="text" id="gcidIn" placeholder="1234-abc.apps.googleusercontent.com" style="width:100%"></div></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-ok]')) { const v = $('#gcidIn').value.trim(); if (!/apps\.googleusercontent\.com$/.test(v)) return toast('That doesn’t look like a Client ID'); store.set('gs.gcid', v); G.client = null; closeDlg(); signIn(); }
  };
}

// Folder browser: My Drive and Shared drives, or search by name. Opens a folder (one subfolder per student) or a ZIP.
async function openFromDrive(assignment) {
  if (!G.email) { await signIn(); if (!G.email) return; }
  const trail = [{ id: 'root', name: 'My Drive' }];
  let mode = 'browse', q = '';
  openDlg('<div class="bh"><h2>Open from Google Drive</h2><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb"><div style="display:flex;gap:8px;margin-bottom:10px"><input type="search" id="dvQ" placeholder="Search your Drive for a folder or ZIP" style="flex:1;padding:8px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit"><button class="btn sm" data-shared>Shared drives</button><button class="btn sm" data-recent>Recent</button></div>' +
    '<div id="dvTrail" style="font-size:14px;margin-bottom:8px"></div><div id="dvList" style="min-height:260px"></div><div class="prog" hidden><i></i></div><p class="muted" id="dvStatus" style="font-size:13px"></p></div>' +
    '<div class="bf"><span class="muted" style="font-size:13px;margin-right:auto;align-self:center">Pick the folder with one folder per student, or the ZIP.</span><button class="btn" data-close>Cancel</button><button class="btn primary" data-here>Open this folder</button></div>');
  const box = $('#dlgBox');
  const row = f => '<button class="dvRow" data-id="' + esc(f.id) + '" data-kind="' + (f.mimeType === FOLDER || f.kind === 'drive#drive' ? 'folder' : 'zip') + '" data-name="' + esc(f.name) + '" style="display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:9px 10px;border:0;border-bottom:1px solid var(--line);background:none;color:var(--fg);font:inherit;cursor:pointer"><span>' + (f.mimeType === FOLDER || f.kind === 'drive#drive' ? '📁' : '🗜️') + '</span><span style="overflow-wrap:anywhere">' + esc(f.name) + '</span></button>';
  async function show() {
    const L = $('#dvList'); L.innerHTML = '<p class="muted">Loading…</p>';
    $('#dvTrail').innerHTML = mode === 'browse' ? trail.map((t, i) => i === trail.length - 1 ? '<b>' + esc(t.name) + '</b>' : '<button class="link" data-up="' + i + '">' + esc(t.name) + '</button> › ').join('') : '<button class="link" data-up="0">My Drive</button> › <b>' + (mode === 'search' ? 'Search: ' + esc(q) : mode === 'shared' ? 'Shared drives' : 'Recent') + '</b>';
    box.querySelector('[data-here]').disabled = mode !== 'browse' || trail.length === 1 && trail[0].id === 'root';
    try {
      let files;
      if (mode === 'shared') files = (await gjson('drives?pageSize=100')).drives.map(d => ({ ...d, kind: 'drive#drive' }));
      else if (mode === 'search') files = await gList("name contains '" + q.replace(/['\\]/g, '\\$&') + "' and (mimeType='" + FOLDER + "' or name contains '.zip') and trashed=false");
      else if (mode === 'recent') files = (await gjson("files?pageSize=30&orderBy=modifiedByMeTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)&q=" + encodeURIComponent("(mimeType='" + FOLDER + "' or name contains '.zip') and trashed=false"))).files;
      else files = await gList("'" + trail[trail.length - 1].id + "' in parents and trashed=false and (mimeType='" + FOLDER + "' or name contains '.zip')");
      L.innerHTML = files.length ? files.map(row).join('') : '<p class="muted">No folders or ZIPs here.</p>';
    } catch (e) { L.innerHTML = '<p>' + esc(e.message) + '</p>'; }
  }
  const take = async (id, name, kind) => {
    for (const b of box.querySelectorAll('.bf .btn')) b.disabled = true;
    const bar = box.querySelector('.prog'); bar.hidden = false;
    try {
      const entries = kind === 'zip' ? [{ path: name, data: new Uint8Array(await (await gfetch('files/' + id + '?alt=media&supportsAllDrives=true')).arrayBuffer()) }] : await driveFolderFiles(id, (n, t) => { bar.firstChild.style.width = (100 * n / Math.max(t, 1)) + '%'; $('#dvStatus').textContent = 'Downloading ' + n + ' of ' + t + ' files…'; });
      closeDlg();
      await intake(entries, name.replace(/\.zip$/i, ''), assignment || null);
      if (batch) { batch.drive = { id, name, kind }; saveSoon(); }
    } catch (e) { $('#dvStatus').textContent = e.message; for (const b of box.querySelectorAll('.bf .btn')) b.disabled = false; }
  };
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const u = e.target.closest('[data-up]'); if (u) { mode = 'browse'; trail.splice(+u.dataset.up + 1); return show(); }
    if (e.target.closest('[data-shared]')) { mode = 'shared'; return show(); }
    if (e.target.closest('[data-recent]')) { mode = 'recent'; return show(); }
    if (e.target.closest('[data-here]')) { const t = trail[trail.length - 1]; return take(t.id, t.name, 'folder'); }
    const r = e.target.closest('.dvRow'); if (!r) return;
    if (r.dataset.kind === 'zip') return take(r.dataset.id, r.dataset.name, 'zip');
    if (mode !== 'browse') trail.splice(1);
    mode = 'browse'; trail.push({ id: r.dataset.id, name: r.dataset.name }); show();
  };
  let qt; $('#dvQ').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value.trim(); mode = q ? 'search' : 'browse'; show(); }, 350); };
  show();
}
// Every file under a folder, with paths relative to it. Google Docs come down as PDFs.
async function driveFolderFiles(id, onStep) {
  const files = [];
  const walk = async (fid, prefix) => {
    for (const f of await gList("'" + fid + "' in parents and trashed=false")) {
      if (f.mimeType === FOLDER) await walk(f.id, prefix + f.name + '/');
      else if (/^application\/vnd\.google-apps\.(document|presentation|spreadsheet|drawing)$/.test(f.mimeType)) files.push({ ...f, path: prefix + f.name + '.pdf', exp: true });
      else if (/\.(pdf|png|jpe?g|zip|docx)$/i.test(f.name) || MEDIA_RX.test(f.name) || /^(application\/pdf|image\/(png|jpeg)|audio\/.*|video\/.*)$/.test(f.mimeType)) files.push({ ...f, path: prefix + f.name });
      else files.push({ ...f, path: prefix + f.name, skip: true });
    }
  };
  await walk(id, '');
  const out = [];
  const todo = files.filter(f => !f.skip);
  for (const f of files.filter(f => f.skip)) out.push({ path: f.path, data: new Uint8Array(0) });
  const total = todo.length; let done = 0;
  const step = () => onStep && onStep(++done, total);
  const run2 = async () => { while (todo.length) { const f = todo.shift(); const r = await gfetch(f.exp ? 'files/' + f.id + '/export?mimeType=application/pdf' : 'files/' + f.id + '?alt=media&supportsAllDrives=true'); out.push({ path: f.path, data: new Uint8Array(await r.arrayBuffer()) }); step(); } };
  await Promise.all([run2(), run2(), run2(), run2()]);
  // Same as a ZIP: one wrapping folder around all the student folders is dropped.
  const tops = new Set(out.map(o => o.path.split('/')[0]));
  if (tops.size === 1 && out.every(o => o.path.split('/').length > 2)) for (const o of out) o.path = o.path.split('/').slice(1).join('/');
  return out;
}
// Saves the export into a new folder in Drive: next to the download she opened from Drive, or in My Drive.
async function saveToDrive(name, files, onStep) {
  let parent = 'root';
  if (batch.drive) { try { const j = await gjson('files/' + batch.drive.id + '?fields=parents&supportsAllDrives=true'); parent = batch.drive.kind === 'folder' ? batch.drive.id : (j.parents && j.parents[0]) || 'root'; } catch {} }
  const mk = async (nm, par) => (await gjson('files?supportsAllDrives=true&fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nm, mimeType: FOLDER, parents: [par] }) })).id;
  const top = await mk(name, parent), dirs = new Map([['', top]]);
  const dirOf = async d => { if (dirs.has(d)) return dirs.get(d); const i = d.lastIndexOf('/'), up = await dirOf(i < 0 ? '' : d.slice(0, i)); const id = await mk(d.slice(i + 1), up); dirs.set(d, id); return id; };
  const list = Object.entries(files); let n = 0;
  for (const [path, bytes] of list) {
    const i = path.lastIndexOf('/'), par = await dirOf(i < 0 ? '' : path.slice(0, i));
    const meta = new Blob([JSON.stringify({ name: path.slice(i + 1), parents: [par] })], { type: 'application/json' });
    const fd = new FormData(); fd.append('metadata', meta); fd.append('file', new Blob([bytes], { type: /\.pdf$/i.test(path) ? 'application/pdf' : 'application/octet-stream' }));
    await gfetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', { method: 'POST', body: fd });
    onStep && onStep(++n, list.length);
  }
  return top;
}


/* Sync: the same work on every device she signs in on (a phone and a computer), through one hidden file in her own Drive.
   It carries what folder.js carries to a folder, without the papers: classes, units, rosters, typed scores and to-dos (gs.lib), each
   download's marks and scores and its row in the list, and the settings that travel (carryLs). Each side is merged the way a folder
   or a take-home file is (merge.js), student by student and field by field, so a score typed on the phone and a comment written on
   the computer both stay. Nothing goes anywhere but her browser and her Drive. */
const SYNC_NAME = 'grading-studio-sync.json';
let syncState = '', syncT = null, syncBusy = null, syncAgain = false, syncFile = null;
const SYNC_RX = /^gs\.(lib|setup|bank|rubrics|school|b\..+|rp\..+|rd\..+)$/;
{
  const raw = store.set.bind(store);
  store.set = (k, v) => { const ok = raw(k, v); if (ok && SYNC_RX.test(k)) syncSoon(); return ok; };
}
function setSyncState(s) { syncState = s; const el = document.getElementById('syncState'); if (el) el.textContent = s; }
function syncSoon() { if (!G.email || sampleOn()) return; clearTimeout(syncT); setSyncState('saving…'); syncT = setTimeout(syncNow, 15000); }
// The file and its version, so two devices saving at once can't write over each other: the second one is turned away and merges again.
async function syncRead() {
  if (!syncFile) { const f = (await (await gsync("files?spaces=appDataFolder&fields=files(id)&q=" + encodeURIComponent("name='" + SYNC_NAME + "' and trashed=false"))).json()).files[0]; syncFile = f ? { id: f.id } : null; }
  if (!syncFile) return null;
  const r = await gsync('files/' + syncFile.id + '?alt=media');
  syncFile.etag = r.headers.get('ETag');
  try { return await r.json(); } catch { return null; }
}
async function syncWrite(body) {
  if (syncFile) return gsync('https://www.googleapis.com/upload/drive/v3/files/' + syncFile.id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(syncFile.etag ? { 'If-Match': syncFile.etag } : {}) }, body });
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify({ name: SYNC_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
  fd.append('file', new Blob([body], { type: 'application/json' }));
  syncFile = { id: (await (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id };
}
const syncNone = { papers: async () => null, added: async () => null, edit: async () => null };   // papers never come through Drive
function syncNow() {
  if (!G.email || sampleOn()) return Promise.resolve();
  if (syncBusy) { syncAgain = true; return syncBusy; }
  clearTimeout(syncT);
  syncBusy = syncOnce().catch(e => {
    if (e && e.status === 412) { syncAgain = true; return; }   // the other device saved first: merge again with what it saved
    console.warn(e); setSyncState(/sign in/i.test(e && e.message) ? 'sign in again to sync' : 'not synced');
  }).finally(() => { syncBusy = null; if (syncAgain) { syncAgain = false; syncNow(); } });
  return syncBusy;
}
async function syncOnce() {
  setSyncState('syncing…');
  if (batch) await saveNow();
  const got = await syncRead(), B = got && got.app === 'Grading Studio sync' ? { work: got.work || {}, meta: got.meta || {}, tomb: got.tomb || {}, added: {}, edits: {}, lib: got.lib, ls: got.ls || {} } : null;
  const A = await localState(), dev = devId(), now = Date.now();
  let rows = [], tomb = A.tomb;
  if (B) {
    const libm = mergeLib(libHere(), B.lib, { dev, now });
    for (const w of Object.values(A.work)) if (libm.mapA[w.cls]) w.cls = libm.mapA[w.cls];
    for (const w of Object.values(B.work)) if (libm.mapB[w.cls]) w.cls = libm.mapB[w.cls];
    const plan = mergeStates(A, B, { dev, now, linked: libLinked(libm.lib, libm.cards) });
    libFollow(libm, plan.rows, dev, now);
    rows = plan.rows; tomb = plan.tomb;
    // The download open on screen keeps what's there; it takes what came in the next time round, once it's closed.
    const open = batch && batch.id, came = rows.filter(r => r.kind === 'new' || r.kind === 'gone' && r.onA || r.toA || (r.meta && JSON.stringify(r.meta) !== JSON.stringify(r.ma)));
    for (const row of came) if (row.id !== open && row.kind !== 'askGone') await applyRow(row, syncNone);
    if (libm.toA) { lib = migrateLib(libm.lib); libUndoForget(); if (!setLibFrom(lib)) throw browserFull(); if (batch && batch.assignment) { const f = findItem(batch.assignment.id); if (f) batch.assignment = f.it; } }
    store.set('gs.tomb', tomb);
    for (const [k, v] of Object.entries(mergeLs(carryLs(), B.ls, k => Object.keys(tomb).some(id => k.includes(id))))) lsPut(k, v);
    if (came.length || libm.toA) { bank = store.get('gs.bank', bank); if (!batch) { const su = store.get('gs.setup', null); if (su) setup = setupOver(su); } await loadKept(); renderLib(); if (typeof homeRender === 'function') homeRender(); if (PHONE && routeNow().v === 'scores') { ph.cols = null; phScoresRender(routeNow()); } }
    if (open && rows.some(r => r.id === open && r.toA)) syncAgain = false;   // nothing to push for it until it is closed and merged
  }
  // What goes up: the merged copy, with the papers left behind. A row's own "papers" says where they are kept, so it stays on each device.
  const out = { app: 'Grading Studio sync', v: 1, t: now, lib: libHere(), work: {}, meta: {}, tomb, ls: carryLs() };
  const ids = new Set([...Object.keys(A.work), ...Object.keys(A.meta), ...rows.map(r => r.id)]);
  for (const id of ids) {
    if (tomb[id]) continue;
    const row = rows.find(r => r.id === id), w = row ? row.work : A.work[id], m = row ? row.meta : A.meta[id];
    if (w) out.work[id] = w;
    if (m) { const { papers, size, ...rest } = m; out.meta[id] = rest; }
  }
  delete out.ls['gs.lib'];
  const body = JSON.stringify(out);
  if (!got || body !== JSON.stringify({ ...got, t: now })) await syncWrite(body);
  store.set('gs.syncAt', now);
  setSyncState('synced');
}
window.addEventListener('focus', () => { if (G.email) syncNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && G.email) syncNow(); });
// Signed in last time: reconnect quietly when the page opens. On an iPhone's home screen that's a quick trip to Google and back, once an hour at most.
if (GOK && G.email && gcid() && !sampleOn()) setTimeout(() => {
  if (G_REDIRECT && !(G.token && Date.now() < G.exp - 60000)) {
    let tried = false; try { tried = sessionStorage.getItem('gs.gQuiet') === '1'; sessionStorage.setItem('gs.gQuiet', '1'); } catch {}
    if (!tried) return gRedirect(SYNC_SCOPE, true);
    return setSyncState('sign in again to sync');
  }
  gToken(false).then(() => { renderGoogle(); syncNow(); }).catch(() => setSyncState('sign in again to sync'));
}, 400);
// Back from signing in on Google's page (an iPhone home-screen app), with no email kept yet: finish signing in.
if (GOK && G_REDIRECT && G.token && !G.email) setTimeout(() => gsync('about?fields=user(emailAddress)').then(r => r.json()).then(me => { G.email = me.user.emailAddress; store.set('gs.gEmail', G.email); renderGoogle(); toast('Signed in as ' + G.email); syncNow(); }).catch(e => toast(e.message)), 400);
