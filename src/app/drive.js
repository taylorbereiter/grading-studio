/* ---------------- Google sign-in: open from Drive, save to Drive, keep work the same on every computer ---------------- */
// Everything happens between this browser and Taylor's own Google account. The sign-in is never stored or sent anywhere else.
const GOOGLE_CLIENT_ID = '/*@@GCID@@*/';
const gcid = () => (/apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID) ? GOOGLE_CLIENT_ID : '') || store.get('gs.gcid', '');
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata';
const G = { token: null, exp: 0, client: null, email: store.get('gs.gEmail', ''), waiters: [] };
let gisP = null;
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return gisP || (gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { gisP = null; rej(new Error('Couldn’t reach Google. Check the internet connection.')); }; document.head.appendChild(s); }));
}
// Gets a fresh token; silent when she's already signed in to Google in this browser.
async function gToken(interactive) {
  if (G.token && Date.now() < G.exp - 60000) return G.token;
  if (!gcid()) throw new Error('setup');
  await loadGis();
  if (!G.client) G.client = google.accounts.oauth2.initTokenClient({
    client_id: gcid(), scope: DRIVE_SCOPES, hint: G.email || undefined,
    callback: r => { const w = G.waiters.splice(0); if (r.error) w.forEach(x => x.rej(new Error(r.error))); else { G.token = r.access_token; G.exp = Date.now() + (r.expires_in || 3600) * 1000; w.forEach(x => x.res(G.token)); } },
    error_callback: e => { const w = G.waiters.splice(0); w.forEach(x => x.rej(new Error(e && e.type === 'popup_closed' ? 'Sign-in was closed' : 'Sign-in didn’t finish'))); },
  });
  return new Promise((res, rej) => { G.waiters.push({ res, rej }); G.client.requestAccessToken({ prompt: interactive && !G.email ? 'consent' : '' }); });
}
async function gfetch(url, opt = {}, interactive) {
  const t = await gToken(interactive);
  const r = await fetch(url.startsWith('http') ? url : 'https://www.googleapis.com/drive/v3/' + url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + t } });
  if (r.status === 401) { G.token = null; return gfetch(url, opt, interactive); }
  if (!r.ok) throw new Error('Google Drive said ' + r.status + ': ' + ((await r.text()).match(/"message":\s*"([^"]+)/) || [, ''])[1]);
  return r;
}
const gjson = (u, o, i) => gfetch(u, o, i).then(r => r.json());
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
    const me = await gjson('about?fields=user(emailAddress)');
    G.email = me.user.emailAddress; store.set('gs.gEmail', G.email);
    renderGoogle(); toast('Signed in as ' + G.email);
    syncPull();
  } catch (e) { toast(e.message || 'Sign-in didn’t finish'); }
}
function signOut() {
  if (G.token && window.google) try { google.accounts.oauth2.revoke(G.token); } catch {}
  G.token = null; G.email = ''; store.del('gs.gEmail'); renderGoogle(); toast('Signed out of Google');
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

// Sync: units, assignments, rosters, setup, saved comments and each download's marks and scores, in a hidden app file in her Drive.
const SYNC_RX = /^gs\.(lib|setup|bank|batches|b\..+|rp\..+|rd\..+)$/;
const SYNC_NAME = 'grading-studio-sync.json';
let syncState = '', syncT = null, syncBusy = false, syncFileId = null;
const syncTimes = () => store.get('gs.syncT', {});
{
  const raw = store.set.bind(store);
  store.set = (k, v) => { const ok = raw(k, v); if (ok && SYNC_RX.test(k)) { const t = syncTimes(); t[k] = Date.now(); raw('gs.syncT', t); syncSoon(); } return ok; };
  const rawDel = store.del.bind(store);
  store.del = k => { rawDel(k); if (SYNC_RX.test(k)) { const t = syncTimes(); t[k] = -Date.now(); raw('gs.syncT', t); syncSoon(); } };
}
function setSyncState(s) { syncState = s; const el = document.getElementById('syncState'); if (el) el.textContent = s; }
function syncSoon() { if (!G.email) return; clearTimeout(syncT); setSyncState('saving…'); syncT = setTimeout(syncPush, 4000); }
async function syncFile() {
  if (syncFileId) return syncFileId;
  const f = (await gjson("files?spaces=appDataFolder&fields=files(id)&q=" + encodeURIComponent("name='" + SYNC_NAME + "'"))).files[0];
  return (syncFileId = f ? f.id : null);
}
async function syncRead() { const id = await syncFile(); return id ? await (await gfetch('files/' + id + '?alt=media')).json() : { t: {}, v: {} }; }
// Newest copy of each item wins, so work from two computers merges instead of overwriting.
async function syncPull() {
  if (!G.email || syncBusy) return;
  syncBusy = true; setSyncState('syncing…');
  try {
    const remote = await syncRead(), local = syncTimes(); let changed = 0;
    for (const [k, t] of Object.entries(remote.t || {})) {
      if (Math.abs(t) <= Math.abs(local[k] || 0)) continue;
      if (batch && k === batch.id) continue;   // the open download keeps what's on screen
      try { if (t < 0) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(remote.v[k])); } catch {}
      local[k] = t; changed++;
    }
    try { localStorage.setItem('gs.syncT', JSON.stringify(local)); } catch {}
    if (changed) {
      const l = store.get('gs.lib', null); if (l) lib = migrateLib(l);
      bank = store.get('gs.bank', bank);
      if (!batch) { const s = store.get('gs.setup', null); if (s) setup = setupOver(s); }
      renderLib(); if (batch) renderClassSel();
    }
    syncBusy = false;
    if (Object.keys(local).some(k => Math.abs(local[k]) > Math.abs((remote.t || {})[k] || 0))) await syncPush(); else setSyncState('synced');
  } catch (e) { syncBusy = false; setSyncState('not synced'); console.warn(e); }
}
async function syncPush() {
  if (!G.email) return;
  if (syncBusy) { syncSoon(); return; }
  syncBusy = true; setSyncState('saving…');
  try {
    const remote = await syncRead(), local = syncTimes(), out = { t: { ...(remote.t || {}) }, v: { ...(remote.v || {}) } };
    for (const [k, t] of Object.entries(local)) if (Math.abs(t) > Math.abs(out.t[k] || 0)) { out.t[k] = t; if (t < 0) delete out.v[k]; else out.v[k] = store.get(k, null); }
    const body = JSON.stringify(out), id = await syncFile();
    if (id) await gfetch('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    else {
      const fd = new FormData();
      fd.append('metadata', new Blob([JSON.stringify({ name: SYNC_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
      fd.append('file', new Blob([body], { type: 'application/json' }));
      syncFileId = (await (await gfetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id;
    }
    setSyncState('synced');
  } catch (e) { setSyncState('not synced'); console.warn(e); }
  syncBusy = false;
}
window.addEventListener('focus', () => { if (G.email && !batch) syncPull(); });
// Signed in last time: reconnect quietly when the page opens.
if (GOK && G.email && gcid()) setTimeout(() => gToken(false).then(() => { renderGoogle(); syncPull(); }).catch(() => { setSyncState('sign in again to sync'); }), 400);

